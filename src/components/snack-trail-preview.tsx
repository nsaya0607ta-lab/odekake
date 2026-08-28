"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "@/app/snack-trail-preview/snack-trail.module.css";
import { REGULAR_ITEMS, type CollectionItem } from "@/lib/collection/items";
import { getSnackTrailSkill, type SnackTrailSkill } from "@/lib/games/snack-trail-skills";

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";
type Phase = "ready" | "playing" | "paused" | "gameover";
type PlayableItem = CollectionItem & { image: string };
type ItemPickup = Point & { uid: number; golden: boolean; item: PlayableItem; skill: SnackTrailSkill };
type SkillToast = { id: number; item: PlayableItem; skill: SnackTrailSkill; boosted: boolean; text: string };

const GRID_SIZE = 16;
const ITEM_SIZE = 2;
const ITEMS_ON_BOARD = 3;
const BOOST_INTERVAL = 5;
const BEST_SCORE_KEY = "odekake:snack-trail-preview:best-score";
const PLAYABLE_ITEMS = REGULAR_ITEMS.filter((item): item is PlayableItem => Boolean(item.image));

const OPPOSITE: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
const STEP: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let pickupIdSeed = 0;

function makeInitialTrail(): Point[] {
  return [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }];
}

function pointKey(point: Point): string {
  return `${point.x}:${point.y}`;
}

function itemCells(item: Pick<ItemPickup, "x" | "y">): Point[] {
  return Array.from({ length: ITEM_SIZE * ITEM_SIZE }, (_, index) => ({
    x: item.x + (index % ITEM_SIZE),
    y: item.y + Math.floor(index / ITEM_SIZE),
  }));
}

function isInsideItem(point: Point, item: ItemPickup, expanded = false): boolean {
  const padding = expanded ? 1 : 0;
  return point.x >= item.x - padding
    && point.x < item.x + ITEM_SIZE + padding
    && point.y >= item.y - padding
    && point.y < item.y + ITEM_SIZE + padding;
}

function spawnOneItem(
  trail: Point[],
  currentItems: ItemPickup[],
  recentItemIds: readonly string[],
  forceGolden = false,
): ItemPickup {
  const occupied = new Set(trail.map(pointKey));
  currentItems.flatMap(itemCells).forEach((point) => occupied.add(pointKey(point)));
  const candidates: Point[] = [];
  for (let y = 1; y <= GRID_SIZE - ITEM_SIZE - 1; y += 1) {
    for (let x = 1; x <= GRID_SIZE - ITEM_SIZE - 1; x += 1) {
      if (itemCells({ x, y }).every((point) => !occupied.has(pointKey(point)))) candidates.push({ x, y });
    }
  }
  const excludedIds = new Set([...recentItemIds, ...currentItems.map((pickup) => pickup.item.id)]);
  const preferredItems = PLAYABLE_ITEMS.filter((item) => !excludedIds.has(item.id));
  const itemPool = preferredItems.length > 0 ? preferredItems : PLAYABLE_ITEMS;
  const item = itemPool[Math.floor(Math.random() * itemPool.length)] ?? PLAYABLE_ITEMS[0]!;
  const point = candidates[Math.floor(Math.random() * candidates.length)] ?? { x: 2, y: 2 };
  return {
    ...point,
    uid: ++pickupIdSeed,
    golden: forceGolden || Math.random() < 0.14,
    item,
    skill: getSnackTrailSkill(item),
  };
}

function spawnInitialItems(trail: Point[]): ItemPickup[] {
  const items: ItemPickup[] = [];
  while (items.length < ITEMS_ON_BOARD) items.push(spawnOneItem(trail, items, []));
  return items;
}

function DogHead({ direction }: { direction: Direction }) {
  const rotation = { right: 0, down: 90, left: 180, up: 270 }[direction];
  return (
    <span className={styles.dogHead} style={{ transform: `rotate(${rotation}deg)` }} aria-hidden="true">
      <Image src="/collection/items/frenchie-plush.webp" alt="" fill sizes="64px" className={styles.dogSprite} />
    </span>
  );
}

function PawSegment({ index }: { index: number }) {
  return (
    <span className={styles.pawSegment} style={{ opacity: Math.max(0.48, 1 - index * 0.035) }} aria-hidden="true">
      <i className={styles.pawPad} />
      <i className={`${styles.pawToe} ${styles.pawToeOne}`} />
      <i className={`${styles.pawToe} ${styles.pawToeTwo}`} />
      <i className={`${styles.pawToe} ${styles.pawToeThree}`} />
    </span>
  );
}

function ControlButton({ direction, label, disabled, onDirection }: {
  direction: Direction;
  label: string;
  disabled: boolean;
  onDirection: (direction: Direction) => void;
}) {
  const directionClass: Record<Direction, string> = {
    up: styles.controlUp ?? "",
    down: styles.controlDown ?? "",
    left: styles.controlLeft ?? "",
    right: styles.controlRight ?? "",
  };
  return (
    <button
      type="button"
      className={`${styles.controlButton} ${directionClass[direction]}`}
      onPointerDown={(event) => { event.preventDefault(); onDirection(direction); }}
      disabled={disabled}
      aria-label={`${label}へ進む`}
    >
      <span aria-hidden="true">{direction === "up" ? "↑" : direction === "down" ? "↓" : direction === "left" ? "←" : "→"}</span>
      <small>{label}</small>
    </button>
  );
}

function playTone(frequency: number, duration: number, soundOn: boolean) {
  if (!soundOn || typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.055, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // サウンド非対応でもゲームは続行する。
  }
}

export function SnackTrailPreview() {
  const initialTrail = useMemo(makeInitialTrail, []);
  const [phase, setPhase] = useState<Phase>("ready");
  const [trail, setTrail] = useState<Point[]>(initialTrail);
  const [pickups, setPickups] = useState<ItemPickup[]>(() => spawnInitialItems(initialTrail));
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [collected, setCollected] = useState(0);
  const [combo, setCombo] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [activeDirection, setActiveDirection] = useState<Direction>("right");
  const [skillToast, setSkillToast] = useState<SkillToast | null>(null);
  const [slowActive, setSlowActive] = useState(false);
  const [doubleRemaining, setDoubleRemaining] = useState(0);
  const [goldenRemaining, setGoldenRemaining] = useState(0);
  const [wallShields, setWallShields] = useState(0);
  const [noGrowRemaining, setNoGrowRemaining] = useState(0);
  const [widePickupRemaining, setWidePickupRemaining] = useState(0);
  const [burst, setBurst] = useState<(Point & { id: number; golden: boolean }) | null>(null);
  const [newBest, setNewBest] = useState(false);

  const directionRef = useRef<Direction>("right");
  const queuedDirectionRef = useRef<Direction>("right");
  const touchStartRef = useRef<Point | null>(null);
  const burstIdRef = useRef(0);
  const scoreRef = useRef(0);
  const collectedRef = useRef(0);
  const comboRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  const doubleRemainingRef = useRef(0);
  const goldenRemainingRef = useRef(0);
  const wallShieldsRef = useRef(0);
  const noGrowRemainingRef = useRef(0);
  const widePickupRemainingRef = useRef(0);
  const recentItemIdsRef = useRef<string[]>([]);
  const slowTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);

  const level = Math.min(9, 1 + Math.floor(collected / 5));
  const baseStepMs = Math.max(78, 184 - (level - 1) * 13);
  const stepMs = slowActive ? Math.round(baseStepMs * 1.45) : baseStepMs;
  const comboMultiplier = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
  const itemsUntilBoost = BOOST_INTERVAL - (collected % BOOST_INTERVAL);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    if (Number.isFinite(stored) && stored > 0) setBestScore(stored);
  }, []);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => () => {
    if (slowTimeoutRef.current !== null) window.clearTimeout(slowTimeoutRef.current);
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
  }, []);

  const chooseDirection = useCallback((next: Direction) => {
    if (phaseRef.current !== "playing" || next === OPPOSITE[directionRef.current]) return;
    queuedDirectionRef.current = next;
  }, []);

  const finishGame = useCallback((finalScore: number) => {
    setPhase("gameover");
    phaseRef.current = "gameover";
    playTone(130, 0.32, soundOn);
    setBestScore((current) => {
      if (finalScore <= current) return current;
      window.localStorage.setItem(BEST_SCORE_KEY, String(finalScore));
      setNewBest(true);
      return finalScore;
    });
  }, [soundOn]);

  const startGame = useCallback(() => {
    const freshTrail = makeInitialTrail();
    if (slowTimeoutRef.current !== null) window.clearTimeout(slowTimeoutRef.current);
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
    directionRef.current = "right";
    queuedDirectionRef.current = "right";
    scoreRef.current = 0;
    collectedRef.current = 0;
    comboRef.current = 0;
    doubleRemainingRef.current = 0;
    goldenRemainingRef.current = 0;
    wallShieldsRef.current = 0;
    noGrowRemainingRef.current = 0;
    widePickupRemainingRef.current = 0;
    recentItemIdsRef.current = [];
    setActiveDirection("right");
    setTrail(freshTrail);
    setPickups(spawnInitialItems(freshTrail));
    setScore(0);
    setCollected(0);
    setCombo(0);
    setSkillToast(null);
    setSlowActive(false);
    setDoubleRemaining(0);
    setGoldenRemaining(0);
    setWallShields(0);
    setNoGrowRemaining(0);
    setWidePickupRemaining(0);
    setBurst(null);
    setNewBest(false);
    setPhase("playing");
    phaseRef.current = "playing";
    playTone(440, 0.12, soundOn);
  }, [soundOn]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setInterval(() => {
      directionRef.current = queuedDirectionRef.current;
      setActiveDirection(directionRef.current);
      const movement = STEP[directionRef.current];

      setTrail((currentTrail) => {
        const head = currentTrail[0];
        if (!head) return makeInitialTrail();
        let nextHead = { x: head.x + movement.x, y: head.y + movement.y };
        const hitWall = nextHead.x < 0 || nextHead.x >= GRID_SIZE || nextHead.y < 0 || nextHead.y >= GRID_SIZE;
        if (hitWall) {
          if (wallShieldsRef.current <= 0) {
            window.setTimeout(() => finishGame(scoreRef.current), 0);
            return currentTrail;
          }
          wallShieldsRef.current -= 1;
          setWallShields(wallShieldsRef.current);
          nextHead = { x: (nextHead.x + GRID_SIZE) % GRID_SIZE, y: (nextHead.y + GRID_SIZE) % GRID_SIZE };
          playTone(420, 0.12, soundOn);
        }

        const caughtItem = pickups.find((pickup) => isInsideItem(nextHead, pickup, widePickupRemainingRef.current > 0));
        const stopsGrowing = Boolean(caughtItem && noGrowRemainingRef.current > 0);
        const grows = Boolean(caughtItem && !stopsGrowing);
        const collisionBody = grows ? currentTrail : currentTrail.slice(0, -1);
        const hitTrailIndex = collisionBody.findIndex((part) => part.x === nextHead.x && part.y === nextHead.y);
        const nextTrail = [nextHead, ...currentTrail];
        if (!grows) nextTrail.pop();

        if (hitTrailIndex >= 0) {
          nextTrail.splice(hitTrailIndex + 1);
          comboRef.current = 0;
          setCombo(0);
          const collisionBurst = { ...nextHead, id: ++burstIdRef.current, golden: false };
          setBurst(collisionBurst);
          window.setTimeout(() => setBurst((value) => value?.id === collisionBurst.id ? null : value), 520);
          playTone(280, 0.1, soundOn);
        }
        if (!caughtItem) return nextTrail;

        if (noGrowRemainingRef.current > 0) {
          noGrowRemainingRef.current -= 1;
          setNoGrowRemaining(noGrowRemainingRef.current);
        }
        if (widePickupRemainingRef.current > 0) {
          widePickupRemainingRef.current -= 1;
          setWidePickupRemaining(widePickupRemainingRef.current);
        }

        const nextCollected = collectedRef.current + 1;
        collectedRef.current = nextCollected;
        setCollected(nextCollected);
        const boosted = nextCollected % BOOST_INTERVAL === 0;
        let nextCombo = comboRef.current + 1;
        const multiplier = nextCombo >= 10 ? 3 : nextCombo >= 5 ? 2 : 1;
        const doubleActive = doubleRemainingRef.current > 0;
        let earned = (caughtItem.golden ? 5 : 1) * multiplier * (doubleActive ? 2 : 1);
        if (doubleActive) {
          doubleRemainingRef.current -= 1;
          setDoubleRemaining(doubleRemainingRef.current);
        }

        const skillValue = boosted ? caughtItem.skill.boostedValue : caughtItem.skill.miniValue;
        const skillText = boosted ? caughtItem.skill.boostedText : caughtItem.skill.miniText;
        if (caughtItem.skill.kind === "slow") {
          if (slowTimeoutRef.current !== null) window.clearTimeout(slowTimeoutRef.current);
          setSlowActive(true);
          slowTimeoutRef.current = window.setTimeout(() => setSlowActive(false), skillValue * 1000);
        } else if (caughtItem.skill.kind === "trim") {
          for (let removed = 0; removed < skillValue && nextTrail.length > 3; removed += 1) nextTrail.pop();
        } else if (caughtItem.skill.kind === "score") {
          earned += skillValue;
        } else if (caughtItem.skill.kind === "double") {
          doubleRemainingRef.current = Math.max(doubleRemainingRef.current, skillValue);
          setDoubleRemaining(doubleRemainingRef.current);
        } else if (caughtItem.skill.kind === "gold") {
          goldenRemainingRef.current = Math.max(goldenRemainingRef.current, skillValue);
          setGoldenRemaining(goldenRemainingRef.current);
        } else if (caughtItem.skill.kind === "shield") {
          wallShieldsRef.current = Math.min(3, wallShieldsRef.current + skillValue);
          setWallShields(wallShieldsRef.current);
        } else if (caughtItem.skill.kind === "noGrow") {
          noGrowRemainingRef.current = Math.max(noGrowRemainingRef.current, skillValue);
          setNoGrowRemaining(noGrowRemainingRef.current);
        } else if (caughtItem.skill.kind === "wide") {
          widePickupRemainingRef.current = Math.max(widePickupRemainingRef.current, skillValue);
          setWidePickupRemaining(widePickupRemainingRef.current);
        } else if (caughtItem.skill.kind === "combo") {
          nextCombo += skillValue;
        } else {
          doubleRemainingRef.current = Math.max(doubleRemainingRef.current, boosted ? 3 : 1);
          goldenRemainingRef.current = Math.max(goldenRemainingRef.current, boosted ? 3 : 1);
          setDoubleRemaining(doubleRemainingRef.current);
          setGoldenRemaining(goldenRemainingRef.current);
          if (boosted) {
            wallShieldsRef.current = Math.min(3, wallShieldsRef.current + 2);
            setWallShields(wallShieldsRef.current);
          }
        }

        comboRef.current = nextCombo;
        setCombo(nextCombo);
        const nextScore = scoreRef.current + earned;
        scoreRef.current = nextScore;
        setScore(nextScore);

        recentItemIdsRef.current = [...recentItemIdsRef.current, caughtItem.item.id].slice(-5);
        setPickups((currentItems) => {
          let nextItems = currentItems.filter((pickup) => pickup.uid !== caughtItem.uid);
          let goldenBudget = goldenRemainingRef.current;
          nextItems = nextItems.map((pickup) => {
            if (goldenBudget <= 0 || pickup.golden) return pickup;
            goldenBudget -= 1;
            return { ...pickup, golden: true };
          });
          while (nextItems.length < ITEMS_ON_BOARD) {
            const forceGolden = goldenBudget > 0;
            if (forceGolden) goldenBudget -= 1;
            nextItems.push(spawnOneItem(nextTrail, nextItems, recentItemIdsRef.current, forceGolden));
          }
          goldenRemainingRef.current = goldenBudget;
          setGoldenRemaining(goldenBudget);
          return nextItems;
        });

        const nextToast: SkillToast = {
          id: ++toastIdRef.current,
          item: caughtItem.item,
          skill: caughtItem.skill,
          boosted,
          text: skillText,
        };
        if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
        setSkillToast(nextToast);
        toastTimeoutRef.current = window.setTimeout(() => {
          setSkillToast((value) => value?.id === nextToast.id ? null : value);
        }, boosted ? 2400 : 1600);

        const pickupBurst = { ...nextHead, id: ++burstIdRef.current, golden: caughtItem.golden };
        setBurst(pickupBurst);
        window.setTimeout(() => setBurst((value) => value?.id === pickupBurst.id ? null : value), 520);
        playTone(boosted ? 1080 : caughtItem.golden ? 880 : 620, boosted ? 0.24 : caughtItem.golden ? 0.2 : 0.1, soundOn);
        return nextTrail;
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [finishGame, phase, pickups, soundOn, stepMs]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMap: Partial<Record<string, Direction>> = {
        ArrowUp: "up", w: "up", ArrowDown: "down", s: "down",
        ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right",
      };
      const next = keyMap[event.key];
      if (next) { event.preventDefault(); chooseDirection(next); }
      if (event.key === " " && (phaseRef.current === "playing" || phaseRef.current === "paused")) {
        event.preventDefault();
        setPhase((current) => current === "playing" ? "paused" : "playing");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chooseDirection]);

  const trailByKey = useMemo(() => new Map(trail.map((point, index) => [pointKey(point), index])), [trail]);
  const boardCells = useMemo(
    () => Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({ x: index % GRID_SIZE, y: Math.floor(index / GRID_SIZE) })),
    [],
  );

  const togglePause = () => {
    setPhase((current) => {
      const next = current === "playing" ? "paused" : current === "paused" ? "playing" : current;
      phaseRef.current = next;
      return next;
    });
  };

  const canTurn = (next: Direction) => phase === "playing" && next !== activeDirection && next !== OPPOSITE[activeDirection];

  return (
    <div className={styles.shell}>
      <div className={styles.ambient} aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <header className={styles.header}>
        <Link href="/games" className={styles.backButton} aria-label="ミニゲーム一覧へ戻る">‹</Link>
        <div className={styles.titleBlock}><span>おでかけ ミニゲーム 03</span><h1>わんこのおやつ道</h1></div>
        <button type="button" className={styles.soundButton} onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "音をオフにする" : "音をオンにする"}>{soundOn ? "♪" : "×"}</button>
      </header>

      <main className={styles.main}>
        <section className={styles.scorePanel} aria-label="スコア">
          <div><small>スコア</small><strong>{score.toString().padStart(3, "0")}</strong></div>
          <span className={styles.scoreDivider} />
          <div><small>ベスト</small><strong>{bestScore.toString().padStart(3, "0")}</strong></div>
          <span className={styles.scoreDivider} />
          <div><small>レベル</small><strong>{level}</strong></div>
          <button type="button" className={styles.pauseButton} onClick={togglePause} disabled={phase === "ready" || phase === "gameover"}>{phase === "paused" ? "再開" : "一時停止"}</button>
        </section>

        <section className={styles.skillStrip} aria-live="polite">
          <span className={comboMultiplier > 1 ? styles.specialReady : ""}>肉球コンボ {combo}・得点×{comboMultiplier}</span>
          <div>
            <b>あと{itemsUntilBoost}個で強化</b>
            {slowActive ? <b>ゆっくり</b> : null}
            {doubleRemaining > 0 ? <b>得点×2：{doubleRemaining}</b> : null}
            {goldenRemaining > 0 ? <b>金色予約：{goldenRemaining}</b> : null}
            {wallShields > 0 ? <b>壁ガード：{wallShields}</b> : null}
            {noGrowRemaining > 0 ? <b>成長なし：{noGrowRemaining}</b> : null}
            {widePickupRemaining > 0 ? <b>取得範囲：{widePickupRemaining}</b> : null}
          </div>
        </section>

        <section
          className={styles.boardFrame}
          onTouchStart={(event) => {
            const touch = event.changedTouches[0];
            if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(event) => {
            const start = touchStartRef.current;
            const touch = event.changedTouches[0];
            touchStartRef.current = null;
            if (!start || !touch) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
            chooseDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
          }}
        >
          <div className={styles.boardGlow} aria-hidden="true" />
          <div className={styles.board} role="img" aria-label="わんこがガチャアイテムを集めるゲーム盤">
            {pickups.map((pickup) => (
              <span
                key={pickup.uid}
                className={`${styles.itemPickup} ${pickup.golden ? styles.goldenItemPickup : ""}`}
                style={{ left: `${(pickup.x / GRID_SIZE) * 100}%`, top: `${(pickup.y / GRID_SIZE) * 100}%` }}
                aria-label={`${pickup.item.name}。${pickup.skill.miniText}`}
              >
                <i className={styles.itemAura} />
                <Image src={pickup.item.image} alt="" fill sizes="64px" className={styles.pickupImage} />
                <small>{pickup.golden ? "5 PT" : pickup.item.rarity}</small>
              </span>
            ))}
            {boardCells.map((cell) => {
              const index = trailByKey.get(pointKey(cell));
              const hasBurst = burst && cell.x === burst.x && cell.y === burst.y;
              return (
                <span key={pointKey(cell)} className={styles.cell}>
                  {index === 0 ? <DogHead direction={directionRef.current} /> : null}
                  {index !== undefined && index > 0 ? <PawSegment index={index} /> : null}
                  {hasBurst ? (
                    <span className={`${styles.burst} ${burst.golden ? styles.goldenBurst : ""}`} aria-hidden="true">
                      {Array.from({ length: 8 }, (_, particle) => <i key={particle} style={{ "--particle": particle } as React.CSSProperties} />)}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>

          {skillToast ? (
            <div className={`${styles.skillToast} ${skillToast.boosted ? styles.boostedToast : ""}`} role="status">
              <span><Image src={skillToast.item.image} alt="" fill sizes="42px" /></span>
              <p><small>{skillToast.boosted ? "強化スキル！" : skillToast.item.name}</small><b>{skillToast.skill.title}</b><em>{skillToast.text}</em></p>
            </div>
          ) : null}

          {phase !== "playing" ? (
            <div className={styles.overlay}>
              {phase === "ready" ? (
                <>
                  <span className={styles.overlayBadge}>80 ITEMS</span>
                  <div className={styles.previewDog}><DogHead direction="right" /></div>
                  <h2>3つのアイテムから<br />進む道を選ぼう！</h2>
                  <p>5個目で強化スキル。<br />肉球の道に触れるとコンボが0になるよ。</p>
                  <button type="button" className={styles.startButton} onClick={startGame}>ゲームスタート <span>›</span></button>
                </>
              ) : null}
              {phase === "paused" ? (
                <><span className={styles.overlayBadge}>ひとやすみ</span><h2>一時停止中</h2><p>準備ができたら、続きをはじめよう。</p><button type="button" className={styles.startButton} onClick={togglePause}>つづける <span>›</span></button></>
              ) : null}
              {phase === "gameover" ? (
                <><span className={styles.overlayBadge}>今回のスコア</span><strong className={styles.finalScore}>{score}</strong><h2>{newBest ? "ベストスコア更新！" : "壁にぶつかっちゃった！"}</h2><p>集めたアイテム {collected}個・最終コンボ {combo}</p><button type="button" className={styles.startButton} onClick={startGame}>もう一度あそぶ <span>↻</span></button></>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={styles.controlArea} aria-label="方向操作">
          <div className={styles.hint}><span>進行方向に対して直角の2方向へ曲がれます</span></div>
          <div className={styles.controls}>
            <ControlButton direction="up" label="上" disabled={!canTurn("up")} onDirection={chooseDirection} />
            <ControlButton direction="left" label="左" disabled={!canTurn("left")} onDirection={chooseDirection} />
            <span className={styles.controlCenter}><i /><i /><i /></span>
            <ControlButton direction="right" label="右" disabled={!canTurn("right")} onDirection={chooseDirection} />
            <ControlButton direction="down" label="下" disabled={!canTurn("down")} onDirection={chooseDirection} />
          </div>
        </section>

        <section className={styles.rules}>
          <div><span className={styles.ruleItemIcon}><Image src={PLAYABLE_ITEMS[0]!.image} alt="" fill sizes="34px" /></span><span><b>通常アイテム</b><small>1ポイント＋ミニスキル</small></span></div>
          <div><span className={`${styles.ruleItemIcon} ${styles.ruleGoldenIcon}`}><Image src={PLAYABLE_ITEMS[1]!.image} alt="" fill sizes="34px" /></span><span><b>金色アイテム</b><small>5ポイント＋ミニスキル</small></span></div>
          <div className={styles.specialRule}>
            <span className={styles.demoItems}>{PLAYABLE_ITEMS.slice(2, 6).map((item) => <i key={item.id}><Image src={item.image} alt="" fill sizes="28px" /></i>)}</span>
            <span><b>シリーズ外 全{PLAYABLE_ITEMS.length}種</b><small>常に3個出現・5個目で強化スキル</small></span>
          </div>
          <p>プレビューでは全アイテムを所持扱い・コインは付与されません</p>
        </section>
      </main>
    </div>
  );
}
