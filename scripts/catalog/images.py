"""Catalog image pipeline (needs Pillow, numpy, scipy).

  python3 scripts/catalog/images.py categories   # composed category tiles
  python3 scripts/catalog/images.py products     # cutouts for every product image

Reads the snapshot in .catalog-cache/woo/, writes processed images to
.catalog-cache/images/<kind>/ and a manifest (.catalog-cache/images/<kind>.json)
mapping each item to its file and its content-hashed bucket key.
"""

import hashlib
import io
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from cutout import cutout  # noqa: E402

ROOT = Path.cwd()
CACHE = ROOT / ".catalog-cache"
WOO = CACHE / "woo"
RAW = CACHE / "raw"
OUT = CACHE / "images"
TILE = (233, 234, 236)  # --tile: the cool grey behind every product card
PICKS = Path(__file__).with_name("category-picks.json")  # optional manual product picks per category


def fetch(url: str) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    dest = RAW / (hashlib.sha1(url.encode()).hexdigest()[:16] + Path(url.split("?")[0]).suffix.lower())
    if not dest.exists():
        # Some store URLs contain non-ASCII characters (e.g. en dashes); percent-encode them.
        safe_url = urllib.parse.quote(url, safe=":/?=&%#+")
        req = urllib.request.Request(safe_url, headers={"User-Agent": "catalog-import/1.0"})
        with urllib.request.urlopen(req, timeout=60) as res:
            dest.write_bytes(res.read())
    if dest.suffix == ".avif":  # older Pillow can't decode AVIF; convert once with ffmpeg if given
        png = dest.with_suffix(".png")
        ffmpeg = os.environ.get("FFMPEG")
        if not png.exists() and ffmpeg:
            subprocess.run([ffmpeg, "-loglevel", "error", "-y", "-i", str(dest), str(png)], check=True)
        if png.exists():
            return png
    return dest


def clean_score(img: Image.Image) -> float:
    """Share of transparent pixels after cutout: real product shots score high, banners near 0."""
    a = np.asarray(img.getchannel("A"))
    return float((a < 10).mean())


def save_webp(img: Image.Image, folder: Path, stem: str, **kw) -> dict:
    folder.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    img.save(buf, "WEBP", **kw)
    data = buf.getvalue()
    digest = hashlib.sha256(data).hexdigest()[:12]
    name = f"{stem}-{digest}.webp"
    (folder / name).write_bytes(data)
    return {"file": str((folder / name).relative_to(ROOT)), "key": f"{folder.name}/{name}", "width": img.width, "height": img.height}


def shadow(img: Image.Image) -> Image.Image:
    a = img.getchannel("A").point(lambda v: 70 if v > 10 else 0)
    s = Image.new("RGBA", img.size, (20, 22, 30, 0))
    s.putalpha(a)
    return s.filter(ImageFilter.GaussianBlur(26))


def compose(cuts: list[Image.Image], size: int = 1000) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), TILE + (255,))
    layouts = {1: [(0, 0.95)], 2: [(-0.19, 0.8), (0.19, 0.8)], 3: [(-0.27, 0.7), (0.27, 0.7), (0, 0.86)]}
    for cut, (dx, scale) in zip(cuts, layouts[len(cuts)]):
        side = int(size * 0.82 * scale)
        c = cut.resize((side, side), Image.LANCZOS)
        x = int(size / 2 + dx * size - side / 2)
        y = int(size / 2 - side / 2 + (1 - scale) * 110)
        canvas.alpha_composite(shadow(c), (x + 10, y + 24))
        canvas.alpha_composite(c, (x, y))
    return canvas.convert("RGB")


def _pixels(src: str) -> int:
    try:
        with Image.open(fetch(src)) as im:
            return im.width * im.height
    except Exception:
        return 0


def square(img: Image.Image, size: int = 1000) -> Image.Image:
    img = img.convert("RGB")
    side = min(img.size)
    left, top = (img.width - side) // 2, (img.height - side) // 2
    return img.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)


def load():
    categories = json.loads((WOO / "categories.json").read_text())
    products = json.loads((WOO / "products.json").read_text())
    return categories, products


def run_categories(only: list[str]):
    categories, products = load()
    picks = json.loads(PICKS.read_text()) if PICKS.exists() else {}
    manifest_path = OUT / "categories.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for c in categories:
        if c["slug"] == "uncategorized" or (only and c["slug"] not in only):
            continue
        members = [p for p in products if p["images"] and any(x["slug"] == c["slug"] for x in p["categories"])]
        if c["slug"] in picks:
            by_id = {p["id"]: p for p in products}
            chosen = [by_id[i] for i in picks[c["slug"]] if i in by_id]
        else:
            chosen = members[:40]  # score up to 40 photos and keep the cleanest three
        srcs = list(dict.fromkeys(p["images"][0]["src"] for p in chosen))
        def safe_fetch(src):
            try:
                return fetch(src)
            except Exception as error:
                print(f"    download failed {src}: {error}")
                return None

        with ThreadPoolExecutor(8) as pool:
            files = list(pool.map(safe_fetch, srcs))
        cuts = []
        for f, s in zip(files, srcs):
            if f is None:
                continue
            try:
                img = cutout(f)
            except Exception as error:  # unreadable source: pick from the other photos
                print(f"    skipped {s}: {error}")
                continue
            cuts.append((clean_score(img), img, s))
        if c["slug"] not in picks:
            cuts.sort(key=lambda t: -t[0])
        best = cuts[:3]
        if not best:
            print(f"  {c['slug']}: no product photos")
            continue
        score = round(sum(b[0] for b in best) / len(best), 2)
        if score < 0.3 and c["slug"] not in picks:
            # Every photo is a styled promo shot: a fan of them looks busy, so use the
            # sharpest single photo full-bleed instead.
            src = max(srcs, key=lambda s: _pixels(s))
            entry = save_webp(square(Image.open(fetch(src))), OUT / "categories", c["slug"], quality=86)
            entry["sources"] = [src]
            entry["style"] = "photo"
        else:
            entry = save_webp(compose([b[1] for b in best]), OUT / "categories", c["slug"], quality=86)
            entry["sources"] = [b[2] for b in best]
            entry["style"] = "composed"
        entry["score"] = score
        manifest[c["slug"]] = entry
        print(f"  {c['slug']:<40} {len(best)} products, clean score {entry['score']}")
    manifest_path.write_text(json.dumps(manifest, indent=1))
    print(f"categories: {len(manifest)} images")


def run_products():
    _, products = load()
    jobs = [(p["id"], i, img["src"]) for p in products for i, img in enumerate(p["images"])]
    manifest_path = OUT / "products.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    todo = [j for j in jobs if j[2] not in manifest]
    print(f"product images: {len(jobs)} total, {len(todo)} to process")

    def work(job):
        pid, pos, src = job
        try:
            img = cutout(fetch(src))
            if max(img.size) > 1200:
                img.thumbnail((1200, 1200), Image.LANCZOS)
            entry = save_webp(img, OUT / "products", f"{pid}-{pos}", quality=84, method=5)
            entry["score"] = round(clean_score(img), 2)
            return src, entry
        except Exception as error:  # keep going; failures are reported in the manifest
            return src, {"error": str(error)}

    done = 0
    with ThreadPoolExecutor(8) as pool:
        for src, entry in pool.map(work, todo):
            manifest[src] = entry
            done += 1
            if done % 100 == 0:
                manifest_path.write_text(json.dumps(manifest))
                print(f"  {done}/{len(todo)}")
    manifest_path.write_text(json.dumps(manifest))
    errors = sum(1 for e in manifest.values() if "error" in e)
    print(f"product images: {len(manifest)} in manifest, {errors} errors")


def run_overrides():
    """Composed range photos for products with no photo of their own (prisma/data/image-overrides.json)."""
    _, products = load()
    by_id = {p["id"]: p for p in products}
    overrides = json.loads((ROOT / "prisma" / "data" / "image-overrides.json").read_text())
    manifest_path = OUT / "products.json"
    manifest = json.loads(manifest_path.read_text())
    for pid, spec in overrides.items():
        if "compose" not in spec:
            continue
        cuts = [cutout(fetch(by_id[i]["images"][0]["src"])) for i in spec["compose"] if by_id.get(i) and by_id[i]["images"]]
        canvas = compose(cuts).convert("RGBA")
        entry = save_webp(canvas, OUT / "products", f"{pid}-range", quality=84, method=5)
        manifest[f"override:{pid}"] = entry
        print(f"  {pid}: range photo from {len(cuts)} products -> {entry['key']}")
    manifest_path.write_text(json.dumps(manifest))


if __name__ == "__main__":
    if sys.argv[1] == "categories":
        run_categories(sys.argv[2:])  # optional: only these category slugs
    elif sys.argv[1] == "overrides":
        run_overrides()
    else:
        run_products()
