#!/usr/bin/env python3
"""レベル報酬の装備を、ポーズごとの重ね絵として書き出す。

    python3 scripts/build-frenchie-gear.py [--preview]

出力は public/characters/frenchie/gear/<装備>/<ポーズ>.webp。犬の1枚絵とぴったり同じ
300×254 で、装備以外は透明。アプリ側は同じ位置に重ねるだけでよく、位置合わせの数値を
持たなくて済む。

--preview を付けると確認用の一覧を .preview/ に出す（リポジトリには入れない）。

必要なもの: pillow, numpy, scipy
"""

from __future__ import annotations

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from PIL import Image

from frenchie_gear.items import BUILDERS
from frenchie_gear.masks import POSES, load, slot_masks

OUT = pathlib.Path("public/characters/frenchie/gear")


def build(preview: bool) -> None:
    masks = {pose: slot_masks(pose) for pose in POSES}
    for item, draw in BUILDERS.items():
        folder = OUT / item
        folder.mkdir(parents=True, exist_ok=True)
        for pose in POSES:
            layer = draw(pose, masks[pose])
            layer.save(folder / f"{pose}.webp", "WEBP", quality=88, method=6)
        print(f"{item}: {len(POSES)} poses")

    if preview:
        out = pathlib.Path(".preview")
        out.mkdir(exist_ok=True)
        for item in BUILDERS:
            sheet = Image.new("RGB", (300 * 5, 254 * 4), (252, 250, 244))
            for i, pose in enumerate(POSES):
                base = load(pose)
                shot = Image.new("RGBA", base.size, (252, 250, 244, 255))
                shot.alpha_composite(base)
                shot.alpha_composite(Image.open(OUT / item / f"{pose}.webp").convert("RGBA"))
                sheet.paste(shot.convert("RGB"), ((i % 5) * 300, (i // 5) * 254))
            sheet.save(out / f"{item}.png")
        print(f"preview -> {out}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    build(parser.parse_args().preview)
