from PIL import Image, ImageDraw

# Generate a simple icon: blue background with a white "PDF" label.
SIZES = [16, 24, 32, 48, 64, 128, 256]

images = []
for size in SIZES:
    img = Image.new("RGBA", (size, size), (30, 58, 138, 255))  # Indigo
    draw = ImageDraw.Draw(img)
    radius = size // 5
    draw.ellipse((radius, radius, size - radius, size - radius), fill=(255, 255, 255, 255))
    draw.ellipse(
        (radius + size // 8, radius + size // 8, size - radius - size // 8, size - radius - size // 8),
        fill=(30, 58, 138, 255),
    )
    draw.rectangle(
        (size // 2 - size // 12, size // 3, size // 2 + size // 12, size - size // 3),
        fill=(255, 255, 255, 255),
    )
    images.append(img)

# Save as ICO using the largest image as the primary entry
images[-1].save(
    "icon.ico",
    format="ICO",
    sizes=[(s, s) for s in SIZES],
    append_images=images[:-1],
)

print("Generated valid icon.ico")