use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;

/// Pasta raiz do projeto Tauri (onde vivem os scripts Python).
fn py_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("py")
}

/// Invoca o pyembroidery via subprocess e devolve o JSON parseado (Value).
fn python_parse(path: &str) -> Result<Value, String> {
    let script = py_dir().join("reader.py");
    let output = Command::new("python")
        .arg(&script)
        .arg(path)
        .output()
        .map_err(|e| format!("N\u{00E3}o foi poss\u{00ED}vel invocar o Python: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() {
        let msg = stderr.trim().lines().last().unwrap_or(&stderr).to_string();
        return Err(format!("pyembroidery falhou: {msg}"));
    }
    serde_json::from_str::<Value>(stdout.trim())
        .map_err(|e| format!("Falha ao ler JSON do pyembroidery: {e}"))
}

/// Usa pyembroidery para analisar um arquivo .pes/.pec.
#[tauri::command]
pub async fn parse_pes_pyembroidery(path: String) -> Result<Value, String> {
    python_parse(&path)
}

/// Lista arquivos .pes/.pec suportados sob uma pasta.
#[tauri::command]
pub async fn list_pes_files(folder: String, recursive: bool) -> Result<Vec<String>, String> {
    use walkdir::WalkDir;

    let walker = WalkDir::new(&folder).min_depth(1);
    let walker = if recursive { walker.into_iter() } else { walker.max_depth(1).into_iter() };
    let mut out = Vec::new();
    for entry in walker.flatten() {
        if !entry.file_type().is_file() {
            continue;
        }
        if let Some(ext) = entry.path().extension().and_then(|x| x.to_str()) {
            if matches!(ext.to_ascii_lowercase().as_str(), "pes" | "pec") {
                out.push(entry.path().to_string_lossy().to_string());
            }
        }
    }
    out.sort();
    Ok(out)
}
