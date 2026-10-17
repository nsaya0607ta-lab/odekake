import type { Stage } from "../types";
import glyphs from "./glyphs-025-026.json";

/** KanjiVG (CC BY-SA 3.0) の派生筆画。出典と原図: /licenses/kakure-kanji/README.txt */
const DATA: Omit<Stage, "strokes">[] = [
  {
    "id": "s025-san",
    "number": 25,
    "kanji": "産",
    "reading": "サン・うむ",
    "difficulty": "上級",
    "structure": "上に立、下に生がある。生の中と、外側の屋根を組み合わせてさがそう。",
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
          ],
          [
            5
          ],
          [
            8
          ],
          [
            10
          ],
          [
            11
          ]
        ],
        "evidence": "独立した横画を1本えらぶよ。",
        "partHint": "独立した横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
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
            2,
            5
          ],
          [
            2,
            8
          ],
          [
            2,
            10
          ],
          [
            2,
            11
          ],
          [
            5,
            8
          ],
          [
            5,
            10
          ],
          [
            5,
            11
          ],
          [
            8,
            10
          ],
          [
            8,
            11
          ],
          [
            10,
            11
          ]
        ],
        "evidence": "上下に並ぶ横画を2本えらぶよ。",
        "partHint": "上下に並ぶ横画を2本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
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
            2,
            5,
            8
          ],
          [
            2,
            5,
            10
          ],
          [
            2,
            5,
            11
          ],
          [
            2,
            8,
            10
          ],
          [
            2,
            8,
            11
          ],
          [
            2,
            10,
            11
          ],
          [
            5,
            8,
            10
          ],
          [
            5,
            8,
            11
          ],
          [
            5,
            10,
            11
          ],
          [
            8,
            10,
            11
          ]
        ],
        "evidence": "上下に並ぶ横画を3本えらぶよ。",
        "partHint": "上下に並ぶ横画を3本えらぶよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
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
            8,
            9
          ],
          [
            9,
            10
          ]
        ],
        "evidence": "生の中で、上下に突き出す縦画と横画をえらぶよ。",
        "partHint": "生の中で、上下に突き出す縦画と横画をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
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
            8,
            9,
            11
          ],
          [
            9,
            10,
            11
          ]
        ],
        "evidence": "生の縦画と一番下の横画に、上か中の横画を足すよ。下の横画が長い土だけを正解にする。",
        "partHint": "生の縦画と一番下の横画に、上か中の横画を足すよ。下の横画が長い土だけを正解にする。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "立",
        "readings": [
          "リツ",
          "たつ"
        ],
        "meaning": "たつ",
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
        "evidence": "上の5画で立になるよ。",
        "partHint": "上の5画で立になるよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
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
            7,
            8,
            9,
            10,
            11
          ]
        ],
        "evidence": "下の生を全部えらぶよ。",
        "partHint": "下の生を全部えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
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
            7,
            8,
            9,
            10
          ]
        ],
        "evidence": "生から一番下の横画だけを外すよ。縦画は上下に出る牛の形。",
        "partHint": "生から一番下の横画だけを外すよ。縦画は上下に出る牛の形。",
        "tier": 2,
        "grade": 2,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "圧",
        "readings": [
          "アツ"
        ],
        "meaning": "おす・おさえる",
        "rule": "loose",
        "strokeSets": [
          [
            5,
            6,
            8,
            9,
            11
          ],
          [
            5,
            6,
            9,
            10,
            11
          ]
        ],
        "evidence": "厂の中に、生から取り出した土を残すよ。",
        "partHint": "厂の中に、生から取り出した土を残すよ。",
        "tier": 3,
        "grade": 5,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "厂",
        "readings": [
          "カン",
          "がけ"
        ],
        "meaning": "がけ",
        "rule": "component",
        "strokeSets": [
          [
            5,
            6
          ]
        ],
        "evidence": "中段の長い横画と、左の長い払いをえらぶよ。",
        "partHint": "中段の長い横画と、左の長い払いをえらぶよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "广",
        "readings": [
          "ゲン",
          "いえ"
        ],
        "meaning": "屋根のある建物",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            5,
            6
          ]
        ],
        "evidence": "一番上の点と厂をえらぶよ。点と屋根の間の大きさを見立てる。",
        "partHint": "一番上の点と厂をえらぶよ。点と屋根の間の大きさを見立てる。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "庄",
        "readings": [
          "ショウ"
        ],
        "meaning": "いなか・土地",
        "rule": "loose",
        "strokeSets": [
          [
            1,
            5,
            6,
            8,
            9,
            11
          ],
          [
            1,
            5,
            6,
            9,
            10,
            11
          ]
        ],
        "evidence": "一番上の点と厂、その中に土を残すよ。",
        "partHint": "一番上の点と厂、その中に土を残すよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "王",
        "reading": "オウ",
        "reason": "生の縦画は一番上の横画より上へ突き出すため、王にはしません。",
        "category": "shape"
      },
      {
        "char": "干",
        "reading": "カン",
        "reason": "生の縦画は上の横画より上へ突き出すため、干にはしません。",
        "category": "shape"
      },
      {
        "char": "士",
        "reading": "シ",
        "reason": "下の横画が長い土に合わせ、同じ組は土だけを正解にします。",
        "category": "shape"
      },
      {
        "char": "午",
        "reading": "ゴ",
        "reason": "縦画が上へ突き出す形なので、牛だけを正解にします。",
        "category": "shape"
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
      "checkedOn": "2026-10-18",
      "note": "日本のKanjiVG筆画とKANJIDIC2の学年・読みを照合。全登録と除外理由は docs/kakure-kanji-answers-025-026.md。"
    }
  },
  {
    "id": "s026-gaku",
    "number": 26,
    "kanji": "額",
    "reading": "ガク・ひたい",
    "difficulty": "超上級",
    "structure": "左に客、右に頁がある。目の中の横画や、左右を組み合わせた字もさがそう。",
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
            9
          ],
          [
            10
          ],
          [
            14
          ],
          [
            15
          ],
          [
            16
          ]
        ],
        "evidence": "口の底か、右側の独立した横画を1本えらぶよ。",
        "partHint": "口の底か、右側の独立した横画を1本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
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
            10,
            14
          ],
          [
            10,
            15
          ],
          [
            10,
            16
          ],
          [
            14,
            15
          ],
          [
            14,
            16
          ],
          [
            15,
            16
          ]
        ],
        "evidence": "右側の上下に並ぶ横画を2本えらぶよ。",
        "partHint": "右側の上下に並ぶ横画を2本えらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
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
            10,
            14,
            15
          ],
          [
            10,
            14,
            16
          ],
          [
            10,
            15,
            16
          ],
          [
            14,
            15,
            16
          ]
        ],
        "evidence": "右側の上下に並ぶ横画を3本えらぶよ。",
        "partHint": "右側の上下に並ぶ横画を3本えらぶよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
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
            17,
            18
          ],
          [
            4,
            6
          ]
        ],
        "evidence": "右下の2画、または各の最初の左払いと右払いをえらぶよ。2画が離れて左右へ開く形を見立てる。",
        "partHint": "右下の2画、または各の最初の左払いと右払いをえらぶよ。2画が離れて左右へ開く形を見立てる。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
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
            7,
            8,
            9
          ],
          [
            12,
            13,
            16
          ]
        ],
        "evidence": "左下の口か、右の目から内側の横画2本を外した口をえらぶよ。",
        "partHint": "左下の口か、右の目から内側の横画2本を外した口をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "日",
        "readings": [
          "ニチ",
          "ひ"
        ],
        "meaning": "ひ・たいよう",
        "rule": "loose",
        "strokeSets": [
          [
            12,
            13,
            14,
            16
          ],
          [
            12,
            13,
            15,
            16
          ]
        ],
        "evidence": "右の目の内側から横画を1本外すよ。曰にはせず日だけを正解にする。",
        "partHint": "右の目の内側から横画を1本外すよ。曰にはせず日だけを正解にする。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "目",
        "readings": [
          "モク",
          "め"
        ],
        "meaning": "め",
        "rule": "component",
        "strokeSets": [
          [
            12,
            13,
            14,
            15,
            16
          ]
        ],
        "evidence": "右の貝の上にある目をえらぶよ。",
        "partHint": "右の貝の上にある目をえらぶよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "白",
        "readings": [
          "ハク",
          "しろ"
        ],
        "meaning": "しろ",
        "rule": "loose",
        "strokeSets": [
          [
            11,
            12,
            13,
            14,
            16
          ],
          [
            11,
            12,
            13,
            15,
            16
          ]
        ],
        "evidence": "目の内側の横画を1本外し、上の短い払いを残すよ。",
        "partHint": "目の内側の横画を1本外し、上の短い払いを残すよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "百",
        "readings": [
          "ヒャク"
        ],
        "meaning": "ひゃく",
        "rule": "loose",
        "strokeSets": [
          [
            10,
            11,
            12,
            13,
            14,
            16
          ],
          [
            10,
            11,
            12,
            13,
            15,
            16
          ]
        ],
        "evidence": "白に、右の一番上の横画を足すよ。",
        "partHint": "白に、右の一番上の横画を足すよ。",
        "tier": 2,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "自",
        "readings": [
          "ジ",
          "みずから"
        ],
        "meaning": "みずから",
        "rule": "loose",
        "strokeSets": [
          [
            11,
            12,
            13,
            14,
            15,
            16
          ]
        ],
        "evidence": "目と、その上の短い払いをえらぶよ。",
        "partHint": "目と、その上の短い払いをえらぶよ。",
        "tier": 2,
        "grade": 2,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "貝",
        "readings": [
          "バイ",
          "かい"
        ],
        "meaning": "かい",
        "rule": "component",
        "strokeSets": [
          [
            12,
            13,
            14,
            15,
            16,
            17,
            18
          ]
        ],
        "evidence": "頁の上の横画と短い払いを外すよ。",
        "partHint": "頁の上の横画と短い払いを外すよ。",
        "tier": 1,
        "grade": 1,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "各",
        "readings": [
          "カク",
          "おのおの"
        ],
        "meaning": "それぞれ",
        "rule": "component",
        "strokeSets": [
          [
            4,
            5,
            6,
            7,
            8,
            9
          ]
        ],
        "evidence": "左の客から、うかんむりを外すよ。",
        "partHint": "左の客から、うかんむりを外すよ。",
        "tier": 1,
        "grade": 4,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "客",
        "readings": [
          "キャク",
          "カク"
        ],
        "meaning": "たずねてくる人",
        "rule": "component",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9
          ]
        ],
        "evidence": "左の客を全部えらぶよ。",
        "partHint": "左の客を全部えらぶよ。",
        "tier": 1,
        "grade": 3,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "又",
        "readings": [
          "ユウ",
          "また"
        ],
        "meaning": "また・ふたたび",
        "rule": "loose",
        "strokeSets": [
          [
            5,
            6
          ]
        ],
        "evidence": "各の上の3画から、最初の左払いを外すよ。横から左下へ折れる画と右払いが交わる。",
        "partHint": "各の上の3画から、最初の左払いを外すよ。横から左下へ折れる画と右払いが交わる。",
        "tier": 3,
        "grade": null,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "只",
        "readings": [
          "シ",
          "ただ"
        ],
        "meaning": "ただ・それだけ",
        "rule": "loose",
        "strokeSets": [
          [
            12,
            13,
            16,
            17,
            18
          ]
        ],
        "evidence": "右側に口と、その下の八を残すよ。",
        "partHint": "右側に口と、その下の八を残すよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "唄",
        "readings": [
          "バイ",
          "うた"
        ],
        "meaning": "うた",
        "rule": "loose",
        "strokeSets": [
          [
            7,
            8,
            9,
            12,
            13,
            14,
            15,
            16,
            17,
            18
          ]
        ],
        "evidence": "左下の口と右の貝をえらぶよ。左右の部品の大きさを見立てる。",
        "partHint": "左下の口と右の貝をえらぶよ。左右の部品の大きさを見立てる。",
        "tier": 3,
        "grade": null,
        "rare": false,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "頁",
        "readings": [
          "ケツ",
          "ページ"
        ],
        "meaning": "ページ・かしら",
        "rule": "component",
        "strokeSets": [
          [
            10,
            11,
            12,
            13,
            14,
            15,
            16,
            17,
            18
          ]
        ],
        "evidence": "右の頁を全部えらぶよ。",
        "partHint": "右の頁を全部えらぶよ。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "咱",
        "readings": [
          "サ",
          "サツ",
          "われ"
        ],
        "meaning": "われ・わたしたち",
        "rule": "loose",
        "strokeSets": [
          [
            7,
            8,
            9,
            11,
            12,
            13,
            14,
            15,
            16
          ]
        ],
        "evidence": "左下の口と右の自をえらぶよ。左右の部品の大きさを見立てる。",
        "partHint": "左下の口と右の自をえらぶよ。左右の部品の大きさを見立てる。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      },
      {
        "char": "咟",
        "readings": [
          "カク"
        ],
        "meaning": "さけぶ",
        "rule": "loose",
        "strokeSets": [
          [
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14,
            16
          ],
          [
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            15,
            16
          ]
        ],
        "evidence": "左下の口と右の百をえらぶよ。左右の部品の大きさを見立てる。",
        "partHint": "左下の口と右の百をえらぶよ。左右の部品の大きさを見立てる。",
        "tier": 3,
        "grade": null,
        "rare": true,
        "verification": {
          "status": "verified",
          "note": "日本のKanjiVG原図と全筆画の組を照合。切断・移動なし。長さや部品の比率を見立てるが、向き・接続・上下左右は維持する。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "見",
        "reading": "ケン",
        "reason": "右下に必要な曲がり・はねがなく、点を曲がる画には変えません。",
        "category": "missing"
      },
      {
        "char": "曰",
        "reading": "エツ",
        "reason": "日と区別せず、日だけを正解にします。",
        "category": "shape"
      },
      {
        "char": "名",
        "reading": "メイ",
        "reason": "各の右払いは交差して外へ出るため、夕の内側の点にはできません。",
        "category": "shape"
      },
      {
        "char": "宀",
        "reading": "ベン",
        "reason": "うかんむりだけの形は答えにしません。",
        "category": "radical"
      },
      {
        "char": "夂",
        "reading": "チ",
        "reason": "各の上の部首だけの形は答えにしません。",
        "category": "radical"
      }
    ],
    "reward": {
      "coins": 70,
      "exp": 110,
      "replayCoins": 12,
      "replayExp": 22
    },
    "verification": {
      "status": "verified",
      "checkedOn": "2026-10-18",
      "note": "日本のKanjiVG筆画とKANJIDIC2の学年・読みを照合。全登録と除外理由は docs/kakure-kanji-answers-025-026.md。"
    }
  }
];

export const STAGES_025_026: Stage[] = DATA.map(stage => ({ ...stage, strokes: glyphs[stage.kanji as keyof typeof glyphs] as Stage["strokes"] }));
