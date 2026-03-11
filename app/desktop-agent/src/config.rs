use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub server_ws_url: String,
    pub device_id: String,
}

impl Config {
    pub fn from_env() -> Self {
        let server_ws_url = env::var("AGENT_SERVER_WS_URL")
            .unwrap_or_else(|_| "ws://127.0.0.1:3000/ws/agent".to_string());

        let device_id = env::var("AGENT_DEVICE_ID").unwrap_or_else(|_| {
            hostname::get()
                .ok()
                .and_then(|host| host.into_string().ok())
                .filter(|host| !host.is_empty())
                .unwrap_or_else(|| "macos-agent".to_string())
        });

        Self {
            server_ws_url,
            device_id,
        }
    }
}
