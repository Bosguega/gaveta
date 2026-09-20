//! Native PDF text extraction for the content search index.
//!
//! Stage 1 of the content pipeline: for every page, pull the text layer out
//! with PDFium and store it per page in SQLite (FTS5). Pages with no
//! extractable text (image-only) are recorded with an empty text field so the
//! upcoming visual/OCR pipeline can fill them in later.

use pdfium_render::prelude::*;
use std::path::{Path, PathBuf};

/// Bumped whenever the extraction logic changes, so existing indexes get
/// re-indexed transparently (see `file_index.extractor_version`).
pub const EXTRACTOR_VERSION: i64 = 1;

/// Pages whose extracted text is shorter than this are treated as
/// image-only pages (empty text) until the visual pipeline exists.
const NATIVE_MIN_CHARS: usize = 30;

/// One extracted page ready to be persisted.
pub struct ExtractedPage {
    pub page_number: i64,
    /// Currently always "native"; reserved for the visual pipeline ("vision").
    pub method: &'static str,
    pub text: String,
}

/// Outcome of extracting a whole PDF.
pub struct ExtractionOutput {
    pub pages: Vec<ExtractedPage>,
}

/// Binds to the PDFium runtime library using the same candidate order as the
/// thumbnail pipeline (resource dir, then executable dir, then system).
fn bind_pdfium(resource_dir: &Path) -> Result<Pdfium, String> {
    let executable_dir = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(PathBuf::from));
    let resource_candidates = [resource_dir.to_path_buf(), resource_dir.join("resources")];

    let bindings = resource_candidates
        .iter()
        .find_map(|dir| Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(dir)).ok())
        .or_else(|| executable_dir.as_ref().and_then(|dir| {
            Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(dir)).ok()
        }))
        .map(Ok)
        .unwrap_or_else(Pdfium::bind_to_system_library)
        .map_err(|e| format!("Não foi possível carregar o Pdfium: {e}"))?;

    Ok(Pdfium::new(bindings))
}

/// Collapses whitespace runs into single spaces so FTS snippets stay readable
/// even when the PDF text layer has odd line breaks.
fn normalize_text(raw: &str) -> String {
    raw.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Extracts the text layer of every page in the PDF.
pub fn extract_pdf_text(pdf_path: &str, resource_dir: &Path) -> Result<ExtractionOutput, String> {
    let pdfium = bind_pdfium(resource_dir)?;
    let document = pdfium
        .load_pdf_from_file(pdf_path, None)
        .map_err(|e| format!("Falha ao abrir PDF: {e}"))?;

    let mut pages = Vec::new();
    for (index, page) in document.pages().iter().enumerate() {
        let page_number = (index + 1) as i64;
        let text = page
            .text()
            .map(|text| normalize_text(&text.all()))
            .unwrap_or_default();

        let usable = text.chars().count() >= NATIVE_MIN_CHARS;
        pages.push(ExtractedPage {
            page_number,
            method: "native",
            text: if usable { text } else { String::new() },
        });
    }

    Ok(ExtractionOutput { pages })
}
