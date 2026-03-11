use std::ptr::NonNull;
use std::sync::{Arc, Mutex};
use std::thread;

use anyhow::{Context, Result};
use block2::RcBlock;
use objc2::rc::autoreleasepool;
use objc2_app_kit::{
    NSRunningApplication, NSWorkspace, NSWorkspaceDidActivateApplicationNotification,
};
use objc2_foundation::{NSNotification, NSRunLoop};
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
    let last_app = Arc::new(Mutex::new(None::<LastApp>));

    autoreleasepool(|_| {
        let workspace = NSWorkspace::sharedWorkspace();
        let center = workspace.notificationCenter();

        let tx_for_callback = tx.clone();
        let last_for_callback = Arc::clone(&last_app);
        let device_id_for_callback = device_id.clone();

        let callback = RcBlock::new(move |_notification: NonNull<NSNotification>| {
            emit_frontmost_event(
                &device_id_for_callback,
                &tx_for_callback,
                &last_for_callback,
            );
        });

        let observer = unsafe {
            center.addObserverForName_object_queue_usingBlock(
                Some(NSWorkspaceDidActivateApplicationNotification),
                None,
                None,
                &callback,
            )
        };

        emit_frontmost_event(&device_id, &tx, &last_app);

        info!("foreground watcher started (NSWorkspace notifications)");

        let _keep_observer_alive = observer;
        let _keep_block_alive = callback;
        NSRunLoop::currentRunLoop().run();
    });

    Ok(())
}

fn emit_frontmost_event(
    device_id: &str,
    tx: &mpsc::UnboundedSender<ActivityEnvelope>,
    last_app: &Arc<Mutex<Option<LastApp>>>,
) {
    let Some(app_info) = current_frontmost_app() else {
        warn!("cannot read frontmost app");
        return;
    };

    let current = LastApp {
        bundle_id: app_info.id.clone(),
        pid: app_info.pid,
    };

    {
        let mut guard = match last_app.lock() {
            Ok(guard) => guard,
            Err(_) => {
                warn!("last_app lock poisoned");
                return;
            }
        };

        if guard.as_ref() == Some(&current) {
            return;
        }

        *guard = Some(current);
    }

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
