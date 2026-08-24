"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PIN_LAYOUT, PIN_VISUAL_WIDTH_PCT, Pins } from "./pins";
import type { BowlingBallVisual } from "@/lib/games/wanko-bowling-balls";
import {
  AXIS_ROTATION_INPUT_EXPONENT,
  BALL_INERTIA_X_KGM2,
  BALL_INERTIA_Y_KGM2,
  BALL_INERTIA_Z_KGM2,
  BALL_PIN_RESTITUTION,
  BALL_SPIN_RADIUS_M,
  GAME_BALL_MASS_KG,
  GAME_MAX_BALL_SPEED_KMH,
  GAME_MIN_BALL_SPEED_KMH,
  GAME_OIL_LENGTH_M,
  GRAVITY_MPS2,
  JB_BALL_DIAMETER_M,
  JB_GUTTER_WIDTH_M,
  JB_HEAD_PIN_DISTANCE_M,
  JB_LANE_WIDTH_M,
  JB_PIN_DIAMETER_M,
  JB_PIN_HEIGHT_M,
  JB_PIN_MASS_KG,
  JB_PIN_SPACING_M,
  JB_TOTAL_WIDTH_M,
  laneFrictionMuAt,
  MAX_AXIS_ROTATION_DEG,
  PIN_CHAIN_KNOCK_SPEED_MPS,
  PIN_DIRECT_KNOCK_SPEED_MPS,
  PIN_FRICTION_PER_SEC,
  PIN_PIN_RESTITUTION,
  PIN_SETTLE_SPEED_MPS,
  SLIP_EPSILON_MPS,
  spinMagnitudeRadSAtSpeed,
  SPIN_AXIS_TILT_DEG,
} from "@/lib/games/wanko-bowling-physics";

const DOCK_Y = 94;
const HEAD_PIN_SCREEN_Y = 19.5;
const MIN_UPWARD_PCT = 8;
const MAX_THROW_MS = 7000;
const MAX_SWIPE_SAMPLES = 96;
const BALL_RADIUS_M = JB_BALL_DIAMETER_M / 2;
const PIN_RADIUS_M = JB_PIN_DIAMETER_M / 2;
const PIN_COLLISION_RADIUS_M = BALL_RADIUS_M + PIN_RADIUS_M;
const PIN_PAIR_RADIUS_M = JB_PIN_DIAMETER_M;
const FALLEN_PIN_EXTRA_REACH_M = Math.max(0, JB_PIN_HEIGHT_M / 2 - PIN_RADIUS_M) * 0.82;
const BALL_EXIT_DISTANCE_M = JB_HEAD_PIN_DISTANCE_M + 1.15;
const MAX_LAUNCH_ANGLE_RAD = 16 * Math.PI / 180;
const GUTTER_BALL_DRAG_PER_SEC = 0.035;
const FOUL_LINE_Y = 97;
const PIN_ROW_DEPTH_M = JB_PIN_SPACING_M * Math.sqrt(3) / 2;
const PIN_DECK_DEPTH_M = PIN_ROW_DEPTH_M * 3;
const PIN_DECK_SCREEN_DEPTH_PCT = 4.2;
const PIN_DECK_LANE_CONVERGENCE_PCT = 2.5;
const HEAD_PIN_LANE_HALF_PCT = 43 - 20;
const HEAD_PIN_LANE_APPROACH_SLOPE_PCT_PER_M = (20 * 0.68) / JB_HEAD_PIN_DISTANCE_M;
const PIN_DECK_LANE_QUADRATIC_TERM_PCT_PER_M2 =
  (PIN_DECK_LANE_CONVERGENCE_PCT - HEAD_PIN_LANE_APPROACH_SLOPE_PCT_PER_M * PIN_DECK_DEPTH_M)
  / (PIN_DECK_DEPTH_M * PIN_DECK_DEPTH_M);
const TARGET_BOARDS = [5, 10, 15, 20, 25, 30, 35] as const;
const GUIDE_DISTANCE_M = 7 * 0.3048;
const TARGET_DISTANCE_M = 15 * 0.3048;

const CURVE_DEAD_ZONE_RAD = 5 * Math.PI / 180;
const CURVE_FULL_SCALE_RAD = 20 * Math.PI / 180;
const CURVE_BOW_DEAD_ZONE_PCT = 0.8;
const CURVE_BOW_FULL_SCALE_PCT = 5;
const MAX_CURVE_NORM = 0.85;
/**
 * axis rotationにして7度まではストレート判定にする。
 * computeAxisRotationの axisRotationRad = MAX_AXIS_ROTATION_DEG * curve01^EXPONENT
 * の逆算（curve01 = combinedとほぼ同義）で、7度に相当するcombinedのしきい値を求める。
 */
const CURVE_STRAIGHT_SNAP_DEG = 7;
const CURVE_STRAIGHT_SNAP = Math.pow(
  CURVE_STRAIGHT_SNAP_DEG / MAX_AXIS_ROTATION_DEG,
  1 / AXIS_ROTATION_INPUT_EXPONENT,
);

const DIRECT_IMPULSE_WEIGHT = 0.16;
const CHAIN_IMPULSE_WEIGHT = 0.24;
const DIRECT_SIDE_BONUS_MPS = 0.06;
const CHAIN_SIDE_BONUS_MPS = 0.13;
const CHAIN_SIDE_THRESHOLD_REDUCTION = 0;

type Point = { x: number; y: number; t: number };
type GutterSide = "left" | "right" | null;
type PointerMode = "place" | "throw" | null;

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
  impulse: number;
  normalX: number;
  normalY: number;
  relativeNormalSpeed: number;
};

export type LaneRollResult = {
  knockedIds: number[];
  isGutter: boolean;
  power: number;
};

type LaneProps = {
  ballVisual: BowlingBallVisual;
  resetSignal: number;
  newGameSignal: number;
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

function laneHalfWidthPct(distanceM: number): number {
  const depth = clamp(distanceM / JB_HEAD_PIN_DISTANCE_M, 0, 1);
  const approachHalf = 43 - 20 * Math.pow(depth, 0.68);
  if (distanceM <= JB_HEAD_PIN_DISTANCE_M) return approachHalf;

  const deckM = clamp(distanceM - JB_HEAD_PIN_DISTANCE_M, 0, PIN_DECK_DEPTH_M);
  return HEAD_PIN_LANE_HALF_PCT
    - HEAD_PIN_LANE_APPROACH_SLOPE_PCT_PER_M * deckM
    - PIN_DECK_LANE_QUADRATIC_TERM_PCT_PER_M2 * deckM * deckM;
}

function gutterVisualWidthPct(distanceM: number): number {
  const depth = clamp(distanceM / JB_HEAD_PIN_DISTANCE_M, 0, 1);
  return 4.6 - 1.6 * Math.pow(depth, 0.72);
}

const HEAD_PIN_APPROACH_SLOPE_PCT_PER_M = ((DOCK_Y - HEAD_PIN_SCREEN_Y) * 0.9) / JB_HEAD_PIN_DISTANCE_M;
const PIN_DECK_QUADRATIC_TERM_PCT_PER_M2 =
  (PIN_DECK_SCREEN_DEPTH_PCT - HEAD_PIN_APPROACH_SLOPE_PCT_PER_M * PIN_DECK_DEPTH_M)
  / (PIN_DECK_DEPTH_M * PIN_DECK_DEPTH_M);

function worldYToPct(distanceFromFoulM: number): number {
  if (distanceFromFoulM <= JB_HEAD_PIN_DISTANCE_M) {
    const depth = distanceFromFoulM / JB_HEAD_PIN_DISTANCE_M;
    return DOCK_Y - (DOCK_Y - HEAD_PIN_SCREEN_Y) * Math.pow(depth, 0.9);
  }

  const deckM = distanceFromFoulM - JB_HEAD_PIN_DISTANCE_M;
  return HEAD_PIN_SCREEN_Y
    - HEAD_PIN_APPROACH_SLOPE_PCT_PER_M * deckM
    - PIN_DECK_QUADRATIC_TERM_PCT_PER_M2 * deckM * deckM;
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

function screenXToVirtualWorldX(screenXPct: number, distanceM: number): number {
  const halfLane = laneHalfWidthPct(distanceM);
  const leftLaneEdge = 50 - halfLane;
  const laneT = (screenXPct - leftLaneEdge) / Math.max(0.001, halfLane * 2);
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
  return PIN_VISUAL_WIDTH_PCT - deckDepth * 0.8;
}

function pinPairCollisionRadius(a: PinBody, b: PinBody): number {
  const fallReach = Math.max(a.fallProgress, b.fallProgress) * FALLEN_PIN_EXTRA_REACH_M;
  return PIN_PAIR_RADIUS_M + fallReach;
}

function computeAxisRotation(launchAngleRad: number, curveNorm: number): { axisRotationRad: number; curveSign: number } {
  const curve01 = clamp(Math.abs(curveNorm) / MAX_CURVE_NORM, 0, 1);
  const axisRotationRad = (MAX_AXIS_ROTATION_DEG * Math.pow(curve01, AXIS_ROTATION_INPUT_EXPONENT)) * Math.PI / 180;
  const curveSign = launchAngleRad !== 0 ? Math.sign(launchAngleRad) : Math.sign(curveNorm);
  return { axisRotationRad, curveSign };
}

/**
 * 精密モード用: computeAxisRotationの逆変換。
 * スライダーで指定したaxis rotation角度（0〜MAX_AXIS_ROTATION_DEG）から、
 * 同じ角度をcomputeAxisRotationが再現するcurveNormを逆算する。
 */
function axisRotationDegToCurveNorm(axisRotationDeg: number): number {
  const clampedDeg = clamp(axisRotationDeg, 0, MAX_AXIS_ROTATION_DEG);
  const curve01 = Math.pow(clampedDeg / MAX_AXIS_ROTATION_DEG, 1 / AXIS_ROTATION_INPUT_EXPONENT);
  return curve01 * MAX_CURVE_NORM;
}

function computeAimFromPoints(
  points: Point[],
  rect: { left: number; top: number; width: number; height: number },
  startXM: number,
  minUpwardPct: number,
): { launchAngleRad: number; curveNorm: number; targetWorldX: number } | null {
  if (points.length < 2) return null;

  const sampleCount = Math.min(3, Math.max(1, Math.floor(points.length / 3)));
  const start = averagePoint(points.slice(0, sampleCount));
  const end = averagePoint(points.slice(-sampleCount));
  const startXPct = ((start.x - rect.left) / rect.width) * 100;
  const startYPct = ((start.y - rect.top) / rect.height) * 100;
  const endYPct = ((end.y - rect.top) / rect.height) * 100;
  const upwardPct = startYPct - endYPct;
  if (upwardPct < minUpwardPct) return null;

  const directionIndex = Math.max(sampleCount, Math.min(points.length - 1, Math.floor(points.length * 0.56)));
  const directionEnd = averagePoint(points.slice(Math.max(0, directionIndex - 2), directionIndex + 1));
  const directionEndXPct = ((directionEnd.x - rect.left) / rect.width) * 100;
  const directionEndYPct = ((directionEnd.y - rect.top) / rect.height) * 100;
  const directionUpPct = Math.max(1, startYPct - directionEndYPct);
  const rayScaleToPins = (startYPct - HEAD_PIN_SCREEN_Y) / directionUpPct;
  const aimScreenXPct = startXPct + (directionEndXPct - startXPct) * rayScaleToPins;
  const targetWorldX = screenXToWorldX(aimScreenXPct, JB_HEAD_PIN_DISTANCE_M);
  const virtualTargetWorldX = screenXToVirtualWorldX(aimScreenXPct, JB_HEAD_PIN_DISTANCE_M);
  const rawLaunchAngle = Math.atan2(virtualTargetWorldX - startXM, JB_HEAD_PIN_DISTANCE_M);
  const launchAngleRad = mapLaunchAngleInput(rawLaunchAngle);
  const curveNorm = estimateCurveNorm(points, rect.width);
  return { launchAngleRad, curveNorm, targetWorldX };
}

function screenDirectionAngle(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const upward = a.y - b.y;
  return Math.atan2(dx, Math.max(1, upward));
}

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

function mapLaunchAngleInput(rawAngleRad: number): number {
  return clamp(rawAngleRad, -MAX_LAUNCH_ANGLE_RAD, MAX_LAUNCH_ANGLE_RAD);
}

/**
 * スワイプの軌跡（角度変化＋横方向の膨らみ）だけからカーブ強度を推定する。
 * ストレート/カーブの分類はボタンではなくこの推定値そのもので決まる
 * （デッドゾーン以下ならほぼ0になり、自然にストレート投球になる）。
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

  const combined = clamp(angleSignal * 0.78 + bowSignal * 0.22, -1, 1);
  if (Math.abs(combined) < CURVE_STRAIGHT_SNAP) return 0;
  return combined * MAX_CURVE_NORM;
}

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
  const relativeNormalSpeed = (avx - bvx) * nx + (avy - bvy) * ny;
  if (relativeNormalSpeed <= 0) return null;

  const invA = 1 / massA;
  const invB = 1 / massB;
  const impulse = ((1 + restitution) * relativeNormalSpeed) / (invA + invB);

  return {
    avx: avx - impulse * nx * invA,
    avy: avy - impulse * ny * invA,
    bvx: bvx + impulse * nx * invB,
    bvy: bvy + impulse * ny * invB,
    impulse,
    normalX: nx,
    normalY: ny,
    relativeNormalSpeed,
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

function effectiveKnockSpeed(
  vx: number,
  vy: number,
  collision: CollisionResult,
  chain: boolean,
): { speed: number; threshold: number } {
  const travelSpeed = Math.hypot(vx, vy);
  const impulseVelocity = collision.impulse / JB_PIN_MASS_KG;
  const sideFactor = Math.abs(collision.normalX);
  const impulseWeight = chain ? CHAIN_IMPULSE_WEIGHT : DIRECT_IMPULSE_WEIGHT;
  const sideBonus = sideFactor * (chain ? CHAIN_SIDE_BONUS_MPS : DIRECT_SIDE_BONUS_MPS);
  const thresholdBase = chain ? PIN_CHAIN_KNOCK_SPEED_MPS : PIN_DIRECT_KNOCK_SPEED_MPS;
  const threshold = chain
    ? thresholdBase * (1 - sideFactor * CHAIN_SIDE_THRESHOLD_REDUCTION)
    : thresholdBase;

  return {
    speed: travelSpeed + impulseVelocity * impulseWeight + sideBonus,
    threshold,
  };
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
const DEFAULT_BALL_START_X_M = JB_GUTTER_WIDTH_M + JB_LANE_WIDTH_M / 2;
const LEFT_GUTTER_CENTER_M = JB_GUTTER_WIDTH_M / 2;
const RIGHT_GUTTER_CENTER_M = JB_GUTTER_WIDTH_M + JB_LANE_WIDTH_M + JB_GUTTER_WIDTH_M / 2;
const MAX_START_OFFSET_M = 0.4249;

export function Lane({ ballVisual, resetSignal, newGameSignal, active, onRoll }: LaneProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const throwingRef = useRef(false);
  const dockingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const activePointerRef = useRef<number | null>(null);
  const pointerModeRef = useRef<PointerMode>(null);
  const ballStartXRef = useRef(DEFAULT_BALL_START_X_M);
  const positionLockedRef = useRef(false);
  const [positionLocked, setPositionLockedState] = useState(false);
  const [startOffsetM, setStartOffsetM] = useState<number>(0);
  const [isThrowing, setIsThrowing] = useState(false);
  const precisionModeRef = useRef(false);
  const [precisionMode, setPrecisionModeState] = useState(false);
  const precisionCurveDegRef = useRef(0);
  const [precisionCurveDeg, setPrecisionCurveDegState] = useState(0);
  const pinBodiesRef = useRef<Map<number, PinBody>>(
    new Map(PIN_LAYOUT.map((pin) => [pin.id, createPinBody(pin)])),
  );
  const pinNodesRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const setPositionLocked = useCallback((locked: boolean) => {
    positionLockedRef.current = locked;
    setPositionLockedState(locked);
    activePointerRef.current = null;
    pointerModeRef.current = null;
    pointsRef.current = [];
  }, []);

  const setPrecisionMode = useCallback((on: boolean) => {
    precisionModeRef.current = on;
    setPrecisionModeState(on);
  }, []);

  const setPrecisionCurveDeg = useCallback((deg: number) => {
    precisionCurveDegRef.current = deg;
    setPrecisionCurveDegState(deg);
  }, []);

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

  const setBallPosition = useCallback((
    xM: number,
    yM: number,
    rotateDeg: number,
    curveNorm = 0,
    onOil = true,
  ) => {
    const el = ballRef.current;
    if (!el) return;
    const screenY = worldYToPct(yM);
    el.style.left = `${worldXToPct(xM, yM)}%`;
    el.style.top = `${screenY}%`;
    el.style.width = `${ballVisualWidthPct(yM)}%`;
    el.style.zIndex = String(501 + Math.round(screenY * 10));

    const visualRollDeg = rotateDeg * 0.16;
    const phaseRad = visualRollDeg * Math.PI / 180;
    const curveStrength = clamp(Math.abs(curveNorm) / MAX_CURVE_NORM, 0, 1);

    if (curveStrength < 0.04) {
      const highlightY = 28 + Math.sin(phaseRad) * 12;
      const forwardRollDeg = visualRollDeg * 0.18;
      el.style.background = `radial-gradient(circle at 32% ${highlightY}%, ${ballVisual.bodyGradient[0]}, ${ballVisual.bodyGradient[1]})`;
      el.style.transform = `translate(-50%, -50%) rotate(${forwardRollDeg}deg)`;
      return;
    }

    const curveDirection = Math.sign(curveNorm) || 1;
    const surfaceFactor = onOil ? 0.58 : 1;
    const sideSpinDeg = visualRollDeg * (0.55 + curveStrength * 0.75) * surfaceFactor * curveDirection;
    const axisTiltDeg = curveDirection * (8 + curveStrength * 14) * surfaceFactor;
    const highlightX = 32 + Math.sin(phaseRad * curveDirection) * 10 * curveStrength * surfaceFactor;
    const highlightY = 28 + Math.cos(phaseRad) * 7 * curveStrength;
    el.style.background = `radial-gradient(circle at ${highlightX}% ${highlightY}%, ${ballVisual.bodyGradient[0]}, ${ballVisual.bodyGradient[1]})`;
    el.style.transform = `translate(-50%, -50%) rotate(${sideSpinDeg + axisTiltDeg}deg)`;
  }, [ballVisual.bodyGradient]);

  const setStartPositionFromScreenX = useCallback((screenXPct: number) => {
    const offsetM = clamp(
      screenXToWorldX(screenXPct, 0) - DEFAULT_BALL_START_X_M,
      -MAX_START_OFFSET_M,
      MAX_START_OFFSET_M,
    );
    const startXM = DEFAULT_BALL_START_X_M + offsetM;
    ballStartXRef.current = startXM;
    setStartOffsetM(offsetM);
    setBallPosition(startXM, 0, 0);
  }, [setBallPosition]);

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
      setBallPosition(ballStartXRef.current, 0, 0);
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
  }, [setBallPosition]);

  useEffect(() => {
    resetPins();
    throwingRef.current = false;
    setIsThrowing(false);
    activePointerRef.current = null;
    pointerModeRef.current = null;
    pointsRef.current = [];
    dockBall();
  }, [resetSignal, resetPins, dockBall]);

  useEffect(() => {
    if (!active) return;
    clearFallenPins();
    dockBall();
  }, [active, clearFallenPins, dockBall]);

  useEffect(() => {
    ballStartXRef.current = DEFAULT_BALL_START_X_M;
    setStartOffsetM(0);
    setPositionLocked(false);
    setBallPosition(DEFAULT_BALL_START_X_M, 0, 0);
  }, [newGameSignal, setPositionLocked, setBallPosition]);

  const runThrow = useCallback((launch: {
    speedMps: number;
    launchAngleRad: number;
    curveNorm: number;
    startXM: number;
  }) => {
    throwingRef.current = true;
    setIsThrowing(true);

    let bxM = launch.startXM;
    let byM = 0;
    let bvxMps = launch.speedMps * Math.sin(launch.launchAngleRad);
    let bvyMps = launch.speedMps * Math.cos(launch.launchAngleRad);
    let rotate = 0;
    let gutterSide: GutterSide = null;
    let ballDone = false;
    let finished = false;

    const { axisRotationRad, curveSign } = computeAxisRotation(launch.launchAngleRad, launch.curveNorm);
    const axisTiltRad = SPIN_AXIS_TILT_DEG * Math.PI / 180;
    const spinMagnitudeRadS = spinMagnitudeRadSAtSpeed(launch.speedMps);
    const horizontalSpinRadS = spinMagnitudeRadS * Math.cos(axisTiltRad);
    let omegaXRadS = -horizontalSpinRadS * Math.cos(axisRotationRad);
    let omegaYRadS = -curveSign * horizontalSpinRadS * Math.sin(axisRotationRad);
    let omegaZRadS = spinMagnitudeRadS * Math.sin(axisTiltRad);
    let phiRad = Math.atan(omegaYRadS / omegaXRadS);

    const maxLateralSpeedMps = Math.max(1.2, launch.speedMps * 0.55);
    const capLateralSpeed = (vx: number, vy: number): [number, number] => {
      if (Math.abs(vx) <= maxLateralSpeedMps) return [vx, vy];
      if (process.env.NODE_ENV !== "production") {
        console.debug(
          `[wanko-bowling] capLateralSpeed fired: vx=${vx.toFixed(2)} > max=${maxLateralSpeedMps.toFixed(2)} (speed=${launch.speedMps.toFixed(2)}m/s, curveNorm=${launch.curveNorm.toFixed(2)})`,
        );
      }
      const speed = Math.hypot(vx, vy);
      const cappedVx = Math.sign(vx) * maxLateralSpeedMps;
      const remaining = Math.max(0, speed * speed - cappedVx * cappedVx);
      const cappedVy = Math.sign(vy || 1) * Math.sqrt(remaining);
      return [cappedVx, cappedVy];
    };

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

    const markKnocked = (
      id: number,
      body: PinBody,
      vx: number,
      vy: number,
      hitFromX: number,
      normalX = 0,
    ) => {
      if (!body.standing) return;
      knockedThisThrow.add(id);
      body.standing = false;
      body.moving = true;
      body.visible = true;
      body.vxMps = vx;
      body.vyMps = vy;

      const speed = Math.hypot(vx, vy);
      const offset = clamp((body.xM - hitFromX) / Math.max(0.001, PIN_COLLISION_RADIUS_M), -1, 1);
      const fallbackDirection = Math.sign(vx) || 1;
      const spinDirection = Math.sign(offset) || Math.sign(normalX) || fallbackDirection;
      const angularMagnitude = 190
        + Math.min(330, speed * 52)
        + Math.abs(offset) * 220
        + Math.abs(normalX) * 90;
      body.angularVel = spinDirection * angularMagnitude + (Math.random() - 0.5) * 100;
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
        setIsThrowing(false);
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
          const mu = laneFrictionMuAt(byM);
          const slipX = bvxMps - BALL_SPIN_RADIUS_M * omegaYRadS;
          const slipY = bvyMps + BALL_SPIN_RADIUS_M * omegaXRadS;
          const slipSpeed = Math.hypot(slipX, slipY);
          let dvx = 0;
          let dvy = 0;
          if (slipSpeed > SLIP_EPSILON_MPS) {
            dvx = -mu * GRAVITY_MPS2 * (slipX / slipSpeed);
            dvy = -mu * GRAVITY_MPS2 * (slipY / slipSpeed);
          }

          const cosPhi = Math.cos(phiRad);
          const sinPhi = Math.sin(phiRad);
          const omegaXPrime = omegaXRadS * cosPhi + omegaYRadS * sinPhi;
          const omegaYPrime = -omegaXRadS * sinPhi + omegaYRadS * cosPhi;

          const termA =
            (GAME_BALL_MASS_KG * BALL_SPIN_RADIUS_M * (dvy * cosPhi + dvx * sinPhi)
              + (BALL_INERTIA_Y_KGM2 - BALL_INERTIA_Z_KGM2) * omegaYPrime * omegaZRadS)
            / BALL_INERTIA_X_KGM2;
          const termB =
            (GAME_BALL_MASS_KG * BALL_SPIN_RADIUS_M * (-dvy * sinPhi - dvx * cosPhi)
              + (BALL_INERTIA_Z_KGM2 - BALL_INERTIA_X_KGM2) * omegaXPrime * omegaZRadS)
            / BALL_INERTIA_Y_KGM2;

          const domegaXdt = termA * cosPhi - termB * sinPhi;
          const domegaYdt = termA * sinPhi + termB * cosPhi;
          const domegaZdt =
            ((BALL_INERTIA_X_KGM2 - BALL_INERTIA_Y_KGM2) / BALL_INERTIA_Z_KGM2)
            * omegaXPrime * omegaYPrime;
          const omegaHorizSq = omegaXRadS * omegaXRadS + omegaYRadS * omegaYRadS;
          const dphiDt = omegaHorizSq > 0
            ? (domegaYdt * omegaXRadS - domegaXdt * omegaYRadS) / omegaHorizSq
            : 0;

          bvxMps += dvx * dt;
          bvyMps += dvy * dt;
          omegaXRadS += domegaXdt * dt;
          omegaYRadS += domegaYdt * dt;
          omegaZRadS += domegaZdt * dt;
          phiRad += dphiDt * dt;

          [bvxMps, bvyMps] = capLateralSpeed(bvxMps, bvyMps);
        } else {
          const gutterDecay = Math.exp(-GUTTER_BALL_DRAG_PER_SEC * dt);
          const lateralDecay = Math.exp(-9 * dt);
          bvxMps *= lateralDecay;
          bvyMps *= gutterDecay;
        }

        bxM += bvxMps * dt;
        byM += bvyMps * dt;

        const laneLeftM = JB_GUTTER_WIDTH_M;
        const laneRightM = JB_GUTTER_WIDTH_M + JB_LANE_WIDTH_M;

        if (gutterSide === null) {
          if (bxM <= laneLeftM) gutterSide = "left";
          else if (bxM >= laneRightM) gutterSide = "right";
        }

        if (gutterSide !== null) {
          const targetX = gutterSide === "left" ? LEFT_GUTTER_CENTER_M : RIGHT_GUTTER_CENTER_M;
          bxM += (targetX - bxM) * Math.min(1, dt * 7.5);

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
              if (process.env.NODE_ENV !== "production") {
                console.debug(
                  "[wanko-bowling] ball-pin collision",
                  {
                    t: (now - startTime).toFixed(0) + "ms",
                    pinId: pin.id,
                    ballPhysicsXY: [bxM.toFixed(4), byM.toFixed(4)],
                    ballScreenXY: [worldXToPct(bxM, byM).toFixed(2), worldYToPct(byM).toFixed(2)],
                    pinPhysicsXY: [body.xM.toFixed(4), body.yM.toFixed(4)],
                    pinScreenXY: [worldXToPct(body.xM, body.yM).toFixed(2), worldYToPct(body.yM).toFixed(2)],
                    distanceM: closest.distance.toFixed(4),
                    collisionRadiusM: PIN_COLLISION_RADIUS_M.toFixed(4),
                  },
                );
              }
              const [nextVx, nextVy] = capLateralSpeed(collision.avx, collision.avy);
              bvxMps = nextVx;
              bvyMps = nextVy;

              const knock = effectiveKnockSpeed(collision.bvx, collision.bvy, collision, false);
              if (knock.speed >= knock.threshold) {
                markKnocked(
                  pin.id,
                  body,
                  collision.bvx,
                  collision.bvy,
                  closest.x,
                  collision.normalX,
                );
              }
            }
          }
        }

        if (byM >= BALL_EXIT_DISTANCE_M) ballDone = true;
        setBallPosition(bxM, byM, rotate, launch.curveNorm, onOil);
      }

      const ids = [...pinBodiesRef.current.keys()];
      for (let i = 0; i < ids.length; i += 1) {
        const idA = ids[i]!;
        const bodyA = pinBodiesRef.current.get(idA)!;
        if (!bodyA.visible) continue;

        for (let j = i + 1; j < ids.length; j += 1) {
          const idB = ids[j]!;
          const bodyB = pinBodiesRef.current.get(idB)!;
          if (!bodyB.visible || (!bodyA.moving && !bodyB.moving)) continue;

          const dx = bodyB.xM - bodyA.xM;
          const dy = bodyB.yM - bodyA.yM;
          const pairDistance = Math.hypot(dx, dy);
          if (pairDistance > pinPairCollisionRadius(bodyA, bodyB)) continue;

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
            const knockA = effectiveKnockSpeed(collision.avx, collision.avy, collision, true);
            if (knockA.speed >= knockA.threshold) {
              markKnocked(idA, bodyA, collision.avx, collision.avy, bodyB.xM, -collision.normalX);
            } else {
              bodyA.vxMps = 0;
              bodyA.vyMps = 0;
            }
          }

          if (bWasStanding) {
            const knockB = effectiveKnockSpeed(collision.bvx, collision.bvy, collision, true);
            if (knockB.speed >= knockB.threshold) {
              markKnocked(idB, bodyB, collision.bvx, collision.bvy, bodyA.xM, collision.normalX);
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

    if (relY < 80 || relY > 99 || relX < NEAR_LANE_LEFT || relX > NEAR_LANE_RIGHT) return;

    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (!positionLockedRef.current) {
      pointerModeRef.current = "place";
      pointsRef.current = [];
      setStartPositionFromScreenX(relX);
      return;
    }

    const currentBallXPct = worldXToPct(ballStartXRef.current, 0);
    const ballHitRadiusXPct = ballVisualWidthPct(0) * 0.72;
    const ballHitRadiusYPct = 7.5;
    const touchedBall =
      Math.abs(relX - currentBallXPct) <= ballHitRadiusXPct
      && Math.abs(relY - DOCK_Y) <= ballHitRadiusYPct;

    if (!touchedBall) {
      activePointerRef.current = null;
      pointerModeRef.current = null;
      pointsRef.current = [];
      return;
    }

    pointerModeRef.current = "throw";
    pointsRef.current = [{ x: event.clientX, y: event.clientY, t: performance.now() }];
  }, [active, setStartPositionFromScreenX]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    if (pointerModeRef.current === "place") {
      if (positionLockedRef.current) return;
      const board = boardRef.current;
      if (!board) return;
      const rect = board.getBoundingClientRect();
      const relX = ((event.clientX - rect.left) / rect.width) * 100;
      setStartPositionFromScreenX(clamp(relX, NEAR_LANE_LEFT, NEAR_LANE_RIGHT));
      return;
    }

    if (pointerModeRef.current !== "throw") return;

    pointsRef.current.push({ x: event.clientX, y: event.clientY, t: performance.now() });
    if (pointsRef.current.length > MAX_SWIPE_SAMPLES) {
      pointsRef.current.splice(1, pointsRef.current.length - MAX_SWIPE_SAMPLES);
    }
  }, [setStartPositionFromScreenX]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    activePointerRef.current = null;

    const pointerMode = pointerModeRef.current;
    pointerModeRef.current = null;

    if (pointerMode === "place") {
      pointsRef.current = [];
      return;
    }
    if (pointerMode !== "throw") return;

    const points = pointsRef.current;
    pointsRef.current = [];
    if (!active || throwingRef.current || dockingRef.current || points.length < 2) return;

    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const startXM = ballStartXRef.current;
    const aim = computeAimFromPoints(points, rect, startXM, MIN_UPWARD_PCT);
    if (!aim) return;

    const swipeRate = estimateReleaseSwipeRate(points, rect.height);
    const rawSpeedNorm = clamp((swipeRate - 25) / 430, 0, 1);
    const speedNorm = Math.pow(rawSpeedNorm, 0.72);
    const speedKmh = GAME_MIN_BALL_SPEED_KMH
      + (GAME_MAX_BALL_SPEED_KMH - GAME_MIN_BALL_SPEED_KMH) * speedNorm;
    const speedMps = speedKmh / 3.6;

    const curveNorm = precisionModeRef.current
      ? axisRotationDegToCurveNorm(precisionCurveDegRef.current)
      : aim.curveNorm;

    runThrow({ speedMps, launchAngleRad: aim.launchAngleRad, curveNorm, startXM });
  }, [active, runThrow]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    activePointerRef.current = null;
    pointerModeRef.current = null;
    pointsRef.current = [];
  }, []);

  const handleConfirmPosition = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!active || throwingRef.current || dockingRef.current) return;
    setPositionLocked(true);
  }, [active, setPositionLocked]);

  const handleUnlockPosition = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!active || throwingRef.current || dockingRef.current) return;
    setPositionLocked(false);
    setBallPosition(ballStartXRef.current, 0, 0);
  }, [active, setBallPosition, setPositionLocked]);

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

      {active && !isThrowing && (
        <div className="pointer-events-none absolute" style={{ top: `${DOCK_Y}%`, left: 0, right: 0 }} aria-hidden="true">
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${worldXToPct(DEFAULT_BALL_START_X_M + startOffsetM, 0)}%`,
              width: positionLocked ? "10px" : "8px",
              height: positionLocked ? "10px" : "8px",
              background: "#ffd76a",
              boxShadow: "0 0 6px 1px rgba(255,215,106,0.7)",
            }}
          />
        </div>
      )}

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

      {active && !isThrowing ? (
        <div
          data-bowling-position-controls="true"
          className="absolute bottom-2 left-2 z-[1200] flex items-center gap-1.5 rounded-full bg-[#2f2119]/78 p-1 shadow-lg backdrop-blur-sm"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            onPointerUp={handleConfirmPosition}
            aria-pressed={positionLocked}
            className={`min-w-[52px] rounded-full px-3 py-2 text-[11px] font-black transition ${
              positionLocked
                ? "bg-[#e8e0d2] text-[#807363]"
                : "bg-[#6f9b58] text-white shadow-sm"
            }`}
          >
            ✓ OK
          </button>
          <button
            type="button"
            onPointerUp={handleUnlockPosition}
            aria-pressed={!positionLocked}
            className={`h-8 w-8 rounded-full text-[16px] font-black leading-none transition ${
              positionLocked
                ? "bg-[#f4eadc] text-[#5b4637] shadow-sm"
                : "bg-white/15 text-white/45"
            }`}
          >
            ×
          </button>
        </div>
      ) : null}

      {active && !isThrowing ? (
        <div
          className="absolute bottom-3 right-2 z-[1200] flex items-center gap-1.5 rounded-full bg-[#2f2119]/78 p-1 pr-2.5 shadow-lg backdrop-blur-sm"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            onPointerUp={() => setPrecisionMode(!precisionMode)}
            aria-pressed={precisionMode}
            className={`min-w-[52px] rounded-full px-3 py-2 text-[11px] font-black transition ${
              precisionMode
                ? "bg-[#6f9b58] text-white shadow-sm"
                : "bg-white/15 text-white/70"
            }`}
          >
            精密
          </button>
          {precisionMode ? (
            <div className="flex items-center gap-1.5 pl-0.5">
              <input
                type="range"
                min={0}
                max={MAX_AXIS_ROTATION_DEG}
                step={1}
                value={precisionCurveDeg}
                onChange={(event) => setPrecisionCurveDeg(Number(event.target.value))}
                className="h-1.5 w-[92px] accent-[#e8c25a]"
              />
              <span className="min-w-[32px] text-right text-[11px] font-black tabular-nums text-white/90">
                {precisionCurveDeg}°
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
