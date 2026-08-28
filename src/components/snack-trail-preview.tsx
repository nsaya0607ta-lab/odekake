"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "@/app/snack-trail-preview/snack-trail.module.css";

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";
type Phase = "ready" | "playing" | "paused" | "gameover";
type Snack = Point & { golden: boolean };
type SpecialSkill = "slow" | "trim" | "double" | "gold";
type SpecialItemDefinition = {
  id: string;
  name: string;
  image: string;
  skill: SpecialSkill;
  effect: string;
};
type SpecialPickup = Point & { item: SpecialItemDefinition };
type SkillToast = { id: number; item: SpecialItemDefinition };

const GRID_SIZE = 16;
const BEST_SCORE_KEY = "odekake:snack-trail-preview:best-score";
const SPECIAL_ITEM_INTERVAL = 5;
const SPECIAL_ITEM_SIZE = 2;
const DEMO_GACHA_ITEMS: readonly SpecialItemDefinition[] = [
  {
    id: "toy_carrot",
    name: "にんじんトイ",
    image: "/collection/items/carrot-toy.webp",
    skill: "slow",
    effect: "6秒間ゆっくり",
  },
  {
    id: "toy_frisbee",
    name: "フリスビー",
    image: "/collection/items/frisbee.webp",
    skill: "trim",
    effect: "足あとを3マス短縮",
  },
  {
    id: "toy_meat",
    name: "大きな肉のおもちゃ",
    image: "/collection/items/meat-toy.webp",
    skill: "double",
    effect: "次のおやつ3個 ×2",
  },
  {
    id: "toy_rainbow_ball",
    name: "虹色わんこボール",
    image: "/collection/items/rainbow-ball.webp",
    skill: "gold",
    effect: "次のおやつ3個が金色",
  },
];
const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
const STEP: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function makeInitialTrail(): Point[] {
  return [
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 },
    { x: 5, y: 8 },
  ];
}

function pointKey(point: Point): string {
  return `${point.x}:${point.y}`;
}

function specialCells(specialItem: SpecialPickup | null): Point[] {
  if (!specialItem) return [];
  return Array.from({ length: SPECIAL_ITEM_SIZE * SPECIAL_ITEM_SIZE }, (_, index) => ({
    x: specialItem.x + (index % SPECIAL_ITEM_SIZE),
    y: specialItem.y + Math.floor(index / SPECIAL_ITEM_SIZE),
  }));
}

function spawnSnack(trail: Point[], specialItem: SpecialPickup | null = null, forceGolden = false): Snack {
  const occupied = new Set(trail.map(pointKey));
  specialCells(specialItem).forEach((point) => occupied.add(pointKey(point)));
  const candidates: Point[] = [];
  for (let y = 1; y < GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < GRID_SIZE - 1; x += 1) {
      if (!occupied.has(`${x}:${y}`)) candidates.push({ x, y });
    }
  }
  const point = candidates[Math.floor(Math.random() * candidates.length)] ?? { x: 3, y: 3 };
  return { ...point, golden: forceGolden || Math.random() < 0.14 };
}

function spawnSpecialItem(trail: Point[], snack: Snack): SpecialPickup {
  const occupied = new Set([...trail.map(pointKey), pointKey(snack)]);
  const candidates: Point[] = [];
  for (let y = 1; y <= GRID_SIZE - SPECIAL_ITEM_SIZE - 1; y += 1) {
    for (let x = 1; x <= GRID_SIZE - SPECIAL_ITEM_SIZE - 1; x += 1) {
      const area = Array.from({ length: SPECIAL_ITEM_SIZE * SPECIAL_ITEM_SIZE }, (_, index) => ({
        x: x + (index % SPECIAL_ITEM_SIZE),
        y: y + Math.floor(index / SPECIAL_ITEM_SIZE),
      }));
      if (area.every((point) => !occupied.has(pointKey(point)))) candidates.push({ x, y });
    }
  }
  const point = candidates[Math.floor(Math.random() * candidates.length)] ?? { x: 2, y: 2 };
  const item = DEMO_GACHA_ITEMS[Math.floor(Math.random() * DEMO_GACHA_ITEMS.length)] ?? DEMO_GACHA_ITEMS[0]!;
  return { ...point, item };
}

function isInsideSpecialItem(point: Point, specialItem: SpecialPickup | null): boolean {
  return Boolean(
    specialItem
    && point.x >= specialItem.x
    && point.x < specialItem.x + SPECIAL_ITEM_SIZE
    && point.y >= specialItem.y
    && point.y < specialItem.y + SPECIAL_ITEM_SIZE,
  );
}

function SnackIcon({ golden = false }: { golden?: boolean }) {
  return (
    <span className={styles.snackIcon} aria-hidden="true">
      <Image
        src={golden ? "/collection/items/paw-pudding.webp" : "/collection/items/paw-melon-bread.webp"}
        alt=""
        fill
        sizes="50px"
      />
    </span>
  );
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

function ControlButton({
  direction,
  label,
  disabled,
  onDirection,
}: {
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
      onPointerDown={(event) => {
        event.preventDefault();
        onDirection(direction);
      }}
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
    // サウンドが使えない環境でもゲームは続行する。
  }
}

export function SnackTrailPreview() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [trail, setTrail] = useState<Point[]>(makeInitialTrail);
  const [snack, setSnack] = useState<Snack>(() => ({ x: 12, y: 5, golden: false }));
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [collected, setCollected] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [activeDirection, setActiveDirection] = useState<Direction>("right");
  const [specialItem, setSpecialItem] = useState<SpecialPickup | null>(null);
  const [skillToast, setSkillToast] = useState<SkillToast | null>(null);
  const [slowActive, setSlowActive] = useState(false);
  const [doubleSnackRemaining, setDoubleSnackRemaining] = useState(0);
  const [goldenSnackRemaining, setGoldenSnackRemaining] = useState(0);
  const [burst, setBurst] = useState<(Point & { id: number; golden: boolean }) | null>(null);
  const [newBest, setNewBest] = useState(false);
  const directionRef = useRef<Direction>("right");
  const queuedDirectionRef = useRef<Direction>("right");
  const touchStartRef = useRef<Point | null>(null);
  const burstIdRef = useRef(0);
  const scoreRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  const doubleSnackRemainingRef = useRef(0);
  const goldenSnackRemainingRef = useRef(0);
  const slowTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);

  const level = Math.min(9, 1 + Math.floor(collected / 5));
  const baseStepMs = Math.max(78, 184 - (level - 1) * 13);
  const stepMs = slowActive ? Math.round(baseStepMs * 1.45) : baseStepMs;
  const snacksUntilSpecial = SPECIAL_ITEM_INTERVAL - (collected % SPECIAL_ITEM_INTERVAL);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    if (Number.isFinite(stored) && stored > 0) setBestScore(stored);
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => () => {
    if (slowTimeoutRef.current !== null) window.clearTimeout(slowTimeoutRef.current);
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
  }, []);

  const chooseDirection = useCallback((next: Direction) => {
    if (phaseRef.current !== "playing") return;
    if (next === OPPOSITE[directionRef.current]) return;
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
    setActiveDirection("right");
    scoreRef.current = 0;
    doubleSnackRemainingRef.current = 0;
    goldenSnackRemainingRef.current = 0;
    setTrail(freshTrail);
    setSnack(spawnSnack(freshTrail));
    setScore(0);
    setCollected(0);
    setSpecialItem(null);
    setSkillToast(null);
    setSlowActive(false);
    setDoubleSnackRemaining(0);
    setGoldenSnackRemaining(0);
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
      setTrail((current) => {
        const head = current[0];
        if (!head) return makeInitialTrail();
        const nextHead = { x: head.x + movement.x, y: head.y + movement.y };
        const hitWall = nextHead.x < 0 || nextHead.x >= GRID_SIZE || nextHead.y < 0 || nextHead.y >= GRID_SIZE;
        const ateSnack = nextHead.x === snack.x && nextHead.y === snack.y;
        const caughtSpecialItem = isInsideSpecialItem(nextHead, specialItem);
        const collisionBody = ateSnack ? current : current.slice(0, -1);
        const hitTailIndex = collisionBody.findIndex((part) => part.x === nextHead.x && part.y === nextHead.y);

        if (hitWall) {
          window.setTimeout(() => finishGame(scoreRef.current), 0);
          return current;
        }

        const nextTrail = [nextHead, ...current];
        if (!ateSnack) nextTrail.pop();
        if (hitTailIndex >= 0) {
          nextTrail.splice(hitTailIndex + 1);
          const nextBurst = { ...nextHead, id: ++burstIdRef.current, golden: false };
          setBurst(nextBurst);
          window.setTimeout(() => setBurst((currentBurst) => currentBurst?.id === nextBurst.id ? null : currentBurst), 520);
          playTone(280, 0.1, soundOn);
        }

        if (caughtSpecialItem && specialItem) {
          if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
          const nextToast = { id: ++toastIdRef.current, item: specialItem.item };
          setSkillToast(nextToast);
          toastTimeoutRef.current = window.setTimeout(() => {
            setSkillToast((currentToast) => currentToast?.id === nextToast.id ? null : currentToast);
          }, 1900);

          if (specialItem.item.skill === "slow") {
            if (slowTimeoutRef.current !== null) window.clearTimeout(slowTimeoutRef.current);
            setSlowActive(true);
            slowTimeoutRef.current = window.setTimeout(() => setSlowActive(false), 6000);
          } else if (specialItem.item.skill === "trim") {
            for (let removed = 0; removed < 3 && nextTrail.length > 3; removed += 1) nextTrail.pop();
          } else if (specialItem.item.skill === "double") {
            doubleSnackRemainingRef.current = 3;
            setDoubleSnackRemaining(3);
          } else if (specialItem.item.skill === "gold") {
            goldenSnackRemainingRef.current = 3;
            setGoldenSnackRemaining(3);
            setSnack((currentSnack) => ({ ...currentSnack, golden: true }));
          }
          setSpecialItem(null);
          playTone(980, 0.22, soundOn);
        }

        if (ateSnack) {
          const doubleActive = doubleSnackRemainingRef.current > 0;
          const earned = (snack.golden ? 5 : 1) * (doubleActive ? 2 : 1);
          const nextScore = scoreRef.current + earned;
          scoreRef.current = nextScore;
          setScore(nextScore);
          if (doubleActive) {
            doubleSnackRemainingRef.current -= 1;
            setDoubleSnackRemaining(doubleSnackRemainingRef.current);
          }
          if (goldenSnackRemainingRef.current > 0) {
            goldenSnackRemainingRef.current -= 1;
            setGoldenSnackRemaining(goldenSnackRemainingRef.current);
          }
          const nextCollected = collected + 1;
          setCollected(nextCollected);
          const nextBurst = { ...snack, id: ++burstIdRef.current };
          setBurst(nextBurst);
          window.setTimeout(() => setBurst((currentBurst) => currentBurst?.id === nextBurst.id ? null : currentBurst), 520);
          const nextSnack = spawnSnack(nextTrail, specialItem, goldenSnackRemainingRef.current > 0);
          setSnack(nextSnack);
          if (nextCollected % SPECIAL_ITEM_INTERVAL === 0) setSpecialItem(spawnSpecialItem(nextTrail, nextSnack));
          playTone(snack.golden ? 880 : 620, snack.golden ? 0.2 : 0.1, soundOn);
        }
        return nextTrail;
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [collected, finishGame, phase, snack, soundOn, specialItem, stepMs]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMap: Partial<Record<string, Direction>> = {
        ArrowUp: "up",
        w: "up",
        ArrowDown: "down",
        s: "down",
        ArrowLeft: "left",
        a: "left",
        ArrowRight: "right",
        d: "right",
      };
      const next = keyMap[event.key];
      if (next) {
        event.preventDefault();
        chooseDirection(next);
      }
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

  const canTurn = (next: Direction) => (
    phase === "playing"
    && next !== activeDirection
    && next !== OPPOSITE[activeDirection]
  );

  return (
    <div className={styles.shell}>
      <div className={styles.ambient} aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>

      <header className={styles.header}>
        <Link href="/games" className={styles.backButton} aria-label="ミニゲーム一覧へ戻る">‹</Link>
        <div className={styles.titleBlock}>
          <span>おでかけ ミニゲーム 03</span>
          <h1>わんこのおやつ道</h1>
        </div>
        <button type="button" className={styles.soundButton} onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "音をオフにする" : "音をオンにする"}>
          {soundOn ? "♪" : "×"}
        </button>
      </header>

      <main className={styles.main}>
        <section className={styles.scorePanel} aria-label="スコア">
          <div>
            <small>スコア</small>
            <strong>{score.toString().padStart(3, "0")}</strong>
          </div>
          <span className={styles.scoreDivider} />
          <div>
            <small>ベスト</small>
            <strong>{bestScore.toString().padStart(3, "0")}</strong>
          </div>
          <span className={styles.scoreDivider} />
          <div>
            <small>レベル</small>
            <strong>{level}</strong>
          </div>
          <button type="button" className={styles.pauseButton} onClick={togglePause} disabled={phase === "ready" || phase === "gameover"}>
            {phase === "paused" ? "再開" : "一時停止"}
          </button>
        </section>

        <section className={styles.skillStrip} aria-live="polite">
          <span className={specialItem ? styles.specialReady : ""}>
            {specialItem ? "特殊アイテム出現中！" : `あと${snacksUntilSpecial}個で特殊アイテム`}
          </span>
          <div>
            {slowActive ? <b>ゆっくり</b> : null}
            {doubleSnackRemaining > 0 ? <b>得点×2：残り{doubleSnackRemaining}個</b> : null}
            {goldenSnackRemaining > 0 ? <b>金色：残り{goldenSnackRemaining}個</b> : null}
          </div>
        </section>

        <section
          className={styles.boardFrame}
          onTouchStart={(event) => {
            const touch = event.changedTouches[0];
            if (!touch) return;
            touchStartRef.current = { x: touch.clientX, y: touch.clientY };
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
          <div className={styles.board} role="img" aria-label="わんこがおやつを集めるゲーム盤">
            {specialItem ? (
              <span
                className={styles.specialItem}
                style={{
                  left: `${(specialItem.x / GRID_SIZE) * 100}%`,
                  top: `${(specialItem.y / GRID_SIZE) * 100}%`,
                }}
                aria-label={`${specialItem.item.name}。${specialItem.item.effect}`}
              >
                <i className={styles.specialAura} />
                <Image src={specialItem.item.image} alt="" fill sizes="64px" className={styles.specialImage} />
                <small>SKILL</small>
              </span>
            ) : null}
            {boardCells.map((cell) => {
              const index = trailByKey.get(pointKey(cell));
              const hasSnack = cell.x === snack.x && cell.y === snack.y;
              const hasBurst = burst && cell.x === burst.x && cell.y === burst.y;
              return (
                <span key={pointKey(cell)} className={styles.cell}>
                  {index === 0 ? <DogHead direction={directionRef.current} /> : null}
                  {index !== undefined && index > 0 ? <PawSegment index={index} /> : null}
                  {hasSnack ? (
                    <span className={`${styles.snack} ${snack.golden ? styles.goldenSnack : ""}`}>
                      <SnackIcon golden={snack.golden} />
                    </span>
                  ) : null}
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
            <div className={styles.skillToast} role="status">
              <span><Image src={skillToast.item.image} alt="" fill sizes="42px" /></span>
              <p><small>{skillToast.item.name}</small><b>{skillToast.item.effect}</b></p>
            </div>
          ) : null}

          {phase !== "playing" ? (
            <div className={styles.overlay}>
              {phase === "ready" ? (
                <>
                  <span className={styles.overlayBadge}>NEW GAME</span>
                  <div className={styles.previewDog}><DogHead direction="right" /></div>
                  <h2>おやつを集めて<br />しっぽをのばそう！</h2>
                  <p>壁だけはよけよう。<br />足あとに触れるとしっぽが短くなるよ。</p>
                  <button type="button" className={styles.startButton} onClick={startGame}>ゲームスタート <span>›</span></button>
                </>
              ) : null}
              {phase === "paused" ? (
                <>
                  <span className={styles.overlayBadge}>ひとやすみ</span>
                  <h2>一時停止中</h2>
                  <p>準備ができたら、続きをはじめよう。</p>
                  <button type="button" className={styles.startButton} onClick={togglePause}>つづける <span>›</span></button>
                </>
              ) : null}
              {phase === "gameover" ? (
                <>
                  <span className={styles.overlayBadge}>今回のスコア</span>
                  <strong className={styles.finalScore}>{score}</strong>
                  <h2>{newBest ? "ベストスコア更新！" : "壁にぶつかっちゃった！"}</h2>
                  <p>集めたおやつ {collected}個・到達レベル {level}</p>
                  <button type="button" className={styles.startButton} onClick={startGame}>もう一度あそぶ <span>↻</span></button>
                </>
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
          <div><SnackIcon /><span><b>肉球メロンパン</b><small>1ポイント</small></span></div>
          <div><SnackIcon golden /><span><b>金の肉球プリン</b><small>5ポイント</small></span></div>
          <div className={styles.specialRule}>
            <span className={styles.demoItems}>
              {DEMO_GACHA_ITEMS.map((item) => (
                <i key={item.id}><Image src={item.image} alt="" fill sizes="28px" /></i>
              ))}
            </span>
            <span><b>ガチャアイテム</b><small>5個ごとに出現・2×2マスで取得</small></span>
          </div>
          <p>プレビュー版のため、コインは付与されません</p>
        </section>
      </main>
    </div>
  );
}
