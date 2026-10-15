/**
 * 勉強部屋（メールサーバー）の本体：ブラウザの中だけで動く、小さな「メールの世界」。
 *
 * - メールサーバー（mail）… MTA は Postfix（main.cf・master.cf・/etc/aliases）か sendmail（sendmail.mc → m4 → sendmail.cf・access）。
 *   メールボックスと IMAP・POP3・LMTP（Sieve）・SMTP AUTH の受け口は Dovecot（/etc/dovecot/conf.d/*.conf）
 * - あなたのパソコン（pc）・外のサーバー（out）… swaks（SMTP）・curl（IMAP・POP3）でつなぐ（コマンドは mail-shell.ts）
 * - インターネットの向こう（example.com の MX・プロバイダの中継サーバー）… 何でも受けとる、決まった相手
 *
 * 設定は「書いたもの（ファイル）」と「動いているもの（読みこんだときの写し）」を分けてある。
 * main.cf は postfix reload、dovecot の設定は systemctl reload dovecot、sendmail.cf は systemctl restart sendmail で読みこむ。
 * /etc/aliases は newaliases、/etc/mail/access は makemap で .db にしてはじめて効く（.db は毎回読むので、再起動はいらない）。
 *
 * どの操作も、maillog（本物と同じ形）・「サーバーの中で起きたこと（trace）」・流れたパケットを残す。
 * 外とはつながらない（名前も IP も、この中だけのもの。example.com・example.net・.example は説明用に決められた名前）。
 */
import { b64encode, b64text, concat, randomBytes, seeded, tlsRecord, utf8 } from "./ldap-bits";
import type { OutLine, TraceItem, TraceTone } from "./ldap";

export type { OutLine, TraceItem, TraceTone };

/* ------------------------------------------------------------ ネットワーク */

export type HostId = "pc" | "mail" | "out";
export const HOST_IDS: readonly HostId[] = ["pc", "mail", "out"];
export const HOST_IP: Record<HostId, string> = { pc: "192.168.10.5", mail: "192.168.10.3", out: "203.0.113.80" };
export const HOST_FQDN: Record<HostId, string> = { pc: "pc.wanko.shop", mail: "mail.wanko.shop", out: "host80.example.net" };
export const DOMAIN = "wanko.shop";
/** 友だちのお店（example.com）のメールサーバー */
export const MX_REMOTE = { name: "mx.example.com", ip: "198.51.100.7" };
/** プロバイダ（インターネットの会社）の中継サーバー */
export const ISP = { name: "smtp.isp.example", ip: "198.51.100.20" };

const A_RECORDS: Record<string, string> = {
  "mail.wanko.shop": HOST_IP.mail,
  "pc.wanko.shop": HOST_IP.pc,
  "host80.example.net": HOST_IP.out,
  "mx.example.com": MX_REMOTE.ip,
  "mx.example.net": "198.51.100.8",
  "smtp.isp.example": ISP.ip,
  localhost: "127.0.0.1",
};
const MX_RECORDS: Record<string, string> = { "wanko.shop": "mail.wanko.shop", "example.com": "mx.example.com", "example.net": "mx.example.net" };

const bare = (name: string) => name.toLowerCase().replace(/\.$/, "");
export const resolveA = (name: string): string | null => (/^\d+\.\d+\.\d+\.\d+$/.test(name) ? name : (A_RECORDS[bare(name)] ?? null));
export const resolveMx = (domain: string): string | null => MX_RECORDS[bare(domain)] ?? null;
/** IP → 名前（逆引き。知らなければ unknown） */
export function ptrName(ip: string): string {
  if (ip === "127.0.0.1") return "localhost";
  for (const [name, a] of Object.entries(A_RECORDS)) if (a === ip && name !== "localhost") return name;
  return "unknown";
}
/** インターネットの向こうの、なんでも受けとるメールサーバーか */
const isRemoteIp = (ip: string) => ip.startsWith("198.51.100.");

export function inCidr(ip: string, cidr: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)(?:\/(\d+))?$/.exec(cidr.trim());
  const n = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (!m || !n) return false;
  const bits = m[5] == null ? 32 : Number(m[5]);
  if (bits > 32) return false;
  const v = (x: RegExpExecArray) => ((Number(x[1]) << 24) | (Number(x[2]) << 16) | (Number(x[3]) << 8) | Number(x[4])) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (v(m) & mask) === (v(n) & mask);
}

/* ------------------------------------------------------------ 記録（画面に出すもの） */

export type Proto = "SMTP" | "IMAP" | "POP3" | "TLS";
export type Packet = {
  no: number;
  from: string;
  to: string;
  proto: Proto;
  info: string;
  bytes: Uint8Array;
  secret: [number, number] | null;
  secretText: string | null;
  /** secret の部分の読み方（base64 をもどすと… など） */
  secretHow?: string;
};
export type LogSrc = "postfix" | "dovecot" | "sendmail" | "system";
export type LogLine = { at: number; src: LogSrc; text: string };
export type WireMode = "plain" | "starttls" | "tls";
export type OpKind = "smtp" | "imap" | "pop3" | "deliver" | "config" | "service" | "queue" | "file" | "dns";
export type DeliverHow = "mbox" | "maildir" | "lmtp" | "remote" | "deferred" | "bounced";
export type OpRecord = {
  kind: OpKind;
  code: number;
  /** つないだもと・さき（smtp・imap・pop3） */
  from?: HostId;
  to?: "mail" | "net";
  /** メールサーバーの中から（localhost）つないだ */
  local?: boolean;
  port?: number;
  mode?: WireMode;
  /** パスワードが平文（か base64）で流れた */
  leak?: boolean;
  /** つながらなかった（connection refused など） */
  refused?: boolean;
  authed?: boolean;
  /** 受けとってもらえた（250 queued・Message accepted） */
  accepted?: boolean;
  /** deliver */
  how?: DeliverHow;
  rcpt?: string;
  via?: string;
  folder?: string;
  note?: string;
};

export class RunLog {
  trace: TraceItem[] = [];
  logs: LogLine[] = [];
  ops: OpRecord[] = [];
  packets: Packet[] = [];
  note(text: string, tone: TraceTone = "info", ref?: string) {
    const last = this.trace[this.trace.length - 1];
    if (last && last.text === text && last.tone === tone && last.ref === ref) return;
    if (this.trace.length < 200) this.trace.push({ text, tone, ref });
  }
}

/* ------------------------------------------------------------ 時刻 */

/** 2026-10-15 10:00:00（日本の時刻） */
const T0 = Date.UTC(2026, 9, 15, 1, 0, 0);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const jst = (ms: number) => new Date(ms + 9 * 3600e3);
const p2 = (n: number) => String(n).padStart(2, "0");
export const clockText = (ms: number) => jst(ms).toISOString().slice(11, 19);
/** syslog の時刻（Oct 15 10:02:11） */
export const syslogTime = (ms: number) => {
  const d = jst(ms);
  return `${MON[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, " ")} ${clockText(ms)}`;
};
/** メールの Date: の形（Thu, 15 Oct 2026 10:02:11 +0900） */
export const rfcDate = (ms: number) => {
  const d = jst(ms);
  return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()} ${clockText(ms)} +0900`;
};
/** mbox の From の行の時刻（Thu Oct 15 10:02:11 2026） */
const ctime = (ms: number) => {
  const d = jst(ms);
  return `${DOW[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, " ")} ${clockText(ms)} ${d.getUTCFullYear()}`;
};

/* ------------------------------------------------------------ 人とメール */

export type User = { name: string; uid: number; label: string };
export const USERS: readonly User[] = [
  { name: "pochi", uid: 1001, label: "店長" },
  { name: "hana", uid: 1002, label: "副店長" },
  { name: "momo", uid: 1003, label: "スタッフ" },
  { name: "kuro", uid: 1004, label: "スタッフ" },
];
/** ログインできないシステムのユーザー（/etc/passwd にはいる。aliases の行き先になる） */
const SYSTEM_USERS = ["root", "postfix", "dovecot", "nobody", "mail"];
export const isUser = (name: string) => USERS.some((u) => u.name === name) || SYSTEM_USERS.includes(name);
export const homeOf = (name: string) => (name === "root" ? "/root" : `/home/${name}`);

export type Mail = {
  qid: string;
  from: string;
  rcpts: string[];
  /** 上から順のヘッダー（Received: などは、届けるときに上へ足す） */
  head: [string, string][];
  body: string;
  at: number;
  size: number;
};
export const headerOf = (m: Mail, name: string) => m.head.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] ?? "";

/** メールボックスにしまった1通 */
export type Stored = { mail: Mail; uid: number; to: string; orig?: string; file: string; received: string[] };

export type QueueItem = { qid: string; mail: Mail; pending: string[]; status: "active" | "deferred"; reason: string; arrival: number; client: string };
export type RemoteMail = { server: string; rcpt: string; mail: Mail; via: string };

/** メールの文字（ヘッダー＋本文）。mbox・IMAP の FETCH・packet に使う */
export function mailText(m: Mail, extra: string[] = []): string {
  return [...extra, ...m.head.map(([k, v]) => `${k}: ${v}`), "", m.body].join("\n");
}

/* ------------------------------------------------------------ Postfix の設定（main.cf） */

/** postconf -d（初めから決まっている値）。この部屋で使うものだけ */
export const PF_DEFAULTS: Record<string, string> = {
  alias_database: "hash:/etc/aliases",
  alias_maps: "hash:/etc/aliases, nis:mail.aliases",
  command_directory: "/usr/sbin",
  compatibility_level: "0",
  daemon_directory: "/usr/libexec/postfix",
  default_transport: "smtp",
  home_mailbox: "",
  inet_interfaces: "all",
  inet_protocols: "all",
  local_recipient_maps: "proxy:unix:passwd.byname $alias_maps",
  mail_name: "Postfix",
  mail_owner: "postfix",
  mail_spool_directory: "/var/mail",
  mail_version: "3.8.5",
  mailbox_size_limit: "51200000",
  mailbox_transport: "",
  message_size_limit: "10240000",
  mydestination: "$myhostname, localhost.$mydomain, localhost",
  mydomain: DOMAIN,
  myhostname: "mail.wanko.shop",
  mynetworks_style: "host",
  myorigin: "$myhostname",
  queue_directory: "/var/spool/postfix",
  relay_domains: "",
  relayhost: "",
  smtpd_banner: "$myhostname ESMTP $mail_name",
  smtpd_recipient_restrictions: "",
  smtpd_relay_restrictions: "permit_mynetworks, permit_sasl_authenticated, defer_unauth_destination",
  smtpd_sasl_auth_enable: "no",
  smtpd_sasl_path: "smtpd",
  smtpd_sasl_type: "cyrus",
  smtpd_tls_auth_only: "no",
  smtpd_tls_cert_file: "",
  smtpd_tls_key_file: "",
  smtpd_tls_security_level: "",
  unknown_local_recipient_reject_code: "550",
};

/** main.cf を読む（# はコメント、行頭が空白なら前の行の続き）。同じ名前は、うしろが勝つ */
export function parseMainCf(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let last: string | null = null;
  for (const raw of text.split("\n")) {
    if (/^\s*#/.test(raw) || !raw.trim()) {
      if (!raw.trim()) last = null;
      continue;
    }
    if (/^\s/.test(raw) && last) {
      out.set(last, `${out.get(last)} ${raw.trim()}`.trim());
      continue;
    }
    const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(raw);
    if (!m) {
      last = null;
      continue;
    }
    last = m[1]!;
    out.set(last, m[2]!.trim());
  }
  return out;
}

/** postconf -e：その名前の行（続きの行も）を書きかえる。なければ最後に足す */
export function editMainCf(text: string, name: string, value: string): string {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => new RegExp(`^${name}\\s*=`).test(l));
  const line = `${name} = ${value}`;
  if (at < 0) {
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return [...lines, line, ""].join("\n");
  }
  let end = at + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end]!) && !/^\s*#/.test(lines[end]!)) end++;
  lines.splice(at, end - at, line);
  return lines.join("\n");
}

/** 名前で値を引く（main.cf になければ初めの値。mynetworks は mynetworks_style から作る） */
export function pfRaw(conf: Map<string, string>, name: string): string | null {
  const v = conf.get(name);
  if (v != null) return v;
  if (name === "mynetworks") {
    const style = pfGet(conf, "mynetworks_style");
    return style === "subnet" ? `127.0.0.0/8 ${HOST_IP.mail.replace(/\.\d+$/, ".0")}/24` : style === "class" ? "127.0.0.0/8 192.168.0.0/16" : `127.0.0.0/8 ${HOST_IP.mail}/32`;
  }
  return PF_DEFAULTS[name] ?? null;
}

/** $name・${name}・$(name) を中身に置きかえた値 */
export function pfGet(conf: Map<string, string>, name: string, depth = 0): string {
  const raw = pfRaw(conf, name) ?? "";
  if (depth > 8) return raw;
  return raw.replace(/\$(?:\{([A-Za-z0-9_]+)\}|\(([A-Za-z0-9_]+)\)|([A-Za-z0-9_]+))/g, (_, a, b, c) => pfGet(conf, (a ?? b ?? c) as string, depth + 1));
}
export const pfList = (conf: Map<string, string>, name: string) => pfGet(conf, name).split(/[\s,]+/).filter(Boolean);
export const pfYes = (conf: Map<string, string>, name: string) => /^(yes|true|1)$/i.test(pfGet(conf, name));

/** master.cf の、外から受けるサービス（smtp・submission・smtps）と、その -o の上書き */
export type PfService = { name: string; port: number; over: Map<string, string> };
const SERVICE_PORT: Record<string, number> = { smtp: 25, submission: 587, smtps: 465, submissions: 465 };
export function parseMasterCf(text: string): PfService[] {
  const out: PfService[] = [];
  let cur: PfService | null = null;
  for (const raw of text.split("\n")) {
    if (/^\s*#/.test(raw) || !raw.trim()) continue;
    if (/^\s/.test(raw)) {
      const m = /^\s+-o\s+([A-Za-z0-9_]+)=(.*)$/.exec(raw);
      if (m && cur) cur.over.set(m[1]!, m[2]!.trim());
      continue;
    }
    const f = raw.trim().split(/\s+/);
    cur = null;
    if (f[1] === "inet" && f[7] === "smtpd") {
      const port = SERVICE_PORT[f[0]!] ?? (/^\d+$/.test(f[0]!) ? Number(f[0]) : 0);
      if (port) {
        cur = { name: f[0]!, port, over: new Map() };
        out.push(cur);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------ Dovecot の設定 */

export const DC_DEFAULTS: Record<string, string> = {
  protocols: "imap pop3 lmtp",
  disable_plaintext_auth: "yes",
  auth_mechanisms: "plain",
  ssl: "yes",
  ssl_cert: "",
  ssl_key: "",
  mail_location: "",
  mail_plugins: "",
  lda_mailbox_autocreate: "no",
};

/**
 * Dovecot の設定ファイルを読む。入れ子（service auth { unix_listener … { mode = 0660 } }）は「service auth/unix_listener …/mode」の形の名前にする。
 * 「mail_plugins = $mail_plugins sieve」のような $ は、その時点の同じ名前の値に置きかえる
 */
export function parseDovecot(files: [string, string][]): { conf: Map<string, string>; errors: string[] } {
  const conf = new Map<string, string>();
  const errors: string[] = [];
  for (const [path, text] of files) {
    const stack: string[] = [];
    text.split("\n").forEach((raw, k) => {
      const line = raw.replace(/(^|\s)#.*$/, "").trim();
      if (!line || line.startsWith("!include")) return;
      if (line === "}") {
        if (!stack.length) errors.push(`${path} line ${k + 1}: Unexpected '}'`);
        stack.pop();
        return;
      }
      const open = /^([A-Za-z0-9_]+)(?:\s+(\S+))?\s*\{$/.exec(line);
      if (open) {
        stack.push(open[2] ? `${open[1]} ${open[2]}` : open[1]!);
        return;
      }
      const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) {
        errors.push(`${path} line ${k + 1}: Unknown setting: ${line.split(/\s/)[0]}`);
        return;
      }
      const key = [...stack, m[1]!].join("/");
      const prev = conf.get(key) ?? conf.get(m[1]!) ?? DC_DEFAULTS[m[1]!] ?? "";
      conf.set(key, m[2]!.replace(new RegExp(`\\$${m[1]}\\b`, "g"), prev).replace(/\s+/g, " ").trim());
    });
    if (stack.length) errors.push(`${path}: Missing '}'`);
  }
  return { conf, errors };
}
export const dcGet = (dc: Map<string, string>, key: string, protocol?: string) => (protocol ? dc.get(`protocol ${protocol}/${key}`) : undefined) ?? dc.get(key) ?? DC_DEFAULTS[key] ?? "";
export const dcHas = (dc: Map<string, string>, prefix: string) => [...dc.keys()].some((k) => k.startsWith(prefix));
/** Postfix が SMTP AUTH で使う、Dovecot の受け口 */
export const AUTH_SOCKET = "service auth/unix_listener /var/spool/postfix/private/auth";
/** Postfix が LMTP で渡す、Dovecot の受け口 */
export const LMTP_SOCKET = "service lmtp/unix_listener /var/spool/postfix/private/dovecot-lmtp";

/* ------------------------------------------------------------ sendmail の設定 */

/** sendmail.mc を m4 にかけて sendmail.cf を作る（この部屋で使う行だけ。dnl で始まる行はコメント） */
export function m4Sendmail(mc: string): { cf: string; error: string | null } {
  const ticks = (mc.match(/`/g) ?? []).length;
  const quotes = (mc.match(/'/g) ?? []).length;
  if (ticks !== quotes) return { cf: "", error: "m4:sendmail.mc: end of file in string" };
  const lines = [
    "#",
    "#  sendmail.cf — m4 sendmail.mc で作ったファイル。直接書きかえないで、sendmail.mc を直して作りなおす",
    "#",
    "V10/Berkeley",
    "Cwlocalhost",
    "Fw/etc/mail/local-host-names",
  ];
  let daemon = 0;
  for (const raw of mc.split("\n")) {
    const l = raw.trim();
    if (!l || l.startsWith("dnl")) continue;
    const d = /^DAEMON_OPTIONS\(`([^']*)'\)/.exec(l);
    if (d) {
      lines.push(`O DaemonPortOptions=${d[1]}`);
      daemon++;
    }
    const f = /^FEATURE\(`([a-z_]+)'/.exec(l);
    if (f?.[1] === "access_db") lines.push("Kaccess hash -T<TMPF> -o /etc/mail/access.db");
    const a = /^define\(`ALIAS_FILE',\s*`([^']*)'\)/.exec(l);
    if (a) lines.push(`O AliasFile=${a[1]}`);
  }
  if (!daemon) lines.push("O DaemonPortOptions=Name=MTA");
  lines.push("O QueueDirectory=/var/spool/mqueue", "Mlocal,\t\tP=/usr/bin/procmail, F=SPfhn9, S=EnvFromSMTP/HdrFromL, R=EnvToL/HdrToL", "Mesmtp,\t\tP=[IPC], F=mDFMuXa, S=EnvFromSMTP/HdrFromSMTP, R=EnvToSMTP, E=\\r\\n, L=990", "");
  return { cf: lines.join("\n"), error: null };
}

/** sendmail.cf から、待ち受けるアドレス（Addr=。書いていなければ 0.0.0.0＝どこからでも） */
export function sendmailListen(cf: string): string {
  const m = /^O DaemonPortOptions=(.*)$/m.exec(cf);
  const addr = m ? /Addr=([^,\s]+)/.exec(m[1]!) : null;
  return addr?.[1] ?? "0.0.0.0";
}

/** /etc/mail/access の中身（Connect:192.168.10 RELAY など） */
export function parseAccess(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.split("\n")) {
    const l = raw.replace(/#.*$/, "").trim();
    if (!l) continue;
    const [k, ...v] = l.split(/\s+/);
    if (k && v.length) out.set(k.toLowerCase(), v.join(" "));
  }
  return out;
}

/** /etc/aliases の中身（info: pochi, hana） */
export function parseAliases(text: string): { map: Map<string, string[]>; errors: string[] } {
  const map = new Map<string, string[]>();
  const errors: string[] = [];
  let last: string | null = null;
  text.split("\n").forEach((raw, k) => {
    if (/^\s*#/.test(raw) || !raw.trim()) return;
    if (/^\s/.test(raw) && last) {
      map.get(last)!.push(...raw.split(",").map((s) => s.trim()).filter(Boolean));
      return;
    }
    const m = /^([^:\s]+)\s*:\s*(.*)$/.exec(raw);
    if (!m) {
      errors.push(`/etc/aliases, line ${k + 1}: name must end in colon`);
      return;
    }
    last = m[1]!.toLowerCase();
    map.set(last, m[2]!.split(",").map((s) => s.trim()).filter(Boolean));
  });
  return { map, errors };
}

/* ------------------------------------------------------------ Sieve（小さな読み手） */

type SieveTok = { t: "str" | "tag" | "id" | "num" | "sym"; v: string; line: number };
export type SieveResult = { folders: string[]; discard: boolean; errors: string[]; trace: string[] };

function sieveLex(src: string): SieveTok[] | string {
  const out: SieveTok[] = [];
  let line = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (c === "\n") line++;
    if (/\s/.test(c)) continue;
    if (c === "#") {
      while (i < src.length && src[i] !== "\n") i++;
      line++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) return `line ${line}: error: unterminated comment`;
      line += (src.slice(i, end).match(/\n/g) ?? []).length;
      i = end + 1;
      continue;
    }
    if (c === '"') {
      let v = "";
      let j = i + 1;
      for (; j < src.length && src[j] !== '"'; j++) {
        if (src[j] === "\\" && j + 1 < src.length) j++;
        v += src[j];
      }
      if (j >= src.length) return `line ${line}: error: unterminated string`;
      out.push({ t: "str", v, line });
      line += (v.match(/\n/g) ?? []).length;
      i = j;
      continue;
    }
    if (c === ":") {
      const m = /^:[A-Za-z_]+/.exec(src.slice(i));
      if (!m) return `line ${line}: error: unexpected character ':'`;
      out.push({ t: "tag", v: m[0].toLowerCase(), line });
      i += m[0].length - 1;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) {
      out.push({ t: "id", v: id[0].toLowerCase(), line });
      i += id[0].length - 1;
      continue;
    }
    const num = /^\d+[KMG]?/.exec(src.slice(i));
    if (num) {
      out.push({ t: "num", v: num[0], line });
      i += num[0].length - 1;
      continue;
    }
    if ("{}[](),;".includes(c)) {
      out.push({ t: "sym", v: c, line });
      continue;
    }
    return `line ${line}: error: unexpected character '${c}'`;
  }
  return out;
}

type SieveTest = { kind: "header" | "address" | "true" | "false" | "not" | "anyof" | "allof" | "exists"; match: string; names: string[]; keys: string[]; part?: string; sub: SieveTest[] };
type SieveCmd = { kind: "if"; branches: { test: SieveTest | null; body: SieveCmd[] }[] } | { kind: "fileinto" | "keep" | "discard" | "stop" | "redirect"; arg: string };

/** Sieve を読んで、そのメールの行き先を決める（RFC 5228 のうち、よく使うところだけ） */
export function runSieve(src: string, mail: Mail): SieveResult {
  const res: SieveResult = { folders: [], discard: false, errors: [], trace: [] };
  const toks = sieveLex(src);
  if (typeof toks === "string") {
    res.errors.push(toks);
    return res;
  }
  let at = 0;
  const required = new Set<string>();
  const peek = () => toks[at];
  const fail = (msg: string, line = peek()?.line ?? toks[toks.length - 1]?.line ?? 1): never => {
    throw new Error(`line ${line}: error: ${msg}`);
  };
  const want = (v: string) => {
    const t = toks[at];
    if (!t || t.t !== "sym" || t.v !== v) fail(`expected '${v}'${t ? ` but found ${t.t === "str" ? "string" : `'${t.v}'`}` : " but found end of script"}`);
    at++;
  };
  const strList = (): string[] => {
    const t = toks[at];
    if (t?.t === "str") {
      at++;
      return [t.v];
    }
    if (t?.t === "sym" && t.v === "[") {
      at++;
      const out: string[] = [];
      for (;;) {
        const s = toks[at];
        if (s?.t !== "str") fail("expected string in string list");
        out.push(s!.v);
        at++;
        if (peek()?.t === "sym" && peek()!.v === ",") {
          at++;
          continue;
        }
        want("]");
        return out;
      }
    }
    return fail("expected string or string list");
  };
  const test = (): SieveTest => {
    const t = toks[at];
    if (t?.t !== "id") return fail("expected test");
    at++;
    const blank: SieveTest = { kind: "true", match: ":is", names: [], keys: [], sub: [] };
    if (t.v === "true" || t.v === "false") return { ...blank, kind: t.v };
    if (t.v === "not") return { ...blank, kind: "not", sub: [test()] };
    if (t.v === "anyof" || t.v === "allof") {
      want("(");
      const sub = [test()];
      while (peek()?.t === "sym" && peek()!.v === ",") {
        at++;
        sub.push(test());
      }
      want(")");
      return { ...blank, kind: t.v, sub };
    }
    if (t.v === "exists") return { ...blank, kind: "exists", names: strList() };
    if (t.v === "header" || t.v === "address") {
      let match = ":is";
      let part: string | undefined;
      while (peek()?.t === "tag") {
        const g = toks[at++]!.v;
        if (g === ":is" || g === ":contains" || g === ":matches") match = g;
        else if (g === ":all" || g === ":localpart" || g === ":domain") part = g;
        else if (g === ":comparator") strList();
        else fail(`unknown tagged argument '${g}' for the ${t.v} test`, t.line);
      }
      return { ...blank, kind: t.v, match, part, names: strList(), keys: strList() };
    }
    return fail(`unknown test '${t.v}'`, t.line);
  };
  const block = (top: boolean): SieveCmd[] => {
    const out: SieveCmd[] = [];
    for (;;) {
      const t = peek();
      if (!t) {
        if (!top) fail("expected '}' but found end of script");
        return out;
      }
      if (t.t === "sym" && t.v === "}") {
        if (top) fail("unexpected '}'");
        return out;
      }
      if (t.t !== "id") fail(`expected command but found ${t.t === "str" ? "string" : `'${t.v}'`}`);
      at++;
      const name = t.v;
      if (name === "require") {
        if (!top) fail("require command can only be placed at top level at the beginning of the file", t.line);
        for (const ext of strList()) {
          if (!["fileinto", "envelope", "reject", "vacation", "imap4flags", "copy"].includes(ext)) fail(`require command: unknown Sieve capability '${ext}'`, t.line);
          required.add(ext);
        }
        want(";");
      } else if (name === "if") {
        const branches: { test: SieveTest | null; body: SieveCmd[] }[] = [];
        const tst = test();
        want("{");
        branches.push({ test: tst, body: block(false) });
        want("}");
        for (;;) {
          const n = peek();
          if (n?.t === "id" && n.v === "elsif") {
            at++;
            const t2 = test();
            want("{");
            branches.push({ test: t2, body: block(false) });
            want("}");
          } else if (n?.t === "id" && n.v === "else") {
            at++;
            want("{");
            branches.push({ test: null, body: block(false) });
            want("}");
            break;
          } else break;
        }
        out.push({ kind: "if", branches });
      } else if (name === "fileinto" || name === "redirect") {
        if (name === "fileinto" && !required.has("fileinto")) fail("fileinto command: missing require \"fileinto\"", t.line);
        while (peek()?.t === "tag") at++;
        const arg = toks[at];
        if (arg?.t !== "str") fail(`${name} command: expected string argument`, t.line);
        at++;
        want(";");
        out.push({ kind: name, arg: arg!.v });
      } else if (name === "keep" || name === "discard" || name === "stop") {
        want(";");
        out.push({ kind: name, arg: "" });
      } else fail(`unknown command '${name}' (only reported once at first occurrence)`, t.line);
    }
  };
  let prog: SieveCmd[];
  try {
    prog = block(true);
  } catch (e) {
    res.errors.push((e as Error).message);
    return res;
  }
  const match = (how: string, value: string, key: string) => {
    const v = value.toLowerCase();
    const k = key.toLowerCase();
    if (how === ":contains") return v.includes(k);
    if (how === ":matches") return new RegExp(`^${k.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`).test(v);
    return v === k;
  };
  const evalTest = (t: SieveTest): boolean => {
    switch (t.kind) {
      case "true":
        return true;
      case "false":
        return false;
      case "not":
        return !evalTest(t.sub[0]!);
      case "anyof":
        return t.sub.some(evalTest);
      case "allof":
        return t.sub.every(evalTest);
      case "exists":
        return t.names.every((n) => headerOf(mail, n) !== "");
      default:
        return t.names.some((n) => {
          let v = headerOf(mail, n);
          if (t.kind === "address") {
            const addr = /<([^>]*)>/.exec(v)?.[1] ?? v;
            v = t.part === ":localpart" ? (addr.split("@")[0] ?? "") : t.part === ":domain" ? (addr.split("@")[1] ?? "") : addr;
          }
          return t.keys.some((k) => match(t.match, v, k));
        });
    }
  };
  let stopped = false;
  let kept = false;
  const exec = (cmds: SieveCmd[]) => {
    for (const c of cmds) {
      if (stopped) return;
      if (c.kind === "if") {
        for (const b of c.branches) {
          if (b.test == null || evalTest(b.test)) {
            res.trace.push(b.test == null ? "else に入った" : `if の条件に合った`);
            exec(b.body);
            break;
          }
        }
      } else if (c.kind === "fileinto") {
        res.folders.push(c.arg);
        res.trace.push(`fileinto "${c.arg}"`);
      } else if (c.kind === "keep") kept = true;
      else if (c.kind === "discard") res.discard = true;
      else if (c.kind === "stop") stopped = true;
    }
  };
  exec(prog);
  // fileinto も discard もなければ、ふつうに INBOX（implicit keep）
  if (kept || (!res.folders.length && !res.discard)) res.folders.push("INBOX");
  return res;
}

/* ------------------------------------------------------------ メールの世界 */

export type Mta = "postfix" | "sendmail";
type SmtpKind = "postfix" | "sendmail" | "remote";

export type WorldInit = {
  seed: number;
  mta: Mta;
  /** メールサーバーのファイル（main.cf・aliases・dovecot の設定 など）。パスは /etc/… */
  files: Record<string, string>;
  /** プロバイダが、外への 25番を止めている（OP25B） */
  op25b?: boolean;
  /** それぞれの人の、ログインのパスワード（/etc/shadow のかわり） */
  passwords: Record<string, string>;
};

export class MailWorld {
  rand: () => number;
  clock = T0;
  mta: Mta;
  op25b: boolean;
  /** メールサーバーのファイル（書いたもの） */
  files = new Map<string, string>();
  /** 動いている Postfix が読みこんだ設定（null は止まっている） */
  pf: { conf: Map<string, string>; services: PfService[] } | null = null;
  /** 動いている Dovecot が読みこんだ設定 */
  dc: Map<string, string> | null = null;
  /** 動いている sendmail */
  sm: { listen: string; cw: Set<string> } | null = null;
  /** newaliases・makemap で作った .db（null はまだない） */
  aliasDb: Map<string, string[]> | null = null;
  accessDb: Map<string, string> | null = null;
  passwords: Map<string, string>;
  queue: QueueItem[] = [];
  mboxes = new Map<string, Stored[]>();
  maildirs = new Map<string, Map<string, Stored[]>>();
  remote: RemoteMail[] = [];
  logs: LogLine[] = [];
  private pid = 2100;
  private packetNo = 0;
  private uidNext = new Map<string, number>();

  constructor(init: WorldInit) {
    this.rand = seeded(init.seed);
    this.mta = init.mta;
    this.op25b = Boolean(init.op25b);
    this.passwords = new Map(Object.entries(init.passwords));
    for (const [k, v] of Object.entries(init.files)) this.files.set(k, v);
    // 起動しておく（はじめの状態）
    if (this.mta === "postfix") {
      this.aliasDb = parseAliases(this.files.get("/etc/aliases") ?? "").map;
      this.pfLoad();
    } else {
      this.aliasDb = parseAliases(this.files.get("/etc/aliases") ?? "").map;
      this.accessDb = parseAccess(this.files.get("/etc/mail/access") ?? "");
      this.smLoad();
    }
    this.dcLoad();
  }

  /* ---------- 小物 ---------- */

  tick(ms: number) {
    this.clock += Math.max(0, Math.round(ms));
  }

  newPid() {
    this.pid += 1 + Math.floor(this.rand() * 3);
    return this.pid;
  }

  log(run: RunLog | null, src: LogSrc, text: string) {
    const line = { at: this.clock, src, text };
    this.logs.push(line);
    if (this.logs.length > 600) this.logs.splice(0, this.logs.length - 600);
    run?.logs.push(line);
  }

  /** /var/log/maillog の行（本物と同じ形） */
  maillog(l: LogLine) {
    return `${syslogTime(l.at)} mail ${l.text}`;
  }

  hex(n: number, upper = true) {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(this.rand() * 16).toString(16);
    return upper ? s.toUpperCase() : s;
  }

  /** キューの ID（Postfix は 16進、sendmail は日時＋文字） */
  qid(kind: Mta) {
    if (kind === "postfix") return `${"3456789ABCDEF"[Math.floor(this.rand() * 13)]}${this.hex(9)}`;
    const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";
    return `59F${abc[Math.floor(this.rand() * abc.length)]}${abc[Math.floor(this.rand() * abc.length)]}${this.hex(1, false)}${String(Math.floor(this.rand() * 1e6)).padStart(6, "0")}`;
  }

  /** パケットを残す（TLS のときは、読めないバイトにする） */
  packet(run: RunLog, from: string, to: string, proto: Proto, info: string, text: string, tls: boolean, secret?: { part: string; shown: string; how?: string }) {
    this.packetNo++;
    const bytes = utf8(text.replace(/\n/g, "\r\n"));
    if (tls) {
      run.packets.push({ no: this.packetNo, from, to, proto: "TLS", info: "Application Data", bytes: tlsRecord(this.rand, bytes.length), secret: null, secretText: null });
      return;
    }
    let range: [number, number] | null = null;
    if (secret) {
      const at = text.indexOf(secret.part);
      if (at >= 0) {
        const start = utf8(text.slice(0, at).replace(/\n/g, "\r\n")).length;
        range = [start, start + utf8(secret.part).length];
      }
    }
    run.packets.push({ no: this.packetNo, from, to, proto, info, bytes, secret: range, secretText: range ? secret!.shown : null, secretHow: range ? secret!.how : undefined });
  }

  tlsHandshake(run: RunLog, client: string, server: string) {
    const hello = (n: number) => concat([Uint8Array.of(0x16, 0x03, 0x01, n >> 8, n & 255), randomBytes(this.rand, n)]);
    run.packets.push({ no: ++this.packetNo, from: client, to: server, proto: "TLS", info: "Client Hello", bytes: hello(380), secret: null, secretText: null });
    run.packets.push({ no: ++this.packetNo, from: server, to: client, proto: "TLS", info: "Server Hello, Change Cipher Spec, Application Data", bytes: tlsRecord(this.rand, 1260, 0x16), secret: null, secretText: null });
  }

  /* ---------- サービスの起動・読みこみ ---------- */

  /** Postfix を起動・reload（main.cf・master.cf を読みこむ）。まちがいはログに */
  pfLoad(run: RunLog | null = null) {
    const conf = parseMainCf(this.files.get("/etc/postfix/main.cf") ?? "");
    const services = parseMasterCf(this.files.get("/etc/postfix/master.cf") ?? "smtp inet n - n - - smtpd");
    this.pf = { conf, services };
    const cert = pfGet(conf, "smtpd_tls_cert_file");
    if (cert && !this.files.has(cert)) this.log(run, "postfix", `postfix/smtpd[${this.newPid()}]: warning: cannot get RSA certificate from file "${cert}": disabling TLS support`);
  }

  dovecotFiles(): [string, string][] {
    const list = [...this.files.entries()].filter(([p]) => p === "/etc/dovecot/dovecot.conf" || (p.startsWith("/etc/dovecot/conf.d/") && p.endsWith(".conf")));
    return list.sort((a, b) => (a[0] === "/etc/dovecot/dovecot.conf" ? -1 : b[0] === "/etc/dovecot/dovecot.conf" ? 1 : a[0].localeCompare(b[0])));
  }

  /** Dovecot を起動・reload。設定にまちがいがあれば、読みこまずにエラー（前の設定のまま） */
  dcLoad(run: RunLog | null = null): string[] {
    const { conf, errors } = parseDovecot(this.dovecotFiles());
    if (errors.length) {
      for (const e of errors) this.log(run, "dovecot", `dovecot: config: Error: ${e}`);
      return errors;
    }
    this.dc = conf;
    return [];
  }

  /** sendmail を起動・再起動（sendmail.cf と local-host-names を読みこむ） */
  smLoad() {
    const cf = this.files.get("/etc/mail/sendmail.cf") ?? "";
    const cw = new Set(["localhost", "mail.wanko.shop", "localhost.localdomain"]);
    for (const l of (this.files.get("/etc/mail/local-host-names") ?? "").split("\n")) if (l.trim() && !l.trim().startsWith("#")) cw.add(l.trim().toLowerCase());
    this.sm = { listen: sendmailListen(cf), cw };
  }

  /* ---------- 名前の判断 ---------- */

  /** Postfix：このドメインは「自分あて」（mydestination）か */
  pfIsLocal(conf: Map<string, string>, domain: string) {
    const d = bare(domain);
    return pfList(conf, "mydestination").some((x) => bare(x) === d);
  }

  /** sendmail：このドメインは自分あて（Cw・local-host-names）か */
  smIsLocal(domain: string) {
    return Boolean(this.sm?.cw.has(bare(domain)));
  }

  /** aliases をたどって、最後に届ける先（ローカルの人・外のアドレス）。見つからなければ null */
  expandAlias(local: string, run: RunLog | null, depth = 0, seen = new Set<string>()): string[] | null {
    const key = local.toLowerCase();
    const hit = this.aliasDb?.get(key);
    if (hit && depth < 6 && !seen.has(key)) {
      seen.add(key);
      if (depth === 0) run?.note(`aliases.db に **${key}: ${hit.join(", ")}** がある → その人たちに届ける`, "ok", "aliases");
      const out: string[] = [];
      for (const v of hit) {
        if (v.includes("@") || v.startsWith("/") || v.startsWith("|")) out.push(v);
        else out.push(...(this.expandAlias(v, run, depth + 1, seen) ?? [v]));
      }
      return out;
    }
    return isUser(key) ? [key] : null;
  }

  /* ---------- SMTP ---------- */

  /** host から name:port へ SMTP でつなぐ。だめなら、その理由（swaks に出す文） */
  smtpConnect(from: HostId, name: string, port: number, run: RunLog): { ok: true; session: SmtpSession } | { ok: false; error: string; timeout?: boolean } {
    const ip = resolveA(name);
    if (!ip) return { ok: false, error: `Name or service not known` };
    const local = from === "mail" && (ip === "127.0.0.1" || ip === HOST_IP.mail);
    const client = from === "mail" ? { host: from, ip: "127.0.0.1", name: "localhost" } : { host: from, ip: HOST_IP[from], name: HOST_FQDN[from] };
    if (ip === HOST_IP.mail || local) {
      if (this.mta === "postfix") {
        if (!this.pf) return { ok: false, error: "Connection refused" };
        const svc = this.pf.services.find((s) => s.port === port);
        if (!svc) {
          run.note(`メールサーバーは **${port}番** で待っていない（master.cf に、このポートのサービスがない）`, "ng", "port");
          return { ok: false, error: "Connection refused" };
        }
        if (pfGet(this.pf.conf, "inet_interfaces") === "loopback-only" && !local) return { ok: false, error: "Connection refused" };
        return { ok: true, session: new SmtpSession(this, "postfix", client, port, svc.over, run, local) };
      }
      if (!this.sm || port !== 25) return { ok: false, error: "Connection refused" };
      if (this.sm.listen !== "0.0.0.0" && !local && this.sm.listen !== ip) {
        run.note(`sendmail は **${this.sm.listen}:25** でしか待っていない（DaemonPortOptions の Addr=）。外からはつながらない`, "ng", "sendmail:daemon");
        return { ok: false, error: "Connection refused" };
      }
      if (this.sm.listen !== "0.0.0.0" && local) run.note(`sendmail は ${this.sm.listen}:25 で待っている。メールサーバーの中からなので、つながる`, "info", "sendmail:daemon");
      return { ok: true, session: new SmtpSession(this, "sendmail", client, port, new Map(), run, local) };
    }
    if (isRemoteIp(ip)) {
      if (from === "mail" && port === 25 && this.op25b && ip !== ISP.ip) return { ok: false, error: "Connection timed out", timeout: true };
      return { ok: true, session: new SmtpSession(this, "remote", client, port, new Map(), run, false, ptrName(ip)) };
    }
    if (ip === HOST_IP.pc || ip === HOST_IP.out) return { ok: false, error: "Connection refused" };
    return { ok: false, error: "Connection timed out", timeout: true };
  }

  /** キューに入れて、すぐに配る（qmgr）。返り値は キューの ID */
  enqueue(kind: Mta, mail: Mail, client: string, run: RunLog) {
    const item: QueueItem = { qid: mail.qid, mail, pending: [...mail.rcpts], status: "active", reason: "", arrival: this.clock, client };
    this.queue.push(item);
    if (kind === "postfix") this.log(run, "postfix", `postfix/qmgr[1499]: ${mail.qid}: from=<${mail.from}>, size=${mail.size}, nrcpt=${mail.rcpts.length} (queue active)`);
    this.deliver(item, run);
  }

  /** キューの中のメールを、もう一度配る（postqueue -f・sendmail -q） */
  flush(run: RunLog) {
    const list = this.queue.filter((q) => q.status === "deferred");
    for (const q of list) {
      q.status = "active";
      if (this.mta === "postfix") this.log(run, "postfix", `postfix/qmgr[1499]: ${q.qid}: from=<${q.mail.from}>, size=${q.mail.size}, nrcpt=${q.pending.length} (queue active)`);
      run.note(`キューにあった **${q.qid}** を、もう一度配ってみる`, "info", "queue");
      this.deliver(q, run);
    }
    return list.length;
  }

  private deliver(q: QueueItem, run: RunLog) {
    const left: string[] = [];
    const reasons: string[] = [];
    for (const rcpt of q.pending) {
      const r = this.mta === "postfix" ? this.pfDeliverOne(q, rcpt, run) : this.smDeliverOne(q, rcpt, run);
      if (r) {
        left.push(rcpt);
        reasons.push(r);
      }
    }
    q.pending = left;
    if (!left.length) {
      this.queue = this.queue.filter((x) => x !== q);
      if (this.mta === "postfix") this.log(run, "postfix", `postfix/qmgr[1499]: ${q.qid}: removed`);
    } else {
      q.status = "deferred";
      q.reason = reasons[0]!;
      run.ops.push({ kind: "queue", code: 0, note: "deferred" });
    }
  }

  private delays(extra = 0) {
    const a = (0.02 + this.rand() * 0.05).toFixed(2);
    const d = (0.01 + this.rand() * 0.03 + extra).toFixed(extra ? 0 : 2);
    return { total: (Number(a) + Number(d) + 0.01).toFixed(extra ? 0 : 2), delays: `${a}/0.01/0/${d}` };
  }

  /** Postfix で1人ぶん配る。キューに残すなら、その理由 */
  private pfDeliverOne(q: QueueItem, rcpt: string, run: RunLog): string | null {
    const conf = this.pf?.conf ?? new Map<string, string>();
    const [localPart = "", domain = ""] = rcpt.split("@");
    if (this.pfIsLocal(conf, domain)) {
      const targets = this.expandAlias(localPart, run) ?? [];
      const orig = targets.length === 1 && targets[0] === localPart.toLowerCase() ? undefined : rcpt;
      let deferred: string | null = null;
      for (const t of targets) {
        if (t.includes("@")) {
          const r = this.pfRemote(q, t, run, rcpt);
          if (r) deferred = r;
          continue;
        }
        if (t.startsWith("/") || t.startsWith("|")) continue;
        const r = this.pfLocal(q, t, rcpt, orig, run);
        if (r) deferred = r;
      }
      if (!targets.length) {
        this.log(run, "postfix", `postfix/local[${this.newPid()}]: ${q.qid}: to=<${rcpt}>, relay=local, delay=0.05, dsn=5.1.1, status=bounced (unknown user: "${localPart}")`);
        run.ops.push({ kind: "deliver", code: 550, how: "bounced", rcpt });
      }
      return deferred;
    }
    return this.pfRemote(q, rcpt, run);
  }

  /** ローカルの人に届ける（mailbox_transport があれば Dovecot の LMTP へ、なければ local が自分で mbox か Maildir に） */
  private pfLocal(q: QueueItem, user: string, rcpt: string, orig: string | undefined, run: RunLog): string | null {
    const conf = this.pf?.conf ?? new Map<string, string>();
    const to = `${user}@${pfGet(conf, "mydomain")}`;
    const origPart = orig ? `, orig_to=<${orig}>` : "";
    const transport = pfGet(conf, "mailbox_transport");
    const d = this.delays();
    if (transport.startsWith("lmtp:")) {
      run.note(`mailbox_transport = **${transport}** → Postfix は自分で配らず、Dovecot の LMTP に渡す`, "info", "sieve:transport");
      const pid = this.newPid();
      const sock = transport.replace(/^lmtp:(unix:)?/, "");
      const ok = this.dc && dcGet(this.dc, "protocols").split(/\s+/).includes("lmtp") && sock === "private/dovecot-lmtp" && dcHas(this.dc, LMTP_SOCKET);
      if (!ok) {
        const why = `connect to mail.wanko.shop[${sock}]: No such file or directory`;
        this.log(run, "postfix", `postfix/lmtp[${pid}]: ${q.qid}: to=<${to}>${origPart}, relay=none, delay=0.1, delays=${d.delays}, dsn=4.4.1, status=deferred (${why})`);
        run.note(`Dovecot の LMTP の受け口（${sock}）がない → キューに残る`, "ng", "sieve:transport");
        run.ops.push({ kind: "deliver", code: 451, how: "deferred", rcpt: to });
        return why;
      }
      const folder = this.dovecotDeliver(user, q.mail, run, "lmtp", to, orig);
      const sess = this.hex(6, false);
      this.log(run, "postfix", `postfix/lmtp[${pid}]: ${q.qid}: to=<${to}>${origPart}, relay=mail.wanko.shop[private/dovecot-lmtp], delay=${d.total}, delays=${d.delays}, dsn=2.0.0, status=sent (250 2.0.0 <${to}> ${sess} Saved)`);
      run.ops.push({ kind: "deliver", code: 250, how: "lmtp", rcpt: to, folder });
      return null;
    }
    const home = pfGet(conf, "home_mailbox");
    const pid = this.newPid();
    const received = this.receivedFor(q, to);
    if (home.endsWith("/")) {
      const dir = `${homeOf(user)}/${home.replace(/\/$/, "")}`;
      this.storeMaildir(dir, "INBOX", q.mail, to, orig, received);
      run.note(`home_mailbox = **${home}** → ${user} の **${dir}/new/** に、1通1ファイルで置いた（Maildir）`, "ok", "maildir");
      this.log(run, "postfix", `postfix/local[${pid}]: ${q.qid}: to=<${to}>${origPart}, relay=local, delay=${d.total}, delays=${d.delays}, dsn=2.0.0, status=sent (delivered to maildir)`);
      run.ops.push({ kind: "deliver", code: 250, how: "maildir", rcpt: to, folder: `${dir}/` });
      return null;
    }
    const file = home ? `${homeOf(user)}/${home}` : `${pfGet(conf, "mail_spool_directory")}/${user}`;
    this.storeMbox(file, q.mail, to, orig, received);
    run.note(home ? `home_mailbox = ${home} → ${file} に足した（mbox）` : `home_mailbox が空 → **${file}** に足した（mbox：1つのファイルに、メールをつなげて書く）`, "info", "maildir");
    this.log(run, "postfix", `postfix/local[${pid}]: ${q.qid}: to=<${to}>${origPart}, relay=local, delay=${d.total}, delays=${d.delays}, dsn=2.0.0, status=sent (delivered to mailbox)`);
    run.ops.push({ kind: "deliver", code: 250, how: "mbox", rcpt: to, folder: file });
    return null;
  }

  /** 外のドメインへ（relayhost があればそこへ、なければ MX へ）。だめならキューに残す理由 */
  private pfRemote(q: QueueItem, rcpt: string, run: RunLog, orig?: string): string | null {
    const conf = this.pf?.conf ?? new Map<string, string>();
    const domain = rcpt.split("@")[1] ?? "";
    const relayhost = pfGet(conf, "relayhost");
    const pid = this.newPid();
    const origPart = orig ? `, orig_to=<${orig}>` : "";
    let target: string | null;
    if (relayhost) {
      target = relayhost.replace(/^\[/, "").replace(/\](:\d+)?$/, "").replace(/:\d+$/, "");
      run.note(`relayhost = **${relayhost}** → 相手のドメインの MX ではなく、プロバイダの中継サーバーに渡す`, "ok", "relayhost");
    } else {
      target = resolveMx(domain);
      if (target) run.note(`${domain} の MX は ${target} → そこへ直接つなぐ（relayhost が空）`, "info", "relayhost");
    }
    const ip = target ? resolveA(target) : null;
    if (!target || !ip) {
      const why = `Host or domain name not found. Name service error for name=${domain} type=MX: Host not found`;
      this.log(run, "postfix", `postfix/smtp[${pid}]: ${q.qid}: to=<${rcpt}>${origPart}, relay=none, delay=0.1, delays=0.05/0.01/0.04/0, dsn=5.4.4, status=bounced (${why})`);
      run.note(`${domain} という相手が見つからない → 送れない（送った人に「届きませんでした」を返す）`, "ng", "queue");
      run.ops.push({ kind: "deliver", code: 550, how: "bounced", rcpt });
      this.bounce(q, rcpt, why, run);
      return null;
    }
    if (this.op25b && !relayhost) {
      this.tick(30000);
      const why = `connect to ${target}[${ip}]:25: Connection timed out`;
      this.log(run, "postfix", `postfix/smtp[${pid}]: ${why}`);
      this.log(run, "postfix", `postfix/smtp[${pid}]: ${q.qid}: to=<${rcpt}>${origPart}, relay=none, delay=30, delays=0.05/0.01/30/0, dsn=4.4.1, status=deferred (${why})`);
      run.note(`プロバイダが、外の **25番** へのつなぎ方を止めている（OP25B）→ ${target} につながらない → **キューに残って、あとでやりなおす**`, "ng", "relayhost");
      run.ops.push({ kind: "deliver", code: 421, how: "deferred", rcpt, via: target });
      return why;
    }
    const rq = this.hex(10);
    this.remote.push({ server: target, rcpt, mail: q.mail, via: relayhost ? ISP.name : "direct" });
    const d = this.delays();
    this.log(run, "postfix", `postfix/smtp[${pid}]: ${q.qid}: to=<${rcpt}>${origPart}, relay=${target}[${ip}]:25, delay=${d.total}, delays=${d.delays}, dsn=2.0.0, status=sent (250 2.0.0 Ok: queued as ${rq})`);
    run.note(`${target} が受けとった（250）→ ここから先は相手のサーバーのしごと`, "ok", relayhost ? "relayhost" : "relay:sent");
    run.ops.push({ kind: "deliver", code: 250, how: "remote", rcpt, via: target });
    return null;
  }

  /** 届けられなかったことを、送った人に知らせる（送った人がこのお店の人なら） */
  private bounce(q: QueueItem, rcpt: string, why: string, run: RunLog) {
    const [lp = "", dom = ""] = q.mail.from.split("@");
    const conf = this.pf?.conf ?? new Map<string, string>();
    if (!q.mail.from || !this.pfIsLocal(conf, dom) || !isUser(lp)) return;
    const qid = this.qid("postfix");
    this.log(run, "postfix", `postfix/bounce[${this.newPid()}]: ${q.qid}: sender non-delivery notification: ${qid}`);
    const mail: Mail = {
      qid,
      from: "",
      rcpts: [q.mail.from],
      head: [
        ["From", "MAIL-DAEMON@mail.wanko.shop (Mail Delivery System)"],
        ["Subject", "Undelivered Mail Returned to Sender"],
        ["To", q.mail.from],
        ["Date", rfcDate(this.clock)],
      ],
      body: `This is the mail system at host mail.wanko.shop.\n\nI'm sorry to have to inform you that your message could not\nbe delivered to one or more recipients.\n\n<${rcpt}>: ${why}`,
      at: this.clock,
      size: 1800,
    };
    this.pfLocal({ ...q, qid, mail }, lp, q.mail.from, undefined, run);
  }

  /** sendmail で1人ぶん配る */
  private smDeliverOne(q: QueueItem, rcpt: string, run: RunLog): string | null {
    const [localPart = "", domain = ""] = rcpt.split("@");
    const pid = this.newPid();
    const pri = 30000 + Math.floor(this.rand() * 900);
    if (this.smIsLocal(domain)) {
      for (const t of this.expandAlias(localPart, run) ?? []) {
        if (t.includes("@") || t.startsWith("/") || t.startsWith("|")) continue;
        this.storeMbox(`/var/mail/${t}`, q.mail, `${t}@${DOMAIN}`, undefined, [`from ${q.client}\n\tby mail.wanko.shop (8.16.1/8.16.1) with ESMTP id ${q.qid}\n\tfor <${rcpt}>; ${rfcDate(this.clock)}`]);
        this.log(run, "sendmail", `sendmail[${pid}]: ${q.qid}: to=<${rcpt}>, delay=00:00:00, xdelay=00:00:00, mailer=local, pri=${pri}, dsn=2.0.0, stat=Sent`);
        run.note(`${rcpt} は自分あて（local-host-names）→ **/var/mail/${t}** に置いた`, "ok", "sendmail:local");
        run.ops.push({ kind: "deliver", code: 250, how: "mbox", rcpt, folder: `/var/mail/${t}` });
      }
      return null;
    }
    const target = resolveMx(domain);
    const ip = target ? resolveA(target) : null;
    if (!target || !ip) {
      this.log(run, "sendmail", `sendmail[${pid}]: ${q.qid}: to=<${rcpt}>, delay=00:00:00, mailer=esmtp, pri=${pri}, dsn=5.1.2, stat=Host unknown (Name server: ${domain}: host not found)`);
      run.ops.push({ kind: "deliver", code: 550, how: "bounced", rcpt });
      return null;
    }
    if (this.op25b) {
      this.log(run, "sendmail", `sendmail[${pid}]: ${q.qid}: to=<${rcpt}>, delay=00:00:30, xdelay=00:00:30, mailer=esmtp, pri=${pri}, relay=${target}. [${ip}], dsn=4.0.0, stat=Deferred: Connection timed out with ${target}.`);
      run.ops.push({ kind: "deliver", code: 421, how: "deferred", rcpt, via: target });
      return `Deferred: Connection timed out with ${target}.`;
    }
    const rq = this.hex(10);
    this.remote.push({ server: target, rcpt, mail: q.mail, via: "direct" });
    this.log(run, "sendmail", `sendmail[${pid}]: ${q.qid}: to=<${rcpt}>, delay=00:00:01, xdelay=00:00:01, mailer=esmtp, pri=${pri}, relay=${target}. [${ip}], dsn=2.0.0, stat=Sent (Ok: queued as ${rq})`);
    run.note(`${target} が受けとった → 外へ送った`, "ok", "sendmail:sent");
    run.ops.push({ kind: "deliver", code: 250, how: "remote", rcpt, via: target });
    return null;
  }

  private receivedFor(q: QueueItem, to: string) {
    return [`from ${q.client}\n\tby mail.wanko.shop (Postfix) with ESMTP id ${q.qid}\n\tfor <${to}>; ${rfcDate(this.clock)} (JST)`];
  }

  /* ---------- メールボックス ---------- */

  private nextUid(key: string) {
    const n = this.uidNext.get(key) ?? 1;
    this.uidNext.set(key, n + 1);
    return n;
  }

  storeMbox(file: string, mail: Mail, to: string, orig: string | undefined, received: string[]) {
    const list = this.mboxes.get(file) ?? [];
    this.mboxes.set(file, list);
    list.push({ mail, uid: this.nextUid(file), to, orig, file, received });
  }

  storeMaildir(dir: string, folder: string, mail: Mail, to: string, orig: string | undefined, received: string[]) {
    const box = this.maildirs.get(dir) ?? new Map<string, Stored[]>([["INBOX", []]]);
    this.maildirs.set(dir, box);
    const list = box.get(folder) ?? [];
    box.set(folder, list);
    const sec = Math.floor(this.clock / 1000);
    const file = `${sec}.M${Math.floor(this.rand() * 900000 + 100000)}P${this.newPid()}.mail,S=${mail.size},W=${mail.size + 12}`;
    list.push({ mail, uid: this.nextUid(`${dir}/${folder}`), to, orig, file, received });
  }

  /** Dovecot がこの人のメールをどこで読むか（mail_location。空なら、ある方をさがす） */
  location(user: string, dc: Map<string, string> | null = this.dc): { kind: "maildir" | "mbox"; path: string; explain: string } {
    const loc = dc ? dcGet(dc, "mail_location") : "";
    const home = homeOf(user);
    const exp = (s: string) => s.replace(/^~/, home).replace(/%u/g, user).replace(/%n/g, user);
    if (loc.startsWith("maildir:")) return { kind: "maildir", path: exp(loc.slice(8).split(":")[0]!), explain: loc };
    if (loc.startsWith("mbox:")) {
      const inbox = /INBOX=([^:]+)/.exec(loc)?.[1];
      return { kind: "mbox", path: exp(inbox ?? `/var/mail/%u`), explain: loc };
    }
    if (this.maildirs.has(`${home}/Maildir`)) return { kind: "maildir", path: `${home}/Maildir`, explain: "（空なので、~/Maildir があったのでそれを使う）" };
    return { kind: "mbox", path: `/var/mail/${user}`, explain: "（空なので、/var/mail を使う）" };
  }

  /** Dovecot が見ているメールボックス（フォルダー名 → メール） */
  folders(user: string): Map<string, Stored[]> {
    const loc = this.location(user);
    if (loc.kind === "maildir") {
      const box = this.maildirs.get(loc.path);
      return box ? new Map(box) : new Map([["INBOX", []]]);
    }
    return new Map([["INBOX", [...(this.mboxes.get(loc.path) ?? [])]]]);
  }

  /** Dovecot（LMTP）が届ける。Sieve があれば、それで行き先を決める */
  private dovecotDeliver(user: string, mail: Mail, run: RunLog, via: "lmtp", to: string, orig?: string): string {
    const dc = this.dc!;
    const sess = this.hex(6, false);
    const pid = this.newPid();
    const tag = `dovecot: ${via}(${user})<${pid}><${sess}>`;
    let folders = ["INBOX"];
    const plugins = dcGet(dc, "mail_plugins", via).split(/\s+/);
    const scriptPath = `${homeOf(user)}/.dovecot.sieve`;
    const script = this.files.get(scriptPath);
    if (plugins.includes("sieve")) {
      if (script != null) {
        const res = runSieve(script, mail);
        if (res.errors.length) {
          for (const e of res.errors) this.log(run, "dovecot", `${tag}: Error: sieve: ${scriptPath}: ${e}`);
          this.log(run, "dovecot", `${tag}: Error: sieve: failed to compile script ${scriptPath}`);
          run.note(`Sieve のスクリプト（${scriptPath}）に **まちがい** がある（${res.errors[0]}）→ 読めないので、**何もしないで INBOX** に入れた`, "warn", "sieve:error");
        } else {
          folders = res.discard && !res.folders.length ? [] : res.folders;
          run.note(`Sieve（${scriptPath}）を読んだ：${res.trace.length ? res.trace.join(" → ") : "どの条件にも合わない"} → **${folders.join("・") || "すてる（discard）"}**`, folders.some((f) => f !== "INBOX") ? "ok" : "info", "sieve");
        }
      } else run.note(`${user} には Sieve のスクリプトがない → INBOX`, "info", "sieve");
    } else run.note("LMTP の mail_plugins に sieve がない → Sieve は読まない", "info", "sieve");
    const loc = this.location(user);
    const placed: string[] = [];
    for (let f of folders) {
      if (loc.kind === "maildir") {
        const box = this.maildirs.get(loc.path);
        if (f !== "INBOX" && !box?.has(f) && !/^yes$/i.test(dcGet(dc, "lda_mailbox_autocreate"))) {
          this.log(run, "dovecot", `${tag}: Error: sieve: msgid=<${mail.qid}@${DOMAIN}>: failed to store into mailbox '${f}': Mailbox doesn't exist: ${f}`);
          run.note(`フォルダー **${f}** がない（lda_mailbox_autocreate = no）→ INBOX に入れた`, "warn", "sieve:error");
          f = "INBOX";
        }
        this.storeMaildir(loc.path, f, mail, to, orig, [`from mail.wanko.shop\n\tby mail.wanko.shop with LMTP id ${sess}\n\tfor <${to}>; ${rfcDate(this.clock)}`]);
      } else this.storeMbox(loc.path, mail, to, orig, []);
      placed.push(f);
      this.log(run, "dovecot", `${tag}: msgid=<${mail.qid}@${DOMAIN}>: ${f === "INBOX" ? "saved mail to INBOX" : `fileinto action: stored mail into mailbox '${f}'`}`);
    }
    if (!placed.length) this.log(run, "dovecot", `${tag}: msgid=<${mail.qid}@${DOMAIN}>: discarded`);
    return placed.join(",");
  }

  /** IMAP・POP3 のログイン（Dovecot）。secured … TLS か、メールサーバーの中から */
  dcPlainAllowed(secured: boolean) {
    if (!this.dc) return false;
    if (secured) return true;
    if (dcGet(this.dc, "ssl") === "required") return false;
    return !/^yes$/i.test(dcGet(this.dc, "disable_plaintext_auth"));
  }

  checkPassword(user: string, pw: string) {
    const real = this.passwords.get(user);
    return real != null && real === pw;
  }

  /* ---------- 設定のようす（画面の「設定」パネル） ---------- */

  /** main.cf の、動いている Postfix とのちがい（reload していない書きかえ） */
  pfStale(): string[] {
    if (!this.pf) return [];
    const file = parseMainCf(this.files.get("/etc/postfix/main.cf") ?? "");
    const names = new Set([...file.keys(), ...this.pf.conf.keys()]);
    return [...names].filter((n) => (file.get(n) ?? null) !== (this.pf!.conf.get(n) ?? null));
  }

  dcStale(): string[] {
    if (!this.dc) return [];
    const { conf } = parseDovecot(this.dovecotFiles());
    const names = new Set([...conf.keys(), ...this.dc.keys()]);
    return [...names].filter((n) => (conf.get(n) ?? null) !== (this.dc!.get(n) ?? null));
  }

  /** 名簿の「人」ごとの、メールボックスのようす（画面の「メールボックス」パネル） */
  boxes(): { user: string; label: string; where: string; folders: { name: string; mails: Stored[] }[]; other: { path: string; mails: Stored[] }[] }[] {
    return USERS.map((u) => {
      const loc = this.location(u.name);
      const seen = loc.kind === "maildir" ? [`${loc.path}`] : [loc.path];
      const folders = [...this.folders(u.name).entries()].map(([name, mails]) => ({ name, mails }));
      const other: { path: string; mails: Stored[] }[] = [];
      for (const [p, list] of this.mboxes) if (p.includes(`/${u.name}`) && !seen.includes(p) && list.length) other.push({ path: p, mails: list });
      for (const [p, box] of this.maildirs)
        if (p.startsWith(`${homeOf(u.name)}/`) && !seen.includes(p)) {
          const n = [...box.values()].flat();
          if (n.length) other.push({ path: `${p}/`, mails: n });
        }
      return { user: u.name, label: u.label, where: loc.kind === "maildir" ? `${loc.path}/（Maildir）` : `${loc.path}（mbox）`, folders, other };
    });
  }
}

/* ------------------------------------------------------------ SMTP の1回のつながり */

export type Reply = { code: number; lines: string[] };
const reply = (code: number, ...texts: string[]): Reply => ({ code, lines: texts.map((t, i) => `${code}${i < texts.length - 1 ? "-" : " "}${t}`) });

type Client = { host: HostId; ip: string; name: string };

/**
 * SMTP の1回のつながり（サーバーの側）。Postfix・sendmail・インターネットの向こうのサーバー（なんでも受けとる）の3つの返し方。
 * 返事はすべて本物と同じ形（Postfix 3.8・sendmail 8.16）。
 */
export class SmtpSession {
  w: MailWorld;
  kind: SmtpKind;
  client: Client;
  port: number;
  /** master.cf の -o で上書きした設定もふくめた、このつながりの設定 */
  conf: Map<string, string>;
  run: RunLog;
  local: boolean;
  remoteName: string;
  pid: number;
  helo: string | null = null;
  tls = false;
  authUser: string | null = null;
  authMech = "";
  from: string | null = null;
  rcpts: string[] = [];
  qid: string | null = null;
  counts = new Map<string, [number, number]>();
  /** AUTH LOGIN の途中（ユーザー名を待つ・パスワードを待つ） */
  private loginStep: null | { user?: string } = null;
  /** パスワードがネットワークに見えたか（平文・base64） */
  leaked = false;
  accepted = false;

  constructor(w: MailWorld, kind: SmtpKind, client: Client, port: number, over: Map<string, string>, run: RunLog, local: boolean, remoteName = "") {
    this.w = w;
    this.kind = kind;
    this.client = client;
    this.port = port;
    const base = kind === "postfix" ? (w.pf?.conf ?? new Map<string, string>()) : new Map<string, string>();
    this.conf = new Map([...base, ...over]);
    this.run = run;
    this.local = local;
    this.remoteName = remoteName;
    this.pid = w.newPid();
    if (kind === "postfix") w.log(run, "postfix", `postfix/smtpd[${this.pid}]: connect from ${client.name}[${client.ip}]`);
  }

  get serverIp() {
    return this.local ? "127.0.0.1" : this.kind === "remote" ? (resolveA(this.remoteName) ?? "198.51.100.1") : HOST_IP.mail;
  }

  private count(cmd: string, ok: boolean) {
    const c = this.counts.get(cmd) ?? [0, 0];
    c[1]++;
    if (ok) c[0]++;
    this.counts.set(cmd, c);
  }

  /** TLS を使える設定か（Postfix：smtpd_tls_security_level が may・encrypt で、証明書がある） */
  tlsReady() {
    if (this.kind === "remote") return true;
    if (this.kind !== "postfix") return false;
    const level = pfGet(this.conf, "smtpd_tls_security_level");
    const cert = pfGet(this.conf, "smtpd_tls_cert_file");
    const key = pfGet(this.conf, "smtpd_tls_key_file");
    return (level === "may" || level === "encrypt") && Boolean(cert && key && this.w.files.has(cert) && this.w.files.has(key));
  }

  /** AUTH を出すか（smtpd_sasl_auth_enable。smtpd_tls_auth_only なら TLS のあとだけ） */
  authOffered() {
    if (this.kind !== "postfix" || !pfYes(this.conf, "smtpd_sasl_auth_enable")) return false;
    return !(pfYes(this.conf, "smtpd_tls_auth_only") && !this.tls);
  }

  banner(): Reply {
    if (this.kind === "remote") return reply(220, `${this.remoteName} ESMTP`);
    if (this.kind === "sendmail") return reply(220, `mail.wanko.shop ESMTP Sendmail 8.16.1/8.16.1; ${rfcDate(this.w.clock)}`);
    return reply(220, pfGet(this.conf, "smtpd_banner"));
  }

  /** 1行のコマンドに返事をする（DATA の中身は data()） */
  handle(line: string): Reply {
    if (this.loginStep) return this.authLoginStep(line);
    const [verbRaw = "", ...restParts] = line.trim().split(/\s+/);
    const verb = verbRaw.toUpperCase();
    const rest = restParts.join(" ");
    switch (verb) {
      case "EHLO":
      case "HELO":
        return this.ehlo(verb, rest);
      case "STARTTLS":
        return this.starttls();
      case "AUTH":
        return this.auth(rest);
      case "MAIL":
        return this.mail(rest);
      case "RCPT":
        return this.rcpt(rest);
      case "RSET":
        this.from = null;
        this.rcpts = [];
        return this.kind === "sendmail" ? reply(250, "2.0.0 Reset state") : reply(250, "2.0.0 Ok");
      case "NOOP":
        return reply(250, this.kind === "sendmail" ? "2.0.0 OK" : "2.0.0 Ok");
      case "QUIT":
        this.count("quit", true);
        return this.kind === "sendmail" ? reply(221, "2.0.0 mail.wanko.shop closing connection") : reply(221, "2.0.0 Bye");
      case "DATA":
        return this.dataStart();
      default:
        this.count("unknown", false);
        return this.kind === "sendmail" ? reply(500, `5.5.1 Command unrecognized: "${line}"`) : reply(502, "5.5.2 Error: command not recognized");
    }
  }

  private ehlo(verb: string, name: string): Reply {
    this.helo = name || this.client.name;
    this.count(verb.toLowerCase(), true);
    if (verb === "HELO") return this.kind === "sendmail" ? reply(250, `mail.wanko.shop Hello ${this.client.name} [${this.client.ip}], pleased to meet you`) : reply(250, this.kind === "remote" ? this.remoteName : "mail.wanko.shop");
    if (this.kind === "remote") return reply(250, this.remoteName, "PIPELINING", "SIZE 52428800", ...(this.tls ? [] : ["STARTTLS"]), "8BITMIME");
    if (this.kind === "sendmail")
      return reply(250, `mail.wanko.shop Hello ${this.client.name} [${this.client.ip}], pleased to meet you`, "ENHANCEDSTATUSCODES", "PIPELINING", "8BITMIME", "SIZE", "DSN", "ETRN", "DELIVERBY", "HELP");
    const caps = [pfGet(this.conf, "myhostname"), "PIPELINING", `SIZE ${pfGet(this.conf, "message_size_limit")}`, "VRFY", "ETRN"];
    if (this.tlsReady() && !this.tls) caps.push("STARTTLS");
    if (this.authOffered()) caps.push("AUTH PLAIN LOGIN");
    caps.push("ENHANCEDSTATUSCODES", "8BITMIME", "DSN", "SMTPUTF8", "CHUNKING");
    if (this.kind === "postfix") {
      if (pfYes(this.conf, "smtpd_sasl_auth_enable") && !this.authOffered()) this.run.note("smtpd_sasl_auth_enable = yes だが **smtpd_tls_auth_only = yes** → 暗号になるまで AUTH を見せない", "info", "tls:auth_only");
      else if (this.authOffered()) this.run.note("smtpd_sasl_auth_enable = yes → EHLO の返事に **AUTH PLAIN LOGIN** をのせた", "info", "sasl");
      else this.run.note("smtpd_sasl_auth_enable = no → AUTH（ログイン）を受けつけていない", "info", "sasl");
      if (!this.tls) this.run.note(this.tlsReady() ? "証明書があって smtpd_tls_security_level = " + pfGet(this.conf, "smtpd_tls_security_level") + " → **STARTTLS** を出した" : "TLS の設定（smtpd_tls_security_level・証明書）がない → STARTTLS を出さない", this.tlsReady() ? "info" : "warn", "tls");
    }
    return reply(250, ...caps);
  }

  private starttls(): Reply {
    if (this.tls) return reply(554, "5.5.1 Error: TLS already active");
    if (!this.tlsReady()) {
      this.count("starttls", false);
      return this.kind === "sendmail" ? reply(500, '5.5.1 Command unrecognized: "STARTTLS"') : reply(502, "5.5.1 Error: command not implemented");
    }
    this.count("starttls", true);
    return reply(220, "2.0.0 Ready to start TLS");
  }

  /** STARTTLS の 220 のあと、暗号の話がまとまったとき */
  tlsUp() {
    this.tls = true;
    this.helo = null;
    if (this.kind === "postfix") {
      this.w.log(this.run, "postfix", `postfix/smtpd[${this.pid}]: Anonymous TLS connection established from ${this.client.name}[${this.client.ip}]: TLSv1.3 with cipher TLS_AES_256_GCM_SHA384 (256/256 bits)`);
      this.run.note("STARTTLS → ここから先は **暗号**。パスワードもメールの中身も、ネットワークでは読めない", "ok", "tls");
    }
  }

  private auth(rest: string): Reply {
    if (this.kind !== "postfix" || !pfYes(this.conf, "smtpd_sasl_auth_enable")) {
      this.count("auth", false);
      if (this.kind === "postfix") this.run.note("smtpd_sasl_auth_enable = no → AUTH はできない", "ng", "sasl");
      return this.kind === "sendmail" ? reply(503, "5.3.3 AUTH not available") : reply(503, "5.5.1 Error: authentication not enabled");
    }
    if (!this.authOffered()) {
      this.count("auth", false);
      this.run.note("**smtpd_tls_auth_only = yes** → 暗号（STARTTLS）の前の AUTH は受けつけない", "ng", "tls:auth_only");
      return reply(503, "5.5.1 Error: authentication not enabled");
    }
    if (this.authUser) return reply(503, "5.5.1 Error: already authenticated");
    if (!this.w.dc || !dcHas(this.w.dc, AUTH_SOCKET) || pfGet(this.conf, "smtpd_sasl_type") !== "dovecot") {
      this.w.log(this.run, "postfix", `postfix/smtpd[${this.pid}]: warning: SASL: Connect to private/auth failed: No such file or directory`);
      this.run.note("Dovecot の SMTP AUTH の受け口（private/auth）につながらない", "ng", "sasl");
      this.count("auth", false);
      return reply(454, "4.7.0 Temporary authentication failure: Connection lost to authentication server");
    }
    const [mech = "", initial] = rest.split(/\s+/);
    if (mech.toUpperCase() === "LOGIN") {
      this.authMech = "LOGIN";
      if (initial) {
        this.loginStep = { user: b64text(initial) ?? "" };
        return reply(334, "UGFzc3dvcmQ6");
      }
      this.loginStep = {};
      return reply(334, "VXNlcm5hbWU6");
    }
    if (mech.toUpperCase() !== "PLAIN") {
      this.count("auth", false);
      return reply(535, "5.7.8 Error: authentication failed: Invalid authentication mechanism");
    }
    this.authMech = "PLAIN";
    const raw = initial ? b64text(initial) : null;
    const parts = raw?.split("\0") ?? [];
    return this.authCheck(parts[1] ?? "", parts[2] ?? "");
  }

  private authLoginStep(line: string): Reply {
    const v = b64text(line.trim()) ?? "";
    if (this.loginStep && this.loginStep.user == null) {
      this.loginStep = { user: v };
      return reply(334, "UGFzc3dvcmQ6");
    }
    const user = this.loginStep?.user ?? "";
    this.loginStep = null;
    return this.authCheck(user, v);
  }

  private authCheck(user: string, pw: string): Reply {
    if (!this.tls) this.leaked = true;
    this.run.note(`Dovecot に「${user} のパスワードは合っている？」と聞く（smtpd_sasl_type = dovecot）`, "info", "sasl");
    if (this.w.checkPassword(user, pw)) {
      this.authUser = user;
      this.count("auth", true);
      this.run.note(`合っていた → **${user} として認証できた**（SMTP AUTH）。このあと、外のドメインあても送れる（permit_sasl_authenticated）`, "ok", "sasl");
      return reply(235, "2.7.0 Authentication successful");
    }
    this.count("auth", false);
    this.w.log(this.run, "postfix", `postfix/smtpd[${this.pid}]: warning: ${this.client.name}[${this.client.ip}]: SASL ${this.authMech} authentication failed: (reason unavailable), sasl_username=${user}`);
    this.run.note(`${user} のパスワードがちがう → 535`, "ng", "sasl");
    return reply(535, "5.7.8 Error: authentication failed: (reason unavailable)");
  }

  private mail(rest: string): Reply {
    const m = /^FROM:\s*<([^>]*)>/i.exec(rest);
    if (!m) {
      this.count("mail", false);
      return reply(501, "5.5.4 Syntax: MAIL FROM:<address>");
    }
    if (!this.helo) {
      this.count("mail", false);
      return this.kind === "sendmail" ? reply(503, "5.0.0 Polite people say HELO first") : reply(503, "5.5.1 Error: send HELO/EHLO first");
    }
    if (this.kind === "postfix" && pfGet(this.conf, "smtpd_tls_security_level") === "encrypt" && !this.tls) {
      this.count("mail", false);
      this.run.note("smtpd_tls_security_level = encrypt → 暗号にしないと送れない", "ng", "tls");
      return reply(530, "5.7.0 Must issue a STARTTLS command first");
    }
    this.from = m[1]!;
    this.rcpts = [];
    this.count("mail", true);
    if (this.kind === "sendmail") {
      this.qid = this.w.qid("sendmail");
      return reply(250, `2.1.0 <${this.from}>... Sender ok`);
    }
    return reply(250, "2.1.0 Ok");
  }

  private rcpt(rest: string): Reply {
    const m = /^TO:\s*<([^>]*)>/i.exec(rest);
    if (!m) {
      this.count("rcpt", false);
      return reply(501, "5.5.4 Syntax: RCPT TO:<address>");
    }
    if (this.from == null) {
      this.count("rcpt", false);
      return this.kind === "sendmail" ? reply(503, "5.0.0 Need MAIL before RCPT") : reply(503, "5.5.1 Error: need MAIL command");
    }
    const rcpt = m[1]!;
    const r = this.kind === "postfix" ? this.pfRcpt(rcpt) : this.kind === "sendmail" ? this.smRcpt(rcpt) : reply(250, "2.1.5 Ok");
    const ok = r.code < 400;
    this.count("rcpt", ok);
    if (ok) this.rcpts.push(rcpt);
    return r;
  }

  /** Postfix の RCPT：smtpd_relay_restrictions を左から順に → ローカルの人がいるか */
  private pfRcpt(rcpt: string): Reply {
    const run = this.run;
    const [lp = "", domain = ""] = rcpt.split("@");
    const isLocal = this.w.pfIsLocal(this.conf, domain);
    const relayDom = pfList(this.conf, "relay_domains").some((d) => bare(d) === bare(domain));
    const mynet = pfList(this.conf, "mynetworks");
    const inNet = this.local || mynet.some((c) => inCidr(this.client.ip, c));
    run.note(
      isLocal
        ? `あて先のドメイン **${domain}** は mydestination（${pfList(this.conf, "mydestination").join(", ")}）にある → **自分あて**`
        : `あて先のドメイン **${domain}** は mydestination（${pfList(this.conf, "mydestination").join(", ")}）にない → 自分あてではない（ほかへの **中継** になる）`,
      isLocal ? "ok" : "warn",
      "mydest",
    );
    const reject = (code: number, text: string, why: string, tone: TraceTone, ref: string): Reply => {
      run.note(why, tone, ref);
      this.w.log(run, "postfix", `postfix/smtpd[${this.pid}]: NOQUEUE: reject: RCPT from ${this.client.name}[${this.client.ip}]: ${code} ${text}; from=<${this.from}> to=<${rcpt}> proto=ESMTP helo=<${this.helo}>`);
      return reply(code, text);
    };
    const lists = [pfList(this.conf, "smtpd_relay_restrictions"), pfList(this.conf, "smtpd_recipient_restrictions")];
    for (const list of lists) {
      let decided = false;
      for (const item of list) {
        if (item === "permit_mynetworks") {
          run.note(
            inNet ? `permit_mynetworks：つないできた ${this.client.ip} は mynetworks（${mynet.join(" ")}）の中 → **通す**` : `permit_mynetworks：${this.client.ip} は mynetworks（${mynet.join(" ")}）の外 → つぎへ`,
            inNet ? (mynet.includes("0.0.0.0/0") ? "warn" : "ok") : "info",
            "relay:mynetworks",
          );
          if (inNet) {
            if (!isLocal && mynet.includes("0.0.0.0/0")) run.note("mynetworks が **0.0.0.0/0**（世界じゅう）なので、だれの中継でも引きうけてしまう（**オープンリレー**）", "ng", "relay:open");
            decided = true;
            break;
          }
        } else if (item === "permit_sasl_authenticated") {
          run.note(this.authUser ? `permit_sasl_authenticated：${this.authUser} として認証ずみ → **通す**` : "permit_sasl_authenticated：認証（SMTP AUTH）していない → つぎへ", this.authUser ? "ok" : "info", "relay:sasl");
          if (this.authUser) {
            decided = true;
            break;
          }
        } else if (item === "reject_unauth_destination" || item === "defer_unauth_destination") {
          if (!isLocal && !relayDom) {
            return item === "reject_unauth_destination"
              ? reject(554, `5.7.1 <${rcpt}>: Relay access denied`, `${item}：自分あてでもなく、中継してよい相手（mynetworks・認証ずみ）でもない → **断る（554 Relay access denied）**`, "ng", "relay")
              : reject(454, `4.7.1 <${rcpt}>: Relay access denied`, `${item}：自分あてでない中継 → いったん断る（454）`, "ng", "relay");
          }
          run.note(`${item}：自分あて（または relay_domains）なので、ここでは断らない → つぎへ`, "info", "relay");
        } else if (item === "permit") {
          run.note("permit → 通す（ここまでで決まらなかったものを、すべて通す）", isLocal ? "info" : "warn", "relay:permit");
          decided = true;
          break;
        } else if (item === "reject") return reject(554, `5.7.1 <${rcpt}>: Recipient address rejected: Access denied`, "reject → 断る", "ng", "relay");
      }
      if (decided) break;
    }
    if (isLocal) {
      const known = this.w.expandAlias(lp, null) != null;
      if (!known)
        return reject(
          550,
          `5.1.1 <${rcpt}>: Recipient address rejected: User unknown in local recipient table`,
          `**${lp}** という人は、このサーバーのユーザーにも aliases.db にもいない → 550 User unknown`,
          "ng",
          "aliases",
        );
      if (!isUser(lp.toLowerCase())) run.note(`${lp} はユーザーではないが、aliases.db にある → 受けとる`, "ok", "aliases");
    }
    return reply(250, "2.1.5 Ok");
  }

  /** sendmail の RCPT：自分あて（local-host-names）でなければ、access.db の RELAY を見る */
  private smRcpt(rcpt: string): Reply {
    const run = this.run;
    const [lp = "", domain = ""] = rcpt.split("@");
    const reject = (code: number, text: string, why: string, ref: string) => {
      run.note(why, "ng", ref);
      this.w.log(run, "sendmail", `sendmail[${this.pid}]: ${this.qid}: ruleset=check_rcpt, arg1=<${rcpt}>, relay=${this.client.name} [${this.client.ip}], reject=${code} ${text}`);
      return reply(code, text);
    };
    if (this.w.smIsLocal(domain)) {
      run.note(`**${domain}** は local-host-names（自分の名前）にある → 自分あて`, "ok", "sendmail:local");
      if (this.w.expandAlias(lp, null) == null) return reject(550, `5.1.1 <${rcpt}>... User unknown`, `${lp} という人はいない → 550`, "aliases");
      return reply(250, `2.1.5 <${rcpt}>... Recipient ok`);
    }
    run.note(`**${domain}** は自分あてではない → 中継してよいか、access.db で ${this.client.ip}（${this.client.name}）をさがす`, "info", "sendmail:access");
    if (this.local) {
      run.note("メールサーバーの中（localhost）から → 中継してよい", "ok", "sendmail:access");
      return reply(250, `2.1.5 <${rcpt}>... Recipient ok`);
    }
    const db = this.w.accessDb ?? new Map<string, string>();
    const keys: string[] = [];
    const octets = this.client.ip.split(".");
    for (let n = 4; n >= 1; n--) keys.push(octets.slice(0, n).join("."));
    const names = this.client.name.split(".");
    for (let n = 0; n < names.length - 1; n++) keys.push(names.slice(n).join("."));
    for (const k of keys)
      for (const key of [`connect:${k}`, k]) {
        const v = db.get(key.toLowerCase());
        if (!v) continue;
        if (/^(RELAY|OK)$/i.test(v)) {
          run.note(`access.db に **${key.replace(/^connect:/, "Connect:")} ${v}** がある → 中継してよい`, "ok", "sendmail:access");
          return reply(250, `2.1.5 <${rcpt}>... Recipient ok`);
        }
        if (/^(REJECT|DISCARD)/i.test(v)) return reject(550, `5.7.1 <${rcpt}>... Access denied`, `access.db に ${key} ${v} → 断る`, "sendmail:access");
      }
    return reject(550, `5.7.1 <${rcpt}>... Relaying denied`, `access.db に ${this.client.ip} を中継してよいと書いた行がない → **断る（550 Relaying denied）**`, "sendmail:access");
  }

  private dataStart(): Reply {
    if (!this.rcpts.length) {
      this.count("data", false);
      return this.kind === "sendmail" ? reply(503, "5.0.0 Need RCPT (recipient)") : reply(554, "5.5.1 Error: no valid recipients");
    }
    return this.kind === "sendmail" ? reply(354, 'Enter mail, end with "." on a line by itself') : reply(354, "End data with <CR><LF>.<CR><LF>");
  }

  /** DATA の中身を受けとる（最後の . まで）。キューに入れて、すぐ配る */
  data(head: [string, string][], body: string): Reply {
    const size = utf8(mailText({ head, body } as Mail)).length + 120;
    this.count("data", true);
    if (this.kind === "remote") {
      const q = this.w.hex(10);
      for (const r of this.rcpts) this.w.remote.push({ server: this.remoteName, rcpt: r, mail: { qid: q, from: this.from ?? "", rcpts: [...this.rcpts], head, body, at: this.w.clock, size }, via: "direct" });
      this.accepted = true;
      return reply(250, `2.0.0 Ok: queued as ${q}`);
    }
    const qid = this.kind === "postfix" ? this.w.qid("postfix") : (this.qid ?? this.w.qid("sendmail"));
    const mail: Mail = { qid, from: this.from ?? "", rcpts: [...this.rcpts], head, body, at: this.w.clock, size };
    const msgId = headerOf(mail, "Message-Id") || `<${qid}@${this.client.name}>`;
    const client = `${this.client.name} (${this.client.name} [${this.client.ip}])`;
    this.accepted = true;
    if (this.kind === "postfix") {
      this.w.log(this.run, "postfix", `postfix/smtpd[${this.pid}]: ${qid}: client=${this.client.name}[${this.client.ip}]${this.authUser ? `, sasl_method=${this.authMech}, sasl_username=${this.authUser}` : ""}`);
      this.w.log(this.run, "postfix", `postfix/cleanup[${this.w.newPid()}]: ${qid}: message-id=${msgId}`);
      this.run.note(`受けとって、キューに入れた（**${qid}**）。250 は「あずかった」の意味で、「届いた」ではない`, "info", "queue");
      this.w.enqueue("postfix", mail, client, this.run);
      return reply(250, `2.0.0 Ok: queued as ${qid}`);
    }
    this.w.log(this.run, "sendmail", `sendmail[${this.pid}]: ${qid}: from=<${this.from}>, size=${size}, class=0, nrcpts=${this.rcpts.length}, msgid=${msgId}, proto=ESMTP, daemon=MTA, relay=${this.client.name} [${this.client.ip}]`);
    this.w.enqueue("sendmail", mail, client, this.run);
    return reply(250, `2.0.0 ${qid} Message accepted for delivery`);
  }

  /** つながりを閉じる（Postfix のログの disconnect の行） */
  close() {
    if (this.kind !== "postfix") return;
    const order = ["ehlo", "helo", "starttls", "auth", "mail", "rcpt", "data", "quit", "unknown"];
    let total = 0;
    const parts: string[] = [];
    for (const k of order) {
      const c = this.counts.get(k);
      if (!c) continue;
      total += c[1];
      parts.push(c[0] === c[1] ? `${k}=${c[1]}` : `${k}=${c[0]}/${c[1]}`);
    }
    this.w.log(this.run, "postfix", `postfix/smtpd[${this.pid}]: disconnect from ${this.client.name}[${this.client.ip}] ${parts.join(" ")} commands=${total}`);
  }
}

/** メールの中身の文字に、パスワードの文字が入っていないか（メールの本文はパスワードあつかいしない） */
export const b64Plain = (user: string, pw: string) => b64encode(utf8(`\0${user}\0${pw}`));
