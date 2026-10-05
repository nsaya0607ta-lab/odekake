"use client";

/**
 * わんこのおへや：青コインのお店。
 * - FurnitureShop … もようがえの「家具」タブと「窓・棚」タブ。1種類あたり持てる数まで買え、買ったものはタップで部屋に置ける
 * - BuyDialog … 1つ買うときの確認（家具・窓や棚・もようがえのデザインで共通）
 * 青コインは「おさんぽフレンチー」・はじめての場所の登録・通算7日ごとのログインでもらえる（src/lib/blue-coin-rewards.ts）。
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BlueCoinArt } from "@/components/coin-art";
import { BLUE_COIN_SOURCES_SHORT } from "@/lib/blue-coin-rewards";
import { FIXTURES, FURNITURE, isFixtureId, shopKey, shopMax, shopName, shopPrice, type DecorEntry, type FixtureId, type FurnitureId, type RoomShop, type ShopId } from "@/lib/room/types";

/** 部屋に置くもの（家具と、窓・棚など） */
type PlaceableId = FurnitureId | FixtureId;

/** 青コインの残高と、ためかた */
export function BlueCoinBar({ shop, note }: { shop: Pick<RoomShop, "blueCoins">; note: string }) {
  return (
    <>
      <div className="flex items-center gap-2.5 rounded-2xl border border-[#BFD7F5] bg-[linear-gradient(135deg,#F2F8FF,#E3EFFD)] px-3 py-2.5">
        <BlueCoinArt className="h-8 w-8 shrink-0 drop-shadow-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-[#3D6FB0]">青コイン</p>
          <p className="text-lg font-black leading-tight tabular-nums text-[#1F4F8F]">{shop.blueCoins.toLocaleString()}<span className="ml-0.5 text-[11px]">枚</span></p>
        </div>
        <Link href="/games/osanpo-run" className="shrink-0 rounded-full bg-[#2F6FC2] px-3 py-1.5 text-[11px] font-black text-white shadow-sm active:scale-95">おさんぽで ためる →</Link>
      </div>
      <p className="mt-1.5 text-[10px] font-semibold text-ink-faint">{BLUE_COIN_SOURCES_SHORT}{note}</p>
    </>
  );
}

/** 1つ買うときの確認。買えたら onDone（持っている数と、のこりの青コイン） */
export function BuyDialog({ id, blueCoins, thumb, actionLabel = "買う", onDone, onClose }: {
  id: ShopId;
  blueCoins: number;
  thumb: ReactNode;
  actionLabel?: string;
  onDone: (owned: number, balance: number) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = shopPrice(id), short = price - blueCoins;
  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/my-room/furniture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ furniture: id }) });
      const payload = (await response.json().catch(() => null)) as { owned?: number; balance?: number; error?: string } | null;
      if (!response.ok || typeof payload?.owned !== "number") throw new Error(payload?.error ?? "買えませんでした。");
      onDone(payload.owned, payload.balance ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "買えませんでした。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[700] flex items-end justify-center bg-[#140f22]/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={`${shopName(id)}を買う`} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="room-bubble w-full max-w-sm rounded-3xl bg-card p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="block w-20 shrink-0 overflow-hidden rounded-2xl bg-paper p-1.5">{thumb}</span>
          <div className="min-w-0">
            <p className="text-base font-black">{shopName(id)}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm font-black tabular-nums text-[#1F4F8F]"><BlueCoinArt className="h-4 w-4" />{price.toLocaleString()}枚</p>
            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-ink-faint">のこり {blueCoins.toLocaleString()}枚{short <= 0 ? ` → ${(blueCoins - price).toLocaleString()}枚` : ""}</p>
          </div>
        </div>
        {short > 0 ? <p className="mt-3 rounded-2xl bg-[#FFF1F3] px-3 py-2 text-center text-[12px] font-bold text-[#b94c60]">青コインが あと{short.toLocaleString()}枚 たりません</p> : null}
        {error ? <p role="alert" className="mt-3 rounded-2xl bg-[#FFF1F3] px-3 py-2 text-center text-[12px] font-bold text-[#b94c60]">{error}</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-full border border-line bg-paper py-2.5 text-sm font-bold text-ink-soft active:scale-[.98]">やめる</button>
          {short > 0 ? (
            <Link href="/games/osanpo-run" className="rounded-full bg-[#2F6FC2] py-2.5 text-center text-sm font-black text-white active:scale-[.98]">おさんぽで ためる</Link>
          ) : (
            <button type="button" disabled={busy} onClick={() => void buy()} className="rounded-full bg-[#2F6FC2] py-2.5 text-sm font-black text-white shadow-md active:scale-[.98] disabled:opacity-60">{busy ? "買っています…" : actionLabel}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FurnitureShop({ ids, what, shop, placedOf, onPlace, onBought, thumb }: {
  /** 並べるもの */
  ids: readonly PlaceableId[];
  /** 何のお店か（「家具」「窓・棚」） */
  what: string;
  shop: RoomShop;
  /** 部屋に置いている数 */
  placedOf: (key: string) => number;
  /** 部屋に置く（count は持っている数） */
  onPlace: (entry: DecorEntry) => void;
  /** 買えたとき（持っている数と、のこりの青コイン） */
  onBought: (id: ShopId, owned: number, balance: number) => void;
  /** 小さな絵（窓や時計は、部屋の見た目に合わせて描くので、外からわたす） */
  thumb: (entry: DecorEntry) => ReactNode;
}) {
  const [buying, setBuying] = useState<PlaceableId | null>(null);
  const entryOf = (id: PlaceableId, count: number): DecorEntry => (isFixtureId(id)
    ? { kind: "fixture", key: shopKey(id), name: FIXTURES[id].name, fixture: id, count }
    : { kind: "furniture", key: shopKey(id), name: FURNITURE[id].name, furniture: id, count });

  return (
    <div className="mt-2">
      <BlueCoinBar shop={shop} note={`${what}は1種類につき、持てる数まで買えます。`} />
      <div className="mt-2 grid grid-cols-3 gap-2.5">
        {ids.map((id) => {
          const owned = shop.owned[id] ?? 0, key = shopKey(id), placed = placedOf(key), max = shopMax(id);
          const canBuy = owned < max;
          return (
            <button
              key={id} type="button"
              onClick={() => { if (owned > placed || !canBuy) onPlace(entryOf(id, owned)); else setBuying(id); }}
              className={`relative min-w-0 rounded-2xl border bg-paper p-2 text-left shadow-sm transition active:scale-[.97] ${placed ? "border-leaf/60" : "border-line"}`}
            >
              <span className={`absolute right-1.5 top-1.5 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${owned ? "bg-card/90 text-ink-soft" : "bg-[#E3EFFD] text-[#3D6FB0]"}`}>{owned ? `${placed}/${owned}` : "未購入"}</span>
              <span className={`flex aspect-square items-center justify-center pt-3 ${owned ? "" : "opacity-55 saturate-[.6]"}`}>
                <span className="block w-[78%]">{thumb(entryOf(id, owned))}</span>
              </span>
              <span className="mt-1 block truncate text-center text-[10px] font-bold">{shopName(id)}</span>
              {canBuy && owned <= placed ? (
                <span className="mt-1 flex items-center justify-center gap-0.5 rounded-full bg-[#2F6FC2] py-0.5 text-[10px] font-black tabular-nums text-white">
                  <BlueCoinArt className="h-3.5 w-3.5 shrink-0" />{shopPrice(id).toLocaleString()}<span className="text-[9px]">{owned ? "で+1こ" : "で買う"}</span>
                </span>
              ) : (
                <span className="mt-1 block rounded-full bg-leaf-soft py-0.5 text-center text-[10px] font-black text-leaf-deep">{owned > placed ? "タップで置く" : `${max}こ 持っています`}</span>
              )}
            </button>
          );
        })}
      </div>

      {buying ? (
        <BuyDialog
          id={buying} blueCoins={shop.blueCoins} thumb={thumb(entryOf(buying, 1))} actionLabel="買って置く"
          onClose={() => setBuying(null)}
          onDone={(owned, balance) => {
            const id = buying;
            onBought(id, owned, balance);
            setBuying(null);
            // 買ったら、そのまま部屋に置く
            onPlace(entryOf(id, owned));
          }}
        />
      ) : null}
    </div>
  );
}
