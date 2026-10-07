/**
 * アプリ「インフラ」の部品（パーツ）とアクセスの種類、シミュレーションの数値。
 *
 * 時間の単位は「ゲーム内の秒」。画面の動きは本物の約100倍ゆっくりで、
 * 表示する「ms」は ゲーム内の1秒 = 100ms として換算したイメージの数字（MS_PER_SEC）。
 * 数値を変えたら `node scripts/simulate-infra.mjs` で各ステージの目標値を確かめること（docs/infra-app.md）。
 */

export type PartKind = "dns" | "cdn" | "waf" | "lb" | "app" | "cache" | "db" | "replica" | "queue" | "worker";

/** アクセスの種類（attack 以外が、本物のお客さん） */
export type ReqType = "page" | "static" | "write" | "heavy" | "attack";
export const REQ_TYPES: readonly ReqType[] = ["page", "static", "write", "heavy", "attack"];

/** 盤面の段（上から） */
export type Tier = "edge" | "lb" | "app" | "data" | "back";

export type PartSize = { label: string; cap: number; queue: number; cost: number };

export type PartSpec = {
  kind: PartKind;
  /** 正式な名前 */
  name: string;
  /** タイルの下に出す短い名前 */
  short: string;
  /** 英語の名前（小さく添える） */
  en: string;
  /** ひとことで */
  role: string;
  /** たとえると */
  analogy: string;
  /** テーマの色 */
  color: string;
  tier: Tier;
  /** S / M / L（1つだけのものもある）。cap = 同時に処理できる数、queue = 待っていられる数、cost = 月額（円） */
  sizes: PartSize[];
};

export const PARTS: Record<PartKind, PartSpec> = {
  dns: {
    kind: "dns",
    name: "DNS",
    short: "DNS",
    en: "Domain Name System",
    role: "「odekake.app」のような名前を、コンピューターの住所（IPアドレス）に変える",
    analogy: "電話帳",
    color: "#8b9dff",
    tier: "edge",
    sizes: [{ label: "", cap: 40, queue: 100, cost: 100 }],
  },
  cdn: {
    kind: "cdn",
    name: "CDN",
    short: "CDN",
    en: "Content Delivery Network",
    role: "画像などのファイルを、利用者の近くの拠点から配る",
    analogy: "近所の倉庫",
    color: "#34d6b8",
    tier: "edge",
    sizes: [{ label: "", cap: 60, queue: 100, cost: 1500 }],
  },
  waf: {
    kind: "waf",
    name: "WAF",
    short: "WAF",
    en: "Web Application Firewall",
    role: "あやしいアクセスを入口で見分けて止める",
    analogy: "入口の警備員",
    color: "#ff6f8a",
    tier: "edge",
    sizes: [{ label: "", cap: 60, queue: 100, cost: 2000 }],
  },
  lb: {
    kind: "lb",
    name: "ロードバランサー",
    short: "LB",
    en: "Load Balancer",
    role: "アクセスを、すいているサーバーへ振り分ける",
    analogy: "受付係",
    color: "#ffc857",
    tier: "lb",
    sizes: [{ label: "", cap: 60, queue: 100, cost: 2500 }],
  },
  app: {
    kind: "app",
    name: "サーバー",
    short: "サーバー",
    en: "Web / App Server",
    role: "アクセスを受けて、ページを組み立てて返す",
    analogy: "お店の店員さん",
    color: "#5fd8ff",
    tier: "app",
    sizes: [
      { label: "S", cap: 3, queue: 6, cost: 3000 },
      { label: "M", cap: 5, queue: 8, cost: 6000 },
      { label: "L", cap: 8, queue: 12, cost: 12000 },
    ],
  },
  cache: {
    kind: "cache",
    name: "キャッシュ",
    short: "キャッシュ",
    en: "Cache",
    role: "よく読まれるデータを、すぐ出せる場所に置いておく",
    analogy: "手元のメモ",
    color: "#b6f05a",
    tier: "data",
    sizes: [{ label: "", cap: 30, queue: 60, cost: 2000 }],
  },
  db: {
    kind: "db",
    name: "データベース",
    short: "DB",
    en: "Database",
    role: "投稿などのデータを、まとめて安全に保存する",
    analogy: "お店の台帳",
    color: "#b08cff",
    tier: "data",
    sizes: [
      { label: "S", cap: 4, queue: 10, cost: 5000 },
      { label: "M", cap: 8, queue: 16, cost: 11000 },
    ],
  },
  replica: {
    kind: "replica",
    name: "予備DB（レプリカ）",
    short: "予備DB",
    en: "Read Replica",
    role: "本番DBの写し。読みこみを分担し、本番が止まったら代わりになる",
    analogy: "台帳の写し",
    color: "#d3c2ff",
    tier: "data",
    sizes: [{ label: "", cap: 4, queue: 10, cost: 4000 }],
  },
  queue: {
    kind: "queue",
    name: "キュー",
    short: "キュー",
    en: "Message Queue",
    role: "重い仕事を順番待ちの列に入れて、あとで処理する",
    analogy: "整理券",
    color: "#ff8fd3",
    tier: "data",
    sizes: [{ label: "", cap: 50, queue: 100, cost: 800 }],
  },
  worker: {
    kind: "worker",
    name: "ワーカー",
    short: "ワーカー",
    en: "Worker",
    role: "キューから仕事を受けとって、裏で処理する",
    analogy: "裏方さん",
    color: "#ffa45c",
    tier: "back",
    sizes: [{ label: "", cap: 2, queue: 0, cost: 2500 }],
  },
};

export const PART_KINDS = Object.keys(PARTS) as PartKind[];

/**
 * 盤面のマス。1つのマスには決まった種類のパーツだけが置ける（スマホでも迷わず置けるように）。
 * サーバーは app1 から順に「1台目、2台目…」。ロードバランサーがないときは、いちばん前のサーバーにだけアクセスが来る
 */
export type SlotId = "dns" | "cdn" | "waf" | "lb" | "app1" | "app2" | "app3" | "app4" | "cache" | "db" | "replica" | "queue" | "worker1" | "worker2";

export const SLOT_KIND: Record<SlotId, PartKind> = {
  dns: "dns",
  cdn: "cdn",
  waf: "waf",
  lb: "lb",
  app1: "app",
  app2: "app",
  app3: "app",
  app4: "app",
  cache: "cache",
  db: "db",
  replica: "replica",
  queue: "queue",
  worker1: "worker",
  worker2: "worker",
};

export const SLOT_ORDER: readonly SlotId[] = ["dns", "cdn", "waf", "lb", "app1", "app2", "app3", "app4", "cache", "db", "replica", "queue", "worker1", "worker2"];

/** 置いたパーツ（size は PARTS[kind].sizes の何番目か） */
export type Placement = { slot: SlotId; kind: PartKind; size: number };

/** マスにいるパーツの呼び名（「サーバー2」など） */
export function slotLabel(slot: SlotId): string {
  const kind = SLOT_KIND[slot];
  const n = /\d$/.test(slot) ? slot.slice(-1) : "";
  return `${PARTS[kind].short}${n}`;
}

export const REQ_INFO: Record<ReqType, { name: string; color: string; note: string }> = {
  page: { name: "ページ", color: "#67e8f9", note: "ページを見る" },
  static: { name: "画像", color: "#fcd34d", note: "画像などのファイル" },
  write: { name: "投稿", color: "#f9a8d4", note: "データを書きこむ" },
  heavy: { name: "重い処理", color: "#c4a1ff", note: "写真の加工など" },
  attack: { name: "攻撃", color: "#ff5a6e", note: "悪いロボットのアクセス" },
};

/** 返事（レスポンス）・DNS の問い合わせ・裏の仕事・データの写しの色 */
export const RESPONSE_COLOR = "#7cf5be";
export const LOOKUP_COLOR = "#e4e9ff";
export const JOB_COLOR = "#ffb27a";
export const REPL_COLOR = "#d3c2ff";

/** ゲーム内の1秒を何msとして見せるか */
export const MS_PER_SEC = 100;

/** 1件の処理時間（ゲーム内の秒）。ばらつきは ×0.75〜1.25 */
export const SERVICE = {
  dns: 0.05,
  cdn: 0.06,
  waf: 0.06,
  lb: 0.04,
  app: { page: 0.35, static: 0.3, write: 0.35, heavy: 2.6, heavyQueued: 0.35, attack: 0.5 },
  cache: 0.06,
  db: { read: 0.45, write: 0.6, job: 0.3 },
  queue: 0.03,
  worker: 1.6,
} as const;

/** 移動にかかる時間（ゲーム内の秒） */
export const TRAVEL = {
  userDnsNear: 0.3,
  userDnsFar: 0.55,
  /** CDN は利用者の近くにあるので、遠くの人でも近い */
  userCdn: 0.28,
  userOriginNear: 0.4,
  userOriginFar: 1.4,
  /** CDN の拠点からサーバーまで（専用の速い道） */
  cdnOrigin: 0.45,
  internal: 0.12,
  data: 0.15,
} as const;

/** これより長くかかったアクセスは、タイムアウト（504） */
export const TIMEOUT = 8;
/** 利用者が DNS の答えを覚えておく時間（TTL） */
export const DNS_TTL = 15;
/** ロードバランサーが、サーバーの故障・復旧に気づくまでの時間（ヘルスチェック） */
export const HEALTH_DELAY = 0.8;
/** 本番DB が止まってから、予備DB が本番に昇格するまで */
export const FAILOVER_DELAY = 1.2;
/** WAF が攻撃を止められる割合 */
export const WAF_BLOCK = 0.97;
/** キャッシュ・CDN のヒット率の上限と、それに届くまでにためる数 */
export const CACHE_MAX_HIT = 0.88;
export const CACHE_WARM = 40;
export const CDN_MAX_HIT = 0.95;
export const CDN_WARM = 24;
/** キューにためておける仕事の数 */
export const QUEUE_MAX_JOBS = 120;
/** キューに入ってから、これより長く待たされた仕事は「期限切れ」（失敗に数える） */
export const JOB_DEADLINE = 8;

/** 利用者（盤面のいちばん上に並ぶ人）の数 */
export const USER_COUNT = 6;

export const partCost = (kind: PartKind, size: number) => {
  const sizes = PARTS[kind].sizes;
  return (sizes[Math.min(size, sizes.length - 1)] ?? sizes[0]!).cost;
};

export const partSize = (kind: PartKind, size: number): PartSize => {
  const sizes = PARTS[kind].sizes;
  return sizes[Math.min(size, sizes.length - 1)] ?? sizes[0]!;
};

export const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
