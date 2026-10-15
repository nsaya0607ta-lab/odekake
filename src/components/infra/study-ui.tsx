"use client";

/**
 * 勉強部屋の共通の部品（LDAP・メールサーバーで同じ）：教科（Subject）の型・3台の図・ターミナルの1行・**ことば**・
 * サーバーの中のひとこと・パケットのパネル・設定ファイルの表示。
 * 教科ごとにちがうもの（図の線の決め方・名簿やメールボックスのパネル・設定のパネル）は study-ldap.tsx・study-mail.tsx。
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { Glyph, type GlyphId } from "./glyphs";
import { hexdump } from "./ldap-bits";
import type { OutLine, TraceItem } from "./ldap";
import { splitStudy, type PrepRunOf, type StudyCardOf } from "./study-kit";
import styles from "./infra.module.css";

/* ------------------------------------------------------------ 教科（Subject） */

/** パケットの1つ（LDAP・SMTP・IMAP・TLS） */
export type PacketLike = {
  no: number;
  from: string;
  to: string;
  proto: string;
  info: string;
  bytes: Uint8Array;
  secret: [number, number] | null;
  secretText: string | null;
  /** secret の部分の読み方（base64 をもどすと… など） */
  secretHow?: string;
};
/** 1回の実行（画面に出すもの）。LDAP の Run・メールの Run は、どちらもこの形をふくむ */
export type AnyRun = { id: number; host: string; line: string; out: OutLine[]; exit: number; trace: TraceItem[]; packets: PacketLike[]; clear?: boolean };
export type AnyLab = { run: (host: string, cmd: string) => AnyRun };
export type AnyCard = StudyCardOf<AnyLab, AnyRun, string, string>;
export type AnyPrepRun = PrepRunOf<AnyRun, string>;
export type Last = { run: AnyRun; pre: AnyRun | null };
export type PanelProps = { panel: string; lab: AnyLab; last: Last | null; card: AnyCard; keyRef?: string };

export type Subject = {
  id: "ldap" | "mail";
  /** 一覧の切りかえに出す名前 */
  name: string;
  /** 見出しの小さな文字（勉強部屋・LDAP） */
  sub: string;
  /** 一覧のはじめの説明 */
  lead: ReactNode;
  foot: string;
  /** できたカードを覚えるところ（localStorage） */
  doneKey: string;
  cards: AnyCard[];
  chapters: readonly { no: number; title: string; sub: string }[];
  seedBase: number;
  cardLabel: (c: AnyCard) => string;
  /** まっさらな状態を作る（on なら設定あり。probe なら、見くらべるの前にやっておくことも） */
  prepare: (card: AnyCard, on: boolean, probe?: boolean) => { lab: AnyLab; runs: AnyPrepRun[] };
  hosts: Record<string, { label: string; prompt: string }>;
  hostIds: readonly string[];
  hostGlyph: (h: string) => GlyphId;
  hostColor: (h: string) => string;
  /** ためしてみようのボタンの小さな札 */
  hostShort: (h: string) => string;
  hostRole: Record<string, string>;
  /** まっさらな◯◯（名簿・メールサーバー） */
  thing: string;
  /** 画面の下のパネルのボタン（trace・packets はどちらにもある） */
  panels: readonly string[];
  panelLabel: Record<string, string>;
  /** パネルの中身（trace・packets は TracePanel・PacketPanel を使う） */
  renderPanel: (p: PanelProps) => ReactNode;
  /** 図（いま動かしたコマンドで流れた線） */
  net: (runs: (AnyRun | null)[]) => NetView;
  outcome: (r: AnyRun) => { ok: boolean; text: string };
};

/* ------------------------------------------------------------ 小さな部品 */

/** 文の中の **ことば** を目立たせる */
export const Rich = ({ text }: { text: string }) => (
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

export function TermLine({ line }: { line: OutLine }) {
  return (
    <p className={styles.termLine} data-err={line.err ? "1" : undefined} data-mark={line.mark}>
      <span>{line.text || " "}</span>
      {line.hint ? <em className={styles.termHintInline}>{line.hint}</em> : null}
    </p>
  );
}

export function TraceList({ items, hit }: { items: TraceItem[]; hit: Set<TraceItem> }) {
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

/**
 * サーバーの中で起きたことのうち、いま見てほしい行（1〜2行）。
 * key（ステップの why か、カードの設定）の行 → 同じなかまの行 → だめ・注意の行 → うまくいった行 の順にさがす。
 */
export function keyNotes(run: AnyRun, key?: string): TraceItem[] {
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

export function ConfText({ text, hit }: { text: string; hit: (line: string) => boolean }) {
  return (
    <div className={styles.studyConfEntry}>
      {text.split("\n").map((l, k) => (
        <p key={k} className={styles.studyConfLine} data-hit={hit(l) ? "1" : undefined} data-dim={l.trimStart().startsWith("#") || l.startsWith("dnl") ? "1" : undefined}>
          {l || " "}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ 図 */

export type WireState = "tls" | "starttls" | "plain";
export type Wire = { lit: boolean; state: WireState | null; leak: boolean };
export const blankWire = (): Wire => ({ lit: false, state: null, leak: false });
export type NetNode = { id: string; x: number; y: number; label: string; glyph: GlyphId; color: string; tag?: string };
/** t … 線の名札を置く場所（a から b へ、0〜1） */
export type NetLine = { a: string; b: string; wire: Wire; name: string; t: number };
export type NetView = { nodes: NetNode[]; lines: NetLine[]; label: string };

export const stateJa = (w: Wire) =>
  w.leak ? "平文（パスワードが見えた）" : w.state === "tls" ? "暗号（TLS）" : w.state === "starttls" ? "途中から暗号（StartTLS）" : w.state === "plain" ? "平文" : "つながらなかった";

/** 図。いま動かしたコマンドで本当に流れた線だけが光り、線ごとに 暗号／StartTLS／平文／平文！ を出す */
export function NetDiagram({ view, at }: { view: NetView; at: string | null }) {
  const pos = new Map(view.nodes.map((n) => [n.id, n]));
  return (
    <div className={styles.studyNet} role="img" aria-label={view.label}>
      <svg className={styles.studyNetSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {view.lines.map((l) => {
          const a = pos.get(l.a)!;
          const b = pos.get(l.b)!;
          return (
            <line
              key={`${l.a}${l.b}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              vectorEffect="non-scaling-stroke"
              data-lit={l.wire.lit ? "1" : undefined}
              data-state={l.wire.leak ? "leak" : (l.wire.state ?? undefined)}
            />
          );
        })}
      </svg>
      {view.lines.map((l) => {
        const a = pos.get(l.a)!;
        const b = pos.get(l.b)!;
        return <WireTag key={`t${l.a}${l.b}`} spot={{ x: a.x + (b.x - a.x) * l.t, y: a.y + (b.y - a.y) * l.t }} wire={l.wire} name={l.name} />;
      })}
      {view.nodes.map((n) => (
        <span key={n.id} className={styles.studyNode} data-on={at === n.id ? "1" : undefined} style={{ "--c": n.color, left: `${n.x}%`, top: `${n.y}%` } as CSSProperties}>
          <span className={styles.studyNodeIcon}>
            <Glyph id={n.glyph} size={18} />
          </span>
          <small>{n.label}</small>
          {n.tag ? <em className={styles.studyLocal}>{n.tag}</em> : null}
        </span>
      ))}
    </div>
  );
}

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

/* ------------------------------------------------------------ パネル（サーバーの中・パケット） */

export function TracePanel({ last, keyRef, prompt }: { last: Last | null; keyRef?: string; prompt: (host: string) => string }) {
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
        <span className={styles.termPrompt}>{prompt(last.run.host)}</span> {last.run.line}
      </p>
      <TraceList items={last.run.trace} hit={hit} />
    </div>
  );
}

const shortIp = (s: string) => s.replace(/^IP=/, "").replace("192.168.10.", ".");

export function PacketPanel({ run, lead }: { run: AnyRun | null; lead: ReactNode }) {
  const packets = run?.packets ?? [];
  const leaked = packets.find((p) => p.secretText);
  const [open, setOpen] = useState<number | null>(leaked?.no ?? null);
  const plain = packets.filter((p) => p.proto !== "TLS").length;
  return (
    <div>
      <h2 className={styles.sheetTitle}>ネットワークを流れたパケット</h2>
      <p className={styles.exportLead}>{lead}</p>
      {packets.length ? (
        <>
          <p className={styles.studyPktSum} data-bad={leaked ? "1" : undefined}>
            {packets.length}こ（平文 {plain}・暗号 {packets.length - plain}）
            {leaked ? ` — No.${leaked.no} に、パスワード「${leaked.secretText}」が${leaked.secretHow ? "読める形で" : "そのまま"}入っていた` : plain ? "" : " — 中身は読めません"}
          </p>
          <ul className={styles.studyPkts}>
            {packets.map((p) => (
              <li key={p.no} data-secret={p.secretText ? "1" : undefined}>
                <button type="button" onClick={() => setOpen(open === p.no ? null : p.no)} aria-expanded={open === p.no}>
                  <span className={styles.studyPktNo}>{p.no}</span>
                  <span className={styles.studyPktDir}>
                    {shortIp(p.from)} <i>→</i> {shortIp(p.to)}
                  </span>
                  <span className={styles.studyPktProto} data-proto={p.proto === "TLS" ? "TLS" : "plain"}>
                    {p.proto}
                  </span>
                  <span className={styles.studyPktInfo}>{p.info}</span>
                </button>
                {open === p.no ? (
                  <div className={styles.studyDump}>
                    {p.secretText && p.secret ? (
                      <p className={styles.studyDumpWarn}>
                        このパケットの中に、パスワード「{p.secretText}」が{p.secretHow ? `読める形で入っています（${p.secretHow}）` : "そのまま入っています"}
                      </p>
                    ) : null}
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
