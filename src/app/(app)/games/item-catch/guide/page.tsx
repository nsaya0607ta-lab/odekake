import { ScoreSimulator, SkillCatalog, type GuideSkill } from "@/components/games/item-catch-guide";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { COLLECTION_ITEMS, RARITY_STARS } from "@/lib/collection/items";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { ITEM_CATCH_SKILLS } from "@/lib/games/item-catch-skills";
import { getNextLevelRemaining, getSkillLevel } from "@/lib/gacha/skill-levels";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "アイテムキャッチのルール | おでかけ記録" };
export const dynamic = "force-dynamic";

const ITEM_BY_ID = new Map(COLLECTION_ITEMS.map((item) => [item.id, item]));

const SCORE_CARDS = [
  ["N", "10pt", "bg-[#eaf5e8] border-[#c9dfc5] text-[#466b45]"],
  ["R", "20pt", "bg-[#e9f3fb] border-[#c5dcec] text-[#426c8c]"],
  ["SR", "40pt", "bg-[#fff6d8] border-[#ead79d] text-[#8a6a19]"],
  ["SSR", "70pt", "bg-gradient-to-br from-[#f7e8ff] via-[#e8f7ff] to-[#fff3d8] border-[#dccfea] text-[#6d5a86]"],
  ["UR", "100pt", "bg-[#fff0ed] border-[#e9c2ba] text-[#9a463b]"],
  ["LR", "150pt", "bg-[#f2eee8] border-[#d4c8b9] text-[#5c4b3a]"],
  ["わんこ", "15pt", "bg-[#f7f0e5] border-[#e2d3bd] text-[#765f42]"],
  ["？", "10pt〜", "bg-[#f0eee8] border-[#d9d4ca] text-[#665f55]"],
] as const;

export default async function ItemCatchGuidePage() {
  const { supabase, user } = await requireUser();
  const counts = await getOwnedItemCounts(supabase, user.id);

  const skills: GuideSkill[] = ITEM_CATCH_SKILLS.flatMap((skill) => {
    const item = ITEM_BY_ID.get(skill.id);
    if (!item) return [];

    const count = counts.get(skill.id) ?? 0;
    if (count <= 0) return [];

    return [
      {
        id: skill.id,
        name: item.name,
        image: item.image,
        rarity: item.rarity,
        levels: skill.levels,
        note: skill.note,
        count,
        level: getSkillLevel(item.rarity, count),
        nextRemaining: getNextLevelRemaining(item.rarity, count),
      },
    ];
  }).sort((a, b) => {
    const byRarity = RARITY_STARS[a.rarity] - RARITY_STARS[b.rarity];
    if (byRarity !== 0) return byRarity;
    return a.name.localeCompare(b.name, "ja");
  });

  return (
    <>
      <PageHeader title="ルールブック" backHref="/games/item-catch" />

      <PageBody className="!space-y-4 !py-3">
        <section className="relative overflow-hidden rounded-[28px] border border-[#d9d2c4] bg-gradient-to-br from-[#fffdf7] via-[#f4f7ea] to-[#edf4e8] px-5 py-5 shadow-[0_12px_30px_rgba(72,82,54,0.08)]">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#bfd5aa]/35 blur-sm" />
          <div className="pointer-events-none absolute -bottom-10 -left-7 h-24 w-24 rounded-full bg-[#e2c58f]/25 blur-sm" />
          <div className="relative">
            <span className="inline-flex rounded-full border border-[#cfd8c4] bg-white/75 px-2.5 py-1 text-[9px] font-black tracking-[0.18em] text-[#637155] shadow-sm">
              ITEM CATCH · RULE BOOK
            </span>
            <h1 className="mt-3 text-xl font-black tracking-tight text-[#3f382d]">30秒で、どこまで伸ばせる？</h1>
            <p className="mt-1.5 max-w-[92%] text-xs leading-relaxed text-[#756b5d]">
              落ちてくるアイテムを段ボールでキャッチ。レア度・JUST・コンボ・スキルを重ねてハイスコアを狙います。
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ["TIME", "30秒", "1プレイ"],
                ["COMBO", "×2.0", "最大倍率"],
                ["REWARD", "÷25", "コイン換算"],
              ].map(([label, value, note]) => (
                <div key={label} className="rounded-2xl border border-white/80 bg-white/70 px-2 py-2.5 text-center shadow-[0_5px_16px_rgba(74,76,58,0.06)] backdrop-blur-sm">
                  <span className="block text-[8px] font-black tracking-[0.12em] text-[#8a816f]">{label}</span>
                  <span className="mt-0.5 block text-base font-black tabular-nums text-[#42583c]">{value}</span>
                  <span className="block text-[9px] text-[#8a816f]">{note}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="01" eyebrow="SCORE" title="レアリティごとの基礎得点" />
          <div className="grid grid-cols-4 gap-1.5">
            {SCORE_CARDS.map(([label, value, colors]) => (
              <div key={label} className={`rounded-2xl border px-1 py-2.5 text-center shadow-[0_4px_12px_rgba(80,70,55,0.04)] ${colors}`}>
                <span className="block text-[9px] font-black opacity-75">{label}</span>
                <span className="mt-0.5 block text-sm font-black tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="02" eyebrow="SIMULATOR" title="スコアを試算する" />
          <div className="rounded-2xl border border-[#ded8ca] bg-[#fffdf8] p-3 shadow-[0_5px_16px_rgba(80,70,55,0.04)]">
            <p className="mb-3 text-[11px] leading-relaxed text-[#756b5d]">
              条件を変えると、ゲーム本体と同じ計算で1個あたりの得点を確認できます。
            </p>
            <ScoreSimulator />
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="03" eyebrow="COMBO" title="つなぐほど倍率アップ" />
          <div className="overflow-hidden rounded-2xl border border-[#d9d4c8] bg-[#fffdf8] shadow-[0_5px_16px_rgba(80,70,55,0.04)]">
            {[
              ["30 〜", "MAX COMBO", "×2.0", true],
              ["20 〜 29", "SUPER COMBO", "×1.5", false],
              ["10 〜 19", "GREAT", "×1.25", false],
              ["5 〜 9", "GOOD", "×1.1", false],
              ["0 〜 4", "通常", "×1.0", false],
            ].map(([range, label, mult, isMax]) => (
              <div
                key={String(range)}
                className={`flex items-center gap-3 border-b border-[#e7e1d5] px-3.5 py-2.5 last:border-b-0 ${
                  isMax ? "bg-gradient-to-r from-[#e3f0da] to-[#f3f7ec]" : "bg-[#fffdf8]"
                }`}
              >
                <span className={`w-[62px] shrink-0 text-[11px] font-black tabular-nums ${isMax ? "text-[#4f733f]" : "text-[#9a907f]"}`}>
                  {range}
                </span>
                <span className={`flex-1 text-[11px] font-bold ${isMax ? "text-[#4f733f]" : "text-[#756b5d]"}`}>{label}</span>
                <span className={`text-sm font-black tabular-nums ${isMax ? "text-[#3f6b35]" : "text-[#4b4338]"}`}>{mult}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[#d9d6c9] bg-[#f6f2e8] p-3.5">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm shadow-sm">🛡️</span>
              <p className="text-[11px] leading-relaxed text-[#756b5d]">
                <b className="text-[#4b4338]">コンボ保護</b>があると、取り逃してもコンボを維持して保護を1つ消費します。
                最大<b className="text-[#4b4338]">4つ</b>まで持てます。
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="04" eyebrow="HAZARD" title="特殊アイテム" />
          <p className="text-[11px] leading-relaxed text-[#756b5d]">図鑑とは別枠。所持状況に関係なく、決まった確率で落ちてきます。</p>
          <div className="grid gap-2">
            {[
              { image: "/collection/items/dog-poop.webp", name: "犬のうんち", rate: "4%", body: "取ると −500pt。ビニール袋があればダメージを打ち消せます。", tone: "bg-[#fff4ed] border-[#ecd6c7]" },
              { image: "/collection/items/mystery-question.webp", name: "？アイテム", rate: "5%", body: "全アイテムからランダムに1つのスキルが発動。未所持ならLv1です。", tone: "bg-[#f3f0f8] border-[#ddd4e8]" },
              { image: "/collection/items/plastic-bag.webp", name: "ビニール袋", rate: "3%", body: "最大3つまで持てる「うんちよけ」。ダメージを1回打ち消します。", tone: "bg-[#edf5f2] border-[#cfe0da]" },
            ].map((hazard) => (
              <div key={hazard.name} className={`rounded-2xl border p-3 shadow-[0_4px_12px_rgba(80,70,55,0.035)] ${hazard.tone}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/75 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={hazard.image} alt="" className="h-9 w-9 object-contain" loading="lazy" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-black text-[#4b4338]">{hazard.name}</span>
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-black tabular-nums text-[#7b7264]">DROP {hazard.rate}</span>
                    </span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-[#756b5d]">{hazard.body}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="05" eyebrow="SKILL LEVEL" title="重ねてスキルを育てる" />
          <p className="text-[11px] leading-relaxed text-[#756b5d]">同じアイテムを引くほど5段階で強化。Nと特殊アイテムはレベル対象外です。</p>
          <div className="rounded-2xl border border-[#d9d4c8] bg-[#fffdf8] p-3.5 shadow-[0_5px_16px_rgba(80,70,55,0.04)]">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {["レア", "Lv1", "Lv2", "Lv3", "Lv4", "MAX"].map((head) => (
                    <th key={head} className="border-b border-[#ddd6c8] px-1 py-1.5 text-center text-[9px] font-black text-[#8d8373] first:text-left">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["R", 1, 12, 30, 55, 90],
                  ["SR", 1, 6, 14, 25, 40],
                  ["SSR", 1, 4, 9, 16, 26],
                  ["UR", 1, 3, 5, 9, 15],
                  ["LR", 1, 2, 3, 5, 8],
                ].map((row) => (
                  <tr key={String(row[0])}>
                    {row.map((cell, index) => (
                      <td key={index} className="border-b border-[#eee8dd] px-1 py-1.5 text-center font-bold tabular-nums text-[#4b4338] last:border-b-0 first:text-left first:font-black">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] leading-relaxed text-[#928878]">数字は累計獲得数です。同じアイテムをもう一度引くことでレベルが上がります。</p>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="06" eyebrow="MY SKILLS" title="持っているスキル" />
          <SkillCatalog skills={skills} total={ITEM_CATCH_SKILLS.length} />
        </section>

        <section className="space-y-2">
          <SectionTitle number="07" eyebrow="REWARD" title="コインのもらい方" />
          <div className="overflow-hidden rounded-[24px] border border-[#d7cfbc] bg-[#fffdf8] shadow-[0_8px_22px_rgba(80,70,55,0.06)]">
            <div className="bg-gradient-to-br from-[#e2efd7] via-[#eef4e6] to-[#fff5dc] px-4 py-5 text-center">
              <p className="text-[9px] font-black tracking-[0.16em] text-[#678052]">COIN REWARD</p>
              <p className="mt-1 text-lg font-black tabular-nums text-[#4b6a3c]">スコア ÷ 25 = 獲得コイン</p>
              <p className="mt-1 text-[10px] text-[#6d7f5e]">小数点以下は切り捨て · 最低1コイン</p>
            </div>
            <ul className="space-y-2 border-t border-[#e6dfd0] bg-[#fffdf8] p-3.5 text-[11px] leading-relaxed text-[#756b5d]">
              <li className="flex gap-2"><span className="font-black text-[#b08b45]">01</span><span>1点でも取れていれば、必ず1コインはもらえます。</span></li>
              <li className="flex gap-2"><span className="font-black text-[#b08b45]">02</span><span>コインがもらえるのは1プレイにつき1回だけです。</span></li>
              <li className="flex gap-2"><span className="font-black text-[#b08b45]">03</span><span>キャッチ数は1プレイ2000個まで、1個あたり1500ptまでです。</span></li>
            </ul>
          </div>
        </section>

        <p className="pb-2 pt-1 text-center text-[9px] tracking-wide text-[#9a907f]">GAME DATA · 数値はゲーム本体の設定にもとづいています</p>
      </PageBody>
    </>
  );
}

function SectionTitle({ number, eyebrow, title }: { number: string; eyebrow: string; title: string }) {
  return (
    <div className="flex items-end gap-3">
      <span className="text-xl font-black tabular-nums text-[#b49b68]">{number}</span>
      <div className="min-w-0 pb-0.5">
        <p className="text-[8px] font-black tracking-[0.18em] text-[#758567]">{eyebrow}</p>
        <h2 className="mt-0.5 text-base font-black tracking-tight text-[#463e33]">{title}</h2>
      </div>
      <span className="mb-1 h-px flex-1 bg-[#ddd4c4]" />
    </div>
  );
}
