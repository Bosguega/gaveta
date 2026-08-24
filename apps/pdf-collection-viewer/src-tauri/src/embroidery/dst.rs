use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

const DST_HEADER_SIZE: usize = 512;

fn getbit(b: u8, pos: u8) -> u32 {
    ((b >> pos) & 1) as u32
}

/// Decodifica el delta X de tres bytes DST.
///
/// Mapeo de bits según la spec Tajima (idéntico a pyembroidery/DstReader):
///   b2 bit2 = +81, b2 bit3 = -81
///   b1 bit2 = +27, b1 bit3 = -27
///   b0 bit2 =  +9, b0 bit3 =  -9
///   b1 bit0 =  +3, b1 bit1 =  -3
///   b0 bit0 =  +1, b0 bit1 =  -1
fn decode_dx(b0: u8, b1: u8, b2: u8) -> i32 {
    let mut x = 0;
    x += getbit(b2, 2) as i32 * 81;
    x += getbit(b2, 3) as i32 * -81;
    x += getbit(b1, 2) as i32 * 27;
    x += getbit(b1, 3) as i32 * -27;
    x += getbit(b0, 2) as i32 * 9;
    x += getbit(b0, 3) as i32 * -9;
    x += getbit(b1, 0) as i32 * 3;
    x += getbit(b1, 1) as i32 * -3;
    x += getbit(b0, 0) as i32 * 1;
    x += getbit(b0, 1) as i32 * -1;
    x
}

/// Decodifica el delta Y en tres bytes DST.
///
/// La spec DST define +y apuntando hacia abajo (coordenadas de máquina); igual
/// que pyembroidery (return -y) y que el parser `.xxx` del repo, negamos el
/// resultado para montar con la geometría interna del renderer.
///   b2 bit5 = +81, b2 bit4 = -81
///   b1 bit5 = +27, b1 bit4 = -27
///   b0 bit5 =  +9, b0 bit4 =  -9
///   b1 bit7 =  +3, b1 bit6 =  -3
///   b0 bit7 =  +1, b0 bit6 =  -1
fn decode_dy(b0: u8, b1: u8, b2: u8) -> i32 {
    let mut y = 0;
    y += getbit(b2, 5) as i32 * 81;
    y += getbit(b2, 4) as i32 * -81;
    y += getbit(b1, 5) as i32 * 27;
    y += getbit(b1, 4) as i32 * -27;
    y += getbit(b0, 5) as i32 * 9;
    y += getbit(b0, 4) as i32 * -9;
    y += getbit(b1, 7) as i32 * 3;
    y += getbit(b1, 6) as i32 * -3;
    y += getbit(b0, 7) as i32 * 1;
    y += getbit(b0, 6) as i32 * -1;
    -y
}
fn hex_nibble(c: u8) -> Option<u8> {
    if c >= 48 && c <= 57 { Some((c - 48) as u8) }
    else if c >= 65 && c <= 70 { Some((c - 55) as u8) } // 'A'..'F'
    else if c >= 97 && c <= 102 { Some((c - 87) as u8) } // 'a'..'f'
    else { None }
}

fn hex_byte(hi: u8, lo: u8) -> Option<u8> {
    let h = hex_nibble(hi);
    let l = hex_nibble(lo);
    if let Some(h) = h {
        if let Some(l) = l {
            Some(((h as usize) * 16 + (l as usize)) as u8)
        } else {
            None
        }
    } else {
        None
    }
}

/// Lee un color RRGGBB (6 dígitos hex) a partir de `s`.
fn parse_hex6(bytes: &[u8], s: usize, end: usize) -> Option<Rgba<u8>> {
    if s + 6 > end {
        return None;
    }
    let r = hex_byte(bytes[s + 0], bytes[s + 1]);
    let g = hex_byte(bytes[s + 2], bytes[s + 3]);
    let b = hex_byte(bytes[s + 4], bytes[s + 5]);
    if let Some(r) = r {
        if let Some(g) = g {
            if let Some(b) = b {
                Some(Rgba([r, g, b, 255]))
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    }
}

/// Extrae la paleta de hilos desde el header DST.
///
/// Las líneas `TC:<hex>,description,catalog` del header (512 bytes iniciales)
/// describen los colores del diseño. El renderer usa `pattern.palette` para
/// colorear la miniatura, así que recuperar estos colores mejora el resultado.
fn parse_header_palette(bytes: &[u8]) -> Option<Vec<Rgba<u8>>> {
    let header_len = (bytes.len()).min(DST_HEADER_SIZE);
    let mut colors: Vec<Rgba<u8>> = Vec::new();
    let mut i = 0usize;
    while i < header_len {
        // Busca la secuencia "TC:"
        if bytes[i] == 84 && i + 2 < header_len && bytes[i + 1] == 67 && bytes[i + 2] == 58 {
            let s0 = i + 3;
            let mut s = s0;
            if s < header_len && (bytes[s] == 35 || bytes[s] == 32) {
                s += 1; // tolera "#RRGGBB" o " RRGGBB"
            }
            if let Some(color) = parse_hex6(bytes, s, header_len) {
                colors.push(color);
            }
            i = s0 + 6; // continuar más allá de este color
            continue;
        }
        i += 1;
    }
    if !colors.is_empty() {
        Some(colors)
    } else {
        None
    }
}

/// Parser para arquivos de bordado Tajima (.dst)
///
/// DST se compone de un header de 512 bytes y luego registros de 3 bytes
/// (b0, b1, b2) con deltas codificados a bit-magnitud de -121 a +121 en cada
/// eje. Los bits altos de b2 codifican comandos (costura/salto/fin).
pub fn parse_dst(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < DST_HEADER_SIZE {
        return Err("Arquivo DST muito curto para conter cabeçalho".to_string());
    }

    let mut pattern = EmbroideryPattern::new();
    let palette = parse_header_palette(bytes);
    if palette.is_some() {
        pattern.palette = palette;
    }

    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;

    let mut i = DST_HEADER_SIZE;

    while i + 2 < bytes.len() {
        let b0 = bytes[i];
        let b1 = bytes[i + 1];
        let b2 = bytes[i + 2];
        i += 3;

        // Fin de archivo: 0b11110011 con máscara (los bits 2/3 son X ±81).
        if (b2 & 0xF3) == 0xF3 {
            pattern.add_stitch(curr_x, curr_y, StitchType::End);
            break;
        }

        let dx = decode_dx(b0, b1, b2) as f32;
        let dy = decode_dy(b0, b1, b2) as f32;
        curr_x += dx;
        curr_y += dy;

        let stitch_type = if (b2 & 0xC3) == 0xC3 {
            StitchType::ColorChange
        } else if (b2 & 0x83) == 0x83 || (b2 & 0x43) == 0x43 {
            // 0x83 es salto/movimiento; 0x43 es sequin-mode (sin costura).
            StitchType::Jump
        } else {
            StitchType::Stitch
        };

        pattern.add_stitch(curr_x, curr_y, stitch_type);
    }

    Ok(pattern)
}
#[cfg(test)]
mod tests {
    use super::*;

    fn head_with_records(records: &[u8]) -> Vec<u8> {
        let mut bytes = vec![0u8; DST_HEADER_SIZE];
        bytes.extend_from_slice(records);
        bytes
    }

    #[test]
    fn decodifica_paso_largo_81() {
        // b2 bit2 (0x04) => dx = +81.
        let parsed = parse_dst(&head_with_records(&[0x00, 0x00, 0x04]));
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches[0].x, 81.0);
        assert_eq!(pattern.stitches[0].y, 0.0);
        assert_eq!(pattern.stitches[0].stitch_type, StitchType::Stitch);
    }

    #[test]
    fn decodifica_suma_121() {
        // 81 + 27 + 9 + 3 + 1 = 121 en X.
        let b0: u8 = (1 | 4) as u8; // bits +1 y +9 (de X)
        let b1: u8 = (1 | 4) as u8; // bits +3 y +27 (de X)
        let b2: u8 = 4 as u8; // bit +81 (de X)
        let parsed = parse_dst(&head_with_records(&[b0, b1, b2]));
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches[0].x, 121.0);
    }

    #[test]
    fn detecta_color_change_jump_y_end() {
        let parsed = parse_dst(&head_with_records(&[
            0x00, 0x00, 0xC3, // color change
            0x00, 0x00, 0x83, // salto
            0x00, 0x00, 0xF3, // fin
        ]));
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        let types: Vec<StitchType> = pattern
            .stitches
            .iter()
            .map(|s| s.stitch_type)
            .collect();
        assert_eq!(
            types,
            vec![
                StitchType::ColorChange,
                StitchType::Jump,
                StitchType::End,
            ],
        );
        // El fin corta la lectura: no hay más puntos tras 0xF3.
        assert_eq!(pattern.stitches.len(), 3);
    }

    #[test]
    fn el_ordinal_end_gana_a_color_change() {
        // 0xF3 tiene bits de color change pero debe tratarse como End primero.
        let parsed = parse_dst(&head_with_records(&[0x00, 0x00, 0xF3]));
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 1);
        assert_eq!(pattern.stitches[0].stitch_type, StitchType::End);
    }

    #[test]
    fn lee_paleta_desde_header_tc() {
        let mut bytes = vec![0u8; DST_HEADER_SIZE];
        bytes[0..2].copy_from_slice(b"TC");
        bytes[2] = 0x3A as u8; // ':'
        bytes[3..9].copy_from_slice(b"ff0000");
        bytes.extend_from_slice(&[0x00, 0x00, 0xF3]); // end para parsear fino
        let parsed = parse_dst(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert!(pattern.palette.is_some());
        assert_eq!(pattern.palette.unwrap().len(), 1);
    }
}
