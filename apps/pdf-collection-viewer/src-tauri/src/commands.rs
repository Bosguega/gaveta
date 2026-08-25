use crate::db::{self, DbState, ThumbnailStatus, UpdateResult};
use crate::file_types::FileType;
use crate::scanner;
use crate::thumbnails;
use crate::ScanCancels;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

// Collections

#[tauri::command]
pub fn list_collections(state: State<DbState>) -> Result<Vec<db::Collection>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_collections(&conn)
}

#[tauri::command]
pub fn create_collection(
    app: AppHandle,
    state: State<DbState>,
    name: String,
    icon: String,
    icon_path: Option<String>,
    paths: Vec<String>,
    include_subfolders: bool,
) -> Result<db::Collection, String> {
    if name.trim().is_empty() {
        return Err("O nome da coleção é obrigatório".to_string());
    }
    if paths.is_empty() || paths.iter().any(|path| path.trim().is_empty()) {
        return Err("Adicione pelo menos um caminho de pasta".to_string());
    }

    validate_collection_paths(&paths)?;

    let resolved_icon_path = resolve_icon_path(&app, icon_path.as_deref())?;

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_collection(&conn, &name, &icon, resolved_icon_path.as_deref(), &paths, include_subfolders)
}

#[tauri::command]
pub fn update_collection(
    app: AppHandle,
    state: State<DbState>,
    id: i64,
    name: String,
    icon: String,
    icon_path: Option<String>,
    paths: Vec<String>,
    include_subfolders: bool,
) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("O nome da coleção é obrigatório".to_string());
    }
    if paths.is_empty() || paths.iter().any(|path| path.trim().is_empty()) {
        return Err("Adicione pelo menos um caminho de pasta".to_string());
    }

    validate_collection_paths(&paths)?;

    let resolved_icon_path = resolve_icon_path(&app, icon_path.as_deref())?;

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_collection(&conn, id, &name, &icon, resolved_icon_path.as_deref(), &paths, include_subfolders)
}

/// Paths that are already generated covers living in the app cache are stored
/// as-is; anything else is treated as a raw user image and copied to the cache.
fn resolve_icon_path(app: &AppHandle, icon_path: Option<&str>) -> Result<Option<String>, String> {
    let Some(path) = icon_path else {
        return Ok(None);
    };

    let file_name = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default();
    if file_name.starts_with("collection_cover_") {
        // Cover already lives in the app cache. If it went missing (e.g. wiped
        // by an older orphan-cleanup), degrade gracefully instead of failing
        // the whole collection save.
        if Path::new(path).exists() {
            return Ok(Some(path.to_string()));
        }
        eprintln!("[resolve_icon_path] capa não encontrada no cache, ignorando: {path}");
        return Ok(None);
    }

    db::copy_icon_to_cache(app, path)
}

/// Generates the collection cover from a picked image: crops and resizes it
/// into a fixed 800x450 WebP stored in the app cache directory.
#[tauri::command]
pub fn save_collection_cover(
    app: AppHandle,
    src_path: String,
    crop_x: f64,
    crop_y: f64,
    crop_w: f64,
    crop_h: f64,
) -> Result<String, String> {
    db::save_cover_to_cache(&app, &src_path, crop_x, crop_y, crop_w, crop_h)
}

#[tauri::command]
pub fn delete_collection(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_collection(&conn, id)
}

#[tauri::command]
pub fn get_collection(state: State<DbState>, id: i64) -> Result<Option<db::CollectionDetail>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_collection(&conn, id)
}

// Items

#[tauri::command]
pub fn list_items(state: State<DbState>, collection_id: i64) -> Result<Vec<db::CollectionItem>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_items(&conn, collection_id)
}

// Scan / Update

#[tauri::command]
pub async fn update_collection_scan(
    app: AppHandle,
    state: State<'_, DbState>,
    cancels: State<'_, ScanCancels>,
    collection_id: i64,
) -> Result<UpdateResult, String> {
    cancels.mark_active(collection_id);
    let _guard = ScanClearGuard::new(&cancels, collection_id);

    // 1. Read collection configuration under a short lock.
    let collection = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::get_collection(&conn, collection_id)?
            .ok_or_else(|| "Coleção não encontrada".to_string())?
    };

    let cache = db::cache_dir(&app)?;
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Não foi possível localizar os recursos do aplicativo: {e}"))?;

    let supported: Vec<String> = FileType::enabled_extensions().iter().map(|s| s.to_string()).collect();

    let mut result = UpdateResult {
        found: 0,
        added: 0,
        removed: 0,
        updated: 0,
        thumbnails_generated: 0,
        unavailable_paths: Vec::new(),
        errored_paths: Vec::new(),
    };

    // 2. Scan all configured paths (no DB lock held during filesystem walk).
    let mut all_items: Vec<scanner::ScannedItem> = Vec::new();
    let mut keep_paths: Vec<String> = Vec::new();

    for path in &collection.paths {
        if cancels.is_cancelled(collection_id) {
            break;
        }

        let (items, unavailable, errored) = scanner::scan_items(path, collection.include_subfolders, &supported);
        if unavailable {
            result.unavailable_paths.push(path.clone());
        }
        for errored_dir in errored {
            if !result.errored_paths.contains(&errored_dir) {
                result.errored_paths.push(errored_dir);
            }
        }

        for item in items {
            keep_paths.push(item.path.clone());
            all_items.push(item);
        }
    }

    result.found = all_items.len();
    let _ = app.emit(
        "update-progress",
        db::ScanProgress {
            stage: "Arquivos encontrados".to_string(),
            current: result.found,
            total: result.found,
        },
    );

    // 3. Compare with DB and process changes. The lock is acquired only for
    //    the individual read/write operations, never across the whole loop, so
    //    other commands (list, favorite, …) can interleave while scanning.
    let mut thumbnails_to_generate: Vec<(i64, String, String)> = Vec::new(); // (item_id, path, file_type)

    for item in &all_items {
        if cancels.is_cancelled(collection_id) {
            break;
        }

        let existing = {
            let conn = state.0.lock().map_err(|e| e.to_string())?;
            db::get_item_by_path(&conn, collection_id, &item.path)?
        };

        match existing {
            Some(existing_item) => {
                // Check if metadata changed
                if existing_item.size != item.size || existing_item.modified_at != item.modified_at {
                    {
                        let conn = state.0.lock().map_err(|e| e.to_string())?;
                        db::update_item_metadata(&conn, existing_item.id, item.size, &item.modified_at)?;
                    }
                    result.updated += 1;
                    thumbnails_to_generate.push((existing_item.id, item.path.clone(), item.file_type.clone()));
                } else if !ThumbnailStatus::from_str(&existing_item.thumbnail_status).is_ready() {
                    // Metadata unchanged but thumbnail missing/errored -> try again
                    thumbnails_to_generate.push((existing_item.id, item.path.clone(), item.file_type.clone()));
                } else if let Some(key) = existing_item.thumbnail_key.clone() {
                    // A3/A4: the status is "ready" but the cached .webp may have
                    // been removed (cache cleared). Revalidate its existence and
                    // regenerate when missing instead of trusting the stale status.
                    if !thumbnails::thumbnail_exists(&cache, &key) {
                        thumbnails_to_generate.push((existing_item.id, item.path.clone(), item.file_type.clone()));
                    }
                }
            }
            None => {
                let id = {
                    let conn = state.0.lock().map_err(|e| e.to_string())?;
                    db::insert_item(
                        &conn,
                        collection_id,
                        &item.path,
                        &item.filename,
                        item.size,
                        &item.modified_at,
                        &item.file_type,
                    )?
                };
                result.added += 1;
                thumbnails_to_generate.push((id, item.path.clone(), item.file_type.clone()));
            }
        }
    }

    // 4. Remove items that no longer exist. Items under directories that were
    //    unavailable (missing root) or raised an access error are preserved so a
    //    transient failure does not delete healthy records or their favorites.
    if !cancels.is_cancelled(collection_id) {
        let mut protected_paths = result.unavailable_paths.clone();
        protected_paths.extend(result.errored_paths.iter().cloned());
        result.removed = {
            let conn = state.0.lock().map_err(|e| e.to_string())?;
            db::delete_items_not_in(&conn, collection_id, &keep_paths, &protected_paths)?
        };
    }

    // 5. Generate thumbnails for new/changed items (no DB lock during rendering).
    let total = thumbnails_to_generate.len();
    for (index, (item_id, item_path, file_type)) in thumbnails_to_generate.iter().enumerate() {
        if cancels.is_cancelled(collection_id) {
            break;
        }

        let _ = app.emit(
            "update-progress",
            db::ScanProgress {
                stage: "Gerando miniaturas".to_string(),
                current: index + 1,
                total,
            },
        );

        match thumbnails::render_thumbnail(item_path, file_type, &cache, &resource_dir) {
            Ok(output) => {
                {
                    let conn = state.0.lock().map_err(|e| e.to_string())?;
                    db::set_item_thumbnail(&conn, *item_id, output.page_count, Some(&output.thumbnail_key), ThumbnailStatus::Ready)?;
                }
                if let Some(stats) = output.embroidery_stats {
                    let conn = state.0.lock().map_err(|e| e.to_string())?;
                    db::set_item_embroidery_stats(
                        &conn,
                        *item_id,
                        stats.stitch_count,
                        stats.color_count,
                        stats.color_changes,
                        stats.width_mm,
                        stats.height_mm,
                    )?;
                }
                result.thumbnails_generated += 1;
            }
            Err(e) => {
                eprintln!("[thumbnail] Erro ao gerar miniatura para {}: {}", item_path, e);
                {
                    let conn = state.0.lock().map_err(|e| e.to_string())?;
                    db::set_item_thumbnail(&conn, *item_id, None, None, ThumbnailStatus::Error)?;
                }
            }
        }
    }

    // 6. Update collection timestamp (short lock).
    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::update_collection_timestamp(&conn, collection_id)?;
    }

    // 7. Cleanup orphan thumbnail cache files.
    if !cancels.is_cancelled(collection_id) {
        let known_keys = {
            let conn = state.0.lock().map_err(|e| e.to_string())?;
            db::list_all_thumbnail_keys(&conn)
        };
        match known_keys {
            Ok(known_keys) => {
                scanner::cleanup_orphan_cache(&cache, &known_keys);
            }
            Err(e) => {
                eprintln!("[cache] Aviso: não foi possível listar thumbnail keys: {}", e);
            }
        }
    }

    let _ = app.emit(
        "update-progress",
        db::ScanProgress {
            stage: "Concluído".to_string(),
            current: total,
            total,
        },
    );

    Ok(result)
}

#[tauri::command]
pub fn cancel_scan(cancels: State<'_, ScanCancels>, collection_id: Option<i64>) -> bool {
    if let Some(id) = collection_id {
        cancels.cancel(id)
    } else {
        // Fallback: cancel all active scans if no specific collection provided
        if let Ok(map) = cancels.0.lock() {
            for (_, b) in map.iter() {
                b.store(true, std::sync::atomic::Ordering::Relaxed);
            }
        }
        true
    }
}

struct ScanClearGuard<'a> {
    cancels: &'a ScanCancels,
    collection_id: i64,
}

impl<'a> ScanClearGuard<'a> {
    fn new(cancels: &'a ScanCancels, collection_id: i64) -> Self {
        Self { cancels, collection_id }
    }
}

impl<'a> Drop for ScanClearGuard<'a> {
    fn drop(&mut self) {
        self.cancels.clear(self.collection_id);
    }
}

// Open file

#[tauri::command]
pub fn open_file(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| format!("Falha ao abrir arquivo: {e}"))?;
    Ok(())
}

// Folder picker

#[tauri::command]
pub fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    use std::sync::mpsc::channel;

    let (tx, rx) = channel();

    let _ = app
        .dialog()
        .file()
        .set_title("Selecionar pasta")
        .pick_folder(move |path: Option<tauri_plugin_dialog::FilePath>| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(path.into_path().ok().map(|p| p.display().to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Falha ao obter pasta: {e}")),
    }
}

fn validate_collection_paths(paths: &[String]) -> Result<(), String> {
    for path in paths {
        if !Path::new(path).is_dir() {
            return Err(format!("A pasta não existe ou não está acessível: {path}"));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_cache_dir(app: AppHandle) -> Result<String, String> {
    Ok(db::cache_dir(&app)?.display().to_string())
}

// ── Duplicate analysis ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateItem {
    pub item_id: i64,
    pub path: String,
    pub filename: String,
    pub size: i64,
    pub modified_at: String,
    pub page_count: Option<i64>,
    pub file_type: String,
    pub thumbnail_key: Option<String>,
    pub thumbnail_status: String,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: i64,
    pub items: Vec<DuplicateItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateAnalysis {
    pub groups: Vec<DuplicateGroup>,
    pub unreadable_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveDuplicateResult {
    pub removed_from_disk: bool,
    pub file_missing: bool,
    pub hash_changed: bool,
    pub affected_other_collections: usize,
}

fn sha256_file(path: &str) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("Não foi possível abrir o arquivo: {e}"))?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|e| format!("Falha ao ler o arquivo: {e}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

#[tauri::command]
pub async fn analyze_duplicates(
    app: AppHandle,
    state: State<'_, DbState>,
    collection_id: i64,
) -> Result<DuplicateAnalysis, String> {
    // Acquire the lock only to read the items; hashing happens without it.
    let items = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::list_items(&conn, collection_id)?
    };

    let total = items.len();
    let mut groups: Vec<DuplicateGroup> = Vec::new();
    let mut unreadable_count = 0usize;

    for (index, item) in items.iter().enumerate() {
        let _ = app.emit(
            "analyze-progress",
            db::ScanProgress {
                stage: "Calculando hashes".to_string(),
                current: index + 1,
                total,
            },
        );

        let hash = match sha256_file(&item.path) {
            Ok(h) => h,
            Err(e) => {
                eprintln!("[duplicates] Erro ao calcular hash de {}: {}", item.path, e);
                unreadable_count += 1;
                continue;
            }
        };

        let dup_item = DuplicateItem {
            item_id: item.id,
            path: item.path.clone(),
            filename: item.filename.clone(),
            size: item.size,
            modified_at: item.modified_at.clone(),
            page_count: item.page_count,
            file_type: item.file_type.clone(),
            thumbnail_key: item.thumbnail_key.clone(),
            thumbnail_status: item.thumbnail_status.clone(),
            hash: hash.clone(),
        };

        if let Some(group) = groups.iter_mut().find(|g| g.hash == hash) {
            group.items.push(dup_item);
        } else {
            groups.push(DuplicateGroup {
                hash,
                size: item.size,
                items: vec![dup_item],
            });
        }
    }

    // Keep only groups with 2+ items
    groups.retain(|g| g.items.len() >= 2);

    // Sort items within each group: shortest path first, then alphabetical
    for group in &mut groups {
        group
            .items
            .sort_by(|a, b| a.path.len().cmp(&b.path.len()).then_with(|| a.path.cmp(&b.path)));
    }

    // Sort groups by size descending (largest duplicates first)
    groups.sort_by(|a, b| b.size.cmp(&a.size));

    let _ = app.emit(
        "analyze-progress",
        db::ScanProgress {
            stage: "Concluído".to_string(),
            current: total,
            total,
        },
    );

    Ok(DuplicateAnalysis {
        groups,
        unreadable_count,
    })
}

#[tauri::command]
pub fn remove_duplicate(
    state: State<'_, DbState>,
    collection_id: i64,
    item_id: i64,
    delete_from_disk: bool,
    expected_hash: Option<String>,
) -> Result<RemoveDuplicateResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let item = db::get_item_by_id(&conn, item_id)?
        .ok_or_else(|| "Item não encontrado".to_string())?;

    // Safety: ensure the item belongs to the given collection
    if item.collection_id != collection_id {
        return Err("O item não pertence a esta coleção".to_string());
    }

    if !delete_from_disk {
        db::delete_item(&conn, item.id)?;
        return Ok(RemoveDuplicateResult {
            removed_from_disk: false,
            file_missing: false,
            hash_changed: false,
            affected_other_collections: 0,
        });
    }

    // Delete from disk flow with revalidation
    let path = Path::new(&item.path);

    if !path.exists() {
        // File already gone: clean up records across all collections
        let affected = db::delete_item_by_path_all_collections(&conn, &item.path)?;
        return Ok(RemoveDuplicateResult {
            removed_from_disk: false,
            file_missing: true,
            hash_changed: false,
            affected_other_collections: affected.saturating_sub(1),
        });
    }

    // Revalidate content hash before deleting
    if let Some(expected) = expected_hash {
        let current_hash = sha256_file(&item.path)?;
        if current_hash != expected {
            return Err(
                "O arquivo foi alterado após a análise. Reexecute a análise de duplicados.".to_string(),
            );
        }
    }

    trash::delete(path)
        .map_err(|e| format!("Não foi possível enviar o arquivo para a Lixeira: {e}"))?;

    let affected = db::delete_item_by_path_all_collections(&conn, &item.path)?;

    Ok(RemoveDuplicateResult {
        removed_from_disk: true,
        file_missing: false,
        hash_changed: false,
        affected_other_collections: affected.saturating_sub(1),
    })
}

#[tauri::command]
pub fn toggle_favorite(state: State<'_, DbState>, item_id: i64) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::toggle_item_favorite(&conn, item_id)
}

#[tauri::command]
pub fn reveal_in_folder(app: AppHandle, path: String) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Falha ao abrir o Explorer: {e}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Falha ao abrir o Finder: {e}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        let dir = Path::new(&path)
            .parent()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| path.clone());
        Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("Falha ao abrir o gerenciador de arquivos: {e}"))?;
    }

    let _ = app;
    Ok(())
}

// Image file picker for collection icon

#[tauri::command]
pub fn pick_image_file(app: AppHandle) -> Result<Option<String>, String> {
    use std::sync::mpsc::channel;

    let (tx, rx) = channel();

    let _ = app
        .dialog()
        .file()
        .set_title("Selecionar imagem para o ícone")
        .add_filter("Imagens", &["png", "jpg", "jpeg", "gif", "webp", "bmp"])
        .pick_file(move |path: Option<tauri_plugin_dialog::FilePath>| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(path)) => {
            let picked = path.into_path().ok().map(|p| p.display().to_string());
            eprintln!("[pick_image_file] caminho selecionado: {:?}", picked);

            // Copy the picked image into the app cache and return that path:
            // the asset protocol scope may not cover the original location,
            // but always covers the cache directory.
            let cached = match picked {
                Some(ref p) => Some(db::stage_image_in_cache(&app, p)?),
                None => None,
            };
            Ok(cached)
        }
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Falha ao obter imagem: {e}")),
    }
}
