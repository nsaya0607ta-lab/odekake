"use client";

/**
 * 1つのステージを遊ぶ画面：せつめい → くみたて → ほんばん → けっか。
 */
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "./board";
import { IntroOverlay, MASCOT } from "./intro";
import { USER_COUNT, kindOf, partCost, yen, type NodeId, type Placement } from "./model";
import type { Progress } from "./progress";
import { ResultOverlay, type ResultInfo } from "./result";
import { PartSheet } from "./sheets";
import { InfraSim, type Tone } from "./sim";
import { STAGES, TIPS, evaluate, hasAttacks, type StageDef } from "./stages";
import { sfx } from "./sound";
import styles from "./infra.module.css";

type Phase = "intro" | "build" | "run" | "result";
type Hud = { success: number | null; latency: number | null; cost: number; now: number };
type Toast = { id: number; text: string; sticky?: boolean };
type BannerState = { id: number; text: string; tone: Tone };

export function StagePlay({
  stage,
  progress,
  onProgress,
  onExit,
  onNext,
  onToggleSound,
}: {
  stage: StageDef;
  progress: Progress;
  onProgress: (fn: (p: Progress) => Progress) => void;
  onExit: () => void;
  onNext: () => void;
  onToggleSound: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(() => (progress.seenIntro[stage.id] ? "build" : "intro"));
  const [placements, setPlacements] = useState<Placement[]>(() => stage.fixed.map((p) => ({ ...p })));
  const [sim, setSim] = useState<InfraSim | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hud, setHud] = useState<Hud>({ success: null, latency: null, cost: 0, now: 0 });
  const [sheet, setSheet] = useState<NodeId | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastRef = useRef<Toast | null>(null);
  const toastQueue = useRef<string[]>([]);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const bannerRef = useRef<BannerState | null>(null);
  const bannerQueue = useRef<{ text: string; tone: Tone }[]>([]);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [hint, setHint] = useState(false);
  const [ending, setEnding] = useState(false);
  const finishing = useRef(false);
  const finishTimer = useRef(0);
  const lastFail = useRef(0);

  const fixed = useMemo(() => new Set(stage.fixed.map((p) => p.slot)), [stage]);
  const bot = useMemo(() => hasAttacks(stage.setup), [stage]);
  const farUsers = Math.round(stage.setup.farRatio * USER_COUNT);
  const cost = placements.reduce((s, p) => s + partCost(p.kind, p.size), 0);
  const index = STAGES.findIndex((s) => s.id === stage.id);
  const hasNext = index >= 0 && index < STAGES.length - 1;
  // ヒント：お手本にあって、まだ置いていないマス。はじめからあるパーツは、設定（DNS の TTL など）がお手本とちがうとき
  const hintSlots = useMemo(
    () =>
      new Set(
        hint
          ? stage.solution
              .filter((p) => {
                const cur = placements.find((q) => q.slot === p.slot);
                return cur ? fixed.has(p.slot) && cur.size !== p.size : !fixed.has(p.slot);
              })
              .map((p) => p.slot)
          : [],
      ),
    [hint, stage, fixed, placements],
  );

  /* ------------------------------------------------ ヒントとお知らせ */

  // いま出ているものは ref にも持つ（状態の更新関数の中で待ち行列をさわらないように）
  const showToast = useCallback((t: Toast | null) => {
    toastRef.current = t;
    setToast(t);
  }, []);
  const nextToast = useCallback(() => {
    const next = toastQueue.current.shift();
    showToast(next ? { id: Date.now(), text: next } : null);
  }, [showToast]);
  const pushToast = useCallback(
    (text: string) => {
      if (!toastRef.current) {
        showToast({ id: Date.now(), text });
        return;
      }
      // たまりすぎると、状況が過ぎてから出てくるので、待たせるのは新しい2つまで
      toastQueue.current.push(text);
      if (toastQueue.current.length > 2) toastQueue.current.shift();
    },
    [showToast],
  );
  const clearToasts = useCallback(() => {
    toastQueue.current = [];
    showToast(null);
  }, [showToast]);

  const showBanner = useCallback((b: BannerState | null) => {
    bannerRef.current = b;
    setBanner(b);
  }, []);
  const pushBanner = useCallback(
    (b: { text: string; tone: Tone }) => {
      if (bannerRef.current) bannerQueue.current.push(b);
      else showBanner({ id: Date.now(), ...b });
    },
    [showBanner],
  );

  useEffect(() => {
    if (!toast || toast.sticky) return;
    const id = window.setTimeout(nextToast, 4600);
    return () => window.clearTimeout(id);
  }, [toast, nextToast]);

  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => {
      const next = bannerQueue.current.shift();
      showBanner(next ? { id: Date.now(), ...next } : null);
    }, 2600);
    return () => window.clearTimeout(id);
  }, [banner, showBanner]);

  /* ------------------------------------------------ 本番 */

  const finish = useCallback(
    (s: InfraSim) => {
      if (finishing.current) return;
      finishing.current = true;
      setEnding(true);
      // 「そこまで！」を少し見せてから結果へ（そのあいだに「やりなおす」を押したら、結果は出さない）
      finishTimer.current = window.setTimeout(() => {
        const res = evaluate(stage.goal, s.successRate(), s.avgLatency(), s.avgCost());
        const prev = progress.stars[stage.id] ?? 0;
        const info: ResultInfo = { res, series: [...s.series], m: { ...s.m, failBy: { ...s.m.failBy } }, firstClear: prev === 0 && res.clear, improved: res.stars > prev };
        onProgress((p) => {
          const stars = { ...p.stars, [stage.id]: Math.max(prev, res.stars, p.stars[stage.id] ?? 0) };
          const best = { ...p.best };
          const old = best[stage.id];
          if (res.clear && (!old || res.stars > (p.stars[stage.id] ?? 0) || res.success > old.success)) best[stage.id] = { success: res.success, latency: res.latency, cost: res.cost };
          return { ...p, stars, best };
        });
        setEnding(false);
        setResult(info);
        setPhase("result");
        clearToasts();
      }, 1100);
    },
    [stage, progress.stars, onProgress, clearToasts],
  );

  const onTick = useCallback(
    (s: InfraSim) => {
      setHud({ success: s.successRate(), latency: s.avgLatency(), cost: s.avgCost(), now: s.now });
      if (s.tips.length) {
        const ids = s.tips;
        s.tips = [];
        for (const id of ids) if (stage.tips.includes(id)) pushToast(TIPS[id]);
      }
      if (s.banners.length) {
        const list = s.banners;
        s.banners = [];
        for (const b of list) {
          if (b.tone === "danger") sfx("alarm");
          else if (b.tone === "good") sfx("good");
          pushBanner(b);
        }
      }
      if (s.m.fail > lastFail.current) sfx("drop");
      lastFail.current = s.m.fail;
      if (s.finished) finish(s);
    },
    [stage.tips, pushToast, pushBanner, finish],
  );

  const start = () => {
    sfx("start");
    const s = new InfraSim(stage.setup, placements, (Date.now() % 100000) + 1);
    finishing.current = false;
    lastFail.current = 0;
    setSim(s);
    setPaused(false);
    setPhase("run");
    setHint(false);
    clearToasts();
    setHud({ success: null, latency: null, cost: s.cost(), now: 0 });
  };

  useEffect(() => () => window.clearTimeout(finishTimer.current), []);

  const backToBuild = () => {
    window.clearTimeout(finishTimer.current);
    setSim(null);
    setResult(null);
    setEnding(false);
    finishing.current = false;
    setPhase("build");
    setHud({ success: null, latency: null, cost: 0, now: 0 });
    clearToasts();
    bannerQueue.current = [];
    showBanner(null);
  };

  /* ------------------------------------------------ パーツ */

  const place = (slot: NodeId, size: number) => {
    const kind = stage.fixed.find((p) => p.slot === slot)?.kind ?? kindOf(slot);
    setPlacements((cur) => {
      const exists = cur.find((p) => p.slot === slot);
      if (exists) return cur.map((p) => (p.slot === slot ? { ...p, size } : p));
      return [...cur, { slot, kind, size }];
    });
    sfx("place");
  };
  const remove = (slot: NodeId) => {
    if (fixed.has(slot)) return;
    setPlacements((cur) => cur.filter((p) => p.slot !== slot));
    setSheet(null);
    sfx("remove");
  };

  const toggleHint = () => {
    const next = !hint;
    setHint(next);
    if (next) {
      toastQueue.current = [];
      showToast({ id: Date.now(), text: stage.hint, sticky: true });
    } else clearToasts();
  };

  const running = phase === "run" || phase === "result";
  const g = stage.goal;
  const shownCost = running && sim ? hud.cost : cost;
  const remain = Math.max(0, Math.ceil(stage.setup.duration - hud.now));
  const progressPct = Math.min(100, (hud.now / stage.setup.duration) * 100);

  return (
    <div className={styles.play}>
      <header className={styles.playHeader}>
        <button type="button" className={styles.roundBtn} onClick={onExit} aria-label="ステージ一覧へ">
          ‹
        </button>
        <div className={styles.playTitle}>
          <small>
            STAGE {stage.no}・{stage.topic}
          </small>
          <h1>{stage.title}</h1>
        </div>
        <SoundButton on={progress.sound} onToggle={onToggleSound} />
        <button type="button" className={styles.roundBtn} onClick={() => setPhase((p) => (p === "run" ? p : "intro"))} disabled={phase === "run"} aria-label="説明を見る">
          ?
        </button>
      </header>

      <div className={styles.hud}>
        <Metric label="成功率" value={hud.success == null ? "—" : `${(hud.success * 100).toFixed(1)}%`} goal={`目標 ${Math.round(g.success * 100)}%以上`} ok={hud.success == null ? null : hud.success >= g.success} />
        <Metric label="平均の速さ" value={hud.latency == null ? "—" : `${Math.round(hud.latency)}ms`} goal={`★ ${g.latency}ms以内`} ok={hud.latency == null ? null : hud.latency <= g.latency} />
        <Metric label={running ? "月額（平均）" : "月額"} value={yen(shownCost)} goal={`★ ${yen(g.cost)}以内`} ok={shownCost <= g.cost + 0.5} />
      </div>
      <div className={styles.timebar} aria-hidden="true">
        <i style={{ width: `${progressPct}%` }} />
        {stage.setup.events.map((e, k) => (
          <b key={k} style={{ left: `${(e.t / stage.setup.duration) * 100}%` }} data-tone={e.kind === "banner" ? e.tone ?? "info" : "danger"} />
        ))}
      </div>

      <div className={styles.boardWrap}>
        <Board
          slots={stage.slots}
          placements={placements}
          fixed={fixed}
          sim={sim}
          paused={paused || phase !== "run"}
          speed={speed}
          bot={bot}
          farUsers={farUsers}
          hint={hintSlots}
          selected={sheet}
          onSlot={setSheet}
          onTick={onTick}
        />
        {banner ? (
          <div key={banner.id} className={styles.banner} data-tone={banner.tone} role="status">
            {banner.text}
          </div>
        ) : null}
        {ending ? <div className={styles.ending}>そこまで！</div> : null}
      </div>

      <div
        key={toast?.id ?? phase}
        className={styles.coach}
        role="status"
        data-tip={toast ? (toast.sticky ? "hint" : "tip") : undefined}
        onClick={toast && !toast.sticky ? nextToast : undefined}
      >
        <span className={styles.toastFace}>
          <Image src={MASCOT} alt="" width={128} height={128} />
        </span>
        <p>
          {toast
            ? toast.text
            : phase === "run"
              ? paused
                ? "一時停止中。パーツをタップすると、ようすが見られるよ"
                : "本番中！ 赤く光るパーツや、困った顔の人に注目"
              : placements.length === stage.fixed.length
                ? "マスをタップしてパーツを置こう。そのまま動かしてみるのもOK"
                : "置けたら「本番スタート」！"}
        </p>
      </div>

      {phase === "run" ? (
        <div className={styles.controls}>
          <button type="button" className={styles.iconBtn} onClick={() => setPaused((p) => !p)} aria-label={paused ? "再開" : "一時停止"}>
            {paused ? "▶" : "❚❚"}
          </button>
          <div className={styles.speed} role="radiogroup" aria-label="速さ">
            {[1, 2, 4].map((v) => (
              <button key={v} type="button" role="radio" aria-checked={speed === v} data-on={speed === v ? "1" : undefined} onClick={() => setSpeed(v)}>
                ×{v}
              </button>
            ))}
          </div>
          <span className={styles.remain}>あと{remain}秒</span>
          <button type="button" className={styles.btnGhost} onClick={backToBuild}>
            やりなおす
          </button>
        </div>
      ) : (
        <div className={styles.controls}>
          <div className={styles.budget}>
            <small>予算</small>
            <span>
              <b>{yen(cost)}</b> / {yen(stage.budget)}
            </span>
            <i style={{ width: `${Math.min(100, (cost / stage.budget) * 100)}%` }} />
          </div>
          <button type="button" className={styles.btnGhost} data-on={hint ? "1" : undefined} onClick={toggleHint}>
            ヒント
          </button>
          <button type="button" className={styles.btnPrimary} onClick={start} disabled={phase === "result"}>
            本番スタート
          </button>
        </div>
      )}

      <PartSheet
        slot={sheet}
        placements={placements}
        fixed={fixed}
        budget={stage.budget}
        sim={sim}
        isNew={sheet ? stage.newParts.includes(kindOf(sheet)) : false}
        onClose={() => setSheet(null)}
        onPlace={(slot, size) => {
          place(slot, size);
          if (!placements.some((p) => p.slot === slot)) setSheet(null);
        }}
        onRemove={remove}
      />

      {phase === "intro" ? (
        <IntroOverlay
          stage={stage}
          onDone={() => {
            setPhase(sim ? "run" : "build");
            onProgress((p) => ({ ...p, seenIntro: { ...p.seenIntro, [stage.id]: true } }));
          }}
        />
      ) : null}

      {phase === "result" && result ? (
        <ResultOverlay
          stage={stage}
          info={result}
          quizDone={Boolean(progress.quiz[stage.id])}
          hasNext={hasNext}
          onQuizCorrect={() => onProgress((p) => ({ ...p, quiz: { ...p.quiz, [stage.id]: true } }))}
          onRetry={backToBuild}
          onNext={onNext}
          onMap={onExit}
        />
      ) : null}
    </div>
  );
}

export function SoundButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={styles.roundBtn} onClick={onToggle} aria-label={on ? "音をオフにする" : "音をオンにする"} aria-pressed={on}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {on ? <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.6a7.6 7.6 0 0 1 0 10.8" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
      </svg>
    </button>
  );
}

function Metric({ label, value, goal, ok }: { label: string; value: string; goal: string; ok: boolean | null }) {
  return (
    <div className={styles.metric} data-ok={ok == null ? undefined : ok ? "1" : "0"}>
      <small>{label}</small>
      <b>{value}</b>
      <em>{goal}</em>
    </div>
  );
}
