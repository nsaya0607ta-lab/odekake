const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleRecord = { exports: {} };
new Function('require', 'exports', 'module', ts.transpileModule(fs.readFileSync('src/lib/games/town-canvas.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(() => ({}), moduleRecord.exports, moduleRecord);
const { TownCanvas } = moduleRecord.exports;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function surface() {
  let width = 300, height = 150;
  const target = { frame: null, resets: 0 };
  Object.defineProperties(target, {
    width: { get: () => width, set: value => { target.beforeReset?.(); width = value; target.frame = null; target.resets++; } },
    height: { get: () => height, set: value => { target.beforeReset?.(); height = value; target.frame = null; target.resets++; } },
  });
  const context = { setTransform() {}, drawImage(buffer) { assert(buffer.frame, 'Only complete frames may be presented'); target.frame = buffer.frame; } };
  target.getContext = () => context;
  return { target, context };
}
function fixture() {
  const display = surface(), buffer = surface();
  display.target.ownerDocument = { createElement: () => buffer.target };
  let failure = false, renders = 0;
  const scene = { camera: { x: 0, y: 0, zoom: 1 }, render(context, width, height, town, options, dt) {
    assert.notEqual(context, display.context, 'Do not paint partial scenes into the display');
    if (failure) throw new Error('Interrupted rendering');
    renders++;
    buffer.target.frame = { width, height, town, options, dt, renders };
  } };
  display.target.beforeReset = () => assert(buffer.target.frame, 'A viewport resize must prepare a frame before clearing the display');
  return { display: display.target, buffer: buffer.target, scene, viewport: new TownCanvas(display.target, scene), fail: () => { failure = true; } };
}
const town = { paused: true }, options = { paused: true, night: false };
test('a paused city is painted synchronously during the first viewport resize', () => {
  const { viewport, display } = fixture(); viewport.resize(390, 844, 2, town, options);
  assert.equal(display.width, 780); assert.equal(display.height, 1688);
  assert.deepEqual(display.frame, { width: 390, height: 844, town, options, dt: 0, renders: 1 });
});
test('browser chrome and orientation changes immediately present a complete city', () => {
  const { viewport, display, scene } = fixture(); viewport.resize(390, 844, 2, town, options);
  const camera = { ...scene.camera };
  viewport.resize(390, 770, 2, town, options); assert.equal(display.frame.height, 770);
  assert.equal(scene.camera.y, camera.y - 37);
  viewport.resize(844, 390, 2, town, options); assert.equal(display.frame.width, 844); assert.equal(display.frame.height, 390);
  assert.equal(scene.camera.zoom, camera.zoom);
});
test('panning never resets the visible bitmap or changes the simulation time', () => {
  const { viewport, display, scene } = fixture(); viewport.resize(390, 844, 2, town, options);
  const resets = display.resets;
  for (let i = 0; i < 30; i++) { scene.camera.x += 5; viewport.draw(town, options, 0); assert(display.frame); }
  assert.equal(display.resets, resets); assert.equal(display.frame.dt, 0);
});
test('duplicate viewport observations do not clear or repaint a paused city', () => {
  const { viewport, display } = fixture(); viewport.resize(390, 844, 2, town, options);
  const frame = display.frame, resets = display.resets;
  viewport.resize(390, 844, 2, town, options); viewport.resize(0, 0, 2, town, options);
  assert.equal(display.frame, frame); assert.equal(display.resets, resets);
});
test('a device pixel ratio change preserves the city and caps mobile memory use', () => {
  const { viewport, display } = fixture(); viewport.resize(390, 844, 1, town, options);
  viewport.resize(390, 844, 3, town, options);
  assert.equal(display.width, 780); assert.equal(display.height, 1688); assert(display.frame);
});
test('an interrupted new frame preserves the last complete visible frame', () => {
  const { viewport, display, fail } = fixture(); viewport.resize(390, 844, 2, town, options);
  const frame = display.frame, resets = display.resets; fail();
  assert.throws(() => viewport.resize(844, 390, 2, town, options), /Interrupted/);
  assert.equal(display.frame, frame); assert.equal(display.resets, resets);
});
console.log(`${passed} town canvas checks passed`);
