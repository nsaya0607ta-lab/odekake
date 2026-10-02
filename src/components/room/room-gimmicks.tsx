"use client";

/**
 * わんこのおへや：ちょっとしたしかけ。
 * - 流れ星：晴れた夜、ときどき窓の外を流れ星が横切る。消えるまでにタップすると、ねがいごとができる。
 */
import { useEffect, useState } from "react";
import type { WindowRect } from "./room-scene";

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
