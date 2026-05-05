//! Run a command under a PTY (or piped fallback), tee output to the terminal, capture for upload + clipboard.

use crate::api::{Client, CreateEntry};
use anyhow::Result;
use colored::*;
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, PtySize};
use std::io::{self, Read, Write};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const MAX_OUTPUT_BYTES: usize = 10 * 1024 * 1024;
const TRUNCATION_MARKER: &str = "[... output truncated to last 10MB ...]\n\n";

#[cfg(windows)]
const CMD_BUILTINS: &[&str] = &[
    "assoc", "break", "call", "cd", "chdir", "cls", "color", "copy", "date", "del", "dir",
    "echo", "endlocal", "erase", "exit", "for", "ftype", "goto", "if", "md", "mkdir", "mklink",
    "move", "path", "pause", "popd", "prompt", "pushd", "rd", "rem", "ren", "rename", "rmdir",
    "set", "setlocal", "shift", "start", "time", "title", "type", "ver", "verify", "vol",
];

/// On Windows, ConPTY emits VT escape sequences that legacy `cmd.exe` shows as
/// literal `←[...` garbage unless `ENABLE_VIRTUAL_TERMINAL_PROCESSING` is set on
/// the console output handle. This is a best-effort, idempotent toggle.
#[cfg(windows)]
fn enable_vt_processing() {
    use windows_sys::Win32::System::Console::{
        GetConsoleMode, GetStdHandle, SetConsoleMode, ENABLE_PROCESSED_OUTPUT,
        ENABLE_VIRTUAL_TERMINAL_PROCESSING, STD_OUTPUT_HANDLE,
    };
    unsafe {
        let handle = GetStdHandle(STD_OUTPUT_HANDLE);
        if handle.is_null() || handle == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
            return;
        }
        let mut mode: u32 = 0;
        if GetConsoleMode(handle, &mut mode) == 0 {
            return;
        }
        let _ = SetConsoleMode(
            handle,
            mode | ENABLE_PROCESSED_OUTPUT | ENABLE_VIRTUAL_TERMINAL_PROCESSING,
        );
    }
}

#[cfg(not(windows))]
fn enable_vt_processing() {}

/// On Windows, `echo`, `dir`, etc. are `cmd.exe` built-ins and cannot be spawned
/// directly via `CreateProcess`. Detect a single-token, all-builtin invocation
/// and rewrite it to `cmd /c <args...>` so it Just Works.
#[cfg(windows)]
fn maybe_wrap_cmd_builtin(argv: Vec<String>) -> (Vec<String>, bool) {
    if argv.is_empty() {
        return (argv, false);
    }
    let head = argv[0].to_ascii_lowercase();
    if !CMD_BUILTINS.contains(&head.as_str()) {
        return (argv, false);
    }
    let mut wrapped = Vec::with_capacity(argv.len() + 2);
    wrapped.push("cmd".to_string());
    wrapped.push("/C".to_string());
    wrapped.extend(argv);
    (wrapped, true)
}

#[cfg(not(windows))]
fn maybe_wrap_cmd_builtin(argv: Vec<String>) -> (Vec<String>, bool) {
    (argv, false)
}

struct RawModeGuard(bool);

impl RawModeGuard {
    fn try_enable() -> Self {
        if atty::is(atty::Stream::Stdin) && crossterm::terminal::enable_raw_mode().is_ok() {
            return Self(true);
        }
        Self(false)
    }
}

impl Drop for RawModeGuard {
    fn drop(&mut self) {
        if self.0 {
            let _ = crossterm::terminal::disable_raw_mode();
        }
    }
}

fn append_capped(buf: &mut Vec<u8>, truncated: &AtomicBool, chunk: &[u8]) {
    if chunk.is_empty() {
        return;
    }
    let new_len = buf.len().saturating_add(chunk.len());
    if new_len > MAX_OUTPUT_BYTES {
        truncated.store(true, Ordering::Relaxed);
        buf.extend_from_slice(chunk);
        let overflow = buf.len() - MAX_OUTPUT_BYTES;
        if overflow > 0 {
            buf.drain(0..overflow);
        }
    } else {
        buf.extend_from_slice(chunk);
    }
}

fn pty_size_from_terminal() -> PtySize {
    let (cols, rows) = crossterm::terminal::size().unwrap_or((80, 24));
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn exit_status_to_code(status: &portable_pty::ExitStatus) -> i32 {
    if status.success() {
        0
    } else {
        status.exit_code() as i32
    }
}

fn status_code_std(status: std::process::ExitStatus) -> i32 {
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        if let Some(sig) = status.signal() {
            return 128 + sig;
        }
    }
    status.code().unwrap_or(-1)
}

/// Run with PTY (blocking). Returns (exit_code, raw_capture, truncated).
fn run_pty(argv: Vec<String>) -> Result<(i32, Vec<u8>, bool)> {
    if argv.is_empty() {
        anyhow::bail!("command required");
    }

    let mut iter = argv.into_iter();
    let prog = iter.next().unwrap();
    let mut cmd = CommandBuilder::new(prog);
    cmd.args(iter);
    // CommandBuilder defaults cwd to $HOME when unset; match normal shell behavior.
    if let Ok(cwd) = std::env::current_dir() {
        cmd.cwd(cwd);
    }

    let pty_system = native_pty_system();
    let pair = pty_system.openpty(pty_size_from_terminal())?;

    let mut child = pair.slave.spawn_command(cmd)?;
    let killer_shared: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>> =
        Arc::new(Mutex::new(child.clone_killer()));
    drop(pair.slave);

    let master = Arc::new(Mutex::new(pair.master));

    let reader = {
        let m = master.lock().unwrap();
        m.try_clone_reader()?
    };

    let writer = {
        let m = master.lock().unwrap();
        m.take_writer()?
    };
    let writer_shared: Arc<Mutex<Option<Box<dyn Write + Send>>>> =
        Arc::new(Mutex::new(Some(writer)));

    let capture = Arc::new(Mutex::new(Vec::<u8>::new()));
    let truncated_flag = Arc::new(AtomicBool::new(false));
    let capture_reader = capture.clone();
    let truncated_reader = truncated_flag.clone();

    let reader_handle = thread::spawn(move || -> io::Result<()> {
        let mut reader = reader;
        let mut stdout = io::stdout();
        let mut chunk = [0u8; 8192];
        loop {
            let n = reader.read(&mut chunk)?;
            if n == 0 {
                break;
            }
            stdout.write_all(&chunk[..n])?;
            stdout.flush().ok();
            let mut g = capture_reader.lock().unwrap();
            append_capped(&mut g, &truncated_reader, &chunk[..n]);
        }
        Ok(())
    });

    let _raw_guard = RawModeGuard::try_enable();

    let writer_for_stdin = writer_shared.clone();
    let shutdown_stdin = Arc::new(AtomicBool::new(false));
    let shutdown_stdin_thr = shutdown_stdin.clone();
    let stdin_thread = if atty::is(atty::Stream::Stdin) {
        Some(thread::spawn(move || {
            let mut stdin = io::stdin();
            let mut buf = [0u8; 4096];
            loop {
                if shutdown_stdin_thr.load(Ordering::SeqCst) {
                    break;
                }
                match stdin.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let mut guard = writer_for_stdin.lock().unwrap();
                        if let Some(w) = guard.as_mut() {
                            if w.write_all(&buf[..n]).is_err() {
                                break;
                            }
                            let _ = w.flush();
                        } else {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        }))
    } else {
        None
    };

    let sig_count = Arc::new(AtomicU32::new(0));

    #[cfg(unix)]
    {
        use signal_hook::consts::signal::{SIGINT, SIGWINCH};
        use signal_hook::iterator::Signals;

        let writer_sig = writer_shared.clone();
        let killer_sig = killer_shared.clone();
        let master_sig = master.clone();
        let sc = sig_count.clone();

        let mut signals = Signals::new([SIGINT, SIGWINCH])?;
        thread::spawn(move || {
            for signal in signals.forever() {
                match signal {
                    SIGINT => {
                        let n = sc.fetch_add(1, Ordering::SeqCst);
                        if n == 0 {
                            let mut guard = writer_sig.lock().unwrap();
                            if let Some(w) = guard.as_mut() {
                                let _ = w.write_all(b"\x03");
                                let _ = w.flush();
                            }
                        } else {
                            let _ = killer_sig.lock().unwrap().kill();
                        }
                    }
                    SIGWINCH => {
                        let new_size = pty_size_from_terminal();
                        let m = master_sig.lock().unwrap();
                        let _ = m.resize(new_size);
                    }
                    _ => {}
                }
            }
        });
    }

    #[cfg(windows)]
    {
        let writer_sig = writer_shared.clone();
        let killer_sig = killer_shared.clone();
        let sc = sig_count.clone();
        ctrlc::set_handler(move || {
            let n = sc.fetch_add(1, Ordering::SeqCst);
            if n == 0 {
                if let Ok(mut guard) = writer_sig.lock() {
                    if let Some(w) = guard.as_mut() {
                        let _ = w.write_all(b"\x03");
                        let _ = w.flush();
                    }
                }
            } else {
                let _ = killer_sig.lock().unwrap().kill();
            }
        })
        .map_err(|e| anyhow::anyhow!("ctrlc handler: {}", e))?;
    }

    if cfg!(target_os = "macos") {
        thread::sleep(Duration::from_millis(20));
    }

    let exit = child.wait()?;
    let code = exit_status_to_code(&exit);

    shutdown_stdin.store(true, Ordering::SeqCst);
    *writer_shared.lock().unwrap() = None;

    reader_handle
        .join()
        .map_err(|_| anyhow::anyhow!("reader thread panicked"))??;

    let (buf, truncated) = {
        let g = capture.lock().unwrap();
        (g.clone(), truncated_flag.load(Ordering::Relaxed))
    };

    drop(stdin_thread);

    Ok((code, buf, truncated))
}

fn run_pipes(argv: Vec<String>) -> Result<(i32, Vec<u8>, bool)> {
    if argv.is_empty() {
        anyhow::bail!("command required");
    }
    let mut iter = argv.into_iter();
    let prog = iter.next().unwrap();
    let args: Vec<_> = iter.collect();

    let capture = Arc::new(Mutex::new(Vec::<u8>::new()));
    let truncated_flag = Arc::new(AtomicBool::new(false));

    let child = Command::new(&prog)
        .args(&args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let child_arc = Arc::new(Mutex::new(Some(child)));
    #[cfg(unix)]
    let pid = {
        let g = child_arc.lock().unwrap();
        g.as_ref().unwrap().id()
    };

    let stdout = child_arc
        .lock()
        .unwrap()
        .as_mut()
        .unwrap()
        .stdout
        .take()
        .unwrap();
    let stderr = child_arc
        .lock()
        .unwrap()
        .as_mut()
        .unwrap()
        .stderr
        .take()
        .unwrap();

    let cap_out = capture.clone();
    let trunc_out = truncated_flag.clone();
    let h_out = thread::spawn(move || -> io::Result<()> {
        let mut reader = stdout;
        let mut stdout = io::stdout();
        let mut chunk = [0u8; 8192];
        loop {
            let n = reader.read(&mut chunk)?;
            if n == 0 {
                break;
            }
            stdout.write_all(&chunk[..n])?;
            stdout.flush().ok();
            let mut g = cap_out.lock().unwrap();
            append_capped(&mut g, &trunc_out, &chunk[..n]);
        }
        Ok(())
    });

    let cap_err = capture.clone();
    let trunc_err = truncated_flag.clone();
    let h_err = thread::spawn(move || -> io::Result<()> {
        let mut reader = stderr;
        let mut stderr = io::stderr();
        let mut chunk = [0u8; 8192];
        loop {
            let n = reader.read(&mut chunk)?;
            if n == 0 {
                break;
            }
            stderr.write_all(&chunk[..n])?;
            stderr.flush().ok();
            let mut g = cap_err.lock().unwrap();
            append_capped(&mut g, &trunc_err, &chunk[..n]);
        }
        Ok(())
    });

    #[cfg(unix)]
    {
        use signal_hook::consts::SIGINT;
        use signal_hook::iterator::Signals;

        let sc = Arc::new(AtomicU32::new(0));
        let sc2 = sc.clone();
        thread::spawn(move || {
            let Ok(mut signals) = Signals::new([SIGINT]) else {
                return;
            };
            for _ in signals.forever() {
                let n = sc2.fetch_add(1, Ordering::SeqCst);
                if n == 0 {
                    unsafe {
                        libc::kill(pid as libc::pid_t, libc::SIGINT);
                    }
                } else {
                    unsafe {
                        libc::kill(pid as libc::pid_t, libc::SIGKILL);
                    }
                }
            }
        });
    }

    #[cfg(windows)]
    {
        let child_kill = child_arc.clone();
        ctrlc::set_handler(move || {
            if let Ok(mut g) = child_kill.lock() {
                if let Some(c) = g.as_mut() {
                    let _ = c.kill();
                }
            }
        })
        .ok();
    }

    let status = {
        let mut g = child_arc.lock().unwrap();
        let c = g.as_mut().unwrap();
        c.wait()?
    };

    h_out
        .join()
        .map_err(|_| anyhow::anyhow!("stdout reader panicked"))??;
    h_err
        .join()
        .map_err(|_| anyhow::anyhow!("stderr reader panicked"))??;

    let buf = {
        let g = capture.lock().unwrap();
        g.clone()
    };
    let truncated = truncated_flag.load(Ordering::Relaxed);

    Ok((status_code_std(status), buf, truncated))
}

fn build_output_for_share(raw: &[u8], truncated: bool) -> String {
    let stripped = strip_ansi_escapes::strip(raw);
    let plain = String::from_utf8_lossy(&stripped);
    if truncated {
        format!("{}{}", TRUNCATION_MARKER, plain)
    } else {
        plain.into_owned()
    }
}

async fn finalize_and_upload(
    resolved_title: Option<String>,
    tags: Vec<String>,
    share: bool,
    command_line: String,
    exit_code: i32,
    raw: Vec<u8>,
    truncated: bool,
) -> Result<()> {
    let output = build_output_for_share(&raw, truncated);
    let line_count = output.lines().count();

    match arboard::Clipboard::new() {
        Ok(mut cb) => match cb.set_text(output.clone()) {
            Ok(()) => {}
            Err(e) => {
                eprintln!(
                    "{} {}",
                    "⚠".yellow(),
                    format!("Could not copy to clipboard: {}", e).dimmed()
                );
            }
        },
        Err(e) => {
            eprintln!(
                "{} {}",
                "⚠".yellow(),
                format!("Could not open clipboard: {}", e).dimmed()
            );
        }
    }

    let spinner = indicatif::ProgressBar::new_spinner();
    spinner.set_style(
        indicatif::ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap(),
    );
    spinner.set_message("Saving to Pipelog...");
    spinner.enable_steady_tick(Duration::from_millis(80));

    let client = match Client::new() {
        Ok(c) => c,
        Err(e) => {
            spinner.finish_and_clear();
            eprintln!("{} {}", "⚠".yellow(), e);
            eprintln!(
                "  Skipping upload; output was copied to clipboard. Authenticate with {}.",
                "pipelog auth login".bold()
            );
            println!(
                "{} {} — {} lines copied to clipboard",
                "✓".green().bold(),
                "Not uploaded (auth required)".dimmed(),
                line_count
            );
            return Ok(());
        }
    };

    let entry = CreateEntry {
        title: resolved_title,
        output: output.clone(),
        command: Some(command_line),
        tags,
        exit_code: Some(exit_code),
        is_public: share,
    };

    match client.create_entry(entry).await {
        Ok(entry) => {
            spinner.finish_and_clear();
            let id_short = &entry.id[..8];
            if share {
                let cfg = crate::config::load()?;
                let url = format!(
                    "{}/s/{}",
                    cfg.web_url,
                    entry.share_token.unwrap_or(entry.id.clone())
                );
                println!(
                    "{} Saved & shared [{}] — {} lines copied to clipboard",
                    "✓".green().bold(),
                    id_short.cyan(),
                    line_count
                );
                println!("{}", url.underline().dimmed());
            } else {
                println!(
                    "{} Saved [{}] — {} lines copied to clipboard; {} or {}",
                    "✓".green().bold(),
                    id_short.cyan(),
                    line_count,
                    format!("pipelog show {}", id_short).bold(),
                    "pipelog dashboard".dimmed()
                );
            }
        }
        Err(e) => {
            spinner.finish_and_clear();
            eprintln!();
            eprintln!(
                "{} {}",
                "✗".red().bold(),
                "Failed to save to Pipelog.".red()
            );
            eprintln!("  {} {}", "reason:".dimmed(), e);
            println!(
                "{} Output still copied to clipboard ({} lines)",
                "✓".green().bold(),
                line_count
            );
        }
    }

    Ok(())
}

/// Run `argv` as a subprocess, capture all output from start to finish, copy to clipboard and upload.
pub async fn run_command(
    argv: Vec<String>,
    title: Option<String>,
    tags: Vec<String>,
    share: bool,
) -> Result<i32> {
    if argv.is_empty() {
        anyhow::bail!("At least one argument (the program to run) is required.");
    }

    enable_vt_processing();

    let (effective_argv, wrapped_with_cmd) = maybe_wrap_cmd_builtin(argv);
    if wrapped_with_cmd {
        eprintln!(
            "{} {}",
            "ℹ".dimmed(),
            "wrapping cmd built-in via `cmd /C ...`".dimmed()
        );
    }

    let command_line = shell_words::join(effective_argv.iter());
    let resolved_title = title.clone().or_else(|| Some(command_line.clone()));

    let (exit_code, raw, truncated) = if atty::is(atty::Stream::Stdout) {
        let argv = effective_argv.clone();
        tokio::task::spawn_blocking(move || run_pty(argv))
            .await
            .map_err(|e| anyhow::anyhow!("join error: {}", e))??
    } else {
        let argv = effective_argv.clone();
        tokio::task::spawn_blocking(move || run_pipes(argv))
            .await
            .map_err(|e| anyhow::anyhow!("join error: {}", e))??
    };

    finalize_and_upload(resolved_title, tags, share, command_line, exit_code, raw, truncated)
        .await?;

    Ok(exit_code)
}
