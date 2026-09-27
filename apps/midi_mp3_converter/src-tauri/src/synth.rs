use crate::paths;
use crate::settings::Settings;
use crate::state::AppState;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

pub async fn render_to_wav(
    app: &AppHandle,
    state: &AppState,
    midi: &Path,
    wav: &Path,
    settings: &Settings,
    duration_ms: i64,
    on_progress: Arc<dyn Fn(f32) + Send + Sync>,
) -> Result<(), String> {
    let tool = paths::tool(app, "fluidsynth.exe")?;
    let soundfont = paths::soundfont(app, settings.soundfont.as_deref())?;

    if let Some(parent) = wav.parent() {
        std::fs::create_dir_all(parent).map_err(|err| format!("não foi possível criar a pasta temporária: {err}"))?;
    }
    let _ = std::fs::remove_file(wav);

    let args: Vec<String> = vec![
        "-F".into(),
        wav.to_string_lossy().into_owned(),
        "-r".into(),
        settings.sample_rate.to_string(),
        "-g".into(),
        format!("{:.2}", settings.gain),
        "-o".into(),
        "synth.limiter.active=1".into(),
        "-o".into(),
        "audio.file.type=wav".into(),
        "-n".into(),
        "-i".into(),
        "-q".into(),
        soundfont.to_string_lossy().into_owned(),
        midi.to_string_lossy().into_owned(),
    ];

    let (mut rx, child) = app
        .shell()
        .command(tool.to_string_lossy().to_string())
        .args(args)
        .spawn()
        .map_err(|err| format!("falha ao iniciar o FluidSynth: {err}"))?;

    if let Ok(mut guard) = state.child.lock() {
        *guard = Some(child);
    }

    let expected_bytes = (duration_ms.max(0) as f64 / 1000.0) * settings.sample_rate as f64 * 4.0 + 44.0;
    let mut ticker = tokio::time::interval(Duration::from_millis(150));
    let mut exit_code: Option<i32> = None;
    let mut messages: Vec<String> = Vec::new();
    let mut spawn_error: Option<String> = None;

    loop {
        tokio::select! {
            incoming = rx.recv() => match incoming {
                Some(CommandEvent::Terminated(payload)) => {
                    exit_code = payload.code;
                    break;
                }
                Some(CommandEvent::Stderr(line)) => {
                    messages.push(String::from_utf8_lossy(&line).trim().to_string());
                }
                Some(CommandEvent::Error(message)) => {
                    spawn_error = Some(message);
                }
                Some(_) => {}
                None => break,
            },
            _ = ticker.tick() => {
                if let Ok(metadata) = std::fs::metadata(wav) {
                    let ratio = (metadata.len() as f64 / expected_bytes).clamp(0.0, 1.0);
                    on_progress(ratio as f32);
                }
            }
        }
    }

    if let Ok(mut guard) = state.child.lock() {
        *guard = None;
    }

    if let Some(message) = spawn_error {
        return Err(message);
    }
    if state.is_canceled() {
        let _ = std::fs::remove_file(wav);
        return Err("cancelado".to_string());
    }
    match exit_code {
        Some(0) => {
            on_progress(1.0);
            Ok(())
        }
        Some(code) => Err(describe(&messages, &format!("FluidSynth terminou com código {code}"))),
        None => Err(describe(&messages, "FluidSynth foi encerrado inesperadamente")),
    }
}

fn describe(messages: &[String], fallback: &str) -> String {
    let relevant: Vec<&str> = messages
        .iter()
        .map(|line| line.as_str())
        .filter(|line| !line.is_empty())
        .filter(|line| !line.starts_with("FluidSynth runtime version"))
        .filter(|line| !line.starts_with("Copyright"))
        .filter(|line| !line.starts_with("Distributed under"))
        .filter(|line| !line.starts_with("SoundFont(R)"))
        .filter(|line| !line.starts_with("Rendering audio to file"))
        .collect();
    if relevant.is_empty() {
        fallback.to_string()
    } else {
        format!("{fallback}: {}", relevant.join(" | "))
    }
}