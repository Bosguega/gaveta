use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const DEFAULT_SOUNDFONT: &str = "FluidR3Mono_GM.sf3";

fn candidates(app: &AppHandle, folder: &str, file: &str) -> Vec<PathBuf> {
    let mut list: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        list.push(dir.join(folder).join(file));
        list.push(dir.join(file));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            list.push(parent.join(folder).join(file));
            list.push(parent.join(file));
        }
    }
    list.push(Path::new(env!("CARGO_MANIFEST_DIR")).join(folder).join(file));
    list
}

fn first_existing(app: &AppHandle, folder: &str, file: &str) -> Option<PathBuf> {
    candidates(app, folder, file).into_iter().find(|path| path.is_file())
}

pub fn tool(app: &AppHandle, file: &str) -> Result<PathBuf, String> {
    first_existing(app, "tools", file)
        .ok_or_else(|| format!("Ferramenta {file} não encontrada. Rode `pnpm fetch-tools` ou reinstale o aplicativo."))
}

pub fn soundfont(app: &AppHandle, custom: Option<&str>) -> Result<PathBuf, String> {
    if let Some(value) = custom {
        let path = PathBuf::from(value);
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!("SoundFont não encontrado: {value}"));
    }
    first_existing(app, "soundfonts", DEFAULT_SOUNDFONT).ok_or_else(|| {
        "SoundFont padrão não encontrado. Rode `pnpm fetch-tools` ou reinstale o aplicativo.".to_string()
    })
}

pub fn bundled_soundfonts(app: &AppHandle) -> Vec<(String, String)> {
    let names = [DEFAULT_SOUNDFONT, "MuseScore_General.sf3"];
    names
        .iter()
        .filter_map(|name| {
            first_existing(app, "soundfonts", name).map(|path| (name.to_string(), path.to_string_lossy().into_owned()))
        })
        .collect()
}