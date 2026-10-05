"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HomeLiveRefresh } from "@/components/home-live-refresh";
import { LEVEL_BANNER, LEVEL_BOARD, LEVEL_PANEL, SIGN_TEXT } from "@/components/home-scene";
import { LEVEL_REWARDS, type ExpProgress, type RewardKind } from "@/lib/exp";

/**
 * 背景の絵に描かれている上の看板へ、おでかけレベルを書き込む。
 * 位置は home-scene.tsx の実測値に合わせてあるので、勝手にずらさない。
 *
 * 板の面は「レベル・あと何EXP・バー」の3行でちょうど埋まる。次のごほうびや EXP のもらい方は、
 * 板をタップして開く「くわしい画面」（LevelSheet）に置いている。
 * 高さを持つ行に shrink-0 が要る。付け忘れると flex が縮めて EXPバーが消える。
 */
export function LevelTag({ progress }: { progress: ExpProgress }) {
  const [open, setOpen] = useState(false);
  const toNext = Math.max(0, progress.nextLevelExp - progress.totalExp);
  // もうすぐレベルアップ（85%以上）のときは、バーを金色にして知らせる
  const almost = progress.progressPercent >= 85;
  return (
    <>
      <HomeLiveRefresh />
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`おでかけレベル ${progress.level}。次のレベルまで あと${toNext}EXP。くわしく見る`}
        className="absolute z-10 block text-left active:scale-[0.98]"
        style={LEVEL_BOARD}
      >
        <span className="absolute flex items-center justify-center" style={LEVEL_BANNER}>
          <span
            className="whitespace-nowrap leading-none font-bold tracking-[0.04em] text-white"
            style={{ fontSize: SIGN_TEXT.banner }}
          >
            おでかけレベル
          </span>
        </span>

        <span className="absolute flex flex-col justify-center" style={LEVEL_PANEL}>
          {/* レベル：木に焼き付けたような金色の数字 */}
          <span className="flex shrink-0 items-end justify-center gap-1 leading-none">
            <span className="pb-px font-semibold text-[#7a6449]" style={{ fontSize: SIGN_TEXT.unit }}>
              Lv.
            </span>
            <span
              className="bg-[linear-gradient(180deg,#C8862A_0%,#8A5418_55%,#5E3A12_100%)] bg-clip-text font-black tabular-nums text-transparent [filter:drop-shadow(0_0.5px_0_rgba(255,240,200,.9))]"
              style={{ fontSize: SIGN_TEXT.level }}
            >
              {progress.level}
            </span>
          </span>

          {/* 次のレベルまで、あと何EXPか（累計より、こっちのほうが目安になる） */}
          <span
            className="mt-px flex w-full shrink-0 items-center justify-between gap-1 leading-none text-[#7a6449]"
            style={{ fontSize: SIGN_TEXT.small }}
          >
            <span className="font-bold">つぎまで</span>
            <span className="min-w-0 truncate font-bold tabular-nums text-[#5b4a35]">
              あと{toNext.toLocaleString("ja-JP")}
              <span className="font-semibold text-[#8b7355]">EXP</span>
            </span>
          </span>
          <span
            className="mt-px block h-[4px] w-full shrink-0 overflow-hidden rounded-full bg-[#bb9463]/40 shadow-[inset_0_0.5px_1px_rgba(90,60,30,.35)]"
            aria-hidden="true"
          >
            <span
              className={`home-shine block h-full rounded-full transition-[width] duration-700 ${
                almost ? "bg-[linear-gradient(90deg,#F2C14E,#E59A1E)]" : "bg-[linear-gradient(90deg,#9BD07A,#4E8A3E)]"
              }`}
              style={{ width: `${Math.max(4, progress.progressPercent)}%` }}
            />
          </span>
        </span>
      </button>
      {open ? <LevelSheet progress={progress} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const KIND_LABEL: Record<RewardKind, string> = {
  motion: "しぐさ",
  expression: "表情",
  accessory: "アクセサリー",
  room: "おへや",
  title: "称号",
};

/** レベルのくわしい画面：いまのレベル・次のごほうび・これからのごほうび・EXPのもらい方 */
function LevelSheet({ progress, onClose }: { progress: ExpProgress; onClose: () => void }) {
  const toNext = Math.max(0, progress.nextLevelExp - progress.totalExp);
  const inLevel = progress.totalExp - progress.currentLevelExp;
  const span = Math.max(1, progress.nextLevelExp - progress.currentLevelExp);
  const upcoming = LEVEL_REWARDS.filter((r) => r.level > progress.level + 1).slice(0, 3);
  const learned = LEVEL_REWARDS.filter((r) => r.level <= progress.level).length;
  const r = 44, c = 2 * Math.PI * r;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[700] flex items-end justify-center bg-[#2a1d10]/45 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`おでかけレベル ${progress.level}`}
        onClick={(e) => e.stopPropagation()}
        className="room-sv-pop w-full max-w-sm overflow-hidden rounded-[28px] border border-[#E6D3AE] bg-[#FFFBF2] shadow-2xl"
      >
        {/* 上：メダルと達成率のリング */}
        <div className="relative flex items-center gap-4 bg-[radial-gradient(120%_90%_at_20%_0%,#FFF1C9,#F7E6C2_45%,#EBD5A6)] px-5 pb-4 pt-5">
          <span className="relative block h-[104px] w-[104px] shrink-0">
            <svg viewBox="0 0 104 104" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx="52" cy="52" r={r} fill="none" stroke="#E2C99A" strokeWidth="7" />
              <circle cx="52" cy="52" r={r} fill="none" stroke="url(#lvring)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${Math.max(0.02, progress.progressPercent / 100) * c} ${c}`} />
              <defs>
                <linearGradient id="lvring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F2C14E" /><stop offset="1" stopColor="#C8862A" /></linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#FFF7DD,#F3D58E_60%,#D9A84A)] shadow-[inset_0_-3px_6px_rgba(140,90,20,.35),0_3px_8px_rgba(120,80,20,.3)]">
              <span className="text-[10px] font-black tracking-[0.1em] text-[#8A5418]">Lv.</span>
              <span className="-mt-0.5 text-[30px] font-black leading-none tabular-nums text-[#5E3A12] [text-shadow:0_1px_0_rgba(255,245,215,.9)]">{progress.level}</span>
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-[0.18em] text-[#A0763A]">ODEKAKE LEVEL</p>
            <p className="mt-0.5 text-[17px] font-black leading-tight text-[#4A3620]">
              あと <span className="tabular-nums text-[#C0661E]">{toNext.toLocaleString("ja-JP")}</span> EXP で
              <br />
              Lv.{progress.level + 1} に アップ！
            </p>
            <p className="mt-1.5 text-[11px] font-bold tabular-nums text-[#8b7355]">
              {inLevel.toLocaleString("ja-JP")} / {span.toLocaleString("ja-JP")} EXP（{Math.floor(progress.progressPercent)}%）
            </p>
            <p className="mt-0.5 text-[10px] font-semibold tabular-nums text-[#A08A6A]">累計 {progress.totalExp.toLocaleString("ja-JP")} EXP</p>
          </div>
        </div>

        <div className="space-y-3 px-4 pb-4 pt-3.5">
          {/* 次のごほうび */}
          <section className="rounded-2xl border border-[#EAD9B6] bg-white/70 px-3.5 py-3">
            <p className="text-[11px] font-black text-[#A0763A]">🎁 つぎの ごほうび</p>
            {progress.nextReward ? (
              <p className="mt-1 text-[14px] font-black text-[#4A3620]">
                Lv.{progress.nextReward.level}で
                <span className="mx-1 rounded-full bg-[#FFF1C9] px-2 py-0.5 text-[#8A5418]">「{progress.nextReward.name}」</span>
                を おぼえる
                <span className="ml-1 align-middle text-[10px] font-bold text-[#A08A6A]">（{KIND_LABEL[progress.nextReward.kind]}）</span>
              </p>
            ) : (
              <p className="mt-1 text-[13px] font-bold text-[#4A3620]">Lv.31からは、レベルアップのたびに コインが もらえる</p>
            )}
            {upcoming.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {upcoming.map((u) => (
                  <li key={u.level} className="flex items-center gap-1 rounded-full border border-[#EAD9B6] bg-[#FBF5E8] px-2 py-0.5 text-[10px] font-bold text-[#8b7355]">
                    <span aria-hidden="true">🔒</span>Lv.{u.level} {u.name}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-[10px] font-semibold text-[#A08A6A]">おぼえた しぐさ・表情：{learned} / {LEVEL_REWARDS.length}</p>
          </section>

          {/* EXP のもらい方 */}
          <section className="rounded-2xl border border-[#EAD9B6] bg-white/70 px-3.5 py-3">
            <p className="text-[11px] font-black text-[#A0763A]">✨ EXP の もらいかた</p>
            <ul className="mt-1.5 space-y-1.5 text-[12px] font-bold text-[#5b4a35]">
              <li className="flex items-start gap-2"><span aria-hidden="true">👣</span><span>おさんぽ：1,000歩から、1日 最大1,000 EXP</span></li>
              <li className="flex items-start gap-2"><span aria-hidden="true">📍</span><span>おでかけを記録：はじめての場所は ボーナス</span></li>
              <li className="flex items-start gap-2"><span aria-hidden="true">📷</span><span>写真・感想・評価を のこすと さらに</span></li>
            </ul>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <Link href="/mypage/gear" className="rounded-full border border-[#E2C99A] bg-white py-2.5 text-center text-[12px] font-bold text-[#8A5418] active:scale-95">おぼえた しぐさ</Link>
            <Link href="/mypage/exp-history" className="rounded-full bg-[linear-gradient(180deg,#D99A3A,#B87420)] py-2.5 text-center text-[12px] font-black text-white shadow-sm active:scale-95">EXP履歴を見る</Link>
          </div>
          <button type="button" onClick={onClose} className="w-full rounded-full py-1.5 text-[12px] font-bold text-[#A08A6A] active:scale-95">とじる</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
