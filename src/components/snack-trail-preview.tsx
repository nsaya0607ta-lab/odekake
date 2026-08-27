"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "@/app/snack-trail-preview/snack-trail.module.css";

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";
type Phase = "ready" | "playing" | "paused" | "gameover";
type Snack = Point & { golden: boolean };

const GRID_SIZE = 16;
const BEST_SCORE_KEY = "odekake:snack-trail-preview:best-score";
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

function spawnSnack(trail: Point[]): Snack {
  const occupied = new Set(trail.map(pointKey));
  const candidates: Point[] = [];
  for (let y = 1; y < GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < GRID_SIZE - 1; x += 1) {
      if (!occupied.has(`${x}:${y}`)) candidates.push({ x, y });
    }
  }
  const point = candidates[Math.floor(Math.random() * candidates.length)] ?? { x: 3, y: 3 };
  return { ...point, golden: Math.random() < 0.14 };
}

function BoneIcon({ golden = false }: { golden?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={styles.boneSvg}>
      <defs>
        <linearGradient id={golden ? "goldBone" : "creamBone"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={golden ? "#fff3a8" : "#fff9e8"} />
          <stop offset="1" stopColor={golden ? "#ffb11b" : "#eecb94"} />
        </linearGradient>
      </defs>
      <path
        d="M13.7 20.2a8.3 8.3 0 1 1 7.4-12 8.2 8.2 0 0 1 9.3 5.4l11.3 11.3a8.2 8.2 0 0 1 5.9-.2 8.3 8.3 0 1 1 3.1 15.6 8.3 8.3 0 1 1-12-7.4L27.4 21.6a8.2 8.2 0 0 1-5.4-.5 8.3 8.3 0 0 1-8.3-.9Z"
        fill={`url(#${golden ? "goldBone" : "creamBone"})`}
        stroke={golden ? "#ff8a00" : "#c69457"}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M25 18 43 36" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

function DogHead({ direction }: { direction: Direction }) {
  const rotation = { right: 0, down: 90, left: 180, up: 270 }[direction];
  return (
    <span className={styles.dogHead} style={{ transform: `rotate(${rotation}deg)` }} aria-hidden="true">
      <span className={`${styles.ear} ${styles.earTop}`} />
      <span className={`${styles.ear} ${styles.earBottom}`} />
      <span className={styles.dogFace}>
        <span className={styles.eyeTop} />
        <span className={styles.eyeBottom} />
        <span className={styles.muzzle} />
        <span className={styles.nose} />
      </span>
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

function ControlButton({ direction, label, onDirection }: { direction: Direction; label: string; onDirection: (direction: Direction) => void }) {
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
  const [burst, setBurst] = useState<(Point & { id: number; golden: boolean }) | null>(null);
  const [newBest, setNewBest] = useState(false);
  const directionRef = useRef<Direction>("right");
  const queuedDirectionRef = useRef<Direction>("right");
  const touchStartRef = useRef<Point | null>(null);
  const burstIdRef = useRef(0);
  const scoreRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");

  const level = Math.min(9, 1 + Math.floor(collected / 5));
  const stepMs = Math.max(78, 184 - (level - 1) * 13);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    if (Number.isFinite(stored) && stored > 0) setBestScore(stored);
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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
    directionRef.current = "right";
    queuedDirectionRef.current = "right";
    scoreRef.current = 0;
    setTrail(freshTrail);
    setSnack(spawnSnack(freshTrail));
    setScore(0);
    setCollected(0);
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
      const movement = STEP[directionRef.current];
      setTrail((current) => {
        const head = current[0];
        if (!head) return makeInitialTrail();
        const nextHead = { x: head.x + movement.x, y: head.y + movement.y };
        const hitWall = nextHead.x < 0 || nextHead.x >= GRID_SIZE || nextHead.y < 0 || nextHead.y >= GRID_SIZE;
        const ateSnack = nextHead.x === snack.x && nextHead.y === snack.y;
        const collisionBody = ateSnack ? current : current.slice(0, -1);
        const hitTail = collisionBody.some((part) => part.x === nextHead.x && part.y === nextHead.y);

        if (hitWall || hitTail) {
          window.setTimeout(() => finishGame(scoreRef.current), 0);
          return current;
        }

        const nextTrail = [nextHead, ...current];
        if (!ateSnack) nextTrail.pop();

        if (ateSnack) {
          const earned = snack.golden ? 5 : 1;
          const nextScore = scoreRef.current + earned;
          scoreRef.current = nextScore;
          setScore(nextScore);
          setCollected((value) => value + 1);
          const nextBurst = { ...snack, id: ++burstIdRef.current };
          setBurst(nextBurst);
          window.setTimeout(() => setBurst((currentBurst) => currentBurst?.id === nextBurst.id ? null : currentBurst), 520);
          setSnack(spawnSnack(nextTrail));
          playTone(snack.golden ? 880 : 620, snack.golden ? 0.2 : 0.1, soundOn);
        }
        return nextTrail;
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [finishGame, phase, snack, soundOn, stepMs]);

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
                      <BoneIcon golden={snack.golden} />
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

          {phase !== "playing" ? (
            <div className={styles.overlay}>
              {phase === "ready" ? (
                <>
                  <span className={styles.overlayBadge}>NEW GAME</span>
                  <div className={styles.previewDog}><DogHead direction="right" /></div>
                  <h2>おやつを集めて<br />しっぽをのばそう！</h2>
                  <p>スワイプで進む方向を変えて、<br />壁と自分の足あとをよけよう。</p>
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
                  <h2>{newBest ? "ベストスコア更新！" : "よくがんばりました！"}</h2>
                  <p>集めたおやつ {collected}個・到達レベル {level}</p>
                  <button type="button" className={styles.startButton} onClick={startGame}>もう一度あそぶ <span>↻</span></button>
                </>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={styles.controlArea} aria-label="方向操作">
          <div className={styles.hint}><span>指でスワイプ</span><i />または方向ボタン</div>
          <div className={styles.controls}>
            <ControlButton direction="up" label="上" onDirection={chooseDirection} />
            <ControlButton direction="left" label="左" onDirection={chooseDirection} />
            <span className={styles.controlCenter}><i /><i /><i /></span>
            <ControlButton direction="right" label="右" onDirection={chooseDirection} />
            <ControlButton direction="down" label="下" onDirection={chooseDirection} />
          </div>
        </section>

        <section className={styles.rules}>
          <div><BoneIcon /><span><b>ふつうのおやつ</b><small>1ポイント</small></span></div>
          <div><BoneIcon golden /><span><b>金のおやつ</b><small>5ポイント</small></span></div>
          <p>プレビュー版のため、コインは付与されません</p>
        </section>
      </main>
    </div>
  );
}
