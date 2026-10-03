"use client";

/**
 * わんこのおへやで暮らす犬。床の上をうろうろ歩いて、すわったり、においをかいだりする。
 * 夜はラグの上で寝ていて、タップすると喜ぶ。画像は左向きなので、右へ歩くときは反転する。
 * 家具の上は歩かず、床のマス目で道をさがして回りこむ。歩きながら重なり順を変えるので、家具の奥を通るときは家具にかくれる。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getFrenchieSrc, type DogSkinId } from "@/lib/dog-skins";
import { clamp, depthScale, ROOM } from "@/lib/room/types";
import type { FurnitureId } from "@/lib/room/types";
import type { WeatherKind } from "@/lib/room/weather";
import type { FurnitureFx } from "./furniture-art";
import type { DayPhase } from "./room-scene";

const IDLE_POSES = ["stand", "sit", "sniff", "sit-side", "smile", "wonder", "yawn", "front"] as const;
const HAPPY_POSES = ["stand-happy", "cheer", "wave", "wink", "bark", "shake"] as const;
/** レコードに合わせて踊るときのポーズ（右・左に向きをかえながら） */
const DANCE_POSES = ["stand-happy", "wave", "cheer", "stand-happy", "wink", "wave"] as const;
const ALL_POSES = ["walk", "trot", "sleep", "bow", "bow-b", "lie-wave", ...IDLE_POSES, ...HAPPY_POSES];
/** 歩く速さ（部屋の幅の % / 秒） */
const WALK_SPEED = 9;
const DOG_WIDTH = 25;
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type DogState = {
  x: number; y: number; pose: string; flip: boolean;
  /** 重なり順に使う y（ベッドの上では、ベッドより手前に描く。ハウスの中では奥に描く） */
  zy?: number;
  /** 床からの高さ（部屋の高さの %）。ソファに乗っているときやジャンプ中 */
  lift?: number;
  /** 見え方（ハウスに入るときに消える） */
  alpha?: number;
};
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
/** 犬がそばを通ると動く家具 */
const BRUSH_FX: Partial<Record<FurnitureId, { fx: FurnitureFx; ms: number }>> = { plant: { fx: "sway", ms: 1800 }, "rocking-chair": { fx: "rock", ms: 3200 } };

/** 床に置いた家具1つ（部屋の %。x, y は下のまん中、w は幅、h は高さ） */
export type FurnitureSpot = { id: string; kind: FurnitureId; x: number; y: number; w: number; h: number };
export type DogPlaces = {
  /** 窓のまん中（部屋の %）。窓をしまっていれば null */
  window: { x: number } | null;
  toys: { x: number; y: number; name: string }[];
  furniture: FurnitureSpot[];
  /** 家具のあるところ（部屋の %）。うろうろするときは、ここに足をおかない */
  blocks: { x0: number; x1: number; y0: number; y1: number }[];
};

export function RoomDog({ skin, phase, sleepy, lines, dreams = [], cue = null, call = null, introduce = null, quiet, places, weather = null, onFx, modes = {}, winter = false, hot = false, onFurnitureSay }: {
  skin: DogSkinId;
  phase: DayPhase;
  /** 窓の外の天気（わからなければ null） */
  weather?: WeatherKind | null;
  /** タップしたときに言うことの候補（飾ってあるものの話など） */
  lines: readonly string[];
  /** 寝ているときの寝言の候補 */
  dreams?: readonly string[];
  /** フレンドの部屋のわんこ：タップされたら名前を言う（ふだんは名前を出さない） */
  introduce?: string | null;
  /** 部屋で起きたことへの反応（id が変わるたびに1回、その場で言う） */
  cue?: { id: number; text: string; pose?: string } | null;
  /** タップされた家具へ、遊びに行く（寝ているときは、ひとことだけ） */
  call?: { id: number; furnitureId: string; text?: string } | null;
  /** もようがえ中は、じゃまにならないよう端ですわって待つ */
  quiet: boolean;
  /** 寝る時間か（日本時間の夜おそく〜朝） */
  sleepy: boolean;
  /** 家具・床に置いたおもちゃの場所 */
  places: DogPlaces;
  /** 犬が遊んでいる家具を動かす（ゆらす・明かりをつける など。null でもとにもどす） */
  onFx?: (id: string, fx: FurnitureFx | null) => void;
  /** 家具ごとの、いまの状態（レコードがかかっている・扇風機がついている・暖炉の火 など） */
  modes?: Record<string, string>;
  /** 寒い季節（暖炉の前で丸くなる） */
  winter?: boolean;
  /** 暑い日 */
  hot?: boolean;
  /** 家具がしゃべる（インコがわんこのまねをする） */
  onFurnitureSay?: (id: string, text: string) => void;
}) {
  const [dog, setDog] = useState<DogState>({ x: 30, y: 84, pose: "sit", flip: false });
  const [bubble, setBubble] = useState<{ text: string; id: number; dream?: boolean } | null>(null);
  const [hearts, setHearts] = useState<number[]>([]);
  /** こわくて ぷるぷる ふるえている（かみなり） */
  const [shiver, setShiver] = useState(false);
  /** ごはんを食べたばかり（このあとなでると…） */
  const ateAt = useRef(0);
  const [puff, setPuff] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const walkAnim = useRef<number | null>(null);
  const stepAnim = useRef<number | null>(null);
  const busy = useRef(false);
  // 置き場所が変わるたびに暮らしを最初からやり直さないよう、最新の場所は ref で見る
  const placesRef = useRef(places);
  placesRef.current = places;
  const fxRef = useRef(onFx);
  fxRef.current = onFx;
  const modesRef = useRef(modes);
  modesRef.current = modes;
  const sayRef = useRef(onFurnitureSay);
  sayRef.current = onFurnitureSay;
  /** 扇風機の風を顔に受けている（1: 風が右から / -1: 左から / 0: なし） */
  const [blown, setBlown] = useState<0 | 1 | -1>(0);
  /** いま動かしている家具（遊びを中断したら、もとにもどす） */
  const activeFx = useRef(new Set<string>());
  /** 食べきったお皿など、しばらく残る家具のようす */
  const lasting = useRef(new Map<string, { fx: FurnitureFx; timer: number }>());
  const lift = useRef(0);
  const night = sleepy;

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    if (walkAnim.current) { window.clearInterval(walkAnim.current); walkAnim.current = null; }
    if (stepAnim.current) { window.cancelAnimationFrame(stepAnim.current); stepAnim.current = null; }
    for (const id of activeFx.current) { const keep = lasting.current.get(id); fxRef.current?.(id, keep?.fx ?? null); }
    activeFx.current.clear();
    setBlown(0);
    // ハウスに入りかけで止まったときは、すがたを戻す
    setDog((d) => (d.alpha !== undefined && d.alpha < 1 ? { ...d, alpha: 1, zy: undefined } : d));
  }, []);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); }, []);

  /** 家具を動かす。ms を渡すと、遊びが終わってもしばらく残す（食べきったお皿など） */
  const fx = useCallback((id: string, f: FurnitureFx | null, ms?: number) => {
    if (ms && f) {
      const old = lasting.current.get(id);
      if (old) window.clearTimeout(old.timer);
      const timer = window.setTimeout(() => { lasting.current.delete(id); fxRef.current?.(id, null); }, ms);
      lasting.current.set(id, { fx: f, timer });
      activeFx.current.delete(id);
    } else if (f) activeFx.current.add(id);
    else activeFx.current.delete(id);
    fxRef.current?.(id, f ?? lasting.current.get(id)?.fx ?? null);
  }, []);
  const lastingFx = (id: string) => lasting.current.get(id)?.fx;

  useEffect(() => () => { for (const v of lasting.current.values()) window.clearTimeout(v.timer); }, []);

  // ポーズの画像を先に読んでおき、切りかえのちらつきを防ぐ
  useEffect(() => {
    for (const pose of ALL_POSES) { const img = new Image(); img.src = getFrenchieSrc(skin, pose); }
  }, [skin]);

  const pos = useRef({ x: dog.x, y: dog.y });
  const dogRef = useRef(dog);
  dogRef.current = dog;

  /** ms のあいだ、1コマごとに frame(0〜1) を呼んでから then */
  const tween = useCallback((ms: number, frame: (k: number) => void, then: () => void) => {
    if (stepAnim.current) window.cancelAnimationFrame(stepAnim.current);
    let t0 = -1;
    const step = (t: number) => {
      if (t0 < 0) t0 = t;
      const k = Math.min(1, (t - t0) / ms);
      frame(k);
      if (k >= 1) { stepAnim.current = null; then(); return; }
      stepAnim.current = window.requestAnimationFrame(step);
    };
    stepAnim.current = window.requestAnimationFrame(step);
  }, []);

  /** ぴょんとジャンプして (x, y) の高さ toLift へ。ソファに飛び乗る・飛び降りる */
  const jump = useCallback((x: number, y: number, toLift: number, then: () => void) => {
    const from = { ...pos.current }, l0 = lift.current;
    const flip = x > from.x + 0.3 ? true : x < from.x - 0.3 ? false : undefined;
    setDog((d) => ({ ...d, pose: "cheer", flip: flip ?? d.flip }));
    tween(560, (k) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const cur = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
      pos.current = cur;
      lift.current = l0 + (toLift - l0) * e;
      setDog((d) => ({ ...d, x: cur.x, y: cur.y, lift: lift.current + Math.sin(Math.PI * k) * 6 }));
    }, () => { lift.current = toLift; setDog((d) => ({ ...d, lift: toLift, pose: "stand" })); then(); });
  }, [tween]);

  /** 家具の上にいたら、床へ飛び降りる */
  const toFloor = useCallback((then: () => void) => {
    if (lift.current < 0.01) { then(); return; }
    const p = pos.current, dx = dogRef.current.flip ? 5 : -5;
    jump(clamp(p.x + dx, 6, 94), clamp(p.y + 1.2, ROOM.floorTop + 2, ROOM.floorBottom), 0, () => { setDog((c) => ({ ...c, lift: 0 })); then(); });
  }, [jump]);

  /** そばを通ると動く家具（観葉植物は葉がさわさわ、ゆり椅子は ゆらり）。同じ家具は、しばらく動かない */
  const brushedAt = useRef(new Map<string, number>());
  const brushPlants = useCallback((at: { x: number; y: number }) => {
    const now = Date.now();
    for (const f of placesRef.current.furniture) {
      const brush = BRUSH_FX[f.kind];
      if (!brush) continue;
      if (Math.abs(at.x - f.x) > f.w / 2 + 5 || Math.abs(at.y - f.y) > 7) continue;
      if (now - (brushedAt.current.get(f.id) ?? 0) < 4000) continue;
      // 犬が遊ばせている最中（ゆり椅子に乗っている など）は、じゃましない
      if (activeFx.current.has(f.id) || lasting.current.has(f.id)) continue;
      brushedAt.current.set(f.id, now);
      fx(f.id, brush.fx, brush.ms);
    }
  }, [fx]);

  /**
   * 家具をよけながら (x, y) まで歩く。1コマごとに位置を変えるので、重なり順も歩きながら変わる。
   * zy は着いてからの重なり順（ベッドの上など）。exact は家具の中（ベッド・ハウス）へ入るとき
   */
  const walkTo = useCallback((x: number, y: number, then: () => void, zy?: number, exact = false) => {
    toFloor(() => {
      if (walkAnim.current) window.clearInterval(walkAnim.current);
      if (stepAnim.current) window.cancelAnimationFrame(stepAnim.current);
      const path = findPath(pos.current, { x, y }, placesRef.current.blocks, exact);
      let a = pos.current, seg = 0, segStart = -1;
      let frame = 0;
      walkAnim.current = window.setInterval(() => { frame += 1; setDog((cur) => ({ ...cur, pose: frame % 2 ? "trot" : "walk" })); }, 210);
      setDog((d) => ({ ...d, pose: "walk", zy: undefined, alpha: undefined }));
      const step = (t: number) => {
        if (segStart < 0) segStart = t;
        const b = path[seg]!;
        const dur = Math.max(80, (dist(a, b) / WALK_SPEED) * 1000);
        const k = Math.min(1, (t - segStart) / dur);
        const cur = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        pos.current = cur;
        brushPlants(cur);
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
    });
  }, [toFloor, brushPlants]);

  /** 少しのあいだ、ふきだしを出す */
  const say = useCallback((text: string, ms = 2400) => {
    const id = Date.now() + Math.random();
    setBubble({ text, id });
    later(() => setBubble((b) => (b?.id === id ? null : b)), ms);
  }, [later]);
  const pose = useCallback((p: string) => setDog((d) => ({ ...d, pose: p })), []);
  const face = useCallback((x: number) => setDog((d) => ({ ...d, flip: x > pos.current.x })), []);
  /** その場でくるくる回る（ベッドで寝る前の犬のくせ） */
  const spin = useCallback((times: number, then: () => void) => {
    let n = 0;
    const turn = () => {
      setDog((d) => ({ ...d, flip: !d.flip, pose: n % 2 ? "trot" : "walk" }));
      n += 1;
      if (n < times) later(turn, 300); else later(then, 300);
    };
    turn();
  }, [later]);

  /* ---------- 家具ごとの遊び ---------- */
  /** 家具の前（手前の床）の立ち位置 */
  const frontOf = (f: FurnitureSpot, dx = 0) => ({ x: clamp(f.x + dx, 6, 94), y: clamp(f.y + 3.4, ROOM.floorTop + 2, ROOM.floorBottom) });
  /** 家具の横の立ち位置（窓に近い左右どちらか、あいているほう） */
  const sideOf = (f: FurnitureSpot) => {
    const side = f.x > 50 ? -1 : 1;
    return { x: clamp(f.x + side * (f.w / 2 + 5), 6, 94), y: clamp(f.y + 0.8, ROOM.floorTop + 2, ROOM.floorBottom), side };
  };

  const playWith = useCallback((f: FurnitureSpot, done: () => void, sleepNow = false) => {
    const fin = (ms: number) => later(done, ms);
    switch (f.kind) {
      case "sofa": {
        // 前まで歩いて、ふせてから飛び乗る。ねころんだり昼寝したりして、起きたら飛び降りる
        const fr = frontOf(f, rand(-f.w * 0.2, f.w * 0.2));
        walkTo(fr.x, fr.y, () => {
          const p = pos.current;
          if (p.y > f.y + 9 || Math.abs(p.x - f.x) > f.w * 0.7) { pose("sit"); say("ソファにのりたいな…"); fin(3000); return; }
          const seatY = f.y - f.h * 0.36;
          const tx = clamp(p.x, f.x - f.w * 0.28, f.x + f.w * 0.28);
          pose("bow");
          say("よいしょ…", 1200);
          later(() => jump(tx, p.y, p.y - seatY, () => {
            fx(f.id, "squish");
            later(() => fx(f.id, null), 650);
            if (sleepNow) { pose("sleep"); return; }
            pose("lie-wave");
            say(pick(["ソファ、ふかふか♪", "ここ、ぼくの特等席！", "ごろごろ〜"]), 2200);
            const napping = Math.random() < 0.6;
            if (napping) later(() => pose("sleep"), 2600);
            const wake = napping ? rand(9000, 14000) : 4200;
            later(() => { pose("yawn"); if (napping) say("ふわぁ…よくねた", 1600); }, wake);
            later(() => toFloor(() => { pose("shake"); later(() => pose("stand-happy"), 700); fin(1600); }), wake + 1500);
          }), 650);
        });
        return;
      }
      case "dog-bed": {
        // ベッドに入って、くるくる回ってから丸くなる
        walkTo(f.x, f.y - 1.5, () => {
          spin(4, () => {
            fx(f.id, "squish");
            later(() => fx(f.id, null), 650);
            if (sleepNow) { pose("sleep"); return; }
            pose("lie-wave");
            say("ごろーん", 1600);
            later(() => pose("sleep"), 2200);
            later(() => { pose("yawn"); say("のびーっ", 1400); }, rand(8000, 12000));
            fin(13500);
          });
        }, f.y + 0.5, true);
        return;
      }
      case "dog-house": {
        // 入り口からのぞいて、中へ入る。中から目だけ見える。しばらくしたら出てくる
        const door = { x: f.x, y: clamp(f.y + 1.2, ROOM.floorTop + 2, ROOM.floorBottom) };
        walkTo(door.x, door.y, () => {
          pose("bow-b");
          if (!sleepNow) say("おじゃましまーす", 1400);
          later(() => {
            const from = { ...pos.current };
            setDog((d) => ({ ...d, pose: "walk", zy: f.y - 0.6 }));
            tween(700, (k) => {
              pos.current = { x: from.x, y: from.y - 2.4 * k };
              setDog((d) => ({ ...d, y: pos.current.y, alpha: 1 - k }));
            }, () => {
              fx(f.id, sleepNow ? "inside-sleep" : "inside");
              if (sleepNow) return;
              later(() => fx(f.id, "inside-sleep"), 4000);
              later(() => {
                fx(f.id, "inside");
                const inPos = { ...pos.current };
                later(() => {
                  fx(f.id, null);
                  setDog((d) => ({ ...d, pose: "walk" }));
                  tween(700, (k) => {
                    pos.current = { x: inPos.x, y: inPos.y + 2.4 * k };
                    setDog((d) => ({ ...d, y: pos.current.y, alpha: k, zy: k > 0.5 ? undefined : d.zy }));
                  }, () => {
                    setDog((d) => ({ ...d, alpha: undefined, zy: undefined, pose: "shake" }));
                    later(() => { pose("stand-happy"); say("ただいま！", 1500); }, 700);
                    fin(2600);
                  });
                }, 1600);
              }, 9000);
            });
          }, 900);
        }, undefined, true);
        return;
      }
      case "bowl": {
        const sp = { x: clamp(f.x + f.w / 2 + 5, 6, 94), y: clamp(f.y + 0.4, ROOM.floorTop + 2, ROOM.floorBottom) };
        walkTo(sp.x, sp.y, () => {
          face(f.x);
          if (lastingFx(f.id) === "empty") {
            pose("sniff");
            later(() => { pose("wonder"); say("からっぽ…おかわり、ほしいな", 2200); }, 1200);
            fin(3800);
            return;
          }
          pose("sniff");
          fx(f.id, "clatter");
          say("もぐもぐ…", 2200);
          later(() => { fx(f.id, "empty", 45_000); pose("smile"); say("ごちそうさま！", 1500); ateAt.current = Date.now(); }, 2600);
          later(() => pose("wink"), 3600);
          fin(4800);
        });
        return;
      }
      case "plant": {
        const sp = sideOf(f);
        walkTo(sp.x, sp.y, () => {
          face(f.x);
          pose("sniff");
          fx(f.id, "sway");
          say("くんくん…", 1200);
          later(() => { pose("shake"); say("くしゅん！", 1400); }, 1500);
          later(() => { fx(f.id, null); pose("smile"); }, 3300);
          fin(4600);
        });
        return;
      }
      case "lamp": {
        const sp = sideOf(f);
        walkTo(sp.x, sp.y, () => {
          face(f.x);
          if (night || phase === "night") {
            // 夜はもう明るいので、ぶつかってゆらしてしまう
            pose("stand");
            fx(f.id, "wobble");
            say("あわわ…", 1400);
            later(() => { fx(f.id, null); pose("sit-side"); }, 1300);
            fin(3000);
            return;
          }
          pose("wave");
          say("ぽちっ", 1000);
          later(() => { fx(f.id, "on", 9000); pose("cheer"); say("あかるくなった！", 1600); }, 600);
          later(() => pose("sit"), 2600);
          fin(4200);
        });
        return;
      }
      case "table": {
        const fr = frontOf(f, rand(-f.w * 0.15, f.w * 0.15));
        walkTo(fr.x, fr.y, () => {
          face(f.x + f.w * 0.1);
          pose("wonder");
          say("クッキーのいいにおい…", 1600);
          if (lastingFx(f.id) === "nibbled") { later(() => { pose("sit"); say("…さっき1まい、もらったもんね", 1800); }, 1800); fin(4000); return; }
          later(() => { pose("bow"); say("1まい、ちょうだい？", 1500); }, 1800);
          const lucky = Math.random() < 0.55;
          later(() => {
            if (lucky) { fx(f.id, "nibbled", 30_000); pose("cheer"); say("もらっちゃった♪", 1500); }
            else { pose("sit"); say("…がまん。", 1400); }
          }, 3500);
          fin(5200);
        });
        return;
      }
      case "whiteboard": {
        // ホワイトボードの横に立って、マーカーで らくがき（ボードがかくれないよう、前には立たない）
        const sd = sideOf(f);
        walkTo(sd.x, sd.y, () => {
          face(f.x);
          pose("wonder");
          say(pick(["なにかこうかな…", "らくがき タイム！"]), 1400);
          later(() => { fx(f.id, "drawing", 3600); pose("stand-happy"); say("かきかき…", 2400); }, 1500);
          later(() => { pose(pick(["cheer", "wink"] as const)); say(pick(["できた！ じょうず？", "けっさく！", "あしたも かくね"]), 1800); }, 5200);
          later(() => pose("sit"), 7100);
          fin(8000);
        });
        return;
      }
      case "kotatsu": {
        // こたつに足をつっこんで、ぬくぬく（夜はそのまま寝る）
        const fr = frontOf(f, rand(-f.w * 0.15, f.w * 0.15));
        walkTo(fr.x, f.y + 1.2, () => {
          face(f.x);
          if (sleepNow) { pose("sleep"); return; }
          pose("lie-wave");
          say(pick(["こたつ、ぬくぬく…", "ここから でられない…"]), 2000);
          later(() => pose("sleep"), 2600);
          later(() => { pose("yawn"); say("みかん、たべたいな", 1600); }, rand(6000, 9000));
          fin(10_500);
        }, f.y + 0.6);
        return;
      }
      case "fishbowl": {
        const sd = sideOf(f);
        walkTo(sd.x, sd.y, () => {
          face(f.x);
          pose("wonder");
          say("おさかな… じーっ", 1600);
          later(() => { pose("sniff"); fx(f.id, "wobble"); say("ぱくっ…しないよ？", 1500); }, 1800);
          later(() => { fx(f.id, null); pose("sit"); }, 3600);
          fin(4600);
        });
        return;
      }
      case "tv": {
        const fr = frontOf(f, 0);
        walkTo(fr.x, Math.min(ROOM.floorBottom, f.y + 7), () => {
          if (modesRef.current[f.id] === "off") {
            setDog((d) => ({ ...d, pose: "wonder", flip: false }));
            say("テレビ、きえてる…", 1800);
            fin(3200);
            return;
          }
          setDog((d) => ({ ...d, pose: "sit", flip: false }));
          say(pick(["わんこ番組、おもしろい！", "ボールのCMだ！", "あ、ぼくに にてる！"]), 2200);
          later(() => { pose("cheer"); say("ワン！", 1000); }, 3000);
          later(() => pose("sit"), 4200);
          fin(6000);
        });
        return;
      }
      case "piano": {
        const fr = frontOf(f, rand(-f.w * 0.2, f.w * 0.2));
        walkTo(fr.x, fr.y, () => {
          face(f.x);
          pose("wave");
          fx(f.id, "wobble");
          say("ポロロン♪", 1400);
          later(() => { pose("bark"); say("ワワン ワン♪", 1400); }, 1500);
          later(() => { fx(f.id, null); pose("wink"); say("じょうずでしょ？", 1500); }, 3000);
          fin(4800);
        });
        return;
      }
      case "rocking-chair": {
        const sd = sideOf(f);
        walkTo(sd.x, sd.y, () => {
          face(f.x);
          pose("stand-happy");
          fx(f.id, "rock", 3200);
          say("ゆーらゆら〜", 1800);
          later(() => { pose("sit-side"); say("ねむくなってきた…", 1500); }, 2400);
          fin(4800);
        });
        return;
      }
      case "toybox": {
        const fr = frontOf(f, 0);
        walkTo(fr.x, fr.y, () => {
          face(f.x);
          pose("sniff");
          fx(f.id, "wobble");
          say("ごそごそ…", 1300);
          later(() => { fx(f.id, "hop", 900); pose("cheer"); say(pick(["ボール みーつけた！", "あひるさん、あった！", "ほねだ〜！"]), 1700); }, 1500);
          later(() => pose("smile"), 3300);
          fin(4600);
        });
        return;
      }
      case "birdcage": {
        // 鳥かごを見上げると、インコがわんこのまねをする → 首をかしげる
        const sd = sideOf(f);
        walkTo(sd.x, sd.y, () => {
          face(f.x);
          pose("wonder");
          say(pick(["インコさん、こんにちは", "とりさん、なにしてるの？"]), 1500);
          later(() => { pose("bark"); say("ワン！", 900); }, 1700);
          later(() => sayRef.current?.(f.id, pick(["ワン！ワン！", "ワンワン！", "コンニチハ！"])), 2700);
          later(() => { pose("wonder"); say(pick(["…いま、ぼくの まね した？", "しゃべった！？", "ふしぎな とりさん…"]), 2000); }, 4300);
          later(() => pose("sit"), 6400);
          fin(7000);
        });
        return;
      }
      case "hamster": {
        const sd = sideOf(f);
        walkTo(sd.x, sd.y, () => {
          face(f.x);
          pose("sniff");
          say(night || phase === "night" ? "よるなのに げんきだね…" : "くるくる まわってる…", 1800);
          later(() => { pose("wonder"); say(pick(["ぼくも はしりたい！", "めが まわらないの？", "いっしょに あそぼ？"]), 1800); }, 2100);
          later(() => pose("sit-side"), 4100);
          fin(5000);
        });
        return;
      }
      case "record": {
        // レコードがかかっていれば前で踊る。止まっていれば、鼻でスイッチを入れてから踊る
        const fr = frontOf(f, rand(-f.w * 0.15, f.w * 0.15));
        walkTo(fr.x, fr.y, () => {
          face(f.x);
          const dance = (beats: number) => {
            let n = 0;
            const step = () => {
              setDog((d) => ({ ...d, pose: DANCE_POSES[n % DANCE_POSES.length]!, flip: n % 2 ? !d.flip : d.flip }));
              n += 1;
              if (n < beats) later(step, 430);
            };
            step();
          };
          if (modesRef.current[f.id] === "on") {
            say(pick(["♪ ノリノリ〜", "♪ ふりふり〜", "おどっちゃう！"]), 1600);
            dance(12);
            later(() => { pose("wink"); say("じょうずでしょ？", 1400); }, 5400);
            fin(6800);
            return;
          }
          pose("bow");
          say("ぽちっ", 900);
          later(() => { fx(f.id, "on", 90_000); say("♪ おんがく スタート！", 1400); dance(12); }, 900);
          later(() => pose("wink"), 6400);
          fin(7400);
        });
        return;
      }
      case "fireplace": {
        const fr = frontOf(f, rand(-f.w * 0.12, f.w * 0.12));
        const fire = !(modesRef.current[f.id] ?? "fire").startsWith("cold");
        walkTo(fr.x, fr.y, () => {
          face(f.x);
          if (sleepNow) { spin(2, () => pose("sleep")); return; }
          if (!fire) { pose("sniff"); say("キャンドル、きれい…", 1600); later(() => pose("sit"), 2000); fin(3400); return; }
          if (winter) {
            // 寒い日は、くるくる回ってから丸くなる
            spin(2, () => {
              pose("lie-wave");
              say(pick(["あったか〜い…", "ぽかぽか…", "ここ、さいこう…"]), 2000);
              later(() => pose("sleep"), 2600);
              later(() => { pose("yawn"); say("…ねちゃってた", 1400); }, rand(8000, 10_000));
              fin(11_500);
            });
            return;
          }
          pose("sit");
          say(pick(["パチパチ いってる…", "ゆらゆら、きれい…"]), 1600);
          later(() => pose("sit-side"), 2200);
          fin(4200);
        });
        return;
      }
      case "fan": {
        // ついていれば、風を顔に受けて「ワレワレハ…」。消えていれば、スイッチをさがす
        const fr = frontOf(f, 0);
        walkTo(fr.x, fr.y, () => {
          face(f.x);
          if (modesRef.current[f.id] !== "on") { pose("wonder"); say(hot ? "あつい… スイッチ、どこかな？" : "きょうは すずしいね", 1800); fin(3200); return; }
          pose("front");
          setBlown(f.x > pos.current.x ? 1 : -1);
          say("ワ゛レ゛ワ゛レ゛ハ゛…", 2200);
          later(() => { pose("stand-happy"); say("すずし〜い！", 1600); }, 2600);
          later(() => setBlown(0), 4600);
          fin(5200);
        });
        return;
      }
      case "gacha": {
        const fr = frontOf(f, 0);
        walkTo(fr.x, fr.y, () => {
          face(f.x);
          pose("sniff");
          say("これ、なあに？", 1300);
          later(() => { pose("bow"); fx(f.id, "spin"); say("ぐいっ…", 1000); }, 1500);
          const lucky = Math.random() < 0.35;
          later(() => {
            if (lucky) {
              fx(f.id, "capsule", 30_000);
              pose("cheer");
              say("カプセル でた！", 1500);
              later(() => { pose("wonder"); say("…あけられない", 1500); }, 1900);
            } else { fx(f.id, null); pose("sit"); say("…でなかった", 1400); }
          }, 2800);
          fin(lucky ? 6400 : 4600);
        });
        return;
      }
      case "bookshelf": {
        const fr = frontOf(f, rand(-f.w * 0.2, f.w * 0.2));
        walkTo(fr.x, fr.y, () => {
          face(f.x);
          pose("wonder");
          say("ごほん、いっぱい…", 1500);
          later(() => { fx(f.id, "book", 20_000); pose("stand-happy"); say("このごほん、よんで？", 1800); }, 1700);
          later(() => pose("sit"), 3600);
          fin(4800);
        });
        return;
      }
      default: {
        // 遊び方を決めていない家具：近くでくんくんして、つぎへ
        const sd = sideOf(f);
        walkTo(sd.x, sd.y, () => { face(f.x); pose("sniff"); fin(2400); });
        return;
      }
    }
  }, [face, fx, hot, jump, later, night, phase, pose, say, spin, toFloor, tween, walkTo, winter]);

  const live = useCallback(() => {
    if (busy.current) return;
    const pl = placesRef.current;
    if (quiet) { walkTo(9, ROOM.floorBottom - 3, () => setDog((d) => ({ ...d, pose: "sit", flip: true }))); return; }
    const next = (ms: number) => later(live, ms);
    const byKind = (k: FurnitureId) => pl.furniture.find((f) => f.kind === k);
    if (night) {
      // 夜はベッド → ソファ → ハウスの中 → ラグ の順で寝る場所をさがす
      const fireplace = byKind("fireplace");
      const warm = winter && fireplace && !(modesRef.current[fireplace.id] ?? "fire").startsWith("cold") ? fireplace : undefined;
      const spot = byKind("dog-bed") ?? byKind("kotatsu") ?? warm ?? byKind("sofa") ?? byKind("dog-house");
      if (spot) playWith(spot, () => {}, true);
      else walkTo(50, 80, () => pose("sleep"));
      return;
    }
    const rainy = weather === "rain" || weather === "drizzle";
    if (weather === "thunder" && Math.random() < 0.65) {
      // かみなり：ハウスの中にかくれる。なければテーブル・ソファのかげ、それもなければ部屋のすみで ぷるぷる
      const house = byKind("dog-house");
      if (house && Math.random() < 0.6) { say("かみなり、こわい…", 1400); playWith(house, () => next(rand(1500, 3000))); return; }
      // テーブルがあれば、その下にもぐりこむ（天板の下で、テーブルよりうしろに描く）
      const table = byKind("table");
      if (table) {
        walkTo(table.x, table.y - 0.8, () => {
          setDog((d) => ({ ...d, flip: Math.random() < 0.5 }));
          pose("lie-wave");
          setShiver(true);
          say(pick(["かみなり、こわい…", "ここなら あんしん…", "ゴロゴロ、どっかいって…"]), 2400);
          later(() => setShiver(false), 6500);
          next(7000);
        }, table.y - 0.6, true);
        return;
      }
      const cover = byKind("sofa") ?? byKind("bookshelf");
      const at = cover ? sideOf(cover) : { x: 7, y: ROOM.floorTop + 4, side: 1 };
      walkTo(at.x, at.y, () => {
        if (cover) face(cover.x); else setDog((d) => ({ ...d, flip: false }));
        pose(pick(["sit", "lie-wave"] as const));
        setShiver(true);
        say(pick(["かみなり、こわい…", "ゴロゴロいってる…", "ここに かくれてよ…"]), 2200);
        later(() => setShiver(false), 6000);
        next(6400);
      });
      return;
    }
    // レコードがかかっていると、そこへ行って踊りたくなる
    const playing = pl.furniture.find((f) => f.kind === "record" && modesRef.current[f.id] === "on");
    if (playing && Math.random() < 0.55) { playWith(playing, () => next(rand(600, 1500))); return; }
    const r = Math.random();
    if (rainy && pl.window && r < 0.35) {
      // 雨の日は、窓から外をよくながめる
      walkTo(clamp(pl.window.x, 8, 92), ROOM.floorTop + 2.5, () => {
        pose(pick(["sit-side", "wonder", "sit"] as const));
        say(pick(["あめ…", "雨の音がするね…", "おさんぽ、いけないね…", "あめ、やまないかな…", "てるてるぼうず、つくる？"]), 2600);
        next(rand(4500, 7000));
      });
      return;
    }
    if (r < 0.14 && pl.toys.length) {
      // おもちゃのにおいをかいで、遊ぶ
      const toy = pick(pl.toys);
      const side = toy.x < 50 ? 6 : -6;
      walkTo(clamp(toy.x + side, 6, 94), clamp(toy.y + 0.6, ROOM.floorTop + 2, ROOM.floorBottom), () => {
        setDog((d) => ({ ...d, pose: "sniff", flip: side < 0 }));
        later(() => { pose(pick(["cheer", "stand-happy", "wave"] as const)); say(`${toy.name}であそぶ♪`); }, 1200);
        next(4200);
      });
    } else if (r < 0.6 && pl.furniture.length) {
      // 家具で遊ぶ（家具ごとにちがう遊び方）
      playWith(pick(pl.furniture), () => next(rand(800, 2000)));
    } else if (r < 0.7 && pl.window) {
      // 窓の下で外をながめる
      walkTo(clamp(pl.window.x, 8, 92), ROOM.floorTop + 2.5, () => {
        pose(pick(["wonder", "sit-side", "front"] as const));
        say(
          weather === "thunder" ? "かみなり、こわい…" : rainy ? "雨の音がするね…" : weather === "snow" ? "雪だ！ おそとまっしろ！" : weather === "fog" ? "おそと、まっしろでなにも見えない…"
            : phase === "night" ? (weather === "cloudy" ? "きょうはお星さま、かくれてる…" : "お星さま、見えるかな…") : phase === "evening" ? "夕やけ、きれい…" : weather === "cloudy" ? "くもってるね。おさんぽ行けるかな？" : phase === "morning" ? "いい朝だね" : "おそと、いい天気…",
          2600,
        );
        next(4200);
      });
    } else if (r < 0.9) {
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
  }, [face, later, night, phase, playWith, pose, quiet, say, walkTo, weather, winter]);

  useEffect(() => {
    clearTimers();
    later(live, 600);
    return clearTimers;
  }, [clearTimers, later, live]);

  const tap = () => {
    if (quiet) return;
    // ごはんのすぐあとになでると、おならが出てしまう（1回だけ）
    if (!night && ateAt.current && Date.now() - ateAt.current < 40_000) {
      ateAt.current = 0;
      clearTimers();
      busy.current = true;
      const id = Date.now();
      setPuff(id);
      setDog((d) => ({ ...d, pose: "wonder" }));
      setBubble({ text: "…ぷぅ", id });
      later(() => { setDog((d) => ({ ...d, pose: "bow" })); setBubble({ text: "しつれい しました…", id: id + 1 }); }, 1300);
      later(() => setPuff((p) => (p === id ? null : p)), 2400);
      later(() => setBubble(null), 3200);
      later(() => { busy.current = false; live(); }, 3400);
      return;
    }
    clearTimers();
    busy.current = true;
    setShiver(false);
    const awake = !night || Math.random() < 0.6;
    setDog((d) => ({ ...d, pose: awake ? pick(HAPPY_POSES) : "yawn" }));
    const id = Date.now();
    setBubble({ text: awake ? (introduce ? `${introduce}だよ！ よろしくね` : pick(lines.length ? lines : ["わん！"])) : "むにゃ…", id });
    setHearts((h) => [...h.slice(-4), id]);
    later(() => setHearts((h) => h.filter((x) => x !== id)), 1400);
    later(() => setBubble((b) => (b?.id === id ? null : b)), 2400);
    later(() => { busy.current = false; live(); }, 2000);
  };

  // 部屋で起きたことに反応する（よごれを片づけてもらった など）
  useEffect(() => {
    if (!cue) return;
    clearTimers();
    busy.current = true;
    setShiver(false);
    if (cue.pose) setDog((d) => ({ ...d, pose: cue.pose! }));
    say(cue.text, 2200);
    later(() => { busy.current = false; live(); }, 2400);
    // cue.id が変わったときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.id]);

  // タップされた家具へ、遊びに行く
  useEffect(() => {
    if (!call) return;
    const f = placesRef.current.furniture.find((x) => x.id === call.furnitureId);
    if (night || quiet || !f) {
      if (call.text && !quiet) say(call.text, 1800);
      return;
    }
    clearTimers();
    busy.current = false;
    setShiver(false);
    if (call.text) say(call.text, 1400);
    playWith(f, () => later(live, rand(800, 2000)));
    // call.id が変わったときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.id]);

  // 寝ているあいだ、ときどき寝言を言う（見えないところ〈ハウスの中〉で寝ているときは言わない）
  const dreaming = night && !quiet && dog.pose === "sleep" && (dog.alpha ?? 1) > 0.05;
  const dreamsRef = useRef(dreams);
  dreamsRef.current = dreams;
  useEffect(() => {
    if (!dreaming) return;
    let t = 0;
    const talk = () => {
      const d = dreamsRef.current;
      if (d.length) {
        const id = Date.now() + Math.random();
        setBubble({ text: `むにゃ… ${pick(d)}`, id, dream: true });
        window.setTimeout(() => setBubble((b) => (b?.id === id ? null : b)), 3200);
      }
      t = window.setTimeout(talk, rand(9000, 16000));
    };
    t = window.setTimeout(talk, rand(3000, 6000));
    return () => window.clearTimeout(t);
  }, [dreaming]);

  const width = DOG_WIDTH * depthScale(dog.y);
  const place = {
    left: `${dog.x}%`,
    top: `${dog.y - (dog.lift ?? 0)}%`,
    width: `${width}%`,
  } as const;
  const hidden = (dog.alpha ?? 1) < 0.05;
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
        style={{ ...place, zIndex: 300 + Math.round((dog.zy ?? dog.y) * 10), opacity: dog.alpha ?? 1, pointerEvents: quiet || hidden ? "none" : "auto" }}
      >
        <span data-shadow className="pointer-events-none absolute bottom-[3%] left-1/2 h-[12%] w-[62%] -translate-x-1/2 rounded-[50%] bg-[#4a3520]/20 blur-[2px]" />
        <span key={hearts.at(-1) ?? 0} className={`block ${hearts.length ? "room-dog-hop" : shiver ? "room-dog-shiver" : blown ? "room-dog-blown" : motion}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-body src={getFrenchieSrc(skin, dog.pose)} alt="" draggable={false} className="relative block h-auto w-full select-none" style={{ transform: dog.flip ? "scaleX(-1)" : undefined }} />
        </span>
      </button>
      {/* ふきだし・ハート・Zzz は、夜の暗さより上に出す */}
      <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full" style={{ ...place, aspectRatio: "300 / 254", zIndex: 2500 }}>
        {dog.pose === "sleep" && !hidden ? <span className="absolute right-[8%] top-[22%] animate-pulse text-[11px] font-black text-[#8A8FD8]">Zzz</span> : null}
        {/* おなら（おしりのほうに、もやっと緑の雲） */}
        {puff ? <span key={puff} className="room-puff absolute bottom-[14%] h-[46%] w-[46%] rounded-full" style={dog.flip ? { left: "-14%" } : { right: "-14%" }} /> : null}
        {hearts.map((h) => <span key={h} className="room-heart absolute left-1/2 top-[8%] text-lg">💗</span>)}
        {/* 扇風機の風（顔に当たる白いすじ） */}
        {blown ? (
          <span className="absolute inset-0" style={{ transform: blown < 0 ? "scaleX(-1)" : undefined }}>
            {[22, 38, 54].map((top, i) => <span key={top} className="room-wind absolute right-[-18%] h-[3px] w-[46%] rounded-full bg-white/85" style={{ top: `${top}%`, animationDelay: `${i * 0.18}s` }} />)}
          </span>
        ) : null}
        {bubble ? (
          <span
            key={bubble.id}
            className={`room-bubble absolute bottom-[96%] w-max max-w-[11rem] rounded-2xl border px-2.5 py-1.5 text-[11px] font-bold leading-snug shadow-md ${bubble.dream ? "border-[#D8D2FF] bg-[#F3F0FF] text-[#5A5794]" : "border-line bg-card text-ink"} ${dog.x < 28 ? "room-bubble-left left-0" : dog.x > 72 ? "room-bubble-right right-0" : "left-1/2 -translate-x-1/2"}`}
          >
            {bubble.text}
          </span>
        ) : null}
      </div>
    </>
  );
}
