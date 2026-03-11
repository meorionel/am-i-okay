#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "macos")]
pub use macos::run_foreground_watcher;

#[cfg(target_os = "windows")]
pub use windows::run_foreground_watcher;
