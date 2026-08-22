"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { PIN_DIAMETER_PCT, PIN_LAYOUT, Pins } from "./pins";
import type { BowlingBallVisual } from "@/lib/games/wanko-bowling-balls";

const DOCK_Y = 88;
const PIN_ZONE_Y = 36;
const DECK_EXIT_Y = 6;
const LANE_LEFT = 16;
const LANE_RIGHT = 84;
const MIN_UPWARD_PCT = 6;
const BALL_DIAMETER_PCT = 9;
const COLLISION_PADDING_PCT = 1.8;
const PIN_PAIR_PADDING_PCT = 1.6;
const BASE_BALL_SPEED_PCT = (20 / 3.6) * 30;
const DECK_SPEED_SCALE = 0.52;
const CURVE_ACCEL_PCT_PER_SEC2 = 235;
const FRICTION_PER_SEC = 3.2;
const SETTLE_SPEED_PCT = 8;
const MAX_THROW_MS = 3200;
const MAX_SWIPE_SAMPLES = 48;
const BALL_MASS_KG = 8 * 0.45359237;
const PIN_MASS_KG = 1.5;
const BALL_PIN_RESTITUTION = 0.58;
const PIN_PIN_RESTITUTION = 0.46;

export type LaneRollResult = {
  knockedIds: number[];
  isGutter: boolean;
  power: number;
};

type LaneProps = {
  ballVisual: BowlingBallVisual;
  resetSignal: number;
  active: boolean;
  onRoll: (result: LaneRollResult) => void;
};

type Point = { x: number; y: number; t: number };

type PinBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  fallProgress: number;
  standing: boolean;
  moving: boolean;
};

function createPinBody(pin: { x: number; y: number }): PinBody {
  return {
    x: pin.x,
    y: pin.y,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVel: 0,
    fallProgress: 0,
    standing: true,
    moving: false,
  };
}

function pctToPx(pct: number, scale: number): number {
  return (pct / 100) * scale;
}

function pxToPct(px: number, scale: number): number {
  return (px / scale) * 100;
}

function distancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  const t = abLenSq > 0
    ? Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / abLenSq))
    : 0;
  const closestX = ax + abx * t;
  const closestY = ay + aby * t;
  return Math.hypot(px - closestX, py - closestY);
}

function resolvePairCollision(
  ax: number,
  ay: number,
  avx: number,
  avy: number,
  massA: number,
  bx: number,
  by: number,
  bvx: number,
  bvy: number,
  massB: number,
  restitution: number,
  scaleX: number,
  scaleY: number,
): { avx: number; avy: number; bvx: number; bvy: number } | null {
  const dxPx = pctToPx(bx - ax, scaleX);
  const dyPx = pctToPx(by - ay, scaleY);
  const dist = Math.hypot(dxPx, dyPx);
  if (dist < 0.0001) return null;

  const nx = dxPx / dist;
  const ny = dyPx / dist;
  const avxPx = pctToPx(avx, scaleX);
  const avyPx = pctToPx(avy, scaleY);
  const bvxPx = pctToPx(bvx, scaleX);
  const bvyPx = pctToPx(bvy, scaleY);
  const velAlongNormal = (avxPx - bvxPx) * nx + (avyPx - bvyPx) * ny;
  if (velAlongNormal <= 0) return null;

  const invA = 1 / massA;
  const invB = 1 / massB;
  const impulse = ((1 + restitution) * velAlongNormal) / (invA + invB);

  return {
    avx: pxToPct(avxPx - impulse * nx * invA, scaleX),
    avy: pxToPct(avyPx - impulse * ny * invA, scaleY),
    bvx: pxToPct(bvxPx + impulse * nx * invB, scaleX),
    bvy: pxToPct(bvyPx + impulse * ny * invB, scaleY),
  };
}

export function Lane({ ballVisual, resetSignal, active, onRoll }: LaneProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const throwingRef = useRef(false);
  const dockingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const activePointerRef = useRef<number | null>(null);
  const pinBodiesRef = useRef<Map<number, PinBody>>(
    new Map(PIN_LAYOUT.map((pin) => [pin.id, createPinBody(pin)])),
  );
  const pinNodesRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const registerPinNode = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) pinNodesRef.current.set(id, el);
    else pinNodesRef.current.delete(id);
  }, []);

  const writePinNode = useCallback((id: number, body: PinBody) => {
    const el = pinNodesRef.current.get(id);
    if (!el) return;
    el.style.left = `${body.x}%`;
    el.style.top = `${body.y}%`;
    const squashY = 1 - 0.62 * body.fallProgress;
    el.style.transform = `translate(-50%, -50%) rotate(${body.angle}deg) scale(1, ${squashY})`;
  }, []);

  const resetPins = useCallback(() => {
    PIN_LAYOUT.forEach((pin) => {
      const body = createPinBody(pin);
      pinBodiesRef.current.set(pin.id, body);
      writePinNode(pin.id, body);
    });
  }, [writePinNode]);

  const dockBall = useCallback(() => {
    const el = ballRef.current;
    if (!el) return;

    dockingRef.current = true;
    el.style.transition = "opacity 130ms ease";
    el.style.opacity = "0";

    window.setTimeout(() => {
      const current = ballRef.current;
      if (!current) {
        dockingRef.current = false;
        return;
      }
      current.style.left = "50%";
      current.style.top = `${DOCK_Y}%`;
      current.style.transform = "translate(-50%, -50%) rotate(0deg)";
      requestAnimationFrame(() => {
        const next = ballRef.current;
        if (!next) {
          dockingRef.current = false;
          return;
        }
        next.style.opacity = "1";
        window.setTimeout(() => {
          if (ballRef.current) ballRef.current.style.transition = "";
          dockingRef.current = false;
        }, 150);
      });
    }, 130);
  }, []);

  useEffect(() => {
    resetPins();
    throwingRef.current = false;
    activePointerRef.current = null;
    pointsRef.current = [];
    dockBall();
  }, [resetSignal, resetPins, dockBall]);

  useEffect(() => {
    if (active) dockBall();
  }, [active, dockBall]);

  const setBallPosition = useCallback((xPct: number, yPct: number, rotateDeg: number) => {
    const el = ballRef.current;
    if (!el) return;
    el.style.left = `${xPct}%`;
    el.style.top = `${yPct}%`;
    el.style.transform = `translate(-50%, -50%) rotate(${rotateDeg}deg)`;
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

    const rect = board.getBoundingClientRect();
    const scaleX = rect.width;
    const scaleY = rect.height;
    const ballRadiusPx = pctToPx(BALL_DIAMETER_PCT / 2, scaleX);
    const pinRadiusPx = pctToPx(PIN_DIAMETER_PCT / 2, scaleX);
    const collideRadiusPx = ballRadiusPx + pinRadiusPx + pctToPx(COLLISION_PADDING_PCT, scaleX);
    const pinPinRadiusPx = pinRadiusPx * 2 + pctToPx(PIN_PAIR_PADDING_PCT, scaleX);

    const preThrowStandingIds = new Set(
      [...pinBodiesRef.current.entries()]
        .filter(([, body]) => body.standing)
        .map(([id]) => id),
    );
    // 見た目の最終状態から推測せず、倒れた瞬間に記録する。
    const knockedThisThrow = new Set<number>();

    let bx = 50;
    let by = DOCK_Y;
    let bvx = launch.lateralPctPerSec;
    let bvy = -launch.speedPctPerSec;
    let rotate = 0;
    let ballGutter = false;
    let ballDone = false;
    let deckSlowdownApplied = false;
    const power = Math.min(1, Math.max(0.3, launch.speedPctPerSec / BASE_BALL_SPEED_PCT));
    const startTime = performance.now();
    let last = startTime;

    const anyPinMoving = () => {
      for (const body of pinBodiesRef.current.values()) {
        if (body.moving) return true;
      }
      return false;
    };

    const finish = () => {
      if (ballGutter && ballRef.current) ballRef.current.style.opacity = "0";
      window.setTimeout(() => {
        throwingRef.current = false;
        const knockedIds = [...knockedThisThrow].filter((id) => preThrowStandingIds.has(id));
        onRoll({ knockedIds, isGutter: ballGutter, power });
      }, ballGutter ? 220 : 300);
    };

    const step = (now: number) => {
      const dt = Math.min(0.028, (now - last) / 1000);
      last = now;

      if (!ballDone) {
        const prevBx = bx;
        const prevBy = by;

        bvx += launch.curveNorm * CURVE_ACCEL_PCT_PER_SEC2 * dt;
        bx += bvx * dt;
        by += bvy * dt;
        rotate += Math.hypot(bvx, bvy) * dt * 2.2;

        if (bx < LANE_LEFT || bx > LANE_RIGHT) {
          ballGutter = true;
          ballDone = true;
          bx = Math.min(Math.max(bx, LANE_LEFT - 4), LANE_RIGHT + 4);
        } else if (by <= PIN_ZONE_Y) {
          if (!deckSlowdownApplied) {
            bvx *= DECK_SPEED_SCALE;
            bvy *= DECK_SPEED_SCALE;
            deckSlowdownApplied = true;
          }

          const prevBxPx = pctToPx(prevBx, scaleX);
          const prevByPx = pctToPx(prevBy, scaleY);
          const bxPx = pctToPx(bx, scaleX);
          const byPx = pctToPx(by, scaleY);

          for (const pin of PIN_LAYOUT) {
            const body = pinBodiesRef.current.get(pin.id);
            if (!body || !body.standing) continue;

            const pinXPx = pctToPx(body.x, scaleX);
            const pinYPx = pctToPx(body.y, scaleY);
            const distance = distancePointToSegment(
              pinXPx,
              pinYPx,
              prevBxPx,
              prevByPx,
              bxPx,
              byPx,
            );
            if (distance > collideRadiusPx) continue;

            const result = resolvePairCollision(
              prevBx,
              prevBy,
              bvx,
              bvy,
              BALL_MASS_KG,
              body.x,
              body.y,
              body.vx,
              body.vy,
              PIN_MASS_KG,
              BALL_PIN_RESTITUTION,
              scaleX,
              scaleY,
            );

            if (result) {
              bvx = result.avx;
              bvy = result.avy;
              body.vx = result.bvx;
              body.vy = result.bvy;
            } else {
              body.vx += bvx * 0.38;
              body.vy += bvy * 0.38;
              bvx *= 0.76;
              bvy *= 0.76;
            }

            knockedThisThrow.add(pin.id);
            body.standing = false;
            body.moving = true;
            body.angularVel = (Math.random() - 0.5) * 920 + (pinXPx >= bxPx ? 280 : -280);
          }

          if (by <= DECK_EXIT_Y) ballDone = true;
        }

        setBallPosition(bx, by, rotate);
      }

      const ids = [...pinBodiesRef.current.keys()];
      for (let i = 0; i < ids.length; i += 1) {
        const bodyA = pinBodiesRef.current.get(ids[i]!)!;
        if (bodyA.standing && !bodyA.moving) continue;

        for (let j = i + 1; j < ids.length; j += 1) {
          const bodyB = pinBodiesRef.current.get(ids[j]!)!;
          if (!bodyA.moving && !bodyB.moving) continue;

          const dxPx = pctToPx(bodyB.x - bodyA.x, scaleX);
          const dyPx = pctToPx(bodyB.y - bodyA.y, scaleY);
          if (Math.hypot(dxPx, dyPx) > pinPinRadiusPx) continue;

          const aWasStanding = bodyA.standing;
          const bWasStanding = bodyB.standing;
          const result = resolvePairCollision(
            bodyA.x,
            bodyA.y,
            bodyA.vx,
            bodyA.vy,
            PIN_MASS_KG,
            bodyB.x,
            bodyB.y,
            bodyB.vx,
            bodyB.vy,
            PIN_MASS_KG,
            PIN_PIN_RESTITUTION,
            scaleX,
            scaleY,
          );
          if (!result) continue;

          bodyA.vx = result.avx;
          bodyA.vy = result.avy;
          bodyB.vx = result.bvx;
          bodyB.vy = result.bvy;
          if (aWasStanding) {
            knockedThisThrow.add(ids[i]!);
            bodyA.angularVel = (Math.random() - 0.5) * 900;
          }
          if (bWasStanding) {
            knockedThisThrow.add(ids[j]!);
            bodyB.angularVel = (Math.random() - 0.5) * 900;
          }
          bodyA.standing = false;
          bodyA.moving = true;
          bodyB.standing = false;
          bodyB.moving = true;
        }
      }

      for (const [id, body] of pinBodiesRef.current) {
        if (!body.moving) continue;

        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.angle += body.angularVel * dt;
        body.fallProgress = Math.min(1, body.fallProgress + dt / 0.15);

        const decay = Math.exp(-FRICTION_PER_SEC * dt);
        body.vx *= decay;
        body.vy *= decay;
        body.angularVel *= decay;
        body.x = Math.min(Math.max(body.x, 2), 98);
        body.y = Math.min(Math.max(body.y, 2), 60);

        if (Math.hypot(body.vx, body.vy) < SETTLE_SPEED_PCT) {
          body.moving = false;
          body.vx = 0;
          body.vy = 0;
          body.angularVel = 0;
          body.fallProgress = 1;
        }

        writePinNode(id, body);
      }

      const elapsed = now - startTime;
      if ((ballDone && !anyPinMoving()) || elapsed > MAX_THROW_MS) {
        finish();
        return;
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [onRoll, setBallPosition, writePinNode]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!active || throwingRef.current || dockingRef.current) return;

    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const relY = ((event.clientY - rect.top) / rect.height) * 100;
    const relX = ((event.clientX - rect.left) / rect.width) * 100;
    if (relY < 66 || relX < 18 || relX > 82) return;

    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointsRef.current = [{ x: event.clientX, y: event.clientY, t: performance.now() }];
  }, [active]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    pointsRef.current.push({ x: event.clientX, y: event.clientY, t: performance.now() });
    if (pointsRef.current.length > MAX_SWIPE_SAMPLES) {
      pointsRef.current.splice(1, pointsRef.current.length - MAX_SWIPE_SAMPLES);
    }
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    activePointerRef.current = null;

    const points = pointsRef.current;
    pointsRef.current = [];
    if (!active || throwingRef.current || dockingRef.current || points.length < 2) return;

    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const start = points[0]!;
    const end = points[points.length - 1]!;
    const dxPct = ((end.x - start.x) / rect.width) * 100;
    const dyPct = ((end.y - start.y) / rect.height) * 100;
    const durationSec = Math.max(0.016, (end.t - start.t) / 1000);

    if (-dyPct < MIN_UPWARD_PCT) return;

    const rawSpeedPctPerSec = (Math.hypot(dxPct, dyPct) / durationSec) * 0.62;
    const speedPctPerSec = Math.min(260, Math.max(100, rawSpeedPctPerSec));
    const lateralPctPerSec = Math.max(-72, Math.min(72, (dxPct / durationSec) * 0.42));

    const avgSlopePctPerMs = (segment: Point[]) => {
      if (segment.length < 2) return 0;
      const a = segment[0]!;
      const b = segment[segment.length - 1]!;
      const ms = b.t - a.t;
      if (ms <= 0) return 0;
      return (((b.x - a.x) / rect.width) * 100) / ms;
    };

    const midIndex = Math.max(1, Math.floor(points.length / 2));
    const firstHalfSlope = avgSlopePctPerMs(points.slice(0, midIndex + 1));
    const secondHalfSlope = avgSlopePctPerMs(points.slice(midIndex));
    const curveNorm = Math.max(-1, Math.min(1, (secondHalfSlope - firstHalfSlope) / 0.24));

    runThrow({ speedPctPerSec, lateralPctPerSec, curveNorm });
  }, [active, runThrow]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    activePointerRef.current = null;
    pointsRef.current = [];
  }, []);

  return (
    <div
      ref={boardRef}
      data-bowling-gesture-block="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="relative w-full touch-none select-none overflow-hidden"
      style={{
        height: "clamp(390px, calc(100dvh - 205px), 620px)",
        touchAction: "none",
        overscrollBehavior: "none",
        borderRadius: "28px 24px 30px 22px",
        background: "linear-gradient(180deg, #e8c997 0%, #d9ad72 42%, #c8935a 75%, #ad7645 100%)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -18px 30px -20px rgba(76,48,24,0.58)",
      }}
    >
      <div
        className="absolute inset-x-[11%] top-[5%] bottom-[17%] rounded-[18px]"
        style={{
          background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0 2px, transparent 2px 20px)",
          maskImage: "linear-gradient(180deg, black 72%, transparent 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-[5%] left-0 w-[13%] rounded-l-[26px]"
        style={{ background: "linear-gradient(90deg, #624025, #7b5230)", boxShadow: "inset -3px 0 7px rgba(0,0,0,0.28)" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-[5%] right-0 w-[13%] rounded-r-[26px]"
        style={{ background: "linear-gradient(270deg, #624025, #7b5230)", boxShadow: "inset 3px 0 7px rgba(0,0,0,0.28)" }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-[13%] top-[59%] h-[3px] rounded-full bg-[#a8442f]" aria-hidden="true" />
      <div className="absolute inset-x-[13%] top-[calc(59%+3px)] h-px bg-[#a8442f]/35" aria-hidden="true" />

      <Pins registerNode={registerPinNode} />

      <div
        ref={ballRef}
        className="pointer-events-none absolute aspect-square w-[9%] rounded-full shadow-[0_4px_8px_rgba(0,0,0,0.35)]"
        style={{
          left: "50%",
          top: `${DOCK_Y}%`,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle at 32% 28%, ${ballVisual.bodyGradient[0]}, ${ballVisual.bodyGradient[1]})`,
          boxShadow: ballVisual.premiumEffect ? `0 0 14px 4px ${ballVisual.hitColor}` : undefined,
        }}
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute bottom-[2.5%] left-1/2 -translate-x-1/2 text-center">
        <p className="whitespace-nowrap rounded-full bg-[#402817]/65 px-3 py-1.5 text-[10.5px] font-black tracking-[0.08em] text-[#fff7e8] backdrop-blur-sm">
          {active ? "ボール付近から上へスワイプ" : ""}
        </p>
      </div>
    </div>
  );
}
