/**
 * 勉強部屋（LDAP）の小さな道具：種つきの乱数・UTF-8・base64・SHA-1（{SSHA}）・LDAP のバイト列（BER）・16進ダンプ。
 * React にも DOM にも依存しない（node でも動く。scripts/fuzz-infra.mjs で確かめる）。
 */

/** 種つきの乱数（同じ種なら、同じ並び） */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 文字から種を作る（カードごとに同じ種になるように） */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function randomBytes(rand: () => number, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor(rand() * 256);
  return out;
}

const enc = new TextEncoder();
export const utf8 = (s: string): Uint8Array => enc.encode(s);
/** UTF-8 として読めなければ null */
export function fromUtf8(b: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return null;
  }
}

export function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/* ------------------------------------------------------------ base64 */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function b64encode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2]!;
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    out += b == null ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    out += c == null ? "=" : B64[c & 63]!;
  }
  return out;
}

/** base64 として正しくなければ null */
export function b64decode(text: string): Uint8Array | null {
  const s = text.replace(/\s+/g, "");
  if (s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null;
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3);
  let at = 0;
  for (let i = 0; i < s.length; i += 4) {
    let v = 0;
    for (let k = 0; k < 4; k++) {
      const ch = s[i + k]!;
      v = (v << 6) | (ch === "=" ? 0 : B64.indexOf(ch));
    }
    out[at++] = (v >> 16) & 255;
    out[at++] = (v >> 8) & 255;
    out[at++] = v & 255;
  }
  return out.slice(0, out.length - pad);
}

/** base64 の文字を、UTF-8 の文字にもどす（もどせなければ null） */
export function b64text(text: string): string | null {
  const b = b64decode(text);
  return b ? fromUtf8(b) : null;
}

/* ------------------------------------------------------------ SHA-1 と {SSHA} */

export function sha1(msg: Uint8Array): Uint8Array {
  const total = Math.ceil((msg.length + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[msg.length] = 0x80;
  const view = new DataView(buf.buffer);
  const bits = msg.length * 8;
  view.setUint32(total - 8, Math.floor(bits / 0x100000000));
  view.setUint32(total - 4, bits >>> 0);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!;
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]!) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
  return out;
}

/** {SSHA}：パスワードに塩（salt）をまぜた SHA-1。塩はハッシュのうしろにつける（OpenLDAP と同じ形） */
export function ssha(password: string, salt: Uint8Array): string {
  const pw = utf8(password);
  return `{SSHA}${b64encode(concat([sha1(concat([pw, salt])), salt]))}`;
}

/** userPassword の値と、入力されたパスワードが合うか（{SSHA}・{SHA}・{CLEARTEXT}・そのまま） */
export function checkPassword(stored: string, password: string): boolean {
  const m = /^\{([A-Za-z0-9-]+)\}(.*)$/s.exec(stored);
  if (!m) return stored === password;
  const scheme = m[1]!.toUpperCase();
  const rest = m[2]!;
  if (scheme === "CLEARTEXT") return rest === password;
  const raw = b64decode(rest);
  if (!raw) return false;
  if (scheme === "SHA") return raw.length === 20 && same(sha1(utf8(password)), raw);
  if (scheme === "SSHA") {
    if (raw.length <= 20) return false;
    const salt = raw.slice(20);
    return same(sha1(concat([utf8(password), salt])), raw.slice(0, 20));
  }
  return false;
}

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/* ------------------------------------------------------------ BER（LDAP のメッセージの形） */

function berLen(n: number): number[] {
  if (n < 0x80) return [n];
  if (n < 0x100) return [0x81, n];
  if (n < 0x10000) return [0x82, n >> 8, n & 255];
  return [0x83, n >> 16, (n >> 8) & 255, n & 255];
}

export const tlv = (tag: number, body: Uint8Array): Uint8Array => concat([Uint8Array.from([tag, ...berLen(body.length)]), body]);

function intBytes(n: number): Uint8Array {
  const out: number[] = [];
  let v = n;
  do {
    out.unshift(v & 255);
    v = Math.floor(v / 256);
  } while (v > 0);
  if (out[0]! & 0x80) out.unshift(0);
  return Uint8Array.from(out);
}

const int = (n: number, tag = 0x02) => tlv(tag, intBytes(n));
const str = (s: string, tag = 0x04) => tlv(tag, utf8(s));
const seq = (parts: Uint8Array[], tag = 0x30) => tlv(tag, concat(parts));
const message = (id: number, op: Uint8Array) => seq([int(id), op]);

/** BindRequest。secret … パスワードのバイトがある範囲（盗み見の図で光らせる） */
export function berBindRequest(id: number, dn: string, password: string): { bytes: Uint8Array; secret: [number, number] | null } {
  const pw = utf8(password);
  const bytes = message(id, seq([int(3), str(dn), tlv(0x80, pw)], 0x60));
  return { bytes, secret: pw.length ? [bytes.length - pw.length, bytes.length] : null };
}

export const berResult = (id: number, tag: number, code: number, matched: string, text: string, extra: Uint8Array[] = []) =>
  message(id, seq([int(code, 0x0a), str(matched), str(text), ...extra], tag));

export const berExtRequest = (id: number, oid: string, value?: Uint8Array) => message(id, seq([str(oid, 0x80), ...(value ? [tlv(0x81, value)] : [])], 0x77));

export const berExtResponse = (id: number, code: number, text: string, value?: string) => berResult(id, 0x78, code, "", text, value != null ? [str(value, 0x8b)] : []);

export const berUnbind = (id: number) => message(id, Uint8Array.from([0x42, 0x00]));

/** 検索のフィルタ（filter の形は ldap.ts の Filter と同じ） */
export type BerFilter =
  | { t: "and"; list: BerFilter[] }
  | { t: "or"; list: BerFilter[] }
  | { t: "not"; f: BerFilter }
  | { t: "eq" | "ge" | "le" | "approx"; attr: string; value: string }
  | { t: "present"; attr: string }
  | { t: "sub"; attr: string; initial?: string; any: string[]; final?: string };

function berFilter(f: BerFilter): Uint8Array {
  switch (f.t) {
    case "and":
      return seq(f.list.map(berFilter), 0xa0);
    case "or":
      return seq(f.list.map(berFilter), 0xa1);
    case "not":
      return tlv(0xa2, berFilter(f.f));
    case "eq":
      return seq([str(f.attr), str(f.value)], 0xa3);
    case "ge":
      return seq([str(f.attr), str(f.value)], 0xa5);
    case "le":
      return seq([str(f.attr), str(f.value)], 0xa6);
    case "approx":
      return seq([str(f.attr), str(f.value)], 0xa8);
    case "present":
      return str(f.attr, 0x87);
    case "sub": {
      const parts: Uint8Array[] = [];
      if (f.initial) parts.push(str(f.initial, 0x80));
      for (const a of f.any) parts.push(str(a, 0x81));
      if (f.final) parts.push(str(f.final, 0x82));
      return seq([str(f.attr), seq(parts)], 0xa4);
    }
  }
}

export function berSearchRequest(id: number, base: string, scope: number, filter: BerFilter, attrs: string[], sizeLimit: number): Uint8Array {
  return message(
    id,
    seq([str(base), int(scope, 0x0a), int(0, 0x0a), int(sizeLimit), int(0), tlv(0x01, Uint8Array.of(0)), berFilter(filter), seq(attrs.map((a) => str(a)))], 0x63),
  );
}

export function berSearchEntry(id: number, dn: string, attrs: [string, string[]][]): Uint8Array {
  return message(id, seq([str(dn), seq(attrs.map(([name, vals]) => seq([str(name), seq(vals.map((v) => str(v)), 0x31)])))], 0x64));
}

/** 本物の TLS のレコードの形（中身は読めないバイト）。plain … 暗号にする前の長さ */
export function tlsRecord(rand: () => number, plain: number, type = 0x17): Uint8Array {
  const n = plain + 17;
  return concat([Uint8Array.of(type, 0x03, 0x03, n >> 8, n & 255), randomBytes(rand, n)]);
}

export type DumpLine = { offset: string; cells: { hex: string; ch: string; secret: boolean }[] };

/** 16進ダンプ（スマホの幅に入るように、1行 8バイト） */
export function hexdump(bytes: Uint8Array, secret: [number, number] | null, width = 8): DumpLine[] {
  const lines: DumpLine[] = [];
  for (let off = 0; off < bytes.length; off += width) {
    const cells = [];
    for (let i = off; i < Math.min(bytes.length, off + width); i++) {
      const b = bytes[i]!;
      cells.push({ hex: b.toString(16).padStart(2, "0"), ch: b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "·", secret: Boolean(secret && i >= secret[0] && i < secret[1]) });
    }
    lines.push({ offset: off.toString(16).padStart(4, "0"), cells });
  }
  return lines;
}
