"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PIN_ADJACENCY, PIN_LAYOUT, Pins } from "./pins";
import type { BowlingBallVisual } from "@/lib/games/wanko-bowling-balls";

const DOCK_Y = 88;
const PIN_ZONE_Y = 34;
const LANE_LEFT = 16;
const LANE_RIGHT = 84;
const PIN_HIT_RADIUS = 6.2;
const MIN_UPWARD_PX = 26;

export type LaneRollResult = {
  knockedIds: number[];
  isGutter: boolean;
  power: number;
};

type LaneProps = {
  ballVisual: BowlingBallVisual;
  /** 変化するたびに、10本すべて立った新しいフレームとして表示をリセットする。 */
  resetSignal: number;
  /** false の間はスワイプ入力を受け付けない（演出中・結果画面など）。 */
  active: boolean;
  onRoll: (result: LaneRollResult) => void;
};

type Point = { x: number; y: number; t: number };

function allPinIds(): Set<number> {
  return new Set(PIN_LAYOUT.map((pin) => pin.id));
}

export function Lane({ ballVisual, resetSignal, active, onRoll }: LaneProps) {
  const [standingIds, setStandingIds] = useState<Set<number>>(() => allPinIds());
  const [fallingIds, setFallingIds] = useState<Set<number>>(() => new Set());

  const boardRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const throwingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const activePointerRef = useRef<number | null>(null);
  const standingIdsRef = useRef(standingIds);
  standingIdsRef.current = standingIds;

  useEffect(() => {
    setStandingIds(allPinIds());
    setFallingIds(new Set());
    throwingRef.current = false;
    if (ballRef.current) {
      ballRef.current.style.transform = `translate(-50%, -50%) translate(50%, ${DOCK_Y}%) rotate(0deg)`;
      ballRef.current.style.opacity = "1";
    }
    if (trailRef.current) trailRef.current.style.opacity = "0";
  }, [resetSignal]);

  const setBallPosition = useCallback((xPct: number, yPct: number, rotateDeg: number) => {
    const el = ballRef.current;
    if (!el) return;
    el.style.left = "0%";
    el.style.top = "0%";
    el.style.transform = `translate(-50%, -50%) translate(${xPct}%, ${yPct}%) rotate(${rotateDeg}deg)`;
  }, []);

  const runThrow = useCallback((launch: {
    speedPctPerSec: number;
    lateralPctPerSec: number;
    curveNorm: number;
  }) => {
    throwingRef.current = true;
    const board = boardRef.current;
    if (!board) {
      throwingRef.current = false;
      return;
    }

    let x = 50;
    let y = DOCK_Y;
    let rotate = 0;
    let last = performance.now();
    let gutter = false;
    const power = Math.min(1, Math.max(0.35, launch.speedPctPerSec / 220));

    const step = (now: number) => {
      const dt = Math.min(48, now - last) / 1000;
      last = now;

      const traveledRatio = Math.min(1, Math.max(0, (DOCK_Y - y) / (DOCK_Y - PIN_ZONE_Y)));
      y -= launch.speedPctPerSec * dt;
      x += launch.lateralPctPerSec * dt;
      x += launch.curveNorm * 46 * traveledRatio * dt;
      rotate += 620 * dt * (launch.speedPctPerSec / 140);

      if (x < LANE_LEFT || x > LANE_RIGHT) {
        gutter = true;
        x = Math.min(Math.max(x, LANE_LEFT - 4), LANE_RIGHT + 4);
      }

      setBallPosition(x, y, rotate);

      if (gutter && y > PIN_ZONE_Y - 6) {
        // ガター：レーン脇へそれたまま少し進んで停止
        window.setTimeout(() => {
          if (ballRef.current) ballRef.current.style.opacity = "0";
          window.setTimeout(() => {
            throwingRef.current = false;
            onRoll({ knockedIds: [], isGutter: true, power });
          }, 260);
        }, 120);
        return;
      }

      if (!gutter && y <= PIN_ZONE_Y) {
        resolveCollision(x, power);
        return;
      }

      requestAnimationFrame(step);
    };

    const resolveCollision = (impactX: number, impactPower: number) => {
      const currentlyStanding = standingIdsRef.current;
      // 手前（レーン側）から奥へ向かって、当たった列の最初のピンを探す
      const rowsFrontToBack = [...PIN_LAYOUT].sort((a, b) => b.y - a.y);
      let primary: (typeof PIN_LAYOUT)[number] | null = null;
      for (const pin of rowsFrontToBack) {
        if (!currentlyStanding.has(pin.id)) continue;
        if (Math.abs(pin.x - impactX) <= PIN_HIT_RADIUS) {
          primary = pin;
          break;
        }
      }

      const knocked = new Set<number>();
      if (primary) {
        const offsetRatio = Math.min(1, Math.abs(primary.x - impactX) / PIN_HIT_RADIUS);
        knocked.add(primary.id);

        const visited = new Set<number>([primary.id]);
        let frontier = [primary.id];
        let hop = 0;
        while (frontier.length > 0 && hop < 3) {
          const next: number[] = [];
          const baseProb = (0.55 - hop * 0.15 + (1 - offsetRatio) * 0.15) * (0.55 + impactPower * 0.5);
          for (const pinId of frontier) {
            const neighbors = PIN_ADJACENCY[pinId] ?? [];
            for (const neighborId of neighbors) {
              if (visited.has(neighborId) || !currentlyStanding.has(neighborId)) continue;
              visited.add(neighborId);
              if (Math.random() < baseProb) {
                knocked.add(neighborId);
                next.push(neighborId);
              }
            }
          }
          frontier = next;
          hop += 1;
        }
      }

      if (knocked.size > 0) {
        setFallingIds(knocked);
        setStandingIds((prev) => {
          const nextSet = new Set(prev);
          knocked.forEach((id) => nextSet.delete(id));
          return nextSet;
        });
      }

      if (ballRef.current) ballRef.current.style.opacity = "0";

      window.setTimeout(() => {
        throwingRef.current = false;
        setFallingIds(new Set());
        onRoll({ knockedIds: [...knocked], isGutter: false, power: impactPower });
      }, 480);
    };

    requestAnimationFrame(step);
  }, [onRoll, setBallPosition]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || throwingRef.current) return;
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const relY = ((event.clientY - rect.top) / rect.height) * 100;
    if (relY < 62) return; // ボール置き場より上から始めた操作は投球にしない

    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointsRef.current = [{ x: event.clientX, y: event.clientY, t: performance.now() }];
  }, [active]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    pointsRef.current.push({ x: event.clientX, y: event.clientY, t: performance.now() });
    if (pointsRef.current.length > 24) pointsRef.current.shift();
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    const points = pointsRef.current;
    pointsRef.current = [];
    if (!active || throwingRef.current || points.length < 2) return;

    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const start = points[0]!;
    const end = points[points.length - 1]!;
    const dxPx = end.x - start.x;
    const dyPx = end.y - start.y;
    const durationMs = Math.max(16, end.t - start.t);

    if (-dyPx < MIN_UPWARD_PX) return; // 上向きに十分な距離を動かしていなければ投球にしない

    const speedPxPerMs = Math.hypot(dxPx, dyPx) / durationMs;
    const speedPctPerSec = Math.min(340, Math.max(150, speedPxPerMs * 1000 * (100 / rect.height) * 0.62));
    const lateralPctPerSec = Math.max(-70, Math.min(70, (dxPx / durationMs) * 1000 * (100 / rect.width) * 0.4));

    const mid = points[Math.floor(points.length / 2)] ?? end;
    const midProgress = durationMs > 0 ? (mid.t - start.t) / durationMs : 0.5;
    const idealMidX = start.x + dxPx * midProgress;
    const curveDeviationPx = mid.x - idealMidX;
    const curveNorm = Math.max(-1, Math.min(1, curveDeviationPx / (rect.width * 0.12)));

    runThrow({ speedPctPerSec, lateralPctPerSec, curveNorm });
  }, [active, runThrow]);

  return (
    <div
      ref={boardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative aspect-[3/4.4] w-full touch-none select-none overflow-hidden rounded-[26px]"
      style={{
        background:
          "linear-gradient(180deg, #b98a55 0%, #a9764a 46%, #8a5c39 78%, #6f472c 100%)",
      }}
    >
      {/* レーンの奥行き板目 */}
      <div
        className="absolute inset-x-[10%] top-[8%] bottom-[16%] rounded-[16px]"
        style={{
          background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 3px, transparent 3px 22px)",
          maskImage: "linear-gradient(180deg, black 70%, transparent 100%)",
        }}
        aria-hidden="true"
      />
      {/* ガター */}
      <div className="absolute inset-y-[8%] left-0 w-[13%] rounded-l-[26px] bg-[#4a301e]/70" aria-hidden="true" />
      <div className="absolute inset-y-[8%] right-0 w-[13%] rounded-r-[26px] bg-[#4a301e]/70" aria-hidden="true" />
      {/* ファウルライン */}
      <div className="absolute inset-x-[13%] top-[60%] h-[2px] bg-[#a8442f]/80" aria-hidden="true" />

      <Pins standingIds={standingIds} fallingIds={fallingIds} />

      {/* 軌跡 */}
      <div
        ref={trailRef}
        className="pointer-events-none absolute h-1 w-1 rounded-full opacity-0"
        aria-hidden="true"
      />

      {/* ボール */}
      <div
        ref={ballRef}
        className="pointer-events-none absolute h-[9%] w-[9%] rounded-full shadow-[0_3px_6px_rgba(0,0,0,0.35)]"
        style={{
          left: "0%",
          top: "0%",
          transform: `translate(-50%, -50%) translate(50%, ${DOCK_Y}%)`,
          background: `radial-gradient(circle at 32% 28%, ${ballVisual.bodyGradient[0]}, ${ballVisual.bodyGradient[1]})`,
          boxShadow: ballVisual.premiumEffect ? `0 0 12px 3px ${ballVisual.hitColor}` : undefined,
        }}
        aria-hidden="true"
      />

      <div className="absolute bottom-[3%] left-1/2 -translate-x-1/2 text-center">
        <p className="text-[10px] font-black tracking-[0.12em] text-[#fff3e0]/85">
          {active ? "上へスワイプして投げよう" : ""}
        </p>
      </div>
    </div>
  );
}
