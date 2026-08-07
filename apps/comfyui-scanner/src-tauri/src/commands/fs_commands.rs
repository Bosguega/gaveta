use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};
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
pub struct SafetensorsMetadata {
    pub base_model: Option<String>,
    pub trigger_words: Vec<String>,
    pub model_name: Option<String>,
    pub architecture: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub size_mb: f64,
    pub items: Vec<ScannedItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub success: bool,
    pub comfyui_path: String,
    pub items: Vec<ScannedItem>,
    pub summary: HashMap<String, usize>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkflowDependency {
    pub name: String,
    pub kind: String,
    pub status: String,
    pub matched_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkflowRecord {
    pub name: String,
    pub path: String,
    pub dependencies: Vec<WorkflowDependency>,
    pub node_types: Vec<String>,
    pub custom_nodes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkflowDependencyIndex {
    pub workflows: Vec<WorkflowRecord>,
    pub model_usage: HashMap<String, usize>,
    pub unused_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub comfyui_path: String,
    pub scan_date: String,
    pub summary: HashMap<String, usize>,
    pub items: Vec<ScannedItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanProgress {
    pub stage: String,
    pub current: usize,
    pub total: usize,
}

static SCAN_CANCELLED: AtomicBool = AtomicBool::new(false);

struct ScanContext<'a> {
    app: Option<&'a AppHandle>,
    cancel: &'a AtomicBool,
}

impl<'a> ScanContext<'a> {
    fn new(app: Option<&'a AppHandle>) -> Self {
        Self {
            app,
            cancel: &SCAN_CANCELLED,
        }
    }

    fn is_cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }

    fn emit_progress(&self, progress: ScanProgress) {
        if let Some(app) = self.app {
            let _ = app.emit("scan-progress", progress);
        }
    }

    fn emit_stage(&self, stage: &str) {
        self.emit_progress(ScanProgress {
            stage: stage.to_string(),
            current: 0,
            total: 0,
        });
    }
}

#[derive(Debug, Clone, Default)]
pub struct ComfyDesktopPaths {
    pub root: Option<PathBuf>,
    pub shared_models: Option<PathBuf>,
    pub shared_input: Option<PathBuf>,
    pub shared_output: Option<PathBuf>,
    pub install_dir: Option<PathBuf>,
    pub custom_nodes: Option<PathBuf>,
    pub install_models: Option<PathBuf>,
    pub workflows: Option<PathBuf>,
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
    scan_comfyui_directory_internal(&path, None)
}

/// Versão com progresso: emite eventos "scan-progress" e respeita o cancelamento.
/// O Tauri injeta o `AppHandle` automaticamente por ser o primeiro parâmetro.
#[tauri::command]
pub fn scan_comfyui_directory_with_progress(path: String, app: AppHandle) -> ScanResult {
    SCAN_CANCELLED.store(false, Ordering::Relaxed);
    let context = ScanContext::new(Some(&app));
    scan_comfyui_directory_internal(&path, Some(&context))
}

#[tauri::command]
pub fn cancel_comfyui_scan() -> bool {
    SCAN_CANCELLED.store(true, Ordering::Relaxed);
    true
}

fn scan_comfyui_directory_internal(path: &str, context: Option<&ScanContext>) -> ScanResult {
    let comfyui_path = Path::new(path);

    if !comfyui_path.exists() {
        return ScanResult {
            success: false,
            comfyui_path: path.to_string(),
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
            comfyui_path: path.to_string(),
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

    if let Some(ctx) = context {
        ctx.emit_stage("Resolvendo diretórios...");
    }

    if desktop_paths.root.is_some() {
        // === Comfy Desktop ===
        if let Some(models) = &desktop_paths.shared_models {
            if models.exists() {
                emit_stage_if_needed(context, "Escaneando modelos (shared)...");
                scan_directory(models, &mut items, context);
                if is_cancelled(context) { return cancelled_result(path); }
            }
        }

        if let Some(custom_nodes) = &desktop_paths.custom_nodes {
            if custom_nodes.exists() {
                emit_stage_if_needed(context, "Escaneando custom nodes...");
                scan_custom_nodes(custom_nodes, &mut items, context);
                if is_cancelled(context) { return cancelled_result(path); }
            }
        }

        if let Some(input) = &desktop_paths.shared_input {
            if input.exists() {
                emit_stage_if_needed(context, "Escaneando input...");
                scan_images(input, &mut items, "Input Images", context);
                if is_cancelled(context) { return cancelled_result(path); }
            }
        }

        if let Some(output) = &desktop_paths.shared_output {
            if output.exists() {
                emit_stage_if_needed(context, "Escaneando output...");
                scan_images(output, &mut items, "Output Images", context);
                if is_cancelled(context) { return cancelled_result(path); }
            }
        }

        if let Some(install_models) = &desktop_paths.install_models {
            if install_models.exists() {
                emit_stage_if_needed(context, "Escaneando modelos (install)...");
                scan_directory(install_models, &mut items, context);
                if is_cancelled(context) { return cancelled_result(path); }
            }
        }

        if let Some(install_dir) = &desktop_paths.install_dir {
            emit_stage_if_needed(context, "Escaneando workflows...");
            for workflows in discover_workflow_directories(install_dir) {
                scan_workflows(&workflows, &mut items, context);
                if is_cancelled(context) { return cancelled_result(path); }
            }
        }
    } else {
        // === ComfyUI clássico ===
        let models_dir = comfyui_path.join("models");
        if models_dir.exists() {
            emit_stage_if_needed(context, "Escaneando modelos...");
            scan_directory(&models_dir, &mut items, context);
            if is_cancelled(context) { return cancelled_result(path); }
        }

        let custom_nodes_dir = comfyui_path.join("custom_nodes");
        if custom_nodes_dir.exists() {
            emit_stage_if_needed(context, "Escaneando custom nodes...");
            scan_custom_nodes(&custom_nodes_dir, &mut items, context);
            if is_cancelled(context) { return cancelled_result(path); }
        }

        emit_stage_if_needed(context, "Escaneando workflows...");
        for workflows in discover_workflow_directories(comfyui_path) {
            scan_workflows(&workflows, &mut items, context);
            if is_cancelled(context) { return cancelled_result(path); }
        }

        let input_dir = comfyui_path.join("input");
        if input_dir.exists() {
            emit_stage_if_needed(context, "Escaneando input...");
            scan_images(&input_dir, &mut items, "Input Images", context);
            if is_cancelled(context) { return cancelled_result(path); }
        }

        let output_dir = comfyui_path.join("output");
        if output_dir.exists() {
            emit_stage_if_needed(context, "Escaneando output...");
            scan_images(&output_dir, &mut items, "Output Images", context);
            if is_cancelled(context) { return cancelled_result(path); }
        }
    }

    if let Some(ctx) = context {
        ctx.emit_progress(ScanProgress {
            stage: "Finalizando...".to_string(),
            current: items.len(),
            total: items.len(),
        });
    }

    // Count by category
    for item in &items {
        *summary.entry(item.category.clone()).or_insert(0) += 1;
    }

    ScanResult {
        success: true,
        comfyui_path: path.to_string(),
        items,
        summary,
        error: None,
    }
}

fn cancelled_result(path: &str) -> ScanResult {
    ScanResult {
        success: false,
        comfyui_path: path.to_string(),
        items: Vec::new(),
        summary: HashMap::new(),
        error: Some("Scan cancelado".to_string()),
    }
}

fn is_cancelled(context: Option<&ScanContext>) -> bool {
    context.map(|c| c.is_cancelled()).unwrap_or(false)
}

fn emit_stage_if_needed(context: Option<&ScanContext>, stage: &str) {
    if let Some(ctx) = context {
        ctx.emit_stage(stage);
    }
}

/// Detecta a estrutura do Comfy Desktop e resolve os caminhos relevantes.
/// Se o path selecionado for uma subpasta (ex: ComfyUI-Shared), escala para cima
/// até encontrar a raiz que contém ComfyUI-Shared ou ComfyUI-Installs.
pub fn resolve_comfy_desktop_paths(path: &Path) -> ComfyDesktopPaths {
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

fn scan_directory(base_path: &Path, items: &mut Vec<ScannedItem>, context: Option<&ScanContext>) {
    for entry in WalkDir::new(base_path)
        .min_depth(1)
        .max_depth(10)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if is_cancelled(context) { break; }
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

fn scan_custom_nodes(path: &Path, items: &mut Vec<ScannedItem>, context: Option<&ScanContext>) {
    for entry in WalkDir::new(path)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if is_cancelled(context) { break; }
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

fn scan_workflows(path: &Path, items: &mut Vec<ScannedItem>, context: Option<&ScanContext>) {
    for entry in WalkDir::new(path)
        .min_depth(1)
        .max_depth(3)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if is_cancelled(context) { break; }
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

/// Includes both the legacy root folder and workflows belonging to each user profile.
/// Comfy Desktop normally saves these under `user/default/workflows`.
fn discover_workflow_directories(comfyui_root: &Path) -> Vec<PathBuf> {
    let mut directories = Vec::new();
    let legacy = comfyui_root.join("workflows");
    if legacy.is_dir() {
        directories.push(legacy);
    }

    let users_dir = comfyui_root.join("user");
    if let Ok(profiles) = fs::read_dir(users_dir) {
        for profile in profiles.flatten() {
            let workflows = profile.path().join("workflows");
            if workflows.is_dir() {
                directories.push(workflows);
            }
        }
    }
    directories
}

fn scan_images(path: &Path, items: &mut Vec<ScannedItem>, category: &str, context: Option<&ScanContext>) {
    let image_extensions = &["png", "jpg", "jpeg", "gif", "bmp", "webp"];

    for entry in WalkDir::new(path)
        .min_depth(1)
        .max_depth(5)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if is_cancelled(context) { break; }
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
/// Constrói o índice de dependências a partir dos itens já escaneados pelo frontend,
/// evitando um segundo scan completo.
pub fn build_workflow_dependency_index(path: String, scanned_items: Vec<ScannedItem>) -> Result<WorkflowDependencyIndex, String> {
    let model_items: Vec<&ScannedItem> = scanned_items.iter()
        .filter(|item| !matches!(item.category.as_str(), "Workflows" | "Custom Nodes" | "Input Images" | "Output Images"))
        .collect();
    let models_by_name: HashMap<String, &ScannedItem> = model_items.iter()
        .map(|item| (item.name.to_ascii_lowercase(), *item))
        .collect();

    let root = Path::new(&path);
    let desktop_paths = resolve_comfy_desktop_paths(root);
    let workflow_root = desktop_paths.install_dir.as_deref().unwrap_or(root);
    let workflow_dirs = discover_workflow_directories(workflow_root);
    let custom_nodes_dir = if desktop_paths.root.is_some() {
        desktop_paths.custom_nodes
    } else {
        Some(root.join("custom_nodes"))
    };

    let mut workflows = Vec::new();
    let mut model_usage: HashMap<String, usize> = HashMap::new();
    for workflow_dir in workflow_dirs.into_iter().filter(|dir| dir.exists()) {
        for entry in WalkDir::new(workflow_dir).min_depth(1).max_depth(3).into_iter().filter_map(|entry| entry.ok()) {
            if !entry.file_type().is_file() || entry.path().extension().and_then(|ext| ext.to_str()).map(|ext| ext.eq_ignore_ascii_case("json")) != Some(true) {
                continue;
            }
            let Ok(content) = fs::read_to_string(entry.path()) else { continue; };
            let Ok(document) = serde_json::from_str::<serde_json::Value>(&content) else { continue; };
            let node_types = extract_node_types(&document);
            if node_types.is_empty() { continue; }

            let mut referenced = extract_api_model_references(&document);
            extract_known_model_references(&document, &models_by_name, &mut referenced);
            let mut dependencies = Vec::new();
            for reference in referenced {
                let lookup = reference.to_ascii_lowercase();
                if let Some(model) = models_by_name.get(&lookup) {
                    *model_usage.entry(model.name.clone()).or_insert(0) += 1;
                    dependencies.push(WorkflowDependency { name: model.name.clone(), kind: model.category.clone(), status: "installed".to_string(), matched_path: Some(model.path.clone()) });
                } else {
                    dependencies.push(WorkflowDependency { name: reference, kind: "Model reference".to_string(), status: "missing".to_string(), matched_path: None });
                }
            }
            dependencies.sort_by(|a, b| a.name.cmp(&b.name));
            let custom_nodes = find_custom_node_providers(&node_types, custom_nodes_dir.as_deref());
            workflows.push(WorkflowRecord {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path().to_string_lossy().to_string(),
                dependencies,
                node_types,
                custom_nodes,
            });
        }
    }
    workflows.sort_by(|a, b| a.name.cmp(&b.name));
    let unused_model_names: Vec<String> = model_items.iter()
        .filter(|item| !model_usage.contains_key(&item.name))
        .map(|item| item.name.clone())
        .collect();
    Ok(WorkflowDependencyIndex { workflows, model_usage, unused_models: unused_model_names })
}

fn extract_node_types(document: &serde_json::Value) -> Vec<String> {
    let mut types = BTreeSet::new();
    if let Some(nodes) = document.get("nodes").and_then(|nodes| nodes.as_array()) {
        for node in nodes {
            if let Some(node_type) = node.get("type").and_then(|value| value.as_str()) { types.insert(node_type.to_string()); }
        }
    } else if let Some(nodes) = document.as_object() {
        for node in nodes.values() {
            if let Some(node_type) = node.get("class_type").and_then(|value| value.as_str()) { types.insert(node_type.to_string()); }
        }
    }
    types.into_iter().collect()
}

fn extract_api_model_references(document: &serde_json::Value) -> BTreeSet<String> {
    let mut references = BTreeSet::new();
    let Some(nodes) = document.as_object() else { return references; };
    for node in nodes.values() {
        let Some(inputs) = node.get("inputs").and_then(|inputs| inputs.as_object()) else { continue; };
        for (input_name, value) in inputs {
            let name = input_name.to_ascii_lowercase();
            if ["ckpt", "checkpoint", "model", "lora", "vae", "control", "unet", "clip", "upscale", "encoder"].iter().any(|keyword| name.contains(keyword)) {
                if let Some(value) = value.as_str() { references.insert(value.to_string()); }
            }
        }
    }
    references
}

fn extract_known_model_references(document: &serde_json::Value, models: &HashMap<String, &ScannedItem>, references: &mut BTreeSet<String>) {
    match document {
        serde_json::Value::String(value) => {
            if let Some(model) = models.get(&value.to_ascii_lowercase()) { references.insert(model.name.clone()); }
        }
        serde_json::Value::Array(values) => for value in values { extract_known_model_references(value, models, references); },
        serde_json::Value::Object(values) => for value in values.values() { extract_known_model_references(value, models, references); },
        _ => {}
    }
}

fn find_custom_node_providers(node_types: &[String], custom_nodes_dir: Option<&Path>) -> Vec<String> {
    let Some(custom_nodes_dir) = custom_nodes_dir.filter(|dir| dir.exists()) else { return Vec::new(); };
    let mut providers = BTreeSet::new();
    for entry in WalkDir::new(custom_nodes_dir).min_depth(1).max_depth(4).into_iter().filter_map(|entry| entry.ok()) {
        if !entry.file_type().is_file() || entry.path().extension().and_then(|ext| ext.to_str()) != Some("py") { continue; }
        let Ok(content) = fs::read_to_string(entry.path()) else { continue; };
        if node_types.iter().any(|node_type| content.contains(&format!("\"{}\"", node_type)) || content.contains(&format!("'{}'", node_type))) {
            if let Ok(relative) = entry.path().strip_prefix(custom_nodes_dir) {
                if let Some(provider) = relative.components().next().and_then(|component| component.as_os_str().to_str()) { providers.insert(provider.to_string()); }
            }
        }
    }
    providers.into_iter().collect()
}

/// Retorna os candidatos canônicos de instalação do ComfyUI.
/// Usada tanto para sugestões de caminho quanto para detecção automática.
fn candidate_paths() -> Vec<(PathBuf, &'static str)> {
    let mut candidates: Vec<(PathBuf, &'static str)> = Vec::new();

    if let Some(home) = dirs::home_dir() {
        candidates.push((home.join("ComfyUI"), "installation"));
        candidates.push((home.join("ComfyUI_windows_portable"), "portable"));
        candidates.push((home.join("Desktop").join("ComfyUI"), "installation"));
        candidates.push((home.join("Documents").join("ComfyUI"), "installation"));
    }

    if let Some(local_app_data) = dirs::data_local_dir() {
        candidates.push((local_app_data.join("Comfy-Desktop"), "comfy-desktop"));
    }

    candidates.push((PathBuf::from("C:/Program Files/ComfyUI"), "installation"));
    candidates.push((PathBuf::from("C:/Program Files (x86)/ComfyUI"), "installation"));
    candidates.push((PathBuf::from("D:/ComfyUI"), "installation"));
    candidates.push((PathBuf::from("D:/ComfyUI_windows_portable"), "portable"));
    candidates.push((PathBuf::from("D:/Program Files/ComfyUI"), "installation"));

    candidates
}

#[tauri::command]
pub fn get_common_comfyui_paths() -> Vec<String> {
    candidate_paths()
        .into_iter()
        .map(|(path, _)| path.to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
pub fn find_comfyui_installations(app: AppHandle) -> Result<Vec<SavedPath>, String> {
    let mut found_paths: Vec<SavedPath> = Vec::new();

    for (path, path_type) in candidate_paths() {
        if path.exists() && is_comfyui_installation(&path) {
            found_paths.push(SavedPath {
                path: path.to_string_lossy().to_string(),
                path_type: path_type.to_string(),
            });
        }
    }

    // Preserva descobertas anteriores sem duplicar.
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
pub fn rename_model_file(path: String, new_name: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err("Arquivo não encontrado".to_string());
    }

    let parent = target.parent().ok_or_else(|| "Caminho inválido".to_string())?;
    let new_path = parent.join(&new_name);

    if new_path.exists() {
        return Err(format!("Já existe um arquivo com o nome '{}'", new_name));
    }

    fs::rename(target, &new_path)
        .map_err(|e| format!("Erro ao renomear arquivo: {}", e))
}

#[tauri::command]
pub fn delete_model_file(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err("Arquivo não encontrado".to_string());
    }

    fs::remove_file(target)
        .map_err(|e| format!("Erro ao excluir arquivo: {}", e))
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

#[tauri::command]
pub fn read_safetensors_metadata(path: String) -> Result<SafetensorsMetadata, String> {
    use std::io::Read;

    let target = Path::new(&path);
    if !target.exists() {
        return Err("Arquivo não encontrado".to_string());
    }

    let mut file = fs::File::open(target).map_err(|e| format!("Erro ao abrir arquivo: {}", e))?;
    let mut header_size_bytes = [0u8; 8];
    file.read_exact(&mut header_size_bytes)
        .map_err(|e| format!("Erro ao ler tamanho do cabeçalho: {}", e))?;

    let header_size = u64::from_le_bytes(header_size_bytes);
    if header_size > 50 * 1024 * 1024 {
        return Err("Cabeçalho safetensors invalido ou muito grande".to_string());
    }

    let mut header_buf = vec![0u8; header_size as usize];
    file.read_exact(&mut header_buf)
        .map_err(|e| format!("Erro ao ler cabeçalho: {}", e))?;

    let header_str = String::from_utf8(header_buf)
        .map_err(|e| format!("Cabeçalho não é UTF-8 valido: {}", e))?;

    let json: serde_json::Value = serde_json::from_str(&header_str)
        .map_err(|e| format!("JSON do cabeçalho invalido: {}", e))?;

    let mut base_model: Option<String> = None;
    let mut trigger_words: BTreeSet<String> = BTreeSet::new();
    let mut model_name: Option<String> = None;
    let mut architecture: Option<String> = None;

    if let Some(metadata) = json.get("__metadata__").and_then(|m| m.as_object()) {
        // Base Model
        if let Some(val) = metadata.get("ss_base_model_version").and_then(|v| v.as_str()) {
            base_model = Some(format_base_model(val));
        } else if let Some(val) = metadata.get("modelspec.architecture").and_then(|v| v.as_str()) {
            architecture = Some(val.to_string());
            if val.to_ascii_lowercase().contains("flux") {
                base_model = Some("FLUX".to_string());
            } else if val.to_ascii_lowercase().contains("sdxl") {
                base_model = Some("SDXL".to_string());
            } else if val.to_ascii_lowercase().contains("sd3") {
                base_model = Some("SD3".to_string());
            } else if val.to_ascii_lowercase().contains("v1") {
                base_model = Some("SD 1.5".to_string());
            }
        }

        // Model Name / Output Name
        if let Some(val) = metadata.get("ss_output_name").and_then(|v| v.as_str()) {
            model_name = Some(val.to_string());
        } else if let Some(val) = metadata.get("modelspec.title").and_then(|v| v.as_str()) {
            model_name = Some(val.to_string());
        }

        // Trigger words extraídos de ss_tag_frequency ou ss_trained_words ou modelspec.trigger_phrase
        if let Some(val) = metadata.get("modelspec.trigger_phrase").and_then(|v| v.as_str()) {
            for word in val.split(',').map(|w| w.trim()).filter(|w| !w.is_empty()) {
                trigger_words.insert(word.to_string());
            }
        }

        if let Some(val) = metadata.get("ss_trained_words").and_then(|v| v.as_str()) {
            let parsed: Result<Vec<String>, _> = serde_json::from_str(val);
            if let Ok(words) = parsed {
                for w in words {
                    if !w.trim().is_empty() {
                        trigger_words.insert(w.trim().to_string());
                    }
                }
            } else {
                for word in val.split(',').map(|w| w.trim()).filter(|w| !w.is_empty()) {
                    trigger_words.insert(word.to_string());
                }
            }
        }

        if let Some(tag_freq_str) = metadata.get("ss_tag_frequency").and_then(|v| v.as_str()) {
            if let Ok(freq_obj) = serde_json::from_str::<serde_json::Value>(tag_freq_str) {
                if let Some(freq_map) = freq_obj.as_object() {
                    for dir_tags in freq_map.values() {
                        if let Some(tags) = dir_tags.as_object() {
                            let mut sorted_tags: Vec<(&String, u64)> = tags
                                .iter()
                                .filter_map(|(k, v)| v.as_u64().map(|count| (k, count)))
                                .collect();
                            sorted_tags.sort_by(|a, b| b.1.cmp(&a.1));
                            for (tag, _) in sorted_tags.into_iter().take(15) {
                                trigger_words.insert(tag.clone());
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(SafetensorsMetadata {
        base_model,
        trigger_words: trigger_words.into_iter().take(20).collect(),
        model_name,
        architecture,
    })
}

fn format_base_model(raw: &str) -> String {
    let lower = raw.to_ascii_lowercase();
    if lower.contains("sdxl") || lower.contains("sd_xl") {
        "SDXL".to_string()
    } else if lower.contains("v1") || lower.contains("sd_v1") || lower.contains("1.5") {
        "SD 1.5".to_string()
    } else if lower.contains("v2") || lower.contains("sd_v2") || lower.contains("2.1") {
        "SD 2.x".to_string()
    } else if lower.contains("flux") {
        "FLUX".to_string()
    } else if lower.contains("sd3") {
        "SD3".to_string()
    } else if lower.contains("pony") {
        "Pony".to_string()
    } else if lower.contains("illustrious") {
        "Illustrious".to_string()
    } else {
        raw.to_string()
    }
}

#[tauri::command]
pub fn find_duplicate_models(items: Vec<ScannedItem>) -> Vec<DuplicateGroup> {

    // Agrupa itens por tamanho aproximado (arredondado a 0.001 MB)
    let mut by_size: HashMap<u64, Vec<ScannedItem>> = HashMap::new();
    for item in items {
        if matches!(item.category.as_str(), "Workflows" | "Custom Nodes" | "Input Images" | "Output Images") {
            continue;
        }
        let key = (item.size_mb * 1000.0) as u64;
        by_size.entry(key).or_default().push(item);
    }

    let mut duplicate_groups = Vec::new();

    for (_size_key, candidate_items) in by_size {
        if candidate_items.len() < 2 {
            continue;
        }

        // Calcula quick-hash (64KB inicio + 64KB fim + tamanho exato) para confirmar duplicatas
        let mut by_hash: HashMap<String, Vec<ScannedItem>> = HashMap::new();
        for item in candidate_items {
            if let Ok(hash) = calculate_quick_hash(&item.path) {
                by_hash.entry(hash).or_default().push(item);
            }
        }

        for (_hash, items_group) in by_hash {
            if items_group.len() >= 2 {
                let size_mb = items_group[0].size_mb;
                duplicate_groups.push(DuplicateGroup {
                    size_mb,
                    items: items_group,
                });
            }
        }
    }

    duplicate_groups.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap_or(std::cmp::Ordering::Equal));
    duplicate_groups
}

fn calculate_quick_hash(path_str: &str) -> Result<String, String> {
    use std::io::{Read, Seek, SeekFrom};

    let path = Path::new(path_str);
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let len = file.metadata().map_err(|e| e.to_string())?.len();

    if len == 0 {
        return Ok("0_empty".to_string());
    }

    let chunk_size = 256 * 1024; // 256 KB
    let mut hasher: u64 = len;

    // FNV-1a 64-bit hash
    let mut mix_bytes = |bytes: &[u8]| {
        for &byte in bytes {
            hasher ^= byte as u64;
            hasher = hasher.wrapping_mul(0x100000001b3);
        }
    };

    // 1. Inicio (Primeiros 256 KB)
    let mut head_buf = vec![0u8; chunk_size];
    let head_read = file.read(&mut head_buf).unwrap_or(0);
    mix_bytes(&head_buf[..head_read]);

    // 2. Ponto Médio (256 KB a 50% do arquivo)
    if len > (chunk_size * 2) as u64 {
        let mid_offset = len / 2;
        if file.seek(SeekFrom::Start(mid_offset)).is_ok() {
            let mut mid_buf = vec![0u8; chunk_size];
            let mid_read = file.read(&mut mid_buf).unwrap_or(0);
            mix_bytes(&mid_buf[..mid_read]);
        }
    }

    // 3. Fim (Últimos 256 KB)
    if len > chunk_size as u64 {
        let tail_offset = len.saturating_sub(chunk_size as u64);
        if file.seek(SeekFrom::Start(tail_offset)).is_ok() {
            let mut tail_buf = vec![0u8; chunk_size];
            let tail_read = file.read(&mut tail_buf).unwrap_or(0);
            mix_bytes(&tail_buf[..tail_read]);
        }
    }

    Ok(format!("{}_{:016x}", len, hasher))
}

fn export_as_json(data: ExportData) -> Result<String, String> {
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Erro ao serializar JSON: {}", e))?;
    Ok(json)
}

/// Escapa um campo de texto para CSV (RFC 4180): substitui `"` por `""`.
fn csv_escape(value: &str) -> String {
    value.replace('"', "\"\"")
}

fn export_as_csv(data: ExportData) -> Result<String, String> {
    let mut csv = String::new();
    csv.push_str("Nome,Caminho,Tamanho (MB),Categoria,Tipo\n");

    for item in &data.items {
        csv.push_str(&format!(
            "\"{}\",\"{}\",{:.2},\"{}\",\"{}\"\n",
            csv_escape(&item.name),
            csv_escape(&item.path),
            item.size_mb,
            csv_escape(&item.category),
            csv_escape(&item.file_type)
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn create_temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("comfyui_scanner_test_{}_{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn test_is_comfyui_installation_detects_main_py() {
        let dir = create_temp_dir("main_py");
        fs::write(dir.join("main.py"), "").unwrap();
        assert!(is_comfyui_installation(&dir));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_is_comfyui_installation_detects_models_dir() {
        let dir = create_temp_dir("models");
        fs::create_dir_all(dir.join("models")).unwrap();
        assert!(is_comfyui_installation(&dir));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_is_comfyui_installation_rejects_empty_dir() {
        let dir = create_temp_dir("empty");
        assert!(!is_comfyui_installation(&dir));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_determine_category_detects_checkpoints() {
        let base = Path::new("C:/ComfyUI/models");
        let file = Path::new("C:/ComfyUI/models/checkpoints/model.safetensors");
        assert_eq!(determine_category(file, base), "Checkpoints");
    }

    #[test]
    fn test_determine_category_detects_loras() {
        let base = Path::new("C:/ComfyUI/models");
        let file = Path::new("C:/ComfyUI/models/loras/style.safetensors");
        assert_eq!(determine_category(file, base), "LoRAs");
    }

    #[test]
    fn test_determine_category_falls_back_to_outros() {
        let base = Path::new("C:/ComfyUI/models");
        let file = Path::new("C:/ComfyUI/models/unknown/file.safetensors");
        assert_eq!(determine_category(file, base), "Outros");
    }

    #[test]
    fn test_resolve_comfy_desktop_paths_detects_shared() {
        let root = create_temp_dir("desktop_root");
        fs::create_dir_all(root.join("ComfyUI-Shared").join("models")).unwrap();
        fs::create_dir_all(root.join("ComfyUI-Shared").join("input")).unwrap();
        fs::create_dir_all(root.join("ComfyUI-Shared").join("output")).unwrap();

        let paths = resolve_comfy_desktop_paths(&root);
        assert!(paths.root.is_some());
        assert!(paths.shared_models.is_some());
        assert!(paths.shared_input.is_some());
        assert!(paths.shared_output.is_some());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_resolve_comfy_desktop_paths_scales_up_from_subdir() {
        let root = create_temp_dir("desktop_scale");
        fs::create_dir_all(root.join("ComfyUI-Shared").join("models")).unwrap();
        let subdir = root.join("some").join("nested").join("dir");
        fs::create_dir_all(&subdir).unwrap();

        let paths = resolve_comfy_desktop_paths(&subdir);
        assert!(paths.root.is_some());
        assert_eq!(paths.root.unwrap(), root);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_scan_comfyui_directory_rejects_invalid_path() {
        let result = scan_comfyui_directory("Z:/nonexistent/path".to_string());
        assert!(!result.success);
        assert!(result.error.is_some());
    }
}
