/**
 * サーバー室のお手本プログラム。ここから選んで、書きかえて、デプロイできる。
 * どれも /health（ロードバランサーのヘルスチェック）に返事をする。
 */

import type { Method } from "./room";

export type Try = { method: Method; path: string; body?: string };
/** steps … 「やってみよう」（何を送って、どこを見るとよいか） */
export type RoomTemplate = { id: string; name: string; note: string; steps: string[]; tries: Try[]; code: string };

export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "hello",
    name: "はじめてのサーバー",
    note: "ページごとに、ちがう返事をする",
    steps: [
      "「GET /」を送ってみよう。本文と、ステータス 200（成功）が返ってくる",
      "「20回まとめて」を押すと、サーバー1・サーバー2 に順番に振り分けられる",
      "「GET /nai」は 404（見つからない）。プログラムに if を足して、新しいページを作ってデプロイしよう",
    ],
    tries: [
      { method: "GET", path: "/" },
      { method: "GET", path: "/hello" },
      { method: "GET", path: "/nai" },
    ],
    code: `// リクエスト（お願い）が来るたびに、この関数が呼ばれます。
// request.method … GET（見る）や POST（送る）
// new URL(request.url).pathname … どのページか（/hello など）
async function onRequest(request, env) {
  const path = new URL(request.url).pathname;

  // ロードバランサーが「げんき？」と聞きに来る場所（ヘルスチェック）
  if (path === "/health") return new Response("ok");

  if (path === "/") {
    return new Response("いらっしゃいませ！ わんこ商店です（" + env.server + "）");
  }
  if (path === "/hello") {
    return new Response("こんにちは！");
  }
  // どれでもなければ「見つかりません」（404）
  return new Response("そのページはありません", { status: 404 });
}
`,
  },
  {
    id: "db",
    name: "データベースを使う",
    note: "どのサーバーに来ても、同じデータが見える",
    steps: [
      "「GET /」を何回か送ると、どのサーバーが返事をしても、人数が1つずつふえる（データベースはみんなで1つ）",
      "「POST /reviews」でレビューを書いて、「GET /reviews」で読んでみよう",
      "いちばん下の「データベースの中身」も見てみよう。この端末に残るので、画面を閉じても消えない",
    ],
    tries: [
      { method: "GET", path: "/" },
      { method: "POST", path: "/reviews", body: "ドッグランが広くて最高！" },
      { method: "GET", path: "/reviews" },
    ],
    code: `// env.db は、みんなで使うデータベース（どのサーバーからも同じ中身が見える）
//   await env.db.get("名前")        … 読む
//   await env.db.put("名前", 中身)  … 書く
//   await env.db.incr("名前")       … 1 ふやして、ふえた数を返す
//   await env.db.list("はじめの文字") … まとめて読む
async function onRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response("ok");

  // 来てくれた人の数を数える
  if (url.pathname === "/") {
    const visits = await env.db.incr("visits");
    return new Response(visits + " 人目のお客さんです（" + env.server + "）");
  }
  // POST /reviews … レビューを書く（送った本文が、そのまま保存される）
  if (url.pathname === "/reviews" && request.method === "POST") {
    const text = await request.text();
    const id = await env.db.incr("review-count");
    await env.db.put("review:" + id, text);
    return Response.json({ ok: true, id }, { status: 201 });
  }
  // GET /reviews … レビューを全部見る
  if (url.pathname === "/reviews") {
    const list = await env.db.list("review:");
    return Response.json(list);
  }
  return new Response("そのページはありません", { status: 404 });
}
`,
  },
  {
    id: "cache",
    name: "キャッシュで速く",
    note: "時間のかかる答えを、しばらく覚えておく",
    steps: [
      "「GET /ranking」を送ると、はじめは 0.8秒くらいかかる（作りたて）",
      "すぐにもう一度送ると、あっというまに返ってくる（キャッシュ）。10秒たつと、また作りなおし",
      "サーバーを3台にしても速いまま。キャッシュも、みんなで1つ",
    ],
    tries: [{ method: "GET", path: "/ranking" }],
    code: `// 人気ランキングを作るのに、時間がかかる（0.8秒）とします
async function makeRanking(env) {
  await env.sleep(800);
  return ["ドッグラン", "わんこカフェ", "わんこ温泉"];
}

// env.cache は、すぐ読める手元のメモ（キャッシュ）
//   await env.cache.get("名前")             … 読む（なければ null）
//   await env.cache.put("名前", 中身, 秒数) … その秒数だけ覚えておく
async function onRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response("ok");

  if (url.pathname === "/ranking") {
    let ranking = await env.cache.get("ranking");
    let from = "キャッシュ（速い）";
    if (!ranking) {
      ranking = await makeRanking(env); // なければ作って
      await env.cache.put("ranking", ranking, 10); // 10秒だけ覚えておく
      from = "作りたて（遅い）";
    }
    return Response.json({ ranking, from });
  }
  return new Response("そのページはありません", { status: 404 });
}
`,
  },
  {
    id: "cdn",
    name: "CDN に覚えてもらう",
    note: "返事に「使い回してOK」と書くと、CDN が代わりに返す",
    steps: [
      "上の「CDN」を「あり」にする",
      "「GET /logo」を2回送る。2回目は「CDN HIT」で、サーバーまで行かずに返ってくる（0ms）",
      "「GET /time」は no-store（使い回さないで）なので、毎回サーバーが返事をする",
    ],
    tries: [
      { method: "GET", path: "/logo" },
      { method: "GET", path: "/time" },
    ],
    code: `// 上の「CDN」をオンにしてから、/logo を何回か送ってみよう。
// 返事のヘッダー（Cache-Control）で、CDN に「使い回してよいか」を伝えます。
async function onRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response("ok");

  if (url.pathname === "/logo") {
    await env.sleep(300); // 画像を作るのに時間がかかる
    return new Response("🐶 わんこ商店のロゴ（" + env.server + " が作成）", {
      // 「この返事は 20秒間 使い回してOK」
      headers: { "Cache-Control": "public, max-age=20" },
    });
  }
  if (url.pathname === "/time") {
    // 毎回ちがう返事なので「使い回さないで」
    return new Response(new Date().toLocaleTimeString("ja-JP"), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  return new Response("そのページはありません", { status: 404 });
}
`,
  },
  {
    id: "broken",
    name: "こわれやすいサーバー",
    note: "エラー・遅い・固まる を、わざと起こす",
    steps: [
      "「GET /lucky」を「20回まとめて」送ると、ときどき 500（サーバーのエラー）になる",
      "「GET /slow」は、3秒で待ちきれずに 504（時間切れ）",
      "「GET /freeze」でサーバーが固まる。ヘルスチェックで外されるのを見たら、上の「監視」を「あり」にして、もう一度",
    ],
    tries: [
      { method: "GET", path: "/lucky" },
      { method: "GET", path: "/slow" },
      { method: "GET", path: "/freeze" },
    ],
    code: `// わざと調子が悪くなるサーバー。上の「監視」をオンにすると、どうなるかな？
async function onRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response("ok");

  // ときどき失敗する → 500（サーバーのエラー）
  if (url.pathname === "/lucky") {
    if (Math.random() < 0.3) throw new Error("うっかりミス！");
    return new Response("うまくいきました");
  }
  // とても遅い → 待ちきれずに 504（時間切れ）
  if (url.pathname === "/slow") {
    await env.sleep(5000);
    return new Response("やっと終わった");
  }
  // ずっと計算し続けて、固まる → このサーバーは /health にも返事ができなくなる
  if (url.pathname === "/freeze") {
    while (true) {}
  }
  return new Response("そのページはありません", { status: 404 });
}
`,
  },
];

export const templateById = (id: string) => ROOM_TEMPLATES.find((t) => t.id === id);
