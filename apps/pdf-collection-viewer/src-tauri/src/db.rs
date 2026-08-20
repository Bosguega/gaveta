use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: i64,
    pub name: String,
    pub icon: String,
    pub include_subfolders: bool,
    pub pdf_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionDetail {
    pub id: i64,
    pub name: String,
    pub icon: String,
    pub include_subfolders: bool,
    pub paths: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pdf {
    pub id: i64,
    pub collection_id: i64,
    pub path: String,
    pub filename: String,
    pub size: i64,
    pub modified_at: String,
    pub page_count: Option<i64>,
    pub thumbnail_key: Option<String>,
    pub thumbnail_status: String,
    pub is_favorite: bool,
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

        CREATE TABLE IF NOT EXISTS pdfs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            path TEXT NOT NULL,
            filename TEXT NOT NULL,
            size INTEGER NOT NULL,
            modified_at TEXT NOT NULL,
            page_count INTEGER,
            thumbnail_key TEXT,
            thumbnail_status TEXT NOT NULL DEFAULT 'pending',
            is_favorite INTEGER NOT NULL DEFAULT 0,
            UNIQUE(collection_id, path)
        );

        CREATE INDEX IF NOT EXISTS idx_pdfs_collection ON pdfs(collection_id);
        CREATE INDEX IF NOT EXISTS idx_pdfs_path ON pdfs(path);
        ",
    )
    .map_err(|e| format!("Não foi possível inicializar o banco: {e}"))?;

    // Migration: add is_favorite column if missing (older databases)
    let has_favorite: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('pdfs') WHERE name = 'is_favorite'")
        .map_err(|e| format!("Falha ao verificar coluna is_favorite: {e}"))?
        .query_row([], |row| {
            let count: i64 = row.get(0)?;
            Ok(count > 0)
        })
        .map_err(|e| format!("Falha ao verificar coluna is_favorite: {e}"))?;

    if !has_favorite {
        conn.execute(
            "ALTER TABLE pdfs ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|e| format!("Falha ao adicionar coluna is_favorite: {e}"))?;
    }

    Ok(conn)
}

// ── Collections ──

pub fn list_collections(conn: &Connection) -> Result<Vec<Collection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, c.icon, c.include_subfolders, c.created_at, c.updated_at,
                    (SELECT COUNT(*) FROM pdfs p WHERE p.collection_id = c.id) as pdf_count
             FROM collections c
             ORDER BY c.name COLLATE NOCASE",
        )
        .map_err(|e| format!("Falha ao preparar listagem: {e}"))?;

    let collections = stmt
        .query_map([], |row| {
            let include: i64 = row.get(3)?;
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                include_subfolders: include != 0,
                pdf_count: row.get(6)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
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
            "SELECT id, name, icon, include_subfolders, created_at, updated_at
             FROM collections WHERE id = ?1",
        )
        .map_err(|e| format!("Falha ao preparar consulta: {e}"))?;

    let result = stmt
        .query_row(params![id], |row| {
            let include: i64 = row.get(3)?;
            Ok(CollectionDetail {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                include_subfolders: include != 0,
                paths: Vec::new(),
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
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
    paths: &[String],
    include_subfolders: bool,
) -> Result<Collection, String> {
    let now = Utc::now().to_rfc3339();
    let include = if include_subfolders { 1 } else { 0 };

    conn.execute(
        "INSERT INTO collections (name, icon, include_subfolders, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![name, icon, include, now, now],
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
        include_subfolders,
        pdf_count: 0,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update_collection(
    conn: &Connection,
    id: i64,
    name: &str,
    icon: &str,
    paths: &[String],
    include_subfolders: bool,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let include = if include_subfolders { 1 } else { 0 };

    conn.execute(
        "UPDATE collections SET name = ?1, icon = ?2, include_subfolders = ?3, updated_at = ?4 WHERE id = ?5",
        params![name, icon, include, now, id],
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

// ── PDFs ──

pub fn list_pdfs(conn: &Connection, collection_id: i64) -> Result<Vec<Pdf>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, path, filename, size, modified_at, page_count, thumbnail_key, thumbnail_status, is_favorite
             FROM pdfs WHERE collection_id = ?1
             ORDER BY filename COLLATE NOCASE",
        )
        .map_err(|e| format!("Falha ao preparar listagem de PDFs: {e}"))?;

    let pdfs = stmt
        .query_map(params![collection_id], |row| {
            let status: ThumbnailStatus = row.get(8)?;
            let favorite: i64 = row.get(9)?;
            Ok(Pdf {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                path: row.get(2)?,
                filename: row.get(3)?,
                size: row.get(4)?,
                modified_at: row.get(5)?,
                page_count: row.get(6)?,
                thumbnail_key: row.get(7)?,
                thumbnail_status: status.to_string(),
                is_favorite: favorite != 0,
            })
        })
        .map_err(|e| format!("Falha ao listar PDFs: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Falha ao ler PDFs: {e}"))?;

    Ok(pdfs)
}

pub fn get_pdf_by_path(conn: &Connection, collection_id: i64, path: &str) -> Result<Option<Pdf>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, path, filename, size, modified_at, page_count, thumbnail_key, thumbnail_status, is_favorite
             FROM pdfs WHERE collection_id = ?1 AND path = ?2",
        )
        .map_err(|e| format!("Falha ao preparar consulta de PDF: {e}"))?;

    let result = stmt
        .query_row(params![collection_id, path], |row| {
            let status: ThumbnailStatus = row.get(8)?;
            let favorite: i64 = row.get(9)?;
            Ok(Pdf {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                path: row.get(2)?,
                filename: row.get(3)?,
                size: row.get(4)?,
                modified_at: row.get(5)?,
                page_count: row.get(6)?,
                thumbnail_key: row.get(7)?,
                thumbnail_status: status.to_string(),
                is_favorite: favorite != 0,
            })
        })
        .optional()
        .map_err(|e| format!("Falha ao consultar PDF: {e}"))?;

    Ok(result)
}

pub fn insert_pdf(
    conn: &Connection,
    collection_id: i64,
    path: &str,
    filename: &str,
    size: i64,
    modified_at: &str,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO pdfs (collection_id, path, filename, size, modified_at, thumbnail_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![collection_id, path, filename, size, modified_at, ThumbnailStatus::Pending],
    )
    .map_err(|e| format!("Falha ao inserir PDF: {e}"))?;

    Ok(conn.last_insert_rowid())
}

pub fn update_pdf_metadata(
    conn: &Connection,
    id: i64,
    size: i64,
    modified_at: &str,
) -> Result<(), String> {
    conn.execute(
        "UPDATE pdfs SET size = ?1, modified_at = ?2, thumbnail_status = ?3 WHERE id = ?4",
        params![size, modified_at, ThumbnailStatus::Pending, id],
    )
    .map_err(|e| format!("Falha ao atualizar PDF: {e}"))?;
    Ok(())
}

pub fn set_pdf_thumbnail(
    conn: &Connection,
    id: i64,
    page_count: Option<i64>,
    thumbnail_key: Option<&str>,
    status: ThumbnailStatus,
) -> Result<(), String> {
    conn.execute(
        "UPDATE pdfs SET page_count = ?1, thumbnail_key = ?2, thumbnail_status = ?3 WHERE id = ?4",
        params![page_count, thumbnail_key, status, id],
    )
    .map_err(|e| format!("Falha ao atualizar thumbnail do PDF: {e}"))?;
    Ok(())
}

pub fn delete_pdf(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM pdfs WHERE id = ?1", params![id])
        .map_err(|e| format!("Falha ao excluir PDF: {e}"))?;
    Ok(())
}

pub fn delete_pdfs_not_in(
    conn: &Connection,
    collection_id: i64,
    keep_paths: &[String],
    unavailable_paths: &[String],
) -> Result<usize, String> {
    let mut removed = 0;
    let existing = list_pdfs(conn, collection_id)?;

    for pdf in existing {
        let belongs_to_unavailable_path = unavailable_paths.iter().any(|root| {
            std::path::Path::new(&pdf.path).starts_with(std::path::Path::new(root))
        });
        if !keep_paths.contains(&pdf.path) && !belongs_to_unavailable_path {
            delete_pdf(conn, pdf.id)?;
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
        .prepare("SELECT thumbnail_key FROM pdfs WHERE thumbnail_key IS NOT NULL")
        .map_err(|e| format!("Falha ao preparar consulta de thumbnail keys: {e}"))?;

    let keys = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Falha ao listar thumbnail keys: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Falha ao ler thumbnail keys: {e}"))?;

    Ok(keys)
}

pub fn get_pdf_by_id(conn: &Connection, id: i64) -> Result<Option<Pdf>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, path, filename, size, modified_at, page_count, thumbnail_key, thumbnail_status, is_favorite
             FROM pdfs WHERE id = ?1",
        )
        .map_err(|e| format!("Falha ao preparar consulta de PDF por id: {e}"))?;

    let result = stmt
        .query_row(params![id], |row| {
            let status: ThumbnailStatus = row.get(8)?;
            let favorite: i64 = row.get(9)?;
            Ok(Pdf {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                path: row.get(2)?,
                filename: row.get(3)?,
                size: row.get(4)?,
                modified_at: row.get(5)?,
                page_count: row.get(6)?,
                thumbnail_key: row.get(7)?,
                thumbnail_status: status.to_string(),
                is_favorite: favorite != 0,
            })
        })
        .optional()
        .map_err(|e| format!("Falha ao consultar PDF por id: {e}"))?;

    Ok(result)
}

/// Removes all pdf records pointing to the given path across every collection.
/// Returns the number of records removed.
pub fn delete_pdf_by_path_all_collections(conn: &Connection, path: &str) -> Result<usize, String> {
    let removed = conn
        .execute("DELETE FROM pdfs WHERE path = ?1", params![path])
        .map_err(|e| format!("Falha ao excluir PDFs por caminho: {e}"))?;
    Ok(removed)
}

/// Toggles the favorite flag of a pdf. Returns the new favorite state.
pub fn toggle_pdf_favorite(conn: &Connection, id: i64) -> Result<bool, String> {
    let current: i64 = conn
        .query_row(
            "SELECT is_favorite FROM pdfs WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Falha ao consultar favorito do PDF: {e}"))?;

    let new_value = if current != 0 { 0 } else { 1 };
    conn.execute(
        "UPDATE pdfs SET is_favorite = ?1 WHERE id = ?2",
        params![new_value, id],
    )
    .map_err(|e| format!("Falha ao atualizar favorito do PDF: {e}"))?;

    Ok(new_value != 0)
}
