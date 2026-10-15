"use client";

/**
 * 勉強部屋の画面（LDAP・メールサーバーで同じ）。設定カード（ldap-lessons.ts・mail-lessons.ts）を、本物のターミナルで1ステップずつ進める。
 * 教科ごとにちがうところ（図の線・パネル・コンピューター）は Subject（study-ldap.tsx・study-mail.tsx）からもらう。
 * - StudyMenu … タブの中。章ごとのカードの一覧と、進み具合（できたら ✓）
 * - StudyScreen … 全画面（?tab=study&card=…）
 *     はじめ → ステップ（やってみる → 返事 → サーバーの中のひとこと → わかったこと）
 *     → まとめ（同じコマンド、ちがう結果・くらべる表・クイズ）→ 自由に試す（設定を切りかえて、コマンドを自分で打つ）
 * 3台の図は、いま動かしたコマンドで本当に流れた線だけを光らせ、線ごとに「暗号／平文」を出す。
 * 1画面に出すのは「いまやること1つ」。くわしいもの（サーバーの中・パケット・ログ・名簿・設定）は、開いたときだけ。
 */
import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Glyph } from "./glyphs";
import { MASCOT, Teacher } from "./intro";
import type { TraceItem } from "./ldap";
import type { Phase } from "./study-kit";
import { NetDiagram, Rich, TermLine, keyNotes, type AnyCard, type AnyLab, type AnyPrepRun, type AnyRun, type Last, type Subject } from "./study-ui";
import { BottomSheet } from "./sheets";
import { sfx } from "./sound";
import styles from "./infra.module.css";

/** 見ている教科（LDAP・メールサーバー）。画面の中の部品は、ここから教科ごとのちがいを引く */
const SubjectCtx = createContext<Subject | null>(null);
function useSubject(): Subject {
  const s = useContext(SubjectCtx);
  if (!s) throw new Error("勉強部屋の教科がない");
  return s;
}

function loadDone(key: string): Set<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function saveDone(key: string, id: string) {
  try {
    const done = loadDone(key);
    done.add(id);
    window.localStorage.setItem(key, JSON.stringify([...done]));
  } catch {
    // 覚えられなくてもよい（一覧の ✓ が出ないだけ）
  }
}

/* ------------------------------------------------------------ 入口（タブの中） */

export function StudyMenu({ subjects, subject, onPick, onOpen }: { subjects: readonly Subject[]; subject: Subject; onPick: (id: Subject["id"]) => void; onOpen: (id: string) => void }) {
  const [doneAll] = useState(() => new Map(subjects.map((x) => [x.id, loadDone(x.doneKey)])));
  const done = doneAll.get(subject.id) ?? new Set<string>();
  const cards = subject.cards;
  const next = cards.find((c) => !done.has(c.id));
  const count = cards.filter((c) => done.has(c.id)).length;
  return (
    <div className={styles.room}>
      <div className={styles.studySubjects} role="tablist" aria-label="勉強する教科">
        {subjects.map((x) => {
          const n = x.cards.filter((c) => doneAll.get(x.id)?.has(c.id)).length;
          return (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === subject.id} data-on={x.id === subject.id ? "1" : undefined} onClick={() => onPick(x.id)}>
              <b>{x.name}</b>
              <small>
                {n} / {x.cards.length} 枚
              </small>
            </button>
          );
        })}
      </div>
      <div className={styles.roomIntro}>
        <Teacher sub={subject.sub} />
        <p>{subject.lead}</p>
      </div>
      <div className={styles.studyProgress}>
        <p>
          <b>{count}</b> / {cards.length} 枚できた
          <small>{count === cards.length ? "ぜんぶできた！ 自由に試すで、組み合わせも試してみよう" : next ? `つぎは「${next.title}」` : ""}</small>
        </p>
        <span className={styles.studyProgressBar} role="progressbar" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={count} aria-label="できたカード">
          <i style={{ width: `${(count / cards.length) * 100}%` }} />
        </span>
      </div>
      {subject.chapters.map((ch) => (
        <section key={ch.no} className={styles.studyChapter} aria-label={ch.title}>
          <h2 className={styles.studyChapterHead}>
            <span>{ch.no ? `第${ch.no}章` : "まず"}</span>
            <b>{ch.title}</b>
            <small>{ch.sub}</small>
          </h2>
          <ol className={styles.roomLessons}>
            {cards
              .filter((c) => c.chapter === ch.no)
              .map((c) => {
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
                          {subject.cardLabel(c)}
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
      <p className={styles.studyFoot}>{subject.foot}</p>
    </div>
  );
}

/* ------------------------------------------------------------ 全画面（1カード） */

type Block = { id: number; kind: "cmd"; host: string; cmd: string; out: AnyRun["out"]; tag?: string } | { id: number; kind: "note"; text: string };
type NewBlock = { kind: "cmd"; host: string; cmd: string; out: AnyRun["out"]; tag?: string } | { kind: "note"; text: string };
type Status = "idle" | "ok" | "retry";
type View = "intro" | "play" | "done" | "free";

const PHASE_LABEL: Record<Phase, string> = { learn: "ことば", off: "設定なし", apply: "設定を入れる", on: "設定あり", trap: "落とし穴" };

export function StudyScreen({ subject, card, onExit, onNext }: { subject: Subject; card: AnyCard; onExit: () => void; onNext: (() => void) | null }) {
  return (
    <SubjectCtx.Provider value={subject}>
      <StudyCardScreen card={card} onExit={onExit} onNext={onNext} />
    </SubjectCtx.Provider>
  );
}

function StudyCardScreen({ card, onExit, onNext }: { card: AnyCard; onExit: () => void; onNext: (() => void) | null }) {
  const subject = useSubject();
  const [lab, setLab] = useState<AnyLab>(() => card.build(subject.seedBase + card.no));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [view, setView] = useState<View>("intro");
  const [i, setI] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [last, setLast] = useState<Last | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sheet, setSheet] = useState<string | null>(null);
  const [wasDone] = useState(() => loadDone(subject.doneKey).has(card.id));
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
  const cmdBlock = (host: string, cmd: string, r: AnyRun, tag?: string): NewBlock => ({ kind: "cmd", host, cmd, out: r.out, tag });

  /* ---------- ガイド（ステップ） ---------- */

  const step = card.steps[i]!;
  const runStep = () => {
    if (status === "ok") return;
    const list: NewBlock[] = [];
    if (step.before) {
      step.before(lab);
      if (step.beforeNote) list.push({ kind: "note", text: step.beforeNote });
    }
    let pre: AnyRun | null = null;
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
        saveDone(subject.doneKey, card.id);
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

  const [host, setHost] = useState<string>("pc");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histAt, setHistAt] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const openFree = () => {
    setView("free");
    setStatus("idle");
    add([{ kind: "note", text: `ここからは自由に試せます。${card.knob ? "上のボタンで、設定なし・ありの${subject.thing}に切りかえられます。" : ""}help で、使えるコマンドが出ます` }]);
  };

  const rebuild = (withKnob: boolean) => {
    const p = subject.prepare(card, withKnob);
    setLab(p.lab);
    setLast(null);
    const list: NewBlock[] = [{ kind: "note", text: withKnob && card.knob ? `まっさらな${subject.thing}に、設定（${card.knob.title}）を入れました` : card.knob ? `まっさらな${subject.thing}（設定なし）にしました` : `まっさらな${subject.thing}にもどしました` }];
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
    <Screen sub={`${subject.sub}・${subject.cardLabel(card)}`} title={card.title} onExit={onExit} scrollKey={view}>
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
              <NetDiagram view={subject.net([last?.pre ?? null, run])} at={step.host} />
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
                        {subject.panelLabel[p]} を見る
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
                まっさらな{subject.thing}にもどす
              </button>
            </div>
          )}
          <section className={styles.studyDesk} aria-label="自由に試す">
            <NetDiagram view={subject.net([run])} at={host} />
            {terminal}
            <div className={styles.studyHosts} role="radiogroup" aria-label="コマンドを打つコンピューター">
              {subject.hostIds.map((h) => (
                <button key={h} type="button" role="radio" aria-checked={host === h} data-on={host === h ? "1" : undefined} style={{ "--c": subject.hostColor(h) } as CSSProperties} onClick={() => setHost(h)}>
                  <Glyph id={subject.hostGlyph(h)} size={13} />
                  {subject.hosts[h]?.label}
                </button>
              ))}
            </div>
            <div className={styles.studyInput}>
              <span className={styles.termPrompt}>{subject.hosts[host]?.prompt}</span>
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
                  <small style={{ "--c": subject.hostColor(t.host) } as CSSProperties}>{subject.hostShort(t.host)}</small>
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
          {subject.panels.map((p) => (
            <button key={p} type="button" onClick={() => setSheet(p)}>
              {subject.panelLabel[p]}
            </button>
          ))}
        </div>
      ) : null}

      <BottomSheet open={sheet != null} onClose={() => setSheet(null)} label={sheet ? (subject.panelLabel[sheet] ?? "") : ""}>
        {sheet ? subject.renderPanel({ panel: sheet, lab, last, card, keyRef: key }) : null}
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

function CardHead({ card }: { card: AnyCard }) {
  const subject = useSubject();
  return (
    <div className={styles.studyHead} style={{ "--c": card.color } as CSSProperties}>
      <span className={styles.studyHeadIcon}>
        <Glyph id={card.icon} size={30} />
      </span>
      <div>
        <small>{card.no ? `${subject.cardLabel(card)}・第${card.chapter}章 ${subject.chapters.find((c) => c.no === card.chapter)?.title ?? ""}` : "はじめに・まず ことばから"}</small>
        <h2>{card.title}</h2>
        <em>{card.sub}</em>
      </div>
    </div>
  );
}

function StudyIntro({ card, wasDone, onStart, onFree }: { card: AnyCard; wasDone: boolean; onStart: () => void; onFree: () => void }) {
  const subject = useSubject();
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
            {subject.hostIds.map((h) => (
              <li key={h} style={{ "--c": subject.hostColor(h) } as CSSProperties}>
                <span>
                  <Glyph id={subject.hostGlyph(h)} size={14} />
                </span>
                <b>{subject.hosts[h]?.label}</b>
                <small>{subject.hostRole[h]}</small>
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

function StudyDone({ card, onExit, onNext, onFree }: { card: AnyCard; onExit: () => void; onNext: (() => void) | null; onFree: () => void }) {
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

type ProbeResult = { off: AnyRun; on: AnyRun; prep: AnyPrepRun[] };

function Probe({ card }: { card: AnyCard }) {
  const subject = useSubject();
  const probe = card.probe!;
  const [res, setRes] = useState<ProbeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const go = () => {
    setBusy(true);
    // まっさらな状態を2つ作る（2000人の名簿のカードもある）。ボタンの見た目を先に変えてから動かす
    window.setTimeout(() => {
      const a = subject.prepare(card, false, true);
      const b = subject.prepare(card, true, true);
      setRes({ off: a.lab.run(probe.host, probe.cmd), on: b.lab.run(probe.host, probe.cmd), prep: b.runs });
      setBusy(false);
      sfx("good");
    }, 40);
  };
  return (
    <div className={styles.studyProbe}>
      <p className={styles.studyCompareHead}>同じコマンド、ちがう結果</p>
      <p className={styles.studyProbeLead}>まっさらな{subject.thing}を2つ用意して、片方にだけ設定を入れます。同じコマンドを、両方で本当に動かしてみよう。</p>
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
              <summary>「設定あり」の{subject.thing}に入れたもの（{res.prep.length}つ）</summary>
              <ul>
                {res.prep.map((p, k) =>
                  "note" in p ? (
                    <li key={k} data-note="1">
                      ⚙ {p.note}
                    </li>
                  ) : (
                    <li key={k}>
                      <span className={styles.termPrompt}>{subject.hosts[p.host]?.prompt}</span> {p.cmd}
                    </li>
                  ),
                )}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <button type="button" className={`${styles.btnPrimary} ${styles.studyRun}`} onClick={go} disabled={busy}>
          {busy ? `${subject.thing}を用意しています…` : `2つの${subject.thing}で動かす`}
        </button>
      )}
    </div>
  );
}

function ProbeSide({ title, tone, run, card }: { title: string; tone: "off" | "on"; run: AnyRun; card: AnyCard }) {
  const subject = useSubject();
  const o = subject.outcome(run);
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

function Switch({ card, on, flip, onOpenConfig }: { card: AnyCard; on: boolean; flip: boolean; onOpenConfig: () => void }) {
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

/** 自由に試す：まっさらの設定なし・ありに切りかえる */
function FreeSwitch({ card, on, onPick }: { card: AnyCard; on: boolean; onPick: (on: boolean) => void }) {
  const knob = card.knob!;
  return (
    <div className={styles.studyFreeSwitch} style={{ "--c": card.color } as CSSProperties}>
      <p>
        <small>{knob.title}</small>
        <b>いま：{on ? knob.on : knob.off}</b>
      </p>
      <div role="group" aria-label="まっさらにして、設定を切りかえる">
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

/* ------------------------------------------------------------ ターミナル */

function CmdChip({ host, cmd, label }: { host: string; cmd: string; label?: string }) {
  const subject = useSubject();
  return (
    <div className={styles.studyCmd}>
      <span className={styles.studyCmdHost} style={{ "--c": subject.hostColor(host) } as CSSProperties}>
        <Glyph id={subject.hostGlyph(host)} size={13} />
        {label ? `${label}：` : ""}
        {subject.hosts[host]?.label}
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
  const subject = useSubject();
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
        <span className={styles.termPrompt}>{subject.hosts[block.host]?.prompt}</span> {block.cmd}
      </p>
      {block.out.map((l, k) => (
        <TermLine key={k} line={l} />
      ))}
    </div>
  );
}

