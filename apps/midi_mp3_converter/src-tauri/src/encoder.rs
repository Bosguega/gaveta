use crate::paths;
use crate::state::AppState;
use std::path::Path;
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[allow(clippy::too_many_arguments)]
pub async fn encode_mp3(
    app: &AppHandle,
    state: &AppState,
    wav: &Path,
    part: &Path,
    bitrate_kbps: u32,
    duration_s: f64,
    title: &str,
    write_id3: bool,
    on_progress: Arc<dyn Fn(f32) + Send + Sync>,
) -> Result<(), String> {
    let tool = paths::tool(app, "ffmpeg.exe")?;
    let mut args: Vec<String> = vec![
        "-hide_banner".into(),
        "-nostdin".into(),
        "-loglevel".into(),
        "error".into(),
        "-nostats".into(),
        "-progress".into(),
        "pipe:1".into(),
        "-i".into(),
        wav.to_string_lossy().into_owned(),
        "-c:a".into(),
        "libmp3lame".into(),
        "-b:a".into(),
        format!("{bitrate_kbps}k"),
    ];
    if write_id3 {
        args.push("-id3v2_version".into());
        args.push("3".into());
        args.push("-metadata".into());
        args.push(format!("title={title}"));
        args.push("-metadata".into());
        args.push("comment=Convertido com MIDI MP3 Converter".into());
    }
    args.push("-f".into());
    args.push("mp3".into());
    args.push("-y".into());
    args.push(part.to_string_lossy().into_owned());

    let (mut rx, child) = app
        .shell()
        .command(tool.to_string_lossy().to_string())
        .args(args)
        .spawn()
        .map_err(|err| format!("falha ao iniciar o FFmpeg: {err}"))?;

    if let Ok(mut guard) = state.child.lock() {
        *guard = Some(child);
    }

    let mut exit_code: Option<i32> = None;
    let mut messages: Vec<String> = Vec::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
                break;
            }
            CommandEvent::Stdout(line) => {
                let text = String::from_utf8_lossy(&line).into_owned();
                for token in text.split_whitespace() {
                    let micros = token
                        .strip_prefix("out_time_us=")
                        .or_else(|| token.strip_prefix("out_time_ms="));
                    if let Some(value) = micros {
                        if let Ok(micros) = value.parse::<f64>() {
                            if duration_s > 0.0 {
                                on_progress((micros / 1_000_000.0 / duration_s).clamp(0.0, 1.0) as f32);
                            }
                        }
                    }
                }
            }
            CommandEvent::Stderr(line) => {
                messages.push(String::from_utf8_lossy(&line).trim().to_string());
            }
            CommandEvent::Error(message) => messages.push(message),
            _ => {}
        }
    }

    if let Ok(mut guard) = state.child.lock() {
        *guard = None;
    }

    if state.is_canceled() {
        let _ = std::fs::remove_file(part);
        return Err("cancelado".to_string());
    }

    match exit_code {
        Some(0) => {
            on_progress(1.0);
            Ok(())
        }
        Some(code) => Err(describe(&messages, &format!("FFmpeg terminou com código {code}"))),
        None => Err(describe(&messages, "FFmpeg foi encerrado inesperadamente")),
    }
}

fn describe(messages: &[String], fallback: &str) -> String {
    let relevant: Vec<&str> = messages
        .iter()
        .map(|line| line.as_str())
        .filter(|line| !line.is_empty())
        .collect();
    if relevant.is_empty() {
        fallback.to_string()
    } else {
        format!("{fallback}: {}", relevant.join(" | "))
    }
}