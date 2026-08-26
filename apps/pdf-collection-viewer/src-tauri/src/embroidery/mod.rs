pub mod dst;
pub mod exp;
pub mod hus;
pub mod husky;
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
    Trim,
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

/// Resumo de metadados extraído do padrão de bordado já decodificado.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct EmbroideryStats {
    /// Número de pontos efetivos (sem saltos/trims).
    pub stitch_count: i64,
    /// Número de cores distintas utilizadas.
    pub color_count: i64,
    /// Número de trocas de cor.
    pub color_changes: i64,
    /// Largura do desenho em milímetros.
    pub width_mm: f64,
    /// Altura do desenho em milímetros.
    pub height_mm: f64,
}

/// Todos os formatos suportados armazenam coordenadas em 1/10 de mm.
const EMBROIDERY_UNIT_MM: f64 = 0.1;

/// Calcula estatísticas (pontos, cores, trocas e tamanho) a partir do padrão.
pub fn analyze_pattern(pattern: &EmbroideryPattern) -> EmbroideryStats {
    let mut stats = EmbroideryStats::default();
    let mut min_x = f32::MAX;
    let mut max_x = f32::MIN;
    let mut min_y = f32::MAX;
    let mut max_y = f32::MIN;
    let mut has_points = false;

    for s in &pattern.stitches {
        match s.stitch_type {
            StitchType::Stitch => {
                stats.stitch_count += 1;
            }
            StitchType::ColorChange => {
                stats.color_changes += 1;
            }
            _ => {}
        }
        // O tamanho do bordado considera também os saltos (área da agulha).
        if matches!(s.stitch_type, StitchType::Stitch | StitchType::Jump) {
            has_points = true;
            if s.x < min_x { min_x = s.x; }
            if s.x > max_x { max_x = s.x; }
            if s.y < min_y { min_y = s.y; }
            if s.y > max_y { max_y = s.y; }
        }
    }

    if has_points {
        stats.width_mm = ((max_x - min_x) as f64 * EMBROIDERY_UNIT_MM).max(0.0);
        stats.height_mm = ((max_y - min_y) as f64 * EMBROIDERY_UNIT_MM).max(0.0);
    }

    stats.color_count = match &pattern.palette {
        Some(palette) if !palette.is_empty() => palette.len() as i64,
        _ => {
            if stats.stitch_count > 0 || stats.color_changes > 0 {
                stats.color_changes + 1
            } else {
                0
            }
        }
    };

    stats
}

/// Renderiza o arquivo de bordado, salva a miniatura WebP no cache e retorna
/// os metadados extraídos do padrão.
pub fn render_embroidery_thumbnail(path: &str, cache_dir: &Path) -> Result<EmbroideryStats, String> {
    let pattern = load_pattern_from_file(path)?;
    let stats = analyze_pattern(&pattern);
    renderer::save_pattern_thumbnail(&pattern, path, cache_dir)?;
    Ok(stats)
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
        
        let start = 512 + 527; // pec_offset (LA:) + 527
        bytes.resize(start + stitch_data.len() + 1, 0);
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
        // Layout standalone conforme pyembroidery: "#PEC0001" (8 bytes),
        // depois "LA:" na posição 8; stream de stitches em 8 + 527 = 535.
        let mut bytes = vec![0u8; 700];
        bytes[..8].copy_from_slice(b"#PEC0001");
        bytes[8..11].copy_from_slice(b"LA:");
        bytes[56] = 1; // 2 cores
        bytes[57] = 16;
        bytes[58] = 24;

        bytes[535] = 10; // dx
        bytes[536] = 15; // dy
        bytes[537] = 20;
        bytes[538] = 25;
        bytes[539] = 0xFF; // End

        let parsed = pes::parse_pes(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 3); // 2 stitches + End
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
        let mut bytes = vec![0u8; 200];
        bytes[0..5].copy_from_slice(b"%vsm%");
        bytes[5] = 0x00;
        bytes[6..8].copy_from_slice(&0u16.to_be_bytes());
        bytes[8..15].copy_from_slice(&[0u8; 7]);
        bytes[15..17].copy_from_slice(&0u16.to_be_bytes());
        bytes[17..49].copy_from_slice(&[0u8; 32]);
        bytes[49..53].copy_from_slice(&0i32.to_be_bytes());
        bytes[53..57].copy_from_slice(&0i32.to_be_bytes());
        bytes[57..84].copy_from_slice(&[0u8; 27]);
        bytes[84..86].copy_from_slice(&0u16.to_be_bytes());
        bytes[86..110].copy_from_slice(&[0u8; 24]);
        bytes[110..112].copy_from_slice(&0u16.to_be_bytes());
        bytes[112..114].copy_from_slice(&1u16.to_be_bytes());

        let start = 114;
        bytes[start..start+3].copy_from_slice(&[0x00, 0x05, 0x00]);
        bytes[start+3..start+7].copy_from_slice(&49u32.to_be_bytes());
        bytes[start+7..start+11].copy_from_slice(&0i32.to_be_bytes());
        bytes[start+11..start+15].copy_from_slice(&0i32.to_be_bytes());
        bytes[start+15] = 0x01;
        bytes[start+16] = 0x01;
        bytes[start+17] = 0x00;
        bytes[start+18] = 0xFF;
        bytes[start+19] = 0x00;
        bytes[start+20] = 0x00;
        bytes[start+21] = 0x00;
        bytes[start+22] = 0x00;
        bytes[start+23] = 0x00;
        bytes[start+24] = 0x00;
        bytes[start+25] = 0x00;
        bytes[start+26] = 0x00;
        bytes[start+27] = 0x00;
        bytes[start+28] = 0x00;
        bytes[start+29] = 0x00;
        bytes[start+30] = 0x00;
        bytes[start+31..start+46].copy_from_slice(&[0u8; 15]);
        bytes[start+46..start+49].copy_from_slice(&[0x0A, 0xF6, 0x00]);
        bytes[start+49] = 10;
        bytes[start+50] = 0;
        bytes[start+51] = 20;
        bytes[start+52] = 0;
        bytes[start+53] = 0x80;
        bytes[start+54] = 0x03;

        let parsed = vp3::parse_vp3(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert!(pattern.stitches.len() >= 2);

        // Verify stitches are accumulated as absolute coordinates.
        // Deltas are (10,0) then (20,0), starting from abs (0,0).
        let stitches: Vec<_> = pattern
            .stitches
            .iter()
            .filter(|s| s.stitch_type == StitchType::Stitch)
            .collect();
        assert!(!stitches.is_empty());
        assert_eq!(stitches[0].x, 10.0);
        assert_eq!(stitches[0].y, 0.0);
        if stitches.len() > 1 {
            assert_eq!(stitches[1].x, 30.0);
            assert_eq!(stitches[1].y, 0.0);
        }

        // Verify the 0x80 0x03 command produces a Trim stitch.
        let trims: Vec<_> = pattern
            .stitches
            .iter()
            .filter(|s| s.stitch_type == StitchType::Trim)
            .collect();
        assert_eq!(trims.len(), 1);
        assert_eq!(trims[0].x, 30.0);
        assert_eq!(trims[0].y, 0.0);
    }

    #[test]
    fn test_synthetic_vp3_pattern_with_nonempty_header_strings() {
        // Header strings in real VP3 files are non-empty (e.g. "Produced by     Software Ltd").
        // The length field is big-endian and already encodes the byte count (2 per UTF-16 char).
        // This test validates the parser does not over-advance on non-empty strings.
        let producer = "Produced by     Software Ltd"; // 25 chars = 50 bytes UTF-16
        let producer_bytes = producer.len() * 2;

        let mut bytes = vec![0u8; 300];
        bytes[0..5].copy_from_slice(b"%vsm%");
        bytes[5] = 0x00;

        let mut pos = 6;
        // string 1: "Produced by     Software Ltd" (50 bytes)
        bytes[pos..pos + 2].copy_from_slice(&(producer_bytes as u16).to_be_bytes());
        pos += 2 + producer_bytes;
        // +7
        pos += 7;
        // string 2: "" (0 bytes)
        bytes[pos..pos + 2].copy_from_slice(&0u16.to_be_bytes());
        pos += 2;
        // +32
        pos += 32;
        // center_x, center_y
        bytes[pos..pos + 4].copy_from_slice(&0i32.to_be_bytes());
        pos += 4;
        bytes[pos..pos + 4].copy_from_slice(&0i32.to_be_bytes());
        pos += 4;
        // +27
        pos += 27;
        // string 3: "" (0 bytes)
        bytes[pos..pos + 2].copy_from_slice(&0u16.to_be_bytes());
        pos += 2;
        // +24
        pos += 24;
        // string 4: "Produced by     Software Ltd" (50 bytes)
        bytes[pos..pos + 2].copy_from_slice(&(producer_bytes as u16).to_be_bytes());
        pos += 2 + producer_bytes;
        // count_colors = 1
        bytes[pos..pos + 2].copy_from_slice(&1u16.to_be_bytes());
        pos += 2;

        let start = pos;
        bytes[start..start + 3].copy_from_slice(&[0x00, 0x05, 0x00]);
        bytes[start + 3..start + 7].copy_from_slice(&49u32.to_be_bytes());
        bytes[start + 7..start + 11].copy_from_slice(&0i32.to_be_bytes());
        bytes[start + 11..start + 15].copy_from_slice(&0i32.to_be_bytes());
        bytes[start + 15] = 0x01;
        bytes[start + 16] = 0x01;
        bytes[start + 17] = 0x00;
        bytes[start + 18] = 0xFF;
        bytes[start + 19] = 0x00;
        bytes[start + 20] = 0x00;
        bytes[start + 21] = 0x00;
        bytes[start + 22] = 0x00;
        bytes[start + 23] = 0x00;
        bytes[start + 24] = 0x00;
        bytes[start + 25] = 0x00;
        bytes[start + 26] = 0x00;
        bytes[start + 27] = 0x00;
        bytes[start + 28] = 0x00;
        bytes[start + 29] = 0x00;
        bytes[start + 30] = 0x00;
        bytes[start + 31..start + 46].copy_from_slice(&[0u8; 15]);
        bytes[start + 46..start + 49].copy_from_slice(&[0x0A, 0xF6, 0x00]);
        bytes[start + 49] = 10;
        bytes[start + 50] = 0;
        bytes[start + 51] = 20;
        bytes[start + 52] = 0;
        bytes[start + 53] = 0x80;
        bytes[start + 54] = 0x03;

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
        bytes[0x104] = 0;
        bytes[0x105] = 0; // parâmetros do color change (consumidos)
        bytes[0x106] = 5;
        bytes[0x107] = 10; // stitch (dx=5, dy=-10)
        bytes[0x108] = 0x7F;
        bytes[0x109] = 0x7F; // end
        bytes[0x10A] = 0;
        bytes[0x10B] = 0;

        let parsed = xxx::parse_xxx(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 4); // stitch + color_change + stitch + end
    }

    #[test]
    fn test_synthetic_sew_pattern() {
        let mut bytes = vec![0u8; 0x1D78 + 10];
        bytes[0..2].copy_from_slice(&1u16.to_le_bytes()); // 1 cor
        bytes[2..4].copy_from_slice(&10u16.to_le_bytes()); // Red
        let o = 0x1D78;
        bytes[o] = 5;
        bytes[o + 1] = 10; // stitch
        bytes[o + 2] = 0x80;
        bytes[o + 3] = 0x02; // jump
        bytes[o + 4] = 1;
        bytes[o + 5] = 2;
        bytes[o + 6] = 0x80;
        bytes[o + 7] = 0x00; // controle desconhecido → encerra

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
    fn analyze_pattern_extrai_estatisticas() {
        let mut pattern = EmbroideryPattern::new();
        pattern.add_stitch(0.0, 0.0, StitchType::Jump);
        pattern.add_stitch(100.0, 0.0, StitchType::Stitch);
        pattern.add_stitch(200.0, 150.0, StitchType::Stitch);
        pattern.add_stitch(200.0, 150.0, StitchType::ColorChange);
        pattern.add_stitch(0.0, 0.0, StitchType::Stitch);

        let stats = analyze_pattern(&pattern);
        assert_eq!(stats.stitch_count, 3);
        assert_eq!(stats.color_changes, 1);
        // Sem paleta embutida: cores = trocas + 1.
        assert_eq!(stats.color_count, 2);
        // Coordenadas em 1/10 mm: 200 => 20 mm, 150 => 15 mm.
        assert!((stats.width_mm - 20.0).abs() < 1e-4);
        assert!((stats.height_mm - 15.0).abs() < 1e-4);
    }

    #[test]
    fn analyze_pattern_com_paleta_usa_tamanho_da_paleta() {
        let mut pattern = EmbroideryPattern::new();
        pattern.palette = Some(vec![image::Rgba([255, 0, 0, 255]), image::Rgba([0, 255, 0, 255]), image::Rgba([0, 0, 255, 255])]);
        pattern.add_stitch(10.0, 10.0, StitchType::Stitch);
        pattern.add_stitch(20.0, 10.0, StitchType::ColorChange);
        pattern.add_stitch(30.0, 10.0, StitchType::Stitch);

        let stats = analyze_pattern(&pattern);
        assert_eq!(stats.color_count, 3);
        assert_eq!(stats.color_changes, 1);
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

