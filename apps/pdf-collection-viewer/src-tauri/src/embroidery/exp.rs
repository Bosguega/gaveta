use crate::embroidery::{EmbroideryPattern, StitchType};

/// Parser para arquivos de bordado Melco (.exp)
pub fn parse_exp(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.is_empty() {
        return Err("Arquivo EXP vazio".to_string());
    }

    let mut pattern = EmbroideryPattern::new();
    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;

    let mut i = 0;
    while i + 1 < bytes.len() {
        let b0 = bytes[i];
        let b1 = bytes[i + 1];
        i += 2;

        if b0 == 0x80 {
            // Byte de controle / escape
            match b1 {
                0x01 => {
                    // Troca de cor. O próximo par de bytes especifica o movimento após a troca
                    if i + 1 < bytes.len() {
                        let dx = bytes[i] as i8 as f32;
                        let dy = bytes[i + 1] as i8 as f32;
                        i += 2;
                        curr_x += dx;
                        curr_y += dy;
                    }
                    pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
                }
                0x02 | 0x04 => {
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
                _ => {
                    // Outro comando especial (pode ser parada/fim)
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
            // Ponto normal de costura
            let dx = b0 as i8 as f32;
            let dy = b1 as i8 as f32;
            curr_x += dx;
            curr_y += dy;
            pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
        }
    }

    Ok(pattern)
}
