"""Digitize 120-seat hemicycle coordinates from the horseshoe template PNG."""
from __future__ import annotations

from collections import Counter, deque
from pathlib import Path

import numpy as np
from PIL import Image

TEMPLATE = Path(
    r"C:\Users\smilg\.cursor\projects\c-Users-smilg-Documents-Data-Viz-Cursor-isr-socio-elections"
    r"\assets\c__Users_smilg_AppData_Roaming_Cursor_User_workspaceStorage_4adc575dd2dc1052ee2f034821dda8cb_images_image-1c14ec58-3ad6-4c7d-9e74-92c115f4b6dd.png"
)
OUT = Path(__file__).resolve().parent.parent / "src/lib/knessetSeatCoords.data.ts"


def is_wing(x: float) -> bool:
    return x < 28 or x > 72


def is_valid_position(x: float, y: float) -> bool:
    """Keep seats on the wings and top arch only — exclude the open center."""
    if y > 74 and 28 < x < 72:
        return False
    if y > 26 and 38 < x < 62:
        return False
    return True


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

    mask = arr.max(axis=2) > 20
    for y in range(h):
        for x in range(w):
            xp, yp = x / w * 100, y / h * 100
            if yp > 90 and 38 < xp < 62:
                mask[y, x] = False

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
            if 20 < len(pts) < 6000:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                cx = sum(xs) / len(xs) / w * 100
                cy = sum(ys) / len(ys) / h * 100
                if is_valid_position(cx, cy):
                    centers.append((cx, cy))

    centers.sort(key=lambda c: (c[1], c[0]))
    return centers


def _round_y(y: float) -> int:
    return round(y)


def _wing_column_positions(centers: list[tuple[float, float]], side: str) -> list[float]:
    xs: list[float] = []
    for x, y in centers:
        if side == "left" and x < 28:
            xs.append(x)
        elif side == "right" and x > 72:
            xs.append(x)
    return sorted(set(round(v, 2) for v in xs))


def _existing_at(centers: list[tuple[float, float]], x: float, y: float, tol=2.2) -> bool:
    return any(abs(px - x) < tol and abs(py - y) < tol for px, py in centers)


# Right-wing rows present on the left wing but absent in the PNG (109→120).
WING_EXTENSION_SEATS: list[tuple[float, float]] = [
    (79.22, 63.0),
    (85.15, 63.0),
    (91.06, 63.0),
    (96.99, 63.0),
    (79.22, 70.0),
    (85.15, 70.0),
    (91.06, 70.0),
    (96.99, 70.0),
    (83.65, 77.0),
    (89.59, 77.0),
    (95.5, 77.0),
]


def pad_to_120(centers: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Add wing-only seats when the PNG has fewer than 120 dots."""
    if len(centers) >= 120:
        return centers[:120]

    out = list(centers)
    for x, y in WING_EXTENSION_SEATS:
        if len(out) >= 120:
            break
        if is_valid_position(x, y) and not _existing_at(out, x, y):
            out.append((x, y))

    out.sort(key=lambda c: (c[1], c[0]))

    if len(out) < 120:
        raise RuntimeError(f"Could not pad to 120 seats — stuck at {len(out)}")

    return out[:120]


def main() -> None:
    raw = extract_centers()
    centers = pad_to_120(raw)
    print(f"extracted {len(raw)} seats, padded to {len(centers)}")
    print("zones:", dict(Counter(zone_for(x, y) for x, y in centers)))

    invalid = [(i, x, y) for i, (x, y) in enumerate(centers) if not is_valid_position(x, y)]
    if invalid:
        print("WARNING invalid positions:", invalid)

    center_hollow = [(i, x, y) for i, (x, y) in enumerate(centers) if y > 26 and 38 < x < 62]
    if center_hollow:
        print("WARNING center hollow seats:", center_hollow)

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
