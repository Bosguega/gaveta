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

/// Localiza o início do stream de stitches dentro da seção PEC.
///
/// Cálculo determinístico a partir da base "LA:" (ver pyembroidery
/// PecReader.read_pec):
///     48           = contagem de mudanças de cor (cc)
///     leitura avança até 50+cc; depois seek (0x1D0 - cc)
///     => marca 0x31 FF F0 em 514+3 = 517
///     +3 (tamanho) => 520, +0x0B => 528 = primeiro byte do stream
///
/// Para arquivos bem-formados o resultado é SEMPRE base + 528,
/// independente da versão ou do número de cores.
fn find_stitch_stream_start(pec: &[u8], _version: &str) -> Result<usize, String> {
    // 50 + cc + (0x1D0 - cc) + 3 + 0x0B = 528
    const STITCH_STREAM_REL: usize = 528;

    if STITCH_STREAM_REL >= pec.len() {
        return Err("Arquivo PES muito curto para conter stitches".to_string());
    }

    Ok(STITCH_STREAM_REL)
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
///     Some((delta, is_jump, is_trim)) | None quando o stream termina
///     de forma truncada no meio de uma coordenada longa (deve ser
///     tratado como fim do desenho, como na referência).
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
) -> Result<Option<(i32, bool, bool)>, String> {
    // Coordenada longa
    if byte & 0x80 != 0 {
        if *cursor >= data.len() {
            return Ok(None);
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

        Ok(Some((value, is_jump, is_trim)))
    } else {
        // Coordenada curta: signed 7-bit.
        let value = if byte & 0x40 != 0 {
            byte as i32 - 0x80
        } else {
            byte as i32
        };

        Ok(Some((value, false, false)))
    }
}

/// Parser para arquivos Brother PES.
///
/// Suporta múltiplas versões (PES0001, PES0050, PES0060, etc.) e também
/// arquivos PEC standalone ("#PEC0001").
///
/// Layout interno do bloco PEC, a partir da base P (ver pyembroidery,
/// PecReader.read_pec):
///     P + 48       = contagem de mudanças de cor
///     P + 49..     = índices da paleta (n = mudanças + 1)
///     P + 528      = primeiro byte do stream de stitches
///                    (50 + n + (0x1D0 - cc) + 3 + 0x0B => constante 528)
///
/// Arquivos .pec iniciam com a assinatura "#PEC0001" (8 bytes) que deve
/// ser consumida antes de aplicar os offsets acima.
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

    // Base do conteúdo PEC dentro do slice `bytes`.
    // Em ambos os casos a base aponta para "LA:" e todos os offsets
    // internos (+48 paleta, +527 stitches) são medidos a partir dela.
    let pec_content = if is_pec {
        // Standalone: consome a assinatura "#PEC0001" (8 bytes).
        8usize
    } else {
        locate_pes_pec(bytes)?
    };

    // ------------------------------------------------------------
    // Paleta
    // ------------------------------------------------------------

    let palette = parse_pes_palette(&bytes[pec_content.min(bytes.len())..]);

    // ------------------------------------------------------------
    // Stream de stitches
    // ------------------------------------------------------------

    let stitch_offset = pec_content
        + find_stitch_stream_start(&bytes[pec_content.min(bytes.len())..], &version)?;

    // ------------------------------------------------------------
    // Inicialização do padrão
    // ------------------------------------------------------------

    let mut pattern = EmbroideryPattern::new();
    pattern.palette = Some(palette);

    // Convenção de eixo: no formato PES/PEC o Y cresce para baixo
    // (coordenadas de tela), igual ao pyembroidery, que nunca inverte por
    // versão. O renderer usa invert_y para NÃO aplicar o espelhamento padrão,
    // portanto ele deve ser true para todas as versões.
    pattern.invert_y = true;

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
        // Fim do desenho (par FF 00, como na referência)
        // --------------------------------------------------------
        // Um byte FF isolado ainda pode ocorrer como coordenada
        // longa (flags jump|trim + nibble alto F), por isso só
        // encerramos quando ele é seguido de 0x00.
        if first == 0xFF {
            let is_end = cursor >= bytes.len() || bytes[cursor] == 0x00;
            if is_end {
                pattern.add_stitch(x, y, StitchType::End);
                break;
            }
            // Caso contrário, FF é tratado como coordenada normal abaixo.
        }

        // --------------------------------------------------------
        // Coordenada X
        // Comandos especiais: FE B0 = troca de cor (consome 1 byte
        // extra). Qualquer outro par FE xx segue o fluxo de
        // coordenadas, igual ao pyembroidery.
        // --------------------------------------------------------

        if first == 0xFE {
            if cursor < bytes.len() && bytes[cursor] == 0xB0 {
                // Comando de troca de cor: consome B0 + 1 byte extra de
                // dados (igual ao pyembroidery, que faz f.seek(1,1)).
                cursor += 1; // B0
                if cursor < bytes.len() {
                    cursor += 1; // byte extra
                }
                pattern.add_stitch(x, y, StitchType::ColorChange);
                continue;
            }
        }

        let Some((dx, jump_x, trim_x)) =
            decode_pes_coordinate(first, bytes, &mut cursor)?
        else {
            break;
        };

        // --------------------------------------------------------
        // Coordenada Y
        // --------------------------------------------------------
        // Stream truncado (arquivo corrompido/cortado): encerra
        // graciosamente como a referência, em vez de invalidar
        // todo o desenho já decodificado.

        if cursor >= bytes.len() {
            break;
        }

        let second = bytes[cursor];
        cursor += 1;

        let Some((dy, jump_y, trim_y)) =
            decode_pes_coordinate(second, bytes, &mut cursor)?
        else {
            break;
        };

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