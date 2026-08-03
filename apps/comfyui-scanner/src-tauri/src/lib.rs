pub mod commands;

use commands::fs_commands::*;
use commands::useful_paths::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_comfyui_directory,
            build_workflow_dependency_index,
            get_common_comfyui_paths,
            find_comfyui_installations,
            get_saved_paths,
            save_export_file,
            get_useful_paths,
            save_useful_paths,
            open_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
