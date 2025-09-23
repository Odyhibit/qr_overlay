#!/usr/bin/env python3
import argparse
from dataclasses import dataclass
from typing import Optional, Tuple, List

import numpy as np
from PIL import Image, ImageDraw

# ---------- Utilities ----------

def to_gray(img: Image.Image) -> np.ndarray:
    # Flatten alpha over white so transparent areas become light, not black
    if img.mode == "RGBA":
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img)
    else:
        img = img.convert("RGB")
    return np.asarray(img.convert("L"))


def otsu_threshold(gray: np.ndarray) -> int:
    # Classic Otsu on 0..255 grayscale
    hist, _ = np.histogram(gray, bins=256, range=(0, 256))
    total = gray.size
    sum_total = np.dot(np.arange(256), hist)
    sum_b = 0
    w_b = 0
    max_var = -1.0
    thresh = 128
    for t in range(256):
        w_b += hist[t]
        if w_b == 0:
            continue
        w_f = total - w_b
        if w_f == 0:
            break
        sum_b += t * hist[t]
        m_b = sum_b / w_b
        m_f = (sum_total - sum_b) / w_f
        var_between = w_b * w_f * (m_b - m_f) ** 2
        if var_between > max_var:
            max_var = var_between
            thresh = t
    return thresh

def luminance_rgb(rgb: Tuple[int,int,int]) -> float:
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def cell_bounds(Lw: int, Lh: int, total_modules: int, qz: int, row: int, col: int):
    """Pixel-aligned bounds for a module cell (content coords -> overlay px)."""
    f = 1.0 / total_modules
    Ctot = col + qz
    Rtot = row + qz
    x0 = int(round(Ctot * f * Lw))
    y0 = int(round(Rtot * f * Lh))
    x1 = int(round((Ctot + 1) * f * Lw)) - 1
    y1 = int(round((Rtot + 1) * f * Lh)) - 1
    return x0, y0, x1, y1


def clamp(v, lo, hi): return lo if v < lo else hi if v > hi else v

# ---------- QR detection ----------
@dataclass
class QRGeometry:
    n_modules: int
    qz_modules: int
    content_box: Tuple[int,int,int,int]  # (left, top, right, bottom)
    module_px: float
    thresh: int
    dark_is_lt: bool  # True: dark = gray < thresh; False: dark = gray > thresh


def geo_from_exact_dims(qr_img: Image.Image, n: int, qz: int) -> QRGeometry:
    W, H = qr_img.size
    if W != H:
        raise ValueError("QR image must be square when using --modules/--quiet override.")
    total = n + 2*qz
    module_px = W / total
    # content box in pixels, snapped to ints
    left  = int(round(qz * module_px))
    top   = int(round(qz * module_px))
    right = int(round((qz + n) * module_px)) - 1
    bottom= int(round((qz + n) * module_px)) - 1
    return QRGeometry(
        n_modules=n,
        qz_modules=qz,
        content_box=(left, top, right, bottom),
        module_px=module_px,
        thresh=128,       # sane default for pure B/W
        dark_is_lt=True,  # dark = gray < thresh
    )



def detect_qr_geometry(qr_img: Image.Image,
                       qr_threshold: Optional[int] = None) -> QRGeometry:
    W, H = qr_img.size
    gray = to_gray(qr_img)

    t = qr_threshold if qr_threshold is not None else otsu_threshold(gray)

    # Try both polarities: dark < t  and  dark > t
    bin_lt = gray < t
    bin_gt = gray > t

    # Choose the polarity that yields a sensible amount of "dark" area
    c_lt = int(bin_lt.sum())
    c_gt = int(bin_gt.sum())
    # Prefer the one with more dark pixels but still >0; fallback to the other.
    if c_lt == 0 and c_gt == 0:
        raise ValueError("No modules detected in QR image (all flat).")
    use_lt = c_lt >= c_gt and c_lt > 0
    bin_black = bin_lt if use_lt else bin_gt

    ys, xs = np.where(bin_black)
    if len(xs) == 0:
        # Final fallback: widen threshold slightly
        tweak = 10
        if use_lt:
            bin_black = gray < min(255, t + tweak)
        else:
            bin_black = gray > max(0, t - tweak)
        ys, xs = np.where(bin_black)
        if len(xs) == 0:
            raise ValueError("No dark modules detected in QR image.")

    left, right = int(xs.min()), int(xs.max())
    top, bottom = int(ys.min()), int(ys.max())
    content_w = right - left + 1
    content_h = bottom - top + 1

    # Estimate module size from black run-lengths on mid row
    mid_y = (top + bottom) // 2
    row = bin_black[mid_y, left:right+1]
    runs = []
    cur = row[0]; cnt = 1
    for v in row[1:]:
        if v == cur:
            cnt += 1
        else:
            if cur: runs.append(cnt)
            cur = v; cnt = 1
    if cur: runs.append(cnt)

    if not runs:
        raise ValueError("Unable to estimate module size from middle row.")

    runs_sorted = sorted(runs)
    lower = runs_sorted[:max(1, len(runs_sorted)//2)]
    module_px = float(np.median(lower))

    n_w = int(round(content_w / module_px))
    n_h = int(round(content_h / module_px))
    n = int(round((n_w + n_h) / 2)) if n_w != n_h else n_w
    if n <= 0:
        raise ValueError("Detected non-positive module count.")

    qz_px = min(left, top, W - 1 - right, H - 1 - bottom)
    qz_modules = int(round(qz_px / module_px))
    qz_modules = max(0, qz_modules)

    return QRGeometry(
        n_modules=n,
        qz_modules=qz_modules,
        content_box=(left, top, right, bottom),
        module_px=module_px,
        thresh=int(t),
        dark_is_lt=use_lt,
    )


def sample_qr_module_dark(qr_img: Image.Image, geo: QRGeometry,
                          _qr_threshold_unused: Optional[int],
                          row: int, col: int) -> bool:
    """Sample module center; decide dark using geo.thresh and geo.dark_is_lt."""
    left, top, right, bottom = geo.content_box
    n = geo.n_modules
    module_w = (right - left + 1) / n
    module_h = (bottom - top + 1) / n

    cx = int(round(left + (col + 0.5) * module_w))
    cy = int(round(top + (row + 0.5) * module_h))
    cx = clamp(cx, 0, qr_img.width - 1)
    cy = clamp(cy, 0, qr_img.height - 1)

    # Alpha-aware grayscale at sample point
    px = qr_img.getpixel((cx, cy))
    if isinstance(px, tuple):
        r, g, b = px[:3]
        gray = int(round(0.299*r + 0.587*g + 0.114*b))
    else:
        gray = int(px)

    return (gray < geo.thresh) if geo.dark_is_lt else (gray > geo.thresh)


# ---------- Finder skipping ----------

def in_finder(n: int, r: int, c: int) -> bool:
    """Return True if (r,c) inside any 7x7 finder square (content coords)."""
    # top-left
    if (0 <= r <= 6) and (0 <= c <= 6):
        return True
    # top-right
    if (0 <= r <= 6) and (n-7 <= c <= n-1):
        return True
    # bottom-left
    if (n-7 <= r <= n-1) and (0 <= c <= 6):
        return True
    return False

# ---------- Overlay drawing ----------

def pick_logo_color(logo_img: Image.Image,
                    logo_w: int, logo_h: int,
                    total_modules: int, qz: int,
                    row: int, col: int,
                    want_dark: bool,
                    thr: int,
                    radius: int) -> Optional[Tuple[int,int,int,int]]:
    """
    Sample center pixel from logo at (row,col). If it doesn't match dark/light,
    search neighbors in radius (closest first). Transparent treated as light.
    Return RGBA or None if nothing suitable found.
    """
    def center_xy(r, c):
        f = 1.0 / total_modules
        cx = int(round((c + 0.5) * f * logo_w))
        cy = int(round((r + 0.5) * f * logo_h))
        return clamp(cx, 0, logo_w - 1), clamp(cy, 0, logo_h - 1)

    def is_dark_rgba(px):
        r, g, b, a = px
        if a < 10:
            return False  # transparent = light
        return luminance_rgb((r, g, b)) < thr

    # content coords -> total-grid coords
    R = row + qz
    C = col + qz
    cx, cy = center_xy(R, C)
    px = logo_img.getpixel((cx, cy))
    dark = is_dark_rgba(px)
    ok = (dark == want_dark)
    if ok:
        return px

    # neighbor search in expanding radius (module units), closest first
    # Build list of (dr, dc) sorted by distance
    offsets: List[Tuple[int,int,float]] = []
    for dr in range(-radius, radius+1):
        for dc in range(-radius, radius+1):
            if dr == 0 and dc == 0:
                continue
            d2 = dr*dr + dc*dc
            offsets.append((dr, dc, d2))
    offsets.sort(key=lambda t: t[2])

    # Bounds in total-grid coords (include quiet)
    total = total_modules
    for dr, dc, _ in offsets:
        nr, nc = R + dr, C + dc
        if not (0 <= nr < total and 0 <= nc < total):
            continue
        nx, ny = center_xy(nr, nc)
        npix = logo_img.getpixel((nx, ny))
        if (luminance_rgb(npix[:3]) < thr) == want_dark and (npix[3] >= 10):
            return npix

    return None

def adjust_color_toward(rgb: Tuple[int,int,int], toward_dark: bool, strength: float = 0.35) -> Tuple[int,int,int]:
    """Lighten/darken RGB toward black/white by strength (0..1)."""
    r, g, b = rgb
    if toward_dark:
        r = int(round(r * (1 - strength)))
        g = int(round(g * (1 - strength)))
        b = int(round(b * (1 - strength)))
    else:
        r = int(round(r + (255 - r) * strength))
        g = int(round(g + (255 - g) * strength))
        b = int(round(b + (255 - b) * strength))
    return (clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255))

def build_overlay(qr_img_path: str,
                  logo_img_path: str,
                  out_path: str,
                  modules_override: Optional[int],
                  quiet_override: Optional[int],
                  square_frac: float,
                  radius: int,
                  threshold_logo: int,
                  threshold_qr: Optional[int],
                  skip_finders: bool,
                  alpha: int):
    # Load images
    qr_img = Image.open(qr_img_path).convert("RGBA")
    logo = Image.open(logo_img_path).convert("RGBA")
    Lw, Lh = logo.size

    # Detect geometry
    if modules_override is not None and quiet_override is not None:
        geo = geo_from_exact_dims(qr_img, modules_override, quiet_override)
    else:
        geo = detect_qr_geometry(qr_img, qr_threshold=threshold_qr)

    n = geo.n_modules
    qz = geo.qz_modules

    # Total modules including quiet
    total_modules = n + 2*qz

    # Prepare overlay
    overlay = Image.new("RGBA", (Lw, Lh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Compute module size on overlay (may be rectangular if logo not square)
    cell_w = Lw / total_modules
    cell_h = Lh / total_modules
    side = int(max(1, round(min(cell_w, cell_h) * square_frac)))  # crisp integer

    for row in range(n):
        for col in range(n):
            # Decide desired darkness from the QR (not from the logo)
            want_dark = sample_qr_module_dark(qr_img, geo, threshold_qr, row, col)

            # Choose a color from the logo (same cell or nearest within radius)
            pix = pick_logo_color(
                logo_img=logo,
                logo_w=Lw, logo_h=Lh,
                total_modules=total_modules, qz=qz,
                row=row, col=col,
                want_dark=want_dark,
                thr=threshold_logo,
                radius=radius
            )

            if pix is None:
                # Fallback: synthesize by nudging local center toward dark/light
                R = row + qz;
                C = col + qz
                f = 1.0 / total_modules
                cx = int(round((C + 0.5) * f * Lw))
                cy = int(round((R + 0.5) * f * Lh))
                cx = clamp(cx, 0, Lw - 1);
                cy = clamp(cy, 0, Lh - 1)
                base = logo.getpixel((cx, cy))
                if base[3] < 10:
                    # try to find any nearby opaque pixel
                    found = None
                    for dy in range(-3, 4):
                        for dx in range(-3, 4):
                            p = logo.getpixel((clamp(cx + dx, 0, Lw - 1), clamp(cy + dy, 0, Lh - 1)))
                            if p[3] >= 10:
                                found = p;
                                break
                        if found: break
                    base = found if found else (0, 0, 0, 255)
                rgb = adjust_color_toward(base[:3], toward_dark=want_dark, strength=0.40)
                pix = (rgb[0], rgb[1], rgb[2], alpha)
            else:
                pix = (pix[0], pix[1], pix[2], alpha)

            # Finder modules: draw FULL-SIZE; others: draw mini-square
            if in_finder(n, row, col):
                x0, y0, x1, y1 = cell_bounds(Lw, Lh, total_modules, qz, row, col)
                draw.rectangle([x0, y0, x1, y1], fill=pix)  # crisp, full cell
            else:
                # centered mini-square (square_frac of the module side)
                f = 1.0 / total_modules
                Ctot = col + qz
                Rtot = row + qz
                cx = int(round((Ctot + 0.5) * f * Lw))
                cy = int(round((Rtot + 0.5) * f * Lh))
                side = int(max(1, round(min(Lw / total_modules, Lh / total_modules) * square_frac)))
                half = side // 2
                x0 = clamp(cx - half, 0, Lw - 1)
                y0 = clamp(cy - half, 0, Lh - 1)
                x1 = clamp(x0 + side - 1, 0, Lw - 1)
                y1 = clamp(y0 + side - 1, 0, Lh - 1)
                draw.rectangle([x0, y0, x1, y1], fill=pix)

    overlay.save(out_path, compress_level=6)
    print(f"Saved overlay: {out_path}")
    print(f"Detected: n={geo.n_modules} modules, qz={geo.qz_modules} quiet")
    if modules_override:
        print(f"Using override n={n}")
    if quiet_override is not None:
        print(f"Using override qz={qz}")

# ---------- CLI ----------

def main():
    ap = argparse.ArgumentParser(description="Generate a logo-colored mini-square QR overlay (transparent background).")
    ap.add_argument("--qr", required=True, help="Path to QR code image (upright, generated).")
    ap.add_argument("--logo", required=True, help="Path to logo image.")
    ap.add_argument("--out", default="qr_overlay.png", help="Output PNG path (transparent).")
    ap.add_argument("--modules", type=int, default=None, help="Override module count (content only).")
    ap.add_argument("--quiet", type=int, default=None, help="Override quiet-zone size (modules, per side). Default: auto-detect.")
    ap.add_argument("--square_frac", type=float, default=0.25, help="Mini-square size as fraction of module side (0.1..0.9).")
    ap.add_argument("--radius", type=int, default=2, help="Search radius (modules) for color fallback (nearest center wins).")
    ap.add_argument("--threshold_logo", type=int, default=145, help="Luminance threshold for logo dark/light (0..255).")
    ap.add_argument("--threshold_qr", type=int, default=None, help="Optional fixed QR threshold; default uses Otsu.")
    ap.add_argument("--alpha", type=int, default=255, help="Alpha for overlay squares (0..255).")
    ap.add_argument("--no_skip_finders", action="store_true", help="If set, DO NOT skip finder patterns.")
    args = ap.parse_args()

    if not (0.05 <= args.square_frac <= 0.95):
        raise SystemExit("--square_frac should be between 0.05 and 0.95")

    build_overlay(
        qr_img_path=args.qr,
        logo_img_path=args.logo,
        out_path=args.out,
        modules_override=args.modules,
        quiet_override=args.quiet,
        square_frac=args.square_frac,
        radius=args.radius,
        threshold_logo=args.threshold_logo,
        threshold_qr=args.threshold_qr,
        skip_finders=not args.no_skip_finders,
        alpha=args.alpha
    )

if __name__ == "__main__":
    main()
