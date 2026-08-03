use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use super::fs_commands::resolve_comfy_desktop_paths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsefulPath {
    pub id: String,
    pub label: String,
    pub path: String,
    pub builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct UsefulPathsData {
    custom: Vec<UsefulPath>,
    overrides: HashMap<String, String>,
}

#[tauri::command]
pub fn get_useful_paths(path: String, app: AppHandle) -> Vec<UsefulPath> {
    let data = load_useful_paths_data(&app).unwrap_or_default();
    let mut result: Vec<UsefulPath> = Vec::new();

    for auto in build_builtin_paths(Path::new(&path)) {
        let final_path = data
            .overrides
            .get(&auto.id)
            .cloned()
            .unwrap_or_else(|| auto.path.clone());
        result.push(UsefulPath {
            path: final_path,
            ..auto
        });
    }

    result.extend(data.custom);
    result
}

#[tauri::command]
pub fn save_useful_paths(
    app: AppHandle,
    installation_path: String,
    shortcuts: Vec<UsefulPath>,
) -> Result<Vec<UsefulPath>, String> {
    let builtins = build_builtin_paths(Path::new(&installation_path));
    let builtin_by_id: HashMap<&String, &UsefulPath> =
        builtins.iter().map(|b| (&b.id, b)).collect();

    let mut data = load_useful_paths_data(&app).unwrap_or_default();
    let mut custom = Vec::new();
    let mut overrides = HashMap::new();

    for shortcut in shortcuts {
        if shortcut.builtin {
            // Salva o override apenas se o caminho difere do builtin original
            if let Some(builtin) = builtin_by_id.get(&shortcut.id) {
                if builtin.path != shortcut.path {
                    overrides.insert(shortcut.id.clone(), shortcut.path.clone());
                }
            }
        } else {
            custom.push(shortcut);
        }
    }

    data.custom = custom;
    data.overrides = overrides;
    save_useful_paths_data(&app, &data)?;

    Ok(get_useful_paths(installation_path, app))
}

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err(format!("Caminho não encontrado: {}", path));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Erro ao abrir no explorador: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let opener = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(opener)
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Erro ao abrir no explorador: {}", e))?;
    }

    Ok(())
}

fn build_builtin_paths(installation: &Path) -> Vec<UsefulPath> {
    let desktop_paths = resolve_comfy_desktop_paths(installation);
    let mut paths = Vec::new();

    // Modelos
    let models_path = desktop_paths
        .shared_models
        .as_ref()
        .filter(|p| p.exists())
        .or_else(|| desktop_paths.install_models.as_ref().filter(|p| p.exists()))
        .cloned()
        .unwrap_or_else(|| installation.join("models"));
    if models_path.exists() {
        paths.push(make_useful_path("builtin:models", "Modelos", &models_path));
    }

    // Workflows
    let workflows_path = desktop_paths
        .workflows
        .as_ref()
        .filter(|p| p.exists())
        .cloned()
        .unwrap_or_else(|| installation.join("workflows"));
    if workflows_path.exists() {
        paths.push(make_useful_path("builtin:workflows", "Workflows", &workflows_path));
    }

    // Custom Nodes
    let custom_nodes_path = desktop_paths
        .custom_nodes
        .as_ref()
        .filter(|p| p.exists())
        .cloned()
        .unwrap_or_else(|| installation.join("custom_nodes"));
    if custom_nodes_path.exists() {
        paths.push(make_useful_path(
            "builtin:custom_nodes",
            "Custom Nodes",
            &custom_nodes_path,
        ));
    }

    // Output (Arquivos criados)
    let output_path = desktop_paths
        .shared_output
        .as_ref()
        .filter(|p| p.exists())
        .cloned()
        .unwrap_or_else(|| installation.join("output"));
    if output_path.exists() {
        paths.push(make_useful_path("builtin:output", "Output", &output_path));
    }

    // Input
    let input_path = desktop_paths
        .shared_input
        .as_ref()
        .filter(|p| p.exists())
        .cloned()
        .unwrap_or_else(|| installation.join("input"));
    if input_path.exists() {
        paths.push(make_useful_path("builtin:input", "Input", &input_path));
    }

    paths
}

fn make_useful_path(id: &str, label: &str, path: &Path) -> UsefulPath {
    UsefulPath {
        id: id.to_string(),
        label: label.to_string(),
        path: path.to_string_lossy().to_string(),
        builtin: true,
    }
}

fn useful_paths_data_file(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Falha ao obter diretorio de dados: {}", e))?;
    Ok(config_dir.join("comfyui_useful_paths.json"))
}

fn load_useful_paths_data(app: &AppHandle) -> Result<UsefulPathsData, String> {
    let config_file = useful_paths_data_file(app)?;

    if !config_file.exists() {
        return Ok(UsefulPathsData::default());
    }

    let content = fs::read_to_string(&config_file)
        .map_err(|e| format!("Falha ao ler atalhos: {}", e))?;

    serde_json::from_str(&content).map_err(|e| format!("Falha ao parsear atalhos: {}", e))
}

fn save_useful_paths_data(app: &AppHandle, data: &UsefulPathsData) -> Result<(), String> {
    let config_file = useful_paths_data_file(app)?;
    if let Some(parent) = config_file.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Falha ao criar diretorio: {}", e))?;
    }

    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Falha ao serializar atalhos: {}", e))?;

    fs::write(&config_file, content).map_err(|e| format!("Falha ao salvar atalhos: {}", e))
}