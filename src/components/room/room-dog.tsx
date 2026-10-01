"use client";

/**
 * わんこのおへやで暮らす犬。床の上をうろうろ歩いて、すわったり、においをかいだりする。
 * 夜はラグの上で寝ていて、タップすると喜ぶ。画像は左向きなので、右へ歩くときは反転する。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getFrenchieSrc, type DogSkinId } from "@/lib/dog-skins";
import { clamp, depthScale, ROOM } from "@/lib/room/types";
import type { DayPhase } from "./room-scene";

const IDLE_POSES = ["stand", "sit", "sniff", "sit-side", "smile", "wonder", "yawn", "front"] as const;
const HAPPY_POSES = ["stand-happy", "cheer", "wave", "wink", "bark", "shake"] as const;
const ALL_POSES = ["walk", "trot", "sleep", ...IDLE_POSES, ...HAPPY_POSES];
/** 歩く速さ（部屋の幅の % / 秒） */
const WALK_SPEED = 9;
const DOG_WIDTH = 25;
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type DogState = { x: number; y: number; pose: string; flip: boolean; dur: number; /** 重なり順に使う y（ベッドの上では、ベッドより手前に描く） */ zy?: number };
export type DogPlaces = {
  bed: { x: number; y: number; zy: number } | null;
  bowl: { x: number; y: number } | null;
  toys: { x: number; y: number; name: string }[];
};

export function RoomDog({ skin, phase, lines, quiet, places }: {
  skin: DogSkinId;
  phase: DayPhase;
  /** タップしたときに言うことの候補（飾ってあるものの話など） */
  lines: readonly string[];
  /** もようがえ中は、じゃまにならないよう端ですわって待つ */
  quiet: boolean;
  /** ベッド・ごはん皿・床に置いたおもちゃの場所 */
  places: DogPlaces;
}) {
  const [dog, setDog] = useState<DogState>({ x: 30, y: 84, pose: "sit", flip: false, dur: 0 });
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null);
  const [hearts, setHearts] = useState<number[]>([]);
  const timers = useRef<number[]>([]);
  const walkAnim = useRef<number | null>(null);
  const busy = useRef(false);
  // 置き場所が変わるたびに暮らしを最初からやり直さないよう、最新の場所は ref で見る
  const placesRef = useRef(places);
  placesRef.current = places;
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
  const walkTo = useCallback((x: number, y: number, then: () => void, zy?: number) => {
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
    setDog({ x, y, pose: "walk", flip: x > from.x, dur, zy });
  }, [later]);

  /** 少しのあいだ、ふきだしを出す */
  const say = useCallback((text: string, ms = 2400) => {
    const id = Date.now() + Math.random();
    setBubble({ text, id });
    later(() => setBubble((b) => (b?.id === id ? null : b)), ms);
  }, [later]);
  const pose = useCallback((p: string) => setDog((d) => ({ ...d, pose: p, dur: 0 })), []);

  const live = useCallback(() => {
    if (busy.current) return;
    const pl = placesRef.current;
    if (quiet) { walkTo(9, ROOM.floorBottom - 3, () => setDog((d) => ({ ...d, pose: "sit", flip: true, dur: 0 }))); return; }
    if (night) {
      // 夜はベッド（なければラグ）で寝る
      const bed = pl.bed;
      if (bed) walkTo(bed.x, bed.y, () => pose("sleep"), bed.zy);
      else walkTo(50, 80, () => pose("sleep"));
      return;
    }
    const r = Math.random();
    const next = (ms: number) => later(live, ms);
    if (r < 0.2 && pl.toys.length) {
      // おもちゃのにおいをかいで、遊ぶ
      const toy = pick(pl.toys);
      const side = toy.x < 50 ? 6 : -6;
      walkTo(clamp(toy.x + side, 6, 94), clamp(toy.y + 0.6, ROOM.floorTop + 2, ROOM.floorBottom), () => {
        setDog((d) => ({ ...d, pose: "sniff", flip: side < 0, dur: 0 }));
        later(() => { pose(pick(["cheer", "stand-happy", "wave"] as const)); say(`${toy.name}であそぶ♪`); }, 1200);
        next(4200);
      });
    } else if (r < 0.32 && pl.bowl) {
      const bowl = pl.bowl;
      walkTo(clamp(bowl.x + 6, 6, 94), clamp(bowl.y + 0.4, ROOM.floorTop + 2, ROOM.floorBottom), () => {
        setDog((d) => ({ ...d, pose: "sniff", flip: false, dur: 0 }));
        say("もぐもぐ…", 2200);
        later(() => { pose("smile"); say("ごちそうさま！", 1500); }, 2400);
        next(4600);
      });
    } else if (r < 0.44) {
      // 窓の下で外をながめる
      walkTo(24, ROOM.floorTop + 2.5, () => {
        pose(pick(["wonder", "sit-side", "front"] as const));
        say(phase === "evening" ? "夕やけ、きれい…" : phase === "morning" ? "いい朝だね" : "おそと、いい天気…", 2600);
        next(4200);
      });
    } else if (r < 0.54 && pl.bed) {
      const bed = pl.bed;
      walkTo(bed.x, bed.y, () => { pose(pick(["lie-wave", "sit"] as const)); say("ごろーん", 1800); next(4500); }, bed.zy);
    } else if (r < 0.85) {
      walkTo(rand(10, 90), rand(ROOM.floorTop + 4, ROOM.floorBottom - 2), () => {
        pose(pick(IDLE_POSES));
        next(rand(2200, 4800));
      });
    } else {
      pose(pick(IDLE_POSES));
      next(rand(2500, 5000));
    }
  }, [later, night, phase, pose, quiet, say, walkTo]);

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
  const place = {
    left: `${dog.x}%`,
    top: `${dog.y}%`,
    width: `${width}%`,
    transition: dog.dur ? `left ${dog.dur}s linear, top ${dog.dur}s linear, width ${dog.dur}s linear` : "none",
  } as const;
  // 歩くときは弾むように、止まっているときは息をするように、寝ているときはゆっくり上下する
  const motion = dog.pose === "walk" || dog.pose === "trot" ? "room-dog-walk" : dog.pose === "sleep" ? "room-dog-sleep" : "room-dog-idle";
  return (
    <>
      <button
        type="button"
        data-dog
        onClick={tap}
        aria-label={night ? "寝ている犬（タップでなでる）" : "犬（タップでなでる）"}
        className="absolute block -translate-x-1/2 -translate-y-full p-0 outline-none"
        style={{ ...place, zIndex: 300 + Math.round((dog.zy ?? dog.y) * 10), pointerEvents: quiet ? "none" : "auto" }}
      >
        <span data-shadow className="pointer-events-none absolute bottom-[3%] left-1/2 h-[12%] w-[62%] -translate-x-1/2 rounded-[50%] bg-[#4a3520]/20 blur-[2px]" />
        <span key={hearts.at(-1) ?? 0} className={`block ${hearts.length ? "room-dog-hop" : motion}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-body src={getFrenchieSrc(skin, dog.pose)} alt="" draggable={false} className="relative block h-auto w-full select-none" style={{ transform: dog.flip ? "scaleX(-1)" : undefined }} />
        </span>
      </button>
      {/* ふきだし・ハート・Zzz は、夜の暗さより上に出す */}
      <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full" style={{ ...place, aspectRatio: "300 / 254", zIndex: 2500 }}>
        {dog.pose === "sleep" ? <span className="absolute -top-[6%] right-[8%] animate-pulse text-[11px] font-black text-[#8A8FD8]">Zzz</span> : null}
        {hearts.map((h) => <span key={h} className="room-heart absolute left-1/2 top-[8%] text-lg">💗</span>)}
        {bubble ? (
          <span
            key={bubble.id}
            className={`room-bubble absolute bottom-[96%] w-max max-w-[11rem] rounded-2xl border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold leading-snug text-ink shadow-md ${dog.x < 28 ? "room-bubble-left left-0" : dog.x > 72 ? "room-bubble-right right-0" : "left-1/2 -translate-x-1/2"}`}
          >
            {bubble.text}
          </span>
        ) : null}
      </div>
    </>
  );
}
