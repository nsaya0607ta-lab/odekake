"use client";

/**
 * ショップの「ホームのカード」。カードの絵がら（冬など）を、1枚ずつ買って1枚ずつ変えるか、
 * セットでまとめて買って（2割引）ぜんぶ一度に変える。文字の位置は変わらない。
 * お金が動くボタンは、1回目で「本当に買う？」に変わり、2回目で買う。
 */
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BlueCoinArt } from "@/components/coin-art";
import {
  DEFAULT_HOME_SKINS,
  HOME_SKIN_ART,
  HOME_SKIN_PART_LABELS,
  HOME_SKIN_PARTS,
  HOME_SKIN_THEME_INFO,
  SHOP_HOME_SKIN_THEMES,
  homeSkinKey,
  homeSkinPrice,
  homeSkinSetPrice,
  type HomeSkinPart,
  type HomeSkinTheme,
  type HomeSkins,
} from "@/lib/home-skins";

/** テーマごとの見本の台の色 */
const THEME_TINT: Record<HomeSkinTheme, string> = {
  default: "bg-paper",
  winter: "bg-[linear-gradient(180deg,#eef4fb,#fbf8f1)] ring-[rgba(120,140,170,.18)]",
  deluxe: "bg-[linear-gradient(180deg,#fbf3dc,#fdf9ef)] ring-[rgba(190,150,60,.28)]",
};

type Confirm = { theme: HomeSkinTheme; part: HomeSkinPart | "set" } | null;

export function HomeSkinShop({
  initialSkins,
  initialOwned,
  blueCoins,
  onBalance,
}: {
  initialSkins: HomeSkins;
  /** 買った絵がら（"winter:scene" の形）。DB の準備がまだなら null */
  initialOwned: string[] | null;
  blueCoins: number;
  onBalance: (balance: number) => void;
}) {
  const [skins, setSkins] = useState(initialSkins);
  const [owned, setOwned] = useState(() => new Set(initialOwned ?? []));
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (initialOwned === null) {
    return (
      <section className="rounded-[22px] border border-line bg-card p-4 text-center text-[12px] text-ink-faint">
        ホームのカードの絵がらは準備中です。
      </section>
    );
  }

  async function call<T>(method: "POST" | "PATCH", body: unknown): Promise<T> {
    const response = await fetch("/api/home-skins", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!response.ok || !payload) throw new Error(payload?.error ?? "うまくいきませんでした。");
    return payload;
  }

  async function apply(next: HomeSkins, done: string) {
    await call("PATCH", next);
    setSkins(next);
    setMessage({ tone: "ok", text: done });
  }

  /** 持っていなければ買ってから、そのカードを変える */
  async function run(theme: HomeSkinTheme, parts: HomeSkinPart[], buy: HomeSkinPart[]) {
    setBusy(true);
    setMessage(null);
    setConfirm(null);
    try {
      if (buy.length) {
        const bought = await call<{ balance: number; bought: HomeSkinPart[] }>("POST", { theme, parts: buy });
        onBalance(bought.balance);
        setOwned((prev) => {
          const next = new Set(prev);
          for (const part of buy) next.add(homeSkinKey(theme, part));
          return next;
        });
      }
      const next = { ...skins };
      for (const part of parts) next[part] = theme;
      const name = HOME_SKIN_THEME_INFO[theme].name;
      await apply(next, parts.length === HOME_SKIN_PARTS.length ? `ホームのカードを ぜんぶ「${name}」にしました` : `${HOME_SKIN_PART_LABELS[parts[0]!]}を「${name}」にしました`);
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "うまくいきませんでした。" });
    } finally {
      setBusy(false);
    }
  }

  async function reset(parts: readonly HomeSkinPart[]) {
    setBusy(true);
    setMessage(null);
    setConfirm(null);
    try {
      const next = { ...skins };
      for (const part of parts) next[part] = "default";
      await apply(next, parts.length === 1 ? `${HOME_SKIN_PART_LABELS[parts[0]!]}を いつもの にもどしました` : "ホームのカードを ぜんぶ いつもの にもどしました");
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "うまくいきませんでした。" });
    } finally {
      setBusy(false);
    }
  }

  const anyChanged = HOME_SKIN_PARTS.some((part) => skins[part] !== DEFAULT_HOME_SKINS[part]);

  return (
    <section className="rounded-[22px] border border-line bg-card p-3 shadow-[0_6px_16px_rgba(90,70,40,.08)]">
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-base font-bold">ホームのカード</h2>
          <p className="mt-0.5 text-[11px] text-ink-faint">カードの絵がらを変えられます。1枚ずつでも、セットでまとめてでも</p>
        </div>
        <Link href="/home" className="shrink-0 rounded-full bg-leaf-soft px-3 py-1.5 text-[11px] font-black text-leaf-deep active:scale-95">
          ホームで見る
        </Link>
      </div>

      {SHOP_HOME_SKIN_THEMES.map((theme) => {
        const info = HOME_SKIN_THEME_INFO[theme];
        const { full, set, missing } = homeSkinSetPrice(theme, owned);
        const allUsing = HOME_SKIN_PARTS.every((part) => skins[part] === theme);
        const setConfirming = confirm?.theme === theme && confirm.part === "set";
        const short = set - blueCoins;
        return (
          <div key={theme} className={`mt-3 overflow-hidden rounded-[20px] ring-1 ${THEME_TINT[theme]}`}>
            <div className="flex gap-3 p-3">
              <MiniHome theme={theme} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-black">{info.name}のカード</p>
                <p className="mt-0.5 text-[11px] font-bold text-ink-soft">{info.sub}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">{info.description}</p>
              </div>
            </div>

            <div className="px-3 pb-3">
              {allUsing ? (
                <p className="rounded-full bg-leaf py-2.5 text-center text-[13px] font-black text-white">ぜんぶ使用中です</p>
              ) : missing.length === 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(theme, [...HOME_SKIN_PARTS], [])}
                  className="w-full rounded-full bg-leaf py-2.5 text-[13px] font-black text-white shadow-md active:scale-[.98] disabled:opacity-60"
                >
                  ぜんぶ「{info.name}」にする
                </button>
              ) : short > 0 ? (
                <p className="rounded-full bg-[#FFF1F3] py-2.5 text-center text-[12px] font-bold text-[#b94c60]">
                  セットには 青コインが あと{short.toLocaleString()}枚 たりません
                </p>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (setConfirming ? void run(theme, [...HOME_SKIN_PARTS], missing) : setConfirm({ theme, part: "set" }))}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-black text-white shadow-md active:scale-[.98] disabled:opacity-60 ${setConfirming ? "bg-[#1F4F8F]" : "bg-[#2F6FC2]"}`}
                >
                  {setConfirming ? "本当に買う？（もう一度タップ）" : "セットで買って ぜんぶ変える"}
                  <span className="flex items-center gap-0.5 rounded-full bg-white/20 px-2 py-0.5 tabular-nums">
                    <BlueCoinArt className="h-3.5 w-3.5" />
                    {set.toLocaleString()}
                  </span>
                  {set < full ? <s className="text-[10px] font-bold text-white/70 tabular-nums">{full.toLocaleString()}</s> : null}
                </button>
              )}
              {missing.length >= 2 && !allUsing ? (
                <p className="mt-1 text-center text-[10px] text-ink-faint">セットで買うと、持っていないカードの合計が2割引になります</p>
              ) : null}

              <ul className="mt-3 flex flex-col gap-1.5">
                {HOME_SKIN_PARTS.map((part) => {
                  const using = skins[part] === theme;
                  const has = owned.has(homeSkinKey(theme, part));
                  const price = homeSkinPrice(theme, part);
                  const confirming = confirm?.theme === theme && confirm.part === part;
                  return (
                    <li key={part} className="flex items-center gap-2 rounded-2xl bg-white/80 py-1.5 pl-1.5 pr-2">
                      <PartThumb theme={theme} part={part} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-black">{HOME_SKIN_PART_LABELS[part]}</span>
                        <span className="block text-[10px] text-ink-faint">{using ? "使用中" : has ? "持っています" : "まだ持っていません"}</span>
                      </span>
                      {using ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void reset([part])}
                          className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-[11px] font-bold text-ink-soft active:scale-95 disabled:opacity-60"
                        >
                          もどす
                        </button>
                      ) : has ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void run(theme, [part], [])}
                          className="shrink-0 rounded-full bg-leaf px-3.5 py-1.5 text-[11px] font-black text-white active:scale-95 disabled:opacity-60"
                        >
                          使う
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy || price > blueCoins}
                          onClick={() => (confirming ? void run(theme, [part], [part]) : setConfirm({ theme, part }))}
                          className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black text-white active:scale-95 disabled:opacity-45 ${confirming ? "bg-[#1F4F8F]" : "bg-[#2F6FC2]"}`}
                        >
                          {confirming ? "買う？" : null}
                          <BlueCoinArt className="h-3.5 w-3.5" />
                          <span className="tabular-nums">{price.toLocaleString()}</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}

      {anyChanged ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void reset(HOME_SKIN_PARTS)}
          className="mt-2.5 w-full rounded-full border border-line bg-paper py-2 text-[12px] font-bold text-ink-soft active:scale-[.98] disabled:opacity-60"
        >
          ぜんぶ いつもの にもどす
        </button>
      ) : null}

      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-2 rounded-2xl px-3 py-2 text-center text-[12px] font-bold ${message.tone === "error" ? "bg-[#FFF1F3] text-[#b94c60]" : "bg-leaf-soft text-leaf-deep"}`}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

/** そのテーマでそろえたときのホームの見本（わんこのカードと3枚のカードを小さく重ねる） */
function MiniHome({ theme }: { theme: HomeSkinTheme }) {
  return (
    <div className="flex w-[104px] shrink-0 flex-col gap-0.5 rounded-xl bg-white/60 p-1.5" aria-hidden="true">
      <SceneThumb theme={theme} />
      <Image src={HOME_SKIN_ART.notice[theme]} alt="" width={217} height={72} className="h-auto w-full" />
      <Image src={HOME_SKIN_ART.highlights[theme]} alt="" width={154} height={102} className="h-auto w-full" />
      <Image src={HOME_SKIN_ART.collection[theme]} alt="" width={217} height={72} className="h-auto w-full" />
    </div>
  );
}

/** わんこのカード（景色と額縁）。額縁はホームと同じ位置にかぶせる */
function SceneThumb({ theme }: { theme: HomeSkinTheme }) {
  return (
    <div className="relative mx-[4%] mb-[3%] mt-[5%]" style={{ aspectRatio: "1440 / 768" }}>
      <Image src={HOME_SKIN_ART.scene[theme]} alt="" fill sizes="120px" className="rounded-[4px] object-cover" />
      <Image
        src={HOME_SKIN_ART.sceneFrame[theme]}
        alt=""
        width={154}
        height={102}
        className="absolute max-w-none"
        style={{ left: "-3.15%", top: "-30.82%", width: "107.64%", height: "167.87%" }}
      />
    </div>
  );
}

function PartThumb({ theme, part }: { theme: HomeSkinTheme; part: HomeSkinPart }) {
  return (
    <span className="flex h-11 w-16 shrink-0 items-center justify-center overflow-visible rounded-xl bg-[#f3efe6] px-1" aria-hidden="true">
      {part === "scene" ? (
        <span className="block w-full">
          <SceneThumb theme={theme} />
        </span>
      ) : (
        <Image src={HOME_SKIN_ART[part][theme]} alt="" width={120} height={part === "highlights" ? 80 : 40} className="h-auto max-h-10 w-full object-contain" />
      )}
    </span>
  );
}
