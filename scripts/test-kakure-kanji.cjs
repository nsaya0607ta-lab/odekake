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
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
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
const { STROKE_STRUCTURES, STROKE_STRUCTURE_VARIANTS, STROKE_COUNTS, LOOSE_KIND_GROUPS } = require(`${dir}/data/structures.ts`);
const { KYOIKU_GRADES } = require(`${dir}/data/grades.ts`);
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
const MAIN = ["一", "二", "三", "八", "口", "心"]; // 小学校で習う字（クリアに必要）
const SECRET = ["咸", "戈", "戌", "戊", "厂", "弋", "乂"]; // 小学校で習わない字（シークレット）
const ANSWERS = [...MAIN, ...SECRET];
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
  assert.equal(E.totalAnswers(draft), MAIN.length);
  assert.equal(E.secretAnswers(draft).length, SECRET.length - 1, "検証中の字はシークレット枠にも出さない");
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
test("4. 見つける字（小学校で習う字）を全部見つけるとクリア、1つでも足りなければクリアしない", () => {
  let round = play(E.newRound(kan, 0), [...SECRET, ...MAIN.filter((c) => c !== "心")]);
  assert.equal(round.clearedAt, null, "シークレットはクリアに入らない");
  const last = E.submit(kan, round, setOf("心"), 2);
  assert.equal(last.cleared, true);
  assert.equal(last.completed, true, "シークレットを先に全部見つけていれば同時にコンプリート");
  assert.equal(last.round.clearedAt, 2);
  assert.equal(E.starsFor(kan, last.round), 3);
});
test("4. クリアのあともシークレットはさがせて、全部でコンプリート。そのあとは何も変わらない", () => {
  let round = play(E.newRound(kan, 0), MAIN, 1);
  assert.equal(round.clearedAt, 1);
  assert.equal(round.completedAt, null);
  const out = E.submit(kan, round, setOf("戈"), 2);
  assert.equal(out.result.kind, "correct");
  assert.equal(out.gained.secret, true);
  assert.equal(out.cleared, false, "クリアは1回だけ");
  round = play(out.round, SECRET.filter((c) => c !== "戈"), 3);
  assert.equal(round.completedAt, 3);
  assert.equal(E.submit(kan, round, [1, 2], 4).round, round, "コンプリート後の回答は何も変えない");
});
test("4. ヒントで答えを開いてもクリアでき、その答えは0点・星が下がる。シークレットのヒントは星に関係ない", () => {
  let round = play(E.newRound(kan, 0), MAIN.filter((c) => c !== "心"));
  round = E.applyHint(kan, round, "戈", "reading", 1);
  round = E.applyHint(kan, round, "戈", "strokes", 1);
  round = E.applyHint(kan, round, "戈", "part", 1);
  round = E.applyHint(kan, round, "心", "reveal", 2);
  assert.equal(round.clearedAt, 2);
  assert.equal(E.starsFor(kan, round), 1);
  assert.equal(E.hintCount(round, kan), 1, "シークレットに使ったヒントは数えない");
  assert.equal(E.pointsFor(kan.answers.find((a) => a.char === "心"), 3, ["reveal"]), 0);
  const noMainHint = E.applyHint(kan, play(E.newRound(kan, 0), MAIN.filter((c) => c !== "心")), "戈", "reveal", 1);
  assert.equal(E.starsFor(kan, play(noMainHint, ["心"], 2)), 3);
});
test("4. まちがえても点数は減らず、連続ボーナスが切れるだけ", () => {
  let round = play(E.newRound(kan, 0), ["心"]);
  const before = round.score;
  round = E.submit(kan, round, [1, 4], 2).round;
  assert.equal(round.score, before);
  assert.equal(round.misses, 1);
  assert.equal(round.combo, 0);
  assert.equal(round.history[0].text, "2画");
  assert.equal(E.starsFor(kan, { ...round, clearedAt: 3 }), 3, "まちがいで星は減らない");
});
test("4. シークレットをはじめて見つけたときだけ墨コイン。全部で実績", () => {
  let save = P.defaultSave();
  let round = play(E.newRound(kan, 0), MAIN, 1);
  save = P.saveRound(save, round);
  const cleared = P.completeStage(save, kan, round, 1);
  save = cleared.save;
  assert.ok(save.rounds[kan.id], "クリアしてもラウンドは残る（シークレットをさがせる）");
  let total = 0;
  for (const ch of SECRET) {
    const out = E.submit(kan, save.rounds[kan.id], setOf(ch), 2);
    save = P.saveRound(save, out.round);
    const rec = P.recordSecret(save, kan, ch, out.gained.points, true, 2);
    assert.equal(rec.coins, P.SECRET_COINS);
    total += out.gained.points;
    save = rec.save;
    if (ch === SECRET.at(-1)) assert.ok(rec.achievements.includes("all_secrets"));
  }
  assert.ok(save.achievements.first_secret);
  assert.deepEqual(sorted(save.stages[kan.id].secretsFound), sorted(SECRET));
  assert.equal(save.totalPoints, cleared.reward.score + total);
  assert.equal(P.recordSecret(save, kan, "戈", 100, true, 3).coins, 0, "2回目からは墨コインなし");
  assert.equal(P.recordSecret(save, kan, "心", 100, true, 3).coins, 0, "シークレットでない字には何もしない");
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
    save = P.dropRound(save, kan.id);
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
/** 見立てで同じとみなす画の種類を、グループの代表（いちばん後ろ）にそろえる */
const looseKind = (kind) => LOOSE_KIND_GROUPS.find((g) => g.includes(kind))?.at(-1) ?? kind;
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
      assert.equal(new Set(a.strokeSets.map((set) => sorted(set).join(","))).size, a.strokeSets.length, "同じ答えの取り出し方が重複しない");
    }
    for (const n of stage.nearMisses) {
      assert.ok(!chars.includes(n.char), `${n.char} は答えと似た字の両方に入っていない`);
      assert.ok(n.reason.length > 10 && n.reading, n.char);
    }
    assert.equal(new Set(stage.nearMisses.map((n) => n.char)).size, stage.nearMisses.length);
    assert.equal(stage.verification.status, "verified");
    // 同じ画を異なる比率に見立てる字は、判定を一方へ固定せず選択肢にする。
    const bySelection = new Map();
    for (const a of stage.answers) for (const set of a.strokeSets) {
      const key = sorted(set).join(",");
      bySelection.set(key, [...(bySelection.get(key) ?? []), a]);
    }
    for (const [key, answers] of bySelection) if (answers.length > 1) {
      assert.ok(answers.some((a) => a.rule === "loose"), "比率を見立てる字だけが同じ組を共有する");
      const result = J.judgeStrokes(stage, key.split(",").map(Number), new Set());
      assert.equal(result.kind, "ambiguous");
      assert.deepEqual(sorted(result.answers.map((a) => a.char)), sorted(answers.map((a) => a.char)));
    }
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
        const kinds = a.rule === "loose" ? (list) => list.map(looseKind) : (list) => list;
        const variants = [structure, ...(STROKE_STRUCTURE_VARIANTS[a.char] ?? [])];
        assert.ok(variants.some((variant) => multiset(kinds(picked)) === multiset(kinds(variant))), `${a.char} の画 [${set}]`);
      }
      assert.equal(E.strokeCountOf(a), STROKE_COUNTS[a.char], `${a.char} ヒントの画数`);
    }
  }
});
test("9. 似た字の分類が構造データと矛盾しない（画が無い=missing、画はあるが作れない=shape/position）", () => {
  for (const stage of ALL_STAGES) {
    // 見立て（はね・曲がりぐあいのちがいを同じとみなす）でも画が足りないものだけが missing
    const all = stage.strokes.map((s) => looseKind(s.kind));
    for (const n of stage.nearMisses) {
      const structure = STROKE_STRUCTURES[n.char];
      if (!structure) continue;
      const formableByKinds = isSubMultiset(structure.map(looseKind), all);
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
  // 二・三：横画（1・3・6画目）が上から順にはなれてならび、横の位置が重なっている
  const [h1, h3, h6] = [box([1]), box([3]), box([6])];
  assert.ok(h1.y1 < h3.y0 && h3.y1 < h6.y0, "横画は上下にはなれている");
  assert.ok(Math.max(h1.x0, h3.x0, h6.x0) < Math.min(h1.x1, h3.x1, h6.x1), "横の位置が重なる");
});

test("9. 見立ての答えは、向き・交わり・位置関係がその字のとおり", () => {
  const pts = (id) => {
    const n = kan.strokes.find((s) => s.id === id).d.match(/-?\d+(\.\d+)?/g).map(Number);
    return n.reduce((list, v, i) => (i % 2 ? [...list.slice(0, -1), { ...list.at(-1), y: v }] : [...list, { x: v, y: 0 }]), []);
  };
  const segCross = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  };
  const cross = (i, j) => {
    const a = pts(i);
    const b = pts(j);
    for (let m = 0; m < a.length - 1; m++) for (let n = 0; n < b.length - 1; n++) if (segCross(a[m], a[m + 1], b[n], b[n + 1])) return true;
    return false;
  };
  /** はじめの点から、いちばん下の点への向き（はねは無視） */
  const dir = (id) => {
    const p = pts(id);
    const low = p.reduce((m, q) => (q.y > m.y ? q : m), p[0]);
    return low.x < p[0].x ? "↙" : "↘";
  };
  // 八：↙が左・↘が右、交わらない
  assert.equal(dir(2), "↙");
  assert.equal(dir(7), "↘");
  assert.ok(!cross(2, 7), "八の2本ははなれている");
  assert.ok(Math.max(...pts(2).map((q) => q.x)) < Math.min(...pts(7).map((q) => q.x)), "八：↙の画が左");
  // 乂：↘と↙が交わる
  assert.equal(dir(8), "↙");
  assert.ok(cross(7, 8), "乂の2本は交わる");
});

test("9. 見つける字は小学校で習う字だけ（学年は配当表のとおり）。それ以外はシークレット", () => {
  for (const stage of ALL_STAGES) {
    for (const a of stage.answers) {
      assert.equal(a.grade, KYOIKU_GRADES[a.char] ?? null, `${a.char} の学年`);
      assert.equal(E.isSecret(a), KYOIKU_GRADES[a.char] === undefined, `${a.char} のシークレット`);
    }
    assert.ok(E.mainAnswers(stage).length > 0, "クリアに必要な字が1つ以上ある");
  }
  assert.deepEqual(sorted(E.mainAnswers(kan).map((a) => a.char)), sorted(MAIN));
  assert.deepEqual(sorted(E.secretAnswers(kan).map((a) => a.char)), sorted(SECRET));
  assert.equal(kan.difficulty, "中級", "見つける字が6個なので中級（4〜6個）");
});
test("9. 古い形のセーブデータ（シークレット前）も読める", () => {
  const old = P.defaultSave();
  const round = E.newRound(kan, 1);
  delete round.rewardedAt;
  delete round.completedAt;
  old.rounds[kan.id] = round;
  old.stages[kan.id] = { clears: 1, bestStars: 3, bestScore: 10, firstClearedAt: 1 };
  const parsed = P.parseSave(JSON.parse(JSON.stringify(old)));
  assert.ok(parsed);
  assert.equal(parsed.rounds[kan.id].rewardedAt, null);
  assert.deepEqual(parsed.stages[kan.id].secretsFound, []);
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
test("10. 見立てで二・三・八・乂になり、七・十・人・部首だけの形は正解にならない", () => {
  for (const pair of [[1, 3], [1, 6], [3, 6]]) assert.equal(judge(pair).answer.char, "二", `二 ${pair}`);
  assert.equal(judge([1, 3, 6]).answer.char, "三");
  assert.equal(judge([1, 7]).kind, "wrong", "1・7画目は七とはみなさない（7画目はななめにのびる線）");
  assert.equal(judge([2, 7]).answer.char, "八");
  assert.equal(judge([7, 8]).answer.char, "乂");
  assert.equal(judge([2, 8]).kind, "wrong", "↙と↙では八にならない");
  assert.equal(judge([10, 13]).kind, "wrong", "心の点（どちらも↘）では八にならない");
  assert.equal(judge([12, 13]).kind, "wrong", "心の点（どちらも↘）では八にならない");
  for (const one of [2, 4, 9, 10, 11]) assert.equal(judge([one]).kind, "wrong", `部首の形 ${one}`);
  assert.equal(judge([1, 4]).kind, "wrong", "十");
});
test("10. どの結果にも画面に出す文があり、undefined が出ない", () => {
  for (const ids of [setOf("心"), [], kan.strokes.map((s) => s.id), [10, 11, 12], [4, 5, 6, 3], [1, 4]]) {
    const msg = J.resultMessage(judge(ids, ["口"]), "感");
    assert.ok(msg && !msg.includes("undefined"), msg);
  }
});

// ---------- 11. 追加ステージ「漢」「称」 ----------
const additions = [
  { char: "漢", main: ["一", "二", "三", "十", "口", "人", "大", "夫"], secret: ["汁"] },
  { char: "称", main: ["一", "十", "千", "木", "八", "小", "丁", "下"], secret: ["禾"] },
];

for (const { char, main, secret } of additions) {
  const stage = STAGES.find((s) => s.kanji === char);
  assert.ok(stage, `ステージ「${char}」が公開一覧にある`);
  test(`11. 「${char}」の通常8字とシークレット1字、全筆画の組で判定が一致する`, () => {
    assert.deepEqual(sorted(E.mainAnswers(stage).map((a) => a.char)), sorted(main));
    assert.deepEqual(sorted(E.secretAnswers(stage).map((a) => a.char)), sorted(secret));
    const registered = new Map(stage.answers.flatMap((a) => a.strokeSets.map((ids) => [sorted(ids).join(","), a.char])));
    const found = new Set();
    for (let mask = 1; mask < 1 << stage.strokes.length; mask++) {
      const ids = stage.strokes.filter((_, i) => mask & (1 << i)).map((s) => s.id);
      const result = J.judgeStrokes(stage, ids, found);
      const expected = registered.get(sorted(ids).join(","));
      if (expected) {
        assert.equal(result.kind, "correct", `${char} [${ids}]`);
        assert.equal(result.answer.char, expected);
      } else {
        assert.notEqual(result.kind, "correct", `${char} の未登録の組 [${ids}]`);
      }
    }
  });
  test(`11. 「${char}」は通常の答えでクリアし、保存してからシークレットまで完成できる`, () => {
    let round = E.newRound(stage, 1);
    for (const answer of main) {
      const a = stage.answers.find((candidate) => candidate.char === answer);
      round = E.submit(stage, round, a.strokeSets[0], 2).round;
    }
    assert.equal(round.clearedAt, 2);
    assert.equal(round.completedAt, null);
    let save = P.saveRound(P.defaultSave(), round);
    save = P.completeStage(save, stage, round, 3).save;
    const storage = memoryStorage();
    const store = P.createKeyValueStore(storage);
    store.save(save);
    save = store.load();
    assert.deepEqual(save.rounds[stage.id].found, main);
    for (const answer of secret) {
      const a = stage.answers.find((candidate) => candidate.char === answer);
      round = E.submit(stage, save.rounds[stage.id], a.strokeSets[0], 4).round;
      save = P.saveRound(save, round);
    }
    assert.equal(round.completedAt, 4);
    assert.equal(E.starsFor(stage, round), 3);
  });
}

test("11. 「漢」の横画は二が6通り・三が4通りで、天とは区別する", () => {
  const stage = STAGES.find((s) => s.kanji === "漢");
  assert.equal(stage.answers.find((a) => a.char === "二").strokeSets.length, 6);
  assert.equal(stage.answers.find((a) => a.char === "三").strokeSets.length, 4);
  assert.equal(J.judgeStrokes(stage, [10, 11, 12, 13], new Set()).answer.char, "夫");
  assert.equal(J.judgeStrokes(stage, [12, 13], new Set()).answer.char, "人");
  assert.ok(!stage.answers.some((a) => ["天", "中", "八", "氵", "艹"].includes(a.char)));
});

test("11. 「称」は日本の7画目が横画。丁・下・小と、はなれた八を区別する", () => {
  const stage = STAGES.find((s) => s.kanji === "称");
  const answer = (ids) => J.judgeStrokes(stage, ids, new Set()).answer.char;
  assert.equal(stage.strokes[6].kind, "横");
  assert.equal(answer([7]), "一");
  assert.equal(answer([7, 8]), "丁");
  assert.equal(answer([7, 8, 10]), "下");
  assert.equal(answer([8, 9, 10]), "小");
  assert.equal(answer([4, 5]), "八");
  // 左払いのすべての制御点が x <= 29、右払いは x >= 34。線の太さを含めても接しない。
  const xs = (id) => stage.strokes.find((s) => s.id === id).d.match(/-?\d+(\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 0);
  const left = stage.strokes[3];
  const right = stage.strokes[4];
  assert.ok(Math.max(...xs(4)) + left.width / 2 < Math.min(...xs(5)) - right.width / 2);
  assert.ok(!stage.answers.some((a) => ["二", "人", "少", "不"].includes(a.char)));
});

// ---------- 12. ステージ4〜10：全候補・同じ画の見立て・10問実績 ----------
const SEVEN = {
  森: ["一二十木林人入大八", "卜杁杕"],
  明: ["一二口日月", "曰"],
  思: ["一二十口日田心土士志", "曰"],
  想: ["一二三十木口日目心相旧", "卜曰"],
  意: ["一二三口日立音心", "曰咅"],
  語: ["一二三口言五工丁", "吾訂訌唔"],
  謝: ["一二三十口言寸身射討計", ""],
};

for (const [char, [main, secret]] of Object.entries(SEVEN)) {
  const stage = STAGES.find((s) => s.kanji === char);
  assert.ok(stage, `${char} の出題`);
  test(`12. 「${char}」の全候補と全${(1 << stage.strokes.length) - 1}組の判定（同じ組の別字も選べる）`, () => {
    assert.deepEqual(sorted(E.mainAnswers(stage).map((a) => a.char)), sorted([...main]));
    assert.deepEqual(sorted(E.secretAnswers(stage).map((a) => a.char)), sorted([...secret]));
    const registered = new Map();
    for (const a of stage.answers) for (const set of a.strokeSets) {
      const key = sorted(set).join(",");
      registered.set(key, [...(registered.get(key) ?? []), a.char]);
    }
    for (let mask = 1; mask < 1 << stage.strokes.length; mask++) {
      const ids = stage.strokes.filter((_, i) => mask & (1 << i)).map((s) => s.id);
      const expected = registered.get(sorted(ids).join(","));
      const result = J.judgeStrokes(stage, ids, new Set());
      if (!expected) {
        assert.ok(!["correct", "ambiguous"].includes(result.kind), `${char} 未登録 [${ids}]`);
      } else if (expected.length === 1) {
        assert.equal(result.kind, "correct");
        assert.equal(result.answer.char, expected[0]);
      } else {
        assert.equal(result.kind, "ambiguous");
        assert.deepEqual(sorted(result.answers.map((a) => a.char)), sorted(expected));
        for (const answer of expected) assert.equal(J.judgeStrokes(stage, ids, new Set(), answer).answer.char, answer);
      }
    }
  });
  test(`12. 「${char}」は全通常字でクリアし、保存・再開して全シークレットまで完成する`, () => {
    let round = E.newRound(stage, 0);
    for (const a of E.mainAnswers(stage)) {
      round = E.submit(stage, round, a.strokeSets[0], 1, a.char).round;
    }
    assert.equal(round.clearedAt, 1);
    const store = P.createKeyValueStore(memoryStorage());
    const cleared = P.completeStage(P.saveRound(P.defaultSave(), round), stage, round, 2);
    assert.ok(cleared.reward);
    store.save(cleared.save);
    let save = store.load();
    for (const a of E.secretAnswers(stage)) {
      round = E.submit(stage, save.rounds[stage.id], a.strokeSets[0], 3, a.char).round;
      save = P.saveRound(save, round);
    }
    assert.ok(round.completedAt !== null);
    store.save(save);
    assert.deepEqual(sorted(store.load().rounds[stage.id].found), sorted(stage.answers.map((a) => a.char)));
    assert.equal(P.completeStage(save, stage, round, 4).reward, null, "クリアの二重報酬なし");
  });
}

test("12. 同じ組で日と曰／土と士に答えても、選択前は点数も履歴も保存も変わらない", () => {
  const stage = STAGES.find((s) => s.kanji === "思");
  let round = E.newRound(stage, 0);
  for (const pair of [["日", "曰"], ["土", "士"]]) {
    const ids = stage.answers.find((a) => a.char === pair[0]).strokeSets[0];
    const offered = E.submit(stage, round, ids, 1);
    assert.equal(offered.result.kind, "ambiguous");
    assert.equal(offered.round, round);
    assert.equal(offered.gained, null);
    assert.equal(E.submit(stage, round, ids, 1, "存在しない字").round, round);
    for (const char of pair) {
      const result = E.submit(stage, round, ids, 2, char);
      assert.equal(result.result.kind, "correct");
      round = result.round;
    }
    const duplicate = E.submit(stage, round, ids, 3, pair[0]);
    assert.equal(duplicate.result.kind, "duplicate");
    assert.equal(duplicate.round.score, round.score);
  }
  const store = P.createKeyValueStore(memoryStorage());
  store.save(P.saveRound(P.defaultSave(), round));
  assert.deepEqual(sorted(store.load().rounds[stage.id].found), sorted(["日", "曰", "土", "士"]));
});

test("12. 既存3問のIDを維持し、10ステージクリアの実績を実際に達成できる", () => {
  assert.equal(STAGES.length, 10);
  assert.deepEqual(STAGES.slice(0, 3).map((s) => s.id), ["s001-kan", "s002-kan", "s003-shou"]);
  let save = P.defaultSave();
  for (const stage of STAGES) {
    let round = E.newRound(stage, 0);
    for (const a of E.mainAnswers(stage)) round = E.submit(stage, round, a.strokeSets[0], 1, a.char).round;
    save = P.completeStage(P.saveRound(save, round), stage, round, 2).save;
  }
  assert.equal(P.clearedStageCount(save), 10);
  assert.ok(save.achievements.clear_10);
});

console.log(`\n${passed} tests passed`);
