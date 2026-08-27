pub mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let cache = app
                .path()
                .app_cache_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("embroidery-viewer"));
            std::fs::create_dir_all(&cache).expect("Falha ao criar cache do app");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::parse_pes_pyembroidery,
            commands::list_pes_files,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo Tauri");
}

