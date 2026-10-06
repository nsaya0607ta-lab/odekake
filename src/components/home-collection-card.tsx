import { CARD_BLEED } from "@/lib/home-card-layout";
import Image from "next/image";
import Link from "next/link";
import { ItemArt } from "@/components/collection/item-art";
import { IconChevronRight } from "@/components/icons";
import type { ItemArtKey } from "@/lib/collection/items";
import type { GachaRarity } from "@/lib/gacha/config";

/**
 * ホームの「図鑑」カード。
 *
 * public/collection-card.webp は本と花の水彩イラストだけが描かれた透明背景の枠。
 * 文字・バー・アイテムはすべて重ねて描く（件数が変わっても絵を描き直す必要はない）。
 *
 * 本のイラストは絵の左 32.4%、花のイラストは右 89.8% から始まるので、
 * 中身はその間（左 35% 〜 右 11% を除いた範囲）に収める。
 * 中身は「集めた数・のこり・進み具合」と「最近手に入れたアイテム（24時間以内は NEW）」。
 */
const CARD_RATIO = "2172 / 724";

const CARD_SRC = "/collection-card.webp";

export type HomeCollectionRecentItem = {
  id: string;
  name: string;
  image: string | null;
  art?: ItemArtKey;
  rarity: GachaRarity;
  isNew: boolean;
};

/** アイテムのまわりの輪の色（レアほど目立つ色） */
const RARITY_RING: Record<GachaRarity, string> = {
  N: "#D9CDB4",
  R: "#8CC4E8",
  SR: "#F0C04E",
  SSR: "#F08FA8",
  UR: "#E0605A",
  LR: "#B07A1E",
  MR: "#4B3F9E",
};

export function HomeCollectionCard({
  collected,
  total,
  recent,
}: {
  collected: number;
  total: number;
  recent: HomeCollectionRecentItem[];
}) {
  const ratio = total > 0 ? Math.min(1, collected / total) : 0;
  const left = Math.max(0, total - collected);
  const newCount = recent.filter((item) => item.isNew).length;

  return (
    <Link
      href="/collection"
      className="pressable relative block active:scale-[0.99]"
      style={{ marginLeft: -CARD_BLEED.left, marginRight: -CARD_BLEED.right }}
      aria-label={`図鑑を見る（${collected} / ${total}、あと${left}種類）`}
    >
      <div className="relative w-full" style={{ aspectRatio: CARD_RATIO }}>
        <Image
          src={CARD_SRC}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 480px) 100vw, 480px"
          draggable={false}
          className="home-card-frame pointer-events-none select-none"
        />
        <div
          className="absolute inset-0 flex items-center"
          style={{ paddingLeft: "35%", paddingRight: "11%", paddingTop: "3.2%", paddingBottom: "2.6%" }}
        >
          <div className="flex w-full min-w-0 items-center gap-1">
            <div className="min-w-0 flex-1">
              {/* 1行目：タイトルと集めた数 */}
              <div className="flex items-baseline justify-between gap-2">
                <p className="flex min-w-0 items-baseline gap-1.5">
                  <span className="shrink-0 text-base font-bold leading-none text-ink">図鑑</span>
                  <span className="truncate text-[10px] font-bold leading-none text-ink-faint">{left > 0 ? `あと${left}種類` : "コンプリート！"}</span>
                </p>
                <p className="shrink-0 leading-none tabular-nums">
                  <span className="text-base font-bold text-leaf-deep">{collected}</span>
                  <span className="text-[10px] font-bold text-ink-faint"> / {total}</span>
                </p>
              </div>

              {/* 2行目：進み具合 */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EADFC8]">
                  <span className="home-shine block h-full rounded-full bg-[linear-gradient(90deg,#8CCB74,#5E8C4A)]" style={{ width: `${ratio * 100}%` }} />
                </span>
                <span className="shrink-0 text-[10px] font-bold tabular-nums text-ink-faint">{Math.floor(ratio * 100)}%</span>
              </div>

              {/* 3行目：最近手に入れたもの */}
              <div className="mt-2 flex items-center gap-1.5">
                <span className="shrink-0 text-[9px] font-bold leading-tight text-ink-faint">
                  {newCount > 0 ? <span className="text-rose-500">NEW {newCount}</span> : "さいきん"}
                </span>
                {recent.length > 0 ? (
                  <span className="flex min-w-0 items-center gap-1">
                    {recent.map((item) => (
                      <span
                        key={item.id}
                        title={item.name}
                        className="relative block size-7 shrink-0 rounded-lg bg-[#FFFDF6] p-0.5"
                        style={{ boxShadow: `inset 0 0 0 1.5px ${RARITY_RING[item.rarity]}` }}
                      >
                        <ItemArt art={item.art} image={item.image} name={item.name} silhouette={false} />
                        {item.isNew ? <span className="absolute -right-0.5 -top-0.5 block size-2 rounded-full bg-rose-500 ring-1 ring-[#FFFDF6]" /> : null}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="truncate text-[10px] font-bold text-ink-faint">ガチャで集めよう</span>
                )}
              </div>
            </div>
            <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
          </div>
        </div>
      </div>
    </Link>
  );
}
