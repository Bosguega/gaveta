pub mod dst;
pub mod exp;
pub mod hus;
pub mod jef;
pub mod pes;
pub mod renderer;
pub mod sew;
pub mod vp3;
pub mod vip;
pub mod xxx;

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
        "hus" => hus::parse_hus(&bytes),
        "xxx" => xxx::parse_xxx(&bytes),
        "sew" => sew::parse_sew(&bytes),
        "vip" => vip::parse_vip(&bytes),
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
        let mut bytes = vec![0u8; 128];
        bytes[0..5].copy_from_slice(b"%vsm%");
        bytes[5] = 0x00;
        bytes[6..8].copy_from_slice(&2u16.to_be_bytes());
        bytes[8..12].copy_from_slice(&[0x00, 0x50, 0x00, 0x00]);

        let embroidery_summary: Vec<u8> = vec![0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x01];
        bytes[12..19].copy_from_slice(&embroidery_summary);

        let hoop_centered: Vec<u8> = vec![0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01];
        bytes[20..27].copy_from_slice(&hoop_centered);

        let mut color_block = Vec::new();
        color_block.extend_from_slice(&[0x00, 0x05, 0x00]);
        color_block.extend_from_slice(&40u32.to_be_bytes());
        color_block.extend_from_slice(&0i32.to_be_bytes());
        color_block.extend_from_slice(&0i32.to_be_bytes());
        color_block.extend_from_slice(&[0x01, 0x01, 0x28]);
        color_block.extend_from_slice(&[0xFF, 0x00, 0x00]);
        color_block.extend_from_slice(&[0x00; 15]);
        color_block.extend_from_slice(&[0x00, 0x01, 0x00]);
        color_block.extend_from_slice(&12u32.to_be_bytes());
        color_block.extend_from_slice(&[0x0A, 0xF6, 0x00]);
        color_block.extend_from_slice(&[10, 0, 20, 0, 0x80, 0x03]);

        let start = 28;
        if start + color_block.len() <= bytes.len() {
            bytes[start..(start + color_block.len())].copy_from_slice(&color_block);
        }

        let parsed = vp3::parse_vp3(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert!(pattern.stitches.len() >= 2);
    }

    #[test]
    fn test_synthetic_xxx_pattern() {
        let mut bytes = vec![0u8; 0x110];
        bytes[0..2].copy_from_slice(&2u16.to_le_bytes()); // 2 colors
        bytes[2..4].copy_from_slice(&0u16.to_le_bytes()); // palette index 0
        bytes[4..6].copy_from_slice(&0u16.to_le_bytes()); // palette index 0

        bytes[0x100] = 10;
        bytes[0x101] = 20; // stitch (dx=10, dy=-20)
        bytes[0x102] = 0x7F;
        bytes[0x103] = 0x08; // color change
        bytes[0x104] = 5;
        bytes[0x105] = 10; // stitch (dx=5, dy=-10)
        bytes[0x106] = 0x7F;
        bytes[0x107] = 0x7F; // end
        bytes[0x108] = 0;
        bytes[0x109] = 0;

        let parsed = xxx::parse_xxx(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 4); // stitch + color_change + stitch + end
    }

    #[test]
    fn test_synthetic_sew_pattern() {
        let mut bytes = vec![0u8; 0x1D78 + 10];
        bytes[0..2].copy_from_slice(&1u16.to_le_bytes()); // 1 color
        bytes[0x1D78] = 5;
        bytes[0x1D79] = 10;
        bytes[0x1D7A] = 0x80;
        bytes[0x1D7B] = 0x10; // End
        bytes[0x1D7C] = 0;
        bytes[0x1D7D] = 0;

        let parsed = sew::parse_sew(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 2);
    }

    #[test]
    fn test_synthetic_hus_pattern() {
        let mut bytes = vec![0u8; 0x100];
        bytes[0..4].copy_from_slice(&[0x5B, 0xAF, 0xC8, 0x00]);
        bytes[0x04..0x08].copy_from_slice(&2u32.to_le_bytes());
        bytes[0x08..0x0C].copy_from_slice(&1u32.to_le_bytes());
        bytes[0x14..0x18].copy_from_slice(&0x50u32.to_le_bytes());
        bytes[0x18..0x1C].copy_from_slice(&0x70u32.to_le_bytes());
        bytes[0x1C..0x20].copy_from_slice(&0x90u32.to_le_bytes());
        bytes[0x2A..0x2C].copy_from_slice(&0u16.to_le_bytes());

        let parsed = hus::parse_hus(&bytes);
        assert!(parsed.is_err());
    }

    #[test]
    fn test_synthetic_vip_pattern() {
        let mut bytes = vec![0u8; 0x100];
        bytes[0..4].copy_from_slice(&[0x5D, 0xFC, 0x90, 0x01]);
        bytes[0x04..0x08].copy_from_slice(&2u32.to_le_bytes());
        bytes[0x08..0x0C].copy_from_slice(&1u32.to_le_bytes());
        bytes[0x14..0x18].copy_from_slice(&0x50u32.to_le_bytes());
        bytes[0x18..0x1C].copy_from_slice(&0x70u32.to_le_bytes());
        bytes[0x1C..0x20].copy_from_slice(&0x90u32.to_le_bytes());

        let parsed = vip::parse_vip(&bytes);
        assert!(parsed.is_err());
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

