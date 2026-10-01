"use client";

/**
 * わんこのおへやで暮らす犬。床の上をうろうろ歩いて、すわったり、においをかいだりする。
 * 夜はラグの上で寝ていて、タップすると喜ぶ。画像は左向きなので、右へ歩くときは反転する。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getFrenchieSrc, type DogSkinId } from "@/lib/dog-skins";
import { depthScale, ROOM } from "@/lib/room/types";
import type { DayPhase } from "./room-scene";

const IDLE_POSES = ["stand", "sit", "sniff", "sit-side", "smile", "wonder", "yawn", "front"] as const;
const HAPPY_POSES = ["stand-happy", "cheer", "wave", "wink", "bark", "shake"] as const;
const ALL_POSES = ["walk", "trot", "sleep", ...IDLE_POSES, ...HAPPY_POSES];
/** 歩く速さ（部屋の幅の % / 秒） */
const WALK_SPEED = 9;
const DOG_WIDTH = 25;
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type DogState = { x: number; y: number; pose: string; flip: boolean; dur: number };

export function RoomDog({ skin, phase, lines, quiet }: {
  skin: DogSkinId;
  phase: DayPhase;
  /** タップしたときに言うことの候補（飾ってあるものの話など） */
  lines: readonly string[];
  /** もようがえ中は、じゃまにならないよう端ですわって待つ */
  quiet: boolean;
}) {
  const [dog, setDog] = useState<DogState>({ x: 30, y: 84, pose: "sit", flip: false, dur: 0 });
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null);
  const [hearts, setHearts] = useState<number[]>([]);
  const timers = useRef<number[]>([]);
  const walkAnim = useRef<number | null>(null);
  const busy = useRef(false);
  const night = phase === "night";

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    if (walkAnim.current) { window.clearInterval(walkAnim.current); walkAnim.current = null; }
  }, []);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); }, []);

  // ポーズの画像を先に読んでおき、切りかえのちらつきを防ぐ
  useEffect(() => {
    for (const pose of ALL_POSES) { const img = new Image(); img.src = getFrenchieSrc(skin, pose); }
  }, [skin]);

  const pos = useRef({ x: dog.x, y: dog.y });
  const walkTo = useCallback((x: number, y: number, then: () => void) => {
    const from = pos.current;
    const dur = Math.max(0.4, Math.hypot(x - from.x, (y - from.y) * 1.4) / WALK_SPEED);
    pos.current = { x, y };
    if (walkAnim.current) window.clearInterval(walkAnim.current);
    let frame = 0;
    walkAnim.current = window.setInterval(() => { frame += 1; setDog((cur) => ({ ...cur, pose: frame % 2 ? "trot" : "walk" })); }, 210);
    later(() => {
      if (walkAnim.current) { window.clearInterval(walkAnim.current); walkAnim.current = null; }
      then();
    }, dur * 1000);
    setDog({ x, y, pose: "walk", flip: x > from.x, dur });
  }, [later]);

  const live = useCallback(() => {
    if (busy.current) return;
    if (quiet) { walkTo(9, ROOM.floorBottom - 3, () => setDog((d) => ({ ...d, pose: "sit", flip: true, dur: 0 }))); return; }
    if (night) {
      walkTo(50, 80, () => { setDog((d) => ({ ...d, pose: "sleep", dur: 0 })); });
      return;
    }
    if (Math.random() < 0.6) {
      walkTo(rand(10, 90), rand(ROOM.floorTop + 4, ROOM.floorBottom - 2), () => {
        setDog((d) => ({ ...d, pose: pick(IDLE_POSES), dur: 0 }));
        later(live, rand(2200, 4800));
      });
    } else {
      setDog((d) => ({ ...d, pose: pick(IDLE_POSES), dur: 0 }));
      later(live, rand(2500, 5000));
    }
  }, [later, night, quiet, walkTo]);

  useEffect(() => {
    clearTimers();
    later(live, 600);
    return clearTimers;
  }, [clearTimers, later, live]);

  const tap = () => {
    if (quiet) return;
    clearTimers();
    busy.current = true;
    const awake = !night || Math.random() < 0.6;
    setDog((d) => ({ ...d, pose: awake ? pick(HAPPY_POSES) : "yawn", dur: 0 }));
    const id = Date.now();
    setBubble({ text: awake ? pick(lines.length ? lines : ["わん！"]) : "むにゃ…", id });
    setHearts((h) => [...h.slice(-4), id]);
    later(() => setHearts((h) => h.filter((x) => x !== id)), 1400);
    later(() => setBubble((b) => (b?.id === id ? null : b)), 2400);
    later(() => { busy.current = false; live(); }, 2000);
  };

  const width = DOG_WIDTH * depthScale(dog.y);
  return (
    <button
      type="button"
      onClick={tap}
      aria-label={night ? "寝ている犬（タップでなでる）" : "犬（タップでなでる）"}
      className="absolute block -translate-x-1/2 -translate-y-full p-0 outline-none"
      style={{
        left: `${dog.x}%`,
        top: `${dog.y}%`,
        width: `${width}%`,
        zIndex: 300 + Math.round(dog.y * 10),
        transition: dog.dur ? `left ${dog.dur}s linear, top ${dog.dur}s linear, width ${dog.dur}s linear` : "none",
        pointerEvents: quiet ? "none" : "auto",
      }}
    >
      <span className="pointer-events-none absolute bottom-[3%] left-1/2 h-[12%] w-[62%] -translate-x-1/2 rounded-[50%] bg-[#4a3520]/20 blur-[2px]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getFrenchieSrc(skin, dog.pose)} alt="" draggable={false} className="relative block h-auto w-full select-none" style={{ transform: dog.flip ? "scaleX(-1)" : undefined }} />
      {dog.pose === "sleep" ? <span className="pointer-events-none absolute -top-[6%] right-[8%] animate-pulse text-[11px] font-black text-[#6A6FA8]">Zzz</span> : null}
      {hearts.map((h) => <span key={h} className="room-heart pointer-events-none absolute left-1/2 top-[8%] text-lg">💗</span>)}
      {bubble ? (
        <span key={bubble.id} className="room-bubble pointer-events-none absolute bottom-[96%] left-1/2 w-max max-w-[11rem] -translate-x-1/2 rounded-2xl border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold leading-snug text-ink shadow-md">
          {bubble.text}
        </span>
      ) : null}
    </button>
  );
}
