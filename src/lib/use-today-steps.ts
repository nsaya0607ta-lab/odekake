"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * 今日の歩数を1か所で持って、必要な画面すべてに配る。
 *
 * ホームでは看板（steps-tag.tsx）と歩数カード（today-steps-card.tsx）が同じ数字を
 * 出す。それぞれが個別に取りに行くと同じ API を二重に叩いて、しかも片方だけ古い数字
 * のまま残ることがあるので、取得も再取得のきっかけもこのモジュールに集めてある。
 */

export type TodaySteps = {
  steps: number | null;
  stepExp: number;
  coinBalance: number;
};

type TodayStepsResponse = {
  ok: boolean;
  todaySteps: number | null;
  todayStepExp: number;
  coinBalance: number;
};

const POLL_MS = 30_000;
/** router.refresh() を短時間に何度も走らせないための間隔 */
const REFRESH_GUARD_MS = 3_000;

let current: TodaySteps | null = null;
/** 値が変わるたびに増える。Server Component の取り直しが必要かの目印 */
let changeToken = 0;
let lastRefreshAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let bound = false;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function pull() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

  try {
    const response = await fetch("/api/steps/today", { cache: "no-store" });
    if (!response.ok) return;

    const body = (await response.json()) as TodayStepsResponse;
    if (!body.ok) return;

    const next: TodaySteps = {
      steps: body.todaySteps,
      stepExp: body.todayStepExp,
      coinBalance: body.coinBalance,
    };
    const changed =
      !current ||
      current.steps !== next.steps ||
      current.stepExp !== next.stepExp ||
      current.coinBalance !== next.coinBalance;

    current = next;
    if (changed) changeToken += 1;
    emit();
  } catch {
    // 一時的な通信失敗では現在の表示を保つ。
  }
}

function onWake() {
  if (document.visibilityState === "visible") void pull();
}

function start() {
  if (bound) return;
  bound = true;
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("focus", onWake);
  timer = setInterval(() => void pull(), POLL_MS);
}

function stopIfIdle() {
  if (listeners.size > 0 || !bound) return;
  bound = false;
  document.removeEventListener("visibilitychange", onWake);
  window.removeEventListener("focus", onWake);
  if (timer) clearInterval(timer);
  timer = null;
}

/**
 * `initial` はサーバーが描いた値。まだ一度も取得していない間はこれをそのまま返す。
 * 値が動いたときは、EXP やコイン残高も併せて描き直せるように画面全体を取り直す。
 */
export function useTodaySteps(initial: TodaySteps): TodaySteps {
  const router = useRouter();
  const [value, setValue] = useState<TodaySteps>(() => current ?? initial);
  const seenToken = useRef(changeToken);
  // 呼び出し側は毎回新しいオブジェクトを渡してくる。購読の張り直しが起きないよう
  // 依存配列には入れず、最新の値だけ持っておく
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    const listener = () => {
      setValue(current ?? initialRef.current);
      if (seenToken.current === changeToken) return;

      seenToken.current = changeToken;
      const now = Date.now();
      if (now - lastRefreshAt < REFRESH_GUARD_MS) return;
      lastRefreshAt = now;
      router.refresh();
    };

    // 最初の1人が乗るときだけ、サーバーが今描いた値へ入れ替える。前に開いたときの
    // 取得結果がモジュールに残っていると、戻ってきた瞬間だけ古い歩数が出てしまう。
    // 2人目以降は入れ替えない（先に乗ったほうが取得した新しい値を消さないため）
    const isFirst = listeners.size === 0;
    listeners.add(listener);
    start();
    if (isFirst) current = initialRef.current;
    // 別の画面が先に取得していれば、その値へすぐ追いつく
    listener();
    void pull();

    return () => {
      listeners.delete(listener);
      stopIfIdle();
    };
  }, [router]);

  return value;
}
