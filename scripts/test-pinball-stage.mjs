#!/usr/bin/env node
import assert from "node:assert/strict";

process.env.PINBALL_DEBUG_EXPORT = "1";
await import("./simulate-pinball.mjs");
const { ST, G, P } = globalThis.__pb;

const blank = ST.emptyStage();
assert.equal(blank.parts.length, 0, "new stages must start without preplaced parts");
assert.equal(blank.base, "blank");
assert.deepEqual(ST.parseStageSpec(JSON.parse(JSON.stringify(blank))), blank);
assert.deepEqual(ST.validateStage(blank, ST.ownedPinballParts({})), []);
assert.equal(ST.parseStageSpec({ ...blank, base: "unknown" }), null);

const table = ST.buildStageTable(blank);
assert.equal(table.walls.length, 2, "only the frame and launcher wall belong on a blank stage");
for (const key of ["circles", "bumpers", "slings", "ramps", "standups", "drops", "laneX", "shots", "spinners", "pinwheels"]) assert.equal(table[key].length, 0, key);
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

const world = P.createWorld(1, table);
const ball = P.addBall(world, 240, 464, 0, 100);
P.stepWorld(world, 1);
assert.equal(ball.mode, "field", "the removed hole must not still capture balls");
const ball2 = P.addBall(world, 124, 591, 0, -500);
P.stepWorld(world, 10);
assert.equal(ball2.mode, "field", "the removed ramp must not still capture balls");
console.log("Pinball stage regression checks passed");
