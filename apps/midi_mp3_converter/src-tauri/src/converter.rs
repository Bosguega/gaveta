use crate::encoder;
use crate::midi;
use crate::queue::{self, QueueItem, QueueStatus, Summary, SummaryError};
use crate::settings::{ExistingPolicy, Settings};
use crate::state::AppState;
use crate::synth;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub id: u64,
    pub index: usize,
    pub total: usize,
    pub name: String,
    pub phase: String,
    pub item_percent: f32,
    pub batch_percent: f32,
    pub output_path: Option<String>,
    pub status: QueueStatus,
    pub error: Option<String>,
    pub duration_ms: Option<i64>,
}

struct EmitterContext {
    app: AppHandle,
    id: u64,
    index: usize,
    total: usize,
    name: String,
    output: String,
    duration_ms: i64,
}

impl EmitterContext {
    fn progress(&self, phase: &'static str) -> Arc<dyn Fn(f32) + Send + Sync> {
        let app = self.app.clone();
        let name = self.name.clone();
        let output = self.output.clone();
        let id = self.id;
        let index = self.index;
        let total = self.total;
        let duration_ms = self.duration_ms;
        Arc::new(move |ratio: f32| {
            let ratio = ratio.clamp(0.0, 1.0);
            let event = ProgressEvent {
                id,
                index: index + 1,
                total,
                name: name.clone(),
                phase: phase.to_string(),
                item_percent: ratio * 100.0,
                batch_percent: (index as f32 + ratio) / total.max(1) as f32 * 100.0,
                output_path: Some(output.clone()),
                status: QueueStatus::Running,
                error: None,
                duration_ms: Some(duration_ms),
            };
            let _ = app.emit("conversion-progress", event);
        })
    }
}

enum Outcome {
    Done(String),
    Skipped(String),
}

fn mark(state: &AppState, id: u64, mutate: impl FnOnce(&mut QueueItem)) {
    if let Ok(mut queue) = state.queue.lock() {
        if let Some(item) = queue.iter_mut().find(|entry| entry.id == id) {
            mutate(item);
        }
    }
}

fn phase_label(status: QueueStatus) -> &'static str {
    match status {
        QueueStatus::Done => "concluido",
        QueueStatus::Skipped => "ignorado",
        QueueStatus::Error => "erro",
        QueueStatus::Canceled => "cancelado",
        QueueStatus::Running => "convertendo",
        QueueStatus::Pending => "aguardando",
    }
}

fn emit_state(app: &AppHandle, state: &AppState, id: u64, index: usize, total: usize) {
    let snapshot = match state.queue.lock() {
        Ok(queue) => queue.iter().find(|entry| entry.id == id).cloned(),
        Err(_) => None,
    };
    if let Some(item) = snapshot {
        let ratio = if item.status == QueueStatus::Done { 1.0 } else { 0.0 };
        let event = ProgressEvent {
            id: item.id,
            index: index + 1,
            total,
            name: item.name.clone(),
            phase: phase_label(item.status).to_string(),
            item_percent: ratio * 100.0,
            batch_percent: (index as f32 + ratio) / total.max(1) as f32 * 100.0,
            output_path: item.output_path.clone(),
            status: item.status,
            error: item.error.clone(),
            duration_ms: item.duration_ms,
        };
        let _ = app.emit("conversion-progress", event);
    }
}

async fn convert_one(
    app: &AppHandle,
    state: &AppState,
    item: &QueueItem,
    settings: &Settings,
    index: usize,
    total: usize,
) -> Result<Outcome, String> {
    let midi_path = PathBuf::from(&item.path);
    let info = midi::analyze(&midi_path)?;
    let duration_ms = info.duration_ms.max(0);
    let output_dir = settings.output_dir.as_ref().map(PathBuf::from);
    let target = queue::target_path(
        &midi_path,
        output_dir.as_deref(),
        item.relative_dir.as_deref(),
        settings.existing,
    );
    let output = target.to_string_lossy().into_owned();

    if settings.existing == ExistingPolicy::Skip && target.exists() {
        return Ok(Outcome::Skipped(output));
    }

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|err| format!("não foi possível localizar a pasta de cache: {err}"))?;
    std::fs::create_dir_all(&cache_dir)
        .map_err(|err| format!("não foi possível criar a pasta de cache: {err}"))?;
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|err| format!("não foi possível criar a pasta de saída: {err}"))?;
    }

    let wav = cache_dir.join(format!("render-{}.wav", item.id));
    let part = target.with_extension("mp3.part");
    let emitter = EmitterContext {
        app: app.clone(),
        id: item.id,
        index,
        total,
        name: item.name.clone(),
        output: output.clone(),
        duration_ms,
    };
    let title = midi_path
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_else(|| item.name.clone());

    let result = async {
        synth::render_to_wav(
            app,
            state,
            &midi_path,
            &wav,
            settings,
            duration_ms,
            emitter.progress("sintetizando"),
        )
        .await?;
        encoder::encode_mp3(
            app,
            state,
            &wav,
            &part,
            settings.bitrate_kbps,
            duration_ms as f64 / 1000.0,
            &title,
            settings.write_id3,
            emitter.progress("codificando"),
        )
        .await?;
        if target.exists() && settings.existing == ExistingPolicy::Overwrite {
            let _ = std::fs::remove_file(&target);
        }
        std::fs::rename(&part, &target).map_err(|err| format!("não foi possível gravar o MP3: {err}"))?;
        Ok::<(), String>(())
    }
    .await;

    let _ = std::fs::remove_file(&wav);
    if result.is_err() {
        let _ = std::fs::remove_file(&part);
    }
    result?;
    Ok(Outcome::Done(output))
}

pub async fn run_batch(app: AppHandle) {
    let state = app.state::<AppState>();
    let settings = match state.settings.lock() {
        Ok(guard) => guard.clone(),
        Err(_) => Settings::default(),
    };
    state.cancel.store(false, Ordering::Relaxed);
    state.running.store(true, Ordering::Relaxed);

    let pending: Vec<u64> = match state.queue.lock() {
        Ok(queue) => queue
            .iter()
            .filter(|item| !matches!(item.status, QueueStatus::Done | QueueStatus::Skipped))
            .map(|item| item.id)
            .collect(),
        Err(_) => Vec::new(),
    };

    let total = pending.len();
    let started = std::time::Instant::now();
    let mut summary = Summary {
        done: 0,
        skipped: 0,
        failed: 0,
        canceled: false,
        elapsed_ms: 0,
        errors: Vec::new(),
    };

    for (index, id) in pending.iter().enumerate() {
        if state.is_canceled() {
            summary.canceled = true;
            mark(&state, *id, |item| {
                item.status = QueueStatus::Canceled;
            });
            emit_state(&app, &state, *id, index, total);
            break;
        }

        let current = match state.queue.lock() {
            Ok(queue) => queue.iter().find(|item| item.id == *id).cloned(),
            Err(_) => None,
        };
        let current = match current {
            Some(item) => item,
            None => continue,
        };

        mark(&state, *id, |item| {
            item.status = QueueStatus::Running;
            item.error = None;
        });
        emit_state(&app, &state, *id, index, total);

        match convert_one(&app, &state, &current, &settings, index, total).await {
            Ok(Outcome::Done(path)) => {
                summary.done += 1;
                mark(&state, *id, |item| {
                    item.status = QueueStatus::Done;
                    item.output_path = Some(path.clone());
                    item.error = None;
                });
            }
            Ok(Outcome::Skipped(path)) => {
                summary.skipped += 1;
                mark(&state, *id, |item| {
                    item.status = QueueStatus::Skipped;
                    item.output_path = Some(path.clone());
                    item.error = None;
                });
            }
            Err(message) => {
                if state.is_canceled() {
                    summary.canceled = true;
                    mark(&state, *id, |item| {
                        item.status = QueueStatus::Canceled;
                        item.error = None;
                    });
                    emit_state(&app, &state, *id, index, total);
                    break;
                }
                summary.failed += 1;
                summary.errors.push(SummaryError {
                    name: current.name.clone(),
                    message: message.clone(),
                });
                mark(&state, *id, |item| {
                    item.status = QueueStatus::Error;
                    item.error = Some(message.clone());
                });
            }
        }
        emit_state(&app, &state, *id, index, total);
    }

    summary.elapsed_ms = started.elapsed().as_millis() as u64;
    state.running.store(false, Ordering::Relaxed);
    let _ = app.emit("conversion-done", summary);
}