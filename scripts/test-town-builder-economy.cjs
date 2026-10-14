/* Real PostgreSQL (PGlite): wallet, atomic purchases, revisions, RLS and reward idempotency. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const file = path.join(root, 'src/lib/games', `${name}.ts`);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => id.startsWith('./') ? load(id.slice(2)) : require(id), module, module.exports);
  modules.set(name, module.exports);
  return module.exports;
}
const g = load('town-builder'), rpg = load('town-progression');
let db, passed = 0;
const userId = '11111111-1111-4111-8111-111111111111';
async function rpc(name, args = {}) {
  const names = Object.keys(args);
  const query = `select public.${name}(${names.map((n, i) => `${n} => $${i + 1}`).join(',')}) as result`;
  return (await db.query(query, Object.values(args).map(v => v && typeof v === 'object' ? JSON.stringify(v) : v))).rows[0].result;
}
async function asUser(id = userId, name = 'しゅん', access = name === 'しゅん') {
  await db.exec('reset role');
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3) on conflict(id) do nothing', [id, `${id}@example.test`, JSON.stringify({ display_name: name })]);
  if (access) await db.query('insert into public.town_builder_access(user_id) values($1) on conflict do nothing', [id]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, role: 'authenticated' })]);
}
async function test(title, fn) {
  await fn(); passed++; console.log(`✓ ${title}`);
}
const snapshot = () => rpc('get_town_builder');
async function action(type, extra = {}, revision) {
  const current = await snapshot();
  return rpc('commit_town_builder', { p_request_id: randomUUID(), p_revision: revision ?? current.revision, p_action: type, ...extra });
}
async function edit(make) {
  const before = await snapshot(), result = make({ ...before.town, money: before.balance });
  assert.notEqual(result.town, before.town);
  const cost = before.balance - result.town.money;
  const after = await action('edit', { p_town: result.town });
  let reward = 0;
  for (let level = before.maxLevel + 1; level <= rpg.townProgress(after.xp).level; level++) reward += rpg.townLevelReward(level);
  assert.equal(after.balance, before.balance - cost + reward);
  assert.equal(after.xp, before.xp + (cost > 0 ? Math.max(1, Math.floor(cost / 10)) : 0));
  return after;
}
async function expectError(fn, message) { await assert.rejects(fn, e => e.message.includes(message)); }
function apiWithSession(session) {
  const cache = new Map();
  const client = { rpc: async (name, args) => { try { return { data: await rpc(name, args), error: null }; } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; } } };
  function read(file) {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', js)(name => {
      if (name === '@/lib/supabase/server') return { requireUser: async () => ({ user: session, supabase: client }) };
      if (name.startsWith('@/')) return read(path.join(root, 'src', `${name.slice(2)}.ts`));
      if (name.startsWith('.')) return read(path.resolve(path.dirname(file), `${name}.ts`));
      return require(name);
    }, module, module.exports);
    cache.set(file, module.exports);
    return module.exports;
  }
  return read(path.join(root, 'src/app/api/games/town-builder/route.ts'));
}

(async () => {
  db = new PGlite();
  await db.exec(fs.readFileSync(path.join(root, 'supabase/tests/00_supabase_stub.sql'), 'utf8').replace('create extension if not exists "pgcrypto";', ''));
  for (const name of fs.readdirSync(path.join(root, 'supabase/migrations')).filter(n => n.endsWith('.sql')).sort()) {
    let sql = fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8').replace(/create extension if not exists "?pgcrypto"?;/gi, '');
    // This historical file has a pre-existing truncated dollar delimiter. Normalize only in the isolated test database.
    if (name.startsWith('0085_')) sql = sql.replace(/^as \$$/m, () => 'as $$').replace(/^\$;$/m, () => '$$;');
    await db.exec(sql);
  }
  await asUser();
  await test('all 50 level thresholds match the database, including exact boundaries', async () => {
    for (let level = 1; level <= 50; level++) {
      const xp = rpg.townLevelXp(level);
      assert.equal(await rpc('town_level_xp', { p_level: level }), xp);
      assert.equal(await rpc('town_level', { p_xp: xp }), level);
      assert.equal(rpg.townProgress(xp).level, level);
      if (level > 1) assert.equal(rpg.townProgress(xp - 1).level, level - 1);
    }
    assert.equal(rpg.townProgress(NaN).level, 1);
  });
  await test('all part prices and all quest rewards match the UI catalog', async () => {
    const parts = (await db.query('select * from public.town_part_catalog()')).rows;
    for (const [scope, catalog] of [['park', g.PARK_PARTS], ['facility', g.FACILITY_PARTS]]) for (const part of catalog) {
      const row = parts.find(p => p.scope === scope && p.part === part.id);
      assert.equal(row.price, part.price);
      if (scope === 'park') { assert.equal(row.layer, part.layer); assert.equal(row.value, part.value); }
      else assert.deepEqual(row.kinds, part.kinds);
    }
    const quests = (await db.query('select * from public.town_quest_catalog()')).rows;
    assert.equal(quests.length, rpg.TOWN_QUESTS.length);
    for (const q of rpg.TOWN_QUESTS) {
      const { chapter, detail, ...expected } = q;
      assert.deepEqual(quests.find(v => v.id === q.id), expected);
    }
  });
  await test('starter grant and initial city are atomic and an identical request never grants twice', async () => {
    const args = { p_request_id: randomUUID(), p_revision: 0, p_action: 'start', p_town: g.createTown() };
    const a = await rpc('commit_town_builder', args), b = await rpc('commit_town_builder', args);
    assert.deepEqual(a, b); assert.equal(a.balance, 20000); assert.equal(a.xp, 0);
    assert.deepEqual(a.town.tiles, g.createTown().tiles);
  });
  await test('a paid construction and its delayed replay charge only once', async () => {
    const before = await snapshot(), next = g.buildTile(before.town, 'house', 11, 9).town;
    const args = { p_request_id: randomUUID(), p_revision: before.revision, p_action: 'edit', p_town: next };
    const a = await rpc('commit_town_builder', args);
    assert.equal(a.balance, before.balance - 250); assert.equal(a.xp, 25);
    await action('daily');
    const current = await snapshot(), retry = await rpc('commit_town_builder', args);
    assert.deepEqual(retry, current);
    await expectError(() => rpc('commit_town_builder', { ...args, p_request_id: randomUUID() }), 'TOWN_CONFLICT');
  });
  await test('two upgrades charge the exact tier prices and undo refunds EXP and cost', async () => {
    const tile = g.indexAt(7, 9);
    await edit(t => g.upgradeTile(t, tile));
    const before = await snapshot(), after = await edit(t => g.upgradeTile(t, tile));
    assert.equal(after.town.levels[tile], 3);
    const undone = await action('undo');
    assert.equal(undone.balance, after.balance + 900); assert.equal(undone.xp, before.xp); assert.equal(undone.town.levels[tile], 2);
    const rebuilt = await edit(t => g.upgradeTile(t, tile));
    assert.equal(rebuilt.maxLevel, after.maxLevel);
    assert.equal(rebuilt.balance, undone.balance - 900); // Already-awarded levels never pay again.
  });
  await test('road and railway bridges spend the correct white coins and undo restores the river', async () => {
    for (const [tool, x, cost] of [['road', 18, 120], ['rail', 19, 160]]) {
      const before = await snapshot();
      assert.equal(before.town.tiles[g.indexAt(x, 0)], 'water');
      const after = await edit(t => g.buildTile(t, tool, x, 0));
      assert.equal(after.xp, before.xp + cost / 10);
      const undo = await action('undo');
      assert.equal(undo.town.tiles[g.indexAt(x, 0)], 'water');
      assert.equal(undo.balance, after.balance + cost);
    }
  });
  await test('park land, every park part, layered paths and expansion have exact server prices', async () => {
    await edit(t => g.buyParkLot(t, 3, 12, 'small'));
    const id = g.indexAt(3, 12);
    for (const part of g.PARK_PARTS) {
      await edit(t => g.placeParkPart(t, id, id, part.id, 3));
      await action('undo');
    }
    await edit(t => g.placeParkPart(t, id, id, 'path'));
    await edit(t => g.placeParkPart(t, id, id, 'fountain'));
    await edit(t => g.expandParkLot(t, id, 'medium'));
    const after = await edit(t => g.expandParkLot(t, id, 'large'));
    assert.equal(after.town.parks.find(p => p.id === id).parts.length, 2);
  });
  await test('all compatible facility parts are charged on the correct building only', async () => {
    for (const part of g.FACILITY_PARTS) for (const kind of part.kinds) {
      let state = await snapshot(), tile = state.town.tiles.indexOf(kind);
      if (tile < 0) {
        state = await edit(t => g.buildTile(t, kind, 11, 11)); tile = g.indexAt(11, 11);
      }
      const installed = await edit(t => g.buyFacilityPart(t, tile, part.id));
      assert(installed.town.attachments.find(a => a.tile === tile).parts.includes(part.id));
      await action('undo');
      // Remove temporary test station/factory, keeping land available for the next kind.
      if (tile === g.indexAt(11, 11)) await action('undo');
    }
  });
  await test('quest metrics match real road connections, park parts and railway routes', async () => {
    let town = g.createTown(false); town.money = 1e6;
    for (let x = 3; x < 16; x++) town = g.buildTile(town, 'road', x, 5).town;
    for (let x = 3; x < 16; x++) town = g.buildTile(town, x % 3 === 0 ? 'shop' : 'house', x, 4).town;
    town = g.buyFacilityPart(town, g.indexAt(4, 4), 'terrace').town;
    for (let x = 2; x <= 10; x++) town = g.buildTile(town, x === 2 || x === 10 ? 'station' : 'rail', x, 15).town;
    town = g.buyParkLot(town, 4, 8, 'medium').town;
    for (let n = 0; n < 8; n++) town = g.placeParkPart(town, g.indexAt(4, 8), g.indexAt(4 + n % 3, 8 + Math.floor(n / 3)), g.PARK_PARTS[n].id).town;
    const metrics = rpg.townQuestMetrics(town);
    for (const quest of rpg.TOWN_QUESTS) assert.equal(await rpc('town_quest_metric', { p_town: town, p_id: quest.id }), metrics[quest.id], quest.id);
    assert.equal(metrics.railway, 2);
  });
  await test('quest claims, daily support and daily building rewards are idempotent', async () => {
    const before = await snapshot(), daily = await action('daily');
    assert.equal(daily.balance, before.balance); // Already claimed in the replay test.
    const a = await action('quest', { p_quest: 'roads' }), b = await action('quest', { p_quest: 'roads' });
    assert.equal(a.balance, b.balance); assert.equal(a.xp, b.xp); assert(a.claimedQuests.includes('roads'));
    const d = await action('quest', { p_quest: 'daily' }), retry = await action('quest', { p_quest: 'daily' });
    assert.equal(retry.balance, d.balance); assert.equal(retry.xp, d.xp); assert(retry.dailyQuestClaimed);
    await expectError(() => action('quest', { p_quest: 'metropolis' }), 'TOWN_QUEST_NOT_READY');
  });
  await test('insufficient funds roll back the city, EXP, receipts and ledger together', async () => {
    await db.query('update public.user_white_coins set balance=10 where user_id=$1', [userId]);
    const before = await snapshot(), counts = (await db.query('select count(*)::integer as n from public.white_coin_events')).rows[0].n;
    const t = g.buildTile({ ...before.town, money: 20000 }, 'road', 0, 0).town;
    await expectError(() => action('edit', { p_town: t }), 'WHITE_COINS_SHORT');
    assert.deepEqual(await snapshot(), before);
    assert.equal((await db.query('select count(*)::integer as n from public.white_coin_events')).rows[0].n, counts);
    await db.query('update public.user_white_coins set balance=20000 where user_id=$1', [userId]);
  });
  await test('malformed geometry and free upgraded starter/reset payloads are rejected', async () => {
    const before = await snapshot();
    const malformed = structuredClone(before.town); malformed.levels[0] = null;
    await expectError(() => action('edit', { p_town: malformed }), 'INVALID_TOWN');
    const forged = g.createTown(); forged.levels[g.indexAt(7, 9)] = 3;
    await expectError(() => action('reset', { p_town: forged }), 'INVALID_TOWN_STARTER');
    assert.deepEqual(await snapshot(), before);
  });
  await test('reset keeps the account wallet, EXP and claimed quests, and never grants starter coins again', async () => {
    const before = await snapshot(), reset = await action('reset', { p_town: g.createTown(false) });
    assert.equal(reset.balance, before.balance); assert.equal(reset.xp, before.xp); assert.deepEqual(reset.claimedQuests, before.claimedQuests); assert.equal(reset.canUndo, false);
    await expectError(() => action('start', { p_town: g.createTown() }), 'TOWN_ALREADY_STARTED');
  });
  await test('legacy import preserves all geometry and ignores client-reported money', async () => {
    await asUser('22222222-2222-4222-8222-222222222222');
    await rpc('claim_white_login_bonus');
    const legacy = g.createTown(); legacy.money = 1e12; legacy.day = 120;
    const imported = await action('start', { p_town: legacy, p_import: true });
    assert.equal(imported.balance, 20500); assert(imported.xp > 0); assert.equal(imported.town.day, 120); assert.deepEqual(imported.town.tiles, legacy.tiles);
  });
  await test('white login rewards preserve existing yellow, blue and red rewards', async () => {
    await asUser('33333333-3333-4333-8333-333333333333');
    const old = await rpc('claim_login_bonus_before_white');
    assert(old.granted);
    const before = (await db.query('select balance from public.user_coins where user_id=auth.uid()')).rows[0].balance;
    const wrapped = await rpc('claim_login_bonus');
    assert.equal(wrapped.granted, false); assert.equal(wrapped.white_amount, 500);
    assert.equal((await db.query('select balance from public.user_coins where user_id=auth.uid()')).rows[0].balance, before);
    assert.equal((await rpc('claim_login_bonus')).white_amount, 0);
  });
  await test('home white coins share cross-color duplicate protection and the 8-second cooldown', async () => {
    const id = randomUUID().replaceAll('-', '');
    const a = await rpc('claim_home_coin_drop', { p_drop_id: id, p_kind: 'white', p_tier: 'epic' });
    assert.equal(a.amount, 100); assert(a.granted);
    assert.equal((await rpc('claim_home_coin_drop', { p_drop_id: id, p_kind: 'red' })).reason, 'duplicate');
    assert.equal((await rpc('claim_home_coin_drop', { p_drop_id: randomUUID(), p_kind: 'coin' })).reason, 'too_soon');
    await db.exec("update public.white_coin_events set created_at=now()-interval '9 seconds' where event_type='home_drop'");
    const blue = await rpc('claim_home_coin_drop', { p_drop_id: randomUUID(), p_kind: 'blue', p_tier: 'rare' });
    assert.equal(blue.amount, 20);
  });
  await test('RLS prevents direct wallet/EXP edits and other-account reads; the private town gate also applies to RPC', async () => {
    await asUser();
    await db.exec('set role authenticated');
    await expectError(() => db.query('update public.user_white_coins set balance=999999 where user_id=auth.uid()'), 'permission denied');
    await expectError(() => db.query('update public.user_town_builder set xp=999999 where user_id=auth.uid()'), 'permission denied');
    assert.equal((await db.query('select * from public.user_white_coins where user_id<>auth.uid()')).rows.length, 0);
    await expectError(() => rpc('add_white_coin_event', { p_user_id: userId, p_event_type: 'starter', p_amount: 100, p_key: 'forged' }), 'permission denied');
    await asUser('44444444-4444-4444-8444-444444444444', '別の人');
    await db.exec('set role authenticated');
    await expectError(() => snapshot(), 'TOWN_NOT_ALLOWED');
    await expectError(() => rpc('commit_town_builder', { p_request_id: randomUUID(), p_revision: 0, p_action: 'start', p_town: g.createTown() }), 'TOWN_NOT_ALLOWED');
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims','{}',false)");
    await db.exec('set role anon');
    await expectError(() => snapshot(), 'permission denied');
    await expectError(() => rpc('claim_white_login_bonus'), 'permission denied');
    assert.equal((await db.query('select * from public.user_white_coins')).rows.length, 0);
    await db.exec('reset role');
  });
  await test('a same-name account cannot promote itself or inherit access on migration replay', async () => {
    await asUser('66666666-6666-4666-8666-666666666666', 'しゅん', false);
    await db.exec('set role authenticated');
    assert.equal(await rpc('has_town_builder_access'), false);
    await expectError(() => snapshot(), 'TOWN_NOT_ALLOWED');
    await expectError(() => db.query('insert into public.town_builder_access(user_id) values(auth.uid())'), 'permission denied');
    const denied = apiWithSession({ id: '66666666-6666-4666-8666-666666666666', displayName: 'しゅん' });
    assert.equal((await denied.GET(new Request('https://qa.example.test/api/games/town-builder?account=66666666-6666-4666-8666-666666666666'))).status, 404);
    await db.exec('reset role');
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/0141_white_coins_town_rpg.sql'), 'utf8'));
    assert.equal(await rpc('has_town_builder_access'), false);
  });
  await test('reapplying the migration preserves cities, balances, quests and the old login implementation', async () => {
    await asUser(); const before = await snapshot();
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/0141_white_coins_town_rpg.sql'), 'utf8'));
    assert.deepEqual(await snapshot(), before);
    await rpc('claim_login_bonus'); // Would recurse if the wrapper were renamed again.
    assert.equal((await rpc('claim_login_bonus')).white_amount, 0);
  });
  await test('the actual API validates the account and commands, computes server prices and replays without charging twice', async () => {
    await asUser(); await db.exec('set role authenticated');
    const session = { id: userId, displayName: 'しゅん' }, api = apiWithSession(session);
    const url = 'https://qa.example.test/api/games/town-builder';
    assert.equal((await api.GET(new Request(`${url}?account=other`))).status, 403);
    const before = await snapshot();
    const payload = { userId, requestId: randomUUID(), revision: before.revision, action: 'edit', command: { type: 'build', tool: 'road', path: [g.indexAt(3, 3)], price: 0 } };
    const post = (body, origin = 'https://qa.example.test') => api.POST(new Request(url, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
    assert.equal((await post(payload, 'https://other.example.test')).status, 403);
    assert.equal((await post({ ...payload, userId: '22222222-2222-4222-8222-222222222222' })).status, 403);
    assert.equal((await post({ ...payload, command: { type: 'build', tool: 'road', path: [-1] } })).status, 400);
    const response = await post(payload); assert.equal(response.status, 200);
    const after = (await response.json()).snapshot;
    assert.equal(after.balance, before.balance - 35); assert.equal(after.xp, before.xp + 3);
    const replay = await post(payload); assert.equal(replay.status, 200); assert.deepEqual((await replay.json()).snapshot, after);
    session.displayName = '別の人';
    assert.equal((await api.GET(new Request(`${url}?account=${userId}`))).status, 404);
    assert.equal((await post({ ...payload, requestId: randomUUID() })).status, 404);
    await db.exec('reset role');
  });
  console.log(`${passed} town economy checks passed`);
  await db.close();
})().catch(async error => { console.error(error); if (db) await db.close(); process.exitCode = 1; });
