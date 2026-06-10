#!/usr/bin/env python3
"""Génère icons/icon-192.png et icons/icon-512.png (même design que icon.svg),
sans dépendance externe (écriture PNG via zlib/struct)."""
import struct, zlib, os

def png_write(path, w, h, pixels):
    raw = b"".join(b"\x00" + bytes(pixels[y]) for y in range(h))
    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)

def make_icon(size):
    S = size
    px = [[0] * (S * 4) for _ in range(S)]

    def put(x, y, rgba):
        if 0 <= x < S and 0 <= y < S:
            r, g, b, a = rgba
            row = px[y]; i = x * 4
            if a >= 255:
                row[i:i+4] = [r, g, b, 255]
            else:  # alpha blending simple
                ar = a / 255
                row[i]   = int(r * ar + row[i]   * (1 - ar))
                row[i+1] = int(g * ar + row[i+1] * (1 - ar))
                row[i+2] = int(b * ar + row[i+2] * (1 - ar))
                row[i+3] = max(row[i+3], a)

    u = S / 512  # facteur d'échelle depuis le design 512
    rad = 100 * u

    # fond dégradé vert à coins arrondis
    for y in range(S):
        t = (y / S)
        r = int(0x2e + (0x1b - 0x2e) * t)
        g = int(0x7d + (0x5e - 0x7d) * t)
        b = int(0x32 + (0x20 - 0x32) * t)
        for x in range(S):
            # coins arrondis
            cx = min(x, S - 1 - x); cy = min(y, S - 1 - y)
            if cx < rad and cy < rad:
                dx, dy = rad - cx, rad - cy
                if dx * dx + dy * dy > rad * rad:
                    continue
            put(x, y, (r, g, b, 255))

    def disc(cx, cy, rx, ry, color):
        cx, cy, rx, ry = cx * u, cy * u, rx * u, ry * u
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d <= 1:
                    put(x, y, color)
                elif d <= 1.15:  # antialiasing grossier du bord
                    a = int(color[3] * (1.15 - d) / 0.15)
                    put(x, y, (color[0], color[1], color[2], a))

    disc(256, 268, 150, 150, (255, 255, 255, 255))          # assiette
    disc(256, 268, 112, 112, (244, 246, 242, 255))          # fond assiette
    disc(218, 252, 58, 40, (255, 248, 225, 255))            # riz
    disc(300, 290, 56, 38, (255, 143, 0, 255))              # cari
    disc(286, 282, 11, 11, (230, 81, 0, 255))
    disc(316, 296, 10, 10, (230, 81, 0, 255))
    disc(356, 206, 26, 12, (198, 40, 40, 255))              # piment

    return px

here = os.path.dirname(os.path.abspath(__file__))
icons = os.path.join(here, "..", "icons")
for size in (192, 512):
    png_write(os.path.join(icons, f"icon-{size}.png"), size, size, make_icon(size))
    print(f"icon-{size}.png ok")
