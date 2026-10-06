"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import type { GachaRarity } from "@/lib/gacha/config";
import { lockPageScroll } from "@/lib/scroll-lock";
import { BACKGROUND_ART, MACHINE_ART, MACHINE_LAYOUT, capsuleSrc, preloadImages } from "./art";
import { playGachaCue, setGachaAudioPlaybackRate } from "./audio";
import { CapsuleArt } from "./capsule-art";
import { GachaMachine, type LampTell, type MachineApi } from "./gacha-machine";
import styles from "./gacha-cinematic.module.css";
import type { AnimationDraw, DrawResult } from "./types";

type BurstIntensity = "small" | "normal" | "large" | "mega";
type Point = { x: number; y: number };
type Gsap = typeof import("gsap")["gsap"];
type GsapTimeline = ReturnType<Gsap["timeline"]>;
type GachaPromotion = NonNullable<AnimationDraw["promotion"]>;
type PlaybackRate = 1 | 2 | 3;

type ParticleHandle = {
  burst: (rarity: GachaRarity, intensity?: BurstIntensity, at?: Point) => void;
};

const ROUND_SIZE = 10;
/** 受け皿から開けるカプセルの演出は、速めに流す */
const TRAY_SCENE_TIME_SCALE = 1.5;

const RANK: Record<GachaRarity, number> = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4, LR: 5, MR: 6 };
/** SSR以上は、ひとつずつ大きく開ける。N〜SRは受け皿の上でその場で開ける */
const SCENE_RANK = RANK.SSR;
/** ガチャを回したときのランプの予告。段がすすむほど良いものが出る */
const TELL_STEPS: Record<GachaRarity, LampTell[]> = {
  N: ["white"],
  R: ["white"],
  SR: ["white", "gold"],
  SSR: ["white", "gold", "rainbow"],
  UR: ["white", "gold", "rainbow", "red"],
  LR: ["white", "gold", "rainbow", "lr"],
  // MRは、ふつうのカプセルのふりをして出てくる（開けるときに化ける）。ランプの最後だけ一瞬ゆらぐ
  MR: ["white"],
};
const BLACKOUT: Record<GachaRarity, number> = { N: 0.42, R: 0.46, SR: 0.52, SSR: 0.48, UR: 0.64, LR: 0.92, MR: 0.74 };

function validRarity(rarity: string): GachaRarity {
  return (["N", "R", "SR", "SSR", "UR", "LR", "MR"] as const).includes(rarity as GachaRarity) ? (rarity as GachaRarity) : "N";
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

const centerOf = (element: Element): Point => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const vibrate = (pattern: number | number[]) => {
  if (navigator.vibrate) navigator.vibrate(pattern);
};

const imageUrl = (src: string) => `url(${JSON.stringify(src)})`;

/** モーダル表示中は、うしろのページがスクロールしないようにする（くわしくは scroll-lock.ts） */
function useBodyScrollLock() {
  useEffect(() => lockPageScroll(), []);
}

/** 演出のあいだは、キーボードのフォーカスを演出の中だけで回す */
function useModalFocus(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")).filter((button) => button.offsetParent !== null);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) {
        event.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", trap);
    return () => {
      root.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [rootRef]);
}

function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);
}

/** 「AUTO（タップを待たずに進める）」は、次に回すときも覚えておく */
const AUTO_KEY = "gacha-auto-open";
function readAutoPreference(): boolean {
  try {
    return window.localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}
function writeAutoPreference(value: boolean) {
  try {
    window.localStorage.setItem(AUTO_KEY, value ? "1" : "0");
  } catch {
    // 保存できない環境でも、この回の演出の中では効く
  }
}

function lowPowerDevice() {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return window.innerWidth < 520 || navigator.hardwareConcurrency <= 4 || (deviceMemory !== undefined && deviceMemory <= 4);
}

const PixiEffects = forwardRef<ParticleHandle, { enabled: boolean }>(function PixiEffects({ enabled }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<ParticleHandle["burst"]>(() => undefined);

  useImperativeHandle(ref, () => ({ burst: (rarity, intensity, at) => burstRef.current(rarity, intensity, at) }), []);

  useEffect(() => {
    if (!enabled || !hostRef.current) return;

    let cancelled = false;
    let cleanup = () => undefined;
    const host = hostRef.current;

    void Promise.all([import("pixi.js"), import("@pixi/particle-emitter")]).then(([PIXI, particles]) => {
      if (cancelled) return;

      const lowPower = lowPowerDevice();
      const app = new PIXI.Application<HTMLCanvasElement>({
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
        backgroundAlpha: 0,
        antialias: false,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, lowPower ? 1.15 : 1.5),
        powerPreference: "high-performance",
      });
      app.ticker.maxFPS = lowPower ? 45 : 60;
      app.view.setAttribute("aria-hidden", "true");
      host.appendChild(app.view);

      const dot = new PIXI.Graphics();
      dot.beginFill(0xffffff).drawCircle(9, 9, 9).endFill();
      const dotTexture = app.renderer.generateTexture(dot, { resolution: 1 });
      dot.destroy();

      const spark = new PIXI.Graphics();
      spark.beginFill(0xffffff);
      spark.moveTo(10, 0).lineTo(13, 7).lineTo(20, 10).lineTo(13, 13).lineTo(10, 20).lineTo(7, 13).lineTo(0, 10).lineTo(7, 7).closePath().endFill();
      const sparkTexture = app.renderer.generateTexture(spark, { resolution: 1 });
      spark.destroy();

      const activeEmitters = new Set<InstanceType<typeof particles.Emitter>>();
      const palettes: Record<GachaRarity, [string, string, string]> = {
        N: ["#fff3cf", "#ffffff", "#ffe7a8"],
        R: ["#71cbff", "#dff5ff", "#8c9dff"],
        SR: ["#ffd75e", "#fff4b8", "#ff9f43"],
        SSR: ["#ff4d6d", "#ffe15a", "#65ddff"],
        UR: ["#ff3131", "#ffbd59", "#fff2bb"],
        LR: ["#151515", "#d9a72f", "#fff0a0"],
        MR: ["#6f52ff", "#4dd7ff", "#ec6cff"],
      };

      const createEmitter = (
        texture: typeof dotTexture,
        colors: [string, string, string],
        count: number,
        speed: [number, number],
        scale: [number, number],
        lifetime: [number, number],
        pos: Point,
      ) => {
        const emitter = new particles.Emitter(app.stage, {
          lifetime: { min: lifetime[0], max: lifetime[1] },
          frequency: 0.001,
          emitterLifetime: 0.028,
          particlesPerWave: count,
          maxParticles: count,
          pos,
          emit: false,
          autoUpdate: true,
          behaviors: [
            { type: "alpha", config: { alpha: { list: [{ value: 1, time: 0 }, { value: 0.72, time: 0.55 }, { value: 0, time: 1 }] } } },
            { type: "scale", config: { scale: { list: [{ value: scale[0], time: 0 }, { value: scale[1], time: 1 }] }, minMult: 0.55 } },
            { type: "color", config: { color: { list: [{ value: colors[0], time: 0 }, { value: colors[1], time: 0.48 }, { value: colors[2], time: 1 }] } } },
            { type: "moveSpeed", config: { speed: { list: [{ value: speed[0], time: 0 }, { value: speed[1], time: 1 }] }, minMult: 0.56 } },
            { type: "rotationStatic", config: { min: 0, max: 360 } },
            { type: "spawnBurst", config: { spacing: 360 / count, start: 0, distance: 10 } },
            { type: "textureSingle", config: { texture } },
          ],
        });
        activeEmitters.add(emitter);
        emitter.playOnceAndDestroy(() => activeEmitters.delete(emitter));
      };

      burstRef.current = (rarity, intensity = "normal", at) => {
        const small = intensity === "small";
        const multiplier = intensity === "mega" ? 1.55 : intensity === "large" ? 1.2 : small ? 0.3 : 1;
        const cap = lowPower ? 92 : 176;
        const sparkCount = Math.max(8, Math.min(cap, Math.round((lowPower ? 48 : 86) * multiplier)));
        const smokeCount = Math.max(5, Math.min(lowPower ? 30 : 54, Math.round((lowPower ? 17 : 30) * multiplier)));
        const palette = palettes[rarity];
        const rect = host.getBoundingClientRect();
        const pos = at ? { x: at.x - rect.left, y: at.y - rect.top } : { x: app.screen.width / 2, y: app.screen.height * 0.47 };
        const reach = small ? 0.5 : 1;
        createEmitter(sparkTexture, palette, sparkCount, [(lowPower ? 360 : 450) * reach, 42], [small ? 0.42 : 0.62, 0.1], [0.58, 1.05], pos);
        createEmitter(dotTexture, [palette[2], palette[1], palette[0]], smokeCount, [(lowPower ? 210 : 270) * reach, 22], [small ? 0.7 : 1.3, small ? 1.6 : 3.8], [0.72, 1.28], pos);

        if (rarity === "SSR" && !small) {
          window.setTimeout(() => createEmitter(sparkTexture, ["#63e6be", "#74c0fc", "#e599f7"], Math.round(sparkCount * 0.72), [340, 28], [0.54, 0.08], [0.62, 1.1], pos), 90);
        }
      };

      const resize = () => app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);

      cleanup = () => {
        burstRef.current = () => undefined;
        resizeObserver.disconnect();
        activeEmitters.forEach((emitter) => emitter.destroy());
        activeEmitters.clear();
        dotTexture.destroy(true);
        sparkTexture.destroy(true);
        app.destroy(true, { children: true, texture: false, baseTexture: false });
      };
    }).catch(() => {
      burstRef.current = () => undefined;
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled]);

  return <div ref={hostRef} className={styles.particleHost} aria-hidden="true" />;
});

type HudProps = {
  eyebrow: string;
  phase: string;
  playbackRate: PlaybackRate;
  auto: boolean;
  skipLabel: string;
  onTogglePlaybackRate: () => void;
  onToggleAuto: () => void;
  onSkip: () => void;
  onSkipRound?: () => void;
};

function Hud({ eyebrow, phase, playbackRate, auto, skipLabel, onTogglePlaybackRate, onToggleAuto, onSkip, onSkipRound }: HudProps) {
  return (
    <>
      <div className={styles.hud}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <p className={styles.phase} aria-live="polite">{phase}</p>
        </div>
      </div>
      <div className={styles.hudLeft}>
        <button type="button" className={styles.speed} data-active={playbackRate > 1} onClick={onTogglePlaybackRate} aria-label={`演出速度 ${playbackRate}倍`} aria-pressed={playbackRate > 1}>
          <span>×{playbackRate}</span>
          <small>倍速</small>
        </button>
        <button type="button" className={styles.autoToggle} data-active={auto} onClick={onToggleAuto} aria-pressed={auto} aria-label={auto ? "オート（タップを待たずに進める）：オン" : "オート（タップを待たずに進める）：オフ"}>
          AUTO
        </button>
      </div>
      <button type="button" className={styles.skip} onClick={onSkip}>
        {skipLabel}
      </button>
      {onSkipRound ? (
        <button type="button" className={styles.skipRound} onClick={onSkipRound}>
          次の10連へ
        </button>
      ) : null}
    </>
  );
}

/** 画面いっぱいに入るひび（SR以上で開けるとき・MRが化けるとき） */
const SCREEN_CRACKS = [
  "M200 200 166 149 179 111 144 74",
  "M200 200 245 158 237 122 272 84 264 49",
  "M200 200 255 218 292 205 340 224 374 207",
  "M200 200 231 256 218 291 246 341 235 384",
  "M200 200 153 245 121 236 78 278 38 273",
  "M200 200 144 184 111 202 64 179 22 192",
];

/** マシンのゆれ（予告の段が多いほど大きく・長く） */
function shakeKeyframes(level: number, duration: number) {
  const amp = 3 + level * 2.6;
  const rot = 0.8 + level * 0.65;
  const count = Math.max(4, Math.round(duration / 0.085));
  const frames = Array.from({ length: count }, (_, index) => {
    const fade = 1 - index / count;
    const side = index % 2 ? 1 : -1;
    return { x: side * amp * fade, rotation: side * rot * fade, duration: duration / (count + 1) };
  });
  return [...frames, { x: 0, rotation: 0, duration: duration / (count + 1) }];
}

const PILE_CHURN = [
  { rotation: -3.2, y: -7 },
  { rotation: 2.6, y: 2 },
  { rotation: -2.2, y: -5 },
  { rotation: 1.6, y: 1 },
  { rotation: -0.8, y: -2 },
  { rotation: 0, y: 0 },
];

type SceneMode = "machine" | "tray";
type SceneInteraction = "turn" | "open" | "done" | null;

type SceneProps = {
  result: DrawResult;
  /** machine：ハンドルを回すところから（1回ガチャ）。tray：受け皿から選んだカプセルを開ける */
  mode: SceneMode;
  eyebrow: string;
  playbackRate: PlaybackRate;
  auto: boolean;
  onTogglePlaybackRate: () => void;
  onToggleAuto: () => void;
  onComplete: () => void;
  onSkipAll: () => void;
  onSkipRound?: () => void;
};

/** カプセル1つを開けて、中身を見せる演出 */
function CapsuleScene({ result, mode, eyebrow, playbackRate, auto, onTogglePlaybackRate, onToggleAuto, onComplete, onSkipAll, onSkipRound }: SceneProps) {
  const rarity = validRarity(result.rarity);
  // MRは、1回ガチャではまず「ふつうのカプセル」の姿で出てきて、開けるときに化ける
  const disguised = rarity === "MR" && mode === "machine";
  const [shownRarity, setShownRarity] = useState<GachaRarity>(disguised ? "N" : rarity);
  const [phase, setPhase] = useState(mode === "machine" ? "準備中" : "カプセル開封");
  const [interaction, setInteraction] = useState<SceneInteraction>(null);
  const [ready, setReady] = useState(false);

  const interactionRef = useRef<SceneInteraction>(null);
  const completedRef = useRef(false);
  const callbacksRef = useRef({ onComplete, onSkipAll, onSkipRound });
  useEffect(() => {
    callbacksRef.current = { onComplete, onSkipAll, onSkipRound };
  }, [onComplete, onSkipAll, onSkipRound]);

  const rootRef = useRef<HTMLDivElement>(null);
  useModalFocus(rootRef);
  const stageRef = useRef<HTMLDivElement>(null);
  const machineWrapRef = useRef<HTMLDivElement>(null);
  const machineApi = useRef<MachineApi>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const capsuleBobRef = useRef<HTMLSpanElement>(null);
  const capsuleShakeRef = useRef<HTMLSpanElement>(null);
  const capsuleTopRef = useRef<HTMLSpanElement>(null);
  const capsuleBottomRef = useRef<HTMLSpanElement>(null);
  const capsuleInsideRef = useRef<HTMLSpanElement>(null);
  const capsuleCracksRef = useRef<SVGSVGElement>(null);
  const capsuleGlowRef = useRef<HTMLSpanElement>(null);
  const specialBackgroundRef = useRef<HTMLDivElement>(null);
  const blackoutRef = useRef<HTMLDivElement>(null);
  const atmosphereRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const cracksRef = useRef<HTMLDivElement>(null);
  const crackLineRefs = useRef<SVGPathElement[]>([]);
  const lightningRef = useRef<HTMLDivElement>(null);
  const shockwaveRefs = useRef<HTMLSpanElement[]>([]);
  const silhouetteRef = useRef<HTMLSpanElement>(null);
  const itemFocusRef = useRef<HTMLSpanElement>(null);
  const itemRef = useRef<HTMLSpanElement>(null);
  const itemCopyRef = useRef<HTMLDivElement>(null);
  const freezeRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<ParticleHandle>(null);
  const timelineRef = useRef<GsapTimeline | null>(null);
  const idleRef = useRef<GsapTimeline | null>(null);
  const gsapRef = useRef<Gsap | null>(null);
  const playbackRateRef = useRef<PlaybackRate>(playbackRate);

  const baseRate = mode === "tray" ? TRAY_SCENE_TIME_SCALE : 1;
  useEffect(() => {
    playbackRateRef.current = playbackRate;
    timelineRef.current?.timeScale(baseRate * playbackRate);
  }, [baseRate, playbackRate]);

  const setInteractionBoth = useCallback((next: SceneInteraction) => {
    interactionRef.current = next;
    setInteraction(next);
  }, []);

  const finish = useCallback((kind: "complete" | "skipAll" | "skipRound") => {
    if (completedRef.current) return;
    completedRef.current = true;
    timelineRef.current?.kill();
    idleRef.current?.kill();
    const { onComplete: done, onSkipAll: skipAllRounds, onSkipRound: skipRound } = callbacksRef.current;
    if (kind === "skipAll") skipAllRounds();
    else if (kind === "skipRound") skipRound?.();
    else done();
  }, []);

  const skipAll = useCallback(() => finish("skipAll"), [finish]);
  useEscape(skipAll);

  /** ハンドルが回った（指・タップ・オート・下のボタン） */
  const onTurn = useCallback(() => {
    if (interactionRef.current !== "turn") return;
    setInteractionBoth(null);
    timelineRef.current?.resume();
  }, [setInteractionBoth]);

  const turnFromButton = useCallback(() => {
    if (interactionRef.current !== "turn") return;
    machineApi.current?.spin(0.8);
    onTurn();
  }, [onTurn]);

  /** カプセルをタップして開ける */
  const tapCapsule = useCallback(() => {
    if (interactionRef.current !== "open") return;
    idleRef.current?.kill();
    idleRef.current = null;
    if (capsuleBobRef.current && gsapRef.current) gsapRef.current.to(capsuleBobRef.current, { rotation: 0, y: 0, duration: 0.1 });
    setInteractionBoth(null);
    timelineRef.current?.resume();
  }, [setInteractionBoth]);

  // オートのときは、待たずに進める
  useEffect(() => {
    if (!auto || !interaction || interaction === "done") return;
    const id = window.setTimeout(() => {
      if (interaction === "turn") turnFromButton();
      else if (interaction === "open") tapCapsule();
    }, interaction === "open" ? 300 : 360);
    return () => window.clearTimeout(id);
  }, [auto, interaction, tapCapsule, turnFromButton]);

  useEffect(() => {
    if (!rootRef.current) return;
    let disposed = false;

    if (reducedMotion()) {
      setPhase("結果発表");
      setShownRarity(rarity);
      setReady(true);
      for (const element of [itemRef.current, itemCopyRef.current, itemFocusRef.current]) if (element) element.style.opacity = "1";
      if (capsuleRef.current) capsuleRef.current.style.opacity = "0";
      setInteractionBoth("done");
      const id = window.setTimeout(() => finish("complete"), 1600);
      return () => window.clearTimeout(id);
    }

    const images = [
      BACKGROUND_ART.shop,
      capsuleSrc(rarity),
      ...(disguised ? [capsuleSrc("N")] : []),
      ...(rarity === "LR" || rarity === "MR" ? [BACKGROUND_ART[rarity]] : []),
      ...(mode === "machine" ? [MACHINE_ART.body, MACHINE_ART.pile, MACHINE_ART.glass, MACHINE_ART.handle, MACHINE_ART.door, MACHINE_ART.domeMask] : []),
      ...(result.image ? [result.image] : []),
    ];

    void Promise.all([import("gsap"), preloadImages(images)])
      .then(([{ gsap }]) => {
        if (disposed) return;
        gsapRef.current = gsap;
        setReady(true);
        build(gsap);
      })
      .catch(() => {
        if (!disposed) finish("complete");
      });

    function build(gsap: Gsap) {
      const root = rootRef.current;
      const stage = stageRef.current;
      const capsule = capsuleRef.current;
      const capsuleBob = capsuleBobRef.current;
      const capsuleShake = capsuleShakeRef.current;
      const capTop = capsuleTopRef.current;
      const capBottom = capsuleBottomRef.current;
      const inside = capsuleInsideRef.current;
      const capCracks = capsuleCracksRef.current;
      const glow = capsuleGlowRef.current;
      const machineWrap = machineWrapRef.current;
      const machine = machineApi.current;
      const item = itemRef.current;
      const silhouette = silhouetteRef.current;
      const [shockwaveOne, shockwaveTwo] = shockwaveRefs.current;
      if (!root || !stage || !capsule || !capsuleBob || !capsuleShake || !capTop || !capBottom || !glow || !item || !silhouette || !shockwaveOne || !shockwaveTwo) return;
      if (mode === "machine" && (!machineWrap || !machine)) return;

      const blackout = blackoutRef.current;
      const atmosphere = atmosphereRef.current;
      const aura = auraRef.current;
      const beam = beamRef.current;
      const flash = flashRef.current;
      const cracks = cracksRef.current;
      const crackLines = crackLineRefs.current;
      const lightning = lightningRef.current;
      const itemFocus = itemFocusRef.current;
      const itemCopy = itemCopyRef.current;
      const freeze = freezeRef.current;
      const special = specialBackgroundRef.current;
      const big = RANK[rarity] >= RANK.SR;

      // 位置は、動かしはじめる前に測る
      const capRect = capsule.getBoundingClientRect();
      const home = { x: capRect.left + capRect.width / 2, y: capRect.top + capRect.height / 2 };
      const stageRect = stage.getBoundingClientRect();
      const itemCenter = centerOf(item);
      const itemFrom = {
        x: home.x - itemCenter.x,
        y: home.y - capRect.height * 0.06 - itemCenter.y,
        scale: (capRect.width * 0.5) / Math.max(1, item.offsetWidth),
      };

      const burst = (intensity: BurstIntensity) => {
        particlesRef.current?.burst(rarity, intensity, home);
        playGachaCue("explosion");
        vibrate(intensity === "mega" ? [35, 30, 55] : 35);
      };

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      timelineRef.current = tl;
      tl.timeScale(baseRate * playbackRateRef.current);
      gsap.set([blackout, atmosphere, aura, beam, flash, cracks, lightning, itemFocus, item, silhouette, itemCopy, freeze, special], { opacity: 0 });
      gsap.set([shockwaveOne, shockwaveTwo], { opacity: 0, scale: 0.12 });
      gsap.set(crackLines, { strokeDashoffset: 380 });
      gsap.set(capsule, { opacity: 0 });

      const waitForOpen = () => {
        setPhase("タップして開けよう！");
        setInteractionBoth("open");
        idleRef.current?.kill();
        idleRef.current = gsap
          .timeline({ repeat: -1, repeatDelay: 0.5 })
          .to(capsuleBob, { keyframes: [{ rotation: -7, y: -6 }, { rotation: 6, y: 0 }, { rotation: -3, y: -2 }, { rotation: 0, y: 0 }], duration: 0.7, ease: "sine.inOut" });
      };

      if (mode === "machine" && machineWrap && machine) {
        const mRect = machineWrap.getBoundingClientRect();
        const chute = { x: mRect.left + (mRect.width * MACHINE_LAYOUT.chute.x) / 100, y: mRect.top + (mRect.height * MACHINE_LAYOUT.chute.y) / 100 };
        const floor = {
          x: chute.x - mRect.width * 0.1,
          y: Math.min(stageRect.bottom - capRect.height * 0.2, mRect.bottom + capRect.height * 0.08),
        };
        const chuteScale = (mRect.width * 0.15) / capRect.width;
        const floorScale = Math.min(0.6, (mRect.width * 0.26) / capRect.width);
        const hop = capRect.height * floorScale;
        const steps = TELL_STEPS[rarity];
        const level = RANK[rarity] >= RANK.LR && !disguised ? 6 : steps.length;
        const shakeDuration = 0.42 + steps.length * 0.16;

        gsap.set(machine.door, { transformPerspective: 260, transformOrigin: "50% 4%" });
        tl.call(() => {
          setPhase("ガチャ起動");
          machine.setTell("idle");
        })
          .fromTo(machineWrap, { opacity: 0, y: 40, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.5)" })
          .addPause(undefined, () => {
            setPhase("ハンドルを回してね");
            setInteractionBoth("turn");
          })
          // 止めた位置とぴったり同じ時刻に置くと、回す前に呼ばれてしまうので、少しだけ後ろに置く
          .call(() => {
            setPhase("ガラガラ…");
            playGachaCue("turn");
            vibrate(level >= 4 ? [30, 20, 45] : 20);
          }, undefined, "+=0.02")
          .addLabel("turned")
          .to(machineWrap, { keyframes: shakeKeyframes(level, shakeDuration), ease: "none" }, "turned")
          .to(machine.pile, { keyframes: PILE_CHURN, duration: shakeDuration, ease: "sine.inOut" }, "turned");
        steps.forEach((tell, index) => {
          tl.call(() => {
            machine.setTell(tell);
            playGachaCue("ding", index);
          }, undefined, `turned+=${(0.08 + index * 0.16).toFixed(2)}`);
        });
        if (disguised) {
          // ほんの一瞬だけ、ランプが別の色にゆらぐ（よく見るとわかる予兆）
          tl.call(() => machine.setTell("mr"), undefined, `turned+=${(shakeDuration - 0.18).toFixed(2)}`)
            .call(() => machine.setTell("white"), undefined, `turned+=${(shakeDuration - 0.1).toFixed(2)}`);
        }
        if (rarity === "LR") {
          tl.to(machineWrap, { filter: "brightness(1.5) drop-shadow(0 0 22px #ffd56a)", duration: 0.14 }, `turned+=${(shakeDuration - 0.3).toFixed(2)}`)
            .to(machineWrap, { filter: "brightness(1) drop-shadow(0 0 0px #ffd56a)", duration: 0.5 });
        }

        tl.addLabel("drop", `turned+=${shakeDuration.toFixed(2)}`)
          .call(() => {
            setPhase("カプセルが出てきた！");
            playGachaCue("door");
          }, undefined, "drop")
          .to(machine.door, { rotationX: -74, duration: 0.14 }, "drop")
          .call(() => playGachaCue("pop"), undefined, "drop+=0.06")
          .fromTo(
            capsule,
            { opacity: 0, x: chute.x - home.x, y: chute.y - home.y, scale: chuteScale * 0.7, rotation: -30 },
            { opacity: 1, x: chute.x - home.x + mRect.width * 0.03, y: chute.y - home.y + mRect.height * 0.012, scale: chuteScale * 1.15, rotation: 20, duration: 0.13, ease: "power1.out" },
            "drop+=0.06",
          )
          .to(capsule, { x: floor.x - home.x, y: floor.y - home.y, scale: floorScale, rotation: 170, duration: 0.26, ease: "power2.in" })
          .call(() => {
            playGachaCue("land");
            vibrate(14);
          })
          .to(capsule, { y: floor.y - home.y - hop * 0.55, x: floor.x - home.x - mRect.width * 0.06, rotation: 260, duration: 0.15, ease: "power2.out" })
          .to(capsule, { y: floor.y - home.y, x: floor.x - home.x - mRect.width * 0.1, rotation: 360, duration: 0.13, ease: "power2.in" })
          .call(() => playGachaCue("land"))
          .to(machine.door, { rotationX: 0, duration: 0.26, ease: "bounce.out" }, "<-0.15")
          .addLabel("lift", "+=0.04")
          .call(() => machine.setTell("off"), undefined, "lift")
          .to(machineWrap, { opacity: 0.16, scale: 0.84, y: -mRect.height * 0.08, duration: 0.45, ease: "power2.inOut" }, "lift")
          .to(blackout, { opacity: 0.3, duration: 0.45 }, "lift")
          .to(capsule, { x: 0, y: 0, scale: 1, rotation: 720, duration: 0.48, ease: "power3.inOut" }, "lift")
          .set(capsule, { rotation: 0 })
          .addPause(undefined, waitForOpen);
      } else {
        tl.fromTo(capsule, { opacity: 0, y: capRect.height * 0.7, scale: 0.32, rotation: -14 }, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.45, ease: "back.out(1.4)" });
      }

      // ---------- 力をためる（たたいて待つときは、待ちの少し後ろから） ----------
      tl.addLabel("charge", mode === "machine" ? "+=0.02" : ">")
        .call(() => {
          setPhase("力をためている…");
          playGachaCue("charge");
        }, undefined, "charge")
        .to(blackout, { opacity: BLACKOUT[disguised ? "N" : rarity], duration: 0.35 }, "charge");
      if (machineWrap && mode === "machine") tl.to(machineWrap, { opacity: 0, duration: 0.3 }, "charge");
      tl.to(glow, { opacity: 1, scale: 1.18, duration: 0.3 }, "charge")
        .to(inside, { opacity: 1, filter: "brightness(0) invert(1) drop-shadow(0 0 6px rgba(255,255,255,.95))", duration: 0.35 }, "charge+=0.05")
        .to(capsuleShake, { keyframes: [{ x: -5, rotation: -3 }, { x: 6, rotation: 3 }, { x: -4, rotation: -2 }, { x: 5, rotation: 2 }, { x: 0, rotation: 0 }], duration: big && !disguised ? 0.5 : 0.32, ease: "none" }, "charge");
      if (big && !disguised && capCracks) {
        tl.to(capCracks.querySelectorAll("path"), { strokeDashoffset: 0, duration: 0.16, stagger: 0.04, ease: "power2.out" }, "charge+=0.12")
          .call(() => playGachaCue("crack"), undefined, "charge+=0.12");
      }

      if (disguised) {
        // ---------- MR：開きかけたところで止まり、化ける ----------
        tl.to(capTop, { yPercent: -7, rotation: -5, duration: 0.18, ease: "power2.out" })
          .call(() => {
            setPhase("……");
            playGachaCue("crack");
            vibrate([30, 40, 30]);
          })
          .to(freeze, { opacity: 1, duration: 0.06 }, "<")
          .to(glow, { opacity: 0.25, duration: 0.06 }, "<")
          .to({}, { duration: 0.38 })
          .to(cracks, { opacity: 1, duration: 0.05 })
          .to(crackLines, { strokeDashoffset: 0, duration: 0.3, stagger: 0.03, ease: "power3.out" }, "<")
          .to(lightning, { opacity: 1, duration: 0.05 }, "<0.1")
          .to(lightning, { opacity: 0.12, duration: 0.08, repeat: 5, yoyo: true })
          .to(capTop, { yPercent: 0, rotation: 0, duration: 0.12, ease: "power3.in" }, "<")
          .call(() => {
            setPhase("レアリティ昇格！");
            playGachaCue("flash");
            vibrate([40, 30, 60]);
          })
          .to(flash, { opacity: 1, duration: 0.07 }, "<")
          .call(() => {
            setShownRarity("MR");
            particlesRef.current?.burst("MR", "large", home);
          }, undefined, ">")
          .to(freeze, { opacity: 0, duration: 0.1 }, "<")
          .to(flash, { opacity: 0, duration: 0.5 })
          .to(blackout, { opacity: BLACKOUT.MR, duration: 0.2 }, "<")
          .to(special, { opacity: 1, duration: 0.6 }, "<")
          .to(capsule, { scale: 1.14, duration: 0.2, ease: "back.out(2)" }, "<")
          .to(capsule, { scale: 1, duration: 0.4, ease: "elastic.out(1, .45)" })
          .to(glow, { opacity: 1, scale: 1.3, duration: 0.3 }, "<")
          .to(capsuleShake, { keyframes: [{ x: -7, rotation: -5 }, { x: 8, rotation: 5 }, { x: -6, rotation: -4 }, { x: 7, rotation: 4 }, { x: 0, rotation: 0 }], duration: 0.6, ease: "none" }, "<")
          .call(() => playGachaCue("charge"), undefined, "<");
      }

      if (big) {
        if (!disguised) {
          tl.to(cracks, { opacity: 1, duration: 0.06 }, ">-0.18")
            .to(crackLines, { strokeDashoffset: 0, duration: 0.24, stagger: 0.025, ease: "power3.out" }, "<");
        }
        tl.to(beam, { opacity: 0.94, scaleX: 1, duration: 0.3, ease: "power3.out" }, "<0.05")
          .to(atmosphere, { opacity: rarity === "SSR" ? 0.92 : 0.72, rotation: 48, duration: 0.4 }, "<")
          .to(aura, { opacity: 0.86, scale: 1, rotation: 42, duration: 0.4 }, "<");
        if (rarity === "LR" || (rarity === "MR" && !disguised)) tl.to(special, { opacity: 1, duration: 0.5 }, "<");
      } else {
        tl.to(beam, { opacity: 0.55, scaleX: 0.62, duration: 0.22 }, ">-0.1");
      }

      // ---------- 開く ----------
      tl.addLabel("open")
        .to(flash, { opacity: big ? 1 : 0.65, duration: 0.07 }, "open")
        .call(() => {
          playGachaCue("flash");
          playGachaCue("pop");
        }, undefined, "open")
        .to(flash, { opacity: 0, duration: 0.42 }, "open+=0.07")
        .to(capTop, { xPercent: -34, yPercent: -100, rotation: -42, opacity: 0, duration: 0.62, ease: "power2.out" }, "open")
        .to(capBottom, { xPercent: 24, yPercent: 62, rotation: 20, opacity: 0, duration: 0.62, ease: "power2.in" }, "open")
        .to([capCracks, inside], { opacity: 0, duration: 0.1 }, "open")
        .to(glow, { opacity: 0, scale: 2.4, duration: 0.55 }, "open")
        .to(shockwaveOne, { opacity: 0.9, scale: 4.8, duration: 0.78, ease: "power3.out" }, "open")
        .to(shockwaveTwo, { opacity: 0.72, scale: 6.2, duration: 0.94, ease: "power3.out" }, "open+=0.12")
        .to([shockwaveOne, shockwaveTwo], { opacity: 0, duration: 0.3 }, "open+=0.8")
        .to(root, { keyframes: [{ x: -8, y: 3 }, { x: 8, y: -4 }, { x: -5, y: 3 }, { x: 0, y: 0 }], duration: 0.42, ease: "none" }, "open")
        .call(() => burst(rarity === "MR" ? "mega" : rarity === "LR" || rarity === "UR" ? "large" : big ? "normal" : "small"), undefined, "open");

      if (rarity === "UR") {
        tl.to(lightning, { opacity: 1, duration: 0.06 }, "open+=0.04")
          .to(lightning, { opacity: 0.18, duration: 0.1, repeat: 5, yoyo: true }, "open+=0.1")
          .call(() => burst("large"), undefined, "open+=0.55")
          .to(flash, { opacity: 0.78, duration: 0.05 }, "open+=0.55")
          .to(flash, { opacity: 0, duration: 0.25 }, "open+=0.6");
      } else if (rarity === "LR") {
        tl.to(blackout, { opacity: 1, duration: 0.1 }, "open")
          .to(aura, { opacity: 1, scale: 1.22, rotation: 150, duration: 0.8, ease: "power4.out" }, "open")
          .call(() => burst("mega"), undefined, "open+=0.18");
      } else if (rarity === "MR") {
        tl.to(aura, { opacity: 1, rotation: 260, scale: 1.35, duration: 0.7 }, "open")
          .to(lightning, { opacity: 1, duration: 0.05 }, "open")
          .to(lightning, { opacity: 0.12, duration: 0.09, repeat: 6, yoyo: true }, "open+=0.05")
          .to(root, { keyframes: [{ x: -12, y: 5 }, { x: 11, y: -7 }, { x: -8, y: 5 }, { x: 6, y: -3 }, { x: 0, y: 0 }], duration: 0.56, ease: "none" }, "open+=0.1");
      }

      // ---------- 中身が飛び出して、まん中に出る ----------
      tl.addLabel("reveal", "open+=0.04")
        .call(() => setPhase("結果発表"), undefined, "reveal")
        .to([beam, aura, cracks, lightning, atmosphere], { opacity: 0, duration: 0.35 }, "reveal+=0.5")
        .to(blackout, { opacity: rarity === "LR" ? 0.66 : rarity === "MR" ? 0.4 : 0.3, duration: 0.4 }, "reveal+=0.3")
        .fromTo([silhouette, item], { x: itemFrom.x, y: itemFrom.y, scale: itemFrom.scale, rotation: -10 }, { x: 0, y: 0, scale: 1.08, rotation: 0, duration: 0.66, ease: "back.out(1.6)" }, "reveal")
        .fromTo(silhouette, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: "power1.in", immediateRender: false }, "reveal+=0.14")
        .fromTo(item, { opacity: 0 }, { opacity: 1, duration: 0.32 }, "reveal+=0.06")
        .fromTo(itemFocus, { opacity: 0, scale: 0.56 }, { opacity: 1, scale: 1, duration: 0.42, ease: "power3.out" }, "reveal+=0.16")
        .to(item, { scale: 1, duration: 0.24 }, "reveal+=0.66")
        .fromTo(itemCopy, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, "reveal+=0.62")
        .call(() => {
          playGachaCue("reveal");
          setInteractionBoth("done");
        }, undefined, "reveal+=0.62")
        .to(item, { scale: 1.03, duration: 0.3, repeat: 1, yoyo: true, ease: "sine.inOut" }, "reveal+=0.95")
        .call(() => finish("complete"), undefined, `reveal+=${mode === "tray" ? 1.5 : 2}`);
    }

    return () => {
      disposed = true;
      timelineRef.current?.kill();
      timelineRef.current = null;
      idleRef.current?.kill();
      idleRef.current = null;
    };
    // シーンはカプセルごとに作りなおす（key）ので、最初の1回だけ組み立てる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const image = result.image;
  const special = rarity === "LR" || rarity === "MR";
  const hint = interaction === "turn" ? "ハンドルを回す ↻" : interaction === "open" ? "タップして開ける" : null;

  return (
    <div ref={rootRef} className={styles.root} data-rarity={shownRarity} role="dialog" tabIndex={-1} aria-modal="true" aria-label={`${eyebrow}のガチャ演出`}>
      <div className={styles.backdrop} />
      {special ? <div ref={specialBackgroundRef} className={styles.specialBackground} data-rarity={rarity} /> : null}
      <div className={styles.ambient} />
      <div ref={atmosphereRef} className={styles.rarityAtmosphere} />
      <div ref={blackoutRef} className={styles.blackout} />
      <div className={styles.vignette} />

      <Hud
        eyebrow={eyebrow}
        phase={phase}
        playbackRate={playbackRate}
        auto={auto}
        skipLabel={mode === "tray" || onSkipRound ? "すべてスキップ" : "スキップ"}
        onTogglePlaybackRate={onTogglePlaybackRate}
        onToggleAuto={onToggleAuto}
        onSkip={skipAll}
        onSkipRound={onSkipRound ? () => finish("skipRound") : undefined}
      />

      <div ref={stageRef} className={styles.stage} data-ready={ready}>
        {mode === "machine" ? (
          <div ref={machineWrapRef} className={styles.sceneMachine}>
            <GachaMachine ref={machineApi} awaitingTurn={interaction === "turn"} onTurn={onTurn} />
          </div>
        ) : null}

        <div ref={beamRef} className={styles.beam} />
        <div ref={capsuleRef} className={styles.sceneCapsule}>
          <span ref={capsuleGlowRef} className={styles.capsuleGlow} />
          <span ref={capsuleBobRef} className={styles.capsuleBob}>
            <span ref={capsuleShakeRef} className={styles.capsuleShake}>
              <CapsuleArt
                rarity={shownRarity}
                inside={image ?? null}
                topRef={capsuleTopRef}
                bottomRef={capsuleBottomRef}
                insideRef={capsuleInsideRef}
                crackRef={capsuleCracksRef}
              />
            </span>
          </span>
          <button
            type="button"
            className={styles.capsuleTapArea}
            disabled={interaction !== "open"}
            onClick={tapCapsule}
            aria-label="カプセルを開ける"
          />
        </div>

        <div ref={auraRef} className={styles.auraRing} />
      </div>

      {/* 中身は、ひびや衝撃波より手前に出す（フラッシュよりは奥） */}
      <div className={styles.reveal}>
        <span ref={itemFocusRef} className={styles.itemFocus} aria-hidden="true" />
        <span ref={silhouetteRef} className={styles.silhouette} style={image ? { backgroundImage: imageUrl(image) } : undefined} aria-hidden="true">
          {image ? null : "?"}
        </span>
        <span ref={itemRef} className={styles.item} role="img" aria-label={result.name} style={image ? { backgroundImage: imageUrl(image) } : undefined}>
          {image ? null : "?"}
        </span>
        <div ref={itemCopyRef} className={styles.itemCopy}>
          <span className={styles.rarityBadge}>{rarity}</span>
          <h2 className={styles.itemName}>{result.name}</h2>
          {result.isNew ? <span className={styles.newBadge}>NEW!</span> : null}
        </div>
      </div>

      {!ready ? <div className={styles.loading}>準備中…</div> : null}
      {hint ? (
        <button type="button" className={styles.interactionHint} onClick={interaction === "turn" ? turnFromButton : tapCapsule}>
          {hint}
        </button>
      ) : null}
      {interaction === "done" ? (
        <button type="button" className={styles.continueLayer} onClick={() => finish("complete")} aria-label="つぎへ">
          <span>タップでつぎへ</span>
        </button>
      ) : null}

      <PixiEffects ref={particlesRef} enabled />
      <div className={styles.shockwaves} aria-hidden="true">
        {[0, 1].map((index) => (
          <span key={index} ref={(node) => { if (node) shockwaveRefs.current[index] = node; }} className={styles.shockwave} />
        ))}
      </div>
      <div ref={lightningRef} className={styles.lightning} aria-hidden="true">
        <span className={styles.bolt} />
        <span className={styles.bolt} />
        <span className={styles.bolt} />
      </div>
      <div ref={cracksRef} className={styles.cracks} aria-hidden="true">
        <svg viewBox="0 0 400 400">
          {SCREEN_CRACKS.map((path, index) => (
            <path key={path} ref={(node) => { if (node) crackLineRefs.current[index] = node; }} className={styles.crackLine} d={path} />
          ))}
        </svg>
      </div>
      <div ref={freezeRef} className={styles.freeze} />
      <div ref={flashRef} className={styles.flash} />
    </div>
  );
}

type TrayProps = {
  results: DrawResult[];
  promotion?: GachaPromotion;
  eyebrow: string;
  /** true：マシンを回して受け皿に出すところから。false：もう受け皿に並んでいる */
  intro: boolean;
  /** ハンドルを待たずに回す（100連の2セット目から） */
  autoTurn: boolean;
  opened: readonly boolean[];
  playbackRate: PlaybackRate;
  auto: boolean;
  onTogglePlaybackRate: () => void;
  onToggleAuto: () => void;
  onIntroDone: () => void;
  /** N〜SRをその場で開けた */
  onOpened: (index: number) => void;
  /** SSR以上を選んだ（大きく開ける） */
  onOpenScene: (index: number) => void;
  /** 「ぜんぶ開ける」でN〜SRを開け終わった（のこりのSSR以上を順に開ける） */
  onOpenRest: () => void;
  onRoundDone: () => void;
  onSkipAll: () => void;
  onSkipRound?: () => void;
};

type TrayInteraction = "turn" | "pick" | null;

/** 10連・100連：マシンを回して、出てきたカプセルを受け皿に並べ、タップで開けていく */
function TrayStage({ results, promotion, eyebrow, intro, autoTurn, opened, playbackRate, auto, onTogglePlaybackRate, onToggleAuto, onIntroDone, onOpened, onOpenScene, onOpenRest, onRoundDone, onSkipAll, onSkipRound }: TrayProps) {
  const rarities = useMemo(() => results.map((result) => validRarity(result.rarity)), [results]);
  const [promoted, setPromoted] = useState(!intro);
  const shownRarities = useMemo(
    () => rarities.map((rarity, index) => (promotion && promotion.index === index && !promoted ? promotion.fromRarity : rarity)),
    [promoted, promotion, rarities],
  );
  const [phase, setPhase] = useState(intro ? "準備中" : "カプセルをタップしてね");
  const [interaction, setInteraction] = useState<TrayInteraction>(intro ? null : "pick");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!intro);
  const allOpened = opened.length > 0 && opened.every(Boolean);

  const interactionRef = useRef<TrayInteraction>(intro ? null : "pick");
  const completedRef = useRef(false);
  const busyRef = useRef(false);
  const callbacksRef = useRef({ onIntroDone, onOpened, onOpenScene, onOpenRest, onRoundDone, onSkipAll, onSkipRound });
  useEffect(() => {
    callbacksRef.current = { onIntroDone, onOpened, onOpenScene, onOpenRest, onRoundDone, onSkipAll, onSkipRound };
  }, [onIntroDone, onOpened, onOpenScene, onOpenRest, onRoundDone, onSkipAll, onSkipRound]);
  const openedRef = useRef(opened);
  useEffect(() => {
    openedRef.current = opened;
  }, [opened]);

  const rootRef = useRef<HTMLDivElement>(null);
  useModalFocus(rootRef);
  const machineWrapRef = useRef<HTMLDivElement>(null);
  const machineApi = useRef<MachineApi>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const capsuleRefs = useRef<HTMLSpanElement[]>([]);
  const topRefs = useRef<HTMLSpanElement[]>([]);
  const prizeRefs = useRef<HTMLSpanElement[]>([]);
  const flashRef = useRef<HTMLDivElement>(null);
  const promotionCopyRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<ParticleHandle>(null);
  const timelineRef = useRef<GsapTimeline | null>(null);
  const gsapRef = useRef<Gsap | null>(null);
  const playbackRateRef = useRef<PlaybackRate>(playbackRate);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    timelineRef.current?.timeScale(playbackRate);
  }, [playbackRate]);

  const setInteractionBoth = useCallback((next: TrayInteraction) => {
    interactionRef.current = next;
    setInteraction(next);
  }, []);

  const finish = useCallback((kind: "skipAll" | "skipRound" | "done") => {
    if (completedRef.current) return;
    completedRef.current = true;
    timelineRef.current?.kill();
    const callbacks = callbacksRef.current;
    if (kind === "skipAll") callbacks.onSkipAll();
    else if (kind === "skipRound") callbacks.onSkipRound?.();
    else callbacks.onRoundDone();
  }, []);
  const skipAll = useCallback(() => finish("skipAll"), [finish]);
  useEscape(skipAll);

  const onTurn = useCallback(() => {
    if (interactionRef.current !== "turn") return;
    setInteractionBoth(null);
    timelineRef.current?.resume();
  }, [setInteractionBoth]);
  const turnFromButton = useCallback(() => {
    if (interactionRef.current !== "turn") return;
    machineApi.current?.spin(0.8);
    onTurn();
  }, [onTurn]);

  /** N〜SRを受け皿の上で開ける */
  const openInline = useCallback((index: number, delay = 0) => {
    const gsap = gsapRef.current;
    const top = topRefs.current[index];
    const prize = prizeRefs.current[index];
    const capsule = capsuleRefs.current[index];
    const rarity = rarities[index] ?? "N";
    if (!gsap || !top || !prize || !capsule) {
      callbacksRef.current.onOpened(index);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      gsap
        .timeline({ delay, onComplete: resolve })
        .call(() => {
          playGachaCue("pop");
          if (RANK[rarity] >= RANK.SR) playGachaCue("ding", 1);
          particlesRef.current?.burst(rarity, "small", centerOf(capsule));
        })
        .to(top, { xPercent: -26, yPercent: -70, rotation: -36, opacity: 0, duration: 0.42, ease: "power2.out" }, 0)
        .fromTo(prize, { opacity: 0, scale: 0.3, yPercent: 30 }, { opacity: 1, scale: 1, yPercent: 0, duration: 0.42, ease: "back.out(2)" }, 0.06)
        .call(() => callbacksRef.current.onOpened(index), undefined, 0.3)
        .timeScale(playbackRateRef.current);
    });
  }, [rarities]);

  const pick = useCallback((index: number) => {
    if (interactionRef.current !== "pick" || busyRef.current || openedRef.current[index]) return;
    if (RANK[rarities[index] ?? "N"] >= SCENE_RANK) {
      callbacksRef.current.onOpenScene(index);
      return;
    }
    void openInline(index);
  }, [openInline, rarities]);

  /** ぜんぶ開ける：N〜SRをいっせいに開けてから、のこりのSSR以上を順に大きく開ける */
  const openAll = useCallback(() => {
    if (interactionRef.current !== "pick" || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const commons = rarities.flatMap((rarity, index) => (!openedRef.current[index] && RANK[rarity] < SCENE_RANK ? [index] : []));
    void Promise.all(commons.map((index, order) => openInline(index, order * 0.06))).then(() => {
      window.setTimeout(() => {
        busyRef.current = false;
        setBusy(false);
        if (!completedRef.current) callbacksRef.current.onOpenRest();
      }, commons.length > 0 ? 260 : 0);
    });
  }, [openInline, rarities]);

  // ぜんぶ開いたら、ひと呼吸おいて次へ
  useEffect(() => {
    if (!allOpened || interaction !== "pick") return;
    setPhase("ぜんぶ開けた！");
    const gsap = gsapRef.current;
    const prizes = prizeRefs.current.filter(Boolean);
    if (gsap && !reducedMotion()) {
      gsap.fromTo(prizes, { y: 0 }, { keyframes: [{ y: -8 }, { y: 0 }], duration: 0.42, stagger: 0.05, ease: "power2.out" });
      playGachaCue("reveal");
    }
    const id = window.setTimeout(() => finish("done"), 950 / playbackRateRef.current);
    return () => window.clearTimeout(id);
  }, [allOpened, finish, interaction]);

  // オートのときは、並び終わったら自動で開けていく（ハンドルは100連の2セット目からも自動）
  useEffect(() => {
    if (allOpened || busy) return;
    if (interaction === "turn" && (auto || autoTurn)) {
      const id = window.setTimeout(turnFromButton, 360);
      return () => window.clearTimeout(id);
    }
    if (interaction === "pick" && auto) {
      const id = window.setTimeout(openAll, 420);
      return () => window.clearTimeout(id);
    }
  }, [allOpened, auto, autoTurn, busy, interaction, openAll, turnFromButton]);

  useEffect(() => {
    let disposed = false;
    const capsules = capsuleRefs.current.filter(Boolean);

    if (reducedMotion()) {
      setPromoted(true);
      setReady(true);
      if (intro) callbacksRef.current.onIntroDone();
      rarities.forEach((_, index) => {
        if (!openedRef.current[index]) callbacksRef.current.onOpened(index);
      });
      setInteractionBoth("pick");
      return;
    }

    const images = [
      BACKGROUND_ART.shop,
      MACHINE_ART.body,
      MACHINE_ART.pile,
      MACHINE_ART.glass,
      MACHINE_ART.handle,
      MACHINE_ART.door,
      MACHINE_ART.domeMask,
      ...new Set(rarities.map((rarity) => capsuleSrc(rarity, true))),
      ...(promotion ? [capsuleSrc(promotion.fromRarity, true)] : []),
    ];

    void Promise.all([import("gsap"), preloadImages(images)])
      .then(([{ gsap }]) => {
        if (disposed) return;
        gsapRef.current = gsap;
        setReady(true);
        if (intro) build(gsap);
      })
      .catch(() => {
        if (!disposed) finish("skipAll");
      });

    function build(gsap: Gsap) {
      const machineWrap = machineWrapRef.current;
      const machine = machineApi.current;
      const tray = trayRef.current;
      if (!machineWrap || !machine || !tray) return;

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      timelineRef.current = tl;
      tl.timeScale(playbackRateRef.current);

      const mRect = machineWrap.getBoundingClientRect();
      const chute = { x: mRect.left + (mRect.width * MACHINE_LAYOUT.chute.x) / 100, y: mRect.top + (mRect.height * MACHINE_LAYOUT.chute.y) / 100 };
      const targets = capsules.map((capsule) => {
        const rect = capsule.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: rect.width };
      });
      const best = shownRarities.reduce<GachaRarity>((top, rarity) => (RANK[rarity] > RANK[top] ? rarity : top), "N");
      const steps = TELL_STEPS[best];
      const level = RANK[best] >= RANK.LR ? 6 : steps.length;
      const shakeDuration = 0.42 + steps.length * 0.16;

      gsap.set(capsules, { opacity: 0 });
      gsap.set(machine.door, { transformPerspective: 220, transformOrigin: "50% 4%" });
      gsap.set(promotionCopyRef.current, { opacity: 0, scale: 0.54 });

      tl.call(() => {
        setPhase("ガチャ起動");
        machine.setTell("idle");
      })
        .fromTo(machineWrap, { opacity: 0, y: 30, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.5)" })
        .fromTo(tray, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.32 }, "<0.08")
        .addPause(undefined, () => {
          setPhase("ハンドルを回してね");
          setInteractionBoth("turn");
        })
        .call(() => {
          setPhase("ガラガラ…");
          playGachaCue("turn");
          vibrate(level >= 4 ? [30, 20, 45] : 20);
        }, undefined, "+=0.02")
        .addLabel("turned")
        .to(machineWrap, { keyframes: shakeKeyframes(level, shakeDuration), ease: "none" }, "turned")
        .to(machine.pile, { keyframes: PILE_CHURN, duration: shakeDuration, ease: "sine.inOut" }, "turned");
      steps.forEach((tell, index) => {
        tl.call(() => {
          machine.setTell(tell);
          playGachaCue("ding", index);
        }, undefined, `turned+=${(0.08 + index * 0.16).toFixed(2)}`);
      });
      if (promotion) {
        // 確変がひそんでいるときは、最後にランプが一瞬ゆらぐ
        tl.call(() => machine.setTell(promotion.toRarity === "MR" ? "mr" : "lr"), undefined, `turned+=${(shakeDuration - 0.18).toFixed(2)}`)
          .call(() => machine.setTell(steps[steps.length - 1] ?? "white"), undefined, `turned+=${(shakeDuration - 0.1).toFixed(2)}`);
      }

      tl.addLabel("drop", `turned+=${shakeDuration.toFixed(2)}`)
        .call(() => {
          setPhase(`${results.length}個のカプセル！`);
          playGachaCue("door");
        }, undefined, "drop")
        .to(machine.door, { rotationX: -74, duration: 0.14 }, "drop");

      capsules.forEach((capsule, index) => {
        const target = targets[index];
        if (!target) return;
        const at = 0.08 + index * 0.085;
        const dx = chute.x - target.x;
        const dy = chute.y - target.y;
        const startScale = (mRect.width * 0.14) / Math.max(1, target.w);
        const rarity = shownRarities[index] ?? "N";
        tl.call(() => playGachaCue("pop"), undefined, `drop+=${at}`)
          .set(capsule, { opacity: 1 }, `drop+=${at}`)
          .fromTo(capsule, { x: dx }, { x: 0, duration: 0.42, ease: "none" }, `drop+=${at}`)
          .fromTo(capsule, { y: dy }, { y: Math.min(dy, 0) - 40, duration: 0.16, ease: "power2.out" }, `drop+=${at}`)
          .to(capsule, { y: 0, duration: 0.26, ease: "power2.in" }, `drop+=${(at + 0.16).toFixed(3)}`)
          .fromTo(capsule, { scale: startScale, rotation: -220 + index * 23 }, { scale: 1, rotation: 0, duration: 0.42, ease: "power1.out" }, `drop+=${at}`)
          .call(() => {
            playGachaCue("land");
            if (RANK[rarity] >= RANK.SSR) {
              playGachaCue("ding", Math.min(4, RANK[rarity] - 1));
              particlesRef.current?.burst(rarity, "small", { x: target.x, y: target.y });
            }
          }, undefined, `drop+=${(at + 0.42).toFixed(3)}`)
          .to(capsule, { keyframes: [{ scaleY: 0.86, scaleX: 1.08 }, { scaleY: 1, scaleX: 1 }], duration: 0.16, ease: "power1.out" }, `drop+=${(at + 0.42).toFixed(3)}`);
      });

      const dropEnd = 0.08 + Math.max(0, capsules.length - 1) * 0.085 + 0.6;
      tl.to(machine.door, { rotationX: 0, duration: 0.3, ease: "bounce.out" }, `drop+=${dropEnd.toFixed(2)}`)
        .call(() => machine.setTell("off"), undefined, `drop+=${dropEnd.toFixed(2)}`);

      const promotionTarget = promotion ? capsules[promotion.index] : undefined;
      if (promotion && promotionTarget) {
        const others = capsules.filter((_, index) => index !== promotion.index);
        const target = targets[promotion.index];
        tl.to({}, { duration: 0.25 })
          .call(() => {
            setPhase("……");
            playGachaCue("charge");
          })
          .to(others, { opacity: 0.25, scale: 0.9, duration: 0.28 }, "<")
          .to(promotionTarget, { keyframes: [{ x: -5, rotation: -6 }, { x: 6, rotation: 6 }, { x: -4, rotation: -4 }, { x: 5, rotation: 4 }, { x: 0, rotation: 0 }], scale: 1.18, duration: 0.6, ease: "none" })
          .call(() => {
            setPhase("確変発生！");
            playGachaCue("crack");
          })
          .to(promotionCopyRef.current, { opacity: 1, scale: 1, duration: 0.22, ease: "back.out(2)" }, "<")
          .to(flashRef.current, { opacity: 1, duration: 0.07 })
          .call(() => {
            setPromoted(true);
            particlesRef.current?.burst(promotion.toRarity, promotion.toRarity === "MR" ? "mega" : "large", target ? { x: target.x, y: target.y } : undefined);
            playGachaCue("explosion");
            vibrate(promotion.toRarity === "MR" ? [40, 30, 60] : [35, 25, 40]);
          }, undefined, "<")
          .to(flashRef.current, { opacity: 0, duration: 0.3 })
          .to(promotionTarget, { scale: 1.36, duration: 0.24, ease: "back.out(1.8)" }, "<")
          .to(promotionTarget, { scale: 1, duration: 0.46, ease: "elastic.out(1, .45)" })
          .to(others, { opacity: 1, scale: 1, duration: 0.34 }, "<0.12")
          .to(promotionCopyRef.current, { opacity: 0, scale: 1.18, duration: 0.24 }, "<");
      }

      tl.to({}, { duration: 0.1 }).call(() => {
        setPromoted(true);
        callbacksRef.current.onIntroDone();
        setPhase("カプセルをタップしてね");
        setInteractionBoth("pick");
      });
    }

    return () => {
      disposed = true;
      timelineRef.current?.kill();
      timelineRef.current = null;
    };
    // 受け皿はセットごとに作りなおす（key）ので、最初の1回だけ組み立てる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = opened.filter((value) => !value).length;
  return (
    <div ref={rootRef} className={`${styles.root} ${styles.trayRoot}`} role="dialog" tabIndex={-1} aria-modal="true" aria-label={`${eyebrow}のカプセル`}>
      <div className={styles.backdrop} />
      <div className={styles.ambient} />
      <div className={styles.vignette} />
      <Hud
        eyebrow={eyebrow}
        phase={phase}
        playbackRate={playbackRate}
        auto={auto}
        skipLabel="すべてスキップ"
        onTogglePlaybackRate={onTogglePlaybackRate}
        onToggleAuto={onToggleAuto}
        onSkip={skipAll}
        onSkipRound={onSkipRound ? () => finish("skipRound") : undefined}
      />

      <div className={styles.trayStage} data-ready={ready}>
        <div ref={machineWrapRef} className={styles.trayMachine} data-idle={!intro || interaction === "pick"}>
          <GachaMachine ref={machineApi} awaitingTurn={interaction === "turn"} onTurn={onTurn} />
        </div>

        <div ref={trayRef} className={styles.tray} data-complete={allOpened}>
          {results.map((result, index) => {
            const rarity = shownRarities[index] ?? "N";
            const isOpen = opened[index] ?? false;
            const canPick = interaction === "pick" && !busy && !isOpen;
            return (
              <button
                key={`${result.id}-${index}`}
                type="button"
                className={styles.traySlot}
                data-rarity={rarity}
                data-open={isOpen}
                data-rare={RANK[rarity] >= RANK.SSR}
                disabled={!canPick}
                onClick={() => pick(index)}
                aria-label={isOpen ? `${index + 1}個目：${result.name}（${rarity}）` : `${index + 1}個目の${rarity}カプセルを開ける`}
              >
                <span className={styles.slotDimple} aria-hidden="true" />
                <span ref={(node) => { if (node) capsuleRefs.current[index] = node; }} className={styles.slotCapsule}>
                  <span className={styles.slotGlow} aria-hidden="true" />
                  <CapsuleArt rarity={rarity} small topRef={(node) => { if (node) topRefs.current[index] = node; }} />
                </span>
                <span
                  ref={(node) => { if (node) prizeRefs.current[index] = node; }}
                  className={styles.slotPrize}
                  style={result.image ? { backgroundImage: imageUrl(result.image) } : undefined}
                  aria-hidden="true"
                >
                  {result.image ? null : "?"}
                </span>
                <span className={styles.slotLabel} aria-hidden="true">{rarity}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.trayActions}>
          {interaction === "pick" && !allOpened ? (
            <>
              <button type="button" className={styles.openAllButton} onClick={openAll} disabled={busy}>
                ぜんぶ開ける（のこり{remaining}個）
              </button>
              <p className={styles.trayHint}>SSR以上は、大きく開くよ</p>
            </>
          ) : null}
        </div>
      </div>

      <div ref={promotionCopyRef} className={styles.batchPromotionCopy} aria-live="assertive">
        <span>確変！</span>
      </div>
      {!ready ? <div className={styles.loading}>準備中…</div> : null}
      {interaction === "turn" ? (
        <button type="button" className={styles.interactionHint} onClick={turnFromButton}>
          ハンドルを回す ↻
        </button>
      ) : null}
      <PixiEffects ref={particlesRef} enabled />
      <div ref={flashRef} className={styles.flash} />
    </div>
  );
}

type View = "tray" | "scene";

export function GachaCinematic({ draw, onComplete }: { draw: AnimationDraw; onComplete: (draw: AnimationDraw) => void }) {
  useBodyScrollLock();
  const isHundred = draw.plan === "hundred";
  const planLabel = draw.plan === "hundred" ? "100連ガチャ" : draw.plan === "multi" ? "10連ガチャ" : "ガチャ";

  // 100連は「10連を10回」と同じ体験になるよう、10個ずつのセットに分ける
  const rounds = useMemo(() => {
    if (isHundred) return chunk(draw.results, ROUND_SIZE);
    return draw.results.length > 0 ? [draw.results] : [];
  }, [draw.results, isHundred]);

  const [roundIndex, setRoundIndex] = useState(0);
  const [opened, setOpened] = useState<boolean[]>(() => (rounds[0] ?? []).map(() => false));
  const [introDone, setIntroDone] = useState(false);
  const [view, setView] = useState<View>(() => ((rounds[0]?.length ?? 0) > 1 ? "tray" : "scene"));
  const [sceneIndex, setSceneIndex] = useState(0);
  const queueRef = useRef<number[]>([]);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const [auto, setAuto] = useState(readAutoPreference);
  const finishedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const drawRef = useRef(draw);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    drawRef.current = draw;
  }, [draw, onComplete]);

  useEffect(() => {
    setGachaAudioPlaybackRate(playbackRate);
    return () => setGachaAudioPlaybackRate(1);
  }, [playbackRate]);

  const togglePlaybackRate = useCallback(() => {
    setPlaybackRate((current) => (current === 1 ? 2 : current === 2 ? 3 : 1));
  }, []);

  const toggleAuto = useCallback(() => {
    setAuto((current) => {
      writeAutoPreference(!current);
      return !current;
    });
  }, []);

  // 出てくるものの絵は、先に読みこんでおく
  useEffect(() => {
    const sources = new Set<string>();
    for (const result of draw.results) if (result.image) sources.add(result.image);
    void preloadImages([...sources], 8000);
  }, [draw.results]);

  const finishAll = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCompleteRef.current(drawRef.current);
  }, []);

  useEffect(() => {
    if (rounds.length === 0) finishAll();
  }, [rounds.length, finishAll]);

  const round = useMemo(() => rounds[roundIndex] ?? [], [roundIndex, rounds]);
  const isTrayRound = round.length > 1;

  const advanceRound = useCallback(() => {
    const next = roundIndex + 1;
    if (next >= rounds.length) {
      finishAll();
      return;
    }
    queueRef.current = [];
    setRoundIndex(next);
    setOpened((rounds[next] ?? []).map(() => false));
    setIntroDone(false);
    setSceneIndex(0);
    setView((rounds[next]?.length ?? 0) > 1 ? "tray" : "scene");
  }, [finishAll, roundIndex, rounds]);

  const markOpened = useCallback((index: number) => {
    setOpened((current) => (current[index] ? current : current.map((value, i) => (i === index ? true : value))));
  }, []);

  const openScene = useCallback((index: number) => {
    setSceneIndex(index);
    setView("scene");
  }, []);

  /** 「ぜんぶ開ける」：のこりのSSR以上を、レアの低い順に（最後がいちばん良いもの） */
  const openRest = useCallback(() => {
    const rest = round
      .map((result, index) => ({ index, rank: RANK[validRarity(result.rarity)] }))
      .filter(({ index }) => !opened[index])
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(({ index }) => index);
    const [first, ...others] = rest;
    if (first === undefined) return;
    queueRef.current = others;
    openScene(first);
  }, [openScene, opened, round]);

  const completeScene = useCallback(() => {
    if (!isTrayRound) {
      advanceRound();
      return;
    }
    markOpened(sceneIndex);
    const [next, ...others] = queueRef.current;
    if (next !== undefined) {
      queueRef.current = others;
      setSceneIndex(next);
      return;
    }
    setView("tray");
  }, [advanceRound, isTrayRound, markOpened, sceneIndex]);

  const hasNextRound = isHundred && roundIndex + 1 < rounds.length;
  const roundLabel = rounds.length > 1 ? `${roundIndex + 1}/${rounds.length}セット目` : null;
  const eyebrow = roundLabel ? `${planLabel}　${roundLabel}` : planLabel;

  if (round.length === 0) return null;

  if (isTrayRound && view === "tray") {
    return (
      <TrayStage
        key={`tray-${roundIndex}`}
        results={round}
        promotion={rounds.length === 1 ? draw.promotion : undefined}
        eyebrow={eyebrow}
        intro={!introDone}
        autoTurn={roundIndex > 0}
        opened={opened}
        playbackRate={playbackRate}
        auto={auto}
        onTogglePlaybackRate={togglePlaybackRate}
        onToggleAuto={toggleAuto}
        onIntroDone={() => setIntroDone(true)}
        onOpened={markOpened}
        onOpenScene={openScene}
        onOpenRest={openRest}
        onRoundDone={advanceRound}
        onSkipAll={finishAll}
        onSkipRound={hasNextRound ? advanceRound : undefined}
      />
    );
  }

  const result = round[isTrayRound ? sceneIndex : 0];
  if (!result) return null;

  return (
    <CapsuleScene
      key={`scene-${roundIndex}-${isTrayRound ? sceneIndex : 0}`}
      result={result}
      mode={isTrayRound ? "tray" : "machine"}
      eyebrow={isTrayRound ? `${eyebrow}　${sceneIndex + 1}個目` : eyebrow}
      playbackRate={playbackRate}
      auto={auto}
      onTogglePlaybackRate={togglePlaybackRate}
      onToggleAuto={toggleAuto}
      onComplete={completeScene}
      onSkipAll={finishAll}
      onSkipRound={hasNextRound ? advanceRound : undefined}
    />
  );
}
