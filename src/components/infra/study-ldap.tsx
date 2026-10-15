"use client";

/**
 * 勉強部屋の教科「LDAP」：3台の図の線の決め方・ログ／名簿／設定のパネル・結果のひとこと。
 * 画面そのものは study-room.tsx（LDAP・メールで同じ）。
 */
import { type CSSProperties } from "react";
import { Glyph, type GlyphId } from "./glyphs";
import { CARDS, CHAPTERS, SEED_BASE, cardLabel, prepareLab, type StudyCard } from "./ldap-lessons";
import { HOST_IP, RESULT_JA, clockText, type HostId, type TreeNode } from "./ldap";
import { HOSTS, HOST_IDS, ldapConf, sssdConf, type LdapLab, type Run } from "./ldap-shell";
import { ConfText, PacketPanel, TracePanel, blankWire, stateJa, type AnyCard, type Last, type NetView, type PanelProps, type Subject, type Wire, type WireState } from "./study-ui";
import styles from "./infra.module.css";

const hostGlyph = (id: string): GlyphId => (id === "pc" ? "user" : id === "ldap" ? "db" : "app");
const hostColor = (id: string) => (id === "pc" ? "#9fb4ff" : id === "ldap" ? "#b08cff" : "#5fd8ff");

const HOST_ROLE: Record<HostId, string> = {
  pc: "あなたがコマンドを打つ",
  ldap: "名簿をしまっている（slapd）",
  shop: "名簿を見て、ログインさせる（SSSD）",
};

/* ------------------------------------------------------------ 3台の図 */

/** そのコマンド（先に動かしたものもふくむ）で、どの線に、どんなつながりが流れたか（ops の順に見る） */
function wires(runs: (Run | null)[]): { pcLdap: Wire; shopLdap: Wire; pcShop: Wire; local: boolean } {
  const w = { pcLdap: blankWire(), shopLdap: blankWire(), pcShop: blankWire(), local: false };
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

/** 上に LDAP サーバー、左下にあなたのパソコン、右下にお店のサーバー */
function net(runs: (Run | null)[]): NetView {
  const w = wires(runs);
  const said = [
    w.pcLdap.lit ? `パソコンと LDAP サーバー：${stateJa(w.pcLdap)}` : "",
    w.shopLdap.lit ? `お店のサーバーと LDAP サーバー：${stateJa(w.shopLdap)}` : "",
    w.pcShop.lit ? "パソコンとお店のサーバー：SSH（暗号）" : "",
    w.local ? "LDAP サーバーの中から（ldapi）" : "",
  ].filter(Boolean);
  const node = (id: HostId, x: number, y: number) => ({ id, x, y, label: HOSTS[id].label, glyph: hostGlyph(id), color: hostColor(id), tag: id === "ldap" && w.local ? "中から（ldapi）" : undefined });
  return {
    nodes: [node("ldap", 50, 20), node("pc", 16, 72), node("shop", 84, 72)],
    lines: [
      { a: "ldap", b: "pc", wire: w.pcLdap, name: "LDAP", t: 0.6 },
      { a: "ldap", b: "shop", wire: w.shopLdap, name: "SSSD", t: 0.6 },
      { a: "pc", b: "shop", wire: w.pcShop, name: "SSH", t: 0.5 },
    ],
    label: `3台の図。${said.length ? `いまのコマンドで流れた線：${said.join("、")}` : "まだ何も流れていません"}`,
  };
}

/* ------------------------------------------------------------ 結果のひとこと */

/** 結果のひとこと（成功・49 ログインできない など） */
function outcome(r: Run): { ok: boolean; text: string } {
  const ssh = r.ops.find((o) => o.kind === "ssh");
  if (ssh) return ssh.code === 0 ? { ok: true, text: "ログインできた" } : { ok: false, text: ssh.stage === "access" ? "入れない（ログインの条件）" : "ログインできない" };
  if (r.exit === 0) return { ok: true, text: "成功（0）" };
  const ja = RESULT_JA[r.exit];
  return { ok: false, text: ja ? `${r.exit}（${ja}）` : `終了コード ${r.exit}` };
}



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

/* ------------------------------------------------------------ 教科 */

const PANEL_LABEL: Record<string, string> = { trace: "サーバーの中", packets: "パケット", logs: "ログ", tree: "名簿", config: "設定" };
const prompt = (h: string) => HOSTS[h as HostId]?.prompt ?? "$";

function renderPanel({ panel, lab, last, card, keyRef }: PanelProps) {
  const l = lab as unknown as LdapLab;
  const c = card as unknown as StudyCard;
  const run = (last?.run ?? null) as Run | null;
  if (panel === "trace") return <TracePanel last={last} keyRef={keyRef} prompt={prompt} />;
  if (panel === "packets")
    return (
      <PacketPanel
        run={last?.run ?? null}
        lead={
          <>
            コンピューターどうしのあいだを、実際に流れたバイトです。<b className={styles.studyKey}>赤いところ</b>は、あなたのパスワード。
            <b>TLS（暗号）</b>のときは中身が読めません。LDAP サーバーの中から（ldapi）や、お店のサーバーの中の SSSD の話は、ここには出ません。
          </>
        }
      />
    );
  if (panel === "logs") return <LogPanel lab={l} run={run} />;
  if (panel === "tree") return <TreePanel lab={l} />;
  return <ConfigPanel lab={l} card={c} last={last} />;
}

export const LDAP_SUBJECT: Subject = {
  id: "ldap",
  name: "LDAP（名簿）",
  sub: "勉強部屋・LDAP",
  lead: (
    <>
      会社やお店の「名簿サーバー」、<b>LDAP</b> の勉強部屋です。1枚のカードで1つの設定を、「なかったらどう動くか」→「入れると何が変わるか」の順に、
      本物のコマンドを打ってたしかめよう。
    </>
  ),
  foot: "LDAP＝Lightweight Directory Access Protocol。社員・パソコン・グループを1か所にまとめて、ログインや権限に使うしくみです。この部屋のサーバーは、すべてブラウザの中のしくみで動いていて、外とはつながりません。",
  doneKey: "odekake_infra_study_v1",
  cards: CARDS as unknown as AnyCard[],
  chapters: CHAPTERS,
  seedBase: SEED_BASE,
  cardLabel: (c) => cardLabel(c as unknown as StudyCard),
  prepare: (card, on) => prepareLab(card as unknown as StudyCard, on) as unknown as ReturnType<Subject["prepare"]>,
  hosts: HOSTS,
  hostIds: HOST_IDS,
  hostGlyph,
  hostColor,
  hostShort: (h) => (h === "pc" ? "パソコン" : h === "ldap" ? "LDAP" : "お店"),
  hostRole: HOST_ROLE,
  thing: "名簿",
  panels: ["trace", "packets", "logs", "tree", "config"],
  panelLabel: PANEL_LABEL,
  renderPanel,
  net: (runs) => net(runs as (Run | null)[]),
  outcome: (r) => outcome(r as unknown as Run),
};
