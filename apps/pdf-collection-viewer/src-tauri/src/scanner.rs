use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use crate::file_types::FileType;

/// A file discovered by the scanner during a directory walk.
///
/// Formerly named `ScannedPdf`, this struct is generic — `file_type`
/// records what kind of content the file is so that downstream
/// processing (thumbnail generation, metadata extraction) can dispatch
/// appropriately.
#[derive(Debug, Clone)]
pub struct ScannedItem {
    pub path: String,
    pub filename: String,
    pub size: i64,
    pub modified_at: String,
    pub file_type: String,
}

/// Scans a directory for files whose extension appears in `extensions`,
/// optionally including subfolders.
///
/// `extensions` is passed explicitly so callers control which file types
/// are discoverable. For now only `["pdf"]` is passed, but the scanner
/// itself is agnostic to content type.
///
/// Returns the list of items found, whether the root path was unavailable
/// (missing/mis-typed folder), and the list of directories that raised an
/// access error mid-walk (e.g. permission denied).
///
/// Errors encountered while descending a subtree are collected rather than
/// silently dropped. Callers must preserve items living under an errored
/// directory so that a transient access failure does not wipe otherwise
/// healthy records (including their `is_favorite` flag).
pub fn scan_items(
    path: &str,
    include_subfolders: bool,
    extensions: &[String],
) -> (Vec<ScannedItem>, bool, Vec<String>) {
    let root = Path::new(path);

    if !root.exists() || !root.is_dir() {
        return (Vec::new(), true, Vec::new());
    }

    let mut items = Vec::new();
    let mut errored_dirs: Vec<String> = Vec::new();

    let walker = if include_subfolders {
        WalkDir::new(root).min_depth(1)
    } else {
        WalkDir::new(root).min_depth(1).max_depth(1)
    };

    for entry in walker {
        let entry = match entry {
            Ok(entry) => entry,
            Err(err) => {
                let errored = err
                    .path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| path.to_string());
                if !errored_dirs.contains(&errored) {
                    errored_dirs.push(errored);
                }
                continue;
            }
        };

        if !entry.file_type().is_file() {
            continue;
        }

        let ext = entry
            .path()
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase());

        let Some(ext_str) = ext else {
            continue;
        };

        // Check if this extension is in the supported list for this scan.
        if !extensions.iter().any(|e| e.eq_ignore_ascii_case(&ext_str)) {
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

        let file_type = FileType::from_extension(&ext_str);

        items.push(ScannedItem {
            path: entry.path().to_string_lossy().to_string(),
            filename: entry.file_name().to_string_lossy().to_string(),
            size: metadata.len() as i64,
            modified_at: modified,
            file_type: file_type.as_str().to_string(),
        });
    }

    (items, false, errored_dirs)
}

/// Removes orphaned cache files that no longer correspond to any item in the database.
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
