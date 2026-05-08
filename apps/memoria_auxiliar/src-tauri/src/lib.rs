use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tokio::time::{sleep, Duration};

#[derive(Serialize)]
struct Note {
    id: i64,
    content: String,
    embedding: String,
    created_at: String,
}

#[derive(Deserialize)]
struct GeminiEmbeddingResponse {
    embedding: Option<GeminiEmbedding>,
    embeddings: Option<Vec<GeminiEmbedding>>,
}

#[derive(Deserialize)]
struct GeminiEmbedding {
    values: Option<Vec<f64>>,
}

#[derive(Deserialize)]
struct GeminiGenerateResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Serialize)]
struct GenerateAnswerResponse {
    answer: String,
    used_ids: Vec<i64>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
}

#[derive(Deserialize)]
struct GeminiContent {
    parts: Option<Vec<GeminiPart>>,
}

#[derive(Deserialize)]
struct GeminiPart {
    text: Option<String>,
}

fn load_dotenv(app: &tauri::AppHandle) {
    let _ = dotenvy::dotenv();

    if let Ok(resource_dir) = app.path().resource_dir() {
        let _ = dotenvy::from_path(resource_dir.join(".env"));
    }

    if let Ok(current_dir) = env::current_dir() {
        let _ = dotenvy::from_path(current_dir.join(".env"));
        if let Some(parent) = current_dir.parent() {
            let _ = dotenvy::from_path(parent.join(".env"));
        }
    }
}

fn gemini_api_key() -> Result<String, String> {
    env::var("GEMINI_API_KEY")
        .map_err(|_| "Configure GEMINI_API_KEY no arquivo .env.".to_string())
        .and_then(|key| {
            if key.trim().is_empty() || key == "coloque_sua_chave_aqui" {
                Err("Configure GEMINI_API_KEY no arquivo .env.".to_string())
            } else {
                Ok(key)
            }
        })
}

fn gemini_model(env_name: &str, fallback: &str) -> String {
    env::var(env_name).unwrap_or_else(|_| fallback.to_string())
}

fn compact_error_details(details: String) -> String {
    const MAX_DETAILS_LENGTH: usize = 500;
    let details = details.trim();
    if details.chars().count() > MAX_DETAILS_LENGTH {
        format!(
            "{}...",
            details.chars().take(MAX_DETAILS_LENGTH).collect::<String>()
        )
    } else {
        details.to_string()
    }
}

/// Sanitiza texto para mitigar prompt injection:
/// - Remove caracteres de controle (exceto quebras de linha básicas)
/// - Remove tokens de sistema comuns
/// - Trunca para tamanho máximo seguro
fn sanitize_prompt_input(text: &str, max_length: usize) -> String {
    const DANGEROUS_TOKENS: &[&str] = &[
        "ignore all previous instructions",
        "ignore all prior instructions",
        "forget everything",
        "system prompt",
        "you are now",
        "act as if",
        "do not follow",
        "do not obey",
        "override",
    ];

    let mut sanitized = text
        .chars()
        .filter(|&c| c == '\n' || c == '\r' || c == '\t' || c.is_ascii_graphic() || c == ' ')
        .collect::<String>();

    // Lowercase para verificar tokens perigosos
    let lower = sanitized.to_lowercase();
    for token in DANGEROUS_TOKENS {
        if lower.contains(token) {
            sanitized = sanitized.replace(token, "[redacted]");
        }
    }

    if sanitized.chars().count() > max_length {
        sanitized.chars().take(max_length).collect()
    } else {
        sanitized
    }
}

async fn retry_with_backoff<F, Fut, T>(mut attempt: F, max_retries: u32) -> Result<T, String>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, String>>,
{
    let mut delay = Duration::from_millis(500);
    for attempt_num in 0..=max_retries {
        match attempt().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                if attempt_num == max_retries {
                    return Err(e);
                }
                eprintln!("Tentativa {} falhou: {}. Tentando novamente em {:?}...", attempt_num + 1, e, delay);
                sleep(delay).await;
                delay = delay.saturating_mul(2); // Exponential backoff
            }
        }
    }
    unreachable!()
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

fn open_database(app: &tauri::AppHandle) -> Result<Connection, String> {
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
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS embedding_cache (
                hash TEXT PRIMARY KEY,
                embedding TEXT NOT NULL,
                created_at TEXT
            );
            ",
        )
        .map_err(|error| format!("Nao foi possivel inicializar o banco: {error}"))?;

    Ok(connection)
}

#[tauri::command]
async fn generate_embedding(app: tauri::AppHandle, text: String) -> Result<Vec<f64>, String> {
    let normalized = text.trim();
    if normalized.is_empty() {
        return Err("Texto vazio nao pode gerar embedding.".to_string());
    }

    load_dotenv(&app);
    let api_key = gemini_api_key()?;
    let model = gemini_model("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001");
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={api_key}"
    );

    retry_with_backoff(
        || async {
            let response = client
                .post(&url)
                .json(&json!({
                    "model": format!("models/{model}"),
                    "content": {
                        "parts": [{ "text": &normalized }]
                    }
                }))
                .send()
                .await
                .map_err(|error| format!("Falha ao chamar Gemini Embedding: {error}"))?;

            if !response.status().is_success() {
                let status = response.status();
                let details = response.text().await.unwrap_or_default();
                return Err(format!(
                    "Falha ao gerar embedding: {status} {}",
                    compact_error_details(details)
                ));
            }

            let data = response
                .json::<GeminiEmbeddingResponse>()
                .await
                .map_err(|error| format!("Resposta de embedding invalida: {error}"))?;

            let embedding = data
                .embedding
                .and_then(|embedding| embedding.values)
                .or_else(|| {
                    data.embeddings
                        .and_then(|mut embeddings| embeddings.pop())
                        .and_then(|embedding| embedding.values)
                })
                .filter(|values| !values.is_empty())
                .ok_or_else(|| "A API nao retornou um embedding valido.".to_string())?;

            Ok(embedding)
        },
        3, // max_retries
    ).await
}

async fn generate_text(app: tauri::AppHandle, prompt: String, empty_message: &str) -> Result<String, String> {
    load_dotenv(&app);
    let api_key = gemini_api_key()?;
    let model = gemini_model("GEMINI_LLM_MODEL", "gemini-2.5-flash-lite");
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    );

    retry_with_backoff(
        || async {
            let response = client
                .post(&url)
                .json(&json!({
                    "contents": [{
                        "parts": [{ "text": &prompt }]
                    }]
                }))
                .send()
                .await
                .map_err(|error| format!("Falha ao chamar Gemini: {error}"))?;

            if !response.status().is_success() {
                let status = response.status();
                let details = response.text().await.unwrap_or_default();
                return Err(format!(
                    "Falha ao gerar texto: {status} {}",
                    compact_error_details(details)
                ));
            }

            let data = response
                .json::<GeminiGenerateResponse>()
                .await
                .map_err(|error| format!("Resposta de texto invalida: {error}"))?;

            let text = data
                .candidates
                .unwrap_or_default()
                .into_iter()
                .filter_map(|candidate| candidate.content)
                .flat_map(|content| content.parts.unwrap_or_default())
                .filter_map(|part| part.text)
                .collect::<Vec<_>>()
                .join("")
                .trim()
                .to_string();

            if text.is_empty() {
                Err(empty_message.to_string())
            } else {
                Ok(text)
            }
        },
        3,
    ).await
}

#[tauri::command]
async fn summarize_notes(app: tauri::AppHandle, notes: Vec<String>) -> Result<String, String> {
    if notes.is_empty() {
        return Err("Nao ha resultados para resumir.".to_string());
    }

    const MAX_NOTE_LENGTH: usize = 5000;

    let notes = notes
        .into_iter()
        .map(|note| sanitize_prompt_input(&note, MAX_NOTE_LENGTH))
        .enumerate()
        .map(|(index, note)| format!("{}. {}", index + 1, note))
        .collect::<Vec<_>>()
        .join("\n");
    let prompt = format!(
        "Resuma ou organize as informacoes abaixo de forma clara. Use apenas os dados fornecidos.\n\n{notes}"
    );

    generate_text(app, prompt, "A API nao retornou resumo.").await
}

#[tauri::command]
async fn generate_answer(
    app: tauri::AppHandle,
    question: String,
    context_notes: Vec<String>,
) -> Result<GenerateAnswerResponse, String> {
    if question.trim().is_empty() {
        return Err("Pergunta vazia nao pode gerar resposta.".to_string());
    }

    const MAX_QUESTION_LENGTH: usize = 2000;

    let sanitized_question = sanitize_prompt_input(&question, MAX_QUESTION_LENGTH);

    let context = if context_notes.is_empty() {
        "Nenhuma nota relevante encontrada.".to_string()
    } else {
        // As notas ja vem formatadas com [MEMORY_ID: N] do frontend
        // Apenas sanitizamos cada uma
        context_notes
            .into_iter()
            .map(|note| sanitize_prompt_input(&note, 5000))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let prompt = format!(
        r#"Voce e uma memoria auxiliar pessoal.

Sua funcao e responder APENAS com base nas memorias fornecidas abaixo.

REGRAS IMPORTANTES:
- Nao invente informacoes.
- Nao use conhecimento externo.
- Se nao encontrar a resposta nas memorias, diga: "Nao encontrei isso nas memorias."
- Nem toda memoria enviada precisa ser usada.
- Use apenas as memorias realmente relevantes.

MEMORIAS:
{context}

PERGUNTA:
{sanitized_question}

Agora, responda a pergunta. Depois de responder, na linha final, informe SOMENTE os IDs das memorias realmente utilizadas neste formato exato:
USED_IDS: [id1, id2, id3]
"#,
        context = context,
        sanitized_question = sanitized_question,
    );

    let raw_response = generate_text(app, prompt, "A API nao retornou resposta.").await?;

    // Parse USED_IDS do final da resposta
    let used_ids = if let Some(pos) = raw_response.rfind("USED_IDS: [") {
        let after = &raw_response[pos + 11..];
        if let Some(end) = after.find(']') {
            let ids_str = &after[..end];
            ids_str
                .split(',')
                .filter_map(|s| {
                    let trimmed = s.trim();
                    if trimmed.is_empty() {
                        None
                    } else {
                        trimmed.parse::<i64>().ok()
                    }
                })
                .collect()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    // Remove a linha USED_IDS da resposta final
    let answer = if let Some(pos) = raw_response.rfind("USED_IDS: [") {
        let before = &raw_response[..pos].trim_end();
        before.to_string()
    } else {
        raw_response.clone()
    };

    Ok(GenerateAnswerResponse { answer, used_ids })
}

#[tauri::command]
fn save_note(app: tauri::AppHandle, content: String, embedding: String) -> Result<Note, String> {
    let connection = open_database(&app)?;
    let created_at = Utc::now().to_rfc3339();

    connection
        .execute(
            "INSERT INTO notes (content, embedding, created_at) VALUES (?1, ?2, ?3)",
            params![content, embedding, created_at],
        )
        .map_err(|error| format!("Nao foi possivel salvar a nota: {error}"))?;

    let id = connection.last_insert_rowid();

    Ok(Note {
        id,
        content,
        embedding,
        created_at,
    })
}

#[tauri::command]
fn list_notes(app: tauri::AppHandle) -> Result<Vec<Note>, String> {
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare("SELECT id, content, embedding, created_at FROM notes ORDER BY id DESC")
        .map_err(|error| format!("Nao foi possivel preparar consulta: {error}"))?;

    let notes = statement
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                embedding: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|error| format!("Nao foi possivel listar notas: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Nao foi possivel ler notas: {error}"))?;

    Ok(notes)
}

#[tauri::command]
fn get_cached_embedding(app: tauri::AppHandle, hash: String) -> Result<Option<String>, String> {
    let connection = open_database(&app)?;
    let mut statement = connection
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
    app: tauri::AppHandle,
    hash: String,
    embedding: String,
) -> Result<(), String> {
    let connection = open_database(&app)?;
    let created_at = Utc::now().to_rfc3339();

    connection
        .execute(
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

#[tauri::command]
fn delete_note(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let connection = open_database(&app)?;
    connection
        .execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|error| format!("Nao foi possivel excluir a nota: {error}"))?;
    Ok(())
}

#[tauri::command]
fn update_note(app: tauri::AppHandle, id: i64, content: String, embedding: String) -> Result<(), String> {
    let connection = open_database(&app)?;
    connection
        .execute(
            "UPDATE notes SET content = ?1, embedding = ?2 WHERE id = ?3",
            params![content, embedding, id],
        )
        .map_err(|error| format!("Nao foi possivel atualizar a nota: {error}"))?;
    Ok(())
}

#[tauri::command]
fn delete_all_notes(app: tauri::AppHandle) -> Result<(), String> {
    let connection = open_database(&app)?;
    connection
        .execute("DELETE FROM notes", [])
        .map_err(|error| format!("Nao foi possivel excluir todas as notas: {error}"))?;
    connection
        .execute("DELETE FROM embedding_cache", [])
        .map_err(|error| format!("Nao foi possivel limpar cache: {error}"))?;
    Ok(())
}



pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            save_note,
            list_notes,
            delete_note,
            update_note,
            delete_all_notes,
            get_cached_embedding,
            save_cached_embedding,
            generate_embedding,
            summarize_notes,
            generate_answer
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo Tauri");
}
