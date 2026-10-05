"use client";

/**
 * ショップ：アプリの背景を青コインで買って、使う背景を選ぶ。
 * 見本は、ホーム画面を小さくした絵の後ろに、本物と同じ背景（app-backgrounds.css）を描いている。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppBackgroundPreview } from "@/components/app-background";
import { BlueCoinArt } from "@/components/coin-art";
import { BlueCoinBar } from "@/components/room/room-shop";
import { APP_BACKGROUNDS, getAppBackground, type AppBackgroundId } from "@/lib/app-backgrounds";

/** 見本の元の大きさ（スマホの画面の幅） */
const PREVIEW_WIDTH = 390;
const PREVIEW_HEIGHT = 600;

/** ホーム画面を小さくした見本。枠の幅に合わせて縮める */
function BackgroundPreview({ id, className = "" }: { id: AppBackgroundId; className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / PREVIEW_WIDTH);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const glass = id !== "default";
  return (
    <div
      ref={frameRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: `${PREVIEW_WIDTH} / ${PREVIEW_HEIGHT}` }}
      aria-hidden="true"
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, transform: `scale(${scale})` }}
      >
        <AppBackgroundPreview id={id} />
        <div className="relative flex h-full flex-col">
          <div className={`flex h-16 shrink-0 items-center gap-3 border-b px-4 ${glass ? "border-line/45 bg-[rgba(255,253,248,.6)]" : "border-line bg-paper/92"}`}>
            <span className="h-10 w-10 rounded-full bg-paper-deep" />
            <span className="h-4 w-20 rounded-full bg-ink-faint/40" />
            <span className="ml-auto h-8 w-24 rounded-full bg-sun-soft" />
          </div>
          <div className="flex flex-1 flex-col gap-3 px-4 pt-4">
            <div className="rough-card relative h-[190px] overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(180deg,#cfe3b4,#b8d59a)]" />
              <div className="absolute left-[18%] top-[22%] h-24 w-40 rounded-[50%] bg-[#bcd6b0]" />
              <div className="absolute right-3 top-3 flex w-[120px] flex-col gap-1.5">
                <span className="h-8 rounded-full bg-[#fff5df]" />
                <span className="h-8 rounded-full bg-[#fff5df]" />
                <span className="h-8 rounded-full bg-[#fff5df]" />
              </div>
            </div>
            <div className="rough-card h-[78px]" />
            <div className="rough-card h-[150px]" />
          </div>
          <div className={`flex h-[70px] shrink-0 items-center justify-around border-t px-4 ${glass ? "border-line/45 bg-[rgba(255,253,248,.66)]" : "border-line bg-card/95"}`}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} className={`rounded-xl bg-ink-faint/25 ${i === 3 ? "h-11 w-11" : "h-7 w-7"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type Status = "using" | "owned" | "locked";

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

  return (
    <>
      <BlueCoinBar shop={{ blueCoins }} note="買った背景は、アプリ全体の背景になります。いつでも切り替えられます。" />

      <section>
        <h2 className="px-1 text-base font-bold">背景</h2>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {APP_BACKGROUNDS.map((bg) => {
            const status = statusOf(bg.id);
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => setSelected(bg.id)}
                className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition active:scale-[.98] ${status === "using" ? "border-leaf ring-2 ring-leaf/40" : "border-line"}`}
              >
                <span className="relative block">
                  <BackgroundPreview id={bg.id} />
                  {bg.tag ? (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-bold text-leaf-deep">{bg.tag}</span>
                  ) : null}
                </span>
                <span className="flex flex-col gap-1 px-2.5 pb-2.5 pt-2">
                  <span className="truncate text-sm font-bold">{bg.name}</span>
                  <span className="truncate text-[11px] text-ink-faint">{bg.sub}</span>
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
    return <span className="rounded-full bg-leaf py-1 text-center text-[11px] font-black text-white">使用中</span>;
  }
  if (status === "owned") {
    return <span className="rounded-full bg-leaf-soft py-1 text-center text-[11px] font-black text-leaf-deep">持っています</span>;
  }
  return (
    <span className="flex items-center justify-center gap-1 rounded-full bg-[#2F6FC2] py-1 text-[11px] font-black tabular-nums text-white">
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
      className="fixed inset-0 z-[700] flex items-end justify-center bg-[#140f22]/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={bg.name}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl bg-card p-4 shadow-2xl">
        <div className="mx-auto w-[62%] overflow-hidden rounded-2xl border border-line">
          <BackgroundPreview id={id} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <p className="text-base font-black">{bg.name}</p>
          {bg.tag ? <span className="rounded-full border border-leaf px-2 py-0.5 text-[10px] font-bold text-leaf-deep">{bg.tag}</span> : null}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{bg.description}</p>
        {status === "locked" ? (
          <>
            <p className="mt-2 flex items-center gap-1 text-sm font-black tabular-nums text-[#1F4F8F]">
              <BlueCoinArt className="h-4 w-4" />
              {bg.price.toLocaleString()}枚
              <span className="ml-1 text-[11px] font-bold text-ink-faint">
                のこり {blueCoins.toLocaleString()}枚{short <= 0 ? ` → ${(blueCoins - bg.price).toLocaleString()}枚` : ""}
              </span>
            </p>
            {short > 0 ? (
              <p className="mt-2 rounded-2xl bg-[#FFF1F3] px-3 py-2 text-center text-[12px] font-bold text-[#b94c60]">
                青コインが あと{short.toLocaleString()}枚 たりません
              </p>
            ) : null}
          </>
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
  );
}
