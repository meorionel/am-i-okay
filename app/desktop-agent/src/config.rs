use std::env;
use tracing::warn;

#[cfg(target_os = "macos")]
const DEFAULT_DEVICE_ID: &str = "macos-agent";
#[cfg(target_os = "windows")]
const DEFAULT_DEVICE_ID: &str = "windows-agent";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const DEFAULT_DEVICE_ID: &str = "desktop-agent";

#[derive(Debug, Clone)]
pub struct Config {
    pub server_ws_url: String,
    pub device_id: String,
}

impl Config {
    pub fn from_env() -> Self {
        let raw_server_ws_url = env::var("AGENT_SERVER_WS_URL")
            .unwrap_or_else(|_| "ws://127.0.0.1:3000/ws/agent".to_string());
        let server_ws_url = normalize_server_ws_url(raw_server_ws_url);

        let device_id = env::var("AGENT_DEVICE_ID").unwrap_or_else(|_| {
            hostname::get()
                .ok()
                .and_then(|host| host.into_string().ok())
                .filter(|host| !host.is_empty())
                .unwrap_or_else(|| DEFAULT_DEVICE_ID.to_string())
        });

        Self {
            server_ws_url,
            device_id,
        }
    }
}

fn normalize_server_ws_url(url: String) -> String {
    if let Some(prefix) = url.strip_suffix("/ws/dashboard") {
        let corrected = format!("{prefix}/ws/agent");
        warn!(
            original = %url,
            corrected = %corrected,
            "AGENT_SERVER_WS_URL points to /ws/dashboard; auto-corrected to /ws/agent"
        );
        return corrected;
    }

    url
}
