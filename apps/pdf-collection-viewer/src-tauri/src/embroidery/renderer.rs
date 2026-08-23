use crate::embroidery::{EmbroideryPattern, StitchType};
use crate::thumbnails::thumbnail_key;
use image::codecs::webp::WebPEncoder;
use image::{ExtendedColorType, ImageEncoder, Rgba, RgbaImage};
use std::fs;
use std::path::Path;

const CANVAS_SIZE: u32 = 300;
const PADDING: f32 = 20.0;

// Paleta de cores de alto contraste padrão quando o arquivo não fornece cores RGB embutidas
const DEFAULT_PALETTE: [Rgba<u8>; 8] = [
    Rgba([35, 87, 137, 255]),   // Azul clássico
    Rgba([220, 53, 69, 255]),   // Vermelho vivo
    Rgba([40, 167, 69, 255]),   // Verde esmeralda
    Rgba([255, 193, 7, 255]),   // Dourado
    Rgba([111, 66, 193, 255]),  // Roxo
    Rgba([253, 126, 20, 255]),  // Laranja
    Rgba([32, 201, 151, 255]),  // Ciano escuro
    Rgba([52, 58, 64, 255]),    // Grafite escuro
];

/// Renderiza um EmbroideryPattern em uma imagem RgbaImage de tamanho fixo CANVAS_SIZE x CANVAS_SIZE.
pub fn render_pattern(pattern: &EmbroideryPattern) -> RgbaImage {
    // Fundo branco limpo com leve transparência nas bordas se desejado, mas sólido é ideal para thumbnails
    let mut img = RgbaImage::from_pixel(CANVAS_SIZE, CANVAS_SIZE, Rgba([255, 255, 255, 255]));

    if pattern.stitches.is_empty() {
        return img;
    }

    // 1. Calcula o Bounding Box considerando apenas pontos com costura
    let mut min_x = f32::MAX;
    let mut max_x = f32::MIN;
    let mut min_y = f32::MAX;
    let mut max_y = f32::MIN;
    let mut has_points = false;

    for s in &pattern.stitches {
        if s.stitch_type == StitchType::Stitch {
            has_points = true;
            if s.x < min_x { min_x = s.x; }
            if s.x > max_x { max_x = s.x; }
            if s.y < min_y { min_y = s.y; }
            if s.y > max_y { max_y = s.y; }
        }
    }

    if !has_points || min_x >= max_x || min_y >= max_y {
        // Se só houver pontos singulares ou vazios
        return img;
    }

    let pattern_w = (max_x - min_x).max(1.0);
    let pattern_h = (max_y - min_y).max(1.0);

    let drawable_size = (CANVAS_SIZE as f32) - (PADDING * 2.0);
    let scale_x = drawable_size / pattern_w;
    let scale_y = drawable_size / pattern_h;
    let scale = scale_x.min(scale_y);

    let offset_x = PADDING + (drawable_size - (pattern_w * scale)) / 2.0;
    let offset_y = PADDING + (drawable_size - (pattern_h * scale)) / 2.0;

    let palette = pattern.palette.as_deref().unwrap_or(&DEFAULT_PALETTE);
    let mut color_idx = 0;
    let mut current_color = if !palette.is_empty() {
        palette[0]
    } else {
        DEFAULT_PALETTE[0]
    };

    let mut prev_pt: Option<(i32, i32)> = None;

    // Em gráficos de bordado, Y frequentemente cresce para cima, enquanto em bitmap cresce para baixo.
    // Invertemos Y mapeando: canvas_y = offset_y + (max_y - y) * scale
    for s in &pattern.stitches {
        match s.stitch_type {
            StitchType::ColorChange => {
                color_idx = (color_idx + 1) % palette.len();
                current_color = palette[color_idx];
                prev_pt = None;
            }
            StitchType::Jump | StitchType::Trim => {
                prev_pt = None;
            }
            StitchType::Stitch => {
                let px = (offset_x + (s.x - min_x) * scale).round() as i32;
                let py = if pattern.invert_y {
                    (offset_y + (s.y - min_y) * scale).round() as i32
                } else {
                    (offset_y + (max_y - s.y) * scale).round() as i32
                };

                if let Some((x0, y0)) = prev_pt {
                    draw_thick_line(&mut img, x0, y0, px, py, current_color);
                }
                prev_pt = Some((px, py));
            }
            StitchType::End => break,
        }
    }

    img
}

/// Desenha uma linha suave com espessura 1.5px usando o algoritmo de Bresenham com offsets
fn draw_thick_line(img: &mut RgbaImage, x0: i32, y0: i32, x1: i32, y1: i32, color: Rgba<u8>) {
    let width = img.width() as i32;
    let height = img.height() as i32;

    let mut plot = |x: i32, y: i32| {
        if x >= 0 && x < width && y >= 0 && y < height {
            img.put_pixel(x as u32, y as u32, color);
        }
    };

    let dx = (x1 - x0).abs();
    let dy = (y1 - y0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx - dy;

    let mut cx = x0;
    let mut cy = y0;

    loop {
        plot(cx, cy);
        // Traçado levemente mais encorpado para imitar linha de bordado visível em miniatura
        if dx > dy {
            plot(cx, cy + 1);
        } else {
            plot(cx + 1, cy);
        }

        if cx == x1 && cy == y1 {
            break;
        }

        let e2 = 2 * err;
        if e2 > -dy {
            err -= dy;
            cx += sx;
        }
        if e2 < dx {
            err += dx;
            cy += sy;
        }
    }
}

/// Salva o padrão de bordado renderizado no diretório de cache como WebP
pub fn save_pattern_thumbnail(
    pattern: &EmbroideryPattern,
    path: &str,
    cache_dir: &Path,
) -> Result<(), String> {
    let key = thumbnail_key(path);
    let output_path = cache_dir.join(&key);

    let img = render_pattern(pattern);
    let (w, h) = (img.width(), img.height());
    let raw_bytes = img.into_raw();

    let mut encoded = Vec::new();
    let encoder = WebPEncoder::new_lossless(&mut encoded);
    encoder
        .write_image(&raw_bytes, w, h, ExtendedColorType::Rgba8)
        .map_err(|e| format!("Falha ao codificar WebP de bordado: {e}"))?;

    fs::write(&output_path, &encoded)
        .map_err(|e| format!("Falha ao salvar thumbnail de bordado: {e}"))?;

    Ok(())
}
