"""Genera los íconos de la app (caja fuerte) en public/. Requiere Pillow:  pip install pillow
Uso:  python3 scripts/make_icons.py
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'public')
S = 1024  # lienzo base; se reduce a cada tamaño

def font(size):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def gradient(top, bottom):
    img = Image.new('RGB', (S, S))
    px = img.load()
    for y in range(S):
        t = y / (S - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(S): px[x, y] = c
    return img.convert('RGBA')

def draw_safe(img):
    d = ImageDraw.Draw(img)
    # sombra suave bajo la caja fuerte
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([212, 262, 812, 812], radius=80, fill=(0, 20, 70, 120))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(28)))
    d = ImageDraw.Draw(img)
    # patas
    for x in (270, 690): d.rounded_rectangle([x, 770, x + 64, 828], radius=16, fill=(150, 160, 175, 255))
    # cuerpo
    d.rounded_rectangle([212, 232, 812, 790], radius=84, fill=(246, 247, 250, 255))
    d.rounded_rectangle([212, 232, 812, 790], radius=84, outline=(205, 211, 221, 255), width=8)
    # puerta
    d.rounded_rectangle([262, 282, 762, 740], radius=56, fill=(226, 230, 237, 255), outline=(196, 203, 214, 255), width=8)
    # bisagras (izquierda)
    for y in (350, 590): d.rounded_rectangle([226, y, 262, y + 84], radius=14, fill=(118, 128, 144, 255))
    # manija (derecha)
    d.rounded_rectangle([716, 404, 752, 618], radius=18, fill=(255, 149, 0, 255))
    # dial: aro, marcas y perilla verde con $
    cx, cy = 482, 511
    d.ellipse([cx - 170, cy - 170, cx + 170, cy + 170], fill=(196, 203, 214, 255))
    d.ellipse([cx - 150, cy - 150, cx + 150, cy + 150], fill=(255, 255, 255, 255))
    for i in range(24):
        a = math.radians(i * 15 - 90)
        r1, r2 = (118, 140) if i % 2 == 0 else (128, 140)
        d.line([cx + r1 * math.cos(a), cy + r1 * math.sin(a), cx + r2 * math.cos(a), cy + r2 * math.sin(a)], fill=(130, 140, 156, 255), width=7 if i % 2 == 0 else 4)
    d.ellipse([cx - 84, cy - 84, cx + 84, cy + 84], fill=(52, 199, 89, 255))
    d.ellipse([cx - 84, cy - 84, cx + 84, cy + 84], outline=(36, 160, 68, 255), width=8)
    f = font(112)
    d.text((cx, cy + 4), '$', font=f, fill=(255, 255, 255, 255), anchor='mm')
    return img

def make(rounded):
    base = gradient((38, 148, 255), (0, 84, 214))
    base = draw_safe(base)
    if rounded:  # versión "any": esquinas redondeadas con transparencia
        mask = Image.new('L', (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=int(S * 0.225), fill=255)
        out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.paste(base, (0, 0), mask); return out
    return base

def save(img, name, size, rgb=False):
    im = img.resize((size, size), Image.LANCZOS)
    if rgb: im = im.convert('RGB')
    im.save(os.path.join(OUT, name))

full, rounded = make(False), make(True)
save(rounded, 'icon-512.png', 512)
save(rounded, 'icon-192.png', 192)
save(full, 'icon-maskable-512.png', 512, rgb=True)
save(full, 'apple-touch-icon.png', 180, rgb=True)   # iOS aplica sus propias esquinas
save(rounded, 'favicon.png', 48)
print('Íconos generados en', os.path.abspath(OUT))
