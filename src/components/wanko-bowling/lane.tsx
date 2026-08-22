"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { PIN_LAYOUT, Pins } from "./pins";
import type { BowlingBallVisual } from "@/lib/games/wanko-bowling-balls";
import {
  BACKEND_HOOK_ACCEL_MPS2,
  BALL_PIN_RESTITUTION,
  DRY_HOOK_FACTOR,
  GAME_BALL_MASS_KG,
  GAME_MAX_BALL_SPEED_KMH,
  GAME_MIN_BALL_SPEED_KMH,
  GAME_OIL_LENGTH_M,
  JB_BALL_DIAMETER_M,
  JB_GUTTER_WIDTH_M,
  JB_HEAD_PIN_DISTANCE_M,
  JB_LANE_WIDTH_M,
  JB_PIN_DIAMETER_M,
  JB_PIN_MASS_KG,
  JB_TOTAL_WIDTH_M,
  OIL_HOOK_FACTOR,
  PIN_CHAIN_KNOCK_SPEED_MPS,
  PIN_DIRECT_KNOCK_SPEED_MPS,
  PIN_FRICTION_PER_SEC,
  PIN_PIN_RESTITUTION,
  PIN_SETTLE_SPEED_MPS,
} from "@/lib/games/wanko-bowling-physics";

const DOCK_Y = 94;
const HEAD_PIN_SCREEN_Y = 24;
const LANE_TRAVEL_PCT = DOCK_Y - HEAD_PIN_SCREEN_Y;
const MIN_UPWARD_PCT = 8;
const MAX_THROW_MS = 7000;
const MAX_SWIPE_SAMPLES = 48;
const BALL_RADIUS_M = JB_BALL_DIAMETER_M / 2;
const PIN_RADIUS_M = JB_PIN_DIAMETER_M / 2;
const BALL_DIAMETER_PCT = (JB_BALL_DIAMETER_M / JB_TOTAL_WIDTH_M) * 100;
const LANE_LEFT_PCT = (JB_GUTTER_WIDTH_M / JB_TOTAL_WIDTH_M) * 100;
const LANE_RIGHT_PCT = 100 - LANE_LEFT_PCT;
const LANE_WIDTH_PCT = (JB_LANE_WIDTH_M / JB_TOTAL_WIDTH_M) * 100;
const PIN_COLLISION_RADIUS_M = BALL_RADIUS_M + PIN_RADIUS_M + 0.006;
const PIN_PAIR_RADIUS_M = JB_PIN_DIAMETER_M + 0.006;
const BALL_EXIT_DISTANCE_M = JB_HEAD_PIN_DISTANCE_M + 1.15;
const MAX_LAUNCH_ANGLE_RAD = 11 * Math.PI / 180;
const MAX_CURVE_ANGLE_RAD = 12 * Math.PI / 180;
const OIL_BALL_DRAG_PER_SEC = 0.012;
const DRY_BALL_DRAG_PER_SEC = 0.04;
const FOUL_LINE_Y = 97;

const TARGET_X_PCTS = [5, 10, 15, 20, 25, 30, 35].map((board) =>
  LANE_LEFT_PCT + LANE_WIDTH_PCT * (board / 40),
);

function worldXToPct(xM: number): number {
  return (xM / JB_TOTAL_WIDTH_M) * 100;
}

function worldYToPct(distanceFromFoulM: number): number {
  return DOCK_Y - (distanceFromFoulM / JB_HEAD_PIN_DISTANCE_M) * LANE_TRAVEL_PCT;
}

const GUIDE_DOTS_Y = worldYToPct(7 * 0.3048);
const TARGET_ARROWS_Y = worldYToPct(15 * 0.3048);
const OIL_END_Y = worldYToPct(GAME_OIL_LENGTH_M);

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
  xM: number;
  yM: number;
  vxMps: number;
  vyMps: number;
  angle: number;
  angularVel: number;
  fallProgress: number;
  standing: boolean;
  moving: boolean;
  visible: boolean;
};

type CollisionResult = {
  avx: number;
  avy: number;
  bvx: number;
  bvy: number;
};

function createPinBody(pin: (typeof PIN_LAYOUT)[number]): PinBody {
  return {
    xM: JB_TOTAL_WIDTH_M / 2 + pin.lateralM,
    yM: JB_HEAD_PIN_DISTANCE_M + pin.forwardM,
    vxMps: 0,
    vyMps: 0,
    angle: 0,
    angularVel: 0,
    fallProgress: 0,
    standing: true,
    moving: false,
    visible: true,
  };
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
): CollisionResult | null {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.000001) return null;

  const nx = dx / dist;
  const ny = dy / dist;
  const velocityAlongNormal = (avx - bvx) * nx + (avy - bvy) * ny;
  if (velocityAlongNormal <= 0) return null;

  const invA = 1 / massA;
  const invB = 1 / massB;
  const impulse = ((1 + restitution) * velocityAlongNormal) / (invA + invB);

  return {
    avx: avx - impulse * nx * invA,
    avy: avy - impulse * ny * invA,
    bvx: bvx + impulse * nx * invB,
    bvy: bvy + impulse * ny * invB,
  };
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { distance: number; t: number; x: number; y: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  const t = abLenSq > 0
    ? Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / abLenSq))
    : 0;
  const x = ax + abx * t;
  const y = ay + aby * t;
  return { distance: Math.hypot(px - x, py - y), t, x, y };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function directionAngle(a: Point, b: Point, width: number, height: number): number {
  const dx = (b.x - a.x) / Math.max(1, width);
  const dy = (b.y - a.y) / Math.max(1, height);
  return Math.atan2(dx, -dy);
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

    el.style.left = `${worldXToPct(body.xM)}%`;
    el.style.top = `${worldYToPct(body.yM)}%`;
    el.style.opacity = body.visible ? "1" : "0";
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

  const clearFallenPins = useCallback(() => {
    for (const [id, body] of pinBodiesRef.current) {
      if (body.standing) continue;
      body.visible = false;
      body.moving = false;
      body.vxMps = 0;
      body.vyMps = 0;
      writePinNode(id, body);
    }
  }, [writePinNode]);

  const dockBall = useCallback(() => {
    const el = ballRef.current;
    if (!el) return;

    dockingRef.current = true;
    el.style.transition = "opacity 120ms ease";
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
        }, 130);
      });
    }, 110);
  }, []);

  useEffect(() => {
    resetPins();
    throwingRef.current = false;
    activePointerRef.current = null;
    pointsRef.current = [];
    dockBall();
  }, [resetSignal, resetPins, dockBall]);

  useEffect(() => {
    if (!active) return;
    clearFallenPins();
    dockBall();
  }, [active, clearFallenPins, dockBall]);

  const setBallPosition = useCallback((xM: number, yM: number, rotateDeg: number) => {
    const el = ballRef.current;
    if (!el) return;
    el.style.left = `${worldXToPct(xM)}%`;
    el.style.top = `${worldYToPct(yM)}%`;
    el.style.transform = `translate(-50%, -50%) rotate(${rotateDeg}deg)`;
  }, []);

  const runThrow = useCallback((launch: {
    speedMps: number;
    launchAngleRad: number;
    curveNorm: number;
  }) => {
    throwingRef.current = true;

    let bxM = JB_TOTAL_WIDTH_M / 2;
    let byM = 0;
    let bvxMps = launch.speedMps * Math.sin(launch.launchAngleRad);
    let bvyMps = launch.speedMps * Math.cos(launch.launchAngleRad);
    let rotate = 0;
    let ballGutter = false;
    let ballDone = false;
    let finished = false;

    const preThrowStandingIds = new Set(
      [...pinBodiesRef.current.entries()]
        .filter(([, body]) => body.standing)
        .map(([id]) => id),
    );
    const knockedThisThrow = new Set<number>();
    const startTime = performance.now();
    let last = startTime;

    const anyPinMoving = () => {
      for (const body of pinBodiesRef.current.values()) {
        if (body.moving) return true;
      }
      return false;
    };

    const markKnocked = (id: number, body: PinBody, vx: number, vy: number, hitFromX: number) => {
      if (!body.standing) return;
      knockedThisThrow.add(id);
      body.standing = false;
      body.moving = true;
      body.visible = true;
      body.vxMps = vx;
      body.vyMps = vy;
      body.angularVel = (Math.random() - 0.5) * 620 + (body.xM >= hitFromX ? 190 : -190);
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      if (ballGutter && ballRef.current) ballRef.current.style.opacity = "0";
      const speedNorm = clamp(
        ((launch.speedMps * 3.6) - GAME_MIN_BALL_SPEED_KMH)
          / (GAME_MAX_BALL_SPEED_KMH - GAME_MIN_BALL_SPEED_KMH),
        0,
        1,
      );

      window.setTimeout(() => {
        throwingRef.current = false;
        const knockedIds = [...knockedThisThrow].filter((id) => preThrowStandingIds.has(id));
        onRoll({ knockedIds, isGutter: ballGutter && knockedIds.length === 0, power: 0.3 + speedNorm * 0.7 });
      }, ballGutter ? 180 : 280);
    };

    const step = (now: number) => {
      const dt = Math.min(0.024, Math.max(0.001, (now - last) / 1000));
      last = now;

      if (!ballDone) {
        const prevBxM = bxM;
        const prevByM = byM;
        const onOil = byM < GAME_OIL_LENGTH_M;
        const hookFactor = onOil ? OIL_HOOK_FACTOR : DRY_HOOK_FACTOR;
        const drag = onOil ? OIL_BALL_DRAG_PER_SEC : DRY_BALL_DRAG_PER_SEC;

        bvxMps += launch.curveNorm * BACKEND_HOOK_ACCEL_MPS2 * hookFactor * dt;
        const ballDecay = Math.exp(-drag * dt);
        bvxMps *= ballDecay;
        bvyMps *= ballDecay;
        bxM += bvxMps * dt;
        byM += bvyMps * dt;

        const angularSpeedRad = Math.hypot(bvxMps, bvyMps) / BALL_RADIUS_M;
        rotate += angularSpeedRad * dt * (180 / Math.PI);

        const laneLeftM = JB_GUTTER_WIDTH_M;
        const laneRightM = JB_GUTTER_WIDTH_M + JB_LANE_WIDTH_M;
        if (bxM - BALL_RADIUS_M < laneLeftM || bxM + BALL_RADIUS_M > laneRightM) {
          ballGutter = knockedThisThrow.size === 0;
          ballDone = true;
          bxM = clamp(bxM, BALL_RADIUS_M * 0.4, JB_TOTAL_WIDTH_M - BALL_RADIUS_M * 0.4);
        }

        if (!ballDone && byM >= JB_HEAD_PIN_DISTANCE_M - 1.35) {
          for (const pin of PIN_LAYOUT) {
            const body = pinBodiesRef.current.get(pin.id);
            if (!body || !body.standing || !body.visible) continue;

            const closest = closestPointOnSegment(
              body.xM,
              body.yM,
              prevBxM,
              prevByM,
              bxM,
              byM,
            );
            if (closest.distance > PIN_COLLISION_RADIUS_M) continue;

            const collision = resolvePairCollision(
              closest.x,
              closest.y,
              bvxMps,
              bvyMps,
              GAME_BALL_MASS_KG,
              body.xM,
              body.yM,
              body.vxMps,
              body.vyMps,
              JB_PIN_MASS_KG,
              BALL_PIN_RESTITUTION,
            );

            if (collision) {
              bvxMps = collision.avx;
              bvyMps = collision.avy;
              const pinSpeed = Math.hypot(collision.bvx, collision.bvy);
              if (pinSpeed >= PIN_DIRECT_KNOCK_SPEED_MPS) {
                markKnocked(pin.id, body, collision.bvx, collision.bvy, closest.x);
              }
            } else {
              const fallbackVx = bvxMps * 0.32;
              const fallbackVy = bvyMps * 0.32;
              if (Math.hypot(fallbackVx, fallbackVy) >= PIN_DIRECT_KNOCK_SPEED_MPS) {
                markKnocked(pin.id, body, fallbackVx, fallbackVy, closest.x);
              }
              bvxMps *= 0.86;
              bvyMps *= 0.86;
            }
          }
        }

        if (byM >= BALL_EXIT_DISTANCE_M) ballDone = true;
        setBallPosition(bxM, byM, rotate);
      }

      const ids = [...pinBodiesRef.current.keys()];
      for (let i = 0; i < ids.length; i += 1) {
        const idA = ids[i]!;
        const bodyA = pinBodiesRef.current.get(idA)!;
        if (!bodyA.visible || (bodyA.standing && !bodyA.moving)) continue;

        for (let j = i + 1; j < ids.length; j += 1) {
          const idB = ids[j]!;
          const bodyB = pinBodiesRef.current.get(idB)!;
          if (!bodyB.visible || (!bodyA.moving && !bodyB.moving)) continue;

          const dx = bodyB.xM - bodyA.xM;
          const dy = bodyB.yM - bodyA.yM;
          if (Math.hypot(dx, dy) > PIN_PAIR_RADIUS_M) continue;

          const aWasStanding = bodyA.standing;
          const bWasStanding = bodyB.standing;
          const collision = resolvePairCollision(
            bodyA.xM,
            bodyA.yM,
            bodyA.vxMps,
            bodyA.vyMps,
            JB_PIN_MASS_KG,
            bodyB.xM,
            bodyB.yM,
            bodyB.vxMps,
            bodyB.vyMps,
            JB_PIN_MASS_KG,
            PIN_PIN_RESTITUTION,
          );
          if (!collision) continue;

          bodyA.vxMps = collision.avx;
          bodyA.vyMps = collision.avy;
          bodyB.vxMps = collision.bvx;
          bodyB.vyMps = collision.bvy;

          if (aWasStanding) {
            const speedA = Math.hypot(collision.avx, collision.avy);
            if (speedA >= PIN_CHAIN_KNOCK_SPEED_MPS) {
              markKnocked(idA, bodyA, collision.avx, collision.avy, bodyB.xM);
            } else {
              bodyA.vxMps = 0;
              bodyA.vyMps = 0;
            }
          }

          if (bWasStanding) {
            const speedB = Math.hypot(collision.bvx, collision.bvy);
            if (speedB >= PIN_CHAIN_KNOCK_SPEED_MPS) {
              markKnocked(idB, bodyB, collision.bvx, collision.bvy, bodyA.xM);
            } else {
              bodyB.vxMps = 0;
              bodyB.vyMps = 0;
            }
          }
        }
      }

      for (const [id, body] of pinBodiesRef.current) {
        if (!body.moving || !body.visible) continue;

        body.xM += body.vxMps * dt;
        body.yM += body.vyMps * dt;
        body.angle += body.angularVel * dt;
        body.fallProgress = Math.min(1, body.fallProgress + dt / 0.2);

        const decay = Math.exp(-PIN_FRICTION_PER_SEC * dt);
        body.vxMps *= decay;
        body.vyMps *= decay;
        body.angularVel *= decay;
        body.xM = clamp(body.xM, 0.02, JB_TOTAL_WIDTH_M - 0.02);
        body.yM = clamp(body.yM, JB_HEAD_PIN_DISTANCE_M - 1.6, JB_HEAD_PIN_DISTANCE_M + 1.55);

        if (Math.hypot(body.vxMps, body.vyMps) < PIN_SETTLE_SPEED_MPS && body.fallProgress >= 0.92) {
          body.moving = false;
          body.vxMps = 0;
          body.vyMps = 0;
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

    if (relY < 80 || relY > 99 || relX < 27 || relX > 73) return;

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
    const durationSec = Math.max(0.05, (end.t - start.t) / 1000);
    const upwardPct = -dyPct;
    if (upwardPct < MIN_UPWARD_PCT) return;

    const swipeRate = upwardPct / durationSec;
    const speedNorm = clamp((swipeRate - 45) / 175, 0, 1);
    const speedKmh = GAME_MIN_BALL_SPEED_KMH
      + (GAME_MAX_BALL_SPEED_KMH - GAME_MIN_BALL_SPEED_KMH) * speedNorm;
    const speedMps = speedKmh / 3.6;

    const rawLaunchAngle = Math.atan2(dxPct, Math.max(1, upwardPct));
    const launchAngleRad = clamp(rawLaunchAngle, -MAX_LAUNCH_ANGLE_RAD, MAX_LAUNCH_ANGLE_RAD);

    let curveNorm = 0;
    if (points.length >= 4) {
      const split = Math.max(1, Math.floor(points.length / 2));
      const firstAngle = directionAngle(points[0]!, points[split]!, rect.width, rect.height);
      const secondAngle = directionAngle(points[split]!, points[points.length - 1]!, rect.width, rect.height);
      curveNorm = clamp((secondAngle - firstAngle) / MAX_CURVE_ANGLE_RAD, -1, 1);
    }

    runThrow({ speedMps, launchAngleRad, curveNorm });
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
      className="relative h-full min-h-0 w-full touch-none select-none overflow-hidden"
      style={{
        touchAction: "none",
        overscrollBehavior: "none",
        borderRadius: "22px 22px 26px 26px",
        background: "linear-gradient(180deg, #e7c38d 0%, #d9aa6b 48%, #c58b50 100%)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.42), inset 0 -22px 34px -24px rgba(76,48,24,0.62)",
      }}
    >
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: `${LANE_LEFT_PCT}%`,
          background: "linear-gradient(90deg, #39291f, #66452d 70%, #7c5635)",
          boxShadow: "inset -4px 0 8px rgba(0,0,0,0.32)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-0 right-0"
        style={{
          width: `${100 - LANE_RIGHT_PCT}%`,
          background: "linear-gradient(270deg, #39291f, #66452d 70%, #7c5635)",
          boxShadow: "inset 4px 0 8px rgba(0,0,0,0.32)",
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute"
        style={{
          left: `${LANE_LEFT_PCT}%`,
          right: `${100 - LANE_RIGHT_PCT}%`,
          top: "0",
          bottom: "0",
          background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 8.2%)",
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute"
        style={{
          left: `${LANE_LEFT_PCT}%`,
          right: `${100 - LANE_RIGHT_PCT}%`,
          top: `${OIL_END_Y}%`,
          bottom: `${100 - DOCK_Y}%`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.11))",
        }}
        aria-hidden="true"
      />

      {TARGET_X_PCTS.map((x, index) => (
        <div key={`guide-${index}`} className="pointer-events-none absolute" style={{ left: `${x}%`, top: `${GUIDE_DOTS_Y}%` }} aria-hidden="true">
          <span className="block h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#654628]/55" />
        </div>
      ))}
      {TARGET_X_PCTS.map((x, index) => (
        <div
          key={`arrow-${index}`}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${x}%`,
            top: `${TARGET_ARROWS_Y}%`,
            width: 0,
            height: 0,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderBottom: "10px solid rgba(82,55,31,0.62)",
          }}
          aria-hidden="true"
        />
      ))}

      <div
        className="pointer-events-none absolute h-[2px] bg-[#7e3e30]/80"
        style={{ left: `${LANE_LEFT_PCT}%`, right: `${100 - LANE_RIGHT_PCT}%`, top: `${FOUL_LINE_Y}%` }}
        aria-hidden="true"
      />

      <Pins registerNode={registerPinNode} />

      <div
        ref={ballRef}
        className="pointer-events-none absolute aspect-square rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.38)]"
        style={{
          width: `${BALL_DIAMETER_PCT}%`,
          left: "50%",
          top: `${DOCK_Y}%`,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle at 32% 28%, ${ballVisual.bodyGradient[0]}, ${ballVisual.bodyGradient[1]})`,
          boxShadow: ballVisual.premiumEffect ? `0 0 14px 4px ${ballVisual.hitColor}` : undefined,
        }}
        aria-hidden="true"
      >
        <span className="absolute left-[34%] top-[28%] h-[10%] w-[10%] rounded-full bg-black/40" />
        <span className="absolute left-[49%] top-[22%] h-[9%] w-[9%] rounded-full bg-black/40" />
        <span className="absolute left-[52%] top-[38%] h-[9%] w-[9%] rounded-full bg-black/40" />
      </div>

      <div className="pointer-events-none absolute bottom-[1.8%] left-1/2 z-30 -translate-x-1/2 text-center">
        <p className="whitespace-nowrap rounded-full bg-[#2f2119]/70 px-3 py-1.5 text-[10px] font-black tracking-[0.07em] text-[#fff7e8] backdrop-blur-sm">
          {active ? "ボールから上へスワイプ" : ""}
        </p>
      </div>
    </div>
  );
}
