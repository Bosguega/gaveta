use crate::embroidery::{EmbroideryPattern, StitchType};

/// Parser para arquivos de bordado Melco (.xxx)
///
/// Formato binário simples com comandos de escape.
/// Stitches são codificados como pares i8 (dx, dy) com Y negado.
#[allow(unused_assignments)]
pub fn parse_xxx(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 0x100 {
        return Err("Arquivo XXX muito curto".to_string());
    }

    let mut pattern = EmbroideryPattern::new();
    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;

    let color_count = u16::from_le_bytes([bytes[0], bytes[1]]) as usize;
    let mut palette = Vec::new();

    if bytes.len() >= 0x102 + color_count * 2 {
        for i in 0..color_count {
            let idx = u16::from_le_bytes([
                bytes[0x02 + i * 2],
                bytes[0x03 + i * 2],
            ]) as usize;
            palette.push(idx);
        }
    }

    if !palette.is_empty() {
        pattern.palette = Some(
            palette
                .iter()
                .map(|&idx| xxx_palette_color(idx))
                .collect(),
        );
    }

    let mut i = 0x100usize;
    while i + 1 < bytes.len() {
        let b0 = bytes[i];
        let b1 = bytes[i + 1];
        i += 2;

        match b0 {
            0x7D | 0x7E => {
                if i + 3 < bytes.len() {
                    let dx = i16::from_le_bytes([bytes[i], bytes[i + 1]]) as f32;
                    let dy = -(i16::from_le_bytes([bytes[i + 2], bytes[i + 3]]) as f32);
                    i += 4;
                    curr_x += dx;
                    curr_y += dy;
                    pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
                }
            }
            0x7F => {
                let cmd = b1;

                match cmd {
                    0x01 | 0x03 => {
                        if i + 1 < bytes.len() {
                            let dx = bytes[i] as i8 as f32;
                            let dy = -(bytes[i + 1] as i8 as f32);
                            i += 2;
                            curr_x += dx;
                            curr_y += dy;
                        }
                        pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
                    }
                    0x08 | 0x0A..=0x17 => {
                        pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
                    }
                    0x7F | 0x18 => {
                        if i + 1 < bytes.len() {
                            let dx = bytes[i] as i8 as f32;
                            let dy = -(bytes[i + 1] as i8 as f32);
                            i += 2;
                            curr_x += dx;
                            curr_y += dy;
                        }
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
                            pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
                        }
                    }
                }
            }
            _ => {
                let dx = b0 as i8 as f32;
                let dy = -(b1 as i8 as f32);
                curr_x += dx;
                curr_y += dy;
                pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
            }
        }
    }

    Ok(pattern)
}

fn xxx_palette_color(index: usize) -> image::Rgba<u8> {
    let colors: &[(u8, u8, u8)] = &[
        (0, 0, 0), (255, 0, 0), (0, 255, 0), (0, 0, 255),
        (255, 255, 0), (255, 0, 255), (0, 255, 255), (128, 0, 0),
        (0, 128, 0), (0, 0, 128), (128, 128, 0), (128, 0, 128),
        (0, 128, 128), (192, 192, 192), (128, 128, 128), (255, 255, 255),
        (255, 128, 0), (128, 255, 0), (0, 255, 128), (0, 128, 255),
        (128, 0, 255), (255, 0, 128), (255, 128, 128), (128, 255, 128),
        (128, 128, 255), (255, 255, 128), (255, 128, 255), (128, 255, 255),
        (192, 0, 0), (0, 192, 0), (0, 0, 192), (192, 192, 0),
        (192, 0, 192), (0, 192, 192), (64, 0, 0), (0, 64, 0),
        (0, 0, 64), (64, 64, 0), (64, 0, 64), (0, 64, 64),
        (255, 192, 0), (192, 255, 0), (0, 255, 192), (0, 192, 255),
        (192, 0, 255), (255, 0, 192), (255, 192, 192), (192, 255, 192),
        (192, 192, 255), (255, 255, 192), (255, 192, 255), (192, 255, 255),
    ];
    let (r, g, b) = colors.get(index).copied().unwrap_or((128, 128, 128));
    image::Rgba([r, g, b, 255])
}
