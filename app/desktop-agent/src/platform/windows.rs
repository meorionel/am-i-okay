use std::io;
use std::path::Path;
use std::ptr;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use anyhow::{Result, anyhow};
use tokio::sync::mpsc;
use tracing::{info, warn};
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, HWND};
use windows_sys::Win32::System::Threading::{
    OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
};
use windows_sys::Win32::UI::Accessibility::{HWINEVENTHOOK, SetWinEventHook, UnhookWinEvent};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, EVENT_SYSTEM_FOREGROUND, GetForegroundWindow, GetMessageW,
    GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, MSG, TranslateMessage,
    WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
};

use crate::event::{ActivityEnvelope, AppInfo};

static HOOK_CONTEXT: OnceLock<HookContext> = OnceLock::new();

#[derive(Debug, Clone, PartialEq, Eq)]
struct LastApp {
    process_path: String,
    pid: i32,
}

#[derive(Debug, Clone)]
struct ForegroundApp {
    app: AppInfo,
    window_title: Option<String>,
}

struct HookContext {
    device_id: String,
    tx: mpsc::UnboundedSender<ActivityEnvelope>,
    last_app: Mutex<Option<LastApp>>,
    last_read_error_at: Mutex<Option<Instant>>,
}

pub fn run_foreground_watcher(
    device_id: String,
    tx: mpsc::UnboundedSender<ActivityEnvelope>,
) -> Result<()> {
    run_watcher(device_id, tx)
}

fn run_watcher(device_id: String, tx: mpsc::UnboundedSender<ActivityEnvelope>) -> Result<()> {
    let context = HookContext {
        device_id,
        tx,
        last_app: Mutex::new(None),
        last_read_error_at: Mutex::new(None),
    };
    HOOK_CONTEXT
        .set(context)
        .map_err(|_| anyhow!("foreground watcher already initialized"))?;

    let hook = unsafe {
        SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            ptr::null_mut(),
            Some(win_event_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        )
    };
    if hook.is_null() {
        return Err(anyhow!(
            "SetWinEventHook(EVENT_SYSTEM_FOREGROUND) failed: {}",
            io::Error::last_os_error()
        ));
    }

    info!("foreground watcher started (SetWinEventHook)");
    emit_frontmost_event(None);

    let result = run_message_loop();
    let _ = unsafe { UnhookWinEvent(hook) };
    result
}

fn run_message_loop() -> Result<()> {
    loop {
        let mut msg: MSG = unsafe { std::mem::zeroed() };
        let status = unsafe { GetMessageW(&mut msg, ptr::null_mut(), 0, 0) };

        if status == -1 {
            return Err(anyhow!(
                "GetMessageW failed: {}",
                io::Error::last_os_error()
            ));
        }
        if status == 0 {
            return Ok(());
        }

        unsafe {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

unsafe extern "system" fn win_event_proc(
    _h_win_event_hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _id_event_thread: u32,
    _dwms_event_time: u32,
) {
    if event != EVENT_SYSTEM_FOREGROUND {
        return;
    }
    emit_frontmost_event(Some(hwnd));
}

fn emit_frontmost_event(hwnd_hint: Option<HWND>) {
    let Some(context) = HOOK_CONTEXT.get() else {
        return;
    };

    let Some(current) = current_foreground_app(hwnd_hint) else {
        let now = Instant::now();
        let mut last_read_error_at_guard = match context.last_read_error_at.lock() {
            Ok(guard) => guard,
            Err(_) => return,
        };
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

    if let Ok(mut guard) = context.last_read_error_at.lock() {
        *guard = None;
    }

    let marker = LastApp {
        process_path: current.app.id.clone(),
        pid: current.app.pid,
    };
    let mut last_app_guard = match context.last_app.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    if last_app_guard.as_ref() == Some(&marker) {
        return;
    }
    *last_app_guard = Some(marker);
    drop(last_app_guard);

    info!(
        app_name = %current.app.name,
        process_path = %current.app.id,
        pid = current.app.pid,
        "foreground app changed"
    );

    let event = ActivityEnvelope::foreground_changed(
        &context.device_id,
        "windows",
        "setwineventhook",
        current.app,
        current.window_title,
    );
    if let Err(err) = context.tx.send(event) {
        warn!(error = %err, "event channel closed, dropping event");
    }
}

fn current_foreground_app(hwnd_hint: Option<HWND>) -> Option<ForegroundApp> {
    let hwnd = hwnd_hint.unwrap_or_else(|| unsafe { GetForegroundWindow() });
    if hwnd.is_null() {
        return None;
    }

    let pid = process_id_from_hwnd(hwnd)?;
    let process_path = process_path(pid).unwrap_or_else(|| format!("pid:{pid}"));
    let app_name = Path::new(&process_path)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .map(|name| name.to_string())
        .unwrap_or_else(|| format!("pid-{pid}"));

    let pid = i32::try_from(pid).unwrap_or(i32::MAX);
    let window_title = window_title(hwnd);

    Some(ForegroundApp {
        app: AppInfo {
            id: process_path,
            name: app_name,
            pid,
        },
        window_title,
    })
}

fn process_id_from_hwnd(hwnd: HWND) -> Option<u32> {
    let mut pid = 0_u32;
    let _thread_id = unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
    if pid == 0 {
        return None;
    }
    Some(pid)
}

fn process_path(pid: u32) -> Option<String> {
    let process_handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if process_handle.is_null() {
        return None;
    }

    let path = query_process_image_name(process_handle);
    let _ = unsafe { CloseHandle(process_handle) };
    path
}

fn query_process_image_name(process_handle: HANDLE) -> Option<String> {
    // Windows extends MAX_PATH for process paths, allocate enough for long paths.
    let mut buffer = vec![0_u16; 32768];
    let mut len = buffer.len() as u32;
    let ok =
        unsafe { QueryFullProcessImageNameW(process_handle, 0, buffer.as_mut_ptr(), &mut len) };
    if ok == 0 || len == 0 {
        return None;
    }

    Some(String::from_utf16_lossy(&buffer[..len as usize]))
}

fn window_title(hwnd: HWND) -> Option<String> {
    let len = unsafe { GetWindowTextLengthW(hwnd) };
    if len <= 0 {
        return None;
    }

    let mut buffer = vec![0_u16; len as usize + 1];
    let written = unsafe { GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32) };
    if written <= 0 {
        return None;
    }

    let raw = String::from_utf16_lossy(&buffer[..written as usize]);
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(trimmed.to_string())
}
