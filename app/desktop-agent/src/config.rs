use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use tracing::{warn, error};

use serde::{Deserialize, Serialize};

pub const DESKTOP_AGENT_NAME: &str = "desktop-agent";
const CONFIG_FILE_NAME: &str = "desktop-agent.config.json";

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
    pub agent_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredConfig {
    server_ws_url: String,
    device_id: String,
}

impl Config {
    pub fn from_prompt() -> io::Result<Self> {
        let config_path = config_file_path();
        let stored_config = load_stored_config(&config_path);

        #[cfg(target_os = "windows")]
        {
            let stored_config = stored_config.unwrap_or_else(|| {
                let config = StoredConfig {
                    server_ws_url: default_server_ws_url(),
                    device_id: default_device_id(),
                };
                save_stored_config(&config_path, &config);
                config
            });

            return Ok(Self {
                server_ws_url: normalize_server_ws_url(stored_config.server_ws_url),
                device_id: stored_config.device_id,
                agent_name: env::var("AGENT_NAME")
                    .unwrap_or_else(|_| DESKTOP_AGENT_NAME.to_string()),
            });
        }

        let default_server_ws_url = stored_config
            .as_ref()
            .map(|config| config.server_ws_url.clone())
            .unwrap_or_else(default_server_ws_url);
        let server_ws_url = prompt_server_ws_url(&default_server_ws_url)?;

        let default_device_id = stored_config
            .as_ref()
            .map(|config| config.device_id.clone())
            .unwrap_or_else(default_device_id);
        let device_id = prompt_device_id(&default_device_id)?;

        save_stored_config(
            &config_path,
            &StoredConfig {
                server_ws_url: server_ws_url.clone(),
                device_id: device_id.clone(),
            },
        );

        Ok(Self {
            server_ws_url,
            device_id,
            agent_name: env::var("AGENT_NAME").unwrap_or_else(|_| DESKTOP_AGENT_NAME.to_string()),
        })
    }
}

fn normalize_server_ws_url(url: String) -> String {
    let trimmed = url.trim().trim_end_matches('/').to_string();

    if let Some(prefix) = trimmed.strip_suffix("/ws/agent") {
        return format!("{prefix}/ws/agent");
    }

    if let Some(prefix) = trimmed.strip_suffix("/ws/dashboard") {
        let corrected = format!("{prefix}/ws/agent");
        warn!(
            original = %trimmed,
            corrected = %corrected,
            "AGENT_SERVER_WS_URL points to /ws/dashboard; auto-corrected to /ws/agent"
        );
        return corrected;
    }

    if trimmed.starts_with("http://") {
        return format!("ws://{}/ws/agent", trimmed.trim_start_matches("http://"));
    }

    if trimmed.starts_with("https://") {
        return format!("wss://{}/ws/agent", trimmed.trim_start_matches("https://"));
    }

    if trimmed.starts_with("ws://") || trimmed.starts_with("wss://") {
        return format!("{trimmed}/ws/agent");
    }

    format!("ws://{trimmed}/ws/agent")
}

fn config_file_path() -> PathBuf {
    env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(CONFIG_FILE_NAME)
}

fn load_stored_config(path: &Path) -> Option<StoredConfig> {
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(err) if err.kind() == io::ErrorKind::NotFound => return None,
        Err(err) => {
            warn!(path = %path.display(), %err, "failed to read config file");
            return None;
        }
    };

    match serde_json::from_str::<StoredConfig>(&raw) {
        Ok(config) => Some(config),
        Err(err) => {
            warn!(path = %path.display(), %err, "failed to parse config file");
            None
        }
    }
}

fn save_stored_config(path: &Path, config: &StoredConfig) {
    let raw = match serde_json::to_string_pretty(config) {
        Ok(raw) => raw,
        Err(err) => {
            error!(path = %path.display(), %err, "failed to serialize config file");
            return;
        }
    };

    if let Err(err) = fs::write(path, format!("{raw}\n")) {
        error!(path = %path.display(), %err, "failed to write config file");
    }
}

fn default_server_ws_url() -> String {
    env::var("AGENT_SERVER_WS_URL").unwrap_or_else(|_| "ws://127.0.0.1:3000/ws/agent".to_string())
}

fn default_device_id() -> String {
    env::var("AGENT_DEVICE_ID").unwrap_or_else(|_| {
        hostname::get()
            .ok()
            .and_then(|host| host.into_string().ok())
            .filter(|host| !host.is_empty())
            .unwrap_or_else(|| DEFAULT_DEVICE_ID.to_string())
    })
}

fn prompt_server_ws_url(default_value: &str) -> io::Result<String> {
    let mut stdout = io::stdout();
    writeln!(
        stdout,
        "Please enter backend address (example: ws://127.0.0.1:3000 or http://127.0.0.1:3000)"
    )?;
    write!(stdout, "Backend address [{default_value}]: ")?;
    stdout.flush()?;

    let mut input = String::new();
    io::stdin().read_line(&mut input)?;

    let raw = if input.trim().is_empty() {
        default_value.to_string()
    } else {
        input
    };

    Ok(normalize_server_ws_url(raw))
}

fn prompt_device_id(default_value: &str) -> io::Result<String> {
    let mut stdout = io::stdout();
    writeln!(stdout, "Please enter current device name")?;
    write!(stdout, "Device name [{default_value}]: ")?;
    stdout.flush()?;

    let mut input = String::new();
    io::stdin().read_line(&mut input)?;

    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Ok(default_value.to_string());
    }

    Ok(trimmed.to_string())
}
