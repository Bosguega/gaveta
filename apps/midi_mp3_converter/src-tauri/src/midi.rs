use midly::{MetaMessage, MidiMessage, Smf, Timing, TrackEventKind};
use std::path::Path;

pub struct MidiInfo {
    pub duration_ms: i64,
    pub note_count: usize,
    pub title: Option<String>,
}

pub fn analyze(path: &Path) -> Result<MidiInfo, String> {
    let data = std::fs::read(path).map_err(|err| format!("não foi possível ler o arquivo: {err}"))?;
    let smf = Smf::parse(&data).map_err(|err| format!("MIDI inválido: {err}"))?;

    let ticks_per_beat = match smf.header.timing {
        Timing::Metrical(value) => value.as_int() as f64,
        Timing::Timecode(_, _) => 0.0,
    };

    let mut tempos: Vec<(u64, u32)> = Vec::new();
    let mut note_count = 0usize;
    let mut last_tick = 0u64;
    let mut title: Option<String> = None;

    for track in &smf.tracks {
        let mut tick = 0u64;
        for event in track {
            tick += event.delta.as_int() as u64;
            match event.kind {
                TrackEventKind::Meta(MetaMessage::TrackName(bytes)) if title.is_none() => {
                    let text = String::from_utf8_lossy(bytes).trim().to_string();
                    if !text.is_empty() {
                        title = Some(text);
                    }
                }
                TrackEventKind::Meta(MetaMessage::Tempo(tempo)) => tempos.push((tick, tempo.as_int())),
                TrackEventKind::Midi {
                    message: MidiMessage::NoteOn { vel, .. },
                    ..
                } => {
                    if vel.as_int() > 0 {
                        note_count += 1;
                    }
                }
                _ => {}
            }
        }
        last_tick = last_tick.max(tick);
    }

    if note_count == 0 {
        return Err("MIDI sem notas".to_string());
    }

    let seconds = match smf.header.timing {
        Timing::Timecode(fps, subframe) => {
            let per_second = fps.as_f32() as f64 * subframe as f64;
            if per_second > 0.0 {
                last_tick as f64 / per_second
            } else {
                0.0
            }
        }
        Timing::Metrical(_) => {
            if ticks_per_beat <= 0.0 {
                0.0
            } else {
                tempos.sort_by_key(|entry| entry.0);
                let mut total = 0.0f64;
                let mut cursor = 0u64;
                let mut us_per_quarter = 500_000u32;
                for (tick, tempo) in &tempos {
                    if *tick > cursor {
                        total += (tick - cursor) as f64 * (us_per_quarter as f64 / 1_000_000.0) / ticks_per_beat;
                        cursor = *tick;
                    }
                    us_per_quarter = *tempo;
                }
                total += (last_tick - cursor) as f64 * (us_per_quarter as f64 / 1_000_000.0) / ticks_per_beat;
                total
            }
        }
    };

    Ok(MidiInfo {
        duration_ms: (seconds * 1000.0).round() as i64,
        note_count,
        title,
    })
}