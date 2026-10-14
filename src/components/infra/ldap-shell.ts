/**
 * 勉強部屋（LDAP）のターミナル：3台のコンピューター（あなたのパソコン・LDAP サーバー・お店のサーバー）と、
 * 本物と同じ形のコマンド（ldapsearch・ldapwhoami・ldapadd・ldapmodify・ldapdelete・ldappasswd・slappasswd・slapcat・
 * ssh・systemctl・getent・id・cat …）。出力・終了コード・エラーの文は OpenLDAP のコマンドと同じ形にしてある。
 *
 * - あなたのパソコン（pc）… LDAP のコマンドを打つ。/etc/openldap/ldap.conf（URI・BASE）があるので -H・-b は省ける
 * - LDAP サーバー（ldap）… root。設定（cn=config）は ldapmodify -Y EXTERNAL -H ldapi:/// で変える（すぐに効く）
 * - お店のサーバー（shop）… SSSD が LDAP の名簿でログインさせる。sssd.conf は systemctl restart sssd で読みこむ
 * パイプ（|）・リダイレクト（>）・変数は使えない。&& ・ || ・ ; はつなげられる。
 */
import { b64encode, b64text, ssha, utf8, randomBytes } from "./ldap-bits";
import {
  HOST_IP,
  LdapWorld,
  RESULT_TEXT,
  RunLog,
  SCOPE_NAME,
  attrDef,
  clockText,
  genTime,
  normDn,
  parseFilter,
  parseLdif,
  rdnOf,
  resultText,
  tlsOn,
  ufn,
  type Conn,
  type HostId,
  type LdifRecord,
  type LogLine,
  type OpRecord,
  type OutLine,
  type Packet,
  type Scope,
  type SearchHit,
  type TraceItem,
} from "./ldap";

export type HostInfo = { id: HostId; user: string; prompt: string; label: string };
export const HOSTS: Record<HostId, HostInfo> = {
  pc: { id: "pc", user: "kakari", prompt: "kakari@pc:~$", label: "あなたのパソコン" },
  ldap: { id: "ldap", user: "root", prompt: "root@ldap:~#", label: "LDAP サーバー" },
  shop: { id: "shop", user: "root", prompt: "root@shop:~#", label: "お店のサーバー" },
};
export const HOST_IDS: readonly HostId[] = ["pc", "ldap", "shop"];

/** /etc/openldap/ldap.conf（コマンドの -H・-b を省いたときに使う） */
export type ClientConf = { uri: string; base: string };
/** /etc/sssd/sssd.conf の、この部屋で変えられるところ */
export type SssdConf = { uri: string; base: string; bindDn: string; bindPw: string; access: "permit" | "ldap"; filter: string };
/** お店のサーバーのファイル（持ち主の番号・グループの番号・パーミッション） */
export type FsNode = { uid: number; gid: number; mode: number; dir?: boolean; content?: string; size?: number; mtime?: string };

/** 1回の実行（画面に出すもの） */
export type Run = {
  id: number;
  host: HostId;
  line: string;
  out: OutLine[];
  exit: number;
  trace: TraceItem[];
  logs: LogLine[];
  ops: OpRecord[];
  packets: Packet[];
  clear?: boolean;
};

export type LabInit = {
  server: LdapWorld;
  /** ホストごとのファイル（LDIF など）。パスは「momo.ldif」か「/etc/…」 */
  files?: Partial<Record<HostId, Record<string, string>>>;
  client?: Partial<Record<HostId, Partial<ClientConf>>>;
  sssd?: Partial<SssdConf>;
  fs?: Record<string, FsNode>;
  /** ssh で使う、その人の本当のパスワード（本人が打ったことにする） */
  cast?: Record<string, string>;
};

const DEFAULT_CLIENT: ClientConf = { uri: "ldaps://ldap.wanko.shop", base: "dc=wanko,dc=shop" };
export const DEFAULT_SSSD: SssdConf = {
  uri: "ldaps://ldap.wanko.shop",
  base: "dc=wanko,dc=shop",
  bindDn: "cn=reader,ou=apps,dc=wanko,dc=shop",
  bindPw: "Reader-2026",
  access: "permit",
  filter: "",
};
const OUT_MAX = 1500;

type Tok = { t: "w"; v: string } | { t: "op"; v: string };

/** 1行を、ことばと記号（&& || ; | > <）に分ける。まちがいなら、理由の文字 */
export function lex(line: string): Tok[] | string {
  const out: Tok[] = [];
  let cur = "";
  let has = false;
  const push = () => {
    if (has) out.push({ t: "w", v: cur });
    cur = "";
    has = false;
  };
  const chars = Array.from(line);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (c === "'") {
      const end = chars.indexOf("'", i + 1);
      if (end < 0) return "' が閉じていません";
      cur += chars.slice(i + 1, end).join("");
      has = true;
      i = end;
    } else if (c === '"') {
      let j = i + 1;
      for (; j < chars.length && chars[j] !== '"'; j++) {
        if (chars[j] === "\\" && j + 1 < chars.length && '"\\$`'.includes(chars[j + 1]!)) j++;
        cur += chars[j];
      }
      if (j >= chars.length) return '" が閉じていません';
      has = true;
      i = j;
    } else if (c === "\\") {
      if (i + 1 < chars.length) cur += chars[++i];
      has = true;
    } else if (c === "#" && !has) break;
    else if (c === " " || c === "\t") push();
    else if (c === "\n" || c === ";") {
      push();
      out.push({ t: "op", v: ";" });
    } else if ((c === "&" || c === "|") && chars[i + 1] === c) {
      push();
      out.push({ t: "op", v: c + c });
      i++;
    } else if (c === "|" || c === ">" || c === "<" || c === "&") {
      push();
      out.push({ t: "op", v: c });
    } else {
      cur += c;
      has = true;
    }
  }
  push();
  return out;
}

/** GNU の getopt と同じく、オプションはどこに書いてもよい（-LLL のように重ねても、-bdc=… のようにくっつけても） */
function getopt(args: string[], flags: string, withArg: string): { opt: Map<string, string>; count: Map<string, number>; rest: string[]; error: string | null } {
  const opt = new Map<string, string>();
  const count = new Map<string, number>();
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--") {
      rest.push(...args.slice(i + 1));
      break;
    }
    if (!a.startsWith("-") || a === "-") {
      rest.push(a);
      continue;
    }
    for (let k = 1; k < a.length; k++) {
      const ch = a[k]!;
      if (withArg.includes(ch)) {
        const v = k + 1 < a.length ? a.slice(k + 1) : args[++i];
        if (v == null) return { opt, count, rest, error: `option requires an argument -- '${ch}'` };
        // -e・-o・-E はいくつも書ける
        opt.set(ch, opt.has(ch) && "eoE".includes(ch) ? `${opt.get(ch)}\n${v}` : v);
        count.set(ch, (count.get(ch) ?? 0) + 1);
        break;
      }
      if (!flags.includes(ch)) return { opt, count, rest, error: `invalid option -- '${ch}'` };
      count.set(ch, (count.get(ch) ?? 0) + 1);
    }
  }
  return { opt, count, rest, error: null };
}

/** LDIF の1行に、そのまま書いてよい値か（だめなら base64 にする） */
function ldifSafe(v: string): boolean {
  if (!v) return true;
  if (/^[ :<]/.test(v) || / $/.test(v)) return false;
  return /^[\x01-\x09\x0b\x0c\x0e-\x7f]*$/.test(v);
}

/** 76文字で折り返す（ldapsearch と同じ。2行目からは先頭に空白） */
function wrap(line: string, width = 76): string[] {
  if (line.length <= width) return [line];
  const out = [line.slice(0, width)];
  for (let i = width; i < line.length; i += width - 1) out.push(` ${line.slice(i, i + width - 1)}`);
  return out;
}

/** 属性1つぶんの LDIF の行（base64 なら、もどした文字を hint に） */
export function ldifLines(name: string, value: string, noWrap = false): OutLine[] {
  const secret = name.toLowerCase() === "userpassword";
  const b64 = secret || !ldifSafe(value);
  const text = b64 ? `${name}:: ${b64encode(utf8(value))}` : `${name}: ${value}`;
  const lines = noWrap ? [text] : wrap(text);
  const out: OutLine[] = lines.map((t) => ({ text: t, ...(secret ? { mark: "secret" as const } : {}) }));
  if (b64) {
    const back = b64text(b64encode(utf8(value)));
    const last = out[out.length - 1]!;
    last.hint = secret ? `base64 をもどすと ${back && back.length > 24 ? `${back.slice(0, 22)}…` : back}（パスワードのハッシュ）` : `= ${back}`;
  }
  return out;
}

export class LdapLab {
  server: LdapWorld;
  files: Record<HostId, Map<string, string>>;
  client: Record<HostId, ClientConf>;
  sssd: { file: SssdConf; running: SssdConf };
  fs: Map<string, FsNode>;
  /** お店のサーバーの /etc/group（グループは LDAP でなく、お店のサーバーに書いてある） */
  groups = new Map<number, string>([
    [0, "root"],
    [10000, "staff"],
  ]);
  cast: Map<string, string>;
  /** お店のサーバーの /var/log/secure */
  secure: string[] = [];
  private runNo = 0;
  private pid = 2100;

  constructor(init: LabInit) {
    this.server = init.server;
    this.files = { pc: new Map(), ldap: new Map(), shop: new Map() };
    for (const h of HOST_IDS) for (const [k, v] of Object.entries(init.files?.[h] ?? {})) this.files[h].set(k, v);
    this.client = {
      pc: { ...DEFAULT_CLIENT, ...init.client?.pc },
      ldap: { uri: "ldapi:///", base: DEFAULT_CLIENT.base, ...init.client?.ldap },
      shop: { ...DEFAULT_CLIENT, ...init.client?.shop },
    };
    const s = { ...DEFAULT_SSSD, ...init.sssd };
    this.sssd = { file: { ...s }, running: { ...s } };
    this.fs = new Map(Object.entries(init.fs ?? {}));
    this.cast = new Map(Object.entries(init.cast ?? {}));
  }

  /** ファイルの中身（ldap.conf・sssd.conf は、いまの設定から作る） */
  file(host: HostId, path: string): string | null {
    const p = path.replace(/^~\//, "").replace(/^\.\//, "");
    if (p === "/etc/openldap/ldap.conf") return ldapConf(this.client[host]);
    if (host === "shop" && p === "/etc/sssd/sssd.conf") return sssdConf(this.sssd.file);
    if (host === "shop" && p === "/var/log/secure") return this.secure.join("\n");
    if (host === "shop" && this.fs.get(p)?.content != null) return this.fs.get(p)!.content!;
    return this.files[host].get(p) ?? this.files[host].get(p.replace(/^\/root\//, "")) ?? null;
  }

  /** 1行を実行する */
  run(host: HostId, line: string): Run {
    const log = new RunLog();
    const out: OutLine[] = [];
    const r: Run = { id: ++this.runNo, host, line, out, exit: 0, trace: log.trace, logs: log.logs, ops: log.ops, packets: log.packets };
    this.server.tick(1200 + this.server.rand() * 1800);
    const toks = lex(line);
    if (typeof toks === "string") {
      out.push({ text: `bash: ${toks}`, err: true });
      r.exit = 2;
      return r;
    }
    const bad = toks.find((t) => t.t === "op" && (t.v === "|" || t.v === ">" || t.v === "<" || t.v === "&"));
    if (bad) {
      out.push({ text: `この部屋では「${bad.v}」は使えません（&& ・ || ・ ; でつなぐのは使えます）`, err: true });
      r.exit = 2;
      return r;
    }
    const segs: { join: string; words: string[] }[] = [];
    let join = ";";
    let words: string[] = [];
    for (const t of toks) {
      if (t.t === "w") words.push(t.v);
      else {
        if (words.length) segs.push({ join, words });
        else if (t.v !== ";") {
          out.push({ text: `bash: syntax error near unexpected token \`${t.v}'`, err: true });
          r.exit = 2;
          return r;
        }
        join = t.v;
        words = [];
      }
    }
    if (words.length) segs.push({ join, words });
    let last = 0;
    for (const seg of segs) {
      if (seg.join === "&&" && last !== 0) continue;
      if (seg.join === "||" && last === 0) continue;
      last = this.exec(host, seg.words, out, log, r);
      if (out.length > OUT_MAX) {
        out.splice(OUT_MAX);
        out.push({ text: "…（長いので、ここから先は省きました）", mark: "dim" });
        break;
      }
    }
    r.exit = last;
    return r;
  }

  private exec(host: HostId, argv: string[], out: OutLine[], log: RunLog, r: Run): number {
    let args = [...argv];
    while (args[0] === "sudo") args = args.slice(1);
    const cmd = args[0] ?? "";
    const rest = args.slice(1);
    const say = (text: string, extra: Partial<OutLine> = {}) => out.push({ text, ...extra });
    const err = (text: string) => out.push({ text, err: true });
    switch (cmd) {
      case "":
        return 0;
      case "ldapsearch":
        return this.ldapsearch(host, rest, out, log);
      case "ldapwhoami":
        return this.ldapwhoami(host, rest, out, log);
      case "ldapadd":
      case "ldapmodify":
        return this.ldapmodify(host, cmd, rest, out, log);
      case "ldapdelete":
        return this.ldapdelete(host, rest, out, log);
      case "ldappasswd":
        return this.ldappasswd(host, rest, out, log);
      case "slappasswd":
      case "slapcat":
        if (host !== "ldap") {
          err(`bash: ${cmd}: command not found`);
          log.note(`${cmd} は LDAP サーバーに入っているコマンド（「LDAP サーバー」で打とう）`, "warn");
          return 127;
        }
        return cmd === "slappasswd" ? this.slappasswd(rest, out) : this.slapcat(rest, out);
      case "ssh":
        return this.ssh(host, rest, null, out, log);
      case "sshpass": {
        const g = getopt(rest, "", "p");
        if (g.error || !g.opt.has("p") || g.rest[0] !== "ssh") {
          err("sshpass: 使い方：sshpass -p 'パスワード' ssh ユーザー@shop");
          return 1;
        }
        return this.ssh(host, g.rest.slice(1), g.opt.get("p")!, out, log);
      }
      case "systemctl":
        return this.systemctl(host, rest, out, log);
      case "getent":
      case "id":
        if (host !== "shop") {
          err(cmd === "id" ? `id: ‘${rest[0] ?? ""}’: no such user` : "");
          log.note("このパソコンは、LDAP の名簿でユーザーを見ていない（SSSD があるのは、お店のサーバー）", "warn", "sssd:access");
          return cmd === "id" ? 1 : 2;
        }
        return cmd === "id" ? this.idCmd(rest, out, log) : this.getent(rest, out, log);
      case "cat": {
        let code = 0;
        if (!rest.length) {
          err("cat: ファイルの名前を書いてね");
          return 1;
        }
        for (const p of rest) {
          const text = this.file(host, p);
          if (text == null) {
            err(`cat: ${p}: No such file or directory`);
            code = 1;
            continue;
          }
          for (const l of text.split("\n")) say(l);
        }
        return code;
      }
      case "ls":
        return this.ls(host, rest, out);
      case "tail": {
        const g = getopt(rest, "f", "n");
        const n = Number(g.opt.get("n") ?? 10);
        const p = g.rest[0];
        const text = p ? this.file(host, p) : null;
        if (text == null) {
          err(`tail: cannot open '${p ?? ""}' for reading: No such file or directory`);
          return 1;
        }
        for (const l of text.split("\n").slice(-Math.max(1, n))) say(l);
        return 0;
      }
      case "journalctl": {
        if (host !== "ldap") {
          say("-- No entries --");
          return 0;
        }
        const g = getopt(rest, "fe", "un");
        const n = Number(g.opt.get("n") ?? 20);
        const lines = this.server.logs.slice(-Math.max(1, n));
        for (const l of lines) say(`Oct 14 ${clockText(l.at)} ldap slapd[812]: ${l.text}`);
        if (!lines.length) say("-- No entries --");
        return 0;
      }
      case "echo":
        say(rest.join(" "));
        return 0;
      case "true":
        return 0;
      case "false":
        return 1;
      case "sleep": {
        const s = Number(rest[0]);
        if (!Number.isFinite(s) || s < 0) {
          err(`sleep: invalid time interval ‘${rest[0] ?? ""}’`);
          return 1;
        }
        this.server.tick(Math.min(s, 86400) * 1000);
        log.note(`${s}秒 たったことにした（この部屋の時計を進めた）`, "info");
        return 0;
      }
      case "hostname":
        say(host === "pc" ? "pc" : host === "ldap" ? "ldap.wanko.shop" : "shop.wanko.shop");
        return 0;
      case "whoami":
        say(HOSTS[host].user);
        return 0;
      case "date":
        say(`${new Date(this.server.clock + 9 * 3600e3).toUTCString().replace("GMT", "JST")}`);
        return 0;
      case "clear":
        r.clear = true;
        return 0;
      case "help":
        for (const l of HELP) say(l);
        return 0;
      case "vi":
      case "vim":
      case "nano":
        err(`この部屋では ${cmd} は使えません。設定ファイルは、画面の「設定」で書きかえてね`);
        return 1;
      default:
        err(`bash: ${cmd}: command not found`);
        return 127;
    }
  }

  /* ------------------------------------------------------------ つなぐ */

  /** URI につなぐ。だめなら、ツールが出すエラーの形 */
  private connect(host: HostId, uri: string, log: RunLog): { conn: Conn } | { code: number; info: string } {
    const m = /^(ldaps?|ldapi):\/\/([^/:]*)(?::(\d+))?\/?$/i.exec(uri.trim());
    if (!m) return { code: -1, info: "" };
    const scheme = m[1]!.toLowerCase();
    const name = m[2]!.toLowerCase();
    const s = this.server;
    if (scheme === "ldapi") {
      if (host !== "ldap") {
        log.note("ldapi:/// は「同じコンピューターの中」のつなぎ方。LDAP サーバーの中で打つ", "warn");
        return { code: -1, info: "" };
      }
      return { conn: s.open(host, 0, false, log) };
    }
    const isLdap = ["ldap.wanko.shop", "ldap", HOST_IP.ldap].includes(name) || (host === "ldap" && ["localhost", "127.0.0.1", ""].includes(name));
    if (!isLdap) {
      log.note(`「${name}」という LDAP サーバーはない`, "ng");
      return { code: -1, info: "" };
    }
    const port = Number(m[3] ?? (scheme === "ldaps" ? 636 : 389));
    if (scheme === "ldaps" || port === 636) {
      if (!tlsOn(s.cfg)) {
        log.note("サーバーに証明書がない → 636番（ldaps）で待っていない → つながらない", "ng", "tls:cert");
        return { code: -1, info: "" };
      }
      if (name === HOST_IP.ldap) {
        log.note("証明書の名前は ldap.wanko.shop。IP アドレスでつなぐと、名前が合わないので TLS がつながらない", "ng", "tls:cert");
        return { code: -1, info: "TLS: hostname does not match CN in peer certificate" };
      }
      const conn = s.open(host, 636, true, log);
      s.handshake(log, conn);
      log.note("ldaps://：はじめから暗号（TLS）で話す", "ok", "tls:client");
      return { conn };
    }
    return { conn: s.open(host, port, false, log) };
  }

  /** ldap* コマンドの共通：つなぐ → StartTLS → バインド。だめなら終了コード */
  private session(
    tool: string,
    host: HostId,
    g: ReturnType<typeof getopt>,
    out: OutLine[],
    log: RunLog,
    opts: { ppolicy?: boolean } = {},
  ): { conn: Conn } | { exit: number } {
    const err = (text: string) => out.push({ text, err: true });
    if (g.count.get("W")) {
      err(`${tool}: -W（パスワードを聞く）は、この部屋では使えません。-w 'パスワード' を使ってね`);
      return { exit: 1 };
    }
    const mech = g.opt.get("Y");
    if (!g.count.get("x") && !mech) {
      err("ldap_sasl_interactive_bind: Unknown authentication method (-6)");
      err("\tadditional info: SASL(-4): no mechanism available: No worthy mechs found");
      log.note("-x（シンプル認証：DN とパスワード）をつけ忘れると、SASL という別のログイン方法になってしまう", "warn");
      return { exit: 250 };
    }
    if (mech && mech.toUpperCase() !== "EXTERNAL") {
      err(`SASL/${mech.toUpperCase()} authentication started`);
      err("ldap_sasl_interactive_bind: Unknown authentication method (-6)");
      return { exit: 250 };
    }
    const uri = g.opt.get("H") ?? this.client[host].uri;
    const c = this.connect(host, uri, log);
    const zz = g.count.get("Z") ?? 0;
    const bindFn = mech ? "ldap_sasl_interactive_bind" : "ldap_sasl_bind(SIMPLE)";
    if ("code" in c) {
      err(`${zz && !/^ldaps/i.test(uri) ? "ldap_start_tls" : bindFn}: ${resultText(c.code)} (${c.code})`);
      if (c.info) err(`\tadditional info: ${c.info}`);
      return { exit: 255 };
    }
    const conn = c.conn;
    if (zz) {
      if (/^\d/.test((/^ldap:\/\/([^/:]*)/i.exec(uri)?.[1] ?? ""))) {
        err("ldap_start_tls: Connect error (-11)");
        err("\tadditional info: TLS: hostname does not match CN in peer certificate");
        log.note("証明書の名前は ldap.wanko.shop。IP アドレスでつなぐと、名前が合わない", "ng", "tls:cert");
        this.server.close(conn, log, false);
        return { exit: 245 };
      }
      const st = this.server.startTLS(conn, log);
      if (st.code) {
        err(`ldap_start_tls: ${resultText(st.code)} (${st.code})`);
        if (st.text) err(`\tadditional info: ${st.text}`);
        if (zz >= 2) {
          log.note("-ZZ は「暗号にできなければ、やめる」。だからここで止まった", "info", "tls:cert");
          this.server.close(conn, log, false);
          return { exit: st.code };
        }
      }
    }
    if (mech) {
      if (conn.local !== 0) {
        err("SASL/EXTERNAL authentication started");
        err("ldap_sasl_interactive_bind: Unknown authentication method (-6)");
        err("\tadditional info: SASL(-4): no mechanism available: ");
        this.server.close(conn, log, false);
        return { exit: 250 };
      }
      err("SASL/EXTERNAL authentication started");
      err("SASL username: gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth");
      err("SASL SSF: 0");
      this.server.bindExternal(conn, log);
      return { conn };
    }
    const dn = g.opt.get("D") ?? "";
    const pw = g.opt.get("w") ?? "";
    const b = this.server.bind(conn, dn, pw, log);
    if (b.code) {
      err(`ldap_bind: ${resultText(b.code)} (${b.code})${b.locked && opts.ppolicy ? "; Account locked" : ""}`);
      if (b.text) err(`\tadditional info: ${b.text}`);
      if (b.locked && !opts.ppolicy) log.note("（-e ppolicy をつけると、ロックされている理由も返ってくる）", "info", "ppolicy");
      this.server.close(conn, log, false);
      return { exit: b.code };
    }
    return { conn };
  }

  /* ------------------------------------------------------------ ldapsearch */

  private ldapsearch(host: HostId, args: string[], out: OutLine[], log: RunLog): number {
    const g = getopt(args, "xLZnvMWAcC", "HDwbszleoYyfE");
    const err = (text: string) => out.push({ text, err: true });
    if (g.error) {
      err(`ldapsearch: ${g.error}`);
      err("ldapsearch: Issue -? for help");
      return 1;
    }
    const scopeIn = (g.opt.get("s") ?? "sub").toLowerCase();
    const scope: Scope | null = scopeIn === "base" ? "base" : scopeIn === "one" ? "one" : scopeIn === "sub" ? "sub" : scopeIn === "children" ? "children" : null;
    if (!scope) {
      err("scope should be base, one, sub or children");
      return 1;
    }
    const s = this.session("ldapsearch", host, g, out, log);
    if ("exit" in s) return s.exit;
    const conn = s.conn;
    const L = g.count.get("L") ?? 0;
    const noWrap = (g.opt.get("o") ?? "").split("\n").some((o) => /^ldif[-_]wrap=no$/i.test(o.trim()));
    const baseGiven = g.opt.has("b");
    const base = g.opt.get("b") ?? this.client[host].base;
    const filterText = g.rest[0] ?? "(objectclass=*)";
    const attrs = g.rest.slice(1);
    const size = Number(g.opt.get("z") ?? 0) || 0;
    const filter = parseFilter(filterText);
    const say = (text: string, extra: Partial<OutLine> = {}) => out.push({ text, ...extra });
    if (!filter) {
      err("ldap_search_ext: Bad search filter (-7)");
      log.note(`フィルタ「${filterText}」の書き方がおかしい（かっこの数・= のまわり など）`, "ng");
      this.server.close(conn, log);
      return 249;
    }
    if (L < 2) {
      if (L === 1) say("version: 1", { mark: "dim" });
      if (L === 1) say("");
      if (L === 0) say("# extended LDIF", { mark: "dim" });
      say("#", { mark: "dim" });
      say("# LDAPv3", { mark: "dim" });
      say(`# base <${base}>${baseGiven ? "" : " (default)"} with scope ${SCOPE_NAME[scope]}`, { mark: "dim" });
      say(`# filter: ${filterText}`, { mark: "dim" });
      say(`# requesting: ${attrs.length ? `${attrs.join(" ")} ` : "ALL"}`, { mark: "dim" });
      say("#", { mark: "dim" });
      say("");
    } else if (L === 2) {
      say("version: 1", { mark: "dim" });
      say("");
    }
    const res = this.server.search(conn, { base, scope, filter, attrs, sizeLimit: size }, log);
    const shown = res.hits.slice(0, 200);
    for (const h of shown) {
      if (L < 2) say(`# ${ufn(h.dn) || "<ROOT>"}`, { mark: "dim" });
      out.push(...entryLines(h, noWrap));
      say("");
    }
    if (res.hits.length > shown.length) say(`…（あと ${res.hits.length - shown.length}件。画面に出すのは 200件まで）`, { mark: "dim" });
    if (L < 2) {
      say("# search result", { mark: "dim" });
      say(`search: ${conn.msg - 1}`);
      say(`result: ${res.code} ${resultText(res.code)}`, { mark: res.code ? "ng" : "ok" });
      if (res.matched) say(`matchedDN: ${res.matched}`);
      if (res.text) say(`text: ${res.text}`);
      say("");
      say(`# numResponses: ${res.hits.length + 1}`, { mark: "dim" });
      if (res.hits.length) say(`# numEntries: ${res.hits.length}`, { mark: "dim" });
    } else if (res.code) {
      err(`${resultText(res.code)} (${res.code})`);
      if (res.matched) err(`Matched DN: ${res.matched}`);
      if (res.text) err(`Additional information: ${res.text}`);
    }
    this.server.close(conn, log);
    return res.code;
  }

  /* ------------------------------------------------------------ ldapwhoami */

  private ldapwhoami(host: HostId, args: string[], out: OutLine[], log: RunLog): number {
    const g = getopt(args, "xZnvWc", "HDweoY");
    if (g.error) {
      out.push({ text: `ldapwhoami: ${g.error}`, err: true });
      return 1;
    }
    const ppolicy = (g.opt.get("e") ?? "").split("\n").some((e) => e.trim().replace(/^!/, "") === "ppolicy");
    const s = this.session("ldapwhoami", host, g, out, log, { ppolicy });
    if ("exit" in s) return s.exit;
    const w = this.server.whoami(s.conn, log);
    if (w.code) {
      out.push({ text: `Result: ${resultText(w.code)} (${w.code})`, err: true });
      if (w.text) out.push({ text: `Additional info: ${w.text}`, err: true });
    } else out.push({ text: w.authz || "anonymous", mark: "ok" });
    this.server.close(s.conn, log);
    return w.code;
  }

  /* ------------------------------------------------------------ ldapadd・ldapmodify */

  private ldapmodify(host: HostId, tool: "ldapadd" | "ldapmodify", args: string[], out: OutLine[], log: RunLog): number {
    const g = getopt(args, "xZacnvWM", "HDwfYeo");
    const err = (text: string) => out.push({ text, err: true });
    if (g.error) {
      err(`${tool}: ${g.error}`);
      return 1;
    }
    const path = g.opt.get("f");
    if (!path) {
      err(`${tool}: この部屋では -f ファイル名 で、書きこむ LDIF のファイルを指定してね`);
      return 1;
    }
    const text = this.file(host, path);
    if (text == null) {
      err(`${tool}: ${path}: No such file or directory`);
      return 1;
    }
    const parsed = parseLdif(text, tool === "ldapadd" || Boolean(g.count.get("a")));
    const s = this.session(tool, host, g, out, log);
    if ("exit" in s) return s.exit;
    const conn = s.conn;
    const keepGoing = Boolean(g.count.get("c"));
    let code = 0;
    const done = (fn: string, r: { code: number; text: string; matched?: string }): boolean => {
      if (!r.code) {
        out.push({ text: "" });
        return true;
      }
      err(`${fn}: ${resultText(r.code)} (${r.code})`);
      if (r.matched) err(`\tmatched DN: ${r.matched}`);
      if (r.text) err(`\tadditional info: ${r.text}`);
      out.push({ text: "" });
      code = r.code;
      return keepGoing;
    };
    for (const rec of parsed.records) {
      if (!this.apply(rec, conn, out, log, done)) break;
    }
    if (parsed.error && (code === 0 || keepGoing)) {
      err(
        parsed.error.text === "modify operation type is missing"
          ? `${tool}: modify operation type is missing at line ${parsed.error.line}, entry "${parsed.error.dn}"`
          : `${tool}: invalid format (line ${parsed.error.line}) entry: "${parsed.error.dn}"`,
      );
      if (parsed.error.text === "modify operation type is missing") log.note("ldapmodify は「どう変えるか」（changetype: modify など）が要る。足すだけなら ldapadd", "warn");
      code = code || 1;
    }
    this.server.close(conn, log);
    return code;
  }

  private apply(rec: LdifRecord, conn: Conn, out: OutLine[], log: RunLog, done: (fn: string, r: { code: number; text: string; matched?: string }) => boolean): boolean {
    if (rec.change === "add") {
      out.push({ text: `adding new entry "${rec.dn}"` });
      return done("ldap_add", this.server.add(conn, rec, log));
    }
    if (rec.change === "modify") {
      out.push({ text: `modifying entry "${rec.dn}"` });
      return done("ldap_modify", this.server.modify(conn, rec, log));
    }
    out.push({ text: `deleting entry "${rec.dn}"` });
    return done("ldap_delete", this.server.delete(conn, rec.dn, log));
  }

  /* ------------------------------------------------------------ ldapdelete */

  private ldapdelete(host: HostId, args: string[], out: OutLine[], log: RunLog): number {
    const g = getopt(args, "xZcvnWr", "HDwfY");
    const err = (text: string) => out.push({ text, err: true });
    if (g.error) {
      err(`ldapdelete: ${g.error}`);
      return 1;
    }
    if (!g.rest.length) {
      err("ldapdelete: 消すエントリの DN を書いてね");
      return 1;
    }
    const s = this.session("ldapdelete", host, g, out, log);
    if ("exit" in s) return s.exit;
    let code = 0;
    for (const dn of g.rest) {
      const r = this.server.delete(s.conn, dn, log);
      if (g.count.get("v")) out.push({ text: `deleting entry "${dn}"` });
      if (r.code) {
        err(`ldap_delete: ${resultText(r.code)} (${r.code})`);
        if (r.matched) err(`\tmatched DN: ${r.matched}`);
        if (r.text) err(`\tadditional info: ${r.text}`);
        code = r.code;
        if (!g.count.get("c")) break;
      }
    }
    this.server.close(s.conn, log);
    return code;
  }

  /* ------------------------------------------------------------ ldappasswd */

  private ldappasswd(host: HostId, args: string[], out: OutLine[], log: RunLog): number {
    const g = getopt(args, "xZvWSAn", "HDwsaY");
    if (g.error) {
      out.push({ text: `ldappasswd: ${g.error}`, err: true });
      return 1;
    }
    if (g.count.get("S") || g.count.get("A")) {
      out.push({ text: "ldappasswd: -S・-A（パスワードを聞く）は、この部屋では使えません。-s '新しいパスワード' を使ってね", err: true });
      return 1;
    }
    const s = this.session("ldappasswd", host, g, out, log);
    if ("exit" in s) return s.exit;
    const r = this.server.passwd(s.conn, { user: g.rest[0] ?? null, newPw: g.opt.get("s") ?? null }, log);
    if (r.generated) out.push({ text: `New password: ${r.generated}` });
    if (r.code) {
      out.push({ text: `Result: ${resultText(r.code)} (${r.code})`, err: true });
      if (r.text) out.push({ text: `Additional info: ${r.text}`, err: true });
    }
    this.server.close(s.conn, log);
    return r.code;
  }

  /* ------------------------------------------------------------ LDAP サーバーの道具 */

  private slappasswd(args: string[], out: OutLine[]): number {
    const g = getopt(args, "nuv", "shT");
    if (g.error || !g.opt.has("s")) {
      out.push({ text: g.error ? `slappasswd: ${g.error}` : "slappasswd: この部屋では -s 'パスワード' をつけてね（入力を聞くのは使えません）", err: true });
      return 1;
    }
    const scheme = (g.opt.get("h") ?? "{SSHA}").toUpperCase();
    const pw = g.opt.get("s")!;
    if (scheme === "{CLEARTEXT}") out.push({ text: pw });
    else if (scheme === "{SSHA}") out.push({ text: ssha(pw, randomBytes(this.server.rand, 4)), mark: "ok" });
    else {
      out.push({ text: `Password generation failed for scheme ${scheme}: scheme not recognized`, err: true });
      return 1;
    }
    return 0;
  }

  private slapcat(args: string[], out: OutLine[]): number {
    const g = getopt(args, "v", "nbFfa");
    const n = g.opt.get("n");
    if (n === "0") {
      for (const e of this.server.configEntries()) {
        out.push({ text: `dn: ${e.dn}` });
        for (const [k, vals] of e.attrs) for (const v of vals) out.push(...ldifLines(k, v));
        out.push({ text: "" });
      }
      return 0;
    }
    for (const e of this.server.entries.values()) {
      out.push({ text: `dn: ${e.dn}` });
      for (const a of e.attrs.values()) for (const v of a.vals) out.push(...ldifLines(a.name, v));
      out.push({ text: `structuralObjectClass: ${this.server.isA(e, "groupOfNames") ? "groupOfNames" : (this.server.vals(e, "objectClass")[0] ?? "")}`, mark: "dim" });
      out.push({ text: `entryUUID: ${e.uuid}`, mark: "dim" });
      out.push({ text: `creatorsName: ${e.creator}`, mark: "dim" });
      out.push({ text: `createTimestamp: ${genTime(e.created)}`, mark: "dim" });
      out.push({ text: `modifiersName: ${e.modifier}`, mark: "dim" });
      out.push({ text: `modifyTimestamp: ${genTime(e.modified)}`, mark: "dim" });
      out.push({ text: "" });
      if (out.length > OUT_MAX) break;
    }
    return 0;
  }

  /* ------------------------------------------------------------ お店のサーバー（SSSD） */

  /** SSSD が名簿でユーザーをさがす（name か uidNumber で） */
  private sssdUser(by: { name?: string; uid?: number }, main: RunLog): { dn: string; uid: string; uidNumber: number; gidNumber: number; home: string; shell: string } | "offline" | null {
    const log = this.inner(main);
    const conf = this.sssd.running;
    const s = this.server;
    const c = this.connect("shop", conf.uri, log);
    if ("code" in c) {
      this.sssdLog(log, `Backend is offline: ${conf.uri}: ${RESULT_TEXT[-1]}`);
      main.note("SSSD：LDAP サーバーにつながらない（オフライン）→ だれも見つけられない", "ng", "sssd:uri");
      return "offline";
    }
    const conn = c.conn;
    if (conf.bindDn) {
      const b = s.bind(conn, conf.bindDn, conf.bindPw, log);
      if (b.code) {
        this.sssdLog(log, `Could not bind as ${conf.bindDn}: ${resultText(b.code)}`);
        main.note(`SSSD：名簿を読むアカウント（${rdnOf(conf.bindDn)}）でログインできない → だれも見つけられない`, "ng", "sssd:bind");
        s.close(conn, log, false);
        return "offline";
      }
    }
    const filter = by.name != null ? `(&(uid=${by.name})(objectClass=posixAccount))` : `(&(uidNumber=${by.uid})(objectClass=posixAccount))`;
    const f = parseFilter(filter);
    const r = f ? s.search(conn, { base: conf.base, scope: "sub", filter: f, attrs: ["uid", "uidNumber", "gidNumber", "homeDirectory", "loginShell"], sizeLimit: 0 }, log) : null;
    s.close(conn, log);
    const h = r?.hits[0];
    if (!h) return null;
    const get = (k: string) => h.attrs.find(([n]) => n === k)?.[1][0] ?? "";
    return { dn: h.dn, uid: get("uid"), uidNumber: Number(get("uidNumber")), gidNumber: Number(get("gidNumber")), home: get("homeDirectory"), shell: get("loginShell") || "/bin/bash" };
  }

  /** SSSD の中の LDAP の操作用（ログだけを本体へ。説明はふやさない） */
  private inner(main: RunLog): RunLog {
    const sub = new RunLog();
    sub.logs = main.logs;
    return sub;
  }

  private sssdLog(log: RunLog, text: string) {
    this.server.log(log, "shop", "sssd", `sssd_be[1043]: ${text}`);
  }

  private sshdLog(log: RunLog, pid: number, text: string) {
    const line = `Oct 14 ${clockText(this.server.clock)} shop sshd[${pid}]: ${text}`;
    this.secure.push(line);
    if (this.secure.length > 200) this.secure.splice(0, this.secure.length - 200);
    this.server.log(log, "shop", "sshd", `sshd[${pid}]: ${text}`);
  }

  private ssh(from: HostId, args: string[], given: string | null, out: OutLine[], log: RunLog): number {
    const g = getopt(args, "tTvqN", "lpoi");
    const err = (text: string) => out.push({ text, err: true });
    if (g.error || !g.rest.length) {
      err(g.error ? `ssh: ${g.error}` : "usage: ssh ユーザー@shop [コマンド]");
      return 255;
    }
    const target = g.rest[0]!;
    const at = target.lastIndexOf("@");
    const user = at >= 0 ? target.slice(0, at) : (g.opt.get("l") ?? HOSTS[from].user);
    const hostName = (at >= 0 ? target.slice(at + 1) : target).toLowerCase();
    const remote = g.rest.slice(1).join(" ");
    if (!["shop", "shop.wanko.shop", HOST_IP.shop].includes(hostName)) {
      err(`ssh: Could not resolve hostname ${hostName}: Name or service not known`);
      log.note("ssh でログインできるのは「お店のサーバー」（shop）だけ", "warn");
      return 255;
    }
    const pid = this.pid++;
    const port = 50000 + Math.floor(this.server.rand() * 9000);
    const known = this.cast.get(user);
    const password = given ?? known ?? "";
    out.push({ text: `${user}@shop's password: ••••••••`, mark: "dim", hint: given ? "（sshpass で渡したパスワード）" : known ? "（本人が、正しいパスワードを入力）" : "（知らない人なので、パスワードはでたらめ）" });
    const rec: OpRecord = { kind: "ssh", code: 255, user, host: "shop" };
    log.ops.push(rec);
    const conf = this.sssd.running;
    const stale = sssdConf(this.sssd.file) !== sssdConf(conf);
    // 1. SSSD が名簿でユーザーをさがす
    const u = this.sssdUser({ name: user }, log);
    if (u === "offline" || !u) {
      if (u === null) log.note(`SSSD：名簿で uid=${user}（posixAccount）をさがした → いない → 知らないユーザー`, "ng");
      this.sshdLog(log, pid, `Invalid user ${user} from ${HOST_IP[from]} port ${port}`);
      this.sshdLog(log, pid, `Failed password for invalid user ${user} from ${HOST_IP[from]} port ${port} ssh2`);
      err("Permission denied, please try again.");
      rec.stage = "unknown";
      return 255;
    }
    log.note(`SSSD：名簿で uid=${user} をさがした → 見つかった（uidNumber ${u.uidNumber}）`, "info");
    // 2. パスワードを LDAP で確かめる（その人の DN でバインド）
    const sub = this.inner(log);
    const c = this.connect("shop", conf.uri, sub);
    let authOk = false;
    let locked = false;
    if (!("code" in c)) {
      const b = this.server.bind(c.conn, u.dn, password, sub);
      authOk = b.code === 0;
      locked = Boolean(b.locked || (b.code === 49 && sub.ops.some((o) => o.lockedNow)));
      this.server.close(c.conn, sub, authOk);
    }
    if (locked) log.note("ppolicy：このアカウントはロックされている", "warn", "ppolicy");
    if (!authOk) {
      this.sshdLog(log, pid, `pam_sss(sshd:auth): authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost=${HOST_IP[from]} user=${user}`);
      this.sshdLog(log, pid, `Failed password for ${user} from ${HOST_IP[from]} port ${port} ssh2`);
      log.note("SSSD：パスワードを LDAP で確かめた（その人の DN でバインド）→ だめ", "ng");
      err("Permission denied, please try again.");
      rec.stage = "auth";
      return 255;
    }
    log.note("SSSD：パスワードを LDAP で確かめた（その人の DN でバインド）→ OK", "ok");
    // 3. 入ってよい人か（access_provider）
    if (stale) log.note("SSSD：動いているのは、読みこんだときの設定のまま（sssd.conf は書きかえたけど、まだ systemctl restart sssd していない）", "warn", "sssd:running");
    if (conf.access === "ldap" && conf.filter) {
      const inner = conf.filter.trim().startsWith("(") ? conf.filter.trim() : `(${conf.filter.trim()})`;
      const f = parseFilter(`(&(uid=${user})(objectClass=posixAccount)${inner})`);
      const sub2 = this.inner(log);
      const cc = this.connect("shop", conf.uri, sub2);
      let allowed = false;
      if (f && !("code" in cc)) {
        if (conf.bindDn) this.server.bind(cc.conn, conf.bindDn, conf.bindPw, sub2);
        const r = this.server.search(cc.conn, { base: conf.base, scope: "sub", filter: f, attrs: ["1.1"], sizeLimit: 0 }, sub2);
        allowed = r.hits.length > 0;
        this.server.close(cc.conn, sub2);
      }
      if (!allowed) {
        this.sssdLog(log, `Access denied for user [${user}@wanko]: filter ${inner} did not match`);
        this.sshdLog(log, pid, `pam_sss(sshd:account): Access denied for user ${user}: 6 (Permission denied)`);
        this.sshdLog(log, pid, `fatal: Access denied for user ${user} by PAM account configuration [preauth]`);
        log.note(`SSSD：ldap_access_filter ${inner} で uid=${user} をさがした → 当てはまらない → 入れない`, "ok", "sssd:access");
        err("Connection closed by 192.168.10.20 port 22");
        rec.stage = "access";
        return 255;
      }
      log.note(`SSSD：ldap_access_filter ${inner} に当てはまる → 入ってよい`, "ok", "sssd:access");
    } else log.note("SSSD：access_provider を書いていない → permit（名簿にいれば、だれでも入れる）", "warn", "sssd:access");
    this.sshdLog(log, pid, `Accepted password for ${user} from ${HOST_IP[from]} port ${port} ssh2`);
    this.sshdLog(log, pid, `pam_unix(sshd:session): session opened for user ${user}(uid=${u.uidNumber}) by (uid=0)`);
    rec.stage = "ok";
    rec.code = 0;
    if (!remote.trim()) {
      out.push({ text: `[${user}@shop ~]$`, mark: "ok", hint: "（ログインできました）" });
      out.push({ text: "logout" });
      out.push({ text: "Connection to shop closed." });
      this.sshdLog(log, pid, `pam_unix(sshd:session): session closed for user ${user}`);
      return 0;
    }
    const code = this.remote(u, remote, out, log);
    rec.note = out
      .filter((l) => !l.err && l.mark !== "dim")
      .map((l) => l.text)
      .join("\n");
    return code;
  }

  /** ssh のあとに書いたコマンド（お店のサーバーで、その人として動かす） */
  private remote(u: { uid: string; uidNumber: number; gidNumber: number; home: string }, line: string, out: OutLine[], log: RunLog): number {
    const toks = lex(line);
    if (typeof toks === "string") {
      out.push({ text: `bash: ${toks}`, err: true });
      return 2;
    }
    const groups: string[][] = [[]];
    for (const t of toks) {
      if (t.t === "w") groups[groups.length - 1]!.push(t.v);
      else groups.push([]);
    }
    let code = 0;
    for (const [cmd, ...args] of groups.filter((x) => x.length)) {
      code = 0;
      if (cmd === "whoami") {
        const who = this.nameOf(u.uidNumber, log);
        out.push({ text: who ?? String(u.uidNumber) });
        if (who && who !== u.uid) log.note(`Linux は、ユーザーを番号（uidNumber ${u.uidNumber}）で見分ける → ${u.uidNumber} を名簿でさがすと、最初に見つかるのは ${who}`, "ng", "unique");
      } else if (cmd === "id") {
        const who = this.nameOf(u.uidNumber, log) ?? String(u.uidNumber);
        const grp = this.groups.get(u.gidNumber);
        out.push({ text: `uid=${u.uidNumber}(${who}) gid=${u.gidNumber}${grp ? `(${grp})` : ""} groups=${u.gidNumber}${grp ? `(${grp})` : ""}` });
      } else if (cmd === "hostname") out.push({ text: "shop.wanko.shop" });
      else if (cmd === "pwd") out.push({ text: u.home });
      else if (cmd === "echo") out.push({ text: args.join(" ") });
      else if (cmd === "ls") code = this.lsAs(u.uidNumber, args, out, log);
      else if (cmd === "cat") {
        for (const p of args) {
          const n = this.fs.get(p);
          if (!n || n.dir) {
            out.push({ text: `cat: ${p}: ${n?.dir ? "Is a directory" : "No such file or directory"}`, err: true });
            code = 1;
          } else if (!this.canRead(n, u.uidNumber)) {
            out.push({ text: `cat: ${p}: Permission denied`, err: true });
            code = 1;
          } else {
            for (const l of (n.content ?? "").split("\n")) out.push({ text: l });
            if (n.uid === u.uidNumber) log.note(`ファイルの持ち主の番号は ${n.uid}、いまの人も ${u.uidNumber} → 自分のファイルとして読める`, n.uid === u.uidNumber && this.nameOf(n.uid, log) !== u.uid ? "ng" : "info", "unique");
          }
        }
      } else {
        out.push({ text: `bash: ${cmd}: command not found`, err: true });
        code = 127;
      }
    }
    return code;
  }

  private canRead(n: FsNode, uid: number): boolean {
    if (uid === 0) return true;
    if (n.uid === uid) return (n.mode & 0o400) !== 0;
    return (n.mode & 0o004) !== 0;
  }

  /** 番号から名前（SSSD で名簿をさがす。最初に見つかった人） */
  private nameOf(uid: number, log: RunLog): string | null {
    if (uid === 0) return "root";
    const u = this.sssdUser({ uid }, log);
    return u && u !== "offline" ? u.uid : null;
  }

  private lsAs(uid: number, args: string[], out: OutLine[], log: RunLog): number {
    const long = args.some((a) => a.startsWith("-") && a.includes("l"));
    const path = args.find((a) => !a.startsWith("-")) ?? "/home";
    const dir = this.fs.get(path);
    if (!dir) {
      out.push({ text: `ls: cannot access '${path}': No such file or directory`, err: true });
      return 2;
    }
    if (!dir.dir) {
      out.push({ text: long ? this.lsLine(path.split("/").pop()!, dir, log) : path });
      return 0;
    }
    const can = uid === 0 || (dir.uid === uid ? (dir.mode & 0o500) === 0o500 : (dir.mode & 0o005) === 0o005);
    if (!can) {
      out.push({ text: `ls: cannot open directory '${path}': Permission denied`, err: true });
      return 2;
    }
    const prefix = path.endsWith("/") ? path : `${path}/`;
    const kids = [...this.fs.entries()].filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"));
    if (long) out.push({ text: `total ${kids.length * 4}` });
    for (const [p, n] of kids) out.push({ text: long ? this.lsLine(p.slice(prefix.length), n, log) : p.slice(prefix.length) });
    return 0;
  }

  private lsLine(name: string, n: FsNode, log: RunLog): string {
    const bits = (m: number) => `${m & 4 ? "r" : "-"}${m & 2 ? "w" : "-"}${m & 1 ? "x" : "-"}`;
    const mode = `${n.dir ? "d" : "-"}${bits(n.mode >> 6)}${bits(n.mode >> 3)}${bits(n.mode)}.`;
    const owner = this.nameOf(n.uid, log) ?? String(n.uid);
    const group = this.groups.get(n.gid) ?? String(n.gid);
    return `${mode} ${n.dir ? 2 : 1} ${owner} ${group} ${String(n.size ?? (n.content?.length ?? 4096)).padStart(4)} ${n.mtime ?? "Oct 10 18:20"} ${name}`;
  }

  private ls(host: HostId, args: string[], out: OutLine[]): number {
    if (host === "shop" && args.some((a) => a.startsWith("/"))) return this.lsAs(0, args, out, new RunLog());
    const names = [...this.files[host].keys()].filter((k) => !k.startsWith("/"));
    if (names.length) out.push({ text: names.join("  ") });
    return 0;
  }

  private systemctl(host: HostId, args: string[], out: OutLine[], log: RunLog): number {
    const [verb, unitRaw] = args;
    const unit = (unitRaw ?? "").replace(/\.service$/, "");
    const here = host === "shop" ? ["sssd", "sshd"] : host === "ldap" ? ["slapd"] : [];
    if (!verb || !unit) {
      out.push({ text: "使い方：systemctl restart sssd ／ systemctl status sssd", err: true });
      return 1;
    }
    if (!here.includes(unit)) {
      out.push({ text: `Failed to ${verb} ${unit}.service: Unit ${unit}.service not found.`, err: true });
      if (unit === "sssd") log.note("SSSD が動いているのは「お店のサーバー」", "warn", "sssd:running");
      if (unit === "slapd") log.note("slapd が動いているのは「LDAP サーバー」", "warn");
      return 5;
    }
    if (verb === "restart" || verb === "reload") {
      if (unit === "sssd") {
        this.sssd.running = { ...this.sssd.file };
        this.sssdLog(log, "Starting up");
        log.note("SSSD を再起動した → sssd.conf を読みなおした（ここから新しい設定で動く）", "ok", "sssd:running");
      } else if (unit === "slapd") {
        this.server.log(log, "ldap", "slapd", "slapd stopped.");
        this.server.log(log, "ldap", "slapd", "@(#) $OpenLDAP: slapd 2.6.8 $ ... slapd starting");
        log.note("slapd を再起動した（cn=config の設定は、再起動しなくても、もう効いている）", "info");
      }
      return 0;
    }
    if (verb === "status") {
      const name = unit === "sssd" ? "System Security Services Daemon" : unit === "sshd" ? "OpenSSH server daemon" : "OpenLDAP Server Daemon";
      out.push({ text: `● ${unit}.service - ${name}` });
      out.push({ text: `     Loaded: loaded (/usr/lib/systemd/system/${unit}.service; enabled)` });
      out.push({ text: `     Active: active (running) since Wed 2026-10-14 09:58:02 JST`, mark: "ok" });
      if (unit === "sssd" && sssdConf(this.sssd.file) !== sssdConf(this.sssd.running)) {
        out.push({ text: "（sssd.conf は書きかえてあるけど、まだ読みこんでいない）", mark: "dim" });
        log.note("いま動いている SSSD は、書きかえる前の設定のまま", "warn", "sssd:running");
      }
      return 0;
    }
    out.push({ text: `この部屋では systemctl ${verb} は使えません（restart・status が使えます）`, err: true });
    return 1;
  }

  private getent(args: string[], out: OutLine[], log: RunLog): number {
    const [db, key] = args;
    if (db === "group") {
      for (const [gid, name] of this.groups) if (!key || key === name || key === String(gid)) out.push({ text: `${name}:x:${gid}:` });
      return 0;
    }
    if (db !== "passwd" || !key) {
      out.push({ text: "使い方：getent passwd ユーザー（か番号）", err: true });
      return 1;
    }
    const u = /^\d+$/.test(key) ? this.sssdUser({ uid: Number(key) }, log) : this.sssdUser({ name: key }, log);
    if (!u || u === "offline") return 2;
    out.push({ text: `${u.uid}:*:${u.uidNumber}:${u.gidNumber}::${u.home}:${u.shell}` });
    return 0;
  }

  private idCmd(args: string[], out: OutLine[], log: RunLog): number {
    const name = args[0];
    if (!name) {
      out.push({ text: "uid=0(root) gid=0(root) groups=0(root)" });
      return 0;
    }
    const u = this.sssdUser({ name }, log);
    if (!u || u === "offline") {
      out.push({ text: `id: ‘${name}’: no such user`, err: true });
      return 1;
    }
    const grp = this.groups.get(u.gidNumber);
    out.push({ text: `uid=${u.uidNumber}(${u.uid}) gid=${u.gidNumber}${grp ? `(${grp})` : ""} groups=${u.gidNumber}${grp ? `(${grp})` : ""}` });
    return 0;
  }
}

/** 検索で見つかった1件を、LDIF の行に */
export function entryLines(h: SearchHit, noWrap = false): OutLine[] {
  const out: OutLine[] = [];
  if (h.dn === "") out.push({ text: "dn:" });
  else out.push(...ldifLines("dn", h.dn, noWrap));
  for (const [name, vals] of h.attrs) for (const v of vals) out.push(...ldifLines(name, v, noWrap));
  return out;
}

export const ldapConf = (c: ClientConf) =>
  [
    "# /etc/openldap/ldap.conf：ldapsearch などが、-H・-b を省いたときに使う",
    `URI     ${c.uri}`,
    `BASE    ${c.base}`,
    "TLS_CACERT /etc/openldap/certs/wanko-ca.crt",
    "TLS_REQCERT demand",
  ].join("\n");

export const sssdConf = (s: SssdConf) =>
  [
    "[sssd]",
    "services = nss, pam",
    "domains = wanko",
    "",
    "[domain/wanko]",
    "id_provider = ldap",
    "auth_provider = ldap",
    `ldap_uri = ${s.uri}`,
    `ldap_search_base = ${s.base}`,
    "ldap_tls_cacert = /etc/pki/tls/certs/wanko-ca.crt",
    `ldap_default_bind_dn = ${s.bindDn}`,
    `ldap_default_authtok = ${s.bindPw}`,
    ...(s.access === "ldap" ? ["access_provider = ldap", `ldap_access_filter = ${s.filter}`] : []),
    "cache_credentials = false",
  ].join("\n");

const HELP = [
  "この部屋で使えるコマンド（本物と同じ形です）",
  "  ldapsearch -x [-LLL] [-D DN -w パスワード] [-b ベース] [-s base|one|sub] [-ZZ] \"(フィルタ)\" [属性…]",
  "  ldapwhoami -x -D DN -w パスワード [-ZZ] [-e ppolicy]",
  "  ldapadd / ldapmodify -x -D DN -w パスワード -f ファイル.ldif",
  "  ldapdelete -x -D DN -w パスワード \"DN\"",
  "  ldappasswd -x -D DN -w パスワード -s 新しいパスワード [DN]",
  "  （LDAP サーバーで）ldapmodify -Y EXTERNAL -H ldapi:/// -f 設定.ldif ／ slappasswd -s パスワード ／ slapcat ／ journalctl -u slapd",
  "  ssh ユーザー@shop [コマンド]   （お店のサーバーへログイン）",
  "  （お店のサーバーで）systemctl restart sssd ／ getent passwd ユーザー ／ id ユーザー ／ tail /var/log/secure",
  "  cat ファイル ／ ls ／ sleep 秒 ／ clear",
  "  && ・ || ・ ; でつなげられます。パイプ（|）は使えません",
];

/** ldapsearch の出力のうち、名簿の属性の行か（台本で光らせるため） */
export const isAttrLine = (l: OutLine, name: string) => !l.err && new RegExp(`^${name}::? `, "i").test(l.text);

/** その属性を、この部屋のサーバーが知っているか（台本の説明のため） */
export const knows = (lab: LdapLab, name: string) => Boolean(attrDef(lab.server.cfg, name));

/** DN をそろえる（台本で比べるため） */
export const sameDn = (lab: LdapLab, a: string, b: string) => normDn(lab.server.cfg, a) === normDn(lab.server.cfg, b);

export { rdnOf };
