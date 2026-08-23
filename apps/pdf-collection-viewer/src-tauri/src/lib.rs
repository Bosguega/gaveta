pub mod commands;
pub mod db;
pub mod embroidery;
pub mod file_types;
pub mod scanner;
pub mod thumbnails;

use db::DbState;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::Manager;

pub struct ScanCancels(Mutex<HashMap<i64, AtomicBool>>);

impl ScanCancels {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }

    pub fn mark_active(&self, collection_id: i64) {
        if let Ok(mut map) = self.0.lock() {
            map.insert(collection_id, AtomicBool::new(false));
        }
    }

    pub fn is_cancelled(&self, collection_id: i64) -> bool {
        self.0
            .lock()
            .ok()
            .and_then(|map| map.get(&collection_id).map(|b| b.load(Ordering::Relaxed)))
            .unwrap_or(false)
    }

    pub fn cancel(&self, collection_id: i64) -> bool {
        self.0
            .lock()
            .ok()
            .and_then(|map| {
                map.get(&collection_id).map(|b| {
                    b.store(true, Ordering::Relaxed);
                    true
                })
            })
            .unwrap_or(false)
    }

    pub fn clear(&self, collection_id: i64) {
        if let Ok(mut map) = self.0.lock() {
            map.remove(&collection_id);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let conn = db::open_and_migrate(app.handle())
                .expect("Falha ao abrir e migrar SQLite");
            app.manage(DbState(Mutex::new(conn)));
            app.manage(ScanCancels::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_collections,
            commands::create_collection,
            commands::update_collection,
            commands::delete_collection,
            commands::get_collection,
            commands::get_cache_dir,
            commands::list_items,
            commands::update_collection_scan,
            commands::cancel_scan,
            commands::open_file,
            commands::pick_folder,
            commands::analyze_duplicates,
            commands::remove_duplicate,
            commands::toggle_favorite,
            commands::reveal_in_folder,
            commands::pick_image_file,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo Tauri");
}
