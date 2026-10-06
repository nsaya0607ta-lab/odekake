"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { playGachaCue } from "./audio";
import styles from "./gacha-cinematic.module.css";

type Gsap = typeof import("gsap")["gsap"];

/**
 * ランプの色（ガチャを回したときの予告）。段がすすむほど良いものが出る
 * idle は待っているあいだの、ほんのりした明かり
 */
export type LampTell = "off" | "idle" | "white" | "gold" | "rainbow" | "red" | "lr" | "mr";

export type MachineApi = {
  root: HTMLDivElement | null;
  pile: HTMLSpanElement | null;
  door: HTMLSpanElement | null;
  /** ハンドルを1回まわす（タップやオートで回したとき。音は呼ぶ側で鳴らす） */
  spin: (duration?: number) => void;
  setTell: (tell: LampTell) => void;
};

type Props = {
  /** ハンドルを回せる（演出が待っている）あいだだけ true */
  awaitingTurn: boolean;
  /** 指で回しきった・タップした・キーボードで押したときに1回だけ呼ぶ */
  onTurn: () => void;
  className?: string;
};

/** これだけ回したら、指をはなしても回ったことにする */
const TURN_ON_RELEASE = 110;
/** これだけ回したら、その場で回ったことにする */
const TURN_COMPLETE = 300;
/** カチッと鳴らす間かく */
const TICK_EVERY = 45;

/**
 * ガチャマシン（本体・ドームの中のカプセルの山・ガラス・ランプ・ハンドル・取り出し口のフタ）。
 * ハンドルは指でつかんで回せる（どちら向きでもよい）。タップやキーボードでも回る。
 */
export const GachaMachine = forwardRef<MachineApi, Props>(function GachaMachine({ awaitingTurn, onTurn, className }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLSpanElement>(null);
  const doorRef = useRef<HTMLSpanElement>(null);
  const lampRef = useRef<HTMLSpanElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const gsapRef = useRef<Gsap | null>(null);
  const angle = useRef({ deg: 0 });
  const tweenRef = useRef<{ kill: () => void } | null>(null);
  const drag = useRef<{ id: number; last: number; signed: number; base: number; nextTick: number; moved: boolean } | null>(null);
  const turnedRef = useRef(false);
  const onTurnRef = useRef(onTurn);

  useEffect(() => {
    onTurnRef.current = onTurn;
  }, [onTurn]);

  // 待ちに入るたびに、もう一度回せるようにする
  useEffect(() => {
    if (awaitingTurn) turnedRef.current = false;
  }, [awaitingTurn]);

  useEffect(() => {
    let alive = true;
    void import("gsap").then(({ gsap }) => {
      if (alive) gsapRef.current = gsap;
    });
    return () => {
      alive = false;
      tweenRef.current?.kill();
    };
  }, []);

  const setKnob = (deg: number) => {
    angle.current.deg = deg;
    if (knobRef.current) knobRef.current.style.transform = `rotate(${deg}deg)`;
  };

  /** 今の角度から、向きにそって次のひと回りの区切りまで回す */
  const spinTo = (direction: 1 | -1, duration: number) => {
    const gsap = gsapRef.current;
    const from = angle.current.deg;
    const target = direction > 0 ? Math.ceil((from + 40) / 360) * 360 : Math.floor((from - 40) / 360) * 360;
    tweenRef.current?.kill();
    if (!gsap) {
      setKnob(target);
      return;
    }
    tweenRef.current = gsap.to(angle.current, {
      deg: target,
      duration,
      ease: "power2.inOut",
      onUpdate: () => setKnob(angle.current.deg),
    });
  };

  const complete = (direction: 1 | -1, duration: number) => {
    if (turnedRef.current) return;
    turnedRef.current = true;
    drag.current = null;
    spinTo(direction, duration);
    onTurnRef.current();
  };

  useImperativeHandle(ref, () => ({
    get root() {
      return rootRef.current;
    },
    get pile() {
      return pileRef.current;
    },
    get door() {
      return doorRef.current;
    },
    spin: (duration = 0.8) => spinTo(1, duration),
    setTell: (tell) => {
      if (lampRef.current) lampRef.current.dataset.tell = tell;
    },
  }));

  const angleAt = (event: PointerEvent<HTMLElement>) => {
    const rect = knobRef.current?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    return (Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180) / Math.PI;
  };

  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const springBack = () => {
    const gsap = gsapRef.current;
    const base = drag.current?.base ?? 0;
    drag.current = null;
    if (!gsap) {
      setKnob(base);
      return;
    }
    tweenRef.current?.kill();
    tweenRef.current = gsap.to(angle.current, { deg: base, duration: 0.5, ease: "elastic.out(1, .5)", onUpdate: () => setKnob(angle.current.deg) });
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!awaitingTurn || turnedRef.current) return;
    event.preventDefault();
    tweenRef.current?.kill();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, last: angleAt(event), signed: 0, base: angle.current.deg, nextTick: TICK_EVERY, moved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId || turnedRef.current) return;
    const now = angleAt(event);
    const delta = ((now - state.last + 540) % 360) - 180;
    state.last = now;
    state.signed += delta;
    if (Math.abs(state.signed) > 6) state.moved = true;
    setKnob(state.base + state.signed);
    const progress = Math.abs(state.signed);
    while (progress >= state.nextTick) {
      playGachaCue("tick", state.nextTick / TICK_EVERY);
      if (navigator.vibrate) navigator.vibrate(6);
      state.nextTick += TICK_EVERY;
    }
    if (progress >= TURN_COMPLETE) {
      release(event);
      complete(state.signed >= 0 ? 1 : -1, 0.32);
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    release(event);
    if (!state || state.id !== event.pointerId || turnedRef.current) return;
    if (!state.moved) {
      // タップだけでも回る
      complete(1, 0.8);
      return;
    }
    if (Math.abs(state.signed) >= TURN_ON_RELEASE) complete(state.signed >= 0 ? 1 : -1, 0.45);
    else springBack();
  };

  const onPointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    release(event);
    if (drag.current && !turnedRef.current) springBack();
  };

  // キーボード（Enter・スペース）で押したとき。指のタップは pointerup で受けているので、ここでは無視する
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0 || !awaitingTurn) return;
    complete(1, 0.8);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      if (awaitingTurn) complete(1, 0.8);
    }
  };

  return (
    <div ref={rootRef} className={`${styles.machine} ${className ?? ""}`} data-awaiting={awaitingTurn}>
      <span className={styles.machineBody} aria-hidden="true" />
      <span className={styles.machineDome} aria-hidden="true">
        <span ref={pileRef} className={styles.machinePile} />
      </span>
      <span className={styles.machineGlass} aria-hidden="true" />
      <span ref={lampRef} className={styles.machineLamp} data-tell="idle" aria-hidden="true" />
      <span ref={doorRef} className={styles.machineDoor} aria-hidden="true" />
      <button
        type="button"
        className={styles.machineHandle}
        disabled={!awaitingTurn}
        aria-label="ハンドルを回す"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {awaitingTurn ? (
          <svg className={styles.turnGuide} viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 6 A44 44 0 1 1 13 26" />
            <path d="M5 21 L13 26 L17 16" />
          </svg>
        ) : null}
        <span ref={knobRef} className={styles.machineKnob} />
      </button>
    </div>
  );
});
