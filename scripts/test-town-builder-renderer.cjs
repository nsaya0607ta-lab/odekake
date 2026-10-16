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
const transport = compile('src/lib/games/town-transport.ts', { './town-builder': game });
const paint = compile('src/lib/games/town-paint.ts');
const sun = compile('src/lib/room/sun.ts'), roomWeather = compile('src/lib/room/weather.ts');
const environment = compile('src/lib/games/town-environment.ts', { '../room/sun': sun, '../room/weather': roomWeather });
const sprites = compile('src/lib/games/town-sprites.ts', { './town-paint': paint });
const decorations = compile('src/lib/games/town-decorations.ts', { './town-paint': paint });
const models = compile('src/lib/games/town-building-models.ts');
const sky = compile('src/lib/games/town-sky.ts', { './town-builder': game, './town-environment': environment });
const figures = compile('src/lib/games/town-figures.ts', { './town-paint': paint });
const art = compile('src/lib/games/town-park-art.ts', { './town-paint': paint });
const motion = compile('src/lib/games/town-park-motion.ts', { './town-paint': paint, './town-figures': figures, './town-park-art': art });
const paths = compile('src/lib/games/town-park-paths.ts', { './town-builder': game });
const sidewalks = compile('src/lib/games/town-sidewalks.ts', { './town-builder': game });
const traffic = compile('src/lib/games/town-traffic.ts', { './town-builder': game, './town-transport': transport });
const roadParts = compile('src/lib/games/town-road-parts.ts', { './town-builder': game });
const roadArt = compile('src/lib/games/town-road-art.ts', { './town-paint': paint, './town-park-art': art, './town-road-parts': roadParts });
const life = compile('src/lib/games/town-life.ts', { './town-builder': game, './town-paint': paint, './town-transport': transport, './town-figures': figures, './town-park-art': art, './town-park-motion': motion, './town-park-paths': paths, './town-sidewalks': sidewalks, './town-road-parts': roadParts });
const { TownScene, drawTownIcon, drawTownPartIcon, trainAt } = compile('src/lib/games/town-renderer.ts', { './town-builder': game, './town-transport': transport, './town-sprites': sprites, './town-decorations': decorations, './town-building-models': models, './town-paint': paint, './town-environment': environment, './town-sky': sky, './town-life': life, './town-park-art': art, './town-park-paths': paths, './town-park-motion': motion, './town-traffic': traffic, './town-road-parts': roadParts, './town-road-art': roadArt });
const iso = (x, y, z = 0) => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
const blank = () => ({ ...game.createTown(false), tiles: Array(576).fill('grass'), terrain: Array(576).fill(false), levels: Array(576).fill(0) });
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
// Record real renderer operations: text, opacity and train geometry, without a GPU dependency.
class RecordedGradient {
  constructor(kind, coordinates) { this.kind = kind; this.coordinates = coordinates; this.stops = []; }
  addColorStop(position, color) { this.stops.push([position, color]); }
}
function recordingContext() {
  const fills = [], strokes = [], stack = [];
  let points = [];
  const target = {
    globalAlpha: 1,
    fillStyle: '',
    beginPath() { points = []; },
    moveTo(x, y) { points.push({ x, y }); },
    lineTo(x, y) { points.push({ x, y }); },
    fill() { fills.push({ color: this.fillStyle, alpha: this.globalAlpha, points: [...points] }); },
    stroke() { strokes.push({ color: this.strokeStyle, points: [...points] }); },
    fillText() { assert.fail('Text must stay in the interface, not on town artwork'); },
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle }); },
    restore() { Object.assign(this, stack.pop()); },
    createLinearGradient(...coordinates) { return new RecordedGradient('linear', coordinates); },
    createRadialGradient(...coordinates) { return new RecordedGradient('radial', coordinates); },
  };
  return { c: new Proxy(target, { get: (obj, key) => key in obj ? obj[key] : () => {} }), fills, strokes };
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
  const scene = new TownScene(), p = iso(6.3, 6.72, 70);
  assert.equal(scene.pickTile(p.x, p.y, town), 6 * 24 + 6);
});
test('empty land and points outside the map retain ground picking', () => {
  const scene = new TownScene(), p = iso(3.5, 8.5);
  assert.equal(scene.pickTile(p.x, p.y, blank()), 8 * 24 + 3);
  assert.equal(scene.pickTile(3000, -3000, blank()), null);
});
test('selection bounds include the roof and foundation of a tall building', () => {
  const scene = new TownScene(), town = blank(), i = 5 * 24 + 5;
  town.tiles[i] = 'house'; town.levels[i] = 3; scene.camera = { x: 195, y: -100, zoom: .85 };
  const bounds = scene.tileBounds(i, town), roof = iso(5.5, 5.5, 80), ground = iso(5.5, 5.5);
  assert(bounds.top <= scene.camera.y + roof.y * .85);
  assert(bounds.bottom >= scene.camera.y + ground.y * .85);
  assert(bounds.left < bounds.right);
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
test('the selection marker is drawn below a house instead of washing out its walls', () => {
  const { c, fills } = recordingContext(), town = blank(), i = 5 * 24 + 5;
  town.tiles[i] = 'house'; town.levels[i] = 1;
  new TownScene().render(c, 390, 844, town, { ...options, selected: i }, 0);
  const marker = fills.findIndex(f => f.color === '#d8b56618');
  const door = fills.findIndex(f => f.color === '#677d70');
  assert(marker >= 0 && door > marker, 'Building details must remain above the selection marker');
});
test('touch exploration has no white hover layer following the camera', () => {
  const town = blank(), baseline = recordingContext(), hovered = recordingContext();
  new TownScene().render(baseline.c, 390, 844, town, options, 0);
  new TownScene().render(hovered.c, 390, 844, town, { ...options, hover: 100 }, 0);
  assert.deepEqual(hovered.fills, baseline.fills);
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
function inside(point, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
test('all 16 road junctions have one continuous surface and only the connected open ends', () => {
  for (let mask = 0; mask < 16; mask++) {
    const outline = transport.transportOutline(mask, .24);
    assert(inside({ x: .5, y: .5 }, outline));
    for (const { bit, dx, dy } of transport.DIRECTIONS) {
      assert.equal(inside({ x: .5 + dx * .499, y: .5 + dy * .499 }, outline), Boolean(mask & bit), `mask ${mask}, direction ${bit}`);
      if (mask & bit) for (const offset of [-.24, 0, .24]) assert(inside({ x: .5 + dx * .499 + dy * offset, y: .5 + dy * .499 + dx * offset }, outline));
    }
    assert(!inside({ x: .05, y: .05 }, outline), 'A junction must not pave the whole tile');
  }
});
test('transport connections never wrap around a map edge and rails join a station', () => {
  const town = blank(); town.tiles[24] = 'road'; town.tiles[23] = 'road';
  assert.equal(transport.transportMask(town, 24, 'road'), 0);
  town.tiles[25] = 'station'; town.tiles[24] = 'rail';
  assert.equal(transport.transportMask(town, 24, 'rail'), 2);
});
test('every road and rail bridge meets the adjacent land ramp without a height discontinuity', () => {
  for (const kind of ['road', 'rail']) for (const { dx, dy } of transport.DIRECTIONS) {
    const town = blank(), i = 10 * 24 + 10, n = (10 + dy) * 24 + 10 + dx;
    town.tiles[i] = kind; town.tiles[n] = kind; town.terrain[n] = true;
    assert.equal(transport.transportHeight(town, i, .5, .5, kind), 0);
    assert.equal(transport.transportHeight(town, i, .5 + dx * .25, .5 + dy * .25, kind), 2.5);
    assert.equal(transport.transportHeight(town, i, .5 + dx * .5, .5 + dy * .5, kind), transport.transportHeight(town, n, .5 - dx * .5, .5 - dy * .5, kind));
  }
});
test('curved rails stay on their ballast and use a continuous heading', () => {
  for (let mask = 1; mask < 16; mask++) for (const path of transport.trackPaths(mask)) {
    const outline = transport.transportOutline(mask, .28);
    for (let j = 1; j < 40; j++) {
      const p = transport.trackPoint(path, j / 40);
      assert(Math.abs(Math.hypot(p.dx, p.dy) - 1) < 1e-9);
      for (const side of [-1, 1]) assert(inside({ x: p.x + p.dy * .095 * side, y: p.y - p.dx * .095 * side }, outline), `rail outside ballast: ${mask}`);
    }
  }
});
test('station roofs and picking rotate with the connected railway', () => {
  const town = blank(), i = 5 * 24 + 5; town.tiles[i] = 'station'; town.tiles[i - 24] = town.tiles[i + 24] = 'rail';
  assert.equal(transport.stationAxis(town, i), 'y');
  const p = iso(5.8, 5.15, 23);
  assert.equal(new TownScene().pickTile(p.x, p.y, town), i);
  town.tiles[i - 24] = town.tiles[i + 24] = 'grass'; town.tiles[i - 1] = town.tiles[i + 1] = 'rail';
  assert.equal(transport.stationAxis(town, i), 'x');
});
test('car positions and headings remain continuous through curves and dead-end reversals', () => {
  for (const route of [[125,126,150,151], [125,126,125,126]]) for (let position = .5; position <= 2.5; position += .5) {
    const a = transport.sampleTransportPath(route, position - .00001), b = transport.sampleTransportPath(route, position + .00001);
    const offset = p => ({ x: p.x + (p.laneApplied ? 0 : p.dy * .13), y: p.y - (p.laneApplied ? 0 : p.dx * .13) });
    const p = offset(a), q = offset(b);
    assert(Math.hypot(p.x - q.x, p.y - q.y) < .001, 'Position jumps at a turn');
    assert(Math.hypot(a.dx - b.dx, a.dy - b.dy) < .001, 'Heading snaps at a turn');
  }
});
test('three train cars keep their spacing around consecutive bends', () => {
  const path = transport.measureTransportRoute([125,126,127,151,175,176]);
  for (let distance = .34; distance < path.length - .34; distance += .025) {
    const a = transport.sampleTransportDistance(path, distance - .34), b = transport.sampleTransportDistance(path, distance), c = transport.sampleTransportDistance(path, distance + .34);
    assert(Math.hypot(a.x - b.x, a.y - b.y) > .29);
    assert(Math.hypot(b.x - c.x, b.y - c.y) > .29);
  }
});
test('factory roof units rest on the roof at every upgrade level', () => {
  for (let level = 1; level <= 3; level++) {
    const town = blank(), i = 5 * 24 + 5; town.tiles[i] = 'factory'; town.levels[i] = level;
    const { c, fills } = recordingContext(); new TownScene().render(c, 800, 600, town, options, 0);
    const top = fills.find(f => f.color === '#9cb9b4'); assert(top);
    const layout=models.factoryLayout(level);assert.deepEqual(top.points[0], iso(5+layout.vent.u, 5+layout.vent.v, layout.main.height+5));
  }
});
test('a platform and train are painted before the station canopy', () => {
  const town = blank(), route = [125,126,127,128]; route.forEach((i,j)=>town.tiles[i] = j === 0 || j === 3 ? 'station' : 'rail');
  const { c, fills } = recordingContext(); new TownScene().render(c, 800, 600, town, { ...options, routes: [route] }, 0);
  const platform = fills.findIndex(f => f.color === '#e6dbc3'), train = fills.findIndex(f => f.color === '#f3e5bf'), canopy = fills.findIndex(f => f.color === '#75aca1');
  assert(platform >= 0 && train > platform && canopy > train);
});
test('removing a rail stops a stale route immediately', () => {
  const town = blank(), route = [125,126,127,128]; route.forEach((i,j)=>town.tiles[i] = j === 0 || j === 3 ? 'station' : 'rail');
  const { c, fills } = recordingContext(), scene = new TownScene(), settings = { ...options, routes: [route] };
  scene.render(c, 800, 600, town, settings, 0); assert(fills.some(f => f.color === '#f3e5bf'));
  fills.length = 0; const tiles = town.tiles.slice(); tiles[126] = 'grass';
  scene.render(c, 800, 600, { ...town, tiles }, settings, 0); assert(!fills.some(f => f.color === '#f3e5bf'));
});
function canvasFactory() {
  const surfaces = [];
  return { surfaces, create() {
    const record = recordingContext(), canvas = { width: 300, height: 150, getContext: () => record.c }; record.c.canvas = canvas;
    surfaces.push({ canvas, ...record }); return canvas;
  } };
}
test('camera movement and accounting reuse ground and artwork; building changes invalidate the right cache', () => {
  const factory = canvasFactory(), { c } = recordingContext(), town = blank();
  town.tiles[125] = 'house'; town.levels[125] = 1; town.tiles[149] = 'road';
  const scene = new TownScene(() => factory.create()); scene.camera = { x: 200, y: 30, zoom: .85 };
  scene.render(c, 390, 844, town, options, 0);
  const ground = factory.surfaces[0], groundPaints = ground.fills.length, surfaces = factory.surfaces.length;
  const paintings = factory.surfaces.reduce((sum,s)=>sum+s.fills.length,0);
  for (let j = 0; j < 20; j++) { scene.camera.x += .1; scene.render(c, 390, 844, { ...town, money: town.money + j }, options, 0); }
  assert.equal(factory.surfaces.length, surfaces); assert.equal(factory.surfaces.reduce((sum,s)=>sum+s.fills.length,0), paintings);
  const levels = town.levels.slice(); levels[125] = 3; scene.render(c, 390, 844, { ...town, levels }, options, 0);
  assert.equal(ground.fills.length, groundPaints); assert(factory.surfaces.length > surfaces);
  const tiles = town.tiles.slice(); tiles[150] = 'road'; scene.render(c, 390, 844, { ...town, tiles }, options, 0);
  assert(ground.fills.length > groundPaints, 'Road connections must refresh when a neighbouring road is added');
});
test('sprite memory is bounded and recently used artwork stays cached', () => {
  const factory = canvasFactory(), cache = new sprites.TownSprites(() => factory.create()), { c } = recordingContext(); let paintings = 0;
  const bounds = { left: 0, top: 0, width: 512, height: 512 }, paint = () => paintings++;
  for (let i = 0; i < 10; i++) cache.draw(c, String(i), 0, 0, bounds, paint);
  cache.draw(c, '9', 0, 0, bounds, paint); assert.equal(paintings, 10);
  cache.draw(c, '0', 0, 0, bounds, paint); assert.equal(paintings, 11, 'The least recently used sprite must be evicted');
});
test('close-range sprites match screen density and reuse artwork while panning', () => {
  const factory = canvasFactory(), cache = new sprites.TownSprites(() => factory.create()), { c } = recordingContext(); let paintings = 0;
  const bounds = { left: -38, top: -90, width: 112, height: 130 }, paint = () => paintings++;
  cache.draw(c, 'tower', 0, 0, bounds, paint, 4.4);
  assert.equal(factory.surfaces[0].canvas.width, 560); assert.equal(factory.surfaces[0].canvas.height, 650);
  cache.draw(c, 'tower', 12, -8, bounds, paint, 4.8); assert.equal(paintings, 1);
  cache.draw(c, 'tower', 0, 0, bounds, paint, 6.2); assert.equal(paintings, 2);
  assert.equal(factory.surfaces[1].canvas.width, 784);
  cache.draw(c, 'tower', 24, -8, bounds, paint, 6.2); assert.equal(paintings, 2);
});
test('an empty purchased park has no automatic fountain or furniture; paid equipment updates without changing terrain tiles', () => {
  let town = game.buyParkLot(blank(),5,5,'small').town;const scene=new TownScene(),{c,fills}=recordingContext();
  const fountainWater = f => f.color instanceof RecordedGradient && f.color.kind === 'radial' && f.color.stops.some(([, color]) => color === '#7bc9c8');
  scene.render(c,800,600,town,options,0);assert(!fills.some(fountainWater));
  const tiles=town.tiles;town=game.placeParkPart(town,125,125,'fountain').town;assert.equal(town.tiles,tiles);fills.length=0;
  scene.render(c,800,600,town,options,0);assert(fills.some(fountainWater));
  town=game.removeParkPart(town,125,125).town;fills.length=0;scene.render(c,800,600,town,options,0);assert(!fills.some(fountainWater));
});
test('a park fence along a street is drawn in stretches sorted where they stand, with one gate and gateposts per street side', () => {
  let town = game.buildLine(blank(), 'road', game.lineTiles(game.indexAt(2, 7), game.indexAt(12, 7))).town;
  town = game.buyParkLot({ ...town, money: 1e6 }, 4, 5, 'small').town;
  const scene = new TownScene(), { c, strokes } = recordingContext();
  scene.camera = { x: 400 - iso(5, 6).x, y: 300 - iso(5, 6).y, zoom: 1 };
  scene.render(c, 800, 600, town, options, 0);
  const fences = scene.objects.filter(o => o.key?.startsWith('fence:'));
  const street = fences.filter(o => o.key.startsWith('fence:8:'));
  assert.equal(street.length, 8, 'Both tiles on the street side are drawn in four stretches each');
  assert.equal(fences.length - street.length, 6, 'The other sides stay single pieces');
  assert.deepEqual([...new Set(street.filter(o => o.key.startsWith('fence:8:true')).map(o => o.tile))], [game.indexAt(4, 6)], 'One gate on the street side');
  assert(strokes.some(s => s.color === '#c4b9a1'), 'Stone gateposts stand either side of the gate');
  for (const o of street) {
    const k = Number(o.key.split(':')[3]), x = o.tile % 24, y = Math.floor(o.tile / 24), near = x + .04 + .92 * k / 4, far = x + .04 + .92 * (k + 1) / 4;
    assert(o.depth > far + y + .9 + .03, 'Someone inside the park near the fence is drawn behind it');
    assert(o.depth < near + y + 1.2 + .02, 'Someone on the sidewalk in front is drawn over it');
  }
});
test('selection bounds include a complete multi-cell plot and space for its trees',()=>{
  const town=game.buyParkLot(blank(),5,5,'medium').town,scene=new TownScene();scene.camera={x:195,y:0,zoom:1.4};
  const bounds=scene.tileBounds(6*24+6,town);for(const p of [iso(5,5),iso(8,5),iso(5,8),iso(8,8),iso(5.5,5.5,40)])assert(bounds.left<=195+p.x*1.4&&bounds.right>=195+p.x*1.4&&bounds.top<=p.y*1.4&&bounds.bottom>=p.y*1.4);
});
test('park tree canopies select their own component tile at different camera scales',()=>{
  let town=game.buyParkLot(blank(),5,5,'small').town;town=game.placeParkPart(town,125,125,'tree').town;const scene=new TownScene(),p=iso(5.5,5.5,24);
  for(const zoom of [.6,1.4,2.8]){scene.camera={x:195,y:50,zoom};assert.equal(scene.pickTile(195+p.x*zoom,50+p.y*zoom,town),125);}
});
test('land placement previews the selected complete footprint',()=>{
  const town=blank(),{c,fills}=recordingContext();new TownScene().render(c,800,600,town,{...options,tool:'park',hover:125,parkSize:'medium'},0);
  const preview=fills.find(f=>f.color==='#bdd0a655');assert(preview);assert.deepEqual(preview.points,[iso(5,5,1),iso(8,5,1),iso(8,8,1),iso(5,8,1)]);
});
test('every park and facility component icon renders without labels or smoke',()=>{
  const {c,fills}=recordingContext();for(const part of [...game.PARK_PARTS,...game.FACILITY_PARTS])drawTownPartIcon(c,part.id,60,48);
  assert(fills.length>30);assert(fills.every(f=>f.alpha===1));
});
test('component and path changes refresh the cache; movement after editing reuses it',()=>{
  const factory=canvasFactory(),{c}=recordingContext();let town=game.buyParkLot(blank(),5,5,'small').town;
  const scene=new TownScene(()=>factory.create());scene.camera={x:195,y:20,zoom:1};scene.render(c,390,844,town,options,0);
  const ground=factory.surfaces[0],before=ground.fills.length;town=game.placeParkPart(town,125,125,'path').town;scene.render(c,390,844,town,options,0);assert(ground.fills.length>before);
  town=game.placeParkPart(town,125,125,'bench').town;scene.render(c,390,844,town,options,0);const paints=factory.surfaces.reduce((n,s)=>n+s.fills.length,0),surfaces=factory.surfaces.length;
  for(let i=0;i<20;i++){scene.camera.x+=.1;scene.render(c,390,844,town,options,0);}assert.equal(factory.surfaces.length,surfaces);assert.equal(factory.surfaces.reduce((n,s)=>n+s.fills.length,0),paints);
});
test('tall new park structures can be selected above the ground tile at different zooms',()=>{
  for(const kind of ['cherry','pine','gazebo','clock','arch','swings']){
    let town=game.buyParkLot(blank(),5,5,'medium').town;town=game.placeParkPart(town,125,125,kind).town;
    const scene=new TownScene(),p=iso(5.5,5.5,kind==='swings'?23:30);
    for(const zoom of [.6,1.4,2.8]){scene.camera={x:160,y:60,zoom};assert.equal(scene.pickTile(160+p.x*zoom,60+p.y*zoom,town),125,kind);}
  }
});
test('the tall parts added in 2026-10 (windmill, carousel, flag pole, bandstand, ginkgo) are selected by their tops too',()=>{
  for(const [kind,z] of [['windmill',40],['carousel',30],['flagPole',40],['bandstand',28],['ginkgo',32],['bamboo',38]]){
    let town=game.buyParkLot(blank(),5,5,'medium').town;town=game.placeParkPart(town,125,125,kind).town;
    const scene=new TownScene(),p=iso(5.5,5.5,z);
    for(const zoom of [.6,1.4,2.8]){scene.camera={x:160,y:60,zoom};assert.equal(scene.pickTile(160+p.x*zoom,60+p.y*zoom,town),125,kind);}
  }
});
test('gazebo furniture stays under the roof and roof lighting stays fixed when rotated',()=>{
  const samples=[{x:-3,y:-4},{x:3,y:-2},{x:2.56,y:.68},{x:0,y:2}], roofs=new Set(['#527d69','#759a7f','#7b9f83','#9ab497']);
  let reference;
  for(let rotation=0;rotation<4;rotation++){
    const {c,fills}=recordingContext();decorations.drawTownDecoration(c,'gazebo',0,0,rotation,false);
    const colors=samples.map(point=>fills.findLast(f=>f.points.length>=3&&inside(point,f.points))?.color);
    assert(colors.every(color=>roofs.has(color)), 'A bench or column is painted through the opaque roof');
    if(reference)assert.deepEqual(colors,reference,'Rotating furniture must not rotate the sunlight');
    reference=colors;
  }
});
test('clock dials remain on the two visible tower walls in every orientation',()=>{
  for(const rotation of [0,1,2,3])for(const night of [false,true]){
    const {c,fills}=recordingContext();decorations.drawTownDecoration(c,'clock',0,0,rotation,night);
    const walls=fills.filter(f=>['#6c8c80','#476b65'].includes(f.color)&&Math.max(...f.points.map(p=>p.x))-Math.min(...f.points.map(p=>p.x))>5);
    const dials=fills.filter(f=>f.color===(night?'#ffdf9d':'#f4edd0')&&f.points.length===32);
    assert.equal(walls.length,2);assert.equal(dials.length,2);
    for(const dial of dials)assert(walls.some(wall=>dial.points.every(point=>inside(point,wall.points))), 'A clock face floats outside its wall');
  }
});
test('a vending machine never paints its display through its opaque back',()=>{
  for(const rotation of [0,1,2,3])for(const night of [false,true]){
    const {c,fills}=recordingContext();decorations.drawTownDecoration(c,'vending',0,0,rotation,night);
    assert.equal(fills.some(f=>f.color===(night?'#c9e6c3':'#6a9c9d')),[0,3].includes(rotation));
  }
});
test('every ladder rung joins both slide ladder rails after rotating',()=>{
  const onSegment=(p,a,b)=>Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))<1e-6&&(p.x-a.x)*(p.x-b.x)+(p.y-a.y)*(p.y-b.y)<=1e-6;
  for(const rotation of [0,1,2,3]){
    let town=game.buyParkLot(blank(),5,5,'small').town;town=game.placeParkPart(town,125,125,'playground',rotation).town;
    const {c,strokes}=recordingContext();new TownScene().render(c,800,600,town,options,0);
    const rails=strokes.filter(s=>s.color==='#749b93'),rungs=strokes.filter(s=>s.color==='#d4d3aa');
    assert.equal(rails.length,2);assert.equal(rungs.length,5);
    for(const rung of rungs){assert(onSegment(rung.points[0],...rails[0].points));assert(onSegment(rung.points[1],...rails[1].points));}
  }
});
test('factory stacks start at the roof and stay clear of the roof equipment',()=>{
  for(let level=1;level<=3;level++){
    const town=blank();town.tiles[125]='factory';town.levels[125]=level;
    const {c,fills}=recordingContext();new TownScene().render(c,800,600,town,options,0);
    const layout=models.factoryLayout(level),sides=fills.filter(f=>['#bf8d75','#8e6557'].includes(f.color));assert.equal(sides.length,layout.stacks.length*2);
    layout.stacks.forEach((stack,j)=>{
      const expected=[[iso(5+stack.u,5+stack.v+stack.d,stack.z),iso(5+stack.u+stack.w,5+stack.v+stack.d,stack.z)],[iso(5+stack.u+stack.w,5+stack.v,stack.z),iso(5+stack.u+stack.w,5+stack.v+stack.d,stack.z)]];
      sides.slice(j*2,j*2+2).forEach((side,n)=>side.points.slice(0,2).forEach((p,k)=>assert(Math.hypot(p.x-expected[n][k].x,p.y-expected[n][k].y)<1e-6)));
    });
  }
});
test('platform benches are painted over passing trains and below the station canopy',()=>{
  const town=blank(),route=[125,126,127,128];route.forEach((tile,j)=>town.tiles[tile]=j===0||j===3?'station':'rail');
  town.attachments=[{tile:125,kind:'station',parts:['bench']}];
  const {c,fills}=recordingContext();new TownScene().render(c,800,600,town,{...options,routes:[route]},0);
  const train=fills.findIndex(f=>f.color==='#f3e5bf'),bench=fills.findIndex(f=>f.color==='#d5b387'),roof=fills.findIndex(f=>f.color==='#75aca1');
  assert(train>=0&&bench>train&&roof>bench,'A train must not paint through a bench on the front platform');
});
test('every building stage keeps its visible roof selectable and inside the selection bounds',()=>{
  for(const kind of ['house','shop','factory'])for(const level of [1,2,3]){
    const town=blank(),tile=125;town.tiles[tile]=kind;town.levels[tile]=level;
    const scene=new TownScene();let point;
    if(kind==='factory'){const s=models.factoryLayout(level).stacks[0];point=iso(5+s.u+s.w/2,5+s.v+s.d/2,s.z+s.height);}
    else if(kind==='house'&&level===1)point=iso(5.5,5.6,26);
    else {const b=models.buildingVolumes(kind,level).at(-1);point=iso(5+b.u+b.w/2,5+b.v+b.d/2,b.z+b.height+(level>1?2:3));}
    for(const zoom of [.6,1.4,2.8]){scene.camera={x:195,y:50,zoom};const x=195+point.x*zoom,y=50+point.y*zoom;assert.equal(scene.pickTile(x,y,town),tile,kind+' '+level);const bounds=scene.tileBounds(tile,town);assert(x>=bounds.left&&x<=bounds.right&&y>=bounds.top&&y<=bounds.bottom);}
  }
});
test('all three stages have distinct names and a strictly growing skyline',()=>{
  for(const kind of ['house','shop','factory']){const heights=[1,2,3].map(l=>models.buildingHeight(kind,l));assert(heights[0]<heights[1]&&heights[1]<heights[2]);assert.equal(new Set(models.BUILDING_STAGES[kind]).size,3);}
});
const overlaps = (a,b) => a.u < b.u+b.w-1e-8 && a.u+a.w > b.u+1e-8 && a.v < b.v+b.d-1e-8 && a.v+a.d > b.v+1e-8;
test('all purchased fittings keep separate spaces within the lot and clear of building interiors',()=>{
  for(const kind of ['house','shop','factory'])for(const level of [1,2,3]){
    const parts=game.FACILITY_PARTS.filter(p=>p.kinds.includes(kind)).map(p=>p.id),fittings=models.facilityLayout(kind,level,parts),body=models.buildingVolumes(kind,level);
    for(const f of fittings){
      assert(f.u>=0&&f.v>=0&&f.u+f.w<=1&&f.v+f.d<=1,kind+' '+level+' '+f.part+' outside lot');
      if(f.mount==='ground')assert(body.every(b=>!overlaps(f,b)),kind+' '+level+' '+f.part+' intersects wall');
      else if(f.part!=='solar')assert(body.some(b=>Math.abs(f.z-(b.z+b.height+2+(kind==='shop'&&level===1?1:0)))<1e-8&&f.u>=b.u&&f.v>=b.v&&f.u+f.w<=b.u+b.w&&f.v+f.d<=b.v+b.d),kind+' '+level+' deck unsupported');
    }
    for(let i=0;i<fittings.length;i++)for(let j=i+1;j<fittings.length;j++){
      const a=fittings[i],b=fittings[j];if(a.z+a.height<=b.z||b.z+b.height<=a.z)continue;
      if(['terrace','canopy'].includes(a.part)&&['terrace','canopy'].includes(b.part))continue;
      assert(!overlaps(a,b),kind+' '+level+' fittings collide: '+a.part+' '+b.part);
    }
  }
});
test('roof decks and solar racks keep clear of fixed roof equipment and chimneys at all levels',()=>{
  for(const kind of ['house','shop'])for(const level of [1,2,3])for(const f of models.facilityLayout(kind,level,['terrace','canopy']).filter(f=>f.mount==='roof')){
    for(const b of models.roofFeatures(kind,level))assert(!overlaps(f,b),kind+' '+level+' deck covers roof unit');
  }
  for(const level of [1,2,3]){
    const layout=models.factoryLayout(level),panel=layout.solar;
    assert.equal(panel.z,layout.main.height,'Solar rack feet must meet the roof');
    assert(panel.u>=layout.main.u&&panel.v>=layout.main.v&&panel.u+panel.w<=layout.main.u+layout.main.w&&panel.v+panel.d<=layout.main.v+layout.main.d);
    for(const s of [...layout.stacks,...Array.from({length:3},(_,j)=>({...layout.vent,u:layout.vent.u+j*layout.vent.spacing}))])assert(!overlaps(panel,s),'Solar covers a vent or stack at Lv.'+level);
  }
});
test('high roof canopies and tilted solar panels select their owner and stay inside selection bounds',()=>{
  for(const kind of ['house','shop','factory'])for(const level of [1,2,3]){
    const town=blank(),tile=125;town.tiles[tile]=kind;town.levels[tile]=level;
    const parts=kind==='factory'?['solar','storage','greenbelt']:['terrace','canopy','garden','planter'];town.attachments=[{tile,kind,parts}];
    const f=models.facilityLayout(kind,level,parts).find(f=>f.part===(kind==='factory'?'solar':'canopy'));
    const p=iso(5+f.u+f.w/2,5+f.v+f.d/2,f.z+(kind==='factory'?2.9:10.7)),scene=new TownScene();
    for(const zoom of [.6,1.4,2.8]){scene.camera={x:195,y:50,zoom};const x=195+p.x*zoom,y=50+p.y*zoom;assert.equal(scene.pickTile(x,y,town),tile,kind+' '+level);const bounds=scene.tileBounds(tile,town);assert(x>=bounds.left&&x<=bounds.right&&y>=bounds.top&&y<=bounds.bottom);}
  }
});
test('a level crossing rings and lowers its barriers before every train, and no car is ever on the track with the train', () => {
  let town = { ...blank(), money: 1e7 };
  town = game.buildLine(town, 'rail', game.lineTiles(8 * 24 + 3, 8 * 24 + 11)).town;
  for (const x of [2, 12]) town = game.buildTile(town, 'station', x, 8).town;
  // A loop of streets that crosses the railway once, so plenty of cars come to the crossing.
  for (const [a, b] of [[[6, 3], [6, 13]], [[6, 3], [14, 3]], [[14, 3], [14, 13]], [[6, 13], [14, 13]]]) town = game.buildLine(town, 'road', game.lineTiles(a[1] * 24 + a[0], b[1] * 24 + b[0])).town;
  const tile = 8 * 24 + 6; assert.equal(town.tiles[tile], 'crossing');
  const routes = game.getTownStats(town.tiles, town.levels, town.parks, town.attachments).routes, { c } = recordingContext(), scene = new TownScene();
  let rang = 0, passes = 0, waited = 0, last = new Map();
  for (let frame = 0; frame < 2400; frame++) {
    scene.render(c, 800, 600, town, { ...options, routes, paused: false }, 1 / 20);
    const route = scene.trainRoutes[0], stop = scene.crossingStops.find(s => s.tile === tile), { center } = trainAt(route, 0, scene.time);
    const near = Math.abs(stop.distance - center), down = scene.barriers.get(tile) ?? 0, closed = scene.ringing.has(tile) || down > .02;
    if (scene.ringing.has(tile)) rang++;
    // The whole train (three cars, about one tile long) is on the crossing: the barriers are fully down.
    if (near < .6) { passes++; assert(down > .99, `barrier only ${down.toFixed(2)} down while the train is on the crossing`); }
    for (const v of scene.traffic.vehicles) {
      const before = last.get(v);
      const onCrossing = v.to === tile && v.t >= .6 || v.from === tile && v.t < .4;
      if (near < .7) assert(!onCrossing, 'a car is on the level crossing while the train passes');
      // A car only drives past the stop line onto the crossing while it is open.
      if (before && before.to === tile && v.to === tile && before.t < .6 && v.t >= .6) assert(!closed, 'a car drove onto the crossing while the barriers were down');
      if (closed && v.to === tile && v.t < .6 && v.t > .45) waited++;
      last.set(v, { to: v.to, t: v.t });
    }
  }
  assert(rang > 0 && passes > 0, 'the train never came over the crossing'); assert(waited > 0, 'no car ever waited at the crossing');
});
test('road parts never stand on top of each other, keep to the sidewalk and stay on their own tile, in every road shape', () => {
  const shapes = {
    straightX: [[[2, 10], [10, 10]]], straightY: [[[6, 6], [6, 14]]], end: [[[6, 10], [10, 10]]],
    corner: [[[2, 10], [6, 10]], [[6, 10], [6, 14]]], corner2: [[[6, 6], [6, 10]], [[6, 10], [10, 10]]],
    tee: [[[2, 10], [10, 10]], [[6, 10], [6, 14]]], teeUp: [[[2, 10], [10, 10]], [[6, 6], [6, 10]]], cross: [[[2, 10], [10, 10]], [[6, 6], [6, 14]]],
  };
  const all = game.FACILITY_PARTS.filter(p => p.kinds.includes('road')).map(p => p.id);
  let checked = 0;
  for (const [name, lines] of Object.entries(shapes)) {
    let base = { ...blank(), money: 1e7 };
    for (const [a, b] of lines) base = game.buildLine(base, 'road', game.lineTiles(b[1] * 24 + b[0], a[1] * 24 + a[0])).town;
    const tile = 10 * 24 + 6;
    // Every part on its own, then as many together as the road takes, in a few different orders.
    for (const order of [all, [...all].reverse(), [...all.slice(5), ...all.slice(0, 5)]]) {
      let town = base;
      for (const part of order) town = game.buyFacilityPart(town, tile, part).town;
      for (const defaultLamp of [false, true]) {
        const layout = roadParts.roadLayout(town, tile, defaultLamp), x = tile % 24, y = Math.floor(tile / 24);
        const standing = layout.items.filter(i => i.kind !== 'footbridge');
        for (const item of standing) {
          assert(item.x > x && item.x < x + 1 && item.y > y && item.y < y + 1, `${name}: ${item.kind} off its tile`);
          // On the sidewalk: within a quarter tile of an edge, never out on the carriageway.
          const u = item.x - x, v = item.y - y, edge = Math.min(u, 1 - u, v, 1 - v);
          if (item.kind !== 'busSign' && item.kind !== 'signal') assert(edge < .2, `${name}: ${item.kind} out in the road (${u.toFixed(2)}, ${v.toFixed(2)})`);
        }
        for (let a = 0; a < standing.length; a++) for (let b = a + 1; b < standing.length; b++) {
          const p = standing[a], q = standing[b], room = p.kind === 'busShelter' || q.kind === 'busShelter' ? .19 : p.kind === 'tree' || q.kind === 'tree' ? .1 : .055;
          assert(Math.hypot(p.x - q.x, p.y - q.y) >= room, `${name}: ${p.kind} and ${q.kind} on top of each other`);
          checked++;
        }
        for (const [p, q] of layout.rails) assert(Math.min(p.x, q.x) >= x - 1e-9 && Math.max(p.x, q.x) <= x + 1 + 1e-9 && Math.min(p.y, q.y) >= y - 1e-9 && Math.max(p.y, q.y) <= y + 1 + 1e-9, `${name}: guardrail off the tile`);
      }
    }
  }
  assert(checked > 200);
  // Painting them all, day and night, from every side.
  const { c } = recordingContext();
  for (const [name, lines] of Object.entries(shapes)) {
    let town = { ...blank(), money: 1e7 };
    for (const [a, b] of lines) town = game.buildLine(town, 'road', game.lineTiles(a[1] * 24 + a[0], b[1] * 24 + b[0])).town;
    for (const part of all) town = game.buyFacilityPart(town, 10 * 24 + 6, part).town;
    for (const night of [false, true]) new TownScene().render(c, 800, 600, town, { ...options, night, camera: undefined }, 0);
    assert.ok(name);
  }
});
console.log(`${passed} town renderer checks passed`);
