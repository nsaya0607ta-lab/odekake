const assert = require('node:assert/strict');
const api = require('./test-kakure-kanji-account.cjs');
const { KanjiAccountClient } = require('../src/components/games/kakure-kanji/account-client.ts');
const { STAGES } = require('../src/lib/games/kakure-kanji/data/index.ts');
const P = require('../src/lib/games/kakure-kanji/progress.ts');
const E = require('../src/lib/games/kakure-kanji/engine.ts');
const stage = STAGES.find(s => s.kanji === '称');
const answers = E.mainAnswers(stage);
const tick = () => new Promise(r => setImmediate(r));
const until = async fn => { for (let i = 0; i < 1000; i++) { if (fn()) return; await tick(); } throw new Error('Operation did not settle'); };
class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k, v) { this.values.set(k, v); }
  removeItem(k) { this.values.delete(k); }
}
const pendingKeys = storage => [...storage.values.keys()].filter(k => k.includes('_pending_v1:'));
function reset() {
  api.reset({ save: { ...P.defaultSave(), login: { lastDate: P.japanDate(Date.now()), streak: 1 }, settings: { sound: false, theme: 'light' } }, revision: 10, balance: 1000 });
}
function network() {
  const n = { hold: false, gates: [], sent: [], active: 0, maxActive: 0, after: null, before: null };
  n.fetch = async (url, init = {}) => {
    const op = init.body ? JSON.parse(init.body) : null;
    if (op) {
      n.sent.push(op); n.active++; n.maxActive = Math.max(n.maxActive, n.active);
      try {
        if (n.hold && op.action.type === 'submit') await new Promise(resolve => n.gates.push(resolve));
        if (n.before) { const response = await n.before(op); if (response) return response; }
        const response = await api.route.POST(new Request('https://odekake.test' + url, { ...init, headers: { ...init.headers, origin: 'https://odekake.test' } }));
        if (n.after) await n.after(op, response);
        return response;
      } finally { n.active--; }
    }
    return api.route.GET(new Request('https://odekake.test' + url, init));
  };
  n.release = async () => { await until(() => n.gates.length); n.gates.shift()(); await tick(); };
  n.finish = async storage => { for (let i = 0; i < 100 && pendingKeys(storage).length; i++) { if (n.gates.length) await n.release(); else await tick(); } await until(() => !n.active && !pendingKeys(storage).length); };
  return n;
}
async function setup(storage = new MemoryStorage(), n = network()) {
  const changes = [];
  const client = new KanjiAccountClient(api.userId, state => changes.push(state), storage, n.fetch);
  await client.initialize(); assert.equal(client.state.error, null);
  await client.act({ type: 'start', stageId: stage.id });
  return { client, storage, n, changes };
}
const answer = a => ({ type: 'submit', stageId: stage.id, strokes: a.strokeSets[0] });
const round = c => c.state.save.rounds[stage.id];
let passed = 0;
async function test(name, fn) { reset(); await fn(); passed++; console.log('PASS client ' + name); }
(async () => {
  await test('標準のfetchをブラウザと同じ呼び方で使い、初回の読込とログインが完了する', async () => {
    const original = globalThis.fetch, n = network();
    globalThis.fetch = function(input, init) { 'use strict'; assert.ok(this === undefined || this === globalThis, 'fetchにクライアント自身をthisとして渡さない'); return n.fetch(input, init); };
    try {
      const client = new KanjiAccountClient(api.userId, () => {}, new MemoryStorage());
      await client.initialize(); assert.equal(client.state.error, null); assert.equal(client.state.busy, false); assert.equal(client.state.save.coins, 1000); client.dispose();
    } finally { globalThis.fetch = original; }
  });
  await test('保存を待たず連続回答でき、返事のたびに後続の回答を消さず順番どおり一度だけ保存', async () => {
    const { client, storage, n } = await setup(); n.hold = true;
    for (const a of answers.slice(0, 4)) {
      const response = await Promise.race([client.act(answer(a)), new Promise((_, reject) => setTimeout(() => reject(Error('判定が通信を待っている')), 100))]);
      assert.equal(response.event.outcome.result.answer.char, a.char); assert.equal(client.state.busy, false);
    }
    assert.deepEqual(round(client).found, answers.slice(0, 4).map(a => a.char));
    assert.deepEqual(api.getState().save.rounds[stage.id].found, []); assert.equal(pendingKeys(storage).length, 4);
    const score = round(client).score;
    await n.release(); assert.equal(round(client).score, score); assert.equal(round(client).found.length, 4);
    await n.finish(storage); assert.equal(n.maxActive, 1); assert.equal(round(client).score, score);
    assert.equal(api.getState().save.rounds[stage.id].score, score); assert.deepEqual(client.state.save, api.getState().save);
    const sent = n.sent.filter(o => o.action.type === 'submit'); assert.equal(new Set(sent.map(o => o.requestId)).size, 4);
    assert.deepEqual(sent.map(o => o.revision), [12, 13, 14, 15]); client.dispose();
  });
  await test('不正解・重複・シークレット・クリアの連続操作でも、確定後の得点とコインが即時判定と一致', async () => {
    const { client, storage, n } = await setup(); n.hold = true;
    await client.act(answer(answers[0]));
    const wrong = await client.act({ type: 'submit', stageId: stage.id, strokes: stage.strokes.map(s => s.id) });
    assert.equal(wrong.event.outcome.result.kind, 'whole');
    await client.act(answer(answers[1]));
    const dup = await client.act(answer(answers[0])); assert.equal(dup.event.outcome.result.kind, 'duplicate');
    for (const a of answers.slice(2)) await client.act(answer(a));
    for (const a of E.secretAnswers(stage)) await client.act(answer(a));
    const before = structuredClone(client.state.save); assert.notEqual(round(client).completedAt, null);
    await n.finish(storage); const actual = api.getState().save;
    for (const key of ['coins', 'totalPoints', 'stats', 'level', 'exp']) assert.deepEqual(actual[key], before[key]);
    for (const key of ['found', 'score', 'misses', 'maxCombo']) assert.deepEqual(actual.rounds[stage.id][key], before.rounds[stage.id][key]);
    assert.equal(actual.stages[stage.id].clears, 1); assert.deepEqual(client.state.save, actual); client.dispose();
  });
  await test('サーバーに届いた返事が失われても、再読み込み後に同じIDで残りを保存して二重報酬を防ぐ', async () => {
    const { client, storage, n } = await setup();
    let lostId; n.hold = true; n.after = async op => { if (op.action.type === 'submit' && !lostId) { lostId = op.requestId; throw new TypeError('Lost response'); } };
    const secret = E.secretAnswers(stage)[0]; await client.act(answer(secret)); await client.act(answer(answers[0]));
    await n.release(); await until(() => !!client.state.error);
    const balance = api.getState().balance; assert.equal(pendingKeys(storage).length, 2); client.dispose();
    const m = network(); const reloaded = new KanjiAccountClient(api.userId, () => {}, storage, m.fetch); await reloaded.initialize();
    assert.equal(reloaded.state.error, null); assert.equal(pendingKeys(storage).length, 0);
    assert.equal(m.sent[0].requestId, lostId); assert.equal(api.getState().balance, balance);
    assert.deepEqual(new Set(round(reloaded).found), new Set([secret.char, answers[0].char]));
    assert.deepEqual(reloaded.state.save, api.getState().save); reloaded.dispose();
  });
  await test('未送信の回答は再読み込み後に回復し、古い画面の遅い返事が新しい画面を上書きしない', async () => {
    const { client, storage, n, changes } = await setup(); n.hold = true;
    await client.act(answer(answers[0])); await client.act(answer(answers[1])); client.dispose(); const oldCount = changes.length;
    const reloaded = new KanjiAccountClient(api.userId, () => {}, storage, network().fetch); await reloaded.initialize();
    const save = structuredClone(api.getState()); assert.equal(round(reloaded).found.length, 2);
    await n.release(); await until(() => n.active === 0); assert.equal(changes.length, oldCount);
    assert.deepEqual(api.getState(), save); assert.equal(pendingKeys(storage).length, 0); reloaded.dispose();
  });
  await test('ヒント購入は先の回答の確定後に行い、購入中の操作を防いで残高を一度だけ引く', async () => {
    const { client, storage, n } = await setup(); n.hold = true;
    await client.act(answer(answers[0])); await client.act(answer(answers[1]));
    const hint = client.act({ type: 'hint', stageId: stage.id, answer: answers[2].char, kind: 'reading' });
    assert.equal(client.state.busy, true); assert.equal(await client.act(answer(answers[3])), null);
    await n.finish(storage); assert.ok(await hint); assert.equal(client.state.busy, false);
    assert.equal(api.getState().balance, client.state.save.coins); assert.deepEqual(round(client).hints[answers[2].char], ['reading']);
    assert.deepEqual(n.sent.slice(-3).map(o => o.action.type), ['submit', 'submit', 'hint']); client.dispose();
  });
  await test('別画面との競合はサーバーの記録に戻して止め、未確定の得点や報酬を残さない', async () => {
    const { client, storage, n } = await setup(); n.hold = true;
    await client.act(answer(answers[0])); await client.act(answer(answers[1]));
    await api.post({ type: 'settings', settings: { sound: true, theme: 'dark' } }); await n.release();
    await until(() => !!client.state.error); assert.equal(pendingKeys(storage).length, 0);
    assert.equal(round(client).found.length, 0); assert.deepEqual(client.state.save, api.getState().save);
    assert.equal(await client.act(answer(answers[2])), null); assert.equal(await client.retry(), true); client.dispose();
  });
  await test('混雑時は回答を残して同じIDで再試行し、他アカウントの一時記録は読まない', async () => {
    const { client, storage, n } = await setup(); let rejected = false;
    n.before = async op => { if (op.action.type === 'submit' && !rejected) { rejected = true; return Response.json({ error: '混雑中' }, { status: 429 }); } };
    storage.setItem('odekake_kakure_kanji_pending_v1:other:untouched', '{}');
    await client.act(answer(answers[0])); await until(() => !!client.state.error);
    const id = n.sent.at(-1).requestId; assert.equal(pendingKeys(storage).length, 2);
    assert.equal(await client.retry(), true); assert.equal(n.sent.at(-1).requestId, id);
    assert.equal(pendingKeys(storage).length, 1); assert.ok(storage.getItem('odekake_kakure_kanji_pending_v1:other:untouched')); client.dispose();
  });
  await test('端末へ一時保存できない場合も判定は即時に返し、通信が終わるまで次の回答を止める', async () => {
    const n = network(); const client = new KanjiAccountClient(api.userId, () => {}, undefined, n.fetch);
    await client.initialize(); await client.act({ type: 'start', stageId: stage.id }); n.hold = true;
    const out = await client.act(answer(answers[0])); assert.ok(out.event.outcome.gained); assert.equal(client.state.busy, true);
    assert.equal(await client.act(answer(answers[1])), null); await n.release(); await until(() => !client.state.busy);
    assert.equal(round(client).found.length, 1); assert.deepEqual(client.state.save, api.getState().save); client.dispose();
  });
  console.log(`${passed} client tests passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
