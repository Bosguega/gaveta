//! Sonda: parseia arquivos .pes/.pec com o parser Rust e imprime contagens
//! separadas (stitches, trims, jumps, color changes, end) para comparar com
//! pyembroidery.
use pdf_collection_viewer_lib::embroidery::pes::parse_pes;
use pdf_collection_viewer_lib::embroidery::StitchType;

fn print_pattern(path: &str, bytes: &[u8]) {
    match parse_pes(bytes) {
        Ok(p) => {
            let s = p
                .stitches
                .iter()
                .filter(|x| x.stitch_type == StitchType::Stitch)
                .count();
            let j = p
                .stitches
                .iter()
                .filter(|x| x.stitch_type == StitchType::Jump)
                .count();
            let t = p
                .stitches
                .iter()
                .filter(|x| x.stitch_type == StitchType::Trim)
                .count();
            let cc = p
                .stitches
                .iter()
                .filter(|x| x.stitch_type == StitchType::ColorChange)
                .count();
            let has_end = p
                .stitches
                .iter()
                .any(|x| x.stitch_type == StitchType::End);
            let colors = p.palette.as_ref().map(|v| v.len()).unwrap_or(0);
            println!(
                "{path} | stitches={s} jumps={j} trims={t} CC={cc} end={has_end} colors={colors}"
            );
        }
        Err(e) => println!("{path}: ERRO {e}"),
    }
}

fn main() {
    let mut dirs: Vec<String> = std::env::args().skip(1).collect();
    if dirs.is_empty() {
        eprintln!("Usage: pes_check <path...>");
        std::process::exit(2);
    }

    for target in dirs {
        let path = std::path::Path::new(&target);
        if path.is_file() {
            let bytes = std::fs::read(path).unwrap();
            print_pattern(&target, &bytes);
        } else if path.is_dir() {
            for entry in std::fs::read_dir(path).unwrap() {
                let entry = entry.unwrap();
                let p = entry.path();
                if !p.is_file() {
                    continue;
                }
                if let Some(e) = p.extension().and_then(|x| x.to_str()) {
                    if !matches!(e.to_ascii_lowercase().as_str(), "pes" | "pec") {
                        continue;
                    }
                    let bytes = std::fs::read(&p).unwrap();
                    print_pattern(&p.to_string_lossy(), &bytes);
                }
            }
        }
    }
}

