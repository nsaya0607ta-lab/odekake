"use client";

/**
 * ショップ：アプリの背景を青コインで買って、使う背景を選ぶ。
 * - 一覧は「動く背景」「変わる背景」「柄・風景」に分けて並べる。見本は背景だけを、1枚の絵で見せる
 * - タップすると大きな見本が開き、動く背景はそのまま動く（さわれる背景は、見本をさわると反応する）
 * - 変わる背景は「雨のとき」「10,000歩のとき」などを切りかえて見られる
 * - 「アプリでためす」で、買う前にアプリ全体の背景を一時的に切りかえられる
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AppBackgroundPreview } from "@/components/app-background";
import { BlueCoinArt } from "@/components/coin-art";
import type { LiveMode } from "@/components/live-backgrounds/engine";
import { setTryOnBackground, useTryOnBackground } from "@/components/live-backgrounds/try-on";
import { BlueCoinBar } from "@/components/room/room-shop";
import { HomeLookEditor } from "@/components/shop/home-look-editor";
import {
  APP_BACKGROUND_GROUPS,
  APP_BACKGROUNDS,
  BACKGROUND_VARIANTS,
  POSTER_VARIANTS,
  defaultVariantKey,
  getAppBackground,
  type AppBackgroundId,
  type BackgroundSignals,
  type BackgroundVariant,
} from "@/lib/app-backgrounds";
import type { HomeLook } from "@/lib/home-look";

const NO_VARIANTS: readonly BackgroundVariant[] = [];

/**
 * 背景だけの見本。zoom で柄の大きさを決める（1 で実際の画面と同じ大きさ）。
 * 中身を zoom 分の1の大きさで描いてから縮めるので、小さな枠でも柄の密度が実物に近く見える。
 */
function Swatch({ id, zoom, mode = "still", signals }: { id: AppBackgroundId; zoom: number; mode?: LiveMode; signals?: BackgroundSignals }) {
  const size = `${100 / zoom}%`;
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: size, height: size, transform: `scale(${zoom})` }}>
        <AppBackgroundPreview id={id} mode={mode} signals={signals} />
      </div>
    </div>
  );
}

/** 一覧の見本。変わる背景は「朝・昼・夕方・夜」などを縦に並べて、1枚で変化がわかるようにする */
function BackgroundArt({ id, zoom }: { id: AppBackgroundId; zoom: number }) {
  const keys = POSTER_VARIANTS[id];
  const variants = BACKGROUND_VARIANTS[id] ?? NO_VARIANTS;
  if (!keys) return <Swatch id={id} zoom={zoom} />;
  const picked = keys.map((key) => variants.find((v) => v.key === key)).filter((v) => v !== undefined);
  if (picked.length === 1) return <Swatch id={id} zoom={zoom} signals={picked[0]!.signals} />;
  return (
    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${picked.length}, minmax(0, 1fr))` }} aria-hidden="true">
      {picked.map((variant) => (
        <div key={variant.key} className="relative overflow-hidden">
          <Swatch id={id} zoom={zoom} signals={variant.signals} />
        </div>
      ))}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M3.5 8.4 6.6 11.4 12.6 4.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Status = "using" | "owned" | "locked";

/** 見本の上に置く、すりガラスの札 */
const GLASS = "bg-[rgba(255,253,248,.82)] backdrop-blur-md [-webkit-backdrop-filter:blur(12px)]";

export function BackgroundShop({ current: initialCurrent, owned: initialOwned, blueCoins: initialBlueCoins, homeLook }: {
  current: AppBackgroundId;
  owned: AppBackgroundId[];
  blueCoins: number;
  homeLook: HomeLook;
}) {
  const router = useRouter();
  const tryOn = useTryOnBackground();
  const [current, setCurrent] = useState(initialCurrent);
  const [owned, setOwned] = useState(() => new Set<AppBackgroundId>(["default", ...initialOwned]));
  const [blueCoins, setBlueCoins] = useState(initialBlueCoins);
  const [selected, setSelected] = useState<AppBackgroundId | null>(null);

  const statusOf = (id: AppBackgroundId): Status => (id === current ? "using" : owned.has(id) ? "owned" : "locked");
  const currentBg = getAppBackground(current);

  return (
    <>
      <BlueCoinBar shop={{ blueCoins }} note="買った背景は、アプリ全体の背景になります。いつでも切り替えられます。" />

      <button
        type="button"
        onClick={() => setSelected(current)}
        className="relative block aspect-[16/7] w-full overflow-hidden rounded-[22px] text-left shadow-[0_6px_18px_rgba(90,70,40,.14)] ring-1 ring-[rgba(120,100,70,.14)] active:scale-[.99]"
      >
        <BackgroundArt id={current} zoom={0.85} />
        <span className={`absolute bottom-2.5 left-2.5 flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm ${GLASS}`}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf text-white"><CheckIcon className="h-3.5 w-3.5" /></span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold text-ink-faint">いま使っている背景</span>
            <span className="block text-sm font-black">{currentBg.name}</span>
          </span>
        </span>
      </button>

      <HomeLookEditor initial={homeLook} />

      {APP_BACKGROUND_GROUPS.map((group) => (
        <section key={group.id}>
          <div className="px-1">
            <h2 className="text-base font-bold">{group.title}</h2>
            <p className="mt-0.5 text-[11px] text-ink-faint">{group.note}</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {APP_BACKGROUNDS.filter((bg) => bg.group === group.id).map((bg) => {
              const status = statusOf(bg.id);
              const trying = tryOn === bg.id;
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setSelected(bg.id)}
                  aria-label={`${bg.name}（${status === "using" ? "使用中" : status === "owned" ? "持っています" : `青コイン${bg.price.toLocaleString()}枚`}）`}
                  className={`flex min-w-0 flex-col rounded-[22px] bg-card p-1.5 text-left shadow-[0_6px_16px_rgba(90,70,40,.1)] transition active:scale-[.98] ${
                    status === "using" ? "ring-[2.5px] ring-leaf" : trying ? "ring-[2.5px] ring-[#2F6FC2]" : "ring-1 ring-[rgba(120,100,70,.14)]"
                  }`}
                >
                  {/* 見本の上には何も重ねず、背景そのものを見せる（しるしは角に小さく） */}
                  <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-[17px] ring-1 ring-inset ring-[rgba(120,100,70,.08)]">
                    <BackgroundArt id={bg.id} zoom={0.6} />
                    {bg.tag ? (
                      <span className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-black text-leaf-deep shadow-sm ${GLASS}`}>{bg.tag}</span>
                    ) : null}
                    {status === "using" ? (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-leaf text-white shadow-md">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                    ) : trying ? (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-[#2F6FC2] px-2 py-0.5 text-[10px] font-black text-white shadow-md">おためし中</span>
                    ) : null}
                  </span>
                  <span className="flex flex-col gap-1 px-1 pb-0.5 pt-2">
                    <span className="truncate text-[13px] font-black leading-tight">{bg.name}</span>
                    <span className="truncate text-[10px] leading-tight text-ink-faint">{bg.sub}</span>
                    <StatusPill status={status} price={bg.price} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {selected ? (
        <BackgroundDialog
          key={selected}
          id={selected}
          status={statusOf(selected)}
          blueCoins={blueCoins}
          onClose={() => setSelected(null)}
          onTry={() => {
            setTryOnBackground(selected === current ? null : selected);
            setSelected(null);
          }}
          onBought={(balance) => {
            setBlueCoins(balance);
            setOwned((prev) => new Set(prev).add(selected));
          }}
          onApplied={() => {
            setTryOnBackground(null);
            setCurrent(selected);
            setSelected(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function StatusPill({ status, price }: { status: Status; price: number }) {
  if (status === "using") {
    return <span className="mt-0.5 rounded-full bg-leaf py-1 text-center text-[11px] font-black text-white">使用中</span>;
  }
  if (status === "owned") {
    return <span className="mt-0.5 rounded-full bg-leaf-soft py-1 text-center text-[11px] font-black text-leaf-deep">持っています</span>;
  }
  return (
    <span className="mt-0.5 flex items-center justify-center gap-1 rounded-full bg-[#2F6FC2] py-1 text-[11px] font-black tabular-nums text-white">
      <BlueCoinArt className="h-3.5 w-3.5 shrink-0" />
      {price.toLocaleString()}
    </span>
  );
}

function BackgroundDialog({ id, status, blueCoins, onClose, onTry, onBought, onApplied }: {
  id: AppBackgroundId;
  status: Status;
  blueCoins: number;
  onClose: () => void;
  onTry: () => void;
  onBought: (balance: number) => void;
  onApplied: () => void;
}) {
  const bg = getAppBackground(id);
  const variants = BACKGROUND_VARIANTS[id] ?? NO_VARIANTS;
  const [variantKey, setVariantKey] = useState(() => defaultVariantKey(id, new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const short = status === "locked" ? bg.price - blueCoins : 0;
  const signals = useMemo(() => variants.find((v) => v.key === variantKey)?.signals ?? {}, [variants, variantKey]);
  const touchable = bg.tag === "さわれる";

  async function request(method: "POST" | "PATCH") {
    const response = await fetch("/api/app-background", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ background: id }),
    });
    const payload = (await response.json().catch(() => null)) as { balance?: number; error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? "うまくいきませんでした。");
    return payload;
  }

  /** 買っていなければ買ってから、使う背景にする */
  async function apply() {
    setBusy(true);
    setError(null);
    try {
      if (status === "locked") {
        const bought = await request("POST");
        onBought(bought?.balance ?? 0);
      }
      await request("PATCH");
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "うまくいきませんでした。");
      setBusy(false);
    }
  }

  // ページ本体（main）は表示のアニメーションで transform を持つので、その中では fixed が画面に固定されない。
  // ダイアログは body の直下に出す
  return createPortal(
    <div
      className="fixed inset-0 z-[700] flex items-end justify-center bg-[#140f22]/55 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={bg.name}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-[28px] bg-card p-3 shadow-2xl">
        <div
          className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] ring-1 ring-[rgba(120,100,70,.14)]"
          data-live-tap={touchable ? "" : undefined}
          onPointerDown={() => setTouched(true)}
        >
          {/* 大きな見本は、実際の画面と同じ大きさの柄で、動くものは動かして見せる */}
          <Swatch id={id} zoom={1} mode="preview" signals={signals} />
          {bg.tag ? (
            <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-black text-leaf-deep shadow-sm ${GLASS}`}>{bg.tag}</span>
          ) : null}
          {status === "using" ? (
            <span className={`absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black text-leaf-deep shadow-sm ${GLASS}`}>
              <CheckIcon className="h-3.5 w-3.5" />使用中
            </span>
          ) : null}
          {touchable && !touched ? (
            <span className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[12px] font-black text-ink shadow-md ${GLASS}`}>
              見本をタップしてみてね
            </span>
          ) : null}
          {variants.length ? (
            <div
              className={`absolute inset-x-3 bottom-3 grid gap-1 rounded-2xl p-1 shadow-sm ${GLASS}`}
              style={{ gridTemplateColumns: `repeat(${Math.min(4, variants.length)}, minmax(0, 1fr))` }}
              role="group"
              aria-label="見たい様子を選ぶ"
            >
              {variants.map((variant) => (
                <button
                  key={variant.key}
                  type="button"
                  aria-pressed={variantKey === variant.key}
                  onClick={() => setVariantKey(variant.key)}
                  className={`rounded-xl px-1 py-1.5 text-[11px] font-black transition ${variantKey === variant.key ? "bg-ink text-card" : "text-ink-soft"}`}
                >
                  {variant.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="px-1.5 pb-1 pt-3">
          <p className="text-lg font-black">{bg.name}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{bg.description}</p>
          {status === "locked" ? (
            <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-black tabular-nums text-[#1F4F8F]">
              <span className="flex items-center gap-1"><BlueCoinArt className="h-4 w-4" />{bg.price.toLocaleString()}枚</span>
              <span className="text-[11px] font-bold text-ink-faint">
                のこり {blueCoins.toLocaleString()}枚{short <= 0 ? ` → ${(blueCoins - bg.price).toLocaleString()}枚` : ""}
              </span>
            </p>
          ) : null}
          {short > 0 ? (
            <p className="mt-2 rounded-2xl bg-[#FFF1F3] px-3 py-2 text-center text-[12px] font-bold text-[#b94c60]">
              青コインが あと{short.toLocaleString()}枚 たりません
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 rounded-2xl bg-[#FFF1F3] px-3 py-2 text-center text-[12px] font-bold text-[#b94c60]">{error}</p>
          ) : null}
          {status !== "using" ? (
            <button
              type="button"
              disabled={busy}
              onClick={onTry}
              className="mt-3 w-full rounded-full border-[1.5px] border-[#2F6FC2] bg-card py-2 text-[13px] font-black text-[#2F6FC2] active:scale-[.98]"
            >
              アプリでためす（買う前に、ホームなどで見られます）
            </button>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-full border border-line bg-paper py-2.5 text-sm font-bold text-ink-soft active:scale-[.98]"
            >
              {status === "using" ? "とじる" : "やめる"}
            </button>
            {status === "using" ? (
              <span className="rounded-full bg-leaf-soft py-2.5 text-center text-sm font-black text-leaf-deep">使用中です</span>
            ) : short > 0 ? (
              <Link href="/games/osanpo-run" className="rounded-full bg-[#2F6FC2] py-2.5 text-center text-sm font-black text-white active:scale-[.98]">
                おさんぽで ためる
              </Link>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply()}
                className={`rounded-full py-2.5 text-sm font-black text-white shadow-md active:scale-[.98] disabled:opacity-60 ${status === "locked" ? "bg-[#2F6FC2]" : "bg-leaf"}`}
              >
                {busy ? "変えています…" : status === "locked" ? "買って使う" : "この背景にする"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
