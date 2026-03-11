use std::thread;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use objc2::rc::autoreleasepool;
use objc2_app_kit::{NSRunningApplication, NSWorkspace};
use tokio::sync::mpsc;
use tracing::{error, info, warn};

use crate::event::{ActivityEnvelope, AppInfo};

#[derive(Debug, Clone, PartialEq, Eq)]
struct LastApp {
    bundle_id: String,
    pid: i32,
}

pub fn start_foreground_watcher(
    device_id: String,
    tx: mpsc::UnboundedSender<ActivityEnvelope>,
) -> Result<thread::JoinHandle<()>> {
    let handle = thread::Builder::new()
        .name("foreground-watcher".to_string())
        .spawn(move || {
            if let Err(err) = run_watcher(device_id, tx) {
                error!(error = %err, "foreground watcher exited unexpectedly");
            }
        })
        .context("failed to spawn foreground watcher thread")?;

    Ok(handle)
}

fn run_watcher(device_id: String, tx: mpsc::UnboundedSender<ActivityEnvelope>) -> Result<()> {
    let mut last_app = None::<LastApp>;
    let mut last_read_error_at = None::<Instant>;

    info!("foreground watcher started (polling)");

    loop {
        emit_frontmost_event(&device_id, &tx, &mut last_app, &mut last_read_error_at);
        thread::sleep(Duration::from_millis(1000));
    }
}

fn emit_frontmost_event(
    device_id: &str,
    tx: &mpsc::UnboundedSender<ActivityEnvelope>,
    last_app: &mut Option<LastApp>,
    last_read_error_at: &mut Option<Instant>,
) {
    let Some(app_info) = current_frontmost_app() else {
        // Throttle noisy logs when macOS API is temporarily unavailable.
        let now = Instant::now();
        let should_log = last_read_error_at
            .map(|at| now.duration_since(at) >= Duration::from_secs(30))
            .unwrap_or(true);
        if should_log {
            warn!("cannot read frontmost app");
            *last_read_error_at = Some(now);
        }
        return;
    };
    *last_read_error_at = None;

    let current = LastApp {
        bundle_id: app_info.id.clone(),
        pid: app_info.pid,
    };

    if last_app.as_ref() == Some(&current) {
        return;
    }
    *last_app = Some(current);

    info!(
        app_name = %app_info.name,
        bundle_id = %app_info.id,
        pid = app_info.pid,
        "foreground app changed"
    );

    let event = ActivityEnvelope::foreground_changed(device_id, app_info);
    if let Err(err) = tx.send(event) {
        warn!(error = %err, "event channel closed, dropping event");
    }
}

fn current_frontmost_app() -> Option<AppInfo> {
    autoreleasepool(|_| {
        let workspace = NSWorkspace::sharedWorkspace();
        let app = workspace.frontmostApplication()?;
        Some(app_from_running_app(&app))
    })
}

fn app_from_running_app(app: &NSRunningApplication) -> AppInfo {
    let bundle_id = app
        .bundleIdentifier()
        .map(|id| id.to_string())
        .unwrap_or_else(|| "unknown.bundle".to_string());
    let name = app
        .localizedName()
        .map(|name| name.to_string())
        .unwrap_or_else(|| bundle_id.clone());
    let pid = app.processIdentifier() as i32;

    AppInfo {
        id: bundle_id,
        name,
        pid,
    }
}
