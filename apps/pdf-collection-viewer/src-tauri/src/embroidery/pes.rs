use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

// Paleta Brother PEC (índices 0..64)
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

/// Localiza a seção de dados PEC dentro de um arquivo PES.
///
/// PES começa com:
///     #PESxxxx
///
/// Os bytes 8..12 contêm um offset absoluto, em little-endian,
/// apontando para a seção de dados PEC/PES incorporada.
fn locate_pes_pec(bytes: &[u8]) -> Result<usize, String> {
    if bytes.len() < 12 {
        return Err("Arquivo PES muito curto".to_string());
    }

    if !bytes.starts_with(b"#PES") {
        return Err("Assinatura #PES não encontrada".to_string());
    }

    let offset =
        u32::from_le_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]) as usize;

    if offset >= bytes.len() {
        return Err(format!(
            "Offset da seção PES fora dos limites: {} / {}",
            offset,
            bytes.len()
        ));
    }

    Ok(offset)
}

/// Tenta localizar o início do stream de stitches dentro da seção PEC.
///
/// Algumas versões do PES usam cabeçalhos de tamanhos diferentes.
/// Esta função prioriza o offset padrão da versão e usa detecção
/// heurística apenas como fallback.
fn find_stitch_stream_start(pec: &[u8], pec_offset: usize, version: &str) -> Result<usize, String> {
    let default_offsets: std::collections::HashMap<&str, usize> = [
        ("0050", 528),
        ("0001", 512),
        ("0060", 528),
    ].iter().cloned().collect();

    let default_rel = default_offsets.get(version).copied().unwrap_or(512);
    let default_offset = pec_offset + default_rel;

    if default_rel < pec.len() && looks_like_stitch_stream(&pec[default_rel..]) {
        return Ok(default_offset);
    }

    let candidates = match version {
        "0050" => vec![528, 512, 256],
        "0001" => vec![512, 528, 256],
        "0060" => vec![528, 512, 256],
        _ => vec![512, 528, 256],
    };

    for &rel in &candidates {
        if rel >= pec.len() {
            continue;
        }

        if looks_like_stitch_stream(&pec[rel..]) {
            return Ok(pec_offset + rel);
        }
    }

    if default_rel < pec.len() {
        return Ok(default_offset);
    }

    Err("Não foi possível localizar o stream de stitches".to_string())
}

/// Heurística para verificar se uma região parece conter um stream de stitches válido.
fn looks_like_stitch_stream(data: &[u8]) -> bool {
    if data.len() < 4 {
        return false;
    }

    let mut valid_pairs = 0;
    let mut cursor = 0;
    let mut has_non_zero = false;

    while cursor < data.len() - 1 && valid_pairs < 5 {
        let first = data[cursor];

        if first == 0xFF {
            break;
        }

        if first == 0xFE {
            cursor += 1;
            if cursor >= data.len() {
                break;
            }
            let cmd = data[cursor];
            cursor += 1;
            match cmd {
                0xB0 | 0xB1 => {
                    if cursor < data.len() {
                        cursor += 1;
                    }
                }
                _ => {}
            }
            continue;
        }

        if first != 0 {
            has_non_zero = true;
        }

        if first & 0x80 != 0 {
            cursor += 1;
            if cursor >= data.len() {
                break;
            }
            let second = data[cursor];
            if second == 0xFF || second == 0xFE {
                break;
            }
            if second != 0 {
                has_non_zero = true;
            }
            valid_pairs += 1;
            cursor += 1;
        } else {
            if cursor + 1 >= data.len() {
                break;
            }
            let second = data[cursor + 1];
            if second == 0xFF || second == 0xFE {
                break;
            }
            if second != 0 {
                has_non_zero = true;
            }
            valid_pairs += 1;
            cursor += 2;
        }
    }

    valid_pairs >= 2 && has_non_zero
}

/// Extrai a paleta Brother PEC da seção incorporada ao PES.
///
/// Estrutura utilizada:
///     pec[48]     = número de mudanças de cor
///     pec[49..]   = índices da paleta
///
/// Número de cores = mudanças de cor + 1.
fn parse_pes_palette(pec: &[u8]) -> Vec<Rgba<u8>> {
    if pec.len() < 49 {
        return vec![Rgba([0, 0, 0, 255])];
    }

    let color_changes = pec[48];

    // 0xFF indica que a informação de cores não está disponível.
    if color_changes == 0xFF {
        return vec![Rgba([0, 0, 0, 255])];
    }

    let color_count = (color_changes as usize) + 1;

    let available = pec.len().saturating_sub(49);
    let color_count = color_count.min(available);

    let mut palette = Vec::with_capacity(color_count);

    for i in 0..color_count {
        let palette_index = pec[49 + i] as usize;

        let (r, g, b) = BROTHER_PALETTE
            .get(palette_index)
            .copied()
            .unwrap_or((30, 30, 30));

        palette.push(Rgba([r, g, b, 255]));
    }

    if palette.is_empty() {
        palette.push(Rgba([0, 0, 0, 255]));
    }

    palette
}

/// Decodifica uma coordenada do stream de stitches PES.
///
/// Retorna:
///     (delta, is_jump, is_trim)
///
/// Formato curto:
///     0xxxxxxx
///
/// Formato longo:
///     1xxx???? ????????
///
/// No formato longo:
///     0x10 = Jump
///     0x20 = Trim
///     0x0F = bits superiores da coordenada
///
/// A coordenada longa é um inteiro assinado de 12 bits.
fn decode_pes_coordinate(
    byte: u8,
    data: &[u8],
    cursor: &mut usize,
) -> Result<(i32, bool, bool), String> {
    // Coordenada longa
    if byte & 0x80 != 0 {
        if *cursor >= data.len() {
            return Err("Coordenada PES longa truncada".to_string());
        }

        let low = data[*cursor];
        *cursor += 1;

        let is_jump = byte & 0x10 != 0;
        let is_trim = byte & 0x20 != 0;

        // IMPORTANTE:
        // Converter para i32 antes do shift evita overflow de u8.
        let mut value =
            (((byte & 0x0F) as i32) << 8) | (low as i32);

        // Converte signed 12-bit para i32.
        if value & 0x800 != 0 {
            value -= 0x1000;
        }

        Ok((value, is_jump, is_trim))
    } else {
        // Coordenada curta: signed 7-bit.
        let value = if byte & 0x40 != 0 {
            byte as i32 - 0x80
        } else {
            byte as i32
        };

        Ok((value, false, false))
    }
}

/// Parser para arquivos Brother PES.
///
/// Suporta múltiplas versões (PES0001, PES0050, PES0060, etc.).
/// A versão é detectada automaticamente pelo cabeçalho.
pub fn parse_pes(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 12 {
        return Err("Arquivo PES/PEC inválido (muito curto)".to_string());
    }

    // ------------------------------------------------------------
    // Identificação da versão / formato
    // ------------------------------------------------------------

    let is_pec = bytes.starts_with(b"#PEC");
    let is_pes = bytes.starts_with(b"#PES");

    if !is_pec && !is_pes {
        return Err("Assinatura #PES ou #PEC não encontrada".to_string());
    }

    let version = if is_pes {
        String::from_utf8_lossy(&bytes[4..8]).to_string()
    } else {
        "PEC".to_string()
    };

    // ------------------------------------------------------------
    // Localiza a seção incorporada
    // ------------------------------------------------------------

    let pec_offset = if is_pec {
        0
    } else {
        locate_pes_pec(bytes)?
    };

    let pec = &bytes[pec_offset..];

    // PEC standalone começa com #PEC.
    // PES incorporado pode começar com "LA:" ou outros metadados.
    if is_pec && !pec.starts_with(b"#PEC") {
        return Err("Bloco PEC inválido".to_string());
    }

    // ------------------------------------------------------------
    // Paleta
    // ------------------------------------------------------------

    let palette = parse_pes_palette(pec);

    // ------------------------------------------------------------
    // Stream de stitches
    // ------------------------------------------------------------

    let stitch_offset = if is_pec {
        pec_offset + 512
    } else {
        find_stitch_stream_start(pec, pec_offset, &version)?
    };

    // ------------------------------------------------------------
    // Inicialização do padrão
    // ------------------------------------------------------------

    let mut pattern = EmbroideryPattern::new();
    pattern.palette = Some(palette);

    // PES0050 usa convenção de Y invertida (crescente para baixo).
    // PEC standalone e outras versões PES usam convenção normal.
    pattern.invert_y = version == "0050";

    let mut cursor = stitch_offset;

    let mut x = 0.0f32;
    let mut y = 0.0f32;

    // ------------------------------------------------------------
    // Leitura dos stitches
    // ------------------------------------------------------------

    while cursor < bytes.len() {
        let first = bytes[cursor];
        cursor += 1;

        // --------------------------------------------------------
        // Fim do desenho
        // --------------------------------------------------------

        if first == 0xFF {
            if cursor < bytes.len() && bytes[cursor] == 0x00 {
            }
            pattern.add_stitch(x, y, StitchType::End);
            break;
        }

        // --------------------------------------------------------
        // Comandos especiais (0xFE)
        // --------------------------------------------------------

        if first == 0xFE {
            if cursor >= bytes.len() {
                break;
            }

            let cmd = bytes[cursor];
            cursor += 1;

            match cmd {
                0xB0 => {
                    if cursor < bytes.len() {
                        cursor += 1;
                    }

                    pattern.add_stitch(x, y, StitchType::ColorChange);
                }
                0xB1 => {
                    if cursor < bytes.len() {
                        cursor += 1;
                    }

                    pattern.add_stitch(x, y, StitchType::Jump);
                }
                _ => {
                    if cursor < bytes.len() {
                        cursor += 1;
                    }
                }
            }

            continue;
        }

        // --------------------------------------------------------
        // Coordenada X
        // --------------------------------------------------------

        let (dx, jump_x, trim_x) =
            decode_pes_coordinate(first, bytes, &mut cursor)?;

        // --------------------------------------------------------
        // Coordenada Y
        // --------------------------------------------------------

        if cursor >= bytes.len() {
            return Err(
                "Coordenada Y ausente no final do stream PES".to_string()
            );
        }

        let second = bytes[cursor];
        cursor += 1;

        let (dy, jump_y, trim_y) =
            decode_pes_coordinate(second, bytes, &mut cursor)?;

        x += dx as f32;
        y += dy as f32;

        // --------------------------------------------------------
        // Tipo do ponto
        // --------------------------------------------------------

        let stitch_type =
            if jump_x || jump_y || trim_x || trim_y {
                StitchType::Jump
            } else {
                StitchType::Stitch
            };

        pattern.add_stitch(x, y, stitch_type);
    }

    // Evita devolver um padrão aparentemente válido,
    // mas completamente vazio.
    if pattern.stitches.is_empty() {
        return Err(
            "Nenhum stitch foi encontrado no stream PES".to_string()
        );
    }

    Ok(pattern)
}