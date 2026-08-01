use crate::scanner::model::RawEntry;
use walkdir::WalkDir;
use std::path::PathBuf;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ScanProgressEvent {
    pub current_path: PathBuf,
    pub files_scanned: usize,
    pub dirs_scanned: usize,
}

pub fn scan_directory_with_progress(path: &std::path::Path) -> (Vec<RawEntry>, Vec<ScanProgressEvent>) {
    let mut entries = Vec::new();
    let mut progress_events = Vec::new();
    let mut files_scanned = 0usize;
    let mut dirs_scanned = 0usize;

    for entry in WalkDir::new(path)
        .follow_links(false)
        .into_iter()
    {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        // Skip symlinks to avoid loops and unwanted targets
        if entry.file_type().is_symlink() {
            continue;
        }

        let path = entry.path();
        let parent_id = None;
        let raw = RawEntry::from_path(path, parent_id);
        
        if raw.path.is_dir() {
            dirs_scanned += 1;
        } else {
            files_scanned += 1;
        }

        entries.push(raw);

        // Emit progress every 100 entries
        if (files_scanned + dirs_scanned) % 100 == 0 {
            progress_events.push(ScanProgressEvent {
                current_path: path.to_path_buf(),
                files_scanned,
                dirs_scanned,
            });
        }
    }

    // Final progress event
    progress_events.push(ScanProgressEvent {
        current_path: path.to_path_buf(),
        files_scanned,
        dirs_scanned,
    });

    (entries, progress_events)
}
