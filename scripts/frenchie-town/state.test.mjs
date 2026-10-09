import test from 'node:test';
import assert from 'node:assert/strict';
import { initialTown, townReducer as reduce, parseTown, encodeTown, decodeTown, walkingPath, availableIncome, storageKey } from '../../src/lib/games/frenchie-town/state.ts';

const now = 1_000_000;
const build = (state, extra = {}) => reduce(state, { type: 'build', kind: 'bakery', id: 'bakery-one', x: 3, z: 3, rotation: 0, now, ...extra });
test('purchase commits once and invalid placement never spends coins', () => {
  const s = initialTown(now), bought = build(s);
  assert.equal(bought.coins, 620);
  assert.equal(bought.buildings.length, 4);
  assert.equal(build(bought), bought);
  assert.equal(build(s, { x: 4 }), s);
  assert.equal(build(s, { x: 2, z: 2 }), s);
  assert.equal(build({ ...s, coins: 179 }).coins, 179);
  assert.equal(reduce(bought, { type: 'move', id: 'bakery-one', x: 0, z: 0, rotation: 2, now }).coins, 620);
});
test('missions and dog rewards survive reload without double payment', () => {
  let s = build(initialTown(now));
  s = reduce(s, { type: 'claim', id: 'bakery', now });
  assert.equal(s.coins, 770);
  const loaded = parseTown(JSON.parse(JSON.stringify(s)), now + 5);
  assert.equal(reduce(loaded, { type: 'claim', id: 'bakery', now: now + 5 }), loaded);
  const pet = reduce(loaded, { type: 'pet', id: 'dog-0', now });
  assert.equal(pet.coins, 780);
  assert.equal(reduce(pet, { type: 'pet', id: 'dog-0', now: now + 59999 }), pet);
  assert.equal(reduce(pet, { type: 'pet', id: 'dog-0', now: now + 60000 }).coins, 790);
  assert.equal(reduce(pet, { type: 'pet', id: 'dog-7', now }), pet);
});
test('income is capped and upgrading pays past income at the old level', () => {
  const s = build(initialTown(now)), b = s.buildings.at(-1);
  assert.equal(availableIncome(b, now - 1), 0);
  assert.equal(availableIncome(b, now + 59999), 0);
  assert.equal(availableIncome(b, now + 60000), 12);
  assert.equal(availableIncome(b, now + 86400000), 60);
  const upgraded = reduce(s, { type: 'upgrade', id: b.id, now: now + 120000 });
  assert.equal(upgraded.coins, 620 - 108 + 24);
  assert.equal(availableIncome(upgraded.buildings.at(-1), now + 180000), 24);
  const collected = reduce(upgraded, { type: 'harvest', now: now + 180000 });
  assert.equal(reduce(collected, { type: 'harvest', now: now + 180000 }), collected);
  const sold = reduce(s, { type: 'sell', id: b.id, now });
  assert.equal(sold.coins, 746);
  assert.equal(reduce(sold, { type: 'sell', id: b.id, now }), sold);
});
test('malformed saves and overlapping/outside/unknown buildings are rejected', () => {
  const s = initialTown(now);
  for (const mutation of [{ coins: -1 }, { coins: NaN }, { v: 2 }, { claimed: ['unknown'] }, { buildings: [...s.buildings, s.buildings[0]] }, { buildings: [{ ...s.buildings[0], x: 9 }] }, { buildings: [{ ...s.buildings[0], z: 4 }] }, { buildings: [{ ...s.buildings[0], kind: '__proto__' }] }, { buildings: [{ ...s.buildings[0], level: 4 }] }]) assert.equal(parseTown({ ...s, ...mutation }, now), null);
  assert.notEqual(storageKey('alice'), storageKey('bob'));
  assert.equal(parseTown({ ...s, updatedAt: now + 999999 }, now).updatedAt, now);
});
test('share snapshots preserve Japanese names without currency or private progress', () => {
  const s = { ...initialTown(now), name: 'ふれぶるの島 🐾' };
  const encoded = encodeTown(s), decoded = decodeTown(encoded, now);
  assert.equal(decoded.name, s.name);
  assert.equal(decoded.buildings.length, s.buildings.length);
  const raw = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  assert.deepEqual(Object.keys(raw).sort(), ['buildings', 'name', 'v']);
  assert.equal(decodeTown('x'.repeat(14001)), null);
  assert.equal(decodeTown('broken!'), null);
});
test('walking paths stay adjacent, in bounds, and avoid occupied tiles', () => {
  const buildings = initialTown(now).buildings, blocked = new Set(buildings.map(b => `${b.x}:${b.z}`));
  for (let x = 0; x < 9; x++) for (let z = 0; z < 9; z++) {
    const path = walkingPath(buildings, { x: 4, z: 4 }, { x, z });
    let previous = { x: 4, z: 4 };
    for (const cell of path) {
      assert.equal(Math.abs(cell.x - previous.x) + Math.abs(cell.z - previous.z), 1);
      assert.ok(cell.x >= 0 && cell.x < 9 && cell.z >= 0 && cell.z < 9);
      assert.ok(!blocked.has(`${cell.x}:${cell.z}`)); previous = cell;
    }
    if (!blocked.has(`${x}:${z}`)) assert.deepEqual(previous, { x, z });
  }
});
