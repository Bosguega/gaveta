use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub fn is_midi(path: &Path) -> bool {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => {
            let lower = ext.to_ascii_lowercase();
            lower == "mid" || lower == "midi"
        }
        None => false,
    }
}

pub fn midi_files(root: &Path, include_subfolders: bool) -> Result<Vec<PathBuf>, String> {
    if !root.is_dir() {
        return Err(format!("Pasta não encontrada: {}", root.display()));
    }
    let depth = if include_subfolders { usize::MAX } else { 1 };
    let mut files: Vec<PathBuf> = Vec::new();
    for entry in WalkDir::new(root).max_depth(depth).follow_links(false) {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if entry.file_type().is_file() && is_midi(entry.path()) {
            files.push(entry.path().to_path_buf());
        }
    }
    files.sort();
    Ok(files)
}