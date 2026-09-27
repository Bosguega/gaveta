use crate::converter;
use crate::midi;
use crate::paths;
use crate::queue::{QueueItem, QueueStatus};
use crate::scan;
use crate::settings::{self, Settings};
use crate::state::AppState;
use crate::synth;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundFontOption {
    pub name: String,
    pub path: String,
}

fn normalized(path: &Path) -> String {
    std::fs::canonicalize(path)
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|_| path.to_string_lossy().into_owned())
        .to_ascii_lowercase()
}

fn build_item(state: &AppState, path: &Path, relative_dir: Option<String>) -> QueueItem {
    let (duration_ms, error, status) = match midi::analyze(path) {
        Ok(info) => (Some(info.duration_ms), None, QueueStatus::Pending),
        Err(message) => (None, Some(message), QueueStatus::Error),
    };
    QueueItem {
        id: state.next_id(),
        path: path.to_string_lossy().into_owned(),
        name: path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default(),
        size: std::fs::metadata(path).map(|meta| meta.len()).unwrap_or(0),
        duration_ms,
        status,
        output_path: None,
        error,
        relative_dir,
    }
}

fn push_items(state: &AppState, incoming: Vec<(PathBuf, Option<String>)>) -> Vec<QueueItem> {
    let mut added: Vec<QueueItem> = Vec::new();
    let Ok(mut queue) = state.queue.lock() else {
        return added;
    };
    for (path, relative_dir) in incoming {
        let key = normalized(&path);
        if queue.iter().any(|item| normalized(Path::new(&item.path)) == key) {
            continue;
        }
        let item = build_item(state, &path, relative_dir);
        queue.push(item.clone());
        added.push(item);
    }
    added
}

#[tauri::command]
pub fn list_queue(state: State<'_, AppState>) -> Vec<QueueItem> {
    state.queue.lock().map(|queue| queue.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn add_files(state: State<'_, AppState>, paths: Vec<String>) -> Vec<QueueItem> {
    let incoming = paths.into_iter().map(|path| (PathBuf::from(path), None)).collect();
    push_items(&state, incoming)
}

#[tauri::command]
pub fn add_folder(
    state: State<'_, AppState>,
    path: String,
    include_subfolders: Option<bool>,
) -> Result<Vec<QueueItem>, String> {
    let include = include_subfolders.unwrap_or_else(|| {
        state
            .settings
            .lock()
            .map(|settings| settings.include_subfolders)
            .unwrap_or(true)
    });
    let root = PathBuf::from(&path);
    let files = scan::midi_files(&root, include)?;
    let incoming = files
        .into_iter()
        .map(|file| {
            let relative = file
                .parent()
                .and_then(|parent| parent.strip_prefix(&root).ok())
                .map(|dir| dir.to_string_lossy().into_owned())
                .filter(|value| !value.is_empty());
            (file, relative)
        })
        .collect();
    Ok(push_items(&state, incoming))
}

#[tauri::command]
pub fn add_paths(
    state: State<'_, AppState>,
    paths: Vec<String>,
    include_subfolders: Option<bool>,
) -> Result<Vec<QueueItem>, String> {
    let include = include_subfolders.unwrap_or_else(|| {
        state
            .settings
            .lock()
            .map(|settings| settings.include_subfolders)
            .unwrap_or(true)
    });
    let mut incoming: Vec<(PathBuf, Option<String>)> = Vec::new();
    for raw in paths {
        let path = PathBuf::from(&raw);
        if path.is_dir() {
            for file in scan::midi_files(&path, include)? {
                let relative = file
                    .parent()
                    .and_then(|parent| parent.strip_prefix(&path).ok())
                    .map(|dir| dir.to_string_lossy().into_owned())
                    .filter(|value| !value.is_empty());
                incoming.push((file, relative));
            }
        } else if scan::is_midi(&path) {
            incoming.push((path, None));
        }
    }
    Ok(push_items(&state, incoming))
}

#[tauri::command]
pub fn remove_items(state: State<'_, AppState>, ids: Vec<u64>) -> Vec<QueueItem> {
    if let Ok(mut queue) = state.queue.lock() {
        queue.retain(|item| !ids.contains(&item.id));
        return queue.clone();
    }
    Vec::new()
}

#[tauri::command]
pub fn clear_queue(state: State<'_, AppState>) -> Vec<QueueItem> {
    if let Ok(mut queue) = state.queue.lock() {
        queue.clear();
    }
    Vec::new()
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings.lock().map(|settings| settings.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn set_settings(app: AppHandle, state: State<'_, AppState>, settings: Settings) -> Result<Settings, String> {
    settings::save(&app, &settings)?;
    if let Ok(mut guard) = state.settings.lock() {
        *guard = settings.clone();
    }
    Ok(settings)
}

#[tauri::command]
pub fn soundfonts(app: AppHandle) -> Vec<SoundFontOption> {
    paths::bundled_soundfonts(&app)
        .into_iter()
        .map(|(name, path)| SoundFontOption { name, path })
        .collect()
}

#[tauri::command]
pub fn start_conversion(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if state.is_running() {
        return Err("já existe uma conversão em andamento".to_string());
    }
    let has_work = state
        .queue
        .lock()
        .map(|queue| {
            queue
                .iter()
                .any(|item| !matches!(item.status, QueueStatus::Done | QueueStatus::Skipped))
        })
        .unwrap_or(false);
    if !has_work {
        return Err("nenhum arquivo para converter".to_string());
    }
    state.running.store(true, Ordering::Relaxed);
    state.cancel.store(false, Ordering::Relaxed);
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        converter::run_batch(handle).await;
    });
    Ok(())
}

#[tauri::command]
pub fn cancel_conversion(state: State<'_, AppState>) {
    state.cancel.store(true, Ordering::Relaxed);
    state.kill_child();
}

#[tauri::command]
pub async fn render_preview(
    app: AppHandle,
    state: State<'_, AppState>,
    id: u64,
) -> Result<String, String> {
    let item = state
        .queue
        .lock()
        .map(|queue| queue.iter().find(|entry| entry.id == id).cloned())
        .unwrap_or(None)
        .ok_or_else(|| "arquivo não encontrado na lista".to_string())?;
    let settings = state.settings.lock().map(|value| value.clone()).unwrap_or_default();
    let midi_path = PathBuf::from(&item.path);
    let info = midi::analyze(&midi_path)?;

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|err| format!("não foi possível localizar a pasta de cache: {err}"))?;
    std::fs::create_dir_all(&cache_dir)
        .map_err(|err| format!("não foi possível criar a pasta de cache: {err}"))?;

    state.clear_preview();
    let wav = cache_dir.join(format!("preview-{}.wav", id));
    let noop: Arc<dyn Fn(f32) + Send + Sync> = Arc::new(|_| {});
    synth::render_to_wav(&app, &state, &midi_path, &wav, &settings, info.duration_ms, noop).await?;
    if let Ok(mut guard) = state.preview.lock() {
        *guard = Some(wav.clone());
    }
    Ok(wav.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn clear_preview(state: State<'_, AppState>) {
    state.clear_preview();
}

#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("arquivo não encontrado: {path}"));
    }
    std::process::Command::new("explorer")
        .arg(format!("/select,{}", target.display()))
        .spawn()
        .map_err(|err| format!("não foi possível abrir o Explorer: {err}"))?;
    Ok(())
}