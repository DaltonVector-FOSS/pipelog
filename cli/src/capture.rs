use anyhow::Result;
use colored::*;
use indicatif::{ProgressBar, ProgressStyle};
use std::io::{self, Read};
use std::process::Command as ProcessCommand;
use std::time::Duration;
use crate::api::{Client, CreateEntry};

const MAX_OUTPUT_BYTES: usize = 10 * 1024 * 1024; // 10MB

fn infer_command_from_parent() -> Option<String> {
    // Allow explicit shell-provided override.
    if let Ok(cmd) = std::env::var("PIPELOG_CMD") {
        let cmd = cmd.trim().to_string();
        if !cmd.is_empty() {
            return Some(cmd);
        }
    }

    // Best effort: inspect parent process command line and extract the command
    // segment just before a pipelog invocation in a pipeline.
    if let Some(cmd) = infer_command_from_process_group() {
        return Some(cmd);
    }

    let pid = std::process::id().to_string();
    let ppid_output = ProcessCommand::new("ps")
        .args(["-o", "ppid=", "-p", &pid])
        .output()
        .ok()?;
    let ppid = String::from_utf8_lossy(&ppid_output.stdout).trim().to_string();
    if ppid.is_empty() {
        return None;
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

    let segments: Vec<&str> = parent_cmd.split('|').collect();
    for i in 0..segments.len() {
        let seg = segments[i].trim();
        if seg.contains("pipelog") && i > 0 {
            let candidate = segments[i - 1].trim().trim_matches('"').trim_matches('\'');
            if !candidate.is_empty() {
                return Some(candidate.to_string());
            }
        }
    }

    infer_command_from_shell_history()
}

fn infer_command_from_process_group() -> Option<String> {
    let pid = std::process::id().to_string();
    let pgid_output = ProcessCommand::new("ps")
        .args(["-o", "pgid=", "-p", &pid])
        .output()
        .ok()?;
    let pgid = String::from_utf8_lossy(&pgid_output.stdout).trim().to_string();
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
        let Some(line_pid) = parts.next() else { continue };
        let Ok(line_pid_num) = line_pid.parse::<u32>() else { continue };
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

        return Some(cmd);
    }

    None
}

fn infer_command_from_shell_history() -> Option<String> {
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

    for marker in ["| pipelog", "| ./target/release/pipelog", "| /usr/local/bin/pipelog"] {
        if let Some((before_pipe, _)) = cmd.split_once(marker) {
            let cleaned = before_pipe.trim().to_string();
            if !cleaned.is_empty() {
                return Some(cleaned);
            }
        }
    }

    None
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

    let output = String::from_utf8_lossy(&buf).to_string();

    if output.trim().is_empty() {
        eprintln!("{}", "No output to capture.".dimmed());
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
            eprintln!("{} Failed to save: {}", "✗".red(), e);
            // Still exit 0 so we don't break pipelines
        }
    }

    Ok(())
}
