use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use crate::config;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Entry {
    pub id: String,
    pub title: Option<String>,
    pub output: String,
    pub command: Option<String>,
    pub tags: Vec<String>,
    pub exit_code: Option<i32>,
    pub is_public: bool,
    pub share_token: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Debug)]
pub struct CreateEntry {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub output: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
    pub is_public: bool,
}

pub struct Client {
    inner: reqwest::Client,
    api_url: String,
    token: String,
}

impl Client {
    pub fn new() -> Result<Self> {
        let cfg = config::load()?;
        let token = cfg
            .auth_token
            .ok_or_else(|| anyhow!("Not logged in. Run `pipelog auth login`"))?;
        Ok(Client {
            inner: reqwest::Client::new(),
            api_url: cfg.api_url,
            token,
        })
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.token)
    }

    pub async fn create_entry(&self, entry: CreateEntry) -> Result<Entry> {
        let res = self
            .inner
            .post(format!("{}/entries", self.api_url))
            .header("Authorization", self.auth_header())
            .json(&entry)
            .send()
            .await?;

        if !res.status().is_success() {
            let msg = res.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to create entry: {}", msg));
        }

        Ok(res.json().await?)
    }

    pub async fn list_entries(&self, tag: Option<String>, limit: u32) -> Result<Vec<Entry>> {
        let mut url = format!("{}/entries?limit={}", self.api_url, limit);
        if let Some(t) = tag {
            url.push_str(&format!("&tag={}", t));
        }
        let res = self
            .inner
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        Ok(res.json().await?)
    }

    pub async fn search_entries(&self, query: &str) -> Result<Vec<Entry>> {
        let res = self
            .inner
            .get(format!("{}/entries/search?q={}", self.api_url, query))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        Ok(res.json().await?)
    }

    pub async fn get_entry(&self, id: &str) -> Result<Entry> {
        let res = self
            .inner
            .get(format!("{}/entries/{}", self.api_url, id))
            .header("Authorization", self.auth_header())
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(anyhow!("Entry not found"));
        }
        Ok(res.json().await?)
    }

    pub async fn share_entry(&self, id: &str) -> Result<Entry> {
        let res = self
            .inner
            .post(format!("{}/entries/{}/share", self.api_url, id))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        Ok(res.json().await?)
    }

    pub async fn delete_entry(&self, id: &str) -> Result<()> {
        self.inner
            .delete(format!("{}/entries/{}", self.api_url, id))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        Ok(())
    }

    pub async fn update_tags(&self, id: &str, add: Vec<String>, remove: Vec<String>) -> Result<()> {
        self.inner
            .patch(format!("{}/entries/{}/tags", self.api_url, id))
            .header("Authorization", self.auth_header())
            .json(&serde_json::json!({ "add": add, "remove": remove }))
            .send()
            .await?;
        Ok(())
    }
}
