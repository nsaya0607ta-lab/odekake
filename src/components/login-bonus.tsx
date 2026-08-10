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
 * localStorage は「今日はもう確かめた」を覚えて通信を減らすだけ。消されても、
 * 端末の時計をずらされても、コインが増えないのは変わらない。
 *
 * 覚える日付はサーバーが数えた日本時間の日付を優先する。端末の時計が進んで
 * いると、自分で数えた日付では受け取れる日をまたいで飛ばしてしまうため。
 */

const SEEN_KEY = "odekake:login-bonus-checked-on";

type Reward = { amount: number; balance: number };

/**
 * 起動スプラッシュ（.app-splash / z-index 9999）が消えるまで待つ。
 *
 * スプラッシュはこのポップより手前に出るので、待たずに出すと演出がぜんぶ裏で
 * 終わってしまい、明けたときには止まった絵だけが残る。秒数を写して持つと
 * スプラッシュ側を変えたときにずれるので、要素が消えたかどうかで見る。
 */
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

    // 監視が何かの拍子に外れても、受け取り自体は済んでいるので必ず出す
    const fallback = window.setTimeout(done, 8000);
  });
}

export function LoginBonus({ skin = "default" }: { skin?: DogSkinId }) {
  const router = useRouter();
  const [reward, setReward] = useState<Reward | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;

    const claim = async () => {
      const today = todayInJapan();
      try {
        if (window.localStorage.getItem(SEEN_KEY) === today) return;
      } catch {
        // プライベートモードなどで localStorage が使えない端末では、
        // 毎回1回だけ問い合わせる。付与はDBが1日1回に絞る。
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
          window.localStorage.setItem(SEEN_KEY, data.date ?? today);
        } catch {
          // 保存できなくても支障はない（次に開いたときにもう一度問い合わせるだけ）
        }

        if (cancelled || !data.granted) return;

        // ヘッダーの残高など、サーバーで描いている表示を新しくする。
        // ポップより先に走らせて、明けたときには数字が揃っているようにする
        router.refresh();

        await waitForSplash();
        if (cancelled) return;
        setReward({ amount: data.amount ?? 0, balance: data.balance ?? 0 });
      } catch {
        // 圏外なら次に開いたときに試す。ここで騒いでも直せない
      }
    };

    void claim();
    return () => {
      cancelled = true;
    };
  }, [router]);

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

        /* 下から跳ね上がって、少し行き過ぎてから収まる */
        @keyframes lb-card {
          0%   { transform: translateY(26px) scale(0.92); opacity: 0 }
          55%  { transform: translateY(-6px) scale(1.02); opacity: 1 }
          78%  { transform: translateY(1px)  scale(0.998) }
          100% { transform: translateY(0)    scale(1) }
        }
        .lb-card { animation: lb-card 460ms cubic-bezier(0.22, 1, 0.36, 1) both; }

        /* コインは上から落ちてきて弾む。カードが出きってから動かす */
        @keyframes lb-coin {
          0%   { transform: translateY(-26px) scale(0.7) rotate(-18deg); opacity: 0 }
          45%  { transform: translateY(3px)   scale(1.08) rotate(4deg);  opacity: 1 }
          65%  { transform: translateY(-7px)  scale(0.98) rotate(-3deg) }
          82%  { transform: translateY(1px)   scale(1.02) rotate(1deg) }
          100% { transform: translateY(0)     scale(1)    rotate(0deg) }
        }
        .lb-coin { animation: lb-coin 620ms cubic-bezier(0.3, 1.3, 0.5, 1) 220ms both; }

        /* 枚数はコインが着いた拍子に、ひと押し出てくる */
        @keyframes lb-amount {
          0%   { transform: scale(0.7); opacity: 0 }
          60%  { transform: scale(1.09); opacity: 1 }
          100% { transform: scale(1) }
        }
        .lb-amount { animation: lb-amount 420ms cubic-bezier(0.3, 1.4, 0.5, 1) 420ms both; }

        /* 犬はコインに気づいて、ぴょんと跳ねる */
        @keyframes lb-dog {
          0%, 100% { transform: translateY(0)    scale(1, 1) }
          25%      { transform: translateY(3px)  scale(1.05, 0.95) }
          55%      { transform: translateY(-9px) scale(0.96, 1.06) }
          78%      { transform: translateY(0)    scale(1.03, 0.98) }
        }
        .lb-dog { transform-origin: 50% 92%; animation: lb-dog 700ms cubic-bezier(0.3, 1.2, 0.5, 1) 560ms both; }

        /* まわりの光。ゆっくり開いて、そのまま残す */
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

      {/* カードの中を押しても閉じない */}
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

        {/* 上半分：朝の空。ここでコインと犬を見せる */}
        {/* とじるボタンと見出しがぶつからないよう、上は広めにとる */}
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

          {/* eslint-disable-next-line @next/next/no-img-element */}
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

        {/* 下半分：文章と残高 */}
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

/** 飾りのキラキラ。位置と出るタイミングだけ変えて使い回す */
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
