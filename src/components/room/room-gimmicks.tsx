"use client";

/**
 * わんこのおへや：ちょっとしたしかけ。
 * - 流れ星：晴れた夜、ときどき窓の外を流れ星が横切る。消えるまでにタップすると、ねがいごとができる。
 * - 窓の外を通る犬：昼間、おさんぽ中の犬がときどき窓の外を通る。きょうたくさん歩いた日ほど、よく通る。
 *   ときどきフレンドの犬も通り、タップするとその部屋にあそびに行ける。
 */
import { useEffect, useState } from "react";
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

/* ---------- 黒板のらくがき ---------- */

/** チョークで描く小さな絵（24×24） */
const DOODLES: { color: string; d: string; fill?: boolean }[] = [
  // 肉球
  { color: "#F4F1E6", fill: true, d: "M12 21c-3.6 0-6-1.8-6-4.2 0-2.6 2.8-4.6 6-4.6s6 2 6 4.6c0 2.4-2.4 4.2-6 4.2zM5.4 11.2a2 2.4 0 1 0 0.1 0zM9.6 7.6a2 2.4 0 1 0 0.1 0zM14.4 7.6a2 2.4 0 1 0 0.1 0zM18.6 11.2a2 2.4 0 1 0 0.1 0z" },
  // ほね
  { color: "#F4F1E6", d: "M6 9a2.6 2.6 0 1 1 3-3l6 6a2.6 2.6 0 1 1 3 3 2.6 2.6 0 1 1-3 3l-6-6a2.6 2.6 0 1 1-3-3z" },
  // ハート
  { color: "#FFB4C8", d: "M12 20s-7-4.4-7-9.4A3.8 3.8 0 0 1 12 8.4a3.8 3.8 0 0 1 7 2.2C19 15.6 12 20 12 20z" },
  // 星
  { color: "#FFF1A8", d: "M12 3.5l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.8l-5 2.9 1.2-5.6L4 9.3l5.6-.6z" },
  // ボール
  { color: "#BDE3FF", d: "M12 4a8 8 0 1 0 .1 0zM4.6 9.6c4.6 1.6 10.2 1.6 14.8 0M4.6 14.4c4.6-1.6 10.2-1.6 14.8 0" },
  // おさかな
  { color: "#BDE3FF", d: "M3.5 12c3-4.4 9-5 13.2 0-4.2 5-10.2 4.4-13.2 0zM16.7 12l4-3.4v6.8zM8 11.2v.1" },
  // お花
  { color: "#FFC4D2", d: "M12 9.6a2.6 2.6 0 1 0 .1 0zM12 4.4a2.6 2.6 0 0 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM12 14.6a2.6 2.6 0 0 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM6.9 9.5a2.6 2.6 0 0 1 4.6 2.4 2.6 2.6 0 0 1-4.6-2.4zM12.5 12.1a2.6 2.6 0 0 1 4.6 2.4 2.6 2.6 0 0 1-4.6-2.4z" },
  // おうち
  { color: "#F4F1E6", d: "M4.5 11.5L12 5l7.5 6.5M6.5 10v9h11v-9M10.5 19v-4.5h3V19" },
  // おひさま
  { color: "#FFE08A", d: "M12 8.4a3.6 3.6 0 1 0 .1 0zM12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" },
  // 足あと（てんてん）
  { color: "#F4F1E6", fill: true, d: "M5 17a1.6 1.6 0 1 0 .1 0zM9.6 13.4a1.6 1.6 0 1 0 .1 0zM14.4 10.6a1.6 1.6 0 1 0 .1 0zM19 7a1.6 1.6 0 1 0 .1 0z" },
];

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/**
 * カードの下の黒板に、わんこが毎朝ひとつずつ描きたしていく らくがき。
 * 月曜の朝に黒板けしで消して、また1つから（日曜には7つ）。横には、きょうの ひとこと。
 */
export function ChalkDoodles({ now, weather, steps, dogName }: { now: Date; weather: string | null; steps: number | null | undefined; dogName: string }) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  const nth = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1 || 1;
  // その週の月曜の日付で、描く順番を決める（週のあいだは同じ順で、1日1つずつふえる）
  const monday = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")) - (nth - 1)));
  const order = DOODLES.map((d, i) => ({ d, k: hash(`${monday.toISOString().slice(0, 10)}:${i}`) })).sort((a, b) => a.k - b.k).map((x) => x.d);
  const shown = order.slice(0, nth);

  const wet = weather === "rain" || weather === "drizzle" || weather === "thunder";
  const notes = [
    nth === 1 ? "ぴかぴかの こくばん！" : null,
    wet ? "あめ… おうちで あそぼ" : weather === "snow" ? "ゆき！ ゆき！" : weather === "clear" ? "おさんぽ びより！" : null,
    steps && steps >= 5000 ? `${steps.toLocaleString()}ほ あるいた！` : null,
    "ごしゅじん だいすき", "おやつ まだかな", `きょうも いいこの ${[...dogName].slice(0, 6).join("")}`, "あした どこいく？",
  ].filter((x): x is string => Boolean(x));
  const note = notes[nth === 1 ? 0 : hash(day) % notes.length]!;

  return (
    <svg viewBox="0 0 320 36" preserveAspectRatio="xMidYMid meet" className="block h-full w-full overflow-visible">
      <defs>
        {/* チョークのかすれ（線のふちをざらつかせる） */}
        <filter id="chalk-rough" x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" result="d" />
          <feComposite in="d" in2="n" operator="in" />
        </filter>
      </defs>
      <g filter="url(#chalk-rough)">
        <text x="6" y="23" fontSize="12.5" fontWeight="800" fill="#F4F1E6" fillOpacity="0.88" transform="rotate(-2 6 23)" letterSpacing="0.5">{note}</text>
        {shown.map((dd, i) => (
          <g key={i} transform={`translate(${314 - (shown.length - i) * 24} ${6 + (i % 2) * 2}) rotate(${(hash(`${day}${i}`) % 21) - 10} 12 12) scale(0.92)`}>
            <path d={dd.d} fill={dd.fill ? dd.color : "none"} fillOpacity={dd.fill ? 0.75 : 0} stroke={dd.color} strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </g>
    </svg>
  );
}
