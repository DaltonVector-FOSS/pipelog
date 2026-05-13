//! Background clipboard sync: PID file + spawn/stop/status.

use crate::config;
use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

pub fn pid_path() -> PathBuf {
    let base = config::config_path()
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("sync.pid")
}

fn read_pid_raw() -> Option<u32> {
    let contents = fs::read_to_string(pid_path()).ok()?;
    contents.trim().parse().ok()
}

fn process_exists(pid: u32) -> bool {
    #[cfg(unix)]
    {
        use std::io::Error;
        let r = unsafe { libc::kill(pid as libc::pid_t, 0) };
        if r == 0 {
            return true;
        }
        let err = Error::last_os_error()
            .raw_os_error()
            .unwrap_or(0);
        err == libc::EPERM
    }
    #[cfg(windows)]
    {
        process_exists_windows(pid)
    }
}

#[cfg(windows)]
fn process_exists_windows(pid: u32) -> bool {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    // WinBase.h: STILL_ACTIVE when process exit code hasn't been finalized
    const STILL_ACTIVE: u32 = 259;

    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            return false;
        }
        let mut code = 0u32;
        let ok = GetExitCodeProcess(h, &mut code) != 0;
        let _ = CloseHandle(h);
        ok && code == STILL_ACTIVE
    }
}

/// Start detached `pipelog sync __run` and write its PID. Cleans stale PID file first.
pub fn start(bin_path: &Path) -> Result<()> {
    let parent = pid_path()
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    fs::create_dir_all(&parent).with_context(|| format!("create_dir_all {:?}", parent))?;

    if pid_path().exists() {
        if let Some(pid) = read_pid_raw() {
            if process_exists(pid) {
                anyhow::bail!("Clipboard sync is already running (PID {})", pid);
            }
        }
        fs::remove_file(pid_path()).ok();
    }

    let mut cmd = Command::new(bin_path);
    cmd.arg("sync")
        .arg("__run")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd
        .spawn()
        .with_context(|| format!("failed to spawn {}", bin_path.display()))?;

    let pid = child.id();
    drop(child);

    fs::write(pid_path(), format!("{}", pid)).context("writing sync.pid")?;
    println!("Clipboard sync daemon started (PID {}).", pid);
    Ok(())
}

pub fn stop() -> Result<()> {
    #[cfg(unix)]
    fn signal_stop(pid: u32) -> bool {
        unsafe { libc::kill(pid as libc::pid_t, libc::SIGTERM) == 0 }
    }

    #[cfg(windows)]
    fn signal_stop(pid: u32) -> bool {
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

        unsafe {
            let h = OpenProcess(PROCESS_TERMINATE, 0, pid);
            if h.is_null() {
                return false;
            }
            let ok = TerminateProcess(h, 1) != 0;
            let _ = CloseHandle(h);
            ok
        }
    }

    if !pid_path().exists() {
        println!("Clipboard sync daemon is not running.");
        return Ok(());
    }

    let pid = match read_pid_raw() {
        Some(p) => p,
        None => {
            fs::remove_file(pid_path()).ok();
            println!("Clipboard sync daemon is not running.");
            return Ok(());
        }
    };

    if !process_exists(pid) {
        fs::remove_file(pid_path()).ok();
        println!("Clipboard sync daemon is not running.");
        return Ok(());
    }

    if !signal_stop(pid) {
        anyhow::bail!("Failed to signal clipboard sync process (PID {})", pid);
    }

    #[cfg(unix)]
    {
        for _ in 0..30 {
            std::thread::sleep(Duration::from_millis(100));
            if !process_exists(pid) {
                break;
            }
        }
        if process_exists(pid) {
            let _ = unsafe { libc::kill(pid as libc::pid_t, libc::SIGKILL) };
        }
    }

    #[cfg(windows)]
    {
        std::thread::sleep(Duration::from_millis(200));
    }

    fs::remove_file(pid_path()).ok();
    println!("Clipboard sync daemon stopped.");
    Ok(())
}

/// Human-readable status line (no trailing newline required by caller).
pub fn status_line() -> String {
    if !pid_path().exists() {
        return "Clipboard sync: stopped".to_string();
    }
    let pid = match read_pid_raw() {
        Some(p) => p,
        None => {
            let _ = fs::remove_file(pid_path());
            return "Clipboard sync: stopped".to_string();
        }
    };
    if process_exists(pid) {
        format!("Clipboard sync: running (PID {})", pid)
    } else {
        let _ = fs::remove_file(pid_path());
        "Clipboard sync: stopped".to_string()
    }
}
