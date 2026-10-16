// かくれ漢字（漢字発見パズル）の判定・報酬・保存・問題データのテスト。
// 使い方: node scripts/test-kakure-kanji.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// src/lib/games/kakure-kanji/*.ts をその場で変換して読みこむ
require.extensions[".ts"] = (mod, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  mod._compile(out, filename);
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith(".") && parent && parent.filename.endsWith(".ts")) {
    const base = path.resolve(path.dirname(parent.filename), request);
    if (fs.existsSync(`${base}.ts`)) return `${base}.ts`;
  }
  return originalResolve.call(this, request, parent, ...rest);
};

const dir = path.join(__dirname, "../src/lib/games/kakure-kanji");
const { STAGES, ALL_STAGES } = require(`${dir}/data/index.ts`);
const { STROKE_STRUCTURES, STROKE_COUNTS } = require(`${dir}/data/structures.ts`);
const J = require(`${dir}/judge.ts`);
const E = require(`${dir}/engine.ts`);
const P = require(`${dir}/progress.ts`);

const isKanji = (ch) => /^\p{Script=Han}$/u.test(ch);
let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
};

const kan = STAGES.find((s) => s.kanji === "感");
assert.ok(kan, "ステージ「感」がある");
const ANSWERS = ["心", "口", "一", "咸", "戈", "戌", "戊", "厂", "弋"];
const sorted = (list) => [...list].sort();
const setOf = (ch) => kan.answers.find((a) => a.char === ch).strokeSets[0];
const judge = (ids, found = []) => J.judgeStrokes(kan, ids, new Set(found));
/** 答えの字をえらんだ筆画で順に答える */
const play = (round, chars, now = 1) => {
  for (const ch of chars) round = E.submit(kan, round, setOf(ch), now).round;
  return round;
};

// ---------- 1. 正しい筆画の組が正解になる ----------
test("1. 答え9字の筆画の組（取り出し方が何通りかあるものは全部）が、それぞれ正解になる", () => {
  assert.deepEqual(sorted(kan.answers.map((a) => a.char)), sorted(ANSWERS));
  for (const a of kan.answers) {
    for (const set of a.strokeSets) {
      const r = judge(set);
      assert.equal(r.kind, "correct", `${a.char} [${set}]`);
      assert.equal(r.answer.char, a.char);
    }
  }
});
test("1. えらんだ順番・重なり・ない番号は関係ない", () => {
  assert.equal(judge([13, 12, 11, 10]).answer.char, "心");
  assert.equal(judge([10, 10, 11, 12, 13]).answer.char, "心");
  assert.equal(judge([10, 11, 12, 13, 99]).answer.char, "心");
});

// ---------- 2. 不正解の組は正解にならない ----------
test("2. 1本でも多い・少ない組は正解にならない（ぴったり同じときだけ）", () => {
  assert.equal(judge([10, 11, 12]).kind, "wrong");
  assert.equal(judge([10, 11, 12, 13, 9]).kind, "wrong");
  assert.equal(judge([4, 5]).kind, "wrong");
});
test("2. 全部の画（出題漢字そのもの）・何もえらばないは正解にならない", () => {
  assert.equal(judge(kan.strokes.map((s) => s.id)).kind, "whole");
  assert.equal(judge([]).kind, "empty");
  assert.equal(E.submit(kan, E.newRound(kan, 0), [], 1).round.history.length, 0, "空のOKは記録しない");
});
test("2. 13画のすべての組み合わせ（8191通り）で、正解になるのは登録した組だけ", () => {
  const registered = new Set(kan.answers.flatMap((a) => a.strokeSets.map((set) => sorted(set).join(","))));
  let correct = 0;
  for (let mask = 1; mask < 1 << kan.strokes.length; mask++) {
    const ids = kan.strokes.filter((_, i) => mask & (1 << i)).map((s) => s.id);
    const r = judge(ids);
    const key = ids.join(",");
    if (r.kind === "correct") {
      correct += 1;
      assert.ok(registered.has(key), `登録していない組 [${key}] が正解になった`);
    } else {
      assert.ok(!registered.has(key), `登録した組 [${key}] が正解にならない`);
    }
  }
  assert.equal(correct, registered.size);
});
test("2. 1本ちがいなら「おしい」をそっと出す", () => {
  assert.equal(judge([10, 11, 12]).near, "fewer");
  assert.equal(judge([4, 5, 6, 3]).near, "more");
  assert.equal(judge([10, 4]).near, null);
  assert.equal(judge([10, 3]).near, "more", "一（3画目）に1本多い");
  assert.equal(judge([10, 11, 12], ["心"]).near, null, "見つけた答えのおしいは出さない");
});
test("2. 検証中（pending）の答えは判定に使わない", () => {
  const draft = { ...kan, answers: kan.answers.map((a) => (a.char === "弋" ? { ...a, verification: { status: "pending", note: "" } } : a)) };
  assert.equal(J.judgeStrokes(draft, setOf("弋"), new Set()).kind, "pending");
  assert.equal(E.totalAnswers(draft), 8);
});

// ---------- 3. 同じ答えをくり返しても報酬が重ならない ----------
test("3. 同じ答えを何度出しても点数・発見数は1回分（別の取り出し方でも）", () => {
  let round = play(E.newRound(kan, 0), ["一"]);
  const score = round.score;
  for (const set of [[1], [3], [6], [1]]) {
    const out = E.submit(kan, round, set, 2);
    assert.equal(out.result.kind, "duplicate");
    assert.equal(out.gained, null);
    round = out.round;
  }
  assert.equal(round.score, score);
  assert.deepEqual(round.found, ["一"]);
  assert.equal(round.misses, 0, "重複はまちがいに数えない");
});
test("3. クリア報酬は1ラウンドにつき1回だけ", () => {
  let save = P.defaultSave();
  let round = E.newRound(kan, 10);
  save = P.saveRound(save, round);
  round = play(round, ANSWERS, 11);
  save = P.saveRound(save, round);
  const first = P.completeStage(save, kan, round, 13);
  assert.ok(first.reward);
  const again = P.completeStage(first.save, kan, round, 14);
  assert.equal(again.reward, null);
  assert.equal(again.save.coins, first.save.coins);
  assert.equal(again.save.stages[kan.id].clears, 1);
});

// ---------- 4. 全正解でクリア ----------
test("4. 全部見つけるとクリア、1つでも足りなければクリアしない", () => {
  let round = E.newRound(kan, 0);
  for (const ch of ANSWERS.slice(0, -1)) {
    const out = E.submit(kan, round, setOf(ch), 1);
    assert.equal(out.cleared, false);
    round = out.round;
  }
  const last = E.submit(kan, round, setOf(ANSWERS.at(-1)), 2);
  assert.equal(last.cleared, true);
  assert.equal(last.round.clearedAt, 2);
  assert.equal(E.starsFor(last.round), 3);
  assert.equal(E.submit(kan, last.round, [1, 2], 3).round, last.round, "クリア後の回答は何も変えない");
});
test("4. ヒントで答えを開いてもクリアでき、その答えは0点・星が下がる", () => {
  let round = play(E.newRound(kan, 0), ANSWERS.slice(0, -1));
  round = E.applyHint(kan, round, "弋", "reveal", 2);
  assert.equal(round.clearedAt, 2);
  assert.equal(E.starsFor(round), 1);
  assert.equal(E.pointsFor(kan.answers.find((a) => a.char === "弋"), 3, ["reveal"]), 0);
});
test("4. まちがえても点数は減らず、連続ボーナスが切れるだけ", () => {
  let round = play(E.newRound(kan, 0), ["心"]);
  const before = round.score;
  round = E.submit(kan, round, [1, 3], 2).round;
  assert.equal(round.score, before);
  assert.equal(round.misses, 1);
  assert.equal(round.combo, 0);
  assert.equal(round.history[0].text, "2画");
  assert.equal(E.starsFor({ ...round, clearedAt: 3 }), 3, "まちがいで星は減らない");
});

// ---------- 5. コイン不足ではヒントを買えない ----------
test("5. コインが足りないとヒントを買えず、残高も変わらない", () => {
  const poor = { ...P.defaultSave(), coins: 15 };
  const result = P.buyHint(poor, kan.id, "弋", "part", E.HINTS.part.cost, 1);
  assert.equal(result.ok, false);
  assert.equal(result.shortBy, 5);
  assert.equal(poor.coins, 15);
  const ok = P.buyHint(poor, kan.id, "弋", "reading", E.HINTS.reading.cost, 1);
  assert.equal(ok.ok, true);
  assert.equal(ok.save.coins, 5);
  assert.equal(ok.save.hintLog.length, 1);
  assert.equal(P.spendCoins(poor, -5).ok, false, "マイナスの値段では増やせない");
});
test("5. 同じヒントは2回使えず、見つけた答えにも使えない", () => {
  let round = E.newRound(kan, 0);
  round = E.applyHint(kan, round, "弋", "reading", 1);
  assert.equal(E.canUseHint(round, "弋", "reading"), false);
  assert.equal(E.canUseHint(round, "弋", "strokes"), true);
  round = E.submit(kan, round, setOf("弋"), 2).round;
  assert.equal(E.canUseHint(round, "弋", "strokes"), false);
});

test("5. ヒント「一部を見る」は答えの画の半分未満だけを見せる", () => {
  for (const a of kan.answers) {
    const part = E.partHintStrokes(a);
    const set = a.strokeSets[0];
    assert.ok(part.length * 2 <= set.length, a.char);
    assert.ok(part.every((id) => set.includes(id)), a.char);
    if (set.length >= 2) assert.ok(part.length >= 1, a.char);
  }
});

// ---------- 6. 再起動しても進みぐあいが残る ----------
function memoryStorage() {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => void map.set(k, v) };
}
test("6. 保存して読みなおすと同じデータになる（途中のラウンドも）", () => {
  const storage = memoryStorage();
  const store = P.createKeyValueStore(storage);
  let save = P.defaultSave();
  let round = play(E.newRound(kan, 5), ["心", "戈"], 6);
  save = P.saveRound({ ...save, coins: 123 }, round);
  store.save(save);
  const reloaded = P.createKeyValueStore(storage).load();
  assert.deepEqual(reloaded, save);
  assert.deepEqual(reloaded.rounds[kan.id].found, ["心", "戈"]);
});
test("6. こわれたデータは1つ前のバックアップから読む・どちらもだめなら最初から", () => {
  const storage = memoryStorage();
  const store = P.createKeyValueStore(storage, "k");
  store.save({ ...P.defaultSave(), coins: 1 });
  store.save({ ...P.defaultSave(), coins: 2 });
  storage.setItem("k", storage.getItem("k").slice(0, 20));
  assert.equal(P.createKeyValueStore(storage, "k").load().coins, 1);
  assert.ok(storage.getItem("k.broken"), "こわれたデータは .broken に残す");
  storage.setItem("k.bak", "{}");
  assert.equal(P.createKeyValueStore(storage, "k").load().coins, P.START_COINS);
  // 形がちがう（マイナスのコイン）データは保存しない
  assert.throws(() => store.save({ ...P.defaultSave(), coins: -1 }));
  // 書き換えられた（チェックサムが合わない）データは読まない
  const tampered = memoryStorage();
  P.createKeyValueStore(tampered, "t").save({ ...P.defaultSave(), coins: 7 });
  const box = JSON.parse(tampered.getItem("t"));
  tampered.setItem("t", JSON.stringify({ sum: box.sum, body: box.body.replace('"coins":7', '"coins":99999') }));
  assert.equal(P.createKeyValueStore(tampered, "t").load().coins, P.START_COINS);
});
test("6. ログインボーナスは1日1回・連続日数で増える", () => {
  let save = P.defaultSave();
  const day1 = P.claimLoginBonus(save, "2026-10-15");
  assert.equal(day1.bonus.coins, 20);
  assert.equal(P.claimLoginBonus(day1.save, "2026-10-15").bonus, null);
  const day2 = P.claimLoginBonus(day1.save, "2026-10-16");
  assert.equal(day2.bonus.streak, 2);
  assert.equal(day2.bonus.coins, 25);
  const gap = P.claimLoginBonus(day2.save, "2026-10-20");
  assert.equal(gap.bonus.streak, 1);
  assert.equal(P.japanDate(Date.UTC(2026, 9, 15, 16, 0)), "2026-10-16", "日本時間で日付を切りかえる");
});
test("6. 経験値でレベルが上がり、報酬と称号がつく", () => {
  const { save, levelUps } = P.addExp(P.defaultSave(), P.expToNext(1) + P.expToNext(2));
  assert.equal(save.level, 3);
  assert.equal(levelUps.length, 2);
  assert.equal(save.coins, P.START_COINS + P.levelUpCoins(2) + P.levelUpCoins(3));
  assert.equal(P.titleFor(1), "漢字初心者");
  assert.equal(P.titleFor(3), "漢字研究家");
  assert.equal(P.titleFor(15), "漢字達人");
});
test("6. 実績（初めての正解・ノーヒント・全問正解・連続クリア）", () => {
  let save = P.defaultSave();
  const first = P.recordAnswers(save, 1, 0, 1);
  assert.deepEqual(first.unlocked, ["first_correct"]);
  assert.deepEqual(P.recordAnswers(first.save, 1, 0, 2).unlocked, []);
  save = first.save;
  for (let i = 0; i < 3; i++) {
    let round = E.newRound(kan, 100 + i);
    save = P.saveRound(save, round);
    round = play(round, ANSWERS, 101 + i);
    save = P.saveRound(save, round);
    const done = P.completeStage(save, kan, round, 102 + i);
    save = done.save;
    if (i === 0) assert.deepEqual(sorted(done.reward.achievements), sorted(["first_clear", "no_hint", "perfect"]));
    if (i === 2) assert.deepEqual(done.reward.achievements, ["streak_3"]);
    if (i > 0) assert.equal(done.reward.coins, kan.reward.replayCoins, "2回目からは少なめ");
  }
  assert.equal(P.skipStage(save, kan.id).clearStreak, 0);
});

// ---------- 8. 長く遊んでも重くならない ----------
test("8. 1万回入力しても履歴は上限までで、時間もかからない", () => {
  const start = process.hrtime.bigint();
  let round = E.newRound(kan, 0);
  const tries = [[1, 3], setOf("心"), [2], [], kan.strokes.map((s) => s.id), [4, 5]];
  for (let i = 0; i < 10000; i++) round = E.submit(kan, round, tries[i % tries.length], i).round;
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(round.history.length <= E.HISTORY_LIMIT);
  assert.ok(ms < 1500, `${ms.toFixed(0)}ms`);
  let save = P.defaultSave();
  for (let i = 0; i < 1000; i++) save = P.buyHint({ ...save, coins: 100 }, kan.id, "弋", "reading", 10, i).save;
  assert.ok(save.hintLog.length <= P.HINT_LOG_LIMIT);
});

// ---------- 9. 問題データと正解一覧に矛盾がない ----------
const multiset = (list) => sorted(list).join(",");
const isSubMultiset = (sub, all) => {
  const rest = [...all];
  return sub.every((x) => {
    const i = rest.indexOf(x);
    if (i < 0) return false;
    rest.splice(i, 1);
    return true;
  });
};
test("9. どのステージもデータの形が正しい", () => {
  const ids = new Set();
  ALL_STAGES.forEach((stage, i) => {
    assert.ok(!ids.has(stage.id), `id重複 ${stage.id}`);
    ids.add(stage.id);
    assert.equal(stage.number, i + 1, "ステージ番号は1から順番");
    assert.ok(isKanji(stage.kanji));
    assert.ok(stage.reading && stage.structure);
    assert.deepEqual(stage.strokes.map((s) => s.id), stage.strokes.map((_, n) => n + 1), "筆画は書き順の番号どおり");
    for (const s of stage.strokes) assert.match(s.d, /^M[\d.\s,MLCQ-]+$/, `path ${s.id}`);
    const chars = stage.answers.map((a) => a.char);
    assert.equal(new Set(chars).size, chars.length, "答えに重複がない");
    assert.ok(!chars.includes(stage.kanji), "出題漢字そのものは答えにしない");
    for (const a of stage.answers) {
      assert.ok(isKanji(a.char), a.char);
      assert.equal(a.char, a.char.normalize("NFKC"), `${a.char} は正規化ずみの字（康熙部首などではない）`);
      assert.ok(a.readings.length > 0 && a.evidence && a.partHint && a.meaning, `${a.char} の説明`);
      assert.ok(a.strokeSets.length > 0);
      for (const set of a.strokeSets) {
        assert.equal(new Set(set).size, set.length);
        for (const id of set) assert.ok(stage.strokes.some((s) => s.id === id), `${a.char} の筆画 ${id}`);
      }
      if (a.rule === "component") assert.equal(a.strokeSets.length, 1, "部品の取り出しは1通り");
    }
    for (const n of stage.nearMisses) {
      assert.ok(!chars.includes(n.char), `${n.char} は答えと似た字の両方に入っていない`);
      assert.ok(n.reason.length > 10 && n.reading, n.char);
    }
    assert.equal(new Set(stage.nearMisses.map((n) => n.char)).size, stage.nearMisses.length);
    assert.equal(stage.verification.status, "verified");
    // ちがう答えどうしが同じ筆画の組を持っていない（どちらが正解か決まらなくなる）
    const keys = stage.answers.flatMap((a) => a.strokeSets.map((set) => sorted(set).join(",")));
    assert.equal(new Set(keys).size, keys.length, "筆画の組が重複");
    for (const a of stage.answers) for (const set of a.strokeSets) assert.ok(set.length < stage.strokes.length, `${a.char} は全部の画ではない`);
  });
});
test("9. 構造データ：出題漢字の筆画の種類と並びが一致する", () => {
  for (const stage of ALL_STAGES) {
    const structure = STROKE_STRUCTURES[stage.kanji];
    assert.ok(structure, `${stage.kanji} の構造データ`);
    assert.deepEqual(stage.strokes.map((s) => s.kind), structure);
    assert.equal(stage.strokes.length, STROKE_COUNTS[stage.kanji]);
  }
});
test("9. 構造データ：答えの筆画えらびが、その字の画の種類・画数と一致する", () => {
  for (const stage of ALL_STAGES) {
    for (const a of stage.answers) {
      const structure = STROKE_STRUCTURES[a.char];
      assert.ok(structure, `${a.char} の構造データがない（構造データを足してから答えに入れる）`);
      assert.equal(structure.length, STROKE_COUNTS[a.char], `${a.char} 画数`);
      for (const set of a.strokeSets) {
        const picked = set.map((id) => stage.strokes.find((s) => s.id === id).kind);
        assert.equal(multiset(picked), multiset(structure), `${a.char} の画 [${set}]`);
      }
      assert.equal(E.strokeCountOf(a), STROKE_COUNTS[a.char], `${a.char} ヒントの画数`);
    }
  }
});
test("9. 似た字の分類が構造データと矛盾しない（画が無い=missing、画はあるが作れない=shape/position）", () => {
  for (const stage of ALL_STAGES) {
    const all = stage.strokes.map((s) => s.kind);
    for (const n of stage.nearMisses) {
      const structure = STROKE_STRUCTURES[n.char];
      if (!structure) continue;
      const formableByKinds = isSubMultiset(structure, all);
      if (n.category === "missing") assert.equal(formableByKinds, false, `${n.char} は本当に画が足りない`);
      if (n.category === "shape" || n.category === "position") assert.equal(formableByKinds, true, `${n.char} は画の種類だけなら足りている`);
    }
  }
});
test("9. 「感」の部品は正しい場所にある（咸は上、心は下、口は咸の中）", () => {
  const box = (ids) => {
    const nums = ids.flatMap((id) => kan.strokes.find((s) => s.id === id).d.match(/-?\d+(\.\d+)?/g).map(Number));
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  const set = (ch) => kan.answers.find((a) => a.char === ch).strokeSets[0];
  const kokoro = box(set("心"));
  const kan9 = box(set("咸"));
  const kuchi = box(set("口"));
  assert.ok(kan9.y1 <= kokoro.y0 + 2, "咸は心の上");
  assert.ok(kuchi.x0 > kan9.x0 && kuchi.x1 < kan9.x1 && kuchi.y0 > kan9.y0 && kuchi.y1 < kan9.y1, "口は咸の中");
  // 戌・戊を分ける「中の横画（3画目）」は口の上にある（下なら或の形）
  assert.ok(box([3]).y1 < kuchi.y0, "3画目は口の上");
  // 「二」にならないこと：横画2本を上下に選んでも、下が上より長くならない
  const horizontals = kan.strokes.filter((s) => s.kind === "横").map((s) => ({ id: s.id, ...box([s.id]) }));
  for (const upper of horizontals) {
    for (const lower of horizontals) {
      if (lower.y0 <= upper.y0) continue;
      assert.ok(lower.x1 - lower.x0 <= upper.x1 - upper.x0, `横画${upper.id}・${lower.id}で二にならない`);
    }
  }
});

// ---------- 10. 字形差による誤判定が起きにくい ----------
test("10. 戌・戊・戈・弋は、中の横画やノの有無で正しく分かれる", () => {
  assert.equal(judge([1, 2, 3, 7, 8, 9]).answer.char, "戌");
  assert.equal(judge([1, 2, 7, 8, 9]).answer.char, "戊", "中の横画なし");
  assert.equal(judge([1, 7, 8, 9]).answer.char, "戈");
  assert.equal(judge([1, 7, 9]).answer.char, "弋", "ノなし");
  // 戍（中が点）は、感の点（9画目）を中に入れても作れない
  assert.equal(judge([1, 2, 9, 7, 8]).answer.char, "戊", "点はもともと戊の右上の点");
  assert.notEqual(judge([1, 2, 10, 7, 8, 9]).kind, "correct", "心の点をまぜても戍にはならない");
});
test("10. 二（横画2本）・十・部首だけの形は正解にならない", () => {
  for (const pair of [[1, 3], [1, 6], [3, 6]]) assert.equal(judge(pair).kind, "wrong", `二 ${pair}`);
  for (const one of [2, 4, 9, 10, 11]) assert.equal(judge([one]).kind, "wrong", `部首の形 ${one}`);
  assert.equal(judge([1, 4]).kind, "wrong", "十");
});
test("10. どの結果にも画面に出す文があり、undefined が出ない", () => {
  for (const ids of [setOf("心"), [], kan.strokes.map((s) => s.id), [10, 11, 12], [4, 5, 6, 3], [1, 3]]) {
    const msg = J.resultMessage(judge(ids, ["口"]), "感");
    assert.ok(msg && !msg.includes("undefined"), msg);
  }
});

console.log(`\n${passed} tests passed`);
