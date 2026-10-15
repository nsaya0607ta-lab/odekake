// 街の相談役・色で見る地図（town-insights.ts）の確認。画面に出すだけの計算で、街やコインは変えない
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const code = ts.transpileModule(fs.readFileSync(`src/lib/games/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} }; cache[name] = mod.exports;
  new Function('exports', 'module', 'require', code)(mod.exports, mod, (p) => load(p.replace('./', '')));
  return mod.exports;
}
const T = load('town-builder');
const I = load('town-insights');
const { createTown, buildTile, buildLine, lineTiles, indexAt, getTownStats, houseHappiness, buyParkLot, placeParkPart, buyFacilityPart } = T;
const { townAdvice, layerCells } = I;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
const build = (town, type, x, y) => buildTile(town, type, x, y).town;
const stats = (t) => getTownStats(t.tiles, t.levels, t.parks, t.attachments);
const rich = () => ({ ...createTown(false), money: 1e7 });

test('house happiness breakdown matches the town average in random towns', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let n = 0; n < 60; n++) {
    let t = rich();
    for (let k = 0; k < 90; k++) {
      const kind = ['road', 'road', 'road', 'house', 'house', 'shop', 'factory', 'station', 'rail'][Math.floor(rand() * 9)];
      t = build(t, kind, Math.floor(rand() * 24), Math.floor(rand() * 24));
    }
    for (let k = 0; k < 3; k++) {
      const r = buyParkLot(t, Math.floor(rand() * 20), Math.floor(rand() * 20), 'small');
      t = r.town;
      if (r.lotId !== undefined) t = placeParkPart(t, r.lotId, r.town.parks.find(l => l.id === r.lotId).y * 24 + r.town.parks.find(l => l.id === r.lotId).x, 'fountain').town;
    }
    const factory = t.tiles.indexOf('factory');
    if (factory >= 0) t = buyFacilityPart(t, factory, 'greenbelt').town;
    const houses = t.tiles.flatMap((v, i) => v === 'house' && T.touchesRoad(t.tiles, i % 24, Math.floor(i / 24)) ? [i] : []);
    const s = stats(t);
    const avg = houses.length ? Math.round(houses.reduce((sum, i) => sum + houseHappiness(t.tiles, t.parks, t.attachments, i).total, 0) / houses.length) : 60;
    assert.equal(avg, s.happiness, `seed ${n}`);
    for (const i of houses) {
      const h = houseHappiness(t.tiles, t.parks, t.attachments, i);
      assert.equal(h.total, Math.max(20, Math.min(100, h.base + h.park + h.garden + h.shops - h.factories + h.greenbelt)));
    }
  }
});

test('a building without a road is reported and marked on the road map', () => {
  let t = build(rich(), 'road', 5, 5);
  t = build(t, 'house', 5, 6);
  t = { ...t, tiles: t.tiles.map((v, i) => (i === indexAt(5, 5) ? 'grass' : v)) };
  const a = townAdvice(t, stats(t));
  assert.equal(a[0].id, 'road'); assert.equal(a[0].tone, 'bad'); assert.deepEqual(a[0].tiles, [indexAt(5, 6)]);
  const cells = layerCells(t, stats(t), 'road');
  assert(cells.some(c => c.tile === indexAt(5, 6) && c.pin && c.pin.text === '道なし'));
});

test('a station without a rail link is reported; linking it clears the advice', () => {
  let t = build(rich(), 'station', 4, 4);
  t = build(t, 'station', 8, 4);
  assert(townAdvice(t, stats(t)).some(a => a.id === 'station' && a.tiles.length === 2));
  t = buildLine(t, 'rail', lineTiles(indexAt(5, 4), indexAt(7, 4))).town;
  const a = townAdvice(t, stats(t));
  assert(!a.some(x => x.id === 'station'));
  assert(a.some(x => x.id === 'riders'), 'a running station with nobody nearby is a warning');
  t = build(build(t, 'road', 4, 5), 'house', 5, 5);
  const after = townAdvice(t, stats(t)).find(x => x.id === 'riders');
  assert(!after || !after.tiles.includes(indexAt(4, 4)));
  const cells = layerCells(t, stats(t), 'station');
  assert(cells.some(c => c.tile === indexAt(5, 5) && c.pin && c.pin.text === '駅'));
});

test('homes next to factories are unhappy and the advice names the factory', () => {
  let t = rich();
  t = buildLine(t, 'road', lineTiles(indexAt(2, 5), indexAt(8, 5))).town;
  for (const x of [2, 4, 6]) t = build(t, 'factory', x, 6);
  t = build(t, 'house', 3, 6); t = build(t, 'house', 5, 6);
  const a = townAdvice(t, stats(t)).find(x => x.id === 'happy');
  assert(a && a.tiles.length === 2 && a.detail.includes('工場'));
  const h = houseHappiness(t.tiles, t.parks, t.attachments, indexAt(3, 6));
  assert(h.factories >= 20 && h.total < 60);
  const pin = layerCells(t, stats(t), 'happiness').find(c => c.tile === indexAt(3, 6));
  assert.equal(pin.pin.text, String(h.total));
});

test('an empty park lot is reported; a part makes it count and shows the bonus', () => {
  let t = build(build(rich(), 'road', 3, 3), 'house', 3, 4);
  const r = buyParkLot(t, 4, 4, 'small'); t = r.town;
  assert(townAdvice(t, stats(t)).some(a => a.id === 'lot'));
  assert(layerCells(t, stats(t), 'park').some(c => c.fill && c.fill.startsWith('#c9b46a')));
  t = placeParkPart(t, r.lotId, indexAt(4, 4), 'fountain').town;
  assert(!townAdvice(t, stats(t)).some(a => a.id === 'lot'));
  const pin = layerCells(t, stats(t), 'park').find(c => c.tile === indexAt(3, 4) && c.pin);
  assert(pin && pin.pin.text.startsWith('+'));
});

test('a tidy town says so, and advice never changes the town', () => {
  let t = build(rich(), 'road', 10, 10);
  const before = JSON.stringify(t);
  const a = townAdvice(t, stats(t));
  assert.equal(a.length, 1); assert.equal(a[0].tone, 'good');
  for (const l of ['happiness', 'station', 'park', 'road']) layerCells(t, stats(t), l);
  assert.equal(JSON.stringify(t), before);
});

console.log(`${passed} town insight checks passed`);
