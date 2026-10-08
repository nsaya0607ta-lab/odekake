/**
 * サーバー室のレッスン。フレブル先生の案内で、1ステップずつ「やってみる → 返事を見る → わかったこと」を進める。
 * 1つの画面に出すのは、いまのステップの説明とボタン1つだけ（くわしいもの＝プログラム全体・本物の HTTP・記録は、開いたときだけ）。
 *
 * - action … ボタンでやること（お願いを送る・設定を変える・プログラムを書きかえる・データベースを見る）
 * - wait … まだ押せないときの理由（サーバーの起動待ち・キャッシュが消えるのを待つ など）。null なら押せる
 * - until … やったあと、こうなるまで待ってから結果を出す（デプロイ後の起動・監視の再起動 など）
 * - ok … 思ったとおりの返事か。ちがえば retry を出して、もう一度押してもらう
 * - learn … うまくいったあとの「わかったこと」。**ことば** は目立たせる
 * - code … この返事を作ったプログラムの行（この文字をふくむ行を見せる）
 * サーバーの動きは本物（Web Worker）なので、どのステップも、つぎのステップの前提がくずれないように待ち合わせる。
 */

import type { BurstResult, Entry, Method, RoomSettings, ServerRoom } from "./room";

/** ステップのあいだで覚えておくこと */
export type LessonCtx = {
  /** 書きかえたあいさつ（レッスン1） */
  edited?: string;
  /** 固めたサーバーの番号（0 から）と、そのときの起動回数（レッスン5） */
  frozen?: number;
  boots?: number;
};

export type StepResult = { entry?: Entry; burst?: BurstResult };

export type LessonAction =
  /** times … まとめて送る回数。editBody … 送る本文を書きかえられる */
  | { kind: "send"; label: string; method: Method; path: string; body?: string; times?: number; editBody?: string }
  | { kind: "set"; label: string; patch: Partial<RoomSettings> }
  /** find … プログラムの中の、書きかえてもらう文字 */
  | { kind: "edit"; label: string; find: string; field: string }
  | { kind: "db"; label: string };

export type LessonStep = {
  say: string;
  action: LessonAction;
  /** まだ押せないときの理由（null なら押せる） */
  wait?: (room: ServerRoom, ctx: LessonCtx) => string | null;
  /** やったあと、こうなるまで待ってから結果を出す */
  until?: (room: ServerRoom, ctx: LessonCtx) => boolean;
  /** until を待っているあいだの、ボタンの文字 */
  waiting?: string;
  ok?: (r: StepResult, ctx: LessonCtx) => boolean;
  retry?: string;
  learn: string | ((r: StepResult, ctx: LessonCtx) => string);
  code?: string[] | ((ctx: LessonCtx) => string[]);
  /** やったときに覚えておくこと */
  remember?: (r: StepResult, ctx: LessonCtx, room: ServerRoom) => void;
};

export type Lesson = {
  id: string;
  no: number;
  title: string;
  sub: string;
  /** 使うお手本（room-templates.ts） */
  template: string;
  settings: RoomSettings;
  /** 図に出すもの（サーバーのプログラムが使うもの） */
  uses: { db?: boolean; cache?: boolean };
  steps: LessonStep[];
  /** 最後に出す「わかったこと」 */
  summary: string[];
};

const BASE: RoomSettings = { count: 2, lb: "rr", cdn: false, autoHeal: false };

const ms = (r: StepResult) => r.entry?.ms ?? 0;
const sec = (r: StepResult) => (ms(r) / 1000).toFixed(1);
const by = (r: StepResult) => r.entry?.by.replace("（失敗）", "") ?? "";
const status = (r: StepResult) => r.entry?.res.status ?? 0;
const body = (r: StepResult) => r.entry?.res.body ?? "";
const xcache = (r: StepResult) => r.entry?.res.headers.find(([k]) => k === "x-cache")?.[1] ?? "";
/** 「サーバー2」→ 1（番号は 0 から） */
export const serverIndex = (name: string) => {
  const m = /サーバー(\d+)/.exec(name);
  return m ? Number(m[1]) - 1 : -1;
};

/** 固めたサーバー */
const frozenOf = (room: ServerRoom, ctx: LessonCtx) => (ctx.frozen != null ? room.servers[ctx.frozen] : undefined);

export const LESSONS: Lesson[] = [
  {
    id: "hello",
    no: 1,
    title: "はじめてのサーバー",
    sub: "お願いと返事・振り分け・デプロイ",
    template: "hello",
    settings: BASE,
    uses: {},
    steps: [
      {
        say: "ここには、本物のプログラムで動くサーバーが2台あります。まずは、お店のトップページを見せてもらおう",
        action: { kind: "send", label: "トップページを見せて", method: "GET", path: "/" },
        ok: (r) => status(r) === 200,
        retry: "うまく返事がもらえませんでした。もう一度押してみよう",
        learn: "サーバーから返事が来ました！ あなたが送った「見せて」というお願いを **リクエスト**、サーバーの返事を **レスポンス** といいます。**200** は「うまくいった」のしるしです",
        code: ['if (path === "/")', "いらっしゃいませ"],
      },
      {
        say: "もう一度、同じお願いを送ってみよう。こんどは、どのサーバーが返事をするかな？",
        action: { kind: "send", label: "もう一度、トップページを見せて", method: "GET", path: "/" },
        ok: (r) => status(r) === 200,
        retry: "うまく返事がもらえませんでした。もう一度押してみよう",
        learn: (r) =>
          `こんどは ${by(r)} が返事をしました。**ロードバランサー** が、お願いを サーバー1 → サーバー2 → サーバー1 …と順番に振り分けているからです。こうすると、1台に仕事が集まりすぎません`,
      },
      {
        say: "お店にないページ（/nai）をお願いすると、どうなるかな？",
        action: { kind: "send", label: "/nai を見せて", method: "GET", path: "/nai" },
        ok: (r) => status(r) === 404,
        retry: "思ったのとちがう返事でした。もう一度押してみよう",
        learn: "**404** は「見つからない」のしるしです。プログラムに書いていないページなので、いちばん下の行の返事になりました",
        code: ["status: 404"],
      },
      {
        say: "プログラムを書きかえてみよう。トップページのあいさつを好きな言葉に変えて、「デプロイ」を押してね",
        action: { kind: "edit", label: "デプロイ", find: "いらっしゃいませ！ わんこ商店です", field: "トップページのあいさつ" },
        until: (room) => room.ready(),
        waiting: "新しいプログラムで起動しています…",
        learn: "新しいプログラムをサーバーに入れることを **デプロイ** といいます。サーバー1 も サーバー2 も、新しいプログラムで動きはじめました",
        code: (ctx) => [ctx.edited != null ? editedMark(ctx.edited) : "いらっしゃいませ"],
      },
      {
        say: "あいさつが変わったか、トップページを見てたしかめよう",
        action: { kind: "send", label: "トップページを見せて", method: "GET", path: "/" },
        ok: (r, ctx) => status(r) === 200 && (!ctx.edited || body(r).includes(ctx.edited)),
        retry: "まだ前の返事でした。もう一度押してみよう",
        learn: (_r, ctx) =>
          `「${ctx.edited ?? ""}」に変わりました！ プログラムを書きかえてデプロイすると、サーバーの返事が変わります。Web のサービスは、こうして作られています`,
        code: (ctx) => [ctx.edited != null ? editedMark(ctx.edited) : "いらっしゃいませ"],
      },
    ],
    summary: ["お願い＝リクエスト、返事＝レスポンス", "200 は成功、404 は見つからない", "ロードバランサーが、サーバーに順番に振り分ける", "デプロイ＝新しいプログラムを、サーバーに入れる"],
  },
  {
    id: "db",
    no: 2,
    title: "データベース",
    sub: "どのサーバーでも、同じデータを見る",
    template: "db",
    settings: BASE,
    uses: { db: true },
    steps: [
      {
        say: "このお店は、来てくれたお客さんの数を数えています。トップページを見てみよう",
        action: { kind: "send", label: "トップページを見せて", method: "GET", path: "/" },
        ok: (r) => status(r) === 200,
        retry: "うまく返事がもらえませんでした。もう一度押してみよう",
        learn: "人数は、サーバーの中ではなく **データベース** に書いてあります。サーバーのプログラムが、データベースの数を1つふやして返しました",
        code: ['env.db.incr("visits")'],
      },
      {
        say: "もう一度見てみよう。こんどは別のサーバーが返事をします。人数はどうなるかな？",
        action: { kind: "send", label: "もう一度、トップページを見せて", method: "GET", path: "/" },
        ok: (r) => status(r) === 200,
        retry: "うまく返事がもらえませんでした。もう一度押してみよう",
        learn: (r) => `${by(r)} が返事をしても、人数は続きから数えています。どのサーバーも、同じデータベースを見ているからです`,
      },
      {
        say: "お店に、レビュー（感想）を送ってみよう。言葉は書きかえてもいいよ",
        action: { kind: "send", label: "レビューを送る", method: "POST", path: "/reviews", editBody: "ドッグランが広くて最高！" },
        ok: (r) => status(r) === 201,
        retry: "思ったのとちがう返事でした。もう一度押してみよう",
        learn: "**POST** は「これを受け取って」というお願いです。**201** は「作れた」のしるし。レビューがデータベースに保存されました",
        code: ['request.method === "POST"', 'env.db.put("review:" + id, text)'],
      },
      {
        say: "保存されたレビューを、読んでみよう",
        action: { kind: "send", label: "レビューを見せて", method: "GET", path: "/reviews" },
        ok: (r) => status(r) === 200,
        retry: "うまく返事がもらえませんでした。もう一度押してみよう",
        learn: "データベースから、レビューが返ってきました。見るときは **GET**、送るときは **POST**。お願いの種類のことを **メソッド** といいます",
        code: ['env.db.list("review:")'],
      },
      {
        say: "データベースの中を、のぞいてみよう",
        action: { kind: "db", label: "データベースの中を見る" },
        learn: "人数（visits）や、レビュー（review:1）が入っています。データベースはサーバーとは別の場所にあるので、サーバーを作りなおしても中身は消えません",
      },
    ],
    summary: ["データは、みんなで使うデータベースに置く", "どのサーバーが返事をしても、同じデータが見える", "GET は見る、POST は送る（メソッド）", "201 は「作れた」"],
  },
  {
    id: "cache",
    no: 3,
    title: "キャッシュ",
    sub: "時間のかかる答えを、しばらく覚えておく",
    template: "cache",
    settings: BASE,
    uses: { cache: true },
    steps: [
      {
        say: "人気ランキングを見てみよう。ランキングを作るのには、少し時間がかかります",
        action: { kind: "send", label: "ランキングを見せて", method: "GET", path: "/ranking" },
        ok: (r) => status(r) === 200,
        retry: "うまく返事がもらえませんでした。もう一度押してみよう",
        learn: (r) => `返事まで ${sec(r)}秒 かかりました。ランキングを作るのに、時間がかかるからです`,
        code: ["await env.sleep(800)"],
      },
      {
        say: "すぐに、もう一度見てみよう",
        action: { kind: "send", label: "もう一度、ランキングを見せて", method: "GET", path: "/ranking" },
        ok: (r) => status(r) === 200 && body(r).includes("キャッシュ"),
        retry: "10秒たって、キャッシュが消えていました。もう一度押すと、こんどは速いはず！",
        learn: (r) => `こんどは ${ms(r)}ms！ 1回目に作ったランキングを **キャッシュ** に覚えておいたので、作りなおさずに返せました`,
        code: ['env.cache.get("ranking")'],
      },
      {
        say: "キャッシュは、10秒で消えるようにしてあります。消えるのを待ってから、もう一度見てみよう",
        wait: (room) => {
          const left = room.cacheLeft("ranking");
          return left > 0 ? `キャッシュが消えるまで あと ${left}秒` : null;
        },
        action: { kind: "send", label: "ランキングを見せて", method: "GET", path: "/ranking" },
        ok: (r) => status(r) === 200 && body(r).includes("作りたて"),
        retry: "まだキャッシュが残っていました。もう一度押してみよう",
        learn: "また作りたてになりました。古い答えをずっと出し続けないように、キャッシュには **覚えておく時間** を決めておきます",
        code: ['env.cache.put("ranking", ranking, 10)'],
      },
    ],
    summary: ["キャッシュ＝時間のかかる答えを、手元に覚えておく", "2回目からは、すぐに返せる", "覚えておく時間がすぎたら、作りなおす"],
  },
  {
    id: "cdn",
    no: 4,
    title: "CDN",
    sub: "あなたの近くで、返事を使い回す",
    template: "cdn",
    settings: BASE,
    uses: {},
    steps: [
      {
        say: "**CDN** は、あなたの近くで返事を覚えておいてくれる場所です。CDN をオンにしよう",
        action: { kind: "set", label: "CDN をオンにする", patch: { cdn: true } },
        learn: "あなたとロードバランサーのあいだに、CDN が入りました。お願いは、まず CDN に届きます",
      },
      {
        say: "お店のロゴ（/logo）を見せてもらおう",
        action: { kind: "send", label: "ロゴを見せて", method: "GET", path: "/logo" },
        ok: (r) => status(r) === 200,
        retry: "うまく返事がもらえませんでした。もう一度押してみよう",
        learn: (r) =>
          `${by(r)} がロゴを作って返しました（${ms(r)}ms）。返事に「20秒間、使い回してOK（max-age=20）」と書いてあるので、CDN が覚えておきます`,
        code: ['"Cache-Control": "public, max-age=20"'],
      },
      {
        say: "もう一度、ロゴを見せてもらおう",
        action: { kind: "send", label: "もう一度、ロゴを見せて", method: "GET", path: "/logo" },
        ok: (r) => xcache(r) === "HIT",
        retry: "20秒たって、CDN が忘れてしまいました。もう一度押すと、こんどは覚えているはず！",
        learn: (r) =>
          `${ms(r)}ms で返ってきました！ CDN が覚えていた返事を返したので、サーバーまで行っていません（**CDN HIT**）。サーバーの仕事がへります`,
      },
      {
        say: "こんどは、いまの時刻（/time）を見せてもらおう",
        action: { kind: "send", label: "時刻を見せて", method: "GET", path: "/time" },
        ok: (r) => status(r) === 200,
        retry: "うまく返事がもらえませんでした。もう一度押してみよう",
        learn: "時刻は毎回ちがうので、返事に「使い回さないで（no-store）」と書いてあります。CDN は覚えずに、サーバーまで通しました（**CDN MISS**）",
        code: ['"Cache-Control": "no-store"'],
      },
      {
        say: "もう一度、時刻を見せてもらおう。こんどもサーバーが返事をするかな？",
        action: { kind: "send", label: "もう一度、時刻を見せて", method: "GET", path: "/time" },
        ok: (r) => status(r) === 200 && xcache(r) !== "HIT",
        retry: "思ったのとちがう返事でした。もう一度押してみよう",
        learn: (r) => `また ${by(r)} が返事をしました。毎回ちがうものは CDN に覚えさせず、同じものだけを使い回します`,
      },
    ],
    summary: ["CDN＝近くで返事を使い回す", "返事の Cache-Control で、使い回してよいかを伝える", "毎回ちがうもの（時刻など）は no-store"],
  },
  {
    id: "broken",
    no: 5,
    title: "こわれたとき",
    sub: "エラー・時間切れ・固まったサーバー",
    template: "broken",
    settings: BASE,
    uses: {},
    steps: [
      {
        say: "このお店には、ときどき失敗するページ（/lucky）があります。20回まとめて送ってみよう",
        action: { kind: "send", label: "/lucky を20回送る", method: "GET", path: "/lucky", times: 20 },
        ok: (r) => (r.burst?.codes[500] ?? 0) > 0,
        retry: "たまたま全部うまくいきました。もう一度送ってみよう",
        learn: (r) =>
          `20回のうち ${r.burst?.codes[500] ?? 0}回が **500**（サーバーのエラー）でした。プログラムの中でエラーが起きると、500 が返ります`,
        code: ['throw new Error("うっかりミス！")'],
      },
      {
        say: "とても時間がかかるページ（/slow）を見てみよう",
        action: { kind: "send", label: "/slow を見せて", method: "GET", path: "/slow" },
        ok: (r) => status(r) === 504,
        retry: "思ったのとちがう返事でした。もう一度押してみよう",
        learn: "ロードバランサーは3秒しか待ちません。間に合わないと **504**（時間切れ）になります。お客さんを待たせすぎないためです",
        code: ["await env.sleep(5000)"],
      },
      {
        say: "/freeze を送ると、サーバーが計算をやめられなくなって、固まってしまいます。送ってみよう",
        action: { kind: "send", label: "/freeze を送る", method: "GET", path: "/freeze" },
        ok: (r) => status(r) === 504 && serverIndex(r.entry?.by ?? "") >= 0,
        retry: "思ったのとちがう返事でした。もう一度押してみよう",
        remember: (r, ctx) => {
          ctx.frozen = serverIndex(r.entry?.by ?? "");
        },
        learn: (r) => `${by(r)} が固まって、返事ができなくなりました（504）`,
        code: ["while (true) {}"],
      },
      {
        say: "固まったサーバーは、「げんき？」の確認（/health）にも答えられません。お店はまだ開いているかな？ トップページを5回見てみよう",
        wait: (room, ctx) => (frozenOf(room, ctx)?.healthy ? "ロードバランサーが、様子を見ています…" : null),
        action: { kind: "send", label: "トップページを5回見せて", method: "GET", path: "/", times: 5 },
        ok: (r) => r.burst?.ok === 5,
        retry: "失敗した返事がありました。もう一度送ってみよう",
        learn: (r) =>
          `5回とも ${Object.keys(r.burst?.by ?? {}).join("・")} が返事をしました。ロードバランサーが「げんき？」の確認（**ヘルスチェック**）で固まったサーバーを見つけて、振り分けをやめたからです。1台こわれても、お店は止まりません`,
        code: ['if (url.pathname === "/health")'],
      },
      {
        say: "固まったサーバーを自動で直してくれる **監視** を、オンにしてみよう",
        action: { kind: "set", label: "監視をオンにする", patch: { autoHeal: true } },
        remember: (_r, ctx, room) => {
          ctx.boots = frozenOf(room, ctx)?.boots ?? 0;
        },
        until: (room, ctx) => {
          const s = frozenOf(room, ctx);
          return Boolean(s && s.boots > (ctx.boots ?? 0) && s.healthy);
        },
        waiting: "監視が見張っています…",
        learn: (_r, ctx) =>
          `監視が、ヘルスチェックに答えられない サーバー${(ctx.frozen ?? 0) + 1} を見つけて、自動で再起動しました。もう元気です！ 本物のサーバーも、こうやって監視が見張っています`,
      },
    ],
    summary: ["500 はプログラムのエラー、504 は時間切れ", "ヘルスチェックで、こわれたサーバーを外す", "監視が、こわれたサーバーを自動で再起動する"],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

/** 文の中の **ことば** を分ける（[ふつう, 目立たせる, ふつう, …]） */
export const splitTerms = (text: string) => text.split("**");

/** 書きかえた言葉を、プログラムの文字列（"…"）の中に入れられる形にする */
export const quoteInside = (text: string) => JSON.stringify(text).slice(1, -1);

/** レッスン1で書きかえた行の目じるし（あいさつの言葉のあとに「（」が続く行。短い言葉でも、ほかの行と取りちがえない） */
export const editedMark = (word: string) => `Response("${quoteInside(word)}（`;
