use crate::embroidery::{EmbroideryPattern, StitchType};

/// Parser para arquivos de bordado Janome (.jef)
pub fn parse_jef(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 0x20 {
        return Err("Arquivo JEF muito curto".to_string());
    }

    let stitch_offset = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize;
    if stitch_offset >= bytes.len() {
        return Err("Offset de pontos JEF inválido".to_string());
    }

    let mut pattern = EmbroideryPattern::new();
    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;

    let mut i = stitch_offset;
    while i + 1 < bytes.len() {
        let b0 = bytes[i];
        let b1 = bytes[i + 1];
        i += 2;

        if b0 == 0x80 {
            match b1 {
                0x01 => {
                    // Troca de cor
                    if i + 1 < bytes.len() {
                        let dx = bytes[i] as i8 as f32;
                        let dy = bytes[i + 1] as i8 as f32;
                        i += 2;
                        curr_x += dx;
                        curr_y += dy;
                    }
                    pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
                }
                0x02 => {
                    // Salto (Jump)
                    if i + 1 < bytes.len() {
                        let dx = bytes[i] as i8 as f32;
                        let dy = bytes[i + 1] as i8 as f32;
                        i += 2;
                        curr_x += dx;
                        curr_y += dy;
                        pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
                    }
                }
                0x10 => {
                    // Fim do desenho
                    pattern.add_stitch(curr_x, curr_y, StitchType::End);
                    break;
                }
                _ => {
                    // Outro comando de escape
                    if i + 1 < bytes.len() {
                        let dx = bytes[i] as i8 as f32;
                        let dy = bytes[i + 1] as i8 as f32;
                        i += 2;
                        curr_x += dx;
                        curr_y += dy;
                        pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
                    }
                }
            }
        } else {
            let dx = b0 as i8 as f32;
            let dy = b1 as i8 as f32;
            curr_x += dx;
            curr_y += dy;
            pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
        }
    }

    Ok(pattern)
}
