"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { PIN_LAYOUT, Pins } from "./pins";
import type { BowlingBallVisual } from "@/lib/games/wanko-bowling-balls";

const DOCK_Y = 88;
const PIN_ZONE_Y = 34;
const DECK_EXIT_Y = 6;
const LANE_LEFT = 16;
const LANE_RIGHT = 84;
const MIN_UPWARD_PX = 26;

// ---------------------------------------------------------------
// 物理定数（実測値ベース）
// ---------------------------------------------------------------
/** 8ポンドのボウリングボール（1ポンド=0.45359237kg）。 */
const BALL_MASS_KG = 8 * 0.45359237;
/** ボウリングピン1本の重さ。 */
const PIN_MASS_KG = 1.5;
/** ボール対ピンの反発係数（1=完全弾性、0=完全非弾性）。木・合成樹脂の実感に寄せた値。 */
const BALL_PIN_RESTITUTION = 0.55;
/** ピン同士がぶつかったときの反発係数。ボールよりロスが大きい。 */
const PIN_PIN_RESTITUTION = 0.42;
/** 衝突とみなす距離（レーン幅に対する%。px換算はスワイプ時のレーン実寸を使う）。 */
const COLLIDE_RADIUS_PCT = 6.4;
/**
 * 20km/h ≈ 5.56m/s を基準速度とする。ピンデッキの奥行き（手前ピン〜最後列）を
 * 現実のボウリングにおよそ合わせて1m ≈ レーン高さの30%とみなし、
 * スワイプの強さで変わるボール速度を [%/秒] に変換する基準値として使う。
 */
const PCT_PER_METER = 30;
const BASE_BALL_SPEED_PCT = (20 / 3.6) * PCT_PER_METER; // ≈166.7 %/秒 = 20km/h相当
/** ピンデッキに入ったら一度だけ速度を落とす（当たり判定の解像度確保＋スロー演出）。 */
const DECK_SPEED_SCALE = 0.5;
/** カーブ（スワイプの弧）による横方向の加速度。 */
const CURVE_ACCEL_PCT_PER_SEC2 = 260;
/** 転がる/滑るときの減速の速さ（指数減衰の係数）。 */
const FRICTION_PER_SEC = 3.4;
/** これより遅くなったら「止まった」とみなす（%/秒）。 */
const SETTLE_SPEED_PCT = 9;
/** 万一物理演算が収束しない場合の打ち切り時間。 */
const MAX_THROW_MS = 3200;

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

type PinBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  /** まだ一度も当たっていない（このゲーム内でまだ立っている）。 */
  standing: boolean;
  /** 現在も速度を持って動いている最中か。 */
  moving: boolean;
};

function createPinBody(pin: { x: number; y: number }): PinBody {
  return { x: pin.x, y: pin.y, vx: 0, vy: 0, angle: 0, angularVel: 0, standing: true, moving: false };
}

/**
 * 2物体の弾性/非弾性衝突（運動量保存則）。位置・速度は%空間で受け取るが、
 * レーンは正方形でない（幅と高さでスケールが違う）ため、衝突の法線方向や
 * 撃力の計算だけは実際の見た目のpx空間に変換してから行い、結果を%/秒へ戻す。
 */
function resolvePairCollision(
  ax: number, ay: number, avx: number, avy: number, massA: number,
  bx: number, by: number, bvx: number, bvy: number, massB: number,
  restitution: number,
  scaleX: number, scaleY: number,
): { avx: number; avy: number; bvx: number; bvy: number } | null {
  const dxPx = (bx - ax) * scaleX;
  const dyPx = (by - ay) * scaleY;
  const dist = Math.hypot(dxPx, dyPx);
  if (dist < 0.0001) return null;
  const nx = dxPx / dist;
  const ny = dyPx / dist;

  const avxPx = avx * scaleX, avyPx = avy * scaleY;
  const bvxPx = bvx * scaleX, bvyPx = bvy * scaleY;
  const relVx = avxPx - bvxPx;
  const relVy = avyPx - bvyPx;
  const velAlongNormal = relVx * nx + relVy * ny;
  if (velAlongNormal <= 0) return null; // すでに離れていく向きなら衝突なし

  const invA = 1 / massA;
  const invB = 1 / massB;
  const j = ((1 + restitution) * velAlongNormal) / (invA + invB);

  return {
    avx: (avxPx - j * nx * invA) / scaleX,
    avy: (avyPx - j * ny * invA) / scaleY,
    bvx: (bvxPx + j * nx * invB) / scaleX,
    bvy: (bvyPx + j * ny * invB) / scaleY,
  };
}

export function Lane({ ballVisual, resetSignal, active, onRoll }: LaneProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const throwingRef = useRef(false);
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
    el.style.transform = `translate(-50%, -50%) rotate(${body.angle}deg)`;
  }, []);

  const resetPins = useCallback(() => {
    PIN_LAYOUT.forEach((pin) => {
      const body = createPinBody(pin);
      pinBodiesRef.current.set(pin.id, body);
      writePinNode(pin.id, body);
    });
  }, [writePinNode]);

  // ボールをドック（下の待機位置）へ戻す。ピンをなぎ倒した位置からいきなり
  // 消えて瞬間移動すると不自然なので、一瞬だけふわっとフェードしてから
  // 定位置へ置き直す（ヒットした瞬間に消えるわけではない）。
  const dockBall = useCallback(() => {
    const el = ballRef.current;
    if (!el) return;
    el.style.transition = "opacity 180ms ease";
    el.style.opacity = "0";
    window.setTimeout(() => {
      const current = ballRef.current;
      if (!current) return;
      current.style.left = "50%";
      current.style.top = `${DOCK_Y}%`;
      current.style.transform = "translate(-50%, -50%) rotate(0deg)";
      requestAnimationFrame(() => {
        if (!ballRef.current) return;
        ballRef.current.style.opacity = "1";
        window.setTimeout(() => {
          if (ballRef.current) ballRef.current.style.transition = "";
        }, 200);
      });
    }, 180);
  }, []);

  useEffect(() => {
    resetPins();
    throwingRef.current = false;
    dockBall();
  }, [resetSignal, resetPins, dockBall]);

  // 同じフレーム内の2投目（resetSignal は変わらず、ピンだけ一部残っている状態）でも、
  // 次の投球が可能になった瞬間（active が false→true）にボールを置き直す。
  useEffect(() => {
    if (!active) return;
    dockBall();
  }, [active, dockBall]);

  // left/top はレーン（親要素）に対する割合、transform の translate(-50%, -50%) は
  // ボール自身のサイズぶんを引いて中心合わせするためだけに使う。
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
    const collideRadiusPx = (COLLIDE_RADIUS_PCT / 100) * scaleX;

    const preThrowStandingIds = new Set(
      [...pinBodiesRef.current.entries()].filter(([, body]) => body.standing).map(([id]) => id),
    );

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
      for (const body of pinBodiesRef.current.values()) if (body.moving) return true;
      return false;
    };

    const finish = () => {
      // ガター（レーン脇に落ちて見えなくなる）のときだけここで隠す。
      // ピンに当たった場合は、ボールは止まった場所に見えたままにする
      // （ピンが倒れきるまで消えない。次の投球に備えるときだけ dockBall() が
      // ふわっとフェードして戻す）。
      if (ballGutter && ballRef.current) ballRef.current.style.opacity = "0";
      window.setTimeout(() => {
        throwingRef.current = false;
        const knockedIds = [...preThrowStandingIds].filter(
          (id) => !pinBodiesRef.current.get(id)?.standing,
        );
        onRoll({ knockedIds, isGutter: ballGutter, power });
      }, ballGutter ? 260 : 320);
    };

    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;

      // --- ボール ---
      if (!ballDone) {
        bvx += launch.curveNorm * CURVE_ACCEL_PCT_PER_SEC2 * dt;
        bx += bvx * dt;
        by += bvy * dt;
        rotate += Math.hypot(bvx, bvy) * dt * 2.4;

        const inDeck = by <= PIN_ZONE_Y;
        if (!inDeck) {
          if (bx < LANE_LEFT || bx > LANE_RIGHT) {
            ballGutter = true;
            ballDone = true;
            bx = Math.min(Math.max(bx, LANE_LEFT - 4), LANE_RIGHT + 4);
          }
        } else {
          if (!deckSlowdownApplied) {
            // ピンデッキに入った瞬間だけ速度を落とす：当たり判定のコマ落ち防止と、
            // 実際の質量比で弾き飛ぶ様子をきちんと見せるためのスロー演出を兼ねる。
            bvx *= DECK_SPEED_SCALE;
            bvy *= DECK_SPEED_SCALE;
            deckSlowdownApplied = true;
          }
          bx = Math.min(Math.max(bx, LANE_LEFT - 3), LANE_RIGHT + 3);

          for (const pin of PIN_LAYOUT) {
            const body = pinBodiesRef.current.get(pin.id);
            if (!body || !body.standing) continue;
            const dxPx = (body.x - bx) * scaleX;
            const dyPx = (body.y - by) * scaleY;
            if (Math.hypot(dxPx, dyPx) > collideRadiusPx) continue;

            const result = resolvePairCollision(
              bx, by, bvx, bvy, BALL_MASS_KG,
              body.x, body.y, body.vx, body.vy, PIN_MASS_KG,
              BALL_PIN_RESTITUTION, scaleX, scaleY,
            );
            if (!result) continue;
            bvx = result.avx;
            bvy = result.avy;
            body.vx = result.bvx;
            body.vy = result.bvy;
            body.standing = false;
            body.moving = true;
            body.angularVel = (Math.random() - 0.5) * 560 + (dxPx >= 0 ? 1 : -1) * 120;
          }

          if (by <= DECK_EXIT_Y || Math.hypot(bvx, bvy) < 10) ballDone = true;
        }

        setBallPosition(bx, by, rotate);
      }

      // --- ピン同士の衝突（動いているピンが立っている/動いている他のピンにぶつかる） ---
      const ids = [...pinBodiesRef.current.keys()];
      for (let i = 0; i < ids.length; i += 1) {
        const bodyA = pinBodiesRef.current.get(ids[i]!)!;
        if (bodyA.standing && !bodyA.moving) continue;
        for (let j = i + 1; j < ids.length; j += 1) {
          const bodyB = pinBodiesRef.current.get(ids[j]!)!;
          if (!bodyA.moving && !bodyB.moving) continue;
          const dxPx = (bodyB.x - bodyA.x) * scaleX;
          const dyPx = (bodyB.y - bodyA.y) * scaleY;
          if (Math.hypot(dxPx, dyPx) > collideRadiusPx) continue;

          const result = resolvePairCollision(
            bodyA.x, bodyA.y, bodyA.vx, bodyA.vy, PIN_MASS_KG,
            bodyB.x, bodyB.y, bodyB.vx, bodyB.vy, PIN_MASS_KG,
            PIN_PIN_RESTITUTION, scaleX, scaleY,
          );
          if (!result) continue;
          bodyA.vx = result.avx;
          bodyA.vy = result.avy;
          bodyB.vx = result.bvx;
          bodyB.vy = result.bvy;
          bodyA.standing = false;
          bodyA.moving = true;
          bodyB.standing = false;
          bodyB.moving = true;
        }
      }

      // --- 動いているピンの位置更新（摩擦で減速し、やがて止まる） ---
      for (const [id, body] of pinBodiesRef.current) {
        if (!body.moving) continue;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.angle += body.angularVel * dt;

        const decay = Math.exp(-FRICTION_PER_SEC * dt);
        body.vx *= decay;
        body.vy *= decay;
        body.angularVel *= decay;

        // 画面外へ飛んでいかないようレーン内側にとどめる
        body.x = Math.min(Math.max(body.x, 2), 98);
        body.y = Math.min(Math.max(body.y, 2), 60);

        if (Math.hypot(body.vx, body.vy) < SETTLE_SPEED_PCT) {
          body.moving = false;
          body.vx = 0;
          body.vy = 0;
          body.angularVel = 0;
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

    // 基準は20km/h（BASE_BALL_SPEED_PCT）。スワイプが速いほど基準より速く、
    // 遅いほど基準より遅く投げられる（だいたい12〜31km/h相当の範囲）。
    const speedPxPerMs = Math.hypot(dxPx, dyPx) / durationMs;
    const rawSpeedPctPerSec = speedPxPerMs * 1000 * (100 / rect.height) * 0.62;
    const speedPctPerSec = Math.min(260, Math.max(100, rawSpeedPctPerSec));
    const lateralPctPerSec = Math.max(-70, Math.min(70, (dxPx / durationMs) * 1000 * (100 / rect.width) * 0.4));

    // カーブは「スワイプの前半」と「後半」で横方向の勢いがどれだけ変化したかで検出する。
    // 一直線のスワイプなら前半・後半の傾きはほぼ同じ（＝カーブなし、狙いの左右だけ反映）。
    // 弧を描くように（例：まっすぐ→最後だけ左に流す）スワイプすると傾きの差が出て、
    // その差の向き・大きさがそのままボールのカーブになる。
    const avgSlope = (segment: Point[]) => {
      if (segment.length < 2) return 0;
      const a = segment[0]!;
      const b = segment[segment.length - 1]!;
      const segDuration = b.t - a.t;
      return segDuration > 0 ? (b.x - a.x) / segDuration : 0;
    };
    const midIndex = Math.max(1, Math.floor(points.length / 2));
    const firstHalfSlope = avgSlope(points.slice(0, midIndex + 1));
    const secondHalfSlope = avgSlope(points.slice(midIndex));
    const curveNorm = Math.max(-1, Math.min(1, (secondHalfSlope - firstHalfSlope) / 0.75));

    runThrow({ speedPctPerSec, lateralPctPerSec, curveNorm });
  }, [active, runThrow]);

  return (
    <div
      ref={boardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative aspect-[3/4.4] w-full touch-none select-none overflow-hidden"
      style={{
        borderRadius: "26px 22px 28px 20px",
        background: "linear-gradient(180deg, #e3c08c 0%, #d3a568 40%, #c08d54 74%, #a97748 100%)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -14px 26px -18px rgba(76,48,24,0.55)",
      }}
    >
      {/* レーンの奥行き板目 */}
      <div
        className="absolute inset-x-[11%] top-[6%] bottom-[18%] rounded-[16px]"
        style={{
          background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 20px)",
          maskImage: "linear-gradient(180deg, black 68%, transparent 100%)",
        }}
        aria-hidden="true"
      />
      {/* ガター */}
      <div
        className="absolute inset-y-[6%] left-0 w-[13%] rounded-l-[24px]"
        style={{ background: "linear-gradient(90deg, #6b4428, #7a5330)", boxShadow: "inset -3px 0 6px rgba(0,0,0,0.25)" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-[6%] right-0 w-[13%] rounded-r-[24px]"
        style={{ background: "linear-gradient(270deg, #6b4428, #7a5330)", boxShadow: "inset 3px 0 6px rgba(0,0,0,0.25)" }}
        aria-hidden="true"
      />
      {/* ファウルライン */}
      <div className="absolute inset-x-[13%] top-[59%] h-[3px] rounded-full bg-[#a8442f]" aria-hidden="true" />
      <div className="absolute inset-x-[13%] top-[calc(59%+3px)] h-[1px] bg-[#a8442f]/35" aria-hidden="true" />

      <Pins registerNode={registerPinNode} />

      {/* ボール */}
      <div
        ref={ballRef}
        className="pointer-events-none absolute aspect-square w-[9%] rounded-full shadow-[0_3px_6px_rgba(0,0,0,0.35)]"
        style={{
          left: "50%",
          top: `${DOCK_Y}%`,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle at 32% 28%, ${ballVisual.bodyGradient[0]}, ${ballVisual.bodyGradient[1]})`,
          boxShadow: ballVisual.premiumEffect ? `0 0 12px 3px ${ballVisual.hitColor}` : undefined,
        }}
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute bottom-[3%] left-1/2 -translate-x-1/2 text-center">
        <p className="rounded-full bg-[#4a301e]/55 px-3 py-1 text-[10.5px] font-black tracking-[0.1em] text-[#fff6e6]">
          {active ? "↑ 上へスワイプして投げよう" : ""}
        </p>
      </div>
    </div>
  );
}
