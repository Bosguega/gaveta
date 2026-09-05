use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fmt;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct DbState(pub Mutex<Connection>);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThumbnailStatus {
    Pending,
    Ready,
    Error,
}

impl ThumbnailStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ThumbnailStatus::Pending => "pending",
            ThumbnailStatus::Ready => "ready",
            ThumbnailStatus::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "ready" => ThumbnailStatus::Ready,
            "error" => ThumbnailStatus::Error,
            _ => ThumbnailStatus::Pending,
        }
    }

    pub fn is_ready(&self) -> bool {
        matches!(self, ThumbnailStatus::Ready)
    }
}

impl fmt::Display for ThumbnailStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl rusqlite::ToSql for ThumbnailStatus {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        Ok(self.as_str().into())
    }
}

impl rusqlite::types::FromSql for ThumbnailStatus {
    fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
        let s = value.as_str()?;
        Ok(ThumbnailStatus::from_str(s))
    }
}

/// High-level metadata about a collection (summary, not detail).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: i64,
    pub name: String,
    pub icon: String,
    pub icon_path: Option<String>,
    pub include_subfolders: bool,
    pub is_pinned: bool,
    pub item_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Full detail of a collection including its configured paths.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionDetail {
    pub id: i64,
    pub name: String,
    pub icon: String,
    pub icon_path: Option<String>,
    pub include_subfolders: bool,
    pub is_pinned: bool,
    pub paths: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchResultItem {
    pub id: i64,
    pub collection_id: i64,
    pub collection_name: String,
    pub path: String,
    pub filename: String,
    pub size: i64,
    pub modified_at: String,
    pub page_count: Option<i64>,
    pub file_type: String,
    pub thumbnail_key: Option<String>,
    pub thumbnail_status: String,
    pub is_favorite: bool,
}


/// A single file belonging to a collection.
///
/// Formerly named `Pdf`, this struct is collection-agnostic. The `file_type`
/// field identifies the content kind (pdf, embroidery, image, …) so the
/// frontend and thumbnail dispatch can branch appropriately.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionItem {
    pub id: i64,
    pub collection_id: i64,
    pub path: String,
    pub filename: String,
    pub size: i64,
    pub modified_at: String,
    pub page_count: Option<i64>,
    pub file_type: String,
    pub thumbnail_key: Option<String>,
    pub thumbnail_status: String,
    pub is_favorite: bool,
    /// Embroidery metadata (only for file_type = "embroidery").
    pub stitch_count: Option<i64>,
    pub color_count: Option<i64>,
    pub color_changes: Option<i64>,
    pub design_width_mm: Option<f64>,
    pub design_height_mm: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub stage: String,
    pub current: usize,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateResult {
    pub found: usize,
    pub added: usize,
    pub removed: usize,
    pub updated: usize,
    pub thumbnails_generated: usize,
    pub unavailable_paths: Vec<String>,
    pub errored_paths: Vec<String>,
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Não foi possível localizar app_data_dir: {e}"))?;

    fs::create_dir_all(&dir)
        .map_err(|e| format!("Não foi possível criar diretório de dados: {e}"))?;

    Ok(dir.join("pdf_collection_viewer.sqlite"))
}

pub fn cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Não foi possível localizar app_data_dir: {e}"))?;

    let cache = dir.join("cache");
    fs::create_dir_all(&cache)
        .map_err(|e| format!("Não foi possível criar diretório de cache: {e}"))?;

    Ok(cache)
}

pub fn open_and_migrate(app: &tauri::AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let conn = Connection::open(path)
        .map_err(|e| format!("Não foi possível abrir o SQLite: {e}"))?;

    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT NOT NULL DEFAULT '📚',
            icon_path TEXT,
            include_subfolders INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS collection_paths (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            path TEXT NOT NULL,
            UNIQUE(collection_id, path)
        );

        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            path TEXT NOT NULL,
            filename TEXT NOT NULL,
            size INTEGER NOT NULL,
            modified_at TEXT NOT NULL,
            page_count INTEGER,
            file_type TEXT NOT NULL DEFAULT 'pdf',
            thumbnail_key TEXT,
            thumbnail_status TEXT NOT NULL DEFAULT 'pending',
            is_favorite INTEGER NOT NULL DEFAULT 0,
            UNIQUE(collection_id, path)
        );

        CREATE INDEX IF NOT EXISTS idx_files_collection ON files(collection_id);
        CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
        ",
    )
    .map_err(|e| format!("Não foi possível inicializar o banco: {e}"))?;

    // ── Migrations for legacy databases ──

    // Migration 1: rename legacy `pdfs` table → `files` and legacy indexes
    let has_pdfs_table: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='pdfs'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Falha ao verificar tabela pdfs: {e}"))?;

    if has_pdfs_table {
        let has_files_table: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='files'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Falha ao verificar tabela files: {e}"))?;

        let should_rename_pdfs = if has_files_table {
            // Legacy upgrade: CREATE TABLE files may have created an empty sibling
            // table while data still lives in pdfs.
            let files_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
                .map_err(|e| format!("Falha ao contar registros em files: {e}"))?;
            let pdfs_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM pdfs", [], |row| row.get(0))
                .map_err(|e| format!("Falha ao contar registros em pdfs: {e}"))?;

            if files_count == 0 && pdfs_count > 0 {
                conn.execute("DROP INDEX IF EXISTS idx_files_collection", [])
                    .map_err(|e| format!("Falha ao dropar idx_files_collection: {e}"))?;
                conn.execute("DROP INDEX IF EXISTS idx_files_path", [])
                    .map_err(|e| format!("Falha ao dropar idx_files_path: {e}"))?;
                conn.execute("DROP TABLE files", [])
                    .map_err(|e| format!("Falha ao dropar tabela files vazia: {e}"))?;
                true
            } else {
                false
            }
        } else {
            true
        };

        if should_rename_pdfs {
            conn.execute("DROP INDEX IF EXISTS idx_pdfs_collection", [])
                .map_err(|e| format!("Falha ao dropar idx_pdfs_collection: {e}"))?;
            conn.execute("DROP INDEX IF EXISTS idx_pdfs_path", [])
                .map_err(|e| format!("Falha ao dropar idx_pdfs_path: {e}"))?;

            conn.execute("ALTER TABLE pdfs RENAME TO files", [])
                .map_err(|e| format!("Falha ao renomear pdfs → files: {e}"))?;

            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_files_collection ON files(collection_id)",
                [],
            )
            .map_err(|e| format!("Falha ao recriar idx_files_collection: {e}"))?;
            conn.execute("CREATE INDEX IF NOT EXISTS idx_files_path ON files(path)", [])
                .map_err(|e| format!("Falha ao recriar idx_files_path: {e}"))?;
        }
    }

    // Migration 2: add file_type column if missing
    let has_file_type: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('files') WHERE name = 'file_type'")
        .map_err(|e| format!("Falha ao verificar coluna file_type: {e}"))?
        .query_row([], |row| {
            let count: i64 = row.get(0)?;
            Ok(count > 0)
        })
        .map_err(|e| format!("Falha ao verificar coluna file_type: {e}"))?;

    if !has_file_type {
        conn.execute(
            "ALTER TABLE files ADD COLUMN file_type TEXT NOT NULL DEFAULT 'pdf'",
            [],
        )
        .map_err(|e| format!("Falha ao adicionar coluna file_type: {e}"))?;
    }

    // Migration 3: add is_favorite column if missing (older databases)
    let has_favorite: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('files') WHERE name = 'is_favorite'")
        .map_err(|e| format!("Falha ao verificar coluna is_favorite: {e}"))?
        .query_row([], |row| {
            let count: i64 = row.get(0)?;
            Ok(count > 0)
        })
        .map_err(|e| format!("Falha ao verificar coluna is_favorite: {e}"))?;

    if !has_favorite {
        conn.execute(
            "ALTER TABLE files ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|e| format!("Falha ao adicionar coluna is_favorite: {e}"))?;
    }

    // Migration 4: add icon_path column to collections if missing
    let has_icon_path: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('collections') WHERE name = 'icon_path'")
        .map_err(|e| format!("Falha ao verificar coluna icon_path: {e}"))?
        .query_row([], |row| {
            let count: i64 = row.get(0)?;
            Ok(count > 0)
        })
        .map_err(|e| format!("Falha ao verificar coluna icon_path: {e}"))?;

    if !has_icon_path {
        conn.execute(
            "ALTER TABLE collections ADD COLUMN icon_path TEXT",
            [],
        )
        .map_err(|e| format!("Falha ao adicionar coluna icon_path: {e}"))?;
    }

    // Migration 5: embroidery metadata columns (only populated for
    // file_type = "embroidery" items once their thumbnail is generated).
    const EMBROIDERY_COLUMNS: [(&str, &str); 5] = [
        ("stitch_count", "INTEGER"),
        ("color_count", "INTEGER"),
        ("color_changes", "INTEGER"),
        ("design_width_mm", "REAL"),
        ("design_height_mm", "REAL"),
    ];

    for (column, decl) in EMBROIDERY_COLUMNS {
        let has_column: bool = conn
            .prepare(&format!(
                "SELECT COUNT(*) FROM pragma_table_info('files') WHERE name = '{column}'"
            ))
            .map_err(|e| format!("Falha ao verificar coluna {column}: {e}"))?
            .query_row([], |row| {
                let count: i64 = row.get(0)?;
                Ok(count > 0)
            })
            .map_err(|e| format!("Falha ao verificar coluna {column}: {e}"))?;

        if !has_column {
            conn.execute(
                &format!("ALTER TABLE files ADD COLUMN {column} {decl}"),
                [],
            )
            .map_err(|e| format!("Falha ao adicionar coluna {column}: {e}"))?;
        }
    }

    // Migration 6: add is_pinned column to collections if missing
    let has_is_pinned: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('collections') WHERE name = 'is_pinned'")
        .map_err(|e| format!("Falha ao verificar coluna is_pinned: {e}"))?
        .query_row([], |row| {
            let count: i64 = row.get(0)?;
            Ok(count > 0)
        })
        .map_err(|e| format!("Falha ao verificar coluna is_pinned: {e}"))?;

    if !has_is_pinned {
        conn.execute(
            "ALTER TABLE collections ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|e| format!("Falha ao adicionar coluna is_pinned: {e}"))?;
    }

    Ok(conn)
}


// ── Collections ──

/// Copies an image into the app cache under a content-hash based name and
/// returns the cached path, so the webview can load it regardless of where
/// the original file lives (asset protocol scope always covers the cache).
pub fn stage_image_in_cache(app: &tauri::AppHandle, src_path: &str) -> Result<String, String> {
    let cache = cache_dir(app)?;

    let ext = std::path::Path::new(src_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp") {
        return Err("Formato de imagem não suportado".to_string());
    }

    // Hash of the file contents so re-picking the same image reuses the copy.
    let bytes = fs::read(src_path)
        .map_err(|e| format!("Não foi possível ler a imagem: {e}"))?;
    let key = format!("cover_src_{}.{ext}", sha256_hex(&format!("{}:{}", bytes.len(), src_path)));
    let dest = cache.join(key);

    fs::write(&dest, &bytes)
        .map_err(|e| format!("Não foi possível copiar a imagem: {e}"))?;

    Ok(dest.display().to_string().replace('\\', "/"))
}

/// Generates a collection cover from a source image: crops the given rect
/// (in original-image pixels), resizes to 800x450 and saves as WebP in the
/// app cache directory. Returns the cached file path.
pub fn save_cover_to_cache(
    app: &tauri::AppHandle,
    src_path: &str,
    crop_x: f64,
    crop_y: f64,
    crop_w: f64,
    crop_h: f64,
) -> Result<String, String> {
    const COVER_W: u32 = 800;
    const COVER_H: u32 = 450;

    let cache = cache_dir(app)?;
    let img = image::open(src_path)
        .map_err(|e| format!("Não foi possível abrir a imagem: {e}"))?;

    let (nat_w, nat_h) = (img.width() as i64, img.height() as i64);
    // Clamp the crop rect to the image bounds, minimum 1px.
    let x = crop_x.round().clamp(0.0, (nat_w - 1) as f64) as u32;
    let y = crop_y.round().clamp(0.0, (nat_h - 1) as f64) as u32;
    let w = (crop_w.round().max(1.0) as u32).min(nat_w as u32 - x);
    let h = (crop_h.round().max(1.0) as u32).min(nat_h as u32 - y);

    let cropped = image::imageops::crop_imm(&img, x, y, w, h).to_image();
    let resized = image::imageops::resize(
        &cropped,
        COVER_W,
        COVER_H,
        image::imageops::FilterType::Lanczos3,
    );

    let key = format!("collection_cover_{}.webp", sha256_hex(src_path));
    let dest = cache.join(&key);
    resized
        .save_with_format(&dest, image::ImageFormat::WebP)
        .map_err(|e| format!("Não foi possível salvar a capa: {e}"))?;

    Ok(dest.display().to_string().replace('\\', "/"))
}

/// Copies an image file into the app cache directory under a sha256-based key
/// and returns the cache path. Returns None if the extension is not a supported image type.
pub fn copy_icon_to_cache(app: &tauri::AppHandle, src_path: &str) -> Result<Option<String>, String> {
    let cache = cache_dir(app)?;

    let ext = std::path::Path::new(src_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    let is_supported_image = matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp"
    );

    if !is_supported_image {
        return Ok(None);
    }

    let key = format!("collection_icon_{}.{}", sha256_hex(src_path), ext);
    let dest = cache.join(&key);

    fs::copy(src_path, &dest)
        .map_err(|e| format!("Não foi possível copiar a imagem do ícone: {e}"))?;

    let normalized = dest.display().to_string().replace('\\', "/");
    Ok(Some(normalized))
}

fn sha256_hex(input: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn list_collections(conn: &Connection) -> Result<Vec<Collection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, c.icon, c.icon_path, c.include_subfolders, c.created_at, c.updated_at, c.is_pinned,
                    (SELECT COUNT(*) FROM files f WHERE f.collection_id = c.id) as item_count
             FROM collections c
             ORDER BY c.is_pinned DESC, c.name COLLATE NOCASE",
        )
        .map_err(|e| format!("Falha ao preparar listagem: {e}"))?;

    let collections = stmt
        .query_map([], |row| {
            let include: i64 = row.get(4)?;
            let pinned: i64 = row.get(7)?;
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                icon_path: row.get(3)?,
                include_subfolders: include != 0,
                is_pinned: pinned != 0,
                item_count: row.get(8)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Falha ao listar coleções: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Falha ao ler coleções: {e}"))?;

    Ok(collections)
}

pub fn get_collection(conn: &Connection, id: i64) -> Result<Option<CollectionDetail>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, icon, icon_path, include_subfolders, created_at, updated_at, is_pinned
             FROM collections WHERE id = ?1",
        )
        .map_err(|e| format!("Falha ao preparar consulta: {e}"))?;

    let result = stmt
        .query_row(params![id], |row| {
            let include: i64 = row.get(4)?;
            let pinned: i64 = row.get(7)?;
            Ok(CollectionDetail {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                icon_path: row.get(3)?,
                include_subfolders: include != 0,
                is_pinned: pinned != 0,
                paths: Vec::new(),
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .optional()
        .map_err(|e| format!("Falha ao consultar coleção: {e}"))?;

    let Some(mut collection) = result else {
        return Ok(None);
    };

    let mut path_stmt = conn
        .prepare("SELECT path FROM collection_paths WHERE collection_id = ?1 ORDER BY id")
        .map_err(|e| format!("Falha ao preparar paths: {e}"))?;

    let paths = path_stmt
        .query_map(params![id], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Falha ao listar paths: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Falha ao ler paths: {e}"))?;

    collection.paths = paths;
    Ok(Some(collection))
}

pub fn create_collection(
    conn: &Connection,
    name: &str,
    icon: &str,
    icon_path: Option<&str>,
    paths: &[String],
    include_subfolders: bool,
) -> Result<Collection, String> {
    let now = Utc::now().to_rfc3339();
    let include = if include_subfolders { 1 } else { 0 };

    conn.execute(
        "INSERT INTO collections (name, icon, icon_path, include_subfolders, is_pinned, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)",
        params![name, icon, icon_path, include, now, now],
    )
    .map_err(|e| format!("Falha ao criar coleção: {e}"))?;

    let id = conn.last_insert_rowid();

    for path in paths {
        conn.execute(
            "INSERT INTO collection_paths (collection_id, path) VALUES (?1, ?2)",
            params![id, path],
        )
        .map_err(|e| format!("Falha ao salvar path: {e}"))?;
    }

    Ok(Collection {
        id,
        name: name.to_string(),
        icon: icon.to_string(),
        icon_path: icon_path.map(|s| s.to_string()),
        include_subfolders,
        is_pinned: false,
        item_count: 0,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn toggle_collection_pin(conn: &Connection, id: i64) -> Result<bool, String> {
    let current: i64 = conn
        .query_row(
            "SELECT is_pinned FROM collections WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Falha ao consultar estado de fixação da coleção: {e}"))?;

    let new_value = if current != 0 { 0 } else { 1 };
    conn.execute(
        "UPDATE collections SET is_pinned = ?1 WHERE id = ?2",
        params![new_value, id],
    )
    .map_err(|e| format!("Falha ao atualizar fixação da coleção: {e}"))?;

    Ok(new_value != 0)
}

pub fn search_all_items(
    conn: &Connection,
    query: &str,
    limit: usize,
    collection_ids: Option<&[i64]>,
) -> Result<Vec<GlobalSearchResultItem>, String> {
    let pattern = format!("%{query}%");
    let mut sql = String::from(
        "SELECT f.id, f.collection_id, c.name, f.path, f.filename, f.size, f.modified_at, f.page_count, f.file_type, f.thumbnail_key, f.thumbnail_status, f.is_favorite
         FROM files f
         JOIN collections c ON c.id = f.collection_id
         WHERE 1=1",
    );
    let mut bind_values: Vec<rusqlite::types::Value> = vec![pattern.into()];

    if let Some(ids) = collection_ids {
        if !ids.is_empty() {
            let placeholders: Vec<String> = ids
                .iter()
                .enumerate()
                .map(|(index, id)| {
                    bind_values.push(rusqlite::types::Value::from(*id));
                    format!("?{}", index + 2)
                })
                .collect();
            sql.push_str(&format!(
                " AND f.collection_id IN ({})",
                placeholders.join(", ")
            ));
        }
    }

    let limit_index = bind_values.len() + 1;
    bind_values.push(rusqlite::types::Value::from(limit as i64));
    sql.push_str(&format!(
        " ORDER BY f.filename COLLATE NOCASE LIMIT ?{limit_index}"
    ));

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Falha ao preparar busca global: {e}"))?;

    let rows = stmt
        .query_map(rusqlite::params_from_iter(bind_values.iter()), |row| {
            let status: ThumbnailStatus = row.get(10)?;
            let favorite: i64 = row.get(11)?;
            Ok(GlobalSearchResultItem {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                collection_name: row.get(2)?,
                path: row.get(3)?,
                filename: row.get(4)?,
                size: row.get(5)?,
                modified_at: row.get(6)?,
                page_count: row.get(7)?,
                file_type: row.get(8)?,
                thumbnail_key: row.get(9)?,
                thumbnail_status: status.to_string(),
                is_favorite: favorite != 0,
            })
        })
        .map_err(|e| format!("Falha ao executar busca global: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Falha ao ler resultados da busca: {e}"))?;

    Ok(rows)
}

pub fn update_collection(

    conn: &Connection,
    id: i64,
    name: &str,
    icon: &str,
    icon_path: Option<&str>,
    paths: &[String],
    include_subfolders: bool,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let include = if include_subfolders { 1 } else { 0 };

    conn.execute(
        "UPDATE collections SET name = ?1, icon = ?2, icon_path = ?3, include_subfolders = ?4, updated_at = ?5 WHERE id = ?6",
        params![name, icon, icon_path, include, now, id],
    )
    .map_err(|e| format!("Falha ao atualizar coleção: {e}"))?;

    // Replace paths
    conn.execute(
        "DELETE FROM collection_paths WHERE collection_id = ?1",
        params![id],
    )
    .map_err(|e| format!("Falha ao limpar paths: {e}"))?;

    for path in paths {
        conn.execute(
            "INSERT INTO collection_paths (collection_id, path) VALUES (?1, ?2)",
            params![id, path],
        )
        .map_err(|e| format!("Falha ao salvar path: {e}"))?;
    }

    Ok(())
}

pub fn delete_collection(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM collections WHERE id = ?1", params![id])
        .map_err(|e| format!("Falha ao excluir coleção: {e}"))?;
    Ok(())
}

// ── Files (items) ──

pub fn list_items(conn: &Connection, collection_id: i64) -> Result<Vec<CollectionItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, path, filename, size, modified_at, page_count, file_type, thumbnail_key, thumbnail_status, is_favorite, stitch_count, color_count, color_changes, design_width_mm, design_height_mm
             FROM files WHERE collection_id = ?1
             ORDER BY filename COLLATE NOCASE",
        )
        .map_err(|e| format!("Falha ao preparar listagem de itens: {e}"))?;

    let items = stmt
        .query_map(params![collection_id], |row| {
            let status: ThumbnailStatus = row.get(9)?;
            let favorite: i64 = row.get(10)?;
            Ok(CollectionItem {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                path: row.get(2)?,
                filename: row.get(3)?,
                size: row.get(4)?,
                modified_at: row.get(5)?,
                page_count: row.get(6)?,
                file_type: row.get(7)?,
                thumbnail_key: row.get(8)?,
                thumbnail_status: status.to_string(),
                is_favorite: favorite != 0,
                stitch_count: row.get(11)?,
                color_count: row.get(12)?,
                color_changes: row.get(13)?,
                design_width_mm: row.get(14)?,
                design_height_mm: row.get(15)?,
            })
        })
        .map_err(|e| format!("Falha ao listar itens: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Falha ao ler itens: {e}"))?;

    Ok(items)
}

pub fn get_item_by_path(
    conn: &Connection,
    collection_id: i64,
    path: &str,
) -> Result<Option<CollectionItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, path, filename, size, modified_at, page_count, file_type, thumbnail_key, thumbnail_status, is_favorite, stitch_count, color_count, color_changes, design_width_mm, design_height_mm
             FROM files WHERE collection_id = ?1 AND path = ?2",
        )
        .map_err(|e| format!("Falha ao preparar consulta de item: {e}"))?;

    let result = stmt
        .query_row(params![collection_id, path], |row| {
            let status: ThumbnailStatus = row.get(9)?;
            let favorite: i64 = row.get(10)?;
            Ok(CollectionItem {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                path: row.get(2)?,
                filename: row.get(3)?,
                size: row.get(4)?,
                modified_at: row.get(5)?,
                page_count: row.get(6)?,
                file_type: row.get(7)?,
                thumbnail_key: row.get(8)?,
                thumbnail_status: status.to_string(),
                is_favorite: favorite != 0,
                stitch_count: row.get(11)?,
                color_count: row.get(12)?,
                color_changes: row.get(13)?,
                design_width_mm: row.get(14)?,
                design_height_mm: row.get(15)?,
            })
        })
        .optional()
        .map_err(|e| format!("Falha ao consultar item: {e}"))?;

    Ok(result)
}

pub fn insert_item(
    conn: &Connection,
    collection_id: i64,
    path: &str,
    filename: &str,
    size: i64,
    modified_at: &str,
    file_type: &str,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO files (collection_id, path, filename, size, modified_at, file_type, thumbnail_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![collection_id, path, filename, size, modified_at, file_type, ThumbnailStatus::Pending],
    )
    .map_err(|e| format!("Falha ao inserir item: {e}"))?;

    Ok(conn.last_insert_rowid())
}

pub fn update_item_metadata(
    conn: &Connection,
    id: i64,
    size: i64,
    modified_at: &str,
) -> Result<(), String> {
    conn.execute(
        "UPDATE files SET size = ?1, modified_at = ?2, thumbnail_status = ?3 WHERE id = ?4",
        params![size, modified_at, ThumbnailStatus::Pending, id],
    )
    .map_err(|e| format!("Falha ao atualizar item: {e}"))?;
    Ok(())
}

pub fn set_item_thumbnail(
    conn: &Connection,
    id: i64,
    page_count: Option<i64>,
    thumbnail_key: Option<&str>,
    status: ThumbnailStatus,
) -> Result<(), String> {
    conn.execute(
        "UPDATE files SET page_count = ?1, thumbnail_key = ?2, thumbnail_status = ?3 WHERE id = ?4",
        params![page_count, thumbnail_key, status, id],
    )
    .map_err(|e| format!("Falha ao atualizar thumbnail do item: {e}"))?;
    Ok(())
}

/// Persists embroidery metadata (stitch/color counts and design size) for an
/// item. Called right after its thumbnail is generated.
pub fn set_item_embroidery_stats(
    conn: &Connection,
    id: i64,
    stitch_count: i64,
    color_count: i64,
    color_changes: i64,
    width_mm: f64,
    height_mm: f64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE files SET stitch_count = ?1, color_count = ?2, color_changes = ?3, design_width_mm = ?4, design_height_mm = ?5 WHERE id = ?6",
        params![stitch_count, color_count, color_changes, width_mm, height_mm, id],
    )
    .map_err(|e| format!("Falha ao salvar metadados do bordado: {e}"))?;
    Ok(())
}

pub fn delete_item(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM files WHERE id = ?1", params![id])
        .map_err(|e| format!("Falha ao excluir item: {e}"))?;
    Ok(())
}

pub fn delete_items_not_in(
    conn: &Connection,
    collection_id: i64,
    keep_paths: &[String],
    unavailable_paths: &[String],
) -> Result<usize, String> {
    let mut removed = 0;
    let existing = list_items(conn, collection_id)?;

    // Hash set turns the per-item membership check from O(keep_paths) into
    // O(1) on average, removing the former O(existing × keep_paths) bottleneck.
    let keep_set: HashSet<&str> = keep_paths.iter().map(|p| p.as_str()).collect();

    for item in existing {
        let belongs_to_unavailable_path = unavailable_paths.iter().any(|root| {
            std::path::Path::new(&item.path).starts_with(std::path::Path::new(root))
        });
        if !keep_set.contains(item.path.as_str()) && !belongs_to_unavailable_path {
            delete_item(conn, item.id)?;
            removed += 1;
        }
    }

    Ok(removed)
}

pub fn update_collection_timestamp(conn: &Connection, collection_id: i64) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE collections SET updated_at = ?1 WHERE id = ?2",
        params![now, collection_id],
    )
    .map_err(|e| format!("Falha ao atualizar timestamp da coleção: {e}"))?;
    Ok(())
}

pub fn list_all_thumbnail_keys(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT thumbnail_key FROM files WHERE thumbnail_key IS NOT NULL")
        .map_err(|e| format!("Falha ao preparar consulta de thumbnail keys: {e}"))?;

    let keys = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Falha ao listar thumbnail keys: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Falha ao ler thumbnail keys: {e}"))?;

    Ok(keys)
}


/// Lists items across the given collections. When `collection_ids` is `None`
/// (or empty) every collection is considered; `favorites_only` restricts the
/// result to favorite items.
pub fn list_items_filtered(
    conn: &Connection,
    collection_ids: Option<&[i64]>,
    favorites_only: bool,
) -> Result<Vec<CollectionItem>, String> {
    let mut sql = String::from(
        "SELECT id, collection_id, path, filename, size, modified_at, page_count, file_type, thumbnail_key, thumbnail_status, is_favorite, stitch_count, color_count, color_changes, design_width_mm, design_height_mm
         FROM files WHERE 1=1",
    );
    let mut bind_values: Vec<rusqlite::types::Value> = Vec::new();

    if let Some(ids) = collection_ids {
        if !ids.is_empty() {
            let placeholders: Vec<String> = ids
                .iter()
                .enumerate()
                .map(|(index, id)| {
                    bind_values.push(rusqlite::types::Value::from(*id));
                    format!("?{}", index + 1)
                })
                .collect();
            sql.push_str(&format!(
                " AND collection_id IN ({})",
                placeholders.join(", ")
            ));
        }
    }

    if favorites_only {
        sql.push_str(" AND is_favorite = 1");
    }

    sql.push_str(" ORDER BY filename COLLATE NOCASE");

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Falha ao preparar listagem de itens: {e}"))?;

    let items = stmt
        .query_map(rusqlite::params_from_iter(bind_values.iter()), |row| {
            let status: ThumbnailStatus = row.get(9)?;
            let favorite: i64 = row.get(10)?;
            Ok(CollectionItem {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                path: row.get(2)?,
                filename: row.get(3)?,
                size: row.get(4)?,
                modified_at: row.get(5)?,
                page_count: row.get(6)?,
                file_type: row.get(7)?,
                thumbnail_key: row.get(8)?,
                thumbnail_status: status.to_string(),
                is_favorite: favorite != 0,
                stitch_count: row.get(11)?,
                color_count: row.get(12)?,
                color_changes: row.get(13)?,
                design_width_mm: row.get(14)?,
                design_height_mm: row.get(15)?,
            })
        })
        .map_err(|e| format!("Falha ao listar itens: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Falha ao ler itens: {e}"))?;

    Ok(items)
}

pub fn get_item_by_id(conn: &Connection, id: i64) -> Result<Option<CollectionItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, path, filename, size, modified_at, page_count, file_type, thumbnail_key, thumbnail_status, is_favorite, stitch_count, color_count, color_changes, design_width_mm, design_height_mm
             FROM files WHERE id = ?1",
        )
        .map_err(|e| format!("Falha ao preparar consulta de item por id: {e}"))?;

    let result = stmt
        .query_row(params![id], |row| {
            let status: ThumbnailStatus = row.get(9)?;
            let favorite: i64 = row.get(10)?;
            Ok(CollectionItem {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                path: row.get(2)?,
                filename: row.get(3)?,
                size: row.get(4)?,
                modified_at: row.get(5)?,
                page_count: row.get(6)?,
                file_type: row.get(7)?,
                thumbnail_key: row.get(8)?,
                thumbnail_status: status.to_string(),
                is_favorite: favorite != 0,
                stitch_count: row.get(11)?,
                color_count: row.get(12)?,
                color_changes: row.get(13)?,
                design_width_mm: row.get(14)?,
                design_height_mm: row.get(15)?,
            })
        })
        .optional()
        .map_err(|e| format!("Falha ao consultar item por id: {e}"))?;

    Ok(result)
}

/// Removes all item records pointing to the given path across every collection.
/// Returns the number of records removed.
pub fn delete_item_by_path_all_collections(conn: &Connection, path: &str) -> Result<usize, String> {
    let removed = conn
        .execute("DELETE FROM files WHERE path = ?1", params![path])
        .map_err(|e| format!("Falha ao excluir itens por caminho: {e}"))?;
    Ok(removed)
}

/// Toggles the favorite flag of an item. Returns the new favorite state.
pub fn toggle_item_favorite(conn: &Connection, id: i64) -> Result<bool, String> {
    let current: i64 = conn
        .query_row(
            "SELECT is_favorite FROM files WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Falha ao consultar favorito do item: {e}"))?;

    let new_value = if current != 0 { 0 } else { 1 };
    conn.execute(
        "UPDATE files SET is_favorite = ?1 WHERE id = ?2",
        params![new_value, id],
    )
    .map_err(|e| format!("Falha ao atualizar favorito do item: {e}"))?;

    Ok(new_value != 0)
}
