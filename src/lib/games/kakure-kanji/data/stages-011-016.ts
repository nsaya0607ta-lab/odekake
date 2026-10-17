import type { Stage } from "../types";
import glyphs from "./glyphs-011-016.json";

/** 筆画は KanjiVG (CC BY-SA 3.0) の派生データ。出典・原図: /licenses/kakure-kanji/README.txt */
const STAGE_DATA: Omit<Stage, "strokes">[] = [
  {
    "id": "s011-kyuu",
    "number": 11,
    "kanji": "休",
    "reading": "キュウ・やすむ",
    "difficulty": "中級",
    "structure": "左ににんべん、右に木がある。木の中の線や、左と右をまたぐ組み合わせもさがそう。",
    "answers": [
      {
        "char": "一",
        "readings": [
          "イチ",
          "ひとつ"
        ],
        "meaning": "ひとつ",
        "rule": "strokes",
        "strokeSets": [
          [
            3
          ]
        ],
        "evidence": "右の木の横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "右の木の横画を1本えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "十",
        "readings": [
          "ジュウ",
          "とお"
        ],
        "meaning": "とお",
        "rule": "strokes",
        "strokeSets": [
          [
            3,
            4
          ]
        ],
        "evidence": "右の木から、交わる横画と縦画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "右の木から、交わる横画と縦画をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "木",
        "readings": [
          "モク",
          "ボク",
          "き"
        ],
        "meaning": "き",
        "rule": "component",
        "strokeSets": [
          [
            3,
            4,
            5,
            6
          ]
        ],
        "evidence": "右の木をそのまま全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "右の木をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "人",
        "readings": [
          "ジン",
          "ニン",
          "ひと"
        ],
        "meaning": "ひと",
        "rule": "loose",
        "strokeSets": [
          [
            5,
            6
          ]
        ],
        "evidence": "右の木から、つながる左右の払い2本をえらぶよ。入にはせず、人だけを正解にする。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "右の木から、つながる左右の払い2本をえらぶよ。入にはせず、人だけを正解にする。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "八",
        "readings": [
          "ハチ",
          "やっつ"
        ],
        "meaning": "やっつ",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            6
          ]
        ],
        "evidence": "一番左の左払いと、一番右の右払いをえらぶよ。2本は左右にはなれている。",
        "tier": 3,
        "grade": 1,
        "rare": false,
        "partHint": "一番左の左払いと、一番右の右払いをえらぶよ。2本は左右にはなれている。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "什",
        "readings": [
          "ジュウ",
          "シュウ"
        ],
        "meaning": "十をひと組とした数・日常の道具",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            3,
            4
          ]
        ],
        "evidence": "左のにんべんに、右の木から十になる横画と縦画を足すよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "左のにんべんに、右の木から十になる横画と縦画を足すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "大",
        "reading": "ダイ（おおきい）",
        "category": "shape",
        "reason": "木の縦画を外すと、左払いが横画より上に突き出しません。大に必要な上の部分を足したり伸ばしたりはできないので、正解にはしません。"
      },
      {
        "char": "入",
        "reading": "ニュウ",
        "category": "shape",
        "reason": "右の木の払いは人に近い形なので、人だけを正解にします。"
      },
      {
        "char": "丁",
        "reading": "チョウ",
        "category": "shape",
        "reason": "木の縦画は横画より上にも出ています。上の部分を切って丁にはできません。"
      },
      {
        "char": "小",
        "reading": "ショウ",
        "category": "missing",
        "reason": "休には小の右側に使える独立した点がありません。右払いを点に変えて小にはしません。"
      }
    ],
    "reward": {
      "coins": 60,
      "exp": 90,
      "replayCoins": 12,
      "replayExp": 22
    },
    "verification": {
      "status": "verified",
      "checkedOn": "2026-10-17",
      "note": "KanjiVGの日本の筆画図、KANJIDIC2の読み・学年を照合。全候補・全筆画の組・除外理由は docs/kakure-kanji-answers-011-016.md。同じ線の組に正解を重複させず、曰は使わない。 2026-10-17再確認：横画より上への突き出しが欠ける大と、その形を前提にする派生字を除外。"
    }
  },
  {
    "id": "s012-tai",
    "number": 12,
    "kanji": "体",
    "reading": "タイ・からだ",
    "difficulty": "上級",
    "structure": "左ににんべん、右に本がある。本の下の短い横画を外した形もさがそう。",
    "answers": [
      {
        "char": "一",
        "readings": [
          "イチ",
          "ひとつ"
        ],
        "meaning": "ひとつ",
        "rule": "strokes",
        "strokeSets": [
          [
            3
          ],
          [
            7
          ]
        ],
        "evidence": "本にある独立した横画を、どちらか1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "本にある独立した横画を、どちらか1本えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "二",
        "readings": [
          "ニ",
          "ふたつ"
        ],
        "meaning": "ふたつ",
        "rule": "loose",
        "strokeSets": [
          [
            3,
            7
          ]
        ],
        "evidence": "本の上と下の横画だけをえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "本の上と下の横画だけをえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "十",
        "readings": [
          "ジュウ",
          "とお"
        ],
        "meaning": "とお",
        "rule": "loose",
        "strokeSets": [
          [
            3,
            4
          ],
          [
            4,
            7
          ]
        ],
        "evidence": "本の縦画と、上か下の横画をえらぶよ。どちらも縦画が横画の上下に出ている。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "本の縦画と、上か下の横画をえらぶよ。どちらも縦画が横画の上下に出ている。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "木",
        "readings": [
          "モク",
          "ボク",
          "き"
        ],
        "meaning": "き",
        "rule": "strokes",
        "strokeSets": [
          [
            3,
            4,
            5,
            6
          ]
        ],
        "evidence": "右の本から、一番下の短い横画だけを外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "右の本から、一番下の短い横画だけを外すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "本",
        "readings": [
          "ホン",
          "もと"
        ],
        "meaning": "もと・書物",
        "rule": "component",
        "strokeSets": [
          [
            3,
            4,
            5,
            6,
            7
          ]
        ],
        "evidence": "右の本をそのまま全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "右の本をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "人",
        "readings": [
          "ジン",
          "ニン",
          "ひと"
        ],
        "meaning": "ひと",
        "rule": "loose",
        "strokeSets": [
          [
            5,
            6
          ]
        ],
        "evidence": "本から、つながる左右の払い2本だけをえらぶよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "本から、つながる左右の払い2本だけをえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "八",
        "readings": [
          "ハチ",
          "やっつ"
        ],
        "meaning": "やっつ",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            6
          ]
        ],
        "evidence": "一番左の左払いと、一番右の右払いをえらぶよ。2本は左右にはなれている。",
        "tier": 3,
        "grade": 1,
        "rare": false,
        "partHint": "一番左の左払いと、一番右の右払いをえらぶよ。2本は左右にはなれている。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "休",
        "readings": [
          "キュウ",
          "やすむ"
        ],
        "meaning": "やすむ",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5,
            6
          ]
        ],
        "evidence": "体の一番下の短い横画だけを外すと、にんべんと木が残るよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "体の一番下の短い横画だけを外すと、にんべんと木が残るよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "仁",
        "readings": [
          "ジン",
          "ニ"
        ],
        "meaning": "思いやり・いつくしみ",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            3,
            7
          ]
        ],
        "evidence": "左のにんべんと、右の本の横画2本をえらぶよ。",
        "tier": 3,
        "grade": 6,
        "rare": false,
        "partHint": "左のにんべんと、右の本の横画2本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "什",
        "readings": [
          "ジュウ",
          "シュウ"
        ],
        "meaning": "十をひと組とした数・日常の道具",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            3,
            4
          ],
          [
            1,
            2,
            4,
            7
          ]
        ],
        "evidence": "にんべんと、本の中から十になる縦画・横画をえらぶよ。横画は上でも下でもよい。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "にんべんと、本の中から十になる縦画・横画をえらぶよ。横画は上でも下でもよい。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "大",
        "reading": "ダイ（おおきい）",
        "category": "shape",
        "reason": "木の縦画を外すと、左払いが横画より上に突き出しません。大に必要な上の部分を足したり伸ばしたりはできないので、正解にはしません。"
      },
      {
        "char": "土",
        "reading": "ド",
        "category": "shape",
        "reason": "本の縦画は下の横画より下まで続くので、土にはしません。"
      },
      {
        "char": "士",
        "reading": "シ",
        "category": "shape",
        "reason": "本の縦画は下の横画で止まりません。途中を切って士にはできません。"
      },
      {
        "char": "未",
        "reading": "ミ",
        "category": "shape",
        "reason": "右の5画は本の形です。下の横画を上へ動かして未にはしません。"
      },
      {
        "char": "末",
        "reading": "マツ",
        "category": "shape",
        "reason": "右の5画は本の形です。下の横画を上へ動かして末にはしません。"
      },
      {
        "char": "入",
        "reading": "ニュウ",
        "category": "shape",
        "reason": "つながる払い2本は人に近いので、人だけを正解にします。"
      }
    ],
    "reward": {
      "coins": 60,
      "exp": 90,
      "replayCoins": 12,
      "replayExp": 22
    },
    "verification": {
      "status": "verified",
      "checkedOn": "2026-10-17",
      "note": "KanjiVGの日本の筆画図、KANJIDIC2の読み・学年を照合。全候補・全筆画の組・除外理由は docs/kakure-kanji-answers-011-016.md。同じ線の組に正解を重複させず、曰は使わない。 2026-10-17再確認：横画より上への突き出しが欠ける大と、その形を前提にする派生字を除外。"
    }
  },
  {
    "id": "s013-sou",
    "number": 13,
    "kanji": "早",
    "reading": "ソウ・はやい",
    "difficulty": "上級",
    "structure": "上の日と下の十からできている。日を残して足す横画や、日を外して残る形もさがそう。",
    "answers": [
      {
        "char": "一",
        "readings": [
          "イチ",
          "ひとつ"
        ],
        "meaning": "ひとつ",
        "rule": "strokes",
        "strokeSets": [
          [
            3
          ],
          [
            4
          ],
          [
            5
          ]
        ],
        "evidence": "独立した横画3本のうち、どれか1本をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "独立した横画3本のうち、どれか1本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "二",
        "readings": [
          "ニ",
          "ふたつ"
        ],
        "meaning": "ふたつ",
        "rule": "loose",
        "strokeSets": [
          [
            3,
            4
          ],
          [
            3,
            5
          ],
          [
            4,
            5
          ]
        ],
        "evidence": "独立した横画3本から、上下に並ぶ2本をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "独立した横画3本から、上下に並ぶ2本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "三",
        "readings": [
          "サン",
          "みっつ"
        ],
        "meaning": "みっつ",
        "rule": "loose",
        "strokeSets": [
          [
            3,
            4,
            5
          ]
        ],
        "evidence": "独立した横画3本を全部えらぶよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "独立した横画3本を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "十",
        "readings": [
          "ジュウ",
          "とお"
        ],
        "meaning": "とお",
        "rule": "component",
        "strokeSets": [
          [
            5,
            6
          ]
        ],
        "evidence": "下の十をそのまま全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "下の十をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "口",
        "readings": [
          "コウ",
          "くち"
        ],
        "meaning": "くち",
        "rule": "strokes",
        "strokeSets": [
          [
            1,
            2,
            4
          ]
        ],
        "evidence": "上の日から、中の横画だけを外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "上の日から、中の横画だけを外すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "日",
        "readings": [
          "ニチ",
          "ジツ",
          "ひ"
        ],
        "meaning": "ひ・たいよう",
        "rule": "component",
        "strokeSets": [
          [
            1,
            2,
            3,
            4
          ]
        ],
        "evidence": "上の日をそのまま全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "上の日をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "干",
        "readings": [
          "カン",
          "ほす"
        ],
        "meaning": "ほす",
        "rule": "loose",
        "strokeSets": [
          [
            4,
            5,
            6
          ]
        ],
        "evidence": "日の底の横画と、下の十をえらぶよ。縦画は上の横画から下へ続く。",
        "tier": 2,
        "grade": 6,
        "rare": false,
        "partHint": "日の底の横画と、下の十をえらぶよ。縦画は上の横画から下へ続く。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "丁",
        "readings": [
          "チョウ",
          "テイ"
        ],
        "meaning": "区画や順序を表す字",
        "rule": "loose",
        "strokeSets": [
          [
            4,
            6
          ]
        ],
        "evidence": "日の底の横画と、そこから下へ続く縦画をえらぶよ。小さなはねの有無は見立てる。",
        "tier": 3,
        "grade": 3,
        "rare": false,
        "partHint": "日の底の横画と、そこから下へ続く縦画をえらぶよ。小さなはねの有無は見立てる。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "旦",
        "readings": [
          "タン",
          "ダン",
          "あさ"
        ],
        "meaning": "あさ・夜明け",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5
          ]
        ],
        "evidence": "上の日と、その下にある横画1本をえらぶよ。下の縦画はえらばない。",
        "tier": 3,
        "grade": null,
        "rare": false,
        "partHint": "上の日と、その下にある横画1本をえらぶよ。下の縦画はえらばない。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "甲",
        "reading": "コウ",
        "category": "shape",
        "reason": "下の縦画は日の内部の上までは続きません。田を作って下へ突き出す甲にはできません。"
      },
      {
        "char": "申",
        "reading": "シン",
        "category": "shape",
        "reason": "下の縦画は日の上へは出ていません。線を伸ばして申にはできません。"
      },
      {
        "char": "土",
        "reading": "ド",
        "category": "shape",
        "reason": "下の縦画の上端は日の底の横画に接する位置です。上へ出る部分を足して土にはしません。"
      },
      {
        "char": "士",
        "reading": "シ",
        "category": "shape",
        "reason": "下の縦画は下の横画より下へ続きます。士にはしません。"
      }
    ],
    "reward": {
      "coins": 60,
      "exp": 90,
      "replayCoins": 12,
      "replayExp": 22
    },
    "verification": {
      "status": "verified",
      "checkedOn": "2026-10-17",
      "note": "KanjiVGの日本の筆画図、KANJIDIC2の読み・学年を照合。全候補・全筆画の組・除外理由は docs/kakure-kanji-answers-011-016.md。同じ線の組に正解を重複させず、曰は使わない。"
    }
  },
  {
    "id": "s014-hoshi",
    "number": 14,
    "kanji": "星",
    "reading": "セイ・ショウ・ほし",
    "difficulty": "上級",
    "structure": "上に日、下に生がある。生の中では、縦画がどこからどこまで続くかも見てみよう。",
    "answers": [
      {
        "char": "一",
        "readings": [
          "イチ",
          "ひとつ"
        ],
        "meaning": "ひとつ",
        "rule": "strokes",
        "strokeSets": [
          [
            3
          ],
          [
            4
          ],
          [
            6
          ],
          [
            8
          ],
          [
            9
          ]
        ],
        "evidence": "日か生にある独立した横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "日か生にある独立した横画を1本えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "二",
        "readings": [
          "ニ",
          "ふたつ"
        ],
        "meaning": "ふたつ",
        "rule": "loose",
        "strokeSets": [
          [
            3,
            4
          ],
          [
            3,
            6
          ],
          [
            3,
            8
          ],
          [
            3,
            9
          ],
          [
            4,
            6
          ],
          [
            4,
            8
          ],
          [
            4,
            9
          ],
          [
            6,
            8
          ],
          [
            6,
            9
          ],
          [
            8,
            9
          ]
        ],
        "evidence": "独立した横画5本から、上下に並ぶ2本をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "独立した横画5本から、上下に並ぶ2本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "三",
        "readings": [
          "サン",
          "みっつ"
        ],
        "meaning": "みっつ",
        "rule": "loose",
        "strokeSets": [
          [
            3,
            4,
            6
          ],
          [
            3,
            4,
            8
          ],
          [
            3,
            4,
            9
          ],
          [
            3,
            6,
            8
          ],
          [
            3,
            6,
            9
          ],
          [
            3,
            8,
            9
          ],
          [
            4,
            6,
            8
          ],
          [
            4,
            6,
            9
          ],
          [
            4,
            8,
            9
          ],
          [
            6,
            8,
            9
          ]
        ],
        "evidence": "独立した横画5本から、上下に並ぶ3本をえらぶよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "独立した横画5本から、上下に並ぶ3本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "十",
        "readings": [
          "ジュウ",
          "とお"
        ],
        "meaning": "とお",
        "rule": "loose",
        "strokeSets": [
          [
            6,
            7
          ],
          [
            7,
            8
          ]
        ],
        "evidence": "生の縦画と、上か中の横画をえらぶよ。縦画が横画の上下に出る組だけが十になる。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "生の縦画と、上か中の横画をえらぶよ。縦画が横画の上下に出る組だけが十になる。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "口",
        "readings": [
          "コウ",
          "くち"
        ],
        "meaning": "くち",
        "rule": "strokes",
        "strokeSets": [
          [
            1,
            2,
            4
          ]
        ],
        "evidence": "上の日から、中の横画だけを外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "上の日から、中の横画だけを外すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "日",
        "readings": [
          "ニチ",
          "ジツ",
          "ひ"
        ],
        "meaning": "ひ・たいよう",
        "rule": "component",
        "strokeSets": [
          [
            1,
            2,
            3,
            4
          ]
        ],
        "evidence": "上の日をそのまま全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "上の日をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "生",
        "readings": [
          "セイ",
          "ショウ",
          "いきる"
        ],
        "meaning": "いきる・うまれる",
        "rule": "component",
        "strokeSets": [
          [
            5,
            6,
            7,
            8,
            9
          ]
        ],
        "evidence": "下の生をそのまま全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "下の生をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "土",
        "readings": [
          "ド",
          "ト",
          "つち"
        ],
        "meaning": "つち",
        "rule": "loose",
        "strokeSets": [
          [
            6,
            7,
            9
          ],
          [
            7,
            8,
            9
          ]
        ],
        "evidence": "生の縦画と一番下の長い横画に、上か中の横画を足すよ。下の横画が長い土になる。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "生の縦画と一番下の長い横画に、上か中の横画を足すよ。下の横画が長い土になる。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "牛",
        "readings": [
          "ギュウ",
          "うし"
        ],
        "meaning": "うし",
        "rule": "loose",
        "strokeSets": [
          [
            5,
            6,
            7,
            8
          ]
        ],
        "evidence": "生の一番下の横画を外すよ。縦画が残した横画の上にも下にも突き出すので、午にはせず牛だけを正解にする。",
        "tier": 3,
        "grade": 2,
        "rare": false,
        "partHint": "生の一番下の横画を外すよ。縦画が残した横画の上にも下にも突き出すので、午にはせず牛だけを正解にする。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "旦",
        "readings": [
          "タン",
          "ダン",
          "あさ"
        ],
        "meaning": "あさ・夜明け",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            6
          ],
          [
            1,
            2,
            3,
            4,
            8
          ],
          [
            1,
            2,
            3,
            4,
            9
          ]
        ],
        "evidence": "上の日に、その下の独立した横画を1本足すよ。日より下の横画3本のどれでもよい。",
        "tier": 3,
        "grade": null,
        "rare": false,
        "partHint": "上の日に、その下の独立した横画を1本足すよ。日より下の横画3本のどれでもよい。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "王",
        "reading": "オウ",
        "category": "shape",
        "reason": "生の縦画は一番上の横画より上へ出ています。上の部分を切って王にはできません。"
      },
      {
        "char": "午",
        "reading": "ゴ",
        "category": "shape",
        "reason": "牛になる組では縦画の上部が横画より上へ出るため、午にはしません。"
      },
      {
        "char": "士",
        "reading": "シ",
        "category": "shape",
        "reason": "一番下まで選ぶと、下の横画が長い土の形です。士は正解にしません。"
      }
    ],
    "reward": {
      "coins": 60,
      "exp": 90,
      "replayCoins": 12,
      "replayExp": 22
    },
    "verification": {
      "status": "verified",
      "checkedOn": "2026-10-17",
      "note": "KanjiVGの日本の筆画図、KANJIDIC2の読み・学年を照合。全候補・全筆画の組・除外理由は docs/kakure-kanji-answers-011-016.md。同じ線の組に正解を重複させず、曰は使わない。"
    }
  },
  {
    "id": "s015-aki",
    "number": 15,
    "kanji": "秋",
    "reading": "シュウ・あき",
    "difficulty": "上級",
    "structure": "左の禾と右の火からできている。禾の右下は短い点なので、右払いへ変えずにさがそう。",
    "answers": [
      {
        "char": "一",
        "readings": [
          "イチ",
          "ひとつ"
        ],
        "meaning": "ひとつ",
        "rule": "strokes",
        "strokeSets": [
          [
            2
          ]
        ],
        "evidence": "禾の中の横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "禾の中の横画を1本えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "十",
        "readings": [
          "ジュウ",
          "とお"
        ],
        "meaning": "とお",
        "rule": "strokes",
        "strokeSets": [
          [
            2,
            3
          ]
        ],
        "evidence": "禾の中で交わる横画と縦画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "禾の中で交わる横画と縦画をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "千",
        "readings": [
          "セン",
          "ち"
        ],
        "meaning": "せん",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            3
          ]
        ],
        "evidence": "禾の上の3画をえらぶよ。左右の枝はえらばない。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "禾の上の3画をえらぶよ。左右の枝はえらばない。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "木",
        "readings": [
          "モク",
          "ボク",
          "き"
        ],
        "meaning": "き",
        "rule": "component",
        "strokeSets": [
          [
            2,
            3,
            4,
            5
          ]
        ],
        "evidence": "禾の一番上の払いだけを外すよ。偏の短い点も木の部品に含める。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "禾の一番上の払いだけを外すよ。偏の短い点も木の部品に含める。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "火",
        "readings": [
          "カ",
          "ひ"
        ],
        "meaning": "ひ・ほのお",
        "rule": "component",
        "strokeSets": [
          [
            6,
            7,
            8,
            9
          ]
        ],
        "evidence": "右の火をそのまま全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "右の火をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "人",
        "readings": [
          "ジン",
          "ニン",
          "ひと"
        ],
        "meaning": "ひと",
        "rule": "loose",
        "strokeSets": [
          [
            8,
            9
          ]
        ],
        "evidence": "火の中心から左右へはらう2本だけをえらぶよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "火の中心から左右へはらう2本だけをえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "八",
        "readings": [
          "ハチ",
          "やっつ"
        ],
        "meaning": "やっつ",
        "rule": "loose",
        "strokeSets": [
          [
            4,
            9
          ]
        ],
        "evidence": "禾の左払いと、火の右払いをえらぶよ。2本は左右にはなれている。",
        "tier": 3,
        "grade": 1,
        "rare": false,
        "partHint": "禾の左払いと、火の右払いをえらぶよ。2本は左右にはなれている。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "禾",
        "readings": [
          "カ",
          "いね"
        ],
        "meaning": "いね",
        "rule": "component",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5
          ]
        ],
        "evidence": "左の禾をそのまま全部えらぶよ。禾は独立した漢字でもある。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "左の禾をそのまま全部えらぶよ。禾は独立した漢字でもある。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "卜",
        "readings": [
          "ボク",
          "うらなう"
        ],
        "meaning": "うらなう",
        "rule": "strokes",
        "strokeSets": [
          [
            3,
            5
          ]
        ],
        "evidence": "禾の縦画と、その右にある短い点だけをえらぶよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "禾の縦画と、その右にある短い点だけをえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "大",
        "reading": "ダイ",
        "category": "shape",
        "reason": "左の禾の右下は点なので、大の右払いには変えません。"
      },
      {
        "char": "小",
        "reading": "ショウ",
        "category": "shape",
        "reason": "禾の左払いは縦画につながるため、左右の画がはなれる小にはしません。"
      },
      {
        "char": "下",
        "reading": "カ",
        "category": "shape",
        "reason": "禾の縦画は横画より上にも続きます。上の部分を切って下にはできません。"
      },
      {
        "char": "化",
        "reading": "カ",
        "category": "shape",
        "reason": "火の払い2本を、曲がる画を含む匕へ変えることはできません。"
      }
    ],
    "reward": {
      "coins": 60,
      "exp": 90,
      "replayCoins": 12,
      "replayExp": 22
    },
    "verification": {
      "status": "verified",
      "checkedOn": "2026-10-17",
      "note": "KanjiVGの日本の筆画図、KANJIDIC2の読み・学年を照合。全候補・全筆画の組・除外理由は docs/kakure-kanji-answers-011-016.md。同じ線の組に正解を重複させず、曰は使わない。"
    }
  },
  {
    "id": "s016-hare",
    "number": 16,
    "kanji": "晴",
    "reading": "セイ・はれる",
    "difficulty": "上級",
    "structure": "左に日、右に青がある。青の上と下の部品も見ながら、左の口や日と組み合わせてみよう。",
    "answers": [
      {
        "char": "一",
        "readings": [
          "イチ",
          "ひとつ"
        ],
        "meaning": "ひとつ",
        "rule": "strokes",
        "strokeSets": [
          [
            3
          ],
          [
            4
          ],
          [
            5
          ],
          [
            7
          ],
          [
            8
          ],
          [
            11
          ],
          [
            12
          ]
        ],
        "evidence": "日か青にある独立した横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "日か青にある独立した横画を1本えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "二",
        "readings": [
          "ニ",
          "ふたつ"
        ],
        "meaning": "ふたつ",
        "rule": "loose",
        "strokeSets": [
          [
            3,
            4
          ],
          [
            5,
            7
          ],
          [
            5,
            8
          ],
          [
            5,
            11
          ],
          [
            5,
            12
          ],
          [
            7,
            8
          ],
          [
            7,
            11
          ],
          [
            7,
            12
          ],
          [
            8,
            11
          ],
          [
            8,
            12
          ],
          [
            11,
            12
          ]
        ],
        "evidence": "左の日の横画2本か、右の青で上下に並ぶ横画2本をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "左の日の横画2本か、右の青で上下に並ぶ横画2本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "三",
        "readings": [
          "サン",
          "みっつ"
        ],
        "meaning": "みっつ",
        "rule": "loose",
        "strokeSets": [
          [
            5,
            7,
            8
          ],
          [
            5,
            7,
            11
          ],
          [
            5,
            7,
            12
          ],
          [
            5,
            8,
            11
          ],
          [
            5,
            8,
            12
          ],
          [
            5,
            11,
            12
          ],
          [
            7,
            8,
            11
          ],
          [
            7,
            8,
            12
          ],
          [
            7,
            11,
            12
          ],
          [
            8,
            11,
            12
          ]
        ],
        "evidence": "右の青にある独立した横画5本から、上下に並ぶ3本をえらぶよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "右の青にある独立した横画5本から、上下に並ぶ3本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "十",
        "readings": [
          "ジュウ",
          "とお"
        ],
        "meaning": "とお",
        "rule": "loose",
        "strokeSets": [
          [
            5,
            6
          ],
          [
            6,
            7
          ]
        ],
        "evidence": "青の上から、縦画が横画の上下に出る2本をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "青の上から、縦画が横画の上下に出る2本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "口",
        "readings": [
          "コウ",
          "くち"
        ],
        "meaning": "くち",
        "rule": "strokes",
        "strokeSets": [
          [
            1,
            2,
            4
          ]
        ],
        "evidence": "左の日から、中の横画だけを外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "左の日から、中の横画だけを外すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "日",
        "readings": [
          "ニチ",
          "ジツ",
          "ひ"
        ],
        "meaning": "ひ・たいよう",
        "rule": "component",
        "strokeSets": [
          [
            1,
            2,
            3,
            4
          ]
        ],
        "evidence": "左の日をそのまま全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "左の日をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "青",
        "readings": [
          "セイ",
          "ショウ",
          "あお"
        ],
        "meaning": "あお",
        "rule": "component",
        "strokeSets": [
          [
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12
          ]
        ],
        "evidence": "右の青をそのまま全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "右の青をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "月",
        "readings": [
          "ゲツ",
          "ガツ",
          "つき"
        ],
        "meaning": "つき",
        "rule": "component",
        "strokeSets": [
          [
            9,
            10,
            11,
            12
          ]
        ],
        "evidence": "青の下にある月の部品を全部えらぶよ。左の縦に近い画も、その部品の形として使う。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "青の下にある月の部品を全部えらぶよ。左の縦に近い画も、その部品の形として使う。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "土",
        "readings": [
          "ド",
          "ト",
          "つち"
        ],
        "meaning": "つち",
        "rule": "loose",
        "strokeSets": [
          [
            5,
            6,
            8
          ],
          [
            6,
            7,
            8
          ]
        ],
        "evidence": "青の上の縦画と、一番下の長い横画に、上か中の横画を足すよ。下の横画が長い土だけを正解にする。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "青の上の縦画と、一番下の長い横画に、上か中の横画を足すよ。下の横画が長い土だけを正解にする。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "明",
        "readings": [
          "メイ",
          "ミョウ",
          "あかるい"
        ],
        "meaning": "あかるい",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            9,
            10,
            11,
            12
          ]
        ],
        "evidence": "左の日と、青の下の月をえらぶよ。左右の位置はそのまま、部品の高さの比率を見立てる。",
        "tier": 3,
        "grade": 2,
        "rare": false,
        "partHint": "左の日と、青の下の月をえらぶよ。左右の位置はそのまま、部品の高さの比率を見立てる。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "吐",
        "readings": [
          "ト",
          "はく"
        ],
        "meaning": "はく・外へ出す",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            4,
            5,
            6,
            8
          ],
          [
            1,
            2,
            4,
            6,
            7,
            8
          ]
        ],
        "evidence": "左の日から口をえらび、青の上から土の形を足すよ。左右の部品の大きさを見立てる。",
        "tier": 3,
        "grade": null,
        "rare": false,
        "partHint": "左の日から口をえらび、青の上から土の形を足すよ。左右の部品の大きさを見立てる。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "叶",
        "readings": [
          "キョウ",
          "かなう"
        ],
        "meaning": "望みがかなう",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            4,
            5,
            6
          ],
          [
            1,
            2,
            4,
            6,
            7
          ]
        ],
        "evidence": "左の日から口をえらび、青の上から十の形を足すよ。左右の部品の大きさを見立てる。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "左の日から口をえらび、青の上から十の形を足すよ。左右の部品の大きさを見立てる。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "王",
        "reading": "オウ",
        "category": "shape",
        "reason": "青の上の縦画は、一番上の横画より上へ出ています。上を切って王にはできません。"
      },
      {
        "char": "士",
        "reading": "シ",
        "category": "shape",
        "reason": "青の上から取り出す3画は下の横画が長い土なので、士にはしません。"
      },
      {
        "char": "丁",
        "reading": "チョウ",
        "category": "shape",
        "reason": "青の縦画は上の横画より上へ出ています。上を切って丁にはできません。"
      }
    ],
    "reward": {
      "coins": 60,
      "exp": 90,
      "replayCoins": 12,
      "replayExp": 22
    },
    "verification": {
      "status": "verified",
      "checkedOn": "2026-10-17",
      "note": "KanjiVGの日本の筆画図、KANJIDIC2の読み・学年を照合。全候補・全筆画の組・除外理由は docs/kakure-kanji-answers-011-016.md。同じ線の組に正解を重複させず、曰は使わない。"
    }
  }
];

export const STAGES_011_016: Stage[] = STAGE_DATA.map((stage) => ({
  ...stage,
  strokes: glyphs[stage.kanji as keyof typeof glyphs] as Stage["strokes"],
}));
