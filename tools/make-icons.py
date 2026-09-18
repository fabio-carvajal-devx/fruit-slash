#!/usr/bin/env python3
"""Generate the PWA icons from pure maths - no image library, no assets.

Draws the cabinet's synthwave horizon, full-bleed so the same file works as a
normal icon and as an Android maskable icon (the sun and grid stay inside the
central safe zone that Android may crop to).

    python3 tools/make-icons.py
"""
import math, os, struct, zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
SS = 3  # supersampling factor


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def over(dst, src, alpha):
    return tuple(dst[i] + (src[i] - dst[i]) * alpha for i in range(3))


SKY_TOP = (18, 10, 53)
SKY_MID = (59, 26, 99)
SKY_LOW = (122, 43, 109)
GROUND = (10, 8, 30)
GRID = (120, 235, 255)
SUN_TOP = (255, 228, 94)
SUN_MID = (255, 138, 92)
SUN_BOT = (255, 46, 138)

HORIZON = 0.10          # y of the horizon in [-1,1] space
SUN_R = 0.58
STARS = [(-0.72, -0.66), (-0.38, -0.82), (0.12, -0.74), (0.62, -0.88),
         (0.84, -0.44), (-0.86, -0.28), (0.38, -0.92), (-0.12, -0.52)]


def sample(x, y):
    """x,y in [-1,1], y up-negative. Returns an RGB tuple."""
    if y < HORIZON:
        k = (y + 1) / (HORIZON + 1)
        col = mix(SKY_TOP, SKY_MID, k) if k < 0.7 else mix(SKY_MID, SKY_LOW, (k - 0.7) / 0.3)

        for sx, sy in STARS:                      # stars sit behind the sun
            if math.hypot(x - sx, y - sy) < 0.022:
                col = over(col, (255, 255, 255), 0.85)

        d = math.hypot(x, (y - HORIZON + SUN_R * 0.62))
        if d < SUN_R:
            t = (y - (HORIZON - SUN_R * 1.24)) / (SUN_R * 1.24)
            t = max(0.0, min(1.0, t))
            sun = mix(SUN_TOP, SUN_MID, t / 0.5) if t < 0.5 else mix(SUN_MID, SUN_BOT, (t - 0.5) / 0.5)
            # the classic scanline gaps, widening toward the bottom
            band = (y - (HORIZON - SUN_R * 1.24)) / (SUN_R * 0.19)
            frac = band - math.floor(band)
            if t > 0.32 and frac < 0.10 + t * 0.22:
                sun = mix(sun, SKY_LOW, 0.85)
            col = sun
        elif d < SUN_R * 1.5:                     # glow
            col = over(col, SUN_BOT, (1 - (d - SUN_R) / (SUN_R * 0.5)) * 0.28)
        return col

    # ground: a perspective grid receding to the horizon
    col = GROUND
    depth = (y - HORIZON) / (1 - HORIZON)
    depth = max(1e-4, depth)
    col = over(col, (60, 20, 90), 0.35 * (1 - depth))

    persp = 1.0 / depth
    line_w = 0.012 * persp
    u = x * persp
    if abs(u - round(u / 0.55) * 0.55) < line_w:
        col = over(col, GRID, min(0.95, 0.35 + depth))

    rows = math.sqrt(depth) * 7.0
    if rows - math.floor(rows) < 0.10:
        col = over(col, GRID, min(0.9, 0.25 + depth))
    return col


def render(size):
    rows = []
    n = size * SS
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc = [0.0, 0.0, 0.0]
            for sy in range(SS):
                for sx in range(SS):
                    x = ((px * SS + sx + 0.5) / n) * 2 - 1
                    y = ((py * SS + sy + 0.5) / n) * 2 - 1
                    c = sample(x, y)
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            k = SS * SS
            row += bytes(int(max(0, min(255, v / k))) for v in acc)
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + r for r in rows)
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print(f"  {os.path.basename(path)}  {len(png)/1024:.1f} KB")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print("rendering icons...")
    for s in (192, 512):
        write_png(os.path.join(OUT, f"icon-{s}.png"), s, render(s))
