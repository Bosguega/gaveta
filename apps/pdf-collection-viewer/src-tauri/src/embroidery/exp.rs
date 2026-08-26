use crate::embroidery::{EmbroideryPattern, StitchType};

/// Parser para arquivos de bordado Melco (.exp)
///
/// Alinhado com pyembroidery/ExpReader:
/// - Pares i8 (dx, dy) como pontos de costura.
/// - 0x80 seguido de controle: 0x01 = troca de cor (+ movimento),
///   0x02 = ponto com movimento (raro, mas existe), 0x04 = salto,
///   0x80 = trim. Qualquer outro controle encerra o parse.
pub fn parse_exp(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.is_empty() {
        return Err("Arquivo EXP vazio".to_string());
    }

    let mut pattern = EmbroideryPattern::new();
    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;

    let mut i = 0;
    while i + 1 < bytes.len() {
        let b0 = bytes[i];
        let b1 = bytes[i + 1];
        i += 2;

        if b0 != 0x80 {
            // Ponto normal de costura
            curr_x += b0 as i8 as f32;
            curr_y += b1 as i8 as f32;
            pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
            continue;
        }

        // Byte de controle / escape: sempre consome mais 2 bytes.
        if i + 1 >= bytes.len() {
            break;
        }
        let dx = bytes[i] as i8 as f32;
        let dy = bytes[i + 1] as i8 as f32;
        i += 2;

        match b1 {
            0x01 => {
                // Troca de cor; movimento aplicado quando não nulo.
                if dx != 0.0 || dy != 0.0 {
                    curr_x += dx;
                    curr_y += dy;
                }
                pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
            }
            0x02 => {
                // Ponto com movimento (raro na prática, mas válido).
                curr_x += dx;
                curr_y += dy;
                pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
            }
            0x04 => {
                // Salto (Jump)
                curr_x += dx;
                curr_y += dy;
                pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
            }
            0x80 => {
                // Trim: quebra a linha de costura.
                pattern.add_stitch(curr_x, curr_y, StitchType::Trim);
            }
            _ => {
                // Controle não reconhecido: encerra de forma defensiva,
                // mesmo comportamento da referência.
                break;
            }
        }
    }

    Ok(pattern)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodifica_stitch_jump_color_change_e_trim() {
        let bytes: Vec<u8> = vec![
            10, 20, // stitch
            0x80, 0x04, 5, 6, // jump
            0x80, 0x01, 0, 0, // color change
            30, 40, // stitch
            0x80, 0x80, 0, 0, // trim
            50, 60, // stitch
        ];

        let pattern = parse_exp(&bytes).unwrap();
        let types: Vec<StitchType> = pattern.stitches.iter().map(|s| s.stitch_type).collect();
        assert_eq!(
            types,
            vec![
                StitchType::Stitch,
                StitchType::Jump,
                StitchType::ColorChange,
                StitchType::Stitch,
                StitchType::Trim,
                StitchType::Stitch,
            ]
        );
    }

    #[test]
    fn controle_desconhecido_encerra_o_parse() {
        let bytes: Vec<u8> = vec![
            10, 20,
            0x80, 0x55, 0, 0, // controle desconhecido
            30, 40, // não deve virar stitch
        ];
        let pattern = parse_exp(&bytes).unwrap();
        assert_eq!(pattern.stitches.len(), 1);
    }
}
