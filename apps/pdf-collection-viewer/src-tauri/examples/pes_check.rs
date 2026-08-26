//! One-off probe: parse PES files from a directory and print stats,
//! comparing against the reference numbers produced by ref_dump.py.
//!
//! Usage: cargo run --example pes_check -- "D:\path\to\folder"

use pdf_collection_viewer_lib::embroidery::pes::parse_pes;
use pdf_collection_viewer_lib::embroidery::StitchType;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let target = &args[1];
    if target.ends_with(".pes") || target.ends_with(".pec") {
        let bytes = std::fs::read(target).unwrap();
        match crate::embroidery::pes::parse_pes(&bytes) {
            Ok(p) => {
                let n = p.palette.as_ref().map(|v: &Vec<image::Rgba<u8>>| v.len()).unwrap_or(0);
                println!("stitches={} colors={}", p.stitches.len(), n);
                for s in p.stitches.iter().take(12) {
                    println!("  ({}, {}) {:?}", s.x, s.y, s.stitch_type);
                }
            }
            Err(e) => println!("ERRO: {e}"),
        }
        return;
    }
    let dir = target.clone();
    for entry in std::fs::read_dir(dir).unwrap() {
        let entry = entry.unwrap();
        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .unwrap_or_default();
        if ext != "pes" && ext != "pec" {
            continue;
        }
        let bytes = std::fs::read(&path).unwrap();
        match parse_pes(&bytes) {
            Ok(p) => {
                let plain = p.stitches.iter().filter(|s| s.stitch_type == StitchType::Stitch).count();
                let jumps = p.stitches.iter().filter(|s| s.stitch_type == StitchType::Jump).count();
                let cc = p.stitches.iter().filter(|s| s.stitch_type == StitchType::ColorChange).count();
                let has_end = p.stitches.iter().any(|s| s.stitch_type == StitchType::End);
                println!(
                    "{}: ok | stitches={} jumps={} color_changes={} end={} colors={}",
                    path.file_name().unwrap().to_string_lossy(),
                    plain,
                    jumps,
                    cc,
                    has_end,
                    p.palette.as_ref().map(|v| v.len()).unwrap_or(0),
                );
            }
            Err(e) => println!("{}: ERRO: {}", path.file_name().unwrap().to_string_lossy(), e),
        }
    }
}

