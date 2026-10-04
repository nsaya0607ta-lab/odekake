"use client";

/**
 * わんこの気分メーター（お天気カードの下の気分カードと、タップで開く くわしい画面）。
 * なでた回数・いっしょに遊んだ回数は、この端末に「きょうの分」だけ残す（useMoodCounters）。
 */
import { useCallback, useEffect, useState } from "react";
import { getFrenchieSrc, type DogSkinId } from "@/lib/dog-skins";
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

/** 気分ごとの わんこのポーズ（じぶんのわんこの きせかえの絵を使う） */
const MOOD_POSE: Record<MoodLevel, string> = { lonely: "lie", normal: "sit", happy: "smile", super: "cheer" };

/** 気分ごとの わんこ（フレブルの絵）。まわりの まるは気分の色 */
export function MoodDog({ level, skin, size = 40 }: { level: MoodLevel; skin: DogSkinId; size?: number }) {
  const c = MOOD_LEVELS[level].color;
  return (
    <span aria-hidden className="relative block shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size, background: `radial-gradient(circle at 50% 62%, #FFFFFF 0 38%, ${c}55 70%, ${c}88 100%)`, boxShadow: `inset 0 0 0 2px ${c}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getFrenchieSrc(skin, MOOD_POSE[level])} alt="" draggable={false} className={`absolute left-1/2 block h-auto max-w-none -translate-x-1/2 select-none ${level === "lonely" ? "bottom-[14%] w-[96%]" : "bottom-[2%] w-[84%]"}`} />
    </span>
  );
}

/** お天気カードの下の、わんこの気分カード（タップで くわしく） */
export function MoodCard({ mood, skin, dogName, onOpen, pulse }: { mood: Mood; skin: DogSkinId; dogName: string; onOpen: () => void; pulse: number }) {
  const lv = MOOD_LEVELS[mood.level];
  return (
    <button type="button" onClick={onOpen} aria-haspopup="dialog" aria-label={`${dogName}の きぶん：${lv.name}（${mood.score}）。タップで くわしく`}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left shadow-sm active:scale-[.98]">
      <span key={pulse} className={pulse ? "room-heart-pop" : undefined}><MoodDog level={mood.level} skin={skin} size={44} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold text-ink-faint">{dogName}の きょうの きぶん</span>
        <span className="mt-0.5 flex items-baseline gap-1.5 leading-none">
          <span className="text-[18px] font-black" style={{ color: lv.color }}>{lv.name}</span>
          <span className="text-[11px] font-black tabular-nums text-ink-soft">{mood.score}<span className="text-[9px] text-ink-faint"> / 100</span></span>
        </span>
        <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-paper-deep">
          <span className="block h-full rounded-full transition-[width,background-color] duration-700" style={{ width: `${mood.score}%`, backgroundColor: lv.color }} />
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-[18px] font-black text-ink-faint">›</span>
    </button>
  );
}

/** くわしい画面：いまの気分・内訳・あと何をすると上がるか */
export function MoodSheet({ mood, skin, dogName, onClose }: { mood: Mood; skin: DogSkinId; dogName: string; onClose: () => void }) {
  const lv = MOOD_LEVELS[mood.level];
  return (
    <div className="fixed inset-0 z-[790] flex items-end justify-center bg-black/30 px-4 pb-6 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${dogName}の きぶん`} onClick={(e) => e.stopPropagation()} className="room-sv-pop w-full max-w-sm overflow-hidden rounded-[28px] border border-line bg-card shadow-2xl">
        <div className="flex items-center gap-3 px-4 pb-3 pt-4" style={{ background: `linear-gradient(160deg, ${lv.color}33, #FFFFFF00)` }}>
          <MoodDog level={mood.level} skin={skin} size={64} />
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
