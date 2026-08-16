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

export default async function ItemCatchGuidePage() {
  const { supabase, user } = await requireUser();
  const counts = await getOwnedItemCounts(supabase, user.id);

  // 図鑑のデータと突き合わせる。持っていないアイテムはここで落とすので画面には出ない
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
    // レアリティの低い順、同じなら名前順
    const byRarity = RARITY_STARS[a.rarity] - RARITY_STARS[b.rarity];
    if (byRarity !== 0) return byRarity;
    return a.name.localeCompare(b.name, "ja");
  });

  return (
    <>
      <PageHeader title="ルールブック" backHref="/games/item-catch" />

      <PageBody className="!space-y-4 !py-3">
        <section className="rough-card relative overflow-hidden px-5 py-5">
          <div className="pointer-events-none absolute -right-7 -top-7 h-24 w-24 rounded-full bg-leaf-soft/70" />
          <div className="pointer-events-none absolute -bottom-8 -left-6 h-20 w-20 rounded-full bg-paper-deep/70" />
          <div className="relative">
            <span className="inline-flex rounded-full border border-line bg-card/90 px-2.5 py-1 text-[9px] font-black tracking-[0.18em] text-ink-faint">
              ITEM CATCH · RULE BOOK
            </span>
            <h1 className="mt-3 text-xl font-black tracking-tight text-ink">30秒で、どこまで伸ばせる？</h1>
            <p className="mt-1.5 max-w-[92%] text-xs leading-relaxed text-ink-soft">
              落ちてくるアイテムを段ボールでキャッチ。レア度・JUST・コンボ・スキルを重ねてハイスコアを狙います。
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ["TIME", "30秒", "1プレイ"],
                ["COMBO", "×2.0", "最大倍率"],
                ["REWARD", "÷25", "コイン換算"],
              ].map(([label, value, note]) => (
                <div key={label} className="rounded-2xl border border-line bg-card/90 px-2 py-2.5 text-center">
                  <span className="block text-[8px] font-black tracking-[0.12em] text-ink-faint">{label}</span>
                  <span className="mt-0.5 block text-base font-black tabular-nums text-ink">{value}</span>
                  <span className="block text-[9px] text-ink-faint">{note}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="01" eyebrow="SCORE" title="レアリティごとの基礎得点" />
          <div className="grid grid-cols-4 gap-1.5">
            {[
              ["N", "10pt"],
              ["R", "20pt"],
              ["SR", "40pt"],
              ["SSR", "70pt"],
              ["UR", "100pt"],
              ["LR", "150pt"],
              ["わんこ", "15pt"],
              ["？", "10pt〜"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-line bg-card px-1 py-2.5 text-center">
                <span className="block text-[9px] font-black text-ink-faint">{label}</span>
                <span className="mt-0.5 block text-sm font-black tabular-nums text-ink">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="02" eyebrow="SIMULATOR" title="スコアを試算する" />
          <div className="rounded-2xl border border-line bg-card p-3">
            <p className="mb-3 text-[11px] leading-relaxed text-ink-soft">
              条件を変えると、ゲーム本体と同じ計算で1個あたりの得点を確認できます。
            </p>
            <ScoreSimulator />
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="03" eyebrow="COMBO" title="つなぐほど倍率アップ" />
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            {[
              ["30 〜", "MAX COMBO", "×2.0", true],
              ["20 〜 29", "SUPER COMBO", "×1.5", false],
              ["10 〜 19", "GREAT", "×1.25", false],
              ["5 〜 9", "GOOD", "×1.1", false],
              ["0 〜 4", "通常", "×1.0", false],
            ].map(([range, label, mult, isMax]) => (
              <div
                key={String(range)}
                className={`flex items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0 ${
                  isMax ? "bg-leaf-soft/60" : "bg-card"
                }`}
              >
                <span
                  className={`w-[62px] shrink-0 text-[11px] font-black tabular-nums ${
                    isMax ? "text-leaf-deep" : "text-ink-faint"
                  }`}
                >
                  {range}
                </span>
                <span className={`flex-1 text-[11px] font-bold ${isMax ? "text-leaf-deep" : "text-ink-soft"}`}>
                  {label}
                </span>
                <span className={`text-sm font-black tabular-nums ${isMax ? "text-leaf-deep" : "text-ink"}`}>
                  {mult}
                </span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-line bg-paper-deep/60 p-3.5">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-sm">🛡️</span>
              <p className="text-[11px] leading-relaxed text-ink-soft">
                <b className="text-ink">コンボ保護</b>があると、取り逃してもコンボを維持して保護を1つ消費します。
                最大<b className="text-ink">4つ</b>まで持てます。
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="04" eyebrow="HAZARD" title="特殊アイテム" />
          <p className="text-[11px] leading-relaxed text-ink-soft">
            図鑑とは別枠。所持状況に関係なく、決まった確率で落ちてきます。
          </p>
          <div className="grid gap-2">
            {[
              {
                image: "/collection/items/dog-poop.webp",
                name: "犬のうんち",
                rate: "4%",
                body: "取ると −500pt。ビニール袋があればダメージを打ち消せます。",
              },
              {
                image: "/collection/items/mystery-question.webp",
                name: "？アイテム",
                rate: "5%",
                body: "全アイテムからランダムに1つのスキルが発動。未所持ならLv1です。",
              },
              {
                image: "/collection/items/plastic-bag.webp",
                name: "ビニール袋",
                rate: "3%",
                body: "最大3つまで持てる「うんちよけ」。ダメージを1回打ち消します。",
              },
            ].map((hazard) => (
              <div key={hazard.name} className="rounded-2xl border border-line bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-paper-deep">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={hazard.image} alt="" className="h-9 w-9 object-contain" loading="lazy" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-black text-ink">{hazard.name}</span>
                      <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[9px] font-black tabular-nums text-ink-faint">
                        DROP {hazard.rate}
                      </span>
                    </span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-ink-soft">{hazard.body}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="05" eyebrow="SKILL LEVEL" title="重ねてスキルを育てる" />
          <p className="text-[11px] leading-relaxed text-ink-soft">
            同じアイテムを引くほど5段階で強化。Nと特殊アイテムはレベル対象外です。
          </p>
          <div className="rounded-2xl border border-line bg-card p-3.5">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {["レア", "Lv1", "Lv2", "Lv3", "Lv4", "MAX"].map((head) => (
                    <th
                      key={head}
                      className="border-b border-line px-1 py-1.5 text-center text-[9px] font-black text-ink-faint first:text-left"
                    >
                      {head}
                    </th>
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
                      <td
                        key={index}
                        className="border-b border-line px-1 py-1.5 text-center font-bold tabular-nums text-ink last:border-b-0 first:text-left first:font-black"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
              数字は累計獲得数です。同じアイテムをもう一度引くことでレベルが上がります。
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="06" eyebrow="MY SKILLS" title="持っているスキル" />
          <SkillCatalog skills={skills} total={ITEM_CATCH_SKILLS.length} />
        </section>

        <section className="space-y-2">
          <SectionTitle number="07" eyebrow="REWARD" title="コインのもらい方" />
          <div className="rough-card overflow-hidden">
            <div className="bg-leaf-soft/60 px-4 py-5 text-center">
              <p className="text-[9px] font-black tracking-[0.16em] text-leaf-deep">COIN REWARD</p>
              <p className="mt-1 text-lg font-black tabular-nums text-leaf-deep">スコア ÷ 25 = 獲得コイン</p>
              <p className="mt-1 text-[10px] text-leaf-deep">小数点以下は切り捨て · 最低1コイン</p>
            </div>
            <ul className="space-y-2 border-t border-line bg-card p-3.5 text-[11px] leading-relaxed text-ink-soft">
              <li className="flex gap-2"><span className="font-black text-ink-faint">01</span><span>1点でも取れていれば、必ず1コインはもらえます。</span></li>
              <li className="flex gap-2"><span className="font-black text-ink-faint">02</span><span>コインがもらえるのは1プレイにつき1回だけです。</span></li>
              <li className="flex gap-2"><span className="font-black text-ink-faint">03</span><span>キャッチ数は1プレイ2000個まで、1個あたり1500ptまでです。</span></li>
            </ul>
          </div>
        </section>

        <p className="pb-2 pt-1 text-center text-[9px] tracking-wide text-ink-faint">
          GAME DATA · 数値はゲーム本体の設定にもとづいています
        </p>
      </PageBody>
    </>
  );
}

function SectionTitle({ number, eyebrow, title }: { number: string; eyebrow: string; title: string }) {
  return (
    <div className="flex items-end gap-3">
      <span className="text-xl font-black tabular-nums text-ink-faint/50">{number}</span>
      <div className="min-w-0 pb-0.5">
        <p className="text-[8px] font-black tracking-[0.18em] text-ink-faint">{eyebrow}</p>
        <h2 className="mt-0.5 text-base font-black tracking-tight text-ink">{title}</h2>
      </div>
      <span className="mb-1 h-px flex-1 bg-line" />
    </div>
  );
}
