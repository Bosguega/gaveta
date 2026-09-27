use crate::settings::ExistingPolicy;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum QueueStatus {
    Pending,
    Running,
    Done,
    Skipped,
    Error,
    Canceled,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueItem {
    pub id: u64,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub duration_ms: Option<i64>,
    pub status: QueueStatus,
    pub output_path: Option<String>,
    pub error: Option<String>,
    pub relative_dir: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryError {
    pub name: String,
    pub message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub done: usize,
    pub skipped: usize,
    pub failed: usize,
    pub canceled: bool,
    pub elapsed_ms: u64,
    pub errors: Vec<SummaryError>,
}

pub fn free_path(target: &Path) -> PathBuf {
    if !target.exists() {
        return target.to_path_buf();
    }
    let stem = target.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let dir = target.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("."));
    for index in 1..1000 {
        let candidate = dir.join(format!("{stem} ({index}).mp3"));
        if !candidate.exists() {
            return candidate;
        }
    }
    target.to_path_buf()
}

pub fn target_path(
    midi: &Path,
    output_dir: Option<&Path>,
    relative_dir: Option<&str>,
    policy: ExistingPolicy,
) -> PathBuf {
    let stem = midi
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "saida".to_string());
    let base = match output_dir {
        Some(dir) => match relative_dir {
            Some(rel) if !rel.is_empty() => dir.join(rel),
            _ => dir.to_path_buf(),
        },
        None => midi.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from(".")),
    };
    let candidate = base.join(format!("{stem}.mp3"));
    if policy == ExistingPolicy::Copy {
        free_path(&candidate)
    } else {
        candidate
    }
}