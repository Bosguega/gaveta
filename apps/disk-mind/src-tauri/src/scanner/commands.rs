use crate::scanner::walker::scan_directory_with_progress;
use crate::scanner::model::{RawEntry, ScanStats};
use crate::db::{self, indexer};
use tauri::{State, AppHandle, Emitter};
use std::sync::Mutex;
use std::path::PathBuf;

#[derive(Default)]
pub struct ScanState {
    pub running: bool,
    pub entries: Vec<RawEntry>,
}

#[tauri::command]
pub async fn start_scan(
    path: PathBuf,
    app: AppHandle,
    scanner_state: State<'_, Mutex<ScanState>>,
    _db_state: State<'_, crate::DbState>,
) -> Result<ScanStats, String> {
    let mut scanner_state = scanner_state.lock().unwrap();
    if scanner_state.running {
        return Err("Scan already running".to_string());
    }
    scanner_state.running = true;
    scanner_state.entries.clear();

    let mut stats = ScanStats {
        total_files: 0,
        total_dirs: 0,
        total_size: 0,
        errors: Vec::new(),
    };

    let (entries, progress_events) = scan_directory_with_progress(&path);

    // Emit progress events to frontend
    for event in progress_events {
        let _ = app.emit("scan-progress", event);
    }

    scanner_state.entries = entries.clone();

    for entry in &entries {
        stats.total_size += entry.size;
        if entry.path.is_dir() {
            stats.total_dirs += 1;
        } else {
            stats.total_files += 1;
        }
    }

    // Persist to SQLite using a local connection to avoid DbState ownership issues
    let db_path = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("diskmind")
        .join("scans.db");
    let conn = db::open(db_path).map_err(|e| e.to_string())?;
    db::migrate(&conn).map_err(|e| e.to_string())?;
    let mut conn_mut = conn;
    let _snapshot_id = indexer::index_snapshot(&mut conn_mut, path.clone(), &entries).map_err(|e| e.to_string())?;

    scanner_state.running = false;
    Ok(stats)
}

#[tauri::command]
pub fn stop_scan(state: State<Mutex<ScanState>>) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    state.running = false;
    Ok(())
}
