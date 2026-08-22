use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

/// Paleta de cores Janome para formato SEW (78 cores)
const JANOME_PALETTE: [(u8, u8, u8); 76] = [
    (0, 0, 0), (255, 255, 255), (255, 0, 0), (0, 255, 0),
    (0, 0, 255), (255, 255, 0), (255, 0, 255), (0, 255, 255),
    (128, 0, 0), (0, 128, 0), (0, 0, 128), (128, 128, 0),
    (128, 0, 128), (0, 128, 128), (192, 192, 192), (128, 128, 128),
    (255, 128, 0), (128, 255, 0), (0, 255, 128), (0, 128, 255),
    (128, 0, 255), (255, 0, 128), (255, 128, 128), (128, 255, 128),
    (128, 128, 255), (255, 255, 128), (255, 128, 255), (128, 255, 255),
    (192, 0, 0), (0, 192, 0), (0, 0, 192), (192, 192, 0),
    (192, 0, 192), (0, 192, 192), (64, 0, 0), (0, 64, 0),
    (0, 0, 64), (64, 64, 0), (64, 0, 64), (0, 64, 64),
    (255, 192, 0), (192, 255, 0), (0, 255, 192), (0, 192, 255),
    (192, 0, 255), (255, 0, 192), (255, 192, 192), (192, 255, 192),
    (192, 192, 255), (255, 255, 192), (255, 192, 255), (192, 255, 255),
    (255, 64, 0), (64, 255, 0), (0, 255, 64), (0, 64, 255),
    (64, 0, 255), (255, 0, 64), (255, 64, 64), (64, 255, 64),
    (64, 64, 255), (255, 255, 64), (255, 64, 255), (64, 255, 255),
    (128, 64, 0), (64, 128, 0), (0, 128, 64), (0, 64, 128),
    (64, 0, 128), (128, 0, 64), (128, 64, 64), (64, 128, 64),
    (64, 64, 128), (128, 128, 64), (128, 64, 128), (64, 128, 128),
];

/// Parser para arquivos de bordado Janome / Baby Lock / Bernina (.sew)
///
/// Formato com cabeçalho fixo e dados de stitches a partir do offset 0x1D78.
/// Usa esquema de comandos escapados similar ao JEF.
pub fn parse_sew(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 0x1D78 {
        return Err("Arquivo SEW muito curto".to_string());
    }

    let mut pattern = EmbroideryPattern::new();

    let color_count = u16::from_le_bytes([bytes[0], bytes[1]]) as usize;
    let mut palette = Vec::new();

    for i in 0..(color_count.min(12)) {
        let idx = u16::from_le_bytes([bytes[0x02 + i * 2], bytes[0x03 + i * 2]]) as usize;
        let (r, g, b) = JANOME_PALETTE
            .get(idx)
            .copied()
            .unwrap_or((128, 128, 128));
        palette.push(Rgba([r, g, b, 255]));
    }

    if !palette.is_empty() {
        pattern.palette = Some(palette);
    }

    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;
    let mut i = 0x1D78usize;

    while i + 1 < bytes.len() {
        let b0 = bytes[i];
        let b1 = bytes[i + 1];
        i += 2;

        if b0 == 0x80 {
            match b1 {
                0x01 => {
                    if i + 1 < bytes.len() {
                        let dx = bytes[i] as i8 as f32;
                        let dy = -(bytes[i + 1] as i8 as f32);
                        i += 2;
                        curr_x += dx;
                        curr_y += dy;
                    }
                    pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
                }
                0x02 | 0x04 => {
                    if i + 1 < bytes.len() {
                        let dx = bytes[i] as i8 as f32;
                        let dy = -(bytes[i + 1] as i8 as f32);
                        i += 2;
                        curr_x += dx;
                        curr_y += dy;
                    }
                    pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
                }
                0x10 => {
                    pattern.add_stitch(curr_x, curr_y, StitchType::End);
                    break;
                }
                _ => {
                    if i + 1 < bytes.len() {
                        let dx = bytes[i] as i8 as f32;
                        let dy = -(bytes[i + 1] as i8 as f32);
                        i += 2;
                        curr_x += dx;
                        curr_y += dy;
                    }
                    pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
                }
            }
        } else {
            let dx = b0 as i8 as f32;
            let dy = -(b1 as i8 as f32);
            curr_x += dx;
            curr_y += dy;
            pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
        }
    }

    Ok(pattern)
}
