use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const DEFAULT_WEB_URL: &str = "https://pipelog.daltonvector.ai";
const LEGACY_WEB_URLS: [&str; 4] = [
    "http://localhost:5174",
    "http://localhost:5173",
    "https://pipelog-8a15f.web.app",
    "https://pipelog-8a15f.web.app/",
];
const DEFAULT_API_URL: &str = "https://api.pipelog.daltonvector.ai";
const LEGACY_API_URLS: [&str; 2] = ["http://localhost:3001", "http://127.0.0.1:3001"];

#[derive(Serialize, Deserialize, Clone)]
pub struct Config {
    pub api_url: String,
    pub web_url: String,
    pub auth_token: Option<String>,
    pub default_workspace: Option<String>,
    #[serde(default)]
    pub sync_clipboard: bool,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            api_url: DEFAULT_API_URL.to_string(),
            web_url: DEFAULT_WEB_URL.to_string(),
            auth_token: None,
            default_workspace: None,
            sync_clipboard: false,
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
    let mut config: Config = serde_json::from_str(&contents)?;
    if LEGACY_API_URLS.contains(&config.api_url.as_str()) {
        config.api_url = DEFAULT_API_URL.to_string();
    }
    if LEGACY_WEB_URLS.contains(&config.web_url.as_str()) {
        config.web_url = DEFAULT_WEB_URL.to_string();
    }
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
