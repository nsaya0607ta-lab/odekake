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
test('park visitors use the furniture: children swing and slide, grown-ups sit, and nobody shares a seat', () => {
  const town = street(), idx = game.indexAt;
  for (let y = 9; y < 11; y++) for (let x = 4; x < 7; x++) town.tiles[idx(x, y)] = 'park';
  town.parks = [{ id: idx(4, 9), x: 4, y: 9, width: 3, height: 2, kind: 'park', parts: [
    { tile: idx(4, 9), kind: 'swings', rotation: 0 }, { tile: idx(5, 9), kind: 'playground', rotation: 1 }, { tile: idx(6, 9), kind: 'sandbox', rotation: 0 },
    { tile: idx(4, 10), kind: 'bench', rotation: 0 }, { tile: idx(5, 10), kind: 'picnic', rotation: 0 }, { tile: idx(6, 10), kind: 'fountain', rotation: 0 }] }];
  const life = new TownLife(), day = env('2026-10-14', 15), used = new Set();
  life.sync(town, new Map());
  for (let j = 0; j < 3600; j++) {
    life.update(1 / 30, 1 / 30, day);
    const busy = life.visitors.filter(v => v.spot && v.using >= 0);
    assert.equal(new Set(busy.map(v => v.spot)).size, busy.length, 'One person per swing seat, bench place or slide');
    for (const v of busy) {
      used.add(v.spot.split(':')[1]);
      if (/swings|playground|sandbox/.test(v.spot)) assert.equal(v.look.kind, 'child', 'Only children play on the equipment');
    }
  }
  for (const kind of ['swings', 'playground', 'bench']) assert(used.has(kind), `Someone used the ${kind}`);
  const draws = [];
  life.collect((x, y, depth, paint) => draws.push(paint), town, day, 0, 2);
  assert(draws.length > 0);
  paint.paintState.liveSwings = true;
  const recorded = recordingContext(); for (const d of draws) d(recorded.c);
  paint.resetPaintState();
  // Removing the swings sends their riders off to do something else.
  town.parks = [{ ...town.parks[0], parts: town.parks[0].parts.filter(p => p.kind !== 'swings') }];
  life.sync(town, new Map());
  assert(!life.visitors.some(v => v.spot && v.spot.includes('swings')));
});
const motion = load('src/lib/games/town-park-motion.ts');
const art = load('src/lib/games/town-park-art.ts');
const NEW_PARTS = ['seesaw', 'springRider', 'globe', 'carousel', 'jungleGym', 'splashPad', 'bars', 'basketball', 'maple', 'ginkgo', 'wisteria', 'flowerField', 'bamboo', 'foodCart', 'parasol', 'drinkFountain', 'bandstand', 'windmill', 'flowerClock', 'lantern', 'flagPole'];
const childLook = { top: '#3f6fa8', bottom: '#2f3540', hair: '#2f2a28', skin: '#f1d3b8', accent: '#e15b4f', umbrella: '#eef4f6', scale: .6, bag: 'none', hat: false, parasol: false, dog: null, kind: 'child' };
/** A street with one park lot of 4×3 at (4,8) holding the given parts row by row. */
function parkTown(parts, kind = 'park') {
  const town = street(), idx = game.indexAt;
  for (let y = 8; y < 11; y++) for (let x = 4; x < 8; x++) town.tiles[idx(x, y)] = 'park';
  town.parks = [{ id: idx(4, 8), x: 4, y: 8, width: 4, height: 3, kind, parts: parts.map((part, j) => part && { tile: idx(4 + j % 4, 8 + Math.floor(j / 4)), kind: part, rotation: j % 4 }).filter(Boolean) }];
  return town;
}
test('every new park part paints in all four rotations, at rest and live, and its moving pieces paint by day, at dusk and at night with riders', () => {
  for (const kind of NEW_PARTS) for (let rotation = 0; rotation < 4; rotation++) for (const live of [false, true]) {
    const rec = recordingContext();
    paint.paintState.liveParts = live;
    assert(art.drawParkArt(rec.c, kind, 5, 5, rotation, rotation % 2 === 1, rotation), kind);
    assert(rec.fills.length > 3, `${kind} draws its artwork`);
    paint.resetPaintState();
  }
  assert.equal(art.drawParkArt(recordingContext().c, 'tree', 0, 0), false, 'Older parts keep their own artwork');
  for (const [kind, m] of Object.entries(motion.PART_MOTION)) for (let rotation = 0; rotation < 4; rotation++) for (const hours of [13, 19.6, 23]) {
    const rec = recordingContext(), e = env('2026-08-01', hours, { weather: weather('clear', { temp: 30 }) });
    const f = { c: rec.c, x: 5, y: 5, tile: 125, rotation, variant: rotation % 2, time: 3.7 + hours, env: e, night: e.night, detail: true, rain: false, reduced: hours === 23, state: { angle: 1, speed: .5, bob: 2 }, riders: [0, 1, 2, 3].map(j => ({ look: childLook, using: 1 + j * 2.3, duration: 20, seed: j })) };
    paint.paintState.liveParts = true;
    m.paint(f, motion.motionKit(f));
    paint.resetPaintState();
    assert(rec.fills.length + rec.strokes.length >= 0, kind);
  }
});
test('the carousel turns while the shops are open, water play needs a warm dry day, the band plays 11:00–20:00 and carp streamers fly in spring', () => {
  assert(motion.carouselRunning(env('2026-08-01', 14))); assert(!motion.carouselRunning(env('2026-08-01', 22)));
  assert(motion.splashActive(env('2026-08-01', 13, { weather: weather('clear', { temp: 30 }) })));
  assert(!motion.splashActive(env('2026-11-20', 13, { weather: weather('clear', { temp: 14 }) })), 'No water play on a cold day');
  assert(!motion.splashActive(env('2026-08-01', 13, { weather: weather('rain', { temp: 28 }) })), 'No water play in the rain');
  assert(!motion.splashActive(env('2026-08-01', 21, { weather: weather('clear', { temp: 28 }) })), 'No water play after dark');
  assert(motion.performing(env('2026-08-01', 15))); assert(!motion.performing(env('2026-08-01', 21))); assert(!motion.performing(env('2026-08-01', 15, { weather: weather('rain') })));
  assert(motion.koinoboriSeason(env('2026-05-01', 12))); assert(!motion.koinoboriSeason(env('2026-07-01', 12)));
});
test('wisteria blooms about a month after the cherry blossom, and the flower beds follow the year', () => {
  assert(seasonOf('2026-04-28', TOKYO).wisteria > .7); assert.equal(seasonOf('2026-03-29', TOKYO).wisteria, 0);
  assert(seasonOf('2026-05-20', SAPPORO).wisteria > seasonOf('2026-05-20', TOKYO).wisteria, 'Later further north');
  for (const [date, flora] of [['2026-04-10', 'tulip'], ['2026-06-15', 'hydrangea'], ['2026-08-01', 'sunflower'], ['2026-10-10', 'cosmos'], ['2027-01-20', 'pansy']]) assert.equal(seasonOf(date, TOKYO).flora, flora, date);
});
test('children ride the new equipment, people queue for ice cream and leave with one, and lawn games follow the weather', () => {
  const town = parkTown(['carousel', 'seesaw', 'springRider', 'globe', 'jungleGym', 'splashPad', 'bars', 'basketball', 'foodCart', null, null, null]);
  const life = new TownLife(), day = env('2026-08-01', 13, { weather: weather('clear', { temp: 30, wind: 22 }) });
  life.sync(town, new Map());
  const used = new Set(), games = new Set(); let iceCream = false;
  for (let j = 0; j < 9000; j++) {
    life.update(1 / 30, 1 / 30, day);
    const busy = life.visitors.filter(v => v.spot && v.using >= 0);
    assert.equal(new Set(busy.map(v => v.spot)).size, busy.length, 'One person per place');
    for (const v of busy) {
      used.add(v.spot.split(':')[1]); if (v.lawn) games.add(v.lawn);
      const spot = life.spots.get(v.spot);
      if (spot.who === 'child') assert.equal(v.look.kind, 'child', `Only children play on the ${spot.part}`);
      if (spot.who === 'adult') assert.notEqual(v.look.kind, 'child', `Grown-ups only at the ${spot.part}`);
    }
    if (life.visitors.some(v => v.look.carry === 'icecream')) iceCream = true;
    if (j % 600 === 0) { const rec = recordingContext(); life.collect((x, y, depth, paint) => paint(rec.c), town, day, 0, 2); }
  }
  for (const kind of ['carousel', 'seesaw', 'springRider', 'globe', 'jungleGym', 'splashPad', 'foodCart']) assert(used.has(kind), `Someone used the ${kind}`);
  assert(iceCream, 'Someone bought an ice cream');
  assert(games.size > 0, 'Someone played on the lawn');
  const wet = env('2026-08-01', 13, { weather: weather('rain', { temp: 24 }) });
  life.update(1 / 30, 1 / 30, wet);
  assert(!life.visitors.some(v => v.spot && (v.spot.includes(':lawn:') || v.spot.includes('splashPad') || v.spot.includes('basketball'))), 'Rain ends lawn games, water play and basketball');
});
test('kites need wind, picnics need a dry day, and pigeons on the plaza take off when a child runs up', () => {
  const town = parkTown(['bench', 'fountain', null, null, null, null, null, null, null, null, null, null], 'plaza');
  const life = new TownLife(), calm = env('2026-08-01', 13, { weather: weather('clear', { temp: 24, wind: 2 }) });
  life.sync(town, new Map());
  for (let j = 0; j < 4000; j++) { life.update(1 / 30, 1 / 30, calm); assert(!life.visitors.some(v => v.lawn === 'kite' || v.lawn === 'blanket'), 'No kites without wind, no picnic blankets on paving'); }
  assert(life.pigeons.length > 0);
  const bird = life.pigeons[0];
  life.visitors = [{ lot: town.parks[0].id, x: bird.x + .05, y: bird.y, tx: bird.x + .5, ty: bird.y, rest: 0, life: 99, age: 1, look: childLook, seed: 1, phase: 0, spot: null, using: 0, duration: 0 }];
  life.update(1 / 30, 1 / 30, calm);
  assert(bird.fly, 'The pigeon flies away from a running child');
});
const paths = load('src/lib/games/town-park-paths.ts');
test('a park has one gate on each side that faces a road, on a free tile near the middle of that side', () => {
  const town = parkTown(['bench', null, null, 'fountain', 'pond', 'tree', 'swings', 'seesaw', null, null, null, null]), idx = game.indexAt;
  for (let x = 2; x <= 14; x++) town.tiles[idx(x, 11)] = 'road';
  for (let y = 7; y <= 11; y++) town.tiles[idx(8, y)] = 'road';
  const lot = town.parks[0], gates = paths.parkGates(lot, town.tiles);
  assert.deepEqual(gates.map(g => [g.dx, g.dy]).sort(), [[0, 1], [1, 0]], 'The bottom side and the right side face roads');
  assert.equal(gates.find(g => g.dy === 1).cell, idx(5, 10), 'Bottom side: the middle tile (both middle tiles are free, the first wins)');
  assert.equal(gates.find(g => g.dx === 1).cell, idx(7, 10), 'Right side: the middle tile has seesaw parts, so the free tile below is used');
  assert.deepEqual(paths.parkGates(parkTown([]).parks[0], parkTown([]).tiles), [], 'No road, no gate');
});
test('park visitors walk round ponds, fountains and play equipment instead of through them', () => {
  const town = parkTown(['carousel', 'pond', 'fountain', 'jungleGym', null, 'bandstand', null, 'splashPad', 'windmill', 'flowerField', 'foodCart', 'basketball']);
  const life = new TownLife(), day = env('2026-08-01', 13, { weather: weather('clear', { temp: 30 }) }), lot = town.parks[0];
  const blocked = new Set(lot.parts.map(p => p.tile)), started = new Map();
  life.sync(town, new Map());
  let walking = 0;
  for (let j = 0; j < 9000; j++) {
    life.update(1 / 30, 1 / 30, day);
    for (const v of life.visitors) {
      if (started.get(v) !== v.path) started.set(v, v.path), v.from = Math.floor(v.y) * 24 + Math.floor(v.x);
      if (!v.path?.length || v.spot && v.using >= 0) continue;
      walking++;
      const cell = Math.floor(v.y) * 24 + Math.floor(v.x), fx = v.x % 1, fy = v.y % 1;
      if (!blocked.has(cell) || cell === v.from || cell === Math.floor(v.ty) * 24 + Math.floor(v.tx)) continue;
      assert(Math.min(fx, 1 - fx, fy, 1 - fy) <= .07, `Walking through the ${lot.parts.find(p => p.tile === cell).kind} at ${v.x.toFixed(2)},${v.y.toFixed(2)}`);
    }
  }
  assert(walking > 1000, 'People walked round the park');
  const w = paths.parkWays(lot, town.tiles), route = paths.parkRoute(w, { x: 5.5, y: 9.5 }, { x: 7.5, y: 8.3 });
  assert(route.length > 1, 'A walk across the full park goes round, not straight');
  assert.deepEqual(route[route.length - 1], { x: 7.5, y: 8.3 });
});
test('visitors come along the sidewalk and in through the gate, and leave the same way', () => {
  const town = parkTown(['swings', 'bench', 'fountain', null, null, 'seesaw', null, 'picnic', null, null, null, null]), idx = game.indexAt;
  for (let x = 2; x <= 14; x++) town.tiles[idx(x, 11)] = 'road';
  const lot = town.parks[0], life = new TownLife(), day = env('2026-08-01', 10, { weather: weather('clear', { temp: 26 }) });
  life.sync(town, new Map());
  const gate = paths.parkWays(lot, town.tiles).gates[0];
  let arrived = 0, left = 0, faded = 0;
  for (let j = 0; j < 12000; j++) {
    life.update(1 / 30, 1 / 30, day);
    for (const v of life.visitors) {
      const outside = v.y > lot.y + lot.height;
      if (outside) assert(Math.abs(v.y - gate.outside.y) < 1e-6 || Math.abs(v.x - gate.outside.x) < .01, 'Outside the park, people keep to the sidewalk or the gate');
      if (outside && v.age < .1) arrived++;
      if (v.leaving && outside && v.path.length === 1) left++;
      if (!outside && !v.spot && !v.leaving && v.age > v.life + 1) faded++;
    }
  }
  assert(arrived > 3, 'People arrive along the sidewalk'); assert(left > 3, 'People leave through the gate');
  assert.equal(faded, 0, 'Nobody lingers in a park with a gate after their visit');
});
test('the water play pad is drained outside the summer, and Tanabata wishes hang on the bamboo from late June to 7 July', () => {
  const colors = (kind, state) => { const rec = recordingContext(); Object.assign(paint.paintState, state); art.drawParkArt(rec.c, kind, 5, 5, 0, false, 0); paint.resetPaintState(); return rec.fills.map(f => typeof f.color === 'string' ? f.color : ''); };
  assert(colors('splashPad', { season: 'summer' }).includes('#8fcadb'), 'Water in the summer');
  for (const season of ['spring', 'autumn', 'winter']) assert(!colors('splashPad', { season }).includes('#8fcadb'), `Drained in ${season}`);
  assert(colors('splashPad', { season: 'default' }).includes('#8fcadb'), 'The shop icon shows the water');
  assert(!motion.splashActive(env('2026-05-20', 13, { weather: weather('clear', { temp: 29 }) })), 'No water play on a hot day in May: the pad is still drained');
  assert(colors('bamboo', { season: 'summer', tanabata: true }).length > colors('bamboo', { season: 'summer' }).length + 10, 'Paper wishes, a chain and streamers');
  for (const [date, on] of [['2026-06-24', false], ['2026-06-25', true], ['2026-07-07', true], ['2026-07-08', false]]) assert.equal(motion.tanabataSeason(env(date, 12)), on, date);
  for (const [date, on] of [['2026-11-30', false], ['2026-12-01', true], ['2026-12-25', true], ['2026-12-26', false]]) assert.equal(motion.illuminationSeason(env(date, 20)), on, date);
});
test('on a snowy day children build snowmen and throw snowballs; the snowmen melt when the snow stops', () => {
  const town = parkTown(['swings', null, null, null, null, null, null, null, null, null, null, 'bench']);
  const life = new TownLife(), snowy = env('2027-01-20', 11, { weather: weather('snow', { temp: -1, precip: .6 }) });
  life.sync(town, new Map());
  const games = new Set();
  for (let j = 0; j < 20000 && life.snowmen.size === 0; j++) {
    life.update(1 / 30, 1 / 30, snowy);
    for (const v of life.visitors) if (v.lawn) { games.add(v.lawn); assert.equal(v.look.kind, 'child', 'Snow games are for children'); }
  }
  assert(life.snowmen.size > 0, 'A snowman is built');
  for (let j = 0; j < 3000; j++) { life.update(1 / 30, 1 / 30, snowy); for (const v of life.visitors) if (v.lawn) games.add(v.lawn); }
  assert(![...games].some(g => !['snowman', 'snowball'].includes(g)), 'No picnics or kites in the snow');
  assert([...life.snowmen.values()].some(size => size > .5), 'The snowman grows while children work on it');
  const draws = []; life.collect((x, y, depth, paint) => draws.push(paint), town, snowy, 0, 3);
  const rec = recordingContext(); for (const d of draws) d(rec.c); assert(rec.fills.some(f => f.color === '#f7fafc'), 'The snowman is drawn');
  const dry = env('2027-01-20', 11, { weather: weather('clear', { temp: 4 }) });
  for (let j = 0; j < 30 * 8; j++) life.update(1 / 30, 1 / 30, dry);
  assert.equal(life.snowmen.size, 0, 'The snowmen melt once the snow stops');
  assert(!life.visitors.some(v => v.lawn === 'snowman' || v.lawn === 'snowball'), 'Snow games end with the snow');
});
test('park trees are lit with twinkling lights from dusk in December, and a park pine gets a star', () => {
  const town = parkTown(['pine', 'tree', 'cherry', 'maple', 'ginkgo', null, null, null, null, null, null, null]);
  const life = new TownLife();
  life.sync(town, new Map());
  const lights = (date, hours) => { const e = env(date, hours), rec = recordingContext(); life.update(1 / 30, 1 / 30, e); life.collect((x, y, depth, paint) => paint(rec.c), town, e, e.night, 3); return rec.fills.filter(f => f.op === 'lighter').map(f => f.color); };
  const december = lights('2026-12-15', 19.5);
  assert(december.includes('#ffe066'), 'A star on top of the pine');
  assert(december.filter(c => c === '#ffe3a0').length > 40, 'Warm white lights on the other trees');
  assert.equal(lights('2026-12-15', 13).length, 0, 'Not in the daytime');
  assert.equal(lights('2026-11-15', 19.5).length, 0, 'Not before December');
});
const sidewalksModule = load('src/lib/games/town-sidewalks.ts'), trafficModule = load('src/lib/games/town-traffic.ts'), transportModule = load('src/lib/games/town-transport.ts');
/** Road adjacency like the renderer's: every road tile and its road neighbours. */
const roadMap = town => new Map(town.tiles.flatMap((t, i) => t === 'road' ? [[i, game.neighbours(i % 24, Math.floor(i / 24)).filter(n => town.tiles[n] === 'road')]] : []));
function grid() {
  let town = { ...blank(), money: 1e7 };
  for (const y of [4, 10, 16]) town = game.buildLine(town, 'road', game.lineTiles(game.indexAt(2, y), game.indexAt(14, y))).town;
  for (const x of [2, 8, 14]) town = game.buildLine(town, 'road', game.lineTiles(game.indexAt(x, 4), game.indexAt(x, 16))).town;
  return town;
}
test('pedestrians keep to the sidewalks and cross the road only at the zebra crossings of junctions', () => {
  const town = grid(), roads = roadMap(town), w = sidewalksModule.walkways(roads, (_tile, arms) => arms >= 3);
  const onRoad = (x, y) => { const tile = Math.floor(y) * 24 + Math.floor(x), u = x % 1, v = y % 1; return roads.has(tile) && Math.abs(u - .5) < .24 && Math.abs(v - .5) < .24 ? tile : -1; };
  const doors = [[game.indexAt(5, 3), game.indexAt(5, 4)], [game.indexAt(11, 17), game.indexAt(11, 16)], [game.indexAt(1, 12), game.indexAt(2, 12)], [game.indexAt(9, 7), game.indexAt(8, 7)]];
  for (const [a, ra] of doors) for (const [b, rb] of doors) {
    if (a === b) continue;
    const side = (house, road) => ({ dx: house % 24 - road % 24, dy: Math.floor(house / 24) - Math.floor(road / 24) });
    const route = sidewalksModule.sidewalkRoute(w, { road: ra, side: side(a, ra) }, { road: rb, side: side(b, rb) });
    assert(route && route.length >= 2, 'Every door can be reached on foot');
    for (let j = 1; j < route.length; j++) for (let k = 1; k < 10; k++) {
      const x = route[j - 1].x + (route[j].x - route[j - 1].x) * k / 10, y = route[j - 1].y + (route[j].y - route[j - 1].y) * k / 10, tile = onRoad(x, y);
      if (tile >= 0) assert(roads.get(tile).length >= 3, `Off the crosswalk at ${x.toFixed(2)},${y.toFixed(2)}`);
      const u = x % 1, v = y % 1;
      if (tile >= 0) assert(Math.abs(u - .5) > .25 || Math.abs(v - .5) > .25 || Math.min(Math.abs(u - .2), Math.abs(u - .8), Math.abs(v - .2), Math.abs(v - .8)) < .01, 'Crossing on the zebra line, never through the middle of the junction');
    }
  }
  // A single street with houses on both sides and no junction: people cross it there, since there is no other way.
  let lane = { ...blank(), money: 1e7 }; lane = game.buildLine(lane, 'road', game.lineTiles(game.indexAt(3, 8), game.indexAt(9, 8))).town;
  const lw = sidewalksModule.walkways(roadMap(lane), (_tile, arms) => arms >= 3);
  assert(sidewalksModule.sidewalkRoute(lw, { road: game.indexAt(4, 8), side: { dx: 0, dy: -1 } }, { road: game.indexAt(7, 8), side: { dx: 0, dy: 1 } }));
});
test('cars keep their distance, take turns in junctions and never overlap', () => {
  const town = grid(), roads = roadMap(town), traffic = new trafficModule.Traffic();
  traffic.sync(roads, tile => town.tiles[tile] === 'road');
  assert(traffic.vehicles.length >= 10);
  let progress = 0;
  for (let j = 0; j < 3000; j++) {
    const before = traffic.vehicles.map(v => v.t);
    traffic.update(1 / 30, 1 / 30, 1, j / 30);
    progress += traffic.vehicles.reduce((sum, v, k) => sum + ((v.t - before[k] + 1) % 1), 0);
    const poses = traffic.poses();
    for (let a = 0; a < poses.length; a++) for (let b = a + 1; b < poses.length; b++) assert(Math.hypot(poses[a].x - poses[b].x, poses[a].y - poses[b].y) >= .2, 'Two cars on top of each other');
    const inJunction = new Map();
    for (const v of traffic.vehicles) {
      const tile = v.t >= trafficModule.STOP_LINE ? v.to : v.t < 1 - trafficModule.STOP_LINE ? v.from : -1;
      if (tile >= 0 && roads.get(tile).length >= 3) { assert(!inJunction.has(tile), 'One car at a time in a junction'); inJunction.set(tile, v); }
    }
  }
  assert(progress / traffic.vehicles.length > 40, 'Cars keep moving instead of jamming');
  // A red light (the town's gate) holds a car at the stop line.
  const held = new trafficModule.Traffic(); held.sync(roads, tile => town.tiles[tile] === 'road');
  for (let j = 0; j < 600; j++) held.update(1 / 30, 1 / 30, 1, j / 30, tile => roads.get(tile).length < 3);
  for (const v of held.vehicles) if (roads.get(v.to).length >= 3) assert(v.t < trafficModule.STOP_LINE, 'Stopped before the junction');
  assert.ok(transportModule.sampleTransportPath);
});
const roadPartsModule = load('src/lib/games/town-road-parts.ts');
/** A grid of streets lined with houses, so people walk and drive through every junction. */
function busyGrid(parts) {
  let town = grid();
  for (const y of [3, 5, 9, 11, 15, 17]) for (const x of [4, 6, 10, 12]) town = game.buildTile(town, (x + y) % 3 ? 'house' : 'shop', x, y).town;
  for (const [x, y, part] of parts) { const r = game.buyFacilityPart(town, game.indexAt(x, y), part); assert.notEqual(r.town, town, `${part} at ${x},${y}: ${r.message}`); town = r.town; }
  return town;
}
const segment = w => { let j = 0; while (j < w.lengths.length - 2 && w.lengths[j + 1] <= w.s) j++; return j; };
test('traffic lights: cars go on green and people cross on the walk light, never against it', () => {
  const town = busyGrid([[8, 10, 'signal'], [8, 7, 'signal']]), junction = game.indexAt(8, 10), mid = game.indexAt(8, 7);
  const scene = new TownScene(), record = recordingContext(), day = env('2026-10-14', 10);
  scene.camera = { x: 200, y: -100, zoom: 1 };
  let cars = 0, people = 0, waited = 0;
  const last = new Map(), crossing = new Map();
  for (let j = 0; j < 30 * 70; j++) {
    scene.render(record.c, 400, 400, town, { ...options, environment: day }, 1 / 30);
    for (const tile of [junction, mid]) {
      const layout = scene.roadLayouts.get(tile), state = roadPartsModule.signalState(layout, scene.time);
      for (const v of scene.traffic.vehicles) {
        const before = last.get(v);
        if (before && before.to === tile && v.to === tile && before.t < trafficModule.STOP_LINE && v.t >= trafficModule.STOP_LINE) {
          cars++; assert.equal(state[Math.abs(tile - v.from) === 1 ? 'x' : 'y'], 'green', 'A car went in against the light');
        }
        if (v.to === tile && v.t < trafficModule.STOP_LINE && v.t > trafficModule.STOP_LINE - .05 && state[Math.abs(tile - v.from) === 1 ? 'x' : 'y'] !== 'green') waited++;
      }
      for (const w of scene.life.walkers) {
        const k = segment(w), end = w.points[k + 1], start = w.points[k], on = end && end.cross && end.cross.tile === tile;
        if (on && crossing.get(w) !== `${tile}:${k}`) {
          const along = Math.abs(end.x - start.x) > Math.abs(end.y - start.y) ? 'x' : 'y';
          people++; assert.equal(along === 'x' ? state.walkX : state.walkY, 'walk', 'Someone stepped out against the walk light');
        }
        if (on) crossing.set(w, `${tile}:${k}`); else if (crossing.get(w)?.startsWith(`${tile}:`)) crossing.delete(w);
      }
    }
    for (const v of scene.traffic.vehicles) last.set(v, { to: v.to, t: v.t });
  }
  assert(cars > 10, `Cars drove through the lights (${cars})`); assert(people > 2, `People crossed at the lights (${people})`); assert(waited > 0, 'Cars waited at a red light');
});
test('a stop sign: every car stops at the line first; a crosswalk: cars wait while people cross', () => {
  const town = busyGrid([[8, 10, 'stopSign'], [5, 10, 'crosswalk'], [11, 10, 'crosswalk']]), junction = game.indexAt(8, 10), walks = [game.indexAt(5, 10), game.indexAt(11, 10)];
  const scene = new TownScene(), record = recordingContext(), day = env('2026-10-14', 10);
  scene.camera = { x: 200, y: -100, zoom: 1 };
  let stops = 0, crossed = 0;
  const last = new Map();
  for (let j = 0; j < 30 * 70; j++) {
    scene.render(record.c, 400, 400, town, { ...options, environment: day }, 1 / 30);
    for (const v of scene.traffic.vehicles) {
      const before = last.get(v);
      if (before && before.to === junction && v.to === junction && before.t < trafficModule.STOP_LINE && v.t >= trafficModule.STOP_LINE) { stops++; assert(before.halt >= .85, `Rolled through the stop sign after ${before.halt.toFixed(2)} s`); }
      for (const tile of walks) {
        const people = scene.life.crossing.get(`${tile}:0`) ?? 0;
        const over = v.alpha > 0 && (v.to === tile && v.t >= .76 || v.from === tile && v.t <= .24);
        if (people && over) assert.fail('A car drove over the crosswalk while someone was on it');
      }
      last.set(v, { to: v.to, t: v.t, halt: v.halt });
    }
    for (const tile of walks) if (scene.life.crossing.get(`${tile}:0`)) crossed++;
  }
  assert(stops > 5, `Cars came to the stop sign (${stops})`); assert(crossed > 0, 'People used the crosswalks');
});
test('buses stop at the bus stops and the people waiting get on', () => {
  const town = busyGrid([[5, 4, 'busStop'], [11, 16, 'busStop'], [2, 7, 'busStop']]);
  const scene = new TownScene(), record = recordingContext(), day = env('2026-10-14', 10);
  scene.camera = { x: 200, y: -100, zoom: 1 };
  let dwelt = 0, boarded = 0;
  const stops = new Set([game.indexAt(5, 4), game.indexAt(11, 16), game.indexAt(2, 7)]);
  for (let j = 0; j < 30 * 120; j++) {
    const queues = scene.life.queues.map(q => q.count);
    scene.render(record.c, 400, 400, town, { ...options, environment: day }, 1 / 30);
    for (const d of scene.traffic.dwelling()) { assert(stops.has(d.tile), 'A bus stood where there is no stop'); dwelt++; }
    scene.life.queues.forEach((q, k) => { if (q.count < queues[k] && scene.life.boarding.get(q.tile) === q.side) boarded++; });
  }
  assert(scene.traffic.vehicles.some(v => v.model === 'bus'), 'Buses run once the town has bus stops');
  assert(dwelt > 0, 'A bus stood at a stop'); assert(boarded > 0, 'Passengers got on');
});
test('people cross a long street by its footbridge, up the stairs and over the cars', () => {
  let town = { ...blank(), money: 1e7 };
  town = game.buildLine(town, 'road', game.lineTiles(game.indexAt(8, 3), game.indexAt(8, 17))).town;
  for (let y = 4; y <= 16; y += 2) for (const x of [7, 9]) town = game.buildTile(town, 'house', x, y).town;
  town = game.buyFacilityPart(town, game.indexAt(8, 10), 'footbridge').town;
  const scene = new TownScene(), record = recordingContext(), day = env('2026-10-14', 10);
  scene.camera = { x: 200, y: -100, zoom: 1 };
  let lifted = 0, top = 0;
  for (let j = 0; j < 30 * 60; j++) {
    scene.render(record.c, 400, 400, town, { ...options, environment: day }, 1 / 30);
    for (const w of scene.life.walkers) {
      const k = segment(w), a = w.points[k], b = w.points[k + 1] ?? a, t = Math.min(1, Math.max(0, (w.s - w.lengths[k]) / ((w.lengths[k + 1] ?? w.s) - w.lengths[k] || 1)));
      const z = (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t;
      if (z > 1) { lifted++; top = Math.max(top, z); }
      // Up on the bridge, nobody is over the middle of the road at ground level.
      const x = a.x + (b.x - a.x) * t, onTile = Math.floor(x) === 8 && Math.floor(a.y + (b.y - a.y) * t) === 10;
      if (onTile && Math.abs(x - 8.5) < .2) assert(z > 10, 'Walking across the road under the footbridge');
    }
  }
  assert(lifted > 0, 'People walked over the footbridge'); assert.equal(top, roadPartsModule.BRIDGE_Z);
});
console.log(`${passed} living town checks passed`);
