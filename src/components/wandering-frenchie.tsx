"use client";

import { useEffect, useRef, useState } from "react";
import { getFrenchieSrc, type DogSkinId } from "@/lib/dog-skins";

/**
 * ホーム画面のバンドを歩き回るフレブル。
 *
 * 絵はイラストの差し替えで、移動は CSS に任せている。歩幅と進む速さを噛み合わせ
 * たいので、速度を固定して移動時間を距離から決める。向きの切り替えは立ち止まって
 * いる間にしか起こさないので、歩きながら裏返ることがない。
 *
 * 変形は要素ごとに分けてある（移動 / 反転 / 上下の揺れ）。ひとつの要素に重ねると
 * transition と animation が同じ transform を奪い合って壊れる。
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
};

/**
 * 絵の差し替えでは出せない「動き」を CSS で足す仕草と、その再生用クラス。
 *
 * 素材はどれも独立した1枚絵で、目だけ違う対の絵は無い。コマ送りで仕草を作ろうと
 * すると体ごと入れ替わって二重写しになるので、報酬モーションは1枚絵のまま
 * transform だけで動かしている。基本ポーズはこれまでどおり静止画。
 */
const GESTURE_CLASS: Record<string, string> = Object.fromEntries(
  MOTIONS.map((motion) => [motion.id, `frenchie-m-${motion.id}`]),
);

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
 */
const SPEED = 6;
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
 * 歩き回れる範囲（カード幅に対する％。犬の中心の位置）。
 *
 * 左半分はレベル・歩数の看板が占めているので、犬は空いている右側を歩く。犬の絵は
 * 118px 幅で中心合わせなので、右端いっぱいまで行かせるとカードから半身はみ出して
 * 切れる。左は看板に、右はカードの縁に、それぞれ被らないところで止めてある。
 */
const MIN_X = 60;
const MAX_X = 83;

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
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;

export function WanderingFrenchie({
  level = 1,
  skin = "default",
}: {
  level?: number;
  /** 表示する犬スキン。所持していないスキンを渡さないのは呼び出し側の責任 */
  skin?: DogSkinId;
}) {
  // 基本ポーズは常に、報酬モーションは解放済みのものだけ重ねて置く
  const visibleKeys: string[] = [
    ...POSE_KEYS,
    ...MOTIONS.filter((motion) => motion.level <= level).map((motion) => motion.id),
  ];
  const [walker, setWalker] = useState<Walker>({
    x: 70,
    depth: 0.45,
    facing: 1,
    pose: "stand",
    walking: false,
    travelMs: 0,
  });
  const [stepUp, setStepUp] = useState(false);
  const poseNodes = useRef<Record<string, HTMLImageElement | null>>({});
  const bobNode = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const availableRests = ALL_RESTS.filter((rest) => (rest.requiredLevel ?? 1) <= level);

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number, fn: () => void) => {
      timers.push(
        setTimeout(() => {
          if (!cancelled) fn();
        }, ms),
      );
    };

    const rest = (from: Walker) => {
      const { pose, min, max } = pick(availableRests);
      setWalker({ ...from, pose, walking: false, travelMs: 0 });
      wait(rand(min, max), () => startWalk(from));
    };

    const startWalk = (from: Walker) => {
      // ちょこっと動いて止まる、を避けてある程度の距離を歩かせる
      let target = rand(MIN_X, MAX_X);
      if (Math.abs(target - from.x) < 7) {
        const middle = (MIN_X + MAX_X) / 2;
        target = from.x < middle ? rand(middle + 2, MAX_X) : rand(MIN_X, middle - 2);
      }
      const facing: 1 | -1 = target > from.x ? -1 : 1;
      const depth = Math.min(1, Math.max(0, from.depth + rand(-0.35, 0.35)));
      const travelMs = (Math.abs(target - from.x) / SPEED) * 1000;
      const turning = facing !== from.facing;

      // 振り向きは止まったまま済ませる
      setWalker((current) => ({ ...current, facing, pose: "stand", walking: false }));

      wait(turning ? TURN_MS : 80, () => {
        const next: Walker = { x: target, depth, facing, pose: "walk", walking: true, travelMs };
        setWalker(next);
        wait(travelMs, () => rest(next));
      });
    };

    wait(700, () =>
      startWalk({ x: 70, depth: 0.45, facing: 1, pose: "stand", walking: false, travelMs: 0 }),
    );

    return () => {
      cancelled = true;
      for (const id of timers) clearTimeout(id);
    };
  }, [level]);

  // 歩いている間だけ、立ち姿と踏み出しを入れ替える
  useEffect(() => {
    if (!walker.walking) {
      setStepUp(false);
      return;
    }
    // 歩き出しは踏み出しの絵から。ここを立ち姿のまま始めると、最初の1歩ぶん
    // （STEP_MS）だけ足を止めたまま横に滑る
    setStepUp(true);
    const id = setInterval(() => setStepUp((v) => !v), STEP_MS);
    return () => clearInterval(id);
  }, [walker.walking]);

  const activePose: string = walker.walking ? (stepUp ? "walk" : "stand") : walker.pose;

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
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
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

        @media (prefers-reduced-motion: reduce) {
          .frenchie-walking .frenchie-bob { animation: none; }
          .frenchie-breath { animation: none; }
          .frenchie-settle { animation: none; }
          .frenchie-pose { transition: none; }
          .frenchie-gesture[class*="frenchie-m-"] { animation: none; }
        }
      `}</style>

      {/* 移動 */}
      <div
        className={`absolute w-[118px] transition-[left,bottom,transform] ease-linear sm:w-[132px] ${
          walker.walking ? "frenchie-walking" : ""
        }`}
        style={{
          left: `${walker.x}%`,
          bottom: `${4 + walker.depth * 15}%`,
          transitionDuration: `${walker.travelMs || 420}ms`,
          transform: `translateX(-50%) scale(${1 - walker.depth * 0.16})`,
          transformOrigin: "50% 100%",
        }}
      >
        {/* 反転 */}
        <div
          className="transition-transform ease-out"
          style={{ transform: `scaleX(${walker.facing})`, transitionDuration: `${TURN_MS}ms` }}
        >
          {/* 上下の揺れ */}
          <div ref={bobNode} className="frenchie-bob">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
