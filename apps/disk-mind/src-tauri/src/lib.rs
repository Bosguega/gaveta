pub mod db;
pub mod scanner;
pub mod classifier;
pub mod advisor;

use std::sync::Mutex;

pub struct DbState(pub Mutex<Option<rusqlite::Connection>>);

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DbState(Mutex::new(None)))
        .manage(Mutex::new(scanner::commands::ScanState::default()))
        .manage(Mutex::new(advisor::commands::AdvisorState::default()))
        .manage(classifier::commands::KnowledgePackState::default())
        .invoke_handler(tauri::generate_handler![
            scanner::commands::start_scan,
            scanner::commands::stop_scan,
            db::commands::list_snapshots,
            db::commands::open_db,
            db::commands::get_snapshot,
            db::commands::get_snapshot_tree,
            db::commands::compare_snapshots,
            db::commands::export_snapshot_report,
            classifier::commands::get_entities,
            advisor::commands::get_recommendations,
            classifier::commands::load_knowledge_pack,
            classifier::commands::list_knowledge_packs,
        ])
        .setup(|app| {
            let _app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Future background tasks
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
