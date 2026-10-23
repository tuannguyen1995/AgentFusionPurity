#!/usr/bin/env python3
"""
Generate high-resolution branding logo for AgentFusionPurity:
Tokamak Magnetic Confinement Plasma Torus & Tritium Breeding Oracle
"""

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def generate_logo():
    width = 800
    height = 500
    image = Image.new("RGBA", (width, height), (4, 3, 10, 255))
    draw = ImageDraw.Draw(image)

    # Background subtle radial glow
    center_x = width // 2
    center_y = 210

    for r in range(220, 0, -4):
        alpha = int(45 * (1 - r / 220))
        draw.ellipse(
            [center_x - r, center_y - r, center_x + r, center_y + r],
            fill=(110, 25, 230, alpha)
        )

    for r in range(120, 0, -3):
        alpha = int(70 * (1 - r / 120))
        draw.ellipse(
            [center_x - r, center_y - r, center_x + r, center_y + r],
            fill=(6, 182, 212, alpha)
        )

    # Tokamak Magnetic Coils & Plasma Torus
    # Outer D-shaped magnetic coils
    num_coils = 16
    for i in range(num_coils):
        angle = (2 * math.pi / num_coils) * i
        rx = 130 * math.cos(angle)
        ry = 75 * math.sin(angle)
        px = center_x + rx
        py = center_y + ry
        coil_w = 14
        coil_h = 36
        draw.ellipse(
            [px - coil_w, py - coil_h, px + coil_w, py + coil_h],
            outline=(217, 70, 239, 180),
            width=2
        )

    # Plasma Torus Core
    for t in range(0, 360, 2):
        rad = math.radians(t)
        px = center_x + 90 * math.cos(rad)
        py = center_y + 45 * math.sin(rad)
        draw.ellipse([px - 6, py - 6, px + 6, py + 6], fill=(6, 182, 212, 190))

    # Core high-temperature fusion spark
    for r in range(35, 0, -2):
        alpha = int(220 * (1 - r / 35))
        draw.ellipse(
            [center_x - r, center_y - r, center_x + r, center_y + r],
            fill=(255, 255, 255, alpha)
        )

    # Tritium Breeding blanket indicators (dots)
    for i in range(12):
        ang = (2 * math.pi / 12) * i
        bx = center_x + 160 * math.cos(ang)
        by = center_y + 90 * math.sin(ang)
        draw.ellipse([bx - 4, by - 4, bx + 4, by + 4], fill=(16, 185, 129, 230))

    # Text rendering (simple fallback fonts)
    try:
        font_large = ImageFont.truetype("arial.ttf", 36)
        font_sub = ImageFont.truetype("arial.ttf", 15)
        font_badge = ImageFont.truetype("arial.ttf", 12)
    except Exception:
        font_large = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_badge = ImageFont.load_default()

    title = "AGENT FUSION PURITY"
    subtitle = "AUTONOMOUS TOKAMAK PLASMA & TRITIUM BREEDING ORACLE"
    tagline = "GENLAYER STUDIONET (CHAIN 61999) · LAWSON CRITERION VERIFICATION"

    bbox1 = draw.textbbox((0, 0), title, font=font_large)
    w1 = bbox1[2] - bbox1[0]
    draw.text((center_x - w1 // 2, 350), title, fill=(245, 243, 255, 255), font=font_large)

    bbox2 = draw.textbbox((0, 0), subtitle, font=font_sub)
    w2 = bbox2[2] - bbox2[0]
    draw.text((center_x - w2 // 2, 400), subtitle, fill=(6, 182, 212, 255), font=font_sub)

    bbox3 = draw.textbbox((0, 0), tagline, font=font_badge)
    w3 = bbox3[2] - bbox3[0]
    draw.text((center_x - w3 // 2, 435), tagline, fill=(167, 139, 250, 220), font=font_badge)

    out_path = Path(__file__).parent.parent / "logo.png"
    image.save(out_path, "PNG")
    print(f"[+] Logo successfully generated at: {out_path}")


if __name__ == "__main__":
    generate_logo()
