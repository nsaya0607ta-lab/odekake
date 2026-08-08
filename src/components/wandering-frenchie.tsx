"use client";

import { useEffect, useState } from "react";

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

const POSES = {
  stand: "/characters/frenchie/stand.webp",
  walk: "/characters/frenchie/walk.webp",
  sit: "/characters/frenchie/sit.webp",
  sniff: "/characters/frenchie/sniff.webp",
  happy: "/characters/frenchie/stand-happy.webp",
  shake: "/characters/frenchie/shake.webp",
  sleep: "/characters/frenchie/sleep.webp",
  wink: "/characters/frenchie/wink.webp",
  wave: "/characters/frenchie/wave.webp",
  camera: "/characters/frenchie/camera.webp",
  bow: "/characters/frenchie/bow.webp",
  cheer: "/characters/frenchie/cheer.webp",
  smile: "/characters/frenchie/smile.webp",
  dig: "/characters/frenchie/dig.webp",
  treat: "/characters/frenchie/treat.webp",
  roll: "/characters/frenchie/roll.webp",
  drink: "/characters/frenchie/drink.webp",
  doze: "/characters/frenchie/doze.webp",
  yawn: "/characters/frenchie/yawn.webp",
  lieWave: "/characters/frenchie/lie-wave.webp",
} as const;

type Pose = keyof typeof POSES;
const POSE_KEYS = Object.keys(POSES) as Pose[];

/** 立ち止まったときの仕草と、その長さ（ms） */
type Rest = { pose: Pose; min: number; max: number; requiredLevel?: number };

const RESTS: readonly Rest[] = [
  { pose: "stand", min: 900, max: 1800 },
  { pose: "sniff", min: 1600, max: 2600 },
  { pose: "sit", min: 2200, max: 4000 },
  { pose: "happy", min: 1400, max: 2400 },
  { pose: "shake", min: 1100, max: 1700 },
  { pose: "sleep", min: 3600, max: 6000 },
  { pose: "wink", min: 1000, max: 1700, requiredLevel: 2 },
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
 * バンド幅に対する移動速度（%/秒）。1歩ぶんの絵の踏み出し幅と
 * STEP_MS × 2 で進む距離が釣り合うように決めてある。ここを崩すと
 * 足だけ動いて進まない／氷の上を滑る、のどちらかになる。
 */
const SPEED = 7.5;
/** 立ち姿と踏み出しを入れ替える間隔（ms） */
const STEP_MS = 340;
/** 振り向きにかける時間（ms）。止まっている間に終わる */
const TURN_MS = 260;

/** 右側のレベル札へ犬が入らないよう、中心座標を左〜中央に限定する。 */
const MIN_X = 18;
const MAX_X = 31;

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

export function WanderingFrenchie({ level = 1 }: { level?: number }) {
  const availablePoseKeys = POSE_KEYS.filter((pose) => (REQUIRED_LEVEL_BY_POSE.get(pose) ?? 1) <= level);
  const [walker, setWalker] = useState<Walker>({
    x: 26,
    depth: 0.45,
    facing: 1,
    pose: "stand",
    walking: false,
    travelMs: 0,
  });
  const [stepUp, setStepUp] = useState(false);

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
    const id = setInterval(() => setStepUp((v) => !v), STEP_MS);
    return () => clearInterval(id);
  }, [walker.walking]);

  const activePose: Pose = walker.walking ? (stepUp ? "walk" : "stand") : walker.pose;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes frenchie-bob {
          0%, 100% { transform: translateY(0) rotate(-0.7deg); }
          50%      { transform: translateY(-3px) rotate(0.7deg); }
        }
        .frenchie-bob { transform-origin: 50% 92%; }
        .frenchie-walking .frenchie-bob {
          animation: frenchie-bob ${STEP_MS * 2}ms ease-in-out infinite;
        }
        /* 仕草の切り替えはふわっと。歩行のコマ送りは瞬時でないと足がぼやける */
        .frenchie-pose { transition: opacity 200ms ease; }
        .frenchie-walking .frenchie-pose { transition: none; }
        @media (prefers-reduced-motion: reduce) {
          .frenchie-walking .frenchie-bob { animation: none; }
          .frenchie-pose { transition: none; }
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
          <div className="frenchie-bob relative">
            {/* 全ポーズを重ねて置き、表示だけ切り替える。切り替え時のちらつきを防ぐ */}
            {availablePoseKeys.map((pose) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={pose}
                src={POSES[pose]}
                alt=""
                width={300}
                height={254}
                decoding="async"
                fetchPriority={pose === "stand" || pose === "walk" ? "high" : "low"}
                draggable={false}
                className={`frenchie-pose ${
                  pose === "stand" ? "block" : "absolute inset-0"
                } h-auto w-full select-none`}
                style={{ opacity: pose === activePose ? 1 : 0 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
