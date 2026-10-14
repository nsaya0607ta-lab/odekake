"use client";

/**
 * 勉強部屋（LDAP）の画面。設定カード（ldap-lessons.ts）を、本物のターミナルで1ステップずつ進める。
 * - StudyMenu … タブの中。カードの一覧（できたら ✓）
 * - StudyScreen … 全画面（?tab=study&card=…）。設定スイッチ（なし↔あり）・3台の図・ターミナル・
 *   先生の案内（やってみる → 返事 → わかったこと）・パネル（サーバーの中・パケット・ログ・名簿・設定）・くらべる・クイズ
 * 1画面に出すのは「いまやること1つ」。くわしいもの（パケット・ログ・名簿・設定）は、開いたときだけ。
 */
import Image from "next/image";
import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Glyph, type GlyphId } from "./glyphs";
import { MASCOT, Teacher } from "./intro";
import { CARDS, cardById, splitStudy, type Panel, type StudyCard } from "./ldap-lessons";
import { clockText, type TreeNode } from "./ldap";
import { HOSTS, HOST_IDS, type LdapLab, type Run } from "./ldap-shell";
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
  return (
    <div className={styles.room}>
      <div className={styles.roomIntro}>
        <Teacher sub="勉強部屋・LDAP" />
        <p>
          会社やお店の「名簿サーバー」、<b>LDAP</b> の勉強部屋です。1つの設定が「なかったらどう動くか」「入れると何が変わるか」を、
          本物のコマンドを打って、1枚ずつたしかめよう。
        </p>
      </div>
      <ol className={styles.roomLessons}>
        {CARDS.map((c) => {
          const ok = done.has(c.id);
          return (
            <li key={c.id}>
              <button type="button" className={styles.roomLesson} data-next={next?.id === c.id ? "1" : undefined} data-done={ok ? "1" : undefined} onClick={() => onOpen(c.id)}>
                <span className={styles.studyNo} style={{ "--c": c.color } as CSSProperties} aria-hidden="true">
                  {ok ? "✓" : <Glyph id={c.icon} size={18} />}
                </span>
                <span className={styles.roomLessonText}>
                  <small>
                    設定 {c.no}
                    {ok ? "・できた" : next?.id === c.id ? "・つぎはこれ" : ""}
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
      <p className={styles.studyFoot}>LDAP＝Lightweight Directory Access Protocol。社員・パソコン・グループを1か所にまとめて、ログインや権限に使うしくみです。</p>
    </div>
  );
}

/* ------------------------------------------------------------ 全画面（1カード） */

type Block = { id: number; host: (typeof HOST_IDS)[number]; cmd: string; out: Run["out"]; note?: string };
type Status = "idle" | "running" | "ok" | "retry";

export function StudyScreen({ card, onExit, onNext }: { card: StudyCard; onExit: () => void; onNext: (() => void) | null }) {
  const labRef = useRef<LdapLab>(null as unknown as LdapLab);
  if (!labRef.current) labRef.current = card.build(1000 + card.no);
  const lab = labRef.current;
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const [view, setView] = useState<"intro" | "play" | "done">("intro");
  const [i, setI] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Run | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sheet, setSheet] = useState<Panel | null>(null);
  const [wasOn, setWasOn] = useState(() => card.knob.isOn(lab));
  const [flip, setFlip] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const step = card.steps[i]!;
  const on = card.knob.isOn(lab);

  // 設定が「あり」に変わったら、スイッチをアニメ
  useEffect(() => {
    if (on && !wasOn) {
      setFlip(true);
      sfx("good");
      const t = window.setTimeout(() => setFlip(false), 700);
      return () => window.clearTimeout(t);
    }
    setWasOn(on);
  }, [on, wasOn]);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [blocks]);

  const run = () => {
    if (status === "running" || status === "ok") return;
    step.before?.(lab);
    const r = lab.run(step.host, step.cmd);
    const block: Block = { id: nextId.current++, host: step.host, cmd: step.cmd, out: r.out, note: step.beforeNote };
    setBlocks((b) => [...b, block]);
    setResult(r);
    const good = step.ok ? step.ok(r) : true;
    setStatus(good ? "ok" : "retry");
    sfx(good ? "good" : "wrong");
    bump();
    window.requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  const next = () => {
    if (i + 1 >= card.steps.length) {
      setView("done");
      saveDone(card.id);
      sfx("clear");
      return;
    }
    setI(i + 1);
    setStatus("idle");
    setResult(null);
  };

  const learn = status === "ok" ? (typeof step.learn === "function" ? step.learn(result ?? ({ out: [] } as unknown as Run)) : step.learn) : "";
  const hostInfo = HOSTS[step.host];

  return (
    <Screen sub={`勉強部屋・設定 ${card.no}`} title={card.title} onExit={onExit}>
      {view === "intro" ? (
        <StudyIntro card={card} onStart={() => setView("play")} />
      ) : (
        <>
          <Switch card={card} on={on} flip={flip} onOpenConfig={() => setSheet("config")} />
          <Diagram active={view === "done" ? null : step.host} tls={lab.server.cfg.tlsCert && lab.server.cfg.tlsKey} />

          <div className={styles.studyTermWrap} ref={termRef} aria-label="ターミナル">
            {blocks.length === 0 ? <p className={styles.termHint}>下の「実行」を押すと、ここにコマンドと返事が出ます</p> : null}
            {blocks.map((b) => (
              <div key={b.id} className={styles.termBlock}>
                {b.note ? <p className={styles.termNote}>⚙ {b.note}</p> : null}
                <p className={styles.termCmd}>
                  <span className={styles.termPrompt}>{HOSTS[b.host].prompt}</span> {b.cmd}
                </p>
                {b.out.map((l, k) => (
                  <TermLine key={k} line={l} />
                ))}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {view === "done" ? (
            <StudyDone card={card} onExit={onExit} onNext={onNext} onOpen={setSheet} />
          ) : (
            <section className={styles.rlStep} key={i} aria-label={`ステップ ${i + 1}`}>
              <div className={styles.rlCount}>
                <span>
                  ステップ {i + 1} / {card.steps.length}
                </span>
                <span className={styles.studyPhase} data-phase={step.phase}>
                  {step.phase === "off" ? "設定なし" : step.phase === "apply" ? "設定を入れる" : "設定あり"}
                </span>
              </div>
              <div className={styles.rlSay}>
                <span className={styles.teacherFace} aria-hidden="true">
                  <Image src={MASCOT} alt="" width={128} height={128} />
                </span>
                <p>
                  <Rich text={step.say} />
                </p>
              </div>

              <div className={styles.studyCmd}>
                <span className={styles.studyCmdHost} style={{ "--c": hostColor(step.host) } as CSSProperties}>
                  <Glyph id={hostGlyph(step.host)} size={13} />
                  {hostInfo.label}
                </span>
                <code>{step.cmd}</code>
              </div>

              {status !== "ok" ? (
                <button type="button" className={`${styles.btnPrimary} ${styles.studyRun}`} onClick={run} disabled={status === "running"}>
                  {status === "retry" ? "もう一度 実行" : "実行"}
                </button>
              ) : null}

              {status === "ok" ? (
                <>
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
                  <button type="button" className={`${styles.btnPrimary} ${styles.rlNext}`} onClick={next}>
                    {i + 1 >= card.steps.length ? "まとめへ" : "つぎへ"}
                  </button>
                </>
              ) : status === "retry" ? (
                <p className={styles.rlRetry}>{step.retry ?? "思ったのとちがう結果でした。もう一度ためしてみよう。"}</p>
              ) : null}
            </section>
          )}

          <div className={styles.rlLinks}>
            {(["trace", "tree", "config", "logs", "packets"] as Panel[]).map((p) => (
              <button key={p} type="button" onClick={() => setSheet(p)}>
                {PANEL_LABEL[p]}
              </button>
            ))}
          </div>
        </>
      )}

      <BottomSheet open={sheet != null} onClose={() => setSheet(null)} label={sheet ? PANEL_LABEL[sheet] : ""}>
        {sheet ? <PanelView panel={sheet} lab={lab} run={result} card={card} /> : null}
      </BottomSheet>
    </Screen>
  );
}

/* ------------------------------------------------------------ 画面のへや */

function Screen({ sub, title, onExit, children }: { sub: string; title: string; onExit: () => void; children: ReactNode }) {
  return (
    <div className={styles.home}>
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

function StudyIntro({ card, onStart }: { card: StudyCard; onStart: () => void }) {
  return (
    <section className={styles.rlStep} aria-label="このカードについて">
      <div className={styles.studyHead} style={{ "--c": card.color } as CSSProperties}>
        <span className={styles.studyHeadIcon}>
          <Glyph id={card.icon} size={30} />
        </span>
        <div>
          <small>設定 {card.no}</small>
          <h2>{card.title}</h2>
          <em>{card.sub}</em>
        </div>
      </div>
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
      <div className={styles.studyKnobMap}>
        <b>この設定</b>
        <p>{card.knob.title}</p>
        <small>ばしょ：{card.knob.where}</small>
      </div>
      <button type="button" className={`${styles.btnPrimary} ${styles.rlNext}`} onClick={onStart}>
        はじめる
      </button>
    </section>
  );
}

function StudyDone({ card, onExit, onNext, onOpen }: { card: StudyCard; onExit: () => void; onNext: (() => void) | null; onOpen: (p: Panel) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked === card.quiz.answer;
  return (
    <section className={styles.rlStep} aria-label="まとめ">
      <div className={styles.rlClear}>
        <span aria-hidden="true">🎉</span>
        <b>設定 {card.no} かんりょう！</b>
        <small>{card.title}</small>
      </div>

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
        {picked != null ? <p className={styles.studyQuizA} data-ok={correct ? "1" : undefined}>{correct ? "正解！ " : "おしい！ "}{card.quiz.explain}</p> : null}
      </div>

      <div className={styles.studyPeek}>
        <button type="button" onClick={() => onOpen("config")}>
          最後の設定（cn=config）を見る
        </button>
        <button type="button" onClick={() => onOpen("tree")}>
          名簿を見る
        </button>
      </div>

      <div className={styles.rlClearBtns}>
        {onNext ? (
          <button type="button" className={styles.btnPrimary} onClick={onNext}>
            つぎの設定へ
          </button>
        ) : null}
        <button type="button" className={onNext ? styles.btnGhost : styles.btnPrimary} onClick={onExit}>
          一覧へもどる
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ 設定スイッチ・図 */

function Switch({ card, on, flip, onOpenConfig }: { card: StudyCard; on: boolean; flip: boolean; onOpenConfig: () => void }) {
  return (
    <button type="button" className={styles.studySwitch} data-on={on ? "1" : undefined} data-flip={flip ? "1" : undefined} onClick={onOpenConfig} style={{ "--c": card.color } as CSSProperties}>
      <span className={styles.studySwitchText}>
        <small>{card.knob.title}</small>
        <b>{on ? card.knob.on : card.knob.off}</b>
      </span>
      <span className={styles.studySwitchTrack} aria-hidden="true">
        <i>なし</i>
        <i>あり</i>
        <span className={styles.studySwitchKnob} />
      </span>
    </button>
  );
}

function Diagram({ active, tls }: { active: (typeof HOST_IDS)[number] | null; tls: boolean }) {
  return (
    <div className={styles.studyNet} aria-hidden="true">
      <Node id="pc" active={active === "pc"} />
      <span className={styles.studyWire} data-lit={active === "pc" || active === "shop" ? "1" : undefined}>
        <i />
        {tls ? <b className={styles.studyLock}>🔒</b> : null}
      </span>
      <Node id="ldap" active={active === "ldap"} />
      <span className={styles.studyWire} data-lit={active === "shop" ? "1" : undefined}>
        <i />
      </span>
      <Node id="shop" active={active === "shop"} />
    </div>
  );
}

function Node({ id, active }: { id: (typeof HOST_IDS)[number]; active: boolean }) {
  return (
    <span className={styles.studyNode} data-on={active ? "1" : undefined} style={{ "--c": hostColor(id) } as CSSProperties}>
      <span className={styles.studyNodeIcon}>
        <Glyph id={hostGlyph(id)} size={18} />
      </span>
      <small>{HOSTS[id].label}</small>
    </span>
  );
}

const hostGlyph = (id: string): GlyphId => (id === "pc" ? "user" : id === "ldap" ? "db" : "app");
const hostColor = (id: string) => (id === "pc" ? "#9fb4ff" : id === "ldap" ? "#b08cff" : "#5fd8ff");

/* ------------------------------------------------------------ ターミナルの行 */

function TermLine({ line }: { line: Run["out"][number] }) {
  return (
    <p className={styles.termLine} data-err={line.err ? "1" : undefined} data-mark={line.mark}>
      <span>{line.text || " "}</span>
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

function PanelView({ panel, lab, run, card }: { panel: Panel; lab: LdapLab; run: Run | null; card: StudyCard }) {
  if (panel === "trace") return <TracePanel run={run} knobRef={card.knob.ref} />;
  if (panel === "packets") return <PacketPanel run={run} />;
  if (panel === "logs") return <LogPanel lab={lab} />;
  if (panel === "tree") return <TreePanel lab={lab} />;
  return <ConfigPanel lab={lab} card={card} />;
}

function TracePanel({ run, knobRef }: { run: Run | null; knobRef: string }) {
  return (
    <div>
      <h2 className={styles.sheetTitle}>サーバーの中で起きたこと</h2>
      <p className={styles.exportLead}>さっきのコマンドで、LDAP サーバーが「なぜその返事をしたか」を順に並べています。</p>
      {run && run.trace.length ? (
        <ol className={styles.studyTrace}>
          {run.trace.map((t, k) => (
            <li key={k} data-tone={t.tone} data-hit={t.ref && t.ref.startsWith(knobRef) ? "1" : undefined}>
              <Rich text={t.text} />
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.roomNote}>まだコマンドを実行していません</p>
      )}
    </div>
  );
}

function PacketPanel({ run }: { run: Run | null }) {
  const [open, setOpen] = useState<number | null>(null);
  const packets = run?.packets ?? [];
  return (
    <div>
      <h2 className={styles.sheetTitle}>ネットワークを流れたパケット</h2>
      <p className={styles.exportLead}>
        あなたのパソコンと LDAP サーバーのあいだを、実際に流れたバイトです。<b className={styles.studyKey}>赤いところ</b>は、あなたのパスワード。
        <b>TLS（暗号）</b>のときは中身が読めません。
      </p>
      {packets.length ? (
        <ul className={styles.studyPkts}>
          {packets.map((p) => (
            <li key={p.no}>
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
                  {p.proto === "TLS" ? <p className={styles.studyDumpWarn} data-ok="1">暗号化されているので、中身（パスワードなど）は読めません</p> : null}
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
      ) : (
        <p className={styles.roomNote}>まだパケットは流れていません</p>
      )}
    </div>
  );
}

const shortIp = (s: string) => s.replace(/^IP=/, "").replace("192.168.10.", ".");

function LogPanel({ lab }: { lab: LdapLab }) {
  const logs = lab.server.logs.slice(-60);
  return (
    <div>
      <h2 className={styles.sheetTitle}>サーバーのログ</h2>
      <p className={styles.exportLead}>LDAP サーバー（slapd）・お店のサーバー（sshd・SSSD）が書いたログです。本物と同じ形。</p>
      <ul className={styles.studyLog}>
        {logs.length ? (
          logs
            .slice()
            .reverse()
            .map((l, k) => (
              <li key={k} data-src={l.src}>
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
      <p className={styles.exportLead}>LDAP サーバーの名簿（ディレクトリ）です。親子の形で、上から下へつながっています。</p>
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
          {n.locked ? <span className={styles.studyTag} data-tone="ng">ロック中</span> : null}
          {n.kind === "person" && n.memberOf?.length ? <span className={styles.studyTag} data-tone="on">memberOf: {n.memberOf.join("・")}</span> : null}
          {n.kind === "person" && n.uidNumber ? <span className={styles.studyTag}>uid#{n.uidNumber}</span> : null}
          {n.kind === "group" && n.members ? <span className={styles.studyTag}>member {n.members.length}</span> : null}
        </>
      )}
    </div>
  );
}

function ConfigPanel({ lab, card }: { lab: LdapLab; card: StudyCard }) {
  const entries = lab.server.configEntries();
  const kw = refKeyword(card.knob.ref);
  const isSssd = card.knob.where.includes("sssd");
  return (
    <div>
      <h2 className={styles.sheetTitle}>いまの設定</h2>
      {isSssd ? (
        <>
          <p className={styles.exportLead}>お店のサーバーの <b>/etc/sssd/sssd.conf</b>。「書いたもの」と「いま動いているもの」は、restart するまでちがいます。</p>
          <div className={styles.studyConfPair}>
            <div>
              <small>書いたもの（ファイル）</small>
              <pre className={styles.codeBlock}>{sssdText(lab.sssd.file)}</pre>
            </div>
            <div>
              <small>いま動いているもの</small>
              <pre className={styles.codeBlock}>{sssdText(lab.sssd.running)}</pre>
            </div>
          </div>
        </>
      ) : null}
      <p className={styles.exportLead}>
        LDAP サーバーの設定（<b>cn=config</b>）。<b className={styles.studyKey}>黄色い行</b>が、このカードで変える設定です。
      </p>
      <div className={styles.studyConf}>
        {entries.map((e) => (
          <div key={e.dn} className={styles.studyConfEntry}>
            <p className={styles.studyConfDn}>{e.dn}</p>
            {e.attrs.map(([name, vals]) =>
              vals.map((v, k) => (
                <p key={`${name}${k}`} className={styles.studyConfLine} data-hit={kw && name.toLowerCase().includes(kw) ? "1" : undefined}>
                  <b>{name}:</b> {v}
                </p>
              )),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const refKeyword = (ref: string): string => {
  const map: Record<string, string> = {
    rootpw: "olcrootpw",
    "anon:disallow": "olcdisallows",
    acl: "olcaccess",
    "tls:security": "olcsecurity",
    "schema:nis": "nis",
    "index:mail": "olcdbindex",
    ppolicy: "olcoverlay",
    memberof: "olcoverlay",
    refint: "olcoverlay",
    unique: "olcoverlay",
  };
  return map[ref] ?? "";
};

function sssdText(s: LdapLab["sssd"]["file"]): string {
  return [
    "[domain/wanko]",
    "id_provider = ldap",
    "auth_provider = ldap",
    `ldap_uri = ${s.uri}`,
    ...(s.access === "ldap" ? ["access_provider = ldap", `ldap_access_filter = ${s.filter}`] : ["# access_provider = permit（ぜんいん）"]),
  ].join("\n");
}
