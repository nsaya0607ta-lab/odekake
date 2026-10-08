/**
 * インフラのシミュレーター（React に依存しない。乱数は種つきなので、同じ条件なら毎回同じ結果になる）。
 *
 * アクセス（リクエスト）は、利用者 → 入口 → … → サーバー → … と1マスずつ移動し、
 * 各パーツで「同時に処理できる数」だけ並行して処理される。いっぱいなら待ち行列、待ち行列もいっぱいなら 503。
 * 返事（レスポンス）は、来た道を逆にたどって利用者へもどる。
 * くわしいルールは docs/infra-app.md の「シミュレーションのルール」。
 */
import {
  BACKUP_DETECT,
  BACKUP_EVERY,
  BOOT_TIME,
  CACHE_MAX_HIT,
  CACHE_WARM,
  CDN_MAX_HIT,
  CDN_WARM,
  DNS_HEALTH_DELAY,
  DNS_TTL,
  DNS_TTL_SHORT,
  FAILOVER_DELAY,
  HEALTH_DELAY,
  JOB_DEADLINE,
  MONITOR_DETECT,
  MS_PER_SEC,
  QUEUE_MAX_JOBS,
  REQ_TYPES,
  RESTART_TIME,
  RESTORE_TIME,
  SCALE_IN_COOLDOWN,
  SCALE_IN_LOAD,
  SCALE_OUT_COOLDOWN,
  SCALE_OUT_LOAD,
  SERVICE,
  SLOW_FACTOR,
  TIMEOUT,
  TRAVEL,
  USER_COUNT,
  WAF_BLOCK,
  PARTS,
  compareIds,
  partCost,
  partSize,
  slotLabel,
  type NodeId,
  type PartKind,
  type Placement,
  type ReqType,
} from "./model";
import { USERS, computeLinks, type Link } from "./layout";

export type Rates = Partial<Record<ReqType, number>>;
export type Tone = "info" | "warn" | "danger" | "good";

export type StageEvent =
  | { t: number; kind: "crash"; target: "app" | "db"; index?: number; duration: number }
  /** サーバーの調子が悪くなる（止まらないが、とても遅い） */
  | { t: number; kind: "slow"; index?: number; duration: number }
  /** データベースの中身が消える（予備DB にも写ってしまう） */
  | { t: number; kind: "wipe" }
  /** いつもの拠点がまるごと止まる（停電など）。DNS・CDN・予備の拠点は動いている */
  | { t: number; kind: "outage"; duration: number }
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

export type FailReason = "busy" | "timeout" | "down" | "dns" | "missing" | "noserver" | "late" | "lost";

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
  | "timeout"
  | "scale-out"
  | "scale-in"
  | "slow"
  | "monitor-alert"
  | "wipe"
  | "repl-lost"
  | "restore"
  | "backup-late"
  | "outage"
  | "dns-failover"
  | "ttl-stale";

/** 画面の効果。at はパーツのマス・利用者（"u0"…）・ロボット（"bot"）。to と p があれば、その道の途中 */
export type Fx =
  | { kind: "text"; at: string; to?: string; p?: number; text: string; color: string; big?: boolean }
  | { kind: "burst"; at: string; to?: string; p?: number; color: string; n: number };

export type Banner = { text: string; tone: Tone };

/** job = 裏の仕事、repl = 予備DB への写し、snap = バックアップの保存 */
export type ReqKind = ReqType | "job" | "repl" | "snap";

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
  inc: NodeId | null;
};

export type SimNode = {
  id: NodeId;
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
  /** オートスケールで休んでいる（月額がかからない） */
  asleep: boolean;
  /** 起きている途中（この時刻までは仕事を受けない） */
  bootUntil: number;
  /** 休む準備中（新しい仕事は受けず、手もちが終わったら休む） */
  draining: boolean;
  /** 調子が悪い（この時刻まで処理が遅い）。監視が気づくと再起動で直る */
  slowUntil: number;
  slowAt: number;
  /** 監視が、いまの故障・不調に気づいている */
  alerted: boolean;
  /** 止まった理由（再起動・停電のときは、お知らせを出しすぎない） */
  downKind: "crash" | "restart" | "outage";
  /** データが消えている（DB） */
  lost: boolean;
};

/** site … DNS に教わった行き先（いつもの拠点か、予備の拠点か） */
export type SimUser = { far: boolean; dnsUntil: number; site: "main" | "region"; lastWrite: NodeId | null; mood: number; okAt: number; failAt: number };

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
const FAIL_LABEL: Record<FailReason, string> = { busy: "503", timeout: "504", down: "×", dns: "?", missing: "データなし", noserver: "×", late: "期限切れ", lost: "消えた" };
const FAIL_COLOR = "#ff6b81";
const DB_KINDS: readonly PartKind[] = ["db", "replica"];
const ENTRY_KINDS: readonly PartKind[] = ["waf", "lb", "app"];
/** 停電でも止まらないパーツ（いつもの拠点の外にある） */
const OUTSIDE = new Set<PartKind>(["dns", "cdn", "region", "monitor", "backup"]);

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
  readonly nodes = new Map<NodeId, SimNode>();
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
  primaryDb: NodeId | null = null;
  /** DNS が「いつもの拠点が止まっている」と気づいているか */
  dnsKnowsMainDown = false;
  /** いちばん新しいバックアップの時刻 */
  lastSnapshot = -Infinity;
  /** 元にもどし終わる時刻（もどしている最中でなければ Infinity） */
  restoreAt = Infinity;

  private readonly rand: () => number;
  private nextId = 1;
  private readonly acc = new Map<ReqType, number>();
  private readonly thr = new Map<ReqType, number>();
  private readonly events: StageEvent[];
  private eventIdx = 0;
  private sec = { ok: 0, fail: 0, latSum: 0, latN: 0 };
  private nextSample = 1;
  private rr = 0;
  private rrEntry = 0;
  private lbSent = 0;
  /** 置いてあるパーツ（処理する順） */
  private order: SimNode[] = [];
  /** つながり（a → そこからつながっている先。つないだ順） */
  private out = new Map<string, NodeId[]>();
  private linkSet = new Set<string>();
  /** オートスケールが見ている混み具合（なめらかにしたもの）と、次に動ける時刻 */
  private autoLoad = 0;
  private autoNext = 0;
  private nextSnapshot = 1;
  private wipedAt = -Infinity;
  private lateNoticed = false;
  /** いつもの拠点が止まった時刻・もどる時刻 */
  private mainDownAt = -Infinity;
  private mainUpAt = -Infinity;
  private outageNotice = false;

  /** links を省くと、置いたパーツからふつうのつなぎ方を決める（ステージ）。ラボでは自分でつないだリンクをわたす */
  constructor(setup: SimSetup, placements: readonly Placement[], seed = 1, links?: readonly Link[]) {
    this.setup = setup;
    this.rand = mulberry32(seed);
    const farCount = Math.round(setup.farRatio * USER_COUNT);
    this.users = Array.from({ length: USER_COUNT }, (_, i) => ({
      far: i >= USER_COUNT - farCount,
      dnsUntil: -1,
      site: "main",
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
      failBy: { busy: 0, timeout: 0, down: 0, dns: 0, missing: 0, noserver: 0, late: 0, lost: 0 },
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
    this.setPlacements(placements, links);
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

  /** いまの月額（オートスケールで休んでいるサーバーはかからない） */
  cost(): number {
    let sum = 0;
    for (const n of this.nodes.values()) if (!n.asleep) sum += partCost(n.kind, n.size);
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

  /** パーツの置き方・つなぎ方を変える（本番の途中でも）。links を省くと、ふつうのつなぎ方 */
  setPlacements(placements: readonly Placement[], links?: readonly Link[]) {
    const want = new Map(placements.map((p) => [p.slot, p]));
    for (const node of [...this.nodes.values()]) {
      const p = want.get(node.id);
      if (!p || p.kind !== node.kind) this.removeNode(node);
    }
    const created: SimNode[] = [];
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
          asleep: false,
          bootUntil: -Infinity,
          draining: false,
          slowUntil: -Infinity,
          slowAt: -Infinity,
          alerted: false,
          downKind: "crash",
          lost: false,
        });
        created.push(this.nodes.get(p.slot)!);
      } else if (node.size !== p.size) {
        node.size = p.size;
        node.cap = s.cap;
        node.qmax = s.queue;
      }
    }
    this.order = [...this.nodes.values()].sort((a, b) => compareIds(a.id, b.id));
    this.out.clear();
    this.linkSet.clear();
    for (const l of links ?? computeLinks(this.nodes.keys())) {
      if (l.a !== USERS && !this.nodes.has(l.a)) continue;
      if (!this.nodes.has(l.b) || this.linkSet.has(`${l.a}>${l.b}`)) continue;
      this.linkSet.add(`${l.a}>${l.b}`);
      const list = this.out.get(l.a);
      if (list) list.push(l.b);
      else this.out.set(l.a, [l.b]);
    }
    if (!this.primaryDb || !this.nodes.has(this.primaryDb)) {
      this.primaryDb = (this.nodes.get("db") ?? this.dbs()[0])?.id ?? null;
    }
    // オートスケールが見ているサーバーは、新しく置いたら休んだ状態から（すでに起きているサーバーがあるとき）。
    // オートスケールを外したら（見られていないサーバーは）、休んでいたサーバーはみんな起こす
    const auto = this.nodes.get("auto");
    const watched = auto ? this.next(auto.id, ["app"]) : [];
    let awake = watched.some((a) => !created.includes(a) && !a.asleep && !a.down);
    for (const a of this.apps()) {
      if (watched.includes(a)) {
        if (!created.includes(a)) continue;
        if (awake) a.asleep = true;
        else awake = true;
        continue;
      }
      if (a.asleep) a.bootUntil = this.now + BOOT_TIME;
      a.asleep = false;
      a.draining = false;
    }
    // 消えたデータは、新しく置いた DB にもない（写しをもらうので）
    if (this.dbs().some((d) => d.lost)) for (const d of created) if (d.kind === "db" || d.kind === "replica") d.lost = true;
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

  /** サーバーの調子を悪くする（止まらないが、とても遅くなる） */
  slowDown(duration: number, index?: number): boolean {
    const node = this.pickCrashApp(index);
    if (!node || node.slowUntil > this.now) return false;
    node.slowUntil = this.now + duration;
    node.slowAt = this.now;
    node.alerted = false;
    this.text(node.id, "不調…", "#ffb35c", true);
    this.banners.push({ text: `🐢 ${slotLabel(node.id)} の調子が悪い…`, tone: "warn" });
    this.tip("slow");
    return true;
  }

  /** データベースの中身を消す（予備DB にも、消したことが写される） */
  wipe(): boolean {
    const dbs = this.dbs().filter((d) => !d.lost);
    if (!dbs.length) return false;
    this.wipedAt = this.now;
    this.restoreAt = Infinity;
    this.lateNoticed = false;
    for (const d of dbs) {
      d.lost = true;
      this.text(d.id, "消えた！", FAIL_COLOR, true);
      this.fx.push({ kind: "burst", at: d.id, color: "#94a3b8", n: 12 });
    }
    // 消えたデータは、キャッシュからも消す
    const cache = this.nodes.get("cache");
    if (cache) cache.warm = 0;
    this.banners.push({ text: "😱 うっかり DB の中身を消した！", tone: "danger" });
    this.tip("wipe");
    if (dbs.length >= 2) this.tip("repl-lost");
    return true;
  }

  /** いつもの拠点を、まるごと止める（停電）。DNS・CDN・予備の拠点・監視・バックアップは別の場所にあるので動いている */
  outage(duration: number): boolean {
    if (this.now < this.mainUpAt) return false;
    this.mainDownAt = this.now;
    this.mainUpAt = this.now + duration;
    this.outageNotice = true;
    for (const n of this.nodes.values()) {
      if (OUTSIDE.has(n.kind)) continue;
      if (!n.down) this.crashNode(n, duration, "outage");
      else {
        // もともと止まっていたパーツも、電気がもどるまでは直らない（監視の再起動も効かない）
        n.recoverAt = Math.max(n.recoverAt, this.mainUpAt);
        n.downKind = "outage";
      }
    }
    this.banners.push({ text: "⚡ 停電！ 拠点がまるごと止まった", tone: "danger" });
    this.tip("outage");
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
    if (this.outageNotice && now >= this.mainUpAt) {
      this.outageNotice = false;
      this.banners.push({ text: "拠点の電気がもどりました", tone: "good" });
    }
    this.checkHealth();
    this.checkMonitor();
    this.autoscale(h);
    this.checkBackup();

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

    for (const node of this.order) {
      if (node.down) continue;
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
        const dns = this.next(USERS, ["dns"])[0];
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
    // DNS が予備の拠点を教えていたら、そちらへ
    if (this.users[req.user]?.site === "region") {
      const region = this.next(USERS, ["region"])[0];
      if (region) {
        this.forward(req, region.id);
        return;
      }
    }
    const cdn = req.kind === "static" ? this.next(USERS, ["cdn"])[0] : undefined;
    const target = cdn ? cdn.id : this.entryFrom(USERS);
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
      const kind = this.nodes.get(userEnd)?.kind;
      if (kind === "dns") return req.far ? TRAVEL.userDnsFar : TRAVEL.userDnsNear;
      if (kind === "cdn") return TRAVEL.userCdn;
      if (kind === "region") return TRAVEL.userRegion;
      return req.far ? TRAVEL.userOriginFar : TRAVEL.userOriginNear;
    }
    const a = this.nodes.get(from)?.kind;
    const b = this.nodes.get(to)?.kind;
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
      const node = this.nodes.get(to);
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
        if (user) {
          user.dnsUntil = this.now + this.ttl();
          const region = this.next(USERS, ["region"])[0];
          user.site = this.dnsKnowsMainDown && region && !region.down ? "region" : "main";
        }
        this.sendToEntry(req);
        return;
      }
      this.complete(req);
      return;
    }
    const node = this.nodes.get(to);
    if (req.kind === "repl" || req.kind === "snap") {
      req.state = "gone";
      if (node) node.activity += 0.4;
      if (req.kind === "snap" && node?.kind === "backup" && !node.down) {
        node.served++;
        this.lastSnapshot = Math.max(this.lastSnapshot, req.born);
      }
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
    // オートスケールで休んでいるサーバーは、電源が切れているのと同じ
    if (node.asleep) {
      this.fail(req, "down");
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
      case "region":
        return req.kind === "heavy" ? SERVICE.app.heavy : SERVICE.region;
      case "auto":
      case "backup":
      case "monitor":
        return 0.05;
      case "db":
      case "replica":
        return req.kind === "write" ? SERVICE.db.write : req.kind === "job" ? SERVICE.db.job : SERVICE.db.read;
      case "app": {
        // 調子の悪いサーバーは、とても遅い
        const slow = node.slowUntil > this.now ? SLOW_FACTOR : 1;
        if (req.kind === "heavy") {
          const q = this.next(node.id, ["queue"])[0];
          req.async = Boolean(q && !q.down);
          return (req.async ? SERVICE.app.heavyQueued : SERVICE.app.heavy) * slow;
        }
        if (req.kind === "static") return SERVICE.app.static * slow;
        if (req.kind === "write") return SERVICE.app.write * slow;
        if (req.kind === "attack") return SERVICE.app.attack * slow;
        return SERVICE.app.page * slow;
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
        const origin = this.entryFrom(node.id);
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
        const next = this.entryFrom(node.id);
        if (!next) this.fail(req, "noserver");
        else this.forward(req, next);
        return;
      }
      case "lb": {
        const app = this.pickApp(node);
        if (!app) {
          this.fail(req, this.next(node.id, ["app"]).length ? "down" : "noserver");
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
      case "region":
        // 予備の拠点は、サーバーも DB もそろっているので、ここで返事ができる
        if (req.kind === "attack") {
          this.m.attackHit++;
          req.state = "gone";
          return;
        }
        this.respond(req);
        return;
      case "auto":
      case "backup":
      case "monitor":
        this.respond(req);
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
        // 中身が消えていると、読みに来ても何もない
        if (node.lost && req.kind === "page") {
          this.fail(req, "lost");
          return;
        }
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
        // 仕上がりを本番DB に書く（DB とつながっていなければ、ワーカーの中で終わり）
        const dbs = this.next(node.id, DB_KINDS);
        if (dbs.length) {
          const db = this.primary();
          if (db && dbs.includes(db)) this.forward(req, db.id);
          else this.fail(req, "down");
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
        const q = this.next(node.id, ["queue"])[0];
        if (req.async && q && !q.down) {
          this.forward(req, q.id);
          return;
        }
        this.tip("heavy-sync");
        this.respond(req);
        return;
      }
      case "page": {
        const dbs = this.next(node.id, DB_KINDS);
        if (dbs.length) {
          const cache = this.next(node.id, ["cache"])[0];
          if (cache && !cache.down) {
            this.forward(req, cache.id);
            return;
          }
          const db = this.pickReadDb(dbs);
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
        // 書きこみは本番DB だけ（予備DB は読みこみ専用）
        const dbs = this.next(node.id, DB_KINDS);
        if (dbs.length) {
          const db = this.primary();
          if (db && dbs.includes(db)) this.forward(req, db.id);
          else this.fail(req, "down");
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
      const db = this.pickReadDb(this.next(node.id, DB_KINDS));
      if (db) this.forward(req, db.id);
      else this.fail(req, "down");
      return;
    }
    if (node.kind === "app" && req.fillCache) {
      req.fillCache = false;
      const cache = this.next(node.id, ["cache"])[0];
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

  /** 書いたデータを、つながっている DB に写す（本番 → 予備。フェイルオーバーのあとは逆向きにも） */
  private replicate(from: SimNode) {
    for (const other of this.dbs()) {
      if (other === from || other.down || !(this.linked(from.id, other.id) || this.linked(other.id, from.id))) continue;
      this.sendPacket("repl", from.id, other.id, TRAVEL.data * 1.4);
      this.tip("repl");
    }
  }

  private pullJobs() {
    const q = this.nodes.get("queue");
    if (!q || q.down || !q.jobs.length) return;
    for (const w of this.next(q.id, ["worker"])) {
      if (w.down) continue;
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
      const node = this.nodes.get(req.at);
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
    if (reason === "busy" && this.nodes.get(req.at)?.kind === "app") this.tip("busy");
    if (reason === "timeout") this.tip("timeout");
    if (reason === "down" && this.dnsKnowsMainDown && user?.site === "main" && this.nodes.has("region")) this.tip("ttl-stale");
  }

  /* ------------------------------------------------------------ 行き先を決める */

  /** サーバー（1台目から順に） */
  apps(): SimNode[] {
    return this.order.filter((n) => n.kind === "app");
  }

  /** データベース（本番と予備） */
  dbs(): SimNode[] {
    return this.order.filter((n) => n.kind === "db" || n.kind === "replica");
  }

  /** a から b へつながっているか（a は USERS か、パーツの id） */
  linked(a: string, b: NodeId): boolean {
    return this.linkSet.has(`${a}>${b}`);
  }

  /** a からつながっている、その種類のパーツ（つないだ順） */
  next(a: string, kinds: readonly PartKind[]): SimNode[] {
    const out: SimNode[] = [];
    for (const id of this.out.get(a) ?? []) {
      const n = this.nodes.get(id);
      if (n && kinds.includes(n.kind)) out.push(n);
    }
    return out;
  }

  primary(): SimNode | null {
    return this.primaryDb ? this.nodes.get(this.primaryDb) ?? null : null;
  }

  /**
   * from（利用者・CDN・WAF）の次の行き先（WAF・ロードバランサー・サーバー）。
   * いくつもつながっていたら、順番に（DNS ラウンドロビン）。休んでいるサーバーは、ほかに行き先があればとばす
   */
  private entryFrom(from: string): NodeId | null {
    const all = this.next(from, ENTRY_KINDS);
    const list = all.length > 1 ? all.filter((n) => !n.asleep && !n.draining) : all;
    if (!list.length) return all[0]?.id ?? null;
    if (list.length === 1) return list[0]!.id;
    return list[this.rrEntry++ % list.length]!.id;
  }

  /** ロードバランサーの振り分け：止まっていると気づいたサーバー・休んでいるサーバーはのぞいて、いちばんすいているところへ */
  private pickApp(lb: SimNode): SimNode | null {
    const apps = this.next(lb.id, ["app"]).filter((a) => !a.lbKnowsDown && this.inService(a));
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

  /** 読みこみは、つながっている DB（本番・予備）のうち、動いていて、すいているほうへ */
  private pickReadDb(dbs: readonly SimNode[]): SimNode | null {
    let best: SimNode | null = null;
    let bestLoad = Infinity;
    for (const d of dbs) {
      if (d.down) continue;
      const load = (d.busy.length + d.wait.length + d.incoming) / d.cap;
      if (load < bestLoad) {
        best = d;
        bestLoad = load;
      }
    }
    const p = this.primary();
    return best ?? (p && dbs.includes(p) ? p : null);
  }

  /** オートスケールで休んでいない・起きている途中でない・休む準備中でない */
  private inService(a: SimNode): boolean {
    return !a.asleep && !a.draining && a.bootUntil <= this.now;
  }

  private pickCrashApp(index?: number): SimNode | null {
    const apps = this.apps().filter((a) => !a.down && !a.asleep);
    if (!apps.length) return null;
    if (index != null) return apps[Math.min(index, apps.length - 1)] ?? null;
    let best = apps[0]!;
    for (const a of apps) if (a.busy.length + a.wait.length > best.busy.length + best.wait.length) best = a;
    return best;
  }

  /* ------------------------------------------------------------ 事件 */

  private runEvent(e: StageEvent) {
    switch (e.kind) {
      case "banner":
        this.banners.push({ text: e.text, tone: e.tone ?? "info" });
        return;
      case "crash":
        this.crash(e.target, e.duration, e.index);
        return;
      case "slow":
        this.slowDown(e.duration, e.index);
        return;
      case "wipe":
        this.wipe();
        return;
      case "outage":
        this.outage(e.duration);
        return;
    }
  }

  private crashNode(node: SimNode, duration: number, kind: SimNode["downKind"] = "crash") {
    node.down = true;
    node.downAt = this.now;
    node.recoverAt = this.now + duration;
    node.downKind = kind;
    if (kind !== "restart") node.alerted = false;
    for (const r of [...node.busy, ...node.wait]) this.fail(r, "down");
    node.busy = [];
    node.wait = [];
    if (kind === "restart") {
      this.text(node.id, "再起動中", "#9cc4ff", true);
      return;
    }
    this.fx.push({ kind: "burst", at: node.id, color: "#ff9a5c", n: kind === "outage" ? 6 : 14 });
    if (kind === "outage") return;
    this.text(node.id, "停止！", FAIL_COLOR, true);
    this.banners.push({ text: `${slotLabel(node.id)} が止まった！`, tone: "danger" });
    const others = node.kind === "app" ? this.apps().filter((a) => a !== node && !a.down && !a.asleep) : this.dbs().filter((d) => d !== node && !d.down);
    if (!others.length || (node.kind === "app" && !this.nodes.has("lb"))) this.tip("spof");
  }

  private recover(node: SimNode) {
    node.down = false;
    node.upAt = this.now;
    node.recoverAt = Infinity;
    node.alerted = false;
    this.text(node.id, "復旧", "#7cf5be", true);
    if (node.downKind === "crash") this.banners.push({ text: `${slotLabel(node.id)} が復旧しました`, tone: "good" });
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
    // DNS も、いつもの拠点の様子を確かめている（止まっていたら、予備の拠点を教える）
    const mainDown = now < this.mainUpAt;
    if (mainDown && !this.dnsKnowsMainDown && now - this.mainDownAt >= DNS_HEALTH_DELAY && this.nodes.has("dns")) {
      this.dnsKnowsMainDown = true;
      const region = this.next(USERS, ["region"])[0];
      if (region && !region.down) {
        this.text("dns", "大阪へ案内", PARTS.region.color, true);
        this.banners.push({ text: "DNS：大阪の拠点へ案内を切りかえ", tone: "good" });
        this.tip("dns-failover");
      }
    }
    if (!mainDown && this.dnsKnowsMainDown && now - this.mainUpAt >= DNS_HEALTH_DELAY) this.dnsKnowsMainDown = false;
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

  /** 監視：止まった・遅くなったサーバーや DB に気づいて、自動で再起動する（停電のときは、電気がないので直せない） */
  private checkMonitor() {
    const mon = this.nodes.get("monitor");
    if (!mon || mon.down) return;
    const now = this.now;
    for (const node of this.next(mon.id, ["app", ...DB_KINDS])) {
      if (node.alerted) continue;
      if (node.down) {
        if (node.downKind !== "crash" || node.recoverAt <= now + RESTART_TIME || now - node.downAt < MONITOR_DETECT) continue;
        node.alerted = true;
        node.downKind = "restart";
        node.recoverAt = now + RESTART_TIME;
        this.text(node.id, "再起動中", "#9cc4ff", true);
        this.alert(mon, `${slotLabel(node.id)} が止まった`);
      } else if (node.slowUntil > now && now - node.slowAt >= MONITOR_DETECT) {
        node.alerted = true;
        node.slowUntil = now;
        // 再起動する前に、ロードバランサーにも伝えておく（ヘルスチェックを待たずに、振り分けから外す）
        if (node.kind === "app") node.lbKnowsDown = true;
        this.crashNode(node, RESTART_TIME, "restart");
        this.alert(mon, `${slotLabel(node.id)} が遅い`);
      }
    }
  }

  private alert(mon: SimNode, what: string) {
    mon.served++;
    mon.activity += 3;
    this.text(mon.id, "アラート！", PARTS.monitor.color, true);
    this.fx.push({ kind: "burst", at: mon.id, color: PARTS.monitor.color, n: 8 });
    this.banners.push({ text: `🔔 監視：${what}→再起動`, tone: "info" });
    this.tip("monitor-alert");
  }

  /** オートスケール：サーバーの混み具合を見て、休んでいるサーバーを起こしたり、すいたら休ませたりする */
  private autoscale(h: number) {
    const now = this.now;
    // 休む準備ができたサーバーは、手もちが終わったら休む
    for (const a of this.apps()) {
      if (a.draining && !a.busy.length && !a.wait.length && !a.incoming) {
        a.draining = false;
        a.asleep = true;
        this.text(a.id, "おやすみ", PARTS.auto.color);
      }
    }
    const auto = this.nodes.get("auto");
    if (!auto || auto.down) return;
    // オートスケールが見ているのは、つながっているサーバーだけ
    const apps = this.next(auto.id, ["app"]);
    let cap = 0, load = 0;
    for (const a of apps) {
      if (a.asleep || a.draining || a.down) continue;
      cap += a.cap;
      load += a.busy.length + a.wait.length;
    }
    const u = cap ? load / cap : 2;
    this.autoLoad += (u - this.autoLoad) * (1 - Math.exp(-h / 0.8));
    if (now < this.autoNext) return;
    if (this.autoLoad > SCALE_OUT_LOAD) {
      const next = apps.find((a) => a.draining) ?? apps.find((a) => a.asleep);
      if (!next) return;
      if (next.draining) next.draining = false;
      else {
        next.asleep = false;
        next.bootUntil = now + BOOT_TIME;
        this.text(next.id, "起動中…", PARTS.auto.color, true);
      }
      auto.served++;
      auto.activity += 2;
      this.autoNext = now + SCALE_OUT_COOLDOWN;
      this.tip("scale-out");
      return;
    }
    if (this.autoLoad < SCALE_IN_LOAD) {
      const up = apps.filter((a) => !a.down && this.inService(a));
      if (up.length <= 1) return;
      up[up.length - 1]!.draining = true;
      auto.activity += 1;
      this.autoNext = now + SCALE_IN_COOLDOWN;
      this.tip("scale-in");
    }
  }

  /** バックアップ：ときどき DB の中身を保存し、消えたら元にもどす */
  private checkBackup() {
    const bk = this.nodes.get("backup");
    // DB とつながっていないバックアップは、何も保存できない（元にもどしている途中なら、そこでやめになる）
    if (!bk || bk.down || !this.dbs().some((d) => this.linked(d.id, bk.id))) {
      this.restoreAt = Infinity;
      return;
    }
    const now = this.now;
    const db = this.primary();
    if (now >= this.nextSnapshot) {
      this.nextSnapshot = now + BACKUP_EVERY;
      if (db && !db.down && !db.lost) this.sendPacket("snap", db.id, bk.id, TRAVEL.data * 2);
    }
    if (!this.dbs().some((d) => d.lost)) return;
    if (this.restoreAt === Infinity) {
      if (now - this.wipedAt < BACKUP_DETECT) return;
      // 消える前に保存したものがなければ、もどせない
      if (this.lastSnapshot === -Infinity || this.lastSnapshot > this.wipedAt) {
        if (!this.lateNoticed) {
          this.lateNoticed = true;
          this.text(bk.id, "消える前のコピーがない", FAIL_COLOR, true);
          this.tip("backup-late");
        }
        return;
      }
      this.restoreAt = now + RESTORE_TIME;
      bk.activity += 3;
      this.text(bk.id, "復元中…", PARTS.backup.color, true);
      this.banners.push({ text: "💾 バックアップから復元中…", tone: "info" });
      for (const d of this.dbs()) this.sendPacket("snap", bk.id, d.id, RESTORE_TIME * 0.8);
      return;
    }
    if (now < this.restoreAt) return;
    this.restoreAt = Infinity;
    for (const d of this.dbs()) {
      d.lost = false;
      this.text(d.id, "元どおり！", "#7cf5be", true);
    }
    this.banners.push({ text: "データが元にもどった！", tone: "good" });
    this.tip("restore");
  }

  /** 利用者とは関係のない、パーツどうしのやりとり（写し・保存）の光る点 */
  private sendPacket(kind: "repl" | "snap", from: NodeId, to: NodeId, time: number) {
    this.reqs.push({
      id: this.nextId++,
      kind,
      user: -1,
      far: false,
      born: this.now,
      at: from,
      state: "travel",
      from,
      to,
      t0: this.now,
      t1: this.now + time,
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
    });
  }

  private ttl() {
    return this.nodes.get("dns")?.size === 1 ? DNS_TTL_SHORT : DNS_TTL;
  }

  private removeNode(node: SimNode) {
    for (const r of [...node.busy, ...node.wait, ...node.jobs]) this.fail(r, "down");
    this.nodes.delete(node.id);
    for (const r of this.reqs) if (r.inc === node.id) r.inc = null;
    if (this.primaryDb === node.id) this.primaryDb = null;
    // バックアップを外したら、保存しておいた中身もいっしょになくなる
    if (node.kind === "backup") {
      this.lastSnapshot = -Infinity;
      this.restoreAt = Infinity;
    }
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
