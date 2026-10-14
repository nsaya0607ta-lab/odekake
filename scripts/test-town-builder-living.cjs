/* The living town: real sky and weather, seasons, night lighting, people, effects and My Home. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  cache.set(absolute, mod.exports);
  new Function('require', 'module', 'exports', source)(name => name.startsWith('.') ? load(path.resolve(path.dirname(absolute), `${name}.ts`)) : require(name), mod, mod.exports);
  cache.set(absolute, mod.exports);
  return mod.exports;
}
const game = load('src/lib/games/town-builder.ts');
const { townEnvironment, townClockLabel, representedTime } = load('src/lib/games/town-environment.ts');
const paint = load('src/lib/games/town-paint.ts');
const { TownSprites } = load('src/lib/games/town-sprites.ts');
const { TownLife } = load('src/lib/games/town-life.ts');
const { TownScene } = load('src/lib/games/town-renderer.ts');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
const TOKYO = { lat: 35.68, lon: 139.77 }, SAPPORO = { lat: 43.06, lon: 141.35 }, NAHA = { lat: 26.21, lon: 127.68 };
const jst = (date, hours = 12) => Date.parse(`${date}T00:00:00+09:00`) + hours * 3600e3;
const weather = (kind, extra = {}) => ({ kind, code: { clear: 0, partly: 2, cloudy: 3, rain: 63, snow: 73, thunder: 95, fog: 45, drizzle: 51 }[kind], temp: 15, cloud: kind === 'clear' ? 5 : 100, precip: kind === 'rain' ? 4 : kind === 'snow' ? 1 : 0, wind: 8, windDir: 270, at: '', ...extra });
const env = (date, hours, extra = {}) => townEnvironment({ now: jst(date, hours), place: TOKYO, weather: weather('clear'), ...extra });
const seasonOf = (date, place) => townEnvironment({ now: jst(date), place, weather: null });

test('the sky follows the real sun: daylight at noon, lamps and full night after dark, late windows after 23:30', () => {
  const noon = env('2026-10-14', 12), dusk = env('2026-10-14', 17.4), night = env('2026-10-14', 21), late = env('2026-10-14', 23.75);
  assert.equal(noon.night, 0); assert.equal(noon.lightsOn, 0); assert(noon.sun.altitude > 30);
  assert(dusk.night > 0 && dusk.night < 1, 'Dusk crossfades between the day and night artwork');
  assert.equal(night.night, 1); assert.equal(night.lightsOn, 1); assert(night.stars > .5);
  assert.equal(night.windows, 'evening'); assert.equal(late.windows, 'late');
  assert(noon.shopsOpen); assert(!night.shopsOpen);
  assert.equal(townClockLabel(noon), '12:00');
});
test('seasons move with latitude: cherry blossom in late March in Tokyo, earlier in Okinawa, later in Hokkaido', () => {
  assert(seasonOf('2026-03-29', TOKYO).blossom > .7);
  assert.equal(seasonOf('2026-03-29', SAPPORO).blossom, 0); assert(seasonOf('2026-04-28', SAPPORO).blossom > .5);
  assert(seasonOf('2026-02-24', NAHA).blossom > .3);
  assert(seasonOf('2026-11-27', TOKYO).foliage > .9, 'Autumn colour peaks in late November in Tokyo');
  assert(seasonOf('2026-10-28', SAPPORO).foliage > seasonOf('2026-10-28', TOKYO).foliage, 'Leaves turn earlier further north');
  assert.equal(seasonOf('2027-01-20', TOKYO).bare, 1); assert.equal(seasonOf('2026-06-10', TOKYO).bare, 0);
  assert(seasonOf('2026-07-25', TOKYO).lush > .8); assert.equal(seasonOf('2026-07-25', TOKYO).season, 'summer');
});
test('weather changes light, precipitation, snow cover and how busy the streets are', () => {
  const clear = env('2026-10-14', 12), rain = env('2026-10-14', 12, { weather: weather('rain') }), snow = env('2026-10-14', 12, { weather: weather('snow', { temp: -2 }) });
  assert(rain.rain > .5 && rain.snow === 0 && rain.grade && rain.grey > 0);
  assert(snow.snow > .4 && snow.snowCover && snow.rain === 0);
  assert(rain.activity < clear.activity && snow.activity < clear.activity);
  assert(env('2026-10-14', 8).activity > env('2026-10-14', 3).activity * 5, 'The morning rush is busier than the middle of the night');
  assert(env('2026-10-14', 12, { weather: weather('thunder') }).thunder);
  assert(env('2026-10-14', 12, { weather: weather('fog') }).fog > .5);
});
test('wind blows the real way: a westerly drifts towards the east, which is screen-left in a town that looks south', () => {
  const westerly = env('2026-10-14', 12, { weather: weather('clear', { windDir: 270 }) }), easterly = env('2026-10-14', 12, { weather: weather('clear', { windDir: 90 }) });
  assert(Math.cos(westerly.windAngle) < -.9); assert(Math.cos(easterly.windAngle) > .9);
});
test('the sky and weather can be fixed for viewing without touching the real clock', () => {
  const now = jst('2026-10-14', 12);
  for (const [mode, check] of [['morning', e => e.night === 0 && townClockLabel(e) === '7:00'], ['day', e => e.night === 0], ['evening', e => e.night > 0 && e.night < 1], ['night', e => e.night === 1]]) {
    const e = townEnvironment({ now, place: TOKYO, weather: weather('clear'), timeMode: mode });
    assert(check(e), mode); assert(!e.live);
    assert.equal(new Date(representedTime(now, mode, TOKYO) + 9 * 3600e3).toISOString().slice(0, 10), '2026-10-14', 'A fixed time stays on today');
  }
  const snowy = townEnvironment({ now, place: TOKYO, weather: weather('clear', { temp: 20 }), weatherMode: 'snow' });
  assert(snowy.snowCover && snowy.temperature <= -1);
  assert(townEnvironment({ now, place: TOKYO, weather: null }).live, 'Without a reading the real sky still shows, as partly cloudy');
});
test('night shading keeps alpha and only lights stay bright in the emissive pass', () => {
  assert.equal(paint.shade('#ffffff', 0), '#ffffff'); assert.equal(paint.shade('#ffffff', 1), paint.NIGHT_AMBIENT);
  assert.equal(paint.shade('#ffffff80', 1), paint.NIGHT_AMBIENT + '80');
  assert.equal(paint.snowy('#336699'), '#336699');
  paint.paintState.snow = true; assert.notEqual(paint.snowy('#336699'), '#336699'); paint.resetPaintState();
  const ops = [], target = { fillStyle: '#000000', strokeStyle: '#000000', globalCompositeOperation: 'source-over', fill() { ops.push([this.fillStyle, this.globalCompositeOperation]); }, stroke() { ops.push([this.strokeStyle, this.globalCompositeOperation]); } };
  const lit = paint.emissiveContext(target);
  lit.fillStyle = '#ffe6a2'; lit.fill(); lit.fillStyle = '#779f9e'; lit.fill(); lit.strokeStyle = '#ece9d4'; lit.stroke();
  assert.deepEqual(ops, [['#ffe6a2', 'source-over'], ['#779f9e', 'destination-out'], ['#ece9d4', 'destination-out']]);
  assert.equal(target.globalCompositeOperation, 'source-over');
});
function surface() {
  const calls = [], context = new Proxy({ globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: true }, { get: (o, k) => k in o ? o[k] : (...args) => { calls.push([k, o.globalCompositeOperation, o.fillStyle]); } });
  return { canvas: { width: 0, height: 0, getContext: () => context }, calls };
}
test('night sprites are darkened, lit and given a soft glow once, then reused; optional ones wait for frame budget', () => {
  const made = [], sprites = new TownSprites(() => { const s = surface(); made.push(s); return s.canvas; }), host = surface().canvas.getContext();
  let paints = 0;
  const bounds = { left: 0, top: 0, width: 40, height: 40 }, night = { ambient: paint.NIGHT_AMBIENT, emissive: () => { paints++; } };
  assert(sprites.draw(host, 'house|n', 0, 0, bounds, () => paints++, 3, { night }));
  assert.equal(paints, 2, 'The artwork and its lights are painted once each');
  const sprite = made[0].calls.map(([k, op, fill]) => `${k}:${op}:${fill}`);
  assert(sprite.includes(`fillRect:destination-over:#000`)); assert(sprite.includes(`fillRect:multiply:${paint.NIGHT_AMBIENT}`));
  assert(sprite.some(c => c.startsWith('drawImage:destination-in'))); assert(sprite.some(c => c.startsWith('drawImage:lighter')));
  sprites.draw(host, 'house|n', 9, 9, bounds, () => paints++, 3, { night }); assert.equal(paints, 2);
  sprites.beginFrame(-1);
  assert.equal(sprites.draw(host, 'tree|n', 0, 0, bounds, () => paints++, 3, { optional: true }), false);
  assert.equal(paints, 2, 'An optional night sprite is not painted once the frame budget is spent');
});
class Gradient { constructor() { this.stops = []; } addColorStop(position, color) { this.stops.push([position, color]); } }
function recordingContext() {
  const fills = [], strokes = [], stack = [];
  const target = {
    globalAlpha: 1, fillStyle: '', strokeStyle: '', globalCompositeOperation: 'source-over', lineWidth: 1,
    beginPath() {}, moveTo() {}, lineTo() {}, fill() { fills.push({ color: this.fillStyle, op: this.globalCompositeOperation }); }, stroke() { strokes.push({ color: this.strokeStyle }); },
    fillRect() { fills.push({ color: this.fillStyle, op: this.globalCompositeOperation }); },
    fillText() { assert.fail('Text must stay in the interface, not on town artwork'); },
    save() { stack.push({ globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation }); }, restore() { Object.assign(this, stack.pop()); },
    createLinearGradient() { return new Gradient(); }, createRadialGradient() { return new Gradient(); },
  };
  return { c: new Proxy(target, { get: (o, k) => k in o ? o[k] : () => {} }), fills, strokes };
}
const blank = () => ({ ...game.createTown(false), tiles: Array(576).fill('grass'), terrain: Array(576).fill(false), levels: Array(576).fill(0), money: 1e6 });
function street() {
  let town = blank();
  town = game.buildLine(town, 'road', game.lineTiles(game.indexAt(2, 6), game.indexAt(14, 6))).town;
  for (let x = 2; x <= 14; x += 2) town = game.buildTile(town, x % 4 ? 'house' : 'shop', x, 5).town;
  return game.buildTile(town, 'home', 9, 7).town;
}
const options = { night: false, grid: false, hover: null, selected: null, preview: [], tool: 'inspect', routes: [], paused: false, speed: 1 };
function frames(environment, town = street(), count = 40) {
  const scene = new TownScene(), record = recordingContext();
  scene.camera = { x: 195, y: -40, zoom: 1.4 };
  for (let j = 0; j < count; j++) { record.fills.length = 0; record.strokes.length = 0; scene.render(record.c, 390, 844, town, { ...options, environment }, 1 / 30); }
  return record;
}
test('identical frames for identical time and weather: people and weather are reproducible', () => {
  const day = env('2026-10-14', 8), a = frames(day), b = frames(day);
  assert.deepEqual(a.fills.map(f => f.color), b.fills.map(f => f.color));
  assert(a.fills.length > 200);
});
test('people walk the streets by day and mostly stay home in the small hours; umbrellas come out in the rain', () => {
  const skin = new Set(['#f1d3b8', '#e8c2a0', '#d9a982', '#f5dcc6']);
  const people = r => r.fills.filter(f => skin.has(f.color)).length;
  const morning = people(frames(env('2026-10-14', 8))), small = people(frames(env('2026-10-14', 3)));
  assert(morning > 3, `Expected people on a weekday morning, found ${morning}`);
  assert(morning > small, 'Fewer people walk at 3am');
  const umbrellas = new Set(['#eef4f6cc', '#3f5f86', '#b9505a', '#e2b84a', '#4f8c6a', '#8a6fae', '#6fb0d6', '#e88b9b']);
  assert(frames(env('2026-10-14', 8, { weather: weather('rain') })).fills.some(f => umbrellas.has(f.color)));
});
test('night lights: lit windows and lamps glow after dark and are absent at noon', () => {
  const lights = new Set(paint.LIGHT_COLORS);
  assert(!frames(env('2026-10-14', 12), street(), 2).fills.some(f => lights.has(f.color)));
  assert(frames(env('2026-10-14', 21), street(), 2).fills.some(f => f.color === '#ffe6a2'), 'Windows are lit at night');
});
test('snow settles on roofs and grass, and seasons repaint the trees', () => {
  const white = color => typeof color === 'string' && /^#[0-9a-f]{6}$/.test(color) && [1, 3, 5].every(i => parseInt(color.slice(i, i + 2), 16) >= 228);
  const count = record => record.fills.filter(f => white(f.color)).length;
  assert(count(frames(env('2027-01-20', 10, { weather: weather('snow', { temp: -2 }) }), street(), 2)) > count(frames(env('2027-01-20', 10), street(), 2)) + 20, 'Snow whitens roofs and top faces');
  // A grove away from the road: its canopies are radial gradients whose colours follow the season.
  const grove = blank(); grove.tiles[0] = 'road';
  const stops = record => new Set(record.fills.flatMap(f => f.color instanceof Gradient ? f.color.stops.map(([, c]) => c) : []));
  const autumn = stops(frames(env('2026-11-27', 12), grove, 2)), spring = stops(frames(env('2026-03-29', 12), grove, 2)), summer = stops(frames(env('2026-07-25', 12), grove, 2));
  assert(['#eb9a6e', '#f2d778', '#f5d191'].some(c => autumn.has(c)), 'Autumn maples and ginkgo');
  assert(spring.has('#ffe6ec'), 'Cherry blossom in spring'); assert(!summer.has('#ffe6ec'));
  assert(summer.has('#70aa63'), 'Deep summer green');
});
test('station and clock-tower clocks show the real time with live hands instead of painted ones', () => {
  let town = blank(); const route = [125, 126, 127, 128]; route.forEach((i, j) => { town.tiles[i] = j === 0 || j === 3 ? 'station' : 'rail'; });
  const live = recordingContext(), scene = new TownScene(); scene.camera = { x: 195, y: 100, zoom: 1 };
  scene.render(live.c, 800, 600, town, { ...options, routes: [route], environment: env('2026-10-14', 15) }, 0);
  assert(live.strokes.some(s => s.color === '#4e655e')); assert(!live.strokes.some(s => s.color === '#536c64'));
  const legacy = recordingContext(); new TownScene().render(legacy.c, 800, 600, town, { ...options, routes: [route] }, 0);
  assert(legacy.strokes.some(s => s.color === '#536c64'), 'Without a live sky the painted hands remain');
});
test('my home: one per town next to a road, 500 white coins, never upgraded, and selectable by its roof', () => {
  let town = game.buildTile(blank(), 'road', 5, 5).town;
  assert.equal(game.buildTile(town, 'home', 8, 8).message, '道路の隣に建ててください');
  const built = game.buildTile(town, 'home', 5, 6); town = built.town;
  assert.equal(town.tiles[game.indexAt(5, 6)], 'home'); assert.equal(town.levels[game.indexAt(5, 6)], 0); assert.equal(built.town.money, 1e6 - 35 - 500);
  town = game.buildTile(town, 'road', 6, 5).town;
  assert.equal(game.buildTile(town, 'home', 6, 6).message, 'マイホームは1軒だけ建てられます');
  assert.equal(game.upgradeTile(town, game.indexAt(5, 6)).town, town);
  assert.equal(game.getTownStats(town.tiles, town.levels).homes, 0, 'My home is not counted as a rental house');
  const twice = structuredClone(town); twice.tiles[game.indexAt(6, 6)] = 'home'; assert.equal(game.decodeTown(JSON.stringify(twice)), null);
  assert.deepEqual(game.decodeTown(JSON.stringify(town)).tiles, town.tiles);
  const removed = game.buildTile(town, 'bulldoze', 5, 6).town; assert.equal(removed.tiles[game.indexAt(5, 6)], 'grass');
  assert.deepEqual(game.undoTownEdit(removed, game.recordTownEdit(town, removed)).tiles, town.tiles);
  const scene = new TownScene(), roof = { x: (5.38 - 6.36) * 32, y: (5.38 + 6.36) * 16 - 33 };
  for (const zoom of [.6, 1.4, 2.8]) { scene.camera = { x: 195, y: 60, zoom }; assert.equal(scene.pickTile(195 + roof.x * zoom, 60 + roof.y * zoom, town), game.indexAt(5, 6)); }
  const record = recordingContext(); new TownScene().render(record.c, 800, 600, town, options, 0);
  assert(record.fills.some(f => f.color === '#c8664c'), 'The terracotta roof is drawn');
});
test('construction plays an effect: a new building rises from the ground, then settles', () => {
  const life = new TownLife(), before = street(), after = game.buildTile(before, 'house', 12, 7).town, tile = game.indexAt(12, 7);
  life.changed(before, after);
  assert(life.rise(tile) < 1, 'A brand-new building starts low');
  const day = env('2026-10-14', 12);
  for (let j = 0; j < 30; j++) life.update(1 / 30, 1 / 30, day);
  assert.equal(life.rise(tile), 1);
  assert.equal(life.rise(game.indexAt(2, 5)), 1, 'Other buildings are unaffected');
});
console.log(`${passed} living town checks passed`);
