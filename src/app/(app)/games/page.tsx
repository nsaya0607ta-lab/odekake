import Link from "next/link";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "各種ゲーム | おでかけ記録" };
export const dynamic = "force-dynamic";

const ITEM_CATCH_CARD_SRC = "/140352b4-d7ad-4b73-8b9d-4136fc5e27a4.webp";
const WANKO_BOWLING_CARD_SRC = "/games/wanko-bowling/icon.svg";

export default async function GamesPage() {
  await requireUser();

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
            今日はどっちで遊ぶ？
          </span>
          <h1 className="mt-2 text-[23px] font-black tracking-[-0.03em] text-ink">好きなゲームを選ぼう</h1>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">短く遊ぶのも、じっくり挑戦するのもお好みで。</p>
        </section>

        <section className="space-y-4" aria-label="ゲーム一覧">
          <Link
            href="/games/item-catch"
            aria-label="アイテムキャッチで遊ぶ"
            className="pressable group relative block min-h-[202px] overflow-hidden rounded-[30px] border border-[#e7c980] bg-gradient-to-br from-[#fffaf0] via-[#fff0cf] to-[#f5d79c] p-5 shadow-[0_12px_28px_rgba(128,92,32,0.13)] transition-transform active:scale-[0.985]"
          >
            <span aria-hidden="true" className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/70 bg-white/20" />
            <span aria-hidden="true" className="absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-[#e8bd68]/15 blur-sm" />

            <span className="relative z-10 flex items-center gap-2">
              <span className="rounded-full bg-[#97681f] px-2.5 py-1 text-[10px] font-black text-white shadow-sm">30秒</span>
              <span className="rounded-full border border-[#c99947]/25 bg-white/65 px-2.5 py-1 text-[10px] font-bold text-[#80612c]">すぐ遊べる</span>
            </span>

            <span className="relative z-10 mt-4 flex items-end gap-3">
              <span className="min-w-0 flex-1 pb-1">
                <span className="block text-[10px] font-black tracking-[0.08em] text-[#99712d]">落ちてくるお宝をキャッチ！</span>
                <span className="mt-1 block text-[21px] font-black tracking-[-0.03em] text-ink">アイテムキャッチ</span>
                <span className="mt-1.5 block text-[11px] font-bold leading-relaxed text-ink-soft">反射神経でハイスコアを目指そう。</span>
                <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#4b4033] py-2 pl-4 pr-3 text-[11px] font-black text-white shadow-[0_5px_12px_rgba(75,64,51,0.18)]">
                  遊ぶ
                  <span aria-hidden="true" className="text-base leading-none transition-transform group-active:translate-x-0.5">›</span>
                </span>
              </span>

              <span className="relative flex h-[108px] w-[108px] shrink-0 items-center justify-center rounded-[25px] border border-white/70 bg-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(133,95,32,0.10)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ITEM_CATCH_CARD_SRC} alt="" aria-hidden="true" className="h-[96px] w-[96px] object-contain" />
              </span>
            </span>
          </Link>

          <Link
            href="/games/wanko-bowling"
            aria-label="わんこボウリングで遊ぶ"
            className="pressable group relative block min-h-[202px] overflow-hidden rounded-[30px] border border-[#b9d09f] bg-gradient-to-br from-[#f8fbf2] via-[#e9f3dc] to-[#d4e7c1] p-5 shadow-[0_12px_28px_rgba(71,105,50,0.13)] transition-transform active:scale-[0.985]"
          >
            <span aria-hidden="true" className="absolute -right-6 -top-8 h-28 w-28 rounded-full border border-white/75 bg-white/25" />
            <span aria-hidden="true" className="absolute -bottom-9 left-12 h-24 w-24 rounded-full bg-[#87ad6d]/15 blur-sm" />

            <span className="relative z-10 flex items-center gap-2">
              <span className="rounded-full bg-leaf-deep px-2.5 py-1 text-[10px] font-black text-white shadow-sm">10フレーム</span>
              <span className="rounded-full border border-leaf/25 bg-white/65 px-2.5 py-1 text-[10px] font-bold text-leaf-deep">じっくり挑戦</span>
            </span>

            <span className="relative z-10 mt-4 flex items-end gap-3">
              <span className="min-w-0 flex-1 pb-1">
                <span className="block text-[10px] font-black tracking-[0.08em] text-leaf-deep">狙って、転がして、ストライク！</span>
                <span className="mt-1 block text-[21px] font-black tracking-[-0.03em] text-ink">わんこボウリング</span>
                <span className="mt-1.5 block text-[11px] font-bold leading-relaxed text-ink-soft">お気に入りのボールでピンを倒そう。</span>
                <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-leaf-deep py-2 pl-4 pr-3 text-[11px] font-black text-white shadow-[0_5px_12px_rgba(93,128,73,0.2)]">
                  遊ぶ
                  <span aria-hidden="true" className="text-base leading-none transition-transform group-active:translate-x-0.5">›</span>
                </span>
              </span>

              <span className="relative flex h-[108px] w-[108px] shrink-0 items-center justify-center rounded-[25px] border border-white/75 bg-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(71,105,50,0.10)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={WANKO_BOWLING_CARD_SRC} alt="" aria-hidden="true" className="h-[92px] w-[92px] object-contain" />
              </span>
            </span>
          </Link>
        </section>

        <p className="flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold text-ink-faint">
          <span aria-hidden="true">🪙</span>
          スコアに応じてコインを獲得できます
        </p>
      </PageBody>
    </>
  );
}
