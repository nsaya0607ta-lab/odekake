import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ミニゲーム選択画面プレビュー",
};

type GameCard = {
  number: string;
  title: string;
  lead: string;
  description: string;
  playStyle: string;
  control: string;
  badge: string;
  image: string;
  cardClass: string;
  accentClass: string;
  copyClass: string;
  dividerClass: string;
  actionClass: string;
  glowClass: string;
  /** 実際にプレイできるプレビューがある場合だけ設定する。他の3枚はまだ静的モックアップのみ */
  href?: string;
};

const games: GameCard[] = [
  {
    number: "01",
    title: "アイテムキャッチ",
    lead: "落ちてくるお宝をキャッチ！",
    description: "反射神経でハイスコアを目指そう。",
    playStyle: "約30秒",
    control: "箱を左右に動かす",
    badge: "すぐ遊べる",
    image: "/games/item-catch/menu-icon-v2.webp",
    cardClass:
      "border-[#efd7a8] bg-gradient-to-br from-[#fffdf8] via-[#fff5df] to-[#fbe7bd] shadow-[0_14px_34px_rgba(184,125,51,0.13)]",
    accentClass: "bg-[#d8913b] text-white",
    copyClass: "text-[#a46624]",
    dividerClass: "bg-[#e7c98e]",
    actionClass: "bg-[#d8913b] text-white shadow-[0_5px_12px_rgba(216,145,59,0.25)]",
    glowClass: "bg-[#f4c768]/25",
  },
  {
    number: "02",
    title: "ごろごろボウリング",
    lead: "狙って、転がして、ストライク！",
    description: "お気に入りのボールでピンを倒そう。",
    playStyle: "10フレーム",
    control: "スワイプで投球",
    badge: "じっくり挑戦",
    image: "/games/wanko-bowling/menu-icon-v2.webp",
    cardClass:
      "border-[#bfd9b6] bg-gradient-to-br from-[#fcfff9] via-[#eef8e9] to-[#dff1d7] shadow-[0_14px_34px_rgba(83,131,69,0.13)]",
    accentClass: "bg-[#6f9f61] text-white",
    copyClass: "text-[#5f8953]",
    dividerClass: "bg-[#bad4b0]",
    actionClass: "bg-[#6f9f61] text-white shadow-[0_5px_12px_rgba(111,159,97,0.25)]",
    glowClass: "bg-[#9bc98d]/22",
  },
  {
    number: "03",
    title: "おやつロード",
    lead: "おやつを集めて、どこまでも！",
    description: "足あとをのばしてハイスコアを目指そう。",
    playStyle: "エンドレス",
    control: "スワイプで方向転換",
    badge: "新しくなったよ",
    image: "/games/snack-trail/menu-icon-preview.webp",
    cardClass:
      "border-[#afd9dd] bg-gradient-to-br from-[#fbffff] via-[#eaf9f6] to-[#d8f1ee] shadow-[0_14px_34px_rgba(62,139,140,0.14)]",
    accentClass: "bg-[#4faaa7] text-white",
    copyClass: "text-[#3e8585]",
    dividerClass: "bg-[#acd5d2]",
    actionClass: "bg-[#4faaa7] text-white shadow-[0_5px_12px_rgba(79,170,167,0.25)]",
    glowClass: "bg-[#78d1cc]/24",
  },
  {
    number: "04",
    title: "しん犬すいじゃく",
    lead: "絵柄をおぼえてペア探し！",
    description: "記憶力でハイスコアを目指そう。",
    playStyle: "初級〜上級",
    control: "タップでめくる",
    badge: "あたまで勝負",
    image: "/collection/items/duck-plush.webp",
    cardClass:
      "border-[#d9cdee] bg-gradient-to-br from-[#fffdfe] via-[#f5f1fb] to-[#e9e1f7] shadow-[0_14px_34px_rgba(105,86,150,0.13)]",
    accentClass: "bg-[#8b74b8] text-white",
    copyClass: "text-[#6d5c96]",
    dividerClass: "bg-[#d3c5ea]",
    actionClass: "bg-[#8b74b8] text-white shadow-[0_5px_12px_rgba(139,116,184,0.25)]",
    glowClass: "bg-[#b9a4dd]/24",
    href: "/memory-game-preview",
  },
];

export default function MiniGamesPreviewPage() {
  return (
    <div className="min-h-dvh bg-[#fffaf1] pb-[max(2rem,env(safe-area-inset-bottom))] text-[#403a32]">
      <header className="sticky top-0 z-30 border-b border-[#eee2cf] bg-[#fffaf1]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button
            type="button"
            aria-label="戻る"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bold text-[#746a5c] shadow-[0_3px_12px_rgba(94,75,47,0.08)]"
          >
            ‹
          </button>
          <span className="min-w-0 flex-1">
            <span className="block text-[19px] font-black">ミニゲーム</span>
            <span className="block text-xs font-bold text-[#9b8d78]">気分に合わせて、ひと遊び。</span>
          </span>
          <span className="rounded-full border border-[#e9dac2] bg-white px-3 py-1.5 text-[10px] font-black text-[#a47d45] shadow-sm">
            PREVIEW
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-6 pt-5">
        <section className="px-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a9c99a]/35 bg-[#eaf4df] px-3 py-1 text-[10px] font-black text-[#628451]">
            <span aria-hidden="true">✦</span>
            今日はどれで遊ぶ？
          </span>
          <h1 className="mt-2 text-[24px] font-black tracking-[-0.04em]">好きなゲームを選ぼう</h1>
          <p className="mt-1 text-xs font-bold leading-relaxed text-[#887e70]">
            4つのゲームを、明るくやさしい色で揃えました。
          </p>
        </section>

        <section className="mt-5 space-y-4" aria-label="ゲーム一覧">
          {games.map((game) => {
            const cardBody = (
              <>
                <span
                  aria-hidden="true"
                  className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/75 bg-white/25"
                />
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-12 left-8 h-28 w-28 rounded-full blur-sm ${game.glowClass}`}
                />

                <div className="relative z-10 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black shadow-sm ${game.accentClass}`}>
                    GAME {game.number}
                  </span>
                  <span className={`rounded-full border border-white/90 bg-white/70 px-2.5 py-1 text-[10px] font-black ${game.copyClass}`}>
                    {game.badge}
                  </span>
                </div>

                <div className="relative z-10 mt-2 flex min-h-[120px] items-center gap-2">
                  <div className="min-w-0 flex-1 pb-1 pl-0.5">
                    <span className={`block text-[10px] font-black tracking-[0.06em] ${game.copyClass}`}>
                      {game.lead}
                    </span>
                    <h2 className="mt-1 text-[21px] font-black tracking-[-0.035em]">{game.title}</h2>
                    <p className="mt-1.5 text-[11px] font-bold leading-relaxed text-[#716a60]">{game.description}</p>
                  </div>

                  <div className="relative h-[116px] w-[116px] shrink-0 overflow-hidden rounded-[25px] border border-white/80 bg-white/65 shadow-[0_8px_18px_rgba(80,66,46,0.09)]">
                    <Image
                      src={game.image}
                      alt=""
                      aria-hidden="true"
                      fill
                      sizes="116px"
                      className="object-cover"
                    />
                    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />
                  </div>
                </div>

                <div className="relative z-10 mt-2 flex items-center justify-between rounded-[18px] border border-white/90 bg-white/68 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="min-w-0">
                      <span className={`block text-[8px] font-black ${game.copyClass}`}>プレイ形式</span>
                      <span className="block text-[11px] font-black">{game.playStyle}</span>
                    </span>
                    <span aria-hidden="true" className={`h-7 w-px ${game.dividerClass}`} />
                    <span className="min-w-0">
                      <span className={`block text-[8px] font-black ${game.copyClass}`}>操作</span>
                      <span className="block truncate text-[11px] font-black">{game.control}</span>
                    </span>
                  </div>
                  <span className={`ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl font-black leading-none ${game.actionClass}`}>
                    ›
                  </span>
                </div>
              </>
            );

            const cardClassName = `group relative overflow-hidden rounded-[30px] border p-4 ${game.cardClass}`;

            if (game.href) {
              return (
                <Link
                  key={game.number}
                  href={game.href}
                  aria-label={`${game.title}で遊ぶ`}
                  className={`pressable block ${cardClassName} transition-transform active:scale-[0.985]`}
                >
                  {cardBody}
                </Link>
              );
            }

            return (
              <article key={game.number} className={cardClassName}>
                {cardBody}
              </article>
            );
          })}
        </section>

        <p className="flex items-center justify-center gap-1.5 py-5 text-[10px] font-bold text-[#a09482]">
          <span aria-hidden="true">🪙</span>
          スコアに応じてコインを獲得できます
        </p>
      </main>
    </div>
  );
}
