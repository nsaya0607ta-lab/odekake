"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  claimProgressMilestone,
  daypartAt,
  FRENCHIE_FRAME,
  frenchieSrc,
  MOODS,
  posesForMood,
  type Daypart,
  type FrenchiePose,
  type Progress,
} from "@/lib/frenchie";

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

const TURN_MS = 260;
const REACT_MS = 1600;
const CHEER_MS = 2400;
const MIN_X = 11;
const MAX_X = 89;
/** 時間帯をまたいだことに気づくための見張り */
const DAYPART_POLL_MS = 5 * 60 * 1000;

type Walker = {
  x: number;
  /** 0 = 手前で大きい、1 = 奥で小さい */
  depth: number;
  /** 1 = 左向き（素材のまま）、-1 = 右向き */
  facing: 1 | -1;
  pose: FrenchiePose;
  walking: boolean;
  travelMs: number;
};

const INITIAL: Walker = {
  x: 26,
  depth: 0.45,
  facing: 1,
  pose: "stand",
  walking: false,
  travelMs: 0,
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;

export function WanderingFrenchie({ progress }: { progress?: Progress }) {
  const [daypart, setDaypart] = useState<Daypart | null>(null);
  const [walker, setWalker] = useState<Walker>(INITIAL);
  const [stepUp, setStepUp] = useState(false);
  const [nudged, setNudged] = useState(false);
  const pokeRef = useRef<(() => void) | null>(null);
  const cheerRef = useRef(false);

  // 時間帯はブラウザの時計で決まるので、描画が合うようマウント後に読む
  useEffect(() => {
    const read = () => setDaypart(daypartAt(new Date().getHours()));
    read();
    const id = setInterval(read, DAYPART_POLL_MS);
    return () => clearInterval(id);
  }, []);

  // 前回見たときより記録が増えていたら、最初にひと喜びする
  useEffect(() => {
    if (progress) cheerRef.current = claimProgressMilestone(progress);
  }, [progress]);

  // なでられたとき用の絵は、ページが落ち着いてから静かに足す
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback;
    if (idle) {
      const id = idle(() => setWarm(true), { timeout: 4000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(() => setWarm(true), 2500);
    return () => clearTimeout(id);
  }, []);

  const mood = daypart ? MOODS[daypart] : null;
  const poses = useMemo(
    () => (mood ? posesForMood(mood, warm) : (["stand", "walk"] as FrenchiePose[])),
    [mood, warm],
  );

  useEffect(() => {
    if (!mood) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // 動かさない。時間帯に合った姿でそこに居るだけにする
      setWalker((w) => ({ ...w, pose: mood.rests[0]?.pose ?? "stand", walking: false }));
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest: Walker = INITIAL;

    const wait = (ms: number, fn: () => void) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const settle = (next: Walker) => {
      latest = next;
      setWalker(next);
    };

    /** 休憩が明けるたび、歩き出すかその場に留まるかを決める */
    const beat = () => {
      if (Math.random() < mood.walkChance) startWalk();
      else rest();
    };

    const rest = () => {
      const { pose, min, max } = pick(mood.rests);
      settle({ ...latest, pose, walking: false, travelMs: 0 });
      wait(rand(min, max), beat);
    };

    const startWalk = () => {
      // ちょこっと動いて止まる、を避けてある程度の距離を歩かせる
      let target = rand(MIN_X, MAX_X);
      if (Math.abs(target - latest.x) < 24) {
        target = latest.x < (MIN_X + MAX_X) / 2 ? rand(62, MAX_X) : rand(MIN_X, 38);
      }
      const facing: 1 | -1 = target > latest.x ? -1 : 1;
      const turning = facing !== latest.facing;

      // 振り向きは止まったまま済ませる
      settle({ ...latest, facing, pose: "stand", walking: false, travelMs: 0 });

      wait(turning ? TURN_MS : 80, () => {
        const travelMs = (Math.abs(target - latest.x) / mood.speed) * 1000;
        settle({
          ...latest,
          x: target,
          depth: Math.min(1, Math.max(0, latest.depth + rand(-0.35, 0.35))),
          pose: "walk",
          walking: true,
          travelMs,
        });
        wait(travelMs, rest);
      });
    };

    /** なでられたとき、記録が増えたとき */
    const react = (pose: FrenchiePose, hold: number) => {
      settle({ ...latest, pose, walking: false, travelMs: 0 });
      wait(hold, beat);
    };

    pokeRef.current = () => react(pick(mood.reactions), REACT_MS);

    if (cheerRef.current) {
      cheerRef.current = false;
      react("cheer", CHEER_MS);
    } else {
      wait(700, beat);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      pokeRef.current = null;
    };
  }, [mood]);

  // 歩いている間だけ、立ち姿と踏み出しを入れ替える
  useEffect(() => {
    if (!walker.walking || !mood) {
      setStepUp(false);
      return;
    }
    const id = setInterval(() => setStepUp((v) => !v), mood.stepMs);
    return () => clearInterval(id);
  }, [walker.walking, mood]);

  const onPoke = useCallback(() => {
    setNudged(true);
    window.setTimeout(() => setNudged(false), 320);
    pokeRef.current?.();
  }, []);

  const activePose: FrenchiePose = walker.walking ? (stepUp ? "walk" : "stand") : walker.pose;
  const stepMs = mood?.stepMs ?? 340;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes frenchie-bob {
          0%, 100% { transform: translateY(0) rotate(-0.7deg); }
          50%      { transform: translateY(-3px) rotate(0.7deg); }
        }
        @keyframes frenchie-nudge {
          0%   { transform: scale(1) translateY(0); }
          40%  { transform: scale(1.08) translateY(-5px); }
          100% { transform: scale(1) translateY(0); }
        }
        .frenchie-bob { transform-origin: 50% 92%; }
        .frenchie-walking .frenchie-bob { animation: frenchie-bob ${stepMs * 2}ms ease-in-out infinite; }
        .frenchie-nudged .frenchie-bob { animation: frenchie-nudge 320ms ease-out; }
        /* 仕草の切り替えはふわっと。歩行のコマ送りは瞬時でないと足がぼやける */
        .frenchie-pose { transition: opacity 200ms ease; }
        .frenchie-walking .frenchie-pose { transition: none; }
        @media (prefers-reduced-motion: reduce) {
          .frenchie-bob { animation: none !important; }
          .frenchie-pose { transition: none; }
        }
      `}</style>

      {/* 移動 */}
      <div
        className={`absolute w-[138px] transition-[left,bottom,transform] ease-linear ${
          walker.walking ? "frenchie-walking" : ""
        } ${nudged ? "frenchie-nudged" : ""}`}
        style={{
          left: `${walker.x}%`,
          bottom: `${4 + walker.depth * 15}%`,
          transitionDuration: `${walker.travelMs || 420}ms`,
          transform: `translateX(-50%) scale(${1 - walker.depth * 0.16})`,
          transformOrigin: "50% 100%",
        }}
      >
        <button
          type="button"
          onClick={onPoke}
          aria-label="フレブルをなでる"
          className="pointer-events-auto block w-full cursor-pointer appearance-none border-0 bg-transparent p-0"
        >
          {/* 反転 */}
          <span
            className="block transition-transform ease-out"
            style={{ transform: `scaleX(${walker.facing})`, transitionDuration: `${TURN_MS}ms` }}
          >
            {/* 上下の揺れ */}
            <span className="frenchie-bob relative block">
              {/* 使う絵は重ねて置き、表示だけ切り替える。切り替えのたびに読み込みが
                  走ってちらつくのを防ぐため */}
              {poses.map((pose) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={pose}
                  src={frenchieSrc(pose)}
                  alt=""
                  width={FRENCHIE_FRAME.width}
                  height={FRENCHIE_FRAME.height}
                  decoding="async"
                  fetchPriority={pose === "stand" || pose === "walk" ? "high" : "low"}
                  draggable={false}
                  className={`frenchie-pose ${
                    pose === "stand" ? "block" : "absolute inset-0"
                  } h-auto w-full select-none`}
                  style={{ opacity: pose === activePose ? 1 : 0 }}
                />
              ))}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
