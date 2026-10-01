"use client";

/**
 * わんこのおへやで暮らす犬。床の上をうろうろ歩いて、すわったり、においをかいだりする。
 * 夜はラグの上で寝ていて、タップすると喜ぶ。画像は左向きなので、右へ歩くときは反転する。
 * 家具の上は歩かず、床のマス目で道をさがして回りこむ。歩きながら重なり順を変えるので、家具の奥を通るときは家具にかくれる。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getFrenchieSrc, type DogSkinId } from "@/lib/dog-skins";
import { clamp, depthScale, ROOM } from "@/lib/room/types";
import type { WeatherKind } from "@/lib/room/weather";
import type { DayPhase } from "./room-scene";

const IDLE_POSES = ["stand", "sit", "sniff", "sit-side", "smile", "wonder", "yawn", "front"] as const;
const HAPPY_POSES = ["stand-happy", "cheer", "wave", "wink", "bark", "shake"] as const;
const ALL_POSES = ["walk", "trot", "sleep", ...IDLE_POSES, ...HAPPY_POSES];
/** 歩く速さ（部屋の幅の % / 秒） */
const WALK_SPEED = 9;
const DOG_WIDTH = 25;
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type DogState = { x: number; y: number; pose: string; flip: boolean; /** 重なり順に使う y（ベッドの上では、ベッドより手前に描く） */ zy?: number };
type Pt = { x: number; y: number };
type Block = DogPlaces["blocks"][number];

/* ---------- 家具をよける道さがし（床を 2% × 1% のマス目にして A*） ---------- */
const GX0 = 5, GX1 = 95, GSX = 2;
const GY0 = ROOM.floorTop + 1.5, GY1 = ROOM.floorBottom, GSY = 1;
const COLS = Math.round((GX1 - GX0) / GSX) + 1, ROWS = Math.round((GY1 - GY0) / GSY) + 1;
/** 奥行き方向は見た目より長い道のりなので、横より重く数える */
const DEPTH_COST = 1.4;
const inside = (b: Block, p: Pt) => p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1;
const cellPt = (i: number): Pt => ({ x: GX0 + (i % COLS) * GSX, y: GY0 + Math.floor(i / COLS) * GSY });
const cellOf = (p: Pt) => clamp(Math.round((p.y - GY0) / GSY), 0, ROWS - 1) * COLS + clamp(Math.round((p.x - GX0) / GSX), 0, COLS - 1);
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, (b.y - a.y) * DEPTH_COST);

function lineClear(a: Pt, b: Pt, blocks: readonly Block[]): boolean {
  const n = Math.ceil(dist(a, b) / 0.6);
  for (let k = 1; k <= n; k++) {
    const t = k / n, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (blocks.some((bl) => inside(bl, p))) return false;
  }
  return true;
}

/** いちばん近い、家具のないところ */
function nearestFree(p: Pt, blocks: readonly Block[]): Pt {
  if (!blocks.some((b) => inside(b, p))) return p;
  let best = p, bestD = Infinity;
  for (let i = 0; i < COLS * ROWS; i++) {
    const c = cellPt(i);
    if (blocks.some((b) => inside(b, c))) continue;
    const d = dist(p, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/**
 * from から to までの通り道（曲がり角の点の列。最後が行き先）。
 * いま家具の中にいるとき（もようがえで上に家具を置かれたとき）は、その家具は無視して外へ出る。
 * exact のときは行き先をそのまま使う（ベッドやハウスの中へ入るとき）
 */
export function findPath(from: Pt, to: Pt, allBlocks: readonly Block[], exact = false): Pt[] {
  const blocks = allBlocks.filter((b) => !inside(b, from) && !(exact && inside(b, to)));
  const goal = exact ? to : nearestFree(to, blocks);
  if (lineClear(from, goal, blocks)) return [goal];
  const n = COLS * ROWS;
  const free = new Uint8Array(n);
  for (let i = 0; i < n; i++) free[i] = blocks.some((b) => inside(b, cellPt(i))) ? 0 : 1;
  const start = cellOf(from), end = cellOf(goal);
  free[start] = 1; free[end] = 1;
  const g = new Float64Array(n).fill(Infinity), came = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const open: number[] = [start];
  g[start] = 0;
  const h = (i: number) => dist(cellPt(i), goal);
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (g[open[k]!]! + h(open[k]!) < g[open[bi]!]! + h(open[bi]!)) bi = k;
    const cur = open.splice(bi, 1)[0]!;
    if (cur === end) break;
    if (done[cur]) continue;
    done[cur] = 1;
    const cx = cur % COLS, cy = Math.floor(cur / COLS);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const ni = ny * COLS + nx;
      if (!free[ni] || done[ni]) continue;
      // 斜めに進むとき、家具の角をかすめないようにする
      if (dx && dy && (!free[cy * COLS + nx] || !free[ny * COLS + cx])) continue;
      const ng = g[cur]! + dist(cellPt(cur), cellPt(ni));
      if (ng < g[ni]!) { g[ni] = ng; came[ni] = cur; open.push(ni); }
    }
  }
  if (came[end] === -1 && start !== end) return [goal];
  const cells: Pt[] = [];
  for (let i = end; i !== -1 && i !== start; i = came[i]!) cells.unshift(cellPt(i));
  cells[cells.length - 1] = goal;
  // 見通しのきく所まではまっすぐ歩く（マス目のカクカクをなくす）
  const path: Pt[] = [];
  let at = from, k = 0;
  while (k < cells.length) {
    let far = k;
    for (let j = cells.length - 1; j > k; j--) if (lineClear(at, cells[j]!, blocks)) { far = j; break; }
    path.push(cells[far]!);
    at = cells[far]!;
    k = far + 1;
  }
  return path;
}
export type DogPlaces = {
  bed: { x: number; y: number; zy: number } | null;
  bowl: { x: number; y: number } | null;
  toys: { x: number; y: number; name: string }[];
  /** 家具のあるところ（部屋の %）。うろうろするときは、ここに足をおかない */
  blocks: { x0: number; x1: number; y0: number; y1: number }[];
};

export function RoomDog({ skin, phase, sleepy, lines, quiet, places, weather = null }: {
  skin: DogSkinId;
  phase: DayPhase;
  /** 窓の外の天気（わからなければ null） */
  weather?: WeatherKind | null;
  /** タップしたときに言うことの候補（飾ってあるものの話など） */
  lines: readonly string[];
  /** もようがえ中は、じゃまにならないよう端ですわって待つ */
  quiet: boolean;
  /** 寝る時間か（日本時間の夜おそく〜朝） */
  sleepy: boolean;
  /** ベッド・ごはん皿・床に置いたおもちゃの場所 */
  places: DogPlaces;
}) {
  const [dog, setDog] = useState<DogState>({ x: 30, y: 84, pose: "sit", flip: false });
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null);
  const [hearts, setHearts] = useState<number[]>([]);
  const timers = useRef<number[]>([]);
  const walkAnim = useRef<number | null>(null);
  const stepAnim = useRef<number | null>(null);
  const busy = useRef(false);
  // 置き場所が変わるたびに暮らしを最初からやり直さないよう、最新の場所は ref で見る
  const placesRef = useRef(places);
  placesRef.current = places;
  const night = sleepy;

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    if (walkAnim.current) { window.clearInterval(walkAnim.current); walkAnim.current = null; }
    if (stepAnim.current) { window.cancelAnimationFrame(stepAnim.current); stepAnim.current = null; }
  }, []);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); }, []);

  // ポーズの画像を先に読んでおき、切りかえのちらつきを防ぐ
  useEffect(() => {
    for (const pose of ALL_POSES) { const img = new Image(); img.src = getFrenchieSrc(skin, pose); }
  }, [skin]);

  const pos = useRef({ x: dog.x, y: dog.y });
  /**
   * 家具をよけながら (x, y) まで歩く。1コマごとに位置を変えるので、重なり順も歩きながら変わる。
   * zy は着いてからの重なり順（ベッドの上など）。exact は家具の中（ベッド・ハウス）へ入るとき
   */
  const walkTo = useCallback((x: number, y: number, then: () => void, zy?: number, exact = false) => {
    if (walkAnim.current) window.clearInterval(walkAnim.current);
    if (stepAnim.current) window.cancelAnimationFrame(stepAnim.current);
    const path = findPath(pos.current, { x, y }, placesRef.current.blocks, exact);
    let a = pos.current, seg = 0, segStart = -1;
    let frame = 0;
    walkAnim.current = window.setInterval(() => { frame += 1; setDog((cur) => ({ ...cur, pose: frame % 2 ? "trot" : "walk" })); }, 210);
    setDog((d) => ({ ...d, pose: "walk", zy: undefined }));
    const step = (t: number) => {
      if (segStart < 0) segStart = t;
      const b = path[seg]!;
      const dur = Math.max(80, (dist(a, b) / WALK_SPEED) * 1000);
      const k = Math.min(1, (t - segStart) / dur);
      const cur = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      pos.current = cur;
      const flip = b.x > a.x + 0.05 ? true : b.x < a.x - 0.05 ? false : undefined;
      if (k >= 1) {
        a = b; seg += 1; segStart = t;
        if (seg >= path.length) {
          stepAnim.current = null;
          if (walkAnim.current) { window.clearInterval(walkAnim.current); walkAnim.current = null; }
          setDog((d) => ({ ...d, x: b.x, y: b.y, zy }));
          then();
          return;
        }
      }
      setDog((d) => ({ ...d, x: cur.x, y: cur.y, flip: flip ?? d.flip }));
      stepAnim.current = window.requestAnimationFrame(step);
    };
    stepAnim.current = window.requestAnimationFrame(step);
  }, []);

  /** 少しのあいだ、ふきだしを出す */
  const say = useCallback((text: string, ms = 2400) => {
    const id = Date.now() + Math.random();
    setBubble({ text, id });
    later(() => setBubble((b) => (b?.id === id ? null : b)), ms);
  }, [later]);
  const pose = useCallback((p: string) => setDog((d) => ({ ...d, pose: p })), []);

  const live = useCallback(() => {
    if (busy.current) return;
    const pl = placesRef.current;
    if (quiet) { walkTo(9, ROOM.floorBottom - 3, () => setDog((d) => ({ ...d, pose: "sit", flip: true }))); return; }
    if (night) {
      // 夜はベッド（なければラグ）で寝る
      const bed = pl.bed;
      if (bed) walkTo(bed.x, bed.y, () => pose("sleep"), bed.zy, true);
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
        setDog((d) => ({ ...d, pose: "sniff", flip: side < 0 }));
        later(() => { pose(pick(["cheer", "stand-happy", "wave"] as const)); say(`${toy.name}であそぶ♪`); }, 1200);
        next(4200);
      });
    } else if (r < 0.32 && pl.bowl) {
      const bowl = pl.bowl;
      walkTo(clamp(bowl.x + 6, 6, 94), clamp(bowl.y + 0.4, ROOM.floorTop + 2, ROOM.floorBottom), () => {
        setDog((d) => ({ ...d, pose: "sniff", flip: false }));
        say("もぐもぐ…", 2200);
        later(() => { pose("smile"); say("ごちそうさま！", 1500); }, 2400);
        next(4600);
      });
    } else if (r < 0.44) {
      // 窓の下で外をながめる
      walkTo(24, ROOM.floorTop + 2.5, () => {
        pose(pick(["wonder", "sit-side", "front"] as const));
        const rainy = weather === "rain" || weather === "drizzle";
        say(
          weather === "thunder" ? "かみなり、こわい…" : rainy ? "雨の音がするね…" : weather === "snow" ? "雪だ！ おそとまっしろ！" : weather === "fog" ? "おそと、まっしろでなにも見えない…"
            : phase === "night" ? (weather === "cloudy" ? "きょうはお星さま、かくれてる…" : "お星さま、見えるかな…") : phase === "evening" ? "夕やけ、きれい…" : weather === "cloudy" ? "くもってるね。おさんぽ行けるかな？" : phase === "morning" ? "いい朝だね" : "おそと、いい天気…",
          2600,
        );
        next(4200);
      });
    } else if (r < 0.54 && pl.bed) {
      const bed = pl.bed;
      walkTo(bed.x, bed.y, () => { pose(pick(["lie-wave", "sit"] as const)); say("ごろーん", 1800); next(4500); }, bed.zy, true);
    } else if (r < 0.85) {
      let tx = rand(10, 90), ty = rand(ROOM.floorTop + 3, ROOM.floorBottom - 2);
      for (let k = 0; k < 10 && pl.blocks.some((b) => inside(b, { x: tx, y: ty })); k++) {
        tx = rand(10, 90); ty = rand(ROOM.floorTop + 3, ROOM.floorBottom - 2);
      }
      walkTo(tx, ty, () => {
        pose(pick(IDLE_POSES));
        next(rand(2200, 4800));
      });
    } else {
      pose(pick(IDLE_POSES));
      next(rand(2500, 5000));
    }
  }, [later, night, phase, pose, quiet, say, walkTo, weather]);

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
    setDog((d) => ({ ...d, pose: awake ? pick(HAPPY_POSES) : "yawn" }));
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
