"use client";

/**
 * わんこの気分メーター（部屋の左上の小さなメーターと、タップで開く くわしい画面）。
 * なでた回数・いっしょに遊んだ回数は、この端末に「きょうの分」だけ残す（useMoodCounters）。
 */
import { useCallback, useEffect, useState } from "react";
import { MOOD_LEVELS, moodTip, type Mood, type MoodLevel } from "@/lib/room/mood";

/** きょうの なでた回数・遊んだ回数（この端末に、日付ごとに残す） */
export function useMoodCounters(owner: string, today: string) {
  const key = `odekake-room-mood:${owner}:${today}`;
  const [c, setC] = useState({ pets: 0, plays: 0 });
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(key) ?? "null") as { pets?: number; plays?: number } | null;
      setC({ pets: Math.max(0, Number(raw?.pets) || 0), plays: Math.max(0, Number(raw?.plays) || 0) });
    } catch { setC({ pets: 0, plays: 0 }); }
  }, [key]);
  const bump = useCallback((k: "pets" | "plays") => {
    setC((cur) => {
      const next = { ...cur, [k]: Math.min(99, cur[k] + 1) };
      try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* 残せなくても、いまは上がる */ }
      return next;
    });
  }, [key]);
  return { ...c, addPet: useCallback(() => bump("pets"), [bump]), addPlay: useCallback(() => bump("plays"), [bump]) };
}

/** 気分ごとの わんこ（フレブル）の顔。大きな立ち耳・ひだりめのまわりのぶち・目と口で表す。まわりの輪は気分の色 */
export function MoodFace({ level, size = 28 }: { level: MoodLevel; size?: number }) {
  const c = MOOD_LEVELS[level].color;
  const droop = level === "lonely";
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="block shrink-0">
      <circle cx="20" cy="20" r="19" fill={c} opacity="0.22" />
      {/* コウモリのような立ち耳（さみしいときは少し たれる） */}
      <g transform={droop ? "rotate(-14 11 15)" : undefined}>
        <path d="M10.5 15 C 5.5 13 4 5 6.5 3.4 C 9 2 13.6 7 15 12 Z" fill="#F6EFE4" stroke="#6E5A48" strokeWidth="1" strokeLinejoin="round" />
        <path d="M10.6 13 C 7.6 11.6 7 7 8.2 6 C 9.6 5.4 12 8.6 12.8 11.4 Z" fill="#F4B4C0" />
      </g>
      <g transform={droop ? "rotate(14 29 15)" : undefined}>
        <path d="M29.5 15 C 34.5 13 36 5 33.5 3.4 C 31 2 26.4 7 25 12 Z" fill="#F6EFE4" stroke="#6E5A48" strokeWidth="1" strokeLinejoin="round" />
        <path d="M29.4 13 C 32.4 11.6 33 7 31.8 6 C 30.4 5.4 28 8.6 27.2 11.4 Z" fill="#F4B4C0" />
      </g>
      {/* 横に広いまるい顔 */}
      <ellipse cx="20" cy="23" rx="14.6" ry="12.6" fill="#F6EFE4" stroke="#6E5A48" strokeWidth="1" />
      {/* ひだりめの ぶち */}
      <ellipse cx="13.4" cy="20.6" rx="5.4" ry="4.6" fill="#8A8480" opacity="0.85" />
      {/* 目 */}
      {level === "lonely" ? (
        <g stroke="#2E2420" strokeWidth="1.6" strokeLinecap="round" fill="none"><path d="M11 21.6 q2.4 1.4 4.8 0" /><path d="M24.2 21.6 q2.4 1.4 4.8 0" /><path d="M28.6 24 q0.8 2.4 0 3.4" stroke="#7FC8F2" /></g>
      ) : level === "super" ? (
        <g stroke="#2E2420" strokeWidth="1.6" strokeLinecap="round" fill="none"><path d="M11 22 q2.4 -3.4 4.8 0" /><path d="M24.2 22 q2.4 -3.4 4.8 0" /></g>
      ) : (
        <g><circle cx="13.4" cy="21" r="2.2" fill="#2E2420" /><circle cx="26.6" cy="21" r="2.2" fill="#2E2420" /><circle cx="14.1" cy="20.3" r="0.7" fill="#FFFFFF" /><circle cx="27.3" cy="20.3" r="0.7" fill="#FFFFFF" /></g>
      )}
      {/* はなすじのしわ・はな */}
      <path d="M17.6 23.4 q2.4 -1 4.8 0" stroke="#B8A898" strokeWidth="0.8" fill="none" />
      <ellipse cx="20" cy="26" rx="2.8" ry="1.9" fill="#2E2420" />
      <ellipse cx="19.2" cy="25.4" rx="0.8" ry="0.5" fill="#FFFFFF" opacity="0.6" />
      {/* 口 */}
      {level === "lonely" ? <path d="M16.6 32 q3.4 -2.4 6.8 0" stroke="#2E2420" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        : level === "normal" ? <path d="M16.4 29.4 q1.8 1.8 3.6 0 q1.8 1.8 3.6 0" stroke="#2E2420" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          : <g><path d="M16 29 q4 6 8 0 Z" fill="#E8607A" stroke="#2E2420" strokeWidth="1.2" strokeLinejoin="round" /><path d="M18.2 31.4 q1.8 1.6 3.6 0" fill="#F7A0B4" /></g>}
      {/* ほっぺ */}
      {level === "happy" || level === "super" ? <g fill="#F7A0B4" opacity="0.85"><ellipse cx="9.4" cy="27" rx="2.4" ry="1.5" /><ellipse cx="30.6" cy="27" rx="2.4" ry="1.5" /></g> : null}
      {level === "super" ? <path d="M33 6 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z" fill="#FFD84A" /> : null}
    </svg>
  );
}

/** 部屋の左上の気分メーター（タップで くわしく） */
export function MoodChip({ mood, onOpen, pulse }: { mood: Mood; onOpen: () => void; pulse: number }) {
  const lv = MOOD_LEVELS[mood.level];
  return (
    <button type="button" onClick={onOpen} aria-label={`わんこの気分：${lv.name}（${mood.score}）。タップで くわしく`}
      className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full border border-white/70 bg-card/90 py-1 pl-1 pr-2.5 shadow-md backdrop-blur active:scale-95" style={{ zIndex: 2650 }}>
      <span key={pulse} className={pulse ? "room-heart-pop" : undefined}><MoodFace level={mood.level} size={26} /></span>
      <span className="flex flex-col items-start leading-none">
        <span className="text-[10px] font-black" style={{ color: lv.color }}>{lv.name}</span>
        <span className="mt-1 block h-1.5 w-14 overflow-hidden rounded-full bg-paper-deep">
          <span className="block h-full rounded-full transition-[width,background-color] duration-700" style={{ width: `${mood.score}%`, backgroundColor: lv.color }} />
        </span>
      </span>
    </button>
  );
}

/** くわしい画面：いまの気分・内訳・あと何をすると上がるか */
export function MoodSheet({ mood, dogName, onClose }: { mood: Mood; dogName: string; onClose: () => void }) {
  const lv = MOOD_LEVELS[mood.level];
  return (
    <div className="fixed inset-0 z-[790] flex items-end justify-center bg-black/30 px-4 pb-6 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${dogName}の きぶん`} onClick={(e) => e.stopPropagation()} className="room-sv-pop w-full max-w-sm overflow-hidden rounded-[28px] border border-line bg-card shadow-2xl">
        <div className="flex items-center gap-3 px-4 pb-3 pt-4" style={{ background: `linear-gradient(160deg, ${lv.color}33, #FFFFFF00)` }}>
          <MoodFace level={mood.level} size={56} />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-ink-soft">{dogName}の きょうの きぶん</p>
            <p className="text-[20px] font-black leading-tight" style={{ color: lv.color }}>{lv.name}<span className="ml-1.5 text-[13px] text-ink-soft tabular-nums">{mood.score}<span className="text-[10px]"> / 100</span></span></p>
          </div>
        </div>
        <div className="px-4">
          {/* 4つの段階のものさし */}
          <div className="relative mt-1 h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${MOOD_LEVELS.lonely.color} 0 25%, ${MOOD_LEVELS.normal.color} 25% 50%, ${MOOD_LEVELS.happy.color} 50% 75%, ${MOOD_LEVELS.super.color} 75% 100%)` }}>
            <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow" style={{ left: `${mood.score}%`, background: lv.color }} />
          </div>
          <div className="mt-1 grid grid-cols-4 text-center text-[9px] font-bold text-ink-faint">{(["lonely", "normal", "happy", "super"] as const).map((l) => <span key={l}>{MOOD_LEVELS[l].name}</span>)}</div>
          {/* 内訳 */}
          <ul className="mt-3 space-y-1.5">
            {mood.parts.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[11px]">
                <span className="w-[8.5rem] shrink-0 font-bold text-ink-soft">{p.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep"><span className="block h-full rounded-full bg-leaf" style={{ width: `${(p.value / p.max) * 100}%` }} /></span>
                <span className="w-10 shrink-0 text-right font-black tabular-nums text-ink">{p.value}<span className="text-[9px] text-ink-faint">/{p.max}</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-2xl bg-paper-deep px-3 py-2 text-[11px] font-bold leading-relaxed text-ink-soft">💡 {moodTip(mood)}</p>
          <p className="mt-2 text-[9.5px] font-semibold leading-relaxed text-ink-faint">きぶんで わんこの ようすが かわります（さみしいと 窓のそばで まっている・るんるんだと おどりだす）。なでた回数・あそんだ回数は 毎日 0 から。</p>
        </div>
        <div className="px-4 pb-4 pt-3">
          <button type="button" onClick={onClose} className="w-full rounded-full bg-leaf-deep py-3 text-xs font-black text-white active:scale-95">とじる</button>
        </div>
      </div>
    </div>
  );
}
