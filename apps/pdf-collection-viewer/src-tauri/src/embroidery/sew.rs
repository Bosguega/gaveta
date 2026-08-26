use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

/// Paleta de fios Janome/Elna/Kenmore (.sew), idêntica a
/// EmbThreadSew.get_thread_set() do pyembroidery (79 entradas).
const SEW_THREAD_SET: [(u8, u8, u8); 79] = [
    (0, 0, 0),        // 0: Unknown
    (0, 0, 0),        // 1: Black
    (255, 255, 255),  // 2: White
    (255, 255, 23),   // 3: Sunflower
    (250, 160, 96),   // 4: Hazel
    (92, 118, 73),    // 5: Green Dust
    (64, 192, 48),    // 6: Green
    (101, 194, 200),  // 7: Sky
    (172, 128, 190),  // 8: Purple
    (245, 188, 203),  // 9: Pink
    (255, 0, 0),      // 10: Red
    (192, 128, 0),    // 11: Brown
    (0, 0, 240),      // 12: Blue
    (228, 195, 93),   // 13: Gold
    (165, 42, 42),    // 14: Dark Brown
    (213, 176, 212),  // 15: Pale Violet
    (252, 242, 148),  // 16: Pale Yellow
    (240, 208, 192),  // 17: Pale Pink
    (255, 192, 0),    // 18: Peach
    (201, 164, 128),  // 19: Beige
    (155, 61, 75),    // 20: Wine Red
    (160, 184, 204),  // 21: Pale Sky
    (127, 194, 28),   // 22: Yellow Green
    (185, 185, 185),  // 23: Silver Grey
    (160, 160, 160),  // 24: Grey
    (152, 214, 189),  // 25: Pale Aqua
    (184, 240, 240),  // 26: Baby Blue
    (54, 139, 160),   // 27: Powder Blue
    (79, 131, 171),   // 28: Bright Blue
    (56, 106, 145),   // 29: Slate Blue
    (0, 32, 107),     // 30: Nave Blue
    (229, 197, 202),  // 31: Salmon Pink
    (249, 103, 107),  // 32: Coral
    (227, 49, 31),    // 33: Burnt Orange
    (226, 161, 136),  // 34: Cinnamon
    (181, 148, 116),  // 35: Umber
    (228, 207, 153),  // 36: Blonde
    (225, 203, 0),    // 37: Sunflower
    (225, 173, 212),  // 38: Orchid Pink
    (195, 0, 126),    // 39: Peony Purple
    (128, 0, 75),     // 40: Burgundy
    (160, 96, 176),   // 41: Royal Purple
    (192, 64, 32),    // 42: Cardinal Red
    (202, 224, 192),  // 43: Opal Green
    (137, 152, 86),   // 44: Moss Green
    (0, 170, 0),      // 45: Meadow Green
    (33, 138, 33),    // 46: Dark Green
    (93, 174, 148),   // 47: Aquamarine
    (76, 191, 143),   // 48: Emerald Green
    (0, 119, 114),    // 49: Peacock Green
    (112, 112, 112),  // 50: Dark Grey
    (242, 255, 255),  // 51: Ivory White
    (177, 88, 24),    // 52: Hazel
    (203, 138, 7),    // 53: Toast
    (247, 146, 123),  // 54: Salmon
    (152, 105, 45),   // 55: Cocoa Brown
    (162, 113, 72),   // 56: Sienna
    (123, 85, 74),    // 57: Sepia
    (79, 57, 70),     // 58: Dark Sepia
    (82, 58, 151),    // 59: Violet Blue
    (0, 0, 160),      // 60: Blue Ink
    (0, 150, 222),    // 61: Solar Blue
    (178, 221, 83),   // 62: Green Dust
    (250, 143, 187),  // 63: Crimson
    (222, 100, 158),  // 64: Floral Pink
    (181, 80, 102),   // 65: Wine
    (94, 87, 71),     // 66: Olive Drab
    (76, 136, 31),    // 67: Meadow
    (228, 220, 121),  // 68: Canary Yellow
    (203, 138, 26),   // 69: Toast
    (198, 170, 66),   // 70: Beige
    (236, 176, 44),   // 71: Honey Dew
    (248, 128, 64),   // 72: Tangerine
    (255, 229, 5),    // 73: Ocean Blue
    (250, 122, 122),  // 74: Sepia
    (107, 224, 0),    // 75: Royal Purple
    (56, 108, 174),   // 76: Yellow Ocher
    (208, 186, 176),  // 77: Beige Grey
    (227, 190, 129),  // 78: Bamboo
];
/// Parser para arquivos de bordado Janome / Elna / Kenmore (.sew)
///
/// Alinhado com pyembroidery/SewReader:
/// - Contagem de cores: u16 LE em 0x00; índices u16 LE a partir de 0x02,
///   aplicando módulo pelo tamanho da paleta.
/// - Stitches começam em 0x1D78.
/// - 0x80 + ctrl: qualquer ctrl ímpar = troca de cor; 0x02/0x04 = salto;
///   0x10 = ponto normal (não é fim!); qualquer outro controle encerra.
pub fn parse_sew(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 0x1D78 {
        return Err("Arquivo SEW muito curto".to_string());
    }

    let mut pattern = EmbroideryPattern::new();

    let color_count = u16::from_le_bytes([bytes[0], bytes[1]]) as usize;
    let mut palette = Vec::new();

    for i in 0..color_count {
        let pos = 0x02 + i * 2;
        if pos + 1 >= bytes.len() || pos + 1 >= 0x1D78 {
            break;
        }
        let idx = u16::from_le_bytes([bytes[pos], bytes[pos + 1]]) as usize % SEW_THREAD_SET.len();
        let (r, g, b) = SEW_THREAD_SET[idx];
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

        if b0 != 0x80 {
            curr_x += b0 as i8 as f32;
            curr_y += -(b1 as i8 as f32);
            pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
            continue;
        }

        // Comando 0x80: sempre consome mais 2 bytes antes de decidir.
        if i + 1 >= bytes.len() {
            break;
        }
        let ctrl = b1;
        let dx = bytes[i] as i8 as f32;
        let dy = -(bytes[i + 1] as i8 as f32);
        i += 2;

        if ctrl & 0x01 != 0 {
            // Qualquer controle ímpar é troca de cor.
            pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
        } else if ctrl == 0x04 || ctrl == 0x02 {
            curr_x += dx;
            curr_y += dy;
            pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
        } else if ctrl == 0x10 {
            // Na referência SEW, 0x10 é um ponto normal (NÃO é fim).
            curr_x += dx;
            curr_y += dy;
            pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
        } else {
            // Controle desconhecido encerra o parse (referência).
            break;
        }
    }

    Ok(pattern)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comando_0x10_e_ponto_normal_nao_fim() {
        // Buffer termina logo após o comando.
        let mut bytes = vec![0u8; 0x1D7C];
        let o = 0x1D78;
        bytes[o] = 0x80;
        bytes[o + 1] = 0x10;
        bytes[o + 2] = 3;
        bytes[o + 3] = 4; // 0x10 => stitch (+3, -4)

        let pattern = parse_sew(&bytes).unwrap();
        assert_eq!(pattern.stitches.len(), 1);
        assert_eq!(pattern.stitches[0].stitch_type, StitchType::Stitch);
        assert_eq!(pattern.stitches[0].x, 3.0);
    }

    #[test]
    fn controle_impar_e_troca_de_cor() {
        let mut bytes = vec![0u8; 0x1D7C];
        let o = 0x1D78;
        bytes[o] = 0x80;
        bytes[o + 1] = 0x03; // ímpar => color change
        bytes[o + 2] = 9;
        bytes[o + 3] = 9;

        let pattern = parse_sew(&bytes).unwrap();
        assert_eq!(pattern.stitches.len(), 1);
        assert_eq!(pattern.stitches[0].stitch_type, StitchType::ColorChange);
    }

    #[test]
    fn le_paleta_com_modulo() {
        let mut bytes = vec![0u8; 0x1D90];
        // 2 cores; segundo índice grande para exercitar o módulo.
        bytes[0] = 2;
        bytes[2..4].copy_from_slice(&10u16.to_le_bytes()); // Red
        bytes[4..6].copy_from_slice(&81u16.to_le_bytes()); // 81 % 79 = 2 → White

        let pattern = parse_sew(&bytes).unwrap();
        let palette = pattern.palette.expect("paleta esperada");
        assert_eq!(palette.len(), 2);
        assert_eq!(palette[0].0, [255, 0, 0, 255]);
        assert_eq!(palette[1].0, [255, 255, 255, 255]);
    }
}
