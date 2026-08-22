use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

/// Paleta de cores Husqvarna para formato HUS
const HUS_PALETTE: [(u8, u8, u8); 30] = [
    (0, 0, 0), (0, 0, 255), (0, 255, 0), (255, 0, 0),
    (255, 255, 0), (255, 0, 255), (0, 255, 255), (128, 0, 0),
    (0, 128, 0), (0, 0, 128), (128, 128, 0), (128, 0, 128),
    (0, 128, 128), (192, 192, 192), (128, 128, 128), (255, 255, 255),
    (255, 128, 0), (128, 255, 0), (0, 255, 128), (0, 128, 255),
    (128, 0, 255), (255, 0, 128), (255, 128, 128), (128, 255, 128),
    (128, 128, 255), (255, 255, 128), (255, 128, 255), (128, 255, 255),
    (64, 64, 64), (255, 255, 255),
];

/// Parser para arquivos de bordado Husqvarna Viking (.hus)
///
/// Usa compressão ArchiveLib AL_GREENLEAF_LEVEL_4 para as seções de dados.
/// Três seções: atributos, deltas X, deltas Y.
pub fn parse_hus(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 0x2E {
        return Err("Arquivo HUS muito curto".to_string());
    }

    let stitch_count = u32::from_le_bytes([bytes[0x04], bytes[0x05], bytes[0x06], bytes[0x07]]) as usize;
    let color_count = u32::from_le_bytes([bytes[0x08], bytes[0x09], bytes[0x0A], bytes[0x0B]]) as usize;

    let offset_sec1 = u32::from_le_bytes([bytes[0x14], bytes[0x15], bytes[0x16], bytes[0x17]]) as usize;
    let offset_sec2 = u32::from_le_bytes([bytes[0x18], bytes[0x19], bytes[0x1A], bytes[0x1B]]) as usize;
    let offset_sec3 = u32::from_le_bytes([bytes[0x1C], bytes[0x1D], bytes[0x1E], bytes[0x1F]]) as usize;

    let mut pattern = EmbroideryPattern::new();

    let mut palette = Vec::new();
    for i in 0..color_count.min(30) {
        let idx = if 0x2A + i * 2 + 1 < bytes.len() {
            u16::from_le_bytes([bytes[0x2A + i * 2], bytes[0x2B + i * 2]]) as usize
        } else {
            i
        };
        let (r, g, b) = HUS_PALETTE
            .get(idx)
            .copied()
            .unwrap_or((128, 128, 128));
        palette.push(Rgba([r, g, b, 255]));
    }

    if !palette.is_empty() {
        pattern.palette = Some(palette);
    }

    if stitch_count == 0 || offset_sec1 == 0 || offset_sec2 == 0 || offset_sec3 == 0 {
        return Ok(pattern);
    }

    let sec1 = decompress_section(bytes, offset_sec1)
        .map_err(|e| format!("Falha ao descomprimir seção 1 HUS: {e}"))?;
    let sec2 = decompress_section(bytes, offset_sec2)
        .map_err(|e| format!("Falha ao descomprimir seção 2 HUS: {e}"))?;
    let sec3 = decompress_section(bytes, offset_sec3)
        .map_err(|e| format!("Falha ao descomprimir seção 3 HUS: {e}"))?;

    let mut curr_x = 0.0f32;
    let mut curr_y = 0.0f32;
    let mut color_idx = 0usize;

    let stitch_count = stitch_count.min(sec1.len()).min(sec2.len()).min(sec3.len());

    for i in 0..stitch_count {
        let attr = sec1[i];
        let dx = sec2[i] as i8 as f32;
        let dy = sec3[i] as i8 as f32;

        curr_x += dx;
        curr_y += dy;

        match attr {
            0x80 => {
                pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
            }
            0x81 => {
                pattern.add_stitch(curr_x, curr_y, StitchType::Jump);
            }
            0x84 => {
                color_idx = (color_idx + 1).min(pattern.palette.as_ref().map(|p| p.len()).unwrap_or(1) - 1);
                pattern.add_stitch(curr_x, curr_y, StitchType::ColorChange);
            }
            0x90 => {
                pattern.add_stitch(curr_x, curr_y, StitchType::End);
                break;
            }
            _ => {
                pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
            }
        }
    }

    Ok(pattern)
}

fn decompress_section(data: &[u8], offset: usize) -> Result<Vec<u8>, String> {
    if offset >= data.len() {
        return Err("Offset de seção fora dos limites".to_string());
    }

    let section_data = &data[offset..];
    archivelib::do_decompress(section_data)
        .map(|boxed| boxed.into_vec())
        .map_err(|e| format!("{e}"))
}
