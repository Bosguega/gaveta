use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

/// Paleta de fios Janome (.jef), idêntica a EmbThreadJef.get_thread_set()
/// do pyembroidery. O índice 0 é um placeholder "None" na referência: quando
/// o arquivo aponta para ele, a cor é simplesmente ignorada.
const JEF_THREAD_SET: [(u8, u8, u8); 79] = [
    (0, 0, 0),        // 0: Placeholder (nunca usado)
    (0x00, 0x00, 0x00), // 1: Black
    (0xFF, 0xFF, 0xFF), // 2: White
    (0xFF, 0xFF, 0x17), // 3: Yellow
    (0xFF, 0x66, 0x00), // 4: Orange
    (0x2F, 0x59, 0x33), // 5: Olive Green
    (0x23, 0x73, 0x36), // 6: Green
    (0x65, 0xC2, 0xC8), // 7: Sky
    (0xAB, 0x5A, 0x96), // 8: Purple
    (0xF6, 0x69, 0xA0), // 9: Pink
    (0xFF, 0x00, 0x00), // 10: Red
    (0xB1, 0x70, 0x4E), // 11: Brown
    (0x0B, 0x2F, 0x84), // 12: Blue
    (0xE4, 0xC3, 0x5D), // 13: Gold
    (0x48, 0x1A, 0x05), // 14: Dark Brown
    (0xAC, 0x9C, 0xC7), // 15: Pale Violet
    (0xFC, 0xF2, 0x94), // 16: Pale Yellow
    (0xF9, 0x99, 0xB7), // 17: Pale Pink
    (0xFA, 0xB3, 0x81), // 18: Peach
    (0xC9, 0xA4, 0x80), // 19: Beige
    (0x97, 0x05, 0x33), // 20: Wine Red
    (0xA0, 0xB8, 0xCC), // 21: Pale Sky
    (0x7F, 0xC2, 0x1C), // 22: Yellow Green
    (0xE5, 0xE5, 0xE5), // 23: Silver Gray
    (0x88, 0x9B, 0x9B), // 24: Gray
    (0x98, 0xD6, 0xBD), // 25: Pale Aqua
    (0xB2, 0xE1, 0xE3), // 26: Baby Blue
    (0x36, 0x8B, 0xA0), // 27: Powder Blue
    (0x4F, 0x83, 0xAB), // 28: Bright Blue
    (0x38, 0x6A, 0x91), // 29: Slate Blue
    (0x07, 0x16, 0x50), // 30: Navy Blue
    (0xF9, 0x99, 0xA2), // 31: Salmon Pink
    (0xF9, 0x67, 0x6B), // 32: Coral
    (0xE3, 0x31, 0x1F), // 33: Burnt Orange
    (0xE2, 0xA1, 0x88), // 34: Cinnamon
    (0xB5, 0x94, 0x74), // 35: Umber
    (0xE4, 0xCF, 0x99), // 36: Blond
    (0xFF, 0xCB, 0x00), // 37: Sunflower
    (0xE1, 0xAD, 0xD4), // 38: Orchid Pink
    (0xC3, 0x00, 0x7E), // 39: Peony Purple
    (0x80, 0x00, 0x4B), // 40: Burgundy
    (0x54, 0x05, 0x71), // 41: Royal Purple
    (0xB1, 0x05, 0x25), // 42: Cardinal Red
    (0xCA, 0xE0, 0xC0), // 43: Opal Green
    (0x89, 0x98, 0x56), // 44: Moss Green
    (0x5C, 0x94, 0x1A), // 45: Meadow Green
    (0x00, 0x31, 0x14), // 46: Dark Green
    (0x5D, 0xAE, 0x94), // 47: Aquamarine
    (0x4C, 0xBF, 0x8F), // 48: Emerald Green
    (0x00, 0x77, 0x72), // 49: Peacock Green
    (0x59, 0x5B, 0x61), // 50: Dark Gray
    (0xFF, 0xFF, 0xF2), // 51: Ivory White
    (0xB1, 0x58, 0x18), // 52: Hazel
    (0xCB, 0x8A, 0x07), // 53: Toast
    (0x98, 0x6C, 0x80), // 54: Salmon
    (0x98, 0x69, 0x2D), // 55: Cocoa Brown
    (0x4D, 0x34, 0x19), // 56: Sienna
    (0x4C, 0x33, 0x0B), // 57: Sepia
    (0x33, 0x20, 0x0A), // 58: Dark Sepia
    (0x52, 0x3A, 0x97), // 59: Violet Blue
    (0x0D, 0x21, 0x7E), // 60: Blue Ink
    (0x1E, 0x77, 0xAC), // 61: Sola Blue
    (0xB2, 0xDD, 0x53), // 62: Green Dust
    (0xF3, 0x36, 0x89), // 63: Crimson
    (0xDE, 0x64, 0x9E), // 64: Floral Pink
    (0x98, 0x41, 0x61), // 65: Wine
    (0x4C, 0x56, 0x12), // 66: Olive Drab
    (0x4C, 0x88, 0x1F), // 67: Meadow
    (0xE4, 0xDE, 0x79), // 68: Mustard
    (0xCB, 0x8A, 0x1A), // 69: Yellow Ocher
    (0xCB, 0xA2, 0x1C), // 70: Old Gold
    (0xFF, 0x98, 0x05), // 71: Honey Dew
    (0xFC, 0xB2, 0x57), // 72: Tangerine
    (0xFF, 0xE5, 0x05), // 73: Canary Yellow
    (0xF0, 0x33, 0x1F), // 74: Vermilion
    (0x1A, 0x84, 0x2D), // 75: Bright Green
    (0x38, 0x6C, 0xAE), // 76: Ocean Blue
    (0xE3, 0xC4, 0xB4), // 77: Beige Gray
    (0xE3, 0xAC, 0x81), // 78: Bamboo
];
/// Parser para arquivos de bordado Janome (.jef)
///
/// Alinhado com pyembroidery/JefReader:
/// - Offset dos pontos: u32 LE em 0x00.
/// - Contagem de cores: u32 LE em 0x18.
/// - Paleta: a partir de 0x74, `count_colors` índices u32 LE na tabela Janome.
/// - Stitches: pares i8; 0x80 + ctrl (0x01 = troca de cor, 0x02 = salto,
///   0x10 = fim). Qualquer outro código de controle encerra o parse
///   (comportamento defensivo da referência).
pub fn parse_jef(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 0x20 {
        return Err("Arquivo JEF muito curto".to_string());
    }

    let stitch_offset = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize;
    if stitch_offset >= bytes.len() {
        return Err("Offset de pontos JEF inválido".to_string());
    }

    let mut pattern = EmbroideryPattern::new();

    // Paleta: count_colors @ 0x18, entradas a partir de 0x74.
    if bytes.len() >= 0x1C {
        let color_count = u32::from_le_bytes([bytes[0x18], bytes[0x19], bytes[0x1A], bytes[0x1B]]) as usize;
        let mut palette = Vec::new();
        for i in 0..color_count {
            let pos = 0x74 + i * 4;
            if pos + 4 > bytes.len() {
                break;
            }
            let raw = u32::from_le_bytes([bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]]);
            let index = (raw as i64).unsigned_abs() as usize;
            if index == 0 {
                continue; // placeholder "None" da referência
            }
            if let Some(&(r, g, b)) = JEF_THREAD_SET.get(index % JEF_THREAD_SET.len()) {
                palette.push(Rgba([r, g, b, 255]));
            }
        }
        if !palette.is_empty() {
            pattern.palette = Some(palette);
        }
    }

    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;

    let mut i = stitch_offset;
    while i + 1 < bytes.len() {
        let b0 = bytes[i];
        let b1 = bytes[i + 1];
        i += 2;

        if b0 == 0x80 {
            if i + 1 >= bytes.len() {
                break;
            }
            let dx = bytes[i] as i8 as f32;
            let dy = bytes[i + 1] as i8 as f32;
            i += 2;

            match b1 {
                0x01 => {
                    // Troca de cor.
                    curr_x += dx;
                    curr_y += dy;
                    pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
                }
                0x02 => {
                    // Salto (jump).
                    curr_x += dx;
                    curr_y += dy;
                    pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
                }
                0x10 => {
                    // Fim do desenho.
                    pattern.add_stitch(curr_x, curr_y, StitchType::End);
                    break;
                }
                _ => {
                    // Código de controle não reconhecido: encerra a leitura
                    // de forma defensiva, como pyembroidery/JefReader.
                    break;
                }
            }
        } else {
            curr_x += b0 as i8 as f32;
            curr_y += b1 as i8 as f32;
            pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
        }
    }

    Ok(pattern)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodifica_stitch_jump_color_change_e_end() {
        let mut bytes = vec![0u8; 0x90];
        let stitch_offset: u32 = 0x80;
        bytes[0..4].copy_from_slice(&stitch_offset.to_le_bytes());

        let o = stitch_offset as usize;
        bytes[o] = 10;
        bytes[o + 1] = 20; // stitch (+10, +20)
        bytes[o + 2] = 0x80;
        bytes[o + 3] = 0x02; // jump
        bytes[o + 4] = 5;
        bytes[o + 5] = 6;
        bytes[o + 6] = 0x80;
        bytes[o + 7] = 0x01; // color change
        bytes[o + 8] = 0;
        bytes[o + 9] = 0;
        bytes[o + 10] = 0x80;
        bytes[o + 11] = 0x10; // fim

        let pattern = parse_jef(&bytes).unwrap();
        let types: Vec<StitchType> = pattern.stitches.iter().map(|s| s.stitch_type).collect();
        assert_eq!(
            types,
            vec![
                StitchType::Stitch,
                StitchType::Jump,
                StitchType::ColorChange,
                StitchType::End,
            ]
        );
    }

    #[test]
    fn le_paleta_do_header_com_indices_modulares() {
        let mut bytes = vec![0u8; 0x90];
        let stitch_offset: u32 = 0x88;
        bytes[0..4].copy_from_slice(&stitch_offset.to_le_bytes());
        // 2 cores @ 0x18.
        let color_count: u32 = 2;
        bytes[0x18..0x1C].copy_from_slice(&color_count.to_le_bytes());
        // Entradas @ 0x74: índice 3 (Yellow) e índice 82 (79+3 → modular → Yellow também? não:
        // 82 % 79 = 3 → Yellow). Usamos 3 e 4 (Orange) para diferenciar.
        let idx_a: u32 = 3;
        let idx_b: u32 = 4;
        bytes[0x74..0x78].copy_from_slice(&idx_a.to_le_bytes());
        bytes[0x78..0x7C].copy_from_slice(&idx_b.to_le_bytes());

        bytes[stitch_offset as usize] = 0x80;
        bytes[stitch_offset as usize + 1] = 0x10; // fim

        let pattern = parse_jef(&bytes).unwrap();
        let palette = pattern.palette.expect("paleta esperada");
        assert_eq!(palette.len(), 2);
        // Índice 3 => Yellow (0xFFFF17); índice 4 => Orange (0xFF6600).
        assert_eq!(palette[0].0, [0xFF, 0xFF, 0x17, 255]);
        assert_eq!(palette[1].0, [0xFF, 0x66, 0x00, 255]);
    }

    #[test]
    fn indice_zero_da_paleta_e_ignorado() {
        let mut bytes = vec![0u8; 0x90];
        let stitch_offset: u32 = 0x88;
        bytes[0..4].copy_from_slice(&stitch_offset.to_le_bytes());
        let color_count: u32 = 2;
        bytes[0x18..0x1C].copy_from_slice(&color_count.to_le_bytes());
        // Primeira entrada aponta para o placeholder (0): deve ser pulada.
        let zero: u32 = 0;
        let red: u32 = 10; // Red
        bytes[0x74..0x78].copy_from_slice(&zero.to_le_bytes());
        bytes[0x78..0x7C].copy_from_slice(&red.to_le_bytes());

        bytes[stitch_offset as usize] = 0x80;
        bytes[stitch_offset as usize + 1] = 0x10;

        let pattern = parse_jef(&bytes).unwrap();
        let palette = pattern.palette.expect("paleta esperada");
        assert_eq!(palette.len(), 1);
        assert_eq!(palette[0].0, [0xFF, 0x00, 0x00, 255]); // Red
    }

    #[test]
    fn codigo_de_controle_desconhecido_encerra_o_parse() {
        let mut bytes = vec![0u8; 0x98];
        let stitch_offset: u32 = 0x80;
        bytes[0..4].copy_from_slice(&stitch_offset.to_le_bytes());

        let o = stitch_offset as usize;
        bytes[o] = 1;
        bytes[o + 1] = 2; // stitch
        bytes[o + 2] = 0x80;
        bytes[o + 3] = 0x55; // controle desconhecido
        bytes[o + 4] = 9;
        bytes[o + 5] = 9; // não deve virar stitch
        bytes[o + 6] = 0x80;
        bytes[o + 7] = 0x10; // fim (nunca alcançado)

        let pattern = parse_jef(&bytes).unwrap();
        assert_eq!(pattern.stitches.len(), 1);
        assert_eq!(pattern.stitches[0].stitch_type, StitchType::Stitch);
    }
}
