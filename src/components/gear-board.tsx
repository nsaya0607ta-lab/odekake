"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { EquipmentMap } from "@/lib/data/equipment";
import { ACCESSORY_SLOTS, SLOT_LABELS, getSlotRewards, type EquipmentSlot } from "@/lib/equipment";
import { LEVEL_REWARDS, type LevelReward } from "@/lib/exp";
import { GearIcon } from "./gear-art";
import { IconCheck, IconLock } from "./icons";

type Props = {
  currentLevel: number;
  initialEquipment: EquipmentMap;
};

export function GearBoard({ currentLevel, initialEquipment }: Props) {
  const router = useRouter();
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
        router.refresh();
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
    [equipment, router],
  );

  const toggle = (slot: EquipmentSlot, level: number) => {
    void setSlot(slot, equipment[slot] === level ? null : level);
  };

  const motionRewards = LEVEL_REWARDS.filter((reward) => reward.kind === "motion" || reward.kind === "expression");
  const roomRewards = LEVEL_REWARDS.filter((reward) => reward.kind === "room");

  return (
    <div className="space-y-4">
      <PreviewCard equipment={equipment} />

      <section className="rough-card overflow-hidden">
        <p className="border-b border-line px-4 py-3 font-bold">アクセサリー</p>
        <div className="divide-y divide-line">
          {ACCESSORY_SLOTS.map((slot) => (
            <SlotRow
              key={slot}
              label={SLOT_LABELS[slot]}
              rewards={getSlotRewards(slot)}
              equippedLevel={equipment[slot] ?? null}
              currentLevel={currentLevel}
              pending={pendingSlot === slot}
              error={errorSlot === slot}
              onToggle={(level) => toggle(slot, level)}
              renderIcon={(level, className) => <GearIcon level={level} className={className} />}
            />
          ))}
        </div>
      </section>

      <section className="rough-card overflow-hidden">
        <p className="border-b border-line px-4 py-3 font-bold">称号</p>
        <div className="px-4 py-3">
          <SlotRow
            label={null}
            rewards={getSlotRewards("title")}
            equippedLevel={equipment.title ?? null}
            currentLevel={currentLevel}
            pending={pendingSlot === "title"}
            error={errorSlot === "title"}
            onToggle={(level) => toggle("title", level)}
            renderIcon={() => <span aria-hidden="true">🎗️</span>}
          />
          <p className="mt-2 text-[10px] text-ink-faint">選んだ称号は、この画面と装着プレビューで確認できます。</p>
        </div>
      </section>

      <ReadOnlySection
        title="しぐさ・表情"
        note="おさんぽ中のフレブルが自動で使います。ここで装着する必要はありません。"
        rewards={motionRewards}
        currentLevel={currentLevel}
      />

      <ReadOnlySection
        title="おへや"
        note="今後のお部屋づくり機能で使う予定です。いまはまだ見た目には反映されません。"
        rewards={roomRewards}
        currentLevel={currentLevel}
      />
    </div>
  );
}

function PreviewCard({ equipment }: { equipment: EquipmentMap }) {
  const equippedSlots = ACCESSORY_SLOTS.filter((slot) => equipment[slot] !== undefined);
  const equippedTitle = equipment.title !== undefined
    ? LEVEL_REWARDS.find((reward) => reward.level === equipment.title)
    : null;

  const badgePosition: Partial<Record<EquipmentSlot, string>> = {
    hat: "left-[30%] top-[0%]",
    crown: "left-[54%] top-[0%]",
    collar: "left-[28%] top-[50%]",
    bandana: "left-[50%] top-[54%]",
    backpack: "right-[4%] top-[38%]",
  };

  return (
    <section className="rough-card overflow-hidden bg-leaf-soft/40 p-4">
      <p className="text-center text-xs font-bold text-ink-soft">そうびプレビュー</p>
      {equippedTitle ? (
        <p className="mt-1 flex items-center justify-center gap-1 text-[11px] font-bold text-leaf-deep">
          <span aria-hidden="true">🎗️</span>
          {equippedTitle.name}
        </p>
      ) : null}

      <div className="relative mx-auto mt-1 h-40 w-40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/characters/frenchie/normal/stand-happy.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
        {ACCESSORY_SLOTS.map((slot) => {
          const level = equipment[slot];
          if (level === undefined) return null;
          return (
            <span
              key={slot}
              className={`absolute h-7 w-7 -translate-x-1/2 rounded-full bg-card p-1 shadow-sm ${badgePosition[slot] ?? ""}`}
            >
              <GearIcon level={level} className="h-full w-full" />
            </span>
          );
        })}
      </div>

      {equippedSlots.length === 0 ? (
        <p className="mt-2 text-center text-[11px] text-ink-faint">まだ何も装着していません</p>
      ) : (
        <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
          {equippedSlots.map((slot) => {
            const reward = LEVEL_REWARDS.find((item) => item.level === equipment[slot]);
            if (!reward) return null;
            return (
              <li
                key={slot}
                className="flex items-center gap-1 rounded-full bg-card px-2 py-1 text-[10px] text-ink-soft shadow-sm"
              >
                <GearIcon level={reward.level} className="h-3.5 w-3.5" />
                {reward.name}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-center text-[10px] leading-relaxed text-ink-faint">
        犬の絵そのものはまだ着せ替えできないため、装着中のものはここにアイコンで表示しています。
      </p>
    </section>
  );
}

function SlotRow({
  label,
  rewards,
  equippedLevel,
  currentLevel,
  pending,
  error,
  onToggle,
  renderIcon,
}: {
  label: string | null;
  rewards: LevelReward[];
  equippedLevel: number | null;
  currentLevel: number;
  pending: boolean;
  error: boolean;
  onToggle: (level: number) => void;
  renderIcon: (level: number, className: string) => React.ReactNode;
}) {
  const equippedReward = rewards.find((reward) => reward.level === equippedLevel) ?? null;

  return (
    <div className={label ? "px-4 py-3" : undefined}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-ink-soft">{label}</p>
          <p className="text-[11px] text-ink-faint">{equippedReward ? equippedReward.name : "未装着"}</p>
        </div>
      ) : null}

      <div className={`flex flex-wrap gap-2 ${label ? "mt-2" : ""}`}>
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
              {unlocked ? renderIcon(reward.level, "h-4 w-4 shrink-0") : <IconLock size={12} className="shrink-0" />}
              {unlocked ? reward.name : `Lv.${reward.level}で解放`}
              {equipped ? <IconCheck size={12} className="shrink-0" /> : null}
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
              <span
                className={`flex h-7 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                  unlocked ? "bg-leaf-soft text-leaf-deep" : "bg-paper-deep text-ink-faint"
                }`}
              >
                Lv.{reward.level}
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${unlocked ? "font-bold" : "text-ink-faint"}`}>
                {reward.name}
              </span>
              {!unlocked ? <IconLock size={13} className="shrink-0 text-ink-faint" /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
