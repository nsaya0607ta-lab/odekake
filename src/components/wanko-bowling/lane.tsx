"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PIN_ADJACENCY, PIN_LAYOUT, Pins } from "./pins";
import type { BowlingBallVisual } from "@/lib/games/wanko-bowling-balls";

const DOCK_Y = 88;
const PIN_ZONE_Y = 34;
/** ピンの一番奥（10番/7番）より少し先。ここまで抜けたらボールがピン列を通過し終えたとみなす。 */
const DECK_EXIT_Y = 6;
const LANE_LEFT = 16;
const LANE_RIGHT = 84;
const PIN_HIT_RADIUS = 6.2;
/** ピンと同じ列とみなすyの許容幅。ピン列は約6%間隔なので、その半分強に設定。 */
const PIN_ROW_BAND = 3.6;
/** ピン列に入ってからは弾みで少し減速させ、当たり判定のコマ落ちも防ぐ。 */
const DECK_SPEED_SCALE = 0.45;
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
    setStandingIds(allPinIds());
    setFallingIds(new Set());
    throwingRef.current = false;
    dockBall();
    if (trailRef.current) trailRef.current.style.opacity = "0";
  }, [resetSignal, dockBall]);

  // 同じフレーム内の2投目（resetSignal は変わらず、ピンだけ一部残っている状態）でも、
  // 次の投球が可能になった瞬間（active が false→true）にボールを置き直す。
  useEffect(() => {
    if (!active) return;
    dockBall();
  }, [active, dockBall]);

  // left/top はレーン（親要素）に対する割合、transform の translate(-50%, -50%) は
  // ボール自身のサイズぶんを引いて中心合わせするためだけに使う。
  // ここに translate(x%, y%) を混ぜると「要素自身のサイズ」基準になってしまい、
  // レーン上の狙った座標からズレる（実際に起きていた不具合）。
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

    let x = 50;
    let y = DOCK_Y;
    let rotate = 0;
    let speedY = launch.speedPctPerSec;
    let last = performance.now();
    let gutter = false;
    const power = Math.min(1, Math.max(0.35, launch.speedPctPerSec / 220));
    const knockedThisThrow = new Set<number>();

    // ぶつかったピンから隣接ピンへ、実際にぶつかった位置・勢いに応じて連鎖的に倒す。
    // ボール自身は止まらず先へ進み続けるので、複数列にまたがって倒れうる。
    const chainFrom = (hitPin: (typeof PIN_LAYOUT)[number], offsetRatio: number, impactPower: number) => {
      const standingNow = standingIdsRef.current;
      const visited = new Set<number>([hitPin.id, ...knockedThisThrow]);
      let frontier = [hitPin.id];
      let hop = 0;
      while (frontier.length > 0 && hop < 3) {
        const next: number[] = [];
        const baseProb = (0.55 - hop * 0.15 + (1 - offsetRatio) * 0.15) * (0.55 + impactPower * 0.5);
        for (const pinId of frontier) {
          const neighbors = PIN_ADJACENCY[pinId] ?? [];
          for (const neighborId of neighbors) {
            if (visited.has(neighborId) || !standingNow.has(neighborId)) continue;
            visited.add(neighborId);
            if (Math.random() < baseProb) {
              knockedThisThrow.add(neighborId);
              next.push(neighborId);
            }
          }
        }
        frontier = next;
        hop += 1;
      }
    };

    const finish = (isGutter: boolean) => {
      // ガター（レーン脇に落ちて見えなくなる）のときだけここで隠す。
      // ピンに当たった場合は、ボールは止まった場所に見えたままにする
      // （ピンが倒れきるまで消えない。次の投球に備えるときだけ dockBall() が
      // ふわっとフェードして戻す）。
      if (isGutter && ballRef.current) ballRef.current.style.opacity = "0";
      // ピンが倒れきる（wanko-bowl-pin-fall: 620ms）のを見せてから次へ進む
      window.setTimeout(() => {
        throwingRef.current = false;
        setFallingIds(new Set());
        onRoll({ knockedIds: [...knockedThisThrow], isGutter, power });
      }, isGutter ? 260 : 650);
    };

    const step = (now: number) => {
      const dt = Math.min(48, now - last) / 1000;
      last = now;

      const inDeck = y <= PIN_ZONE_Y;
      const speedScale = inDeck ? DECK_SPEED_SCALE : 1;
      const traveledRatio = Math.min(1, Math.max(0, (DOCK_Y - y) / (DOCK_Y - PIN_ZONE_Y)));

      y -= speedY * speedScale * dt;
      x += launch.lateralPctPerSec * speedScale * dt;
      x += launch.curveNorm * 70 * traveledRatio * speedScale * dt;
      rotate += 620 * dt * (speedY / 140);

      if (!inDeck) {
        if (x < LANE_LEFT || x > LANE_RIGHT) {
          gutter = true;
          x = Math.min(Math.max(x, LANE_LEFT - 4), LANE_RIGHT + 4);
        }
        setBallPosition(x, y, rotate);

        if (gutter) {
          finish(true);
          return;
        }
        requestAnimationFrame(step);
        return;
      }

      // ピン列の中：レーン外へは弾かず、狙った軌道のまま通り抜けさせる
      x = Math.min(Math.max(x, LANE_LEFT - 2), LANE_RIGHT + 2);
      setBallPosition(x, y, rotate);

      const standingNow = standingIdsRef.current;
      let hitSomethingThisFrame = false;
      for (const pin of PIN_LAYOUT) {
        if (knockedThisThrow.has(pin.id) || !standingNow.has(pin.id)) continue;
        if (Math.abs(pin.y - y) > PIN_ROW_BAND) continue;
        const dx = pin.x - x;
        if (Math.abs(dx) > PIN_HIT_RADIUS) continue;

        knockedThisThrow.add(pin.id);
        hitSomethingThisFrame = true;
        const offsetRatio = Math.min(1, Math.abs(dx) / PIN_HIT_RADIUS);
        chainFrom(pin, offsetRatio, power);
        // 当たった弾みで少しだけ逸れる・減速する
        x += (Math.random() - 0.5) * 3.2 * power;
        speedY *= 0.93;
      }

      if (hitSomethingThisFrame) {
        setFallingIds(new Set(knockedThisThrow));
        setStandingIds((prev) => {
          const nextSet = new Set(prev);
          knockedThisThrow.forEach((id) => nextSet.delete(id));
          return nextSet;
        });
      }

      if (y <= DECK_EXIT_Y || knockedThisThrow.size >= PIN_LAYOUT.length) {
        finish(false);
        return;
      }

      requestAnimationFrame(step);
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
