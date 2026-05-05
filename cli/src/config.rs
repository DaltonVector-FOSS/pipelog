use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
pub struct Config {
    pub api_url: String,
    pub web_url: String,
    pub auth_token: Option<String>,
    pub default_workspace: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            api_url: "http://localhost:3001".to_string(),
            web_url: "http://localhost:5174".to_string(),
            auth_token: None,
            default_workspace: None,
        }
    }
}

pub fn config_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("pipelog");
    path.push("config.json");
    path
}

pub fn load() -> Result<Config> {
    let path = config_path();
    if !path.exists() {
        return Ok(Config::default());
    }
    let contents = std::fs::read_to_string(&path)?;
    let config: Config = serde_json::from_str(&contents)?;
    Ok(config)
}

pub fn save(config: &Config) -> Result<()> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, serde_json::to_string_pretty(config)?)?;
    Ok(())
}
