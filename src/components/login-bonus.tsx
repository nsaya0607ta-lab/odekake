"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCoins } from "@/lib/coins";
import { todayInJapan } from "@/lib/date";
import { getFrenchieSrc, type DogSkinId } from "@/lib/dog-skins";
import { CoinArt } from "./coin-art";
import { IconClose } from "./icons";

/**
 * ログインボーナス。その日はじめてアプリを開いたときに1回だけ出る。
 *
 * 二重付与を止めているのは DB 側（claim_login_bonus の一意キー）で、ここの
 * localStorage は「今日はもう確かめた」を覚えて通信を減らすだけ。
 *
 * 以前は端末全体で1つのキーを使っていたため、同じ端末で別アカウントへ
 * 切り替えたとき、先にログインしたユーザーの「確認済み」が次のユーザーにも
 * 引き継がれてしまっていた。現在は userId ごとにキーを分ける。
 */

const SEEN_KEY_PREFIX = "odekake:login-bonus-checked-on";

type Reward = { amount: number; balance: number };

function waitForSplash(): Promise<void> {
  return new Promise((resolve) => {
    if (!document.querySelector(".app-splash")) return resolve();

    const done = () => {
      observer.disconnect();
      window.clearTimeout(fallback);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (!document.querySelector(".app-splash")) done();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const fallback = window.setTimeout(done, 8000);
  });
}

export function LoginBonus({ skin = "default", userId }: { skin?: DogSkinId; userId: string }) {
  const router = useRouter();
  const [reward, setReward] = useState<Reward | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    const seenKey = `${SEEN_KEY_PREFIX}:${userId}`;

    const claim = async () => {
      const today = todayInJapan();
      try {
        if (window.localStorage.getItem(seenKey) === today) return;
      } catch {
        // localStorage が使えない場合も DB 側で二重付与を防ぐため、そのまま問い合わせる。
      }

      try {
        const response = await fetch("/api/coins/login-bonus", {
          method: "POST",
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = (await response.json()) as {
          granted?: boolean;
          amount?: number;
          balance?: number;
          date?: string | null;
        };

        try {
          window.localStorage.setItem(seenKey, data.date ?? today);
        } catch {
          // 保存できなくても支障はない。
        }

        if (cancelled || !data.granted) return;

        router.refresh();

        await waitForSplash();
        if (cancelled) return;
        setReward({ amount: data.amount ?? 0, balance: data.balance ?? 0 });
      } catch {
        // 圏外なら次に開いたときに再試行する。
      }
    };

    void claim();
    return () => {
      cancelled = true;
    };
  }, [router, userId]);

  const close = useCallback(() => setReward(null), []);

  useEffect(() => {
    if (!reward) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [reward, close]);

  if (!reward) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#463b2f]/35 p-4 backdrop-blur-[1px] lb-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-bonus-title"
      onClick={close}
    >
      <style>{`
        @keyframes lb-backdrop { from { opacity: 0 } to { opacity: 1 } }
        .lb-backdrop { animation: lb-backdrop 200ms ease both; }

        @keyframes lb-card {
          0%   { transform: translateY(26px) scale(0.92); opacity: 0 }
          55%  { transform: translateY(-6px) scale(1.02); opacity: 1 }
          78%  { transform: translateY(1px)  scale(0.998) }
          100% { transform: translateY(0)    scale(1) }
        }
        .lb-card { animation: lb-card 460ms cubic-bezier(0.22, 1, 0.36, 1) both; }

        @keyframes lb-coin {
          0%   { transform: translateY(-26px) scale(0.7) rotate(-18deg); opacity: 0 }
          45%  { transform: translateY(3px)   scale(1.08) rotate(4deg);  opacity: 1 }
          65%  { transform: translateY(-7px)  scale(0.98) rotate(-3deg) }
          82%  { transform: translateY(1px)   scale(1.02) rotate(1deg) }
          100% { transform: translateY(0)     scale(1)    rotate(0deg) }
        }
        .lb-coin { animation: lb-coin 620ms cubic-bezier(0.3, 1.3, 0.5, 1) 220ms both; }

        @keyframes lb-amount {
          0%   { transform: scale(0.7); opacity: 0 }
          60%  { transform: scale(1.09); opacity: 1 }
          100% { transform: scale(1) }
        }
        .lb-amount { animation: lb-amount 420ms cubic-bezier(0.3, 1.4, 0.5, 1) 420ms both; }

        @keyframes lb-dog {
          0%, 100% { transform: translateY(0)    scale(1, 1) }
          25%      { transform: translateY(3px)  scale(1.05, 0.95) }
          55%      { transform: translateY(-9px) scale(0.96, 1.06) }
          78%      { transform: translateY(0)    scale(1.03, 0.98) }
        }
        .lb-dog { transform-origin: 50% 92%; animation: lb-dog 700ms cubic-bezier(0.3, 1.2, 0.5, 1) 560ms both; }

        @keyframes lb-glow {
          from { transform: scale(0.6); opacity: 0 }
          to   { transform: scale(1);   opacity: 1 }
        }
        .lb-glow { animation: lb-glow 700ms ease-out 200ms both; }

        @keyframes lb-spark {
          0%   { transform: scale(0) rotate(0deg);    opacity: 0 }
          40%  { transform: scale(1.15) rotate(90deg); opacity: 1 }
          100% { transform: scale(0.9) rotate(140deg); opacity: 0.85 }
        }
        .lb-spark { animation: lb-spark 720ms ease-out both; }

        @media (prefers-reduced-motion: reduce) {
          .lb-backdrop, .lb-card, .lb-coin, .lb-amount, .lb-dog, .lb-glow, .lb-spark {
            animation: none;
          }
        }
      `}</style>

      <div
        className="lb-card relative w-full max-w-[320px] overflow-hidden rounded-[28px] border border-[#eadfc8] bg-[#fffdf8] shadow-[0_18px_50px_rgba(75,56,36,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButton}
          type="button"
          onClick={close}
          aria-label="とじる"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-ink-faint shadow-sm active:bg-paper-deep"
        >
          <IconClose size={17} />
        </button>

        <div className="relative overflow-hidden bg-gradient-to-b from-[#fdf1d4] to-[#f7e8cd] px-5 pb-4 pt-11">
          <span className="lb-glow pointer-events-none absolute left-1/2 top-20 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f7d380]/45 blur-2xl" />
          <Sparkle className="left-[12%] top-[20%] h-3.5 w-3.5" delay={520} />
          <Sparkle className="right-[27%] top-[10%] h-4 w-4" delay={620} />
          <Sparkle className="right-[9%] top-[54%] h-3 w-3" delay={720} />
          <Sparkle className="left-[8%] top-[48%] h-3 w-3" delay={680} />

          <p
            id="login-bonus-title"
            className="relative z-10 text-center text-[11px] font-bold tracking-[0.14em] text-[#a8823f]"
          >
            ログインボーナス
          </p>

          <div className="relative z-10 mt-2 flex items-center justify-center gap-2">
            <CoinArt className="lb-coin h-11 w-11 drop-shadow-[0_2px_3px_rgba(150,110,45,0.25)]" />
            <span className="lb-amount flex items-baseline text-[#6e5a3c]">
              <span className="text-[40px] leading-none font-black tabular-nums">
                +{formatCoins(reward.amount)}
              </span>
              <span className="ml-1 text-sm font-bold">枚</span>
            </span>
          </div>

          <img
            src={getFrenchieSrc(skin, "cheer")}
            alt=""
            aria-hidden="true"
            draggable={false}
            width={300}
            height={254}
            className="lb-dog relative z-10 mx-auto mt-1 block h-auto w-[132px] select-none"
          />
        </div>

        <div className="px-5 pb-5 pt-4 text-center">
          <p className="text-[15px] font-bold text-ink">今日のぶん、受け取りました！</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
            毎日1回、はじめて開いたときにもらえます。
            <br />
            今日もおさんぽ、いってらっしゃい。
          </p>

          <p className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-paper-deep py-2 text-[11px] text-ink-soft">
            いまのコイン
            <CoinArt className="h-3.5 w-3.5" />
            <span className="font-bold tabular-nums text-ink">{formatCoins(reward.balance)}</span>枚
          </p>

          <button
            type="button"
            onClick={close}
            className="mt-3 w-full rounded-full bg-leaf px-3 py-3 text-sm font-bold text-white shadow-sm active:bg-leaf-deep"
          >
            うけとる
          </button>
        </div>
      </div>
    </div>
  );
}

function Sparkle({ className, delay }: { className: string; delay: number }) {
  return (
    <span
      className={`lb-spark pointer-events-none absolute ${className}`}
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-full w-full">
        <path d="M12 0.5 14.2 9.8 23.5 12 14.2 14.2 12 23.5 9.8 14.2 0.5 12 9.8 9.8Z" fill="#f0c35e" />
      </svg>
    </span>
  );
}
