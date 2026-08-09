"""報酬の装備ひとつひとつの見た目。

色は「レベルアップ報酬図鑑」の絵に合わせてある。どれも元の装備の陰影を残した塗り替え
なので、水彩の質感と線画はそのまま。形が足りないぶん（王冠のとがり、首輪の帯、模様）
だけを描き足す。
"""

from __future__ import annotations

import math
from typing import Callable

import numpy as np
from PIL import Image, ImageDraw

from . import render as R
from .masks import CANVAS

Layer = Image.Image
Masks = dict[str, np.ndarray]


def _empty() -> Layer:
    return Image.new("RGBA", CANVAS, (0, 0, 0, 0))


# ---------------------------------------------------------------- あたま

def straw_hat(pose: str, m: Masks) -> Layer:
    cap = m["cap"]
    if not cap.any():
        return _empty()
    layer = R.tint(pose, cap, (223, 191, 124), lift=1.03)
    ax = R.Axis(cap)
    # 麦わらの編み目。同心の細い帯を流して、のっぺりした塗りに見えないようにする
    for lo, hi in ((0.16, 0.20), (0.34, 0.38), (0.52, 0.56), (0.72, 0.76)):
        layer = R.stamp(layer, R.paint(CANVAS, ax.band(lo, hi), (190, 155, 96, 70)))
    layer = R.stamp(layer, R.paint(CANVAS, ax.band(0.60, 0.78), (130, 170, 100, 236)))
    layer = R.stamp(layer, R.paint(CANVAS, ax.band(0.60, 0.63), (108, 146, 84, 200)))
    # リボンの結び目。前寄りに小さく置くと、ただの帯が帽子の飾りに見える
    big, d = R._canvas(CANVAS)
    cx, cy = ax.point(0.24, 0.69)
    r = ax.span(0.16) * R.SS
    for dx in (-0.9, 0.9):
        d.ellipse(
            [(cx + dx * r / R.SS * 1.1) * R.SS - r * 0.8, cy * R.SS - r * 0.7,
             (cx + dx * r / R.SS * 1.1) * R.SS + r * 0.8, cy * R.SS + r * 0.7],
            fill=(146, 186, 112, 245),
        )
    return R.stamp(layer, R._shrink(big, CANVAS))


def captain_hat(pose: str, m: Masks) -> Layer:
    cap = m["cap"]
    if not cap.any():
        return _empty()
    layer = R.tint(pose, cap, (245, 244, 238), lift=1.02)
    ax = R.Axis(cap)
    layer = R.stamp(layer, R.paint(CANVAS, ax.band(0.66, 1.0), (52, 64, 94, 248)))
    layer = R.stamp(layer, R.paint(CANVAS, ax.band(0.58, 0.66), (206, 170, 92, 240)))
    # 帽章の錨。つばのすぐ上、正面寄りに
    big, d = R._canvas(CANVAS)
    cx, cy = ax.point(0.42, 0.40)
    cx, cy = cx * R.SS, cy * R.SS
    r = ax.span(0.22) * R.SS
    gold = (198, 158, 70, 255)
    w = max(1, int(r * 0.34))
    d.line([(cx, cy - r), (cx, cy + r)], fill=gold, width=w)
    d.line([(cx - r * 0.72, cy - r * 0.5), (cx + r * 0.72, cy - r * 0.5)], fill=gold, width=w)
    d.arc([cx - r * 0.9, cy - r * 0.35, cx + r * 0.9, cy + r * 1.15], 15, 165, fill=gold, width=w)
    return R.stamp(layer, R._shrink(big, CANVAS), cap)


def king_crown(pose: str, m: Masks) -> Layer:
    cap = m["cap"]
    if not cap.any():
        return _empty()
    # 帽子の丸みを赤いビロード、ふちを金の輪に見立てる
    layer = R.tint(pose, cap, (198, 74, 84), lift=1.06)
    ax = R.Axis(cap)
    layer = R.stamp(layer, R.paint(CANVAS, ax.band(0.52, 1.0), (216, 174, 78, 250)))
    layer = R.stamp(layer, R.paint(CANVAS, ax.band(0.52, 0.58), (238, 206, 128, 240)))

    big, d = R._canvas(CANVAS)
    gold, glow = (222, 180, 82, 255), (240, 214, 140, 255)
    # とがりは主軸に沿って生やすので、頭が傾いても王冠が横倒しにならない
    spikes = 5
    for i in range(spikes):
        s = 0.12 + 0.76 * (i / (spikes - 1))
        peak = 0.5 if i in (0, spikes - 1) else 0.72
        base_l = np.array(ax.point(s - 0.1, 0.34))
        base_r = np.array(ax.point(s + 0.1, 0.34))
        tip = np.array(ax.point(s, -peak))
        d.polygon([tuple(base_l * R.SS), tuple(tip * R.SS), tuple(base_r * R.SS)], fill=gold)
        jr = ax.span(0.1) * R.SS
        jx, jy = np.array(ax.point(s, -peak + 0.18)) * R.SS
        d.ellipse([jx - jr, jy - jr, jx + jr, jy + jr], fill=glow)
    # とがりの根元を金の輪でつないで、三角が浮かないようにする
    ring = []
    for i in range(13):
        ring.append(np.array(ax.point(i / 12, 0.30)) * R.SS)
    for i in range(12, -1, -1):
        ring.append(np.array(ax.point(i / 12, 0.52)) * R.SS)
    d.polygon([tuple(p) for p in ring], fill=gold)
    for i in range(4):
        jx, jy = np.array(ax.point(0.2 + 0.2 * i, 0.41)) * R.SS
        jr = ax.span(0.09) * R.SS
        d.ellipse([jx - jr, jy - jr, jx + jr, jy + jr], fill=(214, 92, 96, 255) if i % 2 == 0 else (118, 170, 208, 255))
    return R.stamp(layer, R._shrink(big, CANVAS))


# ---------------------------------------------------------------- バンダナ

def flower_bandana(pose: str, m: Masks) -> Layer:
    neck = m["neck"]
    if not neck.any():
        return _empty()
    layer = R.tint(pose, neck, (196, 218, 170), lift=1.02)
    dots = R.pattern_dots(CANVAS, neck, (253, 253, 250, 255), shape="flower", spacing=15, radius=3.1)
    return R.stamp(layer, dots, neck)


def sky_bandana(pose: str, m: Masks) -> Layer:
    neck = m["neck"]
    if not neck.any():
        return _empty()
    layer = R.tint(pose, neck, (168, 205, 232), lift=1.02)
    dots = R.pattern_dots(CANVAS, neck, (255, 255, 255, 215), shape="cloud", spacing=19, radius=3.4, phase=6)
    return R.stamp(layer, dots, neck)


# ---------------------------------------------------------------- くびわ

def _collar(pose: str, m: Masks, body: tuple[int, int, int], charm: str) -> Layer:
    """バンダナの襟もとをなぞって首輪を巻く。バンダナと一緒に着けても喧嘩しない。"""
    neck = m["neck"]
    if not neck.any():
        return _empty()
    edge = R.smooth_edge(R.top_edge(neck), 13)
    xs = sorted(edge)
    if len(xs) < 12:
        return _empty()
    # 端は肩へ回り込んでいるので落とす。首の正面だけに帯を残す
    keep = xs[int(len(xs) * 0.12) : int(len(xs) * 0.88)]
    edge = {x: edge[x] for x in keep}
    width = keep[-1] - keep[0]
    thickness = max(5.0, width * 0.13)

    layer = _empty()
    # 縁を一段暗くしてから本体を重ねる。線画の犬の中で帯だけ平らだと浮く
    outline = R.band(CANVAS, edge, (60, 52, 44, 120), offset=-thickness * 0.95, thickness=thickness * 1.35)
    layer = R.stamp(layer, outline)
    strap = R.band(CANVAS, edge, (*body, 252), offset=-thickness * 0.8, thickness=thickness)
    layer = R.stamp(layer, strap)
    gloss = R.band(CANVAS, edge, (255, 255, 255, 60), offset=-thickness * 0.72, thickness=thickness * 0.3)
    layer = R.stamp(layer, gloss)

    # 飾りは襟もとのいちばん下がったところに提げる
    low = max(keep, key=lambda x: edge[x])
    big, d = R._canvas(CANVAS)
    cx, cy = low * R.SS, (edge[low] + thickness * 0.1) * R.SS
    r = thickness * 0.62 * R.SS
    ring = (226, 218, 200, 255)
    d.ellipse([cx - r * 0.34, cy - r * 0.6, cx + r * 0.34, cy + r * 0.25], outline=ring, width=max(1, int(r * 0.2)))
    cy += r * 0.85
    if charm == "leaf":
        d.polygon(
            [(cx, cy - r), (cx + r * 0.72, cy), (cx, cy + r), (cx - r * 0.72, cy)],
            fill=(150, 190, 110, 255),
        )
        d.line([(cx, cy - r * 0.75), (cx, cy + r * 0.75)], fill=(112, 152, 84, 255), width=max(1, int(r * 0.16)))
    elif charm == "sun":
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(242, 192, 120, 255))
        d.arc([cx - r * 0.62, cy - r * 0.5, cx + r * 0.62, cy + r * 0.74], 190, 350, fill=(226, 140, 96, 255), width=max(1, int(r * 0.3)))
    else:  # star
        pts = []
        for k in range(10):
            a = math.radians(k * 36 - 90)
            rr = r if k % 2 == 0 else r * 0.44
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        d.polygon(pts, fill=(240, 208, 110, 255))
    return R.stamp(layer, R._shrink(big, CANVAS))


def leaf_collar(pose: str, m: Masks) -> Layer:
    return _collar(pose, m, (92, 142, 74), "leaf")


def sunset_collar(pose: str, m: Masks) -> Layer:
    layer = _collar(pose, m, (226, 150, 106), "sun")
    return layer


def starry_collar(pose: str, m: Masks) -> Layer:
    layer = _collar(pose, m, (63, 78, 126), "star")
    neck = m["neck"]
    if not neck.any():
        return layer
    # 帯の上にだけ星を散らす。帯の外にこぼれないよう、描いた帯を型紙にする
    strap = np.asarray(layer)[..., 3] > 120
    stars = R.pattern_dots(CANVAS, strap, (244, 214, 122, 255), shape="star", spacing=9, radius=1.5)
    return R.stamp(layer, stars, strap)


# ---------------------------------------------------------------- リュック

def outing_pack(pose: str, m: Masks) -> Layer:
    pack = m["pack"]
    if not pack.any():
        return _empty()
    layer = R.tint(pose, pack, (150, 190, 118), lift=1.05)
    dots = R.pattern_dots(CANVAS, pack, (238, 246, 224, 120), shape="speck", spacing=15, radius=1.4)
    return R.stamp(layer, dots, pack)


def explorer_pack(pose: str, m: Masks) -> Layer:
    pack = m["pack"]
    if not pack.any():
        return _empty()
    layer = R.tint(pose, pack, (198, 172, 124), lift=1.03)
    x0, y0, x1, y1 = R.bbox(pack)
    big, d = R._canvas(CANVAS)
    # 方位磁針。荷物のいちばん厚いあたりに小さく留める
    cx, cy = (x0 + x1) / 2 * R.SS, (y0 * 0.62 + y1 * 0.38) * R.SS
    r = min(x1 - x0, y1 - y0) * 0.13 * R.SS
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(232, 226, 208, 255), outline=(146, 118, 78, 255), width=max(1, int(r * 0.2)))
    d.line([(cx, cy + r * 0.55), (cx, cy - r * 0.55)], fill=(196, 96, 84, 255), width=max(1, int(r * 0.22)))
    layer = R.stamp(layer, R._shrink(big, CANVAS), pack)
    return layer


BUILDERS: dict[str, Callable[[str, Masks], Layer]] = {
    "leaf-collar": leaf_collar,
    "flower-bandana": flower_bandana,
    "outing-pack": outing_pack,
    "sunset-collar": sunset_collar,
    "sky-bandana": sky_bandana,
    "straw-hat": straw_hat,
    "starry-collar": starry_collar,
    "explorer-pack": explorer_pack,
    "captain-hat": captain_hat,
    "king-crown": king_crown,
}
