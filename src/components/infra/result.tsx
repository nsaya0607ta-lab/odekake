"use client";

/**
 * 本番が終わったあとの結果：★・目標との比べ・時間ごとのグラフ・学んだこと・ふりかえりクイズ。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { termById } from "./glossary";
import { yen } from "./model";
import { Teacher } from "./intro";
import type { FailReason, Metrics, Sample } from "./sim";
import type { Goal, Quiz, Result, StageDef } from "./stages";
import { sfx } from "./sound";
import styles from "./infra.module.css";

export type ResultInfo = {
  res: Result;
  series: Sample[];
  m: Metrics;
  /** はじめてクリアした（図鑑に用語が入った） */
  firstClear: boolean;
  /** 前より★がふえた */
  improved: boolean;
};

const ADVICE: Record<FailReason, string> = {
  busy: "混雑して断られたアクセス（503）が多かったようです。どこが赤く光っていたか、思い出してみよう。",
  timeout: "待たされすぎたアクセス（504）が多かったようです。行列ができていた場所を、楽にしてあげよう。",
  down: "止まった場所に送られたアクセスが失敗しました。止まっても代わりがいるようにしよう。",
  dns: "住所が分からず、たどりつけないアクセスがありました。",
  missing: "データが見つからないアクセスがありました。データをどこに置くか考えてみよう。",
  noserver: "行き先のサーバーがありませんでした。",
  late: "期限までに終わらなかった加工がありました。ワーカーは足りている？",
};

const FAIL_NAME: Record<FailReason, string> = {
  busy: "混雑（503）",
  timeout: "時間切れ（504）",
  down: "停止",
  dns: "住所不明",
  missing: "データなし",
  noserver: "行き先なし",
  late: "加工の期限切れ",
};

export function ResultOverlay({
  stage,
  info,
  quizDone,
  hasNext,
  onQuizCorrect,
  onRetry,
  onNext,
  onMap,
}: {
  stage: StageDef;
  info: ResultInfo;
  quizDone: boolean;
  hasNext: boolean;
  onQuizCorrect: () => void;
  onRetry: () => void;
  onNext: () => void;
  onMap: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { res, m, series } = info;
  const g = stage.goal;
  const total = m.ok + m.fail;
  const worst = (Object.entries(m.failBy) as [FailReason, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  useEffect(() => {
    sfx(res.clear ? "clear" : "fail");
    const timers = [0, 1, 2].filter((k) => k < res.stars).map((k) => window.setTimeout(() => sfx("star"), 520 + k * 260));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [res.clear, res.stars]);

  if (!mounted) return null;
  const headline = !res.clear ? "もう少し！" : res.stars === 3 ? "パーフェクト！" : "クリア！";
  const starRows: { on: boolean; label: string; value: string; goal: string }[] = [
    { on: res.clear, label: "成功率", value: `${(res.success * 100).toFixed(1)}%`, goal: `${Math.round(g.success * 100)}%以上` },
    { on: res.fast, label: "平均の速さ", value: Number.isFinite(res.latency) ? `${Math.round(res.latency)}ms` : "—", goal: `${g.latency}ms以内` },
    { on: res.cheap, label: "月額（平均）", value: yen(res.cost), goal: `${yen(g.cost)}以内` },
  ];

  return createPortal(
    <div className={styles.resultVeil} role="dialog" aria-modal="true" aria-label="結果">
      <div className={styles.resultCard}>
        <div className={styles.resultHead} data-clear={res.clear ? "1" : "0"}>
          <Teacher sub={`ステージ ${stage.no}・${stage.title}`} />
          <h2>{headline}</h2>
          <div className={styles.bigStars} aria-label={`★${res.stars}`}>
            {[0, 1, 2].map((k) => (
              <span key={k} data-on={k < res.stars ? "1" : undefined} style={{ animationDelay: `${0.45 + k * 0.26}s` }}>
                ★
              </span>
            ))}
          </div>
          {info.improved && res.stars > 0 ? <p className={styles.improved}>自己ベスト更新！</p> : null}
        </div>

        <ul className={styles.goalList}>
          {starRows.map((r, k) => (
            <li key={r.label} data-on={r.on ? "1" : "0"}>
              <span className={styles.goalStar}>{r.on ? "★" : "☆"}</span>
              <span className={styles.goalName}>
                {k === 0 ? "クリア：" : k === 1 ? "速さ：" : "コスト："}
                {r.label}
                <small>目標 {r.goal}</small>
              </span>
              <b>{r.value}</b>
            </li>
          ))}
        </ul>
        {!res.clear ? (
          <div className={styles.advice}>
            <p>{worst[0] ? ADVICE[worst[0][0]] : "成功率が目標にとどきませんでした。"}</p>
            <p className={styles.adviceHint}>ヒント：{stage.hint}</p>
          </div>
        ) : null}

        <section className={styles.resultSection}>
          <h3>時間ごとのようす</h3>
          <ResultChart series={series} goal={g} stage={stage} />
        </section>

        <section className={styles.resultSection}>
          <h3>数字で見る</h3>
          <div className={styles.countGrid}>
            <span>
              <small>返事できた</small>
              <b>{m.ok.toLocaleString("ja-JP")}件</b>
            </span>
            <span>
              <small>失敗</small>
              <b>{m.fail.toLocaleString("ja-JP")}件</b>
            </span>
            {m.attacks ? (
              <span>
                <small>攻撃を防いだ</small>
                <b>
                  {m.blocked}/{m.attacks}件
                </b>
              </span>
            ) : null}
            {m.jobsMade ? (
              <span>
                <small>加工が完成</small>
                <b>
                  {m.jobsDone}/{m.jobsMade}件
                </b>
              </span>
            ) : null}
          </div>
          {worst.length ? (
            <p className={styles.failBreakdown}>
              失敗の内わけ：{worst.map(([k, v]) => `${FAIL_NAME[k]} ${v}件`).join("・")}
              {total ? `（全体の ${((m.fail / total) * 100).toFixed(1)}%）` : ""}
            </p>
          ) : null}
        </section>

        <section className={styles.resultSection}>
          <h3>学んだこと</h3>
          <ul className={styles.takeaways}>
            {stage.takeaways.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {info.firstClear && stage.terms.length ? (
            <div className={styles.newTerms}>
              <small>図鑑に追加されました</small>
              <p>
                {stage.terms.map((id) => (
                  <span key={id}>{termById(id)?.name ?? id}</span>
                ))}
              </p>
            </div>
          ) : null}
        </section>

        <section className={styles.resultSection}>
          <h3>
            ふりかえりクイズ{quizDone ? <span className={styles.quizBadge}>理解 ✓</span> : null}
          </h3>
          <QuizBlock quiz={stage.quiz} onAllCorrect={onQuizCorrect} />
        </section>

        <div className={styles.resultActions}>
          <button type="button" className={styles.btnGhost} onClick={onMap}>
            ステージ一覧
          </button>
          <button type="button" className={styles.btn} onClick={onRetry}>
            もう一度
          </button>
          {res.clear && hasNext ? (
            <button type="button" className={styles.btnPrimary} onClick={onNext}>
              つぎのステージ
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function QuizBlock({ quiz, onAllCorrect }: { quiz: Quiz[]; onAllCorrect: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.map(() => null));
  // 選びなおしで答えが偏らないよう、選択肢の並びは問題ごとに一度だけまぜる
  const orders = useMemo(() => quiz.map((q) => shuffle(q.choices.map((_, i) => i))), [quiz]);
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current) return;
    if (answers.every((a, i) => a != null && a === quiz[i]!.answer)) {
      reported.current = true;
      onAllCorrect();
    }
  }, [answers, quiz, onAllCorrect]);
  return (
    <div className={styles.quizList}>
      {quiz.map((q, qi) => {
        const picked = answers[qi];
        return (
          <div key={q.q} className={styles.quiz}>
            <p className={styles.quizQ}>
              Q{qi + 1}. {q.q}
            </p>
            <div className={styles.quizChoices}>
              {orders[qi]!.map((ci) => {
                const state = picked == null ? undefined : ci === q.answer ? "right" : ci === picked ? "wrong" : "dim";
                return (
                  <button
                    key={ci}
                    type="button"
                    className={styles.quizChoice}
                    data-state={state}
                    disabled={picked != null && picked === q.answer}
                    onClick={() => {
                      sfx(ci === q.answer ? "correct" : "wrong");
                      setAnswers((cur) => cur.map((a, k) => (k === qi ? ci : a)));
                    }}
                  >
                    {q.choices[ci]}
                  </button>
                );
              })}
            </div>
            {picked != null ? (
              <p className={styles.quizWhy} data-right={picked === q.answer ? "1" : "0"}>
                {picked === q.answer ? "正解！ " : "おしい！ もう一度えらんでみよう。 "}
                {picked === q.answer ? q.why : ""}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/* ------------------------------------------------------------ グラフ */

type Point = { t: number; rate: number | null; lat: number | null; n: number };

/** 1秒ごとの記録を、前後1秒ずつと合わせた3秒の平均にする（件数が少ない秒のばらつきをならす） */
function smooth(series: Sample[]): Point[] {
  return series.map((s, i) => {
    let ok = 0, fail = 0, latSum = 0, latN = 0;
    for (let k = Math.max(0, i - 1); k <= Math.min(series.length - 1, i + 1); k++) {
      const x = series[k]!;
      ok += x.ok;
      fail += x.fail;
      if (x.lat != null && x.ok > 0) {
        latSum += x.lat * x.ok;
        latN += x.ok;
      }
    }
    return { t: s.t, rate: ok + fail ? ok / (ok + fail) : null, lat: latN ? latSum / latN : null, n: s.ok + s.fail };
  });
}

const LINE = "#3987e5";
const PAD_L = 34;
const PAD_R = 10;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  const steps = [100, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1500, 2000];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 500) * 500;
}

function ResultChart({ series, goal, stage }: { series: Sample[]; goal: Goal; stage: StageDef }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pts = useMemo(() => smooth(series), [series]);
  const duration = Math.max(1, series.length ? series[series.length - 1]!.t : stage.setup.duration);
  const latMax = niceMax(Math.max(goal.latency * 1.25, ...pts.map((p) => p.lat ?? 0)));
  const crashes = stage.setup.events.filter((e) => e.kind === "crash").map((e) => e.t);
  const H = 92;
  const top = 10;
  const plotH = 64;
  const xOf = (t: number) => PAD_L + (t / duration) * (w - PAD_L - PAD_R);

  const pathOf = (vals: (number | null)[], yOf: (v: number) => number) => {
    let d = "";
    let pen = false;
    pts.forEach((p, i) => {
      const v = vals[i];
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${xOf(p.t).toFixed(1)} ${yOf(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const areaOf = (vals: (number | null)[], yOf: (v: number) => number) => {
    // 途切れたところで区切って、それぞれを下までぬる
    const parts: string[] = [];
    let seg: { x: number; y: number }[] = [];
    const flush = () => {
      if (seg.length > 1) parts.push(`M${seg[0]!.x} ${top + plotH}` + seg.map((s) => `L${s.x.toFixed(1)} ${s.y.toFixed(1)}`).join("") + `L${seg[seg.length - 1]!.x} ${top + plotH}Z`);
      seg = [];
    };
    pts.forEach((p, i) => {
      const v = vals[i];
      if (v == null) flush();
      else seg.push({ x: xOf(p.t), y: yOf(v) });
    });
    flush();
    return parts.join("");
  };

  const rateY = (v: number) => top + plotH - v * plotH;
  const latY = (v: number) => top + plotH - (Math.min(v, latMax) / latMax) * plotH;
  const rates = pts.map((p) => p.rate);
  const lats = pts.map((p) => p.lat);
  const hp = hover != null ? pts[hover] : null;

  const pick = (clientX: number) => {
    const el = ref.current;
    if (!el || !pts.length) return;
    const x = clientX - el.getBoundingClientRect().left;
    const t = ((x - PAD_L) / (w - PAD_L - PAD_R)) * duration;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i]!.t - t) < Math.abs(pts[best]!.t - t)) best = i;
    setHover(best);
  };
  const onPointer = (e: PointerEvent) => pick(e.clientX);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(pts.length - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? pts.length) - 1));
    else if (e.key === "Escape") setHover(null);
  };

  const xTicks: number[] = [];
  for (let t = 0; t <= duration; t += 10) xTicks.push(t);

  const chart = (kind: "rate" | "lat") => {
    const vals = kind === "rate" ? rates : lats;
    const yOf = kind === "rate" ? rateY : latY;
    const ticks = kind === "rate" ? [0, 0.5, 1] : [0, latMax / 2, latMax];
    const goalV = kind === "rate" ? goal.success : goal.latency;
    return (
      <svg width={w} height={H} className={styles.chartSvg} aria-hidden="true">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={w - PAD_R} y1={yOf(v)} y2={yOf(v)} className={styles.chartGrid} />
            <text x={PAD_L - 6} y={yOf(v) + 3} textAnchor="end" className={styles.chartTick}>
              {kind === "rate" ? `${Math.round(v * 100)}%` : `${Math.round(v)}`}
            </text>
          </g>
        ))}
        {crashes.map((t, i) => (
          <g key={t}>
            <line x1={xOf(t)} x2={xOf(t)} y1={top} y2={top + plotH} className={styles.chartEvent} />
            {kind === "rate" && (i === 0 || xOf(t) - xOf(crashes[i - 1]!) > 34) ? (
              <text x={xOf(t) + 3} y={top + plotH - 5} className={styles.chartTick}>
                故障
              </text>
            ) : null}
          </g>
        ))}
        <line x1={PAD_L} x2={w - PAD_R} y1={yOf(goalV)} y2={yOf(goalV)} className={styles.chartGoal} />
        <text x={w - PAD_R} y={yOf(goalV) - 4} textAnchor="end" className={styles.chartTick}>
          目標
        </text>
        <path d={areaOf(vals, yOf)} fill={LINE} opacity={0.1} />
        <path d={pathOf(vals, yOf)} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {kind === "lat"
          ? xTicks.map((t) => (
              <text key={t} x={xOf(t)} y={H - 4} textAnchor="middle" className={styles.chartTick}>
                {t}秒
              </text>
            ))
          : null}
        {hp ? (
          <>
            <line x1={xOf(hp.t)} x2={xOf(hp.t)} y1={top} y2={top + plotH} className={styles.chartCross} />
            {vals[hover!] != null ? <circle cx={xOf(hp.t)} cy={yOf(vals[hover!]!)} r={4} fill={LINE} className={styles.chartDot} /> : null}
          </>
        ) : null}
      </svg>
    );
  };

  const tipLeft = hp ? Math.min(w - 128, Math.max(0, xOf(hp.t) - 64)) : 0;

  return (
    <div>
      <div
        ref={ref}
        className={styles.chartBox}
        tabIndex={0}
        role="img"
        aria-label="成功率と返事の速さの、時間ごとの変化のグラフ。左右キーで時刻を選べます"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <p className={styles.chartTitle}>成功率（前後3秒の平均）</p>
        {chart("rate")}
        <p className={styles.chartTitle}>返事の速さ（ms・前後3秒の平均）</p>
        {chart("lat")}
        {hp ? (
          <div className={styles.chartTip} style={{ left: tipLeft }}>
            <small>{hp.t}秒のころ</small>
            <span>
              <i style={{ background: LINE }} />
              <b>{hp.rate == null ? "—" : `${Math.round(hp.rate * 100)}%`}</b> 成功率
            </span>
            <span>
              <i style={{ background: LINE }} />
              <b>{hp.lat == null ? "—" : `${Math.round(hp.lat)}ms`}</b> 速さ
            </span>
            <span>
              <b>{hp.n}件</b> この1秒の数
            </span>
          </div>
        ) : null}
      </div>
      <details className={styles.tableView}>
        <summary>表で見る</summary>
        <table>
          <thead>
            <tr>
              <th>時間</th>
              <th>成功</th>
              <th>失敗</th>
              <th>平均の速さ</th>
            </tr>
          </thead>
          <tbody>
            {bucket(series, 5).map((b) => (
              <tr key={b.from}>
                <td>
                  {b.from}〜{b.to}秒
                </td>
                <td>{b.ok}</td>
                <td>{b.fail}</td>
                <td>{b.lat == null ? "—" : `${Math.round(b.lat)}ms`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function bucket(series: Sample[], size: number) {
  const out: { from: number; to: number; ok: number; fail: number; lat: number | null }[] = [];
  for (let i = 0; i < series.length; i += size) {
    const part = series.slice(i, i + size);
    let ok = 0, fail = 0, latSum = 0, latN = 0;
    for (const s of part) {
      ok += s.ok;
      fail += s.fail;
      if (s.lat != null && s.ok) {
        latSum += s.lat * s.ok;
        latN += s.ok;
      }
    }
    out.push({ from: part[0]!.t - 1, to: part[part.length - 1]!.t, ok, fail, lat: latN ? latSum / latN : null });
  }
  return out;
}
