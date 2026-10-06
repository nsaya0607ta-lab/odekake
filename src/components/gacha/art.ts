import type { GachaRarity } from "@/lib/gacha/config";

/**
 * ガチャ演出で使う絵（public/gacha/art/）と、その中の部品の位置。
 *
 * 絵は描いてもらった透明PNGから作りなおしたもの（作り方は docs/gacha-illustrated-animation.md）。
 * マシンは「本体」「ドームの中のカプセルの山」「上にかぶせるガラス」「ハンドル」「取り出し口のフタ」に分けてあり、
 * 位置はすべて本体の絵（835×1222）に対する％で決めている。
 */
const ART = "/gacha/art";

export const RARITIES = ["N", "R", "SR", "SSR", "UR", "LR", "MR"] as const satisfies readonly GachaRarity[];

export const MACHINE_ART = {
  body: `${ART}/machine-body.webp`,
  pile: `${ART}/machine-pile.webp`,
  glass: `${ART}/machine-glass.webp`,
  domeMask: `${ART}/machine-dome-mask.webp`,
  handle: `${ART}/machine-handle.webp`,
  door: `${ART}/machine-door.webp`,
  /** 部品をぜんぶ重ねた1枚絵（ガチャの入り口のカードなど、動かさない所で使う） */
  still: `${ART}/machine-still.webp`,
} as const;

export const BACKGROUND_ART = {
  shop: `${ART}/bg-shop.webp`,
  LR: `${ART}/bg-lr.webp`,
  MR: `${ART}/bg-mr.webp`,
} as const;

/** カプセルの絵。small は受け皿に並べる小さいもの */
export function capsuleSrc(rarity: GachaRarity, small = false): string {
  return `${ART}/capsule-${rarity}${small ? "-s" : ""}.webp`;
}

/**
 * カプセルの「ふた（透明な上半分）」と「器（色のついた下半分）」の合わせ目＝帯の上の線。
 * 絵の高さに対する％で、まん中（center）がいちばん低く、左右のはし（edge）に向かって上がる弧になっている。
 */
const CAPSULE_SEAM: Record<GachaRarity, { center: number; edge: number }> = {
  N: { center: 55.19, edge: 53.45 },
  R: { center: 58.25, edge: 51.41 },
  SR: { center: 54.88, edge: 53.21 },
  SSR: { center: 58.14, edge: 54.56 },
  UR: { center: 60.25, edge: 56.06 },
  LR: { center: 55.28, edge: 52.13 },
  MR: { center: 54.58, edge: 51.9 },
};

/** ふたと器を別々に動かすための切り抜き（clip-path）。合わせ目の弧にそって切る */
export function capsuleHalves(rarity: GachaRarity): { top: string; bottom: string } {
  const { center, edge } = CAPSULE_SEAM[rarity];
  const xs = [0, 8, 16, 25, 34, 42, 50, 58, 66, 75, 84, 92, 100];
  // 帯のふちの線は器のほうに残したいので、線の少し上で切る
  const cutAt = (x: number) => {
    const t = (x - 50) / 50;
    return center - (center - edge) * t * t - 0.5;
  };
  const curve = (shift: number) => xs.map((x) => `${x}% ${(cutAt(x) + shift).toFixed(2)}%`);
  return {
    top: `polygon(0% 0%, 100% 0%, ${curve(0).reverse().join(", ")})`,
    // 少しだけ重ねて、切れ目に細いすき間が見えないようにする
    bottom: `polygon(${curve(-0.4).join(", ")}, 100% 100%, 0% 100%)`,
  };
}

/** 本体の絵の中の部品の位置（本体の幅・高さに対する％） */
export const MACHINE_LAYOUT = {
  aspect: 835 / 1222,
  /** 取り出し口の、カプセルが出てくるところ */
  chute: { x: 83.35, y: 85.5 },
} as const;

/** 演出の前に読みこんでおく（読みこみ中に絵が欠けたまま動き出さないように） */
export function preloadImages(sources: readonly string[], timeoutMs = 2600): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const loads = sources.map(
    (src) =>
      new Promise<void>((resolve) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          void image.decode().catch(() => undefined).finally(() => resolve());
        };
        image.onerror = () => resolve();
        image.src = src;
      }),
  );
  return Promise.race([
    Promise.all(loads).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * ガチャボタンを押した時点で、マシンとお店の絵を読みこみはじめる（結果が届くまでの待ち時間を使う）。
 * 待たずにすぐ返る
 */
export function warmGachaArt(): void {
  void preloadImages(
    [
      BACKGROUND_ART.shop,
      MACHINE_ART.body,
      MACHINE_ART.pile,
      MACHINE_ART.glass,
      MACHINE_ART.domeMask,
      MACHINE_ART.handle,
      MACHINE_ART.door,
      ...RARITIES.map((rarity) => capsuleSrc(rarity, true)),
    ],
    15000,
  );
}
