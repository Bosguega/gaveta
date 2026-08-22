use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

// Paleta Brother PEC (0..64)
const BROTHER_PALETTE: [(u8, u8, u8); 65] = [
    (0, 0, 0),
    (14, 31, 124),
    (10, 87, 163),
    (0, 158, 219),
    (20, 169, 160),
    (96, 196, 161),
    (31, 141, 73),
    (59, 180, 56),
    (149, 211, 70),
    (84, 115, 22),
    (107, 142, 35),
    (185, 178, 129),
    (148, 121, 93),
    (139, 115, 85),
    (112, 66, 20),
    (106, 28, 13),
    (237, 23, 75),
    (234, 101, 127),
    (238, 153, 170),
    (218, 59, 137),
    (155, 38, 130),
    (118, 43, 133),
    (240, 130, 0),
    (245, 176, 65),
    (247, 218, 33),
    (250, 240, 165),
    (180, 180, 180),
    (140, 140, 140),
    (40, 40, 40),
    (255, 255, 255),
    (96, 60, 20),
    (210, 120, 70),
    (100, 160, 200),
    (150, 200, 80),
    (220, 190, 150),
    (240, 210, 180),
    (250, 230, 200),
    (80, 50, 100),
    (180, 70, 90),
    (200, 100, 130),
    (230, 130, 150),
    (120, 140, 180),
    (100, 120, 140),
    (80, 160, 180),
    (180, 150, 120),
    (200, 180, 140),
    (240, 180, 130),
    (230, 160, 100),
    (220, 130, 60),
    (180, 120, 40),
    (130, 90, 30),
    (90, 60, 20),
    (160, 30, 50),
    (20, 20, 80),
    (30, 100, 150),
    (50, 120, 100),
    (100, 150, 100),
    (120, 80, 120),
    (160, 100, 150),
    (240, 100, 80),
    (220, 200, 50),
    (200, 200, 200),
    (120, 120, 120),
    (60, 60, 60),
    (0, 0, 0),
];

/// Localiza o bloco PEC dentro de um PES.
///
/// PES começa com:
///   0..4   = "#PES"
///   4..8   = versão ASCII
///   8..12  = offset absoluto do bloco PEC, little-endian
fn locate_pec_block(bytes: &[u8]) -> Result<usize, String> {
    if bytes.starts_with(b"#PEC") {
        return Ok(0);
    }

    if bytes.len() >= 12 && bytes.starts_with(b"#PES") {
        let offset =
            u32::from_le_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]) as usize;

        if offset < bytes.len() && bytes[offset..].starts_with(b"#PEC") {
            return Ok(offset);
        }

        // O offset é a fonte principal de verdade para PES.
        // Se ele não aponta para "#PEC", usamos a busca apenas como
        // fallback para lidar com arquivos reais/variantes.
    }

    bytes
        .windows(4)
        .position(|w| w == b"#PEC")
        .ok_or_else(|| "Bloco PEC não encontrado no arquivo".to_string())
}

/// Extrai a paleta PEC do cabeçalho.
fn parse_pec_palette(pec: &[u8]) -> Vec<Rgba<u8>> {
    // O cabeçalho PEC possui o contador de cores na região inicial.
    // Para os PEC/PES tradicionais, o valor representa
    // número de mudanças de cor; portanto cores = mudanças + 1.
    //
    // 0xFF é um valor especial que indica ausência de informação.
    if pec.len() < 49 {
        return vec![Rgba([0, 0, 0, 255])];
    }

    let color_changes = pec[48];

    if color_changes == 0xFF {
        return vec![Rgba([0, 0, 0, 255])];
    }

    let count = (color_changes as usize) + 1;
    let available = pec.len().saturating_sub(49);
    let count = count.min(available);

    let mut palette = Vec::with_capacity(count);

    for i in 0..count {
        let index = pec[49 + i] as usize;

        let (r, g, b) = BROTHER_PALETTE
            .get(index)
            .copied()
            .unwrap_or((30, 30, 30));

        palette.push(Rgba([r, g, b, 255]));
    }

    if palette.is_empty() {
        palette.push(Rgba([0, 0, 0, 255]));
    }

    palette
}

/// Decodifica uma coordenada PEC.
///
/// Retorna:
///   (delta, is_jump, is_trim)
///
/// Formato curto:
///   0xxxxxxx
///
/// Formato longo:
///   1xxx???? ????????
///
/// Os bits 0x10 e 0x20 são flags de jump/trim.
/// Os quatro bits inferiores do primeiro byte são os bits
/// superiores da coordenada de 12 bits.
fn decode_pec_coordinate(
    first: u8,
    data: &[u8],
    cursor: &mut usize,
) -> Result<(i32, bool, bool), String> {
    // Formato longo
    if first & 0x80 != 0 {
        if *cursor >= data.len() {
            return Err("Coordenada PEC longa truncada".to_string());
        }

        let second = data[*cursor];
        *cursor += 1;

        let is_jump = first & 0x10 != 0;
        let is_trim = first & 0x20 != 0;

        let mut value =
            (((first & 0x0F) as i32) << 8) | second as i32;

        // Assinatura de 12 bits
        if value & 0x800 != 0 {
            value -= 0x1000;
        }

        Ok((value, is_jump, is_trim))
    } else {
        // Formato curto: signed 7-bit
        let value = if first & 0x40 != 0 {
            first as i32 - 0x80
        } else {
            first as i32
        };

        Ok((value, false, false))
    }
}

/// Parser Brother PES/PEC.
///
/// Para PES, extrai o bloco PEC incorporado.
/// Para PEC standalone, interpreta o arquivo diretamente.
pub fn parse_pes(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 8 {
        return Err("Arquivo PES/PEC inválido (muito curto)".to_string());
    }

    let pec_offset = locate_pec_block(bytes)?;

    if pec_offset >= bytes.len() {
        return Err("Offset PEC fora dos limites do arquivo".to_string());
    }

    let pec = &bytes[pec_offset..];

    if !pec.starts_with(b"#PEC") {
        return Err("Bloco PEC inválido".to_string());
    }

    // ------------------------------------------------------------
    // Cabeçalho PEC
    // ------------------------------------------------------------

    if pec.len() < 512 {
        return Err("Cabeçalho PEC truncado".to_string());
    }

    let palette = parse_pec_palette(pec);

    // ------------------------------------------------------------
    // Localização do stream de stitches
    // ------------------------------------------------------------
    //
    // Para PECs tradicionais, o primeiro bloco de 512 bytes
    // contém o cabeçalho. O stream começa na região seguinte.
    //
    // Alguns arquivos PES/PEC possuem dados adicionais no segundo
    // cabeçalho. Mantemos 512 como ponto de partida, mas limitamos
    // a leitura ao tamanho real do arquivo.
    //

    let stitch_offset = 512;

    if stitch_offset >= pec.len() {
        return Err("Stream de pontos PEC ausente".to_string());
    }

    let mut pattern = EmbroideryPattern::new();
    pattern.palette = Some(palette);

    let mut x = 0.0f32;
    let mut y = 0.0f32;

    let mut cursor = stitch_offset;

    while cursor < pec.len() {
        let first = pec[cursor];
        cursor += 1;

        // --------------------------------------------------------
        // Fim do desenho
        // --------------------------------------------------------

        if first == 0xFF {
            // Alguns PEC usam FF 00; outros terminam simplesmente
            // em FF. Não precisamos consumir dados além do desenho.
            pattern.add_stitch(x, y, StitchType::End);
            break;
        }

        // --------------------------------------------------------
        // Troca de cor
        // --------------------------------------------------------

        if first == 0xFE {
            if cursor >= pec.len() {
                break;
            }

            if pec[cursor] == 0xB0 {
                cursor += 1;

                // O terceiro byte identifica/avança a cor.
                // Para visualização, o índice exato não é necessário:
                // basta registrar a mudança.
                if cursor < pec.len() {
                    cursor += 1;
                }

                pattern.add_stitch(x, y, StitchType::ColorChange);
                continue;
            }

            return Err(format!(
                "Comando PEC 0xFE inesperado no offset {}",
                cursor - 1
            ));
        }

        // --------------------------------------------------------
        // Coordenada X
        // --------------------------------------------------------

        let (dx, jump_x, trim_x) =
            decode_pec_coordinate(first, pec, &mut cursor)?;

        // --------------------------------------------------------
        // Coordenada Y
        // --------------------------------------------------------

        if cursor >= pec.len() {
            return Err("Coordenada Y ausente no final do PEC".to_string());
        }

        let second = pec[cursor];
        cursor += 1;

        let (dy, jump_y, trim_y) =
            decode_pec_coordinate(second, pec, &mut cursor)?;

        x += dx as f32;
        y += dy as f32;

        let stitch_type = if trim_x || trim_y {
            // Trim ainda não existe no StitchType atual.
            // Para o renderer, tratá-lo como Jump evita desenhar
            // a movimentação de corte.
            StitchType::Jump
        } else if jump_x || jump_y {
            StitchType::Jump
        } else {
            StitchType::Stitch
        };

        pattern.add_stitch(x, y, stitch_type);
    }

    Ok(pattern)
}