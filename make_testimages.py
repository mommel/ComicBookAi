# make_testimages.py
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = "testimages"
BG_COLOR = (255, 255, 255) 
TEXT_COLOR = (0, 0, 0) 

MARGIN_FACTOR = 0.9
SPACING_FACTOR = 0.04

# Vier Varianten: (Label, (Breite, Höhe), Suffix)
VARIANTEN = [
    ("1:1",  (1000, 1000), "s"), # square
    ("7:5",  (700,  500),  "h"), # horizontal
    ("5:7",  (500,  700),  "v"), # vertical
    ("5:14", (500,  1000), "n"), # narrow
]

os.makedirs(OUT_DIR, exist_ok=True)

def get_font(size: int) -> ImageFont.FreeTypeFont:
    """Versuche gängige System-Schriften; Fallback: Default."""
    candidates = [
        "arial.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()

def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont):
    """Ermittle Breite/Höhe für den Text (ohne Anchor-Verschiebungen)."""
    bbox = draw.textbbox((0, 0), text, font=font, anchor="lt")
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    return w, h

def choose_fonts_for_block(draw, number_text: str, label_text: str, w: int, h: int):
    """
    Wähle Schriftgrößen so, dass:
      - Nummer maximal groß ist,
      - Label exakt halb so groß,
      - beide Zeilen (mit Abstand) innerhalb MARGIN_FACTOR passen.
    """
    size = int(min(w, h) * 0.6)
    min_size = 8

    while size >= min_size:
        font_num = get_font(size)
        font_label = get_font(max(min_size, size // 2))

        num_w, num_h = text_size(draw, number_text, font_num)
        lab_w, lab_h = text_size(draw, label_text, font_label)

        spacing = int(h * SPACING_FACTOR)
        total_h = num_h + spacing + lab_h
        max_w = max(num_w, lab_w)

        if max_w <= w * MARGIN_FACTOR and total_h <= h * MARGIN_FACTOR:
            return font_num, font_label, num_w, num_h, lab_w, lab_h, spacing

        size -= max(2, size // 12)

    font_num = get_font(min_size)
    font_label = get_font(min_size // 2 if min_size // 2 > 0 else 6)
    num_w, num_h = text_size(draw, number_text, font_num)
    lab_w, lab_h = text_size(draw, label_text, font_label)
    spacing = int(h * SPACING_FACTOR)
    return font_num, font_label, num_w, num_h, lab_w, lab_h, spacing

def make_image(width: int, height: int, number: int, label: str, name_num: int, suffix: str):
    img = Image.new("RGB", (width, height), BG_COLOR)
    draw = ImageDraw.Draw(img)

    number_text = str(number)
    font_num, font_lab, num_w, num_h, lab_w, lab_h, spacing = choose_fonts_for_block(
        draw, number_text, label, width, height
    )

    total_h = num_h + spacing + lab_h
    center_x = width / 2
    top = (height - total_h) / 2

    num_center_y = top + num_h / 2
    draw.text((center_x, num_center_y), number_text, font=font_num, fill=TEXT_COLOR, anchor="mm")

    lab_center_y = num_center_y + num_h / 2 + spacing + lab_h / 2
    draw.text((center_x, lab_center_y), label, font=font_lab, fill=TEXT_COLOR, anchor="mm")

    filename = f"00001_{name_num}-{suffix}.jpg"
    out_path = os.path.join(OUT_DIR, filename)
    img.save(out_path, "JPEG", quality=95, optimize=True)
    return out_path

def main():
    saved = []
    for i in range(1, 21):
        name_num = i if i <= 10 else 31 - i

        for label, (w, h), suffix in VARIANTEN:
            path = make_image(w, h, i, label, name_num, suffix)
            saved.append(path)

    print("Fertig! Erzeugte Dateien:")
    for p in saved:
        print(" -", p)

if __name__ == "__main__":
    main()
