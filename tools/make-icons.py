#!/usr/bin/env python3
"""Generate the PWA icons from pure maths - no image library, no assets.

Draws a watermelon half with a blade streak, full-bleed so the same file
works as a normal icon and as an Android maskable icon (all the important
shapes sit inside the central 80% safe zone).

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


RIND_OUT = (20, 83, 45)
RIND_IN = (63, 163, 77)
PITH = (247, 246, 216)
FLESH_C = (255, 143, 163)
FLESH_E = (217, 43, 71)
SEED = (42, 26, 12)
BG_C = (58, 31, 122)
BG_E = (16, 10, 42)

THETA = math.radians(-22)
CT, ST = math.cos(THETA), math.sin(THETA)
CX, CY = 0.0, 0.06
R = 0.60
SEEDS = [(-0.30, 0.22), (-0.06, 0.34), (0.22, 0.24), (0.36, 0.10), (-0.42, 0.08), (0.06, 0.13)]


def sample(x, y):
    """x,y in [-1,1]. Returns an RGB tuple."""
    d = math.hypot(x, y)
    col = mix(BG_C, BG_E, d / 1.35)

    # fruit, in its own rotated frame
    u = (x - CX) * CT + (y - CY) * ST
    v = -(x - CX) * ST + (y - CY) * CT
    r = math.hypot(u, v)
    if v >= 0 and r <= R:
        k = r / R
        if k > 0.88:
            col = mix(RIND_IN, RIND_OUT, (k - 0.88) / 0.12)
        elif k > 0.80:
            col = PITH
        else:
            col = mix(FLESH_C, FLESH_E, k / 0.80)
            for sx, sy in SEEDS:
                if math.hypot((u - sx) / 0.055, (v - sy) / 0.075) < 1.0:
                    col = SEED
        # soft top lighting on the rind side
        col = over(col, (255, 255, 255), max(0.0, 0.18 * (1 - k) * (1 - v / R)))

    # blade streak
    bx, by = 0.86, -0.50
    t = (x * bx + y * by) / (bx * bx + by * by)
    t = max(-1.0, min(1.0, t))
    dist = math.hypot(x - bx * t, y - by * t)
    w = 0.035 * (1.0 - abs(t) * 0.55)
    if dist < w * 3:
        a = max(0.0, 1 - dist / (w * 3)) ** 2 * 0.85
        col = over(col, (255, 255, 255), a)
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
