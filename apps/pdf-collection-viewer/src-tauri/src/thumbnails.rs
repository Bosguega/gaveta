use crate::embroidery::EmbroideryStats;
use crate::file_types::FileType;
use image::codecs::webp::WebPEncoder;
use image::imageops::FilterType;
use image::ImageEncoder;
use pdfium_render::prelude::*;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

const THUMBNAIL_WIDTH: i32 = 300;

/// Generates a cache key (sha256 of the full path) + ".webp".
pub fn thumbnail_key(full_path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(full_path.as_bytes());
    let digest = hasher.finalize();
    format!("{digest:x}.webp")
}

/// Output of a thumbnail rendering attempt.
///
/// `page_count` is currently only populated for PDFs; other file types
/// leave it as `None` until their respective renderers are implemented.
#[derive(Debug)]
pub struct ThumbnailOutput {
    pub thumbnail_key: String,
    pub page_count: Option<i64>,
    /// Embroidery metadata extracted while rendering (stitches, colors, size).
    pub embroidery_stats: Option<EmbroideryStats>,
}

/// Dispatches thumbnail generation to the appropriate renderer based on
/// the item's `file_type`.
///
/// This is the single entry point the scan pipeline calls. Adding support
/// for a new file type is a matter of adding a new arm to the `match` below.
pub fn render_thumbnail(
    path: &str,
    file_type: &str,
    cache_dir: &Path,
    resource_dir: &Path,
) -> Result<ThumbnailOutput, String> {
    let key = thumbnail_key(path);
    let ft = FileType::from_str(file_type);

    match ft {
        FileType::Pdf => match generate_pdf_thumbnail(path, cache_dir, resource_dir) {
            Ok(page_count) => Ok(ThumbnailOutput {
                thumbnail_key: key,
                page_count,
                embroidery_stats: None,
            }),
            Err(e) => Err(e),
        },
        FileType::Embroidery => match crate::embroidery::render_embroidery_thumbnail(path, cache_dir) {
            Ok(stats) => Ok(ThumbnailOutput {
                thumbnail_key: key,
                page_count: None,
                embroidery_stats: Some(stats),
            }),
            Err(e) => Err(e),
        },
        FileType::Image => match generate_image_thumbnail(path, cache_dir) {
            Ok(_) => Ok(ThumbnailOutput {
                thumbnail_key: key,
                page_count: None,
                embroidery_stats: None,
            }),
            Err(e) => Err(e),
        },
        FileType::Unknown => Err(format!("Tipo de arquivo sem renderizador: {file_type}")),
    }
}

/// Renders the first page of a PDF to a WebP thumbnail in the cache directory.
/// Returns the page count on success.
fn generate_pdf_thumbnail(
    pdf_path: &str,
    cache_dir: &Path,
    resource_dir: &Path,
) -> Result<Option<i64>, String> {
    let key = thumbnail_key(pdf_path);
    let output_path = cache_dir.join(&key);

    // Bind explicitly so a missing runtime library becomes a recoverable PDF
    // thumbnail error instead of crashing the application.
    let executable_dir = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf));
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
    let pdfium = Pdfium::new(bindings);
    let document = pdfium
        .load_pdf_from_file(pdf_path, None)
        .map_err(|e| format!("Falha ao abrir PDF: {e}"))?;

    let page_count = document.pages().len() as i64;

    let page = document
        .pages()
        .get(0)
        .map_err(|e| format!("Falha ao obter primeira página: {e}"))?;

    let bitmap = page
        .render_with_config(&PdfRenderConfig::new().set_target_width(THUMBNAIL_WIDTH))
        .map_err(|e| format!("Falha ao renderizar página: {e}"))?;

    let width = bitmap.width() as u32;
    let _height = bitmap.height() as u32;
    let bytes = bitmap.as_raw_bytes();

    // The bitmap from pdfium is already in RGBA format.
    // Copy channels directly without swapping R and B.
    let mut rgba = Vec::with_capacity(bytes.len());
    for chunk in bytes.chunks_exact(4) {
        rgba.push(chunk[0]); // R
        rgba.push(chunk[1]); // G
        rgba.push(chunk[2]); // B
        rgba.push(chunk[3]); // A
    }

    let actual_width = width;
    let actual_height = rgba.len() as u32 / (actual_width * 4);

    let img = image::RgbaImage::from_raw(actual_width, actual_height, rgba)
        .ok_or_else(|| "Falha ao criar imagem".to_string())?;

    // Encode as WebP (lossless)
    let mut encoded = Vec::new();
    let encoder = WebPEncoder::new_lossless(&mut encoded);
    encoder
        .write_image(&img, actual_width, actual_height, image::ExtendedColorType::Rgba8)
        .map_err(|e| format!("Falha ao codificar WebP: {e}"))?;

    fs::write(&output_path, &encoded)
        .map_err(|e| format!("Falha ao salvar thumbnail: {e}"))?;

    Ok(Some(page_count))
}

/// Renders an image file (png/jpg/bmp/gif/webp/…) to a WebP thumbnail in the
/// cache directory, preserving aspect ratio so the longest side is
/// `THUMBNAIL_WIDTH`. Returns `None` for `page_count` (images have no pages).
fn generate_image_thumbnail(
    image_path: &str,
    cache_dir: &Path,
) -> Result<(), String> {
    let key = thumbnail_key(image_path);
    let output_path = cache_dir.join(&key);

    let img = image::open(image_path).map_err(|e| format!("Falha ao abrir imagem: {e}"))?;

    // Scale down preserving aspect ratio; keep the original size when smaller
    // than the target width.
    let (w, h) = (img.width(), img.height());
    let scale = THUMBNAIL_WIDTH as f32 / w.max(h) as f32;
    let (tw, th) = if scale < 1.0 {
        ((w as f32 * scale) as u32, (h as f32 * scale) as u32)
    } else {
        (w, h)
    };

    let resized = img.resize(tw, th, FilterType::Lanczos3);
    let rgba = resized.to_rgba8();

    let actual_width = rgba.width();
    let actual_height = rgba.height();

    let mut encoded = Vec::new();
    let encoder = WebPEncoder::new_lossless(&mut encoded);
    encoder
        .write_image(&rgba, actual_width, actual_height, image::ExtendedColorType::Rgba8)
        .map_err(|e| format!("Falha ao codificar WebP: {e}"))?;

    fs::write(&output_path, &encoded)
        .map_err(|e| format!("Falha ao salvar thumbnail: {e}"))?;

    Ok(())
}

/// Checks if a thumbnail file exists in the cache.
pub fn thumbnail_exists(cache_dir: &Path, key: &str) -> bool {
    cache_dir.join(key).exists()
}

/// Returns the full path to a cached thumbnail.
pub fn thumbnail_path(cache_dir: &Path, key: &str) -> PathBuf {
    cache_dir.join(key)
}
