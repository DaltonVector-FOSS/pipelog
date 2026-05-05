use crate::config;
use anyhow::{anyhow, Result};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

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

/// Standard UUID string (with hyphens) or 32 lowercase hex chars (no hyphens).
fn is_likely_full_uuid(id: &str) -> bool {
    let s = id.to_lowercase();
    if s.len() == 32 && s.chars().all(|c| c.is_ascii_hexdigit()) {
        return true;
    }
    let parts: Vec<&str> = s.split('-').collect();
    if parts.len() != 5 {
        return false;
    }
    let widths = [8usize, 4, 4, 4, 12];
    widths
        .iter()
        .zip(parts.iter())
        .all(|(&n, part)| part.len() == n && part.chars().all(|c| c.is_ascii_hexdigit()))
}

/// Avoid `GET /entries/:id` for short hex fragments; some APIs error instead of 404.
fn should_resolve_entry_via_list_only(id: &str) -> bool {
    let s = id.trim();
    s.len() >= 4
        && s.chars().all(|c| c.is_ascii_hexdigit())
        && !is_likely_full_uuid(s)
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
        let trimmed = id.trim();
        if should_resolve_entry_via_list_only(trimmed) {
            return self.unique_prefix_match_from_list(trimmed).await;
        }

        let res = self
            .inner
            .get(format!("{}/entries/{}", self.api_url, trimmed))
            .header("Authorization", self.auth_header())
            .send()
            .await?;

        if res.status().is_success() {
            return Ok(res.json().await?);
        }
        if res.status() == StatusCode::NOT_FOUND {
            return Err(anyhow!("Entry not found"));
        }
        let status = res.status();
        let msg = res.text().await.unwrap_or_default();
        Err(anyhow!("Failed to load entry: {} {}", status, msg))
    }

    async fn unique_prefix_match_from_list(&self, id: &str) -> Result<Entry> {
        let needle = id.trim().to_lowercase();
        if needle.len() < 4 || !needle.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(anyhow!("Entry not found"));
        }
        const LIST_LIMIT: u32 = 100;
        let entries = self.list_entries(None, LIST_LIMIT).await?;
        let mut matches: Vec<Entry> = entries
            .into_iter()
            .filter(|e| e.id.to_lowercase().starts_with(&needle))
            .collect();
        match matches.len() {
            0 => Err(anyhow!("Entry not found")),
            1 => Ok(matches.pop().expect("length checked")),
            n => Err(anyhow!(
                "Ambiguous id prefix ({} entries match). Use more hex characters or the full id.",
                n
            )),
        }
    }

    async fn resolve_id_for_mutation(&self, id: &str) -> Result<String> {
        Ok(self.get_entry(id).await?.id)
    }

    pub async fn share_entry(&self, id: &str) -> Result<Entry> {
        let id = self.resolve_id_for_mutation(id).await?;
        let res = self
            .inner
            .post(format!("{}/entries/{}/share", self.api_url, id))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        Ok(res.json().await?)
    }

    pub async fn delete_entry(&self, id: &str) -> Result<()> {
        let id = self.resolve_id_for_mutation(id).await?;
        self.inner
            .delete(format!("{}/entries/{}", self.api_url, id))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        Ok(())
    }

    pub async fn update_tags(&self, id: &str, add: Vec<String>, remove: Vec<String>) -> Result<()> {
        let id = self.resolve_id_for_mutation(id).await?;
        self.inner
            .patch(format!("{}/entries/{}/tags", self.api_url, id))
            .header("Authorization", self.auth_header())
            .json(&serde_json::json!({ "add": add, "remove": remove }))
            .send()
            .await?;
        Ok(())
    }
}
