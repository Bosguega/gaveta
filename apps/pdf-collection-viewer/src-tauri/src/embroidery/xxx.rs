use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

/// Parser para arquivos de bordado Melco Condensed (.xxx)
///
/// Alinhado com pyembroidery/XxxReader:
/// - Contagem de cores: u16 little-endian em 0x27.
/// - Stitches começam em 0x100 como pares i8 (dx, dy) com Y negado.
/// - 0x7D/0x7E: salto longo com dois i16 LE.
/// - 0x7F seguido de sub-código: 0x01 = movimento sem costura, 0x03 = trim
///   (com movimento opcional), 0x08/0x0A–0x17 = troca de cor, 0x7F/0x18 = fim.
/// - Após o fim (+2 bytes) vêm `num_of_colors` cores como u32 big-endian.
pub fn parse_xxx(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 0x100 {
        return Err("Arquivo XXX muito curto".to_string());
    }

    // pyembroidery lê o número de cores em 0x27 (não em 0x00).
    let color_count = u16::from_le_bytes([bytes[0x27], bytes[0x28]]) as usize;

    let mut pattern = EmbroideryPattern::new();
    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;
    let mut palette_start: Option<usize> = None;

    let mut i = 0x100usize;
    while i < bytes.len() {
        let b1 = bytes[i];
        i += 1;

        // Salto longo: dois i16 little-endian.
        if b1 == 0x7D || b1 == 0x7E {
            if i + 4 > bytes.len() {
                break;
            }
            let dx = i16::from_le_bytes([bytes[i], bytes[i + 1]]) as f32;
            let dy = -(i16::from_le_bytes([bytes[i + 2], bytes[i + 3]]) as f32);
            i += 4;
            curr_x += dx;
            curr_y += dy;
            pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
            continue;
        }

        if i >= bytes.len() {
            break;
        }
        let b2 = bytes[i];
        i += 1;

        // Par normal de costura.
        if b1 != 0x7F {
            curr_x += b1 as i8 as f32;
            curr_y += -(b2 as i8 as f32);
            pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
            continue;
        }

        // Comando 0x7F: sempre consome mais 2 bytes de parâmetro.
        if i + 2 > bytes.len() {
            break;
        }
        let b3 = bytes[i];
        let b4 = bytes[i + 1];
        i += 2;

        match b2 {
            0x01 => {
                // Movimento sem costura (jump).
                let dx = b3 as i8 as f32;
                let dy = -(b4 as i8 as f32);
                curr_x += dx;
                curr_y += dy;
                pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
            }
            0x03 => {
                // Trim: corta a linha; move apenas se o delta não for nulo.
                pattern.add_stitch(curr_x, curr_y, StitchType::Trim);
                let dx = b3 as i8 as f32;
                let dy = -(b4 as i8 as f32);
                if dx != 0.0 || dy != 0.0 {
                    curr_x += dx;
                    curr_y += dy;
                    pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
                }
            }
            0x08 | 0x0A..=0x17 => {
                // Troca de cor: os 2 bytes de parâmetro são descartados.
                pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
            }
            0x7F | 0x18 => {
                // Fim do desenho.
                pattern.add_stitch(curr_x, curr_y, StitchType::End);
                palette_start = Some(i);
                break;
            }
            // Sub-código desconhecido: ignorado silenciosamente,
            // mesmo comportamento da referência.
            _ => {}
        }
    }
    // Paleta: logo após o fim (+2 bytes de folga), `num_of_colors` cores
    // codificadas como u32 big-endian (RGB nos 3 bytes inferiores).
    if let Some(start) = palette_start {
        let mut p = start + 2;
        let mut palette = Vec::new();
        for _ in 0..color_count {
            if p + 4 > bytes.len() {
                break;
            }
            let v = u32::from_be_bytes([bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]]);
            p += 4;
            palette.push(Rgba([
                ((v >> 16) & 0xFF) as u8,
                ((v >> 8) & 0xFF) as u8,
                (v & 0xFF) as u8,
                255,
            ]));
        }
        if !palette.is_empty() {
            pattern.palette = Some(palette);
        }
    }

    Ok(pattern)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodifica_stitch_color_change_e_end() {
        let mut bytes = vec![0u8; 0x110];
        bytes[0x27] = 1; // contagem de cores em 0x27

        bytes[0x100] = 10;
        bytes[0x101] = 20; // stitch (+10, -20)
        bytes[0x102] = 0x7F;
        bytes[0x103] = 0x08;
        bytes[0x104] = 0x00;
        bytes[0x105] = 0x00; // color change (consome 2 parâmetros)
        bytes[0x106] = 5;
        bytes[0x107] = 10; // stitch (+5, -10)
        bytes[0x108] = 0x7F;
        bytes[0x109] = 0x7F;
        bytes[0x10A] = 0x02;
        bytes[0x10B] = 0x14; // fim

        let pattern = parse_xxx(&bytes).unwrap();
        let types: Vec<StitchType> = pattern.stitches.iter().map(|s| s.stitch_type).collect();
        assert_eq!(
            types,
            vec![
                StitchType::Stitch,
                StitchType::ColorChange,
                StitchType::Stitch,
                StitchType::End,
            ]
        );
        assert_eq!(pattern.stitches.len(), 4);
    }

    #[test]
    fn trim_quebra_a_linha() {
        // Buffer termina logo após o comando para não gerar stitches extras.
        let mut bytes = vec![0u8; 0x104];
        bytes[0x100] = 0x7F;
        bytes[0x101] = 0x03;
        bytes[0x102] = 3;
        bytes[0x103] = 4; // trim + move (3, -4)

        let pattern = parse_xxx(&bytes).unwrap();
        let types: Vec<StitchType> = pattern.stitches.iter().map(|s| s.stitch_type).collect();
        assert_eq!(types, vec![StitchType::Trim, StitchType::Jump]);
        assert_eq!(pattern.stitches.last().unwrap().x, 3.0);
    }

    #[test]
    fn le_paleta_rgb_apos_o_fim() {
        let mut bytes = vec![0u8; 0x118];
        bytes[0x27] = 2; // 2 cores

        bytes[0x100] = 0x7F;
        bytes[0x101] = 0x7F;
        bytes[0x102] = 0x02;
        bytes[0x103] = 0x14; // fim

        // +2 bytes de folga => paleta em 0x106.
        // 1ª cor em 0x106..0x10A: 0x00FF0000 => vermelho
        bytes[0x107] = 0xFF;
        // 2ª cor em 0x10A..0x10E: 0x000000FF => azul
        bytes[0x10D] = 0xFF;

        let pattern = parse_xxx(&bytes).unwrap();
        let palette = pattern.palette.expect("paleta esperada");
        assert_eq!(palette.len(), 2);
        assert_eq!(palette[0].0, [255, 0, 0, 255]);
        assert_eq!(palette[1].0, [0, 0, 255, 255]);
    }

    #[test]
    fn salto_longo_usa_i16() {
        // Buffer termina logo após o salto.
        let mut bytes = vec![0u8; 0x105];
        bytes[0x100] = 0x7D;
        // dx = 300 (0x012C LE); dy bruto = -300 => +300 após negação.
        bytes[0x101] = 0x2C;
        bytes[0x102] = 0x01;
        bytes[0x103] = 0xD4;
        bytes[0x104] = 0xFE;

        let pattern = parse_xxx(&bytes).unwrap();
        assert_eq!(pattern.stitches.len(), 1);
        assert_eq!(pattern.stitches[0].stitch_type, StitchType::Jump);
        assert_eq!(pattern.stitches[0].x, 300.0);
        assert_eq!(pattern.stitches[0].y, 300.0);
    }
}
