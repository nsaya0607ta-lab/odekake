"use client";

import { useEffect, useRef, useState } from "react";

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
 * 見た目の切り替え（スキン）。動きには一切関わらない。
 *
 * 素材は 1ポーズ 1枚で、どのスキンも同じ20ポーズを同じファイル名で持つ。
 * 通常版と夏版はキャンバス（300x254）も足元の高さも水平中心も揃えてあるので、
 * 差し替えても犬の立ち位置は動かない。
 */
export type FrenchieSkin = "normal" | "summer";

/** ポーズ名 → 素材のファイル名（スキンをまたいで共通） */
const POSE_FILES = {
  stand: "stand",
  walk: "walk",
  sit: "sit",
  sniff: "sniff",
  happy: "stand-happy",
  shake: "shake",
  sleep: "sleep",
  wink: "wink",
  wave: "wave",
  camera: "camera",
  bow: "bow",
  cheer: "cheer",
  smile: "smile",
  dig: "dig",
  treat: "treat",
  roll: "roll",
  drink: "drink",
  doze: "doze",
  yawn: "yawn",
  lieWave: "lie-wave",
} as const;

type Pose = keyof typeof POSE_FILES;
const POSE_KEYS = Object.keys(POSE_FILES) as Pose[];

const poseSrc = (skin: FrenchieSkin, pose: Pose) => `/characters/frenchie/${skin}/${POSE_FILES[pose]}.webp`;

/** 立ち止まったときの仕草と、その長さ（ms） */
type Rest = { pose: Pose; min: number; max: number; requiredLevel?: number };

const RESTS: readonly Rest[] = [
  { pose: "stand", min: 900, max: 1800 },
  { pose: "sniff", min: 1600, max: 2600 },
  { pose: "sit", min: 2200, max: 4000 },
  { pose: "happy", min: 1400, max: 2400 },
  { pose: "shake", min: 1100, max: 1700 },
  { pose: "sleep", min: 3600, max: 6000 },
  { pose: "wink", min: 1150, max: 1800, requiredLevel: 2 },
  { pose: "wave", min: 1300, max: 2200, requiredLevel: 3 },
  { pose: "camera", min: 1400, max: 2200, requiredLevel: 5 },
  { pose: "bow", min: 1500, max: 2300, requiredLevel: 7 },
  { pose: "cheer", min: 1300, max: 2100, requiredLevel: 10 },
  { pose: "smile", min: 1400, max: 2300, requiredLevel: 12 },
  { pose: "dig", min: 1600, max: 2500, requiredLevel: 14 },
  { pose: "treat", min: 1500, max: 2400, requiredLevel: 16 },
  { pose: "roll", min: 1800, max: 2900, requiredLevel: 19 },
  { pose: "drink", min: 1800, max: 2800, requiredLevel: 20 },
  { pose: "doze", min: 2600, max: 4200, requiredLevel: 22 },
  { pose: "yawn", min: 1400, max: 2200, requiredLevel: 24 },
  { pose: "lieWave", min: 1900, max: 3000, requiredLevel: 26 },
];

const REQUIRED_LEVEL_BY_POSE = new Map(
  RESTS.filter((rest) => rest.requiredLevel !== undefined).map((rest) => [rest.pose, rest.requiredLevel!]),
);

/**
 * 絵の差し替えでは出せない「動き」を CSS で足す仕草と、その再生用クラス。
 *
 * 素材はどれも独立した1枚絵で、目だけ違う対の絵は無い。コマ送りで瞬きを作ろうと
 * すると体ごと入れ替わって二重写しになるので、ウインクは1枚絵のまま動かしている。
 * ここに載っていない仕草はこれまでどおり静止画。
 */
const GESTURE_POSES: Partial<Record<Pose, string>> = {
  wink: "frenchie-wink",
};

/**
 * 素材ごとの描き位置のずれを打ち消す量（絵の幅に対する %）。
 *
 * 通常版の walk.webp は胴体が stand.webp より 17px（300px 幅の 5.7%）左に描かれている。
 * 上半身で重ねると差分が 0.106 → 0.035 まで落ちるので、絵柄の違いではなく
 * キャンバス上の位置ずれ。そのまま入れ替えると 1歩ごとに犬全体が横に飛ぶので、
 * 立ち姿を基準に踏み出しの絵を寄せて胴体を留める。前進ぶんは CSS の移動が持つ。
 * 足元（下端）は全ポーズ揃っているので縦は触らない。
 *
 * ずれ幅は絵ごとの事情なのでスキンごとに持つ。夏版の値も同じ測り方
 * （上半身を横にずらして重ね、差分が最小になる量）で出してある。
 */
const POSE_NUDGE_X: Record<FrenchieSkin, Partial<Record<Pose, number>>> = {
  normal: {
    walk: 5.7,
    // stand-happy.webp も同じ 17px ずれ（横の描画範囲が walk と一致する）
    happy: 5.7,
  },
  summer: {
    walk: 3.3, // 胴体が立ち姿より 10px 左
    happy: -7.0, // 上げた前足のぶん、こちらは 21px 右
  },
};

/** ウインクの動きの長さ（ms）。RESTS の最短より短くして必ず出し切る */
const WINK_MS = 1000;

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

/** 小さくなった右側のレベル看板を避けつつ、空いた中央右寄りまで歩かせる。 */
const MIN_X = 18;
const MAX_X = 45;

type Walker = {
  x: number;
  /** 0 = 手前で大きい、1 = 奥で小さい */
  depth: number;
  /** 1 = 左向き（素材のまま）、-1 = 右向き */
  facing: 1 | -1;
  pose: Pose;
  walking: boolean;
  travelMs: number;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;

export function WanderingFrenchie({ level = 1, skin = "normal" }: { level?: number; skin?: FrenchieSkin }) {
  const availablePoseKeys = POSE_KEYS.filter((pose) => (REQUIRED_LEVEL_BY_POSE.get(pose) ?? 1) <= level);
  const nudgeX = POSE_NUDGE_X[skin];
  const [walker, setWalker] = useState<Walker>({
    x: 26,
    depth: 0.45,
    facing: 1,
    pose: "stand",
    walking: false,
    travelMs: 0,
  });
  const [stepUp, setStepUp] = useState(false);
  const poseNodes = useRef<Partial<Record<Pose, HTMLImageElement | null>>>({});
  const bobNode = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const availableRests = RESTS.filter((rest) => (rest.requiredLevel ?? 1) <= level);

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
      startWalk({ x: 26, depth: 0.45, facing: 1, pose: "stand", walking: false, travelMs: 0 }),
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

  const activePose: Pose = walker.walking ? (stepUp ? "walk" : "stand") : walker.pose;

  // 動きのある仕草は、その仕草に切り替わるたびに頭から再生し直す
  useEffect(() => {
    const playClass = GESTURE_POSES[activePose];
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

        /* ウインク：ためて、顔を寄せながら跳ね、もう一度小さく弾んで戻る。
           入りがゆっくりだと前の絵と重なって二重写しになるので短く切り替える */
        .frenchie-gesture { transition: opacity 90ms ease; }
        @keyframes frenchie-wink {
          0%, 10%  { transform: translateY(0)    rotate(0deg)    scale(1, 1); }
          20%      { transform: translateY(2px)  rotate(0deg)    scale(1.05, 0.94); }
          36%      { transform: translateY(-7px) rotate(-6deg)   scale(0.97, 1.05); }
          52%      { transform: translateY(0)    rotate(-3.5deg) scale(1, 1); }
          66%      { transform: translateY(-4px) rotate(-5.5deg) scale(0.99, 1.02); }
          80%      { transform: translateY(0)    rotate(-2.5deg) scale(1, 1); }
          100%     { transform: translateY(0)    rotate(0deg)    scale(1, 1); }
        }
        .frenchie-wink {
          transform-origin: 50% 92%;
          animation: frenchie-wink ${WINK_MS}ms cubic-bezier(0.34, 1.2, 0.5, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .frenchie-walking .frenchie-bob { animation: none; }
          .frenchie-breath { animation: none; }
          .frenchie-settle { animation: none; }
          .frenchie-pose { transition: none; }
          .frenchie-wink { animation: none; }
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
              {availablePoseKeys.map((pose) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={pose}
                  ref={(node) => {
                    poseNodes.current[pose] = node;
                  }}
                  src={poseSrc(skin, pose)}
                  alt=""
                  width={300}
                  height={254}
                  decoding="async"
                  fetchPriority={pose === "stand" || pose === "walk" ? "high" : "low"}
                  draggable={false}
                  className={`frenchie-pose ${GESTURE_POSES[pose] ? "frenchie-gesture" : ""} ${
                    pose === "stand" ? "block" : "absolute inset-0"
                  } h-auto w-full select-none`}
                  style={{
                    opacity: pose === activePose ? 1 : 0,
                    transform: nudgeX[pose] ? `translateX(${nudgeX[pose]}%)` : undefined,
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
