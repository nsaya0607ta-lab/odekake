// Node 24+: node --test scripts/test-osanpo-tricks.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { trickPose, TRICK_WARNING, TRICK_KINDS, newTrickRun, newTrickStats, recordTrickClear } from '../src/lib/games/osanpo-run/tricks.ts';

const plain = { over: false, under: false, ducked: false };
test('箱とドローンは予告が終わるまで高さを変えない', () => {
  for (const kind of ['surprise', 'drone']) {
    const idle = trickPose(kind, 240, 0, -1);
    for (const t of [0, .1, .4, TRICK_WARNING - .001]) {
      const p = trickPose(kind, 240, t, t);
      assert.equal(p.y, idle.y); assert.equal(p.h, idle.h); assert.ok(p.warning > 0);
    }
    const ready = trickPose(kind, 240, 0, TRICK_WARNING);
    assert.equal(ready.warning, 0); assert.equal(ready.y, idle.y); assert.equal(ready.h, idle.h);
  }
});
test('箱が伸びる高さとドローンが降りる高さは連続かつ範囲内', () => {
  let lastH = 26, lastY = 158;
  for (let i = 0; i <= 300; i++) {
    const t = i / 200;
    const box = trickPose('surprise', 240, t, t), drone = trickPose('drone', 240, t, t);
    assert.ok(box.h >= lastH && box.h <= 26 + 40); assert.ok(box.h - lastH < 5);
    assert.ok(drone.y >= lastY && drone.y <= 208); assert.ok(drone.y - lastY < 2);
    assert.equal(drone.h, 30); lastH = box.h; lastY = drone.y;
  }
  assert.equal(lastH, 26 + 40); assert.equal(lastY, 208);
  assert.equal(trickPose('surprise', 240, 2.1, 2.1).h, 26);
  assert.ok(trickPose('surprise', 240, 1.85, 1.85).h < 26 + 40);
});
test('スーツケースは接地と高さ88のバウンドを繰り返し、画面サイズに追従する', () => {
  for (let t = 0; t < 10; t += 1 / 60) {
    const a = trickPose('suitcase', 240, t, -1), b = trickPose('suitcase', 600, t, -1);
    assert.ok(a.y >= 152 && a.y <= 240); assert.equal(a.h, 34); assert.ok(Math.abs(b.y - a.y - 360) < 1e-9);
  }
  assert.equal(trickPose('suitcase', 240, .45, -1).y, 152);
  assert.equal(trickPose('suitcase', 240, 1.2, -1).y, 240);
});
test('称号は避け方ごとの回数で開く', () => {
  const s = newTrickStats(), r = newTrickRun();
  for (let i = 1; i <= 5; i++) {
    const ids = recordTrickClear(s, r, 'suitcase', { ...plain, over: true }, 'town');
    assert.equal(ids.includes('suitcaseJumps5'), i >= 5);
  }
  assert.ok(recordTrickClear(s, r, 'suitcase', { ...plain, under: true }, 'town').includes('suitcaseUnder'));
  assert.equal(s.suitcaseJumps, 5);
  for (let i = 1; i <= 5; i++) assert.equal(recordTrickClear(s, r, 'surprise', { ...plain, over: true }, 'town').includes('openBoxes5'), i >= 5);
  for (let i = 1; i <= 10; i++) assert.equal(recordTrickClear(s, r, 'drone', { ...plain, ducked: true }, 'town').includes('droneSlides10'), i >= 10);
});
test('通常回避を跳び越えやスライディングに水増ししない', () => {
  const s = newTrickStats(), r = newTrickRun();
  for (let i = 0; i < 20; i++) for (const kind of TRICK_KINDS) recordTrickClear(s, r, kind, plain, 'town');
  assert.equal(s.openBoxes, 0); assert.equal(s.droneSlides, 0); assert.equal(s.suitcaseJumps, 0); assert.equal(s.suitcaseUnder, 0);
});
test('3種コンプリートは1回のおさんぽで。再挑戦で種類と連続数をリセット', () => {
  const s = newTrickStats();
  for (const kind of TRICK_KINDS) assert.ok(!recordTrickClear(s, newTrickRun(), kind, plain, 'town').includes('trickTrio'));
  const r = newTrickRun();
  for (const kind of TRICK_KINDS.slice(0, 2)) recordTrickClear(s, r, kind, plain, 'town');
  assert.ok(recordTrickClear(s, r, 'drone', plain, 'town').includes('trickTrio'));
  assert.deepEqual(newTrickRun(), { kinds: [], streak: 0 }); assert.deepEqual(s.routes, ['town']);
});
test('連続回避の途中で接触した場合のリセットを反映する', () => {
  const s = newTrickStats(), r = newTrickRun();
  for (let i = 0; i < 5; i++) recordTrickClear(s, r, 'suitcase', plain, 'town');
  r.streak = 0; // Engine: 実際の接触時にリセット
  assert.ok(!recordTrickClear(s, r, 'suitcase', plain, 'town').includes('trickStreak6'));
  for (let i = 0; i < 4; i++) recordTrickClear(s, r, 'suitcase', plain, 'town');
  assert.ok(recordTrickClear(s, r, 'suitcase', plain, 'town').includes('trickStreak6'));
});
test('全国称号は4ステージ必要。同じステージを周回しても重複計上しない', () => {
  const s = newTrickStats();
  for (const stage of ['town', 'town', 'hiking', 'snow', 'summer']) {
    const r = newTrickRun();
    for (const kind of TRICK_KINDS) {
      const ids = recordTrickClear(s, r, kind, plain, stage);
      assert.equal(ids.includes('trickTour'), stage === 'summer' && kind === 'drone');
    }
  }
  assert.deepEqual(s.routes, ['town', 'hiking', 'snow', 'summer']);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
