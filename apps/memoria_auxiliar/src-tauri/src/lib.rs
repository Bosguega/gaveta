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
                model_name TEXT NOT NULL DEFAULT '',
                dimensions INTEGER NOT NULL DEFAULT 0,
                normalization TEXT NOT NULL DEFAULT '',
                version TEXT NOT NULL DEFAULT '',
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS embedding_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                model_name TEXT NOT NULL,
                dimensions INTEGER NOT NULL,
                normalization TEXT NOT NULL,
                version TEXT NOT NULL,
                updated_at TEXT NOT NULL
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

    ensure_embedding_cache_schema(&connection)?;

    Ok(connection)
}

/// O cache de embeddings é atrelado ao perfil (modelo, dimensão, normalização,
/// versão). Bases antigas, sem esses metadados, são recriadas: o cache é
/// descartável por definição e não vale migrar vetores obsoletos.
fn ensure_embedding_cache_schema(connection: &Connection) -> Result<(), String> {
    let has_profile_columns = {
        let mut statement = connection
            .prepare("PRAGMA table_info(embedding_cache)")
            .map_err(|error| format!("Nao foi possivel inspecionar o cache de embeddings: {error}"))?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|error| format!("Nao foi possivel inspecionar o cache de embeddings: {error}"))?;
        let names = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Nao foi possivel inspecionar o cache de embeddings: {error}"))?;
        names.iter().any(|name| name == "version")
    };

    if has_profile_columns {
        return Ok(());
    }

    connection
        .execute_batch(
            "
            DROP TABLE IF EXISTS embedding_cache;

            CREATE TABLE embedding_cache (
                hash TEXT PRIMARY KEY,
                embedding TEXT NOT NULL,
                model_name TEXT NOT NULL DEFAULT '',
                dimensions INTEGER NOT NULL DEFAULT 0,
                normalization TEXT NOT NULL DEFAULT '',
                version TEXT NOT NULL DEFAULT '',
                created_at TEXT
            );
            ",
        )
        .map_err(|error| format!("Nao foi possivel recriar o cache de embeddings: {error}"))
}

/// Registra o perfil de embeddings ativo.
///
/// Se o perfil mudou desde a última execução, o cache e os vetores das notas
/// são invalidados, evitando comparar espaços vetoriais diferentes.
#[tauri::command]
fn sync_embedding_profile(
    state: tauri::State<DbState>,
    model_name: String,
    dimensions: i64,
    normalization: String,
    version: String,
) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let current: Option<(String, i64, String, String)> = conn
        .query_row(
            "SELECT model_name, dimensions, normalization, version FROM embedding_profile WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .ok();

    let matches = current
        .as_ref()
        .map(|(model, dims, norm, current_version)| {
            model == &model_name
                && *dims == dimensions
                && norm == &normalization
                && current_version == &version
        })
        .unwrap_or(false);

    if matches {
        return Ok(false);
    }

    conn.execute("DELETE FROM embedding_cache", [])
        .map_err(|error| format!("Nao foi possivel limpar o cache de embeddings: {error}"))?;
    conn.execute("UPDATE notes SET embedding = '[]'", [])
        .map_err(|error| format!("Nao foi possivel invalidar os embeddings das notas: {error}"))?;

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO embedding_profile (id, model_name, dimensions, normalization, version, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
            model_name = excluded.model_name,
            dimensions = excluded.dimensions,
            normalization = excluded.normalization,
            version = excluded.version,
            updated_at = excluded.updated_at",
        params![model_name, dimensions, normalization, version, now],
    )
    .map_err(|error| format!("Nao foi possivel salvar o perfil de embeddings: {error}"))?;

    Ok(true)
}

#[tauri::command]
fn get_embedding_profile(
    state: tauri::State<DbState>,
) -> Result<Option<(String, i64, String, String, String)>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    Ok(conn
        .query_row(
            "SELECT model_name, dimensions, normalization, version, updated_at FROM embedding_profile WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .ok())
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

/// Remove a entrada de cache de uma nota excluída, mas apenas quando ela não é
/// mais referenciada por nenhuma nota existente.
///
/// `cache_key` é opcional por decisão: sem ele a limpeza não acontece (no-op),
/// preferível a remover uma entrada que ainda possa ser reutilizada. Como a
/// chave de cache deriva do conteúdo, notas com conteúdo idêntico compartilham a
/// mesma entrada — por isso conferimos o conteúdo antes de apagar.
fn prune_orphan_cache_entry(
    conn: &Connection,
    cache_key: Option<String>,
    content: &str,
) -> Result<(), String> {
    let Some(cache_key) = cache_key else {
        return Ok(());
    };

    let remaining: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes WHERE content = ?1",
            params![content],
            |row| row.get(0),
        )
        .map_err(|error| format!("Nao foi possivel verificar o cache de embeddings: {error}"))?;

    if remaining > 0 {
        return Ok(());
    }

    conn.execute(
        "DELETE FROM embedding_cache WHERE hash = ?1",
        params![cache_key],
    )
    .map_err(|error| format!("Nao foi possivel limpar cache de embeddings orfao: {error}"))?;

    Ok(())
}

#[tauri::command]
fn delete_note(
    state: tauri::State<DbState>,
    id: i64,
    cache_key: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Conteudo e necessario para decidir se a entrada de cache ainda e usada.
    let content: Option<String> = conn
        .query_row(
            "SELECT content FROM notes WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .ok();

    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|error| format!("Nao foi possivel excluir a nota: {error}"))?;

    if let Some(content) = content {
        prune_orphan_cache_entry(&conn, cache_key, &content)?;
    }

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
    model_name: Option<String>,
    dimensions: Option<i64>,
    normalization: Option<String>,
    version: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let created_at = Utc::now().to_rfc3339();

    conn.execute(
        "
        INSERT INTO embedding_cache (
            hash, embedding, model_name, dimensions, normalization, version, created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(hash) DO UPDATE SET
            embedding = excluded.embedding,
            model_name = excluded.model_name,
            dimensions = excluded.dimensions,
            normalization = excluded.normalization,
            version = excluded.version,
            created_at = excluded.created_at
        ",
        params![
            hash,
            embedding,
            model_name.unwrap_or_default(),
            dimensions.unwrap_or_default(),
            normalization.unwrap_or_default(),
            version.unwrap_or_default(),
            created_at
        ],
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

// ── Servidores locais llama-server ──

/// Processos iniciados pela própria aplicação, por servidor.
///
/// Apenas os processos guardados aqui podem ser encerrados pelo app. Um
/// llama-server que já estava rodando antes é apenas detectado via health check.
#[derive(Default)]
pub struct ServerState(pub Mutex<HashMap<String, std::process::Child>>);

#[cfg(windows)]
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;

fn normalize_server_kind(kind: &str) -> Result<String, String> {
    match kind {
        "chat" => Ok("chat".to_string()),
        "embedding" => Ok("embedding".to_string()),
        other => Err(format!("Servidor desconhecido: {other}")),
    }
}

/// Divide uma linha de comando Windows em programa + argumentos.
///
/// Segue as regras do CommandLineToArgvW: separadores delimitam argumentos,
/// aspas agrupam valores com espaços e barras invertidas antes de aspas
/// podem escapá-las. Caminhos entre aspas (com espaços) são preservados.
/// Normaliza a sintaxe de shell que aparece ao copiar um comando de terminal.
///
/// Remove o operador de chamada `&` e resolve as continuacoes de linha com
/// crase. O app nao executa por shell: o primeiro token precisa ser o
/// executavel, nao um metacaractere do shell.
fn normalize_shell_syntax(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '`' {
            // Crase seguida de espaco/quebra = continuacao de linha: vira um espaco.
            while matches!(chars.peek(), Some(next) if next.is_whitespace()) {
                chars.next();
            }
            out.push(' ');
            continue;
        }
        out.push(c);
    }

    // Operador de chamada do PowerShell: `& "programa.exe" args...`
    let trimmed = out.trim_start();
    trimmed.strip_prefix('&').unwrap_or(trimmed).to_string()
}

fn parse_command_line(input: &str) -> Result<Vec<String>, String> {
    let input = &normalize_shell_syntax(input);
    let mut args: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut has_token = false;

    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '"' => {
                in_quotes = !in_quotes;
                has_token = true;
            }
            '\\' => {
                let mut backslashes = 1;
                while let Some('\\') = chars.peek() {
                    backslashes += 1;
                    chars.next();
                }

                if let Some(&'"') = chars.peek() {
                    // Metade das barras escapa a barra, a outra escapa a aspa.
                    for _ in 0..(backslashes / 2) {
                        current.push('\\');
                    }
                    if backslashes % 2 == 0 {
                        in_quotes = !in_quotes;
                    } else {
                        current.push('"');
                    }
                    chars.next();
                } else {
                    for _ in 0..backslashes {
                        current.push('\\');
                    }
                }
                has_token = true;
            }
            c if c.is_whitespace() && !in_quotes => {
                if has_token {
                    args.push(std::mem::take(&mut current));
                    has_token = false;
                }
            }
            c => {
                current.push(c);
                has_token = true;
            }
        }
    }

    if in_quotes {
        return Err("Aspas nao balanceadas no comando configurado.".to_string());
    }

    if has_token {
        args.push(current);
    }

    Ok(args)
}

/// Inicia um llama-server em processo e janela de console próprios.
///
/// O processo e independente do app: continua rodando depois que o comando
/// termina, com stdout/stderr visiveis para diagnostico.
#[tauri::command]
fn start_llama_server(
    state: tauri::State<ServerState>,
    kind: String,
    command: String,
) -> Result<bool, String> {
    let key = normalize_server_kind(&kind)?;

    if command.trim().is_empty() {
        return Err("Nenhum comando configurado para este servidor.".to_string());
    }

    let parts = parse_command_line(&command)?;
    let program = parts
        .first()
        .cloned()
        .ok_or_else(|| "Comando configurado vazio.".to_string())?;

    let mut builder = std::process::Command::new(&program);
    builder
        .args(&parts[1..])
        .stdin(std::process::Stdio::inherit())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());

    // Janela de console propria: os logs do llama-server ficam visiveis.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        builder.creation_flags(CREATE_NEW_CONSOLE);
    }

    let child = builder.spawn().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            return format!(
                "Executavel nao encontrado: {program}\nConfira o caminho e as aspas do comando configurado."
            );
        }
        format!("Nao foi possivel iniciar '{program}': {error}")
    })?;

    let mut servers = state.0.lock().map_err(|e| e.to_string())?;
    servers.insert(key, child);

    Ok(true)
}

/// Encerra apenas o processo iniciado pela propria aplicacao.
///
/// Retorna false quando o app nao e dono do processo (servidor previamente
/// iniciado pelo usuario) — nesse caso nada e encerrado.
#[tauri::command]
fn stop_llama_server(state: tauri::State<ServerState>, kind: String) -> Result<bool, String> {
    let key = normalize_server_kind(&kind)?;

    let mut servers = state.0.lock().map_err(|e| e.to_string())?;
    let Some(mut child) = servers.remove(&key) else {
        return Ok(false);
    };

    child
        .kill()
        .map_err(|error| format!("Nao foi possivel encerrar o processo: {error}"))?;

    Ok(true)
}

/// Informa se o app iniciou (e portanto pode encerrar) aquele servidor.
#[tauri::command]
fn is_llama_server_owned(state: tauri::State<ServerState>, kind: String) -> Result<bool, String> {
    let key = normalize_server_kind(&kind)?;
    let servers = state.0.lock().map_err(|e| e.to_string())?;
    Ok(servers.contains_key(&key))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let conn = open_and_migrate_database(app.handle())
                .expect("Falha ao abrir e migrar SQLite");
            app.manage(DbState(Mutex::new(conn)));
            app.manage(ServerState::default());
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
            sync_embedding_profile,
            get_embedding_profile,
            start_llama_server,
            stop_llama_server,
            is_llama_server_owned,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_program_and_arguments() {
        let parts = parse_command_line("llama-server.exe -m model.gguf --port 8080").unwrap();
        assert_eq!(
            parts,
            vec!["llama-server.exe", "-m", "model.gguf", "--port", "8080"]
        );
    }

    #[test]
    fn keeps_quoted_paths_with_spaces_together() {
        let parts = parse_command_line(
            r#""C:\Trabalhos\Modelos\llama bin\llama-server.exe" -m "C:\Modelos\meu modelo.gguf" --port 8081"#,
        )
        .unwrap();

        assert_eq!(parts[0], r"C:\Trabalhos\Modelos\llama bin\llama-server.exe");
        assert_eq!(parts[1], "-m");
        assert_eq!(parts[2], r"C:\Modelos\meu modelo.gguf");
        assert_eq!(parts[3], "--port");
        assert_eq!(parts[4], "8081");
    }

    #[test]
    fn preserves_backslashes_in_unquoted_windows_paths() {
        let parts = parse_command_line(r"C:\bin\llama-server.exe -m C:\m\model.gguf").unwrap();
        assert_eq!(parts[0], r"C:\bin\llama-server.exe");
        assert_eq!(parts[2], r"C:\m\model.gguf");
    }

    #[test]
    fn collapses_extra_whitespace() {
        let parts = parse_command_line("  llama-server.exe   -ngl 99  ").unwrap();
        assert_eq!(parts, vec!["llama-server.exe", "-ngl", "99"]);
    }

    #[test]
    fn treats_empty_quoted_value_as_token() {
        let parts = parse_command_line(r#"llama-server.exe -p "" --port 8080"#).unwrap();
        assert_eq!(parts, vec!["llama-server.exe", "-p", "", "--port", "8080"]);
    }

    #[test]
    fn rejects_unbalanced_quotes() {
        assert!(parse_command_line(r#"llama-server.exe -m "model.gguf"#).is_err());
    }

    #[test]
    fn returns_no_parts_for_blank_command() {
        assert!(parse_command_line("   ").unwrap().is_empty());
    }

    #[test]
    fn rejects_unknown_server_kind() {
        assert!(normalize_server_kind("outro").is_err());
        assert!(normalize_server_kind("chat").is_ok());
        assert!(normalize_server_kind("embedding").is_ok());
    }

    #[test]
    fn ignores_powershell_call_operator() {
        let parts = parse_command_line(
            r#"& "C:\Trabalhos\Modelos\llama-server.exe" -m "C:\Modelos\bge-m3.gguf" --port 8081"#,
        )
        .unwrap();

        assert_eq!(parts[0], r"C:\Trabalhos\Modelos\llama-server.exe");
        assert_eq!(parts[1], "-m");
        assert_eq!(parts[2], r"C:\Modelos\bge-m3.gguf");
    }

    #[test]
    fn resolves_powershell_line_continuation() {
        // Mesmo comando colado do terminal, com crases e quebras de linha.
        let parts = parse_command_line(
            "& \"C:\\bin\\llama-server.exe\" `\r\n  -m \"C:\\m\\bge-m3.gguf\" `\r\n  --embedding `\r\n  --port 8081",
        )
        .unwrap();

        assert_eq!(parts[0], r"C:\bin\llama-server.exe");
        assert_eq!(parts[2], r"C:\m\bge-m3.gguf");
        assert!(parts.contains(&"--embedding".to_string()));
        assert!(parts.contains(&"8081".to_string()));
        assert!(!parts.iter().any(|arg| arg.contains('`')));
    }

    #[test]
    fn keeps_arguments_that_merely_start_with_ampersand() {
        // Só o operador de chamada inicial é removido; argumentos são preservados.
        let parts = parse_command_line(r#"llama-server.exe --jinja "&x" "#).unwrap();
        assert_eq!(parts[0], "llama-server.exe");
        assert_eq!(parts[2], "&x");
    }

    // --- Limpeza de cache de embeddings após exclusão de nota ---

    fn cache_test_connection() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE notes (id INTEGER PRIMARY KEY, content TEXT NOT NULL, embedding TEXT NOT NULL);
            CREATE TABLE embedding_cache (hash TEXT PRIMARY KEY, embedding TEXT NOT NULL);
            ",
        )
        .unwrap();
        conn
    }

    fn cache_row_count(conn: &Connection, hash: &str) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM embedding_cache WHERE hash = ?1",
            params![hash],
            |row| row.get(0),
        )
        .unwrap()
    }

    #[test]
    fn removes_orphan_cache_entry_after_note_deletion() {
        let conn = cache_test_connection();
        conn.execute(
            "INSERT INTO notes (id, content, embedding) VALUES (1, 'conteudo a', '[]')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO embedding_cache (hash, embedding) VALUES ('key-a', '[1,0]')",
            [],
        )
        .unwrap();

        conn.execute("DELETE FROM notes WHERE id = 1", []).unwrap();
        prune_orphan_cache_entry(&conn, Some("key-a".to_string()), "conteudo a").unwrap();

        assert_eq!(cache_row_count(&conn, "key-a"), 0);
    }

    #[test]
    fn preserves_cache_entry_still_used_by_another_note() {
        // Notas com o mesmo conteúdo compartilham a chave de cache.
        let conn = cache_test_connection();
        conn.execute(
            "INSERT INTO notes (id, content, embedding) VALUES (1, 'igual', '[]')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO notes (id, content, embedding) VALUES (2, 'igual', '[]')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO embedding_cache (hash, embedding) VALUES ('key-igual', '[1,0]')",
            [],
        )
        .unwrap();

        conn.execute("DELETE FROM notes WHERE id = 1", []).unwrap();
        prune_orphan_cache_entry(&conn, Some("key-igual".to_string()), "igual").unwrap();

        assert_eq!(cache_row_count(&conn, "key-igual"), 1);
    }

    #[test]
    fn keeps_cache_when_no_key_is_provided() {
        // Sem chave não há como saber o que é órfão: a limpeza é no-op.
        let conn = cache_test_connection();
        conn.execute(
            "INSERT INTO embedding_cache (hash, embedding) VALUES ('key-x', '[1,0]')",
            [],
        )
        .unwrap();

        prune_orphan_cache_entry(&conn, None, "qualquer").unwrap();

        assert_eq!(cache_row_count(&conn, "key-x"), 1);
    }
}
