"use client";

import { useCallback, useState } from "react";
import type { EquipmentMap } from "@/lib/data/equipment";
import { ACCESSORY_SLOTS, getSlotRewards, slotOfLevel, type EquipmentSlot } from "@/lib/equipment";
import { ACCESSORY_REWARD_LEVELS, equipmentForLevel } from "@/lib/equipment-visuals";
import { LEVEL_REWARDS, type LevelReward } from "@/lib/exp";
import { EquipmentItemImage, LayeredFrenchie } from "./layered-frenchie";
import { IconCheck, IconLock } from "./icons";

type Props = {
  currentLevel: number;
  initialEquipment: EquipmentMap;
};

const CONFIRMATION_LEVELS = [null, 4, 6, 9, 18, 25, 27, 30] as const;

export function GearBoard({ currentLevel, initialEquipment }: Props) {
  const [equipment, setEquipment] = useState<EquipmentMap>(initialEquipment);
  const [pendingSlot, setPendingSlot] = useState<EquipmentSlot | null>(null);
  const [errorSlot, setErrorSlot] = useState<EquipmentSlot | null>(null);

  const setSlot = useCallback(
    async (slot: EquipmentSlot, level: number | null) => {
      const previous = equipment[slot] ?? null;
      setPendingSlot(slot);
      setErrorSlot(null);
      setEquipment((current) => {
        const next = { ...current };
        if (level === null) delete next[slot];
        else next[slot] = level;
        return next;
      });

      try {
        const response = await fetch("/api/equipment", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot, level }),
        });
        if (!response.ok) throw new Error();
      } catch {
        setEquipment((current) => {
          const next = { ...current };
          if (previous === null) delete next[slot];
          else next[slot] = previous;
          return next;
        });
        setErrorSlot(slot);
      } finally {
        setPendingSlot(null);
      }
    },
    [equipment],
  );

  const toggle = (slot: EquipmentSlot, level: number) => {
    void setSlot(slot, equipment[slot] === level ? null : level);
  };

  const motionRewards = LEVEL_REWARDS.filter((reward) => reward.kind === "motion");
  const expressionRewards = LEVEL_REWARDS.filter((reward) => reward.kind === "expression");
  const roomRewards = LEVEL_REWARDS.filter((reward) => reward.kind === "room");

  return (
    <div className="space-y-4">
      <CurrentEquipmentPreview equipment={equipment} />

      <section className="rough-card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <p className="font-bold">アクセサリー</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
            左が装備単体、右が実際の犬に重ねた姿です。選ぶと上のプレビューへすぐ反映されます。
          </p>
        </div>
        <div className="divide-y divide-line">
          {ACCESSORY_REWARD_LEVELS.map((level) => {
            const reward = LEVEL_REWARDS.find((item) => item.level === level)!;
            const slot = slotOfLevel(level)!;
            return (
              <AccessoryRewardRow
                key={level}
                reward={reward}
                equipped={equipment[slot] === level}
                unlocked={level <= currentLevel}
                pending={pendingSlot === slot}
                error={errorSlot === slot}
                onToggle={() => toggle(slot, level)}
              />
            );
          })}
        </div>
      </section>

      <MilestoneConfirmation />

      <section className="rough-card overflow-hidden">
        <p className="border-b border-line px-4 py-3 font-bold">称号</p>
        <div className="px-4 py-3">
          <TitleSlot
            rewards={getSlotRewards("title")}
            equippedLevel={equipment.title ?? null}
            currentLevel={currentLevel}
            pending={pendingSlot === "title"}
            error={errorSlot === "title"}
            onToggle={(level) => toggle("title", level)}
          />
          <p className="mt-2 text-[10px] text-ink-faint">称号は犬の画像ではなく、UI上の表示として管理します。</p>
        </div>
      </section>

      <ReadOnlySection
        title="しぐさ"
        note="犬本体のアニメーションとして自動再生します。装備レイヤーとは独立しています。"
        rewards={motionRewards}
        currentLevel={currentLevel}
      />

      <ReadOnlySection
        title="表情"
        note="顔の状態として犬本体のポーズへ反映します。アクセサリーは変更しません。"
        rewards={expressionRewards}
        currentLevel={currentLevel}
      />

      <ReadOnlySection
        title="おへや"
        note="背景や家具の報酬です。犬本体・装備とは別に管理します。"
        rewards={roomRewards}
        currentLevel={currentLevel}
      />
    </div>
  );
}

function CurrentEquipmentPreview({ equipment }: { equipment: EquipmentMap }) {
  const equippedSlots = ACCESSORY_SLOTS.filter((slot) => equipment[slot] !== undefined);
  const equippedTitle = equipment.title !== undefined
    ? LEVEL_REWARDS.find((reward) => reward.level === equipment.title)
    : null;

  return (
    <section className="rough-card overflow-hidden bg-leaf-soft/40 p-4">
      <p className="text-center text-xs font-bold text-ink-soft">現在の犬・そうびプレビュー</p>
      {equippedTitle ? (
        <p className="mt-1 text-center text-[11px] font-bold text-leaf-deep">🎗️ {equippedTitle.name}</p>
      ) : null}

      <LayeredFrenchie
        pose="happy"
        equipment={equipment}
        priority
        className="mx-auto mt-1 w-44 max-w-full"
        alt="現在の装備を着けたフレンチブルドッグ"
      />

      {equippedSlots.length === 0 ? (
        <p className="mt-2 text-center text-[11px] text-ink-faint">START：まだ何も装着していません</p>
      ) : (
        <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
          {equippedSlots.map((slot) => {
            const reward = LEVEL_REWARDS.find((item) => item.level === equipment[slot]);
            if (!reward) return null;
            return (
              <li key={slot} className="rounded-full bg-card px-2 py-1 text-[10px] text-ink-soft shadow-sm">
                {reward.name}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AccessoryRewardRow({
  reward,
  equipped,
  unlocked,
  pending,
  error,
  onToggle,
}: {
  reward: LevelReward;
  equipped: boolean;
  unlocked: boolean;
  pending: boolean;
  error: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="p-3">
      <button
        type="button"
        disabled={!unlocked || pending}
        onClick={onToggle}
        aria-pressed={equipped}
        className={`grid w-full grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] overflow-hidden rounded-2xl border text-left transition ${
          equipped
            ? "border-leaf bg-leaf-soft/60 shadow-sm"
            : unlocked
              ? "border-line-strong bg-card active:scale-[0.99]"
              : "border-line bg-paper-deep/75"
        }`}
      >
        <span className="flex min-w-0 flex-col border-r border-line p-3">
          <span className="flex items-center justify-between gap-2">
            <span className={`text-[11px] font-bold tabular-nums ${unlocked ? "text-leaf-deep" : "text-ink-faint"}`}>
              Lv.{reward.level}
            </span>
            {equipped ? <IconCheck size={14} className="text-leaf-deep" /> : null}
            {!unlocked ? <IconLock size={13} className="text-ink-faint" /> : null}
          </span>
          <span className="mt-1 min-h-8 text-xs font-bold leading-snug">{reward.name}</span>
          <span className={`mx-auto mt-2 h-[78px] w-[78px] ${unlocked ? "" : "opacity-50 grayscale"}`}>
            <EquipmentItemImage level={reward.level} />
          </span>
          <span className="mt-auto pt-1 text-center text-[9px] text-ink-faint">装備単体</span>
        </span>

        <span className={`flex min-w-0 flex-col items-center justify-end p-2 ${unlocked ? "" : "opacity-60"}`}>
          <LayeredFrenchie
            pose="happy"
            equipment={equipmentForLevel(reward.level)}
            className="w-full max-w-[150px]"
            alt={`${reward.name}を着けたフレンチブルドッグ`}
          />
          <span className="mt-1 text-[9px] text-ink-faint">同じ犬に装着</span>
        </span>
      </button>
      <div className="mt-1.5 flex min-h-4 items-center justify-between px-1 text-[10px]">
        <span className={equipped ? "font-bold text-leaf-deep" : "text-ink-faint"}>
          {equipped ? "装着中（タップで外す）" : unlocked ? "タップして装着" : `Lv.${reward.level}で獲得`}
        </span>
        {pending ? <span className="text-ink-faint">保存中…</span> : null}
      </div>
      {error ? <p className="mt-1 text-[10px] text-blossom">変更できませんでした。もう一度お試しください。</p> : null}
    </article>
  );
}

function MilestoneConfirmation() {
  return (
    <section className="rough-card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <p className="font-bold">固定ベース確認プレビュー</p>
        <p className="mt-1 text-[11px] text-ink-soft">全カードで犬本体は同じ画像です。表示されるのは指定レベルの装備だけです。</p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        {CONFIRMATION_LEVELS.map((level) => {
          const reward = level === null ? null : LEVEL_REWARDS.find((item) => item.level === level)!;
          return (
            <div key={level ?? "start"} className="min-w-0 bg-card p-2 text-center">
              <p className="text-[10px] font-bold text-leaf-deep">{level === null ? "START" : `Lv.${level}`}</p>
              <LayeredFrenchie
                pose="happy"
                equipment={equipmentForLevel(level)}
                className="mx-auto w-full max-w-[130px]"
                alt={reward ? `${reward.name}を着けたフレンチブルドッグ` : "何も装備していないフレンチブルドッグ"}
              />
              <p className="truncate text-[9px] text-ink-soft">{reward?.name ?? "装備なし"}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TitleSlot({
  rewards,
  equippedLevel,
  currentLevel,
  pending,
  error,
  onToggle,
}: {
  rewards: LevelReward[];
  equippedLevel: number | null;
  currentLevel: number;
  pending: boolean;
  error: boolean;
  onToggle: (level: number) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {rewards.map((reward) => {
          const unlocked = reward.level <= currentLevel;
          const equipped = reward.level === equippedLevel;
          return (
            <button
              key={reward.level}
              type="button"
              disabled={!unlocked || pending}
              onClick={() => onToggle(reward.level)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition ${
                equipped
                  ? "border-leaf bg-leaf-soft text-leaf-deep"
                  : unlocked
                    ? "border-line-strong bg-card text-ink-soft active:bg-paper-deep"
                    : "border-line bg-paper-deep text-ink-faint"
              }`}
            >
              {!unlocked ? <IconLock size={12} /> : <span aria-hidden="true">🎗️</span>}
              {unlocked ? reward.name : `Lv.${reward.level}で解放`}
              {equipped ? <IconCheck size={12} /> : null}
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-1.5 text-[10px] text-blossom">変更できませんでした。もう一度お試しください。</p> : null}
    </div>
  );
}

function ReadOnlySection({
  title,
  note,
  rewards,
  currentLevel,
}: {
  title: string;
  note: string;
  rewards: LevelReward[];
  currentLevel: number;
}) {
  return (
    <section className="rough-card overflow-hidden">
      <p className="border-b border-line px-4 py-3 font-bold">{title}</p>
      <p className="px-4 pt-3 text-[11px] text-ink-soft">{note}</p>
      <ul className="divide-y divide-line">
        {rewards.map((reward) => {
          const unlocked = reward.level <= currentLevel;
          return (
            <li key={reward.level} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`flex h-7 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${unlocked ? "bg-leaf-soft text-leaf-deep" : "bg-paper-deep text-ink-faint"}`}>
                Lv.{reward.level}
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${unlocked ? "font-bold" : "text-ink-faint"}`}>{reward.name}</span>
              {!unlocked ? <IconLock size={13} className="shrink-0 text-ink-faint" /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
