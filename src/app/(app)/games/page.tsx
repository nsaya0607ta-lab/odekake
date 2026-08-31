import Link from "next/link";
import Image from "next/image";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { canSeeMemoryGame } from "@/lib/games/memory-game-access";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "ミニゲーム | おでかけ記録" };
export const dynamic = "force-dynamic";

const ITEM_CATCH_CARD_SRC = "/games/item-catch/menu-icon-v2.webp";
const WANKO_BOWLING_CARD_SRC = "/games/wanko-bowling/menu-icon-v2.webp";
const SNACK_TRAIL_CARD_SRC = "/games/snack-trail/menu-icon-preview.webp";
const BLOCK_GARDEN_CARD_SRC = "/collection/items/hut-fireplace.webp";
const MEMORY_GAME_CARD_SRC = "/collection/items/duck-plush.webp";

export default async function GamesPage() {
  const { user } = await requireUser();
  const canSeeMemoryGamePreview = canSeeMemoryGame(user.displayName);

  return (
    <>
      <TopHeader
        backHref="/home"
        title="ミニゲーム"
        subtitle="気分に合わせて、ひと遊び。"
      />

      <PageBody className="!space-y-4 !pb-8 !pt-4">
        <section className="px-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf/20 bg-leaf-soft/60 px-3 py-1 text-[10px] font-black text-leaf-deep">
            <span aria-hidden="true">✦</span>
            今日はどれで遊ぶ？
          </span>
          <h1 className="mt-2 text-[23px] font-black tracking-[-0.03em] text-ink">好きなゲームを選ぼう</h1>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">短く遊ぶのも、じっくり挑戦するのもお好みで。</p>
        </section>

        <section className="space-y-4" aria-label="ゲーム一覧">
          <Link
            href="/games/item-catch"
            aria-label="アイテムキャッチで遊ぶ"
            className="pressable group relative block overflow-hidden rounded-[30px] border border-[#efd7a8] bg-gradient-to-br from-[#fffdf8] via-[#fff5df] to-[#fbe7bd] p-5 shadow-[0_14px_34px_rgba(184,125,51,0.13)] transition-transform active:scale-[0.985]"
          >
            <span aria-hidden="true" className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/70 bg-white/20" />
            <span aria-hidden="true" className="absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-[#e8bd68]/15 blur-sm" />

            <span className="relative z-10 flex items-center gap-2">
              <span className="rounded-full bg-[#d8913b] px-2.5 py-1 text-[10px] font-black text-white shadow-sm">GAME 01</span>
              <span className="rounded-full border border-white/90 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-[#a46624]">すぐ遊べる</span>
            </span>

            <span className="relative z-10 mt-3 flex items-center gap-3">
              <span className="min-w-0 flex-1 pb-1">
                <span className="block text-[10px] font-black tracking-[0.08em] text-[#a46624]">落ちてくるお宝をキャッチ！</span>
                <span className="mt-1 block text-[21px] font-black tracking-[-0.03em] text-ink">アイテムキャッチ</span>
                <span className="mt-1.5 block text-[11px] font-bold leading-relaxed text-ink-soft">反射神経でハイスコアを目指そう。</span>
              </span>

              <span className="relative h-[108px] w-[108px] shrink-0 overflow-hidden rounded-[25px] border border-white/80 bg-white/65 shadow-[0_8px_18px_rgba(80,66,46,0.09)]">
                <Image
                  src={ITEM_CATCH_CARD_SRC}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="108px"
                  className="object-cover"
                />
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />
              </span>
            </span>

            <span className="relative z-10 mt-4 flex items-center justify-between rounded-[18px] border border-white/75 bg-white/55 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              <span className="flex min-w-0 items-center gap-3">
                <span className="min-w-0">
                  <span className="block text-[8px] font-black text-[#a46624]">プレイ形式</span>
                  <span className="block text-[11px] font-black text-ink">約50秒</span>
                </span>
                <span aria-hidden="true" className="h-7 w-px bg-[#d4b87d]/55" />
                <span className="min-w-0">
                  <span className="block text-[8px] font-black text-[#a46624]">操作</span>
                  <span className="block truncate text-[11px] font-black text-ink">箱を左右に動かす</span>
                </span>
              </span>
              <span className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d8913b] text-xl font-black leading-none text-white shadow-[0_5px_12px_rgba(216,145,59,0.25)] transition-transform group-active:translate-x-0.5">
                ›
              </span>
            </span>
          </Link>

          <Link
            href="/games/wanko-bowling"
            aria-label="わんこボウリングで遊ぶ"
            className="pressable group relative block overflow-hidden rounded-[30px] border border-[#bfd9b6] bg-gradient-to-br from-[#fcfff9] via-[#eef8e9] to-[#dff1d7] p-5 shadow-[0_14px_34px_rgba(83,131,69,0.13)] transition-transform active:scale-[0.985]"
          >
            <span aria-hidden="true" className="absolute -right-6 -top-8 h-28 w-28 rounded-full border border-white/75 bg-white/25" />
            <span aria-hidden="true" className="absolute -bottom-9 left-12 h-24 w-24 rounded-full bg-[#87ad6d]/15 blur-sm" />

            <span className="relative z-10 flex items-center gap-2">
              <span className="rounded-full bg-[#6f9f61] px-2.5 py-1 text-[10px] font-black text-white shadow-sm">GAME 02</span>
              <span className="rounded-full border border-white/90 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-[#5f8953]">じっくり挑戦</span>
            </span>

            <span className="relative z-10 mt-3 flex items-center gap-3">
              <span className="min-w-0 flex-1 pb-1">
                <span className="block text-[10px] font-black tracking-[0.08em] text-[#5f8953]">狙って、転がして、ストライク！</span>
                <span className="mt-1 block text-[21px] font-black tracking-[-0.03em] text-ink">わんこボウリング</span>
                <span className="mt-1.5 block text-[11px] font-bold leading-relaxed text-ink-soft">お気に入りのボールでピンを倒そう。</span>
              </span>

              <span className="relative h-[108px] w-[108px] shrink-0 overflow-hidden rounded-[25px] border border-white/80 bg-white/65 shadow-[0_8px_18px_rgba(80,66,46,0.09)]">
                <Image
                  src={WANKO_BOWLING_CARD_SRC}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="108px"
                  className="object-cover"
                />
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />
              </span>
            </span>

            <span className="relative z-10 mt-4 flex items-center justify-between rounded-[18px] border border-white/75 bg-white/55 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
              <span className="flex min-w-0 items-center gap-3">
                <span className="min-w-0">
                  <span className="block text-[8px] font-black text-[#5f8953]">プレイ形式</span>
                  <span className="block text-[11px] font-black text-ink">10フレーム</span>
                </span>
                <span aria-hidden="true" className="h-7 w-px bg-leaf/35" />
                <span className="min-w-0">
                  <span className="block text-[8px] font-black text-[#5f8953]">操作</span>
                  <span className="block truncate text-[11px] font-black text-ink">スワイプで投球</span>
                </span>
              </span>
              <span className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6f9f61] text-xl font-black leading-none text-white shadow-[0_5px_12px_rgba(111,159,97,0.25)] transition-transform group-active:translate-x-0.5">
                ›
              </span>
            </span>
          </Link>

          <Link
            href="/games/snack-trail"
            aria-label="わんこのおやつ道で遊ぶ"
            className="pressable group relative block overflow-hidden rounded-[30px] border border-[#afd9dd] bg-gradient-to-br from-[#fbffff] via-[#eaf9f6] to-[#d8f1ee] p-5 text-ink shadow-[0_14px_34px_rgba(62,139,140,0.14)] transition-transform active:scale-[0.985]"
          >
            <span aria-hidden="true" className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/75 bg-white/25" />
            <span aria-hidden="true" className="absolute -bottom-10 left-9 h-28 w-28 rounded-full bg-[#78d1cc]/25 blur-md" />

            <span className="relative z-10 flex items-center gap-2">
              <span className="rounded-full bg-[#4faaa7] px-2.5 py-1 text-[10px] font-black text-white shadow-sm">GAME 03</span>
              <span className="rounded-full border border-white/90 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-[#3e8585]">新しくなったよ</span>
            </span>

            <span className="relative z-10 mt-3 flex items-center gap-3">
              <span className="min-w-0 flex-1 pb-1">
                <span className="block text-[10px] font-black tracking-[0.08em] text-[#3e8585]">おやつを集めて、どこまでも！</span>
                <span className="mt-1 block text-[21px] font-black tracking-[-0.03em]">わんこのおやつ道</span>
                <span className="mt-1.5 block text-[11px] font-bold leading-relaxed text-ink-soft">足あとをのばしてハイスコアを目指そう。</span>
              </span>

              <span className="relative h-[108px] w-[108px] shrink-0 overflow-hidden rounded-[25px] border border-white/80 bg-white/65 shadow-[0_8px_18px_rgba(80,66,46,0.09)]">
                <Image
                  src={SNACK_TRAIL_CARD_SRC}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="108px"
                  className="object-cover"
                />
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />
              </span>
            </span>

            <span className="relative z-10 mt-4 flex items-center justify-between rounded-[18px] border border-white/90 bg-white/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <span className="flex min-w-0 items-center gap-3">
                <span className="min-w-0">
                  <span className="block text-[8px] font-black text-[#3e8585]">プレイ形式</span>
                  <span className="block text-[11px] font-black text-ink">エンドレス</span>
                </span>
                <span aria-hidden="true" className="h-7 w-px bg-[#acd5d2]" />
                <span className="min-w-0">
                  <span className="block text-[8px] font-black text-[#3e8585]">操作</span>
                  <span className="block truncate text-[11px] font-black text-ink">スワイプで方向転換</span>
                </span>
              </span>
              <span className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4faaa7] text-xl font-black leading-none text-white shadow-[0_5px_12px_rgba(79,170,167,0.25)] transition-transform group-active:translate-x-0.5">
                ›
              </span>
            </span>
          </Link>

          <Link
            href="/games/block-garden"
            aria-label="わんこのブロックガーデンで遊ぶ"
            className="pressable group relative block overflow-hidden rounded-[30px] border border-[#c8dcae] bg-gradient-to-br from-[#fefff9] via-[#f2f8df] to-[#dcecc8] p-5 text-ink shadow-[0_14px_34px_rgba(91,133,68,0.14)] transition-transform active:scale-[0.985]"
          >
            <span aria-hidden="true" className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/75 bg-white/30" />
            <span aria-hidden="true" className="absolute -bottom-10 left-8 h-28 w-28 rounded-full bg-[#a8cf83]/25 blur-md" />

            <span className="relative z-10 flex items-center gap-2">
              <span className="rounded-full bg-[#6fa45a] px-2.5 py-1 text-[10px] font-black text-white shadow-sm">GAME 04</span>
              <span className="rounded-full border border-white/90 bg-white/75 px-2.5 py-1 text-[10px] font-bold text-[#588348]">NEW・プロトタイプ</span>
            </span>

            <span className="relative z-10 mt-3 flex items-center gap-3">
              <span className="min-w-0 flex-1 pb-1">
                <span className="block text-[10px] font-black tracking-[0.08em] text-[#588348]">集めて、こわして、庭づくり！</span>
                <span className="mt-1 block text-[20px] font-black tracking-[-0.04em]">わんこのブロックガーデン</span>
                <span className="mt-1.5 block text-[11px] font-bold leading-relaxed text-ink-soft">小さな3Dフィールドを自由に歩こう。</span>
              </span>

              <span className="relative h-[108px] w-[108px] shrink-0 overflow-hidden rounded-[25px] border border-white/85 bg-white/70 shadow-[0_8px_18px_rgba(80,66,46,0.09)]">
                <Image
                  src={BLOCK_GARDEN_CARD_SRC}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="108px"
                  className="object-contain p-1"
                />
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />
              </span>
            </span>

            <span className="relative z-10 mt-4 flex items-center justify-between rounded-[18px] border border-white/90 bg-white/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <span className="flex min-w-0 items-center gap-3">
                <span className="min-w-0">
                  <span className="block text-[8px] font-black text-[#588348]">プレイ形式</span>
                  <span className="block text-[11px] font-black text-ink">自由に遊べる</span>
                </span>
                <span aria-hidden="true" className="h-7 w-px bg-[#bfd7a9]" />
                <span className="min-w-0">
                  <span className="block text-[8px] font-black text-[#588348]">操作</span>
                  <span className="block truncate text-[11px] font-black text-ink">歩く・壊す・置く</span>
                </span>
              </span>
              <span className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6fa45a] text-xl font-black leading-none text-white shadow-[0_5px_12px_rgba(111,164,90,0.25)] transition-transform group-active:translate-x-0.5">
                ›
              </span>
            </span>
          </Link>

          {canSeeMemoryGamePreview && (
          <Link
            href="/memory-game-preview"
            aria-label="しん犬すいじゃくで遊ぶ"
            className="pressable group relative block overflow-hidden rounded-[30px] border border-[#d9cdee] bg-gradient-to-br from-[#fffdfe] via-[#f5f1fb] to-[#e9e1f7] p-5 text-ink shadow-[0_14px_34px_rgba(105,86,150,0.13)] transition-transform active:scale-[0.985]"
          >
            <span aria-hidden="true" className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/75 bg-white/25" />
            <span aria-hidden="true" className="absolute -bottom-10 left-9 h-28 w-28 rounded-full bg-[#b9a4dd]/24 blur-md" />

            <span className="relative z-10 flex items-center gap-2">
              <span className="rounded-full bg-[#8b74b8] px-2.5 py-1 text-[10px] font-black text-white shadow-sm">GAME 05</span>
            </span>

            <span className="relative z-10 mt-3 flex items-center gap-3">
              <span className="min-w-0 flex-1 pb-1">
                <span className="block text-[10px] font-black tracking-[0.08em] text-[#6d5c96]">絵柄をおぼえてペア探し！</span>
                <span className="mt-1 block text-[21px] font-black tracking-[-0.03em]">しん犬すいじゃく</span>
                <span className="mt-1.5 block text-[11px] font-bold leading-relaxed text-ink-soft">記憶力でハイスコアを目指そう。</span>
              </span>

              <span className="relative h-[108px] w-[108px] shrink-0 overflow-hidden rounded-[25px] border border-white/80 bg-white/65 shadow-[0_8px_18px_rgba(80,66,46,0.09)]">
                <Image
                  src={MEMORY_GAME_CARD_SRC}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="108px"
                  className="object-cover"
                />
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />
              </span>
            </span>

            <span className="relative z-10 mt-4 flex items-center justify-between rounded-[18px] border border-white/90 bg-white/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <span className="flex min-w-0 items-center gap-3">
                <span className="min-w-0">
                  <span className="block text-[8px] font-black text-[#6d5c96]">プレイ形式</span>
                  <span className="block text-[11px] font-black text-ink">初級〜上級</span>
                </span>
                <span aria-hidden="true" className="h-7 w-px bg-[#d3c5ea]" />
                <span className="min-w-0">
                  <span className="block text-[8px] font-black text-[#6d5c96]">操作</span>
                  <span className="block truncate text-[11px] font-black text-ink">タップでめくる</span>
                </span>
              </span>
              <span className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8b74b8] text-xl font-black leading-none text-white shadow-[0_5px_12px_rgba(139,116,184,0.25)] transition-transform group-active:translate-x-0.5">
                ›
              </span>
            </span>
          </Link>
          )}
        </section>

        <p className="flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold text-ink-faint">
          <span aria-hidden="true">🪙</span>
          スコアに応じてコインを獲得できます
        </p>
      </PageBody>
    </>
  );
}
