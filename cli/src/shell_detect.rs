//! Detect the user's interactive shell from environment variables and print
//! shell-specific setup hints after `pipelog auth login`.

use colored::Colorize;
use std::path::Path;

/// High-level shell families used for post-login UX and `pipelog init auto`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellFamily {
    Zsh,
    Bash,
    Fish,
    /// Windows PowerShell 5.1 (default when no other signal).
    PowerShell,
    /// PowerShell 7+ (`pwsh`).
    Pwsh,
    /// Minimal POSIX shells (sh, dash, ash, …) — no reliable preexec hook.
    PosixSh,
    Unknown,
}

/// Environment inputs for [`detect_shell_family`].
#[derive(Debug, Clone, Default)]
pub struct ShellEnv {
    pub pipelog_shell: Option<String>,
    pub shell: Option<String>,
}

impl ShellEnv {
    pub fn from_process() -> Self {
        Self {
            pipelog_shell: std::env::var("PIPELOG_SHELL").ok(),
            shell: std::env::var("SHELL").ok(),
        }
    }
}

fn basename_lower(path: &str) -> String {
    let t = path.trim();
    if t.is_empty() {
        return String::new();
    }
    Path::new(t)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(t)
        .to_lowercase()
}

fn strip_exe(name: &str) -> &str {
    name
        .strip_suffix(".exe")
        .or_else(|| name.strip_suffix(".EXE"))
        .unwrap_or(name)
}

/// Map a bare name (e.g. `zsh`, `bash.exe`) to a family. Returns `None` if the token is empty
/// or not a known shell name (caller may fall through to other env).
fn family_from_name(name: &str) -> Option<ShellFamily> {
    let base = basename_lower(name);
    let key = strip_exe(&base);
    match key {
        "" => None,
        "zsh" => Some(ShellFamily::Zsh),
        "bash" => Some(ShellFamily::Bash),
        "fish" => Some(ShellFamily::Fish),
        "pwsh" => Some(ShellFamily::Pwsh),
        "powershell" | "powershell_ise" => Some(ShellFamily::PowerShell),
        "sh" | "dash" | "ash" | "busybox" | "ksh" | "mksh" | "yash" => Some(ShellFamily::PosixSh),
        _ => None,
    }
}

/// Classify shell from `PIPELOG_SHELL` and `SHELL`. Unknown override values are ignored so `SHELL`
/// can still be used.
pub fn detect_shell_family(env: &ShellEnv, is_windows: bool) -> ShellFamily {
    if let Some(ref raw) = env.pipelog_shell {
        let t = raw.trim();
        if !t.is_empty() {
            if let Some(f) = family_from_name(t) {
                return f;
            }
        }
    }
    if let Some(ref sh) = env.shell {
        if let Some(f) = family_from_name(sh) {
            return f;
        }
    }
    if is_windows {
        ShellFamily::PowerShell
    } else {
        ShellFamily::Unknown
    }
}

/// Default `pipelog init <name>` when the user runs `pipelog init auto`.
pub fn auto_init_shell_key(family: ShellFamily, is_windows: bool) -> &'static str {
    match family {
        ShellFamily::Zsh => "zsh",
        ShellFamily::Bash => "bash",
        ShellFamily::Fish => "fish",
        ShellFamily::PowerShell | ShellFamily::Pwsh => "powershell",
        ShellFamily::PosixSh | ShellFamily::Unknown => {
            if is_windows {
                "powershell"
            } else {
                "zsh"
            }
        }
    }
}

/// Resolve CLI argument: `auto` → detected init key; otherwise pass through normalized name.
pub fn resolve_init_shell_argument(shell: &str, is_windows: bool) -> String {
    let s = shell.trim();
    if s.is_empty() || s.eq_ignore_ascii_case("auto") {
        let env = ShellEnv::from_process();
        let fam = detect_shell_family(&env, is_windows);
        return auto_init_shell_key(fam, is_windows).to_string();
    }
    let lower = s.to_lowercase();
    // Normalize pwsh → powershell for snippet lookup (same script).
    if lower == "pwsh" {
        return "powershell".to_string();
    }
    lower
}

pub fn hint_for_detected_shell() {
    let env = ShellEnv::from_process();
    print_shell_integration_hint(detect_shell_family(&env, cfg!(windows)));
}

pub fn print_shell_integration_hint(family: ShellFamily) {
    println!();
    match family {
        ShellFamily::Zsh => {
            println!(
                "{}",
                "Run once (zsh — captures the left-hand command before | pipelog):".dimmed()
            );
            println!("{}", "pipelog init zsh >> ~/.zshrc".cyan());
            println!("{}", "source ~/.zshrc".cyan());
        }
        ShellFamily::Bash => {
            println!(
                "{}",
                "Run once (bash — captures the left-hand command before | pipelog):".dimmed()
            );
            println!(
                "{}",
                "pipelog init bash >> ~/.bashrc    # login shells on macOS may use ~/.bash_profile instead"
                    .cyan()
            );
            println!("{}", "source ~/.bashrc                   # or: source ~/.bash_profile".cyan());
        }
        ShellFamily::Fish => {
            println!(
                "{}",
                "Run once (fish — captures the left-hand command before | pipelog):".dimmed()
            );
            println!(
                "{}",
                "mkdir -p ~/.config/fish && pipelog init fish >> ~/.config/fish/config.fish".cyan()
            );
            println!("{}", "source ~/.config/fish/config.fish".cyan());
        }
        ShellFamily::PowerShell => {
            println!(
                "{}",
                "Run once (PowerShell — captures the pipeline producer before | pipelog):".dimmed()
            );
            println!(
                "{}",
                "if (!(Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force | Out-Null }"
                    .cyan()
            );
            println!(
                "{}",
                "pipelog init powershell | Out-File -Append -Encoding utf8 $PROFILE".cyan()
            );
            println!("{}", ". $PROFILE                         # or open a new terminal".cyan());
        }
        ShellFamily::Pwsh => {
            println!(
                "{}",
                "Run once (PowerShell 7+ — captures the pipeline producer before | pipelog):"
                    .dimmed()
            );
            println!(
                "{}",
                "if (!(Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force | Out-Null }"
                    .cyan()
            );
            println!(
                "{}",
                "pipelog init powershell | Out-File -Append -Encoding utf8 $PROFILE".cyan()
            );
            println!("{}", ". $PROFILE                         # or open a new terminal".cyan());
        }
        ShellFamily::PosixSh => {
            println!("{}", "Your shell looks like POSIX sh — no portable way to hook “last command before a pipe”. You can either:".dimmed());
            println!(
                "{}",
                "Pass the command explicitly: pipelog --cmd 'your-command' ..."
                .cyan()
            );
            println!(
                "{}",
                "Use bash, zsh, fish, or PowerShell and run: pipelog init <shell>"
                .cyan()
            );
        }
        ShellFamily::Unknown => {
            println!(
                "{}",
                "Pick shell integration — enables capturing the producer before \"| pipelog\":"
                    .dimmed()
            );
            println!("{}", "  pipelog init zsh".cyan());
            println!("{}", "  pipelog init bash".cyan());
            println!("{}", "  pipelog init fish".cyan());
            println!("{}", "  pipelog init powershell".cyan());
            println!("{}", "Then append the output to your shell profile (see: pipelog init --help).".dimmed());
        }
    }
    println!();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn classify(pipelog: Option<&str>, shell: Option<&str>, win: bool) -> ShellFamily {
        detect_shell_family(
            &ShellEnv {
                pipelog_shell: pipelog.map(String::from),
                shell: shell.map(String::from),
            },
            win,
        )
    }

    #[test]
    fn pipelog_shell_override() {
        assert_eq!(
            classify(Some("fish"), Some("/bin/zsh"), false),
            ShellFamily::Fish
        );
    }

    #[test]
    fn invalid_pipelog_falls_through_to_shell() {
        assert_eq!(
            classify(Some("not-a-shell"), Some("/bin/bash"), false),
            ShellFamily::Bash
        );
    }

    #[test]
    fn shell_basename() {
        assert_eq!(classify(None, Some("/opt/homebrew/bin/zsh"), false), ShellFamily::Zsh);
    }

    #[test]
    fn windows_default_powershell() {
        assert_eq!(classify(None, None, true), ShellFamily::PowerShell);
    }

    #[test]
    fn unix_unknown_without_shell() {
        assert_eq!(classify(None, None, false), ShellFamily::Unknown);
    }

    #[test]
    fn posix_sh() {
        assert_eq!(classify(None, Some("/bin/sh"), false), ShellFamily::PosixSh);
        assert_eq!(classify(None, Some("dash"), false), ShellFamily::PosixSh);
    }

    #[test]
    fn pwsh_token() {
        assert_eq!(classify(None, Some("pwsh"), false), ShellFamily::Pwsh);
    }

    #[test]
    fn auto_init_keys() {
        assert_eq!(auto_init_shell_key(ShellFamily::Fish, false), "fish");
        assert_eq!(auto_init_shell_key(ShellFamily::PosixSh, false), "zsh");
        assert_eq!(auto_init_shell_key(ShellFamily::Unknown, true), "powershell");
    }

    #[test]
    fn resolve_pass_through_and_pwsh_alias() {
        assert_eq!(resolve_init_shell_argument("bash", false), "bash");
        assert_eq!(resolve_init_shell_argument("pwsh", false), "powershell");
    }
}
