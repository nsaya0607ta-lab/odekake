"use client";

import { useEffect, useMemo, useState } from "react";

type BowlingFrameView = {
  rolls: number[];
  marks: string[];
  cumulative: number | null;
};

type InputContext = {
  frameIndex: number;
  rollIndex: number;
  maxPins: number;
};

const BEST_SCORE_KEY = "odekake:bowling-preview:best-score";
const SEGMENTS: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "d", "e", "g"],
  "3": ["a", "b", "c", "d", "g"],
  "4": ["b", "c", "f", "g"],
  "5": ["a", "c", "d", "f", "g"],
  "6": ["a", "c", "d", "e", "f", "g"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  "-": ["g"],
  " ": [],
};

function displayPin(value: number): string {
  return value === 0 ? "-" : String(value);
}

function frameMarks(rolls: number[], frameIndex: number): string[] {
  if (rolls.length === 0) return [];

  if (frameIndex < 9) {
    const first = rolls[0] ?? 0;
    if (first === 10) return ["X"];
    const marks = [displayPin(first)];
    const second = rolls[1];
    if (second !== undefined) marks.push(first + second === 10 ? "/" : displayPin(second));
    return marks;
  }

  const [first, second, third] = rolls;
  const marks: string[] = [];
  if (first !== undefined) marks.push(first === 10 ? "X" : displayPin(first));

  if (second !== undefined) {
    if (first === 10) marks.push(second === 10 ? "X" : displayPin(second));
    else marks.push((first ?? 0) + second === 10 ? "/" : displayPin(second));
  }

  if (third !== undefined) {
    if (first === 10) {
      if (second === 10) marks.push(third === 10 ? "X" : displayPin(third));
      else marks.push((second ?? 0) + third === 10 ? "/" : displayPin(third));
    } else {
      marks.push(third === 10 ? "X" : displayPin(third));
    }
  }

  return marks;
}

function splitRollsIntoFrames(rolls: number[]): number[][] {
  const frames: number[][] = [];
  let cursor = 0;

  for (let frameIndex = 0; frameIndex < 9; frameIndex += 1) {
    const first = rolls[cursor];
    if (first === undefined) {
      frames.push([]);
      continue;
    }

    if (first === 10) {
      frames.push([first]);
      cursor += 1;
      continue;
    }

    const second = rolls[cursor + 1];
    if (second === undefined) {
      frames.push([first]);
      cursor += 1;
      continue;
    }

    frames.push([first, second]);
    cursor += 2;
  }

  frames.push(rolls.slice(cursor, cursor + 3));
  return frames;
}

function isTenthFrameComplete(rolls: number[]): boolean {
  const [first, second, third] = rolls;
  if (first === undefined || second === undefined) return false;
  if (first === 10 || first + second === 10) return third !== undefined;
  return true;
}

function buildScoreState(rolls: number[]): { frames: BowlingFrameView[]; total: number; complete: boolean } {
  const rawFrames = splitRollsIntoFrames(rolls);
  const frames: BowlingFrameView[] = [];
  let rollCursor = 0;
  let cumulative = 0;
  let scoringBlocked = false;

  for (let frameIndex = 0; frameIndex < 10; frameIndex += 1) {
    const frameRolls = rawFrames[frameIndex] ?? [];
    let frameScore: number | null = null;

    if (!scoringBlocked) {
      if (frameIndex < 9) {
        const first = frameRolls[0];
        const second = frameRolls[1];

        if (first === 10) {
          const bonusOne = rolls[rollCursor + 1];
          const bonusTwo = rolls[rollCursor + 2];
          if (bonusOne !== undefined && bonusTwo !== undefined) frameScore = 10 + bonusOne + bonusTwo;
        } else if (first !== undefined && second !== undefined) {
          if (first + second === 10) {
            const bonus = rolls[rollCursor + 2];
            if (bonus !== undefined) frameScore = 10 + bonus;
          } else {
            frameScore = first + second;
          }
        }
      } else if (isTenthFrameComplete(frameRolls)) {
        frameScore = frameRolls.reduce((sum, roll) => sum + roll, 0);
      }
    }

    if (frameScore === null) {
      scoringBlocked = true;
    } else {
      cumulative += frameScore;
    }

    frames.push({
      rolls: frameRolls,
      marks: frameMarks(frameRolls, frameIndex),
      cumulative: frameScore === null ? null : cumulative,
    });

    if (frameIndex < 9) {
      if (frameRolls[0] === 10) rollCursor += 1;
      else rollCursor += frameRolls.length >= 2 ? 2 : frameRolls.length;
    }
  }

  const complete = rawFrames.slice(0, 9).every((frame) => frame[0] === 10 || frame.length === 2)
    && isTenthFrameComplete(rawFrames[9] ?? []);
  const lastResolved = [...frames].reverse().find((frame) => frame.cumulative !== null)?.cumulative ?? 0;

  return { frames, total: complete ? (frames[9]?.cumulative ?? lastResolved) : lastResolved, complete };
}

function getInputContext(rolls: number[]): InputContext | null {
  const frames = splitRollsIntoFrames(rolls);

  for (let frameIndex = 0; frameIndex < 9; frameIndex += 1) {
    const frame = frames[frameIndex] ?? [];
    const first = frame[0];
    if (first === undefined) return { frameIndex, rollIndex: 0, maxPins: 10 };
    if (first !== 10 && frame[1] === undefined) {
      return { frameIndex, rollIndex: 1, maxPins: 10 - first };
    }
  }

  const tenth = frames[9] ?? [];
  const first = tenth[0];
  const second = tenth[1];
  const third = tenth[2];

  if (first === undefined) return { frameIndex: 9, rollIndex: 0, maxPins: 10 };
  if (second === undefined) {
    return { frameIndex: 9, rollIndex: 1, maxPins: first === 10 ? 10 : 10 - first };
  }

  const bonusAvailable = first === 10 || first + second === 10;
  if (!bonusAvailable || third !== undefined) return null;

  if (first === 10) {
    return { frameIndex: 9, rollIndex: 2, maxPins: second === 10 ? 10 : 10 - second };
  }
  return { frameIndex: 9, rollIndex: 2, maxPins: 10 };
}

function SevenSegmentDigit({ char }: { char: string }) {
  const active = new Set(SEGMENTS[char] ?? []);
  return (
    <span className="bowl-seven-digit" aria-hidden="true">
      {(["a", "b", "c", "d", "e", "f", "g"] as const).map((segment) => (
        <i key={segment} className={`bowl-seg bowl-seg-${segment} ${active.has(segment) ? "is-on" : ""}`} />
      ))}
    </span>
  );
}

function RollingDigit({ char, duration = 420 }: { char: string; duration?: number }) {
  const [shown, setShown] = useState(char);
  const [previous, setPrevious] = useState(char);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (char === shown) return;
    setPrevious(shown);
    setShown(char);
    setRolling(true);
    const timer = window.setTimeout(() => setRolling(false), duration);
    return () => window.clearTimeout(timer);
  }, [char, duration, shown]);

  return (
    <span className="bowl-roll-window">
      {rolling ? (
        <span className="bowl-roll-strip" style={{ animationDuration: `${duration}ms` }}>
          <SevenSegmentDigit char={previous} />
          <SevenSegmentDigit char={shown} />
        </span>
      ) : (
        <SevenSegmentDigit char={shown} />
      )}
    </span>
  );
}

function AnimatedDigitalNumber({
  value,
  large = false,
  blankWhenNull = true,
}: {
  value: number | null;
  large?: boolean;
  blankWhenNull?: boolean;
}) {
  const text = value === null
    ? (blankWhenNull ? "---" : "000")
    : Math.max(0, Math.min(999, value)).toString().padStart(3, "0");

  return (
    <span className={`bowl-digital ${large ? "is-large" : ""}`} aria-label={value === null ? "未確定" : String(value)}>
      {text.split("").map((char, index) => (
        <RollingDigit key={index} char={char} duration={large ? 480 : 360} />
      ))}
    </span>
  );
}

function TransparentBowlingIcon() {
  return (
    <svg viewBox="0 0 108 64" role="img" aria-label="ボウリング" className="h-12 w-[82px] shrink-0 overflow-visible">
      <circle cx="35" cy="35" r="22" fill="#7fa8c9" />
      <circle cx="28" cy="28" r="3" fill="#5d8049" opacity=".72" />
      <circle cx="37" cy="24" r="3" fill="#5d8049" opacity=".72" />
      <circle cx="40" cy="33" r="3" fill="#5d8049" opacity=".72" />
      <path d="M76 7c5 0 7 6 6 13-1 7-2 11 2 18 4 8 7 15 3 19-5 5-22 5-27 0-4-4-1-11 3-19 4-7 3-11 2-18-1-7 1-13 6-13h5Z" fill="#fffdf8" stroke="#cfc5b0" strokeWidth="2" />
      <path d="M66 28h17" stroke="#dd9aa6" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default function BowlingScorePreview() {
  const [rolls, setRolls] = useState<number[]>([]);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  const scoreState = useMemo(() => buildScoreState(rolls), [rolls]);
  const input = useMemo(() => getInputContext(rolls), [rolls]);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    if (Number.isFinite(stored) && stored > 0) setBestScore(stored);
  }, []);

  useEffect(() => {
    if (!scoreState.complete) return;
    const finalScore = scoreState.frames[9]?.cumulative ?? scoreState.total;
    if (bestScore === null || finalScore > bestScore) {
      setBestScore(finalScore);
      setNewBest(true);
      window.localStorage.setItem(BEST_SCORE_KEY, String(finalScore));
      const timer = window.setTimeout(() => setNewBest(false), 1000);
      return () => window.clearTimeout(timer);
    }
  }, [bestScore, scoreState.complete, scoreState.frames, scoreState.total]);

  const addRoll = (pins: number) => {
    if (!input || pins < 0 || pins > input.maxPins) return;
    setRolls((current) => [...current, pins]);
  };

  const undo = () => setRolls((current) => current.slice(0, -1));
  const reset = () => {
    setRolls([]);
    setNewBest(false);
  };

  return (
    <main className="min-h-screen bg-paper px-3 py-5 text-ink sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-4 flex items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <TransparentBowlingIcon />
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.16em] text-leaf-deep">ODEKAKE BOWLING</p>
              <h1 className="truncate text-xl font-black sm:text-2xl">ボウリング スコア</h1>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-leaf-soft px-3 py-1.5 text-[10px] font-black tracking-[0.12em] text-leaf-deep">
            GAME 01
          </span>
        </header>

        <section className="overflow-hidden rounded-[28px] border border-line bg-card shadow-[0_10px_30px_rgba(93,80,58,0.08)]">
          <div className="flex min-w-0">
            <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
              <div className="grid min-w-[900px] grid-cols-10">
                {scoreState.frames.map((frame, frameIndex) => {
                  const active = input?.frameIndex === frameIndex;
                  return (
                    <div
                      key={frameIndex}
                      className={`relative min-h-[190px] border-r border-line text-center transition ${active ? "bg-leaf-soft/45" : "bg-card"}`}
                      aria-label={`${frameIndex + 1}フレーム`}
                    >
                      <span className={`block border-b border-line px-2 py-2 text-sm font-black ${active ? "bg-leaf-soft text-leaf-deep" : "bg-paper-deep text-ink-soft"}`}>
                        {frameIndex + 1}
                      </span>
                      <span key={`${frameIndex}-${frame.marks.join("")}`} className="bowl-mark-pop flex h-[72px] items-center justify-center gap-1 text-[28px] font-black tracking-wide text-ink">
                        {frame.marks.length ? frame.marks.map((mark, index) => <span key={`${mark}-${index}`}>{mark}</span>) : <span className="text-line-strong">·</span>}
                      </span>
                      <span className="flex min-h-[70px] items-center justify-center border-t border-dashed border-line px-1">
                        <AnimatedDigitalNumber value={frame.cumulative} />
                      </span>
                      {active ? <span className="absolute inset-x-2 bottom-1 text-[8px] font-black tracking-[0.1em] text-leaf-deep">NEXT</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="relative z-10 flex w-[132px] shrink-0 flex-col border-l border-line-strong bg-[linear-gradient(180deg,#eef5e6_0%,#fffdf8_100%)] sm:w-[158px]">
              <div className="border-b border-line px-2 py-2 text-center text-sm font-black tracking-[0.08em] text-leaf-deep">TOTAL</div>
              <div className="flex flex-1 flex-col items-center justify-center px-2 py-4">
                <AnimatedDigitalNumber value={scoreState.total} large blankWhenNull={false} />
                <div className={`mt-5 w-full border-t border-dashed border-line-strong pt-3 text-center ${newBest ? "bowl-best-pop" : ""}`}>
                  <p className="text-[10px] font-black text-ink-soft">♛ ベストスコア</p>
                  <div className="mt-2 flex justify-center">
                    <AnimatedDigitalNumber value={bestScore} blankWhenNull />
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-3 rounded-[24px] border border-line bg-card px-3 py-3 shadow-[0_6px_18px_rgba(93,80,58,0.06)] sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black tracking-[0.12em] text-leaf-deep">SCORE INPUT</p>
              <p className="mt-0.5 text-sm font-black text-ink">
                {input ? `第${input.frameIndex + 1}フレーム・${input.rollIndex + 1}投目` : "ゲーム終了"}
              </p>
              {input ? <p className="text-[10px] font-bold text-ink-faint">倒したピン数を選択してください（0〜{input.maxPins}）</p> : null}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={undo} disabled={rolls.length === 0} className="min-h-11 rounded-full border border-line bg-paper-deep px-4 text-xs font-black text-ink-soft disabled:opacity-35">
                1投戻す
              </button>
              <button type="button" onClick={reset} disabled={rolls.length === 0} className="min-h-11 rounded-full border border-line bg-card px-4 text-xs font-black text-ink-soft disabled:opacity-35">
                リセット
              </button>
            </div>
          </div>

          {input ? (
            <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-11">
              {Array.from({ length: 11 }, (_, pins) => (
                <button
                  key={pins}
                  type="button"
                  onClick={() => addRoll(pins)}
                  disabled={pins > input.maxPins}
                  className={`min-h-11 rounded-[14px] border text-sm font-black transition active:scale-95 ${pins === 10 ? "border-leaf bg-leaf-soft text-leaf-deep" : "border-line bg-paper text-ink"} disabled:cursor-not-allowed disabled:opacity-20`}
                >
                  {pins === 10 ? "10 / X" : pins}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-[18px] bg-leaf-soft px-4 py-3 text-center">
              <p className="text-sm font-black text-leaf-deep">ゲーム終了　TOTAL {scoreState.total}</p>
            </div>
          )}
        </section>

        <p className="mt-2 px-1 text-[10px] leading-relaxed text-ink-faint">
          ストライクは次の2投、スペアは次の1投を加算。未確定フレームは「---」で表示します。装飾は透明背景のSVGのみを使用しています。
        </p>
      </div>

      <style>{`
        .bowl-digital{--digit-w:18px;--digit-h:32px;--digit-gap:4px;display:inline-flex;gap:var(--digit-gap);color:#5d8049;filter:drop-shadow(0 1px 0 rgba(255,255,255,.9))}
        .bowl-digital.is-large{--digit-w:26px;--digit-h:46px;--digit-gap:5px;color:#4d7440}
        .bowl-roll-window{display:inline-block;width:var(--digit-w);height:var(--digit-h);overflow:hidden;vertical-align:middle}
        .bowl-roll-strip{display:flex;height:calc(var(--digit-h) * 2);flex-direction:column;animation-name:bowl-digital-roll;animation-timing-function:cubic-bezier(.22,.78,.22,1);animation-fill-mode:forwards}
        .bowl-seven-digit{position:relative;display:block;width:var(--digit-w);height:var(--digit-h);flex:0 0 var(--digit-h)}
        .bowl-seg{position:absolute;display:block;background:currentColor;opacity:.09;border-radius:999px;transition:opacity 120ms ease,filter 120ms ease}
        .bowl-seg.is-on{opacity:1;filter:drop-shadow(0 0 2px rgba(93,128,73,.18))}
        .bowl-seg-a,.bowl-seg-d,.bowl-seg-g{left:20%;width:60%;height:10%}
        .bowl-seg-a{top:2%}.bowl-seg-g{top:45%}.bowl-seg-d{bottom:2%}
        .bowl-seg-b,.bowl-seg-c,.bowl-seg-e,.bowl-seg-f{width:11%;height:38%}
        .bowl-seg-b{right:8%;top:8%}.bowl-seg-c{right:8%;bottom:8%}.bowl-seg-f{left:8%;top:8%}.bowl-seg-e{left:8%;bottom:8%}
        .bowl-mark-pop{animation:bowl-mark-pop 280ms ease-out}
        .bowl-best-pop{animation:bowl-best-pop 700ms cubic-bezier(.2,.8,.2,1)}
        @keyframes bowl-digital-roll{from{transform:translateY(0)}to{transform:translateY(-50%)}}
        @keyframes bowl-mark-pop{0%{opacity:.25;transform:scale(.92)}70%{transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
        @keyframes bowl-best-pop{0%{transform:translateY(0) scale(1)}35%{transform:translateY(-5px) scale(1.05)}100%{transform:translateY(0) scale(1)}}
        @media (prefers-reduced-motion:reduce){.bowl-roll-strip,.bowl-mark-pop,.bowl-best-pop{animation:none!important}.bowl-seg{transition:none}}
      `}</style>
    </main>
  );
}
