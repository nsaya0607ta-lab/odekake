"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type FrenchieCatchItem = {
  id: string;
  name: string;
  image: string;
  rarity: "N" | "R" | "SR" | "SSR" | "UR";
};

type Entity = {
  id: number;
  kind: "dog" | "item";
  name: string;
  image: string;
  rarity: FrenchieCatchItem["rarity"] | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  status: "falling" | "bounced" | "caught";
  rimChecked: boolean;
  ttl: number;
};

const ROUND_SECONDS = 30;
const BOX_WIDTH = 46;
const BOX_HALF = BOX_WIDTH / 2;
const BOX_LIP_Y = 82;
const INNER_OPENING_HALF = 15.5;
const BOX_MIN_X = BOX_HALF + 1;
const BOX_MAX_X = 100 - BOX_HALF - 1;
const POINTS: Record<FrenchieCatchItem["rarity"], number> = { N: 10, R: 20, SR: 40, SSR: 70, UR: 100 };
const RARITY_STYLE: Record<FrenchieCatchItem["rarity"], string> = {
  N: "drop-shadow-[0_4px_7px_rgba(80,120,80,0.22)]",
  R: "drop-shadow-[0_4px_9px_rgba(74,142,200,0.34)]",
  SR: "drop-shadow-[0_0_10px_rgba(235,180,55,0.68)]",
  SSR: "drop-shadow-[0_0_13px_rgba(177,112,220,0.78)]",
  UR: "drop-shadow-[0_0_16px_rgba(201,66,55,0.92)]",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function overlap(leftA: number, rightA: number, leftB: number, rightB: number) {
  return Math.max(0, Math.min(rightA, rightB) - Math.max(leftA, leftB));
}

export function FrenchieCatchGame({ ownedItems }: { ownedItems: FrenchieCatchItem[] }) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const entitiesRef = useRef<Entity[]>([]);
  const draggingRef = useRef(false);
  const boxXRef = useRef(50);
  const nextIdRef = useRef(1);
  const startAtRef = useRef(0);
  const nextSpawnRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const caughtRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const impactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<"idle" | "playing" | "finished">("idle");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [boxX, setBoxX] = useState(50);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [caught, setCaught] = useState(0);
  const [feedback, setFeedback] = useState<{ name: string; points: number } | null>(null);
  const [impactX, setImpactX] = useState<number | null>(null);
  const [boxBounce, setBoxBounce] = useState(false);

  const itemPool = useMemo(() => ownedItems.filter((item) => item.image.length > 0), [ownedItems]);

  const createEntity = useCallback((): Entity => {
    const base = {
      id: nextIdRef.current++,
      x: 9 + Math.random() * 82,
      y: -13 - Math.random() * 5,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 17 + Math.random() * 5,
      rotation: (Math.random() - 0.5) * 12,
      status: "falling" as const,
      rimChecked: false,
      ttl: 0,
    };

    if (itemPool.length === 0 || Math.random() < 0.28) {
      return {
        ...base,
        kind: "dog",
        name: "初期フレブル",
        image: "/characters/default/front.webp",
        rarity: null,
        size: 19,
        spin: (Math.random() - 0.5) * 20,
      };
    }

    const item = itemPool[Math.floor(Math.random() * itemPool.length)] ?? itemPool[0]!;
    return {
      ...base,
      kind: "item",
      name: item.name,
      image: item.image,
      rarity: item.rarity,
      size: 12.5 + Math.random() * 3.5,
      spin: (Math.random() - 0.5) * 65,
    };
  }, [itemPool]);

  const showCatch = useCallback((entity: Entity, points: number) => {
    setFeedback({ name: entity.name, points });
    setBoxBounce(true);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      setBoxBounce(false);
    }, 440);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(18);
  }, []);

  const showImpact = useCallback((x: number) => {
    setImpactX(x);
    if (impactTimerRef.current) clearTimeout(impactTimerRef.current);
    impactTimerRef.current = setTimeout(() => setImpactX(null), 280);
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (impactTimerRef.current) clearTimeout(impactTimerRef.current);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    let last = performance.now();

    const frame = (now: number) => {
      const elapsed = (now - startAtRef.current) / 1000;
      const remaining = Math.max(0, ROUND_SECONDS - elapsed);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        setPhase("finished");
        return;
      }

      const dt = Math.min(0.035, Math.max(0, (now - last) / 1000));
      last = now;
      if (now >= nextSpawnRef.current && entitiesRef.current.length < 10) {
        entitiesRef.current.push(createEntity());
        nextSpawnRef.current = now + 790 - Math.min(1, elapsed / ROUND_SECONDS) * 250 + Math.random() * 170;
      }

      const next: Entity[] = [];
      for (const entity of entitiesRef.current) {
        if (entity.status === "caught") {
          entity.ttl -= dt;
          entity.vy += 18 * dt;
          entity.x += entity.vx * dt;
          entity.y += entity.vy * dt;
          entity.rotation += entity.spin * dt;
          if (entity.ttl > 0) next.push(entity);
          continue;
        }

        if (entity.status === "bounced") entity.vy += 38 * dt;
        entity.x += entity.vx * dt;
        entity.y += entity.vy * dt;
        entity.rotation += entity.spin * dt;

        const hitboxWidth = entity.size * (entity.kind === "dog" ? 0.56 : 0.62);
        const hitLeft = entity.x - hitboxWidth / 2;
        const hitRight = entity.x + hitboxWidth / 2;
        const bottom = entity.y + entity.size * (entity.kind === "dog" ? 0.34 : 0.31);

        // フチで跳ねた物体は、いったん箱より上まで戻ったら再キャッチ可能にする。
        // 上昇中に判定を戻しておけば、次に下降してフチを横切ったときだけ再判定される。
        if (entity.status === "bounced" && entity.rimChecked && entity.vy < 0 && bottom < BOX_LIP_Y - 3) {
          entity.rimChecked = false;
        }

        if (!entity.rimChecked && entity.vy > 0 && bottom >= BOX_LIP_Y) {
          entity.rimChecked = true;
          const center = boxXRef.current;
          const innerRatio = overlap(hitLeft, hitRight, center - INNER_OPENING_HALF, center + INNER_OPENING_HALF) / Math.max(0.01, hitboxWidth);
          const touchesBox = overlap(hitLeft, hitRight, center - BOX_HALF, center + BOX_HALF) > 0;

          if (innerRatio >= 0.58) {
            const points = entity.kind === "dog" ? 15 : POINTS[entity.rarity!];
            entity.status = "caught";
            entity.ttl = 0.48;
            // 箱の中心へ吸い寄せず、その位置のまま自然に中へ落とす。
            // 箱本体のほうが z-index が高いため、落下すると前面の段ボールに自然に隠れる。
            entity.vx *= 0.2;
            entity.vy = Math.max(entity.vy, 18);
            entity.spin *= 0.2;
            scoreRef.current += points;
            comboRef.current += 1;
            caughtRef.current += 1;
            maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            setCaught(caughtRef.current);
            setMaxCombo(maxComboRef.current);
            showCatch(entity, points);
          } else if (touchesBox) {
            const direction = entity.x <= center ? -1 : 1;
            entity.status = "bounced";
            entity.vx = direction * (13 + Math.random() * 6);
            entity.vy = -(9 + Math.random() * 5);
            entity.spin = direction * (220 + Math.random() * 130);
            comboRef.current = 0;
            setCombo(0);
            showImpact(clamp(entity.x, 4, 96));
          }
        }

        if (entity.y > 110 || entity.x < -18 || entity.x > 118) {
          if (entity.status !== "caught") {
            comboRef.current = 0;
            setCombo(0);
          }
          continue;
        }
        next.push(entity);
      }

      entitiesRef.current = next;
      setEntities([...next]);
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [createEntity, phase, showCatch, showImpact]);

  const startGame = useCallback(() => {
    entitiesRef.current = [];
    nextIdRef.current = 1;
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    caughtRef.current = 0;
    boxXRef.current = 50;
    setEntities([]);
    setBoxX(50);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setCaught(0);
    setTimeLeft(ROUND_SECONDS);
    setFeedback(null);
    setImpactX(null);
    startAtRef.current = performance.now();
    nextSpawnRef.current = startAtRef.current;
    setPhase("playing");
  }, []);

  const moveBox = useCallback((clientX: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const nextX = clamp(((clientX - rect.left) / rect.width) * 100, BOX_MIN_X, BOX_MAX_X);
    boxXRef.current = nextX;
    setBoxX(nextX);
  }, []);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "playing") return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveBox(event.clientX);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase === "playing" && draggingRef.current) moveBox(event.clientX);
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section className="rough-card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-ink-faint">MINI GAME</p>
          <h2 className="mt-0.5 text-base font-black text-ink">フレブルキャッチ</h2>
        </div>
        <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-[10px] font-bold text-leaf-deep">30秒チャレンジ</span>
      </div>

      <div ref={boardRef} className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden bg-[#dff3fa]" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#caeef9_0%,#eff9f2_70%,#d9ebbd_100%)]" />
        <div className="absolute -left-8 top-[18%] h-20 w-36 rounded-full bg-white/50 blur-xl" />
        <div className="absolute -right-10 top-[34%] h-24 w-40 rounded-full bg-white/50 blur-xl" />
        <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[linear-gradient(180deg,rgba(208,232,171,0)_0%,#c9e29e_72%,#efdcb8_73%,#e9cfa5_100%)]" />

        <div className="absolute left-3 right-3 top-3 z-30 flex items-start justify-between gap-2">
          <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2 shadow-sm"><p className="text-[9px] font-bold tracking-widest text-ink-faint">SCORE</p><p className="text-xl font-black tabular-nums text-ink">{score.toLocaleString("ja-JP")}</p></div>
          {combo >= 2 ? <div className="rounded-full border border-[#f1c969] bg-[#fff6cc]/95 px-3 py-1.5 text-center shadow-sm"><p className="text-lg font-black leading-none text-[#b77322]">{combo}</p><p className="text-[8px] font-black text-[#b77322]">COMBO!</p></div> : <span />}
          <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-right shadow-sm"><p className="text-[9px] font-bold tracking-widest text-ink-faint">TIME</p><p className="text-xl font-black tabular-nums text-ink">{timeLeft}</p></div>
        </div>

        {entities.map((entity) => (
          <div key={entity.id} className={`absolute z-20 will-change-transform opacity-100 ${entity.rarity ? RARITY_STYLE[entity.rarity] : "drop-shadow-[0_5px_7px_rgba(75,58,43,0.22)]"}`} style={{ left: `${entity.x}%`, top: `${entity.y}%`, width: `${entity.size}%`, transform: `translate(-50%, -50%) rotate(${entity.rotation}deg)` }}>
            <Image src={entity.image} alt="" width={160} height={160} draggable={false} className="h-auto w-full object-contain" />
            {entity.rarity === "UR" ? <span className="absolute -inset-2 -z-10 animate-pulse rounded-full bg-[#e95c4d]/15 blur-md" /> : null}
          </div>
        ))}

        {impactX !== null ? <div className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 animate-ping text-xl font-black text-[#d7684f]" style={{ left: `${impactX}%`, top: `${BOX_LIP_Y}%` }}>✦</div> : null}
        {feedback ? <div className="pointer-events-none absolute left-1/2 top-[69%] z-40 -translate-x-1/2 text-center"><p className="text-lg font-black text-[#c87527]">CATCH!</p><p className="-mt-1 text-sm font-black text-[#c87527]">+{feedback.points}</p><p className="mt-0.5 max-w-40 truncate rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold text-ink-soft">{feedback.name}</p></div> : null}

        <div aria-hidden="true" className={`absolute bottom-[3%] z-30 h-[15%] w-[46%] -translate-x-1/2 transition-transform duration-100 ${boxBounce ? "scale-x-[1.04] scale-y-[0.94]" : "scale-100"}`} style={{ left: `${boxX}%` }}>
          <div className="absolute left-[10%] top-0 h-[25%] w-[80%] rounded-[50%] border-2 border-[#8b6034] bg-[#6d4828] shadow-inner" />
          <div className="absolute -left-[8%] top-[7%] h-[32%] w-[34%] border border-[#9b6c3e] bg-[#c68a4f]" style={{ clipPath: "polygon(100% 0,100% 72%,0 100%,13% 15%)" }} />
          <div className="absolute -right-[8%] top-[7%] h-[32%] w-[34%] border border-[#9b6c3e] bg-[#c68a4f]" style={{ clipPath: "polygon(0 0,87% 15%,100% 100%,0 72%)" }} />
          <div className="absolute inset-x-0 bottom-0 top-[18%] rounded-b-lg border-2 border-[#9b6c3e] bg-[linear-gradient(180deg,#c98e52_0%,#b97b43_100%)] shadow-[0_6px_10px_rgba(93,61,35,0.2)]"><div className="absolute left-1/2 top-[48%] -translate-x-1/2 text-[11px] font-black tracking-[0.14em] text-[#704722]/45">CATCH</div></div>
          <div className="absolute left-[16%] right-[16%] top-[4%] h-[15%] rounded-[50%] border border-[#e8bd76]/50 bg-[#4e331e]/80" />
        </div>

        {phase === "playing" ? <div className="pointer-events-none absolute bottom-[1%] left-1/2 z-40 -translate-x-1/2 rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-bold text-ink-faint">← 指で左右に動かす →</div> : null}

        {phase !== "playing" ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#f9f3e7]/70 px-6 backdrop-blur-[2px]">
            <div className="w-full max-w-xs rounded-[28px] border border-white/90 bg-card/95 p-5 text-center shadow-xl">
              {phase === "finished" ? (
                <><p className="text-[10px] font-black tracking-[0.18em] text-ink-faint">RESULT</p><p className="mt-1 text-4xl font-black tabular-nums text-ink">{score.toLocaleString("ja-JP")}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-paper-deep px-2 py-2"><p className="text-[9px] text-ink-faint">キャッチ</p><p className="font-black text-ink">{caught}個</p></div><div className="rounded-xl bg-paper-deep px-2 py-2"><p className="text-[9px] text-ink-faint">MAX COMBO</p><p className="font-black text-ink">{maxCombo}</p></div></div></>
              ) : (
                <><p className="text-[10px] font-black tracking-[0.18em] text-leaf-deep">FRENCHIE CATCH</p><p className="mt-1 text-xl font-black text-ink">箱でキャッチしよう！</p><p className="mt-2 text-[11px] leading-relaxed text-ink-soft">所持している図鑑アイテムと初期フレブルが降ってきます。箱の内側にしっかり入れると得点！</p><div className="mt-3 rounded-xl bg-[#fff5df] px-3 py-2 text-[10px] leading-relaxed text-[#8d6231]">フチに少しだけ当たると、外へはじかれることがあります。</div></>
              )}
              <button type="button" onClick={startGame} className="mt-4 w-full rounded-full bg-leaf px-4 py-3 text-sm font-black text-white shadow-md active:translate-y-px">{phase === "finished" ? "もう一度あそぶ" : "START"}</button>
              <p className="mt-2 text-[9px] text-ink-faint">所持アイテム {itemPool.length}種類 + 初期フレブル</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}