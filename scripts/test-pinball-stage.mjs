#!/usr/bin/env node
import assert from "node:assert/strict";

process.env.PINBALL_DEBUG_EXPORT = "1";
await import("./simulate-pinball.mjs");
const { ST, G, P, S } = globalThis.__pb;

const blank = ST.emptyStage();
assert.equal(blank.parts.length, 0, "new stages must start without preplaced parts");
assert.equal(blank.base, "blank");
assert.deepEqual(ST.parseStageSpec(JSON.parse(JSON.stringify(blank))), blank);
assert.deepEqual(ST.validateStage(blank, ST.ownedPinballParts({})), []);
assert.equal(ST.parseStageSpec({ ...blank, base: "unknown" }), null);

const table = ST.buildStageTable(blank);
assert.equal(table.walls.length, 2, "only the frame and launcher wall belong on a blank stage");
for (const key of ["circles", "bumpers", "slings", "ramps", "standups", "drops", "outlaneGates", "laneX", "shots", "spinners", "pinwheels"]) assert.equal(table[key].length, 0, key);
assert.equal(table.scoop.r, 0, "no invisible scoop may capture a ball");
assert.equal(table.flippers.length, 2);
assert.deepEqual(table.sensors.map((s) => s.id), ["shooterExit"]);
assert.equal(G.createGame({ table, pool: [], tableName: "blank", seed: 1 }).skillLane, -1);

const lower = { ...blank, parts: [{ kind: "bumper", x: 240, y: 650, size: "m" }] };
assert.deepEqual(ST.validateStage(lower, ST.ownedPinballParts({})), [], "lower playfield must be editable");
assert.equal(ST.buildStageTable(lower).bumpers[0].y, 650);
assert.ok(ST.validateStage({ ...lower, base: undefined }).length, "legacy placement bounds must stay unchanged");
assert.ok(ST.partProblem({ ...blank, parts: [{ kind: "bumper", x: 240, y: 810, size: "m" }] }, 0), "protect the flipper sweep");
assert.ok(ST.partProblem({ ...blank, parts: [{ kind: "bumper", x: 30, y: 80, size: "m" }] }, 0), "protect curved table boundaries");
assert.ok(ST.validateStage({ ...blank, parts: [{ kind: "drop", x: 240, y: 650, angle: 0 }] }, ST.ownedPinballParts({})).length, "inventory must still be enforced");
assert.ok(ST.placeableSpots(blank, (at) => ({ kind: "bumper", ...at, size: "m" }), null).some((pt) => pt.y > 500));

for (const ramp of ["top", "cross"]) {
  const spec = { ...blank, ramp };
  assert.deepEqual(ST.validateStage(spec), []);
  const built = ST.buildStageTable(spec);
  assert.equal(built.ramps.length, 2);
  assert.equal(built.scoop.r, 0);
  assert.equal(built.slings.length, 0);
  assert.equal(built.circles.length, 0);
}

const legacy = ST.starterStage();
assert.deepEqual(ST.validateStage(legacy, ST.ownedPinballParts({})), []);
assert.equal(ST.buildStageTable(legacy).ramps.length, 2);
assert.equal(ST.buildStageTable(legacy).scoop.r, 14);
assert.equal(ST.parseStageSpec(legacy).base, undefined);
assert.equal(ST.sameStageLayout(blank, { ...blank, look: "coaster" }), true);
assert.equal(ST.sameStageLayout(blank, lower), false);

function collectAtFirstSpot(game, item) {
  const spot = game.world.table.itemSpots[0];
  game.lit = [{ item, spot: 0, litAt: game.clock, encore: false, until: Infinity }];
  game.world.balls = [];
  const ball = P.addBall(game.world, spot.x, spot.y, 0, 0);
  game.inPlay.add(ball.id);
  game.phase = "play";
  game.started = true;
  game.simAcc = 0;
  G.stepGame(game, 0.002);
}

const skillIds = ["mie_meoto_iwa", "shizuoka_miho_no_matsubara", "nagano_onbashira", "gifu_gujo_hachiman", "gifu_ayu", "mie_pearl", "gifu_seki_hamono"];
for (const id of skillIds) for (const level of [1, 3, 5]) {
  const skill = S.getPinballSkill(id, id, "SR", level);
  const item = { id, name: id, rarity: "SR", level, stars: 0, skill, image: null };
  const original = JSON.stringify(item);
  const game = G.createGame({ table, pool: [item], tableName: "blank", seed: 1 });
  const adapted = game.pool[0].skill;
  assert.ok(adapted.effects.length > 0, `${id} must still do something on a blank table`);
  assert.ok(adapted.effects.every((effect) => !["kickback", "gate", "magnet", "bumperMult", "combo", "jackpot", "drops"].includes(effect.type)));
  assert.ok(!/キックバック|ふさぐ|マグネット|バンパー|コンボ受付|次のランプ|全倒し/.test(adapted.text), `${id} Lv${level}: ${adapted.text}`);
  collectAtFirstSpot(game, game.pool[0]);
  assert.equal(game.stats.items, 1);
  for (const effect of adapted.effects) {
    if (effect.type === "save") assert.ok(game.saveUntil >= game.clock + effect.sec - 0.004);
    if (effect.type === "mult") assert.ok(game.mults.some((mult) => mult.factor === effect.factor));
    if (effect.type === "points") assert.ok(game.score >= effect.value);
  }
  assert.equal(JSON.stringify(item), original, "stage-specific skills must not mutate the inventory");
  const old = G.createGame({ table: ST.buildStageTable(legacy), pool: [item], tableName: "legacy", seed: 1 });
  assert.equal(old.pool[0], item, "legacy items and skills must stay unchanged");
}
const rampTable = ST.buildStageTable({ ...blank, ramp: "top" });
const jackpot = S.getPinballSkill("mie_pearl", "真珠", "SR", 1);
const rampGame = G.createGame({ table: rampTable, pool: [{ id: "pearl", name: "真珠", rarity: "SR", level: 1, stars: 0, skill: jackpot, image: null }], tableName: "ramps", seed: 1 });
assert.equal(rampGame.pool[0].skill, jackpot, "ramp-specific skills remain available when ramps exist");
for (let i = 0; i < 8; i += 1) collectAtFirstSpot(rampGame, G.capsuleItem(i));
assert.equal(rampGame.conquests, 1);
assert.deepEqual(rampGame.jackpots, { leftOrbit: false, leftRamp: true, scoop: false, rightRamp: true, rightOrbit: false });
for (const side of ["left", "right", "left"]) {
  const ball = rampGame.world.balls[0];
  ball.mode = "ramp";
  ball.ramp = side;
  ball.s = 100000;
  ball.sv = 500;
  G.stepGame(rampGame, 0.004);
  if (side === "right") assert.equal(rampGame.superLit, true, "both available ramps must unlock the super jackpot");
}
assert.equal(rampGame.stats.jackpots, 3, "the super jackpot must be obtainable without a scoop");
assert.equal(rampGame.superLit, false);

const world = P.createWorld(1, table);
const ball = P.addBall(world, 240, 464, 0, 100);
P.stepWorld(world, 1);
assert.equal(ball.mode, "field", "the removed hole must not still capture balls");
const ball2 = P.addBall(world, 124, 591, 0, -500);
P.stepWorld(world, 10);
assert.equal(ball2.mode, "field", "the removed ramp must not still capture balls");
console.log("Pinball stage regression checks passed");
