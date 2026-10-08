/**
 * サーバー室：ブラウザの中で、本物のプログラムが動くサーバーを1〜3台動かす。
 *
 * - サーバー … Web Worker。自分で書いた onRequest(request, env) が、本物の Request を受けて Response を返す。
 *   外とつながる道具（fetch など）は消してあるので、ブラウザの外へは何も送れない。固まったら terminate して作りなおす
 * - ロードバランサー … 元気なサーバー（/health に 2xx を返した）にだけ振り分ける。返事が遅すぎたら 504
 * - CDN … 返事の Cache-Control: max-age を読んで、その秒数だけ同じ返事を使い回す
 * - データベース・キャッシュ … サーバーのプログラムから env.db・env.cache で使う（この画面が持っている。DB はこの端末に覚える）
 * くわしくは docs/infra-app.md の「サーバー室」。
 */

export type Header = [string, string];
export type HttpReq = { method: string; path: string; headers: Header[]; body: string | null };
export type HttpRes = { status: number; statusText: string; headers: Header[]; body: string };
/** by … 返事をしたところ（サーバー名・CDN・ロードバランサー） */
export type Entry = { id: number; at: number; req: HttpReq; res: HttpRes; ms: number; by: string };
export type LogLine = { id: number; at: number; server: string; text: string };

export type ServerStatus = "starting" | "up" | "frozen" | "stopped" | "error";
export type ServerView = { name: string; status: ServerStatus; healthy: boolean; inflight: number; served: number; error: string | null };
export type RoomSettings = { count: number; lb: "rr" | "least"; cdn: boolean; autoHeal: boolean };
export type BurstResult = { total: number; ok: number; fail: number; avgMs: number; by: Record<string, number> };

/** サーバーの返事を待つ時間（これをこえたら 504） */
export const REQUEST_TIMEOUT = 3000;
/** ヘルスチェックの間隔と、待つ時間 */
const HEALTH_EVERY = 1500;
const HEALTH_TIMEOUT = 1200;
/** 本文・記録の長さの上限（画面が重くならないように） */
const MAX_BODY = 20000;
const MAX_ENTRIES = 80;
const MAX_LOGS = 120;
const MAX_DB_KEYS = 300;
const DB_KEY = "odekake_infra_room_db_v1";

export const REASON: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/**
 * Worker の中で動くプログラム（文字列のまま Blob にして読みこむ）。
 * 1. 外とつながる道具を消す 2. env（db・cache・sleep）を用意する 3. 書いたプログラムを読みこむ 4. リクエストを待つ
 */
const WORKER_SOURCE = String.raw`"use strict";
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "WebSocketStream", "EventSource", "importScripts", "indexedDB", "caches", "Worker", "SharedWorker", "BroadcastChannel", "WebTransport"]) {
  let o = self;
  while (o) {
    try { if (Object.prototype.hasOwnProperty.call(o, name)) delete o[name]; } catch (e) {}
    o = Object.getPrototypeOf(o);
  }
  try { Object.defineProperty(self, name, { value: undefined, writable: false, configurable: false }); } catch (e) {}
}
if (typeof Response.json !== "function") {
  Response.json = (data, init) => {
    const headers = new Headers((init && init.headers) || {});
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return new Response(JSON.stringify(data), Object.assign({}, init, { headers }));
  };
}
let handler = null;
let rpcId = 0;
const pending = new Map();
const call = (op, args) => new Promise((resolve, reject) => {
  const id = ++rpcId;
  pending.set(id, { resolve, reject });
  postMessage({ type: "rpc", id, op, args });
});
const env = {
  server: "",
  db: {
    get: (k) => call("db.get", [String(k)]),
    put: (k, v) => call("db.put", [String(k), v]),
    delete: (k) => call("db.delete", [String(k)]),
    list: (prefix) => call("db.list", [String(prefix || "")]),
    incr: (k, by) => call("db.incr", [String(k), Number(by == null ? 1 : by)]),
  },
  cache: {
    get: (k) => call("cache.get", [String(k)]),
    put: (k, v, seconds) => call("cache.put", [String(k), v, Number(seconds == null ? 10 : seconds)]),
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, Math.max(0, Math.min(Number(ms) || 0, 10000)))),
};
let logWindow = 0, logCount = 0;
const log = (...a) => {
  const now = Date.now();
  if (now - logWindow > 1000) { logWindow = now; logCount = 0; }
  if (++logCount > 40) return;
  postMessage({ type: "log", text: a.map((x) => (typeof x === "string" ? x : (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })())).join(" ").slice(0, 500) });
};
console.log = console.info = console.warn = console.error = log;
self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "init") {
    env.server = m.name;
    try {
      handler = new Function("env", m.code + "\n;return typeof onRequest === \"function\" ? onRequest : null;")(env);
      if (!handler) throw new Error("onRequest という関数が見つかりません");
      postMessage({ type: "ready" });
    } catch (err) {
      postMessage({ type: "compileError", message: String((err && err.message) || err) });
    }
    return;
  }
  if (m.type === "rpcres") {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error));
    else p.resolve(m.value);
    return;
  }
  if (m.type === "req") {
    try {
      const init = { method: m.method, headers: m.headers };
      if (m.body != null && m.method !== "GET" && m.method !== "HEAD") init.body = m.body;
      let res = await handler(new Request("https://odekake.lab" + m.path, init), env);
      if (!(res instanceof Response)) res = typeof res === "string" ? new Response(res) : Response.json(res);
      const body = await res.text();
      postMessage({ type: "res", id: m.id, status: res.status, statusText: res.statusText, headers: Array.from(res.headers), body });
    } catch (err) {
      postMessage({ type: "res", id: m.id, status: 500, statusText: "", headers: [["content-type", "text/plain; charset=utf-8"]], body: "サーバーのプログラムでエラー：" + String((err && err.message) || err) });
    }
  }
};
`;

type Waiter = (r: HttpRes | "timeout" | "down") => void;
type Srv = ServerView & { worker: Worker | null; pending: Map<number, Waiter>; fails: number; checking: boolean };

let workerUrl: string | null = null;
function workerScript(): string {
  workerUrl ??= URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
  return workerUrl;
}

/** 本物の HTTP では、ヘッダーの値に使えるのは英数字と記号だけ（日本語は本文に書く） */
const asciiName = (name: string) => name.replace("サーバー", "server");

const plain = (status: number, body: string): HttpRes => ({
  status,
  statusText: REASON[status] ?? "",
  headers: [
    ["content-type", "text/plain; charset=utf-8"],
    ["x-served-by", "load-balancer"],
  ],
  body,
});

const header = (res: HttpRes, name: string) => res.headers.find(([k]) => k.toLowerCase() === name)?.[1] ?? null;

/** Cache-Control から、CDN が使い回してよい秒数（だめなら 0） */
export function cacheSeconds(res: HttpRes): number {
  const cc = (header(res, "cache-control") ?? "").toLowerCase();
  if (res.status !== 200 || /no-store|no-cache|private/.test(cc)) return 0;
  const m = /(?:s-maxage|max-age)\s*=\s*(\d+)/.exec(cc);
  return m ? Math.min(3600, Number(m[1])) : 0;
}

export class ServerRoom {
  servers: Srv[] = [];
  entries: Entry[] = [];
  logs: LogLine[] = [];
  db = new Map<string, unknown>();
  version = 0;
  code = "";
  settings: RoomSettings;
  private cache = new Map<string, { value: unknown; until: number }>();
  private cdn = new Map<string, { res: HttpRes; at: number; until: number }>();
  private listeners = new Set<() => void>();
  private nextId = 1;
  private rr = 0;
  private timer: number;
  private disposed = false;

  constructor(code: string, settings: RoomSettings) {
    this.code = code;
    this.settings = settings;
    this.loadDb();
    this.timer = window.setInterval(() => this.healthCheck(), HEALTH_EVERY);
    this.deploy(code);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  /* ------------------------------------------------------------ サーバーを動かす */

  /** 新しいプログラムで、サーバーをみんな作りなおす */
  deploy(code: string) {
    this.code = code;
    this.version++;
    for (const s of this.servers) this.kill(s);
    this.servers = [];
    this.cdn.clear();
    this.setCount(this.settings.count);
    this.log("デプロイ", `バージョン ${this.version} をデプロイしました`);
  }

  setSettings(patch: Partial<RoomSettings>) {
    this.settings = { ...this.settings, ...patch };
    if (patch.count != null) this.setCount(patch.count);
    if (patch.cdn === false) this.cdn.clear();
    this.emit();
  }

  private setCount(n: number) {
    while (this.servers.length > n) this.kill(this.servers.pop()!);
    while (this.servers.length < n) {
      const s: Srv = { name: `サーバー${this.servers.length + 1}`, status: "starting", healthy: false, inflight: 0, served: 0, error: null, worker: null, pending: new Map(), fails: 0, checking: false };
      this.servers.push(s);
      this.boot(s);
    }
    this.emit();
  }

  private boot(s: Srv) {
    s.status = "starting";
    s.healthy = false;
    s.error = null;
    s.fails = 0;
    s.inflight = 0;
    const w = new Worker(workerScript());
    s.worker = w;
    w.onmessage = (e: MessageEvent) => this.onWorker(s, w, e.data);
    w.onerror = (e) => {
      e.preventDefault();
      if (s.worker !== w) return;
      s.status = "error";
      s.error = e.message || "サーバーが止まりました";
      this.emit();
    };
    w.postMessage({ type: "init", code: this.code, name: s.name });
  }

  private onWorker(s: Srv, w: Worker, m: { type: string; [k: string]: unknown }) {
    if (s.worker !== w) return;
    switch (m.type) {
      case "ready":
        s.status = "up";
        this.emit();
        void this.checkOne(s);
        return;
      case "compileError":
        s.status = "error";
        s.error = `プログラムにまちがいがあります：${String(m.message)}`;
        this.log(s.name, s.error);
        return;
      case "log":
        this.log(s.name, String(m.text));
        return;
      case "res": {
        const done = s.pending.get(m.id as number);
        if (!done) return;
        s.pending.delete(m.id as number);
        const body = String(m.body ?? "");
        done({
          status: Number(m.status) || 200,
          statusText: String(m.statusText || "") || REASON[Number(m.status)] || "",
          headers: (m.headers as Header[]) ?? [],
          body: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY)}…（長いので省略）` : body,
        });
        return;
      }
      case "rpc":
        this.rpc(w, m.id as number, String(m.op), (m.args as unknown[]) ?? []);
        return;
    }
  }

  /** サーバーのプログラムからの、データベース・キャッシュの読み書き */
  private rpc(w: Worker, id: number, op: string, args: unknown[]) {
    const reply = (value: unknown, error?: string) => {
      try {
        w.postMessage({ type: "rpcres", id, value, error });
      } catch {
        w.postMessage({ type: "rpcres", id, error: "この中身は保存できません" });
      }
    };
    const [k, v, n] = args as [string, unknown, number];
    switch (op) {
      case "db.get":
        return reply(this.db.has(k) ? this.db.get(k) : null);
      case "db.put":
        if (!this.db.has(k) && this.db.size >= MAX_DB_KEYS) return reply(null, `データベースがいっぱいです（${MAX_DB_KEYS}件まで）`);
        this.db.set(k, v);
        this.saveDb();
        return reply(true);
      case "db.delete":
        this.db.delete(k);
        this.saveDb();
        return reply(true);
      case "db.list":
        return reply([...this.db].filter(([key]) => key.startsWith(k)).map(([key, value]) => ({ key, value })));
      case "db.incr": {
        const next = (Number(this.db.get(k)) || 0) + (Number(v) || 1);
        this.db.set(k, next);
        this.saveDb();
        return reply(next);
      }
      case "cache.get": {
        const c = this.cache.get(k);
        return reply(c && c.until > Date.now() ? c.value : null);
      }
      case "cache.put":
        this.cache.set(k, { value: v, until: Date.now() + Math.max(0, Math.min(Number(n) || 0, 3600)) * 1000 });
        return reply(true);
    }
    return reply(null, `${op} は使えません`);
  }

  private kill(s: Srv) {
    s.worker?.terminate();
    s.worker = null;
    for (const done of s.pending.values()) done("down");
    s.pending.clear();
    s.inflight = 0;
  }

  stop(i: number) {
    const s = this.servers[i];
    if (!s) return;
    this.kill(s);
    s.status = "stopped";
    s.healthy = false;
    this.log(s.name, "止めました");
    this.emit();
  }

  restart(i: number, why = "再起動しました") {
    const s = this.servers[i];
    if (!s) return;
    this.kill(s);
    this.boot(s);
    this.log(s.name, why);
    this.emit();
  }

  /** 1台のサーバーに、リクエストを1つ送る */
  private ask(s: Srv, req: HttpReq, timeout: number): Promise<HttpRes | "timeout" | "down"> {
    const w = s.worker;
    if (!w || s.status === "stopped" || s.status === "error") return Promise.resolve("down");
    const id = this.nextId++;
    return new Promise((resolve) => {
      const t = window.setTimeout(() => {
        s.pending.delete(id);
        resolve("timeout");
      }, timeout);
      s.pending.set(id, (r) => {
        window.clearTimeout(t);
        resolve(r);
      });
      w.postMessage({ type: "req", id, method: req.method, path: req.path, headers: req.headers, body: req.body });
    });
  }

  /* ------------------------------------------------------------ ヘルスチェック・監視 */

  private healthCheck() {
    for (const s of this.servers) if (s.status === "up" || s.status === "frozen") void this.checkOne(s);
  }

  private async checkOne(s: Srv) {
    if (s.checking || this.disposed) return;
    s.checking = true;
    const r = await this.ask(s, { method: "GET", path: "/health", headers: [["user-agent", "lb-health-check/1.0"]], body: null }, HEALTH_TIMEOUT);
    s.checking = false;
    if (this.disposed || !this.servers.includes(s) || s.status === "stopped" || s.status === "error" || s.status === "starting") return;
    const ok = r !== "timeout" && r !== "down" && r.status >= 200 && r.status < 300;
    if (ok) {
      if (!s.healthy) this.log("ロードバランサー", `${s.name} は元気です。振り分けはじめます`);
      s.fails = 0;
      s.healthy = true;
      s.status = "up";
      s.error = null;
      this.emit();
      return;
    }
    s.fails++;
    if (r === "timeout") s.status = "frozen";
    s.error = r === "timeout" ? "/health に返事がありません（固まっている？）" : r === "down" ? "止まっています" : `/health が ${r.status} を返しました（2xx でないと、元気と見なされません）`;
    if (s.fails >= 2 && s.healthy) {
      s.healthy = false;
      this.log("ロードバランサー", `${s.name} の様子がおかしいので、振り分けをやめます（${s.error}）`);
    }
    if (s.fails >= 2 && this.settings.autoHeal) this.restart(this.servers.indexOf(s), "監視が気づいて、自動で再起動しました");
    this.emit();
  }

  /* ------------------------------------------------------------ リクエストを送る */

  private pick(): Srv | null {
    const ok = this.servers.filter((s) => s.healthy && s.status === "up");
    if (!ok.length) return null;
    if (this.settings.lb === "least") {
      let best = ok[0]!;
      for (let k = 0; k < ok.length; k++) {
        const s = ok[(this.rr + k) % ok.length]!;
        if (s.inflight < best.inflight) best = s;
      }
      this.rr++;
      return best;
    }
    return ok[this.rr++ % ok.length]!;
  }

  async send(method: string, rawPath: string, body: string | null): Promise<Entry> {
    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const headers: Header[] = [
      ["host", "odekake.lab"],
      ["user-agent", "wanko-browser/1.0"],
      ["accept", "*/*"],
    ];
    const hasBody = method !== "GET" && body != null;
    if (hasBody) headers.push(["content-type", "text/plain; charset=utf-8"]);
    const req: HttpReq = { method, path, headers, body: hasBody ? body : null };
    const t0 = performance.now();
    let res: HttpRes;
    let by = "ロードバランサー";
    const key = `${method} ${path}`;
    const hit = this.settings.cdn && method === "GET" ? this.cdn.get(key) : undefined;
    if (hit && hit.until > Date.now()) {
      // CDN が覚えていた返事を、そのまま返す（サーバーまで行かない）
      by = "CDN";
      const age = Math.round((Date.now() - hit.at) / 1000);
      res = { ...hit.res, headers: [...hit.res.headers.filter(([k]) => k !== "x-cache" && k !== "age"), ["x-cache", "HIT"], ["age", String(age)]] };
    } else {
      const s = this.pick();
      if (!s) res = plain(503, "元気なサーバーがありません（ヘルスチェックに合格したサーバーが0台）");
      else {
        by = s.name;
        s.inflight++;
        this.emit();
        const r = await this.ask(s, req, REQUEST_TIMEOUT);
        s.inflight = Math.max(0, s.inflight - 1);
        s.served++;
        if (r === "timeout") res = plain(504, `${s.name} から ${REQUEST_TIMEOUT / 1000}秒たっても返事がありません`);
        else if (r === "down") res = plain(502, `${s.name} が止まっていて、返事をもらえませんでした`);
        else res = { ...r, headers: [...r.headers, ["x-served-by", asciiName(s.name)]] };
        if (r === "timeout" || r === "down") by = `${s.name}（失敗）`;
      }
      if (this.settings.cdn && method === "GET") {
        res = { ...res, headers: [...res.headers, ["x-cache", "MISS"]] };
        const sec = cacheSeconds(res);
        if (sec > 0) this.cdn.set(key, { res, at: Date.now(), until: Date.now() + sec * 1000 });
      }
    }
    const entry: Entry = { id: this.nextId++, at: Date.now(), req, res, ms: Math.round(performance.now() - t0), by };
    this.entries = [entry, ...this.entries].slice(0, MAX_ENTRIES);
    this.emit();
    return entry;
  }

  /** まとめて送る（ロードバランサーの振り分け・混み具合を見る） */
  async burst(method: string, path: string, body: string | null, n: number): Promise<BurstResult> {
    const list = await Promise.all(Array.from({ length: n }, () => this.send(method, path, body)));
    const by: Record<string, number> = {};
    for (const e of list) by[e.by] = (by[e.by] ?? 0) + 1;
    const ok = list.filter((e) => e.res.status < 500).length;
    return { total: n, ok, fail: n - ok, avgMs: Math.round(list.reduce((s, e) => s + e.ms, 0) / n), by };
  }

  /* ------------------------------------------------------------ 小物 */

  private log(server: string, text: string) {
    this.logs = [{ id: this.nextId++, at: Date.now(), server, text }, ...this.logs].slice(0, MAX_LOGS);
    this.emit();
  }

  clearDb() {
    this.db.clear();
    this.cache.clear();
    this.saveDb();
    this.emit();
  }

  private loadDb() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(DB_KEY) ?? "null") as unknown;
      if (Array.isArray(raw)) for (const [k, v] of raw.slice(0, MAX_DB_KEYS) as [unknown, unknown][]) if (typeof k === "string") this.db.set(k, v);
    } catch {
      // 読めなければ、からっぽから
    }
  }

  private saveDb() {
    try {
      window.localStorage.setItem(DB_KEY, JSON.stringify([...this.db]));
    } catch {
      // 覚えられなくても、この画面のあいだは使える
    }
  }

  dispose() {
    this.disposed = true;
    window.clearInterval(this.timer);
    for (const s of this.servers) this.kill(s);
    this.listeners.clear();
  }
}

/** 画面に出す「本物の HTTP」の形 */
export function rawRequest(r: HttpReq): string {
  const head = [`${r.method} ${r.path} HTTP/1.1`, ...r.headers.map(([k, v]) => `${cap(k)}: ${v}`)];
  return r.body != null ? `${head.join("\n")}\n\n${r.body}` : head.join("\n");
}

export function rawResponse(r: HttpRes): string {
  const head = [`HTTP/1.1 ${r.status} ${r.statusText || REASON[r.status] || ""}`.trim(), ...r.headers.map(([k, v]) => `${cap(k)}: ${v}`)];
  return `${head.join("\n")}\n\n${r.body}`;
}

const cap = (k: string) => k.replace(/(^|-)([a-z])/g, (_, d: string, c: string) => d + c.toUpperCase());
