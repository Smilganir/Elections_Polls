"""Recolor the lowest horizontal stroke in N12 party wordmarks to the party dash color."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "parties" / "n12"
SOURCE = Path(__file__).resolve().parent / "n12-logo-source"
# Morphological opening mis-paints letter bases on these wordmarks.
SKIP_COLORIZE = {"yashar.png"}

PARTY_FILES: dict[str, str] = {
    "yashar.png": "#FA6469",
    "likud.png": "#00C4FF",
    "yahad.png": "#F06EAA",
    "democrats.png": "#E30613",
    "yisrael-beiteinu.png": "#8B3FB2",
    "utj.png": "#8096AB",
    "shas.png": "#ADB9CE",
    "otzma-yehudit.png": "#4E93D4",
    "joint-arab-list.png": "#E8933A",
    "religious-zionism.png": "#4598EB",
    "raam.png": "#C4B845",
    "ofer-winter.png": "#3778BE",
    "yesh-atid.png": "#D4DCE8",
    "blue-white.png": "#E88B7A",
    "reservists-economic.png": "#6B8FAD",
    "bayit-yehudi-reservists.png": "#6B8FAD",
    "hadash-taal.png": "#E8933A",
    "balad.png": "#B8956A",
}


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def erode(mask: np.ndarray, kh: int, kw: int) -> np.ndarray:
    pad_y, pad_x = kh // 2, kw // 2
    padded = np.pad(mask, ((pad_y, kh - 1 - pad_y), (pad_x, kw - 1 - pad_x)), constant_values=False)
    h, w = mask.shape
    out = np.ones_like(mask)
    for dy in range(kh):
        for dx in range(kw):
            out &= padded[dy : dy + h, dx : dx + w]
    return out


def dilate(mask: np.ndarray, kh: int, kw: int) -> np.ndarray:
    pad_y, pad_x = kh // 2, kw // 2
    padded = np.pad(mask, ((pad_y, kh - 1 - pad_y), (pad_x, kw - 1 - pad_x)), constant_values=False)
    h, w = mask.shape
    out = np.zeros_like(mask)
    for dy in range(kh):
        for dx in range(kw):
            out |= padded[dy : dy + h, dx : dx + w]
    return out


def opening(mask: np.ndarray, kh: int, kw: int) -> np.ndarray:
    return dilate(erode(mask, kh, kw), kh, kw)


def colorize(path: Path, color: str) -> None:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    a = arr[..., 3]
    lum = arr[..., :3].mean(axis=2)
    ink = (a > 50) & (lum > 160)
    if ink.sum() < 30:
        return

    ys, xs = np.where(ink)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    ch = max(1, y1 - y0 + 1)
    cw = max(1, x1 - x0 + 1)

    kw = max(10, cw // 5)
    kh = 2
    dashes = opening(ink, kh, kw)

    # Keep only the lowest band of dash pixels (the "lower dash")
    if dashes.any():
        dash_ys = np.where(dashes.any(axis=1))[0]
        # cluster from the bottom
        low = int(dash_ys[-1])
        band_top = low
        for y in range(low, y0 - 1, -1):
            if dashes[y].any() and (band_top - y) <= 8:
                band_top = y
            elif y < band_top - 1:
                break
        keep = np.zeros_like(dashes)
        keep[band_top : low + 1] = dashes[band_top : low + 1]
        # ignore bands that sit in the top third (main letter bars)
        if band_top <= y0 + 0.28 * ch and (low - band_top) <= 3:
            keep[:] = False
        dashes = keep

    cr, cg, cb = hex_rgb(color)
    if dashes.any():
        dil = dilate(dashes, 3, 3)
        sel = dil & (a > 20) & (lum > 90)
        arr[..., 0][sel] = cr
        arr[..., 1][sel] = cg
        arr[..., 2][sel] = cb
    Image.fromarray(arr).save(path)


def main() -> None:
    for name, color in PARTY_FILES.items():
        src = SOURCE / name
        dest = ROOT / name
        if not src.exists():
            print("missing", name)
            continue
        dest.write_bytes(src.read_bytes())
        if name not in SKIP_COLORIZE:
            colorize(dest, color)
        print("ok", name)


if __name__ == "__main__":
    main()
