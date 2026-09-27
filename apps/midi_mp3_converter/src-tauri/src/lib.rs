pub mod commands;
pub mod converter;
pub mod encoder;
pub mod midi;
pub mod paths;
pub mod queue;
pub mod scan;
pub mod settings;
pub mod state;
pub mod synth;

use state::AppState;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let settings = settings::load(app.handle());
            app.manage(AppState::new(settings));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_queue,
            commands::add_files,
            commands::add_folder,
            commands::add_paths,
            commands::remove_items,
            commands::clear_queue,
            commands::get_settings,
            commands::set_settings,
            commands::soundfonts,
            commands::start_conversion,
            commands::cancel_conversion,
            commands::render_preview,
            commands::clear_preview,
            commands::reveal_in_folder,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo Tauri");
}
#[cfg(test)]
mod tests;
