/**
 * アプリ「インフラ」の部品（パーツ）とアクセスの種類、シミュレーションの数値。
 *
 * 時間の単位は「ゲーム内の秒」。画面の動きは本物の約100倍ゆっくりで、
 * 表示する「ms」は ゲーム内の1秒 = 100ms として換算したイメージの数字（MS_PER_SEC）。
 * 数値を変えたら `node scripts/simulate-infra.mjs` で各ステージの目標値を確かめること（docs/infra-app.md）。
 */

export type PartKind = "dns" | "cdn" | "waf" | "region" | "lb" | "auto" | "app" | "cache" | "db" | "replica" | "queue" | "backup" | "worker" | "monitor";

/** アクセスの種類（attack 以外が、本物のお客さん） */
export type ReqType = "page" | "static" | "write" | "heavy" | "attack";
export const REQ_TYPES: readonly ReqType[] = ["page", "static", "write", "heavy", "attack"];

/** 盤面の段（上から） */
export type Tier = "edge" | "lb" | "app" | "data" | "back";

/** name / note があれば、置くシートでは「S サイズ」のかわりにこちらを出す（DNS の TTL など、大きさではない選択肢） */
export type PartSize = { label: string; cap: number; queue: number; cost: number; name?: string; note?: string };

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
    // 2つ目は TTL を短くしたもの（住所が変わったとき早く伝わるが、問い合わせが増える）
    sizes: [
      { label: "", cap: 40, queue: 100, cost: 100, name: "TTL 15秒（ふつう）", note: "答えを15秒覚えておく" },
      { label: "短", cap: 40, queue: 100, cost: 100, name: "TTL 3秒（短め）", note: "住所が変わるとすぐ伝わる。問い合わせは増える" },
    ],
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
  region: {
    kind: "region",
    name: "予備の拠点（大阪）",
    short: "大阪",
    en: "Another Region",
    role: "遠くの町に用意した、お店まるごとの予備。いつもの拠点が全部止まったら、DNS がこちらを案内する",
    analogy: "となり町の支店",
    color: "#e879f9",
    tier: "edge",
    sizes: [{ label: "", cap: 8, queue: 16, cost: 7000 }],
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
  auto: {
    kind: "auto",
    name: "オートスケール",
    short: "オート",
    en: "Auto Scaling",
    role: "混み具合を見て、置いたサーバーを自動で起こしたり休ませたりする。休んでいるサーバーは月額がかからない",
    analogy: "混んだら休憩中の店員さんを呼ぶ店長",
    color: "#4ade80",
    tier: "lb",
    sizes: [{ label: "", cap: 0, queue: 0, cost: 1000 }],
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
  backup: {
    kind: "backup",
    name: "バックアップ",
    short: "バックアップ",
    en: "Backup",
    role: "データベースの中身を、ときどき別の場所に保存しておく。消えてしまったら、ここから元にもどす",
    analogy: "台帳のコピーを金庫にしまう",
    color: "#94a3b8",
    tier: "data",
    sizes: [{ label: "", cap: 0, queue: 0, cost: 1200 }],
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
  monitor: {
    kind: "monitor",
    name: "監視",
    short: "監視",
    en: "Monitoring",
    role: "サーバーや DB の様子（速さ・止まっていないか）をいつも見張り、おかしくなったら知らせて自動で再起動する",
    analogy: "見回りの警備員さん",
    color: "#60a5fa",
    tier: "back",
    sizes: [{ label: "", cap: 0, queue: 0, cost: 1500 }],
  },
};

export const PART_KINDS = Object.keys(PARTS) as PartKind[];

/**
 * 盤面のマス。1つのマスには決まった種類のパーツだけが置ける（スマホでも迷わず置けるように）。
 * サーバーは app1 から順に「1台目、2台目…」。ロードバランサーがないときは、いちばん前のサーバーにだけアクセスが来る
 */
export type SlotId =
  | "dns"
  | "cdn"
  | "waf"
  | "region"
  | "lb"
  | "auto"
  | "app1"
  | "app2"
  | "app3"
  | "app4"
  | "cache"
  | "db"
  | "replica"
  | "queue"
  | "backup"
  | "worker1"
  | "worker2"
  | "monitor";

export const SLOT_KIND: Record<SlotId, PartKind> = {
  dns: "dns",
  cdn: "cdn",
  waf: "waf",
  region: "region",
  lb: "lb",
  auto: "auto",
  app1: "app",
  app2: "app",
  app3: "app",
  app4: "app",
  cache: "cache",
  db: "db",
  replica: "replica",
  queue: "queue",
  backup: "backup",
  worker1: "worker",
  worker2: "worker",
  monitor: "monitor",
};

export const SLOT_ORDER: readonly SlotId[] = [
  "dns",
  "cdn",
  "waf",
  "region",
  "lb",
  "auto",
  "app1",
  "app2",
  "app3",
  "app4",
  "cache",
  "db",
  "replica",
  "queue",
  "backup",
  "worker1",
  "worker2",
  "monitor",
];

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
  /** 予備の拠点（サーバーと DB がひとまとめ） */
  region: 0.5,
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
  /** 予備の拠点（大阪）は遠いので、少し時間がかかる */
  userRegion: 0.7,
} as const;

/** これより長くかかったアクセスは、タイムアウト（504） */
export const TIMEOUT = 8;
/** 利用者が DNS の答えを覚えておく時間（TTL）。DNS を「TTL 短め」にすると DNS_TTL_SHORT */
export const DNS_TTL = 15;
export const DNS_TTL_SHORT = 3;
/** DNS が、いつもの拠点が止まったことに気づくまで（DNS のヘルスチェック） */
export const DNS_HEALTH_DELAY = 1;
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

/** オートスケール：混み具合（処理中＋待ち ÷ 同時に処理できる数）がこれをこえたら1台起こし、下回ったら1台休ませる */
export const SCALE_OUT_LOAD = 0.6;
export const SCALE_IN_LOAD = 0.3;
/** 休んでいたサーバーが起きて、仕事を受けられるようになるまで */
export const BOOT_TIME = 2;
/** 1台起こしたあと・休ませたあと、次に動くまで待つ時間 */
export const SCALE_OUT_COOLDOWN = 1.5;
export const SCALE_IN_COOLDOWN = 4;

/** 監視：止まった・遅くなったことに気づくまでと、自動の再起動にかかる時間 */
export const MONITOR_DETECT = 1;
export const RESTART_TIME = 2;
/** 調子の悪いサーバーは、処理がこの倍だけ遅くなる */
export const SLOW_FACTOR = 7;

/** バックアップ：データの保存の間隔・消えたことに気づくまで・元にもどすのにかかる時間 */
export const BACKUP_EVERY = 4;
export const BACKUP_DETECT = 1.2;
export const RESTORE_TIME = 2.5;

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
