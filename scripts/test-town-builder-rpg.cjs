const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const cache = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name === '@/components/coin-art') return { WhiteCoinArt: () => React.createElement('svg', { 'aria-hidden': true }) };
    if (name.startsWith('@/')) return load(path.join('src', `${name.slice(2)}.ts`));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(absolute), `${name}.ts`));
    return require(name);
  }, mod, mod.exports);
  cache.set(absolute, mod.exports);
  return mod.exports;
}
const { TownCrest, TownRpgPanel } = load('src/components/games/town-rpg.tsx');
const { townLevelXp } = load('src/lib/games/town-progression.ts');
const base = { town: null, balance: 20000, revision: 1, xp: 0, maxLevel: 1, claimedQuests: [], canUndo: false, dailyClaimed: false, dailySpent: 0, dailyQuestClaimed: false, date: '2026-10-15' };
const panel = (snapshot, tab = 'growth', busy = false) => render(React.createElement(TownRpgPanel, { snapshot, tab, busy, metrics: {}, onTab() {}, onClaim() {}, onDaily() {} }));
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
test('all six ranks have different crest geometry as well as color', () => {
  const shapes = [1, 5, 10, 20, 35, 50].map(level => {
    const html = render(React.createElement(TownCrest, { level, large: true }));
    assert(html.includes(`>${level}</b>`));
    return [...html.matchAll(/<path d="([^"]+)"/g)].map(m => m[1]).join('|');
  });
  assert.equal(new Set(shapes).size, 6);
});
test('earned rank records survive undoing a construction that lowered the current level', () => {
  const html = panel({ ...base, maxLevel: 20 });
  assert.equal((html.match(/data-unlocked="true"/g) || []).length, 4);
  assert(html.includes('Lv.20 · 到達済み'));
  assert(html.includes('まちづくり Lv.1'));
});
test('max level has a complete progress bar and no nonexistent next-level reward', () => {
  const html = panel({ ...base, xp: townLevelXp(50), maxLevel: 50 });
  assert(html.includes('aria-valuenow="100"'));
  assert(html.includes('最高レベルに到達！'));
  assert(!html.includes('Lv.51'));
  assert.equal((html.match(/data-unlocked="true"/g) || []).length, 6);
});
test('daily support uses the server date and an uncertain save can disable reward claims', () => {
  const html = panel(base, 'quests', true);
  assert(html.includes('2026/10/15 · 日本時間0時に更新'));
  const gift = html.match(/<section[^>]*aria-label="毎日の支援"[^>]*>(.*?)<\/section>/s)?.[1];
  assert(gift && /<button[^>]*disabled/.test(gift));
  assert(gift.includes('受け取る'));
  assert(panel({ ...base, dailyClaimed: true }, 'quests').includes('受取済み'));
});
console.log(`${passed} town RPG presentation checks passed`);
