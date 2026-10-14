/**
 * 勉強部屋（LDAP）の名簿サーバー：本物の OpenLDAP（slapd 2.6）と同じ決まりで動く、小さなシミュレーター。
 *
 * - 名簿（DIT）… エントリ・DN・属性。スキーマ（core・inetorgperson・nis…）で、書ける属性と組み合わせを確かめる
 * - さがす（search）… ベース・スコープ・フィルタ（RFC 4515）。インデックス（olcDbIndex）がなければ、全部を1件ずつ見る
 * - ログイン（bind）… 匿名・DN とパスワード（{SSHA}）・管理者（olcRootDN／olcRootPW）
 * - アクセス制御（olcAccess）… 上から順に見て、最初に当たった to の行の、最初に当たった by で決まる。1行もなければ「だれでも読める」
 * - 設定（cn=config）… ldapmodify -Y EXTERNAL で書きかえると、すぐに効く（applyConfig）
 * - overlay … memberof（memberOf を書く）・refint（消した人をグループからも消す）・unique（値のかぶりを止める）・ppolicy（ロック）
 * どの操作も、slapd のログ（stats）・「サーバーの中で起きたこと」（trace）・ネットワークを流れたバイト（packets）を RunLog に残す。
 * React にも DOM にも依存しない（scripts/fuzz-infra.mjs で、node で確かめる）。くわしくは docs/infra-app.md の「勉強部屋」。
 */
import {
  berBindRequest,
  berExtRequest,
  berExtResponse,
  berResult,
  berSearchEntry,
  berSearchRequest,
  berUnbind,
  checkPassword,
  randomBytes,
  seeded,
  ssha,
  tlsRecord,
  type BerFilter,
} from "./ldap-bits";

/* ------------------------------------------------------------ 結果コード */

export const RESULT_TEXT: Record<number, string> = {
  0: "Success",
  1: "Operations error",
  2: "Protocol error",
  4: "Size limit exceeded",
  8: "Strong(er) authentication required",
  13: "Confidentiality required",
  16: "No such attribute",
  17: "Undefined attribute type",
  19: "Constraint violation",
  20: "Type or value exists",
  21: "Invalid syntax",
  32: "No such object",
  34: "Invalid DN syntax",
  48: "Inappropriate authentication",
  49: "Invalid credentials",
  50: "Insufficient access",
  52: "Server is unavailable",
  53: "Server is unwilling to perform",
  64: "Naming violation",
  65: "Object class violation",
  66: "Operation not allowed on non-leaf",
  68: "Already exists",
  80: "Other (e.g., implementation specific) error",
  [-1]: "Can't contact LDAP server",
  [-6]: "Unknown authentication method",
  [-7]: "Bad search filter",
  [-11]: "Connect error",
};

/** 結果コードの意味（ひとことで） */
export const RESULT_JA: Record<number, string> = {
  0: "成功",
  1: "サーバーの中のエラー",
  2: "お願いの形がおかしい",
  4: "数が多すぎて、途中で止めた",
  13: "暗号にしないと話せない",
  16: "その値はない",
  17: "知らない属性",
  19: "決まりに合わない",
  20: "その値はもうある",
  21: "知らない値・書き方がおかしい",
  32: "見つからない",
  34: "DN の書き方がおかしい",
  48: "そのログインのしかたは使えない",
  49: "ログインできない",
  50: "権限がない",
  52: "用意されていない",
  53: "断られた",
  64: "名前のつけ方がおかしい",
  65: "オブジェクトクラスの決まりに合わない",
  66: "下にエントリがあるので消せない",
  68: "もうある",
  80: "設定のまちがい など",
  [-1]: "サーバーにつながらない",
  [-6]: "そのログイン方法は使えない",
  [-7]: "フィルタの書き方がおかしい",
  [-11]: "つなぐときのエラー（証明書 など）",
};

export const resultText = (code: number) => RESULT_TEXT[code] ?? "Unknown error";

/* ------------------------------------------------------------ 権限 */

export type Level = "none" | "disclose" | "auth" | "compare" | "search" | "read" | "write" | "manage";
const LEVELS: readonly Level[] = ["none", "disclose", "auth", "compare", "search", "read", "write", "manage"];
const rank = (l: Level) => LEVELS.indexOf(l);

/* ------------------------------------------------------------ スキーマ */

export type SchemaId = "system" | "core" | "cosine" | "inetorgperson" | "nis" | "ppolicy" | "memberof";
/** ci … 大文字小文字を区別しない文字、ce … 区別する文字、tel … 電話番号（- と空白を無視）、oc … オブジェクトクラスの名前、attr … 属性の名前 */
type Syntax = "ci" | "ce" | "tel" | "int" | "dn" | "bool" | "oc" | "pw" | "time" | "attr";

export type AttrDef = {
  name: string;
  key: string;
  alias: string[];
  syn: Syntax;
  schema: SchemaId;
  single?: boolean;
  /** 操作属性（* では返さない。+ か、名前を書いて頼んだときだけ） */
  op?: boolean;
  /** 利用者は書きかえられない（サーバーや overlay が書く） */
  noMod?: boolean;
  /** 英数字だけ（IA5String） */
  ia5?: boolean;
  ja: string;
};

const A = (name: string, syn: Syntax, schema: SchemaId, ja: string, extra: Partial<AttrDef> = {}): AttrDef => ({ name, key: name.toLowerCase(), alias: [], syn, schema, ja, ...extra });

const ATTRS: AttrDef[] = [
  A("objectClass", "oc", "system", "どんな種類のエントリか"),
  A("structuralObjectClass", "oc", "system", "いちばん大もとの種類", { op: true, noMod: true, single: true }),
  A("entryUUID", "ce", "system", "エントリの背番号", { op: true, noMod: true, single: true }),
  A("creatorsName", "dn", "system", "作った人", { op: true, noMod: true, single: true }),
  A("createTimestamp", "time", "system", "作った時刻", { op: true, noMod: true, single: true }),
  A("modifiersName", "dn", "system", "変えた人", { op: true, noMod: true, single: true }),
  A("modifyTimestamp", "time", "system", "変えた時刻", { op: true, noMod: true, single: true }),
  A("entryDN", "dn", "system", "このエントリの DN", { op: true, noMod: true, single: true }),
  A("subschemaSubentry", "dn", "system", "スキーマの置き場所", { op: true, noMod: true, single: true }),
  A("hasSubordinates", "bool", "system", "下にエントリがあるか", { op: true, noMod: true, single: true }),
  A("namingContexts", "ce", "system", "このサーバーがあずかる木のてっぺん", { op: true, noMod: true }),
  A("cn", "ci", "core", "名前", { alias: ["commonName"] }),
  A("sn", "ci", "core", "名字", { alias: ["surname"] }),
  A("givenName", "ci", "core", "下の名前", { alias: ["gn"] }),
  A("o", "ci", "core", "組織の名前", { alias: ["organizationName"] }),
  A("ou", "ci", "core", "たな（部署）の名前", { alias: ["organizationalUnitName"] }),
  A("dc", "ci", "core", "ドメインの部品", { alias: ["domainComponent"], ia5: true, single: true }),
  A("description", "ci", "core", "説明"),
  A("telephoneNumber", "tel", "core", "電話番号"),
  A("title", "ci", "core", "役職"),
  A("userPassword", "pw", "core", "パスワード（ハッシュ）"),
  A("member", "dn", "core", "グループのメンバー（DN）"),
  A("owner", "dn", "core", "持ち主（DN）"),
  A("seeAlso", "dn", "core", "関係するエントリ（DN）"),
  A("uid", "ci", "core", "ログイン名", { alias: ["userid"] }),
  A("mail", "ci", "core", "メールアドレス", { alias: ["rfc822Mailbox"], ia5: true }),
  A("displayName", "ci", "inetorgperson", "表示名", { single: true }),
  A("employeeType", "ci", "inetorgperson", "働き方"),
  A("employeeNumber", "ci", "inetorgperson", "社員番号", { single: true }),
  A("uidNumber", "int", "nis", "Linux のユーザー番号", { single: true }),
  A("gidNumber", "int", "nis", "Linux のグループ番号", { single: true }),
  A("homeDirectory", "ce", "nis", "ホームディレクトリ", { single: true, ia5: true }),
  A("loginShell", "ce", "nis", "ログインしたときに動くシェル", { single: true, ia5: true }),
  A("gecos", "ce", "nis", "ユーザーの説明（英数字だけ）", { single: true, ia5: true }),
  A("memberUid", "ce", "nis", "グループのメンバー（ログイン名）", { ia5: true }),
  A("pwdAttribute", "attr", "ppolicy", "ルールを使う属性", { single: true }),
  A("pwdMaxFailure", "int", "ppolicy", "まちがえてよい回数", { single: true }),
  A("pwdLockout", "bool", "ppolicy", "まちがえすぎたらロックするか", { single: true }),
  A("pwdLockoutDuration", "int", "ppolicy", "ロックしておく秒数（0 はずっと）", { single: true }),
  A("pwdFailureCountInterval", "int", "ppolicy", "まちがいを数えておく秒数", { single: true }),
  A("pwdMinLength", "int", "ppolicy", "パスワードの最低の長さ", { single: true }),
  A("pwdFailureTime", "time", "ppolicy", "パスワードをまちがえた時刻", { op: true }),
  A("pwdAccountLockedTime", "time", "ppolicy", "ロックした時刻", { op: true, single: true }),
  A("pwdChangedTime", "time", "ppolicy", "パスワードを変えた時刻", { op: true, single: true, noMod: true }),
  A("memberOf", "dn", "memberof", "入っているグループ（overlay が書く）", { op: true, noMod: true }),
];

export type ClassDef = { name: string; key: string; kind: "abstract" | "structural" | "auxiliary"; sup: string | null; must: string[]; may: string[]; schema: SchemaId };

const C = (name: string, kind: ClassDef["kind"], sup: string | null, must: string[], may: string[], schema: SchemaId): ClassDef => ({
  name,
  key: name.toLowerCase(),
  kind,
  sup,
  must: must.map((m) => m.toLowerCase()),
  may: may.map((m) => m.toLowerCase()),
  schema,
});

const CLASSES: ClassDef[] = [
  C("top", "abstract", null, ["objectClass"], [], "system"),
  C("dcObject", "auxiliary", null, ["dc"], [], "core"),
  C("organization", "structural", null, ["o"], ["description", "telephoneNumber", "userPassword", "seeAlso"], "core"),
  C("organizationalUnit", "structural", null, ["ou"], ["description", "telephoneNumber", "userPassword", "seeAlso"], "core"),
  C("person", "structural", null, ["sn", "cn"], ["userPassword", "telephoneNumber", "seeAlso", "description"], "core"),
  C("organizationalPerson", "structural", "person", [], ["title", "ou", "telephoneNumber"], "core"),
  C("organizationalRole", "structural", null, ["cn"], ["description", "telephoneNumber", "ou", "seeAlso"], "core"),
  C("groupOfNames", "structural", null, ["member", "cn"], ["description", "owner", "ou", "o", "seeAlso"], "core"),
  C("simpleSecurityObject", "auxiliary", null, ["userPassword"], [], "core"),
  C("device", "structural", null, ["cn"], ["description", "owner", "ou", "o", "seeAlso"], "core"),
  C("inetOrgPerson", "structural", "organizationalPerson", [], ["uid", "mail", "displayName", "givenName", "employeeType", "employeeNumber"], "inetorgperson"),
  C("posixAccount", "auxiliary", null, ["cn", "uid", "uidNumber", "gidNumber", "homeDirectory"], ["userPassword", "loginShell", "gecos", "description"], "nis"),
  C("posixGroup", "structural", null, ["cn", "gidNumber"], ["userPassword", "memberUid", "description"], "nis"),
  C("pwdPolicy", "auxiliary", null, ["pwdAttribute"], ["pwdMaxFailure", "pwdLockout", "pwdLockoutDuration", "pwdFailureCountInterval", "pwdMinLength"], "ppolicy"),
];

const ATTR_BY = new Map<string, AttrDef>();
for (const a of ATTRS) {
  ATTR_BY.set(a.key, a);
  for (const x of a.alias) ATTR_BY.set(x.toLowerCase(), a);
}
const CLASS_BY = new Map(CLASSES.map((c) => [c.key, c]));

/** OpenLDAP 2.6 に最初から入っているスキーマ（nis は読みこむ）。ppolicy・memberof の属性は、そのモジュールを読みこむと使える */
function schemaOn(cfg: ServerConfig, s: SchemaId): boolean {
  if (s === "system") return true;
  if (s === "ppolicy" || s === "memberof") return cfg.modules.has(s);
  return cfg.schemas.has(s);
}

export function attrDef(cfg: ServerConfig, name: string): AttrDef | null {
  const d = ATTR_BY.get(name.trim().toLowerCase());
  return d && schemaOn(cfg, d.schema) ? d : null;
}

export function classDef(cfg: ServerConfig, name: string): ClassDef | null {
  const d = CLASS_BY.get(name.trim().toLowerCase());
  return d && schemaOn(cfg, d.schema) ? d : null;
}

/** どのスキーマにある属性か（読みこんでいなくても調べる。説明のため） */
export const attrSchema = (name: string) => ATTR_BY.get(name.toLowerCase())?.schema ?? null;
export const classSchema = (name: string) => CLASS_BY.get(name.toLowerCase())?.schema ?? null;
export const attrJa = (name: string) => ATTR_BY.get(name.toLowerCase())?.ja ?? "";
/** 正式な名前（知らなければ、そのまま） */
export const attrName = (name: string) => ATTR_BY.get(name.toLowerCase())?.name ?? name;

/** そのオブジェクトクラスと、上の（sup）クラスたち */
function classChain(cfg: ServerConfig, c: ClassDef): ClassDef[] {
  const out: ClassDef[] = [];
  let cur: ClassDef | null = c;
  while (cur && !out.includes(cur)) {
    out.push(cur);
    cur = cur.sup ? classDef(cfg, cur.sup) : null;
  }
  return out;
}

/** 値を比べるための形にする（書き方がおかしければ null＝invalid per syntax） */
function normValue(cfg: ServerConfig, def: AttrDef, raw: string): string | null {
  if (def.ia5 && /[^\x00-\x7f]/.test(raw)) return null;
  switch (def.syn) {
    case "ci": {
      const v = raw.trim().replace(/\s+/g, " ").toLowerCase();
      return v || null;
    }
    case "tel": {
      const v = raw.replace(/[\s-]/g, "").toLowerCase();
      return v || null;
    }
    case "ce": {
      const v = raw.trim().replace(/\s+/g, " ");
      return v || null;
    }
    case "pw":
      return raw || null;
    case "int": {
      const t = raw.trim();
      return /^-?\d{1,18}$/.test(t) ? String(BigInt(t)) : null;
    }
    case "bool":
      return raw === "TRUE" || raw === "FALSE" ? raw : null;
    case "dn": {
      const n = normDn(cfg, raw);
      return n ? n : null;
    }
    case "oc":
      return classDef(cfg, raw)?.key ?? null;
    case "attr":
      return attrDef(cfg, raw)?.key ?? null;
    case "time":
      return /^\d{14}(\.\d{1,6})?Z$/.test(raw) ? raw : null;
  }
}

/* ------------------------------------------------------------ DN */

export type Ava = { type: string; value: string };

/** DN を RDN（その中の AVA）に分ける。書き方がおかしければ null。"" は木のいちばん上（ルート） */
export function parseDn(dn: string): Ava[][] | null {
  const chars = Array.from(dn.trim());
  if (!chars.length) return [];
  const rdns: Ava[][] = [];
  let avas: Ava[] = [];
  let type = "";
  let bytes: number[] = [];
  let trailing = 0;
  let inValue = false;
  const enc = new TextEncoder();
  const endAva = (): boolean => {
    const t = type.trim();
    if (!/^([A-Za-z][A-Za-z0-9-]*|\d+(\.\d+)+)$/.test(t)) return false;
    const value = new TextDecoder().decode(Uint8Array.from(bytes.slice(0, bytes.length - trailing)));
    if (!value) return false;
    avas.push({ type: t, value });
    type = "";
    bytes = [];
    trailing = 0;
    inValue = false;
    return true;
  };
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (!inValue) {
      if (c === "=") {
        inValue = true;
        while (chars[i + 1] === " ") i++;
      } else if (c === "," || c === "+" || c === "\\" || c === '"') return null;
      else type += c;
      continue;
    }
    if (c === "\\") {
      const h = (chars[i + 1] ?? "") + (chars[i + 2] ?? "");
      if (/^[0-9a-fA-F]{2}$/.test(h)) {
        bytes.push(parseInt(h, 16));
        i += 2;
      } else if (i + 1 < chars.length) {
        bytes.push(...enc.encode(chars[i + 1]!));
        i += 1;
      } else return null;
      trailing = 0;
      continue;
    }
    if (c === "," || c === "+") {
      if (!endAva()) return null;
      if (c === ",") {
        rdns.push(avas);
        avas = [];
      }
      while (chars[i + 1] === " ") i++;
      continue;
    }
    if (c === '"' || c === "=") return null;
    bytes.push(...enc.encode(c));
    trailing = c === " " ? trailing + 1 : 0;
  }
  if (!inValue || !endAva()) return null;
  rdns.push(avas);
  return rdns;
}

const escNorm = (v: string) =>
  v.replace(/[\\,+"<>;=]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, "0")}`).replace(/^[ #]/, (c) => `\\${c.charCodeAt(0).toString(16)}`).replace(/ $/, "\\20");
const escPretty = (v: string) => v.replace(/[\\,+"<>;=]/g, (c) => `\\${c}`).replace(/^[ #]/, (c) => `\\${c}`).replace(/ $/, "\\ ");

/** 比べるための DN（属性の名前は小文字・値も大文字小文字を区別しないものは小文字）。おかしければ null */
export function normDn(cfg: ServerConfig, dn: string): string | null {
  const rdns = parseDn(dn);
  if (!rdns) return null;
  const out: string[] = [];
  for (const rdn of rdns) {
    const parts: string[] = [];
    for (const ava of rdn) {
      const def = attrDef(cfg, ava.type);
      if (!def || def.syn === "dn") return null;
      const v = normValue(cfg, def, ava.value);
      if (v == null) return null;
      parts.push(`${def.key}=${escNorm(v)}`);
    }
    out.push(parts.join("+"));
  }
  return out.join(",");
}

/** 見せるための DN（空白を取って、そろえる）。おかしければ null */
export function prettyDn(dn: string): string | null {
  const rdns = parseDn(dn);
  if (!rdns) return null;
  return rdns.map((r) => r.map((a) => `${a.type}=${escPretty(a.value)}`).join("+")).join(",");
}

/** DN の、いちばん左の RDN（uid=pochi など） */
export const rdnOf = (dn: string) => {
  const rdns = parseDn(dn);
  return rdns?.[0] ? rdns[0].map((a) => `${a.type}=${a.value}`).join("+") : dn;
};

/** ldapsearch のコメントに出す、人が読む形（uid=pochi,ou=people,dc=wanko,dc=shop → pochi, people, wanko.shop） */
export function ufn(dn: string): string {
  const rdns = parseDn(dn);
  if (!rdns?.length) return dn;
  let cut = rdns.length;
  while (cut > 0 && rdns[cut - 1]!.length === 1 && rdns[cut - 1]![0]!.type.toLowerCase() === "dc") cut--;
  const head = rdns.slice(0, cut).map((r) => r.map((a) => a.value).join(" + "));
  const dc = rdns.slice(cut).map((r) => r[0]!.value);
  return [...head, ...(dc.length ? [dc.join(".")] : [])].join(", ");
}

export type Scope = "base" | "one" | "sub" | "children";
export const SCOPE_NO: Record<Scope, number> = { base: 0, one: 1, sub: 2, children: 3 };
export const SCOPE_NAME: Record<Scope, string> = { base: "baseObject", one: "oneLevel", sub: "subtree", children: "children" };

/** ndn が、base から見て scope の中にあるか（どちらも比べるための DN） */
export function inScope(ndn: string, base: string, scope: Scope): boolean {
  if (scope === "base") return ndn === base;
  if (base === "") return scope === "one" ? !ndn.includes(",") : true;
  if (ndn === base) return scope === "sub";
  if (!ndn.endsWith(`,${base}`)) return false;
  return scope === "one" ? !ndn.slice(0, -base.length - 1).includes(",") : true;
}

const parentOf = (ndn: string) => {
  const i = ndn.indexOf(",");
  return i < 0 ? null : ndn.slice(i + 1);
};

/* ------------------------------------------------------------ フィルタ（RFC 4515） */

export type Filter = BerFilter;

/** フィルタを読む。おかしければ null（ldapsearch の Bad search filter） */
export function parseFilter(text: string): Filter | null {
  let s = text.trim();
  if (!s) return null;
  if (!s.startsWith("(")) s = `(${s})`;
  let i = 0;
  const value = (raw: string): string | null => {
    const bytes: number[] = [];
    const enc = new TextEncoder();
    const chars = Array.from(raw);
    for (let k = 0; k < chars.length; k++) {
      const c = chars[k]!;
      if (c === "\\") {
        const h = (chars[k + 1] ?? "") + (chars[k + 2] ?? "");
        if (!/^[0-9a-fA-F]{2}$/.test(h)) return null;
        bytes.push(parseInt(h, 16));
        k += 2;
      } else if (c === "(" || c === ")" || c === "*") return null;
      else bytes.push(...enc.encode(c));
    }
    return new TextDecoder().decode(Uint8Array.from(bytes));
  };
  const item = (): Filter | null => {
    const start = i;
    while (i < s.length && !"=~<>():".includes(s[i]!)) i++;
    const attr = s.slice(start, i).trim();
    if (!/^([A-Za-z][A-Za-z0-9-]*(;[A-Za-z0-9-]+)*|\d+(\.\d+)+)$/.test(attr)) return null;
    let op = "=";
    if (s[i] === "~" || s[i] === "<" || s[i] === ">") {
      op = s[i] + "=";
      if (s[i + 1] !== "=") return null;
      i += 2;
    } else if (s[i] === "=") i++;
    else return null;
    const vs = i;
    while (i < s.length && s[i] !== ")") i += s[i] === "\\" ? 1 : 1;
    const raw = s.slice(vs, i);
    if (op !== "=") {
      const v = value(raw);
      return v == null ? null : { t: op === "~=" ? "approx" : op === ">=" ? "ge" : "le", attr, value: v };
    }
    if (raw === "*") return { t: "present", attr };
    if (!raw.includes("*")) {
      const v = value(raw);
      return v == null ? null : { t: "eq", attr, value: v };
    }
    const parts = raw.split("*");
    const decoded = parts.map((p) => (p === "" ? "" : value(p)));
    if (decoded.some((d) => d == null)) return null;
    const list = decoded as string[];
    const initial = list[0] || undefined;
    const final = list[list.length - 1] || undefined;
    const any = list.slice(1, -1);
    if (any.some((a) => a === "")) return null;
    return { t: "sub", attr, initial, any, final };
  };
  const parse = (): Filter | null => {
    if (s[i] !== "(") return null;
    i++;
    const c = s[i];
    let f: Filter | null;
    if (c === "&" || c === "|") {
      i++;
      const list: Filter[] = [];
      while (s[i] === "(") {
        const x = parse();
        if (!x) return null;
        list.push(x);
      }
      f = c === "&" ? { t: "and", list } : { t: "or", list };
    } else if (c === "!") {
      i++;
      const x = parse();
      f = x ? { t: "not", f: x } : null;
    } else f = item();
    if (!f || s[i] !== ")") return null;
    i++;
    return f;
  };
  const f = parse();
  return f && i === s.length ? f : null;
}

const escFilter = (v: string) => v.replace(/[\\*()\0]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, "0")}`);

/** フィルタを文字にもどす（ログに出す形。属性の名前は正式な名前にそろえる） */
export function filterText(f: Filter): string {
  switch (f.t) {
    case "and":
      return `(&${f.list.map(filterText).join("")})`;
    case "or":
      return `(|${f.list.map(filterText).join("")})`;
    case "not":
      return `(!${filterText(f.f)})`;
    case "present":
      return `(${attrName(f.attr)}=*)`;
    case "eq":
      return `(${attrName(f.attr)}=${escFilter(f.value)})`;
    case "approx":
      return `(${attrName(f.attr)}~=${escFilter(f.value)})`;
    case "ge":
      return `(${attrName(f.attr)}>=${escFilter(f.value)})`;
    case "le":
      return `(${attrName(f.attr)}<=${escFilter(f.value)})`;
    case "sub":
      return `(${attrName(f.attr)}=${escFilter(f.initial ?? "")}*${f.any.map((a) => `${escFilter(a)}*`).join("")}${escFilter(f.final ?? "")})`;
  }
}

/** フィルタに出てくる属性 */
export function filterAttrs(f: Filter, out = new Set<string>()): Set<string> {
  if (f.t === "and" || f.t === "or") for (const x of f.list) filterAttrs(x, out);
  else if (f.t === "not") filterAttrs(f.f, out);
  else out.add(f.attr.toLowerCase());
  return out;
}

/* ------------------------------------------------------------ アクセス制御（olcAccess） */

type DnStyle = "base" | "one" | "subtree" | "children";
export type AclWhat = { any: boolean; dn?: { style: DnStyle; ndn: string }; attrs?: string[]; filter?: Filter };
export type AclWho = { kind: "any" | "anonymous" | "users" | "self" } | { kind: "dn"; style: DnStyle; ndn: string } | { kind: "group"; ndn: string };
export type AclBy = { who: AclWho; level: Level; control: "stop" | "continue" | "break"; text: string };
export type AclRule = { what: AclWhat; by: AclBy[]; text: string };

function aclTokens(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote = false;
  let has = false;
  for (const c of text) {
    if (c === '"') {
      quote = !quote;
      has = true;
    } else if (!quote && /\s/.test(c)) {
      if (has) out.push(cur);
      cur = "";
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (has) out.push(cur);
  return out;
}

const dnStyle = (s: string | undefined): DnStyle | null =>
  s === undefined || s === "exact" || s === "base" || s === "baseobject"
    ? "base"
    : s === "one" || s === "onelevel"
      ? "one"
      : s === "sub" || s === "subtree"
        ? "subtree"
        : s === "children"
          ? "children"
          : null;

/** olcAccess の1つの値を読む（先頭の {0} はあってもなくてもよい）。まちがいなら、理由の文字 */
export function parseAcl(cfg: ServerConfig, text: string): AclRule | string {
  const body = text.replace(/^\s*\{\d+\}/, "").trim().replace(/\s+/g, " ");
  const toks = aclTokens(body);
  if (toks[0]?.toLowerCase() !== "to") return "最初は「to」で始めます";
  let i = 1;
  const what: AclWhat = { any: false };
  let sawWhat = false;
  while (i < toks.length && toks[i]!.toLowerCase() !== "by") {
    const t = toks[i++]!;
    if (t === "*") {
      what.any = true;
      sawWhat = true;
      continue;
    }
    const m = /^(dn|attrs?|filter)(?:\.([a-z]+))?=(.*)$/is.exec(t);
    if (!m) return `「${t}」がわかりません`;
    sawWhat = true;
    const key = m[1]!.toLowerCase();
    const val = m[3]!;
    if (key === "dn") {
      const style = dnStyle(m[2]?.toLowerCase());
      if (!style) return `dn.${m[2]} は使えません（exact・one・subtree・children）`;
      const ndn = normDn(cfg, val);
      if (ndn == null) return `DN「${val}」の書き方がおかしい`;
      what.dn = { style, ndn };
    } else if (key === "filter") {
      const f = parseFilter(val);
      if (!f) return `filter=${val} の書き方がおかしい`;
      what.filter = f;
    } else {
      const list: string[] = [];
      for (const raw of val.split(",")) {
        const name = raw.trim();
        if (!name) continue;
        const k = name.toLowerCase();
        if (k === "entry" || k === "children") list.push(k);
        else {
          const d = attrDef(cfg, name);
          if (!d) return `属性「${name}」を知りません`;
          list.push(d.key);
        }
      }
      if (!list.length) return "attrs= のあとに属性がありません";
      what.attrs = list;
    }
  }
  if (!sawWhat) return "to のあとに、どこを（* や attrs=…）を書きます";
  const by: AclBy[] = [];
  while (i < toks.length) {
    if (toks[i]!.toLowerCase() !== "by") return `「${toks[i]}」がわかりません（by で始めます）`;
    const whoTok = toks[i + 1];
    const lvlTok = toks[i + 2];
    if (!whoTok || !lvlTok || whoTok.toLowerCase() === "by") return "by のあとに「だれが」と「どこまで」を書きます";
    const who = parseWho(cfg, whoTok);
    if (typeof who === "string") return who;
    const lv = lvlTok.toLowerCase();
    const level: Level | null = lv === "add" || lv === "delete" ? "write" : (LEVELS as readonly string[]).includes(lv) ? (lv as Level) : null;
    if (!level) return `「${lvlTok}」は権限の名前ではありません（none・auth・read・write など）`;
    i += 3;
    let control: AclBy["control"] = "stop";
    const ctl = toks[i]?.toLowerCase();
    if (ctl === "stop" || ctl === "continue" || ctl === "break") {
      control = ctl;
      i++;
    }
    by.push({ who, level, control, text: `by ${whoTok} ${lvlTok}${control !== "stop" ? ` ${control}` : ""}` });
  }
  if (!by.length) return "by が1つもありません";
  return { what, by, text: body };
}

function parseWho(cfg: ServerConfig, t: string): AclWho | string {
  const k = t.toLowerCase();
  if (k === "*") return { kind: "any" };
  if (k === "anonymous" || k === "users" || k === "self") return { kind: k };
  const m = /^(dn|group(?:\/[A-Za-z]+(?:\/[A-Za-z]+)?)?)(?:\.([a-z]+))?=(.*)$/is.exec(t);
  if (!m) return `「${t}」は「だれが」の書き方ではありません（*・anonymous・users・self・dn.exact=…・group=…）`;
  const ndn = normDn(cfg, m[3]!);
  if (!ndn) return `DN「${m[3]}」の書き方がおかしい`;
  if (m[1]!.toLowerCase().startsWith("group")) return { kind: "group", ndn };
  const style = dnStyle(m[2]?.toLowerCase());
  if (!style) return `dn.${m[2]} は使えません`;
  return { kind: "dn", style, ndn };
}

const dnMatch = (ndn: string, style: DnStyle, base: string) =>
  style === "base" ? ndn === base : style === "one" ? parentOf(ndn) === base : style === "subtree" ? inScope(ndn, base, "sub") : ndn !== base && inScope(ndn, base, "sub");

export type Who = { ndn: string; dn: string; root: boolean };
export const ANON: Who = { ndn: "", dn: "", root: false };

/** how … root（管理者は olcAccess を見ない）・default（olcAccess が1行もない）・rule（rule 行目の by 番目）・nomatch（どの行にも当たらない） */
export type Decision = { ok: boolean; how: "root" | "default" | "rule" | "nomatch"; rule: number; by: number; level: Level };

/* ------------------------------------------------------------ 設定（cn=config） */

export type IndexKind = "eq" | "sub" | "pres" | "approx";
export type ModuleId = "memberof" | "refint" | "unique" | "ppolicy";
export const MODULES: readonly ModuleId[] = ["memberof", "refint", "unique", "ppolicy"];

export type ServerConfig = {
  suffix: string;
  rootDN: string;
  rootPW: string | null;
  schemas: Set<SchemaId>;
  modules: Set<ModuleId>;
  /** olcAccess（上から順） */
  acl: { text: string; rule: AclRule }[];
  index: Map<string, Set<IndexKind>>;
  /** olcSizeLimit（null は unlimited。書いていなければ 500） */
  sizeLimit: number | null;
  sizeLimitSet: boolean;
  disallowAnon: boolean;
  requireAuthc: boolean;
  /** 証明書（olcTLSCertificateFile・KeyFile）があるか */
  tlsCert: boolean;
  tlsKey: boolean;
  tlsCA: boolean;
  /** olcSecurity: tls=N（0 は書いていない） */
  securityTls: number;
  /** overlay（入れた順） */
  overlays: OverlayConf[];
};

export type OverlayConf =
  | { kind: "memberof" }
  | { kind: "refint"; attrs: string[]; nothing: string | null }
  | { kind: "unique"; uri: string; base: string; attrs: string[] }
  | { kind: "ppolicy"; def: string };

export const tlsOn = (cfg: ServerConfig) => cfg.tlsCert && cfg.tlsKey;
export const overlay = <K extends ModuleId>(cfg: ServerConfig, kind: K) => cfg.overlays.find((o) => o.kind === kind) as Extract<OverlayConf, { kind: K }> | undefined;

export function defaultConfig(): ServerConfig {
  const cfg: ServerConfig = {
    suffix: "dc=wanko,dc=shop",
    rootDN: "cn=admin,dc=wanko,dc=shop",
    rootPW: null,
    schemas: new Set<SchemaId>(["core", "cosine", "inetorgperson", "nis"]),
    modules: new Set(),
    acl: [],
    index: new Map([["objectclass", new Set<IndexKind>(["eq"])]]),
    sizeLimit: 500,
    sizeLimitSet: false,
    disallowAnon: false,
    requireAuthc: false,
    tlsCert: true,
    tlsKey: true,
    tlsCA: true,
    securityTls: 0,
    overlays: [],
  };
  return cfg;
}

/* ------------------------------------------------------------ 名簿 */

export type Attr = { name: string; vals: string[] };
export type Entry = { dn: string; ndn: string; pndn: string | null; attrs: Map<string, Attr>; created: number; modified: number; creator: string; modifier: string; uuid: string };
export type SearchHit = { dn: string; ndn: string; attrs: [string, string[]][] };

export type HostId = "pc" | "ldap" | "shop";
export const HOST_IP: Record<HostId, string> = { pc: "192.168.10.5", ldap: "192.168.10.2", shop: "192.168.10.20" };

export type LogSrc = "slapd" | "sshd" | "sssd" | "system";
export type LogLine = { at: number; host: HostId; src: LogSrc; text: string };
export type TraceTone = "info" | "ok" | "ng" | "warn";
/** ref … 光らせる設定の目じるし（rootpw・acl・acl:0・index:mail・memberof など。台本の設定の行と同じ名前） */
export type TraceItem = { text: string; tone: TraceTone; ref?: string };
export type Packet = { no: number; from: string; to: string; proto: "LDAP" | "TLS"; info: string; bytes: Uint8Array; secret: [number, number] | null; secretText: string | null };

export type OpKind = "connect" | "starttls" | "bind" | "search" | "add" | "modify" | "delete" | "passwd" | "whoami" | "config" | "ssh" | "remote" | "sssd" | "file";
export type OpRecord = {
  kind: OpKind;
  code: number;
  host?: HostId;
  dn?: string;
  /** bind：だれとして入れたか（ndn）。ppolicy：ロック中だったか・ロックしたか */
  as?: string;
  locked?: boolean;
  lockedNow?: boolean;
  tls?: boolean;
  /** search */
  hits?: SearchHit[];
  scanned?: number;
  indexed?: boolean;
  etime?: number;
  base?: string;
  filter?: string;
  /** add・modify・delete で、ほかに変わったエントリ（memberOf・refint） */
  touched?: string[];
  /** ssh */
  user?: string;
  stage?: "unknown" | "auth" | "access" | "ok" | "nohost";
  /** そのほか（ssh のコマンドの出力・設定の名前 など） */
  note?: string;
};

/** 1回の実行で起きたこと（画面に出すもの） */
export class RunLog {
  out: OutLine[] = [];
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

/** 画面に出す1行。err … 標準エラー、hint … 薄く添える説明（base64 をもどした文字 など）、mark … 目立たせる種類 */
export type OutLine = { text: string; err?: boolean; hint?: string; mark?: "secret" | "ok" | "ng" | "dim" | "prompt" };

export type Conn = {
  id: number;
  fd: number;
  host: HostId;
  port: number;
  /** 389・636・0（ldapi） */
  local: number;
  tls: boolean;
  who: Who;
  /** EXTERNAL（ldapi の root）でログインしている */
  external: boolean;
  op: number;
  msg: number;
};

const T0 = Date.UTC(2026, 9, 14, 1, 0, 0);

/** 2026-10-14 10:02:11（日本の時刻）→ 10:02:11 */
export const clockText = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(11, 19);
/** LDAP の時刻（GeneralizedTime、UTC） */
export const genTime = (ms: number, frac = false) => {
  const iso = new Date(ms).toISOString();
  const base = iso.slice(0, 19).replace(/[-T:]/g, "");
  return frac ? `${base}.${iso.slice(20, 23)}${String(ms % 1000).padStart(3, "0").slice(0, 3)}Z` : `${base}Z`;
};
const parseGenTime = (t: string) => {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(t);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) : 0;
};

const sec6 = (s: number) => s.toFixed(6);

export type WorldInit = { seed: number; cfg?: (cfg: ServerConfig) => void };

/** 名簿サーバー（slapd）1台 */
export class LdapWorld {
  cfg: ServerConfig;
  entries = new Map<string, Entry>();
  /** 下にいくつエントリがあるか（消せるか・hasSubordinates） */
  private kids = new Map<string, number>();
  clock = T0;
  rand: () => number;
  logs: LogLine[] = [];
  private connNo = 1000;
  private fdNo = 11;
  private packetNo = 0;
  /** 名簿を作った人（slapadd で入れたもの） */
  private loader = "cn=admin,dc=wanko,dc=shop";

  constructor(init: WorldInit) {
    this.rand = seeded(init.seed);
    this.cfg = defaultConfig();
    init.cfg?.(this.cfg);
  }

  /* ---------- 小物 ---------- */

  get(ndn: string): Entry | undefined {
    return this.entries.get(ndn);
  }

  /** ログに残す（いつもの slapd のログ：loglevel stats） */
  log(run: RunLog | null, host: HostId, src: LogSrc, text: string) {
    const line = { at: this.clock, host, src, text };
    this.logs.push(line);
    if (this.logs.length > 600) this.logs.splice(0, this.logs.length - 600);
    run?.logs.push(line);
  }

  tick(ms: number) {
    this.clock += Math.max(0, Math.round(ms));
  }

  /** 値（正式な名前で） */
  vals(e: Entry, name: string): string[] {
    return e.attrs.get(name.toLowerCase())?.vals ?? [];
  }

  first(e: Entry, name: string): string {
    return this.vals(e, name)[0] ?? "";
  }

  isA(e: Entry, cls: string): boolean {
    const want = cls.toLowerCase();
    return this.vals(e, "objectClass").some((v) => {
      const c = classDef(this.cfg, v);
      return c ? classChain(this.cfg, c).some((x) => x.key === want) : v.toLowerCase() === want;
    });
  }

  /** ssha をこの名簿の乱数で作る（塩は毎回ちがう） */
  hash(password: string): string {
    return ssha(password, randomBytes(this.rand, 4));
  }

  private uuid(): string {
    const b = randomBytes(this.rand, 16);
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  }

  /* ---------- 名簿を入れる（slapadd と同じ：olcAccess も overlay も通らない） ---------- */

  /** LDIF の add のレコードをまとめて入れる（台本の用意。まちがいがあれば投げる） */
  load(records: LdifRecord[], opts: { memberOf?: boolean } = {}) {
    for (const r of records) {
      if (r.change !== "add") throw new Error(`load: add しか入れられません（${r.dn}）`);
      const err = this.store(r.dn, r.attrs, this.loader, true);
      if (err) throw new Error(`load: ${r.dn}：${err.code} ${err.text}`);
    }
    if (opts.memberOf) for (const e of this.entries.values()) if (this.isA(e, "groupOfNames")) for (const m of this.vals(e, "member")) this.addMemberOf(m, e.dn);
  }

  /** エントリを1件しまう（スキーマを確かめる）。うまくいけば null */
  private store(dn: string, list: { name: string; value: string }[], by: string, bulk: boolean): { code: number; text: string; matched?: string } | null {
    const ndn = normDn(this.cfg, dn);
    const pretty = prettyDn(dn);
    if (!ndn || !pretty) return { code: 34, text: "invalid DN" };
    const check = this.checkAttrs(list);
    if (check) return check;
    const attrs = new Map<string, Attr>();
    for (const { name, value } of list) {
      const def = attrDef(this.cfg, name)!;
      const a = attrs.get(def.key) ?? { name: def.name, vals: [] };
      a.vals.push(value);
      attrs.set(def.key, a);
    }
    const schema = this.checkSchema(pretty, attrs);
    if (schema) return schema;
    const pndn = parentOf(ndn);
    if (!bulk && this.entries.has(ndn)) return { code: 68, text: "" };
    if (pndn && pndn !== "" && !this.entries.has(pndn) && ndn !== normDn(this.cfg, this.cfg.suffix)) return { code: 32, text: "", matched: this.matched(pndn) };
    const e: Entry = { dn: pretty, ndn, pndn, attrs, created: this.clock, modified: this.clock, creator: by, modifier: by, uuid: this.uuid() };
    this.entries.set(ndn, e);
    if (pndn) this.kids.set(pndn, (this.kids.get(pndn) ?? 0) + 1);
    return null;
  }

  /** 属性の名前と値の書き方（17・21） */
  private checkAttrs(list: { name: string; value: string }[]): { code: number; text: string } | null {
    const count = new Map<string, number>();
    for (const { name, value } of list) {
      const def = attrDef(this.cfg, name);
      if (!def) return { code: 17, text: `${name}: attribute type undefined` };
      const k = count.get(def.key) ?? 0;
      count.set(def.key, k + 1);
      if (normValue(this.cfg, def, value) == null) return { code: 21, text: `${def.name}: value #${k} invalid per syntax` };
    }
    return null;
  }

  /** オブジェクトクラスの決まり（65・64・19） */
  checkSchema(dn: string, attrs: Map<string, Attr>): { code: number; text: string } | null {
    const ocs = (attrs.get("objectclass")?.vals ?? []).map((v) => classDef(this.cfg, v)).filter((c): c is ClassDef => Boolean(c));
    if (!ocs.length) return { code: 65, text: "no objectClass attribute" };
    const structural = ocs.filter((c) => c.kind === "structural");
    if (!structural.length) return { code: 65, text: "no structural object class provided" };
    // 構造クラスが2つ以上なら、1本の親子の列になっていること
    const top = structural.find((s) => structural.every((o) => classChain(this.cfg, s).includes(o)));
    if (!top) return { code: 65, text: `invalid structural object class chain (${structural[0]!.name}/${structural[1]!.name})` };
    const all = new Set<ClassDef>();
    for (const c of ocs) for (const x of classChain(this.cfg, c)) all.add(x);
    all.add(CLASS_BY.get("top")!);
    for (const c of all)
      for (const m of c.must)
        if (!attrs.get(m)?.vals.length) return { code: 65, text: `object class '${c.name}' requires attribute '${attrDef(this.cfg, m)?.name ?? m}'` };
    for (const [k, a] of attrs) {
      const def = attrDef(this.cfg, k)!;
      if (def.op) continue;
      if (k !== "objectclass" && ![...all].some((c) => c.must.includes(k) || c.may.includes(k))) return { code: 65, text: `attribute '${a.name}' not allowed` };
      if (def.single && a.vals.length > 1) return { code: 19, text: `attribute '${a.name}' cannot have multiple values` };
      const seen = new Set<string>();
      for (const [n, v] of a.vals.entries()) {
        const nv = normValue(this.cfg, def, v) ?? v;
        if (seen.has(nv)) return { code: 20, text: `${a.name}: value #${n} provided more than once` };
        seen.add(nv);
      }
    }
    const rdns = parseDn(dn);
    for (const ava of rdns?.[0] ?? []) {
      const def = attrDef(this.cfg, ava.type);
      const nv = def ? normValue(this.cfg, def, ava.value) : null;
      if (!def || !(attrs.get(def.key)?.vals ?? []).some((v) => normValue(this.cfg, def, v) === nv)) return { code: 64, text: `value of naming attribute '${ava.type}' is not present in entry` };
    }
    return null;
  }

  /** いちばん近くにある親（matchedDN） */
  private matched(ndn: string | null): string {
    let cur = ndn;
    while (cur) {
      const e = this.entries.get(cur);
      if (e) return e.dn;
      cur = parentOf(cur);
    }
    return "";
  }

  /* ---------- アクセス制御 ---------- */

  access(e: Entry, attr: string, need: Level, who: Who): Decision {
    if (who.root) return { ok: true, how: "root", rule: -1, by: -1, level: "manage" };
    const rules = this.cfg.acl;
    if (!rules.length) return { ok: rank("read") >= rank(need), how: "default", rule: -1, by: -1, level: "read" };
    for (const [ri, { rule }] of rules.entries()) {
      if (!this.whatMatch(rule.what, e, attr)) continue;
      for (const [bi, by] of rule.by.entries()) {
        if (!this.whoMatch(by.who, e, who)) continue;
        if (by.control === "break") break;
        return { ok: rank(by.level) >= rank(need), how: "rule", rule: ri, by: bi, level: by.level };
      }
      // by に1つも当たらなければ、その行で「none」（つぎの行は見ない）
      return { ok: false, how: "rule", rule: ri, by: -1, level: "none" };
    }
    return { ok: false, how: "nomatch", rule: -1, by: -1, level: "none" };
  }

  private whatMatch(w: AclWhat, e: Entry, attr: string): boolean {
    if (w.dn && !dnMatch(e.ndn, w.dn.style, w.dn.ndn)) return false;
    if (w.attrs && !w.attrs.includes(attr)) return false;
    if (w.filter && this.match(e, w.filter, null) !== true) return false;
    return true;
  }

  private whoMatch(w: AclWho, e: Entry, who: Who): boolean {
    switch (w.kind) {
      case "any":
        return true;
      case "anonymous":
        return !who.ndn;
      case "users":
        return Boolean(who.ndn);
      case "self":
        return Boolean(who.ndn) && who.ndn === e.ndn;
      case "dn":
        return Boolean(who.ndn) && dnMatch(who.ndn, w.style, w.ndn);
      case "group": {
        const g = this.entries.get(w.ndn);
        return Boolean(g && who.ndn && this.vals(g, "member").some((m) => normDn(this.cfg, m) === who.ndn));
      }
    }
  }

  /** 決め手になった olcAccess の行を、人が読む形で（trace に出す） */
  describe(d: Decision): { text: string; ref: string } {
    if (d.how === "root") return { text: "管理者（olcRootDN）は olcAccess に関係なく、なんでもできる", ref: "rootdn" };
    if (d.how === "default") return { text: "olcAccess が1行もない → OpenLDAP の決まり「to * by * read」（だれでも読める）", ref: "acl" };
    if (d.how === "nomatch") return { text: "olcAccess のどの行にも当たらない → 「だめ」（none）", ref: "acl" };
    const rule = this.cfg.acl[d.rule]!.rule;
    const by = rule.by[d.by];
    const to = rule.text.replace(/\s+by\s.*$/i, "");
    return by
      ? { text: `olcAccess {${d.rule}} 「${to}」の「${by.text}」に当たった（${by.level}）`, ref: `acl:${d.rule}:${d.by}` }
      : { text: `olcAccess {${d.rule}} 「${to}」の by にどれも当たらない → 「だめ」（none）`, ref: `acl:${d.rule}` };
  }

  /* ---------- フィルタ ---------- */

  /** フィルタに合うか（true・false・わからない＝undefined）。who があれば、search の権限がない属性は「わからない」 */
  match(e: Entry, f: Filter, who: Who | null, denied?: Set<string>): boolean | undefined {
    switch (f.t) {
      case "and": {
        let und = false;
        for (const x of f.list) {
          const r = this.match(e, x, who, denied);
          if (r === false) return false;
          if (r === undefined) und = true;
        }
        return und ? undefined : true;
      }
      case "or": {
        let und = false;
        for (const x of f.list) {
          const r = this.match(e, x, who, denied);
          if (r === true) return true;
          if (r === undefined) und = true;
        }
        return und ? undefined : false;
      }
      case "not": {
        const r = this.match(e, f.f, who, denied);
        return r === undefined ? undefined : !r;
      }
    }
    const def = attrDef(this.cfg, f.attr);
    if (!def) return undefined;
    if (who && !this.access(e, def.key, "search", who).ok) {
      denied?.add(def.name);
      return undefined;
    }
    const vals = this.valuesFor(e, def);
    if (f.t === "present") return vals.length > 0;
    if (f.t === "sub") {
      if (def.syn === "int" || def.syn === "bool" || def.syn === "pw") return undefined;
      const n = (v: string) => (def.syn === "ce" ? v : v.toLowerCase());
      const ini = f.initial ? n(f.initial) : "";
      const fin = f.final ? n(f.final) : "";
      const any = f.any.map(n);
      return vals.some((raw) => {
        let v = def.syn === "dn" ? (normDn(this.cfg, raw) ?? raw) : n(normValue(this.cfg, def, raw) ?? raw);
        if (!v.startsWith(ini)) return false;
        v = v.slice(ini.length);
        for (const a of any) {
          const at = v.indexOf(a);
          if (at < 0) return false;
          v = v.slice(at + a.length);
        }
        return v.endsWith(fin) && v.length >= fin.length;
      });
    }
    if (def.key === "objectclass" && f.t === "eq") {
      const want = f.value.trim().toLowerCase();
      return vals.some((v) => {
        const c = classDef(this.cfg, v);
        return c ? classChain(this.cfg, c).some((x) => x.key === want) : v.toLowerCase() === want;
      });
    }
    const a = normValue(this.cfg, def, f.value);
    if (a == null) return undefined;
    const norm = vals.map((v) => normValue(this.cfg, def, v)).filter((v): v is string => v != null);
    if (f.t === "eq" || f.t === "approx") return norm.includes(a);
    const cmp = (x: string) => (def.syn === "int" ? Number(BigInt(x) - BigInt(a)) : x < a ? -1 : x > a ? 1 : 0);
    return f.t === "ge" ? norm.some((v) => cmp(v) >= 0) : norm.some((v) => cmp(v) <= 0);
  }

  /** エントリの値（ふだんは見えない操作属性も、ここで作る） */
  private valuesFor(e: Entry, def: AttrDef): string[] {
    switch (def.key) {
      case "structuralobjectclass": {
        const s = this.structural(e);
        return s ? [s] : [];
      }
      case "entryuuid":
        return [e.uuid];
      case "creatorsname":
        return [e.creator];
      case "createtimestamp":
        return [genTime(e.created)];
      case "modifiersname":
        return [e.modifier];
      case "modifytimestamp":
        return [genTime(e.modified)];
      case "entrydn":
        return [e.dn];
      case "subschemasubentry":
        return ["cn=Subschema"];
      case "hassubordinates":
        return [(this.kids.get(e.ndn) ?? 0) > 0 ? "TRUE" : "FALSE"];
    }
    return e.attrs.get(def.key)?.vals ?? [];
  }

  private structural(e: Entry): string | null {
    const ocs = this.vals(e, "objectClass")
      .map((v) => classDef(this.cfg, v))
      .filter((c): c is ClassDef => Boolean(c && c.kind === "structural"));
    const top = ocs.find((s) => ocs.every((o) => classChain(this.cfg, s).includes(o)));
    return top?.name ?? null;
  }

  /* ---------- つながり ---------- */

  open(host: HostId, local: number, tls: boolean, run: RunLog): Conn {
    const c: Conn = { id: this.connNo++, fd: this.fdNo++, host, port: 40000 + Math.floor(this.rand() * 20000), local, tls, who: ANON, external: false, op: 0, msg: 1 };
    if (this.fdNo > 40) this.fdNo = 11;
    const from = local === 0 ? "PATH=/run/openldap/ldapi" : `IP=${HOST_IP[host]}:${c.port}`;
    const to = local === 0 ? "PATH=/run/openldap/ldapi" : `IP=0.0.0.0:${local}`;
    this.log(run, "ldap", "slapd", `conn=${c.id} fd=${c.fd} ACCEPT from ${from} (${to})`);
    if (tls) this.log(run, "ldap", "slapd", `conn=${c.id} fd=${c.fd} TLS established tls_ssf=256 ssf=256 tls_proto=TLSv1.3 tls_cipher=TLS_AES_256_GCM_SHA384`);
    run.ops.push({ kind: "connect", code: 0, host, tls });
    return c;
  }

  close(c: Conn, run: RunLog, unbind = true) {
    if (unbind) {
      this.log(run, "ldap", "slapd", `conn=${c.id} op=${c.op} UNBIND`);
      this.packet(run, c, "c2s", "unbindRequest", berUnbind(c.msg));
    }
    this.log(run, "ldap", "slapd", `conn=${c.id} fd=${c.fd} closed`);
  }

  /** ネットワークを流れたバイトを残す（TLS のつながりなら、読めないバイトにする） */
  private packet(run: RunLog, c: Conn, dir: "c2s" | "s2c", info: string, bytes: Uint8Array, secret: [number, number] | null = null, secretText: string | null = null) {
    if (c.local === 0) return;
    const client = `${HOST_IP[c.host]}:${c.port}`;
    const server = `${HOST_IP.ldap}:${c.local}`;
    const [from, to] = dir === "c2s" ? [client, server] : [server, client];
    this.packetNo++;
    if (run.packets.length > 300) return;
    if (c.tls) run.packets.push({ no: this.packetNo, from, to, proto: "TLS", info: "Application Data", bytes: tlsRecord(this.rand, bytes.length), secret: null, secretText: null });
    else run.packets.push({ no: this.packetNo, from, to, proto: "LDAP", info, bytes, secret, secretText });
  }

  /** TLS のあいさつ（ClientHello・ServerHello）を残す */
  handshake(run: RunLog, c: Conn) {
    if (c.local === 0) return;
    const client = `${HOST_IP[c.host]}:${c.port}`;
    const server = `${HOST_IP.ldap}:${c.local}`;
    const hello = (n: number) => {
      const b = randomBytes(this.rand, n);
      b.set([0x16, 0x03, 0x01, (n - 5) >> 8, (n - 5) & 255, 0x01], 0);
      return b;
    };
    run.packets.push({ no: ++this.packetNo, from: client, to: server, proto: "TLS", info: "Client Hello", bytes: hello(517), secret: null, secretText: null });
    run.packets.push({ no: ++this.packetNo, from: server, to: client, proto: "TLS", info: "Server Hello, Change Cipher Spec, Application Data", bytes: tlsRecord(this.rand, 1180, 0x16), secret: null, secretText: null });
  }

  /** StartTLS（ldap:// のまま、途中から暗号にする） */
  startTLS(c: Conn, run: RunLog): { code: number; text: string } {
    const op = c.op++;
    const id = c.msg++;
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} EXT oid=1.3.6.1.4.1.1466.20037`);
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} STARTTLS`);
    this.packet(run, c, "c2s", `extendedReq(${id}) LDAP_START_TLS_OID`, berExtRequest(id, "1.3.6.1.4.1.1466.20037"));
    let code = 0;
    let text = "";
    if (c.tls) [code, text] = [1, "TLS already started"];
    else if (!tlsOn(this.cfg)) [code, text] = [52, "Could not initialize TLS"];
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} RESULT oid= err=${code} qtime=0.000011 etime=0.000${90 + Math.floor(this.rand() * 60)} text=${text}`);
    this.packet(run, c, "s2c", `extendedResp(${id})`, berExtResponse(id, code, text));
    if (code) {
      if (code === 52) run.note("サーバーに証明書（olcTLSCertificateFile）がない → 暗号にできない（52）", "ng", "tls:cert");
      else run.note("もう ldaps:// で暗号になっているので、-ZZ（StartTLS）は要らない（つけるとエラーになる）", "warn", "tls:client");
      run.ops.push({ kind: "starttls", code });
      return { code, text };
    }
    this.handshake(run, c);
    c.tls = true;
    this.log(run, "ldap", "slapd", `conn=${c.id} fd=${c.fd} TLS established tls_ssf=256 ssf=256 tls_proto=TLSv1.3 tls_cipher=TLS_AES_256_GCM_SHA384`);
    run.note("StartTLS：ここから先は暗号（TLS）で話す", "ok", "tls:cert");
    run.ops.push({ kind: "starttls", code: 0, tls: true });
    return { code: 0, text: "" };
  }

  /* ---------- バインド（ログイン） ---------- */

  bind(c: Conn, dn: string, password: string, run: RunLog): { code: number; text: string; locked?: boolean } {
    const op = c.op++;
    const id = c.msg++;
    const shown = dn.trim();
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} BIND dn="${shown}" method=128`);
    const req = berBindRequest(id, shown, password);
    this.packet(run, c, "c2s", `bindRequest(${id}) "${shown || "<ROOT>"}" simple`, req.bytes, req.secret, password || null);
    const done = (code: number, text: string, extra: Partial<OpRecord> = {}) => {
      this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} RESULT tag=97 err=${code} qtime=0.000010 etime=0.000${110 + Math.floor(this.rand() * 90)} text=${text}`);
      this.packet(run, c, "s2c", `bindResponse(${id}) ${code ? resultText(code) : "success"}`, berResult(id, 0x61, code, "", text));
      if (code) c.who = ANON;
      run.ops.push({ kind: "bind", code, dn: shown, tls: c.tls, ...extra });
      return { code, text, locked: extra.locked };
    };
    if (this.cfg.securityTls > 0 && !c.tls) {
      run.note(password ? "暗号にしていないつながりで、パスワードが届いた → olcSecurity: tls=1 なので断った（13）。でも、パスワードはもうネットワークを流れている" : "暗号にしていないつながり → olcSecurity: tls=1 なので断った（13）", "warn", "tls:security");
      return done(13, "TLS confidentiality required");
    }
    if (!shown && !password) {
      if (this.cfg.disallowAnon) {
        run.note("名前もパスワードもない「匿名」のバインド → olcDisallows: bind_anon なので断った（48）", "ok", "anon:disallow");
        return done(48, "anonymous bind disallowed");
      }
      run.note("名前もパスワードもない → 「匿名」としてつながった（olcDisallows: bind_anon がないので、だれでも入れる）", "info", "anon:disallow");
      c.who = ANON;
      return done(0, "", { as: "" });
    }
    if (!shown) {
      run.note("DN がないのにパスワードがある → 断った", "ng");
      return done(49, "");
    }
    if (!password) {
      run.note("DN だけでパスワードがない →「パスワードなしのログイン」は OpenLDAP が断る（53）", "ok");
      return done(53, "unauthenticated bind (DN with no password) disallowed");
    }
    const ndn = normDn(this.cfg, shown);
    if (ndn == null) {
      run.note("DN の書き方がおかしい（34）", "ng");
      return done(34, "invalid DN");
    }
    const rootN = normDn(this.cfg, this.cfg.rootDN);
    if (ndn === rootN) {
      if (this.cfg.rootPW) {
        if (checkPassword(this.cfg.rootPW, password)) {
          run.note(`${rdnOf(shown)} は olcRootDN（管理者）。olcRootPW のハッシュとパスワードが合った → 管理者としてログイン`, "ok", "rootpw");
          c.who = { ndn, dn: shown, root: true };
          this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} BIND dn="${shown}" mech=SIMPLE bind_ssf=0 ssf=${c.tls ? 256 : 0}`);
          return done(0, "", { as: ndn });
        }
        run.note(`${rdnOf(shown)} は管理者。でも olcRootPW とパスワードが合わない → 49`, "ng", "rootpw");
        return done(49, "");
      }
      run.note(`${rdnOf(shown)} は olcRootDN（管理者）。でも olcRootPW が書いていないので、パスワードを確かめられない`, "ng", "rootpw");
    }
    const e = this.entries.get(ndn);
    if (!e) {
      run.note(`${rdnOf(shown)} は名簿にいない → 49（いるかいないかは、わざと教えない）`, "ng");
      return done(49, "");
    }
    const d = this.access(e, "userpassword", "auth", ANON);
    if (!d.ok) {
      const why = this.describe(d);
      run.note(`パスワードを確かめていい？（匿名が userPassword を auth できるか）→ ${why.text}`, "ng", why.ref);
      run.note("確かめられないので、正しいパスワードでも 49", "ng", why.ref);
      return done(49, "");
    }
    const policy = this.policyFor(e);
    if (policy && policy.lockout) {
      const lockedAt = this.first(e, "pwdAccountLockedTime");
      if (lockedAt) {
        const until = policy.duration > 0 ? parseGenTime(lockedAt) + policy.duration * 1000 : Infinity;
        if (this.clock < until) {
          run.note(
            `ppolicy：${rdnOf(shown)} はロック中（${policy.duration > 0 ? `あと ${Math.ceil((until - this.clock) / 1000)}秒` : "管理者が外すまで"}）→ パスワードが正しくても 49`,
            "warn",
            "ppolicy",
          );
          return done(49, "", { locked: true });
        }
        run.note(`ppolicy：ロックしてから ${policy.duration}秒たった（pwdLockoutDuration）→ ロックを外した`, "ok", "ppolicy:duration");
        e.attrs.delete("pwdaccountlockedtime");
        e.attrs.delete("pwdfailuretime");
      }
    }
    const ok = this.vals(e, "userPassword").some((v) => checkPassword(v, password));
    if (!ok) {
      if (policy) {
        const fails = [...this.vals(e, "pwdFailureTime"), genTime(this.clock, true)];
        e.attrs.set("pwdfailuretime", { name: "pwdFailureTime", vals: fails });
        const max = policy.maxFailure;
        if (policy.lockout && max > 0 && fails.length >= max && !this.first(e, "pwdAccountLockedTime")) {
          e.attrs.set("pwdaccountlockedtime", { name: "pwdAccountLockedTime", vals: [genTime(this.clock)] });
          run.note(`パスワードがちがう（${fails.length}回目）→ pwdMaxFailure（${max}回）に届いたので、pwdLockout でロックした`, "ok", "ppolicy");
          return done(49, "", { lockedNow: true });
        }
        run.note(`パスワードがちがう → 49（ppolicy が数えている：${fails.length}回目${max ? ` ／ ${max}回でロック` : ""}）`, "ng", "ppolicy");
        return done(49, "");
      }
      run.note("パスワードがちがう → 49（何回まちがえても、サーバーは何もしない）", "ng", this.cfg.modules.has("ppolicy") ? "ppolicy" : undefined);
      return done(49, "");
    }
    if (policy) e.attrs.delete("pwdfailuretime");
    run.note(`パスワードが合った → ${rdnOf(shown)} としてログイン`, "ok");
    c.who = { ndn, dn: e.dn, root: false };
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} BIND dn="${e.dn}" mech=SIMPLE bind_ssf=0 ssf=${c.tls ? 256 : 0}`);
    return done(0, "", { as: ndn });
  }

  /** ldapi の root（-Y EXTERNAL） */
  bindExternal(c: Conn, run: RunLog) {
    const op = c.op++;
    c.msg++;
    c.external = true;
    c.who = { ndn: "gidnumber=0+uidnumber=0,cn=peercred,cn=external,cn=auth", dn: "gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth", root: false };
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} BIND dn="" method=163`);
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} BIND authcid="gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth" authzid="gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth"`);
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} BIND dn="gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth" mech=EXTERNAL bind_ssf=0 ssf=71`);
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} RESULT tag=97 err=0 qtime=0.000009 etime=0.000080 text=`);
    run.ops.push({ kind: "bind", code: 0, dn: "EXTERNAL", as: "external" });
  }

  /** ppolicy の決まり（overlay が入っていて、olcPPolicyDefault のエントリがあれば） */
  policyFor(_e: Entry): { maxFailure: number; lockout: boolean; duration: number; dn: string } | null {
    const pp = overlay(this.cfg, "ppolicy");
    if (!pp) return null;
    const ndn = normDn(this.cfg, pp.def);
    const p = ndn ? this.entries.get(ndn) : undefined;
    if (!p || !this.isA(p, "pwdPolicy")) return null;
    return {
      maxFailure: Number(this.first(p, "pwdMaxFailure") || 0),
      lockout: this.first(p, "pwdLockout") === "TRUE",
      duration: Number(this.first(p, "pwdLockoutDuration") || 0),
      dn: p.dn,
    };
  }

  /** 操作の前の決まり（暗号・ログイン）。だめなら結果 */
  private restrict(c: Conn, run: RunLog): { code: number; text: string } | null {
    if (c.external) return null;
    if (this.cfg.securityTls > 0 && !c.tls) {
      run.note("暗号にしていないつながり → olcSecurity: tls=1 なので断った（13）", "warn", "tls:security");
      return { code: 13, text: "TLS confidentiality required" };
    }
    if (this.cfg.requireAuthc && !c.who.ndn) {
      run.note("ログインしていない → olcRequires: authc なので断った（53）", "ok", "anon:require");
      return { code: 53, text: "authentication required" };
    }
    return null;
  }

  /* ---------- さがす ---------- */

  search(
    c: Conn,
    req: { base: string; scope: Scope; filter: Filter; attrs: string[]; sizeLimit: number },
    run: RunLog,
  ): { code: number; text: string; matched?: string; hits: SearchHit[]; scanned: number } {
    const op = c.op++;
    const id = c.msg++;
    const ftext = filterText(req.filter);
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} SRCH base="${req.base}" scope=${SCOPE_NO[req.scope]} deref=0 filter="${ftext}"`);
    if (req.attrs.length) this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} SRCH attr=${req.attrs.join(" ")}`);
    this.packet(run, c, "c2s", `searchRequest(${id}) "${req.base}" ${SCOPE_NAME[req.scope]}`, berSearchRequest(id, req.base, SCOPE_NO[req.scope], req.filter, req.attrs, req.sizeLimit));
    const hits: SearchHit[] = [];
    let scanned = 0;
    let indexed = false;
    let etime = 0.00008;
    const finish = (code: number, text: string, matched = "") => {
      etime += hits.length * 0.000015;
      this.tick(etime * 1000);
      this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} SEARCH RESULT tag=101 err=${code} qtime=0.000009 etime=${sec6(etime)} nentries=${hits.length} text=${text}`);
      this.packet(run, c, "s2c", `searchResDone(${id}) ${code ? resultText(code) : "success"} [${hits.length} result${hits.length === 1 ? "" : "s"}]`, berResult(id, 0x65, code, matched, text));
      run.ops.push({ kind: "search", code, hits, scanned, indexed, etime, base: req.base, filter: ftext, tls: c.tls });
      return { code, text, matched, hits, scanned };
    };
    const blocked = this.restrict(c, run);
    if (blocked) return finish(blocked.code, blocked.text);
    if (/(^|,)\s*cn=config\s*$/i.test(req.base) || /^\s*cn=config\s*$/i.test(req.base)) return this.searchConfig(c, req, run, hits, finish);
    if (req.base.trim() === "" && req.scope === "base") {
      const root: SearchHit = { dn: "", ndn: "", attrs: [] };
      const want = new Set(req.attrs.map((a) => a.toLowerCase()));
      if (want.has("+") || want.has("namingcontexts")) root.attrs.push(["namingContexts", [this.cfg.suffix]]);
      if (want.has("+") || want.has("supportedextension")) root.attrs.push(["supportedExtension", ["1.3.6.1.4.1.1466.20037", "1.3.6.1.4.1.4203.1.11.1", "1.3.6.1.4.1.4203.1.11.3"]]);
      if (!req.attrs.length || want.has("*")) root.attrs.unshift(["objectClass", ["top", "OpenLDAProotDSE"]]);
      hits.push(root);
      run.note("ルート DSE（DN が空のエントリ）は、このサーバーの名簿のてっぺん（namingContexts）を教えてくれる", "info", "suffix");
      return finish(0, "");
    }
    const base = normDn(this.cfg, req.base);
    if (base == null) {
      run.note(`さがしはじめる場所「${req.base}」の書き方がおかしい（34）`, "ng");
      return finish(34, "invalid DN");
    }
    const suffix = normDn(this.cfg, this.cfg.suffix)!;
    if (base === "" || !inScope(base, suffix, "sub")) {
      run.note(`「${req.base || "（空）"}」は、このサーバーの名簿（olcSuffix: ${this.cfg.suffix}）の外 → 32`, "ng", "suffix");
      return finish(32, "");
    }
    const baseEntry = this.entries.get(base);
    if (!baseEntry) {
      run.note(`さがしはじめる場所（ベース）「${req.base}」が名簿にない → 32`, "ng");
      return finish(32, "", this.matched(parentOf(base)));
    }
    // インデックスで、見る候補をしぼる
    const cand = this.candidates(req.filter, base, req.scope, run);
    scanned = cand.list.length;
    indexed = cand.indexed;
    etime += scanned * 0.0000028;
    const limit = c.who.root ? req.sizeLimit || 0 : Math.min(req.sizeLimit || Infinity, this.cfg.sizeLimit ?? Infinity);
    const denied = new Set<string>();
    const hidden = new Map<string, Decision>();
    let shownSecret: Decision | null = null;
    let skipped = 0;
    let over = false;
    for (const e of cand.list) {
      if (this.match(e, req.filter, c.who, denied) !== true) continue;
      if (!this.access(e, "entry", "read", c.who).ok) {
        skipped++;
        continue;
      }
      if (limit && Number.isFinite(limit) && hits.length >= limit) {
        over = true;
        break;
      }
      const hit = this.project(e, req.attrs, c.who, hidden);
      if (hit.attrs.some(([n]) => n === "userPassword") && !shownSecret) shownSecret = this.access(e, "userpassword", "read", c.who);
      hits.push(hit);
      this.packet(run, c, "s2c", `searchResEntry(${id}) "${e.dn}"`, berSearchEntry(id, e.dn, hit.attrs));
    }
    // 説明（サーバーの中で起きたこと）
    run.note(
      cand.indexed
        ? `インデックス（olcDbIndex: ${cand.used}）で、見る候補を ${scanned.toLocaleString("en-US")}件にしぼった`
        : `${cand.unindexed.length ? `${cand.unindexed.join("・")} のインデックスがない → ` : ""}「${baseEntry.dn}」の下を全部（${scanned.toLocaleString("en-US")}件）1件ずつ見た`,
      cand.indexed ? "ok" : scanned > 1000 ? "warn" : "info",
      cand.unindexed[0] || cand.used ? `index:${(cand.used || cand.unindexed[0] || "").split(" ")[0]!.toLowerCase()}` : undefined,
    );
    if (denied.size) run.note(`${[...denied].join("・")} は、さがすための権限（search）がないので「わからない」あつかい`, "warn", "acl");
    run.note(`フィルタ ${ftext} に合ったのは ${hits.length + (over ? 1 : 0) + skipped > hits.length ? `${hits.length}件${over ? "（ここで止めた）" : ""}` : `${hits.length}件`}`, hits.length ? "info" : "warn");
    if (skipped) run.note(`見る権限（olcAccess）がないエントリが ${skipped}件あったので、返さなかった`, "info", "acl");
    if (shownSecret) {
      const why = this.describe(shownSecret);
      run.note(`userPassword を見せていい？ → ${why.text} → パスワードのハッシュも返した`, "ng", why.ref);
    }
    for (const [name, d] of hidden) {
      const why = this.describe(d);
      run.note(`${name} を見せていい？ → ${why.text} → ${name} は外して返した`, name === "userPassword" ? "ok" : "info", why.ref);
    }
    const wantMemberOf = req.attrs.some((a) => a.toLowerCase() === "memberof");
    if (wantMemberOf && !attrDef(this.cfg, "memberOf")) run.note("memberOf という属性を、このサーバーは知らない（memberof overlay を入れていない）→ 何も返せない", "ng", "memberof");
    else if (wantMemberOf && hits.length && hits.every((h) => !h.attrs.some(([n]) => n === "memberOf")))
      run.note("memberOf が書いてない（overlay は、グループが変わったときにだけ書く）", "warn", "memberof");
    if (over) {
      run.note(`返す数の上限（${c.who.root ? "-z" : "olcSizeLimit"}：${limit}件）に届いたので、そこで止めた（4）`, "warn", "sizelimit");
      return finish(4, "");
    }
    return finish(0, "");
  }

  /** 返す属性をえらぶ（* … ふつうの属性全部、+ … 操作属性全部、1.1 … なし） */
  private project(e: Entry, attrs: string[], who: Who, hidden: Map<string, Decision>): SearchHit {
    const want = attrs.map((a) => a.toLowerCase());
    const all = !want.length || want.includes("*");
    const ops = want.includes("+");
    const none = want.length > 0 && want.every((a) => a === "1.1");
    const out: [string, string[]][] = [];
    if (none) return { dn: e.dn, ndn: e.ndn, attrs: out };
    const push = (def: AttrDef) => {
      if (out.some(([n]) => n === def.name)) return;
      const vals = this.valuesFor(e, def);
      if (!vals.length) return;
      const d = this.access(e, def.key, "read", who);
      if (!d.ok) {
        if (!hidden.has(def.name)) hidden.set(def.name, d);
        return;
      }
      out.push([def.name, vals]);
    };
    for (const [k] of e.attrs) {
      const def = attrDef(this.cfg, k);
      if (!def) continue;
      if (def.op ? ops || want.includes(def.key) || def.alias.some((x) => want.includes(x.toLowerCase())) : all || want.includes(def.key) || def.alias.some((x) => want.includes(x.toLowerCase()))) push(def);
    }
    for (const w of want) {
      const def = attrDef(this.cfg, w);
      if (def?.op && !e.attrs.has(def.key)) push(def);
    }
    if (ops)
      for (const k of ["structuralobjectclass", "entryuuid", "creatorsname", "createtimestamp", "modifiersname", "modifytimestamp", "entrydn", "subschemasubentry", "hassubordinates"]) push(attrDef(this.cfg, k)!);
    return { dn: e.dn, ndn: e.ndn, attrs: out };
  }

  /** インデックスで候補をしぼる（使えるインデックスがなければ、範囲の中を全部） */
  private candidates(f: Filter, base: string, scope: Scope, run: RunLog): { list: Entry[]; indexed: boolean; used: string; unindexed: string[] } {
    const scopeList = () => [...this.entries.values()].filter((e) => inScope(e.ndn, base, scope));
    const unindexed: string[] = [];
    const tryItem = (x: Filter): { kind: IndexKind; attr: string } | null => {
      if (x.t === "and" || x.t === "or" || x.t === "not") return null;
      const def = attrDef(this.cfg, x.attr);
      if (!def) return null;
      const kind: IndexKind = x.t === "present" ? "pres" : x.t === "sub" ? "sub" : x.t === "approx" ? "approx" : "eq";
      if (x.t === "ge" || x.t === "le") return null;
      const has = this.cfg.index.get(def.key);
      if (has?.has(kind) || (kind === "approx" && has?.has("eq"))) return { kind, attr: def.name };
      const where = kind === "eq" || kind === "approx" ? "equality" : kind === "sub" ? "substring" : "presence";
      const line = `<= mdb_${where}_candidates: (${def.name}) not indexed`;
      this.log(run, "ldap", "slapd", line);
      if (!unindexed.includes(def.name)) unindexed.push(def.name);
      return null;
    };
    const items = f.t === "and" ? f.list : [f];
    const usable = items.map(tryItem).filter((x): x is { kind: IndexKind; attr: string } => Boolean(x));
    if (!usable.length) return { list: scopeList(), indexed: false, used: "", unindexed };
    // 使えるインデックスの中で、いちばん候補が少ないもの
    let best: Entry[] | null = null;
    let used = "";
    for (const u of usable) {
      const sub = items.find((x) => x.t !== "and" && x.t !== "or" && x.t !== "not" && attrDef(this.cfg, x.attr)?.name === u.attr)!;
      const list = scopeList().filter((e) => this.match(e, sub, null) === true);
      if (!best || list.length < best.length) {
        best = list;
        used = `${u.attr} ${u.kind}`;
      }
    }
    return { list: best ?? [], indexed: true, used, unindexed };
  }

  /* ---------- 書きこむ ---------- */

  add(c: Conn, rec: { dn: string; attrs: { name: string; value: string }[] }, run: RunLog): { code: number; text: string; matched?: string } {
    const op = c.op++;
    const id = c.msg++;
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} ADD dn="${rec.dn.trim()}"`);
    this.packet(run, c, "c2s", `addRequest(${id}) "${rec.dn.trim()}"`, berSearchEntry(id, rec.dn.trim(), []));
    const touched: string[] = [];
    const done = (code: number, text: string, matched = "") => {
      this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} RESULT tag=105 err=${code} qtime=0.000010 etime=0.000${300 + Math.floor(this.rand() * 400)} text=${text}`);
      this.packet(run, c, "s2c", `addResponse(${id}) ${code ? resultText(code) : "success"}`, berResult(id, 0x69, code, matched, text));
      run.ops.push({ kind: "add", code, dn: rec.dn.trim(), touched });
      return { code, text, matched };
    };
    if (c.external && /cn=config\s*$/i.test(rec.dn)) return this.configAdd(rec, run, done);
    const blocked = this.restrict(c, run);
    if (blocked) return done(blocked.code, blocked.text);
    const ndn = normDn(this.cfg, rec.dn);
    if (ndn == null) {
      run.note(`DN「${rec.dn}」の書き方がおかしい（34）`, "ng");
      return done(34, "invalid DN");
    }
    const bad = this.checkAttrs(rec.attrs);
    if (bad) {
      const m = /^(.+?): value #(\d+)/.exec(bad.text);
      if (bad.code === 21 && m?.[1] === "objectClass") {
        const name = rec.attrs.filter((a) => a.name.toLowerCase() === "objectclass")[Number(m[2])]?.value ?? "";
        const sc = classSchema(name);
        run.note(
          `オブジェクトクラス「${name}」を${sc && sc !== "system" ? `知らない（${sc} スキーマを読みこんでいない）` : "どのスキーマも知らない"} → 21`,
          "ng",
          sc ? `schema:${sc}` : undefined,
        );
      } else if (bad.code === 17) {
        const name = bad.text.split(":")[0]!;
        const sc = attrSchema(name);
        run.note(`属性「${name}」を${sc ? `知らない（${sc} スキーマを読みこんでいない）` : "どのスキーマも知らない"} → 17`, "ng", sc ? `schema:${sc}` : undefined);
      } else run.note(`値の書き方が、その属性の決まり（シンタックス）に合わない → ${bad.code}`, "ng");
      return done(bad.code, bad.text);
    }
    const suffix = normDn(this.cfg, this.cfg.suffix)!;
    if (!inScope(ndn, suffix, "sub")) {
      run.note(`「${rec.dn}」は、このサーバーがあずかる名簿（olcSuffix: ${this.cfg.suffix}）の外 → どこにも入れられない（53）`, "ng", "suffix");
      return done(53, "no global superior knowledge");
    }
    // unique（入れる前に、ほかのエントリと値がかぶらないか）
    const uq = overlay(this.cfg, "unique");
    if (uq) {
      const clash = this.uniqueClash(uq, ndn, rec.attrs);
      if (clash) {
        run.note(`unique overlay：${clash.attr} ${clash.value} は、もう ${rdnOf(clash.by)} が使っている → 19`, "ok", "unique");
        return done(19, "some attributes not unique");
      }
    }
    const attrs = new Map<string, Attr>();
    for (const { name, value } of rec.attrs) {
      const def = attrDef(this.cfg, name)!;
      const a = attrs.get(def.key) ?? { name: def.name, vals: [] };
      a.vals.push(value);
      attrs.set(def.key, a);
    }
    for (const [k, a] of attrs) {
      const def = attrDef(this.cfg, k)!;
      if (def.noMod) return done(19, `${a.name}: no user modification allowed`);
    }
    const sch = this.checkSchema(prettyDn(rec.dn)!, attrs);
    if (sch) {
      const m = /object class '(.+)' requires attribute '(.+)'/.exec(sch.text);
      run.note(m ? `${m[1]} には ${m[2]} が必ず要る（MUST）のに、書いていない → 65` : `オブジェクトクラスの決まりに合わない（${sch.text}）→ ${sch.code}`, "ng");
      return done(sch.code, sch.text);
    }
    const pndn = parentOf(ndn);
    const parent = pndn ? this.entries.get(pndn) : undefined;
    if (ndn !== suffix && !parent) {
      run.note("入れる場所（親のエントリ）がまだない → 32", "ng");
      return done(32, "", this.matched(pndn));
    }
    if (!c.who.root) {
      const p = parent ? this.access(parent, "children", "write", c.who) : { ok: false, how: "nomatch" as const, rule: -1, by: -1, level: "none" as const };
      if (!p.ok) {
        run.note(`親のエントリに書きこむ権限は？ → ${parent ? this.describe(p).text : "（てっぺんは管理者だけ）"} → 50`, "ng", parent ? this.describe(p).ref : "rootdn");
        return done(50, "no write access to parent");
      }
    }
    if (this.entries.has(ndn)) {
      run.note(`${rdnOf(rec.dn)} は、もう名簿にいる → 68`, "ng");
      return done(68, "");
    }
    const err = this.store(rec.dn, rec.attrs, c.who.dn || "cn=anonymous", false);
    if (err) return done(err.code, err.text, err.matched ?? "");
    const e = this.entries.get(ndn)!;
    run.note(`${rdnOf(e.dn)} を名簿に足した`, "ok");
    if (this.isA(e, "groupOfNames")) {
      const members = this.vals(e, "member");
      if (overlay(this.cfg, "memberof")) {
        for (const m of members) if (this.addMemberOf(m, e.dn)) touched.push(m);
        if (touched.length) run.note(`memberof overlay：メンバー ${touched.map(rdnOf).join("・")} に memberOf: ${rdnOf(e.dn)} を書いた`, "ok", "memberof");
      }
    }
    if (uq) run.note(`unique overlay：${uq.attrs.join("・")} は、ほかのだれともかぶっていない`, "info", "unique");
    return done(0, "");
  }

  /** unique：rec の値が、範囲の中のほかのエントリとかぶるか */
  private uniqueClash(uq: Extract<OverlayConf, { kind: "unique" }>, ndn: string, attrs: { name: string; value: string }[]): { attr: string; value: string; by: string } | null {
    const base = normDn(this.cfg, uq.base) ?? "";
    if (base && !inScope(ndn, base, "sub")) return null;
    for (const { name, value } of attrs) {
      const def = attrDef(this.cfg, name);
      if (!def || !uq.attrs.some((a) => a.toLowerCase() === def.key)) continue;
      const nv = normValue(this.cfg, def, value);
      for (const e of this.entries.values()) {
        if (e.ndn === ndn || (base && !inScope(e.ndn, base, "sub"))) continue;
        if (this.vals(e, def.name).some((v) => normValue(this.cfg, def, v) === nv)) return { attr: def.name, value, by: e.dn };
      }
    }
    return null;
  }

  /** memberof：グループに入った人に memberOf を書く（書いたら true） */
  private addMemberOf(member: string, group: string): boolean {
    const m = normDn(this.cfg, member);
    const e = m ? this.entries.get(m) : undefined;
    if (!e || !attrDef(this.cfg, "memberOf")) return false;
    const a = e.attrs.get("memberof") ?? { name: "memberOf", vals: [] };
    const g = normDn(this.cfg, group);
    if (a.vals.some((v) => normDn(this.cfg, v) === g)) return false;
    a.vals.push(group);
    e.attrs.set("memberof", a);
    return true;
  }

  private delMemberOf(member: string, group: string): boolean {
    const m = normDn(this.cfg, member);
    const e = m ? this.entries.get(m) : undefined;
    const a = e?.attrs.get("memberof");
    if (!e || !a) return false;
    const g = normDn(this.cfg, group);
    const next = a.vals.filter((v) => normDn(this.cfg, v) !== g);
    if (next.length === a.vals.length) return false;
    if (next.length) a.vals = next;
    else e.attrs.delete("memberof");
    return true;
  }

  modify(c: Conn, rec: { dn: string; mods: LdifMod[] }, run: RunLog): { code: number; text: string; matched?: string } {
    const op = c.op++;
    const id = c.msg++;
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} MOD dn="${rec.dn.trim()}"`);
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} MOD attr=${rec.mods.map((m) => m.attr).join(" ")}`);
    this.packet(run, c, "c2s", `modifyRequest(${id}) "${rec.dn.trim()}"`, berSearchEntry(id, rec.dn.trim(), rec.mods.map((m) => [m.attr, m.values])));
    const touched: string[] = [];
    const done = (code: number, text: string, matched = "") => {
      this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} RESULT tag=103 err=${code} qtime=0.000010 etime=0.000${300 + Math.floor(this.rand() * 400)} text=${text}`);
      this.packet(run, c, "s2c", `modifyResponse(${id}) ${code ? resultText(code) : "success"}`, berResult(id, 0x67, code, matched, text));
      run.ops.push({ kind: "modify", code, dn: rec.dn.trim(), touched });
      return { code, text, matched };
    };
    if (c.external && /cn=config\s*$/i.test(rec.dn)) return this.configModify(rec, run, done);
    if (/cn=config\s*$/i.test(rec.dn)) {
      run.note("cn=config（サーバーの設定）は、LDAP サーバーの中から root で（-Y EXTERNAL -H ldapi:///）変える → 50", "ng");
      return done(50, "");
    }
    const blocked = this.restrict(c, run);
    if (blocked) return done(blocked.code, blocked.text);
    const ndn = normDn(this.cfg, rec.dn);
    if (ndn == null) return done(34, "invalid DN");
    const e = this.entries.get(ndn);
    if (!e) {
      run.note(`${rdnOf(rec.dn)} は名簿にいない → 32`, "ng");
      return done(32, "", this.matched(parentOf(ndn)));
    }
    // 書きかえたあとの形を作ってから、決まりに合うか確かめる
    const next = new Map<string, Attr>();
    for (const [k, a] of e.attrs) next.set(k, { name: a.name, vals: [...a.vals] });
    for (const m of rec.mods) {
      const def = attrDef(this.cfg, m.attr);
      if (!def) return done(17, `${m.attr}: attribute type undefined`);
      for (const [n, v] of m.values.entries()) if (normValue(this.cfg, def, v) == null) return done(21, `${def.name}: value #${n} invalid per syntax`);
      if (def.noMod || (def.op && !c.who.root)) {
        run.note(`${def.name} は${def.noMod ? "サーバー（overlay）が書く属性なので、人は書きかえられない" : "操作属性なので、管理者しか書きかえられない"}`, "ng");
        return done(def.noMod ? 19 : 50, def.noMod ? `${def.name}: no user modification allowed` : "");
      }
      if (!c.who.root) {
        const d = this.access(e, def.key, "write", c.who);
        if (!d.ok) {
          const why = this.describe(d);
          run.note(`${def.name} を書きかえていい？ → ${why.text} → 50`, "ng", why.ref);
          return done(50, "");
        }
      }
      const cur = next.get(def.key) ?? { name: def.name, vals: [] };
      const norm = (v: string) => normValue(this.cfg, def, v);
      if (m.op === "add") {
        for (const [n, v] of m.values.entries()) if (cur.vals.some((x) => norm(x) === norm(v))) return done(20, `modify/add: ${def.name}: value #${n} already exists`);
        cur.vals.push(...m.values);
      } else if (m.op === "delete") {
        if (!m.values.length) {
          if (!cur.vals.length) return done(16, `modify/delete: ${def.name}: no such attribute`);
          cur.vals = [];
        } else
          for (const v of m.values) {
            const at = cur.vals.findIndex((x) => norm(x) === norm(v));
            if (at < 0) return done(16, `modify/delete: ${def.name}: no such value`);
            cur.vals.splice(at, 1);
          }
      } else cur.vals = [...m.values];
      if (cur.vals.length) next.set(def.key, cur);
      else next.delete(def.key);
    }
    const sch = this.checkSchema(e.dn, next);
    if (sch) {
      run.note(`書きかえたあとの形が、オブジェクトクラスの決まりに合わない（${sch.text}）→ ${sch.code}`, "ng");
      return done(sch.code, sch.text);
    }
    const uq = overlay(this.cfg, "unique");
    if (uq) {
      const added = rec.mods.filter((m) => m.op !== "delete").flatMap((m) => m.values.map((value) => ({ name: m.attr, value })));
      const clash = this.uniqueClash(uq, ndn, added);
      if (clash) {
        run.note(`unique overlay：${clash.attr} ${clash.value} は、もう ${rdnOf(clash.by)} が使っている → 19`, "ok", "unique");
        return done(19, "some attributes not unique");
      }
    }
    const before = this.isA(e, "groupOfNames") ? this.vals(e, "member") : [];
    e.attrs = next;
    e.modified = this.clock;
    e.modifier = c.who.dn;
    if (rec.mods.some((m) => m.attr.toLowerCase() === "userpassword") && this.cfg.modules.has("ppolicy")) e.attrs.delete("pwdfailuretime");
    run.note(`${rdnOf(e.dn)} の ${[...new Set(rec.mods.map((m) => attrName(m.attr)))].join("・")} を書きかえた`, "ok");
    if (this.isA(e, "groupOfNames")) {
      const after = this.vals(e, "member");
      const n = (v: string) => normDn(this.cfg, v);
      const joined = after.filter((m) => !before.some((b) => n(b) === n(m)));
      const left = before.filter((b) => !after.some((m) => n(m) === n(b)));
      if (overlay(this.cfg, "memberof")) {
        for (const m of joined) if (this.addMemberOf(m, e.dn)) touched.push(m);
        for (const m of left) if (this.delMemberOf(m, e.dn)) touched.push(m);
        if (joined.length) run.note(`memberof overlay：グループに入った ${joined.map(rdnOf).join("・")} に、memberOf: ${rdnOf(e.dn)} を書いた`, "ok", "memberof");
        if (left.length) run.note(`memberof overlay：グループを出た ${left.map(rdnOf).join("・")} から、memberOf を消した`, "info", "memberof");
      } else if (joined.length || left.length) run.note("memberof overlay がない → グループの member だけが変わった（人のほうには何も書かない）", "info", "memberof");
    }
    return done(0, "");
  }

  delete(c: Conn, dn: string, run: RunLog): { code: number; text: string; matched?: string } {
    const op = c.op++;
    const id = c.msg++;
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} DEL dn="${dn.trim()}"`);
    this.packet(run, c, "c2s", `delRequest(${id}) "${dn.trim()}"`, berSearchEntry(id, dn.trim(), []));
    const touched: string[] = [];
    const done = (code: number, text: string, matched = "") => {
      this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} RESULT tag=107 err=${code} qtime=0.000010 etime=0.000${300 + Math.floor(this.rand() * 400)} text=${text}`);
      this.packet(run, c, "s2c", `delResponse(${id}) ${code ? resultText(code) : "success"}`, berResult(id, 0x6b, code, matched, text));
      run.ops.push({ kind: "delete", code, dn: dn.trim(), touched });
      return { code, text, matched };
    };
    if (c.external && /cn=config\s*$/i.test(dn)) return this.configDelete(dn, run, done);
    const blocked = this.restrict(c, run);
    if (blocked) return done(blocked.code, blocked.text);
    const ndn = normDn(this.cfg, dn);
    if (ndn == null) return done(34, "invalid DN");
    const e = this.entries.get(ndn);
    if (!e) {
      run.note(`${rdnOf(dn)} は名簿にいない → 32`, "ng");
      return done(32, "", this.matched(parentOf(ndn)));
    }
    if ((this.kids.get(ndn) ?? 0) > 0) {
      run.note(`${rdnOf(dn)} の下に、まだエントリがある → 先に下を消す（66）`, "ng");
      return done(66, "subordinate objects must be deleted first");
    }
    if (!c.who.root) {
      const parent = e.pndn ? this.entries.get(e.pndn) : undefined;
      const d = parent ? this.access(parent, "children", "write", c.who) : null;
      if (!d?.ok) {
        run.note(`消す権限は？ → ${d ? this.describe(d).text : "てっぺんは管理者だけ"} → 50`, "ng", d ? this.describe(d).ref : "rootdn");
        return done(50, "");
      }
    }
    this.entries.delete(ndn);
    if (e.pndn) this.kids.set(e.pndn, Math.max(0, (this.kids.get(e.pndn) ?? 1) - 1));
    run.note(`${rdnOf(e.dn)} を名簿から消した`, "ok");
    // グループを消したら、メンバーの memberOf も消す（memberof overlay）
    if (this.isA(e, "groupOfNames") && overlay(this.cfg, "memberof")) for (const m of this.vals(e, "member")) if (this.delMemberOf(m, e.dn)) touched.push(m);
    // 消した人を指している member（refint）
    const refs = [...this.entries.values()].filter((x) => this.vals(x, "member").some((v) => normDn(this.cfg, v) === ndn));
    const ri = overlay(this.cfg, "refint");
    if (refs.length && ri && ri.attrs.some((a) => a.toLowerCase() === "member")) {
      for (const g of refs) {
        const a = g.attrs.get("member")!;
        a.vals = a.vals.filter((v) => normDn(this.cfg, v) !== ndn);
        if (!a.vals.length) a.vals = [ri.nothing ?? this.cfg.rootDN];
        g.modified = this.clock;
        g.modifier = this.cfg.rootDN;
        touched.push(g.dn);
        this.log(run, "ldap", "slapd", `conn=-1 op=0 MOD dn="${g.dn}"`);
        this.log(run, "ldap", "slapd", `conn=-1 op=0 MOD attr=member`);
      }
      run.note(`refint overlay：${refs.map((g) => rdnOf(g.dn)).join("・")} の member からも ${rdnOf(e.dn)} を消した`, "ok", "refint");
    } else if (refs.length) run.note(`refint overlay がない → ${refs.map((g) => rdnOf(g.dn)).join("・")} の member に、消した ${rdnOf(e.dn)} が残ったまま`, "ng", "refint");
    return done(0, "");
  }

  /** パスワードを変える（ldappasswd：Password Modify 拡張操作） */
  passwd(c: Conn, req: { user: string | null; newPw: string | null }, run: RunLog): { code: number; text: string; generated?: string } {
    const op = c.op++;
    const id = c.msg++;
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} EXT oid=1.3.6.1.4.1.4203.1.11.1`);
    this.packet(run, c, "c2s", `extendedReq(${id}) passwdModifyOID`, berExtRequest(id, "1.3.6.1.4.1.4203.1.11.1", req.newPw ? new TextEncoder().encode(req.newPw) : undefined), null, req.newPw);
    const done = (code: number, text: string, generated?: string) => {
      this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} RESULT oid= err=${code} qtime=0.000010 etime=0.000${500 + Math.floor(this.rand() * 400)} text=${text}`);
      this.packet(run, c, "s2c", `extendedResp(${id}) ${code ? resultText(code) : "success"}`, berExtResponse(id, code, text));
      run.ops.push({ kind: "passwd", code, dn: req.user ?? c.who.dn });
      return { code, text, generated };
    };
    const blocked = this.restrict(c, run);
    if (blocked) return done(blocked.code, blocked.text);
    const target = req.user ?? c.who.dn;
    if (!target) {
      run.note("ログインしていない人は、パスワードを変えられない（53）", "ng");
      return done(53, "only authenticated users may change passwords");
    }
    const ndn = normDn(this.cfg, target);
    const e = ndn ? this.entries.get(ndn) : undefined;
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} PASSMOD id="${target}" ${req.newPw ? "new" : ""}`.trim());
    if (!e) return done(32, "");
    if (!c.who.root) {
      const d = this.access(e, "userpassword", "write", c.who);
      if (!d.ok) {
        const why = this.describe(d);
        run.note(`userPassword を書きかえていい？ → ${why.text} → 50`, "ng", why.ref);
        return done(50, "");
      }
      const why = this.describe(d);
      run.note(`userPassword を書きかえていい？ → ${why.text} → OK`, "ok", why.ref);
    }
    const pw = req.newPw ?? Array.from(randomBytes(this.rand, 6), (b) => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 56]).join("");
    e.attrs.set("userpassword", { name: "userPassword", vals: [this.hash(pw)] });
    e.modified = this.clock;
    e.modifier = c.who.dn;
    if (this.cfg.modules.has("ppolicy")) {
      e.attrs.delete("pwdfailuretime");
      e.attrs.delete("pwdaccountlockedtime");
    }
    run.note(`${rdnOf(e.dn)} のパスワードを、{SSHA} のハッシュにして書きかえた`, "ok");
    return done(0, "", req.newPw ? undefined : pw);
  }

  whoami(c: Conn, run: RunLog): { code: number; text: string; authz: string } {
    const op = c.op++;
    const id = c.msg++;
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} EXT oid=1.3.6.1.4.1.4203.1.11.3`);
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} WHOAMI`);
    this.packet(run, c, "c2s", `extendedReq(${id}) whoamiOID`, berExtRequest(id, "1.3.6.1.4.1.4203.1.11.3"));
    const blocked = this.restrict(c, run);
    const code = blocked?.code ?? 0;
    const text = blocked?.text ?? "";
    const authz = c.who.dn ? `dn:${c.who.dn}` : "";
    this.log(run, "ldap", "slapd", `conn=${c.id} op=${op} RESULT oid= err=${code} qtime=0.000008 etime=0.000060 text=${text}`);
    this.packet(run, c, "s2c", `extendedResp(${id}) ${code ? resultText(code) : "success"}`, berExtResponse(id, code, text, code ? undefined : authz));
    run.ops.push({ kind: "whoami", code, as: c.who.ndn });
    return { code, text, authz };
  }

  /* ---------- 設定（cn=config） ---------- */

  /** いまの設定を、cn=config の LDIF の形で（ldapsearch -b cn=config・設定の地図で見せる） */
  configEntries(): { dn: string; attrs: [string, string[]][] }[] {
    const cfg = this.cfg;
    const out: { dn: string; attrs: [string, string[]][] }[] = [];
    const global: [string, string[]][] = [
      ["objectClass", ["olcGlobal"]],
      ["cn", ["config"]],
      ["olcArgsFile", ["/run/openldap/slapd.args"]],
      ["olcPidFile", ["/run/openldap/slapd.pid"]],
      ["olcLogLevel", ["stats"]],
    ];
    if (cfg.disallowAnon) global.push(["olcDisallows", ["bind_anon"]]);
    if (cfg.securityTls) global.push(["olcSecurity", [`tls=${cfg.securityTls}`]]);
    if (cfg.tlsCA) global.push(["olcTLSCACertificateFile", ["/etc/openldap/certs/wanko-ca.crt"]]);
    if (cfg.tlsCert) global.push(["olcTLSCertificateFile", ["/etc/openldap/certs/ldap.wanko.shop.crt"]]);
    if (cfg.tlsKey) global.push(["olcTLSCertificateKeyFile", ["/etc/openldap/certs/ldap.wanko.shop.key"]]);
    out.push({ dn: "cn=config", attrs: global });
    if (cfg.modules.size)
      out.push({
        dn: "cn=module{0},cn=config",
        attrs: [
          ["objectClass", ["olcModuleList"]],
          ["cn", ["module{0}"]],
          ["olcModulePath", ["/usr/lib64/openldap"]],
          ["olcModuleLoad", [...cfg.modules].map((m, i) => `{${i}}${m}`)],
        ],
      });
    out.push({ dn: "cn=schema,cn=config", attrs: [["objectClass", ["olcSchemaConfig"]], ["cn", ["schema"]]] });
    [...cfg.schemas].forEach((s, i) => out.push({ dn: `cn={${i}}${s},cn=schema,cn=config`, attrs: [["objectClass", ["olcSchemaConfig"]], ["cn", [`{${i}}${s}`]]] }));
    const front: [string, string[]][] = [
      ["objectClass", ["olcDatabaseConfig", "olcFrontendConfig"]],
      ["olcDatabase", ["{-1}frontend"]],
    ];
    if (cfg.requireAuthc) front.push(["olcRequires", ["authc"]]);
    if (cfg.sizeLimitSet) front.push(["olcSizeLimit", [cfg.sizeLimit == null ? "unlimited" : String(cfg.sizeLimit)]]);
    out.push({ dn: "olcDatabase={-1}frontend,cn=config", attrs: front });
    out.push({
      dn: "olcDatabase={0}config,cn=config",
      attrs: [
        ["objectClass", ["olcDatabaseConfig"]],
        ["olcDatabase", ["{0}config"]],
        ["olcAccess", ["{0}to * by dn.exact=gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth manage by * none"]],
      ],
    });
    const db: [string, string[]][] = [
      ["objectClass", ["olcDatabaseConfig", "olcMdbConfig"]],
      ["olcDatabase", ["{1}mdb"]],
      ["olcDbDirectory", ["/var/lib/ldap"]],
      ["olcSuffix", [cfg.suffix]],
      ["olcRootDN", [cfg.rootDN]],
    ];
    if (cfg.rootPW) db.push(["olcRootPW", [cfg.rootPW]]);
    db.push(["olcDbIndex", indexLines(cfg)]);
    db.push(["olcDbMaxSize", ["1073741824"]]);
    if (cfg.acl.length) db.push(["olcAccess", cfg.acl.map((a, i) => `{${i}}${a.text}`)]);
    out.push({ dn: "olcDatabase={1}mdb,cn=config", attrs: db });
    cfg.overlays.forEach((o, i) => {
      const dn = `olcOverlay={${i}}${o.kind},olcDatabase={1}mdb,cn=config`;
      if (o.kind === "memberof")
        out.push({
          dn,
          attrs: [
            ["objectClass", ["olcOverlayConfig", "olcMemberOf"]],
            ["olcOverlay", [`{${i}}memberof`]],
            ["olcMemberOfGroupOC", ["groupOfNames"]],
            ["olcMemberOfMemberAD", ["member"]],
            ["olcMemberOfMemberOfAD", ["memberOf"]],
          ],
        });
      else if (o.kind === "refint")
        out.push({
          dn,
          attrs: [
            ["objectClass", ["olcOverlayConfig", "olcRefintConfig"]],
            ["olcOverlay", [`{${i}}refint`]],
            ["olcRefintAttribute", o.attrs],
            ...(o.nothing ? ([["olcRefintNothing", [o.nothing]]] as [string, string[]][]) : []),
          ],
        });
      else if (o.kind === "unique")
        out.push({
          dn,
          attrs: [
            ["objectClass", ["olcOverlayConfig", "olcUniqueConfig"]],
            ["olcOverlay", [`{${i}}unique`]],
            ["olcUniqueURI", [o.uri]],
          ],
        });
      else
        out.push({
          dn,
          attrs: [
            ["objectClass", ["olcOverlayConfig", "olcPPolicyConfig"]],
            ["olcOverlay", [`{${i}}ppolicy`]],
            ["olcPPolicyDefault", [o.def]],
          ],
        });
    });
    return out;
  }

  private searchConfig(
    c: Conn,
    req: { base: string; scope: Scope; filter: Filter; attrs: string[] },
    run: RunLog,
    hits: SearchHit[],
    finish: (code: number, text: string, matched?: string) => { code: number; text: string; matched?: string; hits: SearchHit[]; scanned: number },
  ) {
    if (!c.external) {
      run.note("cn=config（サーバーの設定）は、LDAP サーバーの中の root しか見られない（-Y EXTERNAL -H ldapi:///）", "ng");
      return finish(32, "");
    }
    const base = req.base.trim().toLowerCase().replace(/,\s+/g, ",");
    const all = this.configEntries();
    const baseEntry = all.find((e) => e.dn.toLowerCase() === base);
    if (!baseEntry) return finish(32, "", "cn=config");
    for (const e of all) {
      const dn = e.dn.toLowerCase();
      const rel = dn === base ? "base" : dn.endsWith(`,${base}`) ? (dn.slice(0, -base.length - 1).includes(",") ? "deep" : "one") : null;
      if (!rel || (req.scope === "base" && rel !== "base") || (req.scope === "one" && rel !== "one") || (req.scope === "children" && rel === "base")) continue;
      if (!configMatch(e.attrs, req.filter)) continue;
      const want = req.attrs.map((a) => a.toLowerCase());
      const attrs = !want.length || want.includes("*") ? e.attrs : e.attrs.filter(([n]) => want.includes(n.toLowerCase()));
      hits.push({ dn: e.dn, ndn: dn, attrs });
    }
    run.note("cn=config（いま動いている設定）を、名簿と同じ形で読んだ", "info");
    return finish(0, "");
  }

  /** ldapmodify -Y EXTERNAL で cn=config を書きかえる（すぐに効く） */
  private configModify(rec: { dn: string; mods: LdifMod[] }, run: RunLog, done: (code: number, text: string, matched?: string) => { code: number; text: string; matched?: string }) {
    const dn = rec.dn.trim().toLowerCase().replace(/,\s+/g, ",");
    const cfg = this.cfg;
    const next: ServerConfig = { ...cfg, schemas: new Set(cfg.schemas), modules: new Set(cfg.modules), acl: [...cfg.acl], index: new Map([...cfg.index].map(([k, v]) => [k, new Set(v)])), overlays: [...cfg.overlays] };
    const handler = (name: string) => done(80, `<${name}> handler exited with 1`);
    for (const m of rec.mods) {
      const attr = m.attr.toLowerCase();
      const one = m.values[0] ?? "";
      if (dn === "cn=config") {
        if (attr === "olcdisallows") {
          if (m.values.some((v) => !["bind_anon", "bind_simple", "tls_2_anon", "tls_authc"].includes(v.trim().toLowerCase()))) return handler("olcDisallows");
          next.disallowAnon = m.op === "delete" ? false : m.values.some((v) => v.trim().toLowerCase() === "bind_anon");
          run.note(next.disallowAnon ? "olcDisallows: bind_anon を書いた → 匿名のバインドを断るようになった" : "olcDisallows を消した → 匿名でもバインドできる", "info", "anon:disallow");
        } else if (attr === "olcsecurity") {
          if (m.op === "delete") next.securityTls = 0;
          else {
            const mm = /^tls=(\d+)$/i.exec(one.trim());
            if (!mm) return handler("olcSecurity");
            next.securityTls = Number(mm[1]);
          }
          run.note(next.securityTls ? `olcSecurity: tls=${next.securityTls} を書いた → 暗号にしていないつながりを断るようになった` : "olcSecurity を消した → 暗号にしなくても話せる", "info", "tls:security");
        } else if (attr === "olctlscertificatefile" || attr === "olctlscertificatekeyfile" || attr === "olctlscacertificatefile") {
          const on = m.op !== "delete";
          if (attr === "olctlscertificatefile") next.tlsCert = on;
          else if (attr === "olctlscertificatekeyfile") next.tlsKey = on;
          else next.tlsCA = on;
        } else if (attr === "olcloglevel" || attr === "olcidletimeout") continue;
        else return done(17, `${m.attr}: attribute type undefined`);
      } else if (dn === "olcdatabase={-1}frontend,cn=config") {
        if (attr === "olcrequires") {
          if (m.values.some((v) => !["authc", "bind", "sasl", "strong", "none"].includes(v.trim().toLowerCase()))) return handler("olcRequires");
          next.requireAuthc = m.op === "delete" ? false : m.values.some((v) => v.trim().toLowerCase() === "authc");
          run.note(next.requireAuthc ? "olcRequires: authc を書いた → ログインしていない人のお願いを断るようになった" : "olcRequires を消した", "info", "anon:require");
        } else if (attr === "olcsizelimit") {
          const r = sizeLimitOf(m.op === "delete" ? null : one);
          if (r === undefined) return handler("olcSizeLimit");
          next.sizeLimit = r;
          next.sizeLimitSet = m.op !== "delete";
          run.note(`olcSizeLimit を ${m.op === "delete" ? "消した（500件にもどる）" : `${one} にした`}`, "info", "sizelimit");
        } else return done(53, "");
      } else if (dn === "olcdatabase={1}mdb,cn=config") {
        if (attr === "olcrootpw") {
          next.rootPW = m.op === "delete" ? null : one.trim() || null;
          run.note(next.rootPW ? "olcRootPW を書いた → 管理者（olcRootDN）がログインできるようになった" : "olcRootPW を消した → だれも管理者としてログインできない", next.rootPW ? "ok" : "warn", "rootpw");
        } else if (attr === "olcrootdn") {
          const v = normDn(cfg, one);
          if (!v || !inScope(v, normDn(cfg, cfg.suffix)!, "sub")) return done(80, "<olcRootDN> can only be set when rootdn is under suffix");
          next.rootDN = prettyDn(one)!;
        } else if (attr === "olcaccess") {
          const parsed: { text: string; rule: AclRule; at: number | null }[] = [];
          for (const v of m.values) {
            const at = /^\s*\{(\d+)\}/.exec(v);
            const r = parseAcl(next, v);
            if (typeof r === "string") {
              run.note(`olcAccess の書き方がまちがっている：${r}`, "ng", "acl");
              return handler("olcAccess");
            }
            parsed.push({ text: r.text, rule: r, at: at ? Number(at[1]) : null });
          }
          if (m.op === "replace") next.acl = parsed.map(({ text, rule }) => ({ text, rule }));
          else if (m.op === "add")
            for (const p of parsed) {
              const at = p.at == null ? next.acl.length : Math.min(p.at, next.acl.length);
              next.acl.splice(at, 0, { text: p.text, rule: p.rule });
            }
          else if (!m.values.length) next.acl = [];
          else
            for (const v of m.values) {
              const at = /^\s*\{(\d+)\}\s*$/.exec(v);
              const idx = at ? Number(at[1]) : next.acl.findIndex((a) => a.text === v.replace(/^\s*\{\d+\}/, "").trim().replace(/\s+/g, " "));
              if (idx < 0 || idx >= next.acl.length) return done(16, "modify/delete: olcAccess: no such value");
              next.acl.splice(idx, 1);
            }
          run.note(next.acl.length ? `olcAccess を書きかえた（${next.acl.length}行）→ つぎのお願いから、すぐに効く` : "olcAccess を全部消した → OpenLDAP の決まり「だれでも読める」にもどる", "info", "acl");
        } else if (attr === "olcdbindex") {
          if (m.op === "replace" || (m.op === "delete" && !m.values.length)) next.index = new Map();
          for (const v of m.values) {
            const r = parseIndex(next, v);
            if (!r) return handler("olcDbIndex");
            for (const a of r.attrs) {
              if (m.op === "delete") next.index.delete(a);
              else next.index.set(a, new Set(r.kinds));
            }
          }
          if (!next.index.has("objectclass")) next.index.set("objectclass", new Set(["eq"]));
          run.note(`olcDbIndex を書きかえた（${indexLines(next).join("／")}）→ インデックスを作りなおした（cn=config なら、自動で作りなおす）`, "info", "index");
        } else if (attr === "olcsizelimit") {
          const r = sizeLimitOf(m.op === "delete" ? null : one);
          if (r === undefined) return handler("olcSizeLimit");
          next.sizeLimit = r;
          next.sizeLimitSet = m.op !== "delete";
        } else if (attr === "olcsuffix") return done(53, "");
        else return done(17, `${m.attr}: attribute type undefined`);
      } else if (dn === "cn=module{0},cn=config") {
        if (attr !== "olcmoduleload") return done(17, `${m.attr}: attribute type undefined`);
        for (const v of m.values) {
          const name = v.trim().replace(/^\{\d+\}/, "").replace(/\.la$/, "").toLowerCase() as ModuleId;
          if (!MODULES.includes(name)) return handler("olcModuleLoad");
          if (m.op === "delete") {
            if (next.overlays.some((o) => o.kind === name)) return done(53, "");
            next.modules.delete(name);
          } else {
            if (next.modules.has(name)) return done(20, `modify/add: olcModuleLoad: value #0 already exists`);
            next.modules.add(name);
            run.note(`モジュール ${name} を読みこんだ`, "info", name);
          }
        }
      } else {
        run.note(`${rec.dn} は、この部屋では書きかえられない設定です`, "ng");
        return done(32, "", "cn=config");
      }
    }
    this.cfg = next;
    return done(0, "");
  }

  /** cn=config に足す（スキーマ・overlay） */
  private configAdd(rec: { dn: string; attrs: { name: string; value: string }[] }, run: RunLog, done: (code: number, text: string, matched?: string) => { code: number; text: string; matched?: string }) {
    const dn = rec.dn.trim().toLowerCase().replace(/,\s+/g, ",");
    const get = (n: string) => rec.attrs.filter((a) => a.name.toLowerCase() === n.toLowerCase()).map((a) => a.value.trim());
    const schema = /^cn=(?:\{\d+\})?([a-z]+),cn=schema,cn=config$/.exec(dn);
    if (schema) {
      const name = schema[1] as SchemaId;
      if (this.cfg.schemas.has(name)) {
        run.note(`${name} スキーマは、もう読みこんである`, "warn", `schema:${name}`);
        return done(80, name === "nis" ? 'olcAttributeTypes: Duplicate attributeType: "1.3.6.1.1.1.1.2"' : "olcAttributeTypes: Duplicate attributeType");
      }
      if (name !== "nis") return done(80, "olcObjectClasses: Unknown schema");
      this.cfg = { ...this.cfg, schemas: new Set([...this.cfg.schemas, "nis" as SchemaId]) };
      run.note("nis スキーマを読みこんだ → posixAccount・uidNumber・homeDirectory などが使えるようになった", "ok", "schema:nis");
      return done(0, "");
    }
    const ov = /^olcoverlay=(?:\{\d+\})?([a-z]+),olcdatabase=\{1\}mdb,cn=config$/.exec(dn);
    if (!ov) {
      run.note(`${rec.dn} は、この部屋では足せない設定です`, "ng");
      return done(53, "");
    }
    const kind = ov[1] as ModuleId;
    if (!MODULES.includes(kind)) return done(80, `<olcOverlay> handler exited with 1`);
    const ocs = get("objectClass");
    const extra = ocs.findIndex((o) => o.toLowerCase() !== "olcoverlayconfig");
    if (!this.cfg.modules.has(kind)) {
      run.note(`モジュール ${kind} を読みこんでいない（olcModuleLoad）→ ${ocs[extra] ?? kind} を知らない → 21`, "ng", kind);
      return done(21, `objectClass: value #${Math.max(1, extra)} invalid per syntax`);
    }
    if (this.cfg.overlays.some((o) => o.kind === kind)) {
      run.note(`${kind} overlay は、もう入っている`, "warn", kind);
      return done(80, "<olcOverlay> handler exited with 1");
    }
    let conf: OverlayConf;
    if (kind === "memberof") conf = { kind };
    else if (kind === "refint") {
      const attrs = get("olcRefintAttribute").flatMap((v) => v.split(/[\s,]+/)).filter(Boolean);
      if (!attrs.length || attrs.some((a) => !attrDef(this.cfg, a))) return done(80, "<olcRefintAttribute> handler exited with 1");
      conf = { kind, attrs, nothing: get("olcRefintNothing")[0] ?? null };
    } else if (kind === "unique") {
      const uri = get("olcUniqueURI")[0] ?? "";
      const m = /^ldap:\/\/\/([^?]*)\?([^?]+)\?sub$/i.exec(uri);
      if (!m || m[2]!.split(",").some((a) => !attrDef(this.cfg, a))) return done(80, "<olcUniqueURI> handler exited with 1");
      conf = { kind, uri, base: m[1]!, attrs: m[2]!.split(",").map((a) => attrDef(this.cfg, a)!.name) };
    } else {
      const def = get("olcPPolicyDefault")[0] ?? "";
      if (!normDn(this.cfg, def)) return done(80, "<olcPPolicyDefault> handler exited with 1");
      conf = { kind, def };
    }
    this.cfg = { ...this.cfg, overlays: [...this.cfg.overlays, conf] };
    const ja: Record<ModuleId, string> = {
      memberof: "これから、グループが変わると memberOf を書く",
      refint: "これから、エントリを消すと、ほかのエントリの member からも消す",
      unique: "これから、決めた属性の値がかぶるのを止める",
      ppolicy: "これから、パスワードのルール（olcPPolicyDefault のエントリ）を使う",
    };
    run.note(`${kind} overlay を入れた → ${ja[kind]}`, "ok", kind);
    return done(0, "");
  }

  private configDelete(dn: string, run: RunLog, done: (code: number, text: string, matched?: string) => { code: number; text: string; matched?: string }) {
    const n = dn.trim().toLowerCase().replace(/,\s+/g, ",");
    const ov = /^olcoverlay=(?:\{\d+\})?([a-z]+),olcdatabase=\{1\}mdb,cn=config$/.exec(n);
    if (!ov) {
      run.note("この設定は消せない（スキーマは一度読みこむと消せない）", "ng");
      return done(53, "");
    }
    const kind = ov[1] as ModuleId;
    if (!this.cfg.overlays.some((o) => o.kind === kind)) return done(32, "", "olcDatabase={1}mdb,cn=config");
    this.cfg = { ...this.cfg, overlays: this.cfg.overlays.filter((o) => o.kind !== kind) };
    run.note(`${kind} overlay を外した`, "info", kind);
    return done(0, "");
  }

  /* ---------- 画面のための形 ---------- */

  /** 名簿の木（たくさん子がいる たな は、まとめて1つにする） */
  tree(): TreeNode[] {
    const children = new Map<string, Entry[]>();
    const roots: Entry[] = [];
    for (const e of this.entries.values()) {
      if (e.pndn && this.entries.has(e.pndn)) {
        const list = children.get(e.pndn) ?? [];
        list.push(e);
        children.set(e.pndn, list);
      } else roots.push(e);
    }
    const out: TreeNode[] = [];
    const walk = (e: Entry, depth: number) => {
      out.push(this.node(e, depth));
      const kids = children.get(e.ndn) ?? [];
      if (kids.length > 40) {
        out.push({ ndn: `${e.ndn}#bulk`, dn: e.dn, rdn: `${kids.length.toLocaleString("en-US")}件`, depth: depth + 1, kind: "bulk", label: "", count: kids.length });
        return;
      }
      for (const k of kids) walk(k, depth + 1);
    };
    for (const r of roots) walk(r, 0);
    return out;
  }

  private node(e: Entry, depth: number): TreeNode {
    const kind: TreeNode["kind"] = this.isA(e, "groupOfNames")
      ? "group"
      : this.isA(e, "person")
        ? "person"
        : this.isA(e, "organizationalUnit")
          ? "ou"
          : this.isA(e, "organization") || this.isA(e, "dcObject")
            ? "root"
            : this.isA(e, "pwdPolicy") || this.isA(e, "device")
              ? "policy"
              : "app";
    const n: TreeNode = { ndn: e.ndn, dn: e.dn, rdn: rdnOf(e.dn), depth, kind, label: this.first(e, kind === "ou" ? "description" : kind === "root" ? "o" : "cn") };
    if (kind === "group") n.members = this.vals(e, "member").map((m) => normDn(this.cfg, m) ?? m);
    if (kind === "person") {
      n.title = this.first(e, "title");
      n.uidNumber = this.first(e, "uidNumber");
      const mo = this.vals(e, "memberOf");
      if (mo.length) n.memberOf = mo.map(rdnOf);
      n.fails = this.vals(e, "pwdFailureTime").length;
      const lockedAt = this.first(e, "pwdAccountLockedTime");
      const pol = this.policyFor(e);
      n.locked = Boolean(lockedAt && pol && pol.lockout && (pol.duration <= 0 || this.clock < parseGenTime(lockedAt) + pol.duration * 1000));
    }
    return n;
  }
}

export type TreeNode = {
  ndn: string;
  dn: string;
  rdn: string;
  depth: number;
  kind: "root" | "ou" | "person" | "group" | "app" | "policy" | "bulk";
  label: string;
  title?: string;
  count?: number;
  members?: string[];
  memberOf?: string[];
  uidNumber?: string;
  fails?: number;
  locked?: boolean;
};

/** olcDbIndex の行（属性ごと。objectClass eq がいちばん上） */
export function indexLines(cfg: ServerConfig): string[] {
  const groups = new Map<string, string[]>();
  for (const [attr, kinds] of cfg.index) {
    const key = [...kinds].sort((a, b) => ["eq", "pres", "sub", "approx"].indexOf(a) - ["eq", "pres", "sub", "approx"].indexOf(b)).join(",");
    const list = groups.get(key) ?? [];
    list.push(attrName(attr));
    groups.set(key, list);
  }
  return [...groups].map(([k, attrs]) => `${attrs.join(",")} ${k}`).sort((a, b) => (a.startsWith("objectClass ") ? -1 : b.startsWith("objectClass ") ? 1 : 0));
}

function parseIndex(cfg: ServerConfig, v: string): { attrs: string[]; kinds: IndexKind[] } | null {
  const m = /^\s*([A-Za-z0-9,;-]+)\s*([a-z,]*)\s*$/.exec(v);
  if (!m) return null;
  const attrs: string[] = [];
  for (const a of m[1]!.split(",")) {
    const d = attrDef(cfg, a);
    if (!d) return null;
    attrs.push(d.key);
  }
  const kinds = (m[2] || "eq").split(",").filter(Boolean);
  if (kinds.some((k) => !["eq", "sub", "pres", "approx"].includes(k))) return null;
  return { attrs, kinds: kinds as IndexKind[] };
}

/** olcSizeLimit の値（null は unlimited、undefined はまちがい） */
function sizeLimitOf(v: string | null): number | null | undefined {
  if (v == null) return 500;
  const t = v.trim().toLowerCase();
  if (t === "unlimited" || t === "-1") return null;
  return /^\d+$/.test(t) ? Number(t) : undefined;
}

/** cn=config のエントリ（ただの文字の組）がフィルタに合うか */
function configMatch(attrs: [string, string[]][], f: Filter): boolean {
  if (f.t === "and") return f.list.every((x) => configMatch(attrs, x));
  if (f.t === "or") return f.list.some((x) => configMatch(attrs, x));
  if (f.t === "not") return !configMatch(attrs, f.f);
  const vals = attrs.find(([n]) => n.toLowerCase() === f.attr.toLowerCase())?.[1] ?? [];
  if (f.t === "present") return vals.length > 0;
  if (f.t === "eq" || f.t === "approx") return vals.some((v) => v.toLowerCase() === f.value.toLowerCase() || v.replace(/^\{-?\d+\}/, "").toLowerCase() === f.value.replace(/^\{-?\d+\}/, "").toLowerCase());
  if (f.t === "sub") return vals.some((v) => v.toLowerCase().includes((f.initial ?? f.any[0] ?? f.final ?? "").toLowerCase()));
  return false;
}

/* ------------------------------------------------------------ LDIF */

export type LdifMod = { op: "add" | "delete" | "replace"; attr: string; values: string[] };
export type LdifRecord =
  | { change: "add"; dn: string; attrs: { name: string; value: string }[]; line: number }
  | { change: "modify"; dn: string; mods: LdifMod[]; line: number }
  | { change: "delete"; dn: string; line: number };

/** LDIF を読む。addDefault … changetype がないレコードを add とする（ldapadd・ldapmodify -a） */
export function parseLdif(text: string, addDefault: boolean): { records: LdifRecord[]; error: { line: number; dn: string; text: string } | null } {
  // 続きの行（1文字目が空白）をつなげる
  const raw = text.replace(/\r\n?/g, "\n").split("\n");
  const lines: { text: string; no: number }[] = [];
  raw.forEach((l, i) => {
    if (l.startsWith(" ") && lines.length && lines[lines.length - 1]!.text !== "") lines[lines.length - 1]!.text += l.slice(1);
    else lines.push({ text: l, no: i + 1 });
  });
  const records: LdifRecord[] = [];
  let block: { text: string; no: number }[] = [];
  const blocks: { text: string; no: number }[][] = [];
  for (const l of lines) {
    if (l.text.startsWith("#")) continue;
    if (l.text.trim() === "") {
      if (block.length) blocks.push(block);
      block = [];
    } else block.push(l);
  }
  if (block.length) blocks.push(block);
  const pair = (l: { text: string; no: number }): { name: string; value: string } | null => {
    const m = /^([A-Za-z0-9;.-]+)(::?)\s*(.*)$/.exec(l.text);
    if (!m) return null;
    if (m[2] === "::") {
      try {
        const bin = atob(m[3]!.trim());
        return { name: m[1]!, value: new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))) };
      } catch {
        return null;
      }
    }
    return { name: m[1]!, value: m[3]!.replace(/\s+$/, "") };
  };
  for (const [bi, b] of blocks.entries()) {
    if (bi === 0 && b.length === 1 && /^version:\s*1$/i.test(b[0]!.text)) continue;
    let k = 0;
    if (/^version:/i.test(b[0]!.text)) k++;
    const first = b[k] ? pair(b[k]!) : null;
    if (!first || first.name.toLowerCase() !== "dn") return { records, error: { line: b[k]?.no ?? b[0]!.no, dn: "", text: "dn がない" } };
    const dn = first.value;
    const at = b[k]!.no;
    k++;
    let change: "add" | "modify" | "delete" | null = null;
    const ct = b[k] ? pair(b[k]!) : null;
    if (ct && ct.name.toLowerCase() === "changetype") {
      const v = ct.value.toLowerCase();
      if (v !== "add" && v !== "modify" && v !== "delete") return { records, error: { line: b[k]!.no, dn, text: `changetype: ${ct.value} は使えない` } };
      change = v;
      k++;
    } else if (addDefault) change = "add";
    if (!change) return { records, error: { line: b[k]?.no ?? at, dn, text: "modify operation type is missing" } };
    if (change === "delete") {
      records.push({ change, dn, line: at });
      continue;
    }
    if (change === "add") {
      const attrs: { name: string; value: string }[] = [];
      for (; k < b.length; k++) {
        const p = pair(b[k]!);
        if (!p) return { records, error: { line: b[k]!.no, dn, text: "invalid format" } };
        attrs.push(p);
      }
      records.push({ change, dn, attrs, line: at });
      continue;
    }
    const mods: LdifMod[] = [];
    while (k < b.length) {
      const head = pair(b[k]!);
      if (!head || !["add", "delete", "replace"].includes(head.name.toLowerCase())) return { records, error: { line: b[k]!.no, dn, text: "invalid format" } };
      const mod: LdifMod = { op: head.name.toLowerCase() as LdifMod["op"], attr: head.value.trim(), values: [] };
      k++;
      for (; k < b.length && b[k]!.text !== "-"; k++) {
        const p = pair(b[k]!);
        if (!p || p.name.toLowerCase() !== mod.attr.toLowerCase()) return { records, error: { line: b[k]!.no, dn, text: "invalid format" } };
        mod.values.push(p.value);
      }
      if (b[k]?.text === "-") k++;
      mods.push(mod);
    }
    records.push({ change, dn, mods, line: at });
  }
  return { records, error: null };
}
