use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct DbState(pub Mutex<Connection>);

#[derive(Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: i64,
    pub content: String,
    pub embedding: String,
    pub tags: String,
    pub pinned: bool,
    pub reminder_at: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatSession {
    pub id: i64,
    pub title: String,
    pub messages: String,
    pub created_at: String,
    pub updated_at: String,
}

const CONFIG_FILE: &str = "memoria_auxiliar_config.json";

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Nao foi possivel localizar app_data_dir: {error}"))?;

    fs::create_dir_all(&dir)
        .map_err(|error| format!("Nao foi possivel criar diretorio de dados: {error}"))?;

    Ok(dir.join(CONFIG_FILE))
}

fn load_config(app: &tauri::AppHandle) -> HashMap<String, String> {
    let path = match config_path(app) {
        Ok(p) => p,
        Err(_) => return HashMap::new(),
    };

    if !path.exists() {
        return HashMap::new();
    }

    fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

fn save_config(app: &tauri::AppHandle, config: &HashMap<String, String>) -> Result<(), String> {
    let path = config_path(app)?;
    let content = serde_json::to_string_pretty(config)
        .map_err(|error| format!("Nao foi possivel serializar config: {error}"))?;
    fs::write(&path, content)
        .map_err(|error| format!("Nao foi possivel salvar config: {error}"))?;
    Ok(())
}

#[tauri::command]
fn get_config(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let config = load_config(&app);
    Ok(config.get(&key).cloned())
}

#[tauri::command]
fn set_config(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let mut config = load_config(&app);
    config.insert(key, value);
    save_config(&app, &config)
}

#[tauri::command]
fn remove_config(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let mut config = load_config(&app);
    config.remove(&key);
    save_config(&app, &config)
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Nao foi possivel localizar app_data_dir: {error}"))?;

    fs::create_dir_all(&dir)
        .map_err(|error| format!("Nao foi possivel criar diretorio de dados: {error}"))?;

    Ok(dir.join("memoria_auxiliar.sqlite"))
}

fn open_and_migrate_database(app: &tauri::AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let connection = Connection::open(path)
        .map_err(|error| format!("Nao foi possivel abrir o SQLite: {error}"))?;

    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY,
                content TEXT NOT NULL,
                embedding TEXT NOT NULL,
                tags TEXT DEFAULT '',
                pinned INTEGER DEFAULT 0,
                reminder_at TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS embedding_cache (
                hash TEXT PRIMARY KEY,
                embedding TEXT NOT NULL,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                messages TEXT NOT NULL,
                created_at TEXT,
                updated_at TEXT
            );
            ",
        )
        .map_err(|error| format!("Nao foi possivel inicializar o banco: {error}"))?;

    // Migrations for existing databases
    let _ = connection.execute("ALTER TABLE notes ADD COLUMN tags TEXT DEFAULT ''", []);
    let _ = connection.execute("ALTER TABLE notes ADD COLUMN pinned INTEGER DEFAULT 0", []);
    let _ = connection.execute("ALTER TABLE notes ADD COLUMN reminder_at TEXT", []);
    let _ = connection.execute("ALTER TABLE notes ADD COLUMN updated_at TEXT", []);

    Ok(connection)
}

#[tauri::command]
fn save_note(
    state: tauri::State<DbState>,
    content: String,
    embedding: String,
    tags: Option<String>,
    pinned: Option<bool>,
    reminder_at: Option<String>,
) -> Result<Note, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let created_at = Utc::now().to_rfc3339();
    let tags_val = tags.unwrap_or_default();
    let pinned_val = if pinned.unwrap_or(false) { 1 } else { 0 };

    conn.execute(
        "INSERT INTO notes (content, embedding, tags, pinned, reminder_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![content, embedding, tags_val, pinned_val, reminder_at, created_at, created_at],
    )
    .map_err(|error| format!("Nao foi possivel salvar a nota: {error}"))?;

    let id = conn.last_insert_rowid();

    Ok(Note {
        id,
        content,
        embedding,
        tags: tags_val,
        pinned: pinned_val == 1,
        reminder_at,
        created_at: created_at.clone(),
        updated_at: Some(created_at),
    })
}

#[tauri::command]
fn list_notes(state: tauri::State<DbState>) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT id, content, embedding, COALESCE(tags, ''), COALESCE(pinned, 0), reminder_at, created_at, updated_at 
             FROM notes 
             ORDER BY pinned DESC, id DESC",
        )
        .map_err(|error| format!("Nao foi possivel preparar consulta: {error}"))?;

    let notes = statement
        .query_map([], |row| {
            let pinned_int: i64 = row.get(4)?;
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                embedding: row.get(2)?,
                tags: row.get(3)?,
                pinned: pinned_int != 0,
                reminder_at: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|error| format!("Nao foi possivel listar notas: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Nao foi possivel ler notas: {error}"))?;

    Ok(notes)
}

#[tauri::command]
fn search_notes_text(
    state: tauri::State<DbState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let search_pattern = format!("%{}%", query.trim().to_lowercase());
    let max_results = limit.unwrap_or(20) as i64;

    let mut statement = conn
        .prepare(
            "SELECT id, content, embedding, COALESCE(tags, ''), COALESCE(pinned, 0), reminder_at, created_at, updated_at 
             FROM notes 
             WHERE LOWER(content) LIKE ?1 OR LOWER(tags) LIKE ?1 
             ORDER BY pinned DESC, id DESC 
             LIMIT ?2",
        )
        .map_err(|error| format!("Nao foi possivel preparar busca por texto: {error}"))?;

    let notes = statement
        .query_map(params![search_pattern, max_results], |row| {
            let pinned_int: i64 = row.get(4)?;
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                embedding: row.get(2)?,
                tags: row.get(3)?,
                pinned: pinned_int != 0,
                reminder_at: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|error| format!("Nao foi possivel executar busca por texto: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Nao foi possivel ler resultados: {error}"))?;

    Ok(notes)
}

#[tauri::command]
fn delete_note(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|error| format!("Nao foi possivel excluir a nota: {error}"))?;
    Ok(())
}

#[tauri::command]
fn update_note(
    state: tauri::State<DbState>,
    id: i64,
    content: String,
    embedding: String,
    tags: Option<String>,
    pinned: Option<bool>,
    reminder_at: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let updated_at = Utc::now().to_rfc3339();
    let tags_val = tags.unwrap_or_default();
    let pinned_val = if pinned.unwrap_or(false) { 1 } else { 0 };

    conn.execute(
        "UPDATE notes SET content = ?1, embedding = ?2, tags = ?3, pinned = ?4, reminder_at = ?5, updated_at = ?6 WHERE id = ?7",
        params![content, embedding, tags_val, pinned_val, reminder_at, updated_at, id],
    )
    .map_err(|error| format!("Nao foi possivel atualizar a nota: {error}"))?;
    Ok(())
}

#[tauri::command]
fn toggle_pin_note(state: tauri::State<DbState>, id: i64) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT COALESCE(pinned, 0) FROM notes WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let current_pinned: i64 = stmt
        .query_row(params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let new_pinned = if current_pinned == 0 { 1 } else { 0 };
    conn.execute(
        "UPDATE notes SET pinned = ?1 WHERE id = ?2",
        params![new_pinned, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(new_pinned == 1)
}

#[tauri::command]
fn delete_all_notes(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes", [])
        .map_err(|error| format!("Nao foi possivel excluir todas as notas: {error}"))?;
    conn.execute("DELETE FROM embedding_cache", [])
        .map_err(|error| format!("Nao foi possivel limpar cache: {error}"))?;
    Ok(())
}

#[tauri::command]
fn export_notes_json(state: tauri::State<DbState>) -> Result<String, String> {
    let notes = list_notes(state)?;
    serde_json::to_string_pretty(&notes)
        .map_err(|error| format!("Nao foi possivel exportar notas: {error}"))
}

#[tauri::command]
fn import_notes_json(state: tauri::State<DbState>, json_data: String) -> Result<usize, String> {
    let notes: Vec<Note> = serde_json::from_str(&json_data)
        .map_err(|error| format!("JSON de importação inválido: {error}"))?;

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut imported = 0;

    for note in notes {
        let created_at = if note.created_at.is_empty() {
            Utc::now().to_rfc3339()
        } else {
            note.created_at
        };
        let updated_at = note.updated_at.unwrap_or_else(|| created_at.clone());
        let pinned_val = if note.pinned { 1 } else { 0 };

        let res = conn.execute(
            "INSERT INTO notes (content, embedding, tags, pinned, reminder_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![note.content, note.embedding, note.tags, pinned_val, note.reminder_at, created_at, updated_at],
        );
        if res.is_ok() {
            imported += 1;
        }
    }

    Ok(imported)
}

#[tauri::command]
fn get_cached_embedding(state: tauri::State<DbState>, hash: String) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut statement = conn
        .prepare("SELECT embedding FROM embedding_cache WHERE hash = ?1")
        .map_err(|error| format!("Nao foi possivel preparar cache: {error}"))?;

    let mut rows = statement
        .query(params![hash])
        .map_err(|error| format!("Nao foi possivel consultar cache: {error}"))?;

    match rows
        .next()
        .map_err(|error| format!("Nao foi possivel ler cache: {error}"))?
    {
        Some(row) => row
            .get::<_, String>(0)
            .map(Some)
            .map_err(|error| format!("Cache invalido: {error}")),
        None => Ok(None),
    }
}

#[tauri::command]
fn save_cached_embedding(
    state: tauri::State<DbState>,
    hash: String,
    embedding: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let created_at = Utc::now().to_rfc3339();

    conn.execute(
        "
        INSERT INTO embedding_cache (hash, embedding, created_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(hash) DO UPDATE SET
            embedding = excluded.embedding,
            created_at = excluded.created_at
        ",
        params![hash, embedding, created_at],
    )
    .map_err(|error| format!("Nao foi possivel salvar cache: {error}"))?;

    Ok(())
}

// ── Chat History Commands ──

#[tauri::command]
fn get_chat_history(state: tauri::State<DbState>) -> Result<Vec<ChatSession>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, messages, created_at, updated_at FROM chat_history ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let sessions = stmt
        .query_map([], |row| {
            Ok(ChatSession {
                id: row.get(0)?,
                title: row.get(1)?,
                messages: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(sessions)
}

#[tauri::command]
fn save_chat_session(
    state: tauri::State<DbState>,
    id: Option<i64>,
    title: String,
    messages: String,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    if let Some(session_id) = id {
        conn.execute(
            "UPDATE chat_history SET title = ?1, messages = ?2, updated_at = ?3 WHERE id = ?4",
            params![title, messages, now, session_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(session_id)
    } else {
        conn.execute(
            "INSERT INTO chat_history (title, messages, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![title, messages, now, now],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }
}

#[tauri::command]
fn delete_chat_session(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM chat_history WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn clear_chat_history(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM chat_history", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let conn = open_and_migrate_database(app.handle())
                .expect("Falha ao abrir e migrar SQLite");
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_note,
            list_notes,
            search_notes_text,
            delete_note,
            update_note,
            toggle_pin_note,
            delete_all_notes,
            export_notes_json,
            import_notes_json,
            get_cached_embedding,
            save_cached_embedding,
            get_chat_history,
            save_chat_session,
            delete_chat_session,
            clear_chat_history,
            get_config,
            set_config,
            remove_config
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo Tauri");
}
