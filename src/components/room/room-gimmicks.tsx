"use client";

/**
 * わんこのおへや：ちょっとしたしかけ。
 * - 流れ星：晴れた夜、ときどき窓の外を流れ星が横切る。消えるまでにタップすると、ねがいごとができる。
 * - 窓の外を通る犬：昼間、おさんぽ中の犬がときどき窓の外を通る。きょうたくさん歩いた日ほど、よく通る。
 *   ときどきフレンドの犬も通り、タップするとその部屋にあそびに行ける。
 * - ホワイトボードのらくがき：ホワイトボード（家具）を置くと、わんこが毎朝ひとつずつ描きたしていく。
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DOG_SKIN_IDS, getFrenchieSrc } from "@/lib/dog-skins";
import type { WindowPasser, WindowRect } from "./room-scene";

const WISHES = [
  "⭐ ねがいごと、とどいたかも…",
  "⭐ あしたも いっぱい おさんぽできますように",
  "⭐ おやつが ふえますように（わんこより）",
  "⭐ ずっと いっしょに いられますように",
  "⭐ あしたは 晴れますように",
];
/** 流れ星が見えている（タップできる）時間（ms） */
const STAR_MS = 2600;

/** 晴れた夜に、窓の外を流れる星。active のあいだだけ、ときどき流れる */
export function ShootingStars({ rects, active, onWish }: {
  /** 置いてある窓（外が見える範囲。部屋の %） */
  rects: readonly WindowRect[];
  active: boolean;
  /** 流れ星をタップしたとき（ねがいごとの文） */
  onWish: (text: string) => void;
}) {
  const [star, setStar] = useState<{ id: number; win: number; x: number; y: number; tilt: number } | null>(null);
  const [wish, setWish] = useState<{ id: number; x: number; y: number; win: number } | null>(null);
  const count = rects.length;
  // サーバーと最初の描画をそろえる（昼か夜かは、ひらいた端末の時刻で決まる）
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ときどき流す（はじめは少し早めに、あとは 15〜40 秒おき）
  useEffect(() => {
    if (!active || !count) { setStar(null); return; }
    let t = 0;
    const go = () => {
      setStar({ id: Date.now(), win: Math.floor(Math.random() * count), x: -10 + Math.random() * 30, y: 6 + Math.random() * 30, tilt: 18 + Math.random() * 14 });
      t = window.setTimeout(go, 15000 + Math.random() * 25000);
    };
    t = window.setTimeout(go, 4000 + Math.random() * 4000);
    return () => window.clearTimeout(t);
  }, [active, count]);

  useEffect(() => {
    if (!star) return;
    const t = window.setTimeout(() => setStar((s) => (s?.id === star.id ? null : s)), STAR_MS);
    return () => window.clearTimeout(t);
  }, [star]);

  useEffect(() => {
    if (!wish) return;
    const t = window.setTimeout(() => setWish((w) => (w?.id === wish.id ? null : w)), 1600);
    return () => window.clearTimeout(t);
  }, [wish]);

  if (!active || !mounted) return null;
  return (
    <>
      {rects.map((r, i) => {
        // 窓わく・桟・カーテンにかからないよう、左上のガラス1枚の内がわだけに描く
        const gw = r.x1 - r.x0, gh = r.y1 - r.y0;
        const box = { left: `${r.x0 + gw * 0.1}%`, top: `${r.y0 + gh * 0.05}%`, width: `${gw * 0.37}%`, height: `${gh * 0.42}%` };
        const s = star?.win === i ? star : null, w = wish?.win === i ? wish : null;
        return (
          <div key={i} className="pointer-events-none absolute overflow-hidden" style={{ ...box, zIndex: 2100 }}>
            {s ? (
              <span key={s.id} aria-hidden className="absolute block h-[2px] w-[80%] origin-left" style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `rotate(${s.tilt}deg)` }}>
                <span className="room-star block h-full w-full rounded-full bg-[linear-gradient(90deg,rgba(255,250,220,0),rgba(255,250,220,.6)_70%,#FFFFFF)]">
                  <span className="absolute -right-[3px] top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_3px_rgba(255,244,190,.9)]" />
                </span>
              </span>
            ) : null}
            {w ? <span key={w.id} aria-hidden className="room-wish absolute -translate-x-1/2 -translate-y-1/2 text-[18px]" style={{ left: `${w.x}%`, top: `${w.y}%` }}>✨</span> : null}
            {s ? (
              <button
                type="button" aria-label="流れ星にねがいごとをする"
                className="pointer-events-auto absolute inset-0 cursor-pointer"
                onClick={() => {
                  setWish({ id: s.id, x: 55, y: 62, win: i });
                  setStar(null);
                  onWish(WISHES[Math.floor(Math.random() * WISHES.length)]!);
                }}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/** 窓の外を通る犬の、つぎの1匹（いまは通っていなければ null） */
export function useWindowPasser({ active, steps, friends }: {
  active: boolean;
  /** きょうの歩数（多いほど、よく通る） */
  steps: number | null | undefined;
  /** あそびに行けるフレンド（ときどき、その犬が通る） */
  friends: readonly { id: string; name: string }[];
}) {
  const [passer, setPasser] = useState<(WindowPasser & { friendId?: string }) | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // 0歩で 50〜80 秒おき、1万歩で 12〜20 秒おきくらい
  const busy = Math.min(1, Math.max(0, steps ?? 0) / 10000);
  const friendKey = friends.map((f) => `${f.id}:${f.name}`).join(",");
  useEffect(() => {
    if (!active || !mounted) { setPasser(null); return; }
    const list = friendKey ? friendKey.split(",").map((s) => { const i = s.indexOf(":"); return { id: s.slice(0, i), name: s.slice(i + 1) }; }) : [];
    let t = 0;
    const go = () => {
      const friend = list.length && Math.random() < 0.35 ? list[Math.floor(Math.random() * list.length)]! : null;
      const ms = 8000 + Math.random() * 3000;
      setPasser({ id: Date.now(), src: getFrenchieSrc(DOG_SKIN_IDS[Math.floor(Math.random() * DOG_SKIN_IDS.length)]!, "walk"), dir: Math.random() < 0.5 ? 1 : -1, ms, ...(friend ? { name: [...friend.name].slice(0, 6).join(""), friendId: friend.id } : {}) });
      t = window.setTimeout(go, ms + (12000 + (1 - busy) * 38000) * (1 + Math.random() * 0.6));
    };
    t = window.setTimeout(go, 2500 + Math.random() * 3000);
    return () => window.clearTimeout(t);
  }, [active, mounted, busy, friendKey]);
  useEffect(() => {
    if (!passer) return;
    const t = window.setTimeout(() => setPasser((p) => (p?.id === passer.id ? null : p)), passer.ms + 200);
    return () => window.clearTimeout(t);
  }, [passer]);
  return passer;
}

/** 通っているのがフレンドの犬のとき、窓をタップするとその部屋へ */
export function PasserLink({ rects, passer }: { rects: readonly WindowRect[]; passer: (WindowPasser & { friendId?: string }) | null }) {
  if (!passer?.friendId || !rects.length) return null;
  const r = rects[0]!;
  return (
    <Link
      href={`/room/visit/${passer.friendId}`}
      aria-label={`${passer.name}さんの犬が通っています（タップで${passer.name}さんのおへやへ）`}
      className="absolute"
      style={{ left: `${r.x0}%`, top: `${r.y0 + (r.y1 - r.y0) * 0.45}%`, width: `${r.x1 - r.x0}%`, height: `${(r.y1 - r.y0) * 0.55}%`, zIndex: 2100 }}
    />
  );
}

/* ---------- ホワイトボードのらくがき ---------- */

/** マーカーで描く小さな絵（24×24） */
const DOODLES: { color: string; d: string; fill?: boolean }[] = [
  // 肉球
  { color: "#3A3F47", fill: true, d: "M12 21c-3.6 0-6-1.8-6-4.2 0-2.6 2.8-4.6 6-4.6s6 2 6 4.6c0 2.4-2.4 4.2-6 4.2zM5.4 11.2a2 2.4 0 1 0 0.1 0zM9.6 7.6a2 2.4 0 1 0 0.1 0zM14.4 7.6a2 2.4 0 1 0 0.1 0zM18.6 11.2a2 2.4 0 1 0 0.1 0z" },
  // ほね
  { color: "#8A5A30", d: "M6 9a2.6 2.6 0 1 1 3-3l6 6a2.6 2.6 0 1 1 3 3 2.6 2.6 0 1 1-3 3l-6-6a2.6 2.6 0 1 1-3-3z" },
  // ハート
  { color: "#E0405A", d: "M12 20s-7-4.4-7-9.4A3.8 3.8 0 0 1 12 8.4a3.8 3.8 0 0 1 7 2.2C19 15.6 12 20 12 20z" },
  // 星
  { color: "#E8A21A", d: "M12 3.5l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.8l-5 2.9 1.2-5.6L4 9.3l5.6-.6z" },
  // ボール
  { color: "#2F6FC2", d: "M12 4a8 8 0 1 0 .1 0zM4.6 9.6c4.6 1.6 10.2 1.6 14.8 0M4.6 14.4c4.6-1.6 10.2-1.6 14.8 0" },
  // おさかな
  { color: "#2F6FC2", d: "M3.5 12c3-4.4 9-5 13.2 0-4.2 5-10.2 4.4-13.2 0zM16.7 12l4-3.4v6.8zM8 11.2v.1" },
  // お花
  { color: "#D9467A", d: "M12 9.6a2.6 2.6 0 1 0 .1 0zM12 4.4a2.6 2.6 0 0 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM12 14.6a2.6 2.6 0 0 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM6.9 9.5a2.6 2.6 0 0 1 4.6 2.4 2.6 2.6 0 0 1-4.6-2.4zM12.5 12.1a2.6 2.6 0 0 1 4.6 2.4 2.6 2.6 0 0 1-4.6-2.4z" },
  // おうち
  { color: "#2E9A5A", d: "M4.5 11.5L12 5l7.5 6.5M6.5 10v9h11v-9M10.5 19v-4.5h3V19" },
  // おひさま
  { color: "#F08A1C", d: "M12 8.4a3.6 3.6 0 1 0 .1 0zM12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" },
  // 足あと（てんてん）
  { color: "#3A3F47", fill: true, d: "M5 17a1.6 1.6 0 1 0 .1 0zM9.6 13.4a1.6 1.6 0 1 0 .1 0zM14.4 10.6a1.6 1.6 0 1 0 .1 0zM19 7a1.6 1.6 0 1 0 .1 0z" },
];

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** らくがきの中身を決めるもの（部屋の画面からわたす。なければ見本のらくがき） */
export type DoodleInfo = { now: Date; weather: string | null; steps: number | null | undefined; dogName: string };
export const DoodleContext = createContext<DoodleInfo | null>(null);

/**
 * きょうのらくがき：わんこが毎朝1つずつ描きたしていく（月曜の朝に消して、また1つから。日曜には7つ）と、きょうのひとこと。
 * 週のあいだは描く順番が同じで、週ごとに変わる。
 */
function doodlesOf(info: DoodleInfo | null) {
  if (!info) return { day: "sample", shown: [DOODLES[0]!, DOODLES[2]!, DOODLES[3]!], note: "らくがき OK！" };
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(info.now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  const nth = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1 || 1;
  const monday = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")) - (nth - 1))).toISOString().slice(0, 10);
  const shown = DOODLES.map((d, i) => ({ d, k: hash(`${monday}:${i}`) })).sort((a, b) => a.k - b.k).map((x) => x.d).slice(0, nth);
  const w = info.weather, wet = w === "rain" || w === "drizzle" || w === "thunder";
  const notes = [
    nth === 1 ? "ぴかぴかの ボード！" : null,
    wet ? "あめ… おうちで あそぼ" : w === "snow" ? "ゆき！ ゆき！" : w === "clear" ? "おさんぽ びより！" : null,
    info.steps && info.steps >= 5000 ? `${info.steps.toLocaleString()}ほ あるいた！` : null,
    "ごしゅじん だいすき", "おやつ まだかな", `きょうも いいこの ${[...info.dogName].slice(0, 5).join("")}`, "あした どこいく？",
  ].filter((x): x is string => Boolean(x));
  return { day, shown, note: notes[nth === 1 ? 0 : hash(day) % notes.length]! };
}

/**
 * ホワイトボードの面に描く、らくがき（SVG の g。面の左上 x, y・幅 w・高さ h に合わせる）。
 * drawing のときは、いちばん新しい絵をマーカーで描いているところ。
 */
export function WhiteboardDoodles({ x, y, w, h, drawing = false }: { x: number; y: number; w: number; h: number; drawing?: boolean }) {
  const info = useContext(DoodleContext);
  const { day, shown, note } = doodlesOf(info);
  const size = Math.min(w / 4.6, h / 2.6), cols = Math.max(1, Math.floor(w / (size * 1.05)));
  const top = y + h * 0.36;
  const spot = (i: number) => ({ cx: x + (i % cols + 0.5) * (w / cols) + ((hash(`${day}x${i}`) % 7) - 3), cy: top + Math.floor(i / cols) * size * 1.02 + ((hash(`${day}y${i}`) % 5) - 2) });
  const last = shown.length - 1, pen = spot(last);
  return (
    <g>
      <text x={x + 3} y={y + h * 0.24} fontSize={Math.min(13, w / note.length * 1.5)} fontWeight="800" fill="#2F6FC2" transform={`rotate(-3 ${x + 3} ${y + h * 0.24})`}>{note}</text>
      {shown.map((dd, i) => {
        const p = spot(i), s = size / 24;
        return (
          <g key={`${day}-${i}`} transform={`translate(${p.cx - size / 2} ${p.cy - size / 2}) rotate(${(hash(`${day}${i}`) % 21) - 10} ${size / 2} ${size / 2}) scale(${s})`}>
            <path d={dd.d} pathLength={1} className={drawing && i === last ? "room-draw" : undefined} fill={dd.fill ? dd.color : "none"} fillOpacity={dd.fill ? 0.85 : 0} stroke={dd.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
      {drawing ? (
        // 描いているマーカー（青。くるくる動く）
        <g className="room-pen" style={{ transformOrigin: `${pen.cx}px ${pen.cy}px` }}>
          <g transform={`translate(${pen.cx + size * 0.25} ${pen.cy - size * 0.1}) rotate(35)`}>
            <rect x="-2.6" y="-18" width="5.2" height="16" rx="2" fill="#F4F6F8" stroke="#9AA1AB" strokeWidth="0.6" />
            <rect x="-2.8" y="-22" width="5.6" height="6" rx="2" fill="#2F6FC2" />
            <path d="M-1.6 -2 L0 2 L1.6 -2 Z" fill="#2F6FC2" />
          </g>
        </g>
      ) : null}
    </g>
  );
}

/* ---------- わんこの日記帳 ---------- */

const DIARY_EXTRA = [
  "ばんごはんは カリカリ。おいしかった。",
  "ボールを ソファのしたに いれちゃった。ないしょ。",
  "ゆめで おっきな ほねを みた。",
  "ごしゅじんが「いいこ」って いった。うれしい。",
  "まどのそとに ねこが いた。…まけないぞ。",
  "おふろは きらい。でも ふわふわに なった。",
  "しらない いぬと あいさつした。いいにおい だった。",
];
const WEEK_JA = ["日", "月", "火", "水", "木", "金", "土"];

function diaryText(steps: number, before: number | null, date: string) {
  const n = steps.toLocaleString();
  const main = steps <= 0 ? "おさんぽ なし。ずっと ごろごろ してた。たまには いいよね。"
    : steps < 2000 ? `ちょっとだけ おさんぽ。${n}ほ。もっと あるきたかったな…`
      : steps < 5000 ? `${n}ほ あるいた。こうえんの においを いっぱい かいだ。`
        : steps < 8000 ? `${n}ほ！ ごしゅじんと たくさん あるいた。きもちよかった。`
          : steps < 12000 ? `${n}ほも あるいた！ ごしゅじん、さかで へばってた。ぼくは へいき。`
            : `${n}ほ！？ あしが ぼうに なりそう。ごしゅじん、ねちゃった。`;
  const diff = before !== null && steps > before && before > 0 ? `まえのひより ${(steps - before).toLocaleString()}ほ おおい！ えらい！` : null;
  return [main, diff, DIARY_EXTRA[hash(date) % DIARY_EXTRA.length]!].filter((x): x is string => Boolean(x));
}

/** 本だなをタップすると開く、わんこ目線の日記（きのうから、さかのぼって読める） */
export function DiaryDialog({ history, today, dogName, onClose }: {
  history: readonly { date: string; steps: number }[];
  /** きょうの日付（YYYY-MM-DD、日本時間）。きょうの分はまだ書いていない */
  today: string;
  dogName: string;
  onClose: () => void;
}) {
  const days = [...history].filter((d) => d.date < today).sort((a, b) => (a.date < b.date ? 1 : -1));
  const [page, setPage] = useState(0);
  const day = days[page];
  const before = day ? days[page + 1]?.steps ?? null : null;
  const label = day ? (() => { const [y, m, d] = day.date.split("-").map(Number); return `${m}がつ${d}にち（${WEEK_JA[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]}）`; })() : "";
  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-[#140f22]/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${dogName}の日記`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="room-bubble relative w-full max-w-sm overflow-hidden rounded-[18px] bg-[#FFFDF6] shadow-2xl">
        {/* 表紙のふち（とじひも）と、罫線のページ */}
        <div className="flex items-center justify-between bg-[#C9895A] px-4 py-2.5 text-white">
          <p className="text-sm font-black tracking-wide">📔 {[...dogName].slice(0, 8).join("")}の にっき</p>
          <button type="button" onClick={onClose} className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold">とじる</button>
        </div>
        <div className="relative min-h-[240px] bg-[repeating-linear-gradient(180deg,#FFFDF6_0_27px,#E9DCC6_27px_28px)] px-5 pb-4 pt-3">
          <span aria-hidden className="absolute bottom-0 left-9 top-0 w-px bg-[#F2B8B8]" />
          {day ? (
            <div className="pl-6">
              <p className="text-[15px] font-black leading-[28px] text-[#8A5A30]">{label}</p>
              {diaryText(day.steps, before, day.date).map((t, i) => <p key={i} className="text-[14px] font-bold leading-[28px] text-ink-soft">{t}</p>)}
              <p className="mt-1 text-right text-[13px] font-black leading-[28px] text-[#8A5A30]">🐾 {[...dogName].slice(0, 8).join("")}</p>
            </div>
          ) : (
            <p className="pl-6 text-[14px] font-bold leading-[28px] text-ink-soft">まだ なにも かいてないよ。<br />あした から かくね！</p>
          )}
        </div>
        {days.length > 1 ? (
          <div className="flex items-center justify-between border-t border-[#E9DCC6] px-4 py-2 text-xs font-bold text-[#8A5A30]">
            <button type="button" disabled={page >= days.length - 1} onClick={() => setPage((p) => p + 1)} className="rounded-full px-2 py-1 disabled:opacity-30">← まえのひ</button>
            <span className="text-ink-faint">{page + 1} / {days.length}</span>
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-full px-2 py-1 disabled:opacity-30">つぎのひ →</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- るすばん中のいたずら ---------- */

export type MessKind = "fluff" | "sock" | "kibble" | "tissue" | "slipper";
export type Mess = { id: string; kind: MessKind; x: number; y: number; r: number };
const SEEN_KEY = "odekake-room-seen", MESS_KEY = "odekake-room-mess";
const MESS_KINDS: MessKind[] = ["fluff", "sock", "kibble", "tissue", "slipper"];
const HOUR = 3600_000;

const readStore = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const writeStore = (k: string, v: string | null) => { try { if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch { /* 保存できなくても遊べる */ } };

/**
 * しばらく部屋を開かなかったあいだに、わんこがやった いたずら（床に散らかったもの）。
 * 6時間以上あけると1〜2こ、12時間で2〜3こ、1日以上で4こ。片づけるまで（この端末に）残る。
 */
export function useRoomMess({ enabled, floorTop, floorBottom, blocks }: {
  enabled: boolean; floorTop: number; floorBottom: number;
  /** 家具のあるところ（部屋の %）。散らかすものは、家具の下にもぐらないところに置く */
  blocks: readonly { x0: number; x1: number; y0: number; y1: number }[];
}) {
  const [mess, setMess] = useState<Mess[]>([]);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    let list: Mess[] = [];
    try { const raw = readStore(MESS_KEY); if (raw) list = (JSON.parse(raw) as Mess[]).filter((m) => MESS_KINDS.includes(m.kind)).slice(0, 6); } catch { list = []; }
    const seen = Number(readStore(SEEN_KEY) ?? 0);
    const away = seen > 0 ? now - seen : 0;
    if (!list.length && away >= 6 * HOUR) {
      const n = away >= 24 * HOUR ? 4 : away >= 12 * HOUR ? 2 + Math.round(Math.random()) : 1 + Math.round(Math.random());
      const kinds = [...MESS_KINDS].sort(() => Math.random() - 0.5);
      const free = (x: number, y: number) => !blocksRef.current.some((b) => x > b.x0 - 6 && x < b.x1 + 6 && y > b.y0 - 2 && y < b.y1 + 6)
        && !list.some((m) => Math.abs(m.x - x) < 14 && Math.abs(m.y - y) < 6);
      for (let i = 0; i < n; i++) {
        let x = 0, y = 0;
        for (let k = 0; k < 30; k++) {
          x = 12 + Math.random() * 76; y = floorTop + 6 + Math.random() * (floorBottom - floorTop - 10);
          if (free(x, y)) break;
        }
        list.push({ id: `${now}-${i}`, kind: kinds[i % kinds.length]!, x, y, r: Math.round(Math.random() * 50 - 25) });
      }
      writeStore(MESS_KEY, JSON.stringify(list));
      setFresh(true);
    }
    setMess(list);
    // 見ているあいだは「見ていた時刻」を更新しつづける
    const mark = () => writeStore(SEEN_KEY, String(Date.now()));
    mark();
    const t = window.setInterval(mark, 60_000);
    const onHide = () => { if (document.visibilityState === "hidden") mark(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", onHide); mark(); };
  }, [enabled, floorTop, floorBottom]);
  const clean = (id: string) => setMess((list) => { const next = list.filter((m) => m.id !== id); writeStore(MESS_KEY, next.length ? JSON.stringify(next) : null); return next; });
  return { mess, fresh, clean };
}

/** 散らかったもの1つの絵（viewBox 0 0 60 40） */
function MessArt({ kind }: { kind: MessKind }) {
  switch (kind) {
    case "fluff": return (
      // クッションの綿（ふわふわのかたまりと、ちぎれた布）
      <g>
        <ellipse cx="30" cy="34" rx="24" ry="4" fill="#3A2614" opacity="0.15" />
        {[[18, 26, 9], [30, 22, 11], [42, 27, 8], [25, 30, 7], [37, 31, 7]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" stroke="#E6E1D8" strokeWidth="1" />)}
        <path d="M44 33 l8 -3 l3 4 l-7 3 z" fill="#E98FA8" />
      </g>
    );
    case "sock": return (
      // かたっぽの くつした（よだれで少しぬれている）
      <g>
        <ellipse cx="30" cy="34" rx="20" ry="3.5" fill="#3A2614" opacity="0.15" />
        <path d="M14 14 h16 v12 q0 8 10 8 h6 q4 0 4 -4 q0 -5 -6 -6 h-4 q-4 0 -4 -4 v-6 z" fill="#7FB0E0" transform="rotate(8 30 24)" />
        <path d="M14 14 h16 v4 h-16 z" fill="#FFFFFF" opacity="0.7" transform="rotate(8 30 24)" />
        <path d="M20 22 h8 M20 26 h8" stroke="#5E8FC4" strokeWidth="1.5" transform="rotate(8 30 24)" />
      </g>
    );
    case "kibble": return (
      // こぼれたカリカリ
      <g>
        {[[12, 30], [20, 34], [27, 28], [33, 33], [40, 29], [46, 34], [24, 36], [36, 37], [16, 26], [50, 30]].map(([x, y], i) => (
          <g key={i}><ellipse cx={x} cy={y! + 1.6} rx="3.4" ry="1.2" fill="#3A2614" opacity="0.2" /><ellipse cx={x} cy={y} rx="3.2" ry="2.4" fill={i % 3 ? "#B47A42" : "#9A6232"} /><ellipse cx={x! - 0.8} cy={y! - 0.8} rx="1.2" ry="0.7" fill="#E3B27C" /></g>
        ))}
      </g>
    );
    case "tissue": return (
      // びりびりの ティッシュ
      <g>
        <ellipse cx="30" cy="34" rx="22" ry="3.5" fill="#3A2614" opacity="0.12" />
        {[[14, 28, -20], [26, 24, 15], [38, 30, -8], [46, 24, 30], [22, 33, 40], [33, 35, -35]].map(([x, y, r], i) => (
          <path key={i} d="M-6 -4 l4 -1 l3 2 l5 -1 l0 5 l-3 3 l-6 0 l-3 -3 z" fill="#FFFFFF" stroke="#E4E0EA" strokeWidth="0.8" transform={`translate(${x} ${y}) rotate(${r})`} />
        ))}
      </g>
    );
    default: return (
      // かじられた スリッパ
      <g>
        <ellipse cx="30" cy="34" rx="22" ry="4" fill="#3A2614" opacity="0.15" />
        <path d="M8 28 q0 -10 14 -10 h18 q12 0 12 8 q0 6 -12 6 h-18 q-14 0 -14 -4 z" fill="#F2B8C6" />
        <path d="M22 18 q8 -6 16 0 v8 h-16 z" fill="#E98FA8" />
        {/* かじったあと（ぎざぎざ） */}
        <path d="M46 22 l2 2 l-2 2 l2 2 l-2 2" stroke="#FFFDF6" strokeWidth="2.4" fill="none" />
      </g>
    );
  }
}

/** 床の散らかったもの。タップすると、ぽんっと片づく */
export function RoomMess({ mess, onClean }: { mess: readonly Mess[]; onClean: (m: Mess) => void }) {
  const [poofs, setPoofs] = useState<Mess[]>([]);
  return (
    <>
      {mess.map((m) => (
        <button
          key={m.id} type="button" aria-label="わんこが散らかしたものを片づける"
          className="absolute -translate-x-1/2 -translate-y-full p-0"
          style={{ left: `${m.x}%`, top: `${m.y}%`, width: "15%", zIndex: 300 + Math.round(m.y * 10) }}
          onClick={() => { setPoofs((p) => [...p, m]); window.setTimeout(() => setPoofs((p) => p.filter((x) => x.id !== m.id)), 900); onClean(m); }}
        >
          <svg viewBox="0 0 60 40" className="block h-auto w-full" style={{ transform: `rotate(${m.r * 0.3}deg)` }}><MessArt kind={m.kind} /></svg>
        </button>
      ))}
      {poofs.map((m) => <span key={`p${m.id}`} aria-hidden className="room-wish pointer-events-none absolute text-[20px]" style={{ left: `${m.x}%`, top: `${m.y - 3}%`, zIndex: 2500 }}>✨</span>)}
    </>
  );
}

/* ---------- 部屋がちょっとずつよごれる ---------- */

/** ピカピカでいられる、1日あたりの歩数のめやす */
export const CLEAN_STEPS = 5000;

/**
 * 部屋のよごれぐあい（0 ピカピカ 〜 1 ほこりだらけ）。きょう・きのう・おとといの歩数から決める（きょうがいちばん効く）。
 * きょう CLEAN_STEPS 歩あるけば、すぐピカピカ。
 */
export function roomDirtOf(history: readonly { date: string; steps: number }[], todaySteps: number | null | undefined, today: string): number {
  const t = Math.max(todaySteps ?? 0, history.find((d) => d.date === today)?.steps ?? 0);
  if (t >= CLEAN_STEPS) return 0;
  const before = [...history].filter((d) => d.date < today).sort((a, b) => (a.date < b.date ? 1 : -1));
  const score = t * 0.5 + (before[0]?.steps ?? CLEAN_STEPS) * 0.3 + (before[1]?.steps ?? CLEAN_STEPS) * 0.2;
  return Math.min(1, Math.max(0, 1 - score / CLEAN_STEPS));
}

/** 床のすみのほこり（わたぼこり）と、天井のすみのクモの巣。タップすると、ピカピカにするヒント */
export function RoomDust({ dirt, onTap }: { dirt: number; onTap: () => void }) {
  if (dirt < 0.3) return null;
  const bunnies = [{ x: 9, y: 62, s: 1 }, { x: 90, y: 64, s: 0.85 }, { x: 6, y: 90, s: 1.2 }, { x: 93, y: 88, s: 1 }].slice(0, dirt > 0.75 ? 4 : dirt > 0.55 ? 3 : 2);
  return (
    <>
      {bunnies.map((b, i) => (
        <button key={i} type="button" aria-label="ほこり（おさんぽに行くとピカピカになる）" onClick={onTap}
          className="absolute -translate-x-1/2 -translate-y-full p-0" style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${6 * b.s}%`, zIndex: 300 + Math.round(b.y * 10) }}>
          <svg viewBox="0 0 40 26" className="block h-auto w-full">
            <ellipse cx="20" cy="23" rx="16" ry="3" fill="#3A2614" opacity="0.15" />
            <g fill="#B9B3A6" stroke="#9C9586" strokeWidth="0.6">
              <circle cx="14" cy="15" r="8" /><circle cx="24" cy="13" r="9" /><circle cx="30" cy="18" r="6" /><circle cx="9" cy="19" r="5" />
            </g>
            <path d="M6 12 l-3 -3 M33 10 l3 -4 M20 4 l0 -3 M12 8 l-2 -3" stroke="#9C9586" strokeWidth="0.8" strokeLinecap="round" />
          </svg>
        </button>
      ))}
      {dirt > 0.7 ? (
        // 天井の右のすみのクモの巣
        <svg aria-hidden viewBox="0 0 60 60" className="pointer-events-none absolute right-0 top-0 w-[14%]" style={{ zIndex: 30 }}>
          <g fill="none" stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="0.8">
            {[0, 18, 36, 54, 72, 90].map((a) => <line key={a} x1="60" y1="0" x2={60 - 58 * Math.cos((a * Math.PI) / 180)} y2={58 * Math.sin((a * Math.PI) / 180)} />)}
            {[14, 26, 38, 50].map((r) => <path key={r} d={`M${60 - r} 0 Q${60 - r * 0.75} ${r * 0.75} 60 ${r}`} />)}
          </g>
          <circle cx="40" cy="22" r="2.2" fill="#3A3F47" />
        </svg>
      ) : null}
    </>
  );
}

/* ---------- 観葉植物の水やり ---------- */

const PLANT_KEY = "odekake-room-plant";
export type PlantState = { stage: 0 | 1 | 2 | 3; wilted: boolean; wateredToday: boolean; days: number };
/** 観葉植物の育ちぐあい（つぼみ・花・しおれ）。家具の絵が読む */
export const PlantContext = createContext<PlantState | null>(null);

/**
 * 観葉植物の水やり（この端末に保存）。1日1回あげられる。
 * この1週間で2日あげるとつぼみ、4日で花、6日で満開。3日以上あげないと、しおれる。
 */
export function usePlantCare(today: string) {
  const [dates, setDates] = useState<string[]>([]);
  useEffect(() => {
    try { const raw = JSON.parse(readStore(PLANT_KEY) ?? "[]") as unknown; if (Array.isArray(raw)) setDates(raw.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-14)); } catch { /* 読めなければ、まだあげていない */ }
  }, []);
  const dayNo = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000;
  const t = dayNo(today);
  const week = dates.filter((d) => t - dayNo(d) < 7 && t - dayNo(d) >= 0).length;
  const last = dates.length ? Math.max(...dates.map(dayNo)) : null;
  const state: PlantState = {
    stage: week >= 6 ? 3 : week >= 4 ? 2 : week >= 2 ? 1 : 0,
    wilted: last !== null && t - last >= 3,
    wateredToday: dates.includes(today),
    days: week,
  };
  const water = () => {
    if (dates.includes(today)) return false;
    const next = [...dates, today].slice(-14);
    setDates(next);
    writeStore(PLANT_KEY, JSON.stringify(next));
    return true;
  };
  return { plant: state, water };
}

/* ---------- わんこのお泊まり会 ---------- */

/**
 * 週に1回（土曜の夕方〜日曜の朝）、フレンドのわんこが泊まりにくる。だれが来るかは週ごとに決まる。
 * 夕方はラグの近くで遊び、夜は自分のわんこのとなりで寝る。タップすると、そのフレンドのおへやへ。
 */
export function sleepoverGuest(now: Date, friends: readonly { id: string; name: string }[]): { id: string; name: string; skin: (typeof DOG_SKIN_IDS)[number] } | null {
  if (!friends.length) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  const wd = get("weekday"), h = Number(get("hour"));
  const on = (wd === "Sat" && h >= 17) || (wd === "Sun" && h < 9);
  if (!on) return null;
  // 土曜の日付で、その週のお客さんを決める
  const sat = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")) - (wd === "Sun" ? 1 : 0))).toISOString().slice(0, 10);
  const f = friends[hash(sat) % friends.length]!;
  return { ...f, skin: DOG_SKIN_IDS[hash(f.id) % DOG_SKIN_IDS.length]! };
}

export function GuestDog({ guest, sleeping, onTap }: { guest: { id: string; name: string; skin: (typeof DOG_SKIN_IDS)[number] }; sleeping: boolean; onTap: () => void }) {
  // 起きているあいだは、ときどきポーズを変える
  const [pose, setPose] = useState("sit");
  useEffect(() => {
    if (sleeping) return;
    const poses = ["sit", "smile", "sit-side", "wonder", "stand-happy", "sniff"];
    const t = window.setInterval(() => setPose(poses[Math.floor(Math.random() * poses.length)]!), 3800);
    return () => window.clearInterval(t);
  }, [sleeping]);
  const x = 64, y = sleeping ? 81 : 78;
  const name = [...guest.name].slice(0, 6).join("");
  return (
    <>
      <button type="button" onClick={onTap} aria-label={`${name}さんのわんこが おとまりに来ています（タップで${name}さんのおへやへ）`}
        className="absolute block -translate-x-1/2 -translate-y-full p-0" style={{ left: `${x}%`, top: `${y}%`, width: "22%", zIndex: 300 + Math.round(y * 10) }}>
        <span className="pointer-events-none absolute bottom-[3%] left-1/2 h-[12%] w-[62%] -translate-x-1/2 rounded-[50%] bg-[#4a3520]/20 blur-[2px]" />
        <span className={`block ${sleeping ? "room-dog-sleep" : "room-dog-idle"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getFrenchieSrc(guest.skin, sleeping ? "sleep" : pose)} alt="" draggable={false} className="block h-auto w-full select-none" style={{ transform: "scaleX(-1)" }} />
        </span>
      </button>
      {/* 名前の札と Zzz（夜の暗さより上に） */}
      <div className="pointer-events-none absolute -translate-x-1/2" style={{ left: `${x}%`, top: `${y - 17}%`, zIndex: 2500 }}>
        <span className="whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-leaf-deep shadow-sm">{name}さんちの わんこ</span>
        {sleeping ? <span className="absolute -right-4 top-4 animate-pulse text-[11px] font-black text-[#8A8FD8]">Zzz</span> : null}
      </div>
    </>
  );
}
