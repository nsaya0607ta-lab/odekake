/**
 * アプリ「インフラ」のステージ（カリキュラム）。
 * 1ステージ＝1つの考え方。「問題が起きる → しくみを知る → 置いて直す」の順に学ぶ。
 * 目標値（goal）は `node scripts/simulate-infra.mjs` で、お手本の構成なら届き、何もしなければ届かないことを確かめてある。
 */
import type { PartKind, Placement, SlotId } from "./model";
import type { Rates, SimSetup, TipId } from "./sim";

export type Goal = {
  /** ★1（クリア）：成功率がこれ以上 */
  success: number;
  /** ★2：平均の返事の速さ（ms）がこれ以下 */
  latency: number;
  /** ★3：月額（置いていた時間で平均）がこれ以下 */
  cost: number;
};

/** 説明カードの動く図の1こま */
export type FlowStep = { icon: PartKind | "user" | "bot"; label: string; say?: string };

export type IntroCard = {
  title: string;
  body: string;
  flow?: FlowStep[];
  /** たとえると */
  analogy?: string;
};

export type Quiz = { q: string; choices: string[]; answer: number; why: string };

export type StageDef = {
  id: string;
  no: number;
  title: string;
  subtitle: string;
  /** 路線図に出すテーマ */
  topic: string;
  /** このステージではじめて出てくるパーツ */
  newParts: PartKind[];
  intro: IntroCard[];
  /** 盤面に出すマス */
  slots: SlotId[];
  /** はじめから置いてある（外せない） */
  fixed: Placement[];
  /** 月額の上限（これをこえては置けない） */
  budget: number;
  goal: Goal;
  setup: SimSetup;
  /** このステージで出すヒント */
  tips: TipId[];
  hint: string;
  takeaways: string[];
  quiz: Quiz[];
  /** クリアすると図鑑に入る用語 */
  terms: string[];
  /** お手本（検証スクリプト用。at があれば、本番のその時刻に置く） */
  solution: (Placement & { at?: number })[];
};

type Key = { t: number } & Rates;

/** 時刻ごとのアクセス数を、あいだをなめらかにつないだ関数にする */
export function keyframes(keys: Key[]): (t: number) => Rates {
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  const types = ["page", "static", "write", "heavy", "attack"] as const;
  return (t: number) => {
    const out: Rates = {};
    let i = 0;
    while (i < sorted.length - 1 && sorted[i + 1]!.t <= t) i++;
    const a = sorted[i]!;
    const b = sorted[i + 1];
    const k = b && t > a.t ? Math.min(1, (t - a.t) / Math.max(1e-6, b.t - a.t)) : 0;
    for (const type of types) {
      const va = a[type] ?? 0;
      const vb = b ? b[type] ?? 0 : va;
      const v = va + (vb - va) * k;
      if (v > 0) out[type] = v;
    }
    return out;
  };
}

const P = (slot: SlotId, kind: PartKind, size = 0, at?: number): Placement & { at?: number } => (at == null ? { slot, kind, size } : { slot, kind, size, at });
/** ステージ10（総まとめ）で使うマス。ステージ11からのパーツは入れない */
const ALL_SLOTS: SlotId[] = ["dns", "cdn", "waf", "lb", "app1", "app2", "app3", "app4", "cache", "db", "replica", "queue", "worker1", "worker2"];

export const STAGES: StageDef[] = [
  {
    id: "s1",
    no: 1,
    title: "はじめてのサーバー",
    subtitle: "ページを見に来た人に、返事をしよう",
    topic: "サーバー",
    newParts: ["app"],
    intro: [
      {
        title: "インターネットは「お願い」と「返事」",
        body: "スマホでページを開くと、スマホは「ページをください」というお願い（リクエスト）を送ります。受けとったコンピューターが、ページを返事（レスポンス）として送り返します。",
        flow: [
          { icon: "user", label: "スマホ", say: "ページをください" },
          { icon: "app", label: "サーバー", say: "はい、どうぞ" },
        ],
      },
      {
        title: "返事をするのが「サーバー」",
        body: "お願いを受けて仕事をし、返事をするコンピューターを「サーバー」といいます。1台のサーバーが同時に相手できる数には、限りがあります。",
        analogy: "サーバーは、お店の店員さん",
      },
      {
        title: "やってみよう",
        body: "空いているマスをタップしてサーバーを置き、「本番スタート」を押そう。光る点がお願い、ミント色の点が返事です。",
      },
    ],
    slots: ["app1"],
    fixed: [],
    budget: 6000,
    goal: { success: 0.95, latency: 250, cost: 3000 },
    setup: {
      requiresDns: false,
      farRatio: 0,
      duration: 30,
      traffic: keyframes([
        { t: 0, page: 2 },
        { t: 30, page: 3.5 },
      ]),
      events: [],
    },
    tips: ["no-server", "first-ok", "busy"],
    hint: "まんなかのマスにサーバーを1台置けば大丈夫。大きいサイズは月額が高くなります。",
    takeaways: ["スマホは「リクエスト」を送り、サーバーが「レスポンス」を返す", "サーバーは、お願いを受けて仕事をするコンピューター", "1台が同時にこなせる数には限りがある"],
    quiz: [
      {
        q: "スマホがサーバーに「ページをください」と送るものは？",
        choices: ["リクエスト", "レスポンス", "キャッシュ"],
        answer: 0,
        why: "お願いがリクエスト、サーバーからの返事がレスポンスです。",
      },
    ],
    terms: ["request", "server"],
    solution: [P("app1", "app")],
  },
  {
    id: "s2",
    no: 2,
    title: "住所をしらべる",
    subtitle: "名前から、サーバーの住所を見つけよう",
    topic: "DNS",
    newParts: ["dns"],
    intro: [
      {
        title: "コンピューターは番号で相手をさがす",
        body: "ネットにつながる機械には、それぞれ「203.0.113.10」のような番号の住所（IPアドレス）があります。でも、人には覚えにくい…。",
      },
      {
        title: "名前を住所に変える「DNS」",
        body: "そこで「odekake.app」のような名前（ドメイン）を使います。名前を IPアドレスに変えてくれるのが DNS です。",
        flow: [
          { icon: "user", label: "スマホ", say: "odekake.app はどこ？" },
          { icon: "dns", label: "DNS", say: "203.0.113.10 だよ" },
        ],
        analogy: "DNS は、ネットの電話帳",
      },
      {
        title: "一度聞いたら、しばらく覚えておく",
        body: "毎回たずねると時間がかかるので、答えはしばらく覚えておきます。この覚えておく時間を TTL といいます。",
      },
    ],
    slots: ["dns", "app1"],
    fixed: [P("app1", "app")],
    budget: 6000,
    goal: { success: 0.95, latency: 230, cost: 3100 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 30,
      traffic: keyframes([{ t: 0, page: 3 }]),
      events: [],
    },
    tips: ["dns-missing", "dns-first", "dns-cached", "first-ok"],
    hint: "左上の DNS のマスに、DNS を置こう。置かずに動かして、何が起きるか見てみるのもおすすめ。",
    takeaways: ["人は名前（ドメイン）、コンピューターは番号（IPアドレス）で相手を見つける", "DNS は名前を IPアドレスに変える「ネットの電話帳」", "答えは TTL のあいだ覚えておくので、毎回は聞かない"],
    quiz: [
      {
        q: "DNS の役割は？",
        choices: ["名前（ドメイン）を IPアドレスに変える", "ページを速く表示する", "悪いアクセスを止める"],
        answer: 0,
        why: "DNS はネットの電話帳。名前から住所（IPアドレス）を調べます。",
      },
    ],
    terms: ["ip", "domain", "dns", "ttl"],
    solution: [P("app1", "app"), P("dns", "dns")],
  },
  {
    id: "s3",
    no: 3,
    title: "人気になった！",
    subtitle: "1台ではさばけないアクセスを、手分けしよう",
    topic: "ロードバランサー",
    newParts: ["lb"],
    intro: [
      {
        title: "SNS で話題に！",
        body: "お店が話題になり、アクセスがどんどん増えていきます。サーバー1台では、すぐに手いっぱいになってしまいます。",
      },
      {
        title: "大きくする？ 増やす？",
        body: "サーバーを大きくする「スケールアップ」と、台数を増やす「スケールアウト」があります。大きくするのは手軽だけど、値段が高く、大きさにも上限があります。",
      },
      {
        title: "振り分ける「ロードバランサー」",
        body: "台数を増やしたら、アクセスを振り分ける係が必要です。それがロードバランサー。すいているサーバーへ順に案内します。",
        flow: [
          { icon: "user", label: "アクセス" },
          { icon: "lb", label: "LB", say: "こちらへどうぞ" },
          { icon: "app", label: "サーバー×3" },
        ],
        analogy: "ロードバランサーは、お店の受付係",
      },
    ],
    slots: ["dns", "lb", "app1", "app2", "app3", "app4"],
    fixed: [P("dns", "dns"), P("app1", "app")],
    budget: 18000,
    goal: { success: 0.95, latency: 260, cost: 12500 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 40,
      traffic: keyframes([
        { t: 0, page: 2 },
        { t: 22, page: 28 },
        { t: 40, page: 28 },
      ]),
      events: [
        { t: 7, kind: "banner", text: "📈 アクセスが増えてきた！", tone: "warn" },
        { t: 18, kind: "banner", text: "🔥 SNS で大バズり中！", tone: "danger" },
      ],
    },
    tips: ["unused-app", "busy", "lb-spread", "timeout"],
    hint: "ロードバランサーを置いて、サーバーを増やそう。★3 は「混んできてから増やす」と月額が安くすむよ（本番中もパーツを置けます）。",
    takeaways: [
      "スケールアップ（大きくする）には上限があり、値段も高い",
      "スケールアウト（増やす）なら、ロードバランサーで手分けできる",
      "混んできたら足す・すいたら減らす。使う分だけ払うのがクラウドの考え方",
    ],
    quiz: [
      {
        q: "サーバーを2台に増やしたのに、1台にしかアクセスが来ません。足りないのは？",
        choices: ["ロードバランサー", "キャッシュ", "2つ目の DNS"],
        answer: 0,
        why: "DNS が教える住所は1つ。受付係（ロードバランサー）がいないと、ほかのサーバーへ振り分けられません。",
      },
    ],
    terms: ["lb", "scale", "status", "payg"],
    solution: [P("dns", "dns"), P("app1", "app"), P("lb", "lb"), P("app2", "app", 0, 5), P("app3", "app", 0, 11), P("app4", "app", 0, 17)],
  },
  {
    id: "s4",
    no: 4,
    title: "データはどこに？",
    subtitle: "どのサーバーからでも、同じデータを見られるように",
    topic: "データベース",
    newParts: ["db"],
    intro: [
      {
        title: "投稿できるようになった！",
        body: "お店に「レビュー投稿」をつけました。でも投稿は、受けとったサーバーの中に保存されます。次に別のサーバーへ案内されると「さっきの投稿がない！」ということに…。",
      },
      {
        title: "データは、みんなの台帳へ",
        body: "データを1か所のデータベースにまとめれば、どのサーバーからでも同じデータを読めます。サーバーは何も覚えておかなくてよくなります（ステートレス）。",
        flow: [
          { icon: "app", label: "サーバー" },
          { icon: "db", label: "データベース", say: "ぜんぶここにあるよ" },
        ],
        analogy: "データベースは、お店の台帳",
      },
    ],
    slots: ["dns", "lb", "app1", "app2", "db"],
    fixed: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app")],
    budget: 18000,
    goal: { success: 0.95, latency: 320, cost: 13700 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 35,
      traffic: keyframes([{ t: 0, page: 4, write: 2 }]),
      events: [],
    },
    tips: ["missing-data", "db-first", "db-busy", "busy"],
    hint: "いちばん下の DB のマスに、データベースを置こう。",
    takeaways: [
      "データをサーバーに置くと、サーバーごとにバラバラになる",
      "データベースにまとめると、どのサーバーからでも同じデータが見える",
      "サーバーは覚えない（ステートレス）ので、増やしたり減らしたりしやすい",
    ],
    quiz: [
      {
        q: "サーバーが何台あっても、同じ投稿を読めるようにするには、データをどこに置く？",
        choices: ["データベース", "それぞれのサーバー", "利用者のスマホ"],
        answer: 0,
        why: "データベースにまとめておけば、どのサーバーも同じ台帳を見に行けます。",
      },
    ],
    terms: ["db", "stateless"],
    solution: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("db", "db")],
  },
  {
    id: "s5",
    no: 5,
    title: "もっと速く",
    subtitle: "何度も読まれるデータを、手元に置こう",
    topic: "キャッシュ",
    newParts: ["cache"],
    intro: [
      {
        title: "データベースに行列が…",
        body: "人気のページが何度も読まれ、そのたびにデータベースへ読みに行くので、データベースの前に行列ができてしまいました。",
      },
      {
        title: "よく使うものは、手元のメモに",
        body: "一度読んだデータを、すぐ取り出せる場所（キャッシュ）に置いておきます。キャッシュにあれば（ヒット）、データベースまで行かずにすみます。",
        flow: [
          { icon: "app", label: "サーバー" },
          { icon: "cache", label: "キャッシュ", say: "メモにあった！" },
          { icon: "db", label: "DB", say: "ひと休み" },
        ],
        analogy: "キャッシュは、手元のメモ",
      },
      {
        title: "はじめは、からっぽ",
        body: "キャッシュは使ううちに中身がたまり、ヒット率（あった割合）が上がっていきます。タイルの下の % に注目してみよう。",
      },
    ],
    slots: ["dns", "lb", "app1", "app2", "app3", "cache", "db"],
    fixed: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("app3", "app"), P("db", "db")],
    budget: 26000,
    goal: { success: 0.95, latency: 280, cost: 18700 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 35,
      traffic: keyframes([
        { t: 0, page: 7, write: 1 },
        { t: 8, page: 13, write: 1.5 },
      ]),
      events: [{ t: 8, kind: "banner", text: "📈 人気ページにアクセスが集中！", tone: "warn" }],
    },
    tips: ["db-busy", "cache-miss", "cache-hit", "timeout"],
    hint: "キャッシュを置こう。データベースを M サイズにしても速くなるけど、月額がかなり高くなるよ。",
    takeaways: [
      "同じデータを何度も読むなら、キャッシュに置くと速い",
      "キャッシュにある＝ヒット、ない＝ミス。ヒット率が高いほど DB が楽になる",
      "データが変わったら、古いキャッシュは捨てる必要がある",
    ],
    quiz: [
      {
        q: "読みたいデータがキャッシュにあったことを、何という？",
        choices: ["ヒット", "ミス", "タイムアウト"],
        answer: 0,
        why: "あればヒット、なければミス。ミスのときは DB から読んで、キャッシュに入れておきます。",
      },
    ],
    terms: ["cache", "hitrate", "latency"],
    solution: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("app3", "app"), P("db", "db"), P("cache", "cache")],
  },
  {
    id: "s6",
    no: 6,
    title: "遠くの町にも",
    subtitle: "画像を、利用者の近くから配ろう",
    topic: "CDN",
    newParts: ["cdn"],
    intro: [
      {
        title: "全国から見られるように",
        body: "遠くの町の人からもアクセスが来るようになりました。遠いと、往復するだけで時間がかかります。しかも写真が多く、サーバーは画像を返すのでいそがしい…。",
      },
      {
        title: "近所の倉庫から配る「CDN」",
        body: "CDN は、各地にある拠点（エッジ）に画像などのファイルを置いておき、利用者のいちばん近くから返します。サーバーまで行くのは、拠点にまだないときだけ。",
        flow: [
          { icon: "user", label: "遠くの人" },
          { icon: "cdn", label: "近くの拠点", say: "ここにあるよ" },
        ],
        analogy: "CDN は、近所の倉庫",
      },
    ],
    slots: ["dns", "cdn", "lb", "app1", "app2", "app3", "app4", "cache", "db"],
    fixed: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("cache", "cache"), P("db", "db")],
    budget: 26000,
    goal: { success: 0.95, latency: 200, cost: 17200 },
    setup: {
      requiresDns: true,
      farRatio: 0.5,
      duration: 35,
      traffic: keyframes([
        { t: 0, static: 6, page: 4 },
        { t: 8, static: 18, page: 4 },
      ]),
      events: [],
    },
    tips: ["far-slow", "cdn-hit", "busy", "timeout"],
    hint: "CDN を置こう。サーバーを増やしても、遠くの人の往復時間は短くならないよ。",
    takeaways: ["遠い場所とのやりとりは、往復するだけで時間がかかる", "CDN は各地の拠点（エッジ）から、画像などを近くで返す", "サーバーの仕事も減るので、一石二鳥"],
    quiz: [
      {
        q: "遠くの町の人に、画像を速く届けたい。いちばん効くのは？",
        choices: ["CDN", "サーバーを大きくする", "WAF"],
        answer: 0,
        why: "サーバーを強くしても、往復の距離は変わりません。CDN なら近くの拠点から返せます。",
      },
    ],
    terms: ["cdn", "edge"],
    solution: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("cache", "cache"), P("db", "db"), P("cdn", "cdn")],
  },
  {
    id: "s7",
    no: 7,
    title: "サーバーが止まった！",
    subtitle: "1台こわれても、止まらないお店に",
    topic: "冗長化",
    newParts: ["replica"],
    intro: [
      {
        title: "機械は、いつかこわれる",
        body: "どんなサーバーも、故障やメンテナンスで止まることがあります。1台しかないと、止まったとたんにお店も止まります。こういう場所を「単一障害点」といいます。",
      },
      {
        title: "予備をそなえる（冗長化）",
        body: "サーバーを2台以上にしてロードバランサーにつなげば、1台止まっても残りが動きます。ロードバランサーは定期的に様子を見て（ヘルスチェック）、止まったサーバーには送らなくなります。",
        flow: [
          { icon: "lb", label: "LB", say: "だいじょうぶ？" },
          { icon: "app", label: "サーバー", say: "げんき！" },
        ],
      },
      {
        title: "データベースにも予備を",
        body: "予備DB（レプリカ）には、本番DBのデータが常に写されています。本番が止まると、予備が本番に切りかわります（フェイルオーバー）。ふだんは読みこみを手伝います。",
        flow: [
          { icon: "db", label: "本番DB" },
          { icon: "replica", label: "予備DB", say: "写しておくね" },
        ],
        analogy: "予備DB は、台帳の写し",
      },
    ],
    slots: ["dns", "lb", "app1", "app2", "app3", "db", "replica"],
    fixed: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("db", "db")],
    budget: 22000,
    goal: { success: 0.93, latency: 300, cost: 17700 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 45,
      traffic: keyframes([{ t: 0, page: 5, write: 1 }]),
      events: [
        { t: 13, kind: "crash", target: "app", index: 0, duration: 12 },
        { t: 30, kind: "crash", target: "db", duration: 10 },
      ],
    },
    tips: ["spof", "health", "repl", "failover", "busy"],
    hint: "サーバーをもう1台と、予備DB を置こう。どこが止まっても、代わりがいるように。",
    takeaways: [
      "1か所止まると全部止まる場所が「単一障害点」",
      "予備をそなえる（冗長化）と、こわれても動き続けられる",
      "ヘルスチェックで故障に気づき、フェイルオーバーで予備に切りかえる",
    ],
    quiz: [
      {
        q: "1台が止まってもサービスが動き続けるよう、予備をそなえることを何という？",
        choices: ["冗長化", "非同期処理", "スケールアップ"],
        answer: 0,
        why: "同じ役割のものを複数そなえておくことを冗長化といいます。",
      },
    ],
    terms: ["redundancy", "spof", "healthcheck", "failover", "replication"],
    solution: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("db", "db"), P("app2", "app"), P("replica", "replica")],
  },
  {
    id: "s8",
    no: 8,
    title: "重い処理は後で",
    subtitle: "時間のかかる仕事は、裏で順番に",
    topic: "キュー",
    newParts: ["queue", "worker"],
    intro: [
      {
        title: "写真の加工が大人気",
        body: "写真をかわいく加工する機能が大人気。でも加工は時間がかかり、そのあいだサーバーは手がふさがって、ほかのページを返せません。",
      },
      {
        title: "整理券を配って、あとで",
        body: "重い仕事は「キュー」に並べて、利用者にはすぐ「受け付けました」と返事します。キューの仕事は「ワーカー」が裏で順番に片づけます（非同期処理）。",
        flow: [
          { icon: "app", label: "サーバー", say: "受け付けました！" },
          { icon: "queue", label: "キュー" },
          { icon: "worker", label: "ワーカー", say: "順番にやるね" },
        ],
        analogy: "キューは、整理券の列",
      },
    ],
    slots: ["dns", "lb", "app1", "app2", "app3", "app4", "cache", "db", "queue", "worker1", "worker2"],
    fixed: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("cache", "cache"), P("db", "db")],
    budget: 26000,
    goal: { success: 0.95, latency: 230, cost: 21500 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 40,
      traffic: keyframes([
        { t: 0, page: 5, heavy: 0.6 },
        { t: 7.9, page: 5, heavy: 0.6 },
        { t: 8, page: 5, heavy: 3 },
        { t: 26, page: 5, heavy: 3 },
        { t: 26.1, page: 5, heavy: 1.2 },
      ]),
      events: [{ t: 8, kind: "banner", text: "📸 写真の加工がバズった！", tone: "warn" }],
    },
    tips: ["heavy-sync", "busy", "queue-ack", "backlog", "timeout"],
    hint: "キューとワーカーを置こう。ワーカーが足りないと、キューに仕事がたまっていくよ。",
    takeaways: [
      "時間のかかる仕事でサーバーをふさぐと、ほかの人まで待たされる",
      "キューに並べてすぐ返事し、ワーカーが裏で処理する（非同期処理）",
      "仕事がたまるなら、ワーカーを増やす",
    ],
    quiz: [
      {
        q: "重い仕事をキューに入れて、あとでワーカーが処理するやり方を何という？",
        choices: ["非同期処理", "キャッシュ", "フェイルオーバー"],
        answer: 0,
        why: "その場で終わるのを待たずに受け付けだけして、あとで処理するのが非同期処理です。",
      },
    ],
    terms: ["queue", "async", "worker"],
    solution: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("cache", "cache"), P("db", "db"), P("queue", "queue"), P("worker1", "worker"), P("worker2", "worker")],
  },
  {
    id: "s9",
    no: 9,
    title: "あやしいアクセス",
    subtitle: "悪いロボットを、入口で止めよう",
    topic: "WAF",
    newParts: ["waf"],
    intro: [
      {
        title: "悪いロボットがやってきた",
        body: "ロボット（プログラム）が大量のアクセスを送りつけてきました。サーバーが攻撃の相手でいそがしく、本物のお客さんがページを見られません。",
      },
      {
        title: "入口の警備員「WAF」",
        body: "WAF は入口でアクセスの中身や量を調べて、あやしいものを止めます。サーバーまで届かなければ、手がふさがることもありません。",
        flow: [
          { icon: "bot", label: "ロボット" },
          { icon: "waf", label: "WAF", say: "通さないよ" },
        ],
        analogy: "WAF は、入口の警備員",
      },
    ],
    slots: ["dns", "waf", "lb", "app1", "app2", "app3", "app4", "cache", "db"],
    fixed: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("cache", "cache"), P("db", "db")],
    budget: 26000,
    goal: { success: 0.95, latency: 270, cost: 17700 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 40,
      traffic: keyframes([
        { t: 0, page: 5 },
        { t: 8.9, page: 5 },
        { t: 9, page: 5, attack: 14 },
        { t: 19, page: 5, attack: 14 },
        { t: 19.1, page: 5 },
        { t: 24.9, page: 5 },
        { t: 25, page: 5, attack: 22 },
        { t: 36, page: 5, attack: 22 },
        { t: 36.1, page: 5 },
      ]),
      events: [
        { t: 9, kind: "banner", text: "⚠ あやしいアクセスが急増！", tone: "danger" },
        { t: 25, kind: "banner", text: "⚠ 攻撃の第2波！", tone: "danger" },
      ],
    },
    tips: ["attack-hit", "busy", "waf-block", "timeout"],
    hint: "WAF を置こう。サーバーを増やして耐えることもできるけど、お金がかかるし、攻撃が強まるとたえきれないよ。",
    takeaways: ["大量のアクセスでサービスを止めようとする攻撃がある（DDoS）", "WAF は入口であやしいアクセスを見分けて止める", "守りは入口で。中まで入られると、本物のお客さんに迷惑がかかる"],
    quiz: [
      {
        q: "あやしいアクセスを、入口で見分けて止めるのは？",
        choices: ["WAF", "ロードバランサー", "キュー"],
        answer: 0,
        why: "WAF（Web アプリケーション ファイアウォール）が、入口の警備員の役目です。",
      },
    ],
    terms: ["waf", "ddos"],
    solution: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("cache", "cache"), P("db", "db"), P("waf", "waf")],
  },
  {
    id: "s10",
    no: 10,
    title: "テレビで紹介された！",
    subtitle: "学んだことを全部使って、お店を守りぬこう",
    topic: "総まとめ",
    newParts: [],
    intro: [
      {
        title: "夕方のテレビに出ることに！",
        body: "放送が始まると、全国から一気にアクセスが来ます。画像も投稿も写真の加工も…。さらに悪いロボットや、機械の故障まで起きるかもしれません。",
      },
      {
        title: "作戦を立てよう",
        body: "どこが混みそうか、何が止まりそうかを考えてパーツを置こう。本番中も、混んできたらパーツを足せます。",
      },
    ],
    slots: ALL_SLOTS,
    fixed: [P("dns", "dns")],
    budget: 45000,
    goal: { success: 0.95, latency: 250, cost: 33000 },
    setup: {
      requiresDns: true,
      farRatio: 0.4,
      duration: 52,
      traffic: keyframes([
        { t: 0, page: 4, static: 5, write: 0.8, heavy: 0.4 },
        { t: 15, page: 5, static: 6, write: 1, heavy: 0.5 },
        { t: 22, page: 13, static: 15, write: 2.2, heavy: 1.3 },
        { t: 29.9, page: 13, static: 15, write: 2.2, heavy: 1.3 },
        { t: 30, page: 13, static: 15, write: 2.2, heavy: 1.3, attack: 16 },
        { t: 38, page: 13, static: 15, write: 2.2, heavy: 1.3, attack: 16 },
        { t: 38.1, page: 12, static: 14, write: 2, heavy: 1.2 },
        { t: 52, page: 10, static: 12, write: 1.8, heavy: 1 },
      ]),
      events: [
        { t: 15, kind: "banner", text: "📺 放送スタート！ アクセス急増", tone: "danger" },
        { t: 30, kind: "banner", text: "⚠ 悪いロボットも来た！", tone: "danger" },
        { t: 42, kind: "crash", target: "app", duration: 9 },
        { t: 46, kind: "crash", target: "db", duration: 8 },
      ],
    },
    tips: ["busy", "db-busy", "far-slow", "heavy-sync", "backlog", "attack-hit", "spof", "health", "failover", "timeout"],
    hint: "まず今のまま動かして、どこが赤くなるか見てみよう。CDN・WAF・ロードバランサー・キャッシュ・予備DB・キュー…ぜんぶ必要かどうかは、あなたしだい。",
    takeaways: [
      "問題ごとに効くパーツがある：混雑→増やす・振り分ける、遅い→キャッシュ・CDN、故障→予備、攻撃→WAF、重い→キュー",
      "全部を最大にするとお金がかかる。どこが詰まるかを見て、必要なところに足す",
      "本物の大きなサービスも、同じ部品の組み合わせでできている",
    ],
    quiz: [
      {
        q: "画像が多くて、遠くの人ほど遅い。まず置くなら？",
        choices: ["CDN", "キャッシュ", "WAF"],
        answer: 0,
        why: "画像を近くの拠点から返せる CDN が効きます。キャッシュはおもに DB の読みこみを減らす役目です。",
      },
      {
        q: "データベースが止まっても、すぐ動き続けられるようにするには？",
        choices: ["予備DB（レプリカ）を置く", "サーバーを増やす", "キューを置く"],
        answer: 0,
        why: "予備DB があれば、フェイルオーバーで本番に切りかえられます。",
      },
    ],
    terms: ["architecture"],
    solution: [
      P("dns", "dns"),
      P("cdn", "cdn"),
      P("waf", "waf"),
      P("lb", "lb"),
      P("app1", "app"),
      P("app2", "app"),
      P("app3", "app"),
      P("cache", "cache"),
      P("db", "db"),
      P("replica", "replica"),
      P("queue", "queue"),
      P("worker1", "worker"),
      P("worker2", "worker"),
    ],
  },
  {
    id: "s11",
    no: 11,
    title: "昼は大混雑、夜はひま",
    subtitle: "混み具合に合わせて、サーバーの数を自動で変えよう",
    topic: "オートスケール",
    newParts: ["auto"],
    intro: [
      {
        title: "1日の中で、混み方が変わる",
        body: "お昼休みや夕方はアクセスが多いけど、朝や夜はがらがら。いちばん混む時間に合わせてサーバーをそろえておくと、ひまな時間にもずっとお金がかかります。",
      },
      {
        title: "自動で増やして、自動で減らす",
        body: "オートスケールは混み具合を見張っていて、混んできたら休んでいるサーバーを起こし（スケールアウト）、すいたら休ませます（スケールイン）。休んでいるサーバーには、月額がかかりません。",
        flow: [
          { icon: "auto", label: "オートスケール", say: "混んできた！ 起きて" },
          { icon: "app", label: "サーバー", say: "起動中…" },
        ],
        analogy: "オートスケールは、混んだら休憩中の店員さんを呼ぶ店長",
      },
      {
        title: "置いた数が、増やせる上限",
        body: "サーバーのマスに置いた台数までなら、自動で増やせます。ただし、起きて仕事を始めるまでには少し時間がかかります。",
      },
    ],
    slots: ["dns", "lb", "auto", "app1", "app2", "app3", "app4", "cache", "db"],
    fixed: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("cache", "cache"), P("db", "db")],
    budget: 30000,
    goal: { success: 0.95, latency: 230, cost: 18400 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 60,
      traffic: keyframes([
        { t: 0, page: 3, write: 0.4 },
        { t: 12, page: 4, write: 0.5 },
        { t: 24, page: 21, write: 1.5 },
        { t: 34, page: 21, write: 1.5 },
        { t: 40, page: 4, write: 0.5 },
        { t: 60, page: 3, write: 0.4 },
      ]),
      events: [
        { t: 15, kind: "banner", text: "🍙 お昼休み！ アクセスが増えてきた", tone: "warn" },
        { t: 38, kind: "banner", text: "🌙 夜になって、すいてきた", tone: "info" },
      ],
    },
    tips: ["busy", "scale-out", "scale-in", "timeout"],
    hint: "オートスケールを置いて、空いているサーバーのマスにもサーバーを置いておこう（置いた台数が、増やせる上限）。休んでいるサーバーは月額がかかりません。",
    takeaways: [
      "アクセスは1日の中で波がある。いちばん混む時間に合わせっぱなしだと、お金がむだになる",
      "オートスケールは、混んだら増やし（スケールアウト）、すいたら減らす（スケールイン）",
      "起きるまで時間がかかるので、急な混雑には少し余裕をもたせておく",
    ],
    quiz: [
      {
        q: "オートスケールのいちばん良いところは？",
        choices: ["混み具合に合わせて台数が変わり、むだなお金がかからない", "サーバー1台が速くなる", "悪いアクセスを止められる"],
        answer: 0,
        why: "混むときだけ台数を増やし、すいたら減らすので、使った分だけのお金ですみます。",
      },
    ],
    terms: ["autoscale", "peak"],
    solution: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("cache", "cache"), P("db", "db"), P("auto", "auto"), P("app2", "app"), P("app3", "app"), P("app4", "app")],
  },
  {
    id: "s12",
    no: 12,
    title: "だれも気づかない…",
    subtitle: "おかしくなったら、すぐ気づいて直そう",
    topic: "監視",
    newParts: ["monitor"],
    intro: [
      {
        title: "止まってはいないけど、とても遅い",
        body: "サーバーは、こわれて止まるだけではありません。メモリが足りなくなって、動いてはいるのにとても遅くなることもあります。ロードバランサーのヘルスチェックは「返事があるか」しか見ないので、遅いだけだと気づけません。",
      },
      {
        title: "いつも見張る「監視」",
        body: "監視は、それぞれのパーツの速さや混み具合（メトリクス）をいつも記録して、おかしな値になったらアラートで知らせます。決まった直し方（再起動など）は、自動でやらせることもできます。",
        flow: [
          { icon: "monitor", label: "監視", say: "サーバー2 が遅い！" },
          { icon: "app", label: "サーバー", say: "再起動して元気に" },
        ],
        analogy: "監視は、見回りの警備員さん",
      },
      {
        title: "早く気づけば、早く直せる",
        body: "夜中にこわれても、気づくのが朝なら、それまでお店は困ったまま。気づくのが早いほど、早く直せます。",
      },
    ],
    slots: ["dns", "lb", "app1", "app2", "app3", "app4", "cache", "db", "monitor"],
    fixed: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("app3", "app"), P("cache", "cache"), P("db", "db")],
    budget: 30000,
    goal: { success: 0.9, latency: 260, cost: 20200 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 50,
      traffic: keyframes([{ t: 0, page: 15, write: 1 }]),
      events: [
        { t: 10, kind: "slow", index: 1, duration: 40 },
        { t: 24, kind: "crash", target: "app", index: 0, duration: 26 },
        { t: 37, kind: "crash", target: "app", index: 1, duration: 13 },
      ],
    },
    tips: ["slow", "health", "monitor-alert", "spof", "busy", "timeout"],
    hint: "監視を置こう。サーバーを増やしても、遅いサーバーや止まった DB はそのままだよ。",
    takeaways: [
      "こわれ方は「止まる」だけじゃない。動いているのに、とても遅くなることもある",
      "監視は、速さや混み具合（メトリクス）を見張り、おかしければアラートで知らせる",
      "早く気づいて、決まった直し方（再起動など）は自動でやると、止まっている時間が短くなる",
    ],
    quiz: [
      {
        q: "サーバーが止まってはいないけど、とても遅くなった。気づけるのは？",
        choices: ["監視（速さなどの数字を見張る）", "ロードバランサーのヘルスチェック", "DNS"],
        answer: 0,
        why: "ヘルスチェックは返事があるかを見るだけ。速さなどの数字（メトリクス）を見張る監視なら、遅いことにも気づけます。",
      },
    ],
    terms: ["monitoring", "metrics", "alert"],
    solution: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("app3", "app"), P("cache", "cache"), P("db", "db"), P("monitor", "monitor")],
  },
  {
    id: "s13",
    no: 13,
    title: "データが消えた！",
    subtitle: "もしものときに、元にもどせるように",
    topic: "バックアップ",
    newParts: ["backup"],
    intro: [
      {
        title: "うっかり、全部消しちゃった",
        body: "作業のまちがいや、プログラムの不具合で、データベースの中身が消えてしまうことがあります。データがなければ、ページを見に来た人に何も返せません。",
      },
      {
        title: "予備DB があるから大丈夫…？",
        body: "予備DB（レプリカ）は、本番DB の変化をいつも写しています。だから「消した」という操作も、すぐに写ってしまいます。予備DB は故障には強いけど、まちがいからは守ってくれません。",
        flow: [
          { icon: "db", label: "本番DB", say: "消しちゃった…" },
          { icon: "replica", label: "予備DB", say: "こっちも消えた！" },
        ],
      },
      {
        title: "ときどき、別の場所に保存",
        body: "バックアップは、ときどきデータを別の場所に保存しておくこと。消えても、保存したときの状態に元にもどせます（リストア）。消えてから置いても間に合わないので、先に置いておこう。",
        flow: [
          { icon: "db", label: "本番DB" },
          { icon: "backup", label: "バックアップ", say: "保存しておくね" },
        ],
        analogy: "バックアップは、台帳のコピーを金庫にしまうこと",
      },
    ],
    slots: ["dns", "lb", "app1", "app2", "cache", "db", "replica", "backup"],
    fixed: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("cache", "cache"), P("db", "db"), P("replica", "replica")],
    budget: 30000,
    goal: { success: 0.92, latency: 280, cost: 20900 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 60,
      traffic: keyframes([{ t: 0, page: 7, write: 1.2 }]),
      events: [{ t: 22, kind: "wipe" }],
    },
    tips: ["repl", "wipe", "repl-lost", "backup-late", "restore", "cache-hit"],
    hint: "本番の前に、バックアップを置いておこう。予備DB にも消したことが写ってしまうので、予備DB だけでは元にもどせないよ。",
    takeaways: [
      "データは、まちがいや不具合で消えてしまうことがある",
      "予備DB は「消した」ことまで写すので、まちがいからは守れない",
      "バックアップをとっておけば、保存したときの状態に元にもどせる（リストア）",
    ],
    quiz: [
      {
        q: "まちがえて消したデータを、元にもどせるのは？",
        choices: ["バックアップ", "予備DB（レプリカ）", "キャッシュ"],
        answer: 0,
        why: "予備DB には「消した」ことも写されてしまいます。前の状態を保存しておくバックアップなら、元にもどせます。",
      },
    ],
    terms: ["backup", "restore"],
    solution: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("cache", "cache"), P("db", "db"), P("replica", "replica"), P("backup", "backup")],
  },
  {
    id: "s14",
    no: 14,
    title: "町じゅうが停電！",
    subtitle: "拠点がまるごと止まっても、お店を続けよう",
    topic: "マルチリージョン",
    newParts: ["region"],
    intro: [
      {
        title: "建物ごと止まることもある",
        body: "大きな地震や停電で、サーバーが置いてある建物（データセンター）ごと止まることがあります。サーバーを何台に増やしても、みんな同じ場所にあれば、いっしょに止まってしまいます。",
      },
      {
        title: "遠くの町に、もう1つのお店",
        body: "遠くの地域（リージョン）にも、サーバーとデータの写しをそろえておきます。いつもの拠点が止まったら、DNS が「こっちへどうぞ」と予備の拠点を案内します。",
        flow: [
          { icon: "user", label: "スマホ", say: "odekake.app はどこ？" },
          { icon: "dns", label: "DNS", say: "いまは大阪へ！" },
          { icon: "region", label: "大阪の拠点", say: "いらっしゃい" },
        ],
        analogy: "予備の拠点は、となり町の支店",
      },
      {
        title: "TTL が長いと、切りかえが遅れる",
        body: "スマホは DNS の答えを TTL のあいだ覚えていて、そのあいだは止まった拠点へ行ってしまいます。DNS をタップすると、TTL を短くできます（そのかわり、問い合わせが増えます）。",
      },
    ],
    slots: ["dns", "region", "lb", "app1", "app2", "app3", "cache", "db", "replica"],
    fixed: [P("dns", "dns"), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("cache", "cache"), P("db", "db"), P("replica", "replica")],
    budget: 34000,
    goal: { success: 0.9, latency: 240, cost: 26600 },
    setup: {
      requiresDns: true,
      farRatio: 0,
      duration: 65,
      traffic: keyframes([{ t: 0, page: 6, write: 0.8 }]),
      events: [{ t: 23, kind: "outage", duration: 42 }],
    },
    tips: ["outage", "spof", "dns-failover", "ttl-stale", "dns-cached"],
    hint: "予備の拠点（大阪）を置こう。それから DNS をタップして、TTL を短くしておくと、切りかえが早くなるよ。",
    takeaways: [
      "同じ場所にあるパーツは、停電や災害でいっしょに止まる",
      "遠くの地域（リージョン）に予備の拠点を用意し、DNS で案内を切りかえる",
      "TTL が長いと、利用者はしばらく古い住所へ行ってしまう。切りかえの速さと問い合わせの数のバランス",
    ],
    quiz: [
      {
        q: "データセンターがまるごと停電！ お店を続けるには？",
        choices: ["遠くの地域に、予備の拠点を用意しておく", "同じ場所のサーバーを増やす", "キャッシュを置く"],
        answer: 0,
        why: "同じ場所のパーツは、みんないっしょに止まります。遠くの地域（リージョン）に予備があれば、そちらで続けられます。",
      },
    ],
    terms: ["region", "dr"],
    solution: [P("dns", "dns", 1), P("lb", "lb"), P("app1", "app"), P("app2", "app"), P("cache", "cache"), P("db", "db"), P("replica", "replica"), P("region", "region")],
  },
];

export const stageById = (id: string) => STAGES.find((s) => s.id === id);

/** このステージに攻撃（ロボット）が出てくるか */
export function hasAttacks(setup: SimSetup): boolean {
  const end = Number.isFinite(setup.duration) ? setup.duration : 60;
  for (let t = 0; t <= end; t += 0.5) if ((setup.traffic(t).attack ?? 0) > 0) return true;
  return false;
}

/** このステージで、遠くの町の利用者がいるか */
export const hasFarUsers = (setup: SimSetup) => setup.farRatio > 0;

export type Result = {
  success: number;
  latency: number;
  cost: number;
  clear: boolean;
  fast: boolean;
  cheap: boolean;
  stars: number;
};

export function evaluate(goal: Goal, success: number | null, latency: number | null, cost: number): Result {
  const s = success ?? 0;
  const l = latency ?? Infinity;
  const clear = s >= goal.success;
  const fast = clear && l <= goal.latency;
  const cheap = clear && cost <= goal.cost + 0.5;
  return { success: s, latency: l, cost, clear, fast, cheap, stars: clear ? 1 + (fast ? 1 : 0) + (cheap ? 1 : 0) : 0 };
}

/** 本番中に出すヒント（せんせいのひとこと） */
export const TIPS: Record<TipId, string> = {
  "first-ok": "ミント色の点がもどってきた！ これがサーバーからの返事（レスポンス）です。",
  "no-server": "お願いの行き先がありません。まずはサーバーを置こう。",
  "dns-first": "白い点は「odekake.app はどこ？」という、DNS への問い合わせです。",
  "dns-cached": "一度しらべた住所はしばらく覚えておく（TTL）ので、次からは DNS に聞かずに直接行けます。",
  "dns-missing": "住所（IPアドレス）が分からず、たどりつけません。DNS を置こう。",
  busy: "サーバーが手いっぱい！ 待ちきれない分は「503（混雑中）」で断られています。",
  "unused-app": "サーバーを増やしても、DNS が教える住所は1台目だけ。振り分ける係が必要です。",
  "lb-spread": "ロードバランサーが、すいているサーバーへ順に振り分けています。",
  "missing-data": "投稿したサーバーとは別のサーバーに来たので、データが見つかりません！",
  "db-first": "どのサーバーも、同じデータベースを見に行くようになりました。",
  "db-busy": "データベースの前に行列が…！ 読みこみが集中しています。",
  "cache-hit": "キャッシュにあった！（HIT）データベースまで行かずに返せました。",
  "cache-miss": "キャッシュになかったので、データベースへ読みに行きます。読んだデータはキャッシュに残ります。",
  "cdn-hit": "CDN が近くの拠点から画像を返しました。遠くのサーバーまで行かずにすみます。",
  "far-slow": "遠くの町の人は、サーバーまで往復するだけで時間がかかっています。",
  health: "ロードバランサーが故障に気づき（ヘルスチェック）、動いているサーバーだけに振り分けはじめました。",
  spof: "ここが止まると全部止まる…！ これが「単一障害点」です。",
  failover: "予備DB が本番に切りかわりました（フェイルオーバー）。",
  repl: "本番DB に書いたデータが、予備DB にも写されています（レプリケーション）。",
  "queue-ack": "重い処理はキューに並べて、利用者には「受け付けました」とすぐ返事しています。",
  "heavy-sync": "紫の重い処理が、サーバーを長いあいだ占領しています…。",
  backlog: "キューに仕事がたまってきました。ワーカーが足りないかも。",
  "waf-block": "WAF が攻撃を入口で止めました！",
  "attack-hit": "攻撃がサーバーまで届いて、手がふさがっています！",
  timeout: "待たされすぎて、あきらめられてしまいました（504 タイムアウト）。",
  "scale-out": "混んできたので、オートスケールが休んでいたサーバーを起こしました（スケールアウト）。起きるまで少しかかります。",
  "scale-in": "すいてきたので、オートスケールがサーバーを休ませました（スケールイン）。休んでいるあいだは月額がかかりません。",
  slow: "サーバーがとても遅くなった…。でも止まってはいないので、ロードバランサーのヘルスチェックでは気づけません。",
  "monitor-alert": "監視がおかしな様子に気づいて（アラート）、自動で再起動しました。",
  wipe: "データベースの中身が消えた！ ページを読みに来ても、データがありません。",
  "repl-lost": "予備DB にも「消した」ことが写されてしまいました。予備DB は、まちがいからは守ってくれません。",
  restore: "バックアップから元にもどせました（リストア）！",
  "backup-late": "消える前に保存したバックアップがないので、元にもどせません…。バックアップは前もってとっておこう。",
  outage: "拠点がまるごと止まると、同じ場所にあるパーツはみんないっしょに止まってしまいます。",
  "dns-failover": "DNS が、止まった拠点のかわりに予備の拠点（大阪）を案内しはじめました。",
  "ttl-stale": "DNS の答えを覚えている（TTL の）あいだは、止まった拠点へ行ってしまいます。",
};
