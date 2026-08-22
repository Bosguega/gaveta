use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

/// Parser para arquivos de bordado Pfaff / Viking (.vp3)
///
/// Formato hierárquico com tagged sections:
/// - File header: `%vsm%` + null + producer string (UTF-16 BE)
/// - Embroidery-summary: tag `00 02 00`
/// - Hoop-centred: tag `00 03 00`
/// - Thread packets: tag `00 05 00` + thread info + stitch-run
/// - Stitch-run: tag `00 01 00` + scale + stitch data
///
/// Stitch encoding:
/// - Normal: 2 bytes (i8 dx, i8 dy), Y negado
/// - Escape byte `0x80`:
///   - `0x80 0x01`: extended move (i16 BE dx + i16 BE dy + `0x80 0x02`)
///   - `0x80 0x03`: trim/end
pub fn parse_vp3(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 10 {
        return Err("Arquivo VP3 muito curto".to_string());
    }

    let vsm_idx = bytes
        .windows(5)
        .position(|w| w == b"%vsm%")
        .ok_or_else(|| "Assinatura %vsm% não encontrada no arquivo VP3".to_string())?;

    let mut pos = vsm_idx + 5;
    if pos >= bytes.len() || bytes[pos] != 0x00 {
        return Err("VP3: null byte esperado após %vsm%".to_string());
    }
    pos += 1;

    if pos + 2 > bytes.len() {
        return Err("VP3 truncado: tamanho da string produtora ausente".to_string());
    }
    let producer_len = u16::from_be_bytes([bytes[pos], bytes[pos + 1]]) as usize * 2;
    pos += 2;
    if pos + producer_len > bytes.len() {
        return Err("VP3 truncado: string produtora incompleta".to_string());
    }
    pos += producer_len;

    let mut pattern = EmbroideryPattern::new();
    let mut palette = Vec::new();

    while pos + 3 <= bytes.len() {
        let tag = [bytes[pos], bytes[pos + 1], bytes[pos + 2]];
        pos += 3;

        if tag == [0x00, 0x05, 0x00] {
            if pos + 4 > bytes.len() {
                break;
            }
            let block_len = u32::from_be_bytes([
                bytes[pos],
                bytes[pos + 1],
                bytes[pos + 2],
                bytes[pos + 3],
            ]) as usize;
            pos += 4;

            let block_start = pos;
            if pos + 4 > bytes.len() {
                break;
            }
            let start_x = i32::from_be_bytes([
                bytes[pos],
                bytes[pos + 1],
                bytes[pos + 2],
                bytes[pos + 3],
            ]) as f32;
            pos += 4;

            if pos + 4 > bytes.len() {
                break;
            }
            let start_y = i32::from_be_bytes([
                bytes[pos],
                bytes[pos + 1],
                bytes[pos + 2],
                bytes[pos + 3],
            ]) as f32;
            pos += 4;

            if pos + 3 > bytes.len() {
                break;
            }
            let _color_type = bytes[pos];
            pos += 1;
            let _color_count = bytes[pos];
            pos += 1;
            let _thread_weight = bytes[pos];
            pos += 1;

            let mut r = 0u8;
            let mut g = 0u8;
            let mut b = 0u8;
            if pos + 3 <= bytes.len() {
                r = bytes[pos];
                g = bytes[pos + 1];
                b = bytes[pos + 2];
                pos += 3;
            }

            palette.push(Rgba([r, g, b, 255]));
            pattern.add_stitch(0.0, 0.0, StitchType::ColorChange);

            if pos + 15 > bytes.len() {
                pos = block_start + block_len;
                continue;
            }
            pos += 15;

            if pos + 3 > bytes.len() {
                pos = block_start + block_len;
                continue;
            }

            let mut curr_x = start_x / 100.0;
            let mut curr_y = -start_y / 100.0;

            let block_end = block_start + block_len;

            while pos + 1 < block_end && pos + 1 < bytes.len() {
                let b0 = bytes[pos];
                pos += 1;

                if b0 == 0x80 {
                    if pos >= bytes.len() {
                        break;
                    }
                    let cmd = bytes[pos];
                    pos += 1;

                    match cmd {
                        0x01 => {
                            if pos + 4 <= bytes.len() {
                                let dx = i16::from_be_bytes([bytes[pos], bytes[pos + 1]]) as f32;
                                let dy = i16::from_be_bytes([bytes[pos + 2], bytes[pos + 3]]) as f32;
                                pos += 4;
                                curr_x += dx / 100.0;
                                curr_y += -dy / 100.0;
                                pattern.add_stitch(curr_x, curr_y, StitchType::Jump);

                                if pos + 2 <= bytes.len() && bytes[pos] == 0x80 && bytes[pos + 1] == 0x02 {
                                    pos += 2;
                                }
                            }
                        }
                        0x03 => {
                            pattern.add_stitch(curr_x, curr_y, StitchType::End);
                            break;
                        }
                        _ => {}
                    }
                } else {
                    if pos >= bytes.len() {
                        break;
                    }
                    let b1 = bytes[pos];
                    pos += 1;

                    let dx = b0 as i8 as f32;
                    let dy = -(b1 as i8 as f32);
                    curr_x += dx / 10.0;
                    curr_y += dy / 10.0;
                    pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
                }
            }

            pos = block_start + block_len;
        } else if tag == [0x00, 0x02, 0x00] || tag == [0x00, 0x03, 0x00] {
            if pos + 4 > bytes.len() {
                break;
            }
            let section_len = u32::from_be_bytes([
                bytes[pos],
                bytes[pos + 1],
                bytes[pos + 2],
                bytes[pos + 3],
            ]) as usize;
            pos += 4;
            pos += section_len;
        }
    }

    if !palette.is_empty() {
        pattern.palette = Some(palette);
    }

    Ok(pattern)
}
