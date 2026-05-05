use crate::api::{Client, CreateEntry};
use anyhow::Result;
use colored::*;
use indicatif::{ProgressBar, ProgressStyle};
use std::io::{self, Read};
use std::path::PathBuf;
use std::process::Command as ProcessCommand;
use std::time::Duration;

const MAX_OUTPUT_BYTES: usize = 10 * 1024 * 1024; // 10MB

/// Strip leading byte-order marks. PowerShell 5.1 will sometimes prepend UTF-8 / UTF-16 BOMs
/// when piping to a native binary, which would make `output.trim().is_empty()` falsely false
/// or look like a single garbage character in the captured entry.
fn strip_bom(buf: &[u8]) -> &[u8] {
    if buf.starts_with(&[0xEF, 0xBB, 0xBF]) {
        &buf[3..]
    } else if buf.starts_with(&[0xFF, 0xFE]) || buf.starts_with(&[0xFE, 0xFF]) {
        &buf[2..]
    } else {
        buf
    }
}

fn sanitize_command_candidate(cmd: &str) -> Option<String> {
    let mut s = cmd
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();
    if s.is_empty() {
        return None;
    }

    // Drop leading prompt-ish markers like "(git)" that can leak in from shell/process views.
    loop {
        let trimmed = s.trim_start();
        if !trimmed.starts_with('(') {
            s = trimmed.to_string();
            break;
        }
        let Some(close_idx) = trimmed.find(')') else {
            break;
        };
        let after = trimmed[close_idx + 1..].trim_start();
        if after.is_empty() {
            return None;
        }
        s = after.to_string();
    }

    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Ignore bare "(name)" process display values (e.g. "(git)").
    if trimmed.starts_with('(') && trimmed.ends_with(')') {
        return None;
    }

    Some(trimmed.to_string())
}

/// True if this `|` segment is the pipelog invocation (possibly with path / quotes / `&`).
fn pipe_segment_invokes_pipelog(seg: &str) -> bool {
    let mut s = seg.trim();
    while let Some(rest) = s.strip_prefix('&') {
        s = rest.trim_start();
    }
    let first_raw = s.split_whitespace().next().unwrap_or("");
    let first = first_raw
        .trim_matches('"')
        .trim_matches('\'')
        .to_lowercase();
    if first.is_empty() {
        return false;
    }
    first == "pipelog"
        || first.ends_with("\\pipelog.exe")
        || first.ends_with("/pipelog.exe")
        || first.ends_with("\\pipelog")
        || first.ends_with("/pipelog")
        || first.starts_with("pipelog")
}

fn extract_command_before_pipelog_in_pipeline(full: &str) -> Option<String> {
    let segments: Vec<&str> = full.split('|').collect();
    for i in 0..segments.len() {
        let seg = segments[i].trim();
        if i == 0 || !pipe_segment_invokes_pipelog(seg) {
            continue;
        }
        let candidate = segments[i - 1].trim().trim_matches('"').trim_matches('\'');
        if candidate.is_empty() {
            continue;
        }
        return command_before_pipelog(candidate);
    }
    None
}

fn command_before_pipelog(cmd: &str) -> Option<String> {
    let trimmed = cmd.trim();
    if trimmed.is_empty() {
        return None;
    }

    let segments: Vec<&str> = trimmed.split('|').collect();
    if segments.len() > 1 {
        for i in 1..segments.len() {
            if pipe_segment_invokes_pipelog(segments[i]) {
                return sanitize_command_candidate(segments[i - 1]);
            }
        }
    }

    sanitize_command_candidate(trimmed)
}

fn infer_command_from_parent() -> Option<String> {
    // Allow explicit shell-provided override.
    if let Ok(cmd) = std::env::var("PIPELOG_CMD") {
        if let Some(cleaned) = command_before_pipelog(&cmd) {
            return Some(cleaned);
        }
    }

    // zsh init snippet stores this command in preexec.
    if let Ok(cmd) = std::env::var("PIPELOG_LAST_COMMAND") {
        if let Some(cleaned) = command_before_pipelog(&cmd) {
            return Some(cleaned);
        }
    }

    #[cfg(unix)]
    {
        // Best effort: inspect sibling processes in the same process group (short-lived producers).
        if let Some(cmd) = infer_command_from_process_group() {
            return Some(cmd);
        }

        let pid = std::process::id().to_string();
        let ppid_output = ProcessCommand::new("ps")
            .args(["-o", "ppid=", "-p", &pid])
            .output()
            .ok()?;
        let ppid = String::from_utf8_lossy(&ppid_output.stdout)
            .trim()
            .to_string();
        if ppid.is_empty() {
            return infer_command_from_shell_history();
        }

        let parent_output = ProcessCommand::new("ps")
            .args(["-o", "command=", "-p", &ppid])
            .output()
            .ok()?;
        let parent_cmd = String::from_utf8_lossy(&parent_output.stdout)
            .trim()
            .to_string();
        if parent_cmd.is_empty() {
            return infer_command_from_shell_history();
        }

        if let Some(cmd) = extract_command_before_pipelog_in_pipeline(&parent_cmd) {
            return Some(cmd);
        }
    }

    #[cfg(windows)]
    {
        if let Some(cmd) = infer_command_windows() {
            return Some(cmd);
        }
    }

    infer_command_from_shell_history()
}

#[cfg(windows)]
fn join_process_cmd(cmd: &[std::ffi::OsString]) -> String {
    cmd.iter()
        .map(|p| p.to_string_lossy())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Detect a `cmd.exe /S /D /c "<inner>"` wrapper and return `<inner>` (the actual command
/// the shell ran for one side of a pipeline).
#[cfg(windows)]
fn extract_cmd_c_payload(cmd: &str) -> Option<String> {
    let trimmed = cmd.trim_start();
    let lower = trimmed.to_lowercase();

    let is_cmd_exe = lower.starts_with("cmd ")
        || lower.starts_with("cmd.exe ")
        || lower == "cmd"
        || lower == "cmd.exe"
        || lower.starts_with("\"cmd")
        || lower.contains("\\cmd.exe ")
        || lower.contains("/cmd.exe ");
    if !is_cmd_exe {
        return None;
    }

    // Find the `/c` (or `/k`) flag, case-insensitively, with surrounding whitespace.
    let bytes = trimmed.as_bytes();
    let lower_bytes = lower.as_bytes();
    let mut i = 0;
    while i + 2 < bytes.len() {
        let prev_ws = i == 0 || (bytes[i - 1] as char).is_whitespace();
        if prev_ws
            && bytes[i] == b'/'
            && (lower_bytes[i + 1] == b'c' || lower_bytes[i + 1] == b'k')
            && (i + 2 == bytes.len() || (bytes[i + 2] as char).is_whitespace())
        {
            let rest = trimmed[i + 2..].trim_start();
            // Strip ONE pair of surrounding quotes (cmd's `/c " ... "` form).
            let rest = if rest.starts_with('"') && rest.ends_with('"') && rest.len() >= 2 {
                &rest[1..rest.len() - 1]
            } else {
                rest
            };
            let rest = rest.trim();
            if rest.is_empty() {
                return None;
            }
            return Some(rest.to_string());
        }
        i += 1;
    }
    None
}

/// Heuristic: this command line looks like just an interactive shell (no inline pipeline),
/// so we cannot recover the user's command from it.
#[cfg(windows)]
fn cmdline_looks_like_bare_shell(cmd: &str) -> bool {
    let lower = cmd.trim().to_lowercase();
    // Bare interactive shells: "cmd.exe", "powershell.exe", "pwsh.exe", possibly with a path.
    let last = lower.rsplit('\\').next().unwrap_or(&lower).to_string();
    matches!(
        last.as_str(),
        "cmd" | "cmd.exe" | "powershell" | "powershell.exe" | "pwsh" | "pwsh.exe"
    )
}

/// Windows has no `ps`. We have to walk the process tree:
///   1. Parent's command line might already contain the pipeline (PowerShell external chains).
///   2. CMD wraps each side of `a | b` in its own `cmd /c " ... "` child, so the sibling of our
///      parent (under the grandparent shell) holds the producer command. Walk up + scan descendants.
#[cfg(windows)]
fn infer_command_windows() -> Option<String> {
    use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

    fn cmd_line_for(proc: &Process) -> String {
        join_process_cmd(proc.cmd())
    }

    let mut sys = System::new();
    let my_pid = Pid::from_u32(std::process::id());
    let refresh_kind = ProcessRefreshKind::nothing()
        .with_cmd(UpdateKind::Always)
        .without_tasks();

    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind);

    let parent_pid = sys.process(my_pid)?.parent()?;

    // (1) Parent's own command line: works when the shell embedded the whole pipeline
    // (e.g. PowerShell run as `powershell -Command "dir | pipelog"` — though rare interactively).
    if let Some(parent_proc) = sys.process(parent_pid) {
        let parent_cmd = cmd_line_for(parent_proc);
        if let Some(cmd) = extract_command_before_pipelog_in_pipeline(&parent_cmd) {
            return Some(cmd);
        }
    }

    // (2) Walk up the ancestor chain so we can find the sibling of any wrapper that holds the
    // producer side. Stop at obviously-uninformative roots.
    let mut chain: Vec<Pid> = vec![parent_pid];
    let mut cur = parent_pid;
    for _ in 0..6 {
        let Some(p) = sys.process(cur).and_then(|p| p.parent()) else {
            break;
        };
        chain.push(p);
        cur = p;
    }

    // For each ancestor, scan its children that are NOT in our parent chain. These are siblings
    // of (a wrapper of) us — i.e. the other sides of the pipeline.
    for ancestor in chain.iter() {
        for (pid, proc) in sys.processes() {
            if *pid == my_pid || chain.contains(pid) {
                continue;
            }
            if proc.parent() != Some(*ancestor) {
                continue;
            }

            let raw_cmd = cmd_line_for(proc);
            if raw_cmd.is_empty() {
                continue;
            }
            if raw_cmd.to_lowercase().contains("pipelog") {
                continue;
            }

            // Unwrap `cmd /c " <real> "` so we report `<real>` instead of the wrapper.
            let unwrapped = extract_cmd_c_payload(&raw_cmd).unwrap_or(raw_cmd.clone());

            if cmdline_looks_like_bare_shell(&unwrapped) {
                continue;
            }
            if unwrapped.to_lowercase().contains("pipelog") {
                continue;
            }

            // The unwrapped cmd may itself be a pipeline ("a | b | pipelog") if the ancestor
            // is the original interactive shell with the whole line embedded.
            if let Some(cmd) = extract_command_before_pipelog_in_pipeline(&unwrapped) {
                return Some(cmd);
            }
            if let Some(cleaned) = sanitize_command_candidate(&unwrapped) {
                return Some(cleaned);
            }
        }
    }

    None
}

#[cfg(unix)]
fn infer_command_from_process_group() -> Option<String> {
    let pid = std::process::id().to_string();
    let pgid_output = ProcessCommand::new("ps")
        .args(["-o", "pgid=", "-p", &pid])
        .output()
        .ok()?;
    let pgid = String::from_utf8_lossy(&pgid_output.stdout)
        .trim()
        .to_string();
    if pgid.is_empty() {
        return None;
    }

    let procs_output = ProcessCommand::new("ps")
        .args(["-o", "pid=,command=", "-g", &pgid])
        .output()
        .ok()?;
    let body = String::from_utf8_lossy(&procs_output.stdout);

    // In `cmd | pipelog`, the sibling producer process is usually in the same
    // process group and does not include "pipelog" in its command string.
    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut parts = trimmed.split_whitespace();
        let Some(line_pid) = parts.next() else {
            continue;
        };
        let Ok(line_pid_num) = line_pid.parse::<u32>() else {
            continue;
        };
        if line_pid_num == std::process::id() {
            continue;
        }

        let cmd = parts.collect::<Vec<_>>().join(" ");
        let cmd_lc = cmd.to_lowercase();
        if cmd.is_empty()
            || cmd_lc.contains("pipelog")
            || cmd_lc.starts_with("zsh")
            || cmd_lc.starts_with("bash")
            || cmd_lc.starts_with("sh")
            || cmd_lc.starts_with("ps ")
        {
            continue;
        }

        if let Some(cleaned) = sanitize_command_candidate(&cmd) {
            return Some(cleaned);
        }
    }

    None
}

fn read_last_zsh_history_entry() -> Option<String> {
    let mut paths: Vec<PathBuf> = Vec::new();
    if let Ok(p) = std::env::var("HISTFILE") {
        if !p.is_empty() {
            paths.push(PathBuf::from(p));
        }
    }
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join(".zsh_history"));
        paths.push(home.join(".histfile"));
    }

    for path in paths {
        if !path.exists() {
            continue;
        }
        let bytes = std::fs::read(&path).ok()?;
        // zsh history can be in non-utf8 (extended history metachar 0x83 etc.).
        let text = String::from_utf8_lossy(&bytes);
        let lines: Vec<&str> = text.lines().collect();
        // Walk from the bottom and join continuations (lines ending in '\\').
        let mut current: Vec<String> = Vec::new();
        for line in lines.into_iter().rev() {
            current.insert(0, line.to_string());
            if !line.ends_with('\\') {
                break;
            }
        }
        let mut last = current.join("\n");

        // Extended-history format: ": <ts>:<dur>;<cmd>".
        if last.starts_with(':') {
            if let Some(idx) = last.find(';') {
                last = last[idx + 1..].to_string();
            }
        }

        let cleaned = last.trim().to_string();
        if !cleaned.is_empty() {
            return Some(cleaned);
        }
    }
    None
}

fn infer_command_from_shell_history() -> Option<String> {
    if let Some(cmd) = read_last_zsh_history_entry() {
        if let Some(cleaned) = command_before_pipelog(&cmd) {
            return Some(cleaned);
        }
    }

    let shell = std::env::var("SHELL").ok().unwrap_or_default();
    let output = if shell.contains("zsh") {
        ProcessCommand::new("zsh")
            .args(["-ic", "fc -ln -1"])
            .output()
            .ok()?
    } else if shell.contains("bash") {
        ProcessCommand::new("bash")
            .args(["-ic", "history 1"])
            .output()
            .ok()?
    } else {
        return None;
    };

    let mut cmd = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if cmd.is_empty() {
        return None;
    }

    // bash history lines often start with "<num>  ".
    if let Some((_, rest)) = cmd.split_once("  ") {
        if cmd.chars().next().is_some_and(|c| c.is_ascii_digit()) {
            cmd = rest.trim().to_string();
        }
    }

    command_before_pipelog(&cmd)
}

pub async fn run_capture(
    title: Option<String>,
    tags: Vec<String>,
    share: bool,
    command: Option<String>,
) -> Result<()> {
    // Check if stdin is a terminal (not a pipe)
    if atty::is(atty::Stream::Stdin) {
        eprintln!("{}", "Usage: <command> | pipelog [OPTIONS]".yellow());
        eprintln!("Example: npm run build | pipelog --title 'Build' --tag deploy");
        std::process::exit(1);
    }

    // Infer command before reading stdin so short-lived producers (like `ls`)
    // are still visible in the process table.
    let inferred_command = command.clone().or_else(infer_command_from_parent);
    let resolved_title = title.clone().or_else(|| inferred_command.clone());

    // Read all of stdin
    let mut buf = Vec::new();
    let mut stdin = io::stdin();
    stdin.read_to_end(&mut buf)?;

    if buf.len() > MAX_OUTPUT_BYTES {
        eprintln!("{} Output truncated to 10MB", "⚠".yellow());
        buf.truncate(MAX_OUTPUT_BYTES);
    }

    // Strip a leading UTF-8 / UTF-16 BOM that some shells (notably PowerShell 5.1) prepend.
    let buf = strip_bom(&buf);
    let output = String::from_utf8_lossy(buf).to_string();

    if output.trim().is_empty() {
        eprintln!(
            "{} {}",
            "✗".red().bold(),
            "Nothing was piped to pipelog.".yellow()
        );
        #[cfg(windows)]
        {
            eprintln!(
                "{}",
                "  PowerShell tip: Write-Host bypasses the pipeline.".dimmed()
            );
            eprintln!(
                "{}",
                "  Capture errors too: `your-script *>&1 | pipelog` (all streams)".dimmed()
            );
            eprintln!(
                "{}",
                "             or:    `your-script 2>&1 | pipelog` (stderr only)".dimmed()
            );
        }
        #[cfg(not(windows))]
        {
            eprintln!(
                "{}",
                "  Tip: include stderr with `your-cmd 2>&1 | pipelog`.".dimmed()
            );
        }
        return Ok(());
    }

    // Show spinner while uploading
    let spinner = ProgressBar::new_spinner();
    spinner.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap(),
    );
    spinner.set_message("Saving to Pipelog...");
    spinner.enable_steady_tick(Duration::from_millis(80));

    let client = match Client::new() {
        Ok(c) => c,
        Err(e) => {
            spinner.finish_and_clear();
            eprintln!("{} {}", "✗".red(), e);
            eprintln!("  Run {} to authenticate", "pipelog auth login".bold());
            return Ok(()); // Don't block the pipeline on auth failure
        }
    };

    let entry = CreateEntry {
        title: resolved_title,
        output,
        command: inferred_command,
        tags,
        exit_code: None,
        is_public: share,
    };

    match client.create_entry(entry).await {
        Ok(entry) => {
            spinner.finish_and_clear();
            let id_short = &entry.id[..8];
            if share {
                let cfg = crate::config::load()?;
                let share_token = entry.share_token.unwrap_or(entry.id.clone());
                let url = format!("{}/s/{}", cfg.web_url, share_token);
                println!(
                    "{} Saved & shared [{}] {}",
                    "✓".green().bold(),
                    id_short.cyan(),
                    url.underline().dimmed()
                );
            } else {
                println!(
                    "{} Saved [{}] — {} or {}",
                    "✓".green().bold(),
                    id_short.cyan(),
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
            eprintln!(
                "  {} {}",
                "hint:".dimmed(),
                "check `pipelog auth status` and your network connection".dimmed()
            );
            // Still exit 0 so we don't break pipelines.
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pipe_segment_recognizes_pipelog_variants() {
        assert!(pipe_segment_invokes_pipelog(" pipelog "));
        assert!(pipe_segment_invokes_pipelog("pipelog --tag x"));
        assert!(pipe_segment_invokes_pipelog("/usr/local/bin/pipelog"));
        assert!(pipe_segment_invokes_pipelog("./target/release/pipelog"));
        assert!(pipe_segment_invokes_pipelog(r"C:\tools\pipelog.exe"));
        assert!(pipe_segment_invokes_pipelog(r#""C:\tools\pipelog.exe""#));
        assert!(pipe_segment_invokes_pipelog("& pipelog.exe"));
        assert!(!pipe_segment_invokes_pipelog("git status"));
        assert!(!pipe_segment_invokes_pipelog(""));
    }

    #[test]
    fn extracts_command_before_pipelog_in_full_pipeline() {
        let s = "git log --oneline | pipelog --tag git";
        assert_eq!(
            extract_command_before_pipelog_in_pipeline(s).as_deref(),
            Some("git log --oneline")
        );

        let win = r#"dir | "C:\Users\me\.local\bin\pipelog.exe""#;
        assert_eq!(
            extract_command_before_pipelog_in_pipeline(win).as_deref(),
            Some("dir")
        );

        let no_pipelog = "echo hi | grep h";
        assert!(extract_command_before_pipelog_in_pipeline(no_pipelog).is_none());
    }

    #[cfg(windows)]
    #[test]
    fn unwraps_cmd_c_wrapper() {
        // sysinfo joins argv with spaces; cmd's `/c " dir "` shows up like this:
        assert_eq!(
            extract_cmd_c_payload(r#"cmd.exe /S /D /c " dir ""#).as_deref(),
            Some("dir")
        );
        assert_eq!(
            extract_cmd_c_payload("cmd.exe /S /D /c  dir ").as_deref(),
            Some("dir")
        );
        assert_eq!(
            extract_cmd_c_payload(r#"C:\Windows\System32\cmd.exe /c "git status""#).as_deref(),
            Some("git status")
        );
        // The right side wrapper points at pipelog itself; we still unwrap, but the caller
        // filters that out by name.
        assert_eq!(
            extract_cmd_c_payload(r#"cmd.exe /S /D /c " pipelog ""#).as_deref(),
            Some("pipelog")
        );
        // Not cmd at all → no unwrap.
        assert!(extract_cmd_c_payload("git status").is_none());
        // /k (keep open) form, occasionally used.
        assert_eq!(
            extract_cmd_c_payload(r#"cmd.exe /k "echo hi""#).as_deref(),
            Some("echo hi")
        );
    }

    #[cfg(windows)]
    #[test]
    fn cmd_c_with_inner_pipeline_is_recoverable() {
        // Some shells embed the entire pipeline inside `/c`. Unwrap, then run pipeline parser.
        let inner = extract_cmd_c_payload(r#"cmd.exe /c "git log | pipelog --tag g""#).unwrap();
        assert_eq!(
            extract_command_before_pipelog_in_pipeline(&inner).as_deref(),
            Some("git log")
        );
    }

    #[cfg(windows)]
    #[test]
    fn bare_shell_detection() {
        assert!(cmdline_looks_like_bare_shell("cmd.exe"));
        assert!(cmdline_looks_like_bare_shell(
            r"C:\Windows\System32\cmd.exe"
        ));
        assert!(cmdline_looks_like_bare_shell("powershell.exe"));
        assert!(cmdline_looks_like_bare_shell("pwsh.exe"));
        assert!(!cmdline_looks_like_bare_shell("cmd.exe /c dir"));
        assert!(!cmdline_looks_like_bare_shell("git status"));
    }
}
