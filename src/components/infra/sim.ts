/**
 * インフラのシミュレーター（React に依存しない。乱数は種つきなので、同じ条件なら毎回同じ結果になる）。
 *
 * アクセス（リクエスト）は、利用者 → 入口 → … → サーバー → … と1マスずつ移動し、
 * 各パーツで「同時に処理できる数」だけ並行して処理される。いっぱいなら待ち行列、待ち行列もいっぱいなら 503。
 * 返事（レスポンス）は、来た道を逆にたどって利用者へもどる。
 * くわしいルールは docs/infra-app.md の「シミュレーションのルール」。
 */
import {
  CACHE_MAX_HIT,
  CACHE_WARM,
  CDN_MAX_HIT,
  CDN_WARM,
  DNS_TTL,
  FAILOVER_DELAY,
  HEALTH_DELAY,
  JOB_DEADLINE,
  MS_PER_SEC,
  QUEUE_MAX_JOBS,
  REQ_TYPES,
  SERVICE,
  SLOT_ORDER,
  TIMEOUT,
  TRAVEL,
  USER_COUNT,
  WAF_BLOCK,
  partCost,
  partSize,
  slotLabel,
  type PartKind,
  type Placement,
  type ReqType,
  type SlotId,
} from "./model";

export type Rates = Partial<Record<ReqType, number>>;
export type Tone = "info" | "warn" | "danger" | "good";

export type StageEvent =
  | { t: number; kind: "crash"; target: "app" | "db"; index?: number; duration: number }
  | { t: number; kind: "banner"; text: string; tone?: Tone };

export type SimSetup = {
  /** 利用者は、まず DNS で住所を調べないとたどりつけない */
  requiresDns: boolean;
  /** 遠くの町の利用者の割合（0〜1） */
  farRatio: number;
  /** ゲーム内の秒。Infinity なら止めるまで続く（ラボ） */
  duration: number;
  /** その時刻の、種類ごとのアクセス数（1秒あたり） */
  traffic: (t: number) => Rates;
  events: readonly StageEvent[];
};

export type FailReason = "busy" | "timeout" | "down" | "dns" | "missing" | "noserver" | "late";

export type TipId =
  | "first-ok"
  | "no-server"
  | "dns-first"
  | "dns-cached"
  | "dns-missing"
  | "busy"
  | "unused-app"
  | "lb-spread"
  | "missing-data"
  | "db-first"
  | "db-busy"
  | "cache-hit"
  | "cache-miss"
  | "cdn-hit"
  | "far-slow"
  | "health"
  | "spof"
  | "failover"
  | "repl"
  | "queue-ack"
  | "heavy-sync"
  | "backlog"
  | "waf-block"
  | "attack-hit"
  | "timeout";

/** 画面の効果。at はパーツのマス・利用者（"u0"…）・ロボット（"bot"）。to と p があれば、その道の途中 */
export type Fx =
  | { kind: "text"; at: string; to?: string; p?: number; text: string; color: string; big?: boolean }
  | { kind: "burst"; at: string; to?: string; p?: number; color: string; n: number };

export type Banner = { text: string; tone: Tone };

export type ReqKind = ReqType | "job" | "repl";

export type SimReq = {
  id: number;
  kind: ReqKind;
  /** 利用者の番号（ロボットは -1） */
  user: number;
  far: boolean;
  born: number;
  /** いまいる場所 */
  at: string;
  state: "travel" | "wait" | "service" | "gone";
  from: string;
  to: string;
  t0: number;
  t1: number;
  returning: boolean;
  /** 来た道（返事はこれを逆にたどる） */
  stack: string[];
  doneAt: number;
  /** DNS に住所を問い合わせているところ */
  dns: boolean;
  /** キャッシュになかったので、サーバーにもどってから DB へ */
  needDb: boolean;
  /** DB から読んだので、帰りにキャッシュに入れる */
  fillCache: boolean;
  /** CDN になかったので、帰りに CDN に入れる */
  viaCdn: boolean;
  /** キャッシュになかった帰り道（色を変える） */
  miss: boolean;
  /** 重い処理をキューに任せる */
  async: boolean;
  /** 向かっている先（混み具合の見積もりに数えている） */
  inc: SlotId | null;
};

export type SimNode = {
  id: SlotId;
  kind: PartKind;
  size: number;
  cap: number;
  qmax: number;
  busy: SimReq[];
  wait: SimReq[];
  incoming: number;
  down: boolean;
  downAt: number;
  upAt: number;
  recoverAt: number;
  /** ロードバランサーが「止まっている」と気づいているか */
  lbKnowsDown: boolean;
  served: number;
  dropped: number;
  /** キャッシュ・CDN にたまった中身 */
  warm: number;
  hits: number;
  misses: number;
  blocked: number;
  /** キューにたまっている仕事 */
  jobs: SimReq[];
  /** 最近の通過量（線やランプの光り方に使う。だんだん減る） */
  activity: number;
};

export type SimUser = { far: boolean; dnsUntil: number; lastWrite: SlotId | null; mood: number; okAt: number; failAt: number };

/** 1秒ごとの記録（結果のグラフ） */
export type Sample = { t: number; ok: number; fail: number; lat: number | null; cost: number };

export type Metrics = {
  ok: number;
  fail: number;
  failBy: Record<FailReason, number>;
  latSum: number;
  latN: number;
  attacks: number;
  blocked: number;
  attackHit: number;
  jobsMade: number;
  jobsDone: number;
  jobsFailed: number;
  costAcc: number;
  peakCost: number;
};

const LEGIT = new Set<ReqKind>(["page", "static", "write", "heavy"]);
const FAIL_LABEL: Record<FailReason, string> = { busy: "503", timeout: "504", down: "×", dns: "?", missing: "データなし", noserver: "×", late: "期限切れ" };
const FAIL_COLOR = "#ff6b81";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isUserId = (id: string) => id === "bot" || /^u\d+$/.test(id);

export class InfraSim {
  now = 0;
  readonly setup: SimSetup;
  readonly nodes = new Map<SlotId, SimNode>();
  reqs: SimReq[] = [];
  readonly users: SimUser[];
  /** 描画が受けとる効果（受けとったら空にする） */
  fx: Fx[] = [];
  /** 画面の上に出すお知らせ（受けとったら空にする） */
  banners: Banner[] = [];
  /** はじめて起きたこと（ヒントを出す。受けとったら空にする） */
  tips: TipId[] = [];
  readonly seen = new Set<TipId>();
  readonly m: Metrics;
  series: Sample[] = [];
  primaryDb: SlotId | null = null;

  private readonly rand: () => number;
  private nextId = 1;
  private readonly acc = new Map<ReqType, number>();
  private readonly thr = new Map<ReqType, number>();
  private readonly events: StageEvent[];
  private eventIdx = 0;
  private sec = { ok: 0, fail: 0, latSum: 0, latN: 0 };
  private nextSample = 1;
  private rr = 0;
  private lbSent = 0;

  constructor(setup: SimSetup, placements: readonly Placement[], seed = 1) {
    this.setup = setup;
    this.rand = mulberry32(seed);
    const farCount = Math.round(setup.farRatio * USER_COUNT);
    this.users = Array.from({ length: USER_COUNT }, (_, i) => ({
      far: i >= USER_COUNT - farCount,
      dnsUntil: -1,
      lastWrite: null,
      mood: 0.6,
      okAt: -9,
      failAt: -9,
    }));
    this.events = [...setup.events].sort((a, b) => a.t - b.t);
    for (const t of REQ_TYPES) {
      this.acc.set(t, 0);
      this.thr.set(t, this.expo());
    }
    this.m = {
      ok: 0,
      fail: 0,
      failBy: { busy: 0, timeout: 0, down: 0, dns: 0, missing: 0, noserver: 0, late: 0 },
      latSum: 0,
      latN: 0,
      attacks: 0,
      blocked: 0,
      attackHit: 0,
      jobsMade: 0,
      jobsDone: 0,
      jobsFailed: 0,
      costAcc: 0,
      peakCost: 0,
    };
    this.setPlacements(placements);
  }

  /* ------------------------------------------------------------ 外から使うもの */

  get finished() {
    return this.now >= this.setup.duration;
  }

  /** 成功率（攻撃以外）。まだ1件も終わっていなければ null */
  successRate(): number | null {
    const n = this.m.ok + this.m.fail;
    return n ? this.m.ok / n : null;
  }

  /** 平均の返事の速さ（ms） */
  avgLatency(): number | null {
    return this.m.latN ? this.m.latSum / this.m.latN : null;
  }

  /** 月額（置いていた時間で平均） */
  avgCost(): number {
    return this.now > 0.5 ? this.m.costAcc / this.now : this.cost();
  }

  /** いまの月額 */
  cost(): number {
    let sum = 0;
    for (const n of this.nodes.values()) sum += partCost(n.kind, n.size);
    return sum;
  }

  /** 直近 seconds 秒の成功率と速さ（ラボ用） */
  recent(seconds: number): { success: number | null; latency: number | null; rate: number } {
    const from = Math.max(0, this.series.length - seconds);
    let ok = 0, fail = 0, latSum = 0, latN = 0;
    for (let i = from; i < this.series.length; i++) {
      const s = this.series[i]!;
      ok += s.ok;
      fail += s.fail;
      if (s.lat != null) {
        latSum += s.lat * s.ok;
        latN += s.ok;
      }
    }
    const span = Math.max(1, this.series.length - from);
    return { success: ok + fail ? ok / (ok + fail) : null, latency: latN ? latSum / latN : null, rate: (ok + fail) / span };
  }

  /** パーツの置き方を変える（本番の途中でも） */
  setPlacements(placements: readonly Placement[]) {
    const want = new Map(placements.map((p) => [p.slot, p]));
    for (const node of [...this.nodes.values()]) {
      const p = want.get(node.id);
      if (!p || p.kind !== node.kind) this.removeNode(node);
    }
    for (const p of placements) {
      const node = this.nodes.get(p.slot);
      const s = partSize(p.kind, p.size);
      if (!node) {
        this.nodes.set(p.slot, {
          id: p.slot,
          kind: p.kind,
          size: p.size,
          cap: s.cap,
          qmax: s.queue,
          busy: [],
          wait: [],
          incoming: 0,
          down: false,
          downAt: -Infinity,
          upAt: -Infinity,
          recoverAt: Infinity,
          lbKnowsDown: false,
          served: 0,
          dropped: 0,
          warm: 0,
          hits: 0,
          misses: 0,
          blocked: 0,
          jobs: [],
          activity: 0,
        });
      } else if (node.size !== p.size) {
        node.size = p.size;
        node.cap = s.cap;
        node.qmax = s.queue;
      }
    }
    if (!this.primaryDb || !this.nodes.has(this.primaryDb)) {
      this.primaryDb = (this.nodes.get("db") ?? this.nodes.get("replica"))?.id ?? null;
    }
    this.m.peakCost = Math.max(this.m.peakCost, this.cost());
  }

  /** 時間を進める（細かく区切って計算するので、速さを変えても結果は同じ） */
  step(dt: number) {
    let left = dt;
    while (left > 1e-9 && !this.finished) {
      const h = Math.min(left, 1 / 60, this.setup.duration - this.now);
      if (h <= 0) break;
      this.tick(h);
      left -= h;
    }
  }

  /** パーツを止める（事件・ラボのボタン） */
  crash(target: "app" | "db", duration: number, index?: number): boolean {
    const node = target === "db" ? this.primary() : this.pickCrashApp(index);
    if (!node || node.down) return false;
    this.crashNode(node, duration);
    return true;
  }

  /** キャッシュ・CDN のヒット率（いま） */
  hitRate(node: SimNode): number {
    if (node.kind === "cache") return CACHE_MAX_HIT * Math.min(1, node.warm / CACHE_WARM);
    if (node.kind === "cdn") return CDN_MAX_HIT * Math.min(1, node.warm / CDN_WARM);
    return 0;
  }

  /* ------------------------------------------------------------ 1こま */

  private tick(h: number) {
    this.now += h;
    const now = this.now;

    while (this.eventIdx < this.events.length && this.events[this.eventIdx]!.t <= now) this.runEvent(this.events[this.eventIdx++]!);
    for (const node of this.nodes.values()) if (node.down && now >= node.recoverAt) this.recover(node);
    this.checkHealth();

    const rates = this.setup.traffic(now);
    for (const type of REQ_TYPES) {
      const r = rates[type] ?? 0;
      if (r <= 0) continue;
      let acc = (this.acc.get(type) ?? 0) + r * h;
      let thr = this.thr.get(type) ?? 1;
      while (acc >= thr) {
        acc -= thr;
        thr = this.expo();
        this.spawn(type);
      }
      this.acc.set(type, acc);
      this.thr.set(type, thr);
    }

    const reqs = this.reqs;
    for (let i = 0; i < reqs.length; i++) {
      const r = reqs[i]!;
      if (r.state === "travel" && r.t1 <= now) this.arrive(r);
    }

    for (const id of SLOT_ORDER) {
      const node = this.nodes.get(id);
      if (!node || node.down) continue;
      if (node.busy.some((r) => r.doneAt <= now)) {
        const done = node.busy.filter((r) => r.doneAt <= now);
        node.busy = node.busy.filter((r) => r.doneAt > now);
        for (const r of done) {
          node.served++;
          this.afterService(r, node);
        }
      }
      while (node.busy.length < node.cap && node.wait.length) this.startService(node, node.wait.shift()!);
    }
    this.pullJobs();

    for (let i = 0; i < reqs.length; i++) {
      const r = reqs[i]!;
      if (r.state === "gone") continue;
      if ((LEGIT.has(r.kind) || r.kind === "attack") && now - r.born > TIMEOUT) this.fail(r, "timeout");
      else if (r.kind === "job" && r.state === "wait" && now - r.born > JOB_DEADLINE) this.fail(r, "late");
    }
    if (this.reqs.some((r) => r.state === "gone")) this.reqs = this.reqs.filter((r) => r.state !== "gone");

    const cost = this.cost();
    this.m.costAcc += cost * h;
    this.m.peakCost = Math.max(this.m.peakCost, cost);
    const fade = Math.exp(-h * 2.2);
    for (const node of this.nodes.values()) node.activity *= fade;
    const calm = Math.exp(-h * 0.22);
    for (const u of this.users) u.mood *= calm;

    if (now >= this.nextSample) {
      this.series.push({
        t: Math.round(now),
        ok: this.sec.ok,
        fail: this.sec.fail,
        lat: this.sec.latN ? this.sec.latSum / this.sec.latN : null,
        cost,
      });
      if (!Number.isFinite(this.setup.duration) && this.series.length > 240) this.series.shift();
      this.sec = { ok: 0, fail: 0, latSum: 0, latN: 0 };
      this.nextSample += 1;
    }
  }

  /* ------------------------------------------------------------ 生まれる・動く */

  private expo() {
    return -Math.log(1 - this.rand());
  }

  private spawn(type: ReqType) {
    const bot = type === "attack";
    const ui = bot ? -1 : this.pickUser();
    const user = this.users[ui];
    const at = bot ? "bot" : `u${ui}`;
    const req: SimReq = {
      id: this.nextId++,
      kind: type,
      user: ui,
      far: user?.far ?? false,
      born: this.now,
      at,
      state: "travel",
      from: at,
      to: at,
      t0: this.now,
      t1: this.now,
      returning: false,
      stack: [],
      doneAt: 0,
      dns: false,
      needDb: false,
      fillCache: false,
      viaCdn: false,
      miss: false,
      async: false,
      inc: null,
    };
    this.reqs.push(req);
    if (bot) this.m.attacks++;
    if (user && this.setup.requiresDns) {
      if (user.dnsUntil <= this.now) {
        const dns = this.nodes.get("dns");
        if (!dns) {
          this.tip("dns-missing");
          this.fail(req, "dns");
          return;
        }
        req.dns = true;
        this.tip("dns-first");
        this.forward(req, dns.id);
        return;
      }
      this.tip("dns-cached");
    }
    this.sendToEntry(req);
  }

  private pickUser(): number {
    const far = this.rand() < this.setup.farRatio;
    const pool = this.users.flatMap((u, i) => (u.far === far ? [i] : []));
    const list = pool.length ? pool : this.users.map((_, i) => i);
    return list[Math.floor(this.rand() * list.length)] ?? 0;
  }

  private sendToEntry(req: SimReq) {
    const cdn = req.kind === "static" ? this.nodes.get("cdn") : undefined;
    const target = cdn ? cdn.id : this.originEntry();
    if (!target) {
      this.tip("no-server");
      this.fail(req, "noserver");
      return;
    }
    if (!this.nodes.has("lb") && this.apps().length >= 2 && req.kind !== "attack") this.tip("unused-app");
    this.forward(req, target);
  }

  private travelTime(from: string, to: string, req: SimReq): number {
    const userEnd = isUserId(from) ? to : isUserId(to) ? from : null;
    if (userEnd) {
      const kind = this.nodes.get(userEnd as SlotId)?.kind;
      if (kind === "dns") return req.far ? TRAVEL.userDnsFar : TRAVEL.userDnsNear;
      if (kind === "cdn") return TRAVEL.userCdn;
      return req.far ? TRAVEL.userOriginFar : TRAVEL.userOriginNear;
    }
    const a = this.nodes.get(from as SlotId)?.kind;
    const b = this.nodes.get(to as SlotId)?.kind;
    if (a === "cdn" || b === "cdn") return TRAVEL.cdnOrigin;
    const data = (k: PartKind | undefined) => k === "db" || k === "replica";
    if (data(a) || data(b)) return TRAVEL.data;
    return TRAVEL.internal;
  }

  private travel(req: SimReq, to: string) {
    req.state = "travel";
    req.from = req.at;
    req.to = to;
    req.t0 = this.now;
    req.t1 = this.now + this.travelTime(req.from, to, req);
    if (!req.returning) {
      const node = this.nodes.get(to as SlotId);
      if (node) {
        node.incoming++;
        req.inc = node.id;
      }
    }
  }

  private forward(req: SimReq, to: string) {
    req.returning = false;
    req.stack.push(req.at);
    this.travel(req, to);
  }

  private respond(req: SimReq) {
    req.returning = true;
    const next = req.stack.pop();
    if (next === undefined) {
      this.complete(req);
      return;
    }
    this.travel(req, next);
  }

  private releaseIncoming(req: SimReq) {
    if (!req.inc) return;
    const node = this.nodes.get(req.inc);
    if (node) node.incoming = Math.max(0, node.incoming - 1);
    req.inc = null;
  }

  private arrive(req: SimReq) {
    this.releaseIncoming(req);
    const to = req.to;
    req.at = to;
    if (isUserId(to)) {
      if (req.dns) {
        req.dns = false;
        const user = this.users[req.user];
        if (user) user.dnsUntil = this.now + DNS_TTL;
        this.sendToEntry(req);
        return;
      }
      this.complete(req);
      return;
    }
    const node = this.nodes.get(to as SlotId);
    if (req.kind === "repl") {
      req.state = "gone";
      if (node) node.activity += 0.4;
      return;
    }
    if (!node) {
      // 帰り道のパーツが外されていたら、とばして次へ
      if (req.returning) this.respond(req);
      else this.fail(req, "down");
      return;
    }
    if (node.down) {
      this.fail(req, "down");
      return;
    }
    if (req.returning) {
      this.passBack(req, node);
      return;
    }
    this.enqueue(node, req);
  }

  private enqueue(node: SimNode, req: SimReq) {
    if (node.busy.length < node.cap) this.startService(node, req);
    else if (node.wait.length < node.qmax) {
      req.state = "wait";
      node.wait.push(req);
      if (node.kind === "db" || node.kind === "replica") {
        if (node.wait.length >= 4) this.tip("db-busy");
      }
    } else {
      node.dropped++;
      this.fail(req, "busy");
    }
  }

  private startService(node: SimNode, req: SimReq) {
    req.state = "service";
    req.at = node.id;
    req.doneAt = this.now + this.serviceTime(node, req) * (0.75 + this.rand() * 0.5);
    node.busy.push(req);
    node.activity += 1;
  }

  private serviceTime(node: SimNode, req: SimReq): number {
    switch (node.kind) {
      case "dns":
        return SERVICE.dns;
      case "cdn":
        return SERVICE.cdn;
      case "waf":
        return SERVICE.waf;
      case "lb":
        return SERVICE.lb;
      case "cache":
        return SERVICE.cache;
      case "queue":
        return SERVICE.queue;
      case "worker":
        return SERVICE.worker;
      case "db":
      case "replica":
        return req.kind === "write" ? SERVICE.db.write : req.kind === "job" ? SERVICE.db.job : SERVICE.db.read;
      case "app": {
        if (req.kind === "heavy") {
          const q = this.nodes.get("queue");
          req.async = Boolean(q && !q.down);
          return req.async ? SERVICE.app.heavyQueued : SERVICE.app.heavy;
        }
        if (req.kind === "static") return SERVICE.app.static;
        if (req.kind === "write") return SERVICE.app.write;
        if (req.kind === "attack") return SERVICE.app.attack;
        return SERVICE.app.page;
      }
    }
  }

  /* ------------------------------------------------------------ 処理が終わったら */

  private afterService(req: SimReq, node: SimNode) {
    switch (node.kind) {
      case "dns":
        this.respond(req);
        return;
      case "cdn": {
        if (req.kind === "static") {
          if (this.rand() < this.hitRate(node)) {
            node.hits++;
            this.text(node.id, "HIT", "#34d6b8");
            this.tip("cdn-hit");
            this.respond(req);
            return;
          }
          node.misses++;
          req.viaCdn = true;
        }
        const origin = this.originEntry();
        if (!origin) this.fail(req, "noserver");
        else this.forward(req, origin);
        return;
      }
      case "waf": {
        if (req.kind === "attack" && this.rand() < WAF_BLOCK) {
          node.blocked++;
          this.m.blocked++;
          req.state = "gone";
          this.text(node.id, "ブロック", "#ff8fa3");
          this.fx.push({ kind: "burst", at: node.id, color: "#ff6f8a", n: 5 });
          this.tip("waf-block");
          return;
        }
        const next = this.lbOrApp();
        if (!next) this.fail(req, "noserver");
        else this.forward(req, next);
        return;
      }
      case "lb": {
        const app = this.pickApp();
        if (!app) {
          this.fail(req, this.apps().length ? "down" : "noserver");
          return;
        }
        this.lbSent++;
        if (this.lbSent > 10 && this.apps().filter((a) => !a.lbKnowsDown).length >= 2) this.tip("lb-spread");
        this.forward(req, app.id);
        return;
      }
      case "app":
        this.appDone(req, node);
        return;
      case "cache": {
        if (this.rand() < this.hitRate(node)) {
          node.hits++;
          this.text(node.id, "HIT", "#c8f56e");
          this.tip("cache-hit");
          this.respond(req);
          return;
        }
        node.misses++;
        req.needDb = true;
        req.miss = true;
        this.tip("cache-miss");
        this.respond(req);
        return;
      }
      case "db":
      case "replica": {
        if (req.kind === "write" || req.kind === "job") {
          if (req.kind === "write") {
            const cache = this.nodes.get("cache");
            if (cache) cache.warm = Math.max(0, cache.warm - 0.6);
          }
          this.replicate(node);
        }
        if (req.kind === "page") this.tip("db-first");
        if (req.kind === "job") {
          this.jobDone(req, node);
          return;
        }
        this.respond(req);
        return;
      }
      case "queue": {
        if (node.jobs.length >= QUEUE_MAX_JOBS) {
          node.dropped++;
          this.fail(req, "busy");
          return;
        }
        node.jobs.push(this.makeJob(req, node));
        this.m.jobsMade++;
        this.tip("queue-ack");
        if (node.jobs.length >= 10) this.tip("backlog");
        this.respond(req);
        return;
      }
      case "worker": {
        const db = this.primary();
        if (db) {
          this.forward(req, db.id);
          return;
        }
        this.jobDone(req, node);
        return;
      }
    }
  }

  /** 裏の仕事が終わった（加工の完了も、成功に数える） */
  private jobDone(req: SimReq, node: SimNode) {
    req.state = "gone";
    this.m.jobsDone++;
    this.m.ok++;
    this.sec.ok++;
    this.text(node.id, "完成", "#ffb27a");
  }

  private appDone(req: SimReq, node: SimNode) {
    switch (req.kind) {
      case "attack":
        this.m.attackHit++;
        req.state = "gone";
        this.text(node.id, "被害", FAIL_COLOR);
        this.tip("attack-hit");
        return;
      case "static":
        this.respond(req);
        return;
      case "heavy": {
        const q = this.nodes.get("queue");
        if (req.async && q && !q.down) {
          this.forward(req, q.id);
          return;
        }
        this.tip("heavy-sync");
        this.respond(req);
        return;
      }
      case "page": {
        if (this.dbs().length) {
          const cache = this.nodes.get("cache");
          if (cache && !cache.down) {
            this.forward(req, cache.id);
            return;
          }
          const db = this.pickReadDb();
          if (db) this.forward(req, db.id);
          else this.fail(req, "down");
          return;
        }
        // データベースがないと、投稿はそれを受けたサーバーにだけ残る
        const user = this.users[req.user];
        if (user?.lastWrite && user.lastWrite !== node.id && this.nodes.has(user.lastWrite)) {
          this.tip("missing-data");
          this.fail(req, "missing");
          return;
        }
        this.respond(req);
        return;
      }
      case "write": {
        const db = this.primary();
        if (db) {
          this.forward(req, db.id);
          return;
        }
        const user = this.users[req.user];
        if (user) user.lastWrite = node.id;
        this.respond(req);
        return;
      }
      default:
        this.respond(req);
    }
  }

  /** 返事がパーツを通りぬけるとき */
  private passBack(req: SimReq, node: SimNode) {
    node.activity += 0.3;
    if (node.kind === "app" && req.needDb) {
      req.needDb = false;
      req.miss = false;
      req.fillCache = true;
      const db = this.pickReadDb();
      if (db) this.forward(req, db.id);
      else this.fail(req, "down");
      return;
    }
    if (node.kind === "app" && req.fillCache) {
      req.fillCache = false;
      const cache = this.nodes.get("cache");
      if (cache && !cache.down) cache.warm = Math.min(CACHE_WARM * 1.5, cache.warm + 1);
    }
    if (node.kind === "cdn" && req.viaCdn) {
      req.viaCdn = false;
      node.warm = Math.min(CDN_WARM * 1.5, node.warm + 1);
    }
    this.respond(req);
  }

  private makeJob(req: SimReq, queue: SimNode): SimReq {
    const job: SimReq = {
      ...req,
      id: this.nextId++,
      kind: "job",
      born: this.now,
      at: queue.id,
      state: "wait",
      from: queue.id,
      to: queue.id,
      t0: this.now,
      t1: this.now,
      returning: false,
      stack: [],
      inc: null,
    };
    this.reqs.push(job);
    return job;
  }

  private replicate(from: SimNode) {
    for (const other of this.dbs()) {
      if (other === from || other.down) continue;
      const r: SimReq = {
        id: this.nextId++,
        kind: "repl",
        user: -1,
        far: false,
        born: this.now,
        at: from.id,
        state: "travel",
        from: from.id,
        to: other.id,
        t0: this.now,
        t1: this.now + TRAVEL.data * 1.4,
        returning: false,
        stack: [],
        doneAt: 0,
        dns: false,
        needDb: false,
        fillCache: false,
        viaCdn: false,
        miss: false,
        async: false,
        inc: null,
      };
      this.reqs.push(r);
      this.tip("repl");
    }
  }

  private pullJobs() {
    const q = this.nodes.get("queue");
    if (!q || q.down || !q.jobs.length) return;
    for (const id of ["worker1", "worker2"] as const) {
      const w = this.nodes.get(id);
      if (!w || w.down) continue;
      while (w.busy.length + w.incoming < w.cap && q.jobs.length) {
        const job = q.jobs.shift()!;
        job.at = q.id;
        this.forward(job, w.id);
      }
    }
  }

  private complete(req: SimReq) {
    req.state = "gone";
    if (!LEGIT.has(req.kind)) return;
    const lat = (this.now - req.born) * MS_PER_SEC;
    this.m.ok++;
    this.m.latSum += lat;
    this.m.latN++;
    this.sec.ok++;
    this.sec.latSum += lat;
    this.sec.latN++;
    const user = this.users[req.user];
    if (user) {
      user.mood = Math.min(3, user.mood + (lat <= 260 ? 0.55 : lat <= 400 ? 0.15 : -0.35));
      user.okAt = this.now;
    }
    this.tip("first-ok");
    if (req.far && lat > 300 && !this.nodes.has("cdn")) this.tip("far-slow");
  }

  private fail(req: SimReq, reason: FailReason) {
    if (req.state === "gone") return;
    const traveling = req.state === "travel";
    const where = traveling ? { at: req.from, to: req.to, p: Math.min(1, Math.max(0, (this.now - req.t0) / Math.max(1e-6, req.t1 - req.t0))) } : { at: req.at };
    if (req.state === "wait" || req.state === "service") {
      const node = this.nodes.get(req.at as SlotId);
      if (node) {
        if (req.state === "wait") {
          node.wait = node.wait.filter((r) => r !== req);
          node.jobs = node.jobs.filter((r) => r !== req);
        } else node.busy = node.busy.filter((r) => r !== req);
      }
    }
    this.releaseIncoming(req);
    req.state = "gone";
    if (req.kind === "repl" || req.kind === "attack") return;
    if (req.kind === "job") this.m.jobsFailed++;
    this.m.fail++;
    this.m.failBy[reason]++;
    this.sec.fail++;
    const user = this.users[req.user];
    if (user) {
      user.mood = Math.max(-3, user.mood - 1.5);
      user.failAt = this.now;
    }
    this.fx.push({ kind: "text", ...where, text: FAIL_LABEL[reason], color: FAIL_COLOR });
    this.fx.push({ kind: "burst", ...where, color: FAIL_COLOR, n: 4 });
    if (reason === "busy" && this.nodes.get(req.at as SlotId)?.kind === "app") this.tip("busy");
    if (reason === "timeout") this.tip("timeout");
  }

  /* ------------------------------------------------------------ 行き先を決める */

  /** サーバー（1台目から順に） */
  apps(): SimNode[] {
    const out: SimNode[] = [];
    for (const id of ["app1", "app2", "app3", "app4"] as const) {
      const n = this.nodes.get(id);
      if (n) out.push(n);
    }
    return out;
  }

  /** データベース（本番と予備） */
  dbs(): SimNode[] {
    const out: SimNode[] = [];
    for (const id of ["db", "replica"] as const) {
      const n = this.nodes.get(id);
      if (n) out.push(n);
    }
    return out;
  }

  primary(): SimNode | null {
    return this.primaryDb ? this.nodes.get(this.primaryDb) ?? null : null;
  }

  /** 外から入ってくる入口（WAF → ロードバランサー → 1台目のサーバー の順にあるもの） */
  private originEntry(): string | null {
    return this.nodes.get("waf")?.id ?? this.lbOrApp();
  }

  private lbOrApp(): string | null {
    return this.nodes.get("lb")?.id ?? this.apps()[0]?.id ?? null;
  }

  /** ロードバランサーの振り分け：止まっていると気づいたサーバーはのぞいて、いちばんすいているところへ */
  private pickApp(): SimNode | null {
    const apps = this.apps().filter((a) => !a.lbKnowsDown);
    if (!apps.length) return null;
    let best: SimNode | null = null;
    let bestLoad = Infinity;
    for (let k = 0; k < apps.length; k++) {
      const a = apps[(this.rr + k) % apps.length]!;
      const load = (a.busy.length + a.wait.length + a.incoming) / a.cap;
      if (load < bestLoad - 1e-9) {
        best = a;
        bestLoad = load;
      }
    }
    this.rr = (this.rr + 1) % apps.length;
    return best;
  }

  /** 読みこみは、動いている DB（本番・予備）のうち、すいているほうへ */
  private pickReadDb(): SimNode | null {
    let best: SimNode | null = null;
    let bestLoad = Infinity;
    for (const d of this.dbs()) {
      if (d.down) continue;
      const load = (d.busy.length + d.wait.length + d.incoming) / d.cap;
      if (load < bestLoad) {
        best = d;
        bestLoad = load;
      }
    }
    return best ?? this.primary();
  }

  private pickCrashApp(index?: number): SimNode | null {
    const apps = this.apps().filter((a) => !a.down);
    if (!apps.length) return null;
    if (index != null) return apps[Math.min(index, apps.length - 1)] ?? null;
    let best = apps[0]!;
    for (const a of apps) if (a.busy.length + a.wait.length > best.busy.length + best.wait.length) best = a;
    return best;
  }

  /* ------------------------------------------------------------ 事件 */

  private runEvent(e: StageEvent) {
    if (e.kind === "banner") {
      this.banners.push({ text: e.text, tone: e.tone ?? "info" });
      return;
    }
    this.crash(e.target, e.duration, e.index);
  }

  private crashNode(node: SimNode, duration: number) {
    node.down = true;
    node.downAt = this.now;
    node.recoverAt = this.now + duration;
    for (const r of [...node.busy, ...node.wait]) this.fail(r, "down");
    node.busy = [];
    node.wait = [];
    this.text(node.id, "停止！", FAIL_COLOR, true);
    this.fx.push({ kind: "burst", at: node.id, color: "#ff9a5c", n: 14 });
    this.banners.push({ text: `${slotLabel(node.id)} が止まった！`, tone: "danger" });
    const others = node.kind === "app" ? this.apps().filter((a) => a !== node && !a.down) : this.dbs().filter((d) => d !== node && !d.down);
    if (!others.length || (node.kind === "app" && !this.nodes.has("lb"))) this.tip("spof");
  }

  private recover(node: SimNode) {
    node.down = false;
    node.upAt = this.now;
    node.recoverAt = Infinity;
    this.text(node.id, "復旧", "#7cf5be", true);
    this.banners.push({ text: `${slotLabel(node.id)} が復旧しました`, tone: "good" });
  }

  private checkHealth() {
    const now = this.now;
    for (const a of this.apps()) {
      if (a.down && !a.lbKnowsDown && now - a.downAt >= HEALTH_DELAY) {
        a.lbKnowsDown = true;
        const lb = this.nodes.get("lb");
        if (lb && this.apps().some((x) => !x.down)) {
          this.text(lb.id, "ヘルスチェック", "#ffc857");
          this.tip("health");
        }
      }
      if (!a.down && a.lbKnowsDown && now - a.upAt >= HEALTH_DELAY) a.lbKnowsDown = false;
    }
    const p = this.primary();
    if (p && p.down && now - p.downAt >= FAILOVER_DELAY) {
      const next = this.dbs().find((d) => d !== p && !d.down);
      if (next) {
        this.primaryDb = next.id;
        this.text(next.id, "本番に昇格", "#d3c2ff", true);
        this.banners.push({ text: "フェイルオーバー：予備DBが本番になりました", tone: "good" });
        this.tip("failover");
      }
    }
  }

  private removeNode(node: SimNode) {
    for (const r of [...node.busy, ...node.wait, ...node.jobs]) this.fail(r, "down");
    this.nodes.delete(node.id);
    for (const r of this.reqs) if (r.inc === node.id) r.inc = null;
    if (this.primaryDb === node.id) this.primaryDb = null;
  }

  /* ------------------------------------------------------------ 小物 */

  private tip(id: TipId) {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.tips.push(id);
  }

  private text(at: string, text: string, color: string, big = false) {
    this.fx.push({ kind: "text", at, text, color, big });
  }
}
