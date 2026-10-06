"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BlueCoinArt, CoinArt } from "@/components/coin-art";
import { useHomeWeather } from "@/components/home-weather";
import { getFrenchieSrc, type DogSkinId } from "@/lib/dog-skins";
import { registerStepsWriter, type StepsWriteRequest } from "@/lib/home-dog-bus";
import { restWeightsOf } from "@/lib/home-weather";

/**
 * ホーム画面のバンドを歩き回るフレブル。
 *
 * 絵はイラストの差し替えで、移動は CSS に任せている。歩幅と進む速さを噛み合わせ
 * たいので、速度を固定して移動時間を距離から決める。向きの切り替えは立ち止まって
 * いる間にしか起こさないので、歩きながら裏返ることがない。
 *
 * 変形は要素ごとに分けてある（移動 / 反転 / 上下の揺れ）。ひとつの要素に重ねると
 * transition と animation が同じ transform を奪い合って壊れる。
 *
 * 奥行き：犬は芝の上を手前（大きい）から奥（小さい）まで歩く。奥ほど足もとが上がって小さくなり、
 * 画面の上では同じ歩幅でもゆっくり進んで見える（depthBottom / depthScale）。
 *
 * 用事：ふだんは気ままに歩き回るが、用事が入るとそれを先に片づける。
 * - 歩数の書き換え（steps-tag.tsx から home-dog-bus.ts 経由）：看板の前まで歩き、魔法のペンを出して書く
 * - 空から降ってきたコイン：走って拾いに行く（タップでも拾える）。1回 5 枚（/api/coins/home-drop）
 */

/**
 * Lv.1 からある基本動作。ここは変更・削除しない。
 * 歩行処理（stand と walk の入れ替え）もこの7つに乗っている。
 */
const POSES = {
  stand: "stand",
  walk: "walk",
  sit: "sit",
  sniff: "sniff",
  happy: "stand-happy",
  shake: "shake",
  sleep: "sleep",
} as const;

type Pose = keyof typeof POSES;
const POSE_KEYS = Object.keys(POSES) as Pose[];

/**
 * Lv.2〜30 のレベルアップ報酬モーション。
 *
 * 1件につき「土台にする1枚絵」と「CSS の translate / rotate / scale だけの
 * キーフレーム」の組み合わせで作る。コマ送りも Canvas も小道具との absolute 配置も
 * 使わない。動きの中身は下の @keyframes fm-<id> が持っていて、ここは土台の絵と
 * 再生時間だけを決める。
 *
 * `art` はスキンに関わらず共通のファイル名（拡張子なし）。実際の URL は
 * 選択中スキンによって `/characters/<skin>/<art>.webp` に展開される
 * （getFrenchieSrc）。犬の顔・毛色・体型・絵柄はスキンごとに固定なので、
 * モーションのために描き足したり差し替えたりはしない。土台が同じで動きだけ
 * 違う組み合わせがあるのは意図どおり（同じ URL なので画像は1回しか読まれない）。
 *
 * Lv.1 の stand / walk / sit / sniff / happy / shake / sleep とは重複させない。
 */
type Motion = {
  /** ポーズキー兼 CSS クラス名の一部。POSES のキーとは重ならないようにする */
  id: string;
  level: number;
  /** 土台にする1枚絵（拡張子なしのファイル名） */
  art: string;
  /** 動きの長さ（ms） */
  ms: number;
  /** 動きの緩急。省略時は ease-in-out */
  ease?: string;
};

const MOTIONS: readonly Motion[] = [
  { id: "tilt", level: 2, art: "wonder", ms: 1400 },
  { id: "paw", level: 3, art: "sit-side", ms: 1300 },
  { id: "highfive", level: 4, art: "wave", ms: 1100, ease: "cubic-bezier(0.34, 1.4, 0.5, 1)" },
  { id: "wink", level: 5, art: "wink", ms: 1000, ease: "cubic-bezier(0.34, 1.2, 0.5, 1)" },
  { id: "grin", level: 6, art: "smile", ms: 1300 },
  { id: "surprise", level: 7, art: "bark", ms: 1000, ease: "cubic-bezier(0.3, 1.5, 0.6, 1)" },
  { id: "peekaboo", level: 8, art: "cheer", ms: 1500, ease: "cubic-bezier(0.34, 1.3, 0.5, 1)" },
  { id: "spin", level: 9, art: "trot", ms: 1100 },
  { id: "standup", level: 10, art: "cheer", ms: 1400, ease: "cubic-bezier(0.34, 1.2, 0.5, 1)" },
  { id: "hop", level: 11, art: "front", ms: 900, ease: "cubic-bezier(0.3, 1.2, 0.5, 1)" },
  { id: "hiccup", level: 12, art: "yawn", ms: 1200, ease: "cubic-bezier(0.3, 1.6, 0.6, 1)" },
  { id: "tailwag", level: 13, art: "walk-tail", ms: 1400 },
  { id: "earflick", level: 14, art: "front", ms: 1100 },
  { id: "lookaround", level: 15, art: "wonder", ms: 1800 },
  { id: "pawtap", level: 16, art: "lie-wave", ms: 1400 },
  { id: "hipwiggle", level: 17, art: "bow-b", ms: 1500 },
  { id: "stretch", level: 18, art: "bow", ms: 1600 },
  { id: "lookback", level: 19, art: "walk-tail", ms: 1400 },
  { id: "bowing", level: 20, art: "bow", ms: 1400 },
  { id: "pawflail", level: 21, art: "cheer", ms: 1300 },
  { id: "hideface", level: 22, art: "lie-wave", ms: 1500 },
  { id: "onepaw", level: 23, art: "sit-side", ms: 1400 },
  { id: "backstep", level: 24, art: "trot", ms: 1600 },
  { id: "sneeze", level: 25, art: "bark", ms: 1100, ease: "cubic-bezier(0.3, 1.5, 0.6, 1)" },
  { id: "howl", level: 26, art: "bark", ms: 1800 },
  { id: "sidestep", level: 27, art: "trot", ms: 1700 },
  { id: "headshake", level: 28, art: "smile", ms: 1200 },
  { id: "pawcross", level: 29, art: "wave", ms: 1400 },
  { id: "dance", level: 30, art: "cheer", ms: 2000 },
];

/** 表示キー（基本ポーズ or モーション id）から、土台にするファイル名（拡張子なし）を引く */
const POSE_FILES: Record<string, string> = {
  ...POSES,
  ...Object.fromEntries(MOTIONS.map((motion) => [motion.id, motion.art])),
  // 歩数を書くとき：前足をあげた絵に、魔法のペンを持たせる
  write: "wave",
};

/**
 * 絵の差し替えでは出せない「動き」を CSS で足す仕草と、その再生用クラス。
 *
 * 素材はどれも独立した1枚絵で、目だけ違う対の絵は無い。コマ送りで仕草を作ろうと
 * すると体ごと入れ替わって二重写しになるので、報酬モーションは1枚絵のまま
 * transform だけで動かしている。基本ポーズはこれまでどおり静止画。
 */
const GESTURE_CLASS: Record<string, string> = {
  ...Object.fromEntries(MOTIONS.map((motion) => [motion.id, `frenchie-m-${motion.id}`])),
  write: "frenchie-m-write",
};

/** 立ち止まったときの仕草と、その長さ（ms） */
type Rest = { pose: string; min: number; max: number; requiredLevel?: number };

/** Lv.1 の基本動作。ここは変更しない */
const RESTS: readonly Rest[] = [
  { pose: "stand", min: 900, max: 1800 },
  { pose: "sniff", min: 1600, max: 2600 },
  { pose: "sit", min: 2200, max: 4000 },
  { pose: "happy", min: 1400, max: 2400 },
  { pose: "shake", min: 1100, max: 1700 },
  { pose: "sleep", min: 3600, max: 6000 },
];

/**
 * 報酬モーションも立ち止まりの一種として混ぜる。止まっている時間は動きより必ず
 * 長くとって、再生の途中で歩き出さないようにする。
 */
const ALL_RESTS: readonly Rest[] = [
  ...RESTS,
  ...MOTIONS.map((motion) => ({
    pose: motion.id,
    min: motion.ms + 400,
    max: motion.ms + 1200,
    requiredLevel: motion.level,
  })),
];

/**
 * 素材ごとの描き位置のずれを打ち消す量（絵の幅に対する %）。
 *
 * walk.webp は胴体が stand.webp より 17px（300px 幅の 5.7%）左に描かれている。
 * 上半身で重ねると差分が 0.106 → 0.035 まで落ちるので、絵柄の違いではなく
 * キャンバス上の位置ずれ。そのまま入れ替えると 1歩ごとに犬全体が横に飛ぶので、
 * 立ち姿を基準に踏み出しの絵を寄せて胴体を留める。前進ぶんは CSS の移動が持つ。
 * 足元（下端）は全ポーズ揃っているので縦は触らない。
 */
const POSE_NUDGE_X: Record<string, number> = {
  walk: 5.7,
  // stand-happy.webp も同じ 17px ずれ（横の描画範囲が walk と一致する）
  happy: 5.7,
};

/** 報酬モーションの再生クラス。長さと緩急だけ差し替えて、動きは @keyframes が持つ */
const MOTION_RULES = MOTIONS.map(
  (motion) =>
    `.frenchie-m-${motion.id}{animation:fm-${motion.id} ${motion.ms}ms ${motion.ease ?? "ease-in-out"} both;}`,
).join("\n        ");

/**
 * バンド幅に対する移動速度（%/秒）。1歩ぶんの絵の踏み出し幅と
 * STEP_MS × 2 で進む距離が釣り合うように決めてある。ここを崩すと
 * 足だけ動いて進まない／氷の上を滑る、のどちらかになる。
 *
 * 踏み出し幅は犬の絵の幅の 15.4%。犬はカード幅の 22%（DOG_WIDTH）なので
 * 1歩 ＝ カード幅の 3.4%、これを STEP_MS × 2 で進む速さにしてある。
 * 犬の大きさを変えたら、同じ比で必ずここも直すこと。
 */
const SPEED = 4;
/**
 * 立ち姿と踏み出しを入れ替える間隔（ms）。
 *
 * 1歩の絵の踏み出し幅は決まっているので、間隔を詰めたぶんだけ速度を上げないと
 * 足だけ動いて進まない。SPEED × STEP_MS × 2 ＝ 1歩の幅、の関係は保ってある
 * （6 × 0.42 × 2 ＝ 5.04%、以前の 3.75 × 0.68 × 2 ＝ 5.1% とほぼ同じ）。
 * 毎秒1.5枚だとどうしてもパラパラ漫画に見えるので、歩幅はそのままに毎秒2.4枚まで
 * 上げてある。
 */
const STEP_MS = 420;
/** 振り向きにかける時間（ms）。止まっている間に終わる */
const TURN_MS = 520;

/**
 * 犬の大きさ（カード幅に対する％）。px で固定すると、端末幅ごとに背景の絵との
 * 大小関係が変わってしまう。カードは縦横比が固定なので、％なら絵と一緒に伸び縮みする。
 */
const DOG_WIDTH = 22;

/**
 * 歩き回れる範囲（カード幅に対する％。犬の中心の位置）。
 *
 * 背景の絵の左端に看板が2枚あり、カード幅の 30% までを占める。犬はその右側の空いた芝を
 * 歩く。中心合わせなので、犬の左右には DOG_WIDTH の半分（11%）ずつ体がある。左は看板に、
 * 右はカードの縁に、それぞれ被らないところで止めてある。
 */
const MIN_X = 42;
const MAX_X = 86;

/**
 * 奥行き（depth：0 = いちばん手前、1 = いちばん奥）から、足もとの高さ（カードの高さに対する％）と大きさを出す。
 * 絵の芝は下から 44% まで。いちばん奥でも地平線の手前で止まり、遠くの犬は半分くらいの大きさになる。
 */
const depthBottom = (depth: number) => 1.5 + depth * 27;
const depthScale = (depth: number) => 1.06 - depth * 0.5;
/** カードの縦横比（幅 ÷ 高さ）。奥へ歩く距離を、横へ歩く距離と同じものさしで測るのに使う */
const CARD_ASPECT = 1440 / 768;
/** 奥行きの見かけの縮み（画面では短く見えても、実際にはこれだけ長く歩いている） */
const DEPTH_STRETCH = 1.6;

/** 歩数を書くときに立つ場所（看板の右下。ペン先が数字の右はしに届く） */
const WRITE_SPOT = { x: 28, depth: 0.36 };
/** 書くとき、後ろ足で立ちあがる高さ（犬の絵の高さに対する％） */
const WRITE_LIFT = 16;
/** ペンを出してから書きはじめるまで / 書いている長さ（steps-tag.tsx の INK_MS と合わせる） */
const PEN_OUT_MS = 520;
const WRITE_MS = 1300;

/**
 * コイン：8秒ごとに抽選する。1回 5 枚（枚数は DB が決める）。青は 4 回に1回くらい。1日の回数に上限はない。
 * ホームを開いているあいだ、平均して1時間に 100 枚（= 20 回）になるようにする：
 * 1時間の抽選は 3600 / 8 = 450 回なので、1回あたり 20 / 450（約 4.4%）
 */
const COIN_TICK_MS = 8000;
const COINS_PER_HOUR = 100;
const COIN_CHANCE = COINS_PER_HOUR / 5 / (3_600_000 / COIN_TICK_MS);
const COIN_BLUE_CHANCE = 0.25;
const COIN_MAX_ON_GROUND = 3;
/** コインの大きさ（カード幅に対する％。手前のとき） */
const COIN_WIDTH = 6.4;
const COIN_FALL_MS = 1050;
const PEN_SRC = "/home-magic-pen.webp";

/**
 * 前足をあげた絵（wave.webp・300×254）での、あげた前足（肉球）のまん中。絵の幅・高さに対する％。
 * スキンごとに描き位置が少しちがうので実測した。ペンはここでにぎらせ、前足だけをペンの上に重ねなおす。
 */
const WAVE_PAW: Partial<Record<DogSkinId, [number, number]>> = {
  default: [21.7, 38.2],
  hiking: [26.7, 42.1],
  summer: [26.7, 41.3],
  snow: [25.7, 40.2],
  aichi: [23.3, 45.3],
  gifu: [24, 42.1],
  mie: [20.7, 42.1],
  shizuoka: [25.7, 37.4],
  nagano: [34, 45.3],
  fukui: [23.3, 42.1],
};
const WAVE_PAW_FALLBACK: [number, number] = [25, 41.3];
/** ペンの大きさ（犬の絵の幅に対する％。正方形の箱） */
const PEN_SIZE = 26;
/** 前足でかくす丸の半径（犬の絵の幅に対する％） */
const PAW_RADIUS = 5.6;

type Walker = {
  x: number;
  /** 0 = 手前で大きい、1 = 奥で小さい */
  depth: number;
  /** 1 = 左向き（素材のまま）、-1 = 右向き */
  facing: 1 | -1;
  /** 表示キー。基本ポーズ名か、報酬モーションの id */
  pose: string;
  walking: boolean;
  travelMs: number;
  /** 立ち姿と踏み出しを入れ替える間隔（走るときは短く） */
  stepMs: number;
  /** 魔法のペンを持っているか */
  pen: boolean;
};

type Coin = {
  id: string;
  kind: "coin" | "blue";
  x: number;
  depth: number;
  /** 空から足もとまで落ちる距離（px） */
  fallPx: number;
  state: "falling" | "ground" | "taken";
  /** 拾ったあとに出す文字（「+5」など） */
  label: string | null;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const zOf = (depth: number) => 10 + Math.round((1 - depth) * 100);

const rand = (min: number, max: number) => min + Math.random() * (max - min);
/** 重みつきで1つ選ぶ（天気で出やすくした仕草に使う） */
const pickWeighted = <T,>(items: readonly T[], weightOf: (item: T) => number): T => {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= weightOf(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1] as T;
};

export function WanderingFrenchie({
  level = 1,
  skin = "default",
}: {
  level?: number;
  /** 表示する犬スキン。所持していないスキンを渡さないのは呼び出し側の責任 */
  skin?: DogSkinId;
}) {
  // 基本ポーズは常に、報酬モーションは解放済みのものだけ重ねて置く。書くときの絵（wave）はいつでも
  const visibleKeys: string[] = [
    ...POSE_KEYS,
    ...MOTIONS.filter((motion) => motion.level <= level).map((motion) => motion.id),
    "write",
  ];
  const [walker, setWalker] = useState<Walker>({
    x: 66,
    depth: 0.45,
    facing: 1,
    pose: "stand",
    walking: false,
    travelMs: 0,
    stepMs: STEP_MS,
    pen: false,
  });
  const walkerRef = useRef(walker);
  const [stepUp, setStepUp] = useState(false);
  const poseNodes = useRef<Record<string, HTMLImageElement | null>>({});
  // ホームの天気（HomeWeatherProvider の中にいるときだけ）。歩き回りの流れは止めたくないので ref で渡す
  const hw = useHomeWeather();
  const weatherRef = useRef(hw);
  weatherRef.current = hw;
  const bobNode = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);

  const [coins, setCoins] = useState<Coin[]>([]);
  const coinsRef = useRef(coins);
  coinsRef.current = coins;
  /** 犬への用事（コインを拾いに行く）を外から足す口。歩き回りの effect の中で差しかえる */
  const enqueueCoinRef = useRef<(id: string) => void>(() => {});
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  // 拾う（犬が拾っても、タップで拾っても同じ）。数は DB が決めて返す
  const collectCoin = (id: string) => {
    const coin = coinsRef.current.find((c) => c.id === id);
    if (!coin || coin.state === "taken") return;
    setCoins((list) => list.map((c) => (c.id === id ? { ...c, state: "taken" } : c)));
    // 拾ったコインは消えるが、「+5」を出しおわるまで場所は残しておく
    const finish = () => setTimeout(() => setCoins((list) => list.filter((c) => c.id !== id)), 1600);

    // 続けて拾うと DB が「間かくが短い（8秒）」と断るので、そのときは少し待って受け取りなおす
    const claim = (tries: number) => {
      void fetch("/api/coins/home-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropId: id, kind: coin.kind }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { granted?: boolean; kind?: "coin" | "blue"; amount?: number; reason?: string | null } | null) => {
          if (!body) return finish();
          if (body.reason === "too_soon" && tries < 3) {
            setTimeout(() => claim(tries + 1), 8500);
            return;
          }
          if (body.granted && body.amount) {
            setCoins((list) => list.map((c) => (c.id === id ? { ...c, kind: body.kind ?? c.kind, label: `+${body.amount}` } : c)));
            // 上のコインの数を新しくする（何度も続けて取り直さない）
            if (Date.now() - lastRefreshRef.current > 3000) {
              lastRefreshRef.current = Date.now();
              router.refresh();
            }
          }
          finish();
        })
        .catch(() => finish());
    };
    claim(0);
  };
  const collectRef = useRef(collectCoin);
  collectRef.current = collectCoin;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const availableRests = ALL_RESTS.filter((rest) => (rest.requiredLevel ?? 1) <= level);

    let alive = true;
    /** いまの動きの番号。用事が割りこむと増えて、それまでの動きは止まる */
    let token = 0;
    let busy = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    type Task = { kind: "write" } | { kind: "coin"; id: string };
    const tasks: Task[] = [];
    let writeRequest: StepsWriteRequest | null = null;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(() => {
          timers.delete(id);
          resolve();
        }, ms);
        timers.add(id);
      });
    const live = (t: number) => alive && t === token;
    const set = (next: Walker) => {
      walkerRef.current = next;
      setWalker(next);
    };

    /** 歩いている途中で止める：いま見えている場所を読んで、そこに立たせる */
    const freeze = () => {
      const node = moverRef.current;
      const box = boxRef.current;
      const current = walkerRef.current;
      if (!node || !box || !current.walking) return;
      const style = getComputedStyle(node);
      const x = (parseFloat(style.left) / box.clientWidth) * 100;
      const bottom = (parseFloat(style.bottom) / box.clientHeight) * 100;
      if (!Number.isFinite(x) || !Number.isFinite(bottom)) return;
      set({ ...current, x, depth: clamp01((bottom - depthBottom(0)) / (depthBottom(1) - depthBottom(0))), pose: "stand", walking: false, travelMs: 1 });
    };

    const walkTo = async (t: number, x: number, depth: number, speed = 1): Promise<boolean> => {
      const from = walkerRef.current;
      const dx = x - from.x;
      const facing: 1 | -1 = Math.abs(dx) < 1.5 ? from.facing : dx > 0 ? -1 : 1;
      // 振り向きは止まったまま済ませる
      if (facing !== from.facing) {
        set({ ...from, facing, pose: "stand", walking: false, travelMs: 1 });
        await sleep(TURN_MS);
      } else {
        await sleep(60);
      }
      if (!live(t)) return false;
      // 奥ほど小さく見えるので、同じ速さで歩いても画面の上ではゆっくり進む
      const meanScale = (depthScale(from.depth) + depthScale(depth)) / 2;
      const ground = Math.hypot(dx, ((depthBottom(depth) - depthBottom(from.depth)) / CARD_ASPECT) * DEPTH_STRETCH);
      const travelMs = Math.max(260, (ground / meanScale / (SPEED * speed)) * 1000);
      set({ x, depth, facing, pose: "walk", walking: true, travelMs, stepMs: STEP_MS / Math.pow(speed, 0.6), pen: false });
      await sleep(travelMs);
      return live(t);
    };

    const rest = async (t: number) => {
      const now = weatherRef.current;
      const weights = restWeightsOf(now?.weather ?? null);
      const { pose, min, max } = pickWeighted(availableRests, (r) => weights[r.pose] ?? 1);
      set({ ...walkerRef.current, pose, walking: false, travelMs: 0 });
      await sleep(rand(min, max));
      return live(t);
    };

    const wander = async (t: number) => {
      while (live(t)) {
        const from = walkerRef.current;
        // ちょこっと動いて止まる、を避けてある程度の距離を歩かせる
        let target = rand(MIN_X, MAX_X);
        if (Math.abs(target - from.x) < 7) {
          const middle = (MIN_X + MAX_X) / 2;
          target = from.x < middle ? rand(middle + 2, MAX_X) : rand(MIN_X, middle - 2);
        }
        // ときどき大きく奥や手前へ。ふだんは今の奥行きのまわり
        const depth = Math.random() < 0.35 ? Math.random() : clamp01(from.depth + rand(-0.4, 0.4));
        if (!(await walkTo(t, target, depth))) return;
        if (!(await rest(t))) return;
      }
    };

    const writeSteps = async (t: number) => {
      if (!(await walkTo(t, WRITE_SPOT.x, WRITE_SPOT.depth, 2.1))) return;
      // 看板のほう（左）を向く
      if (walkerRef.current.facing !== 1) {
        set({ ...walkerRef.current, facing: 1, pose: "stand", walking: false, travelMs: 1 });
        await sleep(TURN_MS);
      }
      // 後ろ足で立って、魔法のペンを出す
      set({ ...walkerRef.current, pose: "write", walking: false, travelMs: 0, pen: true });
      await sleep(PEN_OUT_MS);
      writeRequest?.write();
      await sleep(WRITE_MS);
      set({ ...walkerRef.current, pose: "happy", pen: false });
      writeRequest?.done();
      writeRequest = null;
      await sleep(1100);
    };

    const fetchCoin = async (t: number, id: string) => {
      const coin = coinsRef.current.find((c) => c.id === id);
      if (!coin || coin.state === "taken") return;
      // コインのとなりで止まって、鼻先で拾う（近づいてきた側に立つ）
      const from = walkerRef.current;
      const reach = 6 * depthScale(coin.depth);
      const x = Math.min(92, Math.max(10, from.x < coin.x ? coin.x - reach : coin.x + reach));
      if (!(await walkTo(t, x, coin.depth, 1.9))) return;
      const still = coinsRef.current.find((c) => c.id === id);
      if (!still || still.state === "taken") return;
      // コインのほうを向く
      const facing: 1 | -1 = coin.x > walkerRef.current.x ? -1 : 1;
      if (facing !== walkerRef.current.facing) {
        set({ ...walkerRef.current, facing, pose: "stand", walking: false, travelMs: 1 });
        await sleep(TURN_MS);
      }
      set({ ...walkerRef.current, pose: "sniff", walking: false, travelMs: 0 });
      await sleep(450);
      collectRef.current(id);
      set({ ...walkerRef.current, pose: "happy" });
      await sleep(1000);
    };

    const runNext = async () => {
      if (busy || !alive) return;
      const task = tasks.shift();
      if (!task) return;
      busy = true;
      const t = ++token;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      freeze();
      if (task.kind === "write") await writeSteps(t);
      else await fetchCoin(t, task.id);
      busy = false;
      if (!alive) return;
      if (tasks.length) void runNext();
      else void wander(++token);
    };

    const unregister = registerStepsWriter((request) => {
      if (!alive) return false;
      // 書いている途中に頼みなおされたら、新しいほうに書く
      writeRequest = request;
      if (!tasks.some((task) => task.kind === "write")) tasks.unshift({ kind: "write" });
      void runNext();
      return true;
    });
    enqueueCoinRef.current = (id) => {
      tasks.push({ kind: "coin", id });
      void runNext();
    };

    void sleep(700).then(() => {
      if (alive && !busy) void wander(++token);
    });

    return () => {
      alive = false;
      unregister();
      enqueueCoinRef.current = () => {};
      for (const id of timers) clearTimeout(id);
    };
  }, [level]);

  // 5秒ごとに 5% で、空からコインが降る（画面を見ているときだけ）
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (coinsRef.current.length >= COIN_MAX_ON_GROUND || Math.random() >= COIN_CHANCE) return;
      const box = boxRef.current;
      if (!box) return;
      const depth = Math.random();
      const coin: Coin = {
        id: crypto.randomUUID().replace(/-/g, ""),
        kind: Math.random() < COIN_BLUE_CHANCE ? "blue" : "coin",
        x: rand(30, 90),
        depth,
        fallPx: box.clientHeight * (1 - depthBottom(depth) / 100) + 24,
        state: "falling",
        label: null,
      };
      setCoins((list) => [...list, coin]);
      setTimeout(() => {
        setCoins((list) => list.map((c) => (c.id === coin.id && c.state === "falling" ? { ...c, state: "ground" } : c)));
        enqueueCoinRef.current(coin.id);
      }, COIN_FALL_MS);
    }, COIN_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // 歩いている間だけ、立ち姿と踏み出しを入れ替える
  useEffect(() => {
    if (!walker.walking) {
      setStepUp(false);
      return;
    }
    // 歩き出しは踏み出しの絵から。ここを立ち姿のまま始めると、最初の1歩ぶん
    // （STEP_MS）だけ足を止めたまま横に滑る
    setStepUp(true);
    const id = setInterval(() => setStepUp((v) => !v), walker.stepMs);
    return () => clearInterval(id);
  }, [walker.walking, walker.stepMs]);

  const activePose: string = walker.walking ? (stepUp ? "walk" : "stand") : walker.pose;
  const paw = WAVE_PAW[skin] ?? WAVE_PAW_FALLBACK;

  // 動きのある仕草は、その仕草に切り替わるたびに頭から再生し直す
  useEffect(() => {
    const playClass = GESTURE_CLASS[activePose];
    const node = poseNodes.current[activePose];
    if (!playClass || !node) return;

    node.classList.remove(playClass);
    // クラスを外した状態を一度確定させてから付け直す。同じフレームで付け外しすると
    // 相殺されて2回目以降が再生されない
    void node.offsetWidth;
    node.classList.add(playClass);
  }, [activePose]);

  // 立ち止まって仕草が変わるたび、体をひと沈みさせて絵の入れ替わりを隠す
  useEffect(() => {
    const node = bobNode.current;
    if (!node) return;
    if (walker.walking) {
      // 歩行中は同じ層を bob が使う。残しておくと取り合いになる
      node.classList.remove("frenchie-settle");
      return;
    }
    node.classList.remove("frenchie-settle");
    void node.offsetWidth;
    node.classList.add("frenchie-settle");
  }, [walker.pose, walker.walking]);

  return (
    // z-[15]：看板（z-10）より手前、右上のボタン（z-40）より奥。犬とコインの前後は、この中で奥行きから決める
    <div ref={boxRef} className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      <style>{`
        /* 上下は1歩ごと、左右の揺れは2歩で1往復。踏み替え（0% / 50%）を必ず
           いちばん低いところに合わせると、絵が入れ替わる瞬間が沈み込みに隠れる */
        @keyframes frenchie-bob {
          0%, 100% { transform: translateY(0.5px) rotate(-0.7deg) scale(1.015, 0.99); }
          25%      { transform: translateY(-2px)  rotate(-0.15deg) scale(0.995, 1.008); }
          50%      { transform: translateY(0.5px) rotate(0.7deg)  scale(1.015, 0.99); }
          75%      { transform: translateY(-2px)  rotate(0.15deg) scale(0.995, 1.008); }
        }
        .frenchie-bob { transform-origin: 50% 92%; }
        .frenchie-walking .frenchie-bob {
          animation: frenchie-bob ${STEP_MS * 2}ms ease-in-out infinite;
        }

        /* 立ち止まっている間の呼吸。1枚絵のままだと完全に固まって見える */
        @keyframes frenchie-breath {
          0%, 100% { transform: translateY(0)    scale(1, 1); }
          50%      { transform: translateY(-1px) scale(0.995, 1.012); }
        }
        .frenchie-breath {
          transform-origin: 50% 100%;
          animation: frenchie-breath 3400ms ease-in-out infinite;
        }
        .frenchie-walking .frenchie-breath { animation: none; }
        /* 仕草の切り替え。長く重ねると別々に描かれた体が二重写しになるので、
           下の frenchie-settle が沈み込んでいる間に切り替えを終わらせる */
        .frenchie-pose { transition: opacity 120ms ease; }
        .frenchie-walking .frenchie-pose { transition: none; }

        /* 立ち止まって仕草が変わる瞬間。絵が入れ替わるのに合わせて一度沈んで戻る。
           クロスフェードを「動きの中」に隠すので、静止画が溶け合うのではなく
           犬が姿勢を変えたように見える。歩行中は同じ層を bob が使うので流さない */
        @keyframes frenchie-settle {
          0%   { transform: translateY(3px)  scale(1.05, 0.94); }
          45%  { transform: translateY(-3px) scale(0.98, 1.03); }
          72%  { transform: translateY(1px)  scale(1.01, 0.99); }
          100% { transform: translateY(0)    scale(1, 1); }
        }
        .frenchie-settle {
          animation: frenchie-settle 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        /* 報酬モーション共通。入りがゆっくりだと前の絵と重なって二重写しになるので
           切り替えは短く。回転と拡縮の軸は足元に置く（腰から上だけが動いて見える） */
        .frenchie-gesture { transition: opacity 90ms ease; transform-origin: 50% 92%; }

        /* Lv.2 首をかしげる：ゆっくり傾けて、そのまま少し止めてから戻す */
        @keyframes fm-tilt {
          0%       { transform: rotate(0deg)    translateX(0); }
          28%, 68% { transform: rotate(-9deg)   translateX(-2px); }
          85%      { transform: rotate(2deg)    translateX(0.5px); }
          100%     { transform: rotate(0deg)    translateX(0); }
        }

        /* Lv.3 お手：前へ体を預けて、前足を差し出すぶんだけ二度沈む */
        @keyframes fm-paw {
          0%, 100% { transform: translateX(0)    rotate(0deg)   scale(1, 1); }
          22%      { transform: translateX(-5px) rotate(-5deg)  scale(1.01, 0.98); }
          45%      { transform: translateX(-2px) rotate(-2deg)  scale(1, 1); }
          68%      { transform: translateX(-5px) rotate(-5deg)  scale(1.01, 0.98); }
        }

        /* Lv.4 ハイタッチ：ためてから前足を高く突き上げ、跳ねて戻る */
        @keyframes fm-highfive {
          0%       { transform: translateY(0)     rotate(0deg)   scale(1, 1); }
          18%      { transform: translateY(4px)   rotate(0deg)   scale(1.05, 0.94); }
          42%      { transform: translateY(-12px) rotate(-7deg)  scale(0.96, 1.06); }
          62%      { transform: translateY(-2px)  rotate(-3deg)  scale(1, 1); }
          78%      { transform: translateY(-6px)  rotate(-5deg)  scale(0.99, 1.02); }
          100%     { transform: translateY(0)     rotate(0deg)   scale(1, 1); }
        }

        /* Lv.5 ウインク：ためて、顔を寄せながら跳ね、もう一度小さく弾んで戻る */
        @keyframes fm-wink {
          0%, 10%  { transform: translateY(0)    rotate(0deg)    scale(1, 1); }
          20%      { transform: translateY(2px)  rotate(0deg)    scale(1.05, 0.94); }
          36%      { transform: translateY(-7px) rotate(-6deg)   scale(0.97, 1.05); }
          52%      { transform: translateY(0)    rotate(-3.5deg) scale(1, 1); }
          66%      { transform: translateY(-4px) rotate(-5.5deg) scale(0.99, 1.02); }
          80%      { transform: translateY(0)    rotate(-2.5deg) scale(1, 1); }
          100%     { transform: translateY(0)    rotate(0deg)    scale(1, 1); }
        }

        /* Lv.6 にっこり：胸を張るように、やわらかく二度ふくらむ */
        @keyframes fm-grin {
          0%, 100% { transform: translateY(0)    scale(1, 1); }
          30%      { transform: translateY(-3px) scale(1.03, 1.03); }
          55%      { transform: translateY(-1px) scale(1.01, 1.01); }
          78%      { transform: translateY(-3px) scale(1.03, 1.03); }
        }

        /* Lv.7 びっくり：一瞬で跳ね上がって固まり、細かく震えて戻る */
        @keyframes fm-surprise {
          0%       { transform: translateY(0)     rotate(0deg)    scale(1, 1); }
          12%      { transform: translateY(-13px) rotate(0deg)    scale(0.92, 1.1); }
          30%      { transform: translateY(-9px)  rotate(2.5deg)  scale(1, 1); }
          44%      { transform: translateY(-9px)  rotate(-2.5deg) scale(1, 1); }
          58%      { transform: translateY(-6px)  rotate(1.5deg)  scale(1, 1); }
          100%     { transform: translateY(0)     rotate(0deg)    scale(1, 1); }
        }

        /* Lv.8 いないいないばあ：小さくしゃがんで隠れ、勢いよく現れる */
        @keyframes fm-peekaboo {
          0%       { transform: translateY(0)    scale(1, 1); }
          20%, 46% { transform: translateY(11px) scale(1.08, 0.78); }
          64%      { transform: translateY(-8px) scale(0.94, 1.1); }
          80%      { transform: translateY(1px)  scale(1.02, 0.98); }
          100%     { transform: translateY(0)    scale(1, 1); }
        }

        /* Lv.9 くるっとターン：横幅をつぶし切って裏返り、正面まで戻る */
        @keyframes fm-spin {
          0%       { transform: scaleX(1)     rotate(0deg); }
          25%      { transform: scaleX(0.12)  rotate(-3deg); }
          50%      { transform: scaleX(-0.85) rotate(0deg); }
          75%      { transform: scaleX(0.12)  rotate(3deg); }
          100%     { transform: scaleX(1)     rotate(0deg); }
        }

        /* Lv.10 二足立ち：後ろ足に体重を移して立ち上がり、そのままふらつく */
        @keyframes fm-standup {
          0%       { transform: translateY(0)    rotate(0deg)   scale(1, 1); }
          22%      { transform: translateY(2px)  rotate(0deg)   scale(1.04, 0.95); }
          45%      { transform: translateY(-9px) rotate(-4deg)  scale(0.94, 1.09); }
          62%      { transform: translateY(-9px) rotate(3deg)   scale(0.94, 1.09); }
          78%      { transform: translateY(-9px) rotate(-2deg)  scale(0.94, 1.09); }
          100%     { transform: translateY(0)    rotate(0deg)   scale(1, 1); }
        }

        /* Lv.11 小ジャンプ：沈み込み → 跳ぶ → 着地でつぶれる */
        @keyframes fm-hop {
          0%       { transform: translateY(0)     scale(1, 1); }
          18%      { transform: translateY(5px)   scale(1.08, 0.9); }
          45%      { transform: translateY(-18px) scale(0.93, 1.1); }
          72%      { transform: translateY(0)     scale(1.06, 0.93); }
          88%      { transform: translateY(-2px)  scale(0.99, 1.02); }
          100%     { transform: translateY(0)     scale(1, 1); }
        }

        /* Lv.12 しゃっくり：不規則な間隔で三度、体ごと小さく跳ねる */
        @keyframes fm-hiccup {
          0%, 8%   { transform: translateY(0)    scale(1, 1); }
          14%      { transform: translateY(-7px) scale(0.96, 1.06); }
          24%      { transform: translateY(0)    scale(1, 1); }
          44%      { transform: translateY(-6px) scale(0.97, 1.05); }
          54%      { transform: translateY(0)    scale(1, 1); }
          78%      { transform: translateY(-8px) scale(0.95, 1.07); }
          88%, 100%{ transform: translateY(0)    scale(1, 1); }
        }

        /* Lv.13 しっぽフリフリ：腰から後ろだけを速く振る（軸を後ろ足に置く） */
        .frenchie-m-tailwag { transform-origin: 78% 92%; }
        @keyframes fm-tailwag {
          0%, 100%           { transform: rotate(0deg)    scaleX(1); }
          12%, 37%, 62%, 87% { transform: rotate(3.2deg)  scaleX(0.985); }
          25%, 50%, 75%      { transform: rotate(-3.2deg) scaleX(0.985); }
        }

        /* Lv.14 耳ぴくぴく：ほとんど動かない。細かく速く、二度ずつ跳ねる */
        @keyframes fm-earflick {
          0%, 16%, 34%, 60%, 100% { transform: translateY(0)      rotate(0deg); }
          22%                     { transform: translateY(-1.5px) rotate(-1.8deg); }
          28%                     { transform: translateY(0)      rotate(0.8deg); }
          46%                     { transform: translateY(-1.5px) rotate(1.8deg); }
          52%                     { transform: translateY(0)      rotate(-0.8deg); }
          72%                     { transform: translateY(-1.2px) rotate(-1.4deg); }
        }

        /* Lv.15 キョロキョロ：左を見て、右を見て、ゆっくり正面へ */
        @keyframes fm-lookaround {
          0%       { transform: translateX(0)    rotate(0deg); }
          22%      { transform: translateX(-6px) rotate(-6deg); }
          38%      { transform: translateX(-6px) rotate(-6deg); }
          62%      { transform: translateX(6px)  rotate(6deg); }
          78%      { transform: translateX(6px)  rotate(6deg); }
          100%     { transform: translateX(0)    rotate(0deg); }
        }

        /* Lv.16 前足ちょいちょい：前足で小刻みに四回つつく */
        @keyframes fm-pawtap {
          0%, 100%        { transform: translateX(0)    translateY(0)    rotate(0deg); }
          14%, 39%, 64%   { transform: translateX(-4px) translateY(-2px) rotate(-3.5deg); }
          26%, 51%, 76%   { transform: translateX(0)    translateY(0)    rotate(0deg); }
        }

        /* Lv.17 おしりフリフリ：前足を軸にして、腰だけを大きく左右に振る */
        .frenchie-m-hipwiggle { transform-origin: 22% 92%; }
        @keyframes fm-hipwiggle {
          0%, 100%      { transform: rotate(0deg)    translateY(0); }
          15%, 45%, 75% { transform: rotate(5.5deg)  translateY(-1px); }
          30%, 60%, 90% { transform: rotate(-5.5deg) translateY(-1px); }
        }

        /* Lv.18 のび〜っ：前足を伸ばして体を長く低く、たっぷり止めてから戻す */
        @keyframes fm-stretch {
          0%       { transform: translateY(0)   scale(1, 1); }
          35%, 68% { transform: translateY(3px) scale(1.11, 0.9); }
          85%      { transform: translateY(-2px) scale(0.98, 1.03); }
          100%     { transform: translateY(0)   scale(1, 1); }
        }

        /* Lv.19 ふりむく：横幅をつぶして一気に裏返り、後ろを見たまま少し止めて戻る。
           つぶれたところで止めると絵が潰れて見えるので、細いのは通過するだけにする */
        @keyframes fm-lookback {
          0%       { transform: scaleX(1)     rotate(0deg); }
          22%      { transform: scaleX(0.3)   rotate(-3deg); }
          40%, 60% { transform: scaleX(-0.92) rotate(0deg); }
          78%      { transform: scaleX(0.3)   rotate(3deg); }
          100%     { transform: scaleX(1)     rotate(0deg); }
        }

        /* Lv.20 おじぎ：前へ深く倒して、ひと呼吸置いてから起き上がる */
        @keyframes fm-bowing {
          0%       { transform: rotate(0deg)     translateY(0)   scale(1, 1); }
          30%, 62% { transform: rotate(-13deg)   translateY(3px) scale(1.03, 0.96); }
          84%      { transform: rotate(2.5deg)   translateY(-1px) scale(0.99, 1.02); }
          100%     { transform: rotate(0deg)     translateY(0)   scale(1, 1); }
        }

        /* Lv.21 前足バタバタ：浮いたまま、左右に速く倒れ込む */
        @keyframes fm-pawflail {
          0%, 100%      { transform: translateY(0)    rotate(0deg); }
          12%           { transform: translateY(-4px) rotate(-7deg); }
          30%           { transform: translateY(-4px) rotate(7deg); }
          48%           { transform: translateY(-4px) rotate(-7deg); }
          66%           { transform: translateY(-4px) rotate(7deg); }
          84%           { transform: translateY(-2px) rotate(-3deg); }
        }

        /* Lv.22 顔かくし：小さく縮こまって、細かく震えながら耐える */
        @keyframes fm-hideface {
          0%       { transform: translateY(0)   scale(1, 1)        rotate(0deg); }
          20%      { transform: translateY(5px) scale(0.93, 0.93)  rotate(0deg); }
          38%      { transform: translateY(5px) scale(0.93, 0.93)  rotate(2deg); }
          52%      { transform: translateY(5px) scale(0.93, 0.93)  rotate(-2deg); }
          66%      { transform: translateY(5px) scale(0.93, 0.93)  rotate(1.5deg); }
          100%     { transform: translateY(0)   scale(1, 1)        rotate(0deg); }
        }

        /* Lv.23 片足あげ：片側へ重心を寄せて、そのまま止まって見せる */
        @keyframes fm-onepaw {
          0%       { transform: rotate(0deg)   translateX(0)   translateY(0); }
          25%, 70% { transform: rotate(7deg)   translateX(4px) translateY(-2px); }
          88%      { transform: rotate(-2deg)  translateX(-1px) translateY(0); }
          100%     { transform: rotate(0deg)   translateX(0)   translateY(0); }
        }

        /* Lv.24 後ずさり：正面を向いたまま、三歩ぶん後ろへ下がる */
        @keyframes fm-backstep {
          0%       { transform: translateX(0)     translateY(0)    rotate(0deg); }
          20%      { transform: translateX(5px)   translateY(-2px) rotate(1.5deg); }
          40%      { transform: translateX(10px)  translateY(0)    rotate(0deg); }
          60%      { transform: translateX(15px)  translateY(-2px) rotate(1.5deg); }
          78%      { transform: translateX(15px)  translateY(0)    rotate(0deg); }
          100%     { transform: translateX(0)     translateY(0)    rotate(0deg); }
        }

        /* Lv.25 くしゃみ：後ろへためて、勢いよく前へ弾け、余韻で二度揺れる */
        @keyframes fm-sneeze {
          0%       { transform: translateX(0)     rotate(0deg)    scale(1, 1); }
          26%      { transform: translateX(6px)   rotate(5deg)    scale(0.98, 1.03); }
          40%      { transform: translateX(-11px) rotate(-11deg)  scale(1.06, 0.93); }
          58%      { transform: translateX(-2px)  rotate(-2deg)   scale(1, 1); }
          74%      { transform: translateX(-5px)  rotate(-5deg)   scale(1.02, 0.98); }
          100%     { transform: translateX(0)     rotate(0deg)    scale(1, 1); }
        }

        /* Lv.26 遠吠え：鼻先を持ち上げて反り、長く伸ばしてからゆっくり下ろす */
        @keyframes fm-howl {
          0%       { transform: translateY(0)    rotate(0deg)   scale(1, 1); }
          16%      { transform: translateY(2px)  rotate(0deg)   scale(1.03, 0.97); }
          34%      { transform: translateY(-7px) rotate(-9deg)  scale(0.97, 1.06); }
          66%      { transform: translateY(-8px) rotate(-10deg) scale(0.97, 1.06); }
          88%      { transform: translateY(-1px) rotate(-2deg)  scale(1, 1); }
          100%     { transform: translateY(0)    rotate(0deg)   scale(1, 1); }
        }

        /* Lv.27 左右ステップ：踏み替えながら左へ、右へ、と body を送る */
        @keyframes fm-sidestep {
          0%, 100% { transform: translateX(0)     translateY(0)     rotate(0deg); }
          18%      { transform: translateX(-9px)  translateY(-3px)  rotate(-3deg); }
          34%      { transform: translateX(-9px)  translateY(0)     rotate(0deg); }
          56%      { transform: translateX(9px)   translateY(-3px)  rotate(3deg); }
          72%      { transform: translateX(9px)   translateY(0)     rotate(0deg); }
          88%      { transform: translateX(-3px)  translateY(-1px)  rotate(-1deg); }
        }

        /* Lv.28 首ぶんぶん：水を切るように、速く大きく左右へ振り切る */
        @keyframes fm-headshake {
          0%, 100%           { transform: rotate(0deg)   scaleX(1); }
          10%, 34%, 58%, 82% { transform: rotate(-9deg)  scaleX(0.97); }
          22%, 46%, 70%      { transform: rotate(9deg)   scaleX(0.97); }
        }

        /* Lv.29 前足クロス：前足を組み替えるぶん、体が斜めに入れ替わる */
        @keyframes fm-pawcross {
          0%, 100% { transform: rotate(0deg)   translateX(0)    scaleX(1); }
          22%      { transform: rotate(-6deg)  translateX(-4px) scaleX(0.94); }
          44%      { transform: rotate(0deg)   translateX(0)    scaleX(1); }
          66%      { transform: rotate(6deg)   translateX(4px)  scaleX(0.94); }
          86%      { transform: rotate(-2deg)  translateX(-1px) scaleX(0.99); }
        }

        /* Lv.30 うれしいダンス：跳ねる・回る・伸びるを全部つなげた、いちばん派手なやつ */
        @keyframes fm-dance {
          0%       { transform: translateY(0)     rotate(0deg)   scale(1, 1); }
          12%      { transform: translateY(-10px) rotate(-8deg)  scale(0.96, 1.07); }
          24%      { transform: translateY(0)     rotate(0deg)   scale(1.06, 0.94); }
          36%      { transform: translateY(-10px) rotate(8deg)   scale(0.96, 1.07); }
          48%      { transform: translateY(0)     rotate(0deg)   scale(1.06, 0.94); }
          60%      { transform: translateY(-6px)  rotate(0deg)   scale(0.9, 1.05); }
          72%      { transform: translateY(-6px)  rotate(0deg)   scale(1.1, 1.05); }
          86%      { transform: translateY(-9px)  rotate(-5deg)  scale(0.98, 1.04); }
          100%     { transform: translateY(0)     rotate(0deg)   scale(1, 1); }
        }

        ${MOTION_RULES}

        /* 歩数を書く：前足をあげたまま、ペンを走らせるぶんだけ小さく揺れる */
        .frenchie-m-write { animation: fm-write ${PEN_OUT_MS + WRITE_MS}ms ease-in-out both; }
        @keyframes fm-write {
          0%, 28%  { transform: rotate(0deg)    translateX(0); }
          36%, 60% { transform: rotate(-2.5deg) translateX(-1px); }
          48%, 72% { transform: rotate(1deg)    translateX(1px); }
          84%      { transform: rotate(-1.5deg) translateX(0); }
          100%     { transform: rotate(0deg)    translateX(0); }
        }
        /* 後ろ足で立ちあがる（ペンが看板に届くところまで） */
        .frenchie-lift { transition: transform 360ms cubic-bezier(0.34, 1.3, 0.5, 1); transform-origin: 50% 100%; }
        /* 魔法のペン：きらっと出てきて、書いている間はペン先をこまかく走らせる */
        @keyframes frenchie-pen-in {
          0%   { opacity: 0; transform: rotate(155deg) scale(0.2); filter: brightness(2.2) drop-shadow(0 0 6px #9fd0ff); }
          60%  { opacity: 1; transform: rotate(107deg) scale(1.12); filter: brightness(1.5) drop-shadow(0 0 5px #9fd0ff); }
          100% { opacity: 1; transform: rotate(115deg) scale(1);    filter: drop-shadow(0 0 3px rgba(120,180,255,.75)); }
        }
        @keyframes frenchie-pen-write {
          0%, 100% { transform: rotate(115deg) translate(0, 0); }
          20%      { transform: rotate(110deg) translate(-2%, 3%); }
          40%      { transform: rotate(119deg) translate(2%, -2%); }
          60%      { transform: rotate(112deg) translate(-1%, 4%); }
          80%      { transform: rotate(118deg) translate(2%, -1%); }
        }
        .frenchie-pen {
          animation:
            frenchie-pen-in ${PEN_OUT_MS}ms cubic-bezier(0.34, 1.4, 0.5, 1) both,
            frenchie-pen-write 260ms ease-in-out ${PEN_OUT_MS}ms ${Math.floor(WRITE_MS / 260)};
          filter: drop-shadow(0 0 3px rgba(120,180,255,.75));
        }
        /* ペン先からこぼれる光の粒 */
        @keyframes frenchie-pen-spark {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
          30%  { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--sx), var(--sy)) scale(1); }
        }
        .frenchie-pen-spark { animation: frenchie-pen-spark 700ms ease-out ${PEN_OUT_MS}ms 2 both; }

        /* 空から降ってくるコイン：落ちて、2回はねて止まる。くるくる回りつづける */
        @keyframes home-coin-fall {
          0%   { transform: translateY(calc(-1 * var(--fall))); animation-timing-function: cubic-bezier(0.5, 0, 1, 0.6); }
          62%  { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0.4, 0.5, 1); }
          76%  { transform: translateY(-34%); animation-timing-function: cubic-bezier(0.5, 0, 1, 0.6); }
          88%  { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0.4, 0.5, 1); }
          94%  { transform: translateY(-10%); }
          100% { transform: translateY(0); }
        }
        @keyframes home-coin-spin {
          0%, 100% { transform: scaleX(1); }
          50%      { transform: scaleX(0.18); }
        }
        @keyframes home-coin-shadow {
          0%   { opacity: 0;   transform: scale(0.3); }
          62%  { opacity: 1;   transform: scale(1); }
          76%  { opacity: 0.6; transform: scale(0.8); }
          100% { opacity: 1;   transform: scale(1); }
        }
        @keyframes home-coin-take {
          0%   { transform: translateY(0)     scale(1);   opacity: 1; }
          35%  { transform: translateY(-70%)  scale(1.35); opacity: 1; }
          100% { transform: translateY(-160%) scale(0.6); opacity: 0; }
        }
        @keyframes home-coin-label {
          0%   { transform: translate(-50%, 0);     opacity: 0; }
          20%  { transform: translate(-50%, -40%);  opacity: 1; }
          75%  { transform: translate(-50%, -110%); opacity: 1; }
          100% { transform: translate(-50%, -150%); opacity: 0; }
        }
        @keyframes home-coin-glint {
          0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
          50%      { opacity: 1; transform: scale(1) rotate(45deg); }
        }
        .home-coin-fall { animation: home-coin-fall ${COIN_FALL_MS}ms both; }
        .home-coin-spin { animation: home-coin-spin 900ms linear infinite; }
        .home-coin-ground .home-coin-spin { animation-duration: 2400ms; }
        .home-coin-shadow { animation: home-coin-shadow ${COIN_FALL_MS}ms both; }
        .home-coin-take { animation: home-coin-take 620ms cubic-bezier(0.3, 0.8, 0.4, 1) both; }
        .home-coin-label { animation: home-coin-label 1500ms ease-out both; }
        .home-coin-glint { animation: home-coin-glint 1400ms ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .frenchie-walking .frenchie-bob { animation: none; }
          .frenchie-breath { animation: none; }
          .frenchie-settle { animation: none; }
          .frenchie-pose { transition: none; }
          .frenchie-gesture[class*="frenchie-m-"] { animation: none; }
        }
      `}</style>

      {/* 空から降ってきたコイン（奥行きで大きさと前後が決まる） */}
      {coins.map((coin) => {
        const scale = depthScale(coin.depth);
        const Art = coin.kind === "blue" ? BlueCoinArt : CoinArt;
        return (
          <div
            key={coin.id}
            className="absolute"
            style={{
              left: `${coin.x}%`,
              bottom: `${depthBottom(coin.depth)}%`,
              width: `${COIN_WIDTH * scale}%`,
              transform: "translateX(-50%)",
              zIndex: zOf(coin.depth) + 2,
            }}
          >
            {/* 足もとの影 */}
            <span
              className={`absolute left-1/2 block rounded-[50%] bg-[rgba(70,60,30,.28)] ${coin.state === "taken" ? "opacity-0 transition-opacity duration-300" : "home-coin-shadow"}`}
              style={{ width: "90%", height: "22%", bottom: "-8%", marginLeft: "-45%" }}
            />
            <button
              type="button"
              aria-label={coin.kind === "blue" ? "青コインを拾う" : "コインを拾う"}
              disabled={coin.state === "taken"}
              onClick={() => collectRef.current(coin.id)}
              className={`pointer-events-auto relative block w-full ${coin.state === "falling" ? "home-coin-fall" : coin.state === "ground" ? "home-coin-ground" : "home-coin-take"}`}
              style={{ ["--fall" as string]: `${coin.fallPx}px`, aspectRatio: "1", touchAction: "manipulation" }}
            >
              <span className="home-coin-spin block h-full w-full" style={{ filter: coin.kind === "blue" ? "drop-shadow(0 0 3px rgba(90,160,255,.8))" : "drop-shadow(0 0 2px rgba(255,210,90,.7))" }}>
                <Art className="h-full w-full" />
              </span>
              <span className="home-coin-glint absolute -right-[18%] -top-[18%] block h-[46%] w-[46%] text-white" aria-hidden="true">
                <svg viewBox="0 0 10 10" className="h-full w-full"><path d="M5 0 6 4 10 5 6 6 5 10 4 6 0 5 4 4Z" fill="currentColor" /></svg>
              </span>
            </button>
            {coin.label ? (
              <span
                className="home-coin-label pointer-events-none absolute bottom-full left-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 font-black leading-none text-white"
                style={{
                  fontSize: "clamp(8px, 2.6vw, 12px)",
                  background: coin.kind === "blue" ? "rgba(46,110,200,.9)" : "rgba(214,150,40,.92)",
                  boxShadow: "0 2px 6px rgba(60,40,10,.25)",
                }}
              >
                {coin.label}
              </span>
            ) : null}
          </div>
        );
      })}

      {/* 移動 */}
      <div
        ref={moverRef}
        aria-hidden="true"
        className={`absolute transition-[left,bottom,transform] ease-linear ${
          walker.walking ? "frenchie-walking" : ""
        }`}
        style={{
          width: `${DOG_WIDTH}%`,
          left: `${walker.x}%`,
          // 絵の芝は下から 44% までなので、奥へ行っても地平線を越えないところで止める
          bottom: `${depthBottom(walker.depth)}%`,
          transitionDuration: `${walker.travelMs || 420}ms`,
          transform: `translateX(-50%) scale(${depthScale(walker.depth)})`,
          transformOrigin: "50% 100%",
          zIndex: zOf(walker.depth),
        }}
      >
        {/* 反転 */}
        <div
          className="transition-transform ease-out"
          style={{
            transform: `scaleX(${walker.facing})`,
            transitionDuration: `${TURN_MS}ms`,
            // 夜と夕方は、景色に合わせて犬も少し暗く・あたたかい色に
            filter:
              hw?.phase === "night"
                ? "brightness(.8) saturate(.85)"
                : hw?.phase === "evening"
                  ? "sepia(.12) saturate(1.05)"
                  : undefined,
          }}
        >
          {/* 上下の揺れ */}
          <div ref={bobNode} className="frenchie-bob" style={walker.walking ? { animationDuration: `${walker.stepMs * 2}ms` } : undefined}>
            {/* 書くときに後ろ足で立ちあがる。ペンも一緒に持ちあがる */}
            <div className="frenchie-lift" style={{ transform: walker.pose === "write" ? `translateY(-${WRITE_LIFT}%)` : undefined }}>
            {/* 呼吸。歩きの揺れや仕草の動きと transform を奪い合わないよう層を分ける */}
            <div className="frenchie-breath relative">
              {/* 全ポーズを重ねて置き、表示だけ切り替える。切り替え時のちらつきを防ぐ */}
              {visibleKeys.map((key) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={key}
                  ref={(node) => {
                    poseNodes.current[key] = node;
                  }}
                  src={getFrenchieSrc(skin, POSE_FILES[key]!)}
                  alt=""
                  width={300}
                  height={254}
                  decoding="async"
                  loading={key === "stand" || key === "walk" ? "eager" : "lazy"}
                  fetchPriority={key === "stand" || key === "walk" ? "high" : "low"}
                  draggable={false}
                  className={`frenchie-pose ${GESTURE_CLASS[key] ? "frenchie-gesture" : ""} ${
                    key === "stand" ? "block" : "absolute inset-0"
                  } h-auto w-full select-none`}
                  style={{
                    opacity: key === activePose ? 1 : 0,
                    transform: POSE_NUDGE_X[key] ? `translateX(${POSE_NUDGE_X[key]}%)` : undefined,
                  }}
                />
              ))}
              {/* 魔法のペン。あげた前足でにぎらせ、ペン先を看板（左上）へ向ける。
                  ペンは犬の手前に出し、前足だけをペンの上に描きなおして「にぎっている」ように見せる */}
              {walker.pen ? (
                <>
                  <span
                    className="pointer-events-none absolute block"
                    style={{
                      left: `${paw[0] - PEN_SIZE * 0.528}%`,
                      top: `${paw[1] - ((PEN_SIZE * 300) / 254) * 0.621}%`,
                      width: `${PEN_SIZE}%`,
                      aspectRatio: "1",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={PEN_SRC} alt="" draggable={false} className="frenchie-pen block h-full w-full select-none" />
                    {[
                      ["-70%", "-50%", "14%", "-10%"],
                      ["-30%", "-90%", "26%", "-14%"],
                      ["-90%", "0%", "8%", "2%"],
                    ].map(([sx, sy, left, top], i) => (
                      <span
                        key={i}
                        className="frenchie-pen-spark absolute block h-[20%] w-[20%] rounded-full"
                        style={{
                          left,
                          top,
                          background: "radial-gradient(circle, #fff 0 30%, #9fd0ff 55%, transparent 72%)",
                          animationDelay: `${PEN_OUT_MS + i * 230}ms`,
                          ["--sx" as string]: sx,
                          ["--sy" as string]: sy,
                        }}
                      />
                    ))}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getFrenchieSrc(skin, POSE_FILES.write!)}
                    alt=""
                    draggable={false}
                    className="frenchie-gesture frenchie-m-write pointer-events-none absolute inset-0 h-auto w-full select-none"
                    style={{ clipPath: `circle(${PAW_RADIUS}% at ${paw[0]}% ${paw[1]}%)` }}
                  />
                </>
              ) : null}
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
