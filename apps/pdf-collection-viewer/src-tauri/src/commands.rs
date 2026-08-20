use crate::db::{self, DbState, ThumbnailStatus, UpdateResult};
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
    state: State<DbState>,
    name: String,
    icon: String,
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
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_collection(&conn, &name, &icon, &paths, include_subfolders)
}

#[tauri::command]
pub fn update_collection(
    state: State<DbState>,
    id: i64,
    name: String,
    icon: String,
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
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_collection(&conn, id, &name, &icon, &paths, include_subfolders)
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

// PDFs

#[tauri::command]
pub fn list_pdfs(state: State<DbState>, collection_id: i64) -> Result<Vec<db::Pdf>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_pdfs(&conn, collection_id)
}

// Scan / Update

#[tauri::command]
pub fn update_collection_scan(
    app: AppHandle,
    state: State<'_, DbState>,
    cancels: State<'_, ScanCancels>,
    collection_id: i64,
) -> Result<UpdateResult, String> {
    cancels.mark_active(collection_id);
    let _guard = ScanClearGuard::new(&cancels, collection_id);

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let collection = db::get_collection(&conn, collection_id)?
        .ok_or_else(|| "Coleção não encontrada".to_string())?;

    let cache = db::cache_dir(&app)?;
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Não foi possível localizar os recursos do aplicativo: {e}"))?;

    let mut result = UpdateResult {
        found: 0,
        added: 0,
        removed: 0,
        updated: 0,
        thumbnails_generated: 0,
        unavailable_paths: Vec::new(),
    };

    // 1. Scan all configured paths
    let mut all_pdfs: Vec<scanner::ScannedPdf> = Vec::new();
    let mut keep_paths: Vec<String> = Vec::new();

    for path in &collection.paths {
        if cancels.is_cancelled(collection_id) {
            break;
        }

        let (pdfs, unavailable) = scanner::scan_directory(path, collection.include_subfolders);
        if unavailable {
            result.unavailable_paths.push(path.clone());
            continue;
        }

        for pdf in pdfs {
            keep_paths.push(pdf.path.clone());
            all_pdfs.push(pdf);
        }
    }

    result.found = all_pdfs.len();
    let _ = app.emit(
        "update-progress",
        db::ScanProgress {
            stage: "PDFs encontrados".to_string(),
            current: result.found,
            total: result.found,
        },
    );

    // 2. Compare with DB and process changes
    let mut thumbnails_to_generate: Vec<(i64, String)> = Vec::new(); // (pdf_id, path)

    for pdf in &all_pdfs {
        if cancels.is_cancelled(collection_id) {
            break;
        }

        let existing = db::get_pdf_by_path(&conn, collection_id, &pdf.path)?;

        match existing {
            Some(existing_pdf) => {
                // Check if metadata changed
                if existing_pdf.size != pdf.size || existing_pdf.modified_at != pdf.modified_at {
                    db::update_pdf_metadata(&conn, existing_pdf.id, pdf.size, &pdf.modified_at)?;
                    result.updated += 1;
                    thumbnails_to_generate.push((existing_pdf.id, pdf.path.clone()));
                } else if !ThumbnailStatus::from_str(&existing_pdf.thumbnail_status).is_ready() {
                    // Metadata unchanged but thumbnail missing/errored -> try again
                    thumbnails_to_generate.push((existing_pdf.id, pdf.path.clone()));
                }
            }
            None => {
                let id = db::insert_pdf(&conn, collection_id, &pdf.path, &pdf.filename, pdf.size, &pdf.modified_at)?;
                result.added += 1;
                thumbnails_to_generate.push((id, pdf.path.clone()));
            }
        }
    }

    // 3. Remove PDFs that no longer exist
    if !cancels.is_cancelled(collection_id) {
        result.removed = db::delete_pdfs_not_in(
            &conn,
            collection_id,
            &keep_paths,
            &result.unavailable_paths,
        )?;
    }

    // 4. Generate thumbnails for new/changed PDFs
    let total = thumbnails_to_generate.len();
    for (index, (pdf_id, pdf_path)) in thumbnails_to_generate.iter().enumerate() {
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

        let key = thumbnails::thumbnail_key(pdf_path);

        match thumbnails::generate_thumbnail(pdf_path, &cache, &resource_dir) {
            Ok((page_count, _)) => {
                db::set_pdf_thumbnail(&conn, *pdf_id, page_count, Some(&key), ThumbnailStatus::Ready)?;
                result.thumbnails_generated += 1;
            }
            Err(e) => {
                eprintln!("[thumbnail] Erro ao gerar miniatura para {}: {}", pdf_path, e);
                db::set_pdf_thumbnail(&conn, *pdf_id, None, None, ThumbnailStatus::Error)?;
            }
        }
    }

    // 5. Update collection timestamp
    db::update_collection_timestamp(&conn, collection_id)?;

    // 6. Cleanup orphan thumbnail cache files
    if !cancels.is_cancelled(collection_id) {
        match db::list_all_thumbnail_keys(&conn) {
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
        if let Ok(mut map) = cancels.0.lock() {
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

// Open PDF

#[tauri::command]
pub fn open_pdf(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;

    app.shell().open(&path, None)
        .map_err(|e| format!("Falha ao abrir PDF: {e}"))?;
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
    pub pdf_id: i64,
    pub path: String,
    pub filename: String,
    pub size: i64,
    pub modified_at: String,
    pub page_count: Option<i64>,
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
pub fn analyze_duplicates(
    app: AppHandle,
    state: State<'_, DbState>,
    collection_id: i64,
) -> Result<DuplicateAnalysis, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let pdfs = db::list_pdfs(&conn, collection_id)?;

    let total = pdfs.len();
    let mut groups: Vec<DuplicateGroup> = Vec::new();
    let mut unreadable_count = 0usize;

    for (index, pdf) in pdfs.iter().enumerate() {
        let _ = app.emit(
            "analyze-progress",
            db::ScanProgress {
                stage: "Calculando hashes".to_string(),
                current: index + 1,
                total,
            },
        );

        let hash = match sha256_file(&pdf.path) {
            Ok(h) => h,
            Err(e) => {
                eprintln!("[duplicates] Erro ao calcular hash de {}: {}", pdf.path, e);
                unreadable_count += 1;
                continue;
            }
        };

        let item = DuplicateItem {
            pdf_id: pdf.id,
            path: pdf.path.clone(),
            filename: pdf.filename.clone(),
            size: pdf.size,
            modified_at: pdf.modified_at.clone(),
            page_count: pdf.page_count,
            thumbnail_key: pdf.thumbnail_key.clone(),
            thumbnail_status: pdf.thumbnail_status.clone(),
            hash: hash.clone(),
        };

        if let Some(group) = groups.iter_mut().find(|g| g.hash == hash) {
            group.items.push(item);
        } else {
            groups.push(DuplicateGroup {
                hash,
                size: pdf.size,
                items: vec![item],
            });
        }
    }

    // Keep only groups with 2+ items
    groups.retain(|g| g.items.len() >= 2);

    // Sort items within each group: shortest path first, then alphabetical
    for group in &mut groups {
        group.items.sort_by(|a, b| {
            a.path
                .len()
                .cmp(&b.path.len())
                .then_with(|| a.path.cmp(&b.path))
        });
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
    pdf_id: i64,
    delete_from_disk: bool,
    expected_hash: Option<String>,
) -> Result<RemoveDuplicateResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let pdf = db::get_pdf_by_id(&conn, pdf_id)?
        .ok_or_else(|| "PDF não encontrado".to_string())?;

    // Safety: ensure the pdf belongs to the given collection
    if pdf.collection_id != collection_id {
        return Err("O PDF não pertence a esta coleção".to_string());
    }

    if !delete_from_disk {
        db::delete_pdf(&conn, pdf.id)?;
        return Ok(RemoveDuplicateResult {
            removed_from_disk: false,
            file_missing: false,
            hash_changed: false,
            affected_other_collections: 0,
        });
    }

    // Delete from disk flow with revalidation
    let path = Path::new(&pdf.path);

    if !path.exists() {
        // File already gone: clean up records across all collections
        let affected = db::delete_pdf_by_path_all_collections(&conn, &pdf.path)?;
        return Ok(RemoveDuplicateResult {
            removed_from_disk: false,
            file_missing: true,
            hash_changed: false,
            affected_other_collections: affected.saturating_sub(1),
        });
    }

    // Revalidate content hash before deleting
    if let Some(expected) = expected_hash {
        let current_hash = sha256_file(&pdf.path)?;
        if current_hash != expected {
            return Err(
                "O arquivo foi alterado após a análise. Reexecute a análise de duplicados.".to_string(),
            );
        }
    }

    trash::delete(path)
        .map_err(|e| format!("Não foi possível enviar o arquivo para a Lixeira: {e}"))?;

    let affected = db::delete_pdf_by_path_all_collections(&conn, &pdf.path)?;

    Ok(RemoveDuplicateResult {
        removed_from_disk: true,
        file_missing: false,
        hash_changed: false,
        affected_other_collections: affected.saturating_sub(1),
    })
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
