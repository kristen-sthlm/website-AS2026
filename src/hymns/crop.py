#!/usr/bin/env python3
"""Crop white margins from monochrome PNGs in ./scores, leave 20px padding, save back with max compression."""

from pathlib import Path
import numpy as np
from PIL import Image

FOLDER = Path("scores")
PADDING = 50

def crop_white_margin(path: Path) -> None:
    img = Image.open(path).convert("1")
    arr = np.array(img, dtype=bool)  # True = white, False = black
    black = ~arr
    if not black.any():
        return
    rows = np.where(black.any(axis=1))[0]
    cols = np.where(black.any(axis=0))[0]
    h, w = arr.shape
    top = max(rows[0] - PADDING, 0)
    bottom = min(rows[-1] + 1 + PADDING, h)
    left = max(cols[0] - PADDING, 0)
    right = min(cols[-1] + 1 + PADDING, w)
    cropped = img.crop((left, top, right, bottom))
    cropped.save(path, format="PNG", optimize=True, compress_level=9, bits=1)

def main() -> None:
    for p in sorted(FOLDER.glob("*.png")):
        crop_white_margin(p)
        print(f"cropped: {p}")

if __name__ == "__main__":
    main()
