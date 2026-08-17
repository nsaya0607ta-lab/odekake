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
  ["N", "10pt", "bg-gradient-to-br from-[#eef8ec] to-[#dff0dc] border-[#bdd8b7] text-[#3f6d43] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"],
  ["R", "20pt", "bg-gradient-to-br from-[#edf7ff] to-[#dceefd] border-[#b9d5ed] text-[#326b96] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"],
  ["SR", "40pt", "bg-gradient-to-br from-[#fff9dc] via-[#fff0b8] to-[#f4d67c] border-[#d8b95e] text-[#7c5a08] shadow-[0_5px_14px_rgba(185,145,35,0.12)]"],
  ["SSR", "70pt", "bg-gradient-to-br from-[#f4ddff] via-[#dff4ff] to-[#fff0c9] border-[#d9c4e8] text-[#6b568a] shadow-[0_5px_14px_rgba(120,95,170,0.10)]"],
  ["UR", "100pt", "bg-gradient-to-br from-[#ffebe8] via-[#f7b5ab] to-[#c9362e] border-[#b72b24] text-[#7f1713] shadow-[0_6px_16px_rgba(182,45,38,0.22)]"],
  ["LR", "150pt", "bg-gradient-to-br from-[#2c2924] via-[#12110f] to-[#050505] border-[#c8a34b] text-[#f0cf72] shadow-[0_7px_18px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(240,207,114,0.16)]"],
  ["わんこ", "15pt", "bg-gradient-to-br from-[#fbf4e9] to-[#efe1cc] border-[#ddc9aa] text-[#735b3d]"],
  ["？", "10pt〜", "bg-gradient-to-br from-[#f5f2ec] to-[#e7e1d8] border-[#d2c8ba] text-[#625b52]"],
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

      <PageBody className="!space-y-5 !py-3">
        <section className="relative overflow-hidden rounded-[30px] border border-[#c9ad68] bg-gradient-to-br from-[#fffdf8] via-[#f4f0df] to-[#e5eedc] px-5 py-5 shadow-[0_14px_36px_rgba(67,55,32,0.14)]">
          <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#d5b65d] to-transparent" />
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#c9ddab]/45 blur-md" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-[#d6b05d]/25 blur-md" />
          <div className="pointer-events-none absolute right-5 top-5 text-[52px] font-black leading-none text-[#c8a64f]/10">R</div>
          <div className="relative">
            <span className="inline-flex rounded-full border border-[#cbb477] bg-[#fffaf0]/90 px-3 py-1 text-[9px] font-black tracking-[0.2em] text-[#7a6533] shadow-[0_3px_10px_rgba(120,95,40,0.08)]">
              ITEM CATCH · RULE BOOK
            </span>
            <h1 className="mt-3 text-[21px] font-black tracking-tight text-[#30291f]">30秒で、どこまで伸ばせる？</h1>
            <p className="mt-1.5 max-w-[92%] text-xs leading-relaxed text-[#6f6251]">
              落ちてくるアイテムを段ボールでキャッチ。レア度・JUST・スキルを重ねてハイスコアを狙います。
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["TIME", "30秒", "1プレイ"],
                ["REWARD", "÷25", "コイン換算"],
              ].map(([label, value, note]) => (
                <div key={label} className="rounded-2xl border border-[#dbcda6] bg-gradient-to-b from-white/95 to-[#fffaf0]/85 px-2 py-2.5 text-center shadow-[0_6px_16px_rgba(90,72,38,0.09)] backdrop-blur-sm">
                  <span className="block text-[8px] font-black tracking-[0.14em] text-[#927b48]">{label}</span>
                  <span className="mt-0.5 block text-base font-black tabular-nums text-[#3f5f37]">{value}</span>
                  <span className="block text-[9px] text-[#8b7e68]">{note}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="01" eyebrow="SCORE" title="レアリティごとの基礎得点" />
          <div className="grid grid-cols-4 gap-1.5">
            {SCORE_CARDS.map(([label, value, colors]) => (
              <div key={label} className={`rounded-2xl border px-1 py-2.5 text-center ${colors}`}>
                <span className="block text-[9px] font-black opacity-80">{label}</span>
                <span className="mt-0.5 block text-sm font-black tabular-nums">{value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-[22px] border border-[#d6c8a9] bg-gradient-to-r from-[#f5f0e4] to-[#fffaf0] p-3.5 shadow-[0_4px_12px_rgba(80,66,40,0.04)]">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d8c69b] bg-white text-sm shadow-sm">🐾</span>
              <p className="text-[11px] leading-relaxed text-[#756854]"><b className="text-[#40362a]">いつものフレブル</b>(N)は、ゲーム終了時に<b className="text-[#40362a]">取った回数 × プレイ時間(秒)</b>(小数点切り捨て)のボーナスがまとめて加算されます。</p>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="02" eyebrow="SIMULATOR" title="スコアを試算する" />
          <div className="rounded-[22px] border border-[#d4c7a6] bg-gradient-to-br from-[#fffefa] to-[#f7f1e4] p-3 shadow-[0_7px_20px_rgba(80,66,40,0.07)]">
            <p className="mb-3 text-[11px] leading-relaxed text-[#756854]">条件を変えると、ゲーム本体と同じ計算で1個あたりの得点を確認できます。</p>
            <ScoreSimulator />
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="03" eyebrow="HAZARD" title="特殊アイテム" />
          <p className="text-[11px] leading-relaxed text-[#756854]">図鑑とは別枠。所持状況に関係なく、決まった確率で落ちてきます。</p>
          <div className="rounded-[22px] border border-[#d6c8a9] bg-gradient-to-r from-[#f5f0e4] to-[#fffaf0] p-3.5 shadow-[0_4px_12px_rgba(80,66,40,0.04)]">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d8c69b] bg-white text-sm shadow-sm">🚫</span>
              <p className="text-[11px] leading-relaxed text-[#756854]"><b className="text-[#40362a]">妨害防止</b>スキルを取ると、しびれ・ダンボール縮小・時間減少のいずれか1つをランダムで防げます。1種類につき1回だけ、最大<b className="text-[#40362a]">3つ</b>まで同時に持てます。</p>
            </div>
          </div>
          <div className="grid gap-2">
            {[
              { image: "/collection/items/dog-poop.webp", name: "犬のうんち", rate: "4%", body: "取ると −500pt。ビニール袋があればダメージを打ち消せます。", tone: "bg-gradient-to-br from-[#fff7f0] to-[#f9e7d8] border-[#e7cbb5]" },
              { image: "/collection/items/mystery-question.webp", name: "？アイテム", rate: "5%", body: "全アイテムからランダムに1つのスキルが発動。未所持ならLv1です。", tone: "bg-gradient-to-br from-[#f8f3fb] to-[#ece4f3] border-[#d8cae5]" },
              { image: "/collection/items/plastic-bag.webp", name: "ビニール袋", rate: "3%", body: "最大3つまで持てる「うんちよけ」。ダメージを1回打ち消します。", tone: "bg-gradient-to-br from-[#f2f8f4] to-[#e3f0e8] border-[#c7dccd]" },
              { image: "/collection/items/hazard-time-minus.webp", name: "時間 -3秒", rate: "1.5%", body: "取ると残り時間が3秒減ります。0秒になるとその場でゲーム終了です。", tone: "bg-gradient-to-br from-[#fdf1f0] to-[#f6dcd9] border-[#e6bdb7]" },
              { image: "/collection/items/hazard-box-shrink.webp", name: "ダンボール縮小", rate: "2%", body: "3秒間、段ボールの当たり判定が0.8倍に縮みます。", tone: "bg-gradient-to-br from-[#f4f1fb] to-[#e6e0f4] border-[#cec4e5]" },
              { image: "/collection/items/hazard-blackout-squid.webp", name: "イカスミ", rate: "1%", body: "3秒間、画面の上半分が真っ黒になって見えなくなります。", tone: "bg-gradient-to-br from-[#eceef2] to-[#d8dbe3] border-[#b7bcc9]" },
              { image: "/collection/items/hazard-stun-battery.webp", name: "しびれバッテリー", rate: "2%", body: "1秒間、段ボールが操作できなくなります。", tone: "bg-gradient-to-br from-[#fff8e8] to-[#fbecc4] border-[#e6cf8f]" },
              { image: "/collection/items/hazard-chocolate-instant-end.webp", name: "呪いのチョコレート", rate: "0.20%", body: "取った瞬間、残り時間が0になりその場でゲーム終了です。", tone: "bg-gradient-to-br from-[#fbeee6] to-[#e9d3c2] border-[#c9a583]" },
            ].map((hazard) => (
              <div key={hazard.name} className={`rounded-[22px] border p-3 shadow-[0_5px_14px_rgba(80,66,40,0.045)] ${hazard.tone}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/80 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={hazard.image} alt="" className="h-9 w-9 object-contain" loading="lazy" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-black text-[#453a2d]">{hazard.name}</span>
                      <span className="rounded-full border border-white/80 bg-white/70 px-2 py-0.5 text-[9px] font-black tabular-nums text-[#796d59]">DROP {hazard.rate}</span>
                    </span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-[#756854]">{hazard.body}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="04" eyebrow="SKILL LEVEL" title="重ねてスキルを育てる" />
          <p className="text-[11px] leading-relaxed text-[#756854]">同じアイテムを引くほど5段階で強化。Nと特殊アイテムはレベル対象外です。</p>
          <div className="rounded-[22px] border border-[#d2c4a2] bg-gradient-to-br from-[#fffefa] to-[#f8f2e7] p-3.5 shadow-[0_7px_20px_rgba(80,66,40,0.07)]">
            <table className="w-full border-collapse text-[11px]">
              <thead><tr>{["レア", "Lv1", "Lv2", "Lv3", "Lv4", "MAX"].map((head) => <th key={head} className="border-b border-[#d9cba9] px-1 py-1.5 text-center text-[9px] font-black text-[#88754d] first:text-left">{head}</th>)}</tr></thead>
              <tbody>
                {[["R", 1, 12, 30, 55, 90],["SR", 1, 6, 14, 25, 40],["SSR", 1, 4, 9, 16, 26],["UR", 1, 3, 5, 9, 15],["LR", 1, 2, 3, 5, 8]].map((row) => (
                  <tr key={String(row[0])}>{row.map((cell, index) => <td key={index} className="border-b border-[#ebe3d2] px-1 py-1.5 text-center font-bold tabular-nums text-[#443a2e] last:border-b-0 first:text-left first:font-black">{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] leading-relaxed text-[#8f816b]">数字は累計獲得数です。同じアイテムをもう一度引くことでレベルが上がります。</p>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="05" eyebrow="MY SKILLS" title="持っているスキル" />
          <div className="rounded-[24px] border border-[#d0c09a] bg-gradient-to-br from-[#fffefa] to-[#f7f1e5] p-1 shadow-[0_8px_22px_rgba(80,66,40,0.07)]">
            <SkillCatalog skills={skills} total={ITEM_CATCH_SKILLS.length} />
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle number="06" eyebrow="REWARD" title="コインのもらい方" />
          <div className="overflow-hidden rounded-[26px] border border-[#b99a4f] bg-[#fffdf8] shadow-[0_10px_28px_rgba(98,72,24,0.12)]">
            <div className="relative bg-gradient-to-br from-[#dce9cf] via-[#f2f3df] to-[#f7df9d] px-4 py-5 text-center">
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#b9933e] to-transparent" />
              <p className="text-[9px] font-black tracking-[0.18em] text-[#7e692e]">COIN REWARD</p>
              <p className="mt-1 text-lg font-black tabular-nums text-[#405f36]">スコア ÷ 25 = 獲得コイン</p>
              <p className="mt-1 text-[10px] text-[#6d7252]">小数点以下は切り捨て · 最低1コイン</p>
            </div>
            <ul className="space-y-2 border-t border-[#dfcfaa] bg-gradient-to-b from-[#fffefa] to-[#fbf6eb] p-3.5 text-[11px] leading-relaxed text-[#756854]">
              <li className="flex gap-2"><span className="font-black text-[#a9822d]">01</span><span>1点でも取れていれば、必ず1コインはもらえます。</span></li>
              <li className="flex gap-2"><span className="font-black text-[#a9822d]">02</span><span>コインがもらえるのは1プレイにつき1回だけです。</span></li>
              <li className="flex gap-2"><span className="font-black text-[#a9822d]">03</span><span>キャッチ数は1プレイ2000個まで、1個あたり1500ptまでです。</span></li>
            </ul>
          </div>
        </section>

        <p className="pb-2 pt-1 text-center text-[9px] tracking-[0.14em] text-[#9b8967]">GAME DATA · 数値はゲーム本体の設定にもとづいています</p>
      </PageBody>
    </>
  );
}

function SectionTitle({ number, eyebrow, title }: { number: string; eyebrow: string; title: string }) {
  return (
    <div className="flex items-end gap-3">
      <span className="bg-gradient-to-b from-[#d6b45e] to-[#8f6e23] bg-clip-text text-xl font-black tabular-nums text-transparent">{number}</span>
      <div className="min-w-0 pb-0.5">
        <p className="text-[8px] font-black tracking-[0.2em] text-[#758567]">{eyebrow}</p>
        <h2 className="mt-0.5 text-base font-black tracking-tight text-[#3e3427]">{title}</h2>
      </div>
      <span className="mb-1 h-px flex-1 bg-gradient-to-r from-[#c6ad6f] to-transparent" />
    </div>
  );
}
