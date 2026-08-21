use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

// Paleta oficial Brother PEC (índices 0..64)
const BROTHER_PALETTE: [(u8, u8, u8); 65] = [
    (0, 0, 0),        // 0: Unknown / Black
    (14, 31, 124),    // 1: Prussian Blue
    (10, 87, 163),    // 2: Blue
    (0, 158, 219),    // 3: Deep Sky Blue
    (20, 169, 160),   // 4: Teal Green
    (96, 196, 161),   // 5: Mint Green
    (31, 141, 73),    // 6: Emerald Green
    (59, 180, 56),    // 7: Lime Green
    (149, 211, 70),   // 8: Brass
    (84, 115, 22),    // 9: Moss Green
    (107, 142, 35),   // 10: Olive Green
    (185, 178, 129),  // 11: Cream Brown
    (148, 121, 93),   // 12: Beige
    (139, 115, 85),   // 13: Light Brown
    (112, 66, 20),    // 14: Amber Brown
    (106, 28, 13),    // 15: Dark Brown
    (237, 23, 75),    // 16: Red
    (234, 101, 127),  // 17: Deep Rose
    (238, 153, 170),  // 18: Pink
    (218, 59, 137),   // 19: Magenta
    (155, 38, 130),   // 20: Violet
    (118, 43, 133),   // 21: Purple
    (240, 130, 0),    // 22: Orange
    (245, 176, 65),   // 23: Gold
    (247, 218, 33),   // 24: Yellow
    (250, 240, 165),  // 25: Light Yellow
    (180, 180, 180),  // 26: Silver
    (140, 140, 140),  // 27: Gray
    (40, 40, 40),     // 28: Dark Gray
    (255, 255, 255),  // 29: White
    (96, 60, 20),     // 30: Brown
    (210, 120, 70),   // 31: Clay Brown
    (100, 160, 200),  // 32: Sky Blue
    (150, 200, 80),   // 33: Yellow Green
    (220, 190, 150),  // 34: Linen
    (240, 210, 180),  // 35: Flesh Pink
    (250, 230, 200),  // 36: Cream
    (80, 50, 100),    // 37: Dark Olive
    (180, 70, 90),    // 38: Mauve
    (200, 100, 130),  // 39: Carmine
    (230, 130, 150),  // 40: Warm Pink
    (120, 140, 180),  // 41: Gray Blue
    (100, 120, 140),  // 42: Slate Gray
    (80, 160, 180),   // 43: Turquoise
    (180, 150, 120),  // 44: Khaki
    (200, 180, 140),  // 45: Light Khaki
    (240, 180, 130),  // 46: Salmon Pink
    (230, 160, 100),  // 47: Peach
    (220, 130, 60),   // 48: Pumpkin
    (180, 120, 40),   // 49: Bronze
    (130, 90, 30),    // 50: Copper
    (90, 60, 20),     // 51: Rust
    (160, 30, 50),    // 52: Burgundy
    (20, 20, 80),     // 53: Midnight Navy
    (30, 100, 150),   // 54: Royal Blue
    (50, 120, 100),   // 55: Forest Green
    (100, 150, 100),  // 56: Moss
    (120, 80, 120),   // 57: Plum
    (160, 100, 150),  // 58: Lilac
    (240, 100, 80),   // 59: Coral
    (220, 200, 50),   // 60: Mustard
    (200, 200, 200),  // 61: Light Gray
    (120, 120, 120),  // 62: Med Gray
    (60, 60, 60),     // 63: Charcoal
    (0, 0, 0),        // 64: Jet Black
];

/// Parser para arquivos de bordado Brother (.pes / .pec)
pub fn parse_pes(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 8 {
        return Err("Arquivo PES inválido (muito curto)".to_string());
    }

    let pec_offset = if bytes.starts_with(b"#PES") {
        if bytes.len() < 12 {
            return Err("Cabeçalho PES truncado".to_string());
        }
        u32::from_le_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]) as usize
    } else if bytes.starts_with(b"#PEC") {
        0
    } else {
        // Tenta buscar "#PEC" nos primeiros 2KB do arquivo
        bytes.windows(4)
            .position(|w| w == b"#PEC")
            .ok_or_else(|| "Assinatura PES/PEC não encontrada no arquivo".to_string())?
    };

    if pec_offset + 512 > bytes.len() {
        return Err("Bloco PEC fora dos limites do arquivo".to_string());
    }

    let pec_data = &bytes[pec_offset..];
    if !pec_data.starts_with(b"#PEC") {
        return Err("Cabeçalho PEC não localizado na posição esperada".to_string());
    }

    // 1. Extrai a paleta de cores do cabeçalho PEC
    let num_colors = if pec_data.len() > 48 { pec_data[48] as usize + 1 } else { 1 };
    let mut palette = Vec::new();

    if pec_data.len() >= 49 + num_colors {
        for i in 0..num_colors {
            let color_idx = pec_data[49 + i] as usize;
            let (r, g, b) = if color_idx < BROTHER_PALETTE.len() {
                BROTHER_PALETTE[color_idx]
            } else {
                (30, 30, 30)
            };
            palette.push(Rgba([r, g, b, 255]));
        }
    }

    // 2. Localiza início da tabela de pontos PEC (offset 0x200 / 512 dentro do bloco PEC)
    let stitch_offset = 512;
    if pec_data.len() <= stitch_offset {
        return Err("Stream de pontos PEC ausente".to_string());
    }

    let mut pattern = EmbroideryPattern::new();
    if !palette.is_empty() {
        pattern.palette = Some(palette);
    }

    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;
    let mut i = stitch_offset;

    while i < pec_data.len() {
        let b0 = pec_data[i];
        i += 1;

        if b0 == 0xFF {
            // Fim do desenho
            pattern.add_stitch(curr_x, curr_y, StitchType::End);
            break;
        }

        if b0 == 0xFE && i < pec_data.len() && pec_data[i] == 0xB0 {
            // Troca de cor PEC: 0xFE 0xB0 <color_idx>
            i += 2;
            pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
            continue;
        }

        // Decodificação de coordenada X
        let (dx, is_jump_x) = decode_pec_coordinate(b0, &pec_data, &mut i);

        // Decodificação de coordenada Y
        if i >= pec_data.len() {
            break;
        }
        let b1 = pec_data[i];
        i += 1;
        let (dy, is_jump_y) = decode_pec_coordinate(b1, &pec_data, &mut i);

        curr_x += dx as f32;
        curr_y += dy as f32;

        let stitch_type = if is_jump_x || is_jump_y {
            StitchType::Jump
        } else {
            StitchType::Stitch
        };

        pattern.add_stitch(curr_x, curr_y, stitch_type);
    }

    Ok(pattern)
}

fn decode_pec_coordinate(val: u8, data: &[u8], i: &mut usize) -> (i32, bool) {
    if val & 0x80 != 0 {
        // Ponto longo de 12 bits com salto
        if *i < data.len() {
            let next = data[*i];
            *i += 1;
            let mut num = (((val & 0x0F) as i32) << 8) | (next as i32);
            if num & 0x0800 != 0 {
                num -= 0x1000;
            }
            (num, true)
        } else {
            (0, true)
        }
    } else {
        // Ponto normal de 7 bits
        let mut num = val as i32;
        if num >= 64 {
            num -= 128;
        }
        (num, false)
    }
}
