#!/usr/bin/env python3
"""首輪3種だけを作り直す。帽子・バンダナ・リュックのフォルダには一切触れない。"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from frenchie_gear.items import BUILDERS
from frenchie_gear.masks import POSES, slot_masks

OUT = pathlib.Path("public/characters/frenchie/gear")
COLLARS = ["leaf-collar", "sunset-collar", "starry-collar"]

for item in COLLARS:
    folder = OUT / item
    for pose in POSES:
        layer = BUILDERS[item](pose, slot_masks(pose))
        layer.save(folder / f"{pose}.webp", "WEBP", quality=88, method=6)
    print(f"{item}: {len(POSES)} poses")
