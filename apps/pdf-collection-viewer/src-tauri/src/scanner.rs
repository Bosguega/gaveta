use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct ScannedPdf {
    pub path: String,
    pub filename: String,
    pub size: i64,
    pub modified_at: String,
}

/// Scans a directory for PDF files, optionally including subfolders.
/// Returns the list of PDFs found and whether the path was unavailable.
pub fn scan_directory(path: &str, include_subfolders: bool) -> (Vec<ScannedPdf>, bool) {
    let root = Path::new(path);

    if !root.exists() || !root.is_dir() {
        return (Vec::new(), true);
    }

    let mut pdfs = Vec::new();

    let walker = if include_subfolders {
        WalkDir::new(root).min_depth(1)
    } else {
        WalkDir::new(root).min_depth(1).max_depth(1)
    };

    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }

        let ext = entry
            .path()
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase());

        if ext.as_deref() != Some("pdf") {
            continue;
        }

        let Ok(metadata) = entry.metadata() else {
            continue;
        };

        let modified = metadata
            .modified()
            .ok()
            .map(|t| {
                let secs = t
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                secs.to_string()
            })
            .unwrap_or_default();

        pdfs.push(ScannedPdf {
            path: entry.path().to_string_lossy().to_string(),
            filename: entry.file_name().to_string_lossy().to_string(),
            size: metadata.len() as i64,
            modified_at: modified,
        });
    }

    (pdfs, false)
}

/// Removes orphaned cache files that no longer correspond to any PDF in the database.
pub fn cleanup_orphan_cache(cache_dir: &Path, known_keys: &[String]) {
    let Ok(entries) = fs::read_dir(cache_dir) else {
        return;
    };

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".webp") && !known_keys.contains(&name) {
            let _ = fs::remove_file(entry.path());
        }
    }
}