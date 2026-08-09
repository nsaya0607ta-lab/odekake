"""犬の絵に描き込まれている装備（帽子・バンダナ・リュック）を切り出す。

素材はポーズごとの1枚絵で、装備は最初から絵の中に描かれている。あとから別の装備を
重ねるとき、下の装備が食み出すと途端に嘘くさくなるので「元の装備と同じ形」を土台に
する。そのための型紙をここで作る。

装備はどれも黄緑〜カーキで、体（生成り）や舌（桃）とは色相で分かれる。まずは色で
装備をまとめて拾い、そのあと帽子／首まわり／背中の3つに切り分ける。切り分けは
ポーズごとに置いた種点からの測地距離（マスクの中だけを通る距離）で決めている。
直線で切ると、丸まった姿勢でバンダナとリュックが重なるポーズを割れない。
"""

from __future__ import annotations

import numpy as np
from PIL import Image
from scipy import ndimage

CANVAS = (300, 254)

# 装備ではない小物（カメラなど）を色で拾ってしまう場所。(x0, y0, x1, y1)
EXCLUDE: dict[str, tuple[int, int, int, int]] = {
    # 首から提げたカメラ。革色が装備のカーキと近く、バンダナとして拾われる
    "camera": (95, 168, 175, 246),
}

# 種点（x, y）。None はそのポーズに写っていない装備。複数置いてもよい。
# 値は素材を実寸で見て、装備の真ん中あたりに置いてある。
Seed = tuple[int, int] | list[tuple[int, int]] | None

SEEDS: dict[str, dict[str, Seed]] = {
    "stand": {"cap": (132, 53), "neck": (112, 172), "pack": (207, 150)},
    "walk": {"cap": (108, 59), "neck": (100, 172), "pack": (190, 150)},
    "sit": {"cap": (128, 59), "neck": (114, 170), "pack": (200, 167)},
    "sniff": {"cap": (76, 149), "neck": (118, 190), "pack": (185, 140)},
    "stand-happy": {"cap": (106, 70), "neck": (95, 180), "pack": (185, 150)},
    "shake": {"cap": (133, 66), "neck": (110, 180), "pack": (205, 155)},
    "sleep": {"cap": (133, 138), "neck": (175, 185), "pack": (215, 175)},
    "wink": {"cap": (117, 62), "neck": (110, 178), "pack": (205, 150)},
    "wave": {"cap": (161, 52), "neck": (140, 175), "pack": (215, 160)},
    "camera": {"cap": (120, 51), "neck": (135, 150), "pack": (215, 143)},
    "bow": {"cap": (112, 139), "neck": (118, 168), "pack": (200, 150)},
    "cheer": {"cap": (156, 53), "neck": (120, 166), "pack": (201, 175)},
    "smile": {"cap": (120, 46), "neck": (110, 165), "pack": (205, 150)},
    "dig": {"cap": (73, 124), "neck": (128, 155), "pack": (190, 130)},
    "treat": {"cap": (180, 57), "neck": (175, 185), "pack": (90, 150)},
    "roll": {"cap": (108, 225), "neck": None, "pack": (205, 175)},
    "drink": {"cap": (114, 73), "neck": (155, 170), "pack": (215, 155)},
    "doze": {"cap": (179, 120), "neck": None, "pack": [(83, 150), (245, 185)]},
    "yawn": {"cap": (130, 91), "neck": (110, 195), "pack": (196, 177)},
    "lie-wave": {"cap": (160, 104), "neck": (128, 196), "pack": (224, 182)},
}

POSES = tuple(SEEDS)
SLOTS = ("cap", "neck", "pack")


def load(pose: str) -> Image.Image:
    return Image.open(f"public/characters/frenchie/{pose}.webp").convert("RGBA")


def _hsl(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    a = rgba.astype(float) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1)
    d = mx - mn + 1e-9
    lightness = (mx + mn) / 2
    sat = (mx - mn) / np.where(lightness < 0.5, mx + mn + 1e-9, 2 - mx - mn + 1e-9)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return hue, sat, lightness


def gear_mask(im: Image.Image, exclude: tuple[int, int, int, int] | None = None) -> np.ndarray:
    """装備ぜんぶ（帽子・バンダナ・リュック）を色で拾う。"""
    a = np.asarray(im)
    hue, sat, lightness = _hsl(a)
    alpha = a[..., 3] / 255
    m = (alpha > 0.6) & (sat > 0.20) & (hue > 45) & (hue < 125) & (lightness > 0.28) & (lightness < 0.92)
    # 線画やハイライトで開いた穴を塞いでから、飛び散った粒を落とす
    m = ndimage.binary_closing(m, np.ones((5, 5)))
    m = ndimage.binary_fill_holes(m)
    m = ndimage.binary_opening(m, np.ones((3, 3)))
    lab, count = ndimage.label(m, np.ones((3, 3)))
    if count:
        sizes = ndimage.sum(m, lab, range(1, count + 1))
        m = np.isin(lab, [i + 1 for i, size in enumerate(sizes) if size >= 250])
    if exclude:
        x0, y0, x1, y1 = exclude
        m[y0:y1, x0:x1] = False
    return m


def _points(seed: Seed) -> list[tuple[int, int]]:
    if seed is None:
        return []
    return list(seed) if isinstance(seed, list) else [seed]


def _geodesic(mask: np.ndarray, seed: Seed) -> np.ndarray:
    """マスクの中だけを通って種点から広がる距離。届かないところは inf。"""
    dist = np.full(mask.shape, np.inf)
    ys_all, xs_all = np.nonzero(mask)
    if len(xs_all) == 0:
        return dist
    for x, y in _points(seed):
        if not mask[y, x]:
            # 種点がわずかに外れていても拾えるよう、近くのマスク上へ寄せる
            i = int(np.argmin((xs_all - x) ** 2 + (ys_all - y) ** 2))
            x, y = int(xs_all[i]), int(ys_all[i])
        dist[y, x] = 0
    # 8近傍の波を繰り返し広げる。300×254 なので素朴な反復で足りる
    step = np.array([[1.41, 1, 1.41], [1, 0, 1], [1.41, 1, 1.41]])
    for _ in range(600):
        prev = dist
        pad = np.pad(dist, 1, constant_values=np.inf)
        cand = dist.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                shifted = pad[1 + dy : 1 + dy + mask.shape[0], 1 + dx : 1 + dx + mask.shape[1]]
                cand = np.minimum(cand, shifted + step[dy + 1, dx + 1])
        dist = np.where(mask, cand, np.inf)
        if np.array_equal(np.isinf(dist), np.isinf(prev)) and np.allclose(
            np.where(np.isinf(dist), 0, dist), np.where(np.isinf(prev), 0, prev)
        ):
            break
    return dist


def slot_masks(pose: str) -> dict[str, np.ndarray]:
    """ポーズ1枚を帽子／首まわり／背中の型紙に切り分ける。"""
    im = load(pose)
    gear = gear_mask(im, EXCLUDE.get(pose))
    seeds = SEEDS[pose]
    dists = {}
    for slot in SLOTS:
        seed = seeds.get(slot)
        dists[slot] = _geodesic(gear, seed) if seed else np.full(gear.shape, np.inf)

    live = [s for s in SLOTS if seeds.get(s)]
    stacked = np.stack([dists[s] for s in SLOTS])
    winner = np.argmin(stacked, axis=0)
    reachable = np.isfinite(stacked).any(axis=0)
    out = {slot: gear & reachable & (winner == i) for i, slot in enumerate(SLOTS)}

    # マスクが途切れていて種点から歩いて行けない部分（背中に括りつけた寝袋など）は、
    # 見た目の近さで拾う。放っておくと元の色のまま取り残されて、着せ替えたときに
    # そこだけ緑が残る
    orphan = gear & ~reachable
    if orphan.any() and live:
        lab, count = ndimage.label(orphan, np.ones((3, 3)))
        for i in range(1, count + 1):
            ys, xs = np.nonzero(lab == i)
            # 絵の具の飛沫くらいの粒は装備ではない。塗り替えると足元に色の染みが残る
            if len(xs) < 200:
                continue
            cx, cy = xs.mean(), ys.mean()
            nearest = min(
                live,
                key=lambda s: min((px - cx) ** 2 + (py - cy) ** 2 for px, py in _points(seeds[s])),
            )
            out[nearest] |= lab == i
    return out
