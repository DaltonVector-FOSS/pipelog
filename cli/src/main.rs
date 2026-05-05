mod auth;
mod api;
mod config;
mod capture;

use clap::{Parser, Subcommand};
use colored::*;

#[derive(Parser)]
#[command(
    name = "pipelog",
    about = "Capture and share command output with your team",
    version = "0.1.0"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Entry title (when piping)
    #[arg(short, long)]
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
        /// Shell type (currently: zsh)
        #[arg(default_value = "zsh")]
        shell: String,
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
            print_shell_init(&shell)?;
        }
    }

    Ok(())
}

fn print_shell_init(shell: &str) -> anyhow::Result<()> {
    match shell {
        "zsh" => {
            let snippet = r#"# pipelog shell integration (zsh)
typeset -g PIPELOG_LAST_COMMAND=""

_pipelog_preexec() {
  PIPELOG_LAST_COMMAND="$1"
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
      [[ "$arg" == "--title" ]] && has_title=1
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
        _ => {
            return Err(anyhow::anyhow!(
                "Unsupported shell '{}'. Use: pipelog init zsh",
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
    println!("{} {}", "Shareable link:".green().bold(), url.cyan().underline());
    Ok(())
}

async fn show_entry(id: String) -> anyhow::Result<()> {
    let client = api::Client::new()?;
    let entry = client.get_entry(&id).await?;

    println!("\n{} {}", "ID:".dimmed(), entry.id.cyan());
    println!(
        "{} {}",
        "Title:".dimmed(),
        entry
            .title
            .unwrap_or_else(|| "untitled".to_string())
            .bold()
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
        if entry.is_public { "yes".green() } else { "no".dimmed() }
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
