const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function compile(file, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', compiled)(name => imports[name] || require(name), mod.exports, mod);
  return mod.exports;
}
const game = compile('src/lib/games/town-builder.ts');
const { TownScene, drawTownIcon } = compile('src/lib/games/town-renderer.ts', { './town-builder': game });
const iso = (x, y, z = 0) => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
const blank = () => ({ ...game.createTown(false), tiles: Array(576).fill('grass'), terrain: Array(576).fill(false), levels: Array(576).fill(0) });
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
// Record real renderer operations: text, opacity and train geometry, without a GPU dependency.
function recordingContext() {
  const fills = [], stack = [];
  let points = [];
  const target = {
    globalAlpha: 1,
    fillStyle: '',
    beginPath() { points = []; },
    moveTo(x, y) { points.push({ x, y }); },
    lineTo(x, y) { points.push({ x, y }); },
    fill() { fills.push({ color: this.fillStyle, alpha: this.globalAlpha, points: [...points] }); },
    fillText() { assert.fail('Text must stay in the interface, not on town artwork'); },
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle }); },
    restore() { Object.assign(this, stack.pop()); },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
  return { c: new Proxy(target, { get: (obj, key) => key in obj ? obj[key] : () => {} }), fills };
}
const options = { night: false, grid: false, hover: null, selected: null, preview: [], tool: 'inspect', routes: [], paused: true, speed: 1 };
test('the visible roof selects its house at multiple camera positions and zooms', () => {
  const town = blank(), i = 5 * 24 + 5; town.tiles[i] = 'house'; town.levels[i] = 1;
  const scene = new TownScene(), p = iso(5.5, 5.6, 26);
  for (const camera of [{ x: 0, y: 0, zoom: 1 }, { x: 420, y: 100, zoom: .85 }, { x: 150, y: -200, zoom: 2.8 }]) {
    scene.camera = camera;
    const x = camera.x + p.x * camera.zoom, y = camera.y + p.y * camera.zoom;
    assert.notEqual(scene.tileAt(x, y), i);
    assert.equal(scene.pickTile(x, y, town), i);
  }
});
test('a tall roof remains selectable above the edge of the ground map', () => {
  const town = blank(), i = 1 * 24 + 5; town.tiles[i] = 'house'; town.levels[i] = 3;
  const scene = new TownScene(), p = iso(5.5, 1.5, 80);
  assert.equal(scene.tileAt(p.x, p.y), null);
  assert.equal(scene.pickTile(p.x, p.y, town), i);
});
test('overlapping buildings select the visible front wall', () => {
  const town = blank(); for (const i of [5 * 24 + 5, 6 * 24 + 6]) { town.tiles[i] = 'house'; town.levels[i] = 3; }
  const scene = new TownScene(), p = iso(6.3, 6.8, 70);
  assert.equal(scene.pickTile(p.x, p.y, town), 6 * 24 + 6);
});
test('empty land and points outside the map retain ground picking', () => {
  const scene = new TownScene(), p = iso(3.5, 8.5);
  assert.equal(scene.pickTile(p.x, p.y, blank()), 8 * 24 + 3);
  assert.equal(scene.pickTile(3000, -3000, blank()), null);
});
test('zooming a fitted small map does not jump to a larger minimum scale', () => {
  const scene = new TownScene(); scene.fit(320, 568);
  const camera = { ...scene.camera };
  assert(camera.zoom * 24 * 64 < 320);
  scene.zoomAt(1, 160, 284); assert.deepEqual(scene.camera, camera);
});
test('factory smoke does not make the construction ghost opaque', () => {
  const { c, fills } = recordingContext(), scene = new TownScene();
  const town = blank(); town.tiles[6 * 24 + 5] = 'road';
  scene.render(c, 800, 600, town, { ...options, preview: [5 * 24 + 5], tool: 'factory' }, 0);
  const counter = fills.find(f => f.color === '#c9d4bb');
  assert(counter); assert.equal(counter.alpha, .55); assert.equal(c.globalAlpha, 1);
});
test('town assets and catalog icons render without floating text or clipped smoke', () => {
  const { c, fills } = recordingContext();
  for (const { id } of game.BUILDINGS) drawTownIcon(c, id, 76, 66);
  assert(fills.every(f => f.alpha === 1), 'Catalog icons must not contain rising smoke outside their frame');
  const town = blank(); ['station', 'shop', 'factory'].forEach((kind, j) => { town.tiles[5 * 24 + 5 + j] = kind; town.levels[5 * 24 + 5 + j] = 1; });
  new TownScene().render(c, 800, 600, town, options, 0);
});
test('train cars remain separated at both termini and while travelling', () => {
  const town = blank(), route = [100, 101, 102, 103, 104];
  route.forEach((i, j) => { town.tiles[i] = j === 0 || j === route.length - 1 ? 'station' : 'rail'; });
  const { c, fills } = recordingContext(), scene = new TownScene();
  for (let frame = 0; frame < 250; frame++) {
    fills.length = 0;
    scene.render(c, 800, 600, town, { ...options, routes: [route], paused: false }, .1);
    const cars = fills.filter(f => f.color === '#f3e5bf').map(f => f.points.reduce((sum, p) => sum + p.x, 0) / f.points.length);
    assert.equal(cars.length, 3);
    assert(new Set(cars.map(x => Math.round(x * 100))).size === 3, 'Train cars overlap at a terminus');
  }
});
console.log(`${passed} town renderer checks passed`);
