use crate::embroidery::{EmbroideryPattern, StitchType};
use image::Rgba;

fn signed32(b: u32) -> i32 {
    if b > 0x7FFFFFFF {
        (b as i64 - 0x100000000i64) as i32
    } else {
        b as i32
    }
}

fn signed16(b0: u8, b1: u8) -> i16 {
    let v = ((b0 as u16) << 8) | (b1 as u16);
    v as i16
}

/// Reads a VP3 header string: 16-bit big-endian byte length followed by UTF-16 text.
/// The length field already encodes the number of bytes (2 per UTF-16 char).
fn skip_string_utf16(data: &[u8], pos: &mut usize) -> Result<(), String> {
    if *pos + 2 > data.len() {
        return Err("VP3: string utf-16 truncada".to_string());
    }
    let length = ((data[*pos] as u16) << 8) | (data[*pos + 1] as u16);
    *pos += 2 + (length as usize);
    if *pos > data.len() {
        return Err("VP3: string utf-16 truncada".to_string());
    }
    Ok(())
}

/// Reads a VP3 body string: 16-bit big-endian byte length followed by UTF-8 text.
fn skip_string_utf8(data: &[u8], pos: &mut usize) -> Result<(), String> {
    if *pos + 2 > data.len() {
        return Err("VP3: string utf-8 truncada".to_string());
    }
    let length = ((data[*pos] as u16) << 8) | (data[*pos + 1] as u16);
    *pos += 2 + (length as usize);
    if *pos > data.len() {
        return Err("VP3: string utf-8 truncada".to_string());
    }
    Ok(())
}

fn read_int_24be(data: &[u8], pos: &mut usize) -> Result<u32, String> {
    if *pos + 3 > data.len() {
        return Err("VP3: int24 truncado".to_string());
    }
    let v = ((data[*pos] as u32) << 16)
        | ((data[*pos + 1] as u32) << 8)
        | (data[*pos + 2] as u32);
    *pos += 3;
    Ok(v)
}

fn read_int_32be(data: &[u8], pos: &mut usize) -> Result<u32, String> {
    if *pos + 4 > data.len() {
        return Err("VP3: int32 truncado".to_string());
    }
    let v = ((data[*pos] as u32) << 24)
        | ((data[*pos + 1] as u32) << 16)
        | ((data[*pos + 2] as u32) << 8)
        | (data[*pos + 3] as u32);
    *pos += 4;
    Ok(v)
}

fn read_int_16be(data: &[u8], pos: &mut usize) -> Result<u16, String> {
    if *pos + 2 > data.len() {
        return Err("VP3: int16 truncado".to_string());
    }
    let v = ((data[*pos] as u16) << 8) | (data[*pos + 1] as u16);
    *pos += 2;
    Ok(v)
}

fn read_int_8(data: &[u8], pos: &mut usize) -> Result<u8, String> {
    if *pos >= data.len() {
        return Err("VP3: int8 truncado".to_string());
    }
    let v = data[*pos];
    *pos += 1;
    Ok(v)
}

pub fn parse_vp3(bytes: &[u8]) -> Result<EmbroideryPattern, String> {
    if bytes.len() < 10 {
        return Err("Arquivo VP3 muito curto".to_string());
    }

    if !bytes.starts_with(b"%vsm%\0") {
        return Err("Assinatura %vsm% não encontrada no início do arquivo VP3".to_string());
    }

    let mut pos = 6;

    skip_string_utf16(bytes, &mut pos)?; // "Produced by     Software Ltd"
    pos += 7;
    skip_string_utf16(bytes, &mut pos)?; // "" comments and note string
    pos += 32;

    let center_x = signed32(read_int_32be(bytes, &mut pos)?) as f32 / 100.0;
    let center_y = -(signed32(read_int_32be(bytes, &mut pos)?) as f32 / 100.0);

    pos += 27;
    skip_string_utf16(bytes, &mut pos)?; // ""
    pos += 24;
    skip_string_utf16(bytes, &mut pos)?; // "Produced by     Software Ltd"

    let count_colors = read_int_16be(bytes, &mut pos)?;

    let mut pattern = EmbroideryPattern::new();
    let mut palette = Vec::new();

    for color_idx in 0..count_colors {
        // bytescheck: \x00\x05\x00
        if pos + 3 > bytes.len() {
            break;
        }
        if bytes[pos] == 0x00 && bytes[pos + 1] == 0x05 && bytes[pos + 2] == 0x00 {
            pos += 3;
        } else {
            break;
        }

        let distance_to_next_block = read_int_32be(bytes, &mut pos)?;
        let block_end_position = (distance_to_next_block as usize) + pos;

        let start_position_x = signed32(read_int_32be(bytes, &mut pos)?) as f32 / 100.0;
        let start_position_y = -(signed32(read_int_32be(bytes, &mut pos)?) as f32 / 100.0);

        let abs_x = start_position_x + center_x;
        let abs_y = start_position_y + center_y;
        let mut curr_x = abs_x;
        let mut curr_y = abs_y;
        if abs_x != 0.0 && abs_y != 0.0 {
            pattern.add_stitch(abs_x, abs_y, StitchType::Jump);
        }

        // vp3_read_thread
        let colors = read_int_8(bytes, &mut pos)?;
        let _transition = read_int_8(bytes, &mut pos)?;

        let mut r = 0u8;
        let mut g = 0u8;
        let mut b = 0u8;
        for _ in 0..colors {
            let rgb = read_int_24be(bytes, &mut pos)?;
            r = ((rgb >> 16) & 0xFF) as u8;
            g = ((rgb >> 8) & 0xFF) as u8;
            b = (rgb & 0xFF) as u8;
            let _parts = read_int_8(bytes, &mut pos)?;
            let _color_length = read_int_16be(bytes, &mut pos)?;
        }
        palette.push(Rgba([r, g, b, 255]));

        let _thread_type = read_int_8(bytes, &mut pos)?;
        let _thread_weight = read_int_8(bytes, &mut pos)?;

        skip_string_utf8(bytes, &mut pos)?; // catalog_number
        skip_string_utf8(bytes, &mut pos)?; // description
        skip_string_utf8(bytes, &mut pos)?; // brand

        pos += 15;

        // bytescheck: \x0A\xF6\x00 (read without validation, like pyembroidery)
        if pos + 3 > bytes.len() {
            break;
        }
        pos += 3;

        let stitch_byte_length = block_end_position.saturating_sub(pos);
        if stitch_byte_length == 0 {
            pos = block_end_position;
            continue;
        }
        if pos + stitch_byte_length > bytes.len() {
            pos = block_end_position;
            continue;
        }

        let stitch_bytes = &bytes[pos..(pos + stitch_byte_length)];

        let mut i = 0;
        while i < stitch_bytes.len() - 1 {
            let x = stitch_bytes[i];
            let y = stitch_bytes[i + 1];
            i += 2;

            if (x & 0xFF) != 0x80 {
                let dx = x as i8 as f32;
                let dy = y as i8 as f32;
                curr_x += dx;
                curr_y += dy;
                pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
                continue;
            }

            if y == 0x01 {
                if i + 4 <= stitch_bytes.len() {
                    let dx = signed16(stitch_bytes[i], stitch_bytes[i + 1]) as f32;
                    let dy = signed16(stitch_bytes[i + 2], stitch_bytes[i + 3]) as f32;
                    i += 4;
                    curr_x += dx;
                    curr_y += dy;
                    pattern.add_stitch(curr_x, curr_y, StitchType::Stitch);
                }
                // Final element is typically 0x80 0x02, skipped regardless of its value.
                i += 2;
            } else if y == 0x02 {
                // This is only seen after 80 01 and should have been skipped. Has no known effect.
            } else if y == 0x03 {
                // Trim command: breaks the stitch line, like pyembroidery's out.trim()
                pattern.add_stitch(curr_x, curr_y, StitchType::Trim);
            }
        }

        if (color_idx as usize) + 1 < count_colors as usize {
            pattern.add_stitch(0.0, 0.0, StitchType::ColorChange);
        }

        pos = block_end_position;
    }

    if !palette.is_empty() {
        pattern.palette = Some(palette);
    }

    pattern.add_stitch(0.0, 0.0, StitchType::End);

    Ok(pattern)
}