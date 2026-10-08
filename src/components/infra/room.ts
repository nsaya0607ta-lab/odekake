/**
 * サーバー室：ブラウザの中で、本物のプログラムが動くサーバーを1〜3台動かす。
 *
 * - サーバー … Web Worker。自分で書いた onRequest(request, env) が、本物の Request を受けて Response を返す。
 *   外とつながる道具（fetch など）は消してあるので、ブラウザの外へは何も送れない。固まったら terminate して作りなおす
 * - ロードバランサー … 元気なサーバー（/health に 2xx を返した）にだけ振り分ける。返事が遅すぎたら 504
 * - CDN … 返事の Cache-Control: max-age を読んで、その秒数だけ同じ返事を使い回す
 * - データベース・キャッシュ … サーバーのプログラムから env.db・env.cache で使う（この画面が持っている。DB は、自由に作るではこの端末に覚え、レッスンでは覚えない）
 * くわしくは docs/infra-app.md の「サーバー室」。
 */

export type Header = [string, string];
export type HttpReq = { method: string; path: string; headers: Header[]; body: string | null };
export type HttpRes = { status: number; statusText: string; headers: Header[]; body: string };
/** by … 返事をしたところ（サーバー名・CDN・ロードバランサー） */
export type Entry = { id: number; at: number; req: HttpReq; res: HttpRes; ms: number; by: string };
export type LogLine = { id: number; at: number; server: string; text: string };

export type ServerStatus = "starting" | "up" | "frozen" | "stopped" | "error";
/** boots … 何回起動したか（再起動したかを見分ける） */
export type ServerView = { name: string; status: ServerStatus; healthy: boolean; inflight: number; served: number; boots: number; error: string | null };
export type Method = "GET" | "POST" | "PUT" | "DELETE";
export const METHODS: readonly Method[] = ["GET", "POST", "PUT", "DELETE"];
/** 本文を送れるメソッド */
export const hasBody = (m: string) => m === "POST" || m === "PUT";
export type RoomSettings = { count: number; lb: "rr" | "least"; cdn: boolean; autoHeal: boolean };
/** by … 返事をしたところごとの数、codes … ステータスコードごとの数 */
export type BurstResult = { total: number; ok: number; fail: number; avgMs: number; by: Record<string, number>; codes: Record<number, number> };
/** persist … データベースをこの端末に覚えるか（レッスンでは覚えない） */
export type RoomOptions = { persist?: boolean };

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
/** データベースの1件の大きさの上限（JSON にしたときの文字数）と、名前の長さの上限 */
const MAX_DB_VALUE = 10000;
const MAX_DB_KEY = 200;
const DB_KEY = "odekake_infra_room_db_v1";
/** 監視の自動の再起動：この時間のうちに、この回数まで（それより多いと、再起動してもむだなのであきらめる） */
const HEAL_WINDOW = 30000;
const HEAL_MAX = 3;

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
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "WebSocketStream", "EventSource", "importScripts", "indexedDB", "caches", "Worker", "SharedWorker", "BroadcastChannel", "WebTransport", "Notification"]) {
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
// エラーが、書いたプログラムの何行目で起きたか（わかるブラウザだけ）。new Function は前に2行つけるので、その分を引く
const where = (err) => {
  const st = String((err && err.stack) || "");
  const m = /<anonymous>:(\d+):\d+/.exec(st) || /> Function:(\d+):\d+/.exec(st);
  const line = m ? Number(m[1]) - 2 : 0;
  return line > 0 ? "（" + line + "行目）" : "";
};
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
      postMessage({ type: "res", id: m.id, status: 500, statusText: "", headers: [["content-type", "text/plain; charset=utf-8"]], body: "サーバーのプログラムでエラー" + where(err) + "：" + String((err && err.message) || err) });
    }
  }
};
`;

type Waiter = (r: HttpRes | "timeout" | "down") => void;
type Srv = ServerView & { worker: Worker | null; pending: Map<number, Waiter>; fails: number; checking: boolean; heals: number[]; gaveUp: boolean };

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
  /** データベース・キャッシュが使われた回数（画面で光らせる） */
  touches = { db: 0, cache: 0 };
  private nextId = 1;
  private rr = 0;
  private timer: number;
  private disposed = false;
  private readonly persist: boolean;

  constructor(code: string, settings: RoomSettings, opts: RoomOptions = {}) {
    this.code = code;
    this.settings = settings;
    this.persist = opts.persist ?? true;
    if (this.persist) this.loadDb();
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
      const s: Srv = { name: `サーバー${this.servers.length + 1}`, status: "starting", healthy: false, inflight: 0, served: 0, boots: 0, error: null, worker: null, pending: new Map(), fails: 0, checking: false, heals: [], gaveUp: false };
      this.servers.push(s);
      this.boot(s);
    }
    this.emit();
  }

  private boot(s: Srv) {
    s.boots++;
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
      // 起動中のエラーは、動き出せないので止める。動いてからのエラー（setTimeout の中など）は、ログに出すだけ
      if (s.status === "starting") {
        s.status = "error";
        s.error = e.message || "サーバーが動き出せませんでした";
        this.emit();
        return;
      }
      // new Function は前に2行つけるので、その分を引く（行がわからないブラウザでは出さない）
      this.log(s.name, `エラー${e.lineno > 2 ? `（${e.lineno - 2}行目）` : ""}：${(e.message || "わからないエラー").replace(/^Uncaught\s+/, "")}`);
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
    if (op.startsWith("db.")) this.touches.db++;
    else if (op.startsWith("cache.")) this.touches.cache++;
    this.emit();
    switch (op) {
      case "db.get":
        return reply(this.db.has(k) ? this.db.get(k) : null);
      case "db.put": {
        if (k.length > MAX_DB_KEY) return reply(null, `名前が長すぎます（${MAX_DB_KEY}文字まで）`);
        let size = 0;
        try {
          size = JSON.stringify(v ?? null).length;
        } catch {
          return reply(null, "この中身は保存できません（文字・数・配列・オブジェクトにしよう）");
        }
        if (size > MAX_DB_VALUE) return reply(null, `1件が大きすぎます（${MAX_DB_VALUE}文字まで）`);
        if (!this.db.has(k) && this.db.size >= MAX_DB_KEYS) return reply(null, `データベースがいっぱいです（${MAX_DB_KEYS}件まで）`);
        this.db.set(k, v);
        this.saveDb();
        return reply(true);
      }
      case "db.delete":
        this.db.delete(k);
        this.saveDb();
        return reply(true);
      case "db.list":
        return reply([...this.db].filter(([key]) => key.startsWith(k)).map(([key, value]) => ({ key, value })));
      case "db.incr": {
        if (!this.db.has(k) && this.db.size >= MAX_DB_KEYS) return reply(null, `データベースがいっぱいです（${MAX_DB_KEYS}件まで）`);
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
    if (why === "再起動しました") {
      // 手で再起動したら、監視の「あきらめ」もやりなおし
      s.heals = [];
      s.gaveUp = false;
    }
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
    if (s.fails >= 2 && this.settings.autoHeal && !s.gaveUp) {
      const now = Date.now();
      s.heals = s.heals.filter((t) => now - t < HEAL_WINDOW);
      if (s.heals.length >= HEAL_MAX) {
        // 何度再起動しても直らない（プログラムそのものがおかしい）。本物の監視でも、くり返すのをやめて人に知らせる
        s.gaveUp = true;
        this.log("監視", `${s.name} は、${HEAL_WINDOW / 1000}秒に${HEAL_MAX}回再起動しても直りません。再起動をやめます（プログラムを見直そう。/health に 200 を返している？）`);
      } else {
        s.heals.push(now);
        this.restart(this.servers.indexOf(s), "監視が気づいて、自動で再起動しました");
      }
    }
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
    const path = normalizePath(rawPath);
    const headers: Header[] = [
      ["host", "odekake.lab"],
      ["user-agent", "wanko-browser/1.0"],
      ["accept", "*/*"],
    ];
    const withBody = hasBody(method) && body != null;
    if (withBody) headers.push(["content-type", "text/plain; charset=utf-8"]);
    const req: HttpReq = { method, path, headers, body: withBody ? body : null };
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
        if (r !== "timeout" && r !== "down") s.served++;
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
    const codes: Record<number, number> = {};
    for (const e of list) codes[e.res.status] = (codes[e.res.status] ?? 0) + 1;
    const ok = list.filter((e) => e.res.status < 400).length;
    return { total: n, ok, fail: n - ok, avgMs: Math.round(list.reduce((s, e) => s + e.ms, 0) / n), by, codes };
  }

  /** サーバーがみんな起動して、ヘルスチェックに合格したか（固まった・止めたサーバーは数えない。プログラムのまちがいで動けなければ false） */
  ready(): boolean {
    if (this.servers.some((s) => s.status === "error")) return false;
    const live = this.servers.filter((s) => s.status === "starting" || s.status === "up");
    return live.length > 0 && live.every((s) => s.healthy);
  }

  /** キャッシュに覚えている残りの秒数（なければ 0） */
  cacheLeft(key: string): number {
    const c = this.cache.get(key);
    return c ? Math.max(0, Math.ceil((c.until - Date.now()) / 1000)) : 0;
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
    if (!this.persist) return;
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

/** ステータスコードの意味（ひとことで） */
export function statusMeaning(code: number): string {
  const exact: Record<number, string> = {
    200: "成功",
    201: "作成できた",
    204: "成功（本文なし）",
    301: "引っこした（ずっと）",
    302: "引っこした（いまだけ）",
    304: "前と同じ",
    400: "お願いの形がおかしい",
    401: "ログインが要る",
    403: "見せられない",
    404: "見つからない",
    405: "そのメソッドは使えない",
    429: "多すぎる",
    500: "サーバーのプログラムのエラー",
    502: "サーバーが止まっていた",
    503: "元気なサーバーがいない",
    504: "時間切れ",
  };
  if (exact[code]) return exact[code];
  if (code < 300) return "成功";
  if (code < 400) return "別の場所へ";
  if (code < 500) return "お願いのまちがい";
  return "サーバー側の問題";
}

/**
 * プログラムのかっこ・文字列の閉じわすれをさがす（文法エラーのときのヒント。わからなければ null）。
 * コメント・文字列の中はとばす。正規表現などで、まちがえることもある
 */
export function bracketHint(code: string): string | null {
  const pair: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: { ch: string; line: number }[] = [];
  let line = 1;
  for (let i = 0; i < code.length; i++) {
    const c = code[i]!;
    if (c === "\n") {
      line++;
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") i++;
      i--;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) {
        if (code[i] === "\n") line++;
        i++;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const start = line;
      i++;
      while (i < code.length && code[i] !== c) {
        if (code[i] === "\\") i++;
        else if (code[i] === "\n") {
          if (c !== "`") return `${start}行目の ${c} が閉じていません`;
          line++;
        }
        i++;
      }
      if (i >= code.length) return `${start}行目の ${c} が閉じていません`;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") stack.push({ ch: c, line });
    else if (c === ")" || c === "]" || c === "}") {
      const open = stack.pop();
      if (!open) return `${line}行目の ${c} に、組になる ${pair[c]} がありません`;
      if (open.ch !== pair[c]) return `${open.line}行目の ${open.ch} と、${line}行目の ${c} が組になっていません`;
    }
  }
  const open = stack.pop();
  return open ? `${open.line}行目の ${open.ch} が閉じていません` : null;
}

/**
 * 入力されたパスを、本物の HTTP で送る形にする（前後の空白をとる・「/」から始める・日本語などは %E3%… に）。
 * https://… と URL ごと入れたときは、パスと ? 以降だけを使う
 */
export function normalizePath(raw: string): string {
  const t = raw.trim();
  try {
    const u = /^https?:\/\//i.test(t) ? new URL(t) : new URL(t.startsWith("/") ? t : `/${t}`, "https://odekake.lab");
    return `${u.pathname}${u.search}`;
  } catch {
    return "/";
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
