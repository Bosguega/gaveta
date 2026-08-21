use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

/// Parser para arquivos de bordado Husqvarna / Pfaff (.vp3)
pub fn parse_vp3(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 10 {
        return Err("Arquivo VP3 muito curto".to_string());
    }

    // Valida assinatura %vsm%
    let vsm_idx = bytes
        .windows(5)
        .position(|w| w == b"%vsm%")
        .ok_or_else(|| "Assinatura %vsm% não encontrada no arquivo VP3".to_string())?;

    let mut pattern = EmbroideryPattern::new();
    let mut palette = Vec::new();

    let mut i = vsm_idx + 5;
    if i >= bytes.len() {
        return Err("Arquivo VP3 truncado após assinatura".to_string());
    }

    // Pula header inicial até os grupos de cores
    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;

    while i + 8 < bytes.len() {
        // Busca marcador de início de grupo de pontos no stream VP3
        // Procura padrão de cor / bloco de costura
        if i + 14 < bytes.len() && bytes[i] == 0x00 && bytes[i + 1] == 0x02 && bytes[i + 2] == 0x00 {
            // Bloco de cor e pontos
            i += 3;
            if i + 3 < bytes.len() {
                let r = bytes[i];
                let g = bytes[i + 1];
                let b = bytes[i + 2];
                palette.push(Rgba([r, g, b, 255]));
                pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
                i += 3;
            }
            continue;
        }

        // Lê deltas de 2 bytes (i16 big-endian) comuns no formato VP3
        let dx = i16::from_be_bytes([bytes[i], bytes[i + 1]]) as f32;
        let dy = i16::from_be_bytes([bytes[i + 2], bytes[i + 3]]) as f32;
        i += 4;

        if dx == -32768.0 || dy == -32768.0 {
            // Comando especial / Salto
            if i + 3 < bytes.len() {
                let jx = i16::from_be_bytes([bytes[i], bytes[i + 1]]) as f32;
                let jy = i16::from_be_bytes([bytes[i + 2], bytes[i + 3]]) as f32;
                i += 4;
                curr_x += jx / 10.0;
                curr_y += jy / 10.0;
                pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
            }
        } else {
            curr_x += dx / 10.0;
            curr_y += dy / 10.0;
            pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
        }
    }

    if !palette.is_empty() {
        pattern.palette = Some(palette);
    }

    Ok(pattern)
}
