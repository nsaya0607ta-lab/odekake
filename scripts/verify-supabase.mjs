#!/usr/bin/env node
/**
 * 実 Supabase プロジェクトでの動作確認
 * =============================================================
 * 新規登録 → 確認メール → ログイン → 公開範囲 → 写真 → アカウント削除 までを
 * 実際のプロジェクトに対して順番に確認します。
 *
 *   node scripts/verify-supabase.mjs
 *
 * 必要な環境変数（.env.local から読み込みます）
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * 任意
 *   SUPABASE_SERVICE_ROLE_KEY
 *     設定すると、確認済みのテストユーザーを自動で作成・削除して
 *     すべての項目を確認します。設定しない場合は、確認メールを必要とする
 *     項目を飛ばし、下記の既存アカウントでログインして確認します。
 *   TEST_EMAIL_A / TEST_PASSWORD_A     … 確認済みのテストアカウント1
 *   TEST_EMAIL_B / TEST_PASSWORD_B     … 確認済みのテストアカウント2
 *   TEST_EMAIL_C / TEST_PASSWORD_C     … 確認済みのテストアカウント3
 *
 * ※ サービスロールキーはこの検証スクリプト（手元での実行）専用です。
 *    アプリ本体のコードでは読み込みません。
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---------- .env.local の読み込み ----------
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。");
  process.exit(1);
}

// ---------- 小さなテスト枠組み ----------
const results = [];
let skipped = 0;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "  OK  " : " 失敗 ";
  console.log(`${mark} ${name}${detail ? `  — ${detail}` : ""}`);
}

function skip(name, reason) {
  skipped += 1;
  console.log(`  --   ${name}  — 省略: ${reason}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, true, typeof detail === "string" ? detail : "");
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const anonClient = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = SERVICE
  ? createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const suffix = Date.now().toString(36);
const PASSWORD = `Odekake-check-${suffix}!`;
const createdUserIds = [];

/** テスト用アカウントを用意する（サービスロールがあれば作成、無ければ既存を使う） */
async function prepareUser(slot) {
  const envEmail = process.env[`TEST_EMAIL_${slot}`];
  const envPassword = process.env[`TEST_PASSWORD_${slot}`];

  if (admin) {
    const email = `odekake-check-${slot.toLowerCase()}-${suffix}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: `検証${slot}` },
    });
    if (error) throw new Error(`テストユーザーの作成に失敗: ${error.message}`);
    createdUserIds.push(data.user.id);
    return { email, password: PASSWORD, id: data.user.id };
  }

  if (!envEmail || !envPassword) return null;
  return { email: envEmail, password: envPassword, id: null };
}

async function signIn(user) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`ログインに失敗: ${error.message}`);
  return { client, userId: data.user.id };
}

async function cleanup() {
  if (!admin) return;
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

// =============================================================
async function main() {
  console.log(`接続先: ${URL}`);
  console.log(admin ? "サービスロールキーあり（全項目を確認します）\n" : "サービスロールキーなし（一部を省略します）\n");

  console.log("── 1. 新規登録と確認メール ──");

  let confirmRequired = null;

  await check("新規登録ができる", async () => {
    const client = anonClient();
    const email = `odekake-signup-${suffix}@example.com`;
    const { data, error } = await client.auth.signUp({
      email,
      password: PASSWORD,
      options: { data: { display_name: "登録テスト" } },
    });
    if (error) throw new Error(error.message);
    assert(data.user, "ユーザーが作成されませんでした");
    if (admin) createdUserIds.push(data.user.id);
    // session が無い = 確認メールが必要な設定になっている
    confirmRequired = data.session === null;
    return confirmRequired ? "確認メールが必要な設定です" : "確認メール不要の設定です";
  });

  await check("確認メールの設定が有効になっている", async () => {
    assert(
      confirmRequired === true,
      "Authentication → Providers → Email の Confirm email を有効にしてください（今は確認なしでログインできます）",
    );
    return "Confirm email = ON";
  });

  if (admin) {
    await check("未確認のアカウントではログインできない", async () => {
      const client = anonClient();
      const { error } = await client.auth.signInWithPassword({
        email: `odekake-signup-${suffix}@example.com`,
        password: PASSWORD,
      });
      assert(error, "確認前なのにログインできてしまいました");
      return error.message;
    });
  } else {
    skip("未確認のアカウントではログインできない", "サービスロールキーが必要です");
  }

  // ---------- ユーザーの用意 ----------
  const alice = await prepareUser("A");
  const bob = await prepareUser("B");
  const carol = await prepareUser("C");

  if (!alice || !bob || !carol) {
    console.log("\nテスト用アカウントが揃わないため、ここまでで終了します。");
    console.log("SUPABASE_SERVICE_ROLE_KEY か、TEST_EMAIL_A〜C / TEST_PASSWORD_A〜C を設定してください。");
    return summarize();
  }

  console.log("\n── 2. ログイン ──");
  const a = await signIn(alice);
  const b = await signIn(bob);
  const c = await signIn(carol);
  record("確認済みアカウントでログインできる", true, "3アカウント");

  await check("ログインするとプロフィールが自動作成されている", async () => {
    const { data, error } = await a.client.from("profiles").select("display_name").eq("user_id", a.userId).maybeSingle();
    if (error) throw new Error(error.message);
    assert(data, "profiles に行がありません（handle_new_user トリガーを確認してください）");
    return data.display_name;
  });

  console.log("\n── 3. 一人旅の公開範囲 ──");

  const soloTripId = crypto.randomUUID();
  const soloSpotId = crypto.randomUUID();

  await check("一人旅を作成できる", async () => {
    const { error } = await a.client
      .from("trips")
      .insert({ id: soloTripId, owner_id: a.userId, title: `検証・一人旅 ${suffix}`, trip_type: "solo" });
    if (error) throw new Error(error.message);
  });

  await check("一人旅にスポットと訪問記録を追加できる", async () => {
    const spot = await a.client.from("spots").insert({
      id: soloSpotId,
      created_by: a.userId,
      name: `検証スポット ${suffix}`,
      prefecture_code: "21",
      municipality_code: "21201",
    });
    if (spot.error) throw new Error(spot.error.message);
    const visit = await a.client.from("visit_records").insert({
      user_id: a.userId,
      trip_id: soloTripId,
      spot_id: soloSpotId,
      visited_at: "2026-01-10",
    });
    if (visit.error) throw new Error(visit.error.message);
  });

  await check("一人旅が他ユーザーから見えない", async () => {
    for (const [label, session] of [["B", b], ["C", c]]) {
      const { data } = await session.client.from("trips").select("id").eq("id", soloTripId);
      assert((data ?? []).length === 0, `アカウント${label}から一人旅が見えています`);
      const visits = await session.client.from("visit_records").select("id").eq("trip_id", soloTripId);
      assert((visits.data ?? []).length === 0, `アカウント${label}から一人旅の記録が見えています`);
      const spots = await session.client.from("spots").select("id").eq("id", soloSpotId);
      assert((spots.data ?? []).length === 0, `アカウント${label}から一人旅のスポットが見えています`);
    }
  });

  console.log("\n── 4. 共有旅の公開範囲 ──");

  const sharedTripId = crypto.randomUUID();
  const sharedSpotId = crypto.randomUUID();
  const inviteCode = `CHK${suffix.toUpperCase().slice(-5)}`;

  await check("共有旅を作成できる", async () => {
    const { error } = await a.client.from("trips").insert({
      id: sharedTripId,
      owner_id: a.userId,
      title: `検証・共有旅 ${suffix}`,
      trip_type: "shared",
      invite_code: inviteCode,
    });
    if (error) throw new Error(error.message);
  });

  await check("メールアドレスで招待を作成できる", async () => {
    const { error } = await a.client.from("trip_invitations").insert({
      trip_id: sharedTripId,
      email: bob.email,
      invite_code: `${inviteCode}B`,
      invited_by: a.userId,
    });
    if (error) throw new Error(error.message);
  });

  await check("招待は宛先本人にだけ見える", async () => {
    const mine = await b.client.from("trip_invitations").select("id").eq("trip_id", sharedTripId);
    assert((mine.data ?? []).length === 1, "宛先本人から招待が見えません");
    const other = await c.client.from("trip_invitations").select("id").eq("trip_id", sharedTripId);
    assert((other.data ?? []).length === 0, "無関係なユーザーから招待が見えています");
  });

  await check("招待コードで共有旅に参加できる", async () => {
    const { data, error } = await b.client.rpc("join_trip_by_code", { p_code: `${inviteCode}B` });
    if (error) throw new Error(error.message);
    assert(Array.isArray(data) && data[0]?.trip_id === sharedTripId, "参加できませんでした");
  });

  await check("共有旅へ未参加ユーザーが閲覧できない", async () => {
    const trips = await c.client.from("trips").select("id").eq("id", sharedTripId);
    assert((trips.data ?? []).length === 0, "未参加ユーザーから共有旅が見えています");
    const members = await c.client.from("trip_members").select("id").eq("trip_id", sharedTripId);
    assert((members.data ?? []).length === 0, "未参加ユーザーからメンバー一覧が見えています");
    const activities = await c.client.from("trip_activities").select("id").eq("trip_id", sharedTripId);
    assert((activities.data ?? []).length === 0, "未参加ユーザーから活動履歴が見えています");
  });

  await check("未参加ユーザーは共有旅に書き込めない", async () => {
    const { error } = await c.client.from("trip_comments").insert({
      trip_id: sharedTripId,
      user_id: c.userId,
      comment: "入れないはず",
    });
    assert(error, "未参加ユーザーがコメントを投稿できてしまいました");
    return error.message;
  });

  await check("メンバーは共有旅に記録を追加できる", async () => {
    const spot = await b.client.from("spots").insert({
      id: sharedSpotId,
      created_by: b.userId,
      name: `共有スポット ${suffix}`,
      prefecture_code: "13",
      municipality_code: "13101",
      latitude: 35.6812,
      longitude: 139.7671,
      location_source: "map",
    });
    if (spot.error) throw new Error(spot.error.message);
    const visit = await b.client.from("visit_records").insert({
      user_id: b.userId,
      trip_id: sharedTripId,
      spot_id: sharedSpotId,
      visited_at: "2026-01-12",
    });
    if (visit.error) throw new Error(visit.error.message);
  });

  await check("活動履歴に誰が何をしたかが残る", async () => {
    const { data, error } = await b.client
      .from("trip_activities")
      .select("action, actor_id, target_label")
      .eq("trip_id", sharedTripId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const actions = (data ?? []).map((row) => row.action);
    assert(actions.includes("trip_created"), "trip_created が記録されていません");
    assert(actions.includes("member_joined"), "member_joined が記録されていません");
    assert(
      (data ?? []).some((row) => row.action === "visit_added" && row.actor_id === b.userId),
      "visit_added の実行者が記録されていません",
    );
    return `${actions.length}件`;
  });

  console.log("\n── 5. 写真のアップロード ──");

  const pngBytes = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    ),
    (ch) => ch.charCodeAt(0),
  );
  const tmpPath = `tmp/${b.userId}/${suffix}/check.png`;
  const finalPath = `trips/${sharedTripId}/visits/${suffix}/check.png`;

  await check("一時領域へアップロードできる", async () => {
    const { error } = await b.client.storage
      .from("photos")
      .upload(tmpPath, pngBytes, { contentType: "image/png", upsert: true });
    if (error) throw new Error(error.message);
  });

  await check("他人の一時領域へはアップロードできない", async () => {
    const { error } = await c.client.storage
      .from("photos")
      .upload(`tmp/${b.userId}/${suffix}/steal.png`, pngBytes, { contentType: "image/png" });
    assert(error, "他人の一時領域に書き込めてしまいました");
    return error.message;
  });

  await check("保存時に本来の場所へ移動できる", async () => {
    const { error } = await b.client.storage.from("photos").move(tmpPath, finalPath);
    if (error) throw new Error(error.message);
  });

  await check("署名付き URL で写真を取得できる", async () => {
    const { data, error } = await b.client.storage.from("photos").createSignedUrl(finalPath, 60);
    if (error) throw new Error(error.message);
    const response = await fetch(data.signedUrl);
    assert(response.ok, `署名付き URL の取得に失敗しました（${response.status}）`);
    return `${response.headers.get("content-type")} / ${response.headers.get("content-length")} bytes`;
  });

  await check("バケットが非公開になっている", async () => {
    const publicUrl = `${URL}/storage/v1/object/public/photos/${finalPath}`;
    const response = await fetch(publicUrl);
    assert(!response.ok, "非公開のはずの写真に、署名なしでアクセスできました");
    return `署名なしのアクセスは ${response.status}`;
  });

  await check("共有旅の写真は未参加ユーザーから取得できない", async () => {
    const { data } = await c.client.storage.from("photos").createSignedUrl(finalPath, 60);
    assert(!data?.signedUrl, "未参加ユーザーが署名付き URL を発行できました");
  });

  console.log("\n── 6. アカウント削除 ──");

  await check("アカウント削除の RPC が成功する", async () => {
    const { error } = await c.client.rpc("delete_own_account");
    if (error) throw new Error(error.message);
  });

  await check("削除したアカウントではログインできない", async () => {
    const client = anonClient();
    const { error } = await client.auth.signInWithPassword({ email: carol.email, password: carol.password });
    assert(error, "削除したはずのアカウントでログインできました");
    return error.message;
  });

  await check("削除したユーザーのデータが残っていない", async () => {
    if (!admin) throw new Error("サービスロールキーが無いため確認できません");
    const { data } = await admin.from("profiles").select("user_id").eq("user_id", c.userId);
    assert((data ?? []).length === 0, "profiles に行が残っています");
  });

  // ---------- 後片付け ----------
  console.log("\n── 後片付け ──");
  await b.client.storage.from("photos").remove([finalPath]);
  await a.client.from("trips").delete().eq("id", soloTripId);
  await a.client.from("trips").delete().eq("id", sharedTripId);
  await a.client.from("spots").delete().eq("id", soloSpotId);
  await b.client.from("spots").delete().eq("id", sharedSpotId);
  console.log("テストデータを削除しました。");

  return summarize();
}

function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log("\n=============================================");
  console.log(`成功 ${results.length - failed.length} / 失敗 ${failed.length} / 省略 ${skipped}`);
  if (failed.length > 0) {
    console.log("\n失敗した項目:");
    for (const item of failed) console.log(`  - ${item.name}: ${item.detail}`);
  }
  return failed.length;
}

main()
  .then(async (failed) => {
    await cleanup();
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(async (error) => {
    console.error("\n検証が途中で止まりました:", error);
    await cleanup();
    process.exit(1);
  });
