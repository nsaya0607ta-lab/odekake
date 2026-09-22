"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RARITY_STYLES } from "@/lib/gacha/config";
import { COLLECTION_ITEMS } from "@/lib/collection/items";

/**
 * わんこパチンコ（プロトタイプ）
 * =============================================================
 * 下のレバーで玉を発射 → 右レーンを昇って盤面に入り、くぎに当たりながら
 * 落ちて、下のポケット（アイテム図柄）のどれかに入る。DB連携・コイン付与は
 * まだ無く、見た目と物理演算だけのプロトタイプ。
 */

const BOARD_W = 340;
const BOARD_H = 600;
const WALL = 10; // 左右の壁の太さ
const LANE_W = 34; // 右レーン(発射通路)の幅
const FIELD_LEFT = WALL;
const FIELD_RIGHT = BOARD_W - WALL - LANE_W;
const TOP_RAIL_Y = 54; // このYより上でレーンから盤面へ流れ込む
const POCKET_TOP = BOARD_H - 96; // ポケット仕切りの上端
const POCKET_FLOOR = BOARD_H - 14; // 玉が静止する床

const BALL_R = 7;
const PEG_R = 4.5;
const GRAVITY = 0.34;
const DAMPING = 0.72; // 衝突時の減衰
const MAX_POWER = 16;
const MIN_POWER = 9;

type PocketDef = {
  itemId: string;
  name: string;
  image: string | null;
  rarity: keyof typeof RARITY_STYLES;
  weight: number; // 幅の比率(大きいほど入りやすい)
};

const POCKET_ITEM_IDS = [
  "toy_colorful_ball",
  "toy_carrot",
  "toy_treasure_puzzle",
  "interior_gold_ball",
  "toy_frenchie_plush",
  "toy_duck_plush",
  "toy_bone",
] as const;

const POCKET_WEIGHTS = [7, 6, 4, 2, 4, 6, 7];

function buildPockets(): PocketDef[] {
  return POCKET_ITEM_IDS.map((id, i) => {
    const item = COLLECTION_ITEMS.find((c) => c.id === id);
    return {
      itemId: id as string,
      name: item?.name ?? id,
      image: item?.image ?? null,
      rarity: (item?.rarity ?? "N") as keyof typeof RARITY_STYLES,
      weight: POCKET_WEIGHTS[i] ?? 1,
    };
  });
}

type Peg = { x: number; y: number };

function buildPegs(): Peg[] {
  const pegs: Peg[] = [];
  const rows = 11;
  const rowGap = (POCKET_TOP - TOP_RAIL_Y - 30) / rows;
  const colGap = 30;
  for (let row = 0; row < rows; row++) {
    const y = TOP_RAIL_Y + 40 + row * rowGap;
    const offset = row % 2 === 0 ? 0 : colGap / 2;
    for (let x = FIELD_LEFT + 18 + offset; x < FIELD_RIGHT - 10; x += colGap) {
      pegs.push({ x, y });
    }
  }
  return pegs;
}

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  inLane: boolean;
  settleFrames: number;
  flightFrames: number;
};

// くぎの間で跳ね続けて止まらない(ごく稀な)ケースの保険。この時間を超えたら強制的に着地させる。
const MAX_FLIGHT_FRAMES = 60 * 8;

type CaughtEntry = { itemId: string; name: string; image: string | null; rarity: keyof typeof RARITY_STYLES; count: number };

const TOTAL_SHOTS = 8;

export function PachinkoGame() {
  const pockets = useMemo(() => buildPockets(), []);
  const pegs = useMemo(() => buildPegs(), []);

  const pocketBounds = useMemo(() => {
    const fieldW = FIELD_RIGHT - FIELD_LEFT;
    const totalWeight = pockets.reduce((s, p) => s + p.weight, 0);
    let cursor = FIELD_LEFT;
    return pockets.map((p) => {
      const w = (p.weight / totalWeight) * fieldW;
      const bound = { start: cursor, end: cursor + w };
      cursor += w;
      return bound;
    });
  }, [pockets]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballRef = useRef<Ball>({ x: 0, y: 0, vx: 0, vy: 0, active: false, inLane: false, settleFrames: 0, flightFrames: 0 });
  const rafRef = useRef<number | null>(null);
  const chargingRef = useRef(false);
  const chargeStartRef = useRef(0);

  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [shotsLeft, setShotsLeft] = useState(TOTAL_SHOTS);
  const [caught, setCaught] = useState<CaughtEntry[]>([]);
  const [lastWin, setLastWin] = useState<CaughtEntry | null>(null);
  const [phase, setPhase] = useState<"ready" | "flying" | "result">("ready");
  const [finished, setFinished] = useState(false);

  const shotsLeftRef = useRef(TOTAL_SHOTS);

  const resetBallToLane = useCallback(() => {
    ballRef.current = {
      x: BOARD_W - WALL - LANE_W / 2,
      y: POCKET_FLOOR - BALL_R,
      vx: 0,
      vy: 0,
      active: false,
      inLane: true,
      settleFrames: 0,
      flightFrames: 0,
    };
  }, []);

  useEffect(() => {
    resetBallToLane();
  }, [resetBallToLane]);

  const registerCatch = useCallback((pocket: PocketDef) => {
    setCaught((prev) => {
      const existing = prev.find((c) => c.itemId === pocket.itemId);
      if (existing) {
        return prev.map((c) => (c.itemId === pocket.itemId ? { ...c, count: c.count + 1 } : c));
      }
      return [...prev, { itemId: pocket.itemId, name: pocket.name, image: pocket.image, rarity: pocket.rarity, count: 1 }];
    });
    setLastWin({ itemId: pocket.itemId, name: pocket.name, image: pocket.image, rarity: pocket.rarity, count: 1 });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, BOARD_W, BOARD_H);

    // 盤面背景
    const bg = ctx.createLinearGradient(0, 0, 0, BOARD_H);
    bg.addColorStop(0, "#173622");
    bg.addColorStop(1, "#0c2015");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    // レーン(発射通路)
    ctx.fillStyle = "#0a1a11";
    ctx.fillRect(BOARD_W - WALL - LANE_W, TOP_RAIL_Y, LANE_W, BOARD_H - TOP_RAIL_Y - WALL);
    ctx.strokeStyle = "#2f6b45";
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_W - WALL - LANE_W, TOP_RAIL_Y, LANE_W, BOARD_H - TOP_RAIL_Y - WALL);

    // 外壁
    ctx.strokeStyle = "#3f8a57";
    ctx.lineWidth = WALL;
    ctx.strokeRect(WALL / 2, WALL / 2, BOARD_W - WALL, BOARD_H - WALL);

    // くぎ
    ctx.fillStyle = "#ffe9b0";
    pegs.forEach((peg) => {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, PEG_R, 0, Math.PI * 2);
      ctx.fill();
    });

    // ポケット仕切り + 図柄
    pocketBounds.forEach((b, i) => {
      const pocket = pockets[i];
      if (!pocket) return;
      if (i > 0) {
        ctx.fillStyle = "#ffe9b0";
        ctx.fillRect(b.start - 2, POCKET_TOP, 4, POCKET_FLOOR - POCKET_TOP);
      }
      const isRare = pocket.rarity === "SSR" || pocket.rarity === "UR" || pocket.rarity === "LR";
      ctx.fillStyle = isRare ? "rgba(255,196,64,0.18)" : "rgba(255,255,255,0.06)";
      ctx.fillRect(b.start, POCKET_TOP, b.end - b.start, POCKET_FLOOR - POCKET_TOP);
    });
    ctx.fillStyle = "#ffe9b0";
    ctx.fillRect(FIELD_LEFT, POCKET_TOP, FIELD_RIGHT - FIELD_LEFT, 3);

    // 玉
    const ball = ballRef.current;
    const ballGrad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, BALL_R);
    ballGrad.addColorStop(0, "#ffffff");
    ballGrad.addColorStop(1, "#c7c7c7");
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }, [pegs, pocketBounds, pockets]);

  const finishShot = useCallback(
    (pocketIndex: number) => {
      const pocket = pockets[pocketIndex] ?? pockets[pockets.length - 1];
      if (!pocket) return;
      registerCatch(pocket);
      const nextShots = shotsLeftRef.current - 1;
      shotsLeftRef.current = nextShots;
      setShotsLeft(nextShots);
      resetBallToLane();
      draw();
      setPhase(nextShots <= 0 ? "result" : "ready");
      if (nextShots <= 0) setFinished(true);
    },
    [draw, pockets, registerCatch, resetBallToLane],
  );

  const step = useCallback(() => {
    const ball = ballRef.current;
    let settledPocketIndex: number | null = null;

    if (ball.active) {
      ball.flightFrames += 1;
      if (ball.flightFrames > MAX_FLIGHT_FRAMES) {
        ball.active = false;
        const idx = pocketBounds.findIndex((b) => ball.x >= b.start && ball.x <= b.end);
        settledPocketIndex = idx >= 0 ? idx : pocketBounds.length - 1;
      } else if (ball.inLane) {
        ball.y += ball.vy;
        if (ball.y <= TOP_RAIL_Y) {
          ball.inLane = false;
          ball.vx = -2.6 - Math.random() * 1.2;
          ball.vy = Math.min(ball.vy * 0.4, -1);
        }
      } else {
        ball.vy += GRAVITY;
        // くぎの真上でほぼ真下だけに弾み続けて止まらなくなるのを防ぐ、ごく小さな横ゆらぎ
        ball.vx += (Math.random() - 0.5) * 0.05;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // 左右壁
        if (ball.x - BALL_R < FIELD_LEFT) {
          ball.x = FIELD_LEFT + BALL_R;
          ball.vx = Math.abs(ball.vx) * DAMPING;
        }
        if (ball.x + BALL_R > FIELD_RIGHT) {
          ball.x = FIELD_RIGHT - BALL_R;
          ball.vx = -Math.abs(ball.vx) * DAMPING;
        }

        // くぎ衝突
        for (const peg of pegs) {
          const dx = ball.x - peg.x;
          const dy = ball.y - peg.y;
          const dist = Math.hypot(dx, dy);
          const minDist = BALL_R + PEG_R;
          if (dist < minDist && dist > 0.0001) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            ball.x += nx * overlap;
            ball.y += ny * overlap;
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * DAMPING;
            ball.vy = (ball.vy - 2 * dot * ny) * DAMPING;
            // 少しランダムに散らす(まっすぐ落ち続けるのを防ぐ)
            ball.vx += (Math.random() - 0.5) * 0.6;
          }
        }

        // ポケット仕切り(縦壁)との衝突
        if (ball.y + BALL_R > POCKET_TOP) {
          for (let i = 1; i < pocketBounds.length; i++) {
            const dividerX = pocketBounds[i]?.start;
            if (dividerX !== undefined && Math.abs(ball.x - dividerX) < BALL_R + 2 && ball.y + BALL_R > POCKET_TOP) {
              ball.x += ball.x < dividerX ? -(BALL_R + 2 - (dividerX - ball.x)) : BALL_R + 2 - (ball.x - dividerX);
              ball.vx *= -DAMPING;
            }
          }
        }

        // 床
        if (ball.y + BALL_R > POCKET_FLOOR) {
          ball.y = POCKET_FLOOR - BALL_R;
          ball.vy = -ball.vy * DAMPING;
        }

        // 静止判定
        if (ball.y > POCKET_TOP && Math.abs(ball.vx) < 0.5 && Math.abs(ball.vy) < 0.5) {
          ball.settleFrames += 1;
        } else {
          ball.settleFrames = 0;
        }

        if (ball.settleFrames > 18) {
          ball.active = false;
          const idx = pocketBounds.findIndex((b) => ball.x >= b.start && ball.x <= b.end);
          settledPocketIndex = idx >= 0 ? idx : pocketBounds.length - 1;
        }
      }
    }

    if (settledPocketIndex !== null) {
      finishShot(settledPocketIndex);
    }
    draw();
    rafRef.current = requestAnimationFrame(step);
  }, [draw, finishShot, pegs, pocketBounds]);

  useEffect(() => {
    draw();
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const launch = useCallback(
    (launchPower: number) => {
      if (ballRef.current.active || phase !== "ready") return;
      setLastWin(null);
      ballRef.current = {
        x: BOARD_W - WALL - LANE_W / 2,
        y: POCKET_FLOOR - BALL_R,
        vx: 0,
        vy: -launchPower,
        active: true,
        inLane: true,
        settleFrames: 0,
        flightFrames: 0,
      };
      setPhase("flying");
    },
    [phase],
  );

  const startCharge = useCallback(() => {
    if (ballRef.current.active || phase !== "ready") return;
    chargingRef.current = true;
    chargeStartRef.current = performance.now();
    setCharging(true);
    const tick = () => {
      if (!chargingRef.current) return;
      const elapsed = performance.now() - chargeStartRef.current;
      const ratio = Math.min(1, (elapsed % 1200) / 1200);
      const wave = ratio < 0.5 ? ratio * 2 : 2 - ratio * 2; // 0→1→0 往復
      setPower(wave);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [phase]);

  const releaseCharge = useCallback(() => {
    if (!chargingRef.current) return;
    chargingRef.current = false;
    setCharging(false);
    const launchPower = MIN_POWER + power * (MAX_POWER - MIN_POWER);
    launch(launchPower);
    setPower(0);
  }, [launch, power]);

  const restart = useCallback(() => {
    shotsLeftRef.current = TOTAL_SHOTS;
    setShotsLeft(TOTAL_SHOTS);
    setCaught([]);
    setLastWin(null);
    setFinished(false);
    setPhase("ready");
    resetBallToLane();
    draw();
  }, [draw, resetBallToLane]);

  return (
    <div className="flex flex-col items-center gap-3 px-3 pb-6 pt-3">
      <div className="flex w-full max-w-[340px] items-center justify-between px-1 text-[11px] font-black text-white/80">
        <span>のこり {shotsLeft} 発</span>
        <span>発射レバーを押しっぱなしでパワー調整</span>
      </div>

      <div
        className="relative overflow-hidden rounded-[22px] border border-white/10 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
        style={{ width: BOARD_W, height: BOARD_H, touchAction: "none" }}
      >
        <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H} className="block h-full w-full" />

        {lastWin && phase === "ready" && (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-white/30 bg-black/70 px-3 py-1.5 text-[11px] font-black text-white shadow-lg">
              <span>GET!</span>
              {lastWin.image && (
                <span className="relative h-5 w-5 overflow-hidden rounded-full bg-white/20">
                  <Image src={lastWin.image} alt="" fill sizes="20px" className="object-cover" />
                </span>
              )}
              <span className={RARITY_STYLES[lastWin.rarity].text.replace("text-", "text-white ")}>{lastWin.name}</span>
            </div>
          </div>
        )}

        {phase === "result" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 px-4 text-center">
            <p className="text-[10px] font-black tracking-[0.16em] text-white/70">RESULT</p>
            <p className="text-lg font-black text-white">ぜんぶ打ち終わったよ！</p>
            <div className="grid max-h-[280px] w-full grid-cols-3 gap-2 overflow-y-auto px-2">
              {caught.length === 0 && <p className="col-span-3 text-xs font-bold text-white/60">今回は何も入らなかった…</p>}
              {caught.map((c) => (
                <div key={c.itemId} className="flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-white/5 p-2">
                  {c.image && (
                    <span className="relative h-10 w-10 overflow-hidden rounded-full bg-white/10">
                      <Image src={c.image} alt="" fill sizes="40px" className="object-cover" />
                    </span>
                  )}
                  <span className="text-[9px] font-black leading-tight text-white">{c.name}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${RARITY_STYLES[c.rarity].badge}`}>
                    {c.rarity} ×{c.count}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={restart}
              className="pressable mt-1 rounded-full bg-[#ffcf4d] px-6 py-2.5 text-sm font-black text-[#5a3b06] shadow-[0_6px_16px_rgba(255,207,77,0.35)] active:scale-95"
            >
              もう一度あそぶ
            </button>
          </div>
        )}
      </div>

      <div className="flex w-full max-w-[340px] flex-col items-center gap-2">
        <div className="h-3 w-full max-w-[220px] overflow-hidden rounded-full border border-white/20 bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ffe27a] to-[#ff8a3d] transition-[width] duration-75"
            style={{ width: `${power * 100}%` }}
          />
        </div>
        <button
          type="button"
          disabled={phase !== "ready" || finished}
          onPointerDown={startCharge}
          onPointerUp={releaseCharge}
          onPointerLeave={releaseCharge}
          className="pressable flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/25 bg-gradient-to-br from-[#ff8a3d] to-[#d8541b] text-2xl font-black text-white shadow-[0_8px_20px_rgba(216,84,27,0.4)] active:scale-95 disabled:opacity-40"
          aria-label="玉を発射する"
        >
          {charging ? "…" : "発射"}
        </button>
        <p className="text-center text-[10px] font-bold leading-relaxed text-white/60">
          押しっぱなしでパワーゲージが往復するよ。離した瞬間の強さで玉が飛ぶ！
        </p>
      </div>

      <Link
        href="/games"
        className="pressable mt-1 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-black text-white/80 active:scale-95"
      >
        ゲーム一覧へ戻る
      </Link>
    </div>
  );
}
