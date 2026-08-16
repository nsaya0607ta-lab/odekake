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

  // 図鑑のデータと突き合わせて、名前・絵・レアリティと所持状況をまとめる
  const skills: GuideSkill[] = ITEM_CATCH_SKILLS.flatMap((skill) => {
    const item = ITEM_BY_ID.get(skill.id);
    if (!item) return [];

    const count = counts.get(skill.id) ?? 0;
    return [
      {
        id: skill.id,
        name: item.name,
        image: item.image,
        rarity: item.rarity,
        levels: skill.levels,
        note: skill.note,
        owned: count > 0,
        count,
        level: getSkillLevel(item.rarity, count),
        nextRemaining: getNextLevelRemaining(item.rarity, count),
      },
    ];
  }).sort((a, b) => {
    // レアリティの低い順、同じなら所持しているものを先に
    const byRarity = RARITY_STARS[a.rarity] - RARITY_STARS[b.rarity];
    if (byRarity !== 0) return byRarity;
    if (a.owned !== b.owned) return a.owned ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });

  return (
    <>
      <PageHeader title="ルールとスキル" backHref="/games/item-catch" />

      <PageBody className="!space-y-6">
        <section className="space-y-2">
          <h1 className="text-lg font-black text-ink">アイテムキャッチの遊び方</h1>
          <p className="text-xs leading-relaxed text-ink-soft">
            1プレイは30秒。落ちてくるアイテムを段ボールでキャッチして、スコアをのばします。
            レアリティで決まる基礎得点に、スキル倍率・JUST判定・コンボ倍率が順にかかります。
          </p>
        </section>

        <section className="space-y-2">
          <SectionTitle eyebrow="得点のしくみ" title="スコアを試算する" />
          <p className="text-xs leading-relaxed text-ink-soft">
            条件を変えると、ゲームと同じ計算で1個あたりの得点が出ます。
          </p>
          <ScoreSimulator />
        </section>

        <section className="space-y-2">
          <SectionTitle eyebrow="基礎得点" title="レアリティごとの点数" />
          <div className="grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-line bg-line">
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
              <div key={label} className="bg-card px-1 py-2.5 text-center">
                <span className="block text-[10px] font-black text-ink-faint">{label}</span>
                <span className="mt-0.5 block text-sm font-black tabular-nums text-ink">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle eyebrow="コンボ" title="つなぐほど倍率が上がる" />
          <div className="overflow-hidden rounded-2xl border border-line">
            {[
              ["30 〜", "MAX COMBO", "×2.0", true],
              ["20 〜 29", "SUPER COMBO", "×1.5", false],
              ["10 〜 19", "GREAT", "×1.25", false],
              ["5 〜 9", "GOOD", "×1.1", false],
              ["0 〜 4", "通常", "×1.0", false],
            ].map(([range, label, mult, isMax]) => (
              <div
                key={String(range)}
                className={`flex items-baseline gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0 ${
                  isMax ? "bg-leaf-soft/60" : "bg-card"
                }`}
              >
                <span
                  className={`w-[58px] shrink-0 text-[11px] font-black tabular-nums ${
                    isMax ? "text-leaf-deep" : "text-ink-faint"
                  }`}
                >
                  {range}
                </span>
                <span className={`flex-1 text-xs ${isMax ? "text-leaf-deep" : "text-ink-soft"}`}>{label}</span>
                <span className={`text-sm font-black tabular-nums ${isMax ? "text-leaf-deep" : "text-ink"}`}>
                  {mult}
                </span>
              </div>
            ))}
          </div>
          <div className="rough-card p-3.5">
            <p className="text-xs leading-relaxed text-ink-soft">
              <b className="text-ink">コンボ保護</b>があると、取り逃してもコンボが途切れず保護を1つ使います。
              持てるのは<b className="text-ink">最大4つ</b>まで。スコアの下に盾のアイコンで出ます。
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle eyebrow="ハザード枠" title="特殊アイテム" />
          <p className="text-xs leading-relaxed text-ink-soft">
            図鑑とは別枠で、持っているアイテムに関係なく決まった確率で落ちてきます。
          </p>
          <div className="overflow-hidden rounded-2xl border border-line">
            {[
              {
                image: "/collection/items/dog-poop.webp",
                name: "犬のうんち",
                rate: "4%",
                body: "取ると −500pt（スコアは0より下がりません）。ビニール袋があれば打ち消せます。",
              },
              {
                image: "/collection/items/mystery-question.webp",
                name: "？アイテム",
                rate: "5%",
                body: "全アイテムの中からランダムに1つのスキルが発動します。発動レベルは自分の所持レベル（未所持ならLv1）。",
              },
              {
                image: "/collection/items/plastic-bag.webp",
                name: "ビニール袋",
                rate: "3%",
                body: "3つまで持てる「うんちよけ」。うんちを踏んだとき1つ使って、ダメージを打ち消します。",
              },
            ].map((hazard) => (
              <div key={hazard.name} className="border-b border-line bg-card p-3 last:border-b-0">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper-deep">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={hazard.image} alt="" className="h-8 w-8 object-contain" loading="lazy" />
                  </span>
                  <span className="flex-1 text-sm font-black text-ink">{hazard.name}</span>
                  <span className="text-[11px] font-black tabular-nums text-ink-faint">{hazard.rate}</span>
                </div>
                <p className="mt-1.5 pl-[50px] text-[11px] leading-relaxed text-ink-soft">{hazard.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle eyebrow="育て方" title="スキルレベル" />
          <p className="text-xs leading-relaxed text-ink-soft">
            同じアイテムを重ねて引くほど、スキルが5段階で強くなります。Nと特殊アイテムはレベルの対象外です。
          </p>
          <div className="rough-card p-3.5">
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
              数字は累計の獲得数です。図鑑に載るだけでは上がらず、同じアイテムをもう一度引く必要があります。
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle eyebrow={`全${skills.length}種`} title="スキル一覧" />
          <SkillCatalog skills={skills} />
        </section>

        <section className="space-y-2">
          <SectionTitle eyebrow="報酬" title="コインのもらい方" />
          <div className="rounded-2xl border border-line bg-leaf-soft/60 px-4 py-5 text-center">
            <p className="text-base font-black tabular-nums text-leaf-deep">スコア ÷ 25 = 獲得コイン</p>
            <p className="mt-1 text-[10px] text-leaf-deep">小数点以下は切り捨て・最低1コイン</p>
          </div>
          <div className="rough-card p-3.5">
            <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-ink-soft">
              <li>1点でも取れていれば、必ず1コインはもらえます。</li>
              <li>コインがもらえるのは1プレイにつき1回だけです。</li>
              <li>キャッチ数は1プレイ2000個まで、1個あたり1500ptまでという上限があります。</li>
            </ul>
          </div>
        </section>

        <p className="pb-2 text-center text-[10px] text-ink-faint">
          数値はゲーム本体の設定にもとづいています。
        </p>
      </PageBody>
    </>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[10px] font-black tracking-[0.14em] text-ink-faint">{eyebrow}</p>
      <h2 className="mt-0.5 text-base font-black text-ink">{title}</h2>
    </div>
  );
}
