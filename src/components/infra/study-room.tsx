"use client";

/**
 * 勉強部屋（LDAP）の画面。設定カード（ldap-lessons.ts）を、本物のターミナルで1ステップずつ進める。
 * - StudyMenu … タブの中。章ごとのカードの一覧と、進み具合（できたら ✓）
 * - StudyScreen … 全画面（?tab=study&card=…）
 *     はじめ → ステップ（やってみる → 返事 → サーバーの中のひとこと → わかったこと）
 *     → まとめ（同じコマンド、ちがう結果・くらべる表・クイズ）→ 自由に試す（設定を切りかえて、コマンドを自分で打つ）
 * 3台の図は、いま動かしたコマンドで本当に流れた線だけを光らせ、線ごとに「暗号／平文」を出す。
 * 1画面に出すのは「いまやること1つ」。くわしいもの（サーバーの中・パケット・ログ・名簿・設定）は、開いたときだけ。
 */
import Image from "next/image";
import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Glyph, type GlyphId } from "./glyphs";
import { MASCOT, Teacher } from "./intro";
import { CARDS, CHAPTERS, SEED_BASE, cardById, cardLabel, prepareLab, splitStudy, type Panel, type Phase, type PrepRun, type StudyCard } from "./ldap-lessons";
import { HOST_IP, RESULT_JA, clockText, type HostId, type TraceItem, type TreeNode } from "./ldap";
import { HOSTS, HOST_IDS, ldapConf, sssdConf, type LdapLab, type Run } from "./ldap-shell";
import { hexdump } from "./ldap-bits";
import { BottomSheet } from "./sheets";
import { sfx } from "./sound";
import styles from "./infra.module.css";

const DONE_KEY = "odekake_infra_study_v1";

function loadDone(): Set<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DONE_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function saveDone(id: string) {
  try {
    const done = loadDone();
    done.add(id);
    window.localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {
    // 覚えられなくてもよい（一覧の ✓ が出ないだけ）
  }
}

export const isStudyScreen = (id: string | null): id is string => Boolean(id && cardById(id));

/* ------------------------------------------------------------ 入口（タブの中） */

export function StudyMenu({ onOpen }: { onOpen: (id: string) => void }) {
  const [done] = useState(loadDone);
  const next = CARDS.find((c) => !done.has(c.id));
  const count = CARDS.filter((c) => done.has(c.id)).length;
  return (
    <div className={styles.room}>
      <div className={styles.roomIntro}>
        <Teacher sub="勉強部屋・LDAP" />
        <p>
          会社やお店の「名簿サーバー」、<b>LDAP</b> の勉強部屋です。1枚のカードで1つの設定を、「なかったらどう動くか」→「入れると何が変わるか」の順に、
          本物のコマンドを打ってたしかめよう。
        </p>
      </div>
      <div className={styles.studyProgress}>
        <p>
          <b>{count}</b> / {CARDS.length} 枚できた
          <small>{count === CARDS.length ? "ぜんぶできた！ 自由に試すで、組み合わせも試してみよう" : next ? `つぎは「${next.title}」` : ""}</small>
        </p>
        <span className={styles.studyProgressBar} role="progressbar" aria-valuemin={0} aria-valuemax={CARDS.length} aria-valuenow={count} aria-label="できたカード">
          <i style={{ width: `${(count / CARDS.length) * 100}%` }} />
        </span>
      </div>
      {CHAPTERS.map((ch) => (
        <section key={ch.no} className={styles.studyChapter} aria-label={ch.title}>
          <h2 className={styles.studyChapterHead}>
            <span>{ch.no ? `第${ch.no}章` : "まず"}</span>
            <b>{ch.title}</b>
            <small>{ch.sub}</small>
          </h2>
          <ol className={styles.roomLessons}>
            {CARDS.filter((c) => c.chapter === ch.no).map((c) => {
              const ok = done.has(c.id);
              const isNext = next?.id === c.id;
              return (
                <li key={c.id}>
                  <button type="button" className={styles.roomLesson} data-next={isNext ? "1" : undefined} data-done={ok ? "1" : undefined} onClick={() => onOpen(c.id)}>
                    <span className={styles.studyNo} style={{ "--c": c.color } as CSSProperties} aria-hidden="true">
                      {ok ? "✓" : <Glyph id={c.icon} size={18} />}
                    </span>
                    <span className={styles.roomLessonText}>
                      <small>
                        {cardLabel(c)}
                        {ok ? "・できた" : isNext ? "・つぎはこれ" : ""}
                      </small>
                      <b>{c.title}</b>
                      <em>{c.sub}</em>
                    </span>
                    <span className={styles.roomLessonGo} aria-hidden="true">
                      ▶
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <p className={styles.studyFoot}>
        LDAP＝Lightweight Directory Access Protocol。社員・パソコン・グループを1か所にまとめて、ログインや権限に使うしくみです。この部屋のサーバーは、すべてブラウザの中の
        しくみで動いていて、外とはつながりません。
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ 全画面（1カード） */

type Block = { id: number; kind: "cmd"; host: HostId; cmd: string; out: Run["out"]; tag?: string } | { id: number; kind: "note"; text: string };
type NewBlock = { kind: "cmd"; host: HostId; cmd: string; out: Run["out"]; tag?: string } | { kind: "note"; text: string };
type Status = "idle" | "ok" | "retry";
type View = "intro" | "play" | "done" | "free";
type Last = { run: Run; pre: Run | null };

const PHASE_LABEL: Record<Phase, string> = { learn: "ことば", off: "設定なし", apply: "設定を入れる", on: "設定あり", trap: "落とし穴" };

export function StudyScreen({ card, onExit, onNext }: { card: StudyCard; onExit: () => void; onNext: (() => void) | null }) {
  const [lab, setLab] = useState(() => card.build(SEED_BASE + card.no));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [view, setView] = useState<View>("intro");
  const [i, setI] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [last, setLast] = useState<Last | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sheet, setSheet] = useState<Panel | null>(null);
  const [wasDone] = useState(() => loadDone().has(card.id));
  const [cleared, setCleared] = useState(false);
  const nextId = useRef(1);
  /** さっき足したブロックのうち、いちばん上の id（ターミナルを、そこから見せる） */
  const firstNew = useRef(0);
  const termRef = useRef<HTMLDivElement | null>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLElement>(null);

  // 設定スイッチ：「あり」に変わった瞬間だけアニメ
  const on = card.knob ? card.knob.isOn(lab) : false;
  const [shownOn, setShownOn] = useState(on);
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    if (on === shownOn) return;
    setShownOn(on);
    if (!on) return;
    setFlip(true);
    const t = window.setTimeout(() => setFlip(false), 700);
    return () => window.clearTimeout(t);
  }, [on, shownOn]);

  useEffect(() => scrollTerm(termRef.current, firstNew.current), [blocks]);
  // ターミナルが画面に出たときだけ（ステップ・自由に試すの切りかえ）。毎回の描きなおしでは動かさない（読んでいる場所がずれないように）
  const attachTerm = useCallback((el: HTMLDivElement | null) => {
    termRef.current = el;
    scrollTerm(el, firstNew.current);
  }, []);

  const add = (list: NewBlock[], reset = false) => {
    const withIds = list.map((b) => ({ ...b, id: nextId.current++ }) as Block);
    firstNew.current = withIds[0]?.id ?? 0;
    setBlocks((cur) => (reset ? withIds : [...cur, ...withIds]));
  };
  const cmdBlock = (host: HostId, cmd: string, r: Run, tag?: string): NewBlock => ({ kind: "cmd", host, cmd, out: r.out, tag });

  /* ---------- ガイド（ステップ） ---------- */

  const step = card.steps[i]!;
  const runStep = () => {
    if (status === "ok") return;
    const list: NewBlock[] = [];
    if (step.before) {
      step.before(lab);
      if (step.beforeNote) list.push({ kind: "note", text: step.beforeNote });
    }
    let pre: Run | null = null;
    if (step.pre) {
      pre = lab.run(step.pre.host, step.pre.cmd);
      list.push(cmdBlock(step.pre.host, step.pre.cmd, pre, "先に"));
    }
    const r = lab.run(step.host, step.cmd);
    list.push(cmdBlock(step.host, step.cmd, r));
    add(list);
    setLast({ run: r, pre });
    const good = step.ok ? step.ok(r) : true;
    setStatus(good ? "ok" : "retry");
    sfx(good ? "good" : "wrong");
    bump();
    // 図・ターミナル・説明が、上から順に読めるところまで動かす
    window.requestAnimationFrame(() => deskRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  const nextStep = () => {
    if (i + 1 >= card.steps.length) {
      setView("done");
      if (!cleared) {
        saveDone(card.id);
        setCleared(true);
        sfx("clear");
      }
      return;
    }
    setI(i + 1);
    setStatus("idle");
    window.requestAnimationFrame(() => stepRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  /* ---------- 自由に試す ---------- */

  const [host, setHost] = useState<HostId>("pc");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histAt, setHistAt] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const openFree = () => {
    setView("free");
    setStatus("idle");
    add([{ kind: "note", text: `ここからは自由に試せます。${card.knob ? "上のボタンで、設定なし・ありの名簿に切りかえられます。" : ""}help で、使えるコマンドが出ます` }]);
  };

  const rebuild = (withKnob: boolean) => {
    const p = prepareLab(card, withKnob);
    setLab(p.lab);
    setLast(null);
    const list: NewBlock[] = [{ kind: "note", text: withKnob && card.knob ? `まっさらな名簿に、設定（${card.knob.title}）を入れました` : card.knob ? "まっさらな名簿（設定なし）にしました" : "まっさらな名簿にもどしました" }];
    for (const x of p.runs) list.push("note" in x ? { kind: "note", text: x.note } : cmdBlock(x.host, x.cmd, x.run, "設定"));
    add(list, true);
    sfx("place");
  };

  const runFree = () => {
    const line = input.trim();
    if (!line) return;
    setHistory((h) => [...h.filter((x) => x !== line), line].slice(-30));
    setHistAt(-1);
    setInput("");
    const r = lab.run(host, line);
    if (r.clear) {
      setBlocks([]);
      setLast(null);
      return;
    }
    add([cmdBlock(host, line, r)]);
    setLast({ run: r, pre: null });
    bump();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runFree();
    } else if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      const at = histAt < 0 ? history.length - 1 : Math.max(0, histAt - 1);
      setHistAt(at);
      setInput(history[at] ?? "");
    } else if (e.key === "ArrowDown" && histAt >= 0) {
      e.preventDefault();
      const at = histAt + 1;
      setHistAt(at >= history.length ? -1 : at);
      setInput(at >= history.length ? "" : (history[at] ?? ""));
    }
  };

  /* ---------- 画面 ---------- */

  const run = last?.run ?? null;
  const key = view === "play" ? (step.why ?? card.knob?.ref) : card.knob?.ref;
  const notes = run ? keyNotes(run, key) : [];
  const learn = status === "ok" && run ? (typeof step.learn === "function" ? step.learn(run) : step.learn) : "";
  const showDesk = view === "play" || view === "free";

  const terminal = (
    <div
      className={styles.studyTermWrap}
      ref={attachTerm}
      aria-label="ターミナル"
      aria-live="polite"
    >
      {blocks.length === 0 ? <p className={styles.termHint}>{view === "free" ? "下にコマンドを打って「実行」。help で一覧が出ます" : "「実行」を押すと、ここにコマンドと返事が出ます"}</p> : null}
      {blocks.map((b) => (
        <TermBlock key={b.id} block={b} />
      ))}
    </div>
  );

  return (
    <Screen sub={`勉強部屋・${cardLabel(card)}`} title={card.title} onExit={onExit} scrollKey={view}>
      {view === "intro" ? (
        <StudyIntro
          card={card}
          wasDone={wasDone}
          onStart={() => {
            setView("play");
            sfx("start");
          }}
          onFree={openFree}
        />
      ) : null}

      {view === "play" ? (
        <>
          {card.knob ? <Switch card={card} on={on} flip={flip} onOpenConfig={() => setSheet("config")} /> : null}
          <section className={styles.rlStep} ref={stepRef} aria-label={`ステップ ${i + 1}`}>
            <div className={styles.rlCount}>
              <span>
                ステップ {i + 1} / {card.steps.length}
              </span>
              <span className={styles.rlDots} aria-hidden="true">
                {card.steps.map((_, k) => (
                  <i key={k} data-on={k < i ? "1" : undefined} data-cur={k === i ? "1" : undefined} />
                ))}
              </span>
              <span className={styles.studyPhase} data-phase={step.phase}>
                {PHASE_LABEL[step.phase]}
              </span>
            </div>
            <div key={i} className={styles.studyStepIn}>
              <div className={styles.rlSay}>
                <span className={styles.teacherFace} aria-hidden="true">
                  <Image src={MASCOT} alt="" width={128} height={128} />
                </span>
                <p>
                  <Rich text={step.say} />
                </p>
              </div>
              {step.pre ? <CmdChip host={step.pre.host} cmd={step.pre.cmd} label="1. 先に" /> : null}
              <CmdChip host={step.host} cmd={step.cmd} label={step.pre ? "2. つぎに" : undefined} />
              {status !== "ok" ? (
                <button type="button" className={`${styles.btnPrimary} ${styles.studyRun}`} onClick={runStep}>
                  {status === "retry" ? "もう一度 実行" : step.pre ? "2つ続けて実行" : "実行"}
                </button>
              ) : null}
            </div>

            <div ref={deskRef} className={styles.studyStage}>
              <Diagram runs={[last?.pre ?? null, run]} at={step.host} />
              {terminal}
            </div>

            {status === "ok" ? (
              <div className={styles.rlResult} key={`r${i}`}>
                {notes.length ? <WhyBox notes={notes} onMore={() => setSheet("trace")} /> : null}
                <p className={styles.rlLearn}>
                  <Rich text={learn} />
                </p>
                {step.show?.length ? (
                  <div className={styles.studyPeek}>
                    {step.show.map((p) => (
                      <button key={p} type="button" onClick={() => setSheet(p)}>
                        {PANEL_LABEL[p]} を見る
                      </button>
                    ))}
                  </div>
                ) : null}
                <button type="button" className={`${styles.btnPrimary} ${styles.rlNext}`} onClick={nextStep}>
                  {i + 1 >= card.steps.length ? "まとめへ" : "つぎへ"}
                </button>
              </div>
            ) : status === "retry" ? (
              <p className={styles.rlRetry}>{step.retry ?? "思ったのとちがう結果でした。もう一度ためしてみよう。"}</p>
            ) : null}
          </section>
        </>
      ) : null}

      {view === "free" ? (
        <>
          {card.knob ? (
            <FreeSwitch card={card} on={on} onPick={rebuild} />
          ) : (
            <div className={styles.studyFreeBar}>
              <button type="button" onClick={() => rebuild(false)}>
                まっさらな名簿にもどす
              </button>
            </div>
          )}
          <section className={styles.studyDesk} aria-label="自由に試す">
            <Diagram runs={[run]} at={host} />
            {terminal}
            <div className={styles.studyHosts} role="radiogroup" aria-label="コマンドを打つコンピューター">
              {HOST_IDS.map((h) => (
                <button key={h} type="button" role="radio" aria-checked={host === h} data-on={host === h ? "1" : undefined} style={{ "--c": hostColor(h) } as CSSProperties} onClick={() => setHost(h)}>
                  <Glyph id={hostGlyph(h)} size={13} />
                  {HOSTS[h].label}
                </button>
              ))}
            </div>
            <div className={styles.studyInput}>
              <span className={styles.termPrompt}>{HOSTS[host].prompt}</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="コマンド（help で一覧）"
                aria-label="コマンド"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
              />
              <button type="button" className={styles.btnPrimary} onClick={runFree} disabled={!input.trim()}>
                実行
              </button>
            </div>
            {notes.length ? <WhyBox notes={notes} onMore={() => setSheet("trace")} /> : null}
            <p className={styles.studyTriesHead}>ためしてみよう（押すと、上に入ります）</p>
            <div className={styles.studyTries}>
              {card.tries.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setHost(t.host);
                    setInput(t.cmd);
                    // スマホでは、キーボードが出て画面がかくれないように、入れるだけにする
                    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
                  }}
                >
                  <small style={{ "--c": hostColor(t.host) } as CSSProperties}>{t.host === "pc" ? "パソコン" : t.host === "ldap" ? "LDAP" : "お店"}</small>
                  {t.label}
                </button>
              ))}
            </div>
            <div className={styles.rlClearBtns}>
              <button type="button" className={styles.btnGhost} onClick={() => setView(cleared || wasDone ? "done" : "intro")}>
                {cleared || wasDone ? "まとめにもどる" : "カードのはじめにもどる"}
              </button>
            </div>
          </section>
        </>
      ) : null}

      {view === "done" ? <StudyDone card={card} onExit={onExit} onNext={onNext} onFree={openFree} /> : null}

      {showDesk ? (
        <div className={`${styles.rlLinks} ${styles.studyLinks}`}>
          {(["trace", "packets", "logs", "tree", "config"] as Panel[]).map((p) => (
            <button key={p} type="button" onClick={() => setSheet(p)}>
              {PANEL_LABEL[p]}
            </button>
          ))}
        </div>
      ) : null}

      <BottomSheet open={sheet != null} onClose={() => setSheet(null)} label={sheet ? PANEL_LABEL[sheet] : ""}>
        {sheet ? <PanelView panel={sheet} lab={lab} last={last} card={card} keyRef={key} /> : null}
      </BottomSheet>
    </Screen>
  );
}

/* ------------------------------------------------------------ 画面のへや */

function Screen({ sub, title, onExit, scrollKey, children }: { sub: string; title: string; onExit: () => void; scrollKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // 画面（はじめ・ステップ・まとめ・自由に試す）が変わったら、いちばん上から
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [scrollKey]);
  return (
    <div className={styles.home} ref={ref}>
      <header className={styles.homeHeader}>
        <button type="button" className={styles.roundBtn} onClick={onExit} aria-label="勉強部屋の一覧へ">
          ‹
        </button>
        <div className={styles.rmHeadText}>
          <small>{sub}</small>
          <h1>{title}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}

function CardHead({ card }: { card: StudyCard }) {
  return (
    <div className={styles.studyHead} style={{ "--c": card.color } as CSSProperties}>
      <span className={styles.studyHeadIcon}>
        <Glyph id={card.icon} size={30} />
      </span>
      <div>
        <small>{card.no ? `${cardLabel(card)}・第${card.chapter}章 ${CHAPTERS.find((c) => c.no === card.chapter)?.title ?? ""}` : "はじめに・まず ことばから"}</small>
        <h2>{card.title}</h2>
        <em>{card.sub}</em>
      </div>
    </div>
  );
}

function StudyIntro({ card, wasDone, onStart, onFree }: { card: StudyCard; wasDone: boolean; onStart: () => void; onFree: () => void }) {
  const traps = card.steps.filter((s) => s.phase === "trap").length;
  return (
    <section className={styles.rlStep} aria-label="このカードについて">
      <CardHead card={card} />
      <div className={styles.rlSay}>
        <span className={styles.teacherFace} aria-hidden="true">
          <Image src={MASCOT} alt="" width={128} height={128} />
        </span>
        <p>
          <Rich text={card.intro} />
        </p>
      </div>
      {card.analogy ? (
        <p className={styles.analogy}>
          <span>たとえると</span>
          {card.analogy}
        </p>
      ) : null}
      {card.knob ? (
        <div className={styles.studyKnobMap}>
          <b>このカードの設定</b>
          <p>{card.knob.title}</p>
          <small>ばしょ：{card.knob.where}</small>
          <ol className={styles.studyFlow}>
            <li data-phase="off">設定なしで、本物のコマンド</li>
            <li data-phase="apply">設定を入れる</li>
            <li data-phase="on">同じことを、もう一度</li>
            {traps ? <li data-phase="trap">落とし穴（{traps}つ）</li> : null}
          </ol>
        </div>
      ) : (
        <div className={styles.studyKnobMap}>
          <b>出てくるコンピューター</b>
          <ul className={styles.studyCast}>
            {HOST_IDS.map((h) => (
              <li key={h} style={{ "--c": hostColor(h) } as CSSProperties}>
                <span>
                  <Glyph id={hostGlyph(h)} size={14} />
                </span>
                <b>{HOSTS[h].label}</b>
                <small>{HOST_ROLE[h]}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" className={`${styles.btnPrimary} ${styles.rlNext}`} onClick={onStart}>
        はじめる（{card.steps.length}ステップ）
      </button>
      {wasDone ? (
        <button type="button" className={`${styles.btnGhost} ${styles.studyAlt}`} onClick={onFree}>
          自由に試す
        </button>
      ) : null}
    </section>
  );
}

const HOST_ROLE: Record<HostId, string> = {
  pc: "あなたがコマンドを打つ",
  ldap: "名簿をしまっている（slapd）",
  shop: "名簿を見て、ログインさせる（SSSD）",
};

function StudyDone({ card, onExit, onNext, onFree }: { card: StudyCard; onExit: () => void; onNext: (() => void) | null; onFree: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked === card.quiz.answer;
  return (
    <section className={styles.rlStep} aria-label="まとめ">
      <div className={styles.rlClear}>
        <span aria-hidden="true">🎉</span>
        <b>{card.no ? `設定 ${card.no} かんりょう！` : "はじめに かんりょう！"}</b>
        <small>{card.title}</small>
      </div>

      {card.probe ? <Probe card={card} /> : null}

      {card.compare?.length ? (
        <>
          <p className={styles.studyCompareHead}>なし と あり、くらべてみよう</p>
          <table className={styles.studyCompare}>
            <thead>
              <tr>
                <th></th>
                <th>設定なし</th>
                <th>設定あり</th>
              </tr>
            </thead>
            <tbody>
              {card.compare.map((row) => (
                <tr key={row.head}>
                  <th>{row.head}</th>
                  <td data-tone="off">{row.off}</td>
                  <td data-tone="on">{row.on}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {card.words?.length ? (
        <>
          <p className={styles.studyCompareHead}>このカードのことば</p>
          <dl className={styles.studyWords}>
            {card.words.map((w) => (
              <div key={w.term}>
                <dt>{w.term}</dt>
                <dd>{w.mean}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}

      <p className={styles.rlSumHead}>わかったこと</p>
      <ul className={styles.rlSummary}>
        {card.summary.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <div className={styles.studyQuiz}>
        <p className={styles.studyQuizQ}>クイズ：{card.quiz.q}</p>
        <div className={styles.studyQuizChoices}>
          {card.quiz.choices.map((c, k) => (
            <button
              key={k}
              type="button"
              data-state={picked == null ? undefined : k === card.quiz.answer ? "right" : k === picked ? "wrong" : undefined}
              disabled={picked != null}
              onClick={() => {
                setPicked(k);
                sfx(k === card.quiz.answer ? "correct" : "wrong");
              }}
            >
              {c}
            </button>
          ))}
        </div>
        {picked != null ? (
          <p className={styles.studyQuizA} data-ok={correct ? "1" : undefined}>
            {correct ? "正解！ " : "おしい！ "}
            {card.quiz.explain}
          </p>
        ) : null}
      </div>

      <div className={styles.rlClearBtns}>
        {onNext ? (
          <button type="button" className={styles.btnPrimary} onClick={onNext}>
            つぎのカードへ
          </button>
        ) : null}
        <button type="button" className={onNext ? styles.btnGhost : styles.btnPrimary} onClick={onFree}>
          自由に試す（コマンドを自分で打つ）
        </button>
        <button type="button" className={styles.btnGhost} onClick={onExit}>
          一覧へもどる
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ 見くらべる（同じコマンド、ちがう結果） */

type ProbeResult = { off: Run; on: Run; prep: PrepRun[] };

function Probe({ card }: { card: StudyCard }) {
  const probe = card.probe!;
  const [res, setRes] = useState<ProbeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const go = () => {
    setBusy(true);
    // 名簿を2つ作る（2000人の名簿のカードもある）。ボタンの見た目を先に変えてから動かす
    window.setTimeout(() => {
      const a = prepareLab(card, false);
      const b = prepareLab(card, true);
      setRes({ off: a.lab.run(probe.host, probe.cmd), on: b.lab.run(probe.host, probe.cmd), prep: b.runs });
      setBusy(false);
      sfx("good");
    }, 40);
  };
  return (
    <div className={styles.studyProbe}>
      <p className={styles.studyCompareHead}>同じコマンド、ちがう結果</p>
      <p className={styles.studyProbeLead}>まっさらな名簿を2つ用意して、片方にだけ設定を入れます。同じコマンドを、両方で本当に動かしてみよう。</p>
      <CmdChip host={probe.host} cmd={probe.cmd} />
      {res ? (
        <>
          <div className={styles.studyProbeGrid}>
            <ProbeSide title="設定なし" tone="off" run={res.off} card={card} />
            <ProbeSide title="設定あり" tone="on" run={res.on} card={card} />
          </div>
          {probe.note ? (
            <p className={styles.studyProbeNote}>
              <Rich text={probe.note} />
            </p>
          ) : null}
          {res.prep.length ? (
            <details className={styles.studyProbePrep}>
              <summary>「設定あり」の名簿に入れたもの（{res.prep.length}つ）</summary>
              <ul>
                {res.prep.map((p, k) =>
                  "note" in p ? (
                    <li key={k} data-note="1">
                      ⚙ {p.note}
                    </li>
                  ) : (
                    <li key={k}>
                      <span className={styles.termPrompt}>{HOSTS[p.host].prompt}</span> {p.cmd}
                    </li>
                  ),
                )}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <button type="button" className={`${styles.btnPrimary} ${styles.studyRun}`} onClick={go} disabled={busy}>
          {busy ? "名簿を用意しています…" : "2つの名簿で動かす"}
        </button>
      )}
    </div>
  );
}

function ProbeSide({ title, tone, run, card }: { title: string; tone: "off" | "on"; run: Run; card: StudyCard }) {
  const o = outcome(run);
  const note = keyNotes(run, card.knob?.ref).at(-1);
  const leak = run.packets.find((p) => p.secretText);
  const lines = run.out.filter((l) => l.text.trim() !== "");
  return (
    <div className={styles.studyProbeSide} data-tone={tone}>
      <div className={styles.studyProbeTop}>
        <b>{title}</b>
        <span className={styles.studyOutcome} data-ok={o.ok ? "1" : undefined}>
          {o.text}
        </span>
      </div>
      {card.probe?.label ? <p className={styles.studyProbeLabel}>{card.probe.label(run)}</p> : null}
      <div className={styles.studyProbeOut}>
        {lines.slice(0, 12).map((l, k) => (
          <TermLine key={k} line={l} />
        ))}
        {lines.length > 12 ? (
          <p className={styles.termLine} data-mark="dim">
            …（ほか {lines.length - 12}行）
          </p>
        ) : null}
        {lines.length === 0 ? (
          <p className={styles.termLine} data-mark="dim">
            （何も出ない）
          </p>
        ) : null}
      </div>
      {leak ? <p className={styles.studyProbeLeak}>パケットの中に、パスワード「{leak.secretText}」がそのまま入っていた</p> : null}
      {note ? (
        <p className={styles.studyProbeWhy} data-tone={note.tone}>
          <small>サーバーの中</small>
          <Rich text={note.text} />
        </p>
      ) : null}
    </div>
  );
}

/** 結果のひとこと（成功・49 ログインできない など） */
function outcome(r: Run): { ok: boolean; text: string } {
  const ssh = r.ops.find((o) => o.kind === "ssh");
  if (ssh) return ssh.code === 0 ? { ok: true, text: "ログインできた" } : { ok: false, text: ssh.stage === "access" ? "入れない（ログインの条件）" : "ログインできない" };
  if (r.exit === 0) return { ok: true, text: "成功（0）" };
  const ja = RESULT_JA[r.exit];
  return { ok: false, text: ja ? `${r.exit}（${ja}）` : `終了コード ${r.exit}` };
}

/* ------------------------------------------------------------ サーバーの中のひとこと */

/**
 * サーバーの中で起きたことのうち、いま見てほしい行（1〜2行）。
 * key（ステップの why か、カードの設定）の行 → 同じなかまの行 → だめ・注意の行 → うまくいった行 の順にさがす。
 */
function keyNotes(run: Run, key?: string): TraceItem[] {
  const tr = run.trace;
  if (!tr.length) return [];
  const two = (xs: TraceItem[]) => (xs.length > 2 ? [xs[0]!, xs[xs.length - 1]!] : xs);
  if (key) {
    const exact = tr.filter((t) => t.ref && (t.ref === key || t.ref.startsWith(`${key}:`)));
    if (exact.length) return two(exact);
    const family = key.split(":")[0]!;
    const near = tr.filter((t) => t.ref && t.ref.split(":")[0] === family);
    if (near.length) return two(near);
  }
  const bad = tr.filter((t) => t.tone === "ng" || t.tone === "warn");
  if (bad.length) return [bad[0]!];
  const good = tr.filter((t) => t.tone === "ok" && !t.ref);
  if (good.length) return [good[good.length - 1]!];
  return [tr[tr.length - 1]!];
}

function WhyBox({ notes, onMore }: { notes: TraceItem[]; onMore: () => void }) {
  return (
    <div className={styles.studyWhy}>
      <div className={styles.studyWhyHead}>
        <small>サーバーの中では</small>
        <button type="button" onClick={onMore}>
          くわしく
        </button>
      </div>
      {notes.map((t, k) => (
        <p key={k} data-tone={t.tone}>
          <Rich text={t.text} />
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ 設定スイッチ */

function Switch({ card, on, flip, onOpenConfig }: { card: StudyCard; on: boolean; flip: boolean; onOpenConfig: () => void }) {
  const knob = card.knob!;
  return (
    <button
      type="button"
      className={styles.studySwitch}
      data-on={on ? "1" : undefined}
      data-flip={flip ? "1" : undefined}
      onClick={onOpenConfig}
      style={{ "--c": card.color } as CSSProperties}
      aria-label={`${knob.title}：いまは ${on ? knob.on : knob.off}（押すと設定を見る）`}
    >
      <span className={styles.studySwitchText}>
        <small>{knob.title}</small>
        <b>{on ? knob.on : knob.off}</b>
      </span>
      <span className={styles.studySwitchTrack} aria-hidden="true">
        <i>なし</i>
        <i>あり</i>
        <span className={styles.studySwitchKnob} />
      </span>
    </button>
  );
}

/** 自由に試す：名簿を、まっさらの設定なし・ありに切りかえる */
function FreeSwitch({ card, on, onPick }: { card: StudyCard; on: boolean; onPick: (on: boolean) => void }) {
  const knob = card.knob!;
  return (
    <div className={styles.studyFreeSwitch} style={{ "--c": card.color } as CSSProperties}>
      <p>
        <small>{knob.title}</small>
        <b>いま：{on ? knob.on : knob.off}</b>
      </p>
      <div role="group" aria-label="名簿をまっさらにして、設定を切りかえる">
        <button type="button" data-on={!on ? "1" : undefined} onClick={() => onPick(false)}>
          設定なしで やりなおす
        </button>
        <button type="button" data-on={on ? "1" : undefined} onClick={() => onPick(true)}>
          設定ありで やりなおす
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 3台の図 */

type WireState = "tls" | "starttls" | "plain";
type Wire = { lit: boolean; state: WireState | null; leak: boolean };

/** そのコマンド（先に動かしたものもふくむ）で、どの線に、どんなつながりが流れたか（ops の順に見る） */
function wires(runs: (Run | null)[]): { pcLdap: Wire; shopLdap: Wire; pcShop: Wire; local: boolean } {
  const blank = (): Wire => ({ lit: false, state: null, leak: false });
  const w = { pcLdap: blank(), shopLdap: blank(), pcShop: blank(), local: false };
  const list = runs.filter((r): r is Run => r != null);
  const conns: { wire: Wire; state: WireState }[] = [];
  for (const o of list.flatMap((r) => r.ops)) {
    if (o.kind === "connect") {
      if (o.host === "ldap") {
        w.local = true;
        continue;
      }
      const wire = o.host === "shop" ? w.shopLdap : w.pcLdap;
      wire.lit = true;
      conns.push({ wire, state: o.tls ? "tls" : "plain" });
    } else if (o.kind === "starttls" && o.code === 0) {
      const c = conns[conns.length - 1];
      if (c && c.state === "plain") c.state = "starttls";
    } else if (o.kind === "ssh") w.pcShop.lit = true;
    else if (o.kind === "sssd") {
      w.shopLdap.lit = true;
      if (o.code === 0) conns.push({ wire: w.shopLdap, state: o.tls ? "tls" : "plain" });
    }
  }
  const rank: Record<WireState, number> = { tls: 0, starttls: 1, plain: 2 };
  for (const c of conns) if (c.wire.state == null || rank[c.state] > rank[c.wire.state]) c.wire.state = c.state;
  for (const p of list.flatMap((r) => r.packets)) {
    if (!p.secretText) continue;
    if (p.from.startsWith(`${HOST_IP.shop}:`)) w.shopLdap.leak = true;
    else w.pcLdap.leak = true;
  }
  if (w.pcShop.lit) w.pcShop.state = "tls";
  return w;
}

/** 図の中の場所（%）。上に LDAP サーバー、左下にあなたのパソコン、右下にお店のサーバー */
const SPOT: Record<HostId, { x: number; y: number }> = { ldap: { x: 50, y: 20 }, pc: { x: 16, y: 72 }, shop: { x: 84, y: 72 } };
/** a から b へ、t（0〜1）だけ進んだところ（線の名札を置く。LDAP サーバーの名前にかぶらないよう、少し下に） */
const along = (a: HostId, b: HostId, t: number) => ({ x: SPOT[a].x + (SPOT[b].x - SPOT[a].x) * t, y: SPOT[a].y + (SPOT[b].y - SPOT[a].y) * t });

function Diagram({ runs, at }: { runs: (Run | null)[]; at: HostId | null }) {
  const w = wires(runs);
  const lines: { a: HostId; b: HostId; wire: Wire }[] = [
    { a: "pc", b: "ldap", wire: w.pcLdap },
    { a: "ldap", b: "shop", wire: w.shopLdap },
    { a: "pc", b: "shop", wire: w.pcShop },
  ];
  const said = [
    w.pcLdap.lit ? `パソコンと LDAP サーバー：${stateJa(w.pcLdap)}` : "",
    w.shopLdap.lit ? `お店のサーバーと LDAP サーバー：${stateJa(w.shopLdap)}` : "",
    w.pcShop.lit ? "パソコンとお店のサーバー：SSH（暗号）" : "",
    w.local ? "LDAP サーバーの中から（ldapi）" : "",
  ].filter(Boolean);
  return (
    <div className={styles.studyNet} role="img" aria-label={`3台の図。${said.length ? `いまのコマンドで流れた線：${said.join("、")}` : "まだ何も流れていません"}`}>
      <svg className={styles.studyNetSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {lines.map((l) => (
          <line
            key={`${l.a}${l.b}`}
            x1={SPOT[l.a].x}
            y1={SPOT[l.a].y}
            x2={SPOT[l.b].x}
            y2={SPOT[l.b].y}
            vectorEffect="non-scaling-stroke"
            data-lit={l.wire.lit ? "1" : undefined}
            data-state={l.wire.leak ? "leak" : (l.wire.state ?? undefined)}
          />
        ))}
      </svg>
      <WireTag spot={along("ldap", "pc", 0.6)} wire={w.pcLdap} name="LDAP" />
      <WireTag spot={along("ldap", "shop", 0.6)} wire={w.shopLdap} name="SSSD" />
      <WireTag spot={along("pc", "shop", 0.5)} wire={w.pcShop} name="SSH" />
      {HOST_IDS.map((h) => (
        <span
          key={h}
          className={styles.studyNode}
          data-on={at === h ? "1" : undefined}
          style={{ "--c": hostColor(h), left: `${SPOT[h].x}%`, top: `${SPOT[h].y}%` } as CSSProperties}
        >
          <span className={styles.studyNodeIcon}>
            <Glyph id={hostGlyph(h)} size={18} />
          </span>
          <small>{HOSTS[h].label}</small>
          {h === "ldap" && w.local ? <em className={styles.studyLocal}>中から（ldapi）</em> : null}
        </span>
      ))}
    </div>
  );
}

const stateJa = (w: Wire) => (w.leak ? "平文（パスワードが見えた）" : w.state === "tls" ? "暗号（TLS）" : w.state === "starttls" ? "途中から暗号（StartTLS）" : w.state === "plain" ? "平文" : "つながらなかった");

function WireTag({ spot, wire, name }: { spot: { x: number; y: number }; wire: Wire; name: string }) {
  const text = !wire.lit ? name : wire.leak ? `${name}・平文！` : wire.state === "plain" ? `${name}・平文` : wire.state === "starttls" ? `${name}・StartTLS` : wire.state ? `${name}・暗号` : name;
  const locked = wire.lit && (wire.state === "tls" || wire.state === "starttls");
  return (
    <span className={styles.studyWireTag} data-lit={wire.lit ? "1" : undefined} data-state={wire.leak ? "leak" : (wire.state ?? undefined)} style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
      {wire.lit && wire.state ? <Lock open={!locked} /> : null}
      {text}
    </span>
  );
}

function Lock({ open }: { open: boolean }) {
  return (
    <svg width="10" height="11" viewBox="0 0 10 11" aria-hidden="true">
      <rect x="1" y="4.6" width="8" height="5.8" rx="1.4" fill="currentColor" />
      <path d={open ? "M3 4.6V3.2a2 2 0 0 1 3.9-.6" : "M3 4.6V3.2a2 2 0 0 1 4 0v1.4"} fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

const hostGlyph = (id: HostId): GlyphId => (id === "pc" ? "user" : id === "ldap" ? "db" : "app");
const hostColor = (id: HostId) => (id === "pc" ? "#9fb4ff" : id === "ldap" ? "#b08cff" : "#5fd8ff");

/* ------------------------------------------------------------ ターミナル */

function CmdChip({ host, cmd, label }: { host: HostId; cmd: string; label?: string }) {
  return (
    <div className={styles.studyCmd}>
      <span className={styles.studyCmdHost} style={{ "--c": hostColor(host) } as CSSProperties}>
        <Glyph id={hostGlyph(host)} size={13} />
        {label ? `${label}：` : ""}
        {HOSTS[host].label}
      </span>
      <code>{cmd}</code>
    </div>
  );
}

/** ターミナルを、さっき足したブロックの頭から見せる（返事が長くても、コマンドの行から読める） */
function scrollTerm(el: HTMLDivElement | null, firstId: number) {
  if (!el) return;
  const first = el.querySelector<HTMLElement>(`[data-block="${firstId}"]`);
  el.scrollTop = first ? Math.max(0, first.offsetTop - 8) : el.scrollHeight;
}

function TermBlock({ block }: { block: Block }) {
  if (block.kind === "note")
    return (
      <p className={styles.termNote} data-block={block.id}>
        ⚙ {block.text}
      </p>
    );
  return (
    <div className={styles.termBlock} data-block={block.id}>
      <p className={styles.termCmd}>
        {block.tag ? <span className={styles.termTag}>{block.tag}</span> : null}
        <span className={styles.termPrompt}>{HOSTS[block.host].prompt}</span> {block.cmd}
      </p>
      {block.out.map((l, k) => (
        <TermLine key={k} line={l} />
      ))}
    </div>
  );
}

function TermLine({ line }: { line: Run["out"][number] }) {
  return (
    <p className={styles.termLine} data-err={line.err ? "1" : undefined} data-mark={line.mark}>
      <span>{line.text || "\u00a0"}</span>
      {line.hint ? <em className={styles.termHintInline}>{line.hint}</em> : null}
    </p>
  );
}

/** 文の中の **ことば** を目立たせる */
const Rich = ({ text }: { text: string }) => (
  <>
    {splitStudy(text).map((t, k) =>
      k % 2 ? (
        <b key={k} className={styles.term}>
          {t}
        </b>
      ) : (
        t
      ),
    )}
  </>
);

/* ------------------------------------------------------------ パネル */

const PANEL_LABEL: Record<Panel, string> = { trace: "サーバーの中", packets: "パケット", logs: "ログ", tree: "名簿", config: "設定" };

function PanelView({ panel, lab, last, card, keyRef }: { panel: Panel; lab: LdapLab; last: Last | null; card: StudyCard; keyRef?: string }) {
  if (panel === "trace") return <TracePanel last={last} keyRef={keyRef} />;
  if (panel === "packets") return <PacketPanel run={last?.run ?? null} />;
  if (panel === "logs") return <LogPanel lab={lab} run={last?.run ?? null} />;
  if (panel === "tree") return <TreePanel lab={lab} />;
  return <ConfigPanel lab={lab} card={card} last={last} />;
}

function TracePanel({ last, keyRef }: { last: Last | null; keyRef?: string }) {
  if (!last || (!last.run.trace.length && !last.pre?.trace.length))
    return (
      <div>
        <h2 className={styles.sheetTitle}>サーバーの中で起きたこと</h2>
        <p className={styles.roomNote}>{last ? "このコマンドでは、サーバーの中で特別なことは起きていません" : "まだコマンドを実行していません"}</p>
      </div>
    );
  const hit = new Set(keyNotes(last.run, keyRef));
  return (
    <div>
      <h2 className={styles.sheetTitle}>サーバーの中で起きたこと</h2>
      <p className={styles.exportLead}>
        さっきのコマンドで、サーバーが「なぜその返事をしたか」を順に並べています。<b className={styles.studyMark}>黄色の行</b>が、いちばん大事なところ。
      </p>
      {last.pre ? (
        <details className={styles.studyTracePre}>
          <summary>先に動かしたコマンド：{last.pre.line}</summary>
          <TraceList items={last.pre.trace} hit={new Set()} />
        </details>
      ) : null}
      <p className={styles.studyTraceCmd}>
        <span className={styles.termPrompt}>{HOSTS[last.run.host].prompt}</span> {last.run.line}
      </p>
      <TraceList items={last.run.trace} hit={hit} />
    </div>
  );
}

function TraceList({ items, hit }: { items: TraceItem[]; hit: Set<TraceItem> }) {
  return (
    <ol className={styles.studyTrace}>
      {items.map((t, k) => (
        <li key={k} data-tone={t.tone} data-hit={hit.has(t) ? "1" : undefined}>
          <Rich text={t.text} />
        </li>
      ))}
    </ol>
  );
}

function PacketPanel({ run }: { run: Run | null }) {
  const packets = run?.packets ?? [];
  const leaked = packets.find((p) => p.secretText);
  const [open, setOpen] = useState<number | null>(leaked?.no ?? null);
  const plain = packets.filter((p) => p.proto === "LDAP").length;
  return (
    <div>
      <h2 className={styles.sheetTitle}>ネットワークを流れたパケット</h2>
      <p className={styles.exportLead}>
        コンピューターどうしのあいだを、実際に流れたバイトです。<b className={styles.studyKey}>赤いところ</b>は、あなたのパスワード。
        <b>TLS（暗号）</b>のときは中身が読めません。LDAP サーバーの中から（ldapi）や、お店のサーバーの中の SSSD の話は、ここには出ません。
      </p>
      {packets.length ? (
        <>
          <p className={styles.studyPktSum} data-bad={leaked ? "1" : undefined}>
            {packets.length}こ（平文 {plain}・暗号 {packets.length - plain}）
            {leaked ? ` — No.${leaked.no} に、パスワード「${leaked.secretText}」がそのまま入っていた` : plain ? "" : " — 中身は読めません"}
          </p>
          <ul className={styles.studyPkts}>
            {packets.map((p) => (
              <li key={p.no} data-secret={p.secretText ? "1" : undefined}>
                <button type="button" onClick={() => setOpen(open === p.no ? null : p.no)} aria-expanded={open === p.no}>
                  <span className={styles.studyPktNo}>{p.no}</span>
                  <span className={styles.studyPktDir}>
                    {shortIp(p.from)} <i>→</i> {shortIp(p.to)}
                  </span>
                  <span className={styles.studyPktProto} data-proto={p.proto}>
                    {p.proto}
                  </span>
                  <span className={styles.studyPktInfo}>{p.info}</span>
                </button>
                {open === p.no ? (
                  <div className={styles.studyDump}>
                    {p.secretText && p.secret ? <p className={styles.studyDumpWarn}>このパケットの中に、パスワード「{p.secretText}」がそのまま入っています</p> : null}
                    {p.proto === "TLS" ? (
                      <p className={styles.studyDumpWarn} data-ok="1">
                        暗号化されているので、中身（パスワードなど）は読めません
                      </p>
                    ) : null}
                    <pre>
                      {hexdump(p.bytes, p.secret).map((row, k) => (
                        <div key={k}>
                          <i>{row.offset}</i>
                          <span>
                            {row.cells.map((c, j) => (
                              <b key={j} data-secret={c.secret ? "1" : undefined}>
                                {c.hex}{" "}
                              </b>
                            ))}
                          </span>
                          <span className={styles.studyDumpAscii}>
                            {row.cells.map((c, j) => (
                              <b key={j} data-secret={c.secret ? "1" : undefined}>
                                {c.ch}
                              </b>
                            ))}
                          </span>
                        </div>
                      ))}
                    </pre>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.roomNote}>{run ? "このコマンドでは、ネットワークにパケットは流れていません" : "まだパケットは流れていません"}</p>
      )}
    </div>
  );
}

const shortIp = (s: string) => s.replace(/^IP=/, "").replace("192.168.10.", ".");

function LogPanel({ lab, run }: { lab: LdapLab; run: Run | null }) {
  const logs = lab.server.logs.slice(-60);
  const fresh = new Set(run?.logs ?? []);
  return (
    <div>
      <h2 className={styles.sheetTitle}>サーバーのログ</h2>
      <p className={styles.exportLead}>
        LDAP サーバー（slapd）・お店のサーバー（sshd・SSSD）が書いたログです。本物と同じ形。<b className={styles.studyMark}>光っている行</b>が、さっきのコマンドのぶん。
      </p>
      <ul className={styles.studyLog}>
        {logs.length ? (
          logs
            .slice()
            .reverse()
            .map((l, k) => (
              <li key={k} data-src={l.src} data-new={fresh.has(l) ? "1" : undefined}>
                <time>{clockText(l.at)}</time>
                <b>{l.src}</b>
                <span>{l.text}</span>
              </li>
            ))
        ) : (
          <li className={styles.roomNote}>まだログはありません</li>
        )}
      </ul>
    </div>
  );
}

function TreePanel({ lab }: { lab: LdapLab }) {
  // パネルを開くたびに作りなおす（名簿はコマンドで変わる）
  const nodes = lab.server.tree();
  return (
    <div>
      <h2 className={styles.sheetTitle}>いまの名簿</h2>
      <p className={styles.exportLead}>LDAP サーバーの名簿（ディレクトリ）です。親子の形で、上から下へつながっています。DN は、下から上へ読んだ住所です。</p>
      <ul className={styles.studyTree}>
        {nodes.map((n) => (
          <li key={n.ndn} style={{ marginLeft: `${n.depth * 14}px` }}>
            <TreeRow n={n} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TreeRow({ n }: { n: TreeNode }) {
  const icon: GlyphId = n.kind === "person" ? "user" : n.kind === "group" ? "worker" : n.kind === "root" ? "db" : n.kind === "policy" ? "monitor" : "lb";
  const color = n.kind === "person" ? "#9fb4ff" : n.kind === "group" ? "#ffa45c" : n.kind === "policy" ? "#60a5fa" : "#b08cff";
  return (
    <div className={styles.studyTreeRow} style={{ "--c": color } as CSSProperties} data-bulk={n.kind === "bulk" ? "1" : undefined}>
      {n.kind === "bulk" ? (
        <span className={styles.studyTreeBulk}>… ほか {n.rdn}</span>
      ) : (
        <>
          <span className={styles.studyTreeIcon}>
            <Glyph id={icon} size={14} />
          </span>
          <b>{n.rdn}</b>
          {n.label ? <small>{n.label}</small> : null}
          {n.locked ? (
            <span className={styles.studyTag} data-tone="ng">
              ロック中
            </span>
          ) : n.fails ? (
            <span className={styles.studyTag} data-tone="ng">
              まちがい {n.fails}回
            </span>
          ) : null}
          {n.kind === "person" && n.memberOf?.length ? (
            <span className={styles.studyTag} data-tone="on">
              memberOf: {n.memberOf.join("・")}
            </span>
          ) : null}
          {n.kind === "person" && n.uidNumber ? <span className={styles.studyTag}>uidNumber {n.uidNumber}</span> : null}
          {n.kind === "group" && n.members ? <span className={styles.studyTag}>member {n.members.length}人</span> : null}
        </>
      )}
    </div>
  );
}

/* ---------- 設定（cn=config・ldap.conf・sssd.conf） ---------- */

const OVERLAYS = new Set(["ppolicy", "memberof", "refint", "unique"]);

/** このカードの設定が、エントリまるごとか（スキーマ・overlay） */
function entryHit(ref: string, dn: string): boolean {
  const d = dn.toLowerCase();
  if (ref === "schema:nis") return d.includes("}nis,cn=schema");
  return OVERLAYS.has(ref) && /^olcoverlay=\{\d+\}/.test(d) && d.includes(`}${ref},`);
}

/** このカードの設定の行か（光らせる） */
function lineHit(ref: string, dn: string, name: string, value: string): boolean {
  const n = name.toLowerCase();
  const mdb = dn.toLowerCase().startsWith("olcdatabase={1}mdb");
  switch (ref) {
    case "rootpw":
      return mdb && n === "olcrootpw";
    case "anon:disallow":
      return n === "olcdisallows";
    case "acl":
      return mdb && n === "olcaccess";
    case "tls:security":
      return n === "olcsecurity";
    case "index:mail":
      return mdb && n === "olcdbindex" && value.toLowerCase().startsWith("mail ");
    default:
      return OVERLAYS.has(ref) && n === "olcmoduleload" && value.toLowerCase().endsWith(`}${ref}`);
  }
}

function ConfigPanel({ lab, card, last }: { lab: LdapLab; card: StudyCard; last: Last | null }) {
  const ref = card.knob?.ref ?? "";
  const entries = lab.server.configEntries();
  // さっきのコマンドで当たった olcAccess の行（{0}・{1} …）
  const used = new Set<number>();
  for (const t of [...(last?.run.trace ?? []), ...(last?.pre?.trace ?? [])]) {
    const m = /^acl:(\d+)/.exec(t.ref ?? "");
    if (m) used.add(Number(m[1]));
  }
  const marked = entries.map((e) => {
    const whole = entryHit(ref, e.dn);
    return { ...e, whole, hit: whole || e.attrs.some(([name, vals]) => vals.some((v) => lineHit(ref, e.dn, name, v))) };
  });
  const mine = marked.filter((e) => e.hit);
  const rest = marked.filter((e) => !e.hit);
  const isSssd = ref.startsWith("sssd");
  const isTls = ref.startsWith("tls");
  return (
    <div>
      <h2 className={styles.sheetTitle}>いまの設定</h2>
      {isSssd ? <SssdConfView lab={lab} /> : null}
      {isTls ? (
        <>
          <p className={styles.exportLead}>
            あなたのパソコンの <b>/etc/openldap/ldap.conf</b>。-H を書かないと、ここの URI でつなぎます（ldap:// は暗号なし、ldaps:// ははじめから暗号）。
          </p>
          <ConfText text={ldapConf(lab.client.pc)} hit={(l) => l.startsWith("URI")} />
        </>
      ) : null}
      {card.knob && !isSssd ? (
        <p className={styles.exportLead}>
          LDAP サーバーの設定（<b>cn=config</b>）。<b className={styles.studyMark}>黄色い行</b>が、このカードの設定（{card.knob.title}）です。
          {mine.length ? "" : "まだ入っていません。"}
        </p>
      ) : (
        <p className={styles.exportLead}>LDAP サーバーの設定（cn=config）。名簿と同じ形で、エントリと属性でできています。</p>
      )}
      <div className={styles.studyConf}>
        {mine.map((e) => (
          <ConfEntry key={e.dn} dn={e.dn} attrs={e.attrs} isHit={(name, v) => e.whole || lineHit(ref, e.dn, name, v)} used={ref === "acl" ? used : null} />
        ))}
      </div>
      {rest.length ? (
        <details className={styles.studyConfRest} open={!mine.length && !isSssd && !isTls}>
          <summary>{mine.length ? `そのほかの設定（${rest.length}）` : `ぜんぶの設定（${rest.length}）`}</summary>
          <div className={styles.studyConf}>
            {rest.map((e) => (
              <ConfEntry key={e.dn} dn={e.dn} attrs={e.attrs} isHit={() => false} used={null} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ConfEntry({ dn, attrs, isHit, used }: { dn: string; attrs: [string, string[]][]; isHit: (name: string, v: string) => boolean; used: Set<number> | null }) {
  const mdb = dn.toLowerCase().startsWith("olcdatabase={1}mdb");
  return (
    <div className={styles.studyConfEntry}>
      <p className={styles.studyConfDn}>{dn}</p>
      {attrs.map(([name, vals]) =>
        vals.map((v, k) => {
          const rule = mdb && name === "olcAccess" ? Number(/^\{(\d+)\}/.exec(v)?.[1] ?? -1) : -1;
          return (
            <p key={`${name}${k}`} className={styles.studyConfLine} data-hit={isHit(name, v) ? "1" : undefined}>
              <b>{name}:</b> {v}
              {used && rule >= 0 && used.has(rule) ? <em className={styles.studyUsed}>← さっき当たった行</em> : null}
            </p>
          );
        }),
      )}
    </div>
  );
}

function ConfText({ text, hit }: { text: string; hit: (line: string) => boolean }) {
  return (
    <div className={styles.studyConfEntry}>
      {text.split("\n").map((l, k) => (
        <p key={k} className={styles.studyConfLine} data-hit={hit(l) ? "1" : undefined} data-dim={l.startsWith("#") ? "1" : undefined}>
          {l || "\u00a0"}
        </p>
      ))}
    </div>
  );
}

function SssdConfView({ lab }: { lab: LdapLab }) {
  const file = sssdConf(lab.sssd.file).split("\n");
  const running = sssdConf(lab.sssd.running).split("\n");
  const stale = file.join("\n") !== running.join("\n");
  const access = (l: string) => l.startsWith("access_provider") || l.startsWith("ldap_access_filter");
  return (
    <>
      <p className={styles.exportLead}>
        お店のサーバーの <b>/etc/sssd/sssd.conf</b>。「書いたもの（ファイル）」と「いま動いている SSSD が読みこんだもの」は、<b>systemctl restart sssd</b> するまでちがいます。
      </p>
      {stale ? <p className={styles.studyStale}>ファイルは書きかえたけれど、SSSD はまだ前の設定で動いています</p> : null}
      <div className={styles.studyConfPair}>
        <div>
          <small>書いたもの（ファイル）</small>
          <ConfText text={file.join("\n")} hit={(l) => access(l) || (stale && !running.includes(l))} />
        </div>
        <div>
          <small>いま動いているもの</small>
          <ConfText text={running.join("\n")} hit={access} />
        </div>
      </div>
    </>
  );
}
