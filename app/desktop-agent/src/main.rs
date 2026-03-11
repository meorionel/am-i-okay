#![cfg_attr(
    not(any(target_os = "macos", target_os = "windows")),
    allow(dead_code, unused_imports)
)]

use anyhow::Result;
use tokio::sync::mpsc;
use tracing::info;
use tracing_subscriber::EnvFilter;

mod config;
mod event;
mod platform;
mod transport;

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
compile_error!("desktop-agent currently supports macOS and Windows only");

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .compact()
        .init();

    let cfg = config::Config::from_prompt()?;
    info!(
        server_ws_url = %cfg.server_ws_url,
        device_id = %cfg.device_id,
        "agent starting"
    );

    let (tx, rx) = mpsc::unbounded_channel();

    let _transport_task = tokio::spawn(transport::run_transport(cfg.server_ws_url.clone(), rx));

    platform::run_foreground_watcher(cfg.device_id.clone(), tx)?;
    Ok(())
}
