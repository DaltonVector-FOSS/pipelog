//! Poll local clipboard and synchronize with the API (in-memory server state only).

use anyhow::Result;
use arboard::Clipboard;
use serde::{Deserialize, Serialize};
use tokio::time::{interval, Duration};

const POLL_MS: u64 = 400;
const REMOTE_POLL_EVERY: u32 = 4;
const MAX_CLIPBOARD_BYTES: usize = 256 * 1024;

#[derive(Debug, Deserialize)]
struct ClipboardState {
    text: String,
    updated_at: i64,
}

#[derive(Debug, Serialize)]
struct PushBody<'a> {
    text: &'a str,
}

#[derive(Debug, Deserialize)]
struct PushResp {
    updated_at: i64,
}

fn auth_header(token: &str) -> String {
    format!("Bearer {}", token)
}

pub async fn watch_and_sync(sync_enabled: bool, token: &str, api_url: &str) -> Result<()> {
    let client = reqwest::Client::new();
    let base = api_url.trim_end_matches('/');
    let url = format!("{}/sync/clipboard", base);

    #[cfg(unix)]
    let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
    #[cfg(unix)]
    let mut sigint = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())?;

    let mut ticker = interval(Duration::from_millis(POLL_MS));
    let mut tick_count: u32 = 0;
    let mut server_ts: i64 = 0;
    // Last content we treat as consistent with server (after push or applying remote).
    let mut baseline: String = String::new();
    let mut skip_local_until_matches: Option<String> = None;

    loop {
        #[cfg(unix)]
        {
            tokio::select! {
                _ = sigterm.recv() => break Ok(()),
                _ = sigint.recv() => break Ok(()),
                _ = ticker.tick() => {}
            }
        }
        #[cfg(not(unix))]
        {
            ticker.tick().await;
        }

        tick_count = tick_count.wrapping_add(1);

        if !sync_enabled {
            continue;
        }

        let mut clip = match Clipboard::new() {
            Ok(c) => c,
            Err(_) => continue,
        };

        let local = match clip.get_text() {
            Ok(t) if t.len() <= MAX_CLIPBOARD_BYTES => t,
            Ok(_) => continue,
            Err(_) => String::new(),
        };

        if let Some(ref target) = skip_local_until_matches {
            if local == *target {
                skip_local_until_matches = None;
                baseline = local;
                continue;
            }
            skip_local_until_matches = None;
        }

        if tick_count % REMOTE_POLL_EVERY == 0 {
            match fetch_remote(&client, &url, token).await {
                Some(remote) if remote.updated_at > server_ts => {
                    server_ts = remote.updated_at;
                    if remote.text.is_empty() {
                        baseline = local.clone();
                    } else if remote.text.len() <= MAX_CLIPBOARD_BYTES && remote.text != local {
                        clip.set_text(remote.text.clone()).ok();
                        skip_local_until_matches = Some(remote.text.clone());
                        baseline.clone_from(&remote.text);
                    } else {
                        baseline.clone_from(&remote.text);
                    }
                }
                Some(remote) if !remote.text.is_empty() && remote.text == local => {
                    baseline.clone_from(&local);
                }
                _ => {}
            }

            continue;
        }

        if local == baseline || local.is_empty() {
            continue;
        }

        match client
            .post(&url)
            .header("Authorization", auth_header(token))
            .json(&PushBody { text: &local })
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => {
                if let Ok(body) = r.json::<PushResp>().await {
                    server_ts = body.updated_at;
                }
                baseline = local;
            }
            _ => {}
        }
    }
}

async fn fetch_remote(
    client: &reqwest::Client,
    url: &str,
    token: &str,
) -> Option<ClipboardState> {
    let r = client
        .get(url)
        .header("Authorization", auth_header(token))
        .send()
        .await
        .ok()?;
    if !r.status().is_success() {
        return None;
    }
    r.json().await.ok()
}
