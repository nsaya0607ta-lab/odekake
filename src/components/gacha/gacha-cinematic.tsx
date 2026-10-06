"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import type { GachaRarity } from "@/lib/gacha/config";
import { playGachaCue, setGachaAudioPlaybackRate } from "./audio";
import styles from "./gacha-cinematic.module.css";
import type { AnimationDraw, DrawResult } from "./types";
import { lockPageScroll } from "@/lib/scroll-lock";
import { MachineArtwork, DoorArtwork, IllustratedHandle, IllustratedCapsule } from "./illustrated-artwork";

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
const ROUND_SIZE = 10;

function validRarity(rarity: string): GachaRarity {
  return (["N", "R", "SR", "SSR", "UR", "LR", "MR"] as const).includes(rarity as GachaRarity)
    ? (rarity as GachaRarity)
    : "N";
}

function hasTellRarity(results: DrawResult[], rarities: readonly GachaRarity[]): boolean {
  return results.some((result) => rarities.includes(validRarity(result.rarity)));
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function applyPromotedCapsuleStyle(capsule: HTMLDivElement, rarity: Extract<GachaRarity, "LR" | "MR">) {
  capsule.dataset.rarity = rarity;
  capsule.querySelectorAll("image").forEach((image) => image.setAttribute("href", `/gacha/illustrated/capsule-${rarity}.jpg`));
  const rareClassName = styles.batchCapsuleRare;
  if (rareClassName) capsule.classList.add(rareClassName);
}

/** モーダル表示中は、うしろのページがスクロールしないようにする（くわしくは scroll-lock.ts） */
function useBodyScrollLock() {
  useEffect(() => lockPageScroll(), []);
}

function useModalFocus(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"))
        .filter((button) => button.offsetParent !== null);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) {
        event.preventDefault(); first.focus();
      }
    };
    root.addEventListener("keydown", trap);
    return () => {
      root.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [rootRef]);
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
  planLabel: string;
  roundLabel: string | null;
  playbackRate: PlaybackRate;
  onTogglePlaybackRate: () => void;
  onComplete: () => void;
  onSkipAll: () => void;
  onSkipRound?: () => void;
};

/** LR以上が混じっているときに、ガチャを回す瞬間だけ強めに揺らして予兆にする */
const SHAKE_TELL_RARITIES: readonly GachaRarity[] = ["LR", "MR"];

function MultiCapsuleIntro({ results, promotion, planLabel, roundLabel, playbackRate, onTogglePlaybackRate, onComplete, onSkipAll, onSkipRound }: MultiCapsuleIntroProps) {
  const eyebrowLabel = roundLabel ? `${planLabel}　${roundLabel}` : planLabel;
  const columns = 5;
  const hasShakeTell = useMemo(() => hasTellRarity(results, SHAKE_TELL_RARITIES), [results]);
  const hasMrTell = useMemo(() => hasTellRarity(results, ["MR"]), [results]);
  const [batchPhase, setBatchPhase] = useState("ガチャ起動");
  const [awaitingTurn, setAwaitingTurn] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useModalFocus(rootRef);
  const machineRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const doorRef = useRef<HTMLSpanElement>(null);
  const capsuleRefs = useRef<HTMLDivElement[]>([]);
  const flashRef = useRef<HTMLDivElement>(null);
  const promotionCopyRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<ParticleHandle>(null);
  const timelineRef = useRef<GsapTimeline | null>(null);
  const playbackRateRef = useRef<PlaybackRate>(playbackRate);
  const completedRef = useRef(false);
  const completeRef = useRef(onComplete);
  const skipRef = useRef(onSkipAll);
  const skipRoundRef = useRef(onSkipRound);
  useEffect(() => {
    completeRef.current = onComplete;
    skipRef.current = onSkipAll;
    skipRoundRef.current = onSkipRound;
  }, [onComplete, onSkipAll, onSkipRound]);

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

  const skipRound = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    timelineRef.current?.kill();
    skipRoundRef.current?.();
  }, []);

  const turnHandle = useCallback(() => {
    if (!timelineRef.current?.paused()) return;
    setAwaitingTurn(false);
    setBatchPhase("ガチャ起動");
    timelineRef.current.resume();
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

      // LR以上が混ざっているときは通常より大きく・長く揺らして予兆にする。
      const shakeKeyframes = hasShakeTell
        ? [{ x: -16, rotation: -4.5 }, { x: 15, rotation: 4 }, { x: -13, rotation: -3.5 }, { x: 11, rotation: 3 }, { x: -6, rotation: -1.5 }, { x: 0, rotation: 0 }]
        : [{ x: -8, rotation: -2 }, { x: 8, rotation: 1.8 }, { x: -6, rotation: -1.2 }, { x: 0, rotation: 0 }];
      const shakeDuration = hasShakeTell ? 0.9 : 0.72;

      tl.fromTo(machineRef.current, { opacity: 0, scale: 0.78, y: 22, xPercent: -50, yPercent: -50 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.4)" })
        .addPause(undefined, () => {
          setBatchPhase("ハンドルを回してね");
          setAwaitingTurn(true);
        })
        .call(() => playGachaCue("turn"))
        .to(machineRef.current, { keyframes: shakeKeyframes, duration: shakeDuration, ease: hasShakeTell ? "power2.inOut" : "none" })
        .to(knobRef.current, { rotation: 720, duration: 1.1, ease: "power3.inOut" }, "<");

      if (hasShakeTell) {
        tl.call(() => { if (navigator.vibrate) navigator.vibrate(hasMrTell ? [30, 20, 30] : 45); }, undefined, "<");
      }
      // MRのときは、回した瞬間にマシン自体を光らせて別格だとわかるようにする。
      if (hasMrTell) {
        tl.to(machineRef.current, { filter: "brightness(2.4) drop-shadow(0 0 26px #ffe9a8)", duration: 0.14 }, "<")
          .call(() => particlesRef.current?.burst("MR", "mega"), undefined, "<")
          .to(machineRef.current, { filter: "brightness(1) drop-shadow(0 0 0px transparent)", duration: 0.55 });
      }

      tl.to(doorRef.current, { rotationX: -82, duration: 0.22 })
        .call(() => setBatchPhase(`${results.length}個のカプセル排出！`));
      tl.addLabel("capsuleDrop");

      const offsetUnit = 48;

      capsules.forEach((capsule, index) => {
        const column = index % columns;
        const at = `capsuleDrop+=${(index * MULTI_DROP_INTERVAL).toFixed(3)}`;
        tl.call(() => playGachaCue("drop"), undefined, at)
          .fromTo(
            capsule,
            { opacity: 0, x: (Math.floor(columns / 2) - column) * offsetUnit, y: -210 - (index % 2) * 22, scale: 0.34, rotation: -150 + index * 19 },
            { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: MULTI_DROP_DURATION, ease: "bounce.out" },
            at,
          );
      });

      const dropSequenceDuration = Math.max(0, capsules.length - 1) * MULTI_DROP_INTERVAL + MULTI_DROP_DURATION;
      tl.to(machineRef.current, { opacity: 0.68, scale: 0.94, duration: 0.3 }, `capsuleDrop+=${dropSequenceDuration.toFixed(3)}`)
        .to(doorRef.current, { rotationX: 0, duration: 0.22 }, "<");

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
    }).catch(() => { if (!disposed) complete(); });

    return () => {
      disposed = true;
      timelineRef.current?.kill();
      timelineRef.current = null;
    };
  }, [columns, complete, hasMrTell, hasShakeTell, promotion, results]);

  return (
    <div ref={rootRef} className={`${styles.root} ${styles.batchRoot}`} role="dialog" tabIndex={-1} aria-modal="true" aria-label={`${eyebrowLabel}のカプセル排出演出`}>
      <div className={styles.backdrop} />
      <div className={styles.ambient} />
      <div className={styles.vignette} />
      <div className={styles.hud}>
        <div>
          <p className={styles.eyebrow}>{eyebrowLabel}</p>
          <p className={styles.phase} aria-live="polite">{batchPhase}</p>
        </div>
      </div>
      <button type="button" className={styles.speed} data-active={playbackRate > 1} onClick={onTogglePlaybackRate} aria-label={`演出速度 ${playbackRate}倍`} aria-pressed={playbackRate > 1}>
        <span>×{playbackRate}</span><small>倍速</small>
      </button>
      <button type="button" className={styles.skip} onClick={skipAll}>すべてスキップ</button>
      {onSkipRound && (
        <button type="button" className={styles.skipRound} onClick={skipRound}>次の10連へ</button>
      )}

      <div className={styles.batchStage}>
        <div ref={machineRef} className={styles.batchMachineWrap} data-running={batchPhase === "ガチャ起動" && !awaitingTurn}>
          <MachineArtwork />
          <div className={styles.domeCapsules} aria-hidden="true">
            {(["N", "R", "SR", "R", "N", "SR"] as const).map((r, index) => <span key={index}><IllustratedCapsule rarity={r} /></span>)}
          </div>
          <span className={styles.predictionLamp} data-lit={batchPhase === "ガチャ起動" && !awaitingTurn} data-tell={hasMrTell ? "MR" : hasShakeTell ? "LR" : results.some((r) => ["SR", "SSR", "UR"].includes(r.rarity)) ? "gold" : "normal"} />
          <IllustratedHandle knobRef={knobRef} active={awaitingTurn} onTurn={turnHandle} />
          <span ref={doorRef} className={styles.machineDoor}><DoorArtwork /></span>
        </div>

        <div className={styles.batchTray} aria-label={`排出された${results.length}個のカプセル`}>
          {results.map((result, index) => {
            const isPromotionTarget = promotion?.index === index;
            const capsuleRarity = isPromotionTarget && promotion
              ? promotion.fromRarity
              : validRarity(result.rarity);
            return (
              <div
                key={`${result.id}-${index}`}
                ref={(node) => { if (node) capsuleRefs.current[index] = node; }}
                className={`${styles.batchCapsule} ${["SSR", "UR", "LR", "MR"].includes(capsuleRarity) ? styles.batchCapsuleRare : ""}`}
                data-rarity={capsuleRarity}
                aria-label={`${index + 1}個目のカプセル`}
              >
                <span className={styles.batchCapsuleGlow} />
                <IllustratedCapsule rarity={capsuleRarity} />
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

      {awaitingTurn && <button className={styles.interactionHint} type="button" autoFocus onClick={turnHandle}>ハンドルを回す ↻</button>}
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
  roundLabel: string | null;
  playbackRate: PlaybackRate;
  onTogglePlaybackRate: () => void;
  onSceneComplete: () => void;
  onSkipAll: () => void;
  onSkipRound?: () => void;
};

function GachaCinematicScene({ result, current, total, capsuleOnly, planLabel, roundLabel, playbackRate, onTogglePlaybackRate, onSceneComplete, onSkipAll, onSkipRound }: SceneProps) {
  const rarity = validRarity(result.rarity);
  const hasShakeTell = rarity === "LR" || rarity === "MR";
  const hasMrTell = rarity === "MR";
  const [phase, setPhase] = useState<Phase>("準備中");
  const [interaction, setInteraction] = useState<"turn" | "open" | null>(null);
  const completeRef = useRef(false);
  const sceneCompleteRef = useRef(onSceneComplete);
  const skipAllRef = useRef(onSkipAll);
  const skipRoundRef = useRef(onSkipRound);

  useEffect(() => {
    sceneCompleteRef.current = onSceneComplete;
    skipAllRef.current = onSkipAll;
    skipRoundRef.current = onSkipRound;
  }, [onSceneComplete, onSkipAll, onSkipRound]);

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

  const skipRound = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    timelineRef.current?.kill();
    skipRoundRef.current?.();
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  useModalFocus(rootRef);
  const machineRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const doorRef = useRef<HTMLSpanElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const capsuleGlowRef = useRef<HTMLSpanElement>(null);
  const capsuleTopRef = useRef<HTMLSpanElement>(null);
  const capsuleBottomRef = useRef<HTMLSpanElement>(null);
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

  const resumeInteraction = useCallback(() => {
    if (completeRef.current || !timelineRef.current?.paused()) return;
    setInteraction(null);
    timelineRef.current.resume();
  }, []);

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
        // LR以上は回した瞬間に大きく揺れて予兆、MRはさらにマシン自体が光る。
        const turnShakeKeyframes = hasShakeTell
          ? [{ x: -14, rotation: -3.6 }, { x: 14, rotation: 3.2 }, { x: -10, rotation: -2.6 }, { x: 9, rotation: 2 }, { x: -5, rotation: -1 }, { x: 0, rotation: 0 }]
          : [{ x: -7, rotation: -1.8 }, { x: 7, rotation: 1.6 }, { x: -5, rotation: -1.1 }, { x: 5, rotation: 1 }, { x: 0, rotation: 0 }];
        const turnShakeDuration = hasShakeTell ? 0.84 : 0.68;

        tl.call(() => {
          setPhase("ガチャ起動");
        })
          .fromTo(machine, { opacity: 0, scale: 0.84, y: 36, xPercent: -50, yPercent: -50 }, { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "back.out(1.35)" })
          .addPause(undefined, () => setInteraction("turn"))
          .call(() => playGachaCue("turn"))
          .to(machine, { keyframes: turnShakeKeyframes, duration: turnShakeDuration, ease: hasShakeTell ? "power2.inOut" : "none" }, ">-0.08")
          .to(knob, { rotation: 360, duration: 0.78, ease: "power3.inOut" }, "<0.03");

        if (hasShakeTell) {
          tl.call(() => { if (navigator.vibrate) navigator.vibrate(hasMrTell ? [30, 20, 30] : 45); }, undefined, "<");
        }
        if (hasMrTell) {
          tl.to(machine, { filter: "brightness(2.4) drop-shadow(0 0 26px #ffe9a8)", duration: 0.14 }, "<")
            .call(() => particlesRef.current?.burst("MR", "mega"), undefined, "<")
            .to(machine, { filter: "brightness(1) drop-shadow(0 0 0px transparent)", duration: 0.55 });
        }

        tl.to(doorRef.current, { rotationX: -82, duration: 0.22 })
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

      tl.addPause(undefined, () => {
          setPhase("カプセル開封");
          setInteraction("open");
        })
        .to(blackout, { opacity: blackoutOpacity, duration: 0.46 })
        .call(() => {
          setPhase("力をためている…");
          playGachaCue("charge");
        })
        .to(capsuleGlow, { opacity: 1, scale: 1.16, duration: 0.32 }, "<")
        .to(capsule, { keyframes: [{ x: -5 }, { x: 6 }, { x: -4 }, { x: 5 }, { x: 0 }], filter: "brightness(1.6)", duration: 0.62, ease: "none" }, "<0.18")
        .to(cracks, { opacity: 1, duration: 0.08 })
        .to(crackLines, { strokeDashoffset: 0, duration: 0.32, stagger: 0.035, ease: "power3.out" }, "<")
        .call(() => playGachaCue("crack"), undefined, "<")
        .to(capsuleTopRef.current, { yPercent: -72, rotation: -16, opacity: 0, duration: 0.58, ease: "power2.out" })
        .to(capsuleBottomRef.current, { yPercent: 54, rotation: 12, opacity: 0, duration: 0.58, ease: "power2.out" }, "<")
        .to(specialBackgroundRef.current, { opacity: 1, duration: 0.65 }, "<")
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
    }).catch(() => { if (!disposed) completeScene(); });

    return () => {
      disposed = true;
      timelineRef.current?.kill();
      timelineRef.current = null;
    };
  }, [capsuleOnly, completeScene, current, hasMrTell, hasShakeTell, rarity, result]);

  const image = result.image;
  return (
    <div ref={rootRef} className={styles.root} data-rarity={rarity} role="dialog" tabIndex={-1} aria-modal="true" aria-label={`${total > 1 ? `${current}個目` : "1回"}のガチャ演出`}>
      <div className={styles.backdrop} />
      {rarity === "LR" || rarity === "MR" ? <div ref={specialBackgroundRef} className={styles.specialBackground} data-rarity={rarity} /> : null}
      <div className={styles.ambient} />
      <div ref={atmosphereRef} className={styles.rarityAtmosphere} />
      <div className={styles.vignette} />

      <div className={styles.hud}>
        <div>
          <p className={styles.eyebrow}>
            {total > 1 && planLabel
              ? `${planLabel}${roundLabel ? `　${roundLabel}` : ""}　${current} / ${total}`
              : "GACHA CINEMATIC"}
          </p>
          <p className={styles.phase} aria-live="polite">{phase}</p>
        </div>
      </div>
      <button type="button" className={styles.speed} data-active={playbackRate > 1} onClick={onTogglePlaybackRate} aria-label={`演出速度 ${playbackRate}倍`} aria-pressed={playbackRate > 1}>
        <span>×{playbackRate}</span><small>倍速</small>
      </button>
      <button type="button" className={styles.skip} onClick={skipAll} aria-label="残りのガチャ演出をすべてスキップ">
        {total > 1 ? "すべてスキップ" : "スキップ"}
      </button>
      {onSkipRound && (
        <button type="button" className={styles.skipRound} onClick={skipRound}>次の10連へ</button>
      )}

      <div className={styles.stage}>
        <div className={styles.floor} />
        <div ref={machineRef} className={styles.machineWrap} data-running={phase === "ガチャ起動" && interaction !== "turn"}>
          <MachineArtwork />
          <div className={styles.domeCapsules} aria-hidden="true">
            {(["N", "R", "SR", "R", "N", "SR"] as const).map((r, index) => <span key={index}><IllustratedCapsule rarity={r} /></span>)}
          </div>
          <span className={styles.predictionLamp} data-lit={phase === "ガチャ起動" && interaction !== "turn"} data-tell={hasMrTell ? "MR" : hasShakeTell ? "LR" : ["SR", "SSR", "UR"].includes(rarity) ? "gold" : "normal"} />
          <IllustratedHandle knobRef={knobRef} active={interaction === "turn"} onTurn={resumeInteraction} />
          <span ref={doorRef} className={styles.machineDoor}><DoorArtwork /></span>
        </div>

        <div ref={beamRef} className={styles.beam} />
        <div ref={capsuleRef} className={styles.capsuleWrap} aria-label={`${rarity}カプセル`}>
          <span ref={capsuleGlowRef} className={styles.capsuleGlow} />
          <span ref={capsuleTopRef} className={styles.capsuleHalf}><IllustratedCapsule rarity={rarity} part="top" /></span>
          <span ref={capsuleBottomRef} className={styles.capsuleHalf}><IllustratedCapsule rarity={rarity} part="bottom" /></span>
          {interaction === "open" && <button type="button" className={styles.capsuleOpenButton} onClick={resumeInteraction} aria-label="カプセルを開ける" />}
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

      {interaction && <button className={styles.interactionHint} type="button" autoFocus onClick={resumeInteraction}>{interaction === "turn" ? "ハンドルを回す ↻" : "タップして開ける ✨"}</button>}
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

type CinematicPhase = "batch" | "scene";

type CinematicState = {
  roundIndex: number;
  phase: CinematicPhase;
  itemIndex: number;
};

function phaseFor(plan: AnimationDraw["plan"], round: DrawResult[] | undefined): CinematicPhase {
  const showBatch = (plan === "multi" || plan === "hundred") && (round?.length ?? 0) > 1;
  return showBatch ? "batch" : "scene";
}

export function GachaCinematic({ draw, onComplete }: { draw: AnimationDraw; onComplete: (draw: AnimationDraw) => void }) {
  useBodyScrollLock();
  const isHundred = draw.plan === "hundred";
  const planLabel = draw.plan === "hundred" ? "100連ガチャ" : draw.plan === "multi" ? "10連ガチャ" : null;

  // 100連は「10連を10回」と同じ体験になるよう、10個ずつのセットに分けて
  // セットごとにカプセル一括排出→1件ずつの本演出を繰り返す。
  const rounds = useMemo(() => {
    if (isHundred) return chunk(draw.results, ROUND_SIZE);
    return draw.results.length > 0 ? [draw.results] : [];
  }, [draw.results, isHundred]);

  const [state, setState] = useState<CinematicState>(() => ({
    roundIndex: 0,
    phase: phaseFor(draw.plan, rounds[0]),
    itemIndex: 0,
  }));
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
    for (const result of draw.results) {
      if (!result.image) continue;
      const image = new Image();
      image.src = result.image;
    }
    // Preload the small illustrated parts once the already-drawn results arrive.
    for (const name of ["machine", "handle", "door", "background-shop", ...["N", "R", "SR", "SSR", "UR", "LR", "MR"].map((r) => `capsule-${r}`)]) {
      const image = new Image();
      image.src = `/gacha/illustrated/${name}.jpg`;
    }
    for (const rarity of ["LR", "MR"]) {
      if (!draw.results.some((r) => r.rarity === rarity)) continue;
      const image = new Image();
      image.src = `/gacha/illustrated/background-${rarity}.jpg`;
    }
  }, [draw.results]);

  const finishAll = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCompleteRef.current(drawRef.current);
  }, []);

  useEffect(() => {
    if (rounds.length === 0) finishAll();
  }, [rounds.length, finishAll]);

  const completeBatchIntro = useCallback(() => {
    setState((previous) => ({ ...previous, phase: "scene" }));
  }, []);

  const advanceToRound = useCallback((nextRoundIndex: number) => {
    if (nextRoundIndex >= rounds.length) {
      finishAll();
      return;
    }
    setState({ roundIndex: nextRoundIndex, phase: phaseFor(draw.plan, rounds[nextRoundIndex]), itemIndex: 0 });
  }, [draw.plan, finishAll, rounds]);

  const completeCurrentScene = useCallback(() => {
    const round = rounds[state.roundIndex] ?? [];
    if (state.itemIndex + 1 < round.length) {
      setState((previous) => ({ ...previous, itemIndex: previous.itemIndex + 1 }));
      return;
    }
    advanceToRound(state.roundIndex + 1);
  }, [advanceToRound, rounds, state.itemIndex, state.roundIndex]);

  // 100連だけ「次の10連へ」で、いま演出中のセットを丸ごと飛ばして次のセットの
  // カプセル排出から見せる（すべてスキップ＝全部終了、とは別の一段階だけの早送り）。
  const skipToNextRound = useCallback(() => {
    advanceToRound(state.roundIndex + 1);
  }, [advanceToRound, state.roundIndex]);
  const hasNextRound = isHundred && state.roundIndex + 1 < rounds.length;

  const round = rounds[state.roundIndex] ?? [];
  const roundLabel = rounds.length > 1 ? `${state.roundIndex + 1}/${rounds.length}セット目` : null;

  if (state.phase === "batch") {
    return (
      <MultiCapsuleIntro
        key={state.roundIndex}
        results={round}
        promotion={rounds.length === 1 ? draw.promotion : undefined}
        planLabel={planLabel ?? ""}
        roundLabel={roundLabel}
        playbackRate={playbackRate}
        onTogglePlaybackRate={togglePlaybackRate}
        onComplete={completeBatchIntro}
        onSkipAll={finishAll}
        onSkipRound={hasNextRound ? skipToNextRound : undefined}
      />
    );
  }

  const result = round[state.itemIndex];
  if (!result) return null;

  const capsuleOnly = (draw.plan === "multi" || isHundred) && round.length > 1;

  return (
    <GachaCinematicScene
      key={`${state.roundIndex}-${state.itemIndex}-${result.id}`}
      result={result}
      current={state.itemIndex + 1}
      total={round.length}
      capsuleOnly={capsuleOnly}
      planLabel={planLabel}
      roundLabel={roundLabel}
      playbackRate={playbackRate}
      onTogglePlaybackRate={togglePlaybackRate}
      onSceneComplete={completeCurrentScene}
      onSkipAll={finishAll}
      onSkipRound={hasNextRound ? skipToNextRound : undefined}
    />
  );
}
