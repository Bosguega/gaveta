use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExistingPolicy {
    Overwrite,
    Skip,
    Copy,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub output_dir: Option<String>,
    pub bitrate_kbps: u32,
    pub gain: f32,
    pub sample_rate: u32,
    pub existing: ExistingPolicy,
    pub include_subfolders: bool,
    pub soundfont: Option<String>,
    pub write_id3: bool,
    pub completion_beep: bool,
    pub reverb: bool,
    pub chorus: bool,
    pub normalize: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            output_dir: None,
            bitrate_kbps: 192,
            gain: 0.8,
            sample_rate: 44100,
            existing: ExistingPolicy::Overwrite,
            include_subfolders: true,
            soundfont: None,
            write_id3: true,
            completion_beep: true,
            reverb: true,
            chorus: true,
            normalize: false,
        }
    }
}

fn config_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("não foi possível localizar a pasta de configuração: {err}"))?;
    Ok(dir.join("settings.json"))
}

pub fn load(app: &AppHandle) -> Settings {
    let text = config_file(app).ok().and_then(|path| std::fs::read_to_string(path).ok());
    match text {
        Some(text) => serde_json::from_str(&text).unwrap_or_default(),
        None => Settings::default(),
    }
}

pub fn save(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = config_file(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|err| format!("não foi possível criar a pasta de configuração: {err}"))?;
    }
    let text = serde_json::to_string_pretty(settings)
        .map_err(|err| format!("não foi possível serializar as configurações: {err}"))?;
    std::fs::write(&path, text).map_err(|err| format!("não foi possível salvar as configurações: {err}"))
}