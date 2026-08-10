"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

const GESTURE_POSES: Partial<Record<Pose, string>> = { wink: "frenchie-wink" };
const POSE_NUDGE_PX: Partial<Record<Pose, number>> = { walk: 6, happy: 6 };

const WINK_MS = 1000;
const SPEED = 6;
const STEP_MS = 420;
const TURN_MS = 520;
const MIN_X = 18;
const MAX_X = 45;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;

const crispImageCache = new Map<string, string>();
const crispImagePending = new Map<string, Promise<string>>();

/**
 * 表示前に犬画像の透過フチを完全に作り直す。
 * 半透明の霞を捨て、外周を1pxだけ内側へ詰め、透明画素のRGBも0にする。
 */
function makeCrispImage(src: string): Promise<string> {
  const cached = crispImageCache.get(src);
  if (cached) return Promise.resolve(cached);
  const pending = crispImagePending.get(src);
  if (pending) return pending;

  const promise = new Promise<string>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        resolve(src);
        return;
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0);
      const frame = context.getImageData(0, 0, width, height);
      const pixels = frame.data;
      const hardMask = new Uint8Array(width * height);

      for (let i = 0; i < hardMask.length; i += 1) {
        hardMask[i] = pixels[i * 4 + 3]! >= 224 ? 1 : 0;
      }

      const trimmed = new Uint8Array(hardMask.length);
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = y * width + x;
          if (
            hardMask[i] &&
            hardMask[i - 1] &&
            hardMask[i + 1] &&
            hardMask[i - width] &&
            hardMask[i + width]
          ) {
            trimmed[i] = 1;
          }
        }
      }

      for (let i = 0; i < trimmed.length; i += 1) {
        const p = i * 4;
        if (trimmed[i]) {
          pixels[p + 3] = 255;
        } else {
          pixels[p] = 0;
          pixels[p + 1] = 0;
          pixels[p + 2] = 0;
          pixels[p + 3] = 0;
        }
      }

      context.putImageData(frame, 0, 0);
      const result = canvas.toDataURL("image/png");
      crispImageCache.set(src, result);
      crispImagePending.delete(src);
      resolve(result);
    };
    image.onerror = () => {
      crispImagePending.delete(src);
      resolve(src);
    };
    image.src = src;
  });

  crispImagePending.set(src, promise);
  return promise;
}

type Walker = {
  x: number;
  depth: number;
  facing: 1 | -1;
  pose: Pose;
  walking: boolean;
  travelMs: number;
};

export function WanderingFrenchie({ level = 1 }: { level?: number }) {
  const availablePoseKeys = useMemo(
    () => POSE_KEYS.filter((pose) => (REQUIRED_LEVEL_BY_POSE.get(pose) ?? 1) <= level),
    [level],
  );
  const [crispSources, setCrispSources] = useState<Partial<Record<Pose, string>>>({});
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
  const bobNode = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      availablePoseKeys.map(async (pose) => [pose, await makeCrispImage(POSES[pose])] as const),
    ).then((entries) => {
      if (cancelled) return;
      setCrispSources((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
  }, [availablePoseKeys]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const availableRests = RESTS.filter((rest) => (rest.requiredLevel ?? 1) <= level);
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number, fn: () => void) => {
      timers.push(setTimeout(() => !cancelled && fn(), ms));
    };

    const rest = (from: Walker) => {
      const { pose, min, max } = pick(availableRests);
      setWalker({ ...from, pose, walking: false, travelMs: 0 });
      wait(rand(min, max), () => startWalk(from));
    };

    const startWalk = (from: Walker) => {
      let target = rand(MIN_X, MAX_X);
      if (Math.abs(target - from.x) < 7) {
        const middle = (MIN_X + MAX_X) / 2;
        target = from.x < middle ? rand(middle + 2, MAX_X) : rand(MIN_X, middle - 2);
      }
      const facing: 1 | -1 = target > from.x ? -1 : 1;
      const depth = Math.min(1, Math.max(0, from.depth + rand(-0.35, 0.35)));
      const travelMs = (Math.abs(target - from.x) / SPEED) * 1000;
      const turning = facing !== from.facing;
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
      for (const timer of timers) clearTimeout(timer);
    };
  }, [level]);

  useEffect(() => {
    if (!walker.walking) {
      setStepUp(false);
      return;
    }
    setStepUp(true);
    const id = setInterval(() => setStepUp((value) => !value), STEP_MS);
    return () => clearInterval(id);
  }, [walker.walking]);

  const activePose: Pose = walker.walking ? (stepUp ? "walk" : "stand") : walker.pose;

  useEffect(() => {
    const playClass = GESTURE_POSES[activePose];
    const node = poseNodes.current[activePose];
    if (!playClass || !node) return;
    node.classList.remove(playClass);
    void node.offsetWidth;
    node.classList.add(playClass);
  }, [activePose]);

  useEffect(() => {
    const node = bobNode.current;
    if (!node) return;
    node.classList.remove("frenchie-settle");
    if (walker.walking) return;
    void node.offsetWidth;
    node.classList.add("frenchie-settle");
  }, [walker.pose, walker.walking]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes frenchie-bob-crisp {
          0%, 100% { transform: translateY(0); }
          25%, 75% { transform: translateY(-2px); }
          50% { transform: translateY(1px); }
        }
        .frenchie-walking .frenchie-bob {
          animation: frenchie-bob-crisp ${STEP_MS * 2}ms steps(4, end) infinite;
        }

        @keyframes frenchie-breath-crisp {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
        .frenchie-breath {
          animation: frenchie-breath-crisp 3400ms steps(2, end) infinite;
        }
        .frenchie-walking .frenchie-breath { animation: none; }

        .frenchie-pose,
        .frenchie-gesture {
          transition: none !important;
          filter: none !important;
          -webkit-filter: none !important;
          box-shadow: none !important;
        }

        @keyframes frenchie-settle-crisp {
          0% { transform: translateY(3px); }
          50% { transform: translateY(-2px); }
          100% { transform: translateY(0); }
        }
        .frenchie-settle {
          animation: frenchie-settle-crisp 360ms steps(3, end) both;
        }

        @keyframes frenchie-wink-crisp {
          0%, 20%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
          70% { transform: translateY(-3px); }
        }
        .frenchie-wink {
          animation: frenchie-wink-crisp ${WINK_MS}ms steps(4, end) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .frenchie-walking .frenchie-bob,
          .frenchie-breath,
          .frenchie-settle,
          .frenchie-wink { animation: none; }
        }
      `}</style>

      <div
        className={`absolute w-[100px] transition-[left,bottom] ease-linear sm:w-[112px] ${
          walker.walking ? "frenchie-walking" : ""
        }`}
        style={{
          left: `${walker.x}%`,
          bottom: `${4 + walker.depth * 15}%`,
          transitionDuration: `${walker.travelMs || 420}ms`,
          transform: "translateX(-50%)",
        }}
      >
        <div style={{ transform: `scaleX(${walker.facing})` }}>
          <div ref={bobNode} className="frenchie-bob">
            <div className="frenchie-breath relative">
              {availablePoseKeys.map((pose) => {
                const src = crispSources[pose];
                if (!src) return null;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={pose}
                    ref={(node: HTMLImageElement | null) => {
                      poseNodes.current[pose] = node;
                    }}
                    src={src}
                    alt=""
                    width={300}
                    height={254}
                    draggable={false}
                    className={`frenchie-pose ${GESTURE_POSES[pose] ? "frenchie-gesture" : ""} ${
                      pose === "stand" ? "block" : "absolute inset-0"
                    } h-auto w-full select-none`}
                    style={{
                      opacity: pose === activePose ? 1 : 0,
                      left: POSE_NUDGE_PX[pose] ? `${POSE_NUDGE_PX[pose]}px` : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
