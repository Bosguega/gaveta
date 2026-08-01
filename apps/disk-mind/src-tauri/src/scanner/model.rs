use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawEntry {
    pub path: PathBuf,
    pub name: String,
    pub size: u64,
    pub modified: i64,
    pub extension: Option<String>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub parent_id: Option<i64>,
}

impl RawEntry {
    pub fn from_path(path: &Path, parent_id: Option<i64>) -> Self {
        let metadata = match std::fs::metadata(path) {
            Ok(m) => m,
            Err(_) => return Self::placeholder(path, parent_id),
        };

        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string())
            .unwrap_or_default();

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e.to_lowercase()));

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        Self {
            path: path.to_path_buf(),
            name,
            size: metadata.len(),
            modified,
            extension,
            is_hidden: is_hidden(path),
            is_symlink: metadata.file_type().is_symlink(),
            parent_id,
        }
    }

    fn placeholder(path: &Path, parent_id: Option<i64>) -> Self {
        Self {
            path: path.to_path_buf(),
            name: path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string())
                .unwrap_or_default(),
            size: 0,
            modified: 0,
            extension: None,
            is_hidden: false,
            is_symlink: false,
            parent_id,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub id: Option<i64>,
    pub parent_id: Option<i64>,
    pub path: PathBuf,
    pub name: String,
    pub size: u64,
    pub file_count: i32,
    pub depth: i32,
}

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanStats {
    pub total_files: u64,
    pub total_dirs: u64,
    pub total_size: u64,
    pub errors: Vec<String>,
}