"""Make product photos' white studio backgrounds transparent.

Only near-white pixels connected to the image border count as background, so
white highlights inside a product stay opaque. Background pixels get a
colour-to-alpha pass (white -> transparent, grey shadow -> translucent black),
then faint residue (watermark text, haze) under ALPHA_FLOOR is dropped.

usage: python3 -I cutout.py OUT_DIR IMG [IMG ...]
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

BG_DISTANCE = 34      # max channel distance from white to count as background
ALPHA_FLOOR = 0.2     # drop anything fainter than this inside the background region


def cutout(path: Path) -> Image.Image:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    dist = (255.0 - rgb).max(axis=2)

    near_white = dist < BG_DISTANCE
    labels, _ = ndimage.label(near_white)
    border = np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])
    bg_labels = np.unique(border[border > 0])
    region = np.isin(labels, bg_labels)
    # Grow the region by a pixel so the anti-aliased fringe goes through colour-to-alpha too.
    region = ndimage.binary_dilation(region, iterations=1)

    alpha = np.ones(dist.shape, np.float32)
    a = dist / 255.0
    a = np.clip((a - ALPHA_FLOOR) / (1.0 - ALPHA_FLOOR), 0.0, 1.0)
    alpha[region] = a[region]

    out = rgb.copy()
    safe = np.maximum(alpha, 1e-3)[..., None]
    unmixed = np.clip((rgb - 255.0 * (1.0 - safe)) / safe, 0, 255)
    out[region] = unmixed[region]

    rgba = np.dstack([out, alpha * 255.0]).round().astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        # Re-centre on a square canvas with even padding so every product sits the same way.
        crop = img.crop(bbox)
        side = int(max(crop.size) * 1.12)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
        img = canvas
    return img


def main() -> None:
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in sys.argv[2:]:
        src = Path(name)
        img = cutout(src)
        dest = out_dir / f"{src.stem}.png"
        img.save(dest, optimize=True)
        print(f"{src.name} -> {dest} {img.size}")


if __name__ == "__main__":
    main()
