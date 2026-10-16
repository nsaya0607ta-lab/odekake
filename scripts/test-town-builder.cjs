const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/games/town-builder.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} }; new Function('exports', 'module', compiled)(mod.exports, mod);
const { createTown, decodeTown, indexAt, buildTile, buildLine, lineTiles, getTownStats, advanceTown, upgradeTile, railRoutes, buyParkLot, placeParkPart, removeParkPart, removeParkLot, expandParkLot, buyFacilityPart, removeFacilityPart, lotTiles, recordTownEdit, undoTownEdit, crossingAxis, opens, touchesRoad, roadShape, roadPartProblem, FACILITY_PARTS } = mod.exports;
const test = (name, fn) => { fn(); console.log(`PASS ${name}`); };
const build = (town, type, x, y) => buildTile(town, type, x, y).town;
const empty = () => createTown(false);
test('new map has river, blank mode has no prebuilt city', () => { const t = empty(); assert(t.tiles.includes('water')); assert(t.tiles.every(v => v === 'grass' || v === 'water')); });
test('road adjacency, overlap and insufficient funds are enforced', () => { let t = empty(); assert.equal(build(t, 'house', 5, 5), t); t = build(t, 'road', 5, 5); assert.notEqual(build(t, 'house', 5, 6), t); assert.equal(build(t, 'house', 5, 5), t); const poor = { ...t, money: 0 }; assert.equal(build(poor, 'shop', 5, 6), poor); });
test('a bridge charges the correct amount and restores river on removal', () => { let t = empty(); const i = t.tiles.findIndex(v => v === 'water'); const start = t.money; t = build(t, 'road', i % 24, Math.floor(i / 24)); assert.equal(start - t.money, 120); t = build(t, 'bulldoze', i % 24, Math.floor(i / 24)); assert.equal(t.tiles[i], 'water'); });
test('L-shaped roads have no diagonal gaps', () => { const path = lineTiles(indexAt(2, 2), indexAt(5, 5)); assert.equal(path.length, 7); for (let n = 1; n < path.length; n++) assert([1, 24].includes(Math.abs(path[n] - path[n - 1]))); });
test('a blocked or unaffordable stroke is atomic', () => { let t = empty(); t = build(t, 'road', 5, 5); t = build(t, 'house', 5, 6); const blocked = buildLine(t, 'road', lineTiles(indexAt(3, 6), indexAt(7, 6))); assert.equal(blocked.town, t); const poor = { ...empty(), money: 40 }; assert.equal(buildLine(poor, 'road', lineTiles(indexAt(2, 2), indexAt(5, 2))).town, poor); });
test('continuous strokes skip an existing road without charging twice', () => { let t = empty(); t = build(t, 'road', 3, 3); const result = buildLine(t, 'road', lineTiles(indexAt(2, 3), indexAt(5, 3))); assert.equal(t.money - result.town.money, 105); });
test('adjacent stations never count as a railway', () => { let t = empty(); t = build(t, 'station', 4, 4); t = build(t, 'station', 5, 4); assert.equal(railRoutes(t.tiles).length, 0); assert.equal(getTownStats(t.tiles, t.levels, t.parks, t.attachments).income, 0); });
test('only real connected rail paths operate; removal stops a route', () => { let t = empty(); t = build(t, 'station', 4, 4); t = build(t, 'station', 8, 4); t = buildLine(t, 'rail', lineTiles(indexAt(5, 4), indexAt(7, 4))).town; const routes = railRoutes(t.tiles); assert.equal(routes.length, 1); assert.equal(routes[0].length, 5); t = build(t, 'bulldoze', 6, 4); assert.equal(railRoutes(t.tiles).length, 0); });
test('stations without nearby accessible homes do not produce free money', () => { let t = empty(); t = build(t, 'station', 4, 4); t = build(t, 'station', 8, 4); t = buildLine(t, 'rail', lineTiles(indexAt(5, 4), indexAt(7, 4))).town; assert.equal(getTownStats(t.tiles, t.levels, t.parks, t.attachments).income, 0); t = build(t, 'road', 4, 5); t = build(t, 'house', 5, 5); assert(getTownStats(t.tiles, t.levels, t.parks, t.attachments).income > 23); });
test('upgrading increases population and is capped at level 3', () => { let t = empty(); t = build(t, 'road', 4, 4); t = build(t, 'house', 4, 5); const i = indexAt(4, 5); t = upgradeTile(t, i).town; assert.equal(getTownStats(t.tiles, t.levels, t.parks, t.attachments).population, 36); t = upgradeTile(t, i).town; assert.equal(getTownStats(t.tiles, t.levels, t.parks, t.attachments).population, 54); assert.equal(upgradeTile(t, i).town, t); });
test('parks and factories affect nearby residents, not the whole map', () => { let t = empty(); t = build(t, 'road', 5, 5); t = build(t, 'house', 5, 6); const base = getTownStats(t.tiles, t.levels, t.parks, t.attachments).happiness; t = buyParkLot(t, 6, 6, 'small').town; assert.equal(getTownStats(t.tiles, t.levels, t.parks, t.attachments).happiness, base); t = placeParkPart(t, indexAt(6,6), indexAt(6,6), 'tree').town; assert(getTownStats(t.tiles, t.levels, t.parks, t.attachments).happiness > base); });
test('pause stops simulation and accounting occurs only every sixth day', () => { const t = createTown(); assert.equal(advanceTown({ ...t, paused: true }).day, t.day); assert.equal(advanceTown(t).money, t.money); const d = { ...t, day: 5 }; assert.equal(advanceTown(d).money, t.money + getTownStats(t.tiles, t.levels, t.parks, t.attachments).income - getTownStats(t.tiles, t.levels, t.parks, t.attachments).upkeep); });
test('milestone rewards are paid once', () => { let t = createTown(); for (let x = 10; x < 13; x++) t = build(t, 'house', x, 9); assert(getTownStats(t.tiles, t.levels, t.parks, t.attachments).homes >= 5); const next = advanceTown(t); assert(next.rewards.includes('settle')); assert.equal(next.money - t.money, 1200); assert.equal(advanceTown(next).money, next.money); });
test('old v1 saves migrate without inserting a river or replacing buildings', () => { const tiles = Array(576).fill('grass'); tiles[10] = 'house'; const t = decodeTown(JSON.stringify({ tiles, money: 12345, day: 45, paused: true })); assert.deepEqual(t.tiles, tiles); assert(t.terrain.every(v => v === false)); assert.equal(t.levels[10], 1); assert.equal(t.money, 12345); });
test('save round trips and malformed data are rejected', () => { const t = createTown(); assert.deepEqual(decodeTown(JSON.stringify(t)), t); for (const raw of [null, 'null', '{', '{"tiles":[]}', JSON.stringify({ ...t, money: Infinity }), JSON.stringify({ ...t, tiles: Array(576).fill('bad') })]) assert.equal(decodeTown(raw), null); });
test('parks purchase their whole chosen footprint and contain no prebuilt paid equipment', () => {
  for (const [size, count, price] of [['small',4,580],['medium',9,1150],['large',12,1500]]) {
    const t = empty(), r = buyParkLot(t, 3, 3, size), lot = r.town.parks[0];
    assert.equal(lotTiles(lot).length,count); assert.equal(r.town.money,t.money-price); assert.equal(lot.parts.length,0); assert(lotTiles(lot).every(i=>r.town.tiles[i]==='park')); assert.equal(getTownStats(r.town.tiles,r.town.levels,r.town.parks).parks,0);
  }
  const rotated=buyParkLot(empty(),3,3,'large','plaza',true).town.parks[0];assert.equal(rotated.width,3);assert.equal(rotated.height,4);assert.equal(rotated.kind,'plaza');
});
test('blocked, riverside, out of bounds and unaffordable park purchases are atomic', () => {
  let t=build(empty(),'road',4,4);assert.equal(buyParkLot(t,3,3,'small').town,t);
  t=empty();assert.equal(buyParkLot(t,17,0,'medium').town,t);assert.equal(buyParkLot(t,23,23,'small').town,t);
  const poor={...t,money:579};assert.equal(buyParkLot(poor,3,3,'small').town,poor);
});
test('park parts charge only on placement; a path and furniture share a cell', () => {
  let t=buyParkLot(empty(),3,3,'small').town;const id=indexAt(3,3),price=t.money;
  t=placeParkPart(t,id,id,'path').town;t=placeParkPart(t,id,id,'bench',1).town;
  assert.equal(t.money,price-25-80);assert.equal(t.parks[0].parts.length,2);
  assert.equal(placeParkPart(t,id,id,'tree').town,t);assert.equal(placeParkPart(t,id,id,'path').town,t);assert.equal(placeParkPart(t,id,indexAt(2,3),'tree').town,t);
  assert.equal(placeParkPart({...t,money:0},id,id+1,'tree').town.money,0);
});
test('part removal preserves purchased land and removes the object before its path', () => {
  let t=buyParkLot(empty(),3,3,'small').town;const id=indexAt(3,3);t=placeParkPart(t,id,id,'path').town;t=placeParkPart(t,id,id,'bench').town;
  const money=t.money;t=buildTile(t,'bulldoze',3,3).town;assert.deepEqual(t.parks[0].parts.map(p=>p.kind),['path']);assert.equal(t.tiles[id],'park');assert.equal(t.money,money);
  t=removeParkPart(t,id,id).town;assert.equal(t.parks[0].parts.length,0);assert.equal(removeParkPart(t,id,id).town,t);
});
test('park expansion retains every purchased part and charges only the extra land', () => {
  let t=buyParkLot(empty(),3,3,'small').town;const id=indexAt(3,3);t=placeParkPart(t,id,id,'tree').town;const old=t;
  t=expandParkLot(t,id,'medium').town;assert.equal(t.parks[0].width,3);assert.deepEqual(t.parks[0].parts,old.parks[0].parts);assert.equal(t.money,old.money-(1150-580));assert.equal(expandParkLot(t,id,'small').town,t);
  const blocked=build(old,'road',5,3);assert.equal(expandParkLot(blocked,id,'medium').town,blocked);
});
test('a whole park counts once and only furnished parks improve nearby homes', () => {
  let t=build(empty(),'road',3,3);t=build(t,'house',3,4);const base=getTownStats(t.tiles,t.levels,t.parks).happiness;
  t=buyParkLot(t,4,4,'medium').town;const id=indexAt(4,4);assert.equal(getTownStats(t.tiles,t.levels,t.parks).happiness,base);
  t=placeParkPart(t,id,id,'fountain').town;const s=getTownStats(t.tiles,t.levels,t.parks);assert.equal(s.parks,1);assert(s.happiness>base);
  t=removeParkLot(t,id).town;assert.equal(getTownStats(t.tiles,t.levels,t.parks).parks,0);assert(lotTiles({x:4,y:4,width:3,height:3}).every(i=>t.tiles[i]==='grass'));
});
test('facility equipment enforces compatibility, available money and one purchase per part', () => {
  let t=createTown();const i=indexAt(7,9),money=t.money;t=buyFacilityPart(t,i,'terrace').town;assert.equal(t.money,money-220);assert.equal(getTownStats(t.tiles,t.levels,t.parks,t.attachments).population,getTownStats(t.tiles,t.levels,t.parks).population+6);
  assert.equal(buyFacilityPart(t,i,'terrace').town,t);assert.equal(buyFacilityPart(t,i,'solar').town,t);assert.equal(buyFacilityPart({...t,money:0},i,'garden').town.money,0);
  t=removeFacilityPart(t,i,'terrace').town;assert.equal(t.attachments.length,0);
});
test('factory landscaping and solar equipment have the stated operating effects', () => {
  let t=build(empty(),'road',5,5);t=build(t,'house',5,6);t=build(t,'factory',6,5);const i=indexAt(6,5),before=getTownStats(t.tiles,t.levels,t.parks,t.attachments);
  t=buyFacilityPart(t,i,'greenbelt').town;t=buyFacilityPart(t,i,'solar').town;const after=getTownStats(t.tiles,t.levels,t.parks,t.attachments);assert.equal(after.happiness,before.happiness+7);assert.equal(after.income,before.income+8);assert.equal(after.upkeep,before.upkeep-4);
});
test('demolishing a facility clears its equipment and undo restores it without reversing time', () => {
  let t=createTown();const i=indexAt(7,9);t=buyFacilityPart(t,i,'garden').town;const removed=buildTile(t,'bulldoze',7,9).town,edit=recordTownEdit(t,removed);
  assert.equal(removed.attachments.length,0);const restored=undoTownEdit({...removed,day:20,money:removed.money+77},edit);assert.equal(restored.day,20);assert.equal(restored.money,t.money+77);assert.deepEqual(restored.attachments,t.attachments);assert.equal(restored.tiles[i],'house');
});
test('park purchases, decorations, expansions and whole-lot removals all undo exactly', () => {
  const base=empty(),land=buyParkLot(base,3,3,'small').town,id=indexAt(3,3),tree=placeParkPart(land,id,id,'tree').town,large=expandParkLot(tree,id,'medium').town,removed=removeParkLot(large,id).town;
  for(const [a,b]of[[base,land],[land,tree],[tree,large],[large,removed]])assert.deepEqual(undoTownEdit(b,recordTownEdit(a,b)),a);
});
test('old single-cell parks migrate to editable plots without new charges or changed tiles', () => {
  const t=empty(),i=indexAt(3,3);t.tiles[i]='park';const {parks:_p,attachments:_a,...legacy}=t;const restored=decodeTown(JSON.stringify(legacy));assert.deepEqual(restored.tiles,t.tiles);assert.equal(restored.money,t.money);assert.equal(restored.parks[0].width,1);assert.equal(restored.parks[0].parts[0].kind,'fountain');assert.equal(expandParkLot(restored,i,'small').town.money,t.money-(580-140));
});
test('save decoding rejects overlapping plots, invalid parts and mismatched facility attachments', () => {
  let t=buyParkLot(empty(),3,3,'small').town;t=placeParkPart(t,indexAt(3,3),indexAt(3,3),'fountain').town;assert.deepEqual(decodeTown(JSON.stringify(t)),t);
  for(const bad of [{...t,parks:[...t.parks,...t.parks]},{...t,parks:[{...t.parks[0],parts:[{tile:0,kind:'tree',rotation:0}]}]},{...t,attachments:[{tile:0,kind:'house',parts:['garden']}]},{...t,parks:[{...t.parks[0],parts:[...t.parks[0].parts,...t.parks[0].parts]}]}])assert.equal(decodeTown(JSON.stringify(bad)),null);
});
test('undo retains the exact order of multiple plots and equipped facilities',()=>{
  let t=buyParkLot(createTown(),3,12,'small').town;t=buyParkLot(t,11,14,'small').town;t=buyFacilityPart(t,indexAt(7,9),'garden').town;t=buyFacilityPart(t,indexAt(10,12),'terrace').town;
  const removed=removeParkLot(t,indexAt(3,12)).town;assert.deepEqual(undoTownEdit(removed,recordTownEdit(t,removed)),t);
  const demolished=buildTile(t,'bulldoze',7,9).town;assert.deepEqual(undoTownEdit(demolished,recordTownEdit(t,demolished)),t);
});
test('every expanded park item purchases, rotates, survives saving and undoes at its exact price',()=>{
  for(const part of mod.exports.PARK_PARTS) for(let rotation=0;rotation<4;rotation++){
    const base=buyParkLot(createTown(false),4,12,'small').town,id=indexAt(4,12);
    const next=placeParkPart(base,id,id,part.id,rotation).town;
    assert.equal(next.money,base.money-part.price);assert.equal(next.parks[0].parts[0].rotation,rotation);
    assert.deepEqual(decodeTown(JSON.stringify(next)),next);
    assert.deepEqual(undoTownEdit(next,recordTownEdit(base,next)),base);
    assert.equal(placeParkPart(next,id,id,part.id).town,next);
    assert.equal(placeParkPart({...base,money:part.price-1},id,id,part.id).town.money,part.price-1);
  }
});
test('stepping stones share ground with furniture; removal removes furniture before the stones',()=>{
  let town=buyParkLot(createTown(false),4,12,'small').town,id=indexAt(4,12);
  town=placeParkPart(town,id,id,'stones').town;town=placeParkPart(town,id,id,'picnic').town;
  assert.equal(town.parks[0].parts.length,2);assert.equal(placeParkPart(town,id,id,'path').town,town);
  const next=removeParkPart(town,id,id).town;assert.deepEqual(next.parks[0].parts.map(p=>p.kind),['stones']);
  assert.equal(getTownStats(next.tiles,next.levels,next.parks).parks,0);
});
test('new facility equipment enforces compatibility and retains the existing city through saves and undo',()=>{
  for(const part of mod.exports.FACILITY_PARTS.filter(p=>['vending','canopy','planter'].includes(p.id))){
    const base=createTown(),tile=indexAt(part.id==='vending'?10:7,part.id==='vending'?12:9);
    const next=buyFacilityPart(base,tile,part.id).town;assert.equal(next.money,base.money-part.price);
    assert.deepEqual(decodeTown(JSON.stringify(next)),next);assert.equal(buyFacilityPart(next,tile,part.id).town,next);
    assert.deepEqual(undoTownEdit(next,recordTownEdit(base,next)),base);
    assert.equal(buyFacilityPart(base,indexAt(0,0),part.id).town,base);
    // Since the road parts (2026-10-16) a vending machine can also stand on a sidewalk; the others cannot.
    assert.equal(buyFacilityPart(base,indexAt(9,10),part.id).town===base,part.id!=='vending');
  }
});

test('a road dragged across a straight railway (or a railway across a road) makes a level crossing that both use', () => {
  let t = empty(); t = build(t, 'station', 2, 4); t = build(t, 'station', 10, 4); t = buildLine(t, 'rail', lineTiles(indexAt(3, 4), indexAt(9, 4))).town;
  const before = t.money, crossed = buildLine(t, 'road', lineTiles(indexAt(6, 1), indexAt(6, 7)));
  t = crossed.town; const i = indexAt(6, 4);
  assert.equal(t.tiles[i], 'crossing'); assert.equal(before - t.money, 6 * 35 + 90); assert.equal(crossingAxis(t.tiles, i), 'x');
  const routes = railRoutes(t.tiles); assert.equal(routes.length, 1); assert(routes[0].includes(i));
  assert(opens(t.tiles, i, i - 1, 'rail') && opens(t.tiles, i, i + 1, 'rail') && !opens(t.tiles, i, i - 24, 'rail'));
  assert(opens(t.tiles, i, i - 24, 'road') && opens(t.tiles, i, i + 24, 'road') && !opens(t.tiles, i, i + 1, 'road'));
  assert(touchesRoad(t.tiles, 7, 4) && getTownStats(t.tiles, t.levels, t.parks, t.attachments).upkeep > getTownStats(t.tiles.map((v, n) => n === i ? 'rail' : v), t.levels, t.parks, t.attachments).upkeep);
  // The other way round: a railway laid across a straight road.
  let u = empty(); u = buildLine(u, 'road', lineTiles(indexAt(2, 12), indexAt(9, 12))).town; u = build(u, 'station', 5, 9); u = build(u, 'station', 5, 15);
  const railed = buildLine(u, 'rail', lineTiles(indexAt(5, 10), indexAt(5, 14))).town, j = indexAt(5, 12);
  assert.equal(railed.tiles[j], 'crossing'); assert.equal(crossingAxis(railed.tiles, j), 'y'); assert.equal(u.money - railed.money, 4 * 55 + 90); assert.equal(railRoutes(railed.tiles).length, 1);
  assert.deepEqual(decodeTown(JSON.stringify(railed)).tiles, railed.tiles);
});
test('level crossings are refused along the line, on bends and junctions, on bridges, and leave the stroke unbuilt', () => {
  let t = empty(); t = buildLine(t, 'rail', lineTiles(indexAt(3, 4), indexAt(9, 4))).town;
  // Along the track, onto its end, or with too little money: nothing at all is built.
  assert.equal(buildLine(t, 'road', lineTiles(indexAt(2, 4), indexAt(10, 4))).town, t);
  assert.equal(buildTile(t, 'road', 6, 4, 'x').town, t); assert.equal(buildTile(t, 'road', 3, 4).town, t);
  const poor = { ...t, money: 89 }; assert.equal(buildTile(poor, 'road', 6, 4, 'y').town, poor);
  // A road may stop on the track and carry on from the other side later.
  const half = buildLine(t, 'road', lineTiles(indexAt(6, 2), indexAt(6, 4))).town; assert.equal(half.tiles[indexAt(6, 4)], 'crossing');
  assert.equal(buildLine(half, 'road', lineTiles(indexAt(6, 7), indexAt(6, 5))).town.tiles[indexAt(6, 5)], 'road');
  // Where the railway branches there is no crossing.
  const branch = buildLine(t, 'rail', lineTiles(indexAt(6, 5), indexAt(6, 7))).town;
  assert.equal(buildLine(branch, 'road', lineTiles(indexAt(6, 2), indexAt(6, 4))).town, branch); assert.equal(buildTile(branch, 'road', 6, 4, 'y').town, branch);
  // A stroke that turns on the track is refused rather than laid along it.
  let v = empty(); v = buildLine(v, 'rail', lineTiles(indexAt(12, 3), indexAt(12, 9))).town;
  assert.equal(buildLine(v, 'road', lineTiles(indexAt(10, 6), indexAt(12, 8))).town, v);
  // Nor on a bridge.
  const river = empty(), bridge = river.tiles.findIndex((x, n) => x === 'water' && river.terrain[n - 1] && river.terrain[n + 1]);
  const span = buildLine(river, 'rail', lineTiles(bridge - 1, bridge + 1)).town; assert.equal(span.tiles[bridge], 'rail'); assert.equal(buildTile(span, 'road', bridge % 24, Math.floor(bridge / 24), 'y').town, span);
});
test('a crossing joins each line only its own way, so cars never drive along the track nor trains along the road', () => {
  // Two neighbouring streets across one railway: crossings side by side along the track.
  let t = empty(); t = build(t, 'station', 2, 8); t = build(t, 'station', 12, 8); t = buildLine(t, 'rail', lineTiles(indexAt(3, 8), indexAt(11, 8))).town;
  t = buildLine(t, 'road', lineTiles(indexAt(6, 5), indexAt(6, 11))).town; t = buildLine(t, 'road', lineTiles(indexAt(7, 5), indexAt(7, 6))).town;
  const a = indexAt(6, 8), b = indexAt(7, 8);
  t = buildLine(t, 'road', lineTiles(indexAt(7, 7), indexAt(7, 11))).town;
  assert.equal(t.tiles[a], 'crossing'); assert.equal(t.tiles[b], 'crossing');
  assert(!opens(t.tiles, a, b, 'road') && opens(t.tiles, a, b, 'rail'));
  assert.equal(railRoutes(t.tiles)[0].filter(n => n === a || n === b).length, 2);
  // Removing the track beside a crossing keeps its way: the next road laid there does not join it.
  const cut = build(t, 'bulldoze', 5, 8), road = build(cut, 'road', 5, 8);
  assert.equal(crossingAxis(road.tiles, a), 'x'); assert(!opens(road.tiles, a, indexAt(5, 8), 'road'));
});
test('demolishing a level crossing clears the tile and undo brings the crossing back', () => {
  let t = empty(); t = buildLine(t, 'rail', lineTiles(indexAt(3, 4), indexAt(9, 4))).town; t = buildLine(t, 'road', lineTiles(indexAt(6, 1), indexAt(6, 7))).town;
  const i = indexAt(6, 4), removed = build(t, 'bulldoze', 6, 4), edit = recordTownEdit(t, removed);
  assert.equal(removed.tiles[i], 'grass'); assert.equal(railRoutes(removed.tiles).length, 0);
  const restored = undoTownEdit(removed, edit); assert.equal(restored.tiles[i], 'crossing'); assert.deepEqual(restored.tiles, t.tiles);
  const built = buildLine(empty(), 'rail', lineTiles(indexAt(3, 4), indexAt(9, 4))).town, crossing = buildLine(built, 'road', lineTiles(indexAt(6, 1), indexAt(6, 7))).town;
  assert.deepEqual(undoTownEdit(crossing, recordTownEdit(built, crossing)).tiles, built.tiles);
});
test('road parts go where they make sense: crossings and bus stops on straight roads, stop signs at junctions, mirrors at bends', () => {
  let t = empty();
  t = buildLine(t, 'road', lineTiles(indexAt(2, 10), indexAt(10, 10))).town; t = buildLine(t, 'road', lineTiles(indexAt(6, 10), indexAt(6, 14))).town; t = buildLine(t, 'road', lineTiles(indexAt(10, 10), indexAt(10, 6))).town;
  const straight = indexAt(4, 10), tee = indexAt(6, 10), bend = indexAt(10, 10), end = indexAt(2, 10);
  assert.deepEqual([straight, tee, bend, end].map(i => roadShape(t.tiles, i).shape), ['straight', 'tee', 'corner', 'end']);
  const fits = (tile, part) => buyFacilityPart(t, tile, part).town !== t;
  for (const part of ['crosswalk', 'busStop', 'footbridge']) { assert(fits(straight, part), part); assert(!fits(tee, part) && !fits(bend, part), part); }
  assert(fits(tee, 'stopSign') && !fits(straight, 'stopSign') && !fits(bend, 'stopSign'));
  assert(fits(bend, 'mirror') && fits(tee, 'mirror') && !fits(straight, 'mirror'));
  assert(fits(tee, 'signal') && fits(straight, 'signal') && !fits(bend, 'signal'));
  assert(fits(straight, 'roadTrees') && fits(bend, 'roadTrees') && !fits(tee, 'roadTrees'));
  for (const part of ['pole', 'guardrail', 'postbox', 'vending', 'paving', 'light']) for (const tile of [straight, tee, bend, end]) assert(fits(tile, part), `${part} anywhere`);
  // Parts that cannot share one stretch of pavement, both ways round.
  const bus = buyFacilityPart(t, straight, 'busStop').town;
  for (const part of ['crosswalk', 'footbridge', 'signal']) { const r = buyFacilityPart(bus, straight, part); assert.equal(r.town, bus); assert.match(r.message, /バス停/); }
  const lights = buyFacilityPart(t, tee, 'signal').town; assert.equal(buyFacilityPart(lights, tee, 'stopSign').town, lights);
  assert.equal(roadPartProblem(t, indexAt(0, 0), 'busStop'), null, 'Only road tiles have shapes');
  // On a bridge only the lamps and the paving.
  let river = empty(); const w = river.tiles.findIndex((x, n) => x === 'water' && river.terrain[n - 1] && river.terrain[n + 1]);
  river = buildLine(river, 'road', lineTiles(w - 2, w + 2)).town;
  for (const part of FACILITY_PARTS.filter(p => p.kinds.includes('road'))) assert.equal(buyFacilityPart(river, w, part.id).town !== river, part.id === 'light' || part.id === 'paving', part.id);
  // Every road part survives a save and undoes at its exact price.
  for (const part of FACILITY_PARTS.filter(p => p.kinds.includes('road'))) {
    const tile = part.id === 'stopSign' || part.id === 'signal' ? tee : part.id === 'mirror' ? bend : straight, next = buyFacilityPart(t, tile, part.id).town;
    assert.equal(t.money - next.money, part.price); assert.deepEqual(decodeTown(JSON.stringify(next)), next); assert.deepEqual(undoTownEdit(next, recordTownEdit(t, next)), t);
  }
});
console.log('36 town simulation checks passed');
