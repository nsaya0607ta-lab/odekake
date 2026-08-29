"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COLLECTION_ITEMS } from "@/lib/collection/items";

type DifficultyId = "beginner" | "intermediate" | "advanced";

type DifficultyConfig = {
  id: DifficultyId;
  label: string;
  tagline: string;
  pairs: number;
  columns: 3 | 4;
  memorizeSeconds: number;
  timeLimitSeconds: number | null;
  coinDivisor: number;
  boardLabel: string;
};

type CardState = {
  key: string;
  itemId: string;
  image: string;
  name: string;
  flipped: boolean;
  matched: boolean;
};

type ResultSummary = {
  difficultyId: DifficultyId;
  cleared: boolean;
  matchScore: number;
  timeBonus: number;
  perfectBonus: number;
  totalScore: number;
  moves: number;
  maxCombo: number;
  coin: number;
  isNewBest: boolean;
};

type Phase = "select" | "memorize" | "playing" | "result";

const DIFFICULTIES: DifficultyConfig[] = [
  {
    id: "beginner",
    label: "初級",
    tagline: "のんびり",
    pairs: 6,
    columns: 3,
    memorizeSeconds: 4,
    timeLimitSeconds: null,
    coinDivisor: 12,
    boardLabel: "3×4・12枚",
  },
  {
    id: "intermediate",
    label: "中級",
    tagline: "じっくり",
    pairs: 8,
    columns: 4,
    memorizeSeconds: 3,
    timeLimitSeconds: 120,
    coinDivisor: 8,
    boardLabel: "4×4・16枚",
  },
  {
    id: "advanced",
    label: "上級",
    tagline: "本気",
    pairs: 10,
    columns: 4,
    memorizeSeconds: 2,
    timeLimitSeconds: 150,
    coinDivisor: 5,
    boardLabel: "4×5・20枚",
  },
];

const BASE_POINT = 100;
const COMBO_STEP = 15;
const TIME_BONUS_CAP = 150;
const PERFECT_BONUS = 300;
const MISMATCH_DELAY_MS = 700;
const FALLBACK_IMAGE = "/collection/items/colorful-ball.webp";

const CARD_ITEM_IDS = [
  "toy_colorful_ball",
  "toy_duck_plush",
  "toy_frisbee",
  "food_paw_pudding",
  "food_smile_onigiri",
  "food_cheese_cubes",
  "interior_anball",
  "interior_gold_ball",
  "accessory_red_bandana",
  "other_acorns",
];

const CARD_POOL = CARD_ITEM_IDS.map((id) => {
  const item = COLLECTION_ITEMS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`memory-game-preview: missing collection item "${id}"`);
  return { id: item.id, name: item.name, image: item.image ?? FALLBACK_IMAGE };
});

function shuffle<T>(input: readonly T[]): T[] {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

function buildDeck(pairs: number): CardState[] {
  const items = CARD_POOL.slice(0, pairs);
  const deck = items.flatMap((item) => [
    { key: `${item.id}-a`, itemId: item.id, image: item.image, name: item.name, flipped: true, matched: false },
    { key: `${item.id}-b`, itemId: item.id, image: item.image, name: item.name, flipped: true, matched: false },
  ]);
  return shuffle(deck);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function bestScoreKey(id: DifficultyId): string {
  return `odekake:memory-game-preview:best-score:${id}`;
}

export default function MemoryGamePreviewPage() {
  const [phase, setPhase] = useState<Phase>("select");
  const [difficulty, setDifficulty] = useState<DifficultyConfig | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [flippedKeys, setFlippedKeys] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [comboStreak, setComboStreak] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [memorizeRemaining, setMemorizeRemaining] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<ResultSummary | null>(null);
  const [bestScores, setBestScores] = useState<Record<DifficultyId, number>>({
    beginner: 0,
    intermediate: 0,
    advanced: 0,
  });

  const scoreRef = useRef(0);
  const movesRef = useRef(0);
  const maxComboRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    try {
      for (const d of DIFFICULTIES) {
        const raw = window.localStorage.getItem(bestScoreKey(d.id));
        const n = raw ? Number(raw) : 0;
        if (Number.isFinite(n) && n > 0) {
          setBestScores((prev) => ({ ...prev, [d.id]: n }));
        }
      }
    } catch {
      // localStorageが使えない環境ではベストスコア表示を諦めるだけでよい
    }
  }, []);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    movesRef.current = moves;
  }, [moves]);
  useEffect(() => {
    maxComboRef.current = maxCombo;
  }, [maxCombo]);

  // おぼえるタイムのカウントダウン
  useEffect(() => {
    if (phase !== "memorize" || memorizeRemaining <= 0) return;
    const id = window.setTimeout(() => setMemorizeRemaining((t) => t - 1), 1000);
    return () => window.clearTimeout(id);
  }, [phase, memorizeRemaining]);

  useEffect(() => {
    if (phase !== "memorize" || memorizeRemaining > 0) return;
    setCards((prev) => prev.map((c) => ({ ...c, flipped: false })));
    setTimeRemaining(difficulty?.timeLimitSeconds ?? null);
    setPhase("playing");
  }, [phase, memorizeRemaining, difficulty]);

  // 制限時間のカウントダウン（初級はtimeLimitSecondsがnullなので発火しない）
  useEffect(() => {
    if (phase !== "playing" || difficulty?.timeLimitSeconds == null) return;
    const id = window.setInterval(() => {
      setTimeRemaining((t) => (t === null ? null : Math.max(0, t - 1)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, difficulty]);

  useEffect(() => {
    if (phase !== "playing" || timeRemaining !== 0 || finishedRef.current) return;
    finishedRef.current = true;
    finishGame(false, { matchScore: scoreRef.current, moves: movesRef.current, maxCombo: maxComboRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeRemaining]);

  function startDifficulty(config: DifficultyConfig) {
    finishedRef.current = false;
    setDifficulty(config);
    setCards(buildDeck(config.pairs));
    setFlippedKeys([]);
    setIsLocked(false);
    setMoves(0);
    setMatchedPairs(0);
    setComboStreak(0);
    setMaxCombo(0);
    setScore(0);
    setResult(null);
    setTimeRemaining(null);
    setMemorizeRemaining(config.memorizeSeconds);
    setPhase("memorize");
  }

  function finishGame(cleared: boolean, values: { matchScore: number; moves: number; maxCombo: number }) {
    if (!difficulty) return;
    let timeBonus = 0;
    let perfectBonus = 0;
    if (cleared) {
      if (difficulty.timeLimitSeconds != null) {
        timeBonus = Math.min(TIME_BONUS_CAP, Math.max(0, timeRemaining ?? 0));
      }
      if (values.moves === difficulty.pairs) perfectBonus = PERFECT_BONUS;
    }
    const totalScore = values.matchScore + timeBonus + perfectBonus;
    const coin = Math.floor(totalScore / difficulty.coinDivisor);
    const previousBest = bestScores[difficulty.id] ?? 0;
    const isNewBest = totalScore > previousBest;

    if (isNewBest) {
      setBestScores((prev) => ({ ...prev, [difficulty.id]: totalScore }));
      try {
        window.localStorage.setItem(bestScoreKey(difficulty.id), String(totalScore));
      } catch {
        // ベストスコアの保存に失敗しても結果表示自体は継続する
      }
    }

    setResult({
      difficultyId: difficulty.id,
      cleared,
      matchScore: values.matchScore,
      timeBonus,
      perfectBonus,
      totalScore,
      moves: values.moves,
      maxCombo: values.maxCombo,
      coin,
      isNewBest,
    });
    setPhase("result");
  }

  function handleCardClick(card: CardState) {
    if (phase !== "playing" || isLocked) return;
    if (card.flipped || card.matched) return;

    const flippedNow = cards.map((c) => (c.key === card.key ? { ...c, flipped: true } : c));
    setCards(flippedNow);
    const nextFlippedKeys = [...flippedKeys, card.key];
    setFlippedKeys(nextFlippedKeys);
    if (nextFlippedKeys.length < 2) return;

    setIsLocked(true);
    const nextMoves = moves + 1;
    setMoves(nextMoves);

    const [keyA, keyB] = nextFlippedKeys;
    const cardA = flippedNow.find((c) => c.key === keyA)!;
    const cardB = flippedNow.find((c) => c.key === keyB)!;

    if (cardA.itemId === cardB.itemId) {
      const newStreak = comboStreak + 1;
      const gained = BASE_POINT + COMBO_STEP * (newStreak - 1);
      const newScore = score + gained;
      const newMaxCombo = Math.max(maxCombo, newStreak);
      const newMatchedPairs = matchedPairs + 1;

      setComboStreak(newStreak);
      setMaxCombo(newMaxCombo);
      setScore(newScore);
      setMatchedPairs(newMatchedPairs);
      setCards((prev) => prev.map((c) => (c.key === keyA || c.key === keyB ? { ...c, matched: true } : c)));
      setFlippedKeys([]);
      setIsLocked(false);

      if (difficulty && newMatchedPairs === difficulty.pairs) {
        finishedRef.current = true;
        finishGame(true, { matchScore: newScore, moves: nextMoves, maxCombo: newMaxCombo });
      }
    } else {
      setComboStreak(0);
      window.setTimeout(() => {
        setCards((prev) => prev.map((c) => (c.key === keyA || c.key === keyB ? { ...c, flipped: false } : c)));
        setFlippedKeys([]);
        setIsLocked(false);
      }, MISMATCH_DELAY_MS);
    }
  }

  return (
    <main className="min-h-dvh bg-paper px-3 py-5 text-ink sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[560px]">
        <header className="mb-5 flex items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/mini-games-preview"
              aria-label="ミニゲーム一覧へ戻る"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-2xl font-bold text-ink-soft shadow-[0_3px_12px_rgba(94,75,47,0.08)]"
            >
              ‹
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.16em] text-[#6d5c96]">ODEKAKE MEMORY</p>
              <h1 className="truncate text-xl font-black sm:text-2xl">しん犬すいじゃく</h1>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-[10px] font-black tracking-[0.12em] text-ink-soft">
            PREVIEW
          </span>
        </header>

        {phase === "select" ? (
          <SelectScreen bestScores={bestScores} onSelect={startDifficulty} />
        ) : null}

        {(phase === "memorize" || phase === "playing") && difficulty ? (
          <PlayScreen
            difficulty={difficulty}
            phase={phase}
            cards={cards}
            onCardClick={handleCardClick}
            moves={moves}
            matchedPairs={matchedPairs}
            comboStreak={comboStreak}
            score={score}
            memorizeRemaining={memorizeRemaining}
            timeRemaining={timeRemaining}
          />
        ) : null}

        {phase === "result" && result && difficulty ? (
          <ResultScreen
            result={result}
            difficulty={difficulty}
            onRetry={() => startDifficulty(difficulty)}
            onBackToSelect={() => {
              setPhase("select");
              setDifficulty(null);
            }}
          />
        ) : null}
      </div>

      <style>{`
        .mem-card { perspective: 800px; }
        .mem-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 420ms cubic-bezier(.2,.8,.2,1);
          transform-style: preserve-3d;
        }
        .mem-card.is-flipped .mem-card-inner { transform: rotateY(180deg); }
        .mem-card-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .mem-card-face.is-back { transform: rotateY(180deg); }
        .mem-card.is-matched .mem-card-inner { animation: mem-matched-pop 380ms ease-out; }
        .mem-shake { animation: mem-shake 420ms ease-in-out; }
        @keyframes mem-matched-pop {
          0% { transform: rotateY(180deg) scale(1); }
          45% { transform: rotateY(180deg) scale(1.08); }
          100% { transform: rotateY(180deg) scale(1); }
        }
        @keyframes mem-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mem-card-inner, .mem-card.is-matched .mem-card-inner, .mem-shake { animation: none !important; transition: none !important; }
        }
      `}</style>
    </main>
  );
}

function SelectScreen({
  bestScores,
  onSelect,
}: {
  bestScores: Record<DifficultyId, number>;
  onSelect: (config: DifficultyConfig) => void;
}) {
  return (
    <div>
      <section className="rounded-[24px] border border-line bg-card px-4 py-4 shadow-[0_6px_18px_rgba(93,80,58,0.06)]">
        <p className="text-[10px] font-black tracking-[0.1em] text-[#6d5c96]">HOW TO PLAY</p>
        <p className="mt-1 text-sm font-bold leading-relaxed text-ink-soft">
          全部のカードが一瞬だけ表向きになります。位置を覚えて、同じ絵柄を2枚めくってペアを揃えましょう。
          連続で正解するとコンボボーナス、ミス0でクリアするとパーフェクトボーナスがつきます。
        </p>
      </section>

      <div className="mt-4 space-y-3" aria-label="難易度を選ぶ">
        {DIFFICULTIES.map((d) => {
          const best = bestScores[d.id];
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d)}
              className="pressable group relative block w-full overflow-hidden rounded-[26px] border border-lilac/25 bg-gradient-to-br from-[#fffdfc] via-[#f4f0fb] to-[#e9e3f6] p-4 text-left shadow-[0_10px_26px_rgba(105,86,150,0.1)] transition-transform active:scale-[0.985]"
            >
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-lilac px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                  {d.label}
                </span>
                <span className="rounded-full border border-white/90 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-[#6d5c96]">
                  {d.tagline}
                </span>
              </span>

              <span className="mt-2 flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold text-ink-soft">{d.boardLabel}</span>
                  <span className="mt-1 block text-[11px] font-bold text-ink-soft">
                    おぼえるタイム{d.memorizeSeconds}秒 ・{" "}
                    {d.timeLimitSeconds ? `制限時間${formatTime(d.timeLimitSeconds)}` : "制限時間なし"}
                  </span>
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lilac text-xl font-black leading-none text-white">
                  ›
                </span>
              </span>

              <span className="mt-3 flex items-center justify-between rounded-[16px] border border-white/90 bg-white/70 px-3 py-2">
                <span className="text-[10px] font-black text-[#6d5c96]">自己ベスト</span>
                <span className="text-[13px] font-black text-ink">{best > 0 ? `${best}点` : "まだ記録なし"}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 px-1 text-[10px] leading-relaxed text-ink-faint">
        ※これはプレビューです。コイン・スコアはこの画面内だけのシミュレーションで、実際には付与されません。
      </p>
    </div>
  );
}

function PlayScreen({
  difficulty,
  phase,
  cards,
  onCardClick,
  moves,
  matchedPairs,
  comboStreak,
  score,
  memorizeRemaining,
  timeRemaining,
}: {
  difficulty: DifficultyConfig;
  phase: Phase;
  cards: CardState[];
  onCardClick: (card: CardState) => void;
  moves: number;
  matchedPairs: number;
  comboStreak: number;
  score: number;
  memorizeRemaining: number;
  timeRemaining: number | null;
}) {
  const gridColsClass = difficulty.columns === 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div>
      <section className="rounded-[22px] border border-line bg-card px-4 py-3 shadow-[0_6px_18px_rgba(93,80,58,0.06)]">
        {phase === "memorize" ? (
          <p className="text-center text-sm font-black text-[#6d5c96]">
            おぼえるタイム 残り {memorizeRemaining} 秒
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 text-center">
            <StatTile label="ペア" value={`${matchedPairs}/${difficulty.pairs}`} />
            <StatTile label="手数" value={String(moves)} />
            <StatTile label="コンボ" value={comboStreak > 0 ? `×${comboStreak}` : "-"} />
            <StatTile label={timeRemaining !== null ? "残り時間" : "スコア"} value={timeRemaining !== null ? formatTime(timeRemaining) : String(score)} />
          </div>
        )}
      </section>

      <div className={`mt-4 grid ${gridColsClass} gap-2.5`} aria-label="カード盤面">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => onCardClick(card)}
            disabled={phase !== "playing" || card.matched}
            aria-label={card.flipped ? card.name : "裏向きのカード"}
            className={`mem-card aspect-square w-full ${card.flipped ? "is-flipped" : ""} ${card.matched ? "is-matched" : ""}`}
          >
            <span className="mem-card-inner block">
              <span className="mem-card-face flex bg-gradient-to-br from-lilac-soft to-[#efe8fa] shadow-[inset_0_0_0_1px_rgba(169,155,203,0.35)]">
                <span aria-hidden="true" className="text-2xl">🐾</span>
              </span>
              <span
                className={`mem-card-face is-back flex bg-white shadow-[inset_0_0_0_1px_rgba(169,155,203,0.35)] ${card.matched ? "opacity-70" : ""}`}
              >
                <Image
                  src={card.image}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 480px) 22vw, 110px"
                  className="object-contain p-2"
                />
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-paper-deep px-2 py-2">
      <p className="text-[9px] font-black text-ink-faint">{label}</p>
      <p className="mt-0.5 text-sm font-black text-ink">{value}</p>
    </div>
  );
}

function ResultScreen({
  result,
  difficulty,
  onRetry,
  onBackToSelect,
}: {
  result: ResultSummary;
  difficulty: DifficultyConfig;
  onRetry: () => void;
  onBackToSelect: () => void;
}) {
  return (
    <div>
      <section className="rounded-[26px] border border-lilac/25 bg-gradient-to-br from-[#fffdfc] via-[#f4f0fb] to-[#e9e3f6] px-5 py-6 text-center shadow-[0_10px_26px_rgba(105,86,150,0.1)]">
        <p className="text-[10px] font-black tracking-[0.14em] text-[#6d5c96]">
          {result.cleared ? `${difficulty.label} クリア！` : "タイムアップ…"}
        </p>
        {result.isNewBest ? (
          <p className="mt-1 text-[11px] font-black text-blossom">🎉 自己ベスト更新！</p>
        ) : null}
        <p className="mt-2 text-4xl font-black text-ink">{result.totalScore}<span className="ml-1 text-base font-bold text-ink-soft">点</span></p>

        <div className="mt-4 space-y-1.5 rounded-[18px] border border-white/90 bg-white/70 px-4 py-3 text-left">
          <ResultRow label="マッチ得点" value={`${result.matchScore}点`} />
          <ResultRow label="タイムボーナス" value={`+${result.timeBonus}点`} />
          <ResultRow label="パーフェクトボーナス" value={`+${result.perfectBonus}点`} />
          <div className="my-1 h-px bg-line" />
          <ResultRow label="手数" value={`${result.moves}手（最小${difficulty.pairs}手）`} />
          <ResultRow label="最大コンボ" value={`×${result.maxCombo}`} />
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-[18px] bg-white/70 px-4 py-3">
          <span aria-hidden="true" className="text-xl">🪙</span>
          <span className="text-sm font-black text-ink">獲得コイン（シミュレーション） {result.coin}枚</span>
        </div>
      </section>

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={onRetry}
          className="pressable flex-1 rounded-full bg-lilac px-4 py-3 text-sm font-black text-white shadow-[0_6px_16px_rgba(105,86,150,0.25)] active:scale-[0.98]"
        >
          もう一度遊ぶ
        </button>
        <button
          type="button"
          onClick={onBackToSelect}
          className="pressable flex-1 rounded-full border border-line bg-card px-4 py-3 text-sm font-black text-ink-soft active:scale-[0.98]"
        >
          難易度を選び直す
        </button>
      </div>

      <p className="mt-4 px-1 text-[10px] leading-relaxed text-ink-faint">
        ※これはプレビューです。コイン・自己ベストはこの端末のブラウザにだけ保存され、実際のコイン残高には反映されません。
      </p>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold text-ink-soft">{label}</span>
      <span className="text-[12px] font-black text-ink">{value}</span>
    </div>
  );
}
