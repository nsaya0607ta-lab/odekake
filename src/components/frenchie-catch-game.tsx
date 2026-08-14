"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type FrenchieCatchItem = {
  id: string;
  name: string;
  image: string;
  rarity: "N" | "R" | "SR" | "SSR" | "UR";
};

type Entity = {
  id: number;
  itemId: string | null;
  kind: "dog" | "item";
  name: string;
  image: string;
  rarity: FrenchieCatchItem["rarity"] | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  status: "falling" | "bounced" | "caught";
  rimChecked: boolean;
  enteredOpening: boolean;
  missHandled: boolean;
  ttl: number;
};

type CatchFeedback = {
  name: string;
  points: number;
  effect?: string;
};

const ROUND_SECONDS = 30;
const BOX_IMAGE = "/4EA485D9-BB37-47F3-97F0-111CF0E4AF7E.png";
const BOX_WIDTH = 37.8;
const BOX_HALF = BOX_WIDTH / 2;
const BOX_HEIGHT = BOX_WIDTH * 0.75;
const BOX_BOTTOM = 0.5;
const BOX_TOP = 100 - BOX_BOTTOM - BOX_HEIGHT;
const OPEN_TOP_LOCAL_Y = 0.17;
const OPEN_BOTTOM_LOCAL_Y = 0.48;
const CATCH_START_LOCAL_Y = 0.36;
const BOX_OPEN_TOP_Y = BOX_TOP + BOX_HEIGHT * OPEN_TOP_LOCAL_Y;
const BOX_LIP_Y = BOX_TOP + BOX_HEIGHT * OPEN_BOTTOM_LOCAL_Y;
const BOX_MIN_X = BOX_HALF + 1;
const BOX_MAX_X = 100 - BOX_HALF - 1;
const BOX_WIDE_SCALE = 1.5;
const POINTS: Record<FrenchieCatchItem["rarity"], number> = { N: 10, R: 20, SR: 40, SSR: 70, UR: 100 };
const RARITY_FALL_SPEED: Record<FrenchieCatchItem["rarity"], number> = { N: 1, R: 1.08, SR: 1.18, SSR: 1.32, UR: 1.5 };
const DEFAULT_ITEM_SPAWN_WEIGHT = 100;
const DOG_SPAWN_RATIO = 0.28;
const FRENCHIE_SKIN_IDS = ["hiking_frenchie", "snow_frenchie", "summer_frenchie"];
const FRENCHIE_SKIN_SPAWN_CHANCE = 0.18;
const ITEM_SPAWN_WEIGHTS: Partial<Record<string, number>> = {
  toy_duck_plush: 50,
  toy_carrot: 35,
  toy_treasure_puzzle: 30,
  other_omojii: 8,
};
const RARITY_STYLE: Record<FrenchieCatchItem["rarity"], string> = {
  N: "drop-shadow-[0_4px_7px_rgba(80,120,80,0.22)]",
  R: "drop-shadow-[0_4px_9px_rgba(74,142,200,0.34)]",
  SR: "drop-shadow-[0_0_10px_rgba(235,180,55,0.68)]",
  SSR: "drop-shadow-[0_0_13px_rgba(177,112,220,0.78)]",
  UR: "drop-shadow-[0_0_16px_rgba(201,66,55,0.92)]",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function overlap(leftA: number, rightA: number, leftB: number, rightB: number) {
  return Math.max(0, Math.min(rightA, rightB) - Math.max(leftA, leftB));
}

function comboScoreMultiplier(combo: number) {
  if (combo >= 30) return 2;
  if (combo >= 20) return 1.5;
  if (combo >= 10) return 1.25;
  if (combo >= 5) return 1.1;
  return 1;
}

function comboMilestoneLabel(combo: number) {
  if (combo === 30) return "MAX COMBO! ×2";
  if (combo === 20) return "SUPER COMBO! ×1.5";
  if (combo === 10) return "GREAT! ×1.25";
  if (combo === 5) return "GOOD! ×1.1";
  return undefined;
}

function openingBoundsAt(localY: number) {
  const t = clamp((localY - OPEN_TOP_LOCAL_Y) / (OPEN_BOTTOM_LOCAL_Y - OPEN_TOP_LOCAL_Y), 0, 1);
  const left = 0.145 - t * 0.055;
  const right = 0.855 + t * 0.055;
  return { left, right };
}

function isCardboardTap(localX: number, localY: number) {
  const front = localY >= 0.47 && localY <= 0.94 && localX >= 0.07 && localX <= 0.93;
  const leftSide = localY >= 0.16 && localY <= 0.50 && localX >= 0.055 && localX <= 0.18;
  const rightSide = localY >= 0.16 && localY <= 0.50 && localX >= 0.82 && localX <= 0.945;
  return front || leftSide || rightSide;
}

export function FrenchieCatchGame({ ownedItems }: { ownedItems: FrenchieCatchItem[] }) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const catcherRef = useRef<HTMLDivElement | null>(null);
  const entitiesRef = useRef<Entity[]>([]);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef(0);
  const boxXRef = useRef(50);
  const nextIdRef = useRef(1);
  const startAtRef = useRef(0);
  const endAtRef = useRef(0);
  const nextSpawnRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const caughtRef = useRef(0);
  const roundIdRef = useRef<string | null>(null);
  const nextMultiplierRef = useRef(1);
  const nextBonus5Ref = useRef(0);
  const nextBonus10Ref = useRef(0);
  const comboShieldRef = useRef(0);
  const multiplier15UntilRef = useRef(0);
  const multiplier2UntilRef = useRef(0);
  const wideCatchUntilRef = useRef(0);
  const nextBigRef = useRef(false);
  const spawnSlowUntilRef = useRef(0);
  const comboKeepRef = useRef(0);
  const rainbowUntilRef = useRef(0);
  const boxWideUntilRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const impactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<"idle" | "playing" | "finished">("idle");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [boxX, setBoxX] = useState(50);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [caught, setCaught] = useState(0);
  const [feedback, setFeedback] = useState<CatchFeedback | null>(null);
  const [activeEffects, setActiveEffects] = useState<string[]>([]);
  const [impactX, setImpactX] = useState<number | null>(null);
  const [boxBounce, setBoxBounce] = useState(false);
  const [coinReward, setCoinReward] = useState<number | null>(null);
  const [rewardPending, setRewardPending] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);

  const itemPool = useMemo(() => ownedItems.filter((item) => item.image.length > 0), [ownedItems]);

  const refreshEffectStatus = useCallback((now: number) => {
    const labels: string[] = [];
    if (now < multiplier2UntilRef.current) labels.push("得点 ×2");
    else if (now < multiplier15UntilRef.current) labels.push("得点 ×1.5");
    if (nextMultiplierRef.current > 1) labels.push(`次の1個 ×${nextMultiplierRef.current}`);
    if (nextBonus10Ref.current > 0) labels.push(`あと${nextBonus10Ref.current}個 +10pt`);
    if (nextBonus5Ref.current > 0) labels.push(`あと${nextBonus5Ref.current}個 +5pt`);
    if (comboShieldRef.current > 0) labels.push(`コンボ保護 ×${comboShieldRef.current}`);
    if (comboKeepRef.current > 0) labels.push(`コンボ据え置き ×${comboKeepRef.current}`);
    if (now < wideCatchUntilRef.current) labels.push("キャッチ判定拡大中");
    if (now < spawnSlowUntilRef.current) labels.push("小休憩中");
    if (now < rainbowUntilRef.current) labels.push("虹色エフェクト中");
    if (now < boxWideUntilRef.current) labels.push("ダンボール拡大中");
    if (nextBigRef.current) labels.push("次の1個 拡大表示");
    setActiveEffects(labels);
  }, []);

  const createEntity = useCallback((): Entity => {
    const base = {
      id: nextIdRef.current++,
      x: 9 + Math.random() * 82,
      y: -13 - Math.random() * 5,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 17 + Math.random() * 5,
      rotation: (Math.random() - 0.5) * 12,
      status: "falling" as const,
      rimChecked: false,
      enteredOpening: false,
      missHandled: false,
      ttl: 0,
    };

    if (itemPool.length === 0) {
      return {
        ...base,
        itemId: null,
        kind: "dog",
        name: "初期フレブル",
        image: "/characters/default/front.webp",
        rarity: null,
        size: 19,
        spin: (Math.random() - 0.5) * 20,
      };
    }

    const weightedItems = itemPool.map((item) => ({
      item,
      weight: ITEM_SPAWN_WEIGHTS[item.id] ?? DEFAULT_ITEM_SPAWN_WEIGHT,
    }));
    const itemWeightTotal = weightedItems.reduce((sum, entry) => sum + entry.weight, 0);
    const dogWeight = itemPool.length * DEFAULT_ITEM_SPAWN_WEIGHT * (DOG_SPAWN_RATIO / (1 - DOG_SPAWN_RATIO));
    let roll = Math.random() * (dogWeight + itemWeightTotal);

    if (roll < dogWeight) {
      const skinPool = itemPool.filter((item) => FRENCHIE_SKIN_IDS.includes(item.id));
      if (skinPool.length > 0 && Math.random() < FRENCHIE_SKIN_SPAWN_CHANCE) {
        const skin = skinPool[Math.floor(Math.random() * skinPool.length)]!;
        return {
          ...base,
          itemId: skin.id,
          kind: "item",
          name: skin.name,
          image: skin.image,
          rarity: skin.rarity,
          vy: base.vy * RARITY_FALL_SPEED[skin.rarity],
          size: 15.5 + Math.random() * 3.5,
          spin: (Math.random() - 0.5) * 20,
        };
      }
      return {
        ...base,
        itemId: null,
        kind: "dog",
        name: "初期フレブル",
        image: "/characters/default/front.webp",
        rarity: null,
        size: 19,
        spin: (Math.random() - 0.5) * 20,
      };
    }

    roll -= dogWeight;
    let item = weightedItems[weightedItems.length - 1]!.item;
    for (const entry of weightedItems) {
      roll -= entry.weight;
      if (roll <= 0) {
        item = entry.item;
        break;
      }
    }

    const isBig = nextBigRef.current;
    if (isBig) nextBigRef.current = false;

    return {
      ...base,
      itemId: item.id,
      kind: "item",
      name: item.name,
      image: item.image,
      rarity: item.rarity,
      vy: base.vy * RARITY_FALL_SPEED[item.rarity],
      size: (12.5 + Math.random() * 3.5) * (isBig ? 1.4 : 1),
      spin: (Math.random() - 0.5) * 65,
    };
  }, [itemPool]);

  const showCatch = useCallback((entity: Entity, points: number, effect?: string) => {
    setFeedback({ name: entity.name, points, effect });
    setBoxBounce(true);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      setBoxBounce(false);
    }, 900);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(18);
  }, []);

  const showImpact = useCallback((x: number) => {
    setImpactX(x);
    if (impactTimerRef.current) clearTimeout(impactTimerRef.current);
    impactTimerRef.current = setTimeout(() => setImpactX(null), 280);
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (impactTimerRef.current) clearTimeout(impactTimerRef.current);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    let last = performance.now();

    const frame = (now: number) => {
      const elapsed = (now - startAtRef.current) / 1000;
      const remaining = Math.max(0, (endAtRef.current - now) / 1000);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        setPhase("finished");
        return;
      }

      let timedEffectChanged = false;
      if (multiplier2UntilRef.current > 0 && now >= multiplier2UntilRef.current) {
        multiplier2UntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (multiplier15UntilRef.current > 0 && now >= multiplier15UntilRef.current) {
        multiplier15UntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (wideCatchUntilRef.current > 0 && now >= wideCatchUntilRef.current) {
        wideCatchUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (spawnSlowUntilRef.current > 0 && now >= spawnSlowUntilRef.current) {
        spawnSlowUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (rainbowUntilRef.current > 0 && now >= rainbowUntilRef.current) {
        rainbowUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (boxWideUntilRef.current > 0 && now >= boxWideUntilRef.current) {
        boxWideUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (timedEffectChanged) refreshEffectStatus(now);

      const breakCombo = (entity: Entity) => {
        if (entity.missHandled) return;
        entity.missHandled = true;
        if (comboKeepRef.current > 0) {
          comboKeepRef.current -= 1;
          refreshEffectStatus(now);
          return;
        }
        if (comboRef.current > 0 && comboShieldRef.current > 0) {
          comboShieldRef.current -= 1;
          refreshEffectStatus(now);
          return;
        }
        comboRef.current = 0;
        setCombo(0);
      };

      const dt = Math.min(0.035, Math.max(0, (now - last) / 1000));
      last = now;
      if (now >= nextSpawnRef.current && entitiesRef.current.length < 10) {
        entitiesRef.current.push(createEntity());
        const spawnSlowExtra = now < spawnSlowUntilRef.current ? 600 : 0;
        nextSpawnRef.current = now + 790 - Math.min(1, elapsed / ROUND_SECONDS) * 250 + Math.random() * 170 + spawnSlowExtra;
      }

      const boxWide = now < boxWideUntilRef.current;
      const effBoxHalf = boxWide ? BOX_HALF * BOX_WIDE_SCALE : BOX_HALF;
      const effBoxWidth = boxWide ? BOX_WIDTH * BOX_WIDE_SCALE : BOX_WIDTH;

      const next: Entity[] = [];
      for (const entity of entitiesRef.current) {
        if (entity.status === "caught") {
          entity.ttl -= dt;
          entity.vy += 42 * dt;
          entity.x += entity.vx * dt;
          entity.y += entity.vy * dt;
          entity.rotation += entity.spin * dt;
          if (entity.ttl > 0) next.push(entity);
          continue;
        }

        const previousY = entity.y;
        if (entity.status === "bounced") entity.vy += 38 * dt;
        entity.x += entity.vx * dt;
        entity.y += entity.vy * dt;
        entity.rotation += entity.spin * dt;

        const hitboxWidth = entity.size * (entity.kind === "dog" ? 0.56 : 0.62);
        const hitLeft = entity.x - hitboxWidth / 2;
        const hitRight = entity.x + hitboxWidth / 2;
        const bottomOffset = entity.size * (entity.kind === "dog" ? 0.34 : 0.31);
        const previousBottom = previousY + bottomOffset;
        const bottom = entity.y + bottomOffset;

        if (entity.vy < 0 && bottom < BOX_OPEN_TOP_Y - 1.5) {
          entity.enteredOpening = false;
          if (entity.status === "bounced") entity.rimChecked = false;
        }

        if (entity.vy > 0 && bottom >= BOX_OPEN_TOP_Y) {
          const center = boxXRef.current;
          const localY = (bottom - BOX_TOP) / BOX_HEIGHT;
          const previousLocalY = (previousBottom - BOX_TOP) / BOX_HEIGHT;
          const localHitLeft = (hitLeft - (center - effBoxHalf)) / effBoxWidth;
          const localHitRight = (hitRight - (center - effBoxHalf)) / effBoxWidth;
          const localHitWidth = Math.max(0.001, localHitRight - localHitLeft);
          const localCenterX = (entity.x - (center - effBoxHalf)) / effBoxWidth;
          const opening = openingBoundsAt(localY);
          const catchMargin = now < wideCatchUntilRef.current ? 0.05 : 0;
          const catchOpening = { left: opening.left - catchMargin, right: opening.right + catchMargin };

          if (!entity.enteredOpening && previousLocalY < OPEN_TOP_LOCAL_Y && localY >= OPEN_TOP_LOCAL_Y) {
            const entryOpening = openingBoundsAt(OPEN_TOP_LOCAL_Y);
            const entryRatio = overlap(localHitLeft, localHitRight, entryOpening.left - catchMargin, entryOpening.right + catchMargin) / localHitWidth;
            const entryInset = 0.035;
            entity.enteredOpening = entryRatio >= 0.68
              && localCenterX >= entryOpening.left - catchMargin + entryInset
              && localCenterX <= entryOpening.right + catchMargin - entryInset;
          }

          const widthFullyInsideOpening = localHitLeft >= catchOpening.left && localHitRight <= catchOpening.right;
          const canCatch = entity.enteredOpening
            && localY >= CATCH_START_LOCAL_Y
            && localY <= OPEN_BOTTOM_LOCAL_Y + 0.10
            && widthFullyInsideOpening;

          if (canCatch) {
            entity.rimChecked = true;
            entity.status = "caught";
            entity.ttl = 0.16;
            entity.vx *= 0.35;
            entity.vy = Math.max(entity.vy, 32);
            entity.spin *= 0.45;

            const basePoints = entity.kind === "dog" ? 15 : POINTS[entity.rarity!];
            let pendingBonus = 0;
            let statusChanged = false;

            if (nextBonus5Ref.current > 0) {
              pendingBonus += 5;
              nextBonus5Ref.current -= 1;
              statusChanged = true;
            }
            if (nextBonus10Ref.current > 0) {
              pendingBonus += 10;
              nextBonus10Ref.current -= 1;
              statusChanged = true;
            }

            const timedMultiplier = now < multiplier2UntilRef.current
              ? 2
              : now < multiplier15UntilRef.current
                ? 1.5
                : 1;
            const nextMultiplier = nextMultiplierRef.current;
            if (nextMultiplier > 1) {
              nextMultiplierRef.current = 1;
              statusChanged = true;
            }
            const multiplier = Math.max(timedMultiplier, nextMultiplier);
            let points = Math.round((basePoints + pendingBonus) * multiplier);
            let effectLabel: string | undefined;

            const addBonusTime = (seconds: number) => {
              endAtRef.current += seconds * 1000;
              setTimeLeft(Math.ceil(Math.max(0, (endAtRef.current - now) / 1000)));
              return seconds;
            };

            switch (entity.itemId) {
              case "toy_soccer_ball":
                points += 10;
                effectLabel = "+10ptボーナス";
                break;
              case "toy_taiyaki_plush":
                points += 15;
                effectLabel = "+15ptボーナス";
                break;
              case "toy_bear_plush":
                comboShieldRef.current += 1;
                effectLabel = "コンボ1回保護";
                statusChanged = true;
                break;
              case "toy_duck_plush": {
                const applied = addBonusTime(2);
                effectLabel = `+${applied}秒`;
                break;
              }
              case "toy_carrot": {
                const applied = addBonusTime(3);
                effectLabel = `+${applied}秒`;
                break;
              }
              case "toy_frisbee":
                nextMultiplierRef.current = 2;
                effectLabel = "次の1個 ×2";
                statusChanged = true;
                break;
              case "food_paw_bowl":
                nextBonus5Ref.current += 3;
                effectLabel = "次の3個 +5pt";
                statusChanged = true;
                break;
              case "toy_meat":
                multiplier15UntilRef.current = now + 5000;
                effectLabel = "5秒間 ×1.5";
                statusChanged = true;
                break;
              case "toy_frenchie_cushion":
                points += 30;
                effectLabel = "+30ptボーナス";
                break;
              case "toy_treasure_puzzle": {
                const roll = Math.floor(Math.random() * 3);
                if (roll === 0) {
                  points += 20;
                  effectLabel = "宝箱 +20pt";
                } else if (roll === 1) {
                  points += 50;
                  effectLabel = "宝箱 +50pt";
                } else {
                  const applied = addBonusTime(5);
                  effectLabel = `宝箱 +${applied}秒`;
                }
                break;
              }
              case "toy_frenchie_plush":
                nextBonus10Ref.current += 3;
                effectLabel = "次の3個 +10pt";
                statusChanged = true;
                break;
              case "toy_rainbow_ball":
                multiplier2UntilRef.current = now + 5000;
                effectLabel = "5秒間 ×2";
                statusChanged = true;
                break;
              case "toy_golden_crown_ball":
                nextMultiplierRef.current = 3;
                effectLabel = "次の1個 ×3";
                statusChanged = true;
                break;
              case "interior_anball":
                points += 100;
                effectLabel = "+100ptボーナス";
                break;
              case "other_azubee":
                multiplier2UntilRef.current = now + 5000;
                effectLabel = "5秒間 ×2";
                statusChanged = true;
                break;
              case "other_omojii": {
                const applied = addBonusTime(10);
                effectLabel = `+${applied}秒`;
                break;
              }
              case "food_paw_pudding":
              case "food_paw_melon_bread":
                points += 15;
                effectLabel = "+15ptボーナス";
                break;
              case "toy_paw_macaron":
              case "food_paw_cupcake":
                wideCatchUntilRef.current = now + 3000;
                effectLabel = "3秒間 キャッチ判定拡大";
                statusChanged = true;
                break;
              case "food_strawberry_roll_cake":
                nextBigRef.current = true;
                effectLabel = "次の1個 拡大表示";
                statusChanged = true;
                break;
              case "toy_star_wan_wand": {
                const timeBonus = Math.round(Math.max(0, (endAtRef.current - now) / 1000));
                points += timeBonus;
                effectLabel = `残り時間ボーナス +${timeBonus}pt`;
                break;
              }
              case "interior_sleepy_moon":
              case "interior_spring_flower_wreath":
                spawnSlowUntilRef.current = now + 4000;
                effectLabel = "4秒間 小休憩";
                statusChanged = true;
                break;
              case "other_sparkle_rope_crown":
                effectLabel = "きらきらボーナス";
                break;
              case "toy_wood_stick":
                boxWideUntilRef.current = now + 3000;
                effectLabel = "3秒間 ダンボール拡大";
                statusChanged = true;
                break;
              case "other_nakayoshi_azubee":
              case "other_kamunayo":
                comboKeepRef.current += 1;
                effectLabel = "コンボ据え置き1回";
                statusChanged = true;
                break;
              case "interior_kinoko_azubee":
              case "other_komochi":
              case "other_azuki":
              case "other_kobee":
                rainbowUntilRef.current = now + 6000;
                effectLabel = "6秒間 虹色エフェクト";
                statusChanged = true;
                break;
              default:
                break;
            }

            const nextCombo = comboRef.current + 1;
            const comboMultiplier = comboScoreMultiplier(nextCombo);
            if (comboMultiplier > 1) points = Math.round(points * comboMultiplier);
            const milestoneLabel = comboMilestoneLabel(nextCombo);
            if (milestoneLabel) effectLabel = effectLabel ? `${effectLabel} / ${milestoneLabel}` : milestoneLabel;

            scoreRef.current += points;
            comboRef.current = nextCombo;
            caughtRef.current += 1;
            maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            setCaught(caughtRef.current);
            setMaxCombo(maxComboRef.current);
            if (statusChanged) refreshEffectStatus(now);
            showCatch(entity, points, effectLabel);
          } else if (!entity.rimChecked && localY >= OPEN_TOP_LOCAL_Y - 0.02 && localY <= OPEN_BOTTOM_LOCAL_Y + 0.10) {
            const wallInnerPadding = 0.025;
            const leftWallHit = overlap(localHitLeft, localHitRight, 0.045, opening.left + wallInnerPadding) > 0;
            const rightWallHit = overlap(localHitLeft, localHitRight, opening.right - wallInnerPadding, 0.955) > 0;

            if (leftWallHit || rightWallHit) {
              entity.rimChecked = true;
              const side = leftWallHit && !rightWallHit ? "left" : rightWallHit && !leftWallHit ? "right" : entity.x <= center ? "left" : "right";
              const contactLocalX = side === "left" ? opening.left : opening.right;
              const contactX = center - effBoxHalf + contactLocalX * effBoxWidth;
              const impactOffset = clamp((contactX - entity.x) / Math.max(hitboxWidth / 2, 0.001), -1, 1);
              const incomingVx = entity.vx;
              const incomingVy = entity.vy;
              const impactSpeed = Math.hypot(incomingVx, incomingVy);

              let direction: -1 | 1;
              if (impactOffset > 0.06) direction = -1;
              else if (impactOffset < -0.06) direction = 1;
              else if (incomingVx > 0.3) direction = -1;
              else if (incomingVx < -0.3) direction = 1;
              else direction = side === "left" ? 1 : -1;

              const lateralFactor = 0.58 + Math.abs(impactOffset) * 0.62;
              const horizontalSpeed = clamp(impactSpeed * 0.48 * lateralFactor, 6.5, 20);
              const verticalSpeed = clamp(Math.abs(incomingVy) * 0.52 + impactSpeed * 0.10, 7.5, 16);

              entity.status = "bounced";
              entity.vx = direction * horizontalSpeed;
              entity.vy = -verticalSpeed;
              entity.x += direction * Math.max(0.7, hitboxWidth * 0.08);
              entity.spin = clamp(entity.spin + direction * (110 + Math.abs(impactOffset) * 210), -420, 420);
              showImpact(clamp(contactX, 4, 96));
            }
          }
        }

        if (entity.y > 110 || entity.x < -18 || entity.x > 118) {
          if (entity.status !== "caught") breakCombo(entity);
          continue;
        }
        next.push(entity);
      }

      entitiesRef.current = next;
      setEntities([...next]);
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [createEntity, phase, refreshEffectStatus, showCatch, showImpact]);

  useEffect(() => {
    if (phase !== "finished" || !roundIdRef.current) return;
    const roundId = roundIdRef.current;
    let cancelled = false;

    const grantReward = async () => {
      setRewardPending(true);
      setRewardError(null);
      try {
        const response = await fetch("/api/coins/item-catch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roundId,
            score: scoreRef.current,
            caughtCount: caughtRef.current,
            durationSeconds: ROUND_SECONDS,
          }),
        });
        const payload = (await response.json().catch(() => null)) as { coins?: number; error?: string } | null;
        if (!response.ok) throw new Error(payload?.error ?? "コインを受け取れませんでした。");
        if (cancelled) return;
        setCoinReward(payload?.coins ?? 0);
      } catch (error) {
        if (cancelled) return;
        setRewardError(error instanceof Error ? error.message : "コインを受け取れませんでした。");
      } finally {
        if (!cancelled) setRewardPending(false);
      }
    };

    void grantReward();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const startGame = useCallback(() => {
    const now = performance.now();
    entitiesRef.current = [];
    nextIdRef.current = 1;
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    caughtRef.current = 0;
    boxXRef.current = 50;
    draggingRef.current = false;
    dragOffsetRef.current = 0;
    roundIdRef.current = crypto.randomUUID();
    nextMultiplierRef.current = 1;
    nextBonus5Ref.current = 0;
    nextBonus10Ref.current = 0;
    comboShieldRef.current = 0;
    multiplier15UntilRef.current = 0;
    multiplier2UntilRef.current = 0;
    setEntities([]);
    setBoxX(50);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setCaught(0);
    setTimeLeft(ROUND_SECONDS);
    setFeedback(null);
    setActiveEffects([]);
    setImpactX(null);
    setCoinReward(null);
    setRewardPending(false);
    setRewardError(null);
    startAtRef.current = now;
    endAtRef.current = now + ROUND_SECONDS * 1000;
    nextSpawnRef.current = now;
    setPhase("playing");
  }, []);

  const moveBox = useCallback((clientX: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pointerX = ((clientX - rect.left) / rect.width) * 100;
    const nextX = clamp(pointerX - dragOffsetRef.current, BOX_MIN_X, BOX_MAX_X);
    boxXRef.current = nextX;
    setBoxX(nextX);
  }, []);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "playing") return;
    const catcherRect = catcherRef.current?.getBoundingClientRect();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!catcherRect || !boardRect || catcherRect.width <= 0 || catcherRect.height <= 0 || boardRect.width <= 0) return;
    const localX = (event.clientX - catcherRect.left) / catcherRect.width;
    const localY = (event.clientY - catcherRect.top) / catcherRect.height;
    if (!isCardboardTap(localX, localY)) return;
    const pointerX = ((event.clientX - boardRect.left) / boardRect.width) * 100;
    dragOffsetRef.current = pointerX - boxXRef.current;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase === "playing" && draggingRef.current) moveBox(event.clientX);
  };

  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section className="rough-card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-ink-faint">MINI GAME</p>
          <h2 className="mt-0.5 text-base font-black text-ink">アイテムキャッチ</h2>
        </div>
        <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-[10px] font-bold text-leaf-deep">30秒チャレンジ</span>
      </div>

      <div ref={boardRef} className="relative aspect-[3/4] w-full select-none overflow-hidden bg-[#dff3fa]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#caeef9_0%,#eff9f2_70%,#d9ebbd_100%)]" />
        <div className="absolute -left-8 top-[18%] h-20 w-36 rounded-full bg-white/50 blur-xl" />
        <div className="absolute -right-10 top-[34%] h-24 w-40 rounded-full bg-white/50 blur-xl" />
        <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[linear-gradient(180deg,rgba(208,232,171,0)_0%,#c9e29e_72%,#efdcb8_73%,#e9cfa5_73%,#e9cfa5_100%)]" />

        <div className="absolute left-3 right-3 top-3 z-30 flex items-start justify-between gap-2">
          <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2 shadow-sm"><p className="text-[9px] font-bold tracking-widest text-ink-faint">SCORE</p><p className="text-xl font-black tabular-nums text-ink">{score.toLocaleString("ja-JP")}</p></div>
          {combo >= 2 ? <div className="rounded-full border border-[#f1c969] bg-[#fff6cc]/95 px-3 py-1.5 text-center shadow-sm"><p className="text-lg font-black leading-none text-[#b77322]">{combo}</p><p className="text-[8px] font-black text-[#b77322]">COMBO!{combo >= 5 ? ` ×${comboScoreMultiplier(combo)}` : ""}</p></div> : <span />}
          <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-right shadow-sm"><p className="text-[9px] font-bold tracking-widest text-ink-faint">TIME</p><p className="text-xl font-black tabular-nums text-ink">{timeLeft}</p></div>
        </div>

        {activeEffects.length > 0 ? (
          <div className="pointer-events-none absolute left-1/2 top-[72px] z-30 flex w-[82%] -translate-x-1/2 flex-wrap justify-center gap-1">
            {activeEffects.map((effect) => (
              <span key={effect} className="rounded-full border border-[#f1c969] bg-[#fff6cc]/95 px-2 py-1 text-[9px] font-black text-[#9a6322] shadow-sm">{effect}</span>
            ))}
          </div>
        ) : null}

        {entities.map((entity) => (
          <div key={entity.id} className={`absolute ${entity.enteredOpening && entity.status !== "bounced" ? "z-40" : "z-20"} will-change-transform opacity-100 ${entity.rarity ? RARITY_STYLE[entity.rarity] : "drop-shadow-[0_5px_7px_rgba(75,58,43,0.22)]"}`} style={{ left: `${entity.x}%`, top: `${entity.y}%`, width: `${entity.size}%`, transform: `translate(-50%, -50%) rotate(${entity.rotation}deg)` }}>
            <Image src={entity.image} alt="" width={160} height={160} draggable={false} className="h-auto w-full object-contain" />
            {entity.rarity === "UR" ? <span className="absolute -inset-2 -z-10 animate-pulse rounded-full bg-[#e95c4d]/15 blur-md" /> : null}
          </div>
        ))}

        {impactX !== null ? <div className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 animate-ping text-xl font-black text-[#d7684f]" style={{ left: `${impactX}%`, top: `${BOX_LIP_Y}%` }}>✦</div> : null}
        {feedback ? (
          <div className="pointer-events-none absolute left-1/2 top-[67%] z-40 -translate-x-1/2 text-center">
            <p className="text-lg font-black text-[#c87527]">CATCH!</p>
            <p className="-mt-1 text-sm font-black text-[#c87527]">+{feedback.points}</p>
            {feedback.effect ? <p className="mt-0.5 rounded-full bg-[#fff6cc]/95 px-2 py-0.5 text-[10px] font-black text-[#9a6322]">{feedback.effect}</p> : null}
            <p className="mt-0.5 max-w-40 truncate rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold text-ink-soft">{feedback.name}</p>
          </div>
        ) : null}

        <div
          ref={catcherRef}
          role="button"
          aria-label="拾ってくだブーの段ボールを左右に動かす"
          className={`absolute bottom-[0.5%] z-30 aspect-square w-[37.8%] touch-none select-none rounded-3xl transition-transform duration-100 ${Date.now() < rainbowUntilRef.current ? "animate-pulse shadow-[0_0_25px_8px_rgba(230,120,220,0.55)] ring-4 ring-pink-300/70" : ""}`}
          style={{
            left: `${boxX}%`,
            transform: `translateX(-50%) scaleX(${Date.now() < boxWideUntilRef.current ? BOX_WIDE_SCALE : 1}) scaleY(${boxBounce ? 1.015 : 1})`,
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
        >
          <Image src={BOX_IMAGE} alt="拾ってくだブーと書かれた段ボール" fill priority draggable={false} sizes="38vw" className="pointer-events-none object-contain" />
        </div>

        {phase === "playing" ? <div className="pointer-events-none absolute bottom-[0.5%] left-1/2 z-40 -translate-x-1/2 rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-bold text-ink-faint">箱を押さえて左右にドラッグ</div> : null}

        {phase !== "playing" ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#f9f3e7]/70 px-6 backdrop-blur-[2px]">
            <div className="w-full max-w-xs rounded-[28px] border border-white/90 bg-card/95 p-5 text-center shadow-xl">
              {phase === "finished" ? (
                <>
                  <p className="text-[10px] font-black tracking-[0.18em] text-ink-faint">RESULT</p>
                  <p className="mt-1 text-4xl font-black tabular-nums text-ink">{score.toLocaleString("ja-JP")}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-paper-deep px-2 py-2"><p className="text-[9px] text-ink-faint">キャッチ</p><p className="font-black text-ink">{caught}個</p></div>
                    <div className="rounded-xl bg-paper-deep px-2 py-2"><p className="text-[9px] text-ink-faint">MAX COMBO</p><p className="font-black text-ink">{maxCombo}</p></div>
                  </div>
                  <div className="mt-3 rounded-xl bg-[#fff5df] px-3 py-2">
                    {rewardPending ? (
                      <p className="text-[11px] font-bold text-[#8d6231]">コインを受け取り中…</p>
                    ) : rewardError ? (
                      <p className="text-[10px] font-bold text-red-600">{rewardError}</p>
                    ) : (
                      <p className="flex items-center justify-center gap-1 text-sm font-black text-[#8d6231]">獲得コイン <span className="tabular-nums">+{coinReward ?? 0}</span></p>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={startGame} disabled={rewardPending} className="rounded-full bg-leaf px-3 py-3 text-xs font-black text-white shadow-md active:translate-y-px disabled:opacity-45">もう一度あそぶ</button>
                    <button type="button" onClick={() => window.location.assign("/games")} disabled={rewardPending} className="rounded-full border border-line bg-card px-3 py-3 text-xs font-black text-ink-soft shadow-sm active:translate-y-px disabled:opacity-45">終了する</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-black tracking-[0.18em] text-leaf-deep">ITEM CATCH</p>
                  <p className="mt-1 text-xl font-black text-ink">箱でキャッチしよう！</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">所持している図鑑アイテムと初期フレブルが降ってきます。一部アイテムには得点・時間・コンボの特殊効果があります。</p>
                  <div className="mt-3 rounded-xl bg-[#fff5df] px-3 py-2 text-[10px] leading-relaxed text-[#8d6231]">レアなアイテムほど速く落ちます。5コンボから得点倍率が上がり、最大30コンボで×2になります。遊びきると25スコアごとに1コインもらえます。</div>
                  <button type="button" onClick={startGame} className="mt-4 w-full rounded-full bg-leaf px-4 py-3 text-sm font-black text-white shadow-md active:translate-y-px">START</button>
                </>
              )}
              <p className="mt-2 text-[9px] text-ink-faint">所持アイテム {itemPool.length}種類 + 初期フレブル</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}