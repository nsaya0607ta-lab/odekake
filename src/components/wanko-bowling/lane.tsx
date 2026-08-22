"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { PIN_LAYOUT, PIN_VISUAL_WIDTH_PCT, Pins } from "./pins";
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
  JB_PIN_SPACING_M,
  JB_TOTAL_WIDTH_M,
  OIL_HOOK_FACTOR,
  PIN_CHAIN_KNOCK_SPEED_MPS,
  PIN_DIRECT_KNOCK_SPEED_MPS,
  PIN_FRICTION_PER_SEC,
  PIN_PIN_RESTITUTION,
  PIN_SETTLE_SPEED_MPS,
} from "@/lib/games/wanko-bowling-physics";

const DOCK_Y = 94;
const HEAD_PIN_SCREEN_Y = 13.5;
const MIN_UPWARD_PCT = 8;
const MAX_THROW_MS = 7000;
const MAX_SWIPE_SAMPLES = 64;
const BALL_RADIUS_M = JB_BALL_DIAMETER_M / 2;
const PIN_RADIUS_M = JB_PIN_DIAMETER_M / 2;
const PIN_COLLISION_RADIUS_M = BALL_RADIUS_M + PIN_RADIUS_M + 0.006;
const PIN_PAIR_RADIUS_M = JB_PIN_DIAMETER_M + 0.006;
const BALL_EXIT_DISTANCE_M = JB_HEAD_PIN_DISTANCE_M + 1.15;
const MAX_LAUNCH_ANGLE_RAD = 2.6 * Math.PI / 180;
const OIL_BALL_DRAG_PER_SEC = 0.012;
const DRY_BALL_DRAG_PER_SEC = 0.04;
const GUTTER_BALL_DRAG_PER_SEC = 0.035;
const FOUL_LINE_Y = 97;
const PIN_ROW_DEPTH_M = JB_PIN_SPACING_M * Math.sqrt(3) / 2;
const PIN_DECK_DEPTH_M = PIN_ROW_DEPTH_M * 3;
const PIN_DECK_SCREEN_DEPTH_PCT = 8.4;
const TARGET_BOARDS = [5, 10, 15, 20, 25, 30, 35] as const;
const GUIDE_DISTANCE_M = 7 * 0.3048;
const TARGET_DISTANCE_M = 15 * 0.3048;

// 指の小さな揺れは無視するが、意図的に曲げたスワイプにはすぐ反応させる。
const CURVE_DEAD_ZONE_RAD = 2.5 * Math.PI / 180;
const CURVE_FULL_SCALE_RAD = 16 * Math.PI / 180;
const CURVE_BOW_DEAD_ZONE_PCT = 0.35;
const CURVE_BOW_FULL_SCALE_PCT = 4.5;
const MAX_CURVE_NORM = 0.9;

type Point = { x: number; y: number; t: number };
type GutterSide = "left" | "right" | null;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function averagePoint(points: Point[]): Point {
  const count = Math.max(1, points.length);
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / count,
    y: points.reduce((sum, point) => sum + point.y, 0) / count,
    t: points.reduce((sum, point) => sum + point.t, 0) / count,
  };
}

/** 手前は広く、18.288m先のピンデッキは狭く見せる透視投影。 */
function laneHalfWidthPct(distanceM: number): number {
  const depth = clamp(distanceM / JB_HEAD_PIN_DISTANCE_M, 0, 1);
  return 43 - 20 * Math.pow(depth, 0.68);
}

function gutterVisualWidthPct(distanceM: number): number {
  const depth = clamp(distanceM / JB_HEAD_PIN_DISTANCE_M, 0, 1);
  return 4.6 - 1.6 * Math.pow(depth, 0.72);
}

function worldYToPct(distanceFromFoulM: number): number {
  if (distanceFromFoulM <= JB_HEAD_PIN_DISTANCE_M) {
    const depth = clamp(distanceFromFoulM / JB_HEAD_PIN_DISTANCE_M, 0, 1);
    return DOCK_Y - (DOCK_Y - HEAD_PIN_SCREEN_Y) * Math.pow(depth, 0.9);
  }

  const deckDepth = (distanceFromFoulM - JB_HEAD_PIN_DISTANCE_M) / PIN_DECK_DEPTH_M;
  return HEAD_PIN_SCREEN_Y - deckDepth * PIN_DECK_SCREEN_DEPTH_PCT;
}

function worldXToPct(xM: number, distanceM: number): number {
  const halfLane = laneHalfWidthPct(distanceM);
  const gutterVisual = gutterVisualWidthPct(distanceM);
  const leftLaneEdge = 50 - halfLane;
  const rightLaneEdge = 50 + halfLane;
  const physicalLeftLane = JB_GUTTER_WIDTH_M;
  const physicalRightLane = JB_GUTTER_WIDTH_M + JB_LANE_WIDTH_M;

  if (xM < physicalLeftLane) {
    const gutterT = clamp(xM / JB_GUTTER_WIDTH_M, 0, 1);
    return leftLaneEdge - gutterVisual * (1 - gutterT);
  }

  if (xM > physicalRightLane) {
    const gutterT = clamp((xM - physicalRightLane) / JB_GUTTER_WIDTH_M, 0, 1);
    return rightLaneEdge + gutterVisual * gutterT;
  }

  const laneT = clamp((xM - physicalLeftLane) / JB_LANE_WIDTH_M, 0, 1);
  return leftLaneEdge + laneT * halfLane * 2;
}

/** 画面上の狙い位置を、その距離にある実レーンX座標へ戻す。 */
function screenXToWorldX(screenXPct: number, distanceM: number): number {
  const halfLane = laneHalfWidthPct(distanceM);
  const gutterVisual = gutterVisualWidthPct(distanceM);
  const leftLaneEdge = 50 - halfLane;
  const rightLaneEdge = 50 + halfLane;
  const outerLeft = leftLaneEdge - gutterVisual;
  const outerRight = rightLaneEdge + gutterVisual;
  const x = clamp(screenXPct, outerLeft, outerRight);

  if (x < leftLaneEdge) {
    const gutterT = (x - outerLeft) / Math.max(0.001, gutterVisual);
    return gutterT * JB_GUTTER_WIDTH_M;
  }

  if (x > rightLaneEdge) {
    const gutterT = (x - rightLaneEdge) / Math.max(0.001, gutterVisual);
    return JB_GUTTER_WIDTH_M + JB_LANE_WIDTH_M + gutterT * JB_GUTTER_WIDTH_M;
  }

  const laneT = (x - leftLaneEdge) / Math.max(0.001, halfLane * 2);
  return JB_GUTTER_WIDTH_M + laneT * JB_LANE_WIDTH_M;
}

function boardXToPct(board: number, distanceM: number): number {
  const normalized = (board - 20) / 20;
  return 50 + normalized * laneHalfWidthPct(distanceM);
}

function ballVisualWidthPct(distanceM: number): number {
  const depth = clamp(distanceM / JB_HEAD_PIN_DISTANCE_M, 0, 1);
  return 10.2 - 5 * Math.pow(depth, 0.72);
}

function pinVisualWidthPct(distanceM: number): number {
  const deckDepth = clamp(
    (distanceM - JB_HEAD_PIN_DISTANCE_M) / Math.max(0.001, PIN_DECK_DEPTH_M),
    0,
    1,
  );
  return PIN_VISUAL_WIDTH_PCT - deckDepth * 0.25;
}

function screenDirectionAngle(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const upward = a.y - b.y;
  return Math.atan2(dx, Math.max(1, upward));
}

/**
 * 球速は「最後の160ms」を75%、ジェスチャー全体を25%で評価する。
 * これにより最後に強く弾いた時の速さがそのまま球速へ反映される。
 */
function estimateReleaseSwipeRate(points: Point[], boardHeightPx: number): number {
  if (points.length < 2) return 0;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const overallDt = Math.max(0.04, (last.t - first.t) / 1000);
  const overallUpPct = ((first.y - last.y) / Math.max(1, boardHeightPx)) * 100;
  const overallRate = Math.max(0, overallUpPct / overallDt);

  const recentCutoff = last.t - 160;
  let recentStart = first;
  for (let i = points.length - 2; i >= 0; i -= 1) {
    const point = points[i]!;
    recentStart = point;
    if (point.t <= recentCutoff) break;
  }

  const recentDt = Math.max(0.025, (last.t - recentStart.t) / 1000);
  const recentUpPct = ((recentStart.y - last.y) / Math.max(1, boardHeightPx)) * 100;
  const recentRate = Math.max(0, recentUpPct / recentDt);

  return recentRate * 0.75 + overallRate * 0.25;
}

/**
 * 前半と後半の指の向きの変化を主成分にし、軌道の弓なり量も少し加える。
 * 直線スワイプは0、意図的な曲線には±1近くまで反応する。
 */
function estimateCurveNorm(points: Point[], boardWidthPx: number): number {
  if (points.length < 5) return 0;

  const length = points.length;
  const earlyEndIndex = clamp(Math.floor(length * 0.38), 2, length - 3);
  const lateStartIndex = clamp(Math.floor(length * 0.58), earlyEndIndex + 1, length - 2);

  const firstStart = averagePoint(points.slice(0, Math.min(3, earlyEndIndex)));
  const firstEnd = averagePoint(points.slice(Math.max(0, earlyEndIndex - 2), earlyEndIndex + 1));
  const secondStart = averagePoint(points.slice(lateStartIndex, Math.min(length, lateStartIndex + 3)));
  const secondEnd = averagePoint(points.slice(-Math.min(3, length - lateStartIndex)));

  const firstAngle = screenDirectionAngle(firstStart, firstEnd);
  const secondAngle = screenDirectionAngle(secondStart, secondEnd);
  const delta = normalizeAngle(secondAngle - firstAngle);
  const angleMagnitude = Math.abs(delta);

  let angleSignal = 0;
  if (angleMagnitude > CURVE_DEAD_ZONE_RAD) {
    const scaled = clamp(
      (angleMagnitude - CURVE_DEAD_ZONE_RAD) / (CURVE_FULL_SCALE_RAD - CURVE_DEAD_ZONE_RAD),
      0,
      1,
    );
    angleSignal = Math.sign(delta) * scaled;
  }

  const start = averagePoint(points.slice(0, Math.min(2, length)));
  const end = averagePoint(points.slice(-Math.min(2, length)));
  const midStart = Math.max(1, Math.floor(length * 0.42));
  const midEnd = Math.min(length - 1, Math.ceil(length * 0.62));
  const mid = averagePoint(points.slice(midStart, midEnd + 1));
  const totalUp = Math.max(1, start.y - end.y);
  const progress = clamp((start.y - mid.y) / totalUp, 0, 1);
  const straightX = start.x + (end.x - start.x) * progress;
  const bowPct = ((mid.x - straightX) / Math.max(1, boardWidthPx)) * 100;
  const bowMagnitude = Math.abs(bowPct);

  let bowSignal = 0;
  if (bowMagnitude > CURVE_BOW_DEAD_ZONE_PCT) {
    const scaled = clamp(
      (bowMagnitude - CURVE_BOW_DEAD_ZONE_PCT)
        / (CURVE_BOW_FULL_SCALE_PCT - CURVE_BOW_DEAD_ZONE_PCT),
      0,
      1,
    );
    bowSignal = Math.sign(bowPct) * scaled;
  }

  return clamp(angleSignal * 0.78 + bowSignal * 0.22, -1, 1) * MAX_CURVE_NORM;
}

const NEAR_LANE_HALF = laneHalfWidthPct(0);
const FAR_LANE_HALF = laneHalfWidthPct(JB_HEAD_PIN_DISTANCE_M);
const NEAR_GUTTER = gutterVisualWidthPct(0);
const FAR_GUTTER = gutterVisualWidthPct(JB_HEAD_PIN_DISTANCE_M);
const NEAR_LANE_LEFT = 50 - NEAR_LANE_HALF;
const NEAR_LANE_RIGHT = 50 + NEAR_LANE_HALF;
const FAR_LANE_LEFT = 50 - FAR_LANE_HALF;
const FAR_LANE_RIGHT = 50 + FAR_LANE_HALF;
const NEAR_OUTER_LEFT = NEAR_LANE_LEFT - NEAR_GUTTER;
const NEAR_OUTER_RIGHT = NEAR_LANE_RIGHT + NEAR_GUTTER;
const FAR_OUTER_LEFT = FAR_LANE_LEFT - FAR_GUTTER;
const FAR_OUTER_RIGHT = FAR_LANE_RIGHT + FAR_GUTTER;
const GUIDE_DOTS_Y = worldYToPct(GUIDE_DISTANCE_M);
const TARGET_ARROWS_Y = worldYToPct(TARGET_DISTANCE_M);
const OIL_END_Y = worldYToPct(GAME_OIL_LENGTH_M);
const OIL_HALF = laneHalfWidthPct(GAME_OIL_LENGTH_M);
const OIL_LEFT = 50 - OIL_HALF;
const OIL_RIGHT = 50 + OIL_HALF;
const BALL_START_X_M = JB_GUTTER_WIDTH_M + JB_LANE_WIDTH_M / 2;
const LEFT_GUTTER_CENTER_M = JB_GUTTER_WIDTH_M / 2;
const RIGHT_GUTTER_CENTER_M = JB_GUTTER_WIDTH_M + JB_LANE_WIDTH_M + JB_GUTTER_WIDTH_M / 2;

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
): { distance: number; x: number; y: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  const t = abLenSq > 0
    ? clamp(((px - ax) * abx + (py - ay) * aby) / abLenSq, 0, 1)
    : 0;
  const x = ax + abx * t;
  const y = ay + aby * t;
  return { distance: Math.hypot(px - x, py - y), x, y };
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

    const screenY = worldYToPct(body.yM);
    el.style.left = `${worldXToPct(body.xM, body.yM)}%`;
    el.style.top = `${screenY}%`;
    el.style.width = `${pinVisualWidthPct(body.yM)}%`;
    el.style.opacity = body.visible ? "1" : "0";
    el.style.zIndex = String(500 + Math.round(screenY * 10));
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
      current.style.width = `${ballVisualWidthPct(0)}%`;
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
    el.style.left = `${worldXToPct(xM, yM)}%`;
    el.style.top = `${worldYToPct(yM)}%`;
    el.style.width = `${ballVisualWidthPct(yM)}%`;
    el.style.transform = `translate(-50%, -50%) rotate(${rotateDeg}deg)`;
  }, []);

  const runThrow = useCallback((launch: {
    speedMps: number;
    launchAngleRad: number;
    curveNorm: number;
  }) => {
    throwingRef.current = true;

    let bxM = BALL_START_X_M;
    let byM = 0;
    let bvxMps = launch.speedMps * Math.sin(launch.launchAngleRad);
    let bvyMps = launch.speedMps * Math.cos(launch.launchAngleRad);
    let rotate = 0;
    let gutterSide: GutterSide = null;
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
      const speedNorm = clamp(
        ((launch.speedMps * 3.6) - GAME_MIN_BALL_SPEED_KMH)
          / (GAME_MAX_BALL_SPEED_KMH - GAME_MIN_BALL_SPEED_KMH),
        0,
        1,
      );

      window.setTimeout(() => {
        throwingRef.current = false;
        const knockedIds = [...knockedThisThrow].filter((id) => preThrowStandingIds.has(id));
        onRoll({ knockedIds, isGutter: gutterSide !== null && knockedIds.length === 0, power: 0.3 + speedNorm * 0.7 });
      }, gutterSide ? 180 : 280);
    };

    const step = (now: number) => {
      const dt = Math.min(0.024, Math.max(0.001, (now - last) / 1000));
      last = now;

      if (!ballDone) {
        const prevBxM = bxM;
        const prevByM = byM;
        const onOil = byM < GAME_OIL_LENGTH_M;

        if (gutterSide === null) {
          const hookFactor = onOil ? OIL_HOOK_FACTOR : DRY_HOOK_FACTOR;
          const drag = onOil ? OIL_BALL_DRAG_PER_SEC : DRY_BALL_DRAG_PER_SEC;
          bvxMps += launch.curveNorm * BACKEND_HOOK_ACCEL_MPS2 * hookFactor * dt;
          const ballDecay = Math.exp(-drag * dt);
          bvxMps *= ballDecay;
          bvyMps *= ballDecay;
        } else {
          // ガターに落ちても球は消さず、溝の中をそのまま奥へ走らせる。
          const gutterDecay = Math.exp(-GUTTER_BALL_DRAG_PER_SEC * dt);
          const lateralDecay = Math.exp(-9 * dt);
          bvxMps *= lateralDecay;
          bvyMps *= gutterDecay;
        }

        bxM += bvxMps * dt;
        byM += bvyMps * dt;

        const laneLeftM = JB_GUTTER_WIDTH_M;
        const laneRightM = JB_GUTTER_WIDTH_M + JB_LANE_WIDTH_M;

        // ボール中心がレーン端を越えた瞬間 = ボールの50%以上がガター側に入った状態。
        if (gutterSide === null) {
          if (bxM <= laneLeftM) gutterSide = "left";
          else if (bxM >= laneRightM) gutterSide = "right";
        }

        if (gutterSide !== null) {
          const targetX = gutterSide === "left" ? LEFT_GUTTER_CENTER_M : RIGHT_GUTTER_CENTER_M;
          bxM += (targetX - bxM) * Math.min(1, dt * 7.5);

          // 実寸ガター幅の中にボール中心を保持する。
          if (gutterSide === "left") {
            bxM = clamp(bxM, BALL_RADIUS_M, Math.max(BALL_RADIUS_M, JB_GUTTER_WIDTH_M - BALL_RADIUS_M));
          } else {
            const minX = laneRightM + BALL_RADIUS_M;
            const maxX = JB_TOTAL_WIDTH_M - BALL_RADIUS_M;
            bxM = clamp(bxM, Math.min(minX, maxX), maxX);
          }
        }

        const angularSpeedRad = Math.hypot(bvxMps, bvyMps) / BALL_RADIUS_M;
        rotate += angularSpeedRad * dt * (180 / Math.PI);

        // ガターに入った後はピンへ戻らない。レーン上の球だけ衝突判定する。
        if (gutterSide === null && byM >= JB_HEAD_PIN_DISTANCE_M - 1.35) {
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
    const sampleCount = Math.min(3, Math.max(1, Math.floor(points.length / 3)));
    const start = averagePoint(points.slice(0, sampleCount));
    const end = averagePoint(points.slice(-sampleCount));
    const startXPct = ((start.x - rect.left) / rect.width) * 100;
    const startYPct = ((start.y - rect.top) / rect.height) * 100;
    const endYPct = ((end.y - rect.top) / rect.height) * 100;
    const upwardPct = startYPct - endYPct;
    if (upwardPct < MIN_UPWARD_PCT) return;

    // 最後に指を弾く速さを強く反映。以前のようにすぐ同じ上限速度へ張り付かない。
    const swipeRate = estimateReleaseSwipeRate(points, rect.height);
    const rawSpeedNorm = clamp((swipeRate - 25) / 430, 0, 1);
    const speedNorm = Math.pow(rawSpeedNorm, 0.72);
    const speedKmh = GAME_MIN_BALL_SPEED_KMH
      + (GAME_MAX_BALL_SPEED_KMH - GAME_MIN_BALL_SPEED_KMH) * speedNorm;
    const speedMps = speedKmh / 3.6;

    // 初期方向はジェスチャー前半〜中央で決め、後半の曲げ操作はカーブとして分離する。
    const directionIndex = Math.max(sampleCount, Math.min(points.length - 1, Math.floor(points.length * 0.56)));
    const directionEnd = averagePoint(points.slice(Math.max(0, directionIndex - 2), directionIndex + 1));
    const directionEndXPct = ((directionEnd.x - rect.left) / rect.width) * 100;
    const directionEndYPct = ((directionEnd.y - rect.top) / rect.height) * 100;
    const directionUpPct = Math.max(1, startYPct - directionEndYPct);
    const rayScaleToPins = (startYPct - HEAD_PIN_SCREEN_Y) / directionUpPct;
    const aimScreenXPct = startXPct + (directionEndXPct - startXPct) * rayScaleToPins;
    const targetWorldX = screenXToWorldX(aimScreenXPct, JB_HEAD_PIN_DISTANCE_M);
    const rawLaunchAngle = Math.atan2(targetWorldX - BALL_START_X_M, JB_HEAD_PIN_DISTANCE_M);
    const launchAngleRad = clamp(rawLaunchAngle, -MAX_LAUNCH_ANGLE_RAD, MAX_LAUNCH_ANGLE_RAD);

    const curveNorm = estimateCurveNorm(points, rect.width);
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
        background: "linear-gradient(180deg, #241914 0%, #39251a 45%, #2b1b13 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -20px 32px -24px rgba(0,0,0,0.8)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          clipPath: `polygon(${FAR_LANE_LEFT}% 0%, ${FAR_LANE_RIGHT}% 0%, ${NEAR_LANE_RIGHT}% 100%, ${NEAR_LANE_LEFT}% 100%)`,
          background: "linear-gradient(180deg, #e6bd7d 0%, #ddb170 42%, #d29d5b 100%)",
          boxShadow: "inset 0 0 24px rgba(104,67,34,0.16)",
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          clipPath: `polygon(${FAR_OUTER_LEFT}% 0%, ${FAR_LANE_LEFT}% 0%, ${NEAR_LANE_LEFT}% 100%, ${NEAR_OUTER_LEFT}% 100%)`,
          background: "linear-gradient(90deg, #3f2a1d, #654329 70%, #775034)",
          boxShadow: "inset -3px 0 7px rgba(0,0,0,0.4)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          clipPath: `polygon(${FAR_LANE_RIGHT}% 0%, ${FAR_OUTER_RIGHT}% 0%, ${NEAR_OUTER_RIGHT}% 100%, ${NEAR_LANE_RIGHT}% 100%)`,
          background: "linear-gradient(270deg, #3f2a1d, #654329 70%, #775034)",
          boxShadow: "inset 3px 0 7px rgba(0,0,0,0.4)",
        }}
        aria-hidden="true"
      />

      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {[-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8].map((n) => (
          <line
            key={n}
            x1={50 + n * FAR_LANE_HALF}
            y1="0"
            x2={50 + n * NEAR_LANE_HALF}
            y2="100"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="0.15"
          />
        ))}
        <polygon
          points={`${OIL_LEFT},${OIL_END_Y} ${OIL_RIGHT},${OIL_END_Y} ${NEAR_LANE_RIGHT},100 ${NEAR_LANE_LEFT},100`}
          fill="rgba(255,255,255,0.035)"
        />
      </svg>

      {TARGET_BOARDS.map((board) => (
        <div
          key={`guide-${board}`}
          className="pointer-events-none absolute"
          style={{ left: `${boardXToPct(board, GUIDE_DISTANCE_M)}%`, top: `${GUIDE_DOTS_Y}%` }}
          aria-hidden="true"
        >
          <span className="block h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#654628]/55" />
        </div>
      ))}

      {TARGET_BOARDS.map((board) => (
        <div
          key={`arrow-${board}`}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${boardXToPct(board, TARGET_DISTANCE_M)}%`,
            top: `${TARGET_ARROWS_Y}%`,
            width: 0,
            height: 0,
            borderLeft: "3.5px solid transparent",
            borderRight: "3.5px solid transparent",
            borderBottom: "9px solid rgba(82,55,31,0.6)",
          }}
          aria-hidden="true"
        />
      ))}

      <div
        className="pointer-events-none absolute h-[2px] bg-[#8c4735]/75"
        style={{ left: `${NEAR_LANE_LEFT}%`, right: `${100 - NEAR_LANE_RIGHT}%`, top: `${FOUL_LINE_Y}%` }}
        aria-hidden="true"
      />

      <Pins registerNode={registerPinNode} />

      <div
        ref={ballRef}
        className="pointer-events-none absolute aspect-square rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.38)]"
        style={{
          width: `${ballVisualWidthPct(0)}%`,
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

      <div className="pointer-events-none absolute bottom-[1.8%] left-1/2 z-[900] -translate-x-1/2 text-center">
        <p className="whitespace-nowrap rounded-full bg-[#2f2119]/70 px-3 py-1.5 text-[10px] font-black tracking-[0.07em] text-[#fff7e8] backdrop-blur-sm">
          {active ? "速さ・方向・カーブをスワイプで操作" : ""}
        </p>
      </div>
    </div>
  );
}
