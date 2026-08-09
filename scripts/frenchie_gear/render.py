"""報酬の装備を、犬の絵に重ねる1枚のレイヤーとして描く。

要は「元の装備を塗り替える」。ゼロから帽子やリュックを描き起こすと、水彩の元絵の上に
のっぺりした図形が乗って一瞬で貼り付け感が出る。そこで元の装備の陰影と線画をそのまま
使い、色だけ差し替える。型紙が元の装備と同一なので、下の緑がはみ出すこともない。

足りない形（王冠のとがり、首輪、リボン）だけを上から描き足す。描き足しは 4 倍の
キャンバスで描いてから縮めて、線のギザギザを消している。
"""

from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

from .masks import load, slot_masks

SS = 4  # 描き足し用の拡大率


def _luma(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def tint(pose: str, mask: np.ndarray, color: tuple[int, int, int], *, lift: float = 1.0) -> Image.Image:
    """型紙の範囲の元絵を、明るさを保ったまま指定色に置き換える。

    元絵の明るさをそのまま倍率に使うと、明るい装備は白飛びし暗い装備は潰れる。
    装備の中の明るいほうから 15% 目を基準にして、そこが指定色ちょうどになるよう
    正規化している。線画（暗い画素）は倍率が小さいまま残るので輪郭が保たれる。
    """
    src = np.asarray(load(pose)).astype(float)
    grow = ndimage.binary_dilation(mask, np.ones((3, 3)))
    gray = _luma(src[..., :3])
    ref = np.percentile(gray[mask], 85) if mask.any() else 255.0
    ratio = np.clip(gray / max(ref, 1.0), 0, 1.35)[..., None] * lift
    out = np.clip(np.array(color, dtype=float)[None, None, :] * ratio, 0, 255)

    rgba = np.zeros((*mask.shape, 4), dtype=np.uint8)
    rgba[..., :3] = out.astype(np.uint8)
    # 型紙の外側 1px は半透明にして、元の装備の縁が緑のまま残るのを防ぐ
    alpha = np.where(mask, 255, np.where(grow, 190, 0))
    rgba[..., 3] = np.where(src[..., 3] > 8, alpha, 0)
    return Image.fromarray(rgba, "RGBA")


def _canvas(size: tuple[int, int]) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    big = Image.new("RGBA", (size[0] * SS, size[1] * SS), (0, 0, 0, 0))
    return big, ImageDraw.Draw(big)


def _shrink(big: Image.Image, size: tuple[int, int]) -> Image.Image:
    return big.resize(size, Image.LANCZOS)


def stamp(layer: Image.Image, drawn: Image.Image, mask: np.ndarray | None = None) -> Image.Image:
    """描き足しをレイヤーに重ねる。mask を渡すとその型紙の中だけに収める。"""
    if mask is not None:
        a = np.asarray(drawn).copy()
        a[..., 3] = np.where(mask, a[..., 3], 0)
        drawn = Image.fromarray(a, "RGBA")
    out = layer.copy()
    out.alpha_composite(drawn)
    return out


def bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def top_edge(mask: np.ndarray) -> dict[int, int]:
    """列ごとの上端。帽子のふちや首元をなぞるのに使う。"""
    edge: dict[int, int] = {}
    ys, xs = np.nonzero(mask)
    for x in np.unique(xs):
        edge[int(x)] = int(ys[xs == x].min())
    return edge


def smooth_edge(edge: dict[int, int], window: int = 9) -> dict[int, int]:
    xs = sorted(edge)
    vals = [edge[x] for x in xs]
    out = {}
    half = window // 2
    for i, x in enumerate(xs):
        lo, hi = max(0, i - half), min(len(vals), i + half + 1)
        out[x] = int(round(sum(vals[lo:hi]) / (hi - lo)))
    return out


def pattern_dots(
    size: tuple[int, int],
    mask: np.ndarray,
    color: tuple[int, int, int, int],
    *,
    shape: str,
    spacing: int,
    radius: float,
    phase: int = 0,
) -> Image.Image:
    """型紙の中に小さな模様を散らす。花・雲・星のどれか。"""
    big, d = _canvas(size)
    x0, y0, x1, y1 = bbox(mask)
    row = 0
    y = y0 + spacing // 2
    while y <= y1:
        offset = (spacing // 2) if row % 2 else 0
        x = x0 + offset + phase % spacing
        while x <= x1:
            cx, cy = x * SS, y * SS
            r = radius * SS
            if shape == "flower":
                for k in range(5):
                    a = math.radians(k * 72 + 18)
                    px, py = cx + math.cos(a) * r * 0.72, cy + math.sin(a) * r * 0.72
                    d.ellipse([px - r * 0.55, py - r * 0.55, px + r * 0.55, py + r * 0.55], fill=color)
                d.ellipse([cx - r * 0.34, cy - r * 0.34, cx + r * 0.34, cy + r * 0.34], fill=(250, 214, 120, color[3]))
            elif shape == "cloud":
                for dx, dy, rr in ((-0.7, 0.15, 0.62), (0.0, -0.2, 0.82), (0.72, 0.15, 0.58)):
                    px, py = cx + dx * r, cy + dy * r
                    d.ellipse([px - rr * r, py - rr * r, px + rr * r, py + rr * r], fill=color)
                d.rectangle([cx - r * 0.75, cy + r * 0.05, cx + r * 0.75, cy + r * 0.5], fill=color)
            elif shape == "star":
                pts = []
                for k in range(10):
                    a = math.radians(k * 36 - 90)
                    rr = r if k % 2 == 0 else r * 0.42
                    pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
                d.polygon(pts, fill=color)
            elif shape == "speck":
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
            x += spacing
        y += spacing
        row += 1
    return _shrink(big, size)


class Axis:
    """型紙の向き。頭が傾いているポーズでも、帽子の帯を水平に巻くために使う。

    t は「てっぺんから縁まで」を 0→1 にした座標、s は「左端から右端まで」を 0→1 に
    した座標。列ごとの上端をなぞる方法だと、つばのように横へ張り出した部分で帯が
    型紙の外へ落ちてしまう。主軸で測れば形からはみ出さない。
    """

    def __init__(self, mask: np.ndarray):
        ys, xs = np.nonzero(mask)
        self.mask = mask
        self.center = np.array([xs.mean(), ys.mean()])
        pts = np.stack([xs - self.center[0], ys - self.center[1]], axis=1)
        _, _, vt = np.linalg.svd(pts, full_matrices=False)
        self.u = vt[0] / np.linalg.norm(vt[0])  # 長いほう＝つばの向き
        self.v = np.array([-self.u[1], self.u[0]])
        top = np.array([xs[np.argmin(ys)], ys[np.argmin(ys)]])
        if np.dot(top - self.center, self.v) > 0:
            self.v = -self.v  # v はいつも「てっぺん→縁」を向く
        self.tv = pts @ self.v
        self.su = pts @ self.u
        self.t0, self.t1 = float(self.tv.min()), float(self.tv.max())
        self.s0, self.s1 = float(self.su.min()), float(self.su.max())

    def point(self, s: float, t: float) -> tuple[float, float]:
        p = self.center + self.u * (self.s0 + (self.s1 - self.s0) * s) + self.v * (
            self.t0 + (self.t1 - self.t0) * t
        )
        return float(p[0]), float(p[1])

    def span(self, t: float) -> float:
        return (self.t1 - self.t0) * t

    def band(self, t0: float, t1: float) -> np.ndarray:
        lo = self.t0 + (self.t1 - self.t0) * t0
        hi = self.t0 + (self.t1 - self.t0) * t1
        out = np.zeros_like(self.mask)
        ys, xs = np.nonzero(self.mask)
        keep = (self.tv >= lo) & (self.tv <= hi)
        out[ys[keep], xs[keep]] = True
        return out


def paint(size: tuple[int, int], area: np.ndarray, color: tuple[int, int, int, int]) -> Image.Image:
    rgba = np.zeros((*area.shape, 4), dtype=np.uint8)
    rgba[area] = color
    img = Image.fromarray(rgba, "RGBA")
    # 型紙をそのまま塗ると段差が目立つので、境目だけ少しぼかす
    return img.filter(ImageFilter.GaussianBlur(0.6))


def band(
    size: tuple[int, int],
    edge: dict[int, int],
    color: tuple[int, int, int, int],
    *,
    offset: float,
    thickness: float,
    trim: int = 0,
) -> Image.Image:
    """上端のなぞり線に沿って帯を描く。帽子のリボンや首輪に使う。"""
    big, d = _canvas(size)
    xs = sorted(edge)
    if trim:
        xs = xs[trim:-trim] if len(xs) > trim * 2 else xs
    if len(xs) < 2:
        return _shrink(big, size)
    top = [(x * SS, (edge[x] + offset) * SS) for x in xs]
    bottom = [(x * SS, (edge[x] + offset + thickness) * SS) for x in reversed(xs)]
    d.polygon(top + bottom, fill=color)
    return _shrink(big, size)
