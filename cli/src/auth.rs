use crate::config;
use anyhow::{anyhow, Result};
use colored::*;

pub async fn login() -> Result<()> {
    let cfg = config::load()?;
    let login_url = format!("{}/cli-auth", cfg.web_url);

    println!("{}", "Opening browser to authenticate...".cyan());
    println!("If it doesn't open, visit: {}", login_url.underline());

    open::that(&login_url).ok();

    println!("\nPaste your auth token here:");
    let mut token = String::new();
    std::io::stdin().read_line(&mut token)?;
    let token = token.trim().to_string();

    if token.is_empty() {
        return Err(anyhow!("No token provided"));
    }

    // Verify token with API
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/auth/me", cfg.api_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    if !res.status().is_success() {
        return Err(anyhow!("Invalid token. Please try again."));
    }

    let user: serde_json::Value = res.json().await?;
    let email = user["email"].as_str().unwrap_or("unknown");

    let mut cfg = cfg;
    cfg.auth_token = Some(token);
    config::save(&cfg)?;

    println!("{} Logged in as {}", "✓".green().bold(), email.cyan());
    println!();
    println!(
        "{}",
        "Run once (zsh — captures command in pipelines):".dimmed()
    );
    println!("{}", "pipelog init zsh >> ~/.zshrc".cyan());
    println!("{}", "source ~/.zshrc".cyan());
    Ok(())
}

pub async fn logout() -> Result<()> {
    let mut cfg = config::load()?;
    cfg.auth_token = None;
    config::save(&cfg)?;
    println!("{}", "✓ Logged out".green());
    Ok(())
}

pub async fn status() -> Result<()> {
    let cfg = config::load()?;
    match &cfg.auth_token {
        None => println!("{}", "Not logged in. Run `pipelog auth login`".yellow()),
        Some(token) => {
            let client = reqwest::Client::new();
            let res = client
                .get(format!("{}/auth/me", cfg.api_url))
                .header("Authorization", format!("Bearer {}", token))
                .send()
                .await?;

            if res.status().is_success() {
                let user: serde_json::Value = res.json().await?;
                println!(
                    "{} Logged in as {}",
                    "✓".green().bold(),
                    user["email"].as_str().unwrap_or("unknown").cyan()
                );
            } else {
                println!("{}", "Token expired. Run `pipelog auth login`".yellow());
            }
        }
    }
    Ok(())
}
