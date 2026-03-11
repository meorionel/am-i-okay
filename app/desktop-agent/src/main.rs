#![cfg_attr(not(target_os = "macos"), allow(dead_code, unused_imports))]

use anyhow::Result;
use tokio::sync::mpsc;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

mod config;
mod event;
mod platform;
mod transport;

#[cfg(not(target_os = "macos"))]
compile_error!("desktop-agent MVP currently supports macOS only");

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .compact()
        .init();

    let cfg = config::Config::from_env();
    info!(
        server_ws_url = %cfg.server_ws_url,
        device_id = %cfg.device_id,
        "agent starting"
    );

    let (tx, rx) = mpsc::unbounded_channel();

    let mut transport_task = tokio::spawn(transport::run_transport(cfg.server_ws_url.clone(), rx));

    #[cfg(target_os = "macos")]
    let _watcher_thread = platform::start_foreground_watcher(cfg.device_id.clone(), tx)?;

    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            info!("received ctrl+c, shutting down");
        }
        transport_result = &mut transport_task => {
            match transport_result {
                Ok(Ok(())) => info!("transport exited"),
                Ok(Err(err)) => error!(error = %err, "transport failed"),
                Err(err) => error!(error = %err, "transport task panicked"),
            }
        }
    }

    transport_task.abort();
    info!("agent exited");
    Ok(())
}
