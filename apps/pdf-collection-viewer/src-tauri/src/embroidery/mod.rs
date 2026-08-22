pub mod dst;
pub mod exp;
pub mod jef;
pub mod pes;
pub mod renderer;
pub mod vp3;

use image::Rgba;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StitchType {
    Stitch,
    Jump,
    ColorChange,
    End,
}

#[derive(Debug, Clone)]
pub struct Stitch {
    pub x: f32,
    pub y: f32,
    pub stitch_type: StitchType,
}

#[derive(Debug, Clone)]
pub struct EmbroideryPattern {
    pub stitches: Vec<Stitch>,
    pub palette: Option<Vec<Rgba<u8>>>,
    pub invert_y: bool,
}

impl EmbroideryPattern {
    pub fn new() -> Self {
        Self {
            stitches: Vec::new(),
            palette: None,
            invert_y: false,
        }
    }

    pub fn add_stitch(&mut self, x: f32, y: f32, stitch_type: StitchType) {
        self.stitches.push(Stitch { x, y, stitch_type });
    }
}

/// Carrega e decodifica um arquivo de bordado com base na extensão
pub fn load_pattern_from_file(path: &str) -> Result<EmbroideryPattern, String> {
    let bytes = fs::read(path).map_err(|e| format!("Falha ao ler arquivo de bordado: {e}"))?;
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "dst" => dst::parse_dst(&bytes),
        "exp" => exp::parse_exp(&bytes),
        "pes" | "pec" => pes::parse_pes(&bytes),
        "jef" => jef::parse_jef(&bytes),
        "vp3" => vp3::parse_vp3(&bytes),
        _ => Err(format!("Formato de bordado não suportado: {ext}")),
    }
}

/// Renderiza o arquivo de bordado e salva a miniatura WebP no cache
pub fn render_embroidery_thumbnail(path: &str, cache_dir: &Path) -> Result<(), String> {
    let pattern = load_pattern_from_file(path)?;
    renderer::save_pattern_thumbnail(&pattern, path, cache_dir)
}

#[cfg(test)]
mod pes_test {
    use super::*;

    #[test]
    fn test_pes_wrapper_with_real_offset() {
        let mut bytes = vec![0u8; 1500];
        bytes[..8].copy_from_slice(b"#PES0001");
        let pec_offset: u32 = 512;
        bytes[8..12].copy_from_slice(&pec_offset.to_le_bytes());
        bytes[512..520].copy_from_slice(b"#PEC0001");
        bytes[560] = 2; // 3 colors
        bytes[561] = 1;
        bytes[562] = 2;
        bytes[563] = 3;
        
        let mut stitch_data = Vec::new();
        stitch_data.extend_from_slice(&[10, 15]); // stitch 1
        stitch_data.extend_from_slice(&[0xFE, 0xB0, 0x01]); // color change to index 1
        stitch_data.extend_from_slice(&[5, 10]); // stitch 2
        stitch_data.extend_from_slice(&[0xFF]); // end
        
        let start = 1024; // pec_offset + 512
        bytes[start..start + stitch_data.len()].copy_from_slice(&stitch_data);
        
        let parsed = pes::parse_pes(&bytes);
        if let Err(ref e) = parsed {
            eprintln!("Parse error: {}", e);
        }
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 4); // 2 stitches + color change + end
        
        // Verify palette
        assert!(pattern.palette.is_some());
        let palette = pattern.palette.unwrap();
        assert_eq!(palette.len(), 3);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_pattern_render() {
        let pattern = EmbroideryPattern::new();
        let img = renderer::render_pattern(&pattern);
        assert_eq!(img.width(), 300);
        assert_eq!(img.height(), 300);
    }

    #[test]
    fn test_synthetic_dst_pattern() {
        let mut bytes = vec![0u8; 512]; // cabeçalho
        bytes.extend_from_slice(&[0x01, 0x00, 0x00]); // +1 dx
        bytes.extend_from_slice(&[0x00, 0x40, 0x00]); // +1 dy
        bytes.extend_from_slice(&[0x00, 0x00, 0xF3]); // EOF

        let parsed = dst::parse_dst(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 3);
    }

    #[test]
    fn test_synthetic_exp_pattern() {
        let bytes = vec![
            10, 20, // stitch
            0x80, 0x01, 5, 5, // color change
            0x80, 0x02, 15, 15, // jump
        ];
        let parsed = exp::parse_exp(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 3);
    }

    #[test]
    fn test_synthetic_pec_pattern() {
        let mut bytes = vec![0u8; 600];
        bytes[..8].copy_from_slice(b"#PEC0001");
        // No offset 512 (0x200), adiciona pontos
        bytes[512] = 10; // dx
        bytes[513] = 15; // dy
        bytes[514] = 0xFF; // End

        let parsed = pes::parse_pes(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 2);
    }

    #[test]
    fn test_synthetic_jef_pattern() {
        let mut bytes = vec![0u8; 64];
        // stitch_offset = 32
        bytes[0..4].copy_from_slice(&32u32.to_le_bytes());
        bytes[32] = 5;
        bytes[33] = 10;
        bytes[34] = 0x80;
        bytes[35] = 0x10; // End

        let parsed = jef::parse_jef(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 2);
    }

    #[test]
    fn test_synthetic_vp3_pattern() {
        let mut bytes = vec![0u8; 16];
        bytes[..5].copy_from_slice(b"%vsm%");
        bytes[5..9].copy_from_slice(&[0, 10, 0, 20]); // dx = 10, dy = 20

        let parsed = vp3::parse_vp3(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 1);
    }

    #[test]
    fn test_render_to_canvas() {
        let mut pattern = EmbroideryPattern::new();
        pattern.add_stitch(0.0, 0.0, StitchType::Stitch);
        pattern.add_stitch(50.0, 50.0, StitchType::Stitch);
        pattern.add_stitch(100.0, 0.0, StitchType::Stitch);
        pattern.add_stitch(100.0, 0.0, StitchType::End);

        let img = renderer::render_pattern(&pattern);
        assert_eq!(img.width(), 300);
        assert_eq!(img.height(), 300);
    }
}

