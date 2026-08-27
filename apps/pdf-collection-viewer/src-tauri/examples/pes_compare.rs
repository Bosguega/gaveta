use pdf_collection_viewer_lib::embroidery::pes::parse_pes;
use pdf_collection_viewer_lib::embroidery::{analyze_pattern, StitchType};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use walkdir::WalkDir;

#[derive(Deserialize)]
struct PyMetrics {
    plainStitchCount: i64,
    colorCount: i64,
    jumpCount: i64,
    colorChangeCount: i64,
    hasEnd: bool,
    bboxMm: BboxMm,
}

#[derive(Deserialize)]
struct BboxMm {
    width: f64,
    height: f64,
}

struct Diff {
    file: String,
    ok: bool,
    detail: String,
}

fn pyembroidery_metrics(path: &Path) -> Option<PyMetrics> {
    let script = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/pes_pyembroidery.py");
    let output = Command::new("python").arg(script).arg(path).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let line = String::from_utf8_lossy(&output.stdout).trim().lines().last()?.to_string();
    serde_json::from_str::<PyMetrics>(&line).ok()
}

fn compare_file(path: &Path) -> Diff {
    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        Err(e) => {
            return Diff {
                file: path.to_string_lossy().to_string(),
                ok: false,
                detail: format!("ler bytes: {e}"),
            };
        }
    };
    let pattern = match parse_pes(&bytes) {
        Ok(p) => p,
        Err(e) => {
            return Diff {
                file: path.to_string_lossy().to_string(),
                ok: false,
                detail: format!("parser rust: {e}"),
            };
        }
    };

    let Some(py) = pyembroidery_metrics(path) else {
        return Diff {
            file: path.to_string_lossy().to_string(),
            ok: false,
            detail: "pyembroidery indisponível/falhou".to_string(),
        };
    };

    let stats = analyze_pattern(&pattern);
    let mut diffs: Vec<String> = Vec::new();

    if stats.stitch_count != py.plainStitchCount {
        diffs.push(format!(
            "plain stitches {} vs {}",
            stats.stitch_count, py.plainStitchCount
        ));
    }
    if stats.color_count != py.colorCount {
        diffs.push(format!("cores {} vs {}", stats.color_count, py.colorCount));
    }
    let rust_jumps = pattern
        .stitches
        .iter()
        .filter(|s| s.stitch_type == StitchType::Jump)
        .count() as i64;
    if rust_jumps != py.jumpCount {
        diffs.push(format!("jumps {} vs {}", rust_jumps, py.jumpCount));
    }
    let rust_cc = pattern
        .stitches
        .iter()
        .filter(|s| s.stitch_type == StitchType::ColorChange)
        .count() as i64;
    if rust_cc != py.colorChangeCount {
        diffs.push(format!("color_changes {} vs {}", rust_cc, py.colorChangeCount));
    }
    let rust_end = pattern.stitches.iter().any(|s| s.stitch_type == StitchType::End);
    if rust_end != py.hasEnd {
        diffs.push(format!("hasEnd {} vs {}", rust_end, py.hasEnd));
    }
    if (stats.width_mm - py.bboxMm.width).abs() > 1.0 {
        diffs.push(format!("width_mm {:.2} vs {:.2}", stats.width_mm, py.bboxMm.width));
    }
    if (stats.height_mm - py.bboxMm.height).abs() > 1.0 {
        diffs.push(format!("height_mm {:.2} vs {:.2}", stats.height_mm, py.bboxMm.height));
    }

    Diff {
        file: path.to_string_lossy().to_string(),
        ok: diffs.is_empty(),
        detail: diffs.join("; "),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let recursive = args.iter().any(|a| a == "--recursive" || a == "-r");
    let roots: Vec<String> = args.iter().filter(|a| !a.starts_with('-')).cloned().collect();
    if roots.is_empty() {
        eprintln!("Usage: pes_compare <dir> [--recursive]");
        std::process::exit(2);
    }

    let mut failures = 0usize;
    let mut scanned = 0usize;
    for root in roots {
        let base = WalkDir::new(root).min_depth(1);
        let walker = if recursive {
            base.into_iter()
        } else {
            base.max_depth(1).into_iter()
        };
        for entry in walker.flatten() {
            let p = entry.path();
            if !p.is_file() {
                continue;
            }
            let Some(ext) = p.extension().and_then(|e| e.to_str()) else {
                continue;
            };
            if !matches!(ext.to_ascii_lowercase().as_str(), "pes" | "pec") {
                continue;
            }
            scanned += 1;
            let d = compare_file(p);
            println!("{} | ok={} | {}", d.file, d.ok, d.detail);
            if !d.ok {
                failures += 1;
            }
        }
    }
    println!("Analisados {scanned} arquivo(s); {failures} divergem.");
    if failures > 0 {
        std::process::exit(1);
    }
}

