//! LLM-based tagging via a local llama.cpp server (OpenAI-compatible API).
//!
//! Kept intentionally independent from `@bosguega/ai-core`: this is a
//! project-local integration with a llama-server instance running a
//! multimodal model (e.g. Ternary-Bonsai-27B + mmproj).

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use pdfium_render::prelude::*;
use serde_json::json;
use std::path::Path;

pub const DEFAULT_BASE_URL: &str = "http://127.0.0.1:8080";
pub const DEFAULT_MODEL: &str = "ternary-bonsai-27b";
pub const DEFAULT_PAGES: i64 = 4;
pub const DEFAULT_MAX_TOKENS: i64 = 512;

pub const DEFAULT_SYSTEM_PROMPT: &str = concat!(
    "You are an assistant that generates search tags for documents (PDFs) based on the image of the first page.\n\n",
    "MANDATORY RULES:\n",
    "- Reply ONLY with valid JSON in the format {\"tags\": [\"tag1\", \"tag2\"]}, with no text before or after.\n",
    "- ALL tags must be in English, lowercase, short (1 to 3 words), no full sentences.\n",
    "- Use consistent, natural English terms that people would actually type when searching.\n",
    "- Maximum 10 tags, but do NOT pad the list to reach 10. Use only as many tags as the images genuinely justify. 4 or 5 strong tags are better than 10 weak ones.\n",
    "- No duplicate tags (check for both exact and near-duplicate meanings).\n",
    "- The attached images show different pages of the SAME document. Generate ONE unified set of tags describing the document as a whole; never create tags per page.\n\n",
    "WHAT A TAG MUST BE (in approximate priority order - stop when the image does not justify more):\n",
    "1. The main object or character of the image.\n",
    "2. The technique depicted (if clearly identifiable).\n",
    "3. The type of item or garment, when identifiable.\n",
    "4. Theme, character, or animal depicted.\n",
    "5. Brand or author name, only if genuinely legible in the image.\n",
    "6. Other characteristics ONLY if they carry real search value.\n\n",
    "WHAT TO AVOID:\n",
    "- Do NOT turn incidental visual details into tags just because they are visible (e.g. a color like \"blue\", or a generic object like \"hat\" that is not the main subject).\n",
    "- Do NOT infer audience, purpose or context that is not clearly identified (e.g. \"baby\", \"children\", \"gift\" just because of how the subject looks).\n",
    "- Do NOT invent that the document is a \"pattern\", \"tutorial\" or \"instructions\" merely because it looks like a craft work. Only use such tags when explicitly evident from the page.\n",
    "- Do NOT use generic category tags like \"craft\", \"art\", \"design\", \"image\", \"document\", \"pdf\" when more specific tags already represent the object or technique.\n",
    "- Do NOT include the file name as a tag.\n",
    "- Do NOT create tags for the file format or page layout."
);

pub const DEFAULT_USER_PROMPT: &str =
    "Generate the search tags for this document (file: \"{filename}\"). The attached images are sample pages of the document (the first is page 1). All tags must be in English. Reply only with the JSON {\"tags\": [...]}";

/// Longest side of each rendered page image sent to the vision model.
const MAX_SIDE: u32 = 512;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TagSettings {
    pub base_url: String,
    pub model: String,
    pub pages: i64,
    pub max_tokens: i64,
    pub system_prompt: String,
    pub user_prompt: String,
}

impl Default for TagSettings {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_BASE_URL.to_string(),
            model: DEFAULT_MODEL.to_string(),
            pages: DEFAULT_PAGES,
            max_tokens: DEFAULT_MAX_TOKENS,
            system_prompt: DEFAULT_SYSTEM_PROMPT.to_string(),
            user_prompt: DEFAULT_USER_PROMPT.to_string(),
        }
    }
}

/// Renders an evenly spaced sample of pages of a PDF as JPEG bytes.
pub fn render_pdf_pages_jpeg(
    pdf_path: &str,
    wanted_pages: i64,
    resource_dir: &Path,
) -> Result<Vec<Vec<u8>>, String> {
    let executable_dir = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf));
    let resource_candidates = [resource_dir.to_path_buf(), resource_dir.join("resources")];
    let bindings = resource_candidates
        .iter()
        .find_map(|dir| Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(dir)).ok())
        .or_else(|| {
            executable_dir.as_ref().and_then(|dir| {
                Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(dir)).ok()
            })
        })
        .map(Ok)
        .unwrap_or_else(Pdfium::bind_to_system_library)
        .map_err(|e| format!("Biblioteca pdfium não encontrada: {e}"))?;

    let pdfium = Pdfium::new(bindings);
    let document = pdfium
        .load_pdf_from_file(pdf_path, None)
        .map_err(|e| format!("Falha ao abrir PDF: {e}"))?;

    let total = document.pages().len() as i64;
    let use_count = wanted_pages.clamp(1, 8).min(total).max(1);
    let mut indices: Vec<i64> = Vec::new();
    for i in 0..use_count {
        let idx = if use_count == 1 { 0 } else { (i * (total - 1)) / (use_count - 1) };
        indices.push(idx);
    }

    let mut images = Vec::new();
    for idx in indices {
        let page = document
            .pages()
            .get(idx as u16)
            .map_err(|e| format!("Falha ao obter página {idx}: {e}"))?;

        let config = PdfRenderConfig::new().set_target_width(MAX_SIDE as i32);
        let bitmap = page
            .render_with_config(&config)
            .map_err(|e| format!("Falha ao renderizar página {idx}: {e}"))?;

        let img = crate::thumbnails::bitmap_to_rgba_image(&bitmap)
            .map_err(|e| format!("{e} (página {idx})"))?;

        let mut jpeg = Vec::new();
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 80);
        // JPEG does not support RGBA: flatten to RGB (alpha over white).
        let rgb = image::DynamicImage::ImageRgba8(img).to_rgb8();
        rgb.write_with_encoder(encoder)
            .map_err(|e| format!("Falha ao codificar JPEG: {e}"))?;
        images.push(jpeg);
    }

    Ok(images)
}

/// Calls the llama.cpp server and returns the tags parsed from the answer.
pub fn generate_tags(
    settings: &TagSettings,
    path: &str,
    filename: &str,
    resource_dir: &Path,
) -> Result<Vec<String>, String> {
    let jpeg_pages = render_pdf_pages_jpeg(path, settings.pages, resource_dir)?;
    let image_parts: Vec<serde_json::Value> = jpeg_pages
        .iter()
        .map(|bytes| {
            json!({
                "type": "image_url",
                "image_url": { "url": format!("data:image/jpeg;base64,{}", BASE64.encode(bytes)) }
            })
        })
        .collect();

    let user_text = if settings.user_prompt.contains("{filename}") {
        settings.user_prompt.replace("{filename}", filename)
    } else {
        format!("{} (file: \"{filename}\")", settings.user_prompt)
    };

    let mut content = vec![json!({ "type": "text", "text": user_text })];
    content.extend(image_parts);

    let body = json!({
        "model": &settings.model,
        "temperature": 0.2,
        "max_tokens": settings.max_tokens,
        "chat_template_kwargs": { "enable_thinking": false },
        "messages": [
            { "role": "system", "content": &settings.system_prompt },
            { "role": "user", "content": content },
        ],
    });

    let url = format!("{}/v1/chat/completions", settings.base_url.trim_end_matches('/'));
    let response = ureq::post(&url)
        .timeout(std::time::Duration::from_secs(180))
        .send_json(body)
        .map_err(|e| format!("Falha ao chamar o llama-server ({url}): {e}"))?;

    let data: serde_json::Value = response
        .into_json()
        .map_err(|e| format!("Resposta inválida do llama-server: {e}"))?;

    let content = data
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if content.trim().is_empty() {
        return Err("O modelo não retornou conteúdo em message.content.".to_string());
    }

    extract_tags(content)
}

/// Extracts a {"tags": [...]} object from a model output, tolerating fences
/// and prose around it.
fn extract_tags(text: &str) -> Result<Vec<String>, String> {
    let cleaned = text.replace("```json", "").replace("```", "");
    for candidate in balanced_objects(&cleaned) {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&candidate) {
            if let Some(tags) = parsed.get("tags").and_then(|v| v.as_array()) {
                let result: Vec<String> = tags
                    .iter()
                    .filter_map(|t| t.as_str().map(|s| s.to_string()))
                    .collect();
                if !result.is_empty() {
                    return Ok(result);
                }
            }
        }
    }
    let preview: String = text.chars().take(300).collect();
    Err(format!("Nenhum JSON de tags na resposta do modelo: {preview}"))
}

/// Returns all balanced {...} substrings of the text.
fn balanced_objects(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut result = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '{' {
            let mut depth = 0;
            let mut in_string = false;
            let mut escaped = false;
            let mut j = i;
            while j < chars.len() {
                let ch = chars[j];
                if in_string {
                    if escaped {
                        escaped = false;
                    } else if ch == '\\' {
                        escaped = true;
                    } else if ch == '"' {
                        in_string = false;
                    }
                } else if ch == '"' {
                    in_string = true;
                } else if ch == '{' {
                    depth += 1;
                } else if ch == '}' {
                    depth -= 1;
                    if depth == 0 {
                        result.push(chars[i..=j].iter().collect());
                        i = j;
                        break;
                    }
                }
                j += 1;
            }
        }
        i += 1;
    }
    result
}

/// Simple connectivity test against the llama-server.
pub fn test_connection(base_url: &str) -> Result<String, String> {
    let url = format!("{}/health", base_url.trim_end_matches('/'));
    let response = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .call()
        .map_err(|e| format!("Servidor inacessível em {url}: {e}"))?;
    let status = response.status();
    if status == 200 {
        Ok("Conectado ao llama-server.".to_string())
    } else {
        Err(format!("Servidor respondeu HTTP {status}"))
    }
}