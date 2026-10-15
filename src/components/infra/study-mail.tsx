"use client";

/**
 * 勉強部屋の教科「メールサーバー」：図の線の決め方（あなたのパソコン・外のサーバー → メールサーバー → インターネットの向こう）・
 * ログ／メールボックス／設定のパネル・結果のひとこと。画面そのものは study-room.tsx（LDAP と同じ）。
 */
import { type CSSProperties, type ReactNode } from "react";
import { type GlyphId } from "./glyphs";
import { MAIL_CARDS, MAIL_CHAPTERS, MAIL_SEED_BASE, mailCardLabel, prepareMailLab, type MailCard } from "./mail-lessons";
import { clockText, parseAccess, parseAliases, type MailWorld } from "./mail";
import { HOSTS, HOST_IDS, type HostId, type MailLab, type Run } from "./mail-shell";
import { ConfText, PacketPanel, TracePanel, blankWire, stateJa, type AnyCard, type Last, type NetView, type PanelProps, type Subject, type Wire, type WireState } from "./study-ui";
import styles from "./infra.module.css";

const hostGlyph = (id: string): GlyphId => (id === "pc" ? "user" : id === "mail" ? "queue" : "app");
const hostColor = (id: string) => (id === "pc" ? "#9fb4ff" : id === "mail" ? "#ffa45c" : "#5fd8ff");

const HOST_ROLE: Record<HostId, string> = {
  pc: "お店のスタッフ。送る（swaks）・読む（curl の IMAP・POP3）",
  mail: "メールサーバー（Postfix か sendmail ＋ Dovecot）",
  out: "インターネットのどこか（お客さん・取引先）",
};

/* ------------------------------------------------------------ 図 */

/** パソコン・外のサーバー → メールサーバー（SMTP・IMAP）、メールサーバー → インターネット（外へ配る） */
function net(runs: (Run | null)[]): NetView {
  const list = runs.filter((r): r is Run => r != null);
  const pcMail = blankWire();
  const outMail = blankWire();
  const mailNet = blankWire();
  let pcName = "SMTP";
  let local = false;
  let boxed = false;
  let waiting = false;
  const rank: Record<WireState, number> = { tls: 0, starttls: 1, plain: 2 };
  const mark = (w: Wire, state: WireState | null, leak: boolean) => {
    w.lit = true;
    if (state && (w.state == null || rank[state] > rank[w.state])) w.state = state;
    if (leak) w.leak = true;
  };
  for (const o of list.flatMap((r) => r.ops)) {
    if (o.kind === "smtp" || o.kind === "imap" || o.kind === "pop3") {
      if (o.local) {
        local = true;
        continue;
      }
      if (o.from === "pc" && o.kind !== "smtp") pcName = o.kind === "imap" ? "IMAP" : "POP3";
      const w = o.from === "out" ? outMail : o.from === "pc" ? pcMail : null;
      if (w) mark(w, o.refused ? null : (o.mode ?? "plain"), Boolean(o.leak));
    } else if (o.kind === "deliver") {
      if (o.how === "remote") mark(mailNet, "plain", false);
      else if (o.how === "deferred" && o.via) {
        mailNet.lit = true;
        waiting = true;
      } else if (o.how === "mbox" || o.how === "maildir" || o.how === "lmtp") boxed = true;
    } else if (o.kind === "queue") waiting = true;
  }
  const said = [
    pcMail.lit ? `パソコンとメールサーバー（${pcName}）：${stateJa(pcMail)}` : "",
    outMail.lit ? `外のサーバーとメールサーバー（SMTP）：${stateJa(outMail)}` : "",
    mailNet.lit ? (mailNet.state ? "メールサーバーからインターネットへ配った" : "インターネットへ配ろうとして、つながらなかった") : "",
    local ? "メールサーバーの中から（localhost）" : "",
  ].filter(Boolean);
  const tag = local ? "中から（localhost）" : waiting ? "キューで待ち" : boxed ? "メールボックスへ" : undefined;
  const node = (id: HostId, x: number, y: number) => ({ id, x, y, label: HOSTS[id].label, glyph: hostGlyph(id), color: hostColor(id), tag: id === "mail" ? tag : undefined });
  return {
    nodes: [node("mail", 50, 20), node("pc", 16, 72), node("out", 84, 72), { id: "net", x: 87, y: 20, label: "インターネット", glyph: "region", color: "#4ade80" }],
    lines: [
      { a: "mail", b: "pc", wire: pcMail, name: pcName, t: 0.6 },
      { a: "mail", b: "out", wire: outMail, name: "SMTP", t: 0.6 },
      { a: "mail", b: "net", wire: mailNet, name: "配る", t: 0.5 },
    ],
    label: `メールの図。${said.length ? `いまのコマンドで流れた線：${said.join("、")}` : "まだ何も流れていません"}`,
  };
}

/* ------------------------------------------------------------ 結果のひとこと */

const SMTP_JA: Record<string, string> = { "550": "ことわり", "554": "中継おことわり", "535": "ログインできない", "530": "暗号が要る", "503": "順番がちがう", "454": "いまはだめ", "421": "いまはだめ" };

function outcome(r: Run): { ok: boolean; text: string } {
  const smtp = r.ops.find((o) => o.kind === "smtp");
  if (smtp) {
    if (smtp.refused) return { ok: false, text: "つながらない" };
    if (r.exit === 0) return { ok: true, text: smtp.accepted ? "受けとった（250）" : "成功" };
    const code = r.out.map((l) => /^<[-~*]{1,2}\s*(\d{3})/.exec(l.text)).find((m) => m && Number(m[1]) >= 400)?.[1];
    if (code) return { ok: false, text: `${code}（${SMTP_JA[code] ?? "だめ"}）` };
    return { ok: false, text: r.exit === 28 ? "ログインのしかたがない" : r.exit === 29 ? "暗号にできない" : `終了コード ${r.exit}` };
  }
  const mbx = r.ops.find((o) => o.kind === "imap" || o.kind === "pop3");
  if (mbx) return r.exit === 0 ? { ok: true, text: "ログインできた" } : { ok: false, text: r.exit === 67 ? "ログインできない" : "つながらない" };
  return r.exit === 0 ? { ok: true, text: "成功（0）" } : { ok: false, text: `終了コード ${r.exit}` };
}

/* ------------------------------------------------------------ パネル */

function LogPanel({ lab, run }: { lab: MailLab; run: Run | null }) {
  const logs = lab.world.logs.slice(-60);
  const fresh = new Set(run?.logs ?? []);
  return (
    <div>
      <h2 className={styles.sheetTitle}>メールサーバーのログ</h2>
      <p className={styles.exportLead}>
        /var/log/maillog です（Postfix・sendmail・Dovecot が書く。本物と同じ形）。<b className={styles.studyMark}>光っている行</b>が、さっきのコマンドのぶん。
        同じ <b>キューID</b> の行をたどると、1通の流れがわかります。
      </p>
      <ul className={styles.studyLog}>
        {logs.length ? (
          logs
            .slice()
            .reverse()
            .map((l, k) => (
              <li key={k} data-src={l.src === "dovecot" ? "sssd" : l.src === "system" ? "system" : "slapd"} data-new={fresh.has(l) ? "1" : undefined}>
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

const subjectOf = (m: { head: [string, string][] }) => m.head.find(([k]) => k.toLowerCase() === "subject")?.[1] ?? "（件名なし）";

function BoxPanel({ lab }: { lab: MailLab }) {
  const w = lab.world;
  const boxes = w.boxes();
  return (
    <div>
      <h2 className={styles.sheetTitle}>メールボックスとキュー</h2>
      <p className={styles.exportLead}>
        それぞれの人のメールボックス（<b>Dovecot が見ている場所</b>）と、まだ配れていないメール（キュー）、外へ配ったメールです。
      </p>
      <ul className={styles.studyTree}>
        {boxes.map((b) => (
          <li key={b.user}>
            <div className={styles.studyTreeRow} style={{ "--c": "#9fb4ff" } as CSSProperties}>
              <b>{b.user}</b>
              <small>
                {b.label}・{b.where}
              </small>
            </div>
            {b.folders.map((f) => (
              <div key={f.name} className={styles.studyTreeRow} style={{ "--c": "#ffa45c", marginLeft: "14px" } as CSSProperties}>
                <b>{f.name}</b>
                <span className={styles.studyTag} data-tone={f.mails.length ? "on" : undefined}>
                  {f.mails.length}通
                </span>
                {f.mails.length ? <small>{f.mails.map((s) => subjectOf(s.mail)).join("・")}</small> : null}
              </div>
            ))}
            {b.other.map((o) => (
              <div key={o.path} className={styles.studyTreeRow} style={{ "--c": "#ff7a8a", marginLeft: "14px" } as CSSProperties}>
                <span className={styles.studyTag} data-tone="ng">
                  Dovecot は見ていない
                </span>
                <small>
                  {o.path}：{o.mails.length}通（{o.mails.map((s) => subjectOf(s.mail)).join("・")}）
                </small>
              </div>
            ))}
          </li>
        ))}
      </ul>
      <p className={styles.studyCompareHead}>キュー（mailq）</p>
      {w.queue.length ? (
        <ul className={styles.studyTree}>
          {w.queue.map((q) => (
            <li key={q.qid}>
              <div className={styles.studyTreeRow} style={{ "--c": "#ff7a8a" } as CSSProperties}>
                <b>{q.qid}</b>
                <small>
                  {q.mail.from} → {q.pending.join(", ")}
                </small>
                <span className={styles.studyTag} data-tone="ng">
                  {q.reason || "配っている"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.roomNote}>キューは空です（あずかったメールは、ぜんぶ配りおわった）</p>
      )}
      <p className={styles.studyCompareHead}>外へ配ったメール</p>
      {w.remote.length ? (
        <ul className={styles.studyTree}>
          {w.remote.slice(-8).map((m, k) => (
            <li key={k}>
              <div className={styles.studyTreeRow} style={{ "--c": "#4ade80" } as CSSProperties}>
                <b>{m.rcpt}</b>
                <small>
                  {subjectOf(m.mail)}（{m.via === "direct" ? m.server : `${m.via} 経由`}）
                </small>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.roomNote}>まだ外へは配っていません</p>
      )}
    </div>
  );
}

/** このカードの設定が書いてある、Postfix の設定の名前 */
const PF_KEYS: Record<string, string[]> = {
  mydest: ["mydestination"],
  "relay:mynetworks": ["mynetworks", "smtpd_relay_restrictions"],
  sasl: ["smtpd_sasl_auth_enable", "smtpd_sasl_type", "smtpd_sasl_path"],
  tls: ["smtpd_tls_cert_file", "smtpd_tls_key_file", "smtpd_tls_security_level", "smtpd_tls_auth_only"],
  maildir: ["home_mailbox"],
  "sieve:transport": ["mailbox_transport"],
  relayhost: ["relayhost"],
};
const keyHit = (keys: string[]) => (l: string) => keys.some((k) => new RegExp(`^\\s*${k}\\s*=`).test(l));

/** 書いたもの（ファイル）と、いま動いているもの（読みこんだときの写し）を並べる */
function Pair({ title, file, running, hit, staleNote }: { title: string; file: string; running: string | null; hit: (l: string) => boolean; staleNote: string }) {
  const stale = running != null && running.trim() !== file.trim();
  return (
    <>
      <p className={styles.exportLead}>
        <b>{title}</b>
      </p>
      {stale ? <p className={styles.studyStale}>{staleNote}</p> : null}
      {running == null ? (
        <ConfText text={file.replace(/\n$/, "")} hit={hit} />
      ) : (
        <div className={styles.studyConfPair}>
          <div>
            <small>書いたもの（ファイル）</small>
            <ConfText text={file.replace(/\n$/, "")} hit={(l) => hit(l) || (stale && !running.split("\n").includes(l))} />
          </div>
          <div>
            <small>いま動いているもの</small>
            <ConfText text={running.replace(/\n$/, "")} hit={hit} />
          </div>
        </div>
      )}
    </>
  );
}

/** main.cf のうち、設定の行だけ（# と空の行をのぞく） */
const cfLines = (text: string) =>
  text
    .split("\n")
    .filter((l) => l.trim() && !l.trimStart().startsWith("#"))
    .join("\n");

function ConfigPanel({ lab, card }: { lab: MailLab; card: MailCard }) {
  const w: MailWorld = lab.world;
  const ref = card.knob?.ref ?? "";
  const f = (p: string) => w.files.get(p) ?? "";
  const views: ReactNode[] = [];
  if (w.mta === "postfix" && (PF_KEYS[ref] || !ref)) {
    const running = w.pf ? [...w.pf.conf.entries()].map(([k, v]) => `${k} = ${v}`).join("\n") : "（Postfix は止まっている）";
    views.push(
      <Pair
        key="main"
        title="/etc/postfix/main.cf（Postfix の設定）"
        file={cfLines(f("/etc/postfix/main.cf"))}
        running={running}
        hit={keyHit(PF_KEYS[ref] ?? [])}
        staleNote="main.cf は書きかえたけれど、Postfix はまだ前の設定で動いています（postfix reload で読みこむ）"
      />,
    );
  }
  if (ref === "maildir") views.push(<Pair key="mail" title="/etc/dovecot/conf.d/10-mail.conf（Dovecot が読む場所）" file={f("/etc/dovecot/conf.d/10-mail.conf")} running={null} hit={keyHit(["mail_location"])} staleNote="" />);
  if (ref === "sieve:transport") {
    views.push(<Pair key="lmtp" title="/etc/dovecot/conf.d/20-lmtp.conf" file={f("/etc/dovecot/conf.d/20-lmtp.conf")} running={null} hit={keyHit(["mail_plugins"])} staleNote="" />);
    views.push(<Pair key="sieve" title="/home/pochi/.dovecot.sieve（pochi のふり分けのルール）" file={f("/home/pochi/.dovecot.sieve")} running={null} hit={(l) => l.includes("fileinto")} staleNote="" />);
  }
  if (ref === "sasl") views.push(<Pair key="auth" title="/etc/dovecot/conf.d/10-master.conf（SMTP AUTH の受け口）" file={f("/etc/dovecot/conf.d/10-master.conf")} running={null} hit={(l) => l.includes("private/auth")} staleNote="" />);
  if (ref === "aliases") {
    const db = w.aliasDb ? [...w.aliasDb.entries()].map(([k, v]) => `${k}: ${v.join(", ")}`).join("\n") : "（まだない）";
    const fileHas = parseAliases(f("/etc/aliases")).map.has("info");
    views.push(
      <Pair
        key="al"
        title="/etc/aliases と、Postfix が読む /etc/aliases.db（中身を文字にしたもの）"
        file={f("/etc/aliases")}
        running={db}
        hit={(l) => l.startsWith("info")}
        staleNote={fileHas && !w.aliasDb?.has("info") ? "/etc/aliases には書いたけれど、aliases.db はまだ前のまま（newaliases で作りなおす）" : ""}
      />,
    );
  }
  if (ref === "imap") {
    const run = w.dc ? `disable_plaintext_auth = ${w.dc.get("disable_plaintext_auth") ?? "yes"}\nauth_mechanisms = ${w.dc.get("auth_mechanisms") ?? "plain"}` : "（Dovecot は止まっている）";
    views.push(
      <Pair
        key="dc"
        title="/etc/dovecot/conf.d/10-auth.conf（Dovecot のログインの設定）"
        file={cfLines(f("/etc/dovecot/conf.d/10-auth.conf"))}
        running={run}
        hit={keyHit(["disable_plaintext_auth"])}
        staleNote="10-auth.conf は書きかえたけれど、Dovecot はまだ前の設定で動いています（systemctl reload dovecot で読みこむ）"
      />,
    );
  }
  if (ref === "sendmail:daemon") {
    const cf = f("/etc/mail/sendmail.cf")
      .split("\n")
      .filter((l) => l.startsWith("O DaemonPortOptions"))
      .join("\n");
    views.push(<Pair key="mc" title="/etc/mail/sendmail.mc（人が書く設定）" file={f("/etc/mail/sendmail.mc")} running={null} hit={(l) => l.startsWith("DAEMON_OPTIONS")} staleNote="" />);
    views.push(
      <Pair
        key="cf"
        title="/etc/mail/sendmail.cf の待ち受けの行（m4 で作る）と、動いている sendmail"
        file={cf}
        running={w.sm ? `待ち受け：${w.sm.listen}:25` : "（sendmail は止まっている）"}
        hit={(l) => l.includes("DaemonPortOptions") || l.startsWith("待ち受け")}
        staleNote=""
      />,
    );
    if (w.smMcStale()) views.unshift(<p key="st" className={styles.studyStale}>sendmail.mc は書きかえたけれど、sendmail.cf はまだ前のまま（m4 で作りなおして、再起動する）</p>);
  }
  if (ref === "sendmail:access") {
    const db = w.accessDb ? [...w.accessDb.entries()].map(([k, v]) => `${k.replace(/^connect:/, "Connect:")}\t${v}`).join("\n") : "（まだない）";
    const want = parseAccess(f("/etc/mail/access")).has("connect:192.168.10") && !w.accessDb?.has("connect:192.168.10");
    views.push(
      <Pair
        key="ac"
        title="/etc/mail/access と、sendmail が読む access.db（中身を文字にしたもの）"
        file={f("/etc/mail/access")}
        running={db}
        hit={(l) => /^Connect:192\.168\.10\s/i.test(l)}
        staleNote={want ? "access には書いたけれど、access.db はまだ前のまま（makemap で作りなおす）" : ""}
      />,
    );
  }
  return (
    <div>
      <h2 className={styles.sheetTitle}>いまの設定</h2>
      {card.knob ? (
        <p className={styles.exportLead}>
          <b className={styles.studyMark}>黄色い行</b>が、このカードの設定（{card.knob.title}）です。
        </p>
      ) : null}
      {views}
    </div>
  );
}

/* ------------------------------------------------------------ 教科 */

const PANEL_LABEL: Record<string, string> = { trace: "サーバーの中", packets: "パケット", logs: "ログ", boxes: "メールボックス", config: "設定" };
const prompt = (h: string) => HOSTS[h as HostId]?.prompt ?? "$";

function renderPanel({ panel, lab, last, card, keyRef }: PanelProps) {
  const l = lab as unknown as MailLab;
  const run = (last?.run ?? null) as unknown as Run | null;
  if (panel === "trace") return <TracePanel last={last as Last | null} keyRef={keyRef} prompt={prompt} />;
  if (panel === "packets")
    return (
      <PacketPanel
        run={last?.run ?? null}
        lead={
          <>
            あなたのパソコン・外のサーバーとメールサーバーのあいだを、実際に流れたバイトです。<b className={styles.studyKey}>赤いところ</b>は、パスワード（そのままか base64）。
            SMTP も IMAP も、<b>TLS（暗号）</b>にしないと、パスワードもメールの中身も読めてしまいます。メールサーバーの中の話（Postfix → Dovecot など）は、ここには出ません。
          </>
        }
      />
    );
  if (panel === "logs") return <LogPanel lab={l} run={run} />;
  if (panel === "boxes") return <BoxPanel lab={l} />;
  return <ConfigPanel lab={l} card={card as unknown as MailCard} />;
}

export const MAIL_SUBJECT: Subject = {
  id: "mail",
  name: "メール（Postfix・sendmail）",
  sub: "勉強部屋・メール",
  lead: (
    <>
      メールを運ぶ <b>Postfix・sendmail</b> と、メールボックスの <b>Dovecot</b> の勉強部屋です（LPIC-2 の 202 試験の「電子メールサービス」くらい）。
      1枚のカードで1つの設定を、「なかったらどう動くか」→「入れると何が変わるか」の順に、本物のコマンドを打ってたしかめよう。
    </>
  ),
  foot: "MTA＝メールを運ぶサーバー、MDA＝メールボックスにしまう係、MUA＝メールを読み書きするアプリ。この部屋のサーバーは、すべてブラウザの中のしくみで動いていて、外とはつながりません（example.com などは説明用の名前です）。",
  doneKey: "odekake_infra_mail_v1",
  cards: MAIL_CARDS as unknown as AnyCard[],
  chapters: MAIL_CHAPTERS,
  seedBase: MAIL_SEED_BASE,
  cardLabel: (c) => mailCardLabel(c as unknown as MailCard),
  prepare: (card, on, probe) => prepareMailLab(card as unknown as MailCard, on, undefined, probe) as unknown as ReturnType<Subject["prepare"]>,
  hosts: HOSTS,
  hostIds: HOST_IDS,
  hostGlyph,
  hostColor,
  hostShort: (h) => (h === "pc" ? "パソコン" : h === "mail" ? "メール" : "外"),
  hostRole: HOST_ROLE,
  thing: "メールサーバー",
  panels: ["trace", "packets", "logs", "boxes", "config"],
  panelLabel: PANEL_LABEL,
  renderPanel,
  net: (runs) => net(runs as unknown as (Run | null)[]),
  outcome: (r) => outcome(r as unknown as Run),
};
