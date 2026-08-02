import struct

# ICO header: reserved (2 bytes), type (2 bytes), count (2 bytes)
header = struct.pack('<HHH', 0, 1, 1)

# Directory entry: width, height, colors, reserved, planes, bitcount, size, offset
dir_entry = struct.pack('<BBBBHHII', 0, 0, 0, 0, 1, 32, 1024, 22)

# Dummy image data (1024 bytes)
image_data = bytes([0] * 1024)

with open('icon.ico', 'wb') as f:
    f.write(header + dir_entry + image_data)

print("Generated icon.ico")