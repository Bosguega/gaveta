use crate::embroidery::{EmbroideryPattern, StitchType};

/// Parser para arquivos de bordado Tajima (.dst)
pub fn parse_dst(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 512 {
        return Err("Arquivo DST muito curto para conter cabeçalho".to_string());
    }

    let mut pattern = EmbroideryPattern::new();
    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;

    let mut i = 512; // Pula cabeçalho de 512 bytes

    while i + 2 < bytes.len() {
        let b0 = bytes[i];
        let b1 = bytes[i + 1];
        let b2 = bytes[i + 2];
        i += 3;

        // Fim de arquivo Tajima
        if b2 == 0xF3 {
            pattern.add_stitch(curr_x, curr_y, StitchType::End);
            break;
        }

        let mut dx = 0;
        let mut dy = 0;

        if b0 & 0x01 != 0 { dx += 1; }
        if b0 & 0x02 != 0 { dx -= 1; }
        if b0 & 0x04 != 0 { dx += 9; }
        if b0 & 0x08 != 0 { dx -= 9; }
        if b0 & 0x40 != 0 { dy += 1; }
        if b0 & 0x80 != 0 { dy -= 1; }

        if b1 & 0x01 != 0 { dx += 3; }
        if b1 & 0x02 != 0 { dx -= 3; }
        if b1 & 0x04 != 0 { dx += 27; }
        if b1 & 0x08 != 0 { dx -= 27; }
        if b1 & 0x40 != 0 { dy += 3; }
        if b1 & 0x80 != 0 { dy -= 3; }

        if b2 & 0x04 != 0 { dy += 27; }
        if b2 & 0x08 != 0 { dy -= 27; }
        if b2 & 0x40 != 0 { dy += 9; }
        if b2 & 0x80 != 0 { dy -= 9; }

        curr_x += dx as f32;
        curr_y += dy as f32;

        let stitch_type = if b2 & 0xC0 == 0xC0 {
            StitchType::ColorChange
        } else if b2 & 0x40 != 0 || b2 & 0x80 != 0 {
            StitchType::Jump
        } else {
            StitchType::Stitch
        };

        pattern.add_stitch(curr_x, curr_y, stitch_type);
    }

    Ok(pattern)
}
