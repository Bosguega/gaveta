use crate::embroidery::EmbroideryPattern;
use crate::embroidery::husky::parse_husky_sections;
use image::Rgba;

/// Paleta de cores Husqvarna para formato HUS.
///
/// Os índices de cor no arquivo mapeiam ao catálogo básico de 29 fios
/// Husqvarna (mesma tabela usada por pyembroidery/EmbThreadHus). Índices fora
/// da faixa caem num cinza por padrão (defensivo).
const HUS_PALETTE: [(u8, u8, u8); 29] = [
    (0, 0, 0),        // 0: Black
    (0, 0, 231),      // 1: Blue
    (0, 198, 0),      // 2: Green
    (255, 0, 0),      // 3: Red
    (132, 0, 132),    // 4: Purple
    (255, 255, 0),    // 5: Yellow
    (132, 132, 132),  // 6: Grey
    (132, 132, 231),  // 7: Light Blue
    (0, 255, 132),    // 8: Light Green
    (255, 123, 49),   // 9: Orange
    (255, 140, 165),  // 10: Pink
    (132, 82, 0),     // 11: Brown
    (255, 255, 255),  // 12: White
    (0, 0, 132),      // 13: Dark Blue
    (0, 132, 0),      // 14: Dark Green
    (123, 0, 0),      // 15: Dark Red
    (255, 99, 132),   // 16: Light Red
    (82, 41, 82),     // 17: Dark Purple
    (255, 0, 255),    // 18: Light Purple
    (255, 222, 0),    // 19: Dark Yellow
    (255, 255, 156),  // 20: Light Yellow
    (82, 82, 82),     // 21: Dark Grey
    (214, 214, 214),  // 22: Light Grey
    (255, 82, 8),     // 23: Dark Orange
    (255, 156, 90),   // 24: Light Orange
    (255, 82, 181),   // 25: Dark Pink
    (255, 198, 222),  // 26: Light Pink
    (82, 49, 0),      // 27: Dark Brown
    (181, 165, 132),  // 28: Light Brown
];

/// Parser para arquivos de bordado Husqvarna Viking (.hus)
///
/// Usa compressão ArchiveLib AL_GREENLEAF_LEVEL_4 para as seções de dados.
/// Três seções: atributos, deltas X, deltas Y. Assim como pyembroidery, é lido
/// de forma estrutural (exige apenas tamanho mínimo de cabeçalho, não una
/// assinatura mágica rígida, para não rejeitar arquivos válidos).
pub fn parse_hus(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 0x2E {
        return Err("Arquivo HUS muito curto".to_string());
    }

    let stitch_count = u32::from_le_bytes([bytes[0x04], bytes[0x05], bytes[0x06], bytes[0x07]]) as usize;
    let color_count = u32::from_le_bytes([bytes[0x08], bytes[0x09], bytes[0x0A], bytes[0x0B]]) as usize;

    let offset1 = u32::from_le_bytes([bytes[0x14], bytes[0x15], bytes[0x16], bytes[0x17]]) as usize;
    let offset2 = u32::from_le_bytes([bytes[0x18], bytes[0x19], bytes[0x1A], bytes[0x1B]]) as usize;
    let offset3 = u32::from_le_bytes([bytes[0x1C], bytes[0x1D], bytes[0x1E], bytes[0x1F]]) as usize;

    let mut pattern = EmbroideryPattern::new();

    let mut palette = Vec::new();
    for i in 0..color_count.min(30) {
        let idx = if 0x2A + i * 2 + 1 < bytes.len() {
            u16::from_le_bytes([bytes[0x2A + i * 2], bytes[0x2B + i * 2]]) as usize
        } else {
            i
        };
        let (r, g, b) = HUS_PALETTE.get(idx).copied().unwrap_or((128, 128, 128));
        palette.push(Rgba([r, g, b, 255]));
    }

    if !palette.is_empty() {
        pattern.palette = Some(palette);
    }

    if stitch_count == 0 || offset1 == 0 || offset2 == 0 || offset3 == 0 {
        return Ok(pattern);
    }

    parse_husky_sections(&mut pattern, bytes, stitch_count, offset1, offset2, offset3, "HUS")?;

    Ok(pattern)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_hus_sin_stitches_conserva_la_paleta() {
        // stitch_count = 0 => retorno temprano sin descomprimir; paleta presente.
        let mut bytes = vec![0u8; 0x40];
        bytes[0x08..0x0C].copy_from_slice(&1u32.to_le_bytes()); // 1 color
        bytes[0x2A..0x2C].copy_from_slice(&3u16.to_le_bytes()); // índice 3 => Red
        let parsed = parse_hus(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert_eq!(pattern.stitches.len(), 0);
        assert!(pattern.palette.is_some());
        assert_eq!(pattern.palette.unwrap().len(), 1);
    }

    #[test]
    fn parse_hus_paleta_indice_fuera_de_rango_cae_en_gris() {
        let mut bytes = vec![0u8; 0x40];
        bytes[0x08..0x0C].copy_from_slice(&1u32.to_le_bytes()); // 1 color
        bytes[0x2A..0x2C].copy_from_slice(&255u16.to_le_bytes()); // fora de las 29 entradas
        let parsed = parse_hus(&bytes);
        assert!(parsed.is_ok());
        let pattern = parsed.unwrap();
        assert!(pattern.palette.is_some());
        assert_eq!(pattern.palette.unwrap().len(), 1);
    }
}
