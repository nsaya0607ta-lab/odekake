"use client";

/**
 * ショップ：アプリの背景を青コインで買って、使う背景を選ぶ。
 * 見本は、本物と同じ背景（app-backgrounds.css）だけを描いている。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppBackgroundPreview } from "@/components/app-background";
import { BlueCoinArt } from "@/components/coin-art";
import { BlueCoinBar } from "@/components/room/room-shop";
import { APP_BACKGROUNDS, getAppBackground, skyTimeOf, type AppBackgroundId, type SkyTime } from "@/lib/app-backgrounds";

/** 時間で変わる空の見本に並べる時間帯 */
const SKY_TIMES: { time: SkyTime; label: string }[] = [
  { time: "morning", label: "朝" },
  { time: "day", label: "昼" },
  { time: "evening", label: "夕方" },
  { time: "night", label: "夜" },
];

/**
 * 背景だけの見本。zoom で柄の大きさを決める（1 で実際の画面と同じ大きさ）。
 * 中身を zoom 分の1の大きさで描いてから縮めるので、小さな枠でも柄の密度が実物に近く見える。
 */
function Swatch({ id, time, zoom }: { id: AppBackgroundId; time?: SkyTime; zoom: number }) {
  const size = `${100 / zoom}%`;
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: size, height: size, transform: `scale(${zoom})` }}>
        <AppBackgroundPreview id={id} time={time} />
      </div>
    </div>
  );
}

/** 一覧・大きな見本の絵。時間で変わる空は、朝・昼・夕方・夜を縦に4つ並べる */
function BackgroundArt({ id, zoom }: { id: AppBackgroundId; zoom: number }) {
  if (id !== "sky-clock") return <Swatch id={id} zoom={zoom} />;
  return (
    <div className="absolute inset-0 grid grid-cols-4" aria-hidden="true">
      {SKY_TIMES.map(({ time }) => (
        <div key={time} className="relative">
          <Swatch id={id} time={time} zoom={zoom} />
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

/** 一覧のタイルと大きな見本の、すりガラスの札 */
const GLASS = "bg-[rgba(255,253,248,.8)] backdrop-blur-md [-webkit-backdrop-filter:blur(12px)]";

export function BackgroundShop({ current: initialCurrent, owned: initialOwned, blueCoins: initialBlueCoins }: {
  current: AppBackgroundId;
  owned: AppBackgroundId[];
  blueCoins: number;
}) {
  const router = useRouter();
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

      <section>
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-base font-bold">背景</h2>
          <span className="text-[11px] text-ink-faint">タップで大きく見られます</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {APP_BACKGROUNDS.map((bg) => {
            const status = statusOf(bg.id);
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => setSelected(bg.id)}
                aria-label={`${bg.name}（${status === "using" ? "使用中" : status === "owned" ? "持っています" : `青コイン${bg.price.toLocaleString()}枚`}）`}
                className={`flex min-w-0 flex-col rounded-[22px] bg-card p-1.5 text-left shadow-[0_6px_16px_rgba(90,70,40,.1)] transition active:scale-[.98] ${
                  status === "using" ? "ring-[2.5px] ring-leaf" : "ring-1 ring-[rgba(120,100,70,.14)]"
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

      {selected ? (
        <BackgroundDialog
          id={selected}
          status={statusOf(selected)}
          blueCoins={blueCoins}
          onClose={() => setSelected(null)}
          onBought={(balance) => {
            setBlueCoins(balance);
            setOwned((prev) => new Set(prev).add(selected));
          }}
          onApplied={() => {
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

function BackgroundDialog({ id, status, blueCoins, onClose, onBought, onApplied }: {
  id: AppBackgroundId;
  status: Status;
  blueCoins: number;
  onClose: () => void;
  onBought: (balance: number) => void;
  onApplied: () => void;
}) {
  const bg = getAppBackground(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skyTime, setSkyTime] = useState<SkyTime>(() => skyTimeOf(new Date()));
  const short = status === "locked" ? bg.price - blueCoins : 0;

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

  return (
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
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] ring-1 ring-[rgba(120,100,70,.14)]">
          {/* 大きな見本は、実際の画面と同じ大きさの柄で見せる */}
          <Swatch id={id} time={id === "sky-clock" ? skyTime : undefined} zoom={1} />
          {bg.tag ? (
            <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-black text-leaf-deep shadow-sm ${GLASS}`}>{bg.tag}</span>
          ) : null}
          {status === "using" ? (
            <span className={`absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black text-leaf-deep shadow-sm ${GLASS}`}>
              <CheckIcon className="h-3.5 w-3.5" />使用中
            </span>
          ) : null}
          {id === "sky-clock" ? (
            <div className={`absolute inset-x-3 bottom-3 grid grid-cols-4 gap-1 rounded-2xl p-1 shadow-sm ${GLASS}`} role="group" aria-label="時間帯を選んで見る">
              {SKY_TIMES.map(({ time, label }) => (
                <button
                  key={time}
                  type="button"
                  aria-pressed={skyTime === time}
                  onClick={() => setSkyTime(time)}
                  className={`rounded-xl py-1.5 text-[11px] font-black transition ${skyTime === time ? "bg-ink text-card" : "text-ink-soft"}`}
                >
                  {label}
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
          <div className="mt-3 grid grid-cols-2 gap-2">
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
    </div>
  );
}
