import type { Stage } from "../types";
import glyphs from "./glyphs-017-024.json";

/** 筆画は KanjiVG (CC BY-SA 3.0) の派生データ。出典・原図: /licenses/kakure-kanji/README.txt */
const STAGE_DATA: Omit<Stage, "strokes">[] = [
  {
    "id": "s017-iwa",
    "number": 17,
    "kanji": "岩",
    "reading": "ガン・いわ",
    "difficulty": "中級",
    "structure": "上に山、下に石がある。石の中にある口や、口を外して残る形もさがそう。",
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
            4
          ],
          [
            8
          ]
        ],
        "evidence": "石の上か、口の底にある独立した横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "石の上か、口の底にある独立した横画を1本えらぶよ。",
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
            4,
            8
          ]
        ],
        "evidence": "石の一番上の横画と、口の底の横画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "石の一番上の横画と、口の底の横画をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "山",
        "readings": [
          "サン",
          "やま"
        ],
        "meaning": "やま",
        "rule": "component",
        "strokeSets": [
          [
            1,
            2,
            3
          ]
        ],
        "evidence": "上の山を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "上の山を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "石",
        "readings": [
          "セキ",
          "シャク",
          "いし"
        ],
        "meaning": "いし",
        "rule": "component",
        "strokeSets": [
          [
            4,
            5,
            6,
            7,
            8
          ]
        ],
        "evidence": "下の石を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "下の石を全部えらぶよ。",
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
        "rule": "component",
        "strokeSets": [
          [
            6,
            7,
            8
          ]
        ],
        "evidence": "石の中の口を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "石の中の口を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "厂",
        "readings": [
          "カン",
          "がんだれ"
        ],
        "meaning": "がけの形を表す字",
        "rule": "loose",
        "strokeSets": [
          [
            4,
            5
          ]
        ],
        "evidence": "下の石から口を外して、上の横画と左払いをえらぶよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "下の石から口を外して、上の横画と左払いをえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "右",
        "reading": "ウ",
        "category": "shape",
        "reason": "石の左払いは横画より下から始まります。上へ突き出す形に変えて右にはしません。"
      },
      {
        "char": "出",
        "reading": "シュツ",
        "category": "missing",
        "reason": "山の下にもう一つ山がある形ではありません。石の画を曲げて出にはしません。"
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
      "note": "KanjiVGの筆画図と抽出した線の形・接続・位置を照合。読み・学年はKANJIDIC2。全候補と除外理由は docs/kakure-kanji-answers-017-024.md。同じ筆画の組の正解は一字だけ。"
    }
  },
  {
    "id": "s018-hana",
    "number": 18,
    "kanji": "花",
    "reading": "カ・はな",
    "difficulty": "初級",
    "structure": "上にくさかんむり、下に化がある。下の右側には、さじを表す独立した漢字もある。",
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
            1
          ]
        ],
        "evidence": "くさかんむりの長い横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "くさかんむりの長い横画を1本えらぶよ。",
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
            1,
            2
          ],
          [
            1,
            3
          ]
        ],
        "evidence": "くさかんむりの横画と、左か右の交わる縦画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "くさかんむりの横画と、左か右の交わる縦画をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "化",
        "readings": [
          "カ",
          "ケ",
          "ばける"
        ],
        "meaning": "すがたを変える",
        "rule": "component",
        "strokeSets": [
          [
            4,
            5,
            6,
            7
          ]
        ],
        "evidence": "下の化を全部えらぶよ。",
        "tier": 1,
        "grade": 3,
        "rare": false,
        "partHint": "下の化を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "匕",
        "readings": [
          "ヒ",
          "さじ"
        ],
        "meaning": "さじ",
        "rule": "component",
        "strokeSets": [
          [
            6,
            7
          ]
        ],
        "evidence": "下の化から、右側の払いと曲がる画をえらぶよ。匕はさじを表す漢字でもある。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "下の化から、右側の払いと曲がる画をえらぶよ。匕はさじを表す漢字でもある。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "七",
        "reading": "シチ",
        "category": "shape",
        "reason": "右下の曲がる画は、上のくさかんむりの横画とは接していません。線を伸ばして七にはしません。"
      },
      {
        "char": "人",
        "reading": "ジン",
        "category": "shape",
        "reason": "下の右側の長い画は縦から横へ曲がる画です。まっすぐな右払いへ変えて人にはしません。"
      }
    ],
    "reward": {
      "coins": 40,
      "exp": 60,
      "replayCoins": 12,
      "replayExp": 22
    },
    "verification": {
      "status": "verified",
      "checkedOn": "2026-10-17",
      "note": "KanjiVGの筆画図と抽出した線の形・接続・位置を照合。読み・学年はKANJIDIC2。全候補と除外理由は docs/kakure-kanji-answers-017-024.md。同じ筆画の組の正解は一字だけ。"
    }
  },
  {
    "id": "s019-nae",
    "number": 19,
    "kanji": "苗",
    "reading": "ビョウ・なえ",
    "difficulty": "上級",
    "structure": "上にくさかんむり、下に田がある。田の中央の線を外した形や、上下の横画にも注目しよう。",
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
            1
          ],
          [
            7
          ],
          [
            8
          ]
        ],
        "evidence": "くさかんむりか、田の中と底の独立した横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "くさかんむりか、田の中と底の独立した横画を1本えらぶよ。",
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
            1,
            7
          ],
          [
            1,
            8
          ],
          [
            7,
            8
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
            1,
            7,
            8
          ]
        ],
        "evidence": "くさかんむりの横画と、田の中と底の横画を全部えらぶよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "くさかんむりの横画と、田の中と底の横画を全部えらぶよ。",
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
            1,
            2
          ],
          [
            1,
            3
          ],
          [
            6,
            7
          ]
        ],
        "evidence": "くさかんむりの左右か、田の中央で交わる横画と縦画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "くさかんむりの左右か、田の中央で交わる横画と縦画をえらぶよ。",
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
            4,
            5,
            8
          ]
        ],
        "evidence": "田の中央の縦画と横画を外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中央の縦画と横画を外すよ。",
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
        "rule": "strokes",
        "strokeSets": [
          [
            4,
            5,
            7,
            8
          ]
        ],
        "evidence": "田の中央の縦画だけを外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中央の縦画だけを外すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "田",
        "readings": [
          "デン",
          "た"
        ],
        "meaning": "た・たんぼ",
        "rule": "component",
        "strokeSets": [
          [
            4,
            5,
            6,
            7,
            8
          ]
        ],
        "evidence": "下の田を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "下の田を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "士",
        "readings": [
          "シ",
          "さむらい"
        ],
        "meaning": "さむらい",
        "rule": "loose",
        "strokeSets": [
          [
            6,
            7,
            8
          ]
        ],
        "evidence": "田の中央の縦画と横画2本をえらぶよ。上の横画が長いので、士だけを正解にする。",
        "tier": 3,
        "grade": 5,
        "rare": false,
        "partHint": "田の中央の縦画と横画2本をえらぶよ。上の横画が長いので、士だけを正解にする。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "土",
        "reading": "ド",
        "category": "shape",
        "reason": "田の中央と底の横画は上のほうが長く描かれているため、士だけを正解にします。"
      },
      {
        "char": "古",
        "reading": "コ",
        "category": "position",
        "reason": "くさかんむりから取り出した十の縦画は、下の口には接していません。間の線を足して古にはしません。"
      },
      {
        "char": "中",
        "reading": "チュウ",
        "category": "shape",
        "reason": "田の中央の縦画は四角の上下へ突き出していないため、中にはしません。"
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
      "note": "KanjiVGの筆画図と抽出した線の形・接続・位置を照合。読み・学年はKANJIDIC2。全候補と除外理由は docs/kakure-kanji-answers-017-024.md。同じ筆画の組の正解は一字だけ。"
    }
  },
  {
    "id": "s020-otoko",
    "number": 20,
    "kanji": "男",
    "reading": "ダン・ナン・おとこ",
    "difficulty": "上級",
    "structure": "上に田、下に力がある。下の左払いは、折れた画より上から始まる一画なので、途中で切らずに見よう。",
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
            4
          ],
          [
            5
          ]
        ],
        "evidence": "田の中か底の独立した横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中か底の独立した横画を1本えらぶよ。",
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
            4,
            5
          ]
        ],
        "evidence": "田の中と底の横画を両方えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中と底の横画を両方えらぶよ。",
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
        "evidence": "田の中央で交わる横画と縦画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中央で交わる横画と縦画をえらぶよ。",
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
            5
          ]
        ],
        "evidence": "田の中央の縦画と横画を外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中央の縦画と横画を外すよ。",
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
        "rule": "strokes",
        "strokeSets": [
          [
            1,
            2,
            4,
            5
          ]
        ],
        "evidence": "田の中央の縦画だけを外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中央の縦画だけを外すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "田",
        "readings": [
          "デン",
          "た"
        ],
        "meaning": "た・たんぼ",
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
        "evidence": "上の田を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "上の田を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "士",
        "readings": [
          "シ",
          "さむらい"
        ],
        "meaning": "さむらい",
        "rule": "loose",
        "strokeSets": [
          [
            3,
            4,
            5
          ]
        ],
        "evidence": "田の中央の縦画と横画2本をえらぶよ。上の横画が長いので、士だけを正解にする。",
        "tier": 3,
        "grade": 5,
        "rare": false,
        "partHint": "田の中央の縦画と横画2本をえらぶよ。上の横画が長いので、士だけを正解にする。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "力",
        "readings": [
          "リョク",
          "リキ",
          "ちから"
        ],
        "meaning": "ちから",
        "rule": "component",
        "strokeSets": [
          [
            6,
            7
          ]
        ],
        "evidence": "下の力を全部えらぶよ。左払いは上から長く続いているので、刀にはしない。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "下の力を全部えらぶよ。左払いは上から長く続いているので、刀にはしない。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "另",
        "readings": [
          "レイ",
          "リョウ",
          "べつの"
        ],
        "meaning": "べつの・分かれる",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            5,
            6,
            7
          ]
        ],
        "evidence": "上の田から口をえらび、下の力を全部足すよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "上の田から口をえらび、下の力を全部足すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "刀",
        "reading": "トウ",
        "category": "shape",
        "reason": "力の左払いは、折れた画の横線より上から始まります。上の部分を切って刀にはしません。"
      },
      {
        "char": "万",
        "reading": "マン",
        "category": "shape",
        "reason": "下の折れた画の横部分は左払いを越えて左まで続きます。その部分を切って万にはしません。"
      },
      {
        "char": "土",
        "reading": "ド",
        "category": "shape",
        "reason": "田の中央の横画は底の横画より長いので、士だけを正解にします。"
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
      "note": "KanjiVGの筆画図と抽出した線の形・接続・位置を照合。読み・学年はKANJIDIC2。全候補と除外理由は docs/kakure-kanji-answers-017-024.md。同じ筆画の組の正解は一字だけ。"
    }
  },
  {
    "id": "s021-machi",
    "number": 21,
    "kanji": "町",
    "reading": "チョウ・まち",
    "difficulty": "上級",
    "structure": "左に田、右に丁がある。田の中の線を外して、右の丁と組み合わせる字もさがそう。",
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
            4
          ],
          [
            5
          ],
          [
            6
          ]
        ],
        "evidence": "田の中と底、または丁の横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中と底、または丁の横画を1本えらぶよ。",
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
            4,
            5
          ]
        ],
        "evidence": "田の中と底の横画をえらぶよ。右の丁の横画は横にはなれているので組み合わせない。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中と底の横画をえらぶよ。右の丁の横画は横にはなれているので組み合わせない。",
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
        "evidence": "田の中央で交わる横画と縦画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中央で交わる横画と縦画をえらぶよ。",
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
            5
          ]
        ],
        "evidence": "田の中央の縦画と横画を外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中央の縦画と横画を外すよ。",
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
        "rule": "strokes",
        "strokeSets": [
          [
            1,
            2,
            4,
            5
          ]
        ],
        "evidence": "田の中央の縦画だけを外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "田の中央の縦画だけを外すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "田",
        "readings": [
          "デン",
          "た"
        ],
        "meaning": "た・たんぼ",
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
        "evidence": "左の田を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "左の田を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "士",
        "readings": [
          "シ",
          "さむらい"
        ],
        "meaning": "さむらい",
        "rule": "loose",
        "strokeSets": [
          [
            3,
            4,
            5
          ]
        ],
        "evidence": "田の中央の縦画と横画2本をえらぶよ。上の横画が長いので、士だけを正解にする。",
        "tier": 3,
        "grade": 5,
        "rare": false,
        "partHint": "田の中央の縦画と横画2本をえらぶよ。上の横画が長いので、士だけを正解にする。",
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
        "rule": "component",
        "strokeSets": [
          [
            6,
            7
          ]
        ],
        "evidence": "右の丁を全部えらぶよ。",
        "tier": 1,
        "grade": 3,
        "rare": false,
        "partHint": "右の丁を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "叮",
        "readings": [
          "テイ"
        ],
        "meaning": "念を入れて頼む・音のひびき",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            5,
            6,
            7
          ]
        ],
        "evidence": "左の田から口をえらび、右の丁を全部足すよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "左の田から口をえらび、右の丁を全部足すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "土",
        "reading": "ド",
        "category": "shape",
        "reason": "田の中央の横画は底の横画より長いので、士だけを正解にします。"
      },
      {
        "char": "可",
        "reading": "カ",
        "category": "position",
        "reason": "右の丁の横画は、左の口の上まで伸びていません。右上から囲む線を足して可にはしません。"
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
      "note": "KanjiVGの筆画図と抽出した線の形・接続・位置を照合。読み・学年はKANJIDIC2。全候補と除外理由は docs/kakure-kanji-answers-017-024.md。同じ筆画の組の正解は一字だけ。"
    }
  },
  {
    "id": "s022-mura",
    "number": 22,
    "kanji": "村",
    "reading": "ソン・むら",
    "difficulty": "中級",
    "structure": "左に木、右に寸がある。木の右下は短い点で、寸の点は縦画の左側にあることにも注目しよう。",
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
            1
          ],
          [
            5
          ]
        ],
        "evidence": "木か寸の横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "木か寸の横画を1本えらぶよ。",
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
            1,
            2
          ],
          [
            5,
            6
          ]
        ],
        "evidence": "木か寸から、交わる横画と縦画をえらぶよ。寸の縦画の小さなはねだけは見立てる。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "木か寸から、交わる横画と縦画をえらぶよ。寸の縦画の小さなはねだけは見立てる。",
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
            1,
            2,
            3,
            4
          ]
        ],
        "evidence": "左の木を全部えらぶよ。偏の右下の点も木の部品に含める。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "左の木を全部えらぶよ。偏の右下の点も木の部品に含める。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "寸",
        "readings": [
          "スン"
        ],
        "meaning": "長さの単位・わずか",
        "rule": "component",
        "strokeSets": [
          [
            5,
            6,
            7
          ]
        ],
        "evidence": "右の寸を全部えらぶよ。",
        "tier": 1,
        "grade": 6,
        "rare": false,
        "partHint": "右の寸を全部えらぶよ。",
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
            2,
            4
          ]
        ],
        "evidence": "左の木から、縦画とその右の短い点をえらぶよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "左の木から、縦画とその右の短い点をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "付",
        "reading": "フ",
        "category": "shape",
        "reason": "木の縦画は左払いの始点より上に長く出ています。上を切って、にんべんにすることはできません。"
      },
      {
        "char": "下",
        "reading": "カ",
        "category": "shape",
        "reason": "木の縦画は横画より上にも長く出ています。上の部分を切って下にはしません。"
      },
      {
        "char": "朴",
        "reading": "ボク",
        "category": "position",
        "reason": "右の寸の点は縦画の左側にあります。右側へ点を動かして朴にはしません。"
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
      "note": "KanjiVGの筆画図と抽出した線の形・接続・位置を照合。読み・学年はKANJIDIC2。全候補と除外理由は docs/kakure-kanji-answers-017-024.md。同じ筆画の組の正解は一字だけ。"
    }
  },
  {
    "id": "s023-komaru",
    "number": 23,
    "kanji": "困",
    "reading": "コン・こまる",
    "difficulty": "上級",
    "structure": "外の四角の中に木がある。外の四角を残しながら、中の木の線を減らす取り出し方もある。",
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
        "evidence": "内側の木の横画か、外の四角の底の横画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "内側の木の横画か、外の四角の底の横画をえらぶよ。",
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
        "evidence": "内側の木と、外の四角の底の横画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "内側の木と、外の四角の底の横画をえらぶよ。",
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
        "evidence": "内側の木で交わる横画と縦画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "内側の木で交わる横画と縦画をえらぶよ。",
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
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            7
          ]
        ],
        "evidence": "外の四角だけを全部えらぶよ。大きさを見立てて口とする。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "外の四角だけを全部えらぶよ。大きさを見立てて口とする。",
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
        "evidence": "内側の木を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "内側の木を全部えらぶよ。",
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
        "evidence": "内側の木から、つながる左右の払い2本をえらぶよ。人だけを正解にする。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "内側の木から、つながる左右の払い2本をえらぶよ。人だけを正解にする。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "大",
        "readings": [
          "ダイ",
          "タイ",
          "おおきい"
        ],
        "meaning": "おおきい",
        "rule": "loose",
        "strokeSets": [
          [
            3,
            5,
            6
          ]
        ],
        "evidence": "内側の木から、縦画だけを外すよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "partHint": "内側の木から、縦画だけを外すよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "因",
        "readings": [
          "イン",
          "よる"
        ],
        "meaning": "原因・もとになること",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            3,
            5,
            6,
            7
          ]
        ],
        "evidence": "外の四角と、内側の木から大になる3画をえらぶよ。",
        "tier": 3,
        "grade": 5,
        "rare": false,
        "partHint": "外の四角と、内側の木から大になる3画をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "囚",
        "readings": [
          "シュウ",
          "とらわれる"
        ],
        "meaning": "とらわれる",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            5,
            6,
            7
          ]
        ],
        "evidence": "外の四角と、内側の木から人になる払い2本をえらぶよ。",
        "tier": 3,
        "grade": null,
        "rare": false,
        "partHint": "外の四角と、内側の木から人になる払い2本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "入",
        "reading": "ニュウ",
        "category": "shape",
        "reason": "内側の木の払い2本は人に近い形なので、人だけを正解にします。"
      },
      {
        "char": "中",
        "reading": "チュウ",
        "category": "shape",
        "reason": "内側の縦画は外の四角より外へ出ていません。線を伸ばして中にはしません。"
      },
      {
        "char": "回",
        "reading": "カイ",
        "category": "missing",
        "reason": "内側にもう一つ口を作るための折れた画がありません。木の線を曲げて回にはしません。"
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
      "note": "KanjiVGの筆画図と抽出した線の形・接続・位置を照合。読み・学年はKANJIDIC2。全候補と除外理由は docs/kakure-kanji-answers-017-024.md。同じ筆画の組の正解は一字だけ。"
    }
  },
  {
    "id": "s024-mizuumi",
    "number": 24,
    "kanji": "湖",
    "reading": "コ・みずうみ",
    "difficulty": "中級",
    "structure": "左にさんずい、中央に古、右に月がある。古と月を合わせたり、さんずいに別の形を足したりしてみよう。",
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
            4
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
        "evidence": "古か月にある独立した横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "古か月にある独立した横画を1本えらぶよ。",
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
            4,
            8
          ],
          [
            11,
            12
          ]
        ],
        "evidence": "古の横画2本か、月の中の横画2本をえらぶよ。左右にはなれた横画どうしは組み合わせない。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "古の横画2本か、月の中の横画2本をえらぶよ。左右にはなれた横画どうしは組み合わせない。",
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
            4,
            5
          ]
        ],
        "evidence": "中央の古の上の十を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "中央の古の上の十を全部えらぶよ。",
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
        "rule": "component",
        "strokeSets": [
          [
            6,
            7,
            8
          ]
        ],
        "evidence": "中央の古の下の口を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "中央の古の下の口を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "古",
        "readings": [
          "コ",
          "ふるい"
        ],
        "meaning": "ふるい",
        "rule": "component",
        "strokeSets": [
          [
            4,
            5,
            6,
            7,
            8
          ]
        ],
        "evidence": "中央の古を全部えらぶよ。",
        "tier": 1,
        "grade": 2,
        "rare": false,
        "partHint": "中央の古を全部えらぶよ。",
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
        "evidence": "右の月を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "partHint": "右の月を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "胡",
        "readings": [
          "コ",
          "ゴ"
        ],
        "meaning": "外国や遠方を表す字・えびす",
        "rule": "component",
        "strokeSets": [
          [
            4,
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
        "evidence": "さんずいを外し、中央の古と右の月を全部えらぶよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "さんずいを外し、中央の古と右の月を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "汁",
        "readings": [
          "ジュウ",
          "しる"
        ],
        "meaning": "しる",
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
        "evidence": "左のさんずいと、中央の古の上から十をえらぶよ。",
        "tier": 3,
        "grade": null,
        "rare": false,
        "partHint": "左のさんずいと、中央の古の上から十をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      },
      {
        "char": "沽",
        "readings": [
          "コ",
          "うる"
        ],
        "meaning": "うる・買う",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8
          ]
        ],
        "evidence": "左のさんずいと中央の古を全部えらぶよ。右の月はえらばない。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "partHint": "左のさんずいと中央の古を全部えらぶよ。右の月はえらばない。",
        "verification": {
          "status": "verified",
          "note": "KanjiVGの原図と抽出した筆画を照合。線を切らずに使い、向き・接続・位置を確認。同じ組の正解は一字だけ。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "刀",
        "reading": "トウ",
        "category": "position",
        "reason": "月の左払いは上の横画の左端にあります。途中から始まる刀の位置へ動かすことはしません。"
      },
      {
        "char": "力",
        "reading": "リョク",
        "category": "shape",
        "reason": "月の左払いは、上の横画より上へ長く突き出していません。力にはしません。"
      },
      {
        "char": "汀",
        "reading": "テイ",
        "category": "shape",
        "reason": "古の縦画は横画より上へ長く出ています。上を切って丁を作り、さんずいを足すことはしません。"
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
      "note": "KanjiVGの筆画図と抽出した線の形・接続・位置を照合。読み・学年はKANJIDIC2。全候補と除外理由は docs/kakure-kanji-answers-017-024.md。同じ筆画の組の正解は一字だけ。"
    }
  }
];

export const STAGES_017_024: Stage[] = STAGE_DATA.map((stage) => ({
  ...stage,
  strokes: glyphs[stage.kanji as keyof typeof glyphs] as Stage["strokes"],
}));
