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
from .masks import CANVAS, load

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

# 飾りの色（本体, ハイライトの弧）。バンダナ（淡い緑や水色）の上でも沈まない明るさに
# 寄せてある。形はどれも同じ丸いビーズで、色だけ首輪ごとに変える
CHARM_FILL = {
    "leaf": ((172, 208, 122, 255), (118, 162, 90, 255)),
    "sun": ((244, 196, 122, 255), (222, 132, 88, 255)),
    "star": ((150, 176, 224, 255), (94, 122, 176, 255)),
}


def _feather(keep: list[int]) -> np.ndarray:
    """帯の左右の端をなめらかに透明へ落とす重み（x座標ぶん、0〜1）。

    端をまっすぐ切ると、頬や首の後ろでぶつ切りになって貼り付けて見える。
    先端3割ほどをイーズで消し、実際の首輪が肉に沈んで見えなくなる感じに近づける。
    """
    weight = np.zeros(CANVAS[0])
    n = len(keep)
    fade = max(2, int(n * 0.32))
    for i, x in enumerate(keep):
        if i < fade:
            t = i / fade
        elif i >= n - fade:
            t = (n - 1 - i) / fade
        else:
            t = 1.0
        t = max(0.0, min(1.0, t))
        weight[x] = t * t * (3 - 2 * t)
    return weight


def _fade_ends(layer: Layer, keep: list[int]) -> Layer:
    weight = _feather(keep)
    arr = np.asarray(layer).astype(float)
    arr[..., 3] *= weight[np.newaxis, :]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def _clip_to_dog(layer: Layer, pose: str) -> Layer:
    """犬の輪郭の外にはみ出した分を消す。首輪は犬の絵の中だけに収まる。"""
    dog_alpha = np.asarray(load(pose))[..., 3] > 10
    arr = np.asarray(layer).astype(float)
    arr[..., 3] *= dog_alpha
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def _collar(pose: str, m: Masks, body: tuple[int, int, int], charm: str) -> Layer:
    """バンダナの結び目の少し上、あごとの間の細い隙間に首輪を通す。

    バンダナの上端そのものを帯の下端にすると、首輪の下側がバンダナに食い込んで
    「胸に貼り付けた」ように見える。なので帯は上端より確実に上（gap ぶん）だけに描き、
    バンダナの生地には一切かからないようにする。あご下の余白は数px しかないので、
    帯は薄く、範囲は首の正面だけに絞り、両端は頬の後ろへ溶けるようフェードする。
    """
    neck = m["neck"]
    if not neck.any():
        return _empty()
    edge = R.smooth_edge(R.top_edge(neck), 13)
    xs = sorted(edge)
    if len(xs) < 12:
        return _empty()
    # 首の正面だけを使う。肩や頬まで帯を伸ばすと「巻いた」より「貼った」に見える
    keep = xs[int(len(xs) * 0.24) : int(len(xs) * 0.80)]
    if len(keep) < 6:
        keep = xs
    edge = {x: edge[x] for x in keep}
    width = keep[-1] - keep[0]
    thickness = min(5.4, max(3.0, width * 0.05))
    gap = max(1.3, thickness * 0.4)  # バンダナの生地から離す余白

    layer = _empty()
    # 縁を一段暗くしてから本体を重ねる。線画の犬の中で帯だけ平らだと浮く
    outline = R.band(
        CANVAS, edge, (60, 52, 44, 130), offset=-(gap + thickness * 1.18), thickness=thickness * 1.3
    )
    layer = R.stamp(layer, outline)
    strap = R.band(CANVAS, edge, (*body, 252), offset=-(gap + thickness), thickness=thickness)
    layer = R.stamp(layer, strap)
    gloss = R.band(
        CANVAS, edge, (255, 255, 255, 60), offset=-(gap + thickness * 0.86), thickness=thickness * 0.24
    )
    layer = R.stamp(layer, gloss)
    layer = _fade_ends(layer, keep)

    # 飾りは帯そのものにかかった小さなビーズ。帯より下へ垂らすと、また
    # バンダナへ近づいてしまうので、帯の真ん中に乗せるだけにする
    low = max(keep, key=lambda x: edge[x])
    big, d = R._canvas(CANVAS)
    cx = low * R.SS
    cy = (edge[low] - gap - thickness * 0.5) * R.SS
    r = thickness * 0.6 * R.SS
    edge_color = (74, 62, 48, 235)
    fill, glow = CHARM_FILL[charm]
    d.ellipse([cx - r * 1.28, cy - r * 1.28, cx + r * 1.28, cy + r * 1.28], fill=edge_color)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    d.arc(
        [cx - r * 0.62, cy - r * 0.5, cx + r * 0.62, cy + r * 0.74],
        190, 350, fill=glow, width=max(1, int(r * 0.3)),
    )
    layer = R.stamp(layer, R._shrink(big, CANVAS))
    return _clip_to_dog(layer, pose)


def leaf_collar(pose: str, m: Masks) -> Layer:
    # バンダナと同系色なので、帯はぐっと深い緑にして輪郭を立てる
    return _collar(pose, m, (66, 106, 62), "leaf")


def sunset_collar(pose: str, m: Masks) -> Layer:
    layer = _collar(pose, m, (226, 150, 106), "sun")
    return layer


def starry_collar(pose: str, m: Masks) -> Layer:
    # 若葉・夕焼けと同じ帯＋丸いビーズの形。色だけ夜空の紺にする
    return _collar(pose, m, (63, 78, 126), "star")


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
