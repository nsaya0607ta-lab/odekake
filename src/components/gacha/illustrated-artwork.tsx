"use client";

import { useId, useRef, type PointerEvent, type RefObject } from "react";
import type { GachaRarity } from "@/lib/gacha/config";
import styles from "./gacha-cinematic.module.css";

const ASSETS = "/gacha/illustrated";

// Display masks follow the supplied artwork. The original JPEGs remain available
// at full resolution; white margins never cover the illustrated stage.
export function MachineArtwork() {
  const id = useId();
  return (
    <svg className={styles.machineArt} viewBox="0 0 853 1280" role="img" aria-label="肉球のガチャマシン">
      <defs>
        <clipPath id={id}>
          <path d="M432 145 C279 144 208 150 176 211 Q165 232 161 269 L180 283 C99 357 67 474 86 575 Q96 641 144 703 L136 769 L112 1019 Q96 1035 94 1060 Q88 1086 116 1102 C255 1175 629 1174 751 1113 Q767 1102 757 1073 Q757 1047 735 1029 L715 767 L709 718 Q714 705 705 694 C755 641 778 577 772 507 C768 419 740 349 688 295 Q705 287 704 268 C703 207 685 181 659 170 C610 151 516 145 432 145 Z" />
        </clipPath>
      </defs>
      <image href={`${ASSETS}/machine.jpg`} width="853" height="1280" clipPath={`url(#${id})`} />
    </svg>
  );
}

function HandleArtwork() {
  const id = useId();
  return (
    <svg viewBox="0 0 1254 1254" aria-hidden="true">
      <defs><clipPath id={id}>
        <circle cx="627" cy="626" r="307" />
        <path d="M50 625 C50 562 91 526 159 530 Q184 527 225 549 L518 549 C553 481 702 481 739 549 L1030 549 Q1073 527 1101 530 C1174 531 1203 570 1203 625 C1203 685 1171 720 1100 719 Q1064 720 1030 703 L739 703 C705 767 550 767 518 703 L225 703 Q183 723 157 719 C87 720 50 682 50 625Z" />
      </clipPath></defs>
      <image href={`${ASSETS}/handle.jpg`} width="1254" height="1254" clipPath={`url(#${id})`} />
    </svg>
  );
}

export function DoorArtwork() {
  const id = useId();
  return (
    <svg viewBox="183 217 886 868" aria-hidden="true">
      <defs><clipPath id={id}><rect x="190" y="225" width="870" height="853" rx="165" /></clipPath></defs>
      <image href={`${ASSETS}/door.jpg`} width="1254" height="1254" clipPath={`url(#${id})`} />
    </svg>
  );
}

const CAPSULE_SHAPES: Record<GachaRarity, { top: number; left: number; right: number; bottom: number; seam: number }> = {
  N: { top: 114, left: 113, right: 1137, bottom: 1148, seam: 704 },
  R: { top: 151, left: 143, right: 1113, bottom: 1130, seam: 730 },
  SR: { top: 87, left: 90, right: 1163, bottom: 1167, seam: 718 },
  SSR: { top: 134, left: 133, right: 1120, bottom: 1135, seam: 739 },
  UR: { top: 108, left: 80, right: 1174, bottom: 1181, seam: 750 },
  LR: { top: 97, left: 85, right: 1168, bottom: 1169, seam: 714 },
  MR: { top: 129, left: 103, right: 1149, bottom: 1167, seam: 720 },
};

export function IllustratedCapsule({ rarity, part = "whole" }: { rarity: GachaRarity; part?: "whole" | "top" | "bottom" }) {
  const id = useId();
  const { top, left, right, bottom, seam } = CAPSULE_SHAPES[rarity];
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const edge = part === "top" ? seam : part === "bottom" ? seam : null;
  // Both halves share a viewBox, so they meet at the original curved seam.
  const d = part === "top"
    ? `M${cx} ${top} C${right - 100} ${top} ${right} ${cy - 240} ${right - 9} ${seam - 78} Q${cx} ${seam + 10} ${left + 9} ${seam - 78} C${left} ${cy - 240} ${left + 100} ${top} ${cx} ${top}Z`
    : part === "bottom"
      ? `M${left + 9} ${seam - 78} Q${cx} ${seam + 10} ${right - 9} ${seam - 78} C${right - 15} ${bottom - 170} ${cx + 250} ${bottom} ${cx} ${bottom} C${cx - 250} ${bottom} ${left + 15} ${bottom - 170} ${left + 9} ${seam - 78}Z`
      : `M${cx} ${top} C${right - 100} ${top} ${right} ${cy - 240} ${right} ${cy} C${right} ${bottom - 170} ${cx + 250} ${bottom} ${cx} ${bottom} C${cx - 250} ${bottom} ${left} ${bottom - 170} ${left} ${cy} C${left} ${cy - 240} ${left + 100} ${top} ${cx} ${top}Z`;
  return (
    <svg className={styles.capsuleArt} viewBox={`${left} ${top} ${right - left} ${bottom - top}`} aria-hidden="true" data-half={edge ? part : undefined}>
      <defs><clipPath id={id}><path d={d} /></clipPath></defs>
      <image href={`${ASSETS}/capsule-${rarity}.jpg`} width="1254" height="1254" clipPath={`url(#${id})`} />
    </svg>
  );
}

export function IllustratedHandle({ knobRef, active, onTurn }: {
  knobRef: RefObject<HTMLSpanElement | null>;
  active: boolean;
  onTurn: () => void;
}) {
  const drag = useRef<{ id: number; angle: number; progress: number } | null>(null);
  const didDrag = useRef(false);
  const angleAt = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2) * 180 / Math.PI;
  };
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
  };
  return (
    <button type="button" className={styles.handleButton} disabled={!active} aria-label="ハンドルを回す" onClick={() => {
      if (didDrag.current) { didDrag.current = false; return; }
      onTurn();
    }} onPointerDown={(event) => {
      if (!active) return;
      didDrag.current = false;
      drag.current = { id: event.pointerId, angle: angleAt(event), progress: 0 };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={(event) => {
      const state = drag.current;
      if (!active || !state || state.id !== event.pointerId) return;
      const angle = angleAt(event);
      const delta = (angle - state.angle + 540) % 360 - 180;
      state.angle = angle;
      // Either direction is comfortable on a phone. Ignore tiny pointer jitter.
      state.progress = Math.max(0, state.progress + Math.abs(delta));
      if (Math.abs(delta) > 2) didDrag.current = true;
      if (knobRef.current) knobRef.current.style.transform = `rotate(${state.progress}deg)`;
      if (state.progress >= 220) { release(event); onTurn(); }
    }} onPointerUp={(event) => {
      const state = drag.current;
      const turn = active && state !== null && state.progress >= 75;
      release(event);
      if (turn) onTurn();
      else if (knobRef.current && didDrag.current) knobRef.current.style.transform = "rotate(0deg)";
    }} onPointerCancel={release}>
      <span ref={knobRef} className={styles.illustratedKnob}><HandleArtwork /></span>
    </button>
  );
}
