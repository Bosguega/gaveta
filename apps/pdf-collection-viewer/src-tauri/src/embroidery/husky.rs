use crate::embroidery::{EmbroideryPattern, StitchType};

/// Núcleo compartido para loes parsers da família Husqvarna/Viking (.hus,
/// .vip). Ambos formatos guardan três seções de dados comprimidos com
/// ArchiveLib/Greenleaf e contiguas entre si: atributos, deltas X e deltas Y.
///
/// A libraria `archivelib::do_decompress` não recebe um tamanho esperado: ela
/// se detiene sozinha ao encontrar o token END (0x1FE). Por isso é crítico
/// passar os límites exactos [start, end) de cada seção; si se lê `data[start..]`
/// até o fim do arquivo, uma seção sem END explícito engulliría bytes da
/// seguinte e produziría uma cola lixo no padrão.
///
/// Importante: `archivelib::do_decompress` usa `ArchivelibConfig::default()`,
/// cujo `max_size = Some(65536)` faz falhar com "failed to write whole buffer"
/// em bordados reais grandes. Aqui limitamos a saída pelo tamanho esperado da
/// seção (1 byte por ponto + folga), o que aceita arquivos grandes e continua
/// rejeitando dados corrompidos.
fn decompress_section(
    data: &[u8],
    start: usize,
    end: usize,
    expected_len: usize,
) -> Result<Vec<u8>, String> {
    if start >= data.len() || start >= end {
        return Err("Offset de seção fora de limites".to_string());
    }
    let bounded_end = end.min(data.len());
    let section_data = &data[start..bounded_end];
    let config = archivelib::ArchivelibConfig {
        // Folga generosa: seções podem conter comandos extras além dos pontos.
        max_size: Some(expected_len.saturating_add(4096)),
        ..archivelib::ArchivelibConfig::default()
    };
    config
        .decompress(section_data)
        .map(|boxed| boxed.into_vec())
        .map_err(|e| format!("{e}"))
}

/// Descomprime y lee las 3 secciones de la família Husky (atributos, deltas X,
/// deltas Y) y agrega los puntos de costura al patrón.
///
/// Convención de coordenadas: al igual que los demás parsers de este repo (p.ej.
/// `xxx.rs`), el delta Y se acumula tal cual del archivo (no se niega) y el
/// patrón queda con `invert_y = false`, que el renderer traduce correctamente.
pub fn parse_husky_sections(
    pattern: &mut EmbroideryPattern,
    bytes: &[u8],
    stitch_count: usize,
    offset1: usize,
    offset2: usize,
    offset3: usize,
    label: &str,
) -> Result<(), String> {
    let sec1 = decompress_section(bytes, offset1, offset2, stitch_count)
        .map_err(|e| format!("Falha ao descomprimir seção 1 {label}: {e}"))?;
    let sec2 = decompress_section(bytes, offset2, offset3, stitch_count)
        .map_err(|e| format!("Falha ao descomprimir seção 2 {label}: {e}"))?;
    let sec3 = decompress_section(bytes, offset3, bytes.len(), stitch_count)
        .map_err(|e| format!("Falha ao descomprimir seção 3 {label}: {e}"))?;

    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;

    let count = stitch_count.min(sec1.len()).min(sec2.len()).min(sec3.len());

    for i in 0..count {
        let attr = sec1[i];
        let dx = sec2[i] as i8 as f32;
        let dy = sec3[i] as i8 as f32;

        curr_x += dx;
        curr_y += dy;

        match attr {
            0x80 => pattern.add_stitch(curr_x, curr_y, StitchType::Stitch),
            0x81 => pattern.add_stitch(curr_x, curr_y, StitchType::Jump),
            0x84 => pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange),
            0x88 => pattern.add_stitch(curr_x, curr_y, StitchType::Trim),
            0x90 => {
                pattern.add_stitch(curr_x, curr_y, StitchType::End);
                break;
            }
            // Comando no mapeado: corta la lectura (mismo comportamiento
            // defensivo que pyembroidery) para no inventar stitches.
            _ => break,
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{decompress_section, parse_husky_sections};
    use crate::embroidery::{EmbroideryPattern, StitchType};

    fn compress_section(bytes: &[u8]) -> Vec<u8> {
        // do_compress produce exactamente lo que do_decompress espera.
        archivelib::do_compress(bytes).map(|b| b.into_vec()).unwrap()
    }

    #[test]
    fn decompress_section_respeta_el_rango_exacto() {
        // La 2ª sección se comprime y va justo después de la 1ª; el rango
        // [start, end) impide leer más allá y mezclar bytes de la siguiente.
        let one: &[u8] = &[1, 2, 3];
        let two: &[u8] = &[9, 8, 7, 6];
        let c1 = compress_section(one);
        let c2 = compress_section(two);

        let mut data = vec![0u8; 32];
        data[0..c1.len()].copy_from_slice(&c1);
        data[c1.len()..c1.len() + c2.len()].copy_from_slice(&c2);

        let dec1 = decompress_section(&data, 0, c1.len(), one.len()).unwrap();
        let dec2 = decompress_section(&data, c1.len(), c1.len() + c2.len(), two.len()).unwrap();

        assert_eq!(dec1[..], one[..]);
        assert_eq!(dec2[..], two[..]);
    }

    #[test]
    fn parse_husky_maps_comandos_y_del_puntos() {
        // Atributos: Stitch, ColorChange, Jump, Trim, End
        let attrs: &[u8] = &[0x80, 0x84, 0x81, 0x88, 0x90];
        let xs: &[u8] = &[10, 0, 0, 0, 0];
        let ys: &[u8] = &[5, 0, 0, 0, 0];

        let c1 = compress_section(attrs);
        let c2 = compress_section(xs);
        let c3 = compress_section(ys);

        let mut data = vec![0u8; 128];
        let o1 = 0x40usize;
        let o2 = o1 + c1.len();
        let o3 = o2 + c2.len();
        data[o1..o1 + c1.len()].copy_from_slice(&c1);
        data[o2..o2 + c2.len()].copy_from_slice(&c2);
        data[o3..o3 + c3.len()].copy_from_slice(&c3);

        let mut pattern = EmbroideryPattern::new();
        assert!(parse_husky_sections(&mut pattern, &data, 5, o1, o2, o3, "HUS").is_ok());

        let types: Vec<StitchType> = pattern
            .stitches
            .iter()
            .map(|s| s.stitch_type)
            .collect();

        assert_eq!(
            types,
            vec![
                StitchType::Stitch,
                StitchType::ColorChange,
                StitchType::Jump,
                StitchType::Trim,
                StitchType::End,
            ],
        );
        assert_eq!(pattern.stitches.len(), 5);
    }

    #[test]
    fn decompress_section_aceita_secoes_maiores_que_64kb() {
        // Reproduz a falha "failed to write whole buffer": do_decompress usa
        // max_size = 65536 e falha em seções reais maiores. Com max_size: None
        // deve descomprimir sem erro.
        let big: Vec<u8> = (0..70_000u32).map(|i| (i % 251) as u8).collect();
        let compressed = compress_section(&big);

        let mut data = vec![0u8; compressed.len()];
        data.copy_from_slice(&compressed);
        let dec = decompress_section(&data, 0, data.len(), big.len()).unwrap();
        assert_eq!(dec.len(), 70_000);
        assert_eq!(dec[..], big[..]);
    }

    #[test]
    fn parse_husky_detiene_comando_no_mapeado() {
        let attrs: &[u8] = &[0x80, 0x7F, 0x80];
        let xs: &[u8] = &[1, 2, 3];
        let ys: &[u8] = &[4, 5, 6];

        let c1 = compress_section(attrs);
        let c2 = compress_section(xs);
        let c3 = compress_section(ys);

        let mut data = vec![0u8; 128];
        let o1 = 0x40usize;
        let o2 = o1 + c1.len();
        let o3 = o2 + c2.len();
        data[o1..o1 + c1.len()].copy_from_slice(&c1);
        data[o2..o2 + c2.len()].copy_from_slice(&c2);
        data[o3..o3 + c3.len()].copy_from_slice(&c3);

        let mut pattern = EmbroideryPattern::new();
        assert!(parse_husky_sections(&mut pattern, &data, 3, o1, o2, o3, "HUS").is_ok());

        // El comando no mapeado (0x7F) corta la lectura; no se inventan puntos.
        assert_eq!(pattern.stitches.len(), 1);
        assert_eq!(pattern.stitches[0].stitch_type, StitchType::Stitch);
    }
}