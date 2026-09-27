use crate::queue::QueueItem;
use crate::settings::Settings;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use tauri_plugin_shell::process::CommandChild;

pub struct AppState {
    pub queue: Mutex<Vec<QueueItem>>,
    pub settings: Mutex<Settings>,
    pub running: AtomicBool,
    pub cancel: AtomicBool,
    pub counter: AtomicU64,
    pub child: Mutex<Option<CommandChild>>,
    pub preview: Mutex<Option<PathBuf>>,
}

impl AppState {
    pub fn new(settings: Settings) -> Self {
        Self {
            queue: Mutex::new(Vec::new()),
            settings: Mutex::new(settings),
            running: AtomicBool::new(false),
            cancel: AtomicBool::new(false),
            counter: AtomicU64::new(0),
            child: Mutex::new(None),
            preview: Mutex::new(None),
        }
    }

    pub fn next_id(&self) -> u64 {
        self.counter.fetch_add(1, Ordering::Relaxed) + 1
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    pub fn is_canceled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }

    pub fn kill_child(&self) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
    }

    pub fn clear_preview(&self) {
        if let Ok(mut guard) = self.preview.lock() {
            if let Some(path) = guard.take() {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}