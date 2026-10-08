"use client";

import { useState } from "react";
import { RARITY_STYLES, type GachaRarity } from "@/lib/gacha/config";

export type GuideSkillRow = {
  id: string;
  name: string;
  image: string | null;
  rarity: GachaRarity;
  title: string | null;
  levels: string[] | null;
  /** 持っている数（0 は未所持） */
  count: number;
  /** いまのスキルLv（0 は未所持・スキルなし） */
  level: number;
  /** 限界突破の★（Lv5 のあとに引いたぶん） */
  stars: number;
  /** ★でのびた、いまの強さ（★が無いときは null） */
  starText: string | null;
};

/** zukan はこの県の図鑑ボーナス（すべての得点にかかる倍率） */
export type GuidePref = { id: string; name: string; accent: string; rows: GuideSkillRow[]; zukan: number };

/** 県ごとのスキル一覧（タブで切りかえ） */
export function PinballSkillTabs({ prefs }: { prefs: GuidePref[] }) {
  const firstOwned = prefs.find((p) => p.rows.some((r) => r.count > 0))?.id ?? prefs[0]?.id ?? "";
  const [active, setActive] = useState(firstOwned);
  const pref = prefs.find((p) => p.id === active) ?? prefs[0];
  if (!pref) return null;
  const owned = pref.rows.filter((r) => r.count > 0).length;
  return (
    <div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="都道府県">
        {prefs.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === active}
            onClick={() => setActive(p.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black ${p.id === active ? "border-transparent text-black" : "border-white/15 bg-white/5 text-white/70"}`}
            style={p.id === active ? { background: p.accent } : undefined}
          >
            {p.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] font-bold text-white/50">
        持っている {owned} / {pref.rows.length} 種
        {pref.zukan > 1 ? <b className="ml-1 text-[#ffe08a]">図鑑ボーナス ×{pref.zukan.toFixed(2)}</b> : null}
        <span className="block">スキルLvは図鑑と同じ（同じアイテムを集めるほど上がる）。Lv5で覚醒、そのあとは★</span>
      </p>
      <ul className="mt-2 space-y-2">
        {pref.rows.map((row) => (
          <li key={row.id} className={`rounded-2xl border p-3 ${row.count > 0 ? "border-white/15 bg-white/[0.06]" : "border-white/5 bg-white/[0.02] opacity-60"}`}>
            <div className="flex items-center gap-2.5">
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/90">
                {row.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.image} alt="" className={`h-full w-full object-cover ${row.count > 0 ? "" : "grayscale"}`} loading="lazy" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={`rounded px-1.5 py-px text-[9px] font-black ${RARITY_STYLES[row.rarity].badge}`}>{row.rarity}</span>
                  <span className="truncate text-[13px] font-black text-white">{row.name}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-bold" style={{ color: pref.accent }}>
                  {row.title ?? "スキルなし（集めると得点）"}
                </span>
              </span>
              <span className="shrink-0 text-right text-[10px] font-black text-white/70">
                {row.count > 0 ? (row.level > 0 ? (row.level >= 5 ? "Lv.MAX" : `Lv${row.level}`) : `${row.count}こ`) : "未所持"}
                {row.stars > 0 ? <span className="block text-[#ffe08a]">{"★".repeat(row.stars)}</span> : null}
              </span>
            </div>
            {row.levels ? (
              <ol className="mt-2 grid grid-cols-1 gap-1">
                {row.levels.map((text, i) => {
                  const on = row.level === i + 1;
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-2 rounded-xl px-2 py-1 text-[10.5px] font-bold ${on ? "text-black" : "bg-black/20 text-white/70"}`}
                      style={on ? { background: pref.accent } : undefined}
                    >
                      <span className="w-9 shrink-0 font-black">{i === 4 ? "覚醒" : `Lv${i + 1}`}</span>
                      <span className="min-w-0">{text}</span>
                    </li>
                  );
                })}
              </ol>
            ) : null}
            {row.starText ? (
              <p className="mt-1 rounded-xl border border-[#ffe08a]/40 bg-[#ffe08a]/10 px-2 py-1 text-[10.5px] font-bold text-[#ffe08a]">
                {"★".repeat(row.stars)} いまの強さ：{row.starText}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
