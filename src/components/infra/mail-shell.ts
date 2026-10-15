/**
 * 勉強部屋（メールサーバー）のターミナル：3台のコンピューター（あなたのパソコン・メールサーバー・外のサーバー）と、
 * 本物と同じ形のコマンド。
 *
 * - あなたのパソコン（pc）・外のサーバー（out）… swaks（SMTP のやりとりを全部見せる）・curl（IMAP・POP3）・dig
 * - メールサーバー（mail）… root。postconf・postfix・mailq・postqueue・postsuper・postcat・newaliases・postalias・
 *   doveconf・doveadm・systemctl・m4・makemap・ss・sed・echo・cat・ls・tail・grep …
 * パイプ（|）は使えない。リダイレクト（> ・>> ・<）と、&& ・ || ・ ; は使える。
 */
import { b64encode, utf8 } from "./ldap-bits";
import { lex } from "./ldap-shell";
import {
  AUTH_SOCKET,
  DC_DEFAULTS,
  HOST_FQDN,
  HOST_IDS,
  HOST_IP,
  LMTP_SOCKET,
  MailWorld,
  PF_DEFAULTS,
  RunLog,
  USERS,
  dcGet,
  dcHas,
  editMainCf,
  headerOf,
  homeOf,
  m4Sendmail,
  mailText,
  parseAccess,
  parseAliases,
  parseDovecot,
  parseMainCf,
  pfGet,
  pfRaw,
  ptrName,
  rfcDate,
  resolveA,
  resolveMx,
  type HostId,
  type LogLine,
  type OpRecord,
  type OutLine,
  type Packet,
  type Reply,
  type Stored,
  type TraceItem,
  type WireMode,
} from "./mail";

export { HOST_IDS };
export type { HostId };

export type HostInfo = { id: HostId; user: string; prompt: string; label: string; home: string };
export const HOSTS: Record<HostId, HostInfo> = {
  pc: { id: "pc", user: "kakari", prompt: "kakari@pc:~$", label: "あなたのパソコン", home: "/home/kakari" },
  mail: { id: "mail", user: "root", prompt: "root@mail:~#", label: "メールサーバー", home: "/root" },
  out: { id: "out", user: "guest", prompt: "guest@out:~$", label: "外のサーバー", home: "/home/guest" },
};

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
  world: MailWorld;
  /** パソコン・外のサーバーのファイル（メールサーバーのファイルは world.files） */
  files?: Partial<Record<HostId, Record<string, string>>>;
};

const OUT_MAX = 1500;

/** 引数を「-x 値」「--long 値」「--long=値」に分ける。withArg にあるものだけ値をとる */
function opts(args: string[], withArg: string[], flags: string[]): { opt: Map<string, string[]>; rest: string[]; error: string | null } {
  const opt = new Map<string, string[]>();
  const rest: string[] = [];
  const add = (k: string, v: string) => opt.set(k, [...(opt.get(k) ?? []), v]);
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (!a.startsWith("-") || a === "-") {
      rest.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    const name = a.startsWith("--") && eq > 0 ? a.slice(0, eq) : a;
    if (withArg.includes(name)) {
      const v = a.startsWith("--") && eq > 0 ? a.slice(eq + 1) : args[++i];
      if (v == null) return { opt, rest, error: `option ${name} requires an argument` };
      add(name, v);
    } else if (flags.includes(name)) add(name, "");
    else if (/^--h-[A-Za-z-]+$/.test(name)) {
      const v = args[++i];
      if (v == null) return { opt, rest, error: `option ${name} requires an argument` };
      add("--header", `${name.slice(4)}: ${v}`);
    } else return { opt, rest, error: `unknown option ${a}` };
  }
  return { opt, rest, error: null };
}

const one = (o: Map<string, string[]>, ...names: string[]) => {
  for (const n of names) {
    const v = o.get(n);
    if (v?.length) return v[v.length - 1]!;
  }
  return undefined;
};
const flag = (o: Map<string, string[]>, ...names: string[]) => names.some((n) => o.has(n));

/** BRE（sed の正規表現）を JavaScript の正規表現にする（よく使うところだけ） */
function breToJs(src: string): string {
  let out = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (c === "\\" && i + 1 < src.length) {
      const n = src[++i]!;
      out += "(){}|+?".includes(n) ? n : `\\${n}`;
    } else if ("(){}|+?".includes(c)) out += `\\${c}`;
    else out += c;
  }
  return out;
}

export class MailLab {
  world: MailWorld;
  files: Record<"pc" | "out", Map<string, string>>;
  private runNo = 0;

  constructor(init: LabInit) {
    this.world = init.world;
    this.files = { pc: new Map(), out: new Map() };
    for (const h of ["pc", "out"] as const) for (const [k, v] of Object.entries(init.files?.[h] ?? {})) this.files[h].set(this.abs(h, k), v);
  }

  /* ---------- ファイル ---------- */

  abs(host: HostId, path: string): string {
    const home = HOSTS[host].home;
    let p = path.replace(/^~\//, `${home}/`);
    if (p === "~") p = home;
    if (/^~[a-z]+/.test(p)) p = p.replace(/^~([a-z]+)/, (_, u: string) => homeOf(u));
    if (!p.startsWith("/")) p = `${home}/${p.replace(/^\.\//, "")}`;
    const parts: string[] = [];
    for (const s of p.split("/")) {
      if (!s || s === ".") continue;
      if (s === "..") parts.pop();
      else parts.push(s);
    }
    return `/${parts.join("/")}`;
  }

  /** メールサーバーで、作られるファイル（ログ・mbox・Maildir の1通） */
  private virtual(): Map<string, () => string> {
    const w = this.world;
    const v = new Map<string, () => string>();
    v.set("/var/log/maillog", () => w.logs.map((l) => w.maillog(l)).join("\n"));
    for (const [file, list] of w.mboxes) v.set(file, () => list.map((s) => mboxEntry(s)).join("\n"));
    for (const [dir, box] of w.maildirs)
      for (const [folder, list] of box) {
        const base = folder === "INBOX" ? dir : `${dir}/.${folder}`;
        for (const sub of ["cur", "tmp"]) v.set(`${base}/${sub}/`, () => "");
        v.set(`${base}/new/`, () => "");
        for (const s of list) v.set(`${base}/new/${s.file}`, () => storedText(s));
      }
    if (w.aliasDb) v.set("/etc/aliases.db", () => "\u0000");
    if (w.accessDb) v.set("/etc/mail/access.db", () => "\u0000");
    if (w.mta === "postfix") for (const q of w.queue) v.set(`/var/spool/postfix/${q.status}/${q.qid}`, () => "\u0000");
    return v;
  }

  read(host: HostId, path: string): string | null {
    const p = this.abs(host, path);
    if (host !== "mail") return this.files[host].get(p) ?? null;
    const f = this.world.files.get(p);
    if (f != null) return f;
    return this.virtual().get(p)?.() ?? null;
  }

  write(host: HostId, path: string, text: string) {
    const p = this.abs(host, path);
    if (host === "mail") this.world.files.set(p, text);
    else this.files[host].set(p, text);
  }

  /** ディレクトリの中（すぐ下だけ）。ディレクトリでなければ null */
  private list(host: HostId, path: string): { name: string; dir: boolean; path: string }[] | null {
    const p = this.abs(host, path);
    const keys = host === "mail" ? [...this.world.files.keys(), ...this.virtual().keys()] : [...this.files[host].keys()];
    const homes = host === "mail" ? USERS.map((u) => `${homeOf(u.name)}/`) : [`${HOSTS[host].home}/`];
    const prefix = p === "/" ? "/" : `${p}/`;
    const seen = new Map<string, boolean>();
    for (const k of [...keys, ...homes]) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      if (!rest) continue;
      const name = rest.split("/")[0]!;
      const dir = rest.includes("/");
      seen.set(name, (seen.get(name) ?? false) || dir);
    }
    if (!seen.size) return keys.some((k) => k === `${prefix}`) || homes.includes(prefix) ? [] : null;
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, dir]) => ({ name, dir, path: `${prefix}${name}` }));
  }

  /* ---------- 実行 ---------- */

  run(host: HostId, line: string): Run {
    const log = new RunLog();
    const out: OutLine[] = [];
    const r: Run = { id: ++this.runNo, host, line, out, exit: 0, trace: log.trace, logs: log.logs, ops: log.ops, packets: log.packets };
    this.world.tick(1200 + this.world.rand() * 1800);
    const toks = lex(line);
    if (typeof toks === "string") {
      out.push({ text: `bash: ${toks}`, err: true });
      r.exit = 2;
      return r;
    }
    const bad = toks.find((t) => t.t === "op" && (t.v === "|" || t.v === "&"));
    if (bad) {
      out.push({ text: `この部屋では「${bad.v}」は使えません（> ・>> ・< と、&& ・ || ・ ; は使えます）`, err: true });
      r.exit = 2;
      return r;
    }
    type Seg = { join: string; words: string[]; outFile?: { path: string; append: boolean }; inFile?: string };
    const segs: Seg[] = [];
    let cur: Seg = { join: ";", words: [] };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]!;
      if (t.t === "w") {
        cur.words.push(t.v);
        continue;
      }
      if (t.v === ">" || t.v === "<") {
        const append = t.v === ">" && toks[i + 1]?.t === "op" && toks[i + 1]!.v === ">";
        if (append) i++;
        const target = toks[i + 1];
        if (target?.t !== "w") {
          out.push({ text: "bash: syntax error near unexpected token `newline'", err: true });
          r.exit = 2;
          return r;
        }
        i++;
        if (t.v === "<") cur.inFile = target.v;
        else cur.outFile = { path: target.v, append };
        continue;
      }
      if (cur.words.length) segs.push(cur);
      else if (t.v !== ";") {
        out.push({ text: `bash: syntax error near unexpected token \`${t.v}'`, err: true });
        r.exit = 2;
        return r;
      }
      cur = { join: t.v, words: [] };
    }
    if (cur.words.length) segs.push(cur);
    let last = 0;
    for (const seg of segs) {
      if (seg.join === "&&" && last !== 0) continue;
      if (seg.join === "||" && last === 0) continue;
      let stdin: string | null = null;
      if (seg.inFile) {
        stdin = this.read(host, seg.inFile);
        if (stdin == null) {
          out.push({ text: `bash: ${seg.inFile}: No such file or directory`, err: true });
          last = 1;
          continue;
        }
      }
      const sink: OutLine[] = seg.outFile ? [] : out;
      last = this.exec(host, seg.words, sink, log, r, stdin);
      if (seg.outFile) {
        const text = sink.filter((l) => !l.err).map((l) => l.text).join("\n");
        out.push(...sink.filter((l) => l.err));
        const p = this.abs(host, seg.outFile.path);
        const before = this.read(host, p);
        const next = seg.outFile.append && before != null ? `${before}${before.endsWith("\n") || !before ? "" : "\n"}${text}\n` : `${text}\n`;
        this.write(host, p, next);
        r.ops.push({ kind: "file", code: 0, note: p });
        this.fileNote(host, p, log);
      }
      if (out.length > OUT_MAX) {
        out.splice(OUT_MAX);
        out.push({ text: "…（長いので、ここから先は省きました）", mark: "dim" });
        break;
      }
    }
    r.exit = last;
    return r;
  }

  /** 設定ファイルを書きかえたときの、ひとこと（まだ効いていない など） */
  private fileNote(host: HostId, p: string, log: RunLog) {
    if (host !== "mail") return;
    if (p === "/etc/aliases") log.note("/etc/aliases を書きかえた。でも Postfix・sendmail が読むのは **/etc/aliases.db** → **newaliases** で作りなおすまで効かない", "warn", "aliases:db");
    else if (p === "/etc/mail/access") log.note("/etc/mail/access を書きかえた。sendmail が読むのは **access.db** → **makemap** で作りなおすまで効かない", "warn", "sendmail:db");
    else if (p === "/etc/mail/sendmail.mc") log.note("sendmail.mc を書きかえた。sendmail が読むのは **sendmail.cf** → m4 で作りなおして、再起動するまで効かない", "warn", "sendmail:cf");
    else if (p === "/etc/mail/sendmail.cf") log.note("sendmail.cf を作った。動いている sendmail は、**systemctl restart sendmail** で読みこむ", "info", "sendmail:cf");
    else if (p.startsWith("/etc/dovecot/")) log.note("Dovecot の設定を書きかえた。動いている Dovecot は、**systemctl reload dovecot** で読みこむ", "warn", "dovecot:running");
    else if (p === "/etc/postfix/main.cf" || p === "/etc/postfix/master.cf") log.note("Postfix の設定を書きかえた。**postfix reload** で読みこむ", "warn", "postfix:running");
  }

  private exec(host: HostId, argv: string[], out: OutLine[], log: RunLog, r: Run, stdin: string | null): number {
    let args = [...argv];
    while (args[0] === "sudo") args = args.slice(1);
    const cmd = args[0] ?? "";
    const rest = args.slice(1);
    const say = (text: string, extra: Partial<OutLine> = {}) => out.push({ text, ...extra });
    const err = (text: string) => out.push({ text, err: true });
    const w = this.world;
    const onMail = (c: string) => {
      if (host === "mail") return true;
      err(`bash: ${c}: command not found`);
      log.note(`${c} はメールサーバーに入っているコマンド（「メールサーバー」で打とう）`, "warn");
      return false;
    };
    const needPostfix = (c: string) => {
      if (!onMail(c)) return false;
      if (w.mta === "postfix") return true;
      err(`bash: ${c}: command not found`);
      log.note("このメールサーバーは sendmail で動いている（Postfix は入っていない）", "warn");
      return false;
    };
    switch (cmd) {
      case "":
        return 0;
      case "help":
        for (const l of helpLines(host, w.mta)) say(l, { mark: l.startsWith("#") ? "dim" : undefined });
        return 0;
      case "clear":
        r.clear = true;
        return 0;
      case "hostname":
        say(HOST_FQDN[host]);
        return 0;
      case "whoami":
        say(HOSTS[host].user);
        return 0;
      case "pwd":
        say(HOSTS[host].home);
        return 0;
      case "date":
        say(rfcDate(w.clock).replace(/^(\w+), (\d+) (\w+) (\d+) ([\d:]+) \+0900$/, "$1 $3 $2 $5 JST $4"));
        return 0;
      case "echo": {
        const text = rest.filter((a) => a !== "-e" && a !== "-n").join(" ");
        say(rest.includes("-e") ? text.replace(/\\n/g, "\n") : text);
        return 0;
      }
      case "cat":
        return this.cat(host, rest, out, log);
      case "ls":
        return this.ls(host, rest, out);
      case "tail":
      case "head":
        return this.tailHead(host, cmd, rest, out);
      case "grep":
        return this.grep(host, rest, out);
      case "dig":
      case "host":
      case "nslookup":
        return this.dig(cmd, rest, out, log);
      case "swaks":
        return this.swaks(host, rest, out, log);
      case "curl":
        return this.curl(host, rest, out, log);
      case "telnet":
      case "nc":
      case "openssl":
        err(`${cmd}: この部屋では、1行ずつのやりとりはできません`);
        log.note(`${cmd} のかわりに、SMTP のやりとりをまとめて見せる **swaks**（送る）・**curl**（IMAP・POP3 で読む）を使おう`, "warn");
        return 1;
      case "mail":
      case "mailx":
      case "mutt":
        err(`bash: ${cmd}: command not found`);
        log.note("この部屋では、送るのは swaks、読むのは curl（IMAP・POP3）か doveadm を使おう", "warn");
        return 127;
      case "cp":
        return this.cp(host, rest, out);
      case "sed":
        return this.sed(host, rest, out, log);
      case "id":
        say(host === "mail" ? "uid=0(root) gid=0(root) groups=0(root)" : `uid=1000(${HOSTS[host].user}) gid=1000(${HOSTS[host].user}) groups=1000(${HOSTS[host].user})`);
        return 0;
      case "vi":
      case "vim":
      case "nano":
        err(`${cmd}: この部屋では、エディターは使えません`);
        log.note("設定は postconf -e ・ sed -i ・ echo … >> で書きかえよう", "warn");
        return 1;
      /* ---------- Postfix ---------- */
      case "postconf":
        return needPostfix(cmd) ? this.postconf(rest, out, log) : 127;
      case "postfix":
        return needPostfix(cmd) ? this.postfixCmd(rest, out, log) : 127;
      case "postqueue":
        if (!needPostfix(cmd)) return 127;
        if (rest[0] === "-p") return this.mailq(out, log);
        if (rest[0] === "-f") {
          w.flush(log);
          return 0;
        }
        err("postqueue: fatal: usage: postqueue -f | postqueue -p | postqueue -s site");
        return 64;
      case "postsuper":
        return needPostfix(cmd) ? this.postsuper(rest, out) : 127;
      case "postcat":
        return needPostfix(cmd) ? this.postcat(rest, out) : 127;
      case "postalias":
        return needPostfix(cmd) ? this.postalias(rest, out, log) : 127;
      case "postmap":
        if (!needPostfix(cmd)) return 127;
        err("postmap: この部屋では使いません（/etc/aliases は newaliases か postalias で .db にします）");
        return 1;
      case "newaliases":
        return onMail(cmd) ? this.newaliases(out, log) : 127;
      case "mailq":
        return onMail(cmd) ? this.mailq(out, log) : 127;
      case "sendmail":
        if (!onMail(cmd)) return 127;
        if (rest[0] === "-bp") return this.mailq(out, log);
        if (rest[0] === "-bi") return this.newaliases(out, log);
        if (rest[0] === "-q") {
          w.flush(log);
          return 0;
        }
        err("sendmail: この部屋では -bp（キューを見る）・-q（キューを配る）・-bi（newaliases）だけ使えます。送るのは swaks で");
        return 64;
      /* ---------- Dovecot ---------- */
      case "doveconf":
        return onMail(cmd) ? this.doveconf(rest, out) : 127;
      case "doveadm":
        return onMail(cmd) ? this.doveadm(rest, out, log) : 127;
      /* ---------- sendmail ---------- */
      case "m4":
        return onMail(cmd) ? this.m4(rest, out, log) : 127;
      case "makemap":
        return onMail(cmd) ? this.makemap(rest, out, log, stdin) : 127;
      case "make":
        if (!onMail(cmd)) return 127;
        err("make: この部屋では、m4 sendmail.mc > sendmail.cf ・ makemap hash access < access を1つずつ打とう");
        return 2;
      /* ---------- 共通 ---------- */
      case "systemctl":
      case "service":
        return onMail(cmd) ? this.systemctl(cmd, rest, out, log) : 127;
      case "ss":
      case "netstat":
        return onMail(cmd) ? this.ss(out) : 127;
      default:
        err(`bash: ${cmd}: command not found`);
        log.note("help で、このコンピューターで使えるコマンドが出ます", "warn");
        return 127;
    }
  }

  /* ---------- ファイルのコマンド ---------- */

  private cat(host: HostId, args: string[], out: OutLine[], log: RunLog): number {
    if (!args.length) {
      out.push({ text: "cat: 読むファイルを書こう（例：cat /etc/postfix/main.cf）", err: true });
      return 1;
    }
    let code = 0;
    for (const a of args) {
      const p = this.abs(host, a);
      const t = this.read(host, a);
      if (t == null) {
        out.push({ text: this.list(host, a) ? `cat: ${a}: Is a directory` : `cat: ${a}: No such file or directory`, err: true });
        code = 1;
        continue;
      }
      if (t === "\u0000") {
        out.push({ text: `（${p} は、プログラムが速く引けるようにした形（バイナリ）。cat では読めない）`, mark: "dim" });
        if (p === "/etc/aliases.db") log.note("aliases.db の中は postalias -q 名前 /etc/aliases で引ける", "info", "aliases:db");
        continue;
      }
      for (const l of t.replace(/\n$/, "").split("\n")) out.push({ text: l, mark: l.trimStart().startsWith("#") || l.startsWith("dnl") ? "dim" : undefined });
    }
    return code;
  }

  private ls(host: HostId, args: string[], out: OutLine[]): number {
    const long = args.some((a) => /^-[a-zA-Z]*l/.test(a));
    const paths = args.filter((a) => !a.startsWith("-"));
    let code = 0;
    for (const a of paths.length ? paths : ["."]) {
      const items = this.list(host, a);
      if (items == null) {
        if (this.read(host, a) != null) {
          out.push({ text: long ? this.lsLine(host, this.abs(host, a), this.abs(host, a).split("/").pop()!, false) : a });
          continue;
        }
        out.push({ text: `ls: cannot access '${a}': No such file or directory`, err: true });
        code = 2;
        continue;
      }
      if (paths.length > 1) out.push({ text: `${a}:` });
      if (long) {
        out.push({ text: `total ${items.length * 4}` });
        for (const it of items) out.push({ text: this.lsLine(host, it.path, it.name, it.dir) });
      } else if (items.length) out.push({ text: items.map((it) => it.name).join("  ") });
    }
    return code;
  }

  private lsLine(host: HostId, path: string, name: string, dir: boolean) {
    const owner = (() => {
      const m = /^\/(?:var\/mail|home)\/([a-z]+)/.exec(path);
      return host === "mail" && m && USERS.some((u) => u.name === m[1]) ? m[1]! : host === "mail" ? "root" : HOSTS[host].user;
    })();
    const size = dir ? 4096 : utf8(this.read(host, path) ?? "").length;
    const mode = dir ? "drwx------" : path.startsWith("/var/mail/") ? "-rw-rw----" : "-rw-r--r--";
    const group = path.startsWith("/var/mail/") ? "mail" : owner;
    return `${mode}. 1 ${owner.padEnd(6)} ${group.padEnd(6)} ${String(size).padStart(6)} Oct 15 10:00 ${name}`;
  }

  private tailHead(host: HostId, cmd: string, args: string[], out: OutLine[]): number {
    let n = 10;
    const files: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i]!;
      if (a === "-n") n = Number(args[++i] ?? 10);
      else if (/^-n\d+$/.test(a)) n = Number(a.slice(2));
      else if (/^-\d+$/.test(a)) n = Number(a.slice(1));
      else if (a === "-f") {
        out.push({ text: `${cmd}: この部屋では -f（待ちつづける）は使えません`, err: true });
        return 1;
      } else files.push(a);
    }
    if (!Number.isFinite(n) || n < 0) n = 10;
    if (!files.length) {
      out.push({ text: `${cmd}: 読むファイルを書こう（例：tail -n 5 /var/log/maillog）`, err: true });
      return 1;
    }
    let code = 0;
    for (const f of files) {
      const t = this.read(host, f);
      if (t == null || t === "\u0000") {
        out.push({ text: `${cmd}: cannot open '${f}' for reading: No such file or directory`, err: true });
        code = 1;
        continue;
      }
      const lines = t.replace(/\n$/, "").split("\n").filter((l, k, all) => l !== "" || all.length > 1);
      for (const l of cmd === "tail" ? lines.slice(Math.max(0, lines.length - n)) : lines.slice(0, n)) out.push({ text: l });
    }
    return code;
  }

  private grep(host: HostId, args: string[], out: OutLine[]): number {
    const flags = args.filter((a) => /^-[a-zA-Z]+$/.test(a)).join("");
    const rest = args.filter((a) => !/^-[a-zA-Z]+$/.test(a));
    const [pat, ...files] = rest;
    if (pat == null || !files.length) {
      out.push({ text: "Usage: grep [OPTION]... PATTERNS [FILE]...", err: true });
      return 2;
    }
    let re: RegExp;
    try {
      re = new RegExp(breToJs(pat), flags.includes("i") ? "i" : "");
    } catch {
      out.push({ text: "grep: Invalid regular expression", err: true });
      return 2;
    }
    let found = 0;
    for (const f of files) {
      const t = this.read(host, f);
      if (t == null) {
        out.push({ text: `grep: ${f}: No such file or directory`, err: true });
        continue;
      }
      const hits = t.split("\n").filter((l) => re.test(l) !== flags.includes("v"));
      found += hits.length;
      if (flags.includes("c")) out.push({ text: files.length > 1 ? `${f}:${hits.length}` : String(hits.length) });
      else for (const l of hits) out.push({ text: files.length > 1 ? `${f}:${l}` : l });
    }
    return found ? 0 : 1;
  }

  private cp(host: HostId, args: string[], out: OutLine[]): number {
    const files = args.filter((a) => !a.startsWith("-"));
    if (files.length !== 2) {
      out.push({ text: "cp: missing destination file operand", err: true });
      return 1;
    }
    const t = this.read(host, files[0]!);
    if (t == null) {
      out.push({ text: `cp: cannot stat '${files[0]}': No such file or directory`, err: true });
      return 1;
    }
    this.write(host, files[1]!, t);
    return 0;
  }

  private sed(host: HostId, args: string[], out: OutLine[], log: RunLog): number {
    const inPlace = args.includes("-i");
    const rest = args.filter((a) => a !== "-i" && a !== "-e");
    const [script, ...files] = rest;
    const m = script ? /^s(.)(.*)$/.exec(script) : null;
    if (!script || !m) {
      out.push({ text: "sed: この部屋では s/さがす/おきかえ/ だけ使えます（例：sed -i 's/= no/= yes/' ファイル）", err: true });
      return 1;
    }
    const d = m[1]!;
    const parts = m[2]!.split(d);
    if (parts.length < 3) {
      out.push({ text: `sed: -e expression #1, char ${script.length}: unterminated \`s' command`, err: true });
      return 1;
    }
    const [from, to, fl = ""] = parts;
    let re: RegExp;
    try {
      re = new RegExp(breToJs(from!), fl.includes("g") ? "g" : "");
    } catch {
      out.push({ text: "sed: -e expression #1: Invalid regular expression", err: true });
      return 1;
    }
    if (!files.length) {
      out.push({ text: "sed: no input files", err: true });
      return 1;
    }
    for (const f of files) {
      const t = this.read(host, f);
      if (t == null) {
        out.push({ text: `sed: can't read ${f}: No such file or directory`, err: true });
        return 2;
      }
      const next = t
        .split("\n")
        .map((l) => l.replace(re, to!.replace(/\\\//g, "/").replace(/&/g, "$&")))
        .join("\n");
      if (inPlace) {
        this.write(host, f, next);
        if (next === t) log.note(`${f} の中に「${from}」に合う行がなかった（何も変わっていない）`, "warn");
        else this.fileNote(host, this.abs(host, f), log);
      } else for (const l of next.replace(/\n$/, "").split("\n")) out.push({ text: l });
    }
    return 0;
  }

  private dig(cmd: string, args: string[], out: OutLine[], log: RunLog): number {
    let type = "A";
    let name = "";
    let short = cmd !== "dig";
    for (let i = 0; i < args.length; i++) {
      const a = args[i]!;
      if (a === "+short") short = true;
      else if (a === "-t") type = (args[++i] ?? "A").toUpperCase();
      else if (/^(MX|A|AAAA|TXT|NS)$/i.test(a)) type = a.toUpperCase();
      else if (!a.startsWith("-") && !a.startsWith("+")) name = a;
    }
    if (!name) {
      out.push({ text: `${cmd}: 名前を書こう（例：dig MX wanko.shop）`, err: true });
      return 1;
    }
    const answers: string[] = [];
    if (type === "MX") {
      const mx = resolveMx(name);
      if (mx) answers.push(`10 ${mx}.`);
    } else if (type === "A") {
      const a = resolveA(name);
      if (a && a !== name) answers.push(a);
    }
    r_dns: {
      if (cmd === "host") {
        if (!answers.length) {
          out.push({ text: `Host ${name} not found: 3(NXDOMAIN)`, err: true });
          return 1;
        }
        for (const a of answers) out.push({ text: type === "MX" ? `${name} mail is handled by ${a}` : `${name} has address ${a}` });
        break r_dns;
      }
      if (short) {
        for (const a of answers) out.push({ text: a });
        break r_dns;
      }
      out.push({ text: `; <<>> DiG 9.18.28 <<>> ${type} ${name}`, mark: "dim" });
      out.push({ text: `;; ->>HEADER<<- opcode: QUERY, status: ${answers.length ? "NOERROR" : "NXDOMAIN"}, id: ${10000 + Math.floor(this.world.rand() * 50000)}`, mark: "dim" });
      out.push({ text: ";; ANSWER SECTION:" });
      for (const a of answers) out.push({ text: `${name}.\t\t300\tIN\t${type}\t${a}` });
      out.push({ text: "" });
      out.push({ text: ";; SERVER: 192.168.10.1#53(192.168.10.1) (UDP)", mark: "dim" });
    }
    if (type === "MX") {
      log.note(answers.length ? `**MX**（メールの届け先）：${name} あてのメールは ${answers[0]!.replace(/^10 |\.$/g, "")} へ` : `${name} には MX がない`, answers.length ? "ok" : "warn", "dns:mx");
    }
    log.ops.push({ kind: "dns", code: answers.length ? 0 : 1 });
    return answers.length ? 0 : 1;
  }

  /* ---------- swaks（SMTP） ---------- */

  private swaks(host: HostId, args: string[], out: OutLine[], log: RunLog): number {
    const w = this.world;
    const o = opts(
      args,
      ["--to", "-t", "--from", "-f", "--server", "-s", "--port", "-p", "--ehlo", "--helo", "-h", "--header", "--body", "--auth-user", "-au", "--auth-password", "-ap", "--quit-after", "-q", "--data", "-d"],
      ["--auth", "-a", "--tls", "-tls", "--tls-optional", "-tlso", "--tls-on-connect", "-tlsc", "--suppress-data", "-n", "--silent", "-S"],
    );
    // --auth のあとの PLAIN・LOGIN（なくてもよい）
    let mech = "";
    const authAt = args.findIndex((a) => a === "--auth" || a === "-a");
    if (authAt >= 0 && args[authAt + 1] && /^(PLAIN|LOGIN)$/i.test(args[authAt + 1]!)) {
      mech = args[authAt + 1]!.toUpperCase();
      o.rest = o.rest.filter((x) => x !== args[authAt + 1]);
    }
    if (o.error) {
      out.push({ text: `*** ${o.error}`, err: true });
      return 1;
    }
    if (o.rest.length) {
      out.push({ text: `*** unknown argument: ${o.rest[0]}（オプションの名前を確かめよう。--to・--from・--server など）`, err: true });
      return 1;
    }
    const toList = (one(o.opt, "--to", "-t") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!toList.length) {
      out.push({ text: "*** --to（あて先）を書こう。例：swaks --to hana@wanko.shop --server mail.wanko.shop", err: true });
      return 1;
    }
    const from = one(o.opt, "--from", "-f") ?? `${HOSTS[host].user}@${HOST_FQDN[host]}`;
    const wantAuth = flag(o.opt, "--auth", "-a") || o.opt.has("--auth-user") || o.opt.has("-au");
    const user = one(o.opt, "--auth-user", "-au");
    const pass = one(o.opt, "--auth-password", "-ap");
    if (wantAuth && (!user || pass == null)) {
      out.push({ text: "*** AUTH には --auth-user と --auth-password を書こう（本物の swaks は、ここで聞いてくる）", err: true });
      return 1;
    }
    const tlsc = flag(o.opt, "--tls-on-connect", "-tlsc");
    const starttls = flag(o.opt, "--tls", "-tls");
    const tlsOpt = flag(o.opt, "--tls-optional", "-tlso");
    const quiet = flag(o.opt, "--suppress-data", "-n");
    const quitAfter = (one(o.opt, "--quit-after", "-q") ?? "").toLowerCase();
    let server = one(o.opt, "--server", "-s");
    let port = Number(one(o.opt, "--port", "-p") ?? (tlsc ? 465 : 25));
    if (server?.includes(":")) {
      const [h, pt] = server.split(":");
      server = h!;
      port = Number(pt);
    }
    if (!server) {
      const dom = toList[0]!.split("@")[1] ?? "";
      const mx = resolveMx(dom);
      if (!mx) {
        out.push({ text: `*** No MX for ${dom}（--server でつなぐ先を書こう）`, err: true });
        return 2;
      }
      server = mx;
      log.note(`--server がないので、${dom} の MX（${mx}）につなぐ`, "info", "dns:mx");
    }
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      out.push({ text: `*** bad port: ${port}`, err: true });
      return 1;
    }
    const helo = one(o.opt, "--ehlo", "--helo", "-h") ?? HOST_FQDN[host];
    const ip = resolveA(server);
    out.push({ text: `=== Trying ${server}:${port}...`, mark: "dim" });
    const conn = w.smtpConnect(host, server, port, log);
    const toNet = ip != null && ip.startsWith("198.51.100.");
    const op: OpRecord = { kind: "smtp", code: 0, from: host, to: toNet ? "net" : "mail", local: host === "mail" && !toNet, port, mode: tlsc ? "tls" : "plain", leak: false };
    log.ops.push(op);
    if (!conn.ok) {
      out.push({ text: `*** Error connecting to ${server}:${port}:`, err: true });
      out.push({ text: `***\tIO::Socket::INET6: connect: ${conn.error}`, err: true });
      op.refused = true;
      op.code = -1;
      if (conn.error === "Connection refused" && !log.trace.length) log.note(`${server} の ${port}番では、だれも待っていない（Connection refused）`, "ng", "port");
      return 2;
    }
    const s = conn.session;
    out.push({ text: `=== Connected to ${server}.`, mark: "dim" });
    const cport = 40000 + Math.floor(w.rand() * 20000);
    const cAddr = `${s.client.ip}:${cport}`;
    const sAddr = `${s.serverIp}:${port}`;
    let tls = tlsc;
    if (tlsc) {
      w.tlsHandshake(log, cAddr, sAddr);
      out.push({ text: "=== TLS started with cipher TLSv1.3:TLS_AES_256_GCM_SHA384:256", mark: "dim" });
      s.tlsUp();
    }
    const show = (rp: Reply, bad = false) => {
      for (const l of rp.lines) out.push({ text: `${tls ? (bad ? "<~* " : "<~  ") : bad ? "<** " : "<-  "}${l}`, err: bad, mark: bad ? undefined : rp.code < 400 ? undefined : "ng" });
      w.packet(log, sAddr, cAddr, "SMTP", `S: ${rp.lines[0]!.slice(0, 48)}`, rp.lines.join("\n") + "\n", tls);
      op.code = rp.code;
    };
    const send = (line: string, secret?: { part: string; shown: string; how?: string }): Reply => {
      out.push({ text: `${tls ? " ~> " : " -> "}${line}`, mark: secret && !tls ? "secret" : undefined });
      w.packet(log, cAddr, sAddr, "SMTP", `C: ${line.length > 40 ? `${line.slice(0, 40)}…` : line}`, `${line}\n`, tls, secret);
      return s.handle(line);
    };
    const finish = (code: number): number => {
      const q = send("QUIT");
      show(q);
      out.push({ text: "=== Connection closed with remote host.", mark: "dim" });
      s.close();
      op.mode = tlsc ? "tls" : tls ? "starttls" : "plain";
      op.leak = s.leaked;
      op.authed = Boolean(s.authUser);
      op.accepted = s.accepted;
      return code;
    };
    const ban = s.banner();
    show(ban);
    if (quitAfter === "connect" || quitAfter === "banner") return finish(0);
    let ehlo = send(`EHLO ${helo}`);
    show(ehlo, ehlo.code >= 400);
    if (ehlo.code >= 400) return finish(22);
    if (quitAfter === "ehlo" || quitAfter === "helo") return finish(0);
    const caps = () => ehlo.lines.map((l) => l.slice(4).toUpperCase());
    if ((starttls || tlsOpt) && !tls) {
      if (!caps().includes("STARTTLS")) {
        if (starttls) {
          out.push({ text: "*** STARTTLS not advertised by server（サーバーが STARTTLS を出していない）", err: true });
          log.note("--tls は「暗号にできないなら送らない」。サーバーが STARTTLS を出していないので、ここでやめた", "ng", "tls");
          return finish(29);
        }
      } else {
        const st = send("STARTTLS");
        show(st, st.code >= 400);
        if (st.code !== 220) return finish(29);
        w.tlsHandshake(log, cAddr, sAddr);
        tls = true;
        s.tlsUp();
        out.push({ text: "=== TLS started with cipher TLSv1.3:TLS_AES_256_GCM_SHA384:256", mark: "dim" });
        out.push({ text: "=== TLS peer DN=\"/CN=mail.wanko.shop\"", mark: "dim" });
        ehlo = send(`EHLO ${helo}`);
        show(ehlo);
      }
    }
    if (quitAfter === "tls") return finish(0);
    if (wantAuth) {
      const authCap = caps().find((c) => c.startsWith("AUTH "));
      if (!authCap) {
        out.push({ text: "*** Host did not advertise authentication（サーバーが AUTH を出していない）", err: true });
        return finish(28);
      }
      const m = mech || (authCap.includes("PLAIN") ? "PLAIN" : "LOGIN");
      let ar: Reply;
      if (m === "PLAIN") {
        const token = b64encode(utf8(`\0${user}\0${pass}`));
        ar = send(`AUTH PLAIN ${token}`, { part: token, shown: pass!, how: `base64 をもどすと「\\0${user}\\0${pass}」（名前とパスワード）` });
      } else {
        ar = send("AUTH LOGIN");
        if (ar.code === 334) {
          show(ar);
          ar = send(b64encode(utf8(user!)));
          if (ar.code === 334) {
            show(ar);
            const token = b64encode(utf8(pass!));
            ar = send(token, { part: token, shown: pass!, how: `base64 をもどすと「${pass}」（パスワード）` });
          }
        }
      }
      show(ar, ar.code >= 400);
      if (ar.code !== 235) return finish(28);
    }
    if (quitAfter === "auth") return finish(0);
    const mr = send(`MAIL FROM:<${from}>`);
    show(mr, mr.code >= 400);
    if (mr.code >= 400) return finish(23);
    if (quitAfter === "mail" || quitAfter === "from") return finish(0);
    let okRcpt = 0;
    for (const t of toList) {
      const rr = send(`RCPT TO:<${t}>`);
      show(rr, rr.code >= 400);
      if (rr.code < 400) okRcpt++;
    }
    if (!okRcpt) return finish(24);
    if (quitAfter === "rcpt" || quitAfter === "to") return finish(0);
    const dr = send("DATA");
    show(dr, dr.code >= 400);
    if (dr.code !== 354) return finish(25);
    const date = rfcDate(w.clock);
    const msgId = `<${new Date(w.clock + 9 * 3600e3).toISOString().replace(/\D/g, "").slice(0, 14)}.${String(w.newPid()).padStart(6, "0")}@${HOST_FQDN[host]}>`;
    const head: [string, string][] = [
      ["Date", date],
      ["To", toList.join(", ")],
      ["From", from],
      ["Subject", `test ${date}`],
      ["Message-Id", msgId],
      ["X-Mailer", "swaks v20240103.0 jetmore.org/john/code/swaks/"],
    ];
    for (const h of o.opt.get("--header") ?? []) {
      const m2 = /^([A-Za-z0-9-]+):\s*(.*)$/.exec(h);
      if (!m2) continue;
      const at = head.findIndex(([k]) => k.toLowerCase() === m2[1]!.toLowerCase());
      if (at >= 0) head[at] = [head[at]![0], m2[2]!];
      else head.push([m2[1]!, m2[2]!]);
    }
    const body = (one(o.opt, "--body") ?? "This is a test mailing").replace(/\\n/g, "\n");
    const dataLines = [...head.map(([k, v]) => `${k}: ${v}`), "", ...body.split("\n"), "", "."];
    if (quiet) out.push({ text: `${tls ? " ~> " : " -> "}${dataLines.length} lines sent`, mark: "dim" });
    else for (const l of dataLines) out.push({ text: `${tls ? " ~> " : " -> "}${l}` });
    w.packet(log, cAddr, sAddr, "SMTP", `C: (メールの中身 ${dataLines.length}行)`, dataLines.join("\n") + "\n", tls);
    const fin = s.data(head, body);
    show(fin, fin.code >= 400);
    return finish(fin.code < 400 ? 0 : 26);
  }

  /* ---------- curl（IMAP・POP3） ---------- */

  private curl(host: HostId, args: string[], out: OutLine[], log: RunLog): number {
    const w = this.world;
    const o = opts(args, ["-u", "--user", "-X", "--request"], ["-v", "--verbose", "-s", "--silent", "-k", "--insecure", "--ssl-reqd", "--ssl", "-sv", "-vs"]);
    if (o.error) {
      out.push({ text: `curl: ${o.error}`, err: true });
      return 2;
    }
    const verbose = flag(o.opt, "-v", "--verbose", "-sv", "-vs");
    const url = o.rest[0];
    if (!url) {
      out.push({ text: "curl: no URL specified!", err: true });
      return 2;
    }
    const m = /^([a-z0-9]+):\/\/([^/:]+)(?::(\d+))?(\/.*)?$/i.exec(url);
    if (!m) {
      out.push({ text: `curl: (3) URL rejected: Malformed input to a URL function`, err: true });
      return 3;
    }
    const scheme = m[1]!.toLowerCase();
    if (!["imap", "imaps", "pop3", "pop3s"].includes(scheme)) {
      out.push({ text: `curl: (1) Protocol "${scheme}" not supported`, err: true });
      log.note("この部屋の curl は、メールを読む imap:// ・ imaps:// ・ pop3:// ・ pop3s:// だけ", "warn");
      return 1;
    }
    const pop = scheme.startsWith("pop3");
    const implicit = scheme.endsWith("s");
    const port = Number(m[3] ?? (pop ? (implicit ? 995 : 110) : implicit ? 993 : 143));
    const name = m[2]!;
    const path = decodeURIComponent(m[4] ?? "/");
    const cred = one(o.opt, "-u", "--user");
    if (!cred) {
      out.push({ text: "curl: (67) Login denied（-u 名前:パスワード を書こう）", err: true });
      return 67;
    }
    const [user = "", ...pwParts] = cred.split(":");
    const pw = pwParts.join(":");
    const ip = resolveA(name);
    const vsay = (text: string, extra: Partial<OutLine> = {}) => {
      if (verbose) out.push({ text, mark: "dim", ...extra });
    };
    vsay(`*   Trying ${ip ?? name}:${port}...`);
    const local = host === "mail" && (ip === "127.0.0.1" || ip === HOST_IP.mail);
    const reach = ip === HOST_IP.mail || local;
    const dc = w.dc;
    const proto = pop ? "pop3" : "imap";
    const listening = reach && dc && dcGet(dc, "protocols").split(/\s+/).includes(proto) && (!implicit || dcGet(dc, "ssl") !== "no");
    const op: OpRecord = { kind: pop ? "pop3" : "imap", code: 0, from: host, to: "mail", local, port, mode: implicit ? "tls" : "plain", leak: false };
    log.ops.push(op);
    if (!ip) {
      out.push({ text: `curl: (6) Could not resolve host: ${name}`, err: true });
      op.refused = true;
      return 6;
    }
    if (!listening) {
      out.push({ text: `curl: (7) Failed to connect to ${name} port ${port} after 2 ms: Couldn't connect to server`, err: true });
      log.note(reach && dc ? `Dovecot は ${port}番で待っていない（protocols = ${dcGet(dc, "protocols")}）` : "そこでは IMAP・POP3 のサーバーが動いていない", "ng", "port");
      op.refused = true;
      return 7;
    }
    const cIp = local ? "127.0.0.1" : HOST_IP[host];
    const cAddr = `${cIp}:${40000 + Math.floor(w.rand() * 20000)}`;
    const sAddr = `${local ? "127.0.0.1" : HOST_IP.mail}:${port}`;
    vsay(`* Connected to ${name} (${ip}) port ${port}`);
    let tls = implicit;
    if (tls) {
      w.tlsHandshake(log, cAddr, sAddr);
      vsay("* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384 / X25519 / RSASSA-PSS");
    }
    const sess = `<${b64encode(Uint8Array.from({ length: 9 }, () => Math.floor(w.rand() * 256)))}>`;
    const loginLog = (ok: boolean, method: string, extra = "") =>
      w.log(
        log,
        "dovecot",
        ok
          ? `dovecot: ${proto}-login: Login: user=<${user}>, method=${method}, rip=${cIp}, lip=${local ? "127.0.0.1" : HOST_IP.mail}, mpid=${w.newPid()}${tls ? ", TLS" : local ? ", secured" : ""}, session=${sess}`
          : `dovecot: ${proto}-login: Disconnected: Aborted login by logging out (${extra}): user=<${method ? user : ""}>${method ? `, method=${method}` : ""}, rip=${cIp}, lip=${local ? "127.0.0.1" : HOST_IP.mail}${tls ? ", TLS" : ""}, session=${sess}`,
      );
    const srv = (text: string) => {
      for (const l of text.split("\n")) vsay(`< ${l}`);
      w.packet(log, sAddr, cAddr, pop ? "POP3" : "IMAP", `S: ${text.split("\n")[0]!.slice(0, 48)}`, `${text}\n`, tls);
    };
    const cli = (text: string, secret?: { part: string; shown: string; how?: string }) => {
      vsay(`> ${text}`, secret && !tls ? { mark: "secret" } : {});
      w.packet(log, cAddr, sAddr, pop ? "POP3" : "IMAP", `C: ${text.length > 40 ? `${text.slice(0, 40)}…` : text}`, `${text}\n`, tls, secret);
    };
    const stale = w.dcStale();
    if (stale.length) log.note(`Dovecot の設定ファイル（${stale.slice(0, 2).join("・")}）は書きかえてあるが、**動いている Dovecot はまだ前の設定**（reload していない）`, "warn", "dovecot:running");
    const secured = () => tls || local;
    const plainOk = () => w.dcPlainAllowed(secured());
    const sslReqd = flag(o.opt, "--ssl-reqd", "--ssl");
    const done = (code: number) => {
      op.mode = implicit ? "tls" : tls ? "starttls" : "plain";
      op.code = code;
      if (verbose) out.push({ text: "* Closing connection", mark: "dim" });
      return code;
    };
    const fail = (code: number, text: string) => {
      out.push({ text: `curl: (${code}) ${text}`, err: true });
      return done(code);
    };
    const authToken = b64encode(utf8(`\0${user}\0${pw}`));
    const authSecret = { part: authToken, shown: pw, how: `base64 をもどすと「\\0${user}\\0${pw}」（名前とパスワード）` };
    const noteAuth = () => {
      if (local && !tls) log.note("メールサーバーの中（127.0.0.1）からのつながりは、Dovecot は **安全（secured）** とみなす → 平文のログインも通す", "warn", "imap:local");
      else if (tls) log.note(`${implicit ? `${port}番は、はじめから暗号（${scheme}://）` : "STARTTLS で暗号にした"} → ログインしてよい`, "ok", "imap");
      else if (plainOk()) log.note("**disable_plaintext_auth = no** → 暗号なしでも、パスワードでのログインを受けつける。パスワードがそのまま流れる", "ng", "imap");
      else log.note("**disable_plaintext_auth = yes** → 暗号なしのつながりでは、パスワードでのログインを出さない（LOGINDISABLED）", "ok", "imap");
    };

    if (pop) {
      srv("+OK Dovecot ready.");
      cli("CAPA");
      const capa = () => ["+OK", "CAPA", "TOP", "UIDL", "RESP-CODES", "PIPELINING", "AUTH-RESP-CODE", ...(tls ? [] : ["STLS"]), ...(plainOk() ? ["USER", "SASL PLAIN"] : []), "."].join("\n");
      srv(capa());
      if (sslReqd && !tls) {
        cli("STLS");
        srv("+OK Begin TLS negotiation now.");
        w.tlsHandshake(log, cAddr, sAddr);
        tls = true;
        vsay("* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384");
        cli("CAPA");
        srv(capa());
      }
      noteAuth();
      if (!plainOk()) {
        cli(`USER ${user}`);
        srv("-ERR [AUTH] Plaintext authentication disallowed on non-secure (SSL/TLS) connections.");
        loginLog(false, "", "no auth attempts in 0 secs");
        return fail(67, "Login denied");
      }
      cli(`AUTH PLAIN ${authToken}`, authSecret);
      if (!tls) op.leak = true;
      if (!w.checkPassword(user, pw)) {
        srv("-ERR [AUTH] Authentication failed.");
        loginLog(false, "PLAIN", "auth failed, 1 attempts in 2 secs");
        log.note(`${user} のパスワードがちがう`, "ng", "imap");
        return fail(67, "Login denied");
      }
      srv("+OK Logged in.");
      loginLog(true, "PLAIN");
      op.authed = true;
      const inbox = w.folders(user).get("INBOX") ?? [];
      const n = /^\/(\d+)$/.exec(path)?.[1];
      if (n) {
        const s = inbox[Number(n) - 1];
        cli(`RETR ${n}`);
        if (!s) {
          srv("-ERR There's no message " + n + ".");
          return fail(78, "Remote file not found");
        }
        srv(`+OK ${s.mail.size} octets`);
        for (const l of storedText(s).split("\n")) out.push({ text: l });
      } else {
        cli("LIST");
        srv(["+OK " + inbox.length + " messages:", ...inbox.map((s, k) => `${k + 1} ${s.mail.size}`), "."].join("\n"));
        for (const [k, s] of inbox.entries()) out.push({ text: `${k + 1} ${s.mail.size}` });
        log.note(`POP3 で見えるのは INBOX だけ（${inbox.length}通）。読むと、ふつうはパソコンに持っていって消す`, "info", "pop3");
      }
      cli("QUIT");
      srv("+OK Logging out.");
      return done(0);
    }

    const capList = () => ["IMAP4rev1", "SASL-IR", "LOGIN-REFERRALS", "ID", "ENABLE", "IDLE", "LITERAL+", ...(tls ? [] : ["STARTTLS"]), plainOk() ? "AUTH=PLAIN" : "LOGINDISABLED"].join(" ");
    srv(`* OK [CAPABILITY ${capList()}] Dovecot ready.`);
    let tagNo = 1;
    const tag = () => `A${String(tagNo++).padStart(3, "0")}`;
    let t = tag();
    cli(`${t} CAPABILITY`);
    srv(`* CAPABILITY ${capList()}\n${t} OK Pre-login capabilities listed, post-login capabilities have more.`);
    if (sslReqd && !tls) {
      t = tag();
      cli(`${t} STARTTLS`);
      srv(`${t} OK Begin TLS negotiation now.`);
      w.tlsHandshake(log, cAddr, sAddr);
      tls = true;
      vsay("* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384");
      t = tag();
      cli(`${t} CAPABILITY`);
      srv(`* CAPABILITY ${capList()}\n${t} OK Pre-login capabilities listed, post-login capabilities have more.`);
    }
    noteAuth();
    if (!plainOk()) {
      vsay("* No known authentication mechanisms supported!");
      loginLog(false, "", "no auth attempts in 0 secs");
      t = tag();
      cli(`${t} LOGOUT`);
      srv(`* BYE Logging out\n${t} OK Logout completed.`);
      return fail(67, "Login denied");
    }
    t = tag();
    cli(`${t} AUTHENTICATE PLAIN ${authToken}`, authSecret);
    if (!tls) op.leak = true;
    if (!w.checkPassword(user, pw)) {
      srv(`${t} NO [AUTHENTICATIONFAILED] Authentication failed.`);
      loginLog(false, "PLAIN", "auth failed, 1 attempts in 2 secs");
      log.note(`${user} のパスワードがちがう → ログインできない`, "ng", "imap");
      return fail(67, "Login denied");
    }
    srv(`${t} OK [CAPABILITY IMAP4rev1 SASL-IR LOGIN-REFERRALS ID ENABLE IDLE SORT THREAD=REFERENCES MOVE] Logged in`);
    loginLog(true, "PLAIN");
    op.authed = true;
    const folders = w.folders(user);
    const loc = w.location(user);
    log.note(`mail_location = ${loc.explain} → Dovecot は **${loc.kind === "maildir" ? `${loc.path}/` : loc.path}** を ${user} のメールボックスとして見る`, "info", "maildir");
    const custom = one(o.opt, "-X", "--request");
    const qm = /^\/([^;?]*)(?:;UID=(\d+))?(?:\?(.*))?$/i.exec(path);
    const box = (qm?.[1] ?? "").replace(/\/$/, "");
    if (custom) {
      const st = /^STATUS\s+(\S+)\s+\(([^)]*)\)$/i.exec(custom.trim());
      t = tag();
      cli(`${t} ${custom}`);
      if (st && folders.has(st[1]!)) {
        const list = folders.get(st[1]!)!;
        const items = st[2]!.split(/\s+/).map((k) => `${k.toUpperCase()} ${k.toUpperCase() === "UIDNEXT" ? (list.at(-1)?.uid ?? 0) + 1 : list.length}`);
        const line = `* STATUS ${st[1]} (${items.join(" ")})`;
        srv(`${line}\n${t} OK Status completed.`);
        out.push({ text: line });
      } else {
        srv(`${t} NO Mailbox doesn't exist: ${st?.[1] ?? custom}`);
        return fail(78, "Remote file not found");
      }
    } else if (!box) {
      t = tag();
      cli(`${t} LIST "" *`);
      const lines = [...folders.keys()].map((f) => `* LIST (\\HasNoChildren${f === "INBOX" ? "" : ""}) "." ${f}`);
      srv(`${lines.join("\n")}\n${t} OK List completed (0.001 + 0.000 secs).`);
      for (const l of lines) out.push({ text: l });
    } else {
      const list = folders.get(box);
      t = tag();
      cli(`${t} SELECT ${box}`);
      if (!list) {
        srv(`${t} NO Mailbox doesn't exist: ${box}`);
        return fail(78, "Remote file not found");
      }
      srv(`* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)\n* ${list.length} EXISTS\n* 0 RECENT\n${t} OK [READ-WRITE] Select completed.`);
      if (qm?.[2]) {
        const s = list.find((x) => x.uid === Number(qm[2]));
        t = tag();
        cli(`${t} UID FETCH ${qm[2]} BODY[]`);
        if (!s) {
          srv(`${t} OK Fetch completed (no messages).`);
          return fail(78, "Remote file not found");
        }
        const text = storedText(s);
        srv(`* 1 FETCH (UID ${s.uid} BODY[] {${utf8(text).length}}\n…\n${t} OK Fetch completed.`);
        for (const l of text.split("\n")) out.push({ text: l });
      } else {
        const crit = (qm?.[3] ?? "").trim() || "ALL";
        t = tag();
        cli(`${t} SEARCH ${crit}`);
        const hit = list.filter((s) => imapMatch(s, crit)).map((s) => s.uid);
        const line = `* SEARCH${hit.length ? ` ${hit.join(" ")}` : ""}`;
        srv(`${line}\n${t} OK Search completed (0.001 + 0.000 secs).`);
        if (qm?.[3] != null) out.push({ text: line });
        log.note(`${box} には ${list.length}通（${crit} に合うのは ${hit.length}通）`, list.length ? "ok" : "warn", "maildir:count");
      }
    }
    t = tag();
    cli(`${t} LOGOUT`);
    srv(`* BYE Logging out\n${t} OK Logout completed (0.001 + 0.000 secs).`);
    w.log(log, "dovecot", `dovecot: imap(${user})<${w.newPid()}>${sess}: Logged out in=120 out=${600 + Math.floor(w.rand() * 400)} deleted=0 expunged=0 trashed=0 hdr_count=0 hdr_bytes=0 body_count=0 body_bytes=0`);
    return done(0);
  }

  /* ---------- Postfix のコマンド ---------- */

  private postconf(args: string[], out: OutLine[], log: RunLog): number {
    const w = this.world;
    const text = w.files.get("/etc/postfix/main.cf") ?? "";
    const file = parseMainCf(text);
    const flags = new Set(args.filter((a) => /^-[a-zA-Z]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
    const names = args.filter((a) => !/^-[a-zA-Z]+$/.test(a));
    if (flags.has("e")) {
      if (!names.length) {
        out.push({ text: "postconf: fatal: -e は「名前 = 値」を書こう（例：postconf -e 'mydestination = $myhostname, $mydomain'）", err: true });
        return 1;
      }
      let next = text;
      for (const n of names) {
        const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/s.exec(n);
        if (!m) {
          out.push({ text: `postconf: fatal: missing '=' after attribute name: "${n}"`, err: true });
          return 1;
        }
        if (!(m[1]! in PF_DEFAULTS) && m[1] !== "mynetworks") out.push({ text: `postconf: warning: /etc/postfix/main.cf: unused parameter: ${m[1]}=${m[2]}`, err: true });
        next = editMainCf(next, m[1]!, m[2]!.trim());
      }
      w.files.set("/etc/postfix/main.cf", next);
      log.ops.push({ kind: "config", code: 0, note: "main.cf" });
      log.note("**main.cf を書きかえた**（postconf -e は何も出さない）。でも、動いている Postfix は **まだ前の設定** → **postfix reload** で読みこむ", "warn", "postfix:running");
      return 0;
    }
    if (flags.has("M")) {
      for (const l of (w.files.get("/etc/postfix/master.cf") ?? "").split("\n")) if (l.trim() && !l.startsWith("#") && !/^\s/.test(l)) out.push({ text: l.replace(/\s+/g, " ").replace(/^(\S+) (\S+)/, "$1/$2 $2") });
      return 0;
    }
    const defaults = flags.has("d");
    const expand = flags.has("x");
    const value = (n: string) => (defaults ? (pfRaw(new Map(), n) ?? null) : expand ? (pfRaw(file, n) != null ? pfGet(file, n) : null) : pfRaw(file, n));
    if (flags.has("n")) {
      for (const n of [...file.keys()].sort()) out.push({ text: `${n} = ${expand ? pfGet(file, n) : file.get(n)}` });
      return 0;
    }
    const list = names.length ? names : [...new Set([...Object.keys(PF_DEFAULTS), "mynetworks", ...file.keys()])].sort();
    let code = 0;
    for (const n of list) {
      const v = value(n);
      if (v == null) {
        out.push({ text: `postconf: warning: ${n}: unknown parameter`, err: true });
        code = 0;
        continue;
      }
      out.push({ text: `${n} = ${v}` });
    }
    if (names.length && !defaults) {
      const stale = w.pfStale().filter((n) => names.includes(n));
      if (stale.length) log.note(`いま見たのは **main.cf（書いたもの）**。動いている Postfix は ${stale.join("・")} をまだ前の値で使っている（postfix reload で読みこむ）`, "warn", "postfix:running");
    }
    return code;
  }

  private postfixCmd(args: string[], out: OutLine[], log: RunLog): number {
    const w = this.world;
    const sub = args[0] ?? "";
    switch (sub) {
      case "reload":
        if (!w.pf) {
          out.push({ text: "postfix/postfix-script: fatal: the Postfix mail system is not running", err: true });
          return 1;
        }
        w.pfLoad(log);
        out.push({ text: "postfix/postfix-script: refreshing the Postfix mail system" });
        w.log(log, "postfix", "postfix/postfix-script[3210]: refreshing the Postfix mail system");
        w.log(log, "postfix", "postfix/master[1450]: reload -- version 3.8.5, configuration /etc/postfix");
        log.ops.push({ kind: "service", code: 0, note: "postfix reload" });
        log.note("**postfix reload** → main.cf・master.cf を読みなおした。ここから新しい設定で動く", "ok", "postfix:running");
        return 0;
      case "start":
        if (w.pf) {
          out.push({ text: "postfix/postfix-script: fatal: the Postfix mail system is already running", err: true });
          return 1;
        }
        w.pfLoad(log);
        out.push({ text: "postfix/postfix-script: starting the Postfix mail system" });
        return 0;
      case "stop":
        if (!w.pf) {
          out.push({ text: "postfix/postfix-script: fatal: the Postfix mail system is not running", err: true });
          return 1;
        }
        w.pf = null;
        out.push({ text: "postfix/postfix-script: stopping the Postfix mail system" });
        return 0;
      case "status":
        out.push(w.pf ? { text: "postfix/postfix-script: the Postfix mail system is running: PID: 1450" } : { text: "postfix/postfix-script: the Postfix mail system is not running", err: true });
        return w.pf ? 0 : 1;
      case "check": {
        const conf = parseMainCf(w.files.get("/etc/postfix/main.cf") ?? "");
        const cert = pfGet(conf, "smtpd_tls_cert_file");
        if (cert && !w.files.has(cert)) out.push({ text: `postfix/postfix-script: warning: ${cert}: No such file or directory`, err: true });
        return 0;
      }
      case "flush":
        w.flush(log);
        return 0;
      default:
        out.push({ text: "postfix: fatal: usage: postfix [-c config_dir] [-Dv] command（reload・start・stop・status・check・flush）", err: true });
        return 1;
    }
  }

  private mailq(out: OutLine[], log?: RunLog): number {
    const w = this.world;
    if (w.queue.some((q) => q.status === "deferred"))
      log?.note("届けられなかったメールが **キューで待っている**（deferred）。やりなおしは決まった時間がたってから。**postqueue -f** で、いますぐやりなおせる", "warn", "queue");
    if (!w.queue.length) {
      out.push({ text: w.mta === "postfix" ? "Mail queue is empty" : "/var/spool/mqueue is empty" });
      if (w.mta === "sendmail") out.push({ text: "\t\tTotal requests: 0" });
      return 0;
    }
    if (w.mta === "postfix") {
      out.push({ text: "-Queue ID-  --Size-- ----Arrival Time---- -Sender/Recipient-------" });
      let kb = 0;
      for (const q of w.queue) {
        kb += Math.ceil(q.mail.size / 1024);
        const when = rfcDate(q.arrival).replace(/^(\w+), (\d+) (\w+) \d+ ([\d:]+).*$/, "$1 $3 $2 $4");
        out.push({ text: `${(q.qid + (q.status === "active" ? "*" : "")).padEnd(11)} ${String(q.mail.size).padStart(8)} ${when.padEnd(20)} ${q.mail.from || "MAILER-DAEMON"}` });
        if (q.reason) out.push({ text: `(${q.reason})`, mark: "ng" });
        for (const p of q.pending) out.push({ text: `${" ".repeat(41)}${p}` });
        out.push({ text: "" });
      }
      out.push({ text: `-- ${kb} Kbytes in ${w.queue.length} Request${w.queue.length > 1 ? "s" : ""}.` });
      return 0;
    }
    out.push({ text: `\t\t/var/spool/mqueue (${w.queue.length} request${w.queue.length > 1 ? "s" : ""})` });
    out.push({ text: "-----Q-ID----- --Size-- -----Q-Time----- ------------Sender/Recipient-----------" });
    for (const q of w.queue) {
      out.push({ text: `${q.qid} ${String(q.mail.size).padStart(8)} Thu Oct 15 10:0${Math.floor(w.rand() * 9)} <${q.mail.from}>` });
      if (q.reason) out.push({ text: `                 (${q.reason})`, mark: "ng" });
      for (const p of q.pending) out.push({ text: `\t\t\t\t\t <${p}>` });
    }
    out.push({ text: `\t\tTotal requests: ${w.queue.length}` });
    return 0;
  }

  private postsuper(args: string[], out: OutLine[]): number {
    const w = this.world;
    const at = args.indexOf("-d");
    const id = at >= 0 ? args[at + 1] : undefined;
    if (!id) {
      out.push({ text: "postsuper: fatal: usage: postsuper -d queue_id|ALL [deferred]", err: true });
      return 1;
    }
    const gone = w.queue.filter((q) => id === "ALL" || q.qid === id);
    w.queue = w.queue.filter((q) => !gone.includes(q));
    for (const q of gone) {
      out.push({ text: `postsuper: ${q.qid}: removed` });
      w.log(null, "postfix", `postfix/postsuper[${w.newPid()}]: ${q.qid}: removed`);
    }
    out.push({ text: `postsuper: Deleted: ${gone.length} message${gone.length === 1 ? "" : "s"}` });
    return 0;
  }

  private postcat(args: string[], out: OutLine[]): number {
    const at = args.indexOf("-q");
    const id = at >= 0 ? args[at + 1] : args.find((a) => !a.startsWith("-"));
    const q = this.world.queue.find((x) => x.qid === id);
    if (!q) {
      out.push({ text: `postcat: fatal: open queue file ${id ?? ""}: No such file or directory`, err: true });
      return 1;
    }
    out.push({ text: `*** ENVELOPE RECORDS ${q.status}/${q.qid} ***` });
    out.push({ text: `message_arrival_time: ${rfcDate(q.arrival)}` });
    out.push({ text: `sender: ${q.mail.from}` });
    for (const p of q.pending) out.push({ text: `recipient: ${p}` });
    out.push({ text: "*** MESSAGE CONTENTS ***" });
    for (const l of mailText(q.mail).split("\n")) out.push({ text: l });
    out.push({ text: "*** HEADER EXTRACTED ***" });
    out.push({ text: "*** MESSAGE FILE END ***" });
    return 0;
  }

  private newaliases(out: OutLine[], log: RunLog): number {
    const w = this.world;
    const text = w.files.get("/etc/aliases");
    if (text == null) {
      out.push({ text: "newaliases: fatal: open /etc/aliases: No such file or directory", err: true });
      return 1;
    }
    const { map, errors } = parseAliases(text);
    for (const e of errors) out.push({ text: `postalias: warning: ${e}`, err: true });
    const before = w.aliasDb;
    w.aliasDb = map;
    if (w.mta === "sendmail") {
      const longest = Math.max(0, ...[...map.values()].map((v) => v.join(",").length));
      out.push({ text: `/etc/aliases: ${map.size} aliases, longest ${longest} bytes, ${[...map.values()].reduce((n, v) => n + v.join(",").length + 2, 0)} bytes total` });
    }
    const added = [...map.keys()].filter((k) => !before?.has(k));
    log.ops.push({ kind: "config", code: 0, note: "aliases.db" });
    log.note(`**/etc/aliases.db** を作りなおした${added.length ? `（${added.join("・")} が増えた）` : ""}。.db は毎回読むので、reload はいらない${w.mta === "postfix" ? "（newaliases はうまくいくと何も出さない）" : ""}`, "ok", "aliases:db");
    return 0;
  }

  private postalias(args: string[], out: OutLine[], log: RunLog): number {
    const at = args.indexOf("-q");
    const w = this.world;
    if (at >= 0) {
      const key = (args[at + 1] ?? "").toLowerCase();
      const v = w.aliasDb?.get(key);
      if (v) out.push({ text: v.join(", ") });
      log.note(v ? `aliases.db に ${key} がある` : `aliases.db に **${key}** はない（/etc/aliases に書いても、newaliases するまで .db には入らない）`, v ? "ok" : "warn", "aliases:db");
      return v ? 0 : 1;
    }
    return this.newaliases(out, log);
  }

  /* ---------- Dovecot のコマンド ---------- */

  private doveconf(args: string[], out: OutLine[]): number {
    const w = this.world;
    const { conf } = parseDovecot(w.dovecotFiles());
    const names = args.filter((a) => !a.startsWith("-"));
    if (args.includes("-n") && !names.length) {
      out.push({ text: "# 2.3.21 (47349e2482): /etc/dovecot/dovecot.conf", mark: "dim" });
      out.push(...nested(conf).map((text) => ({ text })));
      return 0;
    }
    if (!names.length) {
      out.push({ text: "doveconf: 見たい設定の名前を書こう（例：doveconf disable_plaintext_auth mail_location）。-n で、書いた設定のぜんぶ", err: true });
      return 1;
    }
    let code = 0;
    for (const n of names) {
      if (!(n in DC_DEFAULTS) && !conf.has(n)) {
        out.push({ text: `doveconf: Fatal: Unknown setting: ${n}`, err: true });
        code = 1;
        continue;
      }
      out.push({ text: `${n} = ${conf.get(n) ?? DC_DEFAULTS[n] ?? ""}` });
    }
    return code;
  }

  private doveadm(args: string[], out: OutLine[], log: RunLog): number {
    const w = this.world;
    const [sub = "", sub2 = ""] = args;
    if (sub === "reload") return this.systemctl("systemctl", ["reload", "dovecot"], out, log);
    if (!w.dc) {
      out.push({ text: "doveadm(root): Error: Couldn't connect to dovecot: No such file or directory", err: true });
      return 75;
    }
    const uAt = args.indexOf("-u");
    const user = uAt >= 0 ? (args[uAt + 1] ?? "") : "";
    const needUser = () => {
      if (USERS.some((u) => u.name === user)) return true;
      out.push({ text: user ? `doveadm(${user}): Error: User doesn't exist` : "doveadm: -u ユーザー名 を書こう（例：doveadm mailbox list -u pochi）", err: true });
      return false;
    };
    if (sub === "auth" && sub2 === "test") {
      const [, , name = "", pw] = args;
      if (pw == null) {
        out.push({ text: "doveadm auth test: 名前とパスワードを書こう（例：doveadm auth test pochi 'パスワード'）", err: true });
        return 64;
      }
      const ok = w.checkPassword(name, pw);
      out.push(ok ? { text: `passdb: ${name} auth succeeded` } : { text: `passdb: ${name} auth failed`, err: true });
      out.push({ text: "extra fields:" });
      out.push({ text: `  user=${name}` });
      return ok ? 0 : 77;
    }
    if (sub === "mailbox" && sub2 === "list") {
      if (!needUser()) return 67;
      for (const f of w.folders(user).keys()) out.push({ text: f });
      return 0;
    }
    if (sub === "mailbox" && sub2 === "status") {
      if (!needUser()) return 67;
      const fields = args.slice(2).filter((a, k, all) => a !== "-u" && all[k - 1] !== "-u");
      const pattern = fields.pop() ?? "INBOX";
      const items = fields.length ? fields.join(" ").split(/\s+/) : ["messages"];
      const folders = w.folders(user);
      const names = pattern === "*" ? [...folders.keys()] : [pattern];
      for (const n of names) {
        const list = folders.get(n);
        if (!list) {
          out.push({ text: `doveadm(${user}): Error: Mailbox ${n}: Mailbox doesn't exist: ${n}`, err: true });
          return 68;
        }
        out.push({ text: `${n} ${items.map((k) => `${k}=${k === "unseen" || k === "messages" || k === "recent" ? list.length : k === "uidnext" ? (list.at(-1)?.uid ?? 0) + 1 : 0}`).join(" ")}` });
      }
      const loc = w.location(user);
      log.note(`Dovecot は **${loc.kind === "maildir" ? `${loc.path}/` : loc.path}** を ${user} のメールボックスとして見ている（mail_location ${loc.explain}）`, "info", "maildir");
      return 0;
    }
    if (sub === "fetch") {
      if (!needUser()) return 67;
      const field = args.find((a, k) => k > 0 && !a.startsWith("-") && args[k - 1] !== "-u") ?? "hdr.subject";
      const mbAt = args.indexOf("mailbox");
      const box = mbAt >= 0 ? (args[mbAt + 1] ?? "INBOX") : "INBOX";
      const list = w.folders(user).get(box);
      if (!list) {
        out.push({ text: `doveadm(${user}): Error: Mailbox ${box}: Mailbox doesn't exist: ${box}`, err: true });
        return 68;
      }
      for (const s of list) {
        const name = field.replace(/^hdr\./, "");
        out.push({ text: `${field}: ${field.startsWith("hdr.") ? headerOf(s.mail, name) : field === "uid" ? s.uid : ""}` });
      }
      return 0;
    }
    out.push({ text: "doveadm: この部屋で使えるのは reload ・ auth test ・ mailbox list ・ mailbox status ・ fetch です", err: true });
    return 64;
  }

  /* ---------- sendmail のコマンド ---------- */

  private m4(args: string[], out: OutLine[], log: RunLog): number {
    const f = args.find((a) => !a.startsWith("-"));
    if (!f) {
      out.push({ text: "m4: 読むファイルを書こう（例：m4 /etc/mail/sendmail.mc > /etc/mail/sendmail.cf）", err: true });
      return 1;
    }
    const t = this.read("mail", f);
    if (t == null) {
      out.push({ text: `m4: cannot open \`${f}': No such file or directory`, err: true });
      return 1;
    }
    if (!f.endsWith(".mc")) {
      for (const l of t.split("\n")) out.push({ text: l });
      return 0;
    }
    const r = m4Sendmail(t);
    if (r.error) {
      out.push({ text: r.error, err: true });
      return 1;
    }
    for (const l of r.cf.replace(/\n$/, "").split("\n")) out.push({ text: l });
    log.note("m4 が sendmail.mc（人が読む設定）から、sendmail.cf（sendmail が読む設定）を作った", "info", "sendmail:cf");
    return 0;
  }

  private makemap(args: string[], out: OutLine[], log: RunLog, stdin: string | null): number {
    const [type, map] = args.filter((a) => !a.startsWith("-"));
    if (!type || !map) {
      out.push({ text: "Usage: makemap [-N] [-c cachesize] [-D commentchar] ... type mapname（例：makemap hash /etc/mail/access < /etc/mail/access）", err: true });
      return 64;
    }
    if (stdin == null) {
      out.push({ text: "makemap: 中身を < でわたそう（例：makemap hash /etc/mail/access < /etc/mail/access）", err: true });
      return 66;
    }
    if (type !== "hash") {
      out.push({ text: `makemap: Unknown database type ${type}`, err: true });
      return 64;
    }
    const p = this.abs("mail", map);
    if (p !== "/etc/mail/access") {
      out.push({ text: `makemap: この部屋で使うのは /etc/mail/access だけです`, err: true });
      return 1;
    }
    this.world.accessDb = parseAccess(stdin);
    log.ops.push({ kind: "config", code: 0, note: "access.db" });
    log.note("**/etc/mail/access.db** を作りなおした。sendmail は .db を毎回見るので、再起動しなくても、つぎのメールから効く", "ok", "sendmail:db");
    return 0;
  }

  /* ---------- サービス ---------- */

  private systemctl(cmd: string, args: string[], out: OutLine[], log: RunLog): number {
    const w = this.world;
    const [a, b] = cmd === "service" ? [args[1], args[0]] : [args[0], args[1]];
    const action = a ?? "";
    const unit = (b ?? "").replace(/\.service$/, "");
    const known = w.mta === "postfix" ? ["postfix", "dovecot"] : ["sendmail", "dovecot"];
    if (!["reload", "restart", "start", "stop", "status", "is-active"].includes(action) || !unit) {
      out.push({ text: "systemctl: この部屋では reload・restart・start・stop・status を使います（例：systemctl reload dovecot）", err: true });
      return 1;
    }
    if (!known.includes(unit)) {
      out.push({ text: `Unit ${unit}.service could not be found.`, err: true });
      if (unit === "postfix" || unit === "sendmail") log.note(`このメールサーバーは ${w.mta} で動いている`, "warn");
      return 5;
    }
    const running = unit === "postfix" ? Boolean(w.pf) : unit === "dovecot" ? Boolean(w.dc) : Boolean(w.sm);
    if (action === "status" || action === "is-active") {
      if (action === "is-active") {
        out.push({ text: running ? "active" : "inactive" });
        return running ? 0 : 3;
      }
      const desc = unit === "postfix" ? "Postfix Mail Transport Agent" : unit === "dovecot" ? "Dovecot IMAP/POP3 email server" : "Sendmail Mail Transport Agent";
      out.push({ text: `● ${unit}.service - ${desc}` });
      out.push({ text: `     Loaded: loaded (/usr/lib/systemd/system/${unit}.service; enabled; preset: disabled)` });
      out.push(running ? { text: "     Active: active (running) since Thu 2026-10-15 09:58:02 JST", mark: "ok" } : { text: "     Active: inactive (dead)", mark: "ng" });
      if (unit === "dovecot" && running) {
        const stale = w.dcStale();
        if (stale.length) log.note(`Dovecot は、まだ前の設定で動いている（${stale.slice(0, 3).join("・")} がちがう）→ systemctl reload dovecot`, "warn", "dovecot:running");
      }
      return running ? 0 : 3;
    }
    if (action === "stop") {
      if (unit === "postfix") w.pf = null;
      else if (unit === "dovecot") w.dc = null;
      else w.sm = null;
      return 0;
    }
    if (action === "reload" && !running) {
      out.push({ text: `Job for ${unit}.service invalid.`, err: true });
      return 1;
    }
    if (unit === "postfix") {
      w.pfLoad(log);
      w.log(log, "postfix", `postfix/master[1450]: ${action === "reload" ? "reload" : "daemon started"} -- version 3.8.5, configuration /etc/postfix`);
      log.note(`${action === "reload" ? "reload" : "restart"} → Postfix が main.cf を読みなおした`, "ok", "postfix:running");
    } else if (unit === "dovecot") {
      const errors = w.dcLoad(log);
      if (errors.length) {
        out.push({ text: `Job for dovecot.service failed because the control process exited with error code.`, err: true });
        for (const e of errors) out.push({ text: `doveconf: Fatal: Error in configuration file ${e}`, err: true });
        log.note("Dovecot の設定にまちがいがあるので、読みこめなかった（前の設定のまま）", "ng", "dovecot:running");
        return 1;
      }
      w.log(log, "dovecot", `dovecot: master: ${action === "reload" ? "Warning: SIGHUP received - reloading configuration" : "Dovecot v2.3.21 (47349e2482) starting up for imap, pop3, lmtp"}`);
      log.note(`${action} → Dovecot が設定（/etc/dovecot/）を読みなおした`, "ok", "dovecot:running");
    } else {
      if (action === "reload") {
        out.push({ text: "Failed to reload sendmail.service: Job type reload is not applicable for unit sendmail.service.", err: true });
        return 1;
      }
      w.smLoad();
      w.log(log, "sendmail", `sendmail[${w.newPid()}]: starting daemon (8.16.1): SMTP+queueing@01:00:00`);
      log.note(`sendmail を起動しなおした → **sendmail.cf** を読みこんだ（待ち受け：${w.sm!.listen}:25）`, w.sm!.listen === "0.0.0.0" ? "ok" : "info", "sendmail:daemon");
      if (w.smMcStale()) log.note("sendmail が読むのは **sendmail.cf**。sendmail.mc を書きかえても、m4 で sendmail.cf を作りなおすまでは前のまま", "warn", "sendmail:cf");
    }
    log.ops.push({ kind: "service", code: 0, note: `${unit} ${action}` });
    return 0;
  }

  private ss(out: OutLine[]): number {
    const w = this.world;
    out.push({ text: "State   Recv-Q  Send-Q    Local Address:Port    Peer Address:Port" });
    const rows: string[] = [];
    if (w.pf) {
      const loop = pfGet(w.pf.conf, "inet_interfaces") === "loopback-only";
      for (const s of w.pf.services) rows.push(`${loop ? "127.0.0.1" : "0.0.0.0"}:${s.port}`);
    }
    if (w.sm) rows.push(`${w.sm.listen}:25`);
    if (w.dc) {
      const protos = dcGet(w.dc, "protocols").split(/\s+/);
      const ssl = dcGet(w.dc, "ssl") !== "no";
      if (protos.includes("imap")) rows.push("0.0.0.0:143", ...(ssl ? ["0.0.0.0:993"] : []));
      if (protos.includes("pop3")) rows.push("0.0.0.0:110", ...(ssl ? ["0.0.0.0:995"] : []));
    }
    rows.push("0.0.0.0:22");
    for (const r of rows.sort((a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1]))) out.push({ text: `LISTEN  0       100       ${r.padEnd(21)} 0.0.0.0:*` });
    return 0;
  }
}

/* ------------------------------------------------------------ 小物 */

/** IMAP の SEARCH の条件（ALL・SUBJECT ことば・FROM ことば・UNSEEN） */
function imapMatch(s: Stored, crit: string): boolean {
  const m = /^(SUBJECT|FROM|TO|BODY|TEXT)\s+"?(.*?)"?$/i.exec(crit.trim());
  if (!m) return true;
  const key = m[2]!.toLowerCase();
  const field = m[1]!.toUpperCase();
  if (field === "BODY" || field === "TEXT") return s.mail.body.toLowerCase().includes(key);
  return headerOf(s.mail, field === "SUBJECT" ? "Subject" : field === "FROM" ? "From" : "To").toLowerCase().includes(key);
}

/** 届いたメールの文字（Return-Path・Delivered-To・Received を上につける） */
export function storedText(s: Stored): string {
  const extra = [`Return-Path: <${s.mail.from}>`, ...(s.orig ? [`X-Original-To: ${s.orig}`] : []), `Delivered-To: ${s.to}`, ...s.received.map((r) => `Received: ${r}`)];
  return mailText(s.mail, extra);
}

/** mbox の1通（From の行から始まる） */
function mboxEntry(s: Stored): string {
  const d = new Date(s.mail.at + 9 * 3600e3);
  const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const when = `${DOWS[d.getUTCDay()]} ${MONS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, " ")} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()}`;
  return `From ${s.mail.from || "MAILER-DAEMON"}  ${when}\n${storedText(s)}\n`;
}

/** Dovecot の設定（平らな名前）を、doveconf -n の入れ子の形にもどす */
function nested(conf: Map<string, string>): string[] {
  type Node = { vals: [string, string][]; kids: Map<string, Node> };
  const root: Node = { vals: [], kids: new Map() };
  for (const [k, v] of conf) {
    const parts = k.split("/");
    let n = root;
    for (const p of parts.slice(0, -1)) {
      if (!n.kids.has(p)) n.kids.set(p, { vals: [], kids: new Map() });
      n = n.kids.get(p)!;
    }
    n.vals.push([parts[parts.length - 1]!, v]);
  }
  const out: string[] = [];
  const walk = (n: Node, depth: number) => {
    const pad = "  ".repeat(depth);
    for (const [k, v] of n.vals) out.push(`${pad}${k} = ${v}`);
    for (const [name, kid] of n.kids) {
      out.push(`${pad}${name} {`);
      walk(kid, depth + 1);
      out.push(`${pad}}`);
    }
  };
  walk(root, 0);
  return out;
}

function helpLines(host: HostId, mta: "postfix" | "sendmail"): string[] {
  const common = ["cat ファイル ・ ls ・ tail -n 5 ファイル ・ grep ことば ファイル ・ echo ・ dig MX wanko.shop ・ clear"];
  if (host !== "mail")
    return [
      "# メールを送る（SMTP のやりとりが全部見える）",
      "swaks --to hana@wanko.shop --from pochi@wanko.shop --server mail.wanko.shop",
      "   --auth --auth-user 名前 --auth-password 'パスワード'（ログインして送る）・--tls（STARTTLS で暗号に）",
      "   --header 'Subject: 件名' --body '本文' ・ --port 587",
      "# メールを読む（IMAP・POP3）",
      "curl -u '名前:パスワード' imaps://mail.wanko.shop/          … フォルダーの一覧",
      "curl -u '名前:パスワード' 'imaps://mail.wanko.shop/INBOX?ALL'  … INBOX の何通目があるか",
      "curl -u '名前:パスワード' 'imaps://mail.wanko.shop/INBOX;UID=1' … 1通目を読む",
      "   -v（やりとりを見る）・imap://（暗号なし）・--ssl-reqd（STARTTLS）・pop3s://",
      "# そのほか",
      ...common,
    ];
  return [
    ...(mta === "postfix"
      ? [
          "# Postfix",
          "postconf 名前 ・ postconf -n（書いた設定）・ postconf -d 名前（初めの値）・ postconf -x 名前（$ をひらく）",
          "postconf -e '名前 = 値'（main.cf を書きかえ）→ postfix reload（読みこむ）",
          "mailq（キュー）・ postqueue -f（もう一度配る）・ postsuper -d ID ・ postcat -q ID",
          "newaliases（/etc/aliases → aliases.db）・ postalias -q 名前 /etc/aliases",
        ]
      : ["# sendmail", "m4 /etc/mail/sendmail.mc > /etc/mail/sendmail.cf → systemctl restart sendmail", "makemap hash /etc/mail/access < /etc/mail/access ・ newaliases ・ mailq"]),
    "# Dovecot",
    "doveconf 名前 ・ doveconf -n ・ systemctl reload dovecot",
    "doveadm mailbox status -u 名前 messages '*' ・ doveadm mailbox list -u 名前 ・ doveadm auth test 名前 'パスワード'",
    "# そのほか",
    "systemctl status|reload|restart サービス ・ ss -tln（待ち受けているポート）",
    "sed -i 's/さがす/おきかえ/' ファイル ・ echo '行' >> ファイル ・ tail -n 5 /var/log/maillog",
    "swaks ・ curl（メールサーバーの中から localhost にもつなげる）",
    ...common,
  ];
}

/** ほかのファイルで使う小物 */
export const knownSocket = (w: MailWorld, which: "auth" | "lmtp") => Boolean(w.dc && dcHas(w.dc, which === "auth" ? AUTH_SOCKET : LMTP_SOCKET));
export const wireOf = (o: OpRecord): WireMode => o.mode ?? "plain";
export { ptrName };
