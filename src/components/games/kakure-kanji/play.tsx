"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Answer, Stage } from "@/lib/games/kakure-kanji/types";
import {
  HINTS,
  HINT_ORDER,
  canUseHint,
  applyHint,
  newRound,
  orderedAnswers,
  partHintStrokes,
  strokeCountOf,
  submit,
  totalAnswers,
  type HintKind,
  type RoundState,
} from "@/lib/games/kakure-kanji/engine";
import { normalizeSelection, resultMessage, type JudgeResult } from "@/lib/games/kakure-kanji/judge";
import {
  ACHIEVEMENTS,
  buyHint,
  completeStage,
  expToNext,
  recordAnswers,
  saveRound,
  titleFor,
  type AchievementId,
  type ClearReward,
  type SaveData,
} from "@/lib/games/kakure-kanji/progress";
import { KanjiStrokes } from "./kanji-strokes";
import { playSfx } from "./sound";
import { StrokeBoard } from "./stroke-board";
import { CoinPill, Sheet } from "./ui";
import styles from "./kakure-kanji.module.css";

type Feedback = { tone: "good" | "bad" | "info" | "plain"; text: string; key: number };
type Flyer = { key: number; char: string; from: DOMRect; to: DOMRect };

const TIER_LABEL = { 1: "やさしい", 2: "ふつう", 3: "むずかしい" } as const;
const RULE_LABEL = { component: "部品をそのまま取り出す", strokes: "筆画をえらんで取り出す" } as const;

export function PlayScreen({
  stage,
  save,
  commit,
  readSave,
  sound,
  onExit,
  onSkip,
  onReview,
  onSettings,
  onAchievements,
}: {
  stage: Stage;
  save: SaveData;
  /** 新しいセーブデータを反映して保存する */
  commit: (next: SaveData) => void;
  /** いちばん新しいセーブデータ（連打しても古い状態から計算しないように） */
  readSave: () => SaveData;
  sound: boolean;
  onExit: () => void;
  onSkip: () => void;
  onReview: () => void;
  onSettings: () => void;
  onAchievements: (unlocked: AchievementId[]) => void;
}) {
  // クリアしたラウンドは保存データから消えるので、クリア画面を閉じるまではここで持っておく
  const [finished, setFinished] = useState<RoundState | null>(null);
  const round = save.rounds[stage.id] ?? finished ?? undefined;
  const answers = useMemo(() => orderedAnswers(stage), [stage]);
  const total = totalAnswers(stage);

  // はじめて開いたとき・クリア後にもう一度遊ぶときは、新しいラウンドを作る
  useEffect(() => {
    if (finished) return;
    const current = readSave();
    if (!current.rounds[stage.id]) commit(saveRound(current, newRound(stage, Date.now())));
  }, [stage, round, finished, commit, readSave]);

  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [feedback, setFeedback] = useState<Feedback>({ tone: "plain", text: START_MESSAGE, key: 0 });
  const [shake, setShake] = useState(0);
  const [glow, setGlow] = useState<{ strokes: number[]; key: number } | null>(null);
  const [pop, setPop] = useState<{ char: string; key: number } | null>(null);
  const [scorePop, setScorePop] = useState<{ points: number; key: number } | null>(null);
  const [boardPulse, setBoardPulse] = useState(0);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [hintTarget, setHintTarget] = useState<string | null>(null);
  const [detail, setDetail] = useState<Answer | null>(null);
  const [clear, setClear] = useState<{ reward: ClearReward; round: RoundState } | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef(new Map<string, HTMLButtonElement>());
  const seq = useRef(1);
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const found = useMemo(() => new Set(round?.found ?? []), [round]);

  const launchFlyer = useCallback((char: string) => {
    const board = boardRef.current?.getBoundingClientRect();
    const slot = slotRefs.current.get(char)?.getBoundingClientRect();
    if (!board || !slot) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFlyers((list) => [...list, { key: seq.current++, char, from: board, to: slot }]);
  }, []);

  const handleSubmit = useCallback(() => {
    const current = readSave();
    const live = current.rounds[stage.id];
    if (!live || live.clearedAt !== null) return;
    const now = Date.now();
    const outcome = submit(stage, live, selected, now);
    const result = outcome.result;
    if (!result) return;
    const key = seq.current++;
    setGlow(null);
    if (result.kind === "empty") {
      setFeedback({ tone: "info", text: resultMessage(result, stage.kanji), key });
      setShake(key);
      return;
    }

    let next = saveRound(current, outcome.round);
    const wrong = result.kind === "wrong" || result.kind === "whole" ? 1 : 0;
    const recorded = recordAnswers(next, outcome.gained ? 1 : 0, wrong, now);
    next = recorded.save;
    // クリアでとれた実績はクリア画面に出すので、トーストには「初めての正解」などだけを出す
    const unlocked: AchievementId[] = [...recorded.unlocked];

    let reward: ClearReward | null = null;
    if (outcome.cleared) {
      const done = completeStage(next, stage, outcome.round, now);
      next = done.save;
      reward = done.reward;
    }
    commit(next);
    if (outcome.cleared) setFinished(outcome.round);

    if (outcome.gained) {
      const { answer, points } = outcome.gained;
      setSelected(new Set());
      setFeedback({ tone: "good", text: `「${answer.char}」を見つけた！ +${points}点`, key });
      setGlow({ strokes: [...normalizeSelection(stage, selected)], key });
      setBoardPulse(key);
      setScorePop({ points, key });
      later(() => launchFlyer(answer.char), 80);
      later(() => setPop({ char: answer.char, key }), 600);
      playSfx("correct", sound);
      navigator.vibrate?.(12);
    } else if (result.kind === "duplicate" || result.kind === "pending") {
      setSelected(new Set());
      setFeedback({ tone: "info", text: resultMessage(result, stage.kanji), key });
      playSfx("duplicate", sound);
    } else {
      // まちがいでは、えらんだ線は残す（少し直して、もう一度答えられるように）
      setFeedback({ tone: "bad", text: resultMessage(result, stage.kanji), key });
      setShake(key);
      playSfx("wrong", sound);
      navigator.vibrate?.(30);
    }

    if (unlocked.length > 0) onAchievements(unlocked);
    if (reward) {
      const snapshot = outcome.round;
      const done = reward;
      later(() => {
        setClear({ reward: done, round: snapshot });
        playSfx("clear", sound);
      }, 1200);
    }
  }, [commit, launchFlyer, later, onAchievements, readSave, selected, sound, stage]);

  const spendHint = (answerChar: string, kind: HintKind) => {
    const current = readSave();
    const live = current.rounds[stage.id];
    if (!live || !canUseHint(live, answerChar, kind)) return;
    const now = Date.now();
    const bought = buyHint(current, stage.id, answerChar, kind, HINTS[kind].cost, now);
    if (!bought.ok) return;
    const nextRound = applyHint(stage, live, answerChar, kind, now);
    let next = saveRound(bought.save, nextRound);
    playSfx("hint", sound);
    if (kind === "reveal") {
      setHintTarget(null);
      setSelected(new Set());
      const key = seq.current++;
      const answer = stage.answers.find((a) => a.char === answerChar);
      setGlow({ strokes: answer?.strokeSets[0] ?? [], key });
      setFeedback({ tone: "info", text: `「${answerChar}」を開きました（点数は入りません）`, key });
      later(() => launchFlyer(answerChar), 60);
      if (nextRound.clearedAt !== null) {
        setFinished(nextRound);
        const done = completeStage(next, stage, nextRound, now);
        next = done.save;
        if (done.reward) {
          const reward = done.reward;
          later(() => {
            setClear({ reward, round: nextRound });
            playSfx("clear", sound);
          }, 1000);
        }
      }
    }
    commit(next);
  };

  const retry = () => {
    setClear(null);
    setFinished(null);
    setGlow(null);
    setSelected(new Set());
    setFeedback({ tone: "plain", text: "もう一度！ こんどはヒントなし・まちがいなしをめざそう", key: seq.current++ });
  };

  if (!round) return <div className={styles.scroll} aria-busy="true" />;

  const nextHintTarget = answers.find((a) => !found.has(a.char))?.char ?? null;
  const progress = round.found.length / Math.max(1, total);

  return (
    <>
      <header className={styles.topbar}>
        <button type="button" className={styles.iconButton} onClick={onExit} aria-label="ステージ一覧へ戻る">
          ‹
        </button>
        <div className={styles.stageMeta}>
          <small>ステージ {stage.number}</small>
          <strong>
            {stage.difficulty}・「{stage.kanji}」
          </strong>
        </div>
        <span style={{ position: "relative" }}>
          <span className={styles.pill} aria-label={`このステージの点数 ${round.score}点`}>
            {round.score.toLocaleString("ja-JP")}
            <small style={{ fontSize: 10 }}>点</small>
          </span>
          {scorePop && (
            <span key={scorePop.key} className={styles.scorePop} aria-hidden="true">
              +{scorePop.points}
            </span>
          )}
        </span>
        <CoinPill coins={save.coins} />
        <button type="button" className={styles.iconButton} onClick={onSettings} aria-label="設定">
          ⚙
        </button>
      </header>

      <main className={styles.scroll}>
        <div className={styles.column}>
          <div ref={boardRef} className={styles.board} data-pulse={boardPulse ? "true" : undefined} data-shake={shake ? "true" : undefined} key={`board-${boardPulse}-${shake}`}>
            <StrokeBoard
              strokes={stage.strokes}
              selected={selected}
              onChange={(next) => {
                setSelected(next);
                playSfx("tap", sound);
              }}
              glow={glow}
              disabled={round.clearedAt !== null}
              label={`出題漢字「${stage.kanji}」。線をタップすると黒くなります。いま${selected.size}本えらんでいます`}
            />
          </div>

          <div className={styles.counter} aria-live="polite">
            <span>
              <b>{round.found.length}</b> / {total} 見つけた
            </span>
            <span className={styles.progressTrack} aria-hidden="true">
              <span className={styles.progressFill} style={{ display: "block", transform: `scaleX(${progress})` }} />
            </span>
          </div>

          <div className={styles.slots} role="list" aria-label="答えの一覧">
            {answers.map((answer, i) => {
              const isFound = found.has(answer.char);
              const used = round.hints[answer.char] ?? [];
              const note = !isFound ? hintNote(answer, used) : null;
              return (
                <button
                  key={answer.char}
                  role="listitem"
                  type="button"
                  ref={(el) => {
                    if (el) slotRefs.current.set(answer.char, el);
                    else slotRefs.current.delete(answer.char);
                  }}
                  className={`${styles.slot} ${isFound ? styles.mincho : ""}`}
                  data-found={isFound ? "true" : "false"}
                  data-revealed={round.revealed.includes(answer.char) ? "true" : undefined}
                  data-pop={pop?.char === answer.char ? "true" : undefined}
                  onClick={() => (isFound ? setDetail(answer) : setHintTarget(answer.char))}
                  aria-label={
                    isFound
                      ? `答え${i + 1}「${answer.char}」見つけた。説明を見る`
                      : `答え${i + 1} まだ見つけていない（${TIER_LABEL[answer.tier]}）。ヒントを見る`
                  }
                >
                  {isFound ? answer.char : "？"}
                  {!isFound && note && <span className={styles.slotNote}>{note}</span>}
                  {isFound && answer.rare && <span className={styles.slotRare}>めずらしい</span>}
                  {!isFound && (
                    <span className={styles.slotTier} aria-hidden="true">
                      {Array.from({ length: answer.tier }, (_, n) => (
                        <i key={n} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p key={feedback.key} className={styles.feedback} data-tone={feedback.tone} role="status" aria-live="polite">
            {feedback.text}
          </p>

          {round.history.length > 0 && (
            <div className={styles.history} aria-label="入力の履歴">
              {round.history.slice(0, 14).map((h, i) => (
                <span key={`${h.at}-${i}`} className={`${styles.chip} ${styles.mincho}`} data-kind={h.kind} title={KIND_LABEL[h.kind]}>
                  {h.text}
                  <span className={styles.srOnly}>{KIND_LABEL[h.kind]}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </main>

      <div className={styles.dock}>
        <div className={styles.column}>
          <div className={styles.inputRow}>
            <button type="button" className={styles.secondary} style={{ height: 52, padding: "0 16px" }} onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
              けす
            </button>
            <button type="button" className={`${styles.primary} ${styles.okButton}`} onClick={handleSubmit} disabled={selected.size === 0 || round.clearedAt !== null}>
              OK<small>{selected.size > 0 ? `えらんだ線 ${selected.size}本で答える` : "線をタップしてえらぶ"}</small>
            </button>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => nextHintTarget && setHintTarget(nextHintTarget)} disabled={!nextHintTarget}>
              💡 ヒント
            </button>
            <button type="button" className={styles.secondary} onClick={() => setConfirmSkip(true)}>
              ⏭ スキップ
            </button>
          </div>
        </div>
      </div>

      {flyers.map((f) => (
        <FlyingChar key={f.key} flyer={f} onDone={() => setFlyers((list) => list.filter((x) => x.key !== f.key))} />
      ))}

      {hintTarget && (
        <HintSheet
          stage={stage}
          answers={answers}
          round={round}
          coins={save.coins}
          target={hintTarget}
          onTarget={setHintTarget}
          onUse={spendHint}
          onClose={() => setHintTarget(null)}
        />
      )}

      {detail && (
        <Sheet title={`「${detail.char}」の見つけ方`} onClose={() => setDetail(null)}>
          <AnswerExplain stage={stage} answer={detail} />
        </Sheet>
      )}

      {confirmSkip && (
        <Sheet title="このステージをスキップ？" onClose={() => setConfirmSkip(false)} center>
          <p className={styles.explainText}>
            答えと説明を見て、このステージを終わりにします。報酬はもらえず、連続クリアの記録が切れます。
          </p>
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button type="button" className={styles.secondary} onClick={() => setConfirmSkip(false)}>
              つづける
            </button>
            <button type="button" className={`${styles.secondary} ${styles.danger}`} onClick={onSkip}>
              スキップする
            </button>
          </div>
        </Sheet>
      )}

      {clear && <ClearDialog stage={stage} save={save} clear={clear} sound={sound} onReview={onReview} onExit={onExit} onRetry={retry} />}
    </>
  );
}

const START_MESSAGE = "大きな漢字の線をタップして黒くしよう。漢字になったと思ったら OK！";

const KIND_LABEL: Record<JudgeResult["kind"], string> = {
  correct: "正解",
  duplicate: "見つけ済み",
  pending: "確認中",
  whole: "全部の線",
  wrong: "ちがう",
  empty: "えらんでいない",
};

function hintNote(answer: Answer, used: HintKind[]): string | null {
  const parts: string[] = [];
  if (used.includes("reading")) parts.push(answer.readings[answer.readings.length - 1] ?? "");
  if (used.includes("strokes")) parts.push(`${strokeCountOf(answer)}画`);
  if (used.includes("part")) parts.push("一部");
  return parts.length ? parts.join("・") : null;
}

function FlyingChar({ flyer, onDone }: { flyer: Flyer; onDone: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { from, to } = flyer;
    const size = to.width;
    const startScale = (from.width * 0.5) / size;
    const sx = from.left + from.width / 2 - size / 2;
    const sy = from.top + from.height / 2 - size / 2;
    const anim = el.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(${startScale * 0.6})`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy - 10}px) scale(${startScale})`, opacity: 1, offset: 0.28 },
        { transform: `translate(${to.left}px, ${to.top}px) scale(1)`, opacity: 0.9 },
      ],
      { duration: 720, easing: "cubic-bezier(0.5, 0, 0.25, 1)", fill: "forwards" },
    );
    anim.onfinish = () => done.current();
    return () => anim.cancel();
  }, [flyer]);
  return (
    <span
      ref={ref}
      className={`${styles.flyer} ${styles.mincho}`}
      style={{ width: flyer.to.width, height: flyer.to.height, fontSize: flyer.to.width * 0.62 }}
      aria-hidden="true"
    >
      {flyer.char}
    </span>
  );
}

function HintSheet({
  stage,
  answers,
  round,
  coins,
  target,
  onTarget,
  onUse,
  onClose,
}: {
  stage: Stage;
  answers: Answer[];
  round: RoundState;
  coins: number;
  target: string;
  onTarget: (char: string) => void;
  onUse: (char: string, kind: HintKind) => void;
  onClose: () => void;
}) {
  const open = answers.filter((a) => !round.found.includes(a.char));
  const index = Math.max(0, open.findIndex((a) => a.char === target));
  const answer = open[index];
  if (!answer) {
    return (
      <Sheet title="ヒント" onClose={onClose}>
        <p className={styles.explainText}>全部見つけました！</p>
      </Sheet>
    );
  }
  const position = answers.findIndex((a) => a.char === answer.char) + 1;
  const used = round.hints[answer.char] ?? [];
  const move = (step: number) => {
    const next = open[(index + step + open.length) % open.length];
    if (next) onTarget(next.char);
  };
  return (
    <Sheet title="ヒント" onClose={onClose}>
      <div className={styles.targetPicker}>
        <button type="button" className={styles.close} onClick={() => move(-1)} aria-label="前の答え" disabled={open.length < 2}>
          ‹
        </button>
        <strong>
          答え{position}（{TIER_LABEL[answer.tier]}）
        </strong>
        <button type="button" className={styles.close} onClick={() => move(1)} aria-label="次の答え" disabled={open.length < 2}>
          ›
        </button>
      </div>
      <div className={styles.hintGrid}>
        {HINT_ORDER.map((kind) => {
          const hint = HINTS[kind];
          const isUsed = used.includes(kind);
          const short = Math.max(0, hint.cost - coins);
          return (
            <button
              key={kind}
              type="button"
              className={styles.hintButton}
              data-used={isUsed ? "true" : undefined}
              disabled={isUsed || short > 0}
              onClick={() => onUse(answer.char, kind)}
            >
              <b>{hint.label}</b>
              {isUsed ? (
                <HintValue kind={kind} answer={answer} stage={stage} />
              ) : (
                <>
                  <span>{hint.description}</span>
                  <em>{short > 0 ? `墨コインがあと${short}枚たりない` : `墨コイン ${hint.cost}枚`}</em>
                </>
              )}
            </button>
          );
        })}
      </div>
      <p className={styles.note}>
        ヒントを使った答えは点数が半分、開いた答えは0点になります。線は{stage.strokes.length}本だけなので、ヒントを使わなくても、組み合わせをためせば必ず見つけられます。
        （出題「{stage.kanji}」・持っている墨コイン {coins}枚）
      </p>
    </Sheet>
  );
}

function HintValue({ kind, answer, stage }: { kind: HintKind; answer: Answer; stage: Stage }) {
  if (kind === "reading") return <span className={styles.hintReveal}>{answer.readings.join("・")}</span>;
  if (kind === "strokes") return <span className={styles.hintReveal}>{strokeCountOf(answer)}画</span>;
  if (kind === "part") {
    const part = partHintStrokes(answer);
    return (
      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {part.length > 0 && (
          <span className={styles.partArt}>
            <KanjiStrokes strokes={stage.strokes} highlight={part} mode="focus" label={`答えに使う画の一部（${part.length}画）`} className={styles.kanjiSvg} />
          </span>
        )}
        <span>{answer.partHint}</span>
      </span>
    );
  }
  return <span className={styles.hintReveal}>{answer.char}</span>;
}

export function AnswerExplain({ stage, answer }: { stage: Stage; answer: Answer }) {
  return (
    <div className={styles.explain}>
      <div className={styles.explainArt}>
        <KanjiStrokes strokes={stage.strokes} highlight={answer.strokeSets[0]} mode="focus" label={`「${stage.kanji}」の中の「${answer.char}」の場所`} className={styles.kanjiSvg} />
      </div>
      <div>
        <div className={styles.explainChar}>
          <strong className={styles.mincho}>{answer.char}</strong>
          <span>{answer.readings.join("・")}</span>
        </div>
        <span className={styles.tag}>{RULE_LABEL[answer.rule]}</span>
        <span className={styles.tag}>{strokeCountOf(answer)}画</span>
        {answer.rare && (
          <span className={styles.tag} data-kind="rare">
            めずらしい字
          </span>
        )}
        <p className={styles.explainText}>
          {answer.evidence}
          <br />
          意味：{answer.meaning}
        </p>
        {answer.strokeSets.length > 1 && (
          <p className={styles.note}>取り出し方は{answer.strokeSets.length}通り（図は1つ目）。</p>
        )}
      </div>
    </div>
  );
}

function ClearDialog({
  stage,
  save,
  clear,
  sound,
  onReview,
  onExit,
  onRetry,
}: {
  stage: Stage;
  save: SaveData;
  clear: { reward: ClearReward; round: RoundState };
  sound: boolean;
  onReview: () => void;
  onExit: () => void;
  onRetry: () => void;
}) {
  const { reward, round } = clear;
  useEffect(() => {
    const ids = [0, 1, 2].filter((i) => i < reward.stars).map((i) => window.setTimeout(() => playSfx("star", sound), 450 + i * 260));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [reward.stars, sound]);
  const confetti = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        dx: `${((i * 53) % 60) - 30}px`,
        delay: `${(i % 7) * 0.09}s`,
        color: ["#c4523a", "#c08d22", "#2f5470", "#4f7d52"][i % 4],
      })),
    [],
  );
  const seconds = Math.max(1, Math.round(((round.clearedAt ?? round.startedAt) - round.startedAt) / 1000));
  return (
    <Sheet title="ステージクリア" hideTitle onClose={onExit} center closable={false}>
      <div className={styles.celebrate} aria-hidden="true">
        {confetti.map((c, i) => (
          <i key={i} style={{ left: c.left, background: c.color, animationDelay: c.delay, ["--dx" as string]: c.dx }} />
        ))}
      </div>
      <p className={`${styles.clearTitle} ${styles.mincho}`}>ステージクリア</p>
      <div className={styles.clearStars} role="img" aria-label={`星${reward.stars}つ`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={styles.clearStar} data-on={i < reward.stars ? "true" : "false"} style={{ animationDelay: `${0.35 + i * 0.26}s` }} aria-hidden="true">
            ★
          </span>
        ))}
      </div>
      <p style={{ textAlign: "center", fontSize: 12, fontWeight: 800 }} className={styles.explainText}>
        {reward.stars === 3 ? "ノーヒントで全部見つけた！" : reward.stars === 2 ? "ヒント少なめでクリア！" : "クリア！次はヒントなしをめざそう"}
        {reward.newBest && " ・自己ベスト！"}
      </p>
      <div className={styles.rewardRows}>
        <div className={styles.rewardRow}>
          <span>点数</span>
          <b>{reward.score.toLocaleString("ja-JP")}点</b>
        </div>
        <div className={styles.rewardRow}>
          <span>墨コイン{reward.firstClear ? "（初クリア）" : ""}</span>
          <b>+{reward.coins}枚</b>
        </div>
        <div className={styles.rewardRow}>
          <span>経験値</span>
          <b>+{reward.exp}</b>
        </div>
        <div className={styles.rewardRow}>
          <span>まちがい・ヒント・時間</span>
          <b>
            {round.misses}回・{Object.values(round.hints).flat().length}回・{seconds}秒
          </b>
        </div>
        {reward.levelUps.map((up) => (
          <div key={up.level} className={styles.rewardRow} style={{ background: "var(--kin-soft)" }}>
            <span>レベルアップ！ Lv{up.level}（{titleFor(up.level)}）</span>
            <b>+{up.coins}枚</b>
          </div>
        ))}
        {reward.achievements.map((id) => {
          const a = ACHIEVEMENTS.find((x) => x.id === id);
          return a ? (
            <div key={id} className={styles.rewardRow} style={{ background: "var(--ai-soft)" }}>
              <span>🏅 実績「{a.name}」</span>
              <b>+{a.coins}枚</b>
            </div>
          ) : null;
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 900 }}>
          Lv{save.level} {titleFor(save.level)}
        </span>
        <div className={styles.expTrack}>
          <div className={styles.expFill} style={{ transform: `scaleX(${Math.min(1, save.exp / expToNext(save.level))})` }} />
        </div>
      </div>
      <button type="button" className={`${styles.primary} ${styles.bigButton}`} onClick={onReview}>
        答えと解説を見る
      </button>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onRetry}>
          もう一度
        </button>
        <button type="button" className={styles.secondary} onClick={onExit}>
          ステージ一覧
        </button>
      </div>
      <p className={styles.note} style={{ textAlign: "center" }}>
        「{stage.kanji}」の次の問題は、答えを1つずつ確かめてから追加します。
      </p>
    </Sheet>
  );
}
