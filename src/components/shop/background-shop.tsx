"use client";

/**
 * ショップ：アプリの背景を青コインで買って、使う背景を選ぶ。
 * - 上のタブで「背景」「ホームのカード」「並び・透け感」を切りかえる。背景は種類のボタンでしぼりこめ、「すべて」は種類ごとに横に並べる
 * - タップすると大きな見本が開き、動く背景はそのまま動く（さわれる背景は、見本をさわると反応する）
 * - 変わる背景は「雨のとき」「10,000歩のとき」などを切りかえて見られる
 * - 「アプリでためす」で、買う前にアプリ全体の背景を一時的に切りかえられる
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AppBackgroundPreview } from "@/components/app-background";
import { BlueCoinArt } from "@/components/coin-art";
import { requestTiltPermission, type LiveMode } from "@/components/live-backgrounds/engine";
import { setTryOnBackground, useTryOnBackground } from "@/components/live-backgrounds/try-on";
import { HomeLookEditor } from "@/components/shop/home-look-editor";
import { HomeSkinShop } from "@/components/shop/home-skin-shop";
import {
  APP_BACKGROUND_GROUPS,
  APP_BACKGROUNDS,
  BACKGROUND_VARIANTS,
  POSTER_VARIANTS,
  defaultVariantKey,
  getAppBackground,
  type AppBackgroundGroup,
  type AppBackgroundId,
  type BackgroundSignals,
  type BackgroundVariant,
} from "@/lib/app-backgrounds";
import type { HomeLook } from "@/lib/home-look";
import type { HomeSkins } from "@/lib/home-skins";

const NO_VARIANTS: readonly BackgroundVariant[] = [];

/** ショップの売り場（いちばん上のタブ） */
const SHOP_TABS = [
  { id: "bg", label: "背景", sub: "アプリ全体" },
  { id: "cards", label: "ホームのカード", sub: "冬・豪華など" },
  { id: "look", label: "並び・透け感", sub: "無料" },
] as const;
type ShopTab = (typeof SHOP_TABS)[number]["id"];
const isShopTab = (v: string): v is ShopTab => SHOP_TABS.some((t) => t.id === v);

/** 背景の種類のしぼりこみ */
type GroupFilter = "all" | "owned" | AppBackgroundGroup;
const GROUP_LABELS: Record<AppBackgroundGroup, string> = {
  move: "動く",
  trace: "なぞる",
  tilt: "かたむける",
  change: "変わる",
  record: "記録で育つ",
  art: "シンプル",
  pattern: "柄・風景",
};
const GROUP_FILTERS: readonly { id: GroupFilter; label: string }[] = [
  { id: "all", label: "すべて" },
  ...APP_BACKGROUND_GROUPS.map((g) => ({ id: g.id as GroupFilter, label: GROUP_LABELS[g.id] })),
  { id: "owned", label: "持っている" },
];

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

export function BackgroundShop({ current: initialCurrent, owned: initialOwned, blueCoins: initialBlueCoins, homeLook, homeSkins, ownedHomeSkins }: {
  current: AppBackgroundId;
  owned: AppBackgroundId[];
  blueCoins: number;
  homeLook: HomeLook;
  homeSkins: HomeSkins;
  /** 買ったカードの絵がら。DB の準備がまだなら null */
  ownedHomeSkins: string[] | null;
}) {
  const router = useRouter();
  const tryOn = useTryOnBackground();
  const [current, setCurrent] = useState(initialCurrent);
  const [owned, setOwned] = useState(() => new Set<AppBackgroundId>(["default", ...initialOwned]));
  const [blueCoins, setBlueCoins] = useState(initialBlueCoins);
  const [selected, setSelected] = useState<AppBackgroundId | null>(null);

  const [tab, setTab] = useState<ShopTab>("bg");
  const [group, setGroup] = useState<GroupFilter>("all");

  // URL の #cards などで、そのタブを開く（ホームの「着せかえ」から来たときなど）
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (isShopTab(hash)) setTab(hash);
  }, []);
  const chooseTab = (next: ShopTab) => {
    setTab(next);
    window.history.replaceState(null, "", next === "bg" ? window.location.pathname : `#${next}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const statusOf = (id: AppBackgroundId): Status => (id === current ? "using" : owned.has(id) ? "owned" : "locked");
  const currentBg = getAppBackground(current);
  const ownedCount = APP_BACKGROUNDS.filter((bg) => bg.id !== "default" && owned.has(bg.id)).length;

  const tile = (bg: (typeof APP_BACKGROUNDS)[number], size: "row" | "grid") => {
    const status = statusOf(bg.id);
    const trying = tryOn === bg.id;
    return (
      <button
        key={bg.id}
        type="button"
        onClick={() => setSelected(bg.id)}
        aria-label={`${bg.name}（${status === "using" ? "使用中" : status === "owned" ? "持っています" : `青コイン${bg.price.toLocaleString()}枚`}）`}
        className={`flex min-w-0 flex-col rounded-[18px] bg-card p-1 text-left shadow-[0_4px_12px_rgba(90,70,40,.1)] transition active:scale-[.97] ${
          size === "row" ? "w-[112px] shrink-0 snap-start" : ""
        } ${status === "using" ? "ring-[2.5px] ring-leaf" : trying ? "ring-[2.5px] ring-[#2F6FC2]" : "ring-1 ring-[rgba(120,100,70,.14)]"}`}
      >
        {/* 見本の上には何も重ねず、背景そのものを見せる（しるしは角に小さく） */}
        <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-[14px] ring-1 ring-inset ring-[rgba(120,100,70,.08)]">
          <BackgroundArt id={bg.id} zoom={0.5} />
          {bg.tag ? (
            <span className={`absolute left-1 top-1 rounded-full px-1.5 py-px text-[9px] font-black text-leaf-deep shadow-sm ${GLASS}`}>{bg.tag}</span>
          ) : null}
          {status === "using" ? (
            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-leaf text-white shadow-md">
              <CheckIcon className="h-3 w-3" />
            </span>
          ) : trying ? (
            <span className="absolute right-1 top-1 rounded-full bg-[#2F6FC2] px-1.5 py-px text-[9px] font-black text-white shadow-md">おためし</span>
          ) : null}
        </span>
        <span className="flex flex-col gap-0.5 px-0.5 pb-0.5 pt-1.5">
          <span className="truncate text-[12px] font-black leading-tight">{bg.name}</span>
          <StatusPill status={status} price={bg.price} />
        </span>
      </button>
    );
  };

  const visible = (id: GroupFilter) =>
    APP_BACKGROUNDS.filter((bg) => (id === "owned" ? owned.has(bg.id) : id === "all" ? true : bg.group === id));

  return (
    <>
      {/* 青コイン（1行にまとめる） */}
      <div className="flex items-center gap-2 rounded-2xl border border-[#BFD7F5] bg-[linear-gradient(135deg,#F2F8FF,#E3EFFD)] py-2 pl-2.5 pr-2">
        <BlueCoinArt className="h-7 w-7 shrink-0 drop-shadow-sm" />
        <p className="min-w-0 flex-1 text-[11px] font-bold text-[#3D6FB0]">
          青コイン <span className="text-lg font-black tabular-nums text-[#1F4F8F]">{blueCoins.toLocaleString()}</span>
          <span className="text-[11px] text-[#1F4F8F]">枚</span>
        </p>
        <Link href="/games/osanpo-run" className="shrink-0 rounded-full bg-[#2F6FC2] px-3 py-1.5 text-[11px] font-black text-white shadow-sm active:scale-95">ためる →</Link>
      </div>

      {/* いちばん上のタブ（ヘッダーの下にくっつく） */}
      <div className="sticky top-[69px] z-20 -mx-4 bg-[rgba(251,248,241,.92)] px-4 pb-2 pt-2 backdrop-blur-md" role="tablist" aria-label="ショップの売り場">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-paper-deep p-1 ring-1 ring-[rgba(120,100,70,.12)]">
          {SHOP_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => chooseTab(item.id)}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition ${tab === item.id ? "bg-card text-ink shadow-sm" : "text-ink-faint"}`}
            >
              <span className="text-[13px] font-black leading-tight">{item.label}</span>
              <span className="text-[9.5px] font-bold leading-tight opacity-80">{item.sub}</span>
            </button>
          ))}
        </div>

        {tab === "bg" ? (
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="背景の種類">
            {GROUP_FILTERS.map((item) => {
              const count = visible(item.id).length;
              const on = group === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setGroup(item.id);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-black transition ${
                    on ? "bg-ink text-card" : "bg-card text-ink-soft ring-1 ring-[rgba(120,100,70,.16)]"
                  }`}
                >
                  {item.label}
                  <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${on ? "bg-white/20" : "bg-paper-deep text-ink-faint"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {tab === "bg" ? (
        <>
          <button
            type="button"
            onClick={() => setSelected(current)}
            className="relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] bg-card p-1.5 pr-3 text-left shadow-[0_4px_12px_rgba(90,70,40,.1)] ring-1 ring-[rgba(120,100,70,.14)] active:scale-[.99]"
          >
            <span className="relative block h-14 w-24 shrink-0 overflow-hidden rounded-[14px]">
              <BackgroundArt id={current} zoom={0.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold text-ink-faint">いま使っている背景</span>
              <span className="block truncate text-sm font-black">{currentBg.name}</span>
            </span>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf text-white"><CheckIcon className="h-3.5 w-3.5" /></span>
          </button>

          {group === "all" ? (
            APP_BACKGROUND_GROUPS.map((g) => {
              const items = APP_BACKGROUNDS.filter((bg) => bg.group === g.id);
              return (
                <section key={g.id} aria-label={g.title}>
                  <div className="flex items-end justify-between gap-2 px-1">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-black">{g.title}<span className="ml-1.5 text-[11px] font-bold text-ink-faint">{items.length}</span></h2>
                      <p className="mt-0.5 line-clamp-1 text-[10.5px] text-ink-faint">{g.note}</p>
                    </div>
                    <button type="button" onClick={() => setGroup(g.id)} className="shrink-0 rounded-full bg-paper-deep px-2.5 py-1 text-[11px] font-black text-ink-soft active:scale-95">
                      すべて見る
                    </button>
                  </div>
                  <div className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                    {items.map((bg) => tile(bg, "row"))}
                  </div>
                </section>
              );
            })
          ) : (
            <section aria-label={GROUP_FILTERS.find((f) => f.id === group)?.label}>
              {group !== "owned" ? (
                <p className="px-1 text-[11px] text-ink-faint">{APP_BACKGROUND_GROUPS.find((g) => g.id === group)?.note}</p>
              ) : ownedCount === 0 ? (
                <p className="rounded-2xl bg-card px-4 py-6 text-center text-[12px] text-ink-faint ring-1 ring-[rgba(120,100,70,.14)]">まだ買った背景はありません</p>
              ) : null}
              <div className="mt-2 grid grid-cols-3 gap-2">{visible(group).map((bg) => tile(bg, "grid"))}</div>
            </section>
          )}
        </>
      ) : tab === "cards" ? (
        <HomeSkinShop initialSkins={homeSkins} initialOwned={ownedHomeSkins} blueCoins={blueCoins} onBalance={setBlueCoins} />
      ) : (
        <HomeLookEditor initial={homeLook} />
      )}

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
  const touchable = bg.tag === "さわれる" || bg.tag === "なぞれる" || bg.tag === "かたむける";
  const traceable = bg.group === "trace" || id === "snow-globe";
  const tiltable = bg.group === "tilt";
  const hint = bg.tag === "なぞれる" ? "見本を指でなぞってみてね" : tiltable ? "スマホをかたむけてみてね（タップでも）" : "見本をタップしてみてね";

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
          // なぞる背景は、見本の上でなぞってもダイアログがスクロールしないようにする
          style={traceable ? { touchAction: "none" } : undefined}
          onPointerDown={() => {
            setTouched(true);
            // iPhone は、さわった直後にしか「かたむき」の許可を聞けない
            if (tiltable) void requestTiltPermission();
          }}
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
              {hint}
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
              onClick={() => {
                if (tiltable) void requestTiltPermission();
                onTry();
              }}
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
                onClick={() => {
                  if (tiltable) void requestTiltPermission();
                  void apply();
                }}
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
