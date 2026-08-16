"use client";

import { useMemo, useState } from "react";
import { RARITY_STYLES, type GachaRarity } from "@/lib/gacha/config";
import { MAX_SKILL_LEVEL } from "@/lib/gacha/skill-levels";

/**
 * ルールブックの動く部分。
 * 得点の試算と、所持状況をふまえたスキル一覧をここで受け持つ。
 */

/**
 * 一覧に出す1件ぶん。
 * 持っているアイテムだけをサーバー側で選んで渡すので、未所持はここに来ない。
 */
export type GuideSkill = {
  id: string;
  name: string;
  image: string | null;
  rarity: GachaRarity;
  levels: readonly string[];
  note?: string;
  /** 累計の獲得数 */
  count: number;
  /** 現在のスキルLv */
  level: number;
  /** 次のLvまでに必要な追加獲得数。Lv.MAXならnull */
  nextRemaining: number | null;
};

// ---------------------------------------------------------------
// 得点の試算
// ---------------------------------------------------------------
const BASE_POINTS: Record<GachaRarity, number> = { N: 10, R: 20, SR: 40, SSR: 70, UR: 100, LR: 150 };
const SIM_RARITIES: GachaRarity[] = ["N", "R", "SR", "SSR", "UR", "LR"];
const SIM_MULTIPLIERS = [1, 1.5, 2, 2.5, 3];
const JUST_MULTIPLIER = 1.25;

/** frenchie-catch-game.tsx の COMBO_TIERS と同じ段 */
function comboMultiplier(combo: number) {
  if (combo >= 30) return 2;
  if (combo >= 20) return 1.5;
  if (combo >= 10) return 1.25;
  if (combo >= 5) return 1.1;
  return 1;
}

export function ScoreSimulator() {
  const [rarity, setRarity] = useState<GachaRarity>("SSR");
  const [skillMultiplier, setSkillMultiplier] = useState(1);
  const [combo, setCombo] = useState(12);
  const [just, setJust] = useState(false);

  // ゲーム本体と同じく、かけるたびに丸める
  const base = BASE_POINTS[rarity];
  const afterSkill = Math.round(base * skillMultiplier);
  const afterJust = just ? Math.round(afterSkill * JUST_MULTIPLIER) : afterSkill;
  const comboMult = comboMultiplier(combo);
  const total = comboMult > 1 ? Math.round(afterJust * comboMult) : afterJust;

  const steps = [
    { label: `基礎 ${rarity}`, value: `${base}pt` },
    ...(skillMultiplier !== 1 ? [{ label: "スキル", value: `×${skillMultiplier}` }] : []),
    ...(just ? [{ label: "JUST", value: `×${JUST_MULTIPLIER}` }] : []),
    { label: "コンボ", value: `×${comboMult}` },
  ];

  return (
    <div className="rough-card overflow-hidden !p-0">
      <div className="space-y-4 p-4">
        <div>
          <p className="text-[10px] font-black tracking-[0.12em] text-ink-faint">レアリティ</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SIM_RARITIES.map((r) => (
              <PickButton key={r} active={rarity === r} onClick={() => setRarity(r)}>
                {r}
              </PickButton>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black tracking-[0.12em] text-ink-faint">スキルの得点倍率</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SIM_MULTIPLIERS.map((m) => (
              <PickButton key={m} active={skillMultiplier === m} onClick={() => setSkillMultiplier(m)}>
                {m === 1 ? "なし" : `×${m}`}
              </PickButton>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black tracking-[0.12em] text-ink-faint">コンボ数</p>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={40}
              value={combo}
              onChange={(event) => setCombo(Number(event.target.value))}
              aria-label="コンボ数"
              className="h-6 flex-1 accent-leaf"
            />
            <span className="w-[74px] shrink-0 text-right text-xs font-black tabular-nums text-ink">
              {combo} コンボ
            </span>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={just}
            onChange={(event) => setJust(event.target.checked)}
            className="h-4 w-4 accent-leaf"
          />
          <span className="text-xs font-bold text-ink">JUST判定（段ボールの中央でキャッチ）</span>
        </label>
      </div>

      <div className="border-t border-line bg-leaf-soft/60 px-4 py-4 text-center">
        <p className="text-[10px] font-black tracking-[0.14em] text-leaf-deep">1個あたりの得点</p>
        <p className="mt-0.5 text-4xl font-black leading-none tabular-nums text-leaf-deep">
          {total.toLocaleString("ja-JP")}
          <span className="ml-1 text-sm font-black">pt</span>
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {steps.map((step) => (
            <span
              key={step.label}
              className="rounded-lg border border-line bg-card px-2 py-0.5 text-[10px] text-ink-faint"
            >
              {step.label} <b className="font-black tabular-nums text-ink">{step.value}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PickButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border px-3 py-1.5 text-xs font-black transition-transform active:scale-95 ${
        active ? "border-leaf bg-leaf text-white" : "border-line bg-card text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------
// スキル一覧
// ---------------------------------------------------------------
const RARITY_TABS: (GachaRarity | "all")[] = ["all", "R", "SR", "SSR", "UR", "LR"];

export function SkillCatalog({ skills, total }: { skills: GuideSkill[]; total: number }) {
  const [rarity, setRarity] = useState<GachaRarity | "all">("all");

  const visible = useMemo(
    () => (rarity === "all" ? skills : skills.filter((skill) => skill.rarity === rarity)),
    [skills, rarity],
  );

  if (skills.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
        <p className="text-xs leading-relaxed text-ink-faint">
          まだスキルを持っていません。
          <br />
          ガチャでアイテムを集めると、ここに効果が出ます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rough-card p-4">
        <div className="flex items-baseline gap-2">
          <span className="flex-1 text-xs font-black text-ink">使えるスキル</span>
          <span className="text-sm font-black tabular-nums text-leaf-deep">
            {skills.length} / {total}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-leaf transition-[width] duration-500"
            style={{ width: `${total ? (skills.length / total) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
          持っているアイテムのスキルだけを出しています。ガチャで集めるとここに増えていきます。
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {RARITY_TABS.map((tab) => (
          <PickButton key={tab} active={rarity === tab} onClick={() => setRarity(tab)}>
            {tab === "all" ? "すべて" : tab}
          </PickButton>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <p className="text-xs text-ink-faint">このレアリティのスキルはまだ持っていません。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((skill) => (
            <SkillRow key={skill.id} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}

function SkillRow({ skill }: { skill: GuideSkill }) {
  const tone = RARITY_STYLES[skill.rarity];

  return (
    <article className="rough-card p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paper-deep">
          {skill.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={skill.image} alt="" className="h-9 w-9 object-contain" loading="lazy" />
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-black text-ink">{skill.name}</h3>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black ${tone.badge}`}>
              {skill.rarity}
            </span>
          </div>
          {skill.note ? <p className="mt-0.5 text-[10px] leading-snug text-ink-faint">{skill.note}</p> : null}
        </div>

        <span className="shrink-0 text-right">
          <span className="block text-[11px] font-black text-leaf-deep">
            {skill.level >= MAX_SKILL_LEVEL ? "Lv.MAX" : `Lv${skill.level}`}
          </span>
          <span className="block text-[9px] text-ink-faint">
            {skill.nextRemaining === null ? `${skill.count}個` : `あと${skill.nextRemaining}個`}
          </span>
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-5 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {skill.levels.map((text, index) => {
          const isCurrent = skill.level === index + 1;
          return (
            <div
              key={index}
              className={`px-1 py-1.5 text-center ${isCurrent ? "bg-leaf-soft" : "bg-card"}`}
            >
              <span
                className={`block text-[8px] font-black ${isCurrent ? "text-leaf-deep" : "text-ink-faint"}`}
              >
                {index + 1 === MAX_SKILL_LEVEL ? "MAX" : `Lv${index + 1}`}
              </span>
              <span
                className={`mt-0.5 block text-[9px] font-bold leading-tight ${
                  isCurrent ? "text-leaf-deep" : "text-ink"
                }`}
              >
                {text}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
