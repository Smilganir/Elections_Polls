"""Digitize 120-seat hemicycle coordinates from the horseshoe template PNG."""
from __future__ import annotations

from collections import Counter, deque
from pathlib import Path

import numpy as np
from PIL import Image

TEMPLATE = Path(
    r"C:\Users\smilg\.cursor\projects\c-Users-smilg-Documents-Data-Viz-Cursor-isr-socio-elections"
    r"\assets\c__Users_smilg_AppData_Roaming_Cursor_User_workspaceStorage_4adc575dd2dc1052ee2f034821dda8cb_images_image-5cb7d0ba-488b-4945-854d-5e4553ed4f52.png"
)
OUT = Path(__file__).resolve().parent.parent / "src/lib/knessetSeatCoords.data.ts"


def zone_for(x: float, y: float) -> str:
    if y >= 68:
        return "opposition-wing" if x < 50 else "coalition-wing"
    if y <= 30:
        if x < 48:
            return "opposition-arch"
        if x < 54:
            return "arabs-center"
        if x < 60:
            return "haredi-center"
        return "coalition-arch"
    if x < 28:
        return "opposition-wing"
    if x > 72:
        return "coalition-wing"
    if y <= 50:
        return "opposition-arch" if x < 50 else "coalition-arch"
    return "opposition-wing" if x < 50 else "coalition-wing"


def extract_centers() -> list[tuple[float, float]]:
    img = Image.open(TEMPLATE).convert("RGB")
    arr = np.array(img)
    h, w = arr.shape[:2]
    mask = np.ones((h, w), dtype=bool)
    for y in range(h):
        for x in range(w):
            xp, yp = x / w * 100, y / h * 100
            # Mask only the "120" label — keep wing tips at the bottom corners.
            if yp > 90 and 38 < xp < 62:
                mask[y, x] = False
    gray = arr.mean(axis=2)
    mask &= gray < 175
    visited = np.zeros(mask.shape, dtype=bool)
    centers: list[tuple[float, float]] = []
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or visited[y, x]:
                continue
            q: deque[tuple[int, int]] = deque([(y, x)])
            pts: list[tuple[int, int]] = []
            visited[y, x] = True
            while q:
                cy, cx = q.popleft()
                pts.append((cx, cy))
                for dy in range(-1, 2):
                    for dx in range(-1, 2):
                        ny, nx = cy + dy, cx + dx
                        if (
                            0 <= ny < h
                            and 0 <= nx < w
                            and mask[ny, nx]
                            and not visited[ny, nx]
                        ):
                            visited[ny, nx] = True
                            q.append((ny, nx))
            if 80 < len(pts) < 6000:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                centers.append((sum(xs) / len(xs) / w * 100, sum(ys) / len(ys) / h * 100))
    centers.sort(key=lambda c: (c[1], c[0]))
    return centers


def pad_to_120(centers: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Insert one midpoint when digitization misses a single merged dot."""
    if len(centers) >= 120:
        return centers[:120]
    out = list(centers)
    while len(out) < 120:
        best_i = 0
        best_d = -1.0
        for i in range(len(out) - 1):
            x0, y0 = out[i]
            x1, y1 = out[i + 1]
            d = (x1 - x0) ** 2 + (y1 - y0) ** 2
            if d > best_d:
                best_d = d
                best_i = i
        x0, y0 = out[best_i]
        x1, y1 = out[best_i + 1]
        out.insert(best_i + 1, ((x0 + x1) / 2, (y0 + y1) / 2))
    return out


def main() -> None:
    centers = pad_to_120(extract_centers())
    print(f"extracted {len(centers)} seats")
    print("zones:", dict(Counter(zone_for(x, y) for x, y in centers)))

    lines = [
        "/** Digitized hemicycle seat coordinates (% of stage box). Do not hand-edit — run scripts/digitize_knesset_layout.py */",
        "import type { KnessetSeatSlot } from './knessetSeatLayout'",
        "",
        "export const KNESSET_SEAT_COORDS: readonly KnessetSeatSlot[] = [",
    ]
    for i, (x, y) in enumerate(centers):
        z = zone_for(x, y)
        lines.append(f"  {{ id: {i}, x: {round(x, 2)}, y: {round(y, 2)}, zone: '{z}' }},")
    lines.append("]")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
