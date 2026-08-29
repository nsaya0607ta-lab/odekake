"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GachaRarity } from "@/lib/gacha/config";
import { playGachaCue, setGachaAudioPlaybackRate } from "./audio";
import styles from "./gacha-cinematic.module.css";
import type { AnimationDraw, DrawResult } from "./types";

type Phase = "準備中" | "ガチャ起動" | "カプセル排出" | "カプセル開封" | "力をためている…" | "……" | "レアリティ昇格" | "結果発表";
type BurstIntensity = "normal" | "large" | "mega";
type GsapModule = typeof import("gsap");
type GsapTimeline = ReturnType<GsapModule["gsap"]["timeline"]>;
type GachaPromotion = NonNullable<AnimationDraw["promotion"]>;
type PlaybackRate = 1 | 2 | 3;

type ParticleHandle = {
  burst: (rarity: GachaRarity, intensity?: BurstIntensity) => void;
};

const MULTI_DROP_DURATION = 0.53;
const MULTI_DROP_GAP = 0.03;
const MULTI_DROP_INTERVAL = MULTI_DROP_DURATION + MULTI_DROP_GAP;
const MULTI_REVEAL_TIME_SCALE = 1.4;

/**
 * 100連は全件フル演出だと2〜3分かかってしまうため、SR以上だけ1件ずつの
 * カプセル演出を見せ、N・Rは演出を挟まず結果一覧にまとめて出す。
 */
const FULL_CINEMATIC_RARITIES = new Set<GachaRarity>(["SR", "SSR", "UR", "LR", "MR"]);

function validRarity(rarity: string): GachaRarity {
  return (["N", "R", "SR", "SSR", "UR", "LR", "MR"] as const).includes(rarity as GachaRarity)
    ? (rarity as GachaRarity)
    : "N";
}

function applyPromotedCapsuleStyle(capsule: HTMLDivElement, rarity: Extract<GachaRarity, "LR" | "MR">) {
  capsule.dataset.rarity = rarity;
  const rareClassName = styles.batchCapsuleRare;
  if (rareClassName) capsule.classList.add(rareClassName);
}

function useBodyScrollLock() {
  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      root.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, []);
}

function lowPowerDevice() {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return window.innerWidth < 520 || navigator.hardwareConcurrency <= 4 || (deviceMemory !== undefined && deviceMemory <= 4);
}

const PixiEffects = forwardRef<ParticleHandle, { enabled: boolean }>(function PixiEffects({ enabled }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<ParticleHandle["burst"]>(() => undefined);

  useImperativeHandle(ref, () => ({ burst: (rarity, intensity) => burstRef.current(rarity, intensity) }), []);

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
        N: ["#9be96b", "#eaffd8", "#f6ff9d"],
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
      ) => {
        const emitter = new particles.Emitter(app.stage, {
          lifetime: { min: lifetime[0], max: lifetime[1] },
          frequency: 0.001,
          emitterLifetime: 0.028,
          particlesPerWave: count,
          maxParticles: count,
          pos: { x: app.screen.width / 2, y: app.screen.height * 0.52 },
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

      burstRef.current = (rarity, intensity = "normal") => {
        const multiplier = intensity === "mega" ? 1.55 : intensity === "large" ? 1.2 : 1;
        const cap = lowPower ? 92 : 176;
        const sparkCount = Math.min(cap, Math.round((lowPower ? 48 : 86) * multiplier));
        const smokeCount = Math.min(lowPower ? 30 : 54, Math.round((lowPower ? 17 : 30) * multiplier));
        const palette = palettes[rarity];
        createEmitter(sparkTexture, palette, sparkCount, [lowPower ? 360 : 450, 42], [0.62, 0.1], [0.58, 1.05]);
        createEmitter(dotTexture, [palette[2], palette[1], palette[0]], smokeCount, [lowPower ? 210 : 270, 22], [1.3, 3.8], [0.72, 1.28]);

        if (rarity === "SSR") {
          window.setTimeout(() => createEmitter(sparkTexture, ["#63e6be", "#74c0fc", "#e599f7"], Math.round(sparkCount * 0.72), [340, 28], [0.54, 0.08], [0.62, 1.1]), 90);
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

type MultiCapsuleIntroProps = {
  results: DrawResult[];
  promotion?: GachaPromotion;
  playbackRate: PlaybackRate;
  onTogglePlaybackRate: () => void;
  onComplete: () => void;
  onSkipAll: () => void;
};

function MultiCapsuleIntro({ results, promotion, playbackRate, onTogglePlaybackRate, onComplete, onSkipAll }: MultiCapsuleIntroProps) {
  const drawLabel = `${results.length}連ガチャ`;
  // 10連は5列のまま。100連は10列にして、各列の粒を小さくすることで
  // 全部を1画面（+縦スクロール）で見られるようにする。
  const columns = results.length > 20 ? 10 : 5;
  const [batchPhase, setBatchPhase] = useState(`${results.length}個のカプセル排出！`);
  const rootRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const capsuleRefs = useRef<HTMLDivElement[]>([]);
  const flashRef = useRef<HTMLDivElement>(null);
  const promotionCopyRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<ParticleHandle>(null);
  const timelineRef = useRef<GsapTimeline | null>(null);
  const playbackRateRef = useRef<PlaybackRate>(playbackRate);
  const completedRef = useRef(false);
  const completeRef = useRef(onComplete);
  const skipRef = useRef(onSkipAll);
  useEffect(() => {
    completeRef.current = onComplete;
    skipRef.current = onSkipAll;
  }, [onComplete, onSkipAll]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    timelineRef.current?.timeScale(playbackRate);
  }, [playbackRate]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    timelineRef.current?.kill();
    completeRef.current();
  }, []);

  const skipAll = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    timelineRef.current?.kill();
    skipRef.current();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") skipAll();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [skipAll]);

  useEffect(() => {
    let disposed = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const capsules = capsuleRefs.current.filter(Boolean);

    if (reducedMotion) {
      for (const capsule of capsules) capsule.style.opacity = "1";
      const promotionTarget = promotion ? capsules[promotion.index] : undefined;
      if (promotionTarget && promotion) {
        applyPromotedCapsuleStyle(promotionTarget, promotion.toRarity);
      }
      const id = window.setTimeout(complete, 1000);
      return () => window.clearTimeout(id);
    }

    void import("gsap").then(({ gsap }) => {
      if (disposed || !rootRef.current || !machineRef.current || !knobRef.current) return;

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      timelineRef.current = tl;
      tl.timeScale(playbackRateRef.current);
      gsap.set(promotionCopyRef.current, { opacity: 0, scale: 0.54 });

      tl.fromTo(machineRef.current, { opacity: 0, scale: 0.78, y: 22 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.4)" })
        .call(() => playGachaCue("turn"))
        .to(machineRef.current, { keyframes: [{ x: -8, rotation: -2 }, { x: 8, rotation: 1.8 }, { x: -6, rotation: -1.2 }, { x: 0, rotation: 0 }], duration: 0.72, ease: "none" })
        .to(knobRef.current, { rotation: 720, duration: 1.1, ease: "power3.inOut" }, "<")
        .addLabel("capsuleDrop", ">-0.12");

      // 件数が多いほど間隔を詰めて、100個でも数秒でひとまとまりに落ちきるようにする。
      const dropInterval = capsules.length > 20
        ? Math.max(0.018, 2.4 / capsules.length)
        : MULTI_DROP_INTERVAL;
      const offsetUnit = (48 * 5) / columns;
      // ドロップ音が100連で鳴りっぱなしにならないよう、間引いて再生する。
      const soundStep = Math.max(1, Math.round(capsules.length / 24));

      capsules.forEach((capsule, index) => {
        const column = index % columns;
        const at = `capsuleDrop+=${(index * dropInterval).toFixed(3)}`;
        tl.call(() => {
          if (index % soundStep === 0) playGachaCue("drop");
        }, undefined, at)
          .fromTo(
            capsule,
            { opacity: 0, x: (Math.floor(columns / 2) - column) * offsetUnit, y: -210 - (index % 2) * 22, scale: 0.34, rotation: -150 + index * 19 },
            { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: MULTI_DROP_DURATION, ease: "bounce.out" },
            at,
          );
      });

      const dropSequenceDuration = Math.max(0, capsules.length - 1) * dropInterval + MULTI_DROP_DURATION;
      tl.to(machineRef.current, { opacity: 0.68, scale: 0.94, duration: 0.3 }, `capsuleDrop+=${dropSequenceDuration.toFixed(3)}`);

      const promotionTarget = promotion ? capsules[promotion.index] : undefined;
      if (promotion && promotionTarget) {
        const otherCapsules = capsules.filter((_, index) => index !== promotion.index);
        tl.to({}, { duration: 0.54 })
          .call(() => {
            setBatchPhase("……");
            playGachaCue("charge");
          })
          .to(otherCapsules, { opacity: 0.24, scale: 0.9, duration: 0.28 }, "<")
          .to(promotionTarget, {
            keyframes: [{ x: -5, rotation: -5 }, { x: 6, rotation: 5 }, { x: -4, rotation: -4 }, { x: 5, rotation: 4 }, { x: 0, rotation: 0 }],
            scale: 1.16,
            duration: 0.58,
            ease: "none",
          })
          .call(() => {
            setBatchPhase("確変発生！");
            playGachaCue("crack");
          })
          .to(promotionCopyRef.current, { opacity: 1, scale: 1, duration: 0.22, ease: "back.out(2)" }, "<")
          .to(flashRef.current, { opacity: 1, duration: 0.07 })
          .call(() => {
            applyPromotedCapsuleStyle(promotionTarget, promotion.toRarity);
            particlesRef.current?.burst(promotion.toRarity, promotion.toRarity === "MR" ? "mega" : "large");
            playGachaCue("explosion");
            if (navigator.vibrate) navigator.vibrate(promotion.toRarity === "MR" ? [40, 30, 60] : [35, 25, 40]);
          }, undefined, "<")
          .to(flashRef.current, { opacity: 0, duration: 0.3 })
          .to(promotionTarget, { scale: 1.34, duration: 0.24, ease: "back.out(1.8)" }, "<")
          .to(promotionTarget, { scale: 1, duration: 0.46, ease: "elastic.out(1, .45)" })
          .to(otherCapsules, { opacity: 1, scale: 1, duration: 0.34 }, "<0.12")
          .to(promotionCopyRef.current, { opacity: 0, scale: 1.18, duration: 0.24 }, "<")
          .to({}, { duration: 0.78 })
          .call(complete);
      } else {
        tl.to({}, { duration: 0.82 })
          .call(complete);
      }
    });

    return () => {
      disposed = true;
      timelineRef.current?.kill();
      timelineRef.current = null;
    };
  }, [columns, complete, promotion, results]);

  return (
    <div ref={rootRef} className={`${styles.root} ${styles.batchRoot}`} role="dialog" aria-modal="true" aria-label={`${drawLabel}のカプセル排出演出`}>
      <div className={styles.backdrop} />
      <div className={styles.ambient} />
      <div className={styles.vignette} />
      <div className={styles.hud}>
        <div>
          <p className={styles.eyebrow}>{drawLabel}</p>
          <p className={styles.phase} aria-live="polite">{batchPhase}</p>
        </div>
      </div>
      <button type="button" className={styles.speed} data-active={playbackRate > 1} onClick={onTogglePlaybackRate} aria-label={`演出速度 ${playbackRate}倍`} aria-pressed={playbackRate > 1}>
        <span>×{playbackRate}</span><small>倍速</small>
      </button>
      <button type="button" className={styles.skip} onClick={skipAll}>すべてスキップ</button>

      <div className={styles.batchStage}>
        <div ref={machineRef} className={styles.batchMachineWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.machine} src="/gacha/reference/lucky-paws-machine.webp" alt="ガチャマシン" draggable={false} />
          <span ref={knobRef} className={styles.knob} aria-hidden="true" />
        </div>

        <div
          className={styles.batchTray}
          aria-label={`排出された${results.length}個のカプセル`}
          style={{ "--batch-columns": columns } as CSSProperties}
        >
          {results.map((result, index) => {
            const isPromotionTarget = promotion?.index === index;
            const capsuleRarity = isPromotionTarget && promotion
              ? promotion.fromRarity
              : validRarity(result.rarity);
            return (
              <div
                key={`${result.id}-${index}`}
                ref={(node) => { if (node) capsuleRefs.current[index] = node; }}
                className={styles.batchCapsule}
                data-rarity={capsuleRarity}
                aria-label={`${index + 1}個目のカプセル`}
              >
                <span className={styles.batchCapsuleGlow} />
                <span className={styles.capsule} />
                <span className={styles.capsuleBand} />
                {isPromotionTarget ? (
                  <span className={styles.capsuleSparkles} aria-hidden="true">
                    <i /><i /><i /><i /><i /><i /><i /><i />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div ref={promotionCopyRef} className={styles.batchPromotionCopy} aria-live="assertive">確変！</div>
      </div>

      <PixiEffects ref={particlesRef} enabled />
      <div ref={flashRef} className={styles.flash} />
    </div>
  );
}

type SceneProps = {
  result: DrawResult;
  current: number;
  total: number;
  capsuleOnly: boolean;
  planLabel: string | null;
  playbackRate: PlaybackRate;
  onTogglePlaybackRate: () => void;
  onSceneComplete: () => void;
  onSkipAll: () => void;
};

function GachaCinematicScene({ result, current, total, capsuleOnly, planLabel, playbackRate, onTogglePlaybackRate, onSceneComplete, onSkipAll }: SceneProps) {
  const rarity = validRarity(result.rarity);
  const [phase, setPhase] = useState<Phase>("準備中");
  const completeRef = useRef(false);
  const sceneCompleteRef = useRef(onSceneComplete);
  const skipAllRef = useRef(onSkipAll);

  useEffect(() => {
    sceneCompleteRef.current = onSceneComplete;
    skipAllRef.current = onSkipAll;
  }, [onSceneComplete, onSkipAll]);

  const completeScene = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    timelineRef.current?.kill();
    sceneCompleteRef.current();
  }, []);

  const skipAll = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    timelineRef.current?.kill();
    skipAllRef.current();
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const capsuleGlowRef = useRef<HTMLSpanElement>(null);
  const blackoutRef = useRef<HTMLDivElement>(null);
  const atmosphereRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const cracksRef = useRef<HTMLDivElement>(null);
  const crackLineRefs = useRef<SVGPathElement[]>([]);
  const lightningRef = useRef<HTMLDivElement>(null);
  const shockwaveRefs = useRef<HTMLSpanElement[]>([]);
  const silhouetteRef = useRef<HTMLImageElement>(null);
  const itemFocusRef = useRef<HTMLSpanElement>(null);
  const itemRef = useRef<HTMLImageElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const itemCopyRef = useRef<HTMLDivElement>(null);
  const fakeResultRef = useRef<HTMLDivElement>(null);
  const freezeRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<ParticleHandle>(null);
  const timelineRef = useRef<GsapTimeline | null>(null);
  const playbackRateRef = useRef<PlaybackRate>(playbackRate);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    const sceneBaseRate = capsuleOnly ? MULTI_REVEAL_TIME_SCALE : 1;
    timelineRef.current?.timeScale(sceneBaseRate * playbackRate);
  }, [capsuleOnly, playbackRate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") skipAll();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [skipAll]);

  useEffect(() => {
    if (!rootRef.current) {
      const id = window.setTimeout(completeScene, 150);
      return () => window.clearTimeout(id);
    }

    let disposed = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setPhase("結果発表");
      const target = itemRef.current ?? placeholderRef.current;
      if (target) {
        target.style.opacity = "1";
        target.style.transform = "translate(-50%, -50%) scale(1)";
      }
      if (itemCopyRef.current) {
        itemCopyRef.current.style.opacity = "1";
        itemCopyRef.current.style.transform = "translate(-50%, 0)";
      }
      const id = window.setTimeout(completeScene, 1100);
      return () => window.clearTimeout(id);
    }

    void import("gsap").then(({ gsap }) => {
      if (disposed || !rootRef.current || !machineRef.current || !knobRef.current || !capsuleRef.current) return;

      const root = rootRef.current;
      const machine = machineRef.current;
      const knob = knobRef.current;
      const capsule = capsuleRef.current;
      const capsuleGlow = capsuleGlowRef.current;
      const blackout = blackoutRef.current;
      const atmosphere = atmosphereRef.current;
      const aura = auraRef.current;
      const beam = beamRef.current;
      const flash = flashRef.current;
      const cracks = cracksRef.current;
      const lightning = lightningRef.current;
      const silhouette = silhouetteRef.current;
      const itemFocus = itemFocusRef.current;
      const item = itemRef.current ?? placeholderRef.current;
      const itemCopy = itemCopyRef.current;
      const fakeResult = fakeResultRef.current;
      const freeze = freezeRef.current;
      const shockwaves = shockwaveRefs.current;
      const crackLines = crackLineRefs.current;
      const shockwaveOne = shockwaves[0];
      const shockwaveTwo = shockwaves[1];
      if (!shockwaveOne || !shockwaveTwo) return;

      const burst = (intensity: BurstIntensity = "normal") => {
        particlesRef.current?.burst(rarity, intensity);
        playGachaCue("explosion");
        if (navigator.vibrate) navigator.vibrate(intensity === "mega" ? [35, 30, 55] : 35);
      };

      const reveal = (timeline: GsapTimeline, at: string | number) => {
        const silhouetteOutAt = typeof at === "number" ? at + 0.3 : `${at}+=0.3`;
        const itemRevealAt = typeof at === "number" ? at + 0.44 : `${at}+=0.44`;
        timeline
          .call(() => setPhase("結果発表"), undefined, at)
          .to([beam, aura, cracks, lightning, atmosphere], { opacity: 0, duration: 0.24 }, at)
          .to(blackout, { opacity: rarity === "LR" ? 0.66 : 0.26, duration: 0.3 }, at)
          .fromTo(silhouette, { opacity: 0, scale: 0.72 }, { opacity: 0.82, scale: 1.04, duration: 0.28, ease: "power2.out" }, at)
          .to(silhouette, { opacity: 0, scale: 1.14, duration: 0.2, ease: "power2.in" }, silhouetteOutAt)
          .fromTo(itemFocus, { opacity: 0, scale: 0.56 }, { opacity: 1, scale: 1, duration: 0.38, ease: "power3.out" }, itemRevealAt)
          .fromTo(item, { opacity: 0, scale: 0.46, rotation: -3 }, { opacity: 1, scale: 1.08, rotation: 0, duration: 0.5, ease: "back.out(1.65)" }, itemRevealAt)
          .to(item, { scale: 1, duration: 0.22, ease: "power2.out" })
          .fromTo(itemCopy, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, "<0.02")
          .call(() => playGachaCue("reveal"), undefined, "<")
          .to({}, { duration: 0.92 })
          .to(item, { scale: 1.025, duration: 0.38, repeat: 1, yoyo: true, ease: "sine.inOut" })
          .call(completeScene, undefined, ">+=0.34");
      };

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      timelineRef.current = tl;
      gsap.set([blackout, atmosphere, aura, beam, flash, cracks, lightning, silhouette, itemFocus, item, itemCopy, fakeResult, freeze], { opacity: 0 });
      gsap.set(shockwaves, { opacity: 0, scale: 0.12 });
      gsap.set(crackLines, { strokeDashoffset: 380 });

      if (capsuleOnly) {
        tl.set(machine, { opacity: 0 })
          .call(() => {
            setPhase("カプセル開封");
            playGachaCue("charge");
          })
          .fromTo(
            capsule,
            { opacity: 1, xPercent: 0, yPercent: 74, scale: 0.7, rotation: -9 },
            { opacity: 1, xPercent: 0, yPercent: -8, scale: 2.18, rotation: 0, duration: 0.72, ease: "power3.inOut" },
          );
      } else {
        tl.call(() => {
          setPhase("ガチャ起動");
          playGachaCue("turn");
        })
          .fromTo(machine, { opacity: 0, scale: 0.84, y: 36 }, { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "back.out(1.35)" })
          .to(machine, { keyframes: [{ x: -7, rotation: -1.8 }, { x: 7, rotation: 1.6 }, { x: -5, rotation: -1.1 }, { x: 5, rotation: 1 }, { x: 0, rotation: 0 }], duration: 0.68, ease: "none" }, ">-0.08")
          .to(knob, { rotation: 360, duration: 0.78, ease: "power3.inOut" }, "<0.03")
          .call(() => {
            setPhase("カプセル排出");
            playGachaCue("drop");
          })
          .fromTo(capsule, { opacity: 0, xPercent: 38, yPercent: -152, scale: 0.46, rotation: -170 }, { opacity: 1, xPercent: 0, yPercent: 98, scale: 1, rotation: 12, duration: 0.64, ease: "power2.in" })
          .to(capsule, { yPercent: 50, rotation: -8, duration: 0.25, ease: "power2.out" })
          .to(capsule, { yPercent: 98, rotation: 4, duration: 0.2, ease: "power2.in" })
          .to(capsule, { yPercent: 74, rotation: 0, duration: 0.18, ease: "power2.out" })
          .to(machine, { opacity: 0, scale: 1.08, duration: 0.34 }, "<0.08")
          .to(capsule, { xPercent: 0, yPercent: -8, scale: 2.18, duration: 0.72, ease: "power3.inOut" });
      }

      const blackoutOpacity = rarity === "LR" ? 1 : rarity === "MR" ? 0.72 : rarity === "UR" ? 0.64 : rarity === "SSR" ? 0.48 : 0.56;

      tl.to(blackout, { opacity: blackoutOpacity, duration: 0.46 }, capsuleOnly ? "<0.12" : "<")
        .call(() => {
          setPhase("力をためている…");
          playGachaCue("charge");
        })
        .to(capsuleGlow, { opacity: 1, scale: 1.16, duration: 0.32 }, "<")
        .to(capsule, { keyframes: [{ x: -5 }, { x: 6 }, { x: -4 }, { x: 5 }, { x: 0 }], filter: "brightness(1.6)", duration: 0.62, ease: "none" }, "<0.18")
        .to(cracks, { opacity: 1, duration: 0.08 })
        .to(crackLines, { strokeDashoffset: 0, duration: 0.32, stagger: 0.035, ease: "power3.out" }, "<")
        .call(() => playGachaCue("crack"), undefined, "<")
        .to(beam, { opacity: 0.94, scaleX: 1, duration: 0.45, ease: "power3.out" })
        .to(atmosphere, { opacity: rarity === "SSR" ? 0.92 : 0.72, rotation: 48, duration: 0.58 }, "<")
        .to(aura, { opacity: 0.86, scale: 1, rotation: 42, duration: 0.58 }, "<")
        .to(flash, { opacity: 1, duration: 0.08 })
        .call(() => playGachaCue("flash"), undefined, "<")
        .to(flash, { opacity: 0, duration: 0.38 })
        .to(capsule, { opacity: 0, scale: 3.4, duration: 0.2 }, "<")
        .to(shockwaveOne, { opacity: 0.9, scale: 4.8, duration: 0.78, ease: "power3.out" }, "<")
        .to(shockwaveTwo, { opacity: 0.72, scale: 6.2, duration: 0.94, ease: "power3.out" }, "<0.12")
        .to(root, { keyframes: [{ x: -8, y: 3 }, { x: 8, y: -4 }, { x: -5, y: 3 }, { x: 0, y: 0 }], duration: 0.42, ease: "none" }, "<")
        .call(() => burst(rarity === "MR" ? "mega" : rarity === "LR" || rarity === "UR" ? "large" : "normal"), undefined, "<");

      if (rarity === "UR") {
        tl.to(lightning, { opacity: 1, duration: 0.06 }, "<0.04")
          .to(lightning, { opacity: 0.18, duration: 0.1, repeat: 5, yoyo: true })
          .call(() => burst("large"), undefined, ">-0.08")
          .to(flash, { opacity: 0.78, duration: 0.05 }, "<")
          .to(flash, { opacity: 0, duration: 0.25 });
      } else if (rarity === "LR") {
        tl.to(blackout, { opacity: 1, duration: 0.1 }, "<")
          .to(aura, { opacity: 1, scale: 1.22, rotation: 150, duration: 0.8, ease: "power4.out" }, "<")
          .call(() => burst("mega"), undefined, "<0.18");
      }

      if (rarity === "MR") {
        tl.to([beam, aura, cracks, atmosphere], { opacity: 0, duration: 0.2 })
          .to(blackout, { opacity: 0.44, duration: 0.18 })
          .fromTo(fakeResult, { opacity: 0, scale: 0.74 }, { opacity: 1, scale: 1, duration: 0.48, ease: "back.out(1.45)" })
          .call(() => setPhase("結果発表"), undefined, "<")
          .to(fakeResult, { scale: 1.02, duration: 0.5, ease: "sine.inOut" })
          .call(() => setPhase("……"))
          .to(freeze, { opacity: 1, duration: 0.06 })
          .to({}, { duration: 0.58 })
          .to(cracks, { opacity: 1, duration: 0.05 })
          .fromTo(crackLines, { strokeDashoffset: 380 }, { strokeDashoffset: 0, duration: 0.28, stagger: 0.025 })
          .call(() => {
            setPhase("レアリティ昇格");
            playGachaCue("crack");
          }, undefined, "<")
          .to(fakeResult, { opacity: 0, scale: 1.2, duration: 0.18 }, "<0.08")
          .to(freeze, { opacity: 0, duration: 0.12 }, "<")
          .to(blackout, { opacity: 0.94, duration: 0.14 }, "<")
          .to([beam, aura, atmosphere], { opacity: 1, duration: 0.28 }, "<")
          .to(aura, { rotation: 260, scale: 1.35, duration: 0.58 }, "<")
          .to(lightning, { opacity: 1, duration: 0.05 }, "<")
          .to(lightning, { opacity: 0.12, duration: 0.09, repeat: 6, yoyo: true })
          .to(flash, { opacity: 1, duration: 0.07 }, "<0.18")
          .call(() => burst("mega"), undefined, "<")
          .to(root, { keyframes: [{ x: -12, y: 5 }, { x: 11, y: -7 }, { x: -8, y: 5 }, { x: 6, y: -3 }, { x: 0, y: 0 }], duration: 0.56, ease: "none" }, "<")
          .to(flash, { opacity: 0, duration: 0.42 });
      }

      reveal(tl, ">");
      tl.timeScale((capsuleOnly ? MULTI_REVEAL_TIME_SCALE : 1) * playbackRateRef.current);
    });

    return () => {
      disposed = true;
      timelineRef.current?.kill();
      timelineRef.current = null;
    };
  }, [capsuleOnly, completeScene, current, rarity, result]);

  const image = result.image;
  return (
    <div ref={rootRef} className={styles.root} data-rarity={rarity} role="dialog" aria-modal="true" aria-label={`${total > 1 ? `${current}個目` : "1回"}のガチャ演出`}>
      <div className={styles.backdrop} />
      <div className={styles.ambient} />
      <div ref={atmosphereRef} className={styles.rarityAtmosphere} />
      <div className={styles.vignette} />

      <div className={styles.hud}>
        <div>
          <p className={styles.eyebrow}>{total > 1 && planLabel ? `${planLabel}　${current} / ${total}` : "GACHA CINEMATIC"}</p>
          <p className={styles.phase} aria-live="polite">{phase}</p>
        </div>
      </div>
      <button type="button" className={styles.speed} data-active={playbackRate > 1} onClick={onTogglePlaybackRate} aria-label={`演出速度 ${playbackRate}倍`} aria-pressed={playbackRate > 1}>
        <span>×{playbackRate}</span><small>倍速</small>
      </button>
      <button type="button" className={styles.skip} onClick={skipAll} aria-label="残りのガチャ演出をすべてスキップ">
        {total > 1 ? "すべてスキップ" : "スキップ"}
      </button>

      <div className={styles.stage}>
        <div className={styles.floor} />
        <div ref={machineRef} className={styles.machineWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.machine} src="/gacha/reference/lucky-paws-machine.webp" alt="ガチャマシン" draggable={false} />
          <span ref={knobRef} className={styles.knob} aria-hidden="true" />
        </div>

        <div ref={beamRef} className={styles.beam} />
        <div ref={capsuleRef} className={styles.capsuleWrap} aria-label={`${rarity}カプセル`}>
          <span ref={capsuleGlowRef} className={styles.capsuleGlow} />
          <span className={styles.capsule} />
          <span className={styles.capsuleBand} />
        </div>

        <div ref={auraRef} className={styles.auraRing} />

        <div ref={fakeResultRef} className={styles.fakeResult} aria-hidden="true">
          <div className={styles.fakeOrb}>
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" draggable={false} />
            ) : <span>?</span>}
          </div>
          <span className={styles.fakeLabel}>N</span>
          <p className={styles.fakeName}>{result.name}</p>
        </div>

        <div className={styles.reveal}>
          <span ref={itemFocusRef} className={styles.itemFocus} aria-hidden="true" />
          {image ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={silhouetteRef} className={styles.silhouette} src={image} alt="" draggable={false} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={itemRef} className={styles.item} src={image} alt={result.name} draggable={false} />
            </>
          ) : (
            <div ref={placeholderRef} className={styles.placeholder} aria-label={`${result.name}の画像は準備中です`}>?</div>
          )}
          <div ref={itemCopyRef} className={styles.itemCopy}>
            <span className={styles.rarityBadge}>{rarity}</span>
            <h2 className={styles.itemName}>{result.name}</h2>
            {result.isNew ? <span className={styles.newBadge}>NEW!</span> : null}
          </div>
        </div>
      </div>

      <PixiEffects ref={particlesRef} enabled />
      <div className={styles.shockwaves} aria-hidden="true">
        {[0, 1].map((index) => <span key={index} ref={(node) => { if (node) shockwaveRefs.current[index] = node; }} className={styles.shockwave} />)}
      </div>
      <div ref={lightningRef} className={styles.lightning} aria-hidden="true">
        <span className={styles.bolt} /><span className={styles.bolt} /><span className={styles.bolt} />
      </div>
      <div ref={cracksRef} className={styles.cracks} aria-hidden="true">
        <svg viewBox="0 0 400 400">
          {[
            "M200 200 166 149 179 111 144 74",
            "M200 200 245 158 237 122 272 84 264 49",
            "M200 200 255 218 292 205 340 224 374 207",
            "M200 200 231 256 218 291 246 341 235 384",
            "M200 200 153 245 121 236 78 278 38 273",
            "M200 200 144 184 111 202 64 179 22 192",
          ].map((path, index) => (
            <path key={path} ref={(node) => { if (node) crackLineRefs.current[index] = node; }} className={styles.crackLine} d={path} />
          ))}
        </svg>
      </div>
      <div ref={freezeRef} className={styles.freeze} />
      <div ref={blackoutRef} className={styles.blackout} />
      <div ref={flashRef} className={styles.flash} />
    </div>
  );
}

export function GachaCinematic({ draw, onComplete }: { draw: AnimationDraw; onComplete: (draw: AnimationDraw) => void }) {
  useBodyScrollLock();
  const isHundred = draw.plan === "hundred";
  // 100連も10連と同じく、まず全個数ぶんのカプセルが一括で排出される演出を見せる。
  const showBatchIntro = (draw.plan === "multi" || isHundred) && draw.results.length > 1;
  const isCapsuleOnly = showBatchIntro;
  const planLabel = draw.plan === "hundred" ? "100連ガチャ" : draw.plan === "multi" ? "10連ガチャ" : null;

  // 100連はSR以上だけを1件ずつの演出にかけ、N・Rは結果一覧にまとめて出す。
  const cinematicResults = useMemo(() => {
    if (!isHundred) return draw.results;
    return draw.results.filter((result) => FULL_CINEMATIC_RARITIES.has(validRarity(result.rarity)));
  }, [draw.results, isHundred]);

  const [batchIntroComplete, setBatchIntroComplete] = useState(!showBatchIntro);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
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
    setPlaybackRate((currentRate) => currentRate === 1 ? 2 : currentRate === 2 ? 3 : 1);
  }, []);

  useEffect(() => {
    for (const result of cinematicResults) {
      if (!result.image) continue;
      const image = new Image();
      image.src = result.image;
    }
  }, [cinematicResults]);

  const finishAll = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCompleteRef.current(drawRef.current);
  }, []);

  const completeCurrentScene = useCallback(() => {
    if (currentIndex + 1 >= cinematicResults.length) {
      finishAll();
      return;
    }
    setCurrentIndex(currentIndex + 1);
  }, [currentIndex, cinematicResults.length, finishAll]);

  useEffect(() => {
    // カプセル一括排出の演出中は、その演出自身の onComplete / onSkipAll に任せる。
    if (!batchIntroComplete) return;
    if (cinematicResults.length === 0) finishAll();
  }, [batchIntroComplete, cinematicResults.length, finishAll]);

  if (!batchIntroComplete) {
    return (
      <MultiCapsuleIntro
        results={draw.results}
        promotion={draw.promotion}
        playbackRate={playbackRate}
        onTogglePlaybackRate={togglePlaybackRate}
        onComplete={() => setBatchIntroComplete(true)}
        onSkipAll={finishAll}
      />
    );
  }

  const result = cinematicResults[currentIndex];
  if (!result) return null;

  return (
    <GachaCinematicScene
      key={`${currentIndex}-${result.id}`}
      result={result}
      current={currentIndex + 1}
      total={cinematicResults.length}
      capsuleOnly={isCapsuleOnly}
      planLabel={planLabel}
      playbackRate={playbackRate}
      onTogglePlaybackRate={togglePlaybackRate}
      onSceneComplete={completeCurrentScene}
      onSkipAll={finishAll}
    />
  );
}
