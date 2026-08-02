use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;
use dirs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedPath {
    pub path: String,
    pub path_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedItem {
    pub name: String,
    pub path: String,
    pub size_mb: f64,
    pub category: String,
    pub file_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub success: bool,
    pub comfyui_path: String,
    pub items: Vec<ScannedItem>,
    pub summary: HashMap<String, usize>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub comfyui_path: String,
    pub scan_date: String,
    pub summary: HashMap<String, usize>,
    pub items: Vec<ScannedItem>,
}

#[derive(Debug, Clone, Default)]
struct ComfyDesktopPaths {
    root: Option<PathBuf>,
    shared_models: Option<PathBuf>,
    shared_input: Option<PathBuf>,
    shared_output: Option<PathBuf>,
    install_dir: Option<PathBuf>,
    custom_nodes: Option<PathBuf>,
    install_models: Option<PathBuf>,
    workflows: Option<PathBuf>,
}

const MODEL_EXTENSIONS: &[&str] = &[
    "safetensors", "ckpt", "pt", "pth", "bin", "onnx", "gguf", "sft", "pkl",
];

const WORKFLOW_EXTENSIONS: &[&str] = &[
    "json", "png",
];

// Patterns relativos ao diretório base de models (ex: "checkpoints" em vez de "models/checkpoints")
const CATEGORY_PATTERNS: &[(&str, &[&str])] = &[
    ("Checkpoints", &["checkpoints"]),
    ("LoRAs", &["loras"]),
    ("VAE", &["vae"]),
    ("VAE Approx", &["vae_approx"]),
    ("Upscale Models", &["upscale_models"]),
    ("Latent Upscale Models", &["latent_upscale_models"]),
    ("Embeddings", &["embeddings", "textual_inversion"]),
    ("ControlNet", &["controlnet"]),
    ("CLIP", &["clip"]),
    ("CLIP Vision", &["clip_vision"]),
    ("Hypernetworks", &["hypernetworks"]),
    ("Style Models", &["style_models"]),
    ("GLIGEN", &["gligen"]),
    ("Diffusion Models", &["diffusion_models"]),
    ("Text Encoders", &["text_encoders"]),
    ("UNet", &["unet"]),
    ("Diffusers", &["diffusers"]),
    ("Audio Encoders", &["audio_encoders"]),
    ("Background Removal", &["background_removal"]),
    ("Classifiers", &["classifiers"]),
    ("Configs", &["configs"]),
    ("Detection", &["detection"]),
    ("Frame Interpolation", &["frame_interpolation"]),
    ("Geometry Estimation", &["geometry_estimation"]),
    ("Model Patches", &["model_patches"]),
    ("Optical Flow", &["optical_flow"]),
    ("PhotoMaker", &["photomaker"]),
    ("SEED VR2", &["seedvr2"]),
    ("Custom Nodes", &["custom_nodes"]),
    ("Workflows", &["workflows"]),
    ("Input Images", &["input"]),
    ("Output Images", &["output"]),
];

#[tauri::command]
pub fn scan_comfyui_directory(path: String) -> ScanResult {
    let comfyui_path = Path::new(&path);

    if !comfyui_path.exists() {
        return ScanResult {
            success: false,
            comfyui_path: path.clone(),
            items: Vec::new(),
            summary: HashMap::new(),
            error: Some("Diretório não encontrado".to_string()),
        };
    }

    // Detecta se é uma instalação do Comfy Desktop
    let desktop_paths = resolve_comfy_desktop_paths(comfyui_path);

    if desktop_paths.root.is_none() && !is_comfyui_installation(comfyui_path) {
        return ScanResult {
            success: false,
            comfyui_path: path.clone(),
            items: Vec::new(),
            summary: HashMap::new(),
            error: Some(
                "Não parece ser uma instalação válida do ComfyUI. Procure a pasta que contém main.py e models/, ou a pasta do Comfy Desktop (Comfy-Desktop)."
                    .to_string(),
            ),
        };
    }

    let mut items: Vec<ScannedItem> = Vec::new();
    let mut summary: HashMap<String, usize> = HashMap::new();

    if desktop_paths.root.is_some() {
        // === Comfy Desktop ===
        if let Some(models) = &desktop_paths.shared_models {
            if models.exists() {
                scan_directory(models, &mut items);
            }
        }

        if let Some(custom_nodes) = &desktop_paths.custom_nodes {
            if custom_nodes.exists() {
                scan_custom_nodes(custom_nodes, &mut items);
            }
        }

        if let Some(input) = &desktop_paths.shared_input {
            if input.exists() {
                scan_images(input, &mut items, "Input Images");
            }
        }

        if let Some(output) = &desktop_paths.shared_output {
            if output.exists() {
                scan_images(output, &mut items, "Output Images");
            }
        }

        if let Some(install_models) = &desktop_paths.install_models {
            if install_models.exists() {
                scan_directory(install_models, &mut items);
            }
        }

        if let Some(workflows) = &desktop_paths.workflows {
            if workflows.exists() {
                scan_workflows(workflows, &mut items);
            }
        }
    } else {
        // === ComfyUI clássico ===
        let models_dir = comfyui_path.join("models");
        if models_dir.exists() {
            scan_directory(&models_dir, &mut items);
        }

        let custom_nodes_dir = comfyui_path.join("custom_nodes");
        if custom_nodes_dir.exists() {
            scan_custom_nodes(&custom_nodes_dir, &mut items);
        }

        let workflows_dir = comfyui_path.join("workflows");
        if workflows_dir.exists() {
            scan_workflows(&workflows_dir, &mut items);
        }

        let input_dir = comfyui_path.join("input");
        if input_dir.exists() {
            scan_images(&input_dir, &mut items, "Input Images");
        }

        let output_dir = comfyui_path.join("output");
        if output_dir.exists() {
            scan_images(&output_dir, &mut items, "Output Images");
        }
    }

    // Count by category
    for item in &items {
        *summary.entry(item.category.clone()).or_insert(0) += 1;
    }

    ScanResult {
        success: true,
        comfyui_path: path,
        items,
        summary,
        error: None,
    }
}

/// Detecta a estrutura do Comfy Desktop e resolve os caminhos relevantes.
/// Se o path selecionado for uma subpasta (ex: ComfyUI-Shared), escala para cima
/// até encontrar a raiz que contém ComfyUI-Shared ou ComfyUI-Installs.
fn resolve_comfy_desktop_paths(path: &Path) -> ComfyDesktopPaths {
    let mut result = ComfyDesktopPaths::default();

    // Escalar para cima até achar a raiz do Comfy Desktop
    let mut current = Some(path.to_path_buf());
    while let Some(dir) = current {
        if dir.join("ComfyUI-Shared").exists() || dir.join("ComfyUI-Installs").exists() {
            result.root = Some(dir.clone());
            break;
        }
        current = dir.parent().map(|p| p.to_path_buf());
    }

    if let Some(root) = &result.root {
        result.shared_models = Some(root.join("ComfyUI-Shared").join("models"));
        result.shared_input = Some(root.join("ComfyUI-Shared").join("input"));
        result.shared_output = Some(root.join("ComfyUI-Shared").join("output"));

        // Procurar a instalação real: ComfyUI-Installs/*/ComfyUI (que contém main.py)
        let installs_dir = root.join("ComfyUI-Installs");
        if installs_dir.exists() {
            if let Ok(entries) = fs::read_dir(&installs_dir) {
                for entry in entries.flatten() {
                    let install_root = entry.path();
                    let candidates = [
                        install_root.join("ComfyUI"),
                        install_root.clone(),
                    ];
                    for candidate in candidates {
                        if candidate.join("main.py").exists() {
                            result.install_dir = Some(candidate.clone());
                            result.custom_nodes = Some(candidate.join("custom_nodes"));
                            result.install_models = Some(candidate.join("models"));
                            result.workflows = Some(candidate.join("workflows"));
                            break;
                        }
                    }
                    if result.install_dir.is_some() {
                        break;
                    }
                }
            }
        }
    }

    result
}

fn is_comfyui_installation(path: &Path) -> bool {
    let main_py = path.join("main.py");
    let comfy_dir = path.join("comfy");
    let models_dir = path.join("models");
    let custom_nodes_dir = path.join("custom_nodes");
    let shared_dir = path.join("ComfyUI-Shared");
    let installs_dir = path.join("ComfyUI-Installs");

    main_py.exists()
        || comfy_dir.exists()
        || models_dir.exists()
        || custom_nodes_dir.exists()
        || shared_dir.exists()
        || installs_dir.exists()
}

fn scan_directory(base_path: &Path, items: &mut Vec<ScannedItem>) {
    for entry in WalkDir::new(base_path)
        .min_depth(1)
        .max_depth(10)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension() {
                if let Some(ext_str) = ext.to_str() {
                    let ext_lower = ext_str.to_ascii_lowercase();
                    if MODEL_EXTENSIONS.contains(&ext_lower.as_str()) {
                        if let Ok(metadata) = entry.metadata() {
                            let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);
                            let category = determine_category(entry.path(), base_path);

                            items.push(ScannedItem {
                                name: entry.file_name().to_string_lossy().to_string(),
                                path: entry.path().to_string_lossy().to_string(),
                                size_mb,
                                category: category.clone(),
                                file_type: ext_lower,
                            });
                        }
                    }
                }
            }
        }
    }
}

fn scan_custom_nodes(path: &Path, items: &mut Vec<ScannedItem>) {
    for entry in WalkDir::new(path)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_dir() {
            let init_py = entry.path().join("__init__.py");
            if init_py.exists() {
                let size_bytes = get_dir_size(entry.path());
                let size_mb = size_bytes as f64 / (1024.0 * 1024.0);

                items.push(ScannedItem {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: entry.path().to_string_lossy().to_string(),
                    size_mb,
                    category: "Custom Nodes".to_string(),
                    file_type: "folder".to_string(),
                });
            }
        }
    }
}

fn get_dir_size(path: &Path) -> u64 {
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

fn scan_workflows(path: &Path, items: &mut Vec<ScannedItem>) {
    for entry in WalkDir::new(path)
        .min_depth(1)
        .max_depth(3)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension() {
                if let Some(ext_str) = ext.to_str() {
                    let ext_lower = ext_str.to_ascii_lowercase();
                    if WORKFLOW_EXTENSIONS.contains(&ext_lower.as_str()) {
                        if let Ok(metadata) = entry.metadata() {
                            let size_kb = metadata.len() as f64 / 1024.0;

                            items.push(ScannedItem {
                                name: entry.file_name().to_string_lossy().to_string(),
                                path: entry.path().to_string_lossy().to_string(),
                                size_mb: size_kb / 1024.0,
                                category: "Workflows".to_string(),
                                file_type: ext_lower,
                            });
                        }
                    }
                }
            }
        }
    }
}

fn scan_images(path: &Path, items: &mut Vec<ScannedItem>, category: &str) {
    let image_extensions = &["png", "jpg", "jpeg", "gif", "bmp", "webp"];

    for entry in WalkDir::new(path)
        .min_depth(1)
        .max_depth(5)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension() {
                if let Some(ext_str) = ext.to_str() {
                    let ext_lower = ext_str.to_lowercase();
                    if image_extensions.contains(&ext_lower.as_str()) {
                        if let Ok(metadata) = entry.metadata() {
                            let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);

                            items.push(ScannedItem {
                                name: entry.file_name().to_string_lossy().to_string(),
                                path: entry.path().to_string_lossy().to_string(),
                                size_mb,
                                category: category.to_string(),
                                file_type: ext_str.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
}

fn determine_category(file_path: &Path, base_path: &Path) -> String {
    let relative = file_path.strip_prefix(base_path).unwrap_or(file_path);
    let components: Vec<String> = relative
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .map(|component| component.to_ascii_lowercase())
        .collect();

    for (category, patterns) in CATEGORY_PATTERNS.iter() {
        for pattern in patterns.iter() {
            if components.iter().any(|component| component == pattern) {
                return category.to_string();
            }
        }
    }

    "Outros".to_string()
}

#[tauri::command]
pub fn get_common_comfyui_paths() -> Vec<String> {
    let mut paths: Vec<String> = Vec::new();

    // Windows common paths
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join("ComfyUI").to_string_lossy().to_string());
        paths.push(home.join("ComfyUI_windows_portable").to_string_lossy().to_string());
        paths.push(home.join("Desktop").join("ComfyUI").to_string_lossy().to_string());
        paths.push(home.join("Documents").join("ComfyUI").to_string_lossy().to_string());
    }

    // Comfy Desktop (app oficial) — %LOCALAPPDATA%\Comfy-Desktop
    if let Some(local_app_data) = dirs::data_local_dir() {
        paths.push(local_app_data.join("Comfy-Desktop").to_string_lossy().to_string());
    }

    // D: drive common for installations
    paths.push("D:\\ComfyUI".to_string());
    paths.push("D:\\ComfyUI_windows_portable".to_string());

    paths
}

#[tauri::command]
pub fn find_comfyui_installations(app: AppHandle) -> Result<Vec<SavedPath>, String> {
    let mut found_paths: Vec<SavedPath> = Vec::new();

    // Common ComfyUI installation locations on Windows
    let search_paths: Vec<PathBuf> = vec![
        PathBuf::from("C:/Program Files/ComfyUI"),
        PathBuf::from("C:/Program Files (x86)/ComfyUI"),
        PathBuf::from("D:/ComfyUI"),
        PathBuf::from("D:/Program Files/ComfyUI"),
    ];

    // Check common installation paths
    for path in &search_paths {
        if path.exists() && is_comfyui_installation(path) {
            found_paths.push(SavedPath {
                path: path.to_string_lossy().to_string(),
                path_type: "installation".to_string(),
            });
        }
    }

    // Check home directory
    if let Some(home) = dirs::home_dir() {
        let home_comfyui = home.join("ComfyUI");
        if home_comfyui.exists() && is_comfyui_installation(&home_comfyui) {
            found_paths.push(SavedPath {
                path: home_comfyui.to_string_lossy().to_string(),
                path_type: "installation".to_string(),
            });
        }

        // Check for portable version
        let portable = home.join("ComfyUI_windows_portable");
        if portable.exists() && is_comfyui_installation(&portable) {
            found_paths.push(SavedPath {
                path: portable.to_string_lossy().to_string(),
                path_type: "portable".to_string(),
            });
        }
    }

    // Check Comfy Desktop in %LOCALAPPDATA%
    if let Some(local_app_data) = dirs::data_local_dir() {
        let comfy_desktop = local_app_data.join("Comfy-Desktop");
        if comfy_desktop.exists() {
            found_paths.push(SavedPath {
                path: comfy_desktop.to_string_lossy().to_string(),
                path_type: "comfy-desktop".to_string(),
            });
        }
    }

    // Preserve previous discoveries, but never return duplicate directories.
    let mut saved_paths = get_saved_paths(app.clone())?;
    saved_paths.append(&mut found_paths);
    let mut seen = HashSet::new();
    saved_paths.retain(|saved| seen.insert(saved.path.clone()));
    save_found_paths(&app, &saved_paths)?;

    Ok(saved_paths)
}

#[tauri::command]
pub fn get_saved_paths(app: AppHandle) -> Result<Vec<SavedPath>, String> {
    let config_dir = app.path().app_data_dir()
        .map_err(|e| format!("Falha ao obter diretorio de dados: {}", e))?;

    let config_file = config_dir.join("comfyui_paths.json");

    if !config_file.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&config_file)
        .map_err(|e| format!("Falha ao ler configuracoes: {}", e))?;

    let paths: Vec<SavedPath> = serde_json::from_str(&content)
        .map_err(|e| format!("Falha ao parsear configuracoes: {}", e))?;

    Ok(paths)
}

fn save_found_paths(app: &AppHandle, paths: &[SavedPath]) -> Result<(), String> {
    let config_dir = app.path().app_data_dir()
        .map_err(|e| format!("Falha ao obter diretorio de dados: {}", e))?;

    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Falha ao criar diretorio: {}", e))?;

    let config_file = config_dir.join("comfyui_paths.json");

    let content = serde_json::to_string_pretty(paths)
        .map_err(|e| format!("Falha ao serializar configuracoes: {}", e))?;

    fs::write(&config_file, content)
        .map_err(|e| format!("Falha ao salvar configuracoes: {}", e))?;

    Ok(())
}

pub fn export_results(data: ExportData, format: String) -> Result<String, String> {
    // Filtra itens de imagem (Input/Output Images) dos exports
    let filtered_items: Vec<ScannedItem> = data
        .items
        .into_iter()
        .filter(|item| {
            item.category != "Input Images" && item.category != "Output Images"
        })
        .collect();

    let filtered_data = ExportData {
        comfyui_path: data.comfyui_path,
        scan_date: data.scan_date,
        summary: data.summary,
        items: filtered_items,
    };

    match format.as_str() {
        "json" => export_as_json(filtered_data),
        "csv" => export_as_csv(filtered_data),
        "txt" => export_as_txt(filtered_data),
        _ => Err("Formato não suportado".to_string()),
    }
}

#[tauri::command]
pub fn save_export_file(path: String, content: String) -> Result<(), String> {
    let allowed_extensions = ["json", "csv", "html", "md", "txt"];
    let extension = Path::new(&path)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase());

    if !extension.as_deref().is_some_and(|extension| allowed_extensions.contains(&extension)) {
        return Err("Formato de exportação não suportado".to_string());
    }

    fs::write(&path, content)
        .map_err(|e| format!("Erro ao salvar arquivo: {}", e))
}

fn export_as_json(data: ExportData) -> Result<String, String> {
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Erro ao serializar JSON: {}", e))?;
    Ok(json)
}

fn export_as_csv(data: ExportData) -> Result<String, String> {
    let mut csv = String::new();
    csv.push_str("Nome,Caminho,Tamanho (MB),Categoria,Tipo\n");

    for item in &data.items {
        csv.push_str(&format!(
            "\"{}\",\"{}\",{:.2},\"{}\",\"{}\"\n",
            item.name,
            item.path,
            item.size_mb,
            item.category,
            item.file_type
        ));
    }

    Ok(csv)
}

fn export_as_txt(data: ExportData) -> Result<String, String> {
    let mut txt = String::new();
    txt.push_str(&format!("ComfyUI Scanner - Relatório de Scan\n"));
    txt.push_str(&format!("================================\n\n"));
    txt.push_str(&format!("Diretório: {}\n", data.comfyui_path));
    txt.push_str(&format!("Data: {}\n\n", data.scan_date));
    txt.push_str(&format!("===== RESUMO POR CATEGORIA =====\n"));

    let mut categories: Vec<_> = data.summary.into_iter().collect();
    categories.sort_by(|a, b| b.1.cmp(&a.1));
    for (category, count) in categories {
        txt.push_str(&format!("{:25} : {}\n", category, count));
    }

    txt.push_str(&format!("\n===== ITENS =====\n"));

    for item in &data.items {
        txt.push_str(&format!(
            "{} | {} | {:.2} MB | {}\n",
            item.category,
            item.name,
            item.size_mb,
            item.path
        ));
    }

    Ok(txt)
}
