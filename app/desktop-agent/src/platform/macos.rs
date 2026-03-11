use std::ptr::NonNull;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::Result;
use block2::RcBlock;
use objc2::rc::autoreleasepool;
use objc2_app_kit::{
    NSRunningApplication, NSWorkspace, NSWorkspaceDidActivateApplicationNotification,
};
use objc2_foundation::{NSDate, NSDefaultRunLoopMode, NSNotification, NSRunLoop};
use tokio::sync::mpsc;
use tracing::{info, warn};

use crate::event::{ActivityEnvelope, AppInfo};

#[derive(Debug, Clone, PartialEq, Eq)]
struct LastApp {
    bundle_id: String,
    pid: i32,
}

pub fn run_foreground_watcher(
    device_id: String,
    tx: mpsc::UnboundedSender<ActivityEnvelope>,
) -> Result<()> {
    run_watcher(device_id, tx)
}

fn run_watcher(device_id: String, tx: mpsc::UnboundedSender<ActivityEnvelope>) -> Result<()> {
    let last_app = Arc::new(Mutex::new(None::<LastApp>));
    let last_read_error_at = Arc::new(Mutex::new(None::<Instant>));

    autoreleasepool(|_| {
        let workspace = NSWorkspace::sharedWorkspace();
        let notification_center = workspace.notificationCenter();

        emit_frontmost_event(&device_id, &tx, &last_app, &last_read_error_at);

        let block_device_id = device_id.clone();
        let block_tx = tx.clone();
        let block_last_app = Arc::clone(&last_app);
        let block_last_read_error_at = Arc::clone(&last_read_error_at);
        let observer = RcBlock::new(move |_notification: NonNull<NSNotification>| {
            emit_frontmost_event(
                &block_device_id,
                &block_tx,
                &block_last_app,
                &block_last_read_error_at,
            );
        });

        let _observer_token = unsafe {
            notification_center.addObserverForName_object_queue_usingBlock(
                Some(NSWorkspaceDidActivateApplicationNotification),
                None,
                None,
                &observer,
            )
        };

        info!("foreground watcher started (notification + polling fallback)");

        let run_loop = NSRunLoop::currentRunLoop();
        loop {
            let until = NSDate::dateWithTimeIntervalSinceNow(1.0);
            let mode = unsafe { NSDefaultRunLoopMode };
            let _ = run_loop.runMode_beforeDate(mode, &until);
            // Fallback polling covers cases where macOS notification delivery is unreliable.
            emit_frontmost_event(&device_id, &tx, &last_app, &last_read_error_at);
        }
    })
}

fn emit_frontmost_event(
    device_id: &str,
    tx: &mpsc::UnboundedSender<ActivityEnvelope>,
    last_app: &Arc<Mutex<Option<LastApp>>>,
    last_read_error_at: &Arc<Mutex<Option<Instant>>>,
) {
    let Some(app_info) = current_frontmost_app() else {
        // Throttle noisy logs when macOS API is temporarily unavailable.
        let now = Instant::now();
        let mut last_read_error_at_guard = last_read_error_at.lock().expect("poisoned mutex");
        let should_log = last_read_error_at_guard
            .as_ref()
            .copied()
            .map(|at| now.duration_since(at) >= Duration::from_secs(30))
            .unwrap_or(true);
        if should_log {
            warn!("cannot read frontmost app");
            *last_read_error_at_guard = Some(now);
        }
        return;
    };
    *last_read_error_at.lock().expect("poisoned mutex") = None;

    let current = LastApp {
        bundle_id: app_info.id.clone(),
        pid: app_info.pid,
    };

    let mut last_app_guard = last_app.lock().expect("poisoned mutex");
    if last_app_guard.as_ref() == Some(&current) {
        return;
    }
    *last_app_guard = Some(current);
    drop(last_app_guard);

    info!(
        app_name = %app_info.name,
        bundle_id = %app_info.id,
        pid = app_info.pid,
        "foreground app changed"
    );

    let event =
        ActivityEnvelope::foreground_changed(device_id, "macos", "nsworkspace", app_info, None);
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
    let title = Some(name.clone());
    let pid = app.processIdentifier() as i32;

    AppInfo {
        id: bundle_id,
        name,
        title,
        pid,
    }
}
