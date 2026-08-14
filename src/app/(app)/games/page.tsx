import Link from "next/link";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";

export const metadata = { title: "各種ゲーム | おでかけ記録" };

const ITEM_CATCH_CARD_SRC = "https://raw.githubusercontent.com/nsaya0607ta-lab/odekake/main/public/item-catch-card.webp";

export default function GamesPage() {
  return (
    <>
      <TopHeader
        backHref="/home"
        title="各種ゲーム"
        subtitle="ちょっと遊べる、おでかけミニゲーム。"
      />

      <PageBody className="!space-y-3 !py-3">
        <section className="rough-card overflow-hidden p-4">
          <p className="text-[9px] font-black tracking-[0.18em] text-ink-faint">MINI GAMES</p>
          <h1 className="mt-1 text-lg font-black text-ink">各種ゲーム</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
            遊びたいゲームを選んでください。
          </p>

          <div className="mt-4 space-y-3">
            <Link
              href="/games/item-catch"
              className="pressable group flex items-center gap-3 rounded-[22px] border border-[#d8c79e] bg-[#fffaf0] p-3 shadow-[0_3px_10px_rgba(85,63,31,0.08)] active:scale-[0.99]"
            >
              <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#fffaf0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ITEM_CATCH_CARD_SRC}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-contain"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-black tracking-[0.13em] text-leaf-deep">30 SEC GAME</span>
                <span className="mt-0.5 block text-base font-black text-ink">アイテムキャッチ</span>
                <span className="mt-1 block text-[10px] leading-relaxed text-ink-soft">
                  落ちてくるアイテムを段ボールでキャッチしよう。
                </span>
              </span>

              <span className="shrink-0 text-xl font-black text-[#8d7852] transition-transform group-active:translate-x-0.5">›</span>
            </Link>
          </div>
        </section>
      </PageBody>
    </>
  );
}
