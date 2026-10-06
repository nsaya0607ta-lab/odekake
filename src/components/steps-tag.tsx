"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SIGN_TEXT, STEPS_BANNER, STEPS_BOARD, STEPS_PANEL } from "@/components/home-scene";
import { requestStepsWrite } from "@/lib/home-dog-bus";
import { useTodaySteps } from "@/lib/use-today-steps";

/**
 * 背景の絵に描かれている下の看板へ、今日の歩数を書き込む。
 * 位置は home-scene.tsx の実測値に合わせてあるので、勝手にずらさない。
 *
 * 歩数が前に見せたときより増えていたら、すぐには書き換えない。いったん前の数字を出しておき、
 * 犬（wandering-frenchie.tsx）が看板まで歩いてきてペンで書きはじめたところで、古い数字が消えて
 * 新しい数字が左から書かれていく。犬がいないとき（動きを減らす設定など）は、看板が自分で書き換える。
 * 「前に見せた歩数」はこの端末に日付つきで覚えておく（日がかわったら 0 から書く）。
 */

const SHOWN_KEY = "home-steps-shown";
/** ホームを開いてから犬に頼むまで（前の数字を少し見せる） */
const ASK_DELAY_MS = 900;
/** 犬が引き受けたのに書きはじめないときは、看板が自分で書き換える */
const WRITE_TIMEOUT_MS = 12_000;
/** 新しい数字を書きあげるまで */
const INK_MS = 1100;

function jstToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

function readShown(): { date: string; steps: number } | null {
  try {
    const value = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "null") as unknown;
    if (value && typeof value === "object" && "date" in value && "steps" in value) {
      const { date, steps } = value as { date: unknown; steps: unknown };
      if (typeof date === "string" && typeof steps === "number") return { date, steps };
    }
  } catch {
    // 読めなければ、覚えていないのと同じ
  }
  return null;
}

function saveShown(steps: number) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify({ date: jstToday(), steps }));
  } catch {
    // 保存できなくても、表示はそのまま
  }
}

const fmt = (steps: number | null) => (steps === null ? "—" : steps.toLocaleString("ja-JP"));

export function StepsTag({
  initialSteps,
  initialStepExp,
  initialCoinBalance,
}: {
  initialSteps: number | null;
  initialStepExp: number;
  initialCoinBalance: number;
}) {
  const { steps, stepExp } = useTodaySteps({
    steps: initialSteps,
    stepExp: initialStepExp,
    coinBalance: initialCoinBalance,
  });

  // 看板に出ている数字。書き換えている間は old → next
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState<number | null>(steps);
  const [writing, setWriting] = useState<{ old: number | null; next: number; key: number } | null>(null);
  const latest = useRef(steps);
  latest.current = steps;

  useEffect(() => {
    setReady(true);
    if (steps === null) {
      setShown(null);
      return;
    }
    const stored = readShown();
    const prev = stored ? (stored.date === jstToday() ? stored.steps : 0) : null;
    if (prev === null || steps <= prev) {
      setShown(steps);
      saveShown(steps);
      return;
    }

    // 前の数字を出しておいて、犬に書いてもらう
    setShown(prev);
    let finished = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let inkTimer: ReturnType<typeof setTimeout> | undefined;
    const write = () => {
      if (finished) return;
      finished = true;
      clearTimeout(fallback);
      const next = latest.current ?? steps;
      setWriting({ old: prev, next, key: Date.now() });
      saveShown(next);
      inkTimer = setTimeout(() => {
        setShown(next);
        setWriting(null);
      }, INK_MS);
    };
    const ask = setTimeout(() => {
      const accepted = requestStepsWrite({ write, done: () => {} });
      if (!accepted) write();
      else fallback = setTimeout(write, WRITE_TIMEOUT_MS);
    }, ASK_DELAY_MS);

    return () => {
      // 途中で数字が変わったら、まだ書いていなければ頼みなおす（書きはじめていたらそのまま書ききる）
      clearTimeout(ask);
      clearTimeout(fallback);
      if (!finished) finished = true;
      else if (inkTimer) {
        clearTimeout(inkTimer);
        setShown(latest.current);
        setWriting(null);
      }
    };
  }, [steps]);

  return (
    <Link
      href="/mypage/step-sync"
      aria-label={
        steps === null ? "今日の歩数は未連携。歩数の連携設定を開く" : `今日の歩数 ${steps}歩。歩数の連携設定を開く`
      }
      className="absolute z-10 block active:scale-[0.98]"
      style={STEPS_BOARD}
    >
      <style>{`
        /* 古い数字は、ペンが来たところでかすれて消える */
        @keyframes steps-erase {
          0%   { opacity: 1; filter: blur(0); transform: translateY(0); }
          100% { opacity: 0; filter: blur(2px); transform: translateY(-2px); }
        }
        /* 新しい数字は、左から書かれていく。書きたてのインクは少し青く光って、なじむ */
        @keyframes steps-ink {
          0%   { clip-path: inset(-20% 100% -20% 0); color: #3b6fd1; }
          70%  { clip-path: inset(-20% 0 -20% 0);   color: #3b6fd1; }
          100% { clip-path: inset(-20% 0 -20% 0);   color: inherit; }
        }
        .steps-erase { animation: steps-erase 380ms ease-out both; }
        .steps-ink { animation: steps-ink ${INK_MS}ms cubic-bezier(0.45, 0.05, 0.4, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .steps-erase { animation-duration: 1ms; }
          .steps-ink { animation: none; }
        }
      `}</style>
      <span className="absolute flex items-center justify-center" style={STEPS_BANNER}>
        <span
          className="whitespace-nowrap leading-none font-bold tracking-[0.04em] text-white"
          style={{ fontSize: SIGN_TEXT.banner }}
        >
          今日の歩数
        </span>
      </span>

      <span className="absolute flex flex-col justify-center" style={STEPS_PANEL}>
        <span
          className="flex shrink-0 items-baseline justify-center gap-1 leading-none whitespace-nowrap text-[#5b4a35]"
          aria-live="polite"
          style={{ opacity: ready ? 1 : 0 }}
        >
          <span className="relative font-bold tabular-nums" style={{ fontSize: SIGN_TEXT.steps }}>
            {writing ? (
              <>
                {/* 幅は新しい数字に合わせ、古い数字は重ねて消す */}
                <span key={`ink-${writing.key}`} className="steps-ink inline-block">{fmt(writing.next)}</span>
                <span key={`old-${writing.key}`} className="steps-erase absolute inset-0 text-center">{fmt(writing.old)}</span>
              </>
            ) : (
              fmt(shown)
            )}
          </span>
          <span className="font-semibold" style={{ fontSize: SIGN_TEXT.unit }}>
            歩
          </span>
        </span>
        <span
          className="mt-0.5 block shrink-0 truncate text-center leading-none text-[#8b7355]"
          style={{ fontSize: SIGN_TEXT.small }}
        >
          {steps === null ? "ショートカット連携前" : `歩数EXP +${stepExp.toLocaleString("ja-JP")}`}
        </span>
      </span>
    </Link>
  );
}
