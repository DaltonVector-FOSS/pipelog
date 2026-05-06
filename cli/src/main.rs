mod api;
mod auth;
mod capture;
mod config;
mod runner;
mod shell_detect;

use clap::{Parser, Subcommand};
use colored::*;

#[derive(Parser)]
#[command(
    name = "pipelog",
    about = "Capture and share command output with your team",
    version = env!("CARGO_PKG_VERSION")
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Entry title (when piping)
    #[arg(short = 'T', long)]
    title: Option<String>,

    /// Tags (can be used multiple times)
    #[arg(short = 't', long = "tag")]
    tags: Vec<String>,

    /// Make entry public/shareable immediately
    #[arg(short, long)]
    share: bool,

    /// The original command that was run (for replay)
    #[arg(short, long)]
    cmd: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Authenticate with Pipelog
    Auth {
        #[command(subcommand)]
        action: AuthCommands,
    },
    /// List your recent entries
    List {
        /// Filter by tag
        #[arg(short, long)]
        tag: Option<String>,
        /// Number of entries to show
        #[arg(short, long, default_value = "20")]
        limit: u32,
    },
    /// Search entries
    Search {
        /// Search query
        query: String,
    },
    /// Replay a command from an entry
    Replay {
        /// Entry ID to replay
        id: String,
    },
    /// Share an entry (get shareable link)
    Share {
        /// Entry ID to share
        id: String,
    },
    /// Show details of an entry
    Show {
        /// Entry ID
        id: String,
    },
    /// Delete an entry
    Delete {
        /// Entry ID
        id: String,
    },
    /// Manage tags
    Tag {
        /// Entry ID
        id: String,
        /// Tags to add
        #[arg(short, long)]
        add: Vec<String>,
        /// Tags to remove
        #[arg(short, long)]
        remove: Vec<String>,
    },
    /// Open web dashboard
    Dashboard,
    /// Show current config
    Config,
    /// Print shell integration setup
    Init {
        /// Shell: zsh, bash, fish, powershell — or `auto` (from SHELL / PIPELOG_SHELL).
        /// Set PIPELOG_SHELL to override detection.
        #[arg(default_value = "auto")]
        shell: String,
    },
    /// Run a command, stream output live, and capture everything from start to end
    Run {
        /// Entry title (defaults to the command line)
        #[arg(short = 'T', long = "title")]
        title: Option<String>,
        /// Tags
        #[arg(short = 't', long = "tag")]
        tags: Vec<String>,
        /// Share publicly on save
        #[arg(short, long)]
        share: bool,
        /// The command to run (use -- to separate flags from the command)
        #[arg(trailing_var_arg = true, required = true, num_args = 1..)]
        argv: Vec<String>,
    },
}

#[derive(Subcommand)]
enum AuthCommands {
    /// Log in to Pipelog
    Login,
    /// Log out
    Logout,
    /// Show current auth status
    Status,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        None => {
            // No subcommand = piping mode
            capture::run_capture(cli.title, cli.tags, cli.share, cli.cmd).await?;
        }
        Some(Commands::Auth { action }) => match action {
            AuthCommands::Login => auth::login().await?,
            AuthCommands::Logout => auth::logout().await?,
            AuthCommands::Status => auth::status().await?,
        },
        Some(Commands::List { tag, limit }) => {
            list_entries(tag, limit).await?;
        }
        Some(Commands::Search { query }) => {
            search_entries(query).await?;
        }
        Some(Commands::Replay { id }) => {
            replay_entry(id).await?;
        }
        Some(Commands::Share { id }) => {
            share_entry(id).await?;
        }
        Some(Commands::Show { id }) => {
            show_entry(id).await?;
        }
        Some(Commands::Delete { id }) => {
            delete_entry(id).await?;
        }
        Some(Commands::Tag { id, add, remove }) => {
            update_tags(id, add, remove).await?;
        }
        Some(Commands::Dashboard) => {
            let cfg = config::load()?;
            let url = format!("{}/dashboard", cfg.web_url);
            println!("{} {}", "Opening".green(), url);
            open::that(url)?;
        }
        Some(Commands::Config) => {
            let cfg = config::load()?;
            println!("{}", serde_json::to_string_pretty(&cfg)?);
        }
        Some(Commands::Init { shell }) => {
            let resolved = shell_detect::resolve_init_shell_argument(&shell, cfg!(windows));
            print_shell_init(&resolved)?;
        }
        Some(Commands::Run {
            title,
            tags,
            share,
            argv,
        }) => {
            let code = runner::run_command(argv, title, tags, share).await?;
            std::process::exit(code);
        }
    }

    Ok(())
}

fn print_shell_init(shell: &str) -> anyhow::Result<()> {
    match shell {
        "sh" | "dash" | "ash" | "ksh" | "mksh" | "yash" | "busybox" => {
            return Err(anyhow::anyhow!(
                "POSIX shells like '{}' don't support pipelog's interactive pipeline hook. \
                 Use bash, zsh, fish, or PowerShell (`pipelog init <shell>`), \
                 or pass the command explicitly (`pipelog --cmd '...'`).",
                shell
            ));
        }
        "zsh" => {
            let snippet = r#"# pipelog shell integration (zsh)
typeset -gx PIPELOG_LAST_COMMAND=""

_pipelog_preexec() {
  typeset -gx PIPELOG_LAST_COMMAND="$1"
}
autoload -Uz add-zsh-hook 2>/dev/null || true
add-zsh-hook preexec _pipelog_preexec

pipelog() {
  if [[ ! -t 0 ]]; then
    local has_cmd=0
    local has_title=0
    local arg
    for arg in "$@"; do
      [[ "$arg" == "--cmd" ]] && has_cmd=1
      if [[ "$arg" == "--title" || "$arg" == "-t" ]]; then
        has_title=1
      fi
    done

    local left_cmd="${PIPELOG_LAST_COMMAND%%| pipelog*}"
    left_cmd="${left_cmd%%| /usr/local/bin/pipelog*}"
    left_cmd="${left_cmd%%| ./target/release/pipelog*}"
    left_cmd="${left_cmd%%| */pipelog*}"
    left_cmd="${left_cmd## }"
    left_cmd="${left_cmd%% }"

    if [[ $has_cmd -eq 0 && -n "$left_cmd" ]]; then
      if [[ $has_title -eq 0 ]]; then
        command pipelog --cmd "$left_cmd" --title "$left_cmd" "$@"
      else
        command pipelog --cmd "$left_cmd" "$@"
      fi
      return $?
    fi
  fi

  command pipelog "$@"
}
"#;
            println!("{}", snippet);
        }
        "bash" => {
            // PROMPT_COMMAND runs before each prompt; capture the last history line as a
            // lightweight preexec substitute (requires interactive bash with history enabled).
            let snippet = r#"# pipelog shell integration (bash — interactive; enable history as usual)
_pipelog_prompt_cmd() {
  local h
  h=$(HISTTIMEFORMAT= builtin history 1 2>/dev/null) || return 0
  export PIPELOG_LAST_COMMAND="$(sed -E 's/^[[:space:]]*[0-9]+[[:space:]]+//' <<<"$h")"
}
case ":${PROMPT_COMMAND:-}:" in
  *":_pipelog_prompt_cmd:"*) ;;
  *) PROMPT_COMMAND="_pipelog_prompt_cmd${PROMPT_COMMAND:+;$PROMPT_COMMAND}" ;;
esac

pipelog() {
  if [[ ! -t 0 ]]; then
    local has_cmd=0
    local has_title=0
    local arg
    for arg in "$@"; do
      [[ "$arg" == "--cmd" ]] && has_cmd=1
      if [[ "$arg" == "--title" || "$arg" == "-t" ]]; then
        has_title=1
      fi
    done

    local left_cmd="${PIPELOG_LAST_COMMAND%%| pipelog*}"
    left_cmd="${left_cmd%%| /usr/local/bin/pipelog*}"
    left_cmd="${left_cmd%%| ./target/release/pipelog*}"
    left_cmd="${left_cmd%%| */pipelog*}"
    left_cmd="${left_cmd## }"
    left_cmd="${left_cmd%% }"

    if [[ $has_cmd -eq 0 && -n "$left_cmd" ]]; then
      if [[ $has_title -eq 0 ]]; then
        command pipelog --cmd "$left_cmd" --title "$left_cmd" "$@"
      else
        command pipelog --cmd "$left_cmd" "$@"
      fi
      return $?
    fi
  fi

  command pipelog "$@"
}
"#;
            println!("{}", snippet);
        }
        "fish" => {
            let snippet = r#"# pipelog shell integration (fish 3+)

function __pipelog_fish_preexec --on-event fish_preexec
    set -gx PIPELOG_LAST_COMMAND (commandline)
end

function pipelog
    set -l exe (command -v pipelog 2>/dev/null)
    if test -z "$exe"
        echo 'pipelog: command not found' >&2
        return 127
    end

    set -l has_cmd 0
    set -l has_title 0
    for a in $argv
        if test "$a" = --cmd
            set has_cmd 1
        end
        if test "$a" = --title
            set has_title 1
        end
        string match -q -- -t "$a"
        and set has_title 1
    end

    if not test -t 0
        if test $has_cmd -eq 0; and test -n "$PIPELOG_LAST_COMMAND"
            set -l left (string replace -r '\s*\|\s*[^|]*pipelog(\.exe)?(\b.*)?$' '' "$PIPELOG_LAST_COMMAND")
            set left (string trim "$left")
            if test -n "$left"
                if test $has_title -eq 1
                    command pipelog --cmd "$left" $argv
                else
                    command pipelog --cmd "$left" --title "$left" $argv
                end
                return $status
            end
        end
    end

    command pipelog $argv
end
"#;
            println!("{}", snippet);
        }
        "powershell" | "pwsh" => {
            // PowerShell pipelines like `Get-ChildItem | pipelog` run entirely inside one
            // pwsh process, so we cannot recover the producer via process inspection. We use
            // PSReadLine's history hook as a "preexec" equivalent and stash the command in
            // $env:PIPELOG_LAST_COMMAND, then a wrapper function injects --cmd.
            //
            // We deliberately avoid [CmdletBinding] / a $Args parameter (which collides with
            // PowerShell's automatic $args variable). The wrapper just splats $args.
            //
            // We also force UTF-8 output encoding so pipelog receives clean bytes from
            // PowerShell 5.1 (which otherwise pipes ASCII-with-replacement to native exes).
            let snippet = r#"# pipelog shell integration (PowerShell 5.1+ / pwsh 7+)
try { $OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch { }
$env:PIPELOG_LAST_COMMAND = ''

if (Get-Module -ListAvailable -Name PSReadLine) {
    Import-Module PSReadLine -ErrorAction SilentlyContinue
    try {
        Set-PSReadLineOption -AddToHistoryHandler {
            param([string]$line)
            $env:PIPELOG_LAST_COMMAND = $line
            return $true
        }
    } catch { }
}

function pipelog {
    $exe = (Get-Command pipelog.exe -CommandType Application -ErrorAction SilentlyContinue |
            Select-Object -First 1).Source
    if (-not $exe) {
        Write-Error 'pipelog.exe not found on PATH.'
        return
    }

    $hasCmd = $false
    $hasTitle = $false
    foreach ($a in $args) {
        if ($a -eq '--cmd') { $hasCmd = $true }
        if ($a -eq '--title' -or $a -eq '-t') { $hasTitle = $true }
    }

    $stdinPiped = $false
    try { $stdinPiped = [Console]::IsInputRedirected } catch { }

    if ($stdinPiped -and -not $hasCmd -and $env:PIPELOG_LAST_COMMAND) {
        $line = $env:PIPELOG_LAST_COMMAND
        # Strip everything from the first ` | ... pipelog` onward, leaving the producer.
        $left = [regex]::Replace($line, '\s*\|\s*[^|]*pipelog(\.exe)?(\b.*)?$', '')
        $left = $left.Trim()

        if ($left) {
            if ($hasTitle) {
                & $exe --cmd $left @args
            } else {
                & $exe --cmd $left --title $left @args
            }
            return
        }
    }

    & $exe @args
}
"#;
            println!("{}", snippet);
        }
        _ => {
            return Err(anyhow::anyhow!(
                "Unsupported shell '{}'. Use: pipelog init <zsh|bash|fish|powershell> (or pwsh)",
                shell
            ));
        }
    }
    Ok(())
}

async fn list_entries(tag: Option<String>, limit: u32) -> anyhow::Result<()> {
    let client = api::Client::new()?;
    let entries = client.list_entries(tag, limit).await?;

    if entries.is_empty() {
        println!("{}", "No entries found.".dimmed());
        return Ok(());
    }

    println!(
        "\n{:<12} {:<30} {:<20} {:<10} {}",
        "ID".bold(),
        "TITLE".bold(),
        "TAGS".bold(),
        "STATUS".bold(),
        "CREATED".bold()
    );
    println!("{}", "─".repeat(90).dimmed());

    for entry in entries {
        let tags_str = entry.tags.join(", ");
        let status = if entry.is_public {
            "public".green()
        } else {
            "private".dimmed()
        };
        println!(
            "{:<12} {:<30} {:<20} {:<10} {}",
            entry.id[..8].cyan(),
            truncate(&entry.title.unwrap_or_else(|| "untitled".to_string()), 28),
            truncate(&tags_str, 18),
            status,
            entry.created_at[..10].to_string().dimmed()
        );
    }
    println!();
    Ok(())
}

async fn search_entries(query: String) -> anyhow::Result<()> {
    let client = api::Client::new()?;
    let entries = client.search_entries(&query).await?;

    if entries.is_empty() {
        println!("{}", "No results found.".dimmed());
        return Ok(());
    }

    println!("\n{} results for '{}':\n", entries.len(), query.cyan());
    for entry in entries {
        println!(
            "  {} {} {}",
            entry.id[..8].cyan(),
            entry.title.unwrap_or_else(|| "untitled".to_string()).bold(),
            format!("[{}]", entry.tags.join(", ")).dimmed()
        );
    }
    println!();
    Ok(())
}

async fn replay_entry(id: String) -> anyhow::Result<()> {
    let client = api::Client::new()?;
    let entry = client.get_entry(&id).await?;

    match entry.command {
        None => {
            eprintln!("{}", "This entry has no stored command to replay.".yellow());
        }
        Some(cmd) => {
            println!("{} {}", "Replaying:".green().bold(), cmd.cyan());
            println!("{}", "─".repeat(60).dimmed());

            let output = std::process::Command::new("sh")
                .arg("-c")
                .arg(&cmd)
                .output()?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            print!("{}", stdout);

            // Store the replay as a new entry
            let title = format!("Replay: {}", entry.title.unwrap_or_else(|| cmd.clone()));
            let new_entry = api::CreateEntry {
                title: Some(title),
                output: stdout,
                command: Some(cmd),
                tags: entry.tags,
                exit_code: output.status.code(),
                is_public: false,
            };
            client.create_entry(new_entry).await?;
            println!("\n{}", "✓ Replay saved as new entry".green().dimmed());
        }
    }
    Ok(())
}

async fn share_entry(id: String) -> anyhow::Result<()> {
    let client = api::Client::new()?;
    let entry = client.share_entry(&id).await?;
    let cfg = config::load()?;
    let url = format!("{}/s/{}", cfg.web_url, entry.share_token.unwrap_or(id));
    println!(
        "{} {}",
        "Shareable link:".green().bold(),
        url.cyan().underline()
    );
    Ok(())
}

async fn show_entry(id: String) -> anyhow::Result<()> {
    let client = api::Client::new()?;
    let entry = client.get_entry(&id).await?;

    println!("\n{} {}", "ID:".dimmed(), entry.id.cyan());
    println!(
        "{} {}",
        "Title:".dimmed(),
        entry.title.unwrap_or_else(|| "untitled".to_string()).bold()
    );
    println!("{} {}", "Tags:".dimmed(), entry.tags.join(", ").yellow());
    println!(
        "{} {}",
        "Command:".dimmed(),
        entry.command.unwrap_or_else(|| "—".to_string()).cyan()
    );
    println!(
        "{} {}",
        "Exit code:".dimmed(),
        entry
            .exit_code
            .map(|c| c.to_string())
            .unwrap_or_else(|| "—".to_string())
    );
    println!("{} {}", "Created:".dimmed(), entry.created_at.dimmed());
    println!(
        "{} {}",
        "Public:".dimmed(),
        if entry.is_public {
            "yes".green()
        } else {
            "no".dimmed()
        }
    );
    println!("\n{}", "─".repeat(60).dimmed());
    println!("{}", entry.output);
    Ok(())
}

async fn delete_entry(id: String) -> anyhow::Result<()> {
    let client = api::Client::new()?;
    client.delete_entry(&id).await?;
    println!("{} {}", "✓ Deleted".green(), id.dimmed());
    Ok(())
}

async fn update_tags(id: String, add: Vec<String>, remove: Vec<String>) -> anyhow::Result<()> {
    let client = api::Client::new()?;
    client.update_tags(&id, add, remove).await?;
    println!("{}", "✓ Tags updated".green());
    Ok(())
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}…", &s[..max - 1])
    }
}

#[cfg(test)]
mod init_shell_tests {
    use super::print_shell_init;

    #[test]
    fn posix_explicit_init_errors_with_guidance() {
        let msg = print_shell_init("dash").unwrap_err().to_string();
        assert!(
            msg.contains("POSIX shells") && msg.contains("pipelog init"),
            "{msg}"
        );
    }

    #[test]
    fn bash_fish_snippet_arms_execute() {
        print_shell_init("bash").unwrap();
        print_shell_init("fish").unwrap();
    }
}
