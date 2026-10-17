import type { Stage } from "../types";
import glyphs from "./glyphs-004-010.json";

/** 筆画は KanjiVG (CC BY-SA 3.0) を座標変換。出典・原SVG・ライセンス: /licenses/kakure-kanji/README.txt */
const STAGE_DATA = [
  {
    "id": "s004-mori",
    "number": 4,
    "kanji": "森",
    "reading": "シン・もり",
    "difficulty": "上級",
    "structure": "上の木と、下の林（木が2つ）からできている。部品だけでなく、払いを組み合わせた字や、左下の木の中もさがそう。",
    "answers": [
      {
        "char": "一",
        "strokeSets": [
          [
            1
          ],
          [
            5
          ],
          [
            9
          ]
        ],
        "rule": "strokes",
        "evidence": "木の横画1本をえらぶよ。",
        "tier": 1,
        "meaning": "ひとつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "イチ",
          "イツ",
          "ひとつ"
        ],
        "partHint": "木の横画1本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "二",
        "strokeSets": [
          [
            1,
            5
          ],
          [
            1,
            9
          ]
        ],
        "rule": "loose",
        "evidence": "上の横画と、下の左右どちらかの横画をえらぶよ。横の位置が重なる2本だけが二になる。",
        "tier": 1,
        "meaning": "ふたつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニ",
          "ジ",
          "ふたたび"
        ],
        "partHint": "上の横画と、下の左右どちらかの横画をえらぶよ。横の位置が重なる2本だけが二になる。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "十",
        "strokeSets": [
          [
            1,
            2
          ],
          [
            5,
            6
          ],
          [
            9,
            10
          ]
        ],
        "rule": "strokes",
        "evidence": "同じ木の、交わる横画と縦画をえらぶよ。",
        "tier": 1,
        "meaning": "とお・じゅう",
        "grade": 1,
        "rare": false,
        "readings": [
          "ジュウ",
          "ジッ",
          "そ"
        ],
        "partHint": "同じ木の、交わる横画と縦画をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "木",
        "strokeSets": [
          [
            1,
            2,
            3,
            4
          ],
          [
            5,
            6,
            7,
            8
          ],
          [
            9,
            10,
            11,
            12
          ]
        ],
        "rule": "component",
        "evidence": "3つある木のうち、どれか1つをえらぶよ。偏になる木の短い点も、その木の部品に含める。",
        "tier": 1,
        "meaning": "き",
        "grade": 1,
        "rare": false,
        "readings": [
          "ボク",
          "モク",
          "こ"
        ],
        "partHint": "3つある木のうち、どれか1つをえらぶよ。偏になる木の短い点も、その木の部品に含める。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "林",
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
        "rule": "component",
        "evidence": "下の左右の木を、両方ともえらぶよ。",
        "tier": 1,
        "meaning": "はやし",
        "grade": 1,
        "rare": false,
        "readings": [
          "リン",
          "はやし"
        ],
        "partHint": "下の左右の木を、両方ともえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "人",
        "strokeSets": [
          [
            3,
            4
          ],
          [
            11,
            12
          ]
        ],
        "rule": "loose",
        "evidence": "上か右下の木から、つながる左右の払い2本をえらぶよ。先端の比率を見立てると入にもなるので、両方を一緒に見つけるよ。",
        "tier": 2,
        "meaning": "ひと",
        "grade": 1,
        "rare": false,
        "readings": [
          "ジン",
          "ニン",
          "と"
        ],
        "partHint": "上か右下の木から、つながる左右の払い2本をえらぶよ。先端の比率を見立てると入にもなるので、両方を一緒に見つけるよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "入",
        "strokeSets": [
          [
            3,
            4
          ],
          [
            11,
            12
          ]
        ],
        "rule": "loose",
        "evidence": "つながる左右の払いで、右の払いが上へ続く長さを見立てるよ。人と同じ画の組では、両方を一緒に見つけるよ。",
        "tier": 3,
        "meaning": "はいる",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニュウ",
          "ジュ",
          "はいる"
        ],
        "partHint": "つながる左右の払いで、右の払いが上へ続く長さを見立てるよ。人と同じ画の組では、両方を一緒に見つけるよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "大",
        "strokeSets": [
          [
            1,
            3,
            4
          ],
          [
            9,
            11,
            12
          ]
        ],
        "rule": "loose",
        "evidence": "上か右下の木から、縦画だけを外すよ。左下の木の短い点は、右払いには変えない。",
        "tier": 2,
        "meaning": "おおきい",
        "grade": 1,
        "rare": false,
        "readings": [
          "ダイ",
          "タイ",
          "おおいに"
        ],
        "partHint": "上か右下の木から、縦画だけを外すよ。左下の木の短い点は、右払いには変えない。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "八",
        "strokeSets": [
          [
            7,
            12
          ]
        ],
        "rule": "loose",
        "evidence": "下の林から、左の木の左払いと、右の木の右払いをえらぶよ。2本は左右にはなれている。",
        "tier": 3,
        "meaning": "やっつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "ハチ",
          "ハツ",
          "よう"
        ],
        "partHint": "下の林から、左の木の左払いと、右の木の右払いをえらぶよ。2本は左右にはなれている。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "卜",
        "strokeSets": [
          [
            6,
            8
          ]
        ],
        "rule": "strokes",
        "evidence": "左下の木から、縦画とその右の短い点だけをえらぶよ。",
        "tier": 3,
        "meaning": "うらなう",
        "grade": null,
        "rare": true,
        "readings": [
          "ボク",
          "うらなう",
          "うらない"
        ],
        "partHint": "左下の木から、縦画とその右の短い点だけをえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "杁",
        "strokeSets": [
          [
            5,
            6,
            7,
            8,
            11,
            12
          ]
        ],
        "rule": "loose",
        "evidence": "左下の木を全部えらび、右下の木から入の形になる左右の払いを足すよ。",
        "tier": 3,
        "meaning": "水を通す水門（いり）",
        "grade": null,
        "rare": true,
        "readings": [
          "いり"
        ],
        "partHint": "左下の木を全部えらび、右下の木から入の形になる左右の払いを足すよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "杕",
        "strokeSets": [
          [
            5,
            6,
            7,
            8,
            9,
            11,
            12
          ]
        ],
        "rule": "loose",
        "evidence": "左下の木を全部えらび、右下の木から大の形をえらぶよ。",
        "tier": 3,
        "meaning": "一本だけで立つ木",
        "grade": null,
        "rare": true,
        "readings": [
          "テイ",
          "ダイ",
          "タ"
        ],
        "partHint": "左下の木を全部えらび、右下の木から大の形をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "三",
        "reading": "サン",
        "category": "position",
        "reason": "横画は3本ありますが、下の2本は横に並んでいます。上下に3本を並べるには線を動かす必要があります。"
      },
      {
        "char": "札",
        "reading": "サツ",
        "category": "shape",
        "reason": "札の右には下で曲がる一画が必要です。森の払いは曲がった一画ではないので作れません。"
      },
      {
        "char": "化",
        "reading": "カ",
        "category": "shape",
        "reason": "化の右側は曲がる画を含む匕です。森のまっすぐな払いを曲がる画に変えることはできません。"
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
      "note": "KanjiVGの日本の筆画図・部品構造、KANJIDIC2の字・読み・学年を照合。候補の全一覧と除外理由は docs/kakure-kanji-answers-004-010.md。同じ画の組を共有する字は、一度の回答でまとめて発見する。曰は日へ統合。"
    }
  },
  {
    "id": "s005-mei",
    "number": 5,
    "kanji": "明",
    "reading": "メイ・あかるい",
    "difficulty": "中級",
    "structure": "左に日、右に月がある。折れた画は途中で切れないので、横線を選ぶときは1画の全体を見よう。",
    "answers": [
      {
        "char": "一",
        "strokeSets": [
          [
            3
          ],
          [
            4
          ],
          [
            7
          ],
          [
            8
          ]
        ],
        "rule": "strokes",
        "evidence": "日か月の中にある、独立した横画を1本えらぶよ。",
        "tier": 1,
        "meaning": "ひとつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "イチ",
          "イツ",
          "ひとつ"
        ],
        "partHint": "日か月の中にある、独立した横画を1本えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "二",
        "strokeSets": [
          [
            3,
            4
          ],
          [
            7,
            8
          ]
        ],
        "rule": "loose",
        "evidence": "日の横画2本か、月の横画2本をえらぶよ。左右をまたぐ2本は横の位置が重ならない。",
        "tier": 1,
        "meaning": "ふたつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニ",
          "ジ",
          "ふたたび"
        ],
        "partHint": "日の横画2本か、月の横画2本をえらぶよ。左右をまたぐ2本は横の位置が重ならない。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "口",
        "strokeSets": [
          [
            1,
            2,
            4
          ]
        ],
        "rule": "strokes",
        "evidence": "左の日から、まんなかの横画を外すよ。",
        "tier": 1,
        "meaning": "くち",
        "grade": 1,
        "rare": false,
        "readings": [
          "コウ",
          "ク",
          "くち"
        ],
        "partHint": "左の日から、まんなかの横画を外すよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "日",
        "strokeSets": [
          [
            1,
            2,
            3,
            4
          ]
        ],
        "rule": "component",
        "evidence": "左の部品をそのまま全部えらぶよ。",
        "tier": 1,
        "meaning": "ひ・たいよう",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニチ",
          "ジツ",
          "か"
        ],
        "partHint": "左の部品をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "月",
        "strokeSets": [
          [
            5,
            6,
            7,
            8
          ]
        ],
        "rule": "component",
        "evidence": "右の部品をそのまま全部えらぶよ。",
        "tier": 1,
        "meaning": "つき",
        "grade": 1,
        "rare": false,
        "readings": [
          "ゲツ",
          "ガツ",
          "つき"
        ],
        "partHint": "右の部品をそのまま全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "三",
        "reading": "サン",
        "category": "position",
        "reason": "独立した横画は左右の部品に分かれています。同じ横位置で上下に3本は並びません。"
      },
      {
        "char": "刀",
        "reading": "トウ",
        "category": "position",
        "reason": "刀の左払いは上の横画の途中から始まります。明の月の左払いは横画の左端にあり、位置が違います。"
      },
      {
        "char": "目",
        "reading": "モク",
        "category": "position",
        "reason": "日の中に横画を足す必要がありますが、月の横画は日からはなれた右側にあるので動かせません。"
      },
      {
        "char": "几",
        "reading": "キ",
        "category": "shape",
        "reason": "几の右の画は、下で右へ曲がってからはねます。月の右の画は下で左へはねる画なので、そのまま几にはしません。"
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
      "note": "KanjiVGの日本の筆画図・部品構造、KANJIDIC2の字・読み・学年を照合。候補の全一覧と除外理由は docs/kakure-kanji-answers-004-010.md。同じ画の組を共有する字は、一度の回答でまとめて発見する。曰は日へ統合。"
    }
  },
  {
    "id": "s006-shi",
    "number": 6,
    "kanji": "思",
    "reading": "シ・おもう",
    "difficulty": "上級",
    "structure": "上は田、下は心。田の中の縦横を選ぶと、四角の部品以外の字も見つかる。",
    "answers": [
      {
        "char": "一",
        "strokeSets": [
          [
            4
          ],
          [
            5
          ]
        ],
        "rule": "strokes",
        "evidence": "田の中か下にある横画を1本えらぶよ。",
        "tier": 1,
        "meaning": "ひとつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "イチ",
          "イツ",
          "ひとつ"
        ],
        "partHint": "田の中か下にある横画を1本えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "二",
        "strokeSets": [
          [
            4,
            5
          ]
        ],
        "rule": "loose",
        "evidence": "田の中と下の横画を両方えらぶよ。",
        "tier": 1,
        "meaning": "ふたつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニ",
          "ジ",
          "ふたたび"
        ],
        "partHint": "田の中と下の横画を両方えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "十",
        "strokeSets": [
          [
            3,
            4
          ]
        ],
        "rule": "strokes",
        "evidence": "田のまんなかで交わる縦画と横画をえらぶよ。",
        "tier": 1,
        "meaning": "とお・じゅう",
        "grade": 1,
        "rare": false,
        "readings": [
          "ジュウ",
          "ジッ",
          "そ"
        ],
        "partHint": "田のまんなかで交わる縦画と横画をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "口",
        "strokeSets": [
          [
            1,
            2,
            5
          ]
        ],
        "rule": "strokes",
        "evidence": "田から、まんなかの縦画と横画を外すよ。",
        "tier": 1,
        "meaning": "くち",
        "grade": 1,
        "rare": false,
        "readings": [
          "コウ",
          "ク",
          "くち"
        ],
        "partHint": "田から、まんなかの縦画と横画を外すよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "日",
        "strokeSets": [
          [
            1,
            2,
            4,
            5
          ]
        ],
        "rule": "strokes",
        "evidence": "田から、まんなかの縦画だけを外すよ。",
        "tier": 1,
        "meaning": "ひ・たいよう",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニチ",
          "ジツ",
          "か"
        ],
        "partHint": "田から、まんなかの縦画だけを外すよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "田",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5
          ]
        ],
        "rule": "component",
        "evidence": "上の部品を全部えらぶよ。",
        "tier": 1,
        "meaning": "た・たんぼ",
        "grade": 1,
        "rare": false,
        "readings": [
          "デン",
          "た"
        ],
        "partHint": "上の部品を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "心",
        "strokeSets": [
          [
            6,
            7,
            8,
            9
          ]
        ],
        "rule": "component",
        "evidence": "下の部品を全部えらぶよ。",
        "tier": 1,
        "meaning": "こころ",
        "grade": 2,
        "rare": false,
        "readings": [
          "シン",
          "こころ",
          "ごころ"
        ],
        "partHint": "下の部品を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "土",
        "strokeSets": [
          [
            3,
            4,
            5
          ]
        ],
        "rule": "loose",
        "evidence": "田のまんなかの縦画と、独立した横画2本をえらぶよ。横画の長さの比率を見立てると士にもなるので、両方を一緒に見つけるよ。",
        "tier": 2,
        "meaning": "つち",
        "grade": 1,
        "rare": false,
        "readings": [
          "ド",
          "ト",
          "つち"
        ],
        "partHint": "田のまんなかの縦画と、独立した横画2本をえらぶよ。横画の長さの比率を見立てると士にもなるので、両方を一緒に見つけるよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "士",
        "strokeSets": [
          [
            3,
            4,
            5
          ]
        ],
        "rule": "loose",
        "evidence": "田のまんなかの縦画と横画2本を、士の長さの比率に見立てるよ。土と同じ組なので、両方を一緒に見つけるよ。",
        "tier": 3,
        "meaning": "さむらい・学問をする人",
        "grade": 5,
        "rare": false,
        "readings": [
          "シ",
          "さむらい"
        ],
        "partHint": "田のまんなかの縦画と横画2本を、士の長さの比率に見立てるよ。土と同じ組なので、両方を一緒に見つけるよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "志",
        "strokeSets": [
          [
            3,
            4,
            5,
            6,
            7,
            8,
            9
          ]
        ],
        "rule": "loose",
        "evidence": "田から士の形をえらび、下の心を全部足すよ。",
        "tier": 3,
        "meaning": "こころざし",
        "grade": 5,
        "rare": false,
        "readings": [
          "シ",
          "シリング",
          "こころざし"
        ],
        "partHint": "田から士の形をえらび、下の心を全部足すよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "中",
        "reading": "チュウ",
        "category": "position",
        "reason": "田の中央の縦画は四角の上下に長く突き出ていません。中にするために線を伸ばしたり、位置関係を変えたりはしません。"
      },
      {
        "char": "甲",
        "reading": "コウ",
        "category": "position",
        "reason": "甲では中央の縦画が四角の下に出ます。思の田の縦画は四角の下までなので、下へ伸ばすことはできません。"
      },
      {
        "char": "由",
        "reading": "ユ",
        "category": "position",
        "reason": "由では中央の縦画が四角の上に出ます。思の田の縦画を上へ伸ばすことはできません。"
      },
      {
        "char": "申",
        "reading": "シン",
        "category": "position",
        "reason": "申では中央の縦画が四角の上下に出ます。思の田の縦画を伸ばすことはできません。"
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
      "note": "KanjiVGの日本の筆画図・部品構造、KANJIDIC2の字・読み・学年を照合。候補の全一覧と除外理由は docs/kakure-kanji-answers-004-010.md。同じ画の組を共有する字は、一度の回答でまとめて発見する。曰は日へ統合。"
    }
  },
  {
    "id": "s007-sou",
    "number": 7,
    "kanji": "想",
    "reading": "ソウ・おもう",
    "difficulty": "超上級",
    "structure": "上の相は、木と目が横に並んだ形。下に心がある。目の中には、横画を選んで作れる字もある。",
    "answers": [
      {
        "char": "一",
        "strokeSets": [
          [
            1
          ],
          [
            7
          ],
          [
            8
          ],
          [
            9
          ]
        ],
        "rule": "strokes",
        "evidence": "木の横画か、目の中と下の横画を1本えらぶよ。",
        "tier": 1,
        "meaning": "ひとつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "イチ",
          "イツ",
          "ひとつ"
        ],
        "partHint": "木の横画か、目の中と下の横画を1本えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "二",
        "strokeSets": [
          [
            7,
            8
          ],
          [
            7,
            9
          ],
          [
            8,
            9
          ]
        ],
        "rule": "loose",
        "evidence": "目にある独立した横画3本から、2本をえらぶよ。",
        "tier": 1,
        "meaning": "ふたつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニ",
          "ジ",
          "ふたたび"
        ],
        "partHint": "目にある独立した横画3本から、2本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "三",
        "strokeSets": [
          [
            7,
            8,
            9
          ]
        ],
        "rule": "loose",
        "evidence": "目にある独立した横画3本を全部えらぶよ。",
        "tier": 2,
        "meaning": "みっつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "サン",
          "ゾウ",
          "みっつ"
        ],
        "partHint": "目にある独立した横画3本を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "十",
        "strokeSets": [
          [
            1,
            2
          ]
        ],
        "rule": "strokes",
        "evidence": "木から、横画と縦画だけをえらぶよ。",
        "tier": 1,
        "meaning": "とお・じゅう",
        "grade": 1,
        "rare": false,
        "readings": [
          "ジュウ",
          "ジッ",
          "そ"
        ],
        "partHint": "木から、横画と縦画だけをえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "木",
        "strokeSets": [
          [
            1,
            2,
            3,
            4
          ]
        ],
        "rule": "component",
        "evidence": "左上の木の部品を全部えらぶよ。偏の右下の短い画は点のまま取り出す。",
        "tier": 1,
        "meaning": "き",
        "grade": 1,
        "rare": false,
        "readings": [
          "ボク",
          "モク",
          "こ"
        ],
        "partHint": "左上の木の部品を全部えらぶよ。偏の右下の短い画は点のまま取り出す。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "口",
        "strokeSets": [
          [
            5,
            6,
            9
          ]
        ],
        "rule": "strokes",
        "evidence": "目から、中の横画2本だけを外すよ。",
        "tier": 1,
        "meaning": "くち",
        "grade": 1,
        "rare": false,
        "readings": [
          "コウ",
          "ク",
          "くち"
        ],
        "partHint": "目から、中の横画2本だけを外すよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "日",
        "strokeSets": [
          [
            5,
            6,
            7,
            9
          ],
          [
            5,
            6,
            8,
            9
          ]
        ],
        "rule": "loose",
        "evidence": "目の中の横画を1本だけ外すよ。どちらの横画を残しても、日になる。",
        "tier": 2,
        "meaning": "ひ・たいよう",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニチ",
          "ジツ",
          "か"
        ],
        "partHint": "目の中の横画を1本だけ外すよ。どちらの横画を残しても、日になる。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "目",
        "strokeSets": [
          [
            5,
            6,
            7,
            8,
            9
          ]
        ],
        "rule": "component",
        "evidence": "右上の目を全部えらぶよ。",
        "tier": 1,
        "meaning": "め",
        "grade": 1,
        "rare": false,
        "readings": [
          "モク",
          "ボク",
          "ま"
        ],
        "partHint": "右上の目を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "心",
        "strokeSets": [
          [
            10,
            11,
            12,
            13
          ]
        ],
        "rule": "component",
        "evidence": "下の心を全部えらぶよ。",
        "tier": 1,
        "meaning": "こころ",
        "grade": 2,
        "rare": false,
        "readings": [
          "シン",
          "こころ",
          "ごころ"
        ],
        "partHint": "下の心を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "相",
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
        "rule": "component",
        "evidence": "上に横に並んでいる木と目を、両方とも全部えらぶよ。",
        "tier": 2,
        "meaning": "互い・すがた",
        "grade": 3,
        "rare": false,
        "readings": [
          "ソウ",
          "ショウ",
          "あい"
        ],
        "partHint": "上に横に並んでいる木と目を、両方とも全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "旧",
        "strokeSets": [
          [
            2,
            5,
            6,
            7,
            9
          ],
          [
            2,
            5,
            6,
            8,
            9
          ]
        ],
        "rule": "loose",
        "evidence": "左上の木の縦画1本と、右の目から日になる4画をえらぶよ。木の横画・払い・点はえらばない。",
        "tier": 3,
        "meaning": "ふるい・以前の",
        "grade": 5,
        "rare": false,
        "readings": [
          "キュウ",
          "ふるい",
          "もと"
        ],
        "partHint": "左上の木の縦画1本と、右の目から日になる4画をえらぶよ。木の横画・払い・点はえらばない。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "卜",
        "strokeSets": [
          [
            2,
            4
          ]
        ],
        "rule": "strokes",
        "evidence": "左上の木から、縦画とその右の短い点だけをえらぶよ。",
        "tier": 3,
        "meaning": "うらなう",
        "grade": null,
        "rare": true,
        "readings": [
          "ボク",
          "うらなう",
          "うらない"
        ],
        "partHint": "左上の木から、縦画とその右の短い点だけをえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "大",
        "reading": "ダイ",
        "category": "missing",
        "reason": "想の木の右下は短い点です。この点を右払いに変えないため、大にはしません。"
      },
      {
        "char": "人",
        "reading": "ジン",
        "category": "missing",
        "reason": "想の木の右下は点で、人に必要な右払いではありません。点と払いは別の種類として扱います。"
      },
      {
        "char": "旦",
        "reading": "タン",
        "category": "position",
        "reason": "目の下の横画は左右の縦画につながっています。旦のように日の外の下へ別の横画を置くには、線を切る必要があります。"
      },
      {
        "char": "且",
        "reading": "ショ",
        "category": "position",
        "reason": "且の一番下の横画は四角の左右より外へ出ます。想の目の下の横画は四角の内側にあるので、そのまま取り出せません。"
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
      "checkedOn": "2026-10-17",
      "note": "KanjiVGの日本の筆画図・部品構造、KANJIDIC2の字・読み・学年を照合。候補の全一覧と除外理由は docs/kakure-kanji-answers-004-010.md。同じ画の組を共有する字は、一度の回答でまとめて発見する。曰は日へ統合。"
    }
  },
  {
    "id": "s008-i",
    "number": 8,
    "kanji": "意",
    "reading": "イ",
    "difficulty": "上級",
    "structure": "上の音は立と日でできていて、下に心がある。日から中の横画を外すと、別の音を表す部品も見つかる。",
    "answers": [
      {
        "char": "一",
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
            9
          ]
        ],
        "rule": "strokes",
        "evidence": "独立した横画4本のうち、1本をえらぶよ。",
        "tier": 1,
        "meaning": "ひとつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "イチ",
          "イツ",
          "ひとつ"
        ],
        "partHint": "独立した横画4本のうち、1本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "二",
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
            9
          ],
          [
            5,
            8
          ],
          [
            5,
            9
          ],
          [
            8,
            9
          ]
        ],
        "rule": "loose",
        "evidence": "独立した横画4本のうち、上下に並ぶ2本をえらぶよ。",
        "tier": 1,
        "meaning": "ふたつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニ",
          "ジ",
          "ふたたび"
        ],
        "partHint": "独立した横画4本のうち、上下に並ぶ2本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "三",
        "strokeSets": [
          [
            2,
            5,
            8
          ],
          [
            2,
            5,
            9
          ],
          [
            2,
            8,
            9
          ],
          [
            5,
            8,
            9
          ]
        ],
        "rule": "loose",
        "evidence": "独立した横画4本のうち、上下に並ぶ3本をえらぶよ。",
        "tier": 2,
        "meaning": "みっつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "サン",
          "ゾウ",
          "みっつ"
        ],
        "partHint": "独立した横画4本のうち、上下に並ぶ3本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "口",
        "strokeSets": [
          [
            6,
            7,
            9
          ]
        ],
        "rule": "strokes",
        "evidence": "まんなかの日から、中の横画を外すよ。",
        "tier": 1,
        "meaning": "くち",
        "grade": 1,
        "rare": false,
        "readings": [
          "コウ",
          "ク",
          "くち"
        ],
        "partHint": "まんなかの日から、中の横画を外すよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "日",
        "strokeSets": [
          [
            6,
            7,
            8,
            9
          ]
        ],
        "rule": "component",
        "evidence": "まんなかにある日を全部えらぶよ。",
        "tier": 1,
        "meaning": "ひ・たいよう",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニチ",
          "ジツ",
          "か"
        ],
        "partHint": "まんなかにある日を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "立",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5
          ]
        ],
        "rule": "component",
        "evidence": "一番上の立を全部えらぶよ。",
        "tier": 1,
        "meaning": "たつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "リツ",
          "リュウ",
          "だてる"
        ],
        "partHint": "一番上の立を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "音",
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
        "rule": "component",
        "evidence": "上の立と、その下の日を両方えらぶよ。",
        "tier": 2,
        "meaning": "おと",
        "grade": 1,
        "rare": false,
        "readings": [
          "オン",
          "イン",
          "ね"
        ],
        "partHint": "上の立と、その下の日を両方えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "心",
        "strokeSets": [
          [
            10,
            11,
            12,
            13
          ]
        ],
        "rule": "component",
        "evidence": "下の心を全部えらぶよ。",
        "tier": 1,
        "meaning": "こころ",
        "grade": 2,
        "rare": false,
        "readings": [
          "シン",
          "こころ",
          "ごころ"
        ],
        "partHint": "下の心を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "咅",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            9
          ]
        ],
        "rule": "strokes",
        "evidence": "上の立と、その下の口をえらぶよ。音から日内部の横画を1本外した形になる。",
        "tier": 3,
        "meaning": "つばを吐く",
        "grade": null,
        "rare": true,
        "readings": [
          "トウ"
        ],
        "partHint": "上の立と、その下の口をえらぶよ。音から日内部の横画を1本外した形になる。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "六",
        "reading": "ロク",
        "category": "shape",
        "reason": "立の中の左右の画は、左が点・右が左払いで、六の足とは向きと左右が違います。点と払いを入れ替えることはできません。"
      },
      {
        "char": "白",
        "reading": "ハク",
        "category": "position",
        "reason": "上の左払いは日の左上にはつながっていません。日と離れた払いを動かして白にはできません。"
      },
      {
        "char": "章",
        "reading": "ショウ",
        "category": "position",
        "reason": "章では日の下に十が必要です。意の下にあるのは心で、交わる横画と縦画がありません。"
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
      "note": "KanjiVGの日本の筆画図・部品構造、KANJIDIC2の字・読み・学年を照合。候補の全一覧と除外理由は docs/kakure-kanji-answers-004-010.md。同じ画の組を共有する字は、一度の回答でまとめて発見する。曰は日へ統合。"
    }
  },
  {
    "id": "s009-go",
    "number": 9,
    "kanji": "語",
    "reading": "ゴ・かたる",
    "difficulty": "上級",
    "structure": "左に言、右に吾がある。吾は五と口に分かれる。五の折れた線は途中で切らず、全部を選ぼう。",
    "answers": [
      {
        "char": "一",
        "strokeSets": [
          [
            2
          ],
          [
            3
          ],
          [
            4
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
            14
          ]
        ],
        "rule": "strokes",
        "evidence": "言や右側の部品の、独立した横画を1本えらぶよ。",
        "tier": 1,
        "meaning": "ひとつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "イチ",
          "イツ",
          "ひとつ"
        ],
        "partHint": "言や右側の部品の、独立した横画を1本えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "二",
        "strokeSets": [
          [
            2,
            3
          ],
          [
            2,
            4
          ],
          [
            2,
            7
          ],
          [
            3,
            4
          ],
          [
            3,
            7
          ],
          [
            4,
            7
          ],
          [
            8,
            11
          ],
          [
            8,
            14
          ],
          [
            11,
            14
          ]
        ],
        "rule": "loose",
        "evidence": "左の言の横画どうしか、右側の横画どうしから2本えらぶよ。左右をまたいで横位置が重ならない2本は使わない。",
        "tier": 1,
        "meaning": "ふたつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニ",
          "ジ",
          "ふたたび"
        ],
        "partHint": "左の言の横画どうしか、右側の横画どうしから2本えらぶよ。左右をまたいで横位置が重ならない2本は使わない。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "三",
        "strokeSets": [
          [
            2,
            3,
            4
          ],
          [
            2,
            3,
            7
          ],
          [
            2,
            4,
            7
          ],
          [
            3,
            4,
            7
          ],
          [
            8,
            11,
            14
          ]
        ],
        "rule": "loose",
        "evidence": "左の言か右側で、横位置が重なる横画を3本えらぶよ。",
        "tier": 2,
        "meaning": "みっつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "サン",
          "ゾウ",
          "みっつ"
        ],
        "partHint": "左の言か右側で、横位置が重なる横画を3本えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "口",
        "strokeSets": [
          [
            5,
            6,
            7
          ],
          [
            12,
            13,
            14
          ]
        ],
        "rule": "component",
        "evidence": "左下か右下にある口の部品を全部えらぶよ。",
        "tier": 1,
        "meaning": "くち",
        "grade": 1,
        "rare": false,
        "readings": [
          "コウ",
          "ク",
          "くち"
        ],
        "partHint": "左下か右下にある口の部品を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "言",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5,
            6,
            7
          ]
        ],
        "rule": "component",
        "evidence": "左の言を全部えらぶよ。",
        "tier": 1,
        "meaning": "いう・ことば",
        "grade": 2,
        "rare": false,
        "readings": [
          "ゲン",
          "ゴン",
          "こと"
        ],
        "partHint": "左の言を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "五",
        "strokeSets": [
          [
            8,
            9,
            10,
            11
          ]
        ],
        "rule": "component",
        "evidence": "右上の五を全部えらぶよ。",
        "tier": 1,
        "meaning": "いつつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "ゴ",
          "いつ",
          "いつつ"
        ],
        "partHint": "右上の五を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "工",
        "strokeSets": [
          [
            8,
            9,
            11
          ]
        ],
        "rule": "loose",
        "evidence": "右上の五から、まんなかの折れた画を外すよ。横画2本を縦画がつないだ工になる。",
        "tier": 3,
        "meaning": "つくる・細工する",
        "grade": 2,
        "rare": false,
        "readings": [
          "コウ",
          "ク",
          "グ"
        ],
        "partHint": "右上の五から、まんなかの折れた画を外すよ。横画2本を縦画がつないだ工になる。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "丁",
        "strokeSets": [
          [
            8,
            9
          ]
        ],
        "rule": "loose",
        "evidence": "右上の五から、最初の横画と縦画だけをえらぶよ。小さなはねの有無は見立てる。",
        "tier": 3,
        "meaning": "順序や区画を表す字",
        "grade": 3,
        "rare": false,
        "readings": [
          "チョウ",
          "テイ",
          "ひのと"
        ],
        "partHint": "右上の五から、最初の横画と縦画だけをえらぶよ。小さなはねの有無は見立てる。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "吾",
        "strokeSets": [
          [
            8,
            9,
            10,
            11,
            12,
            13,
            14
          ]
        ],
        "rule": "component",
        "evidence": "右側の五と口を両方とも全部えらぶよ。",
        "tier": 2,
        "meaning": "われ・自分",
        "grade": null,
        "rare": true,
        "readings": [
          "ゴ",
          "われ",
          "あ"
        ],
        "partHint": "右側の五と口を両方とも全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "訂",
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
        "rule": "loose",
        "evidence": "左の言を全部えらび、右上から丁の形を足すよ。",
        "tier": 3,
        "meaning": "ただす・直す",
        "grade": null,
        "rare": false,
        "readings": [
          "テイ",
          "ただす"
        ],
        "partHint": "左の言を全部えらび、右上から丁の形を足すよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "訌",
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
            9,
            11
          ]
        ],
        "rule": "loose",
        "evidence": "左の言を全部えらび、右上から工の形を足すよ。",
        "tier": 3,
        "meaning": "仲間どうしでもめる",
        "grade": null,
        "rare": true,
        "readings": [
          "コウ"
        ],
        "partHint": "左の言を全部えらび、右上から工の形を足すよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "唔",
        "strokeSets": [
          [
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14
          ]
        ],
        "rule": "loose",
        "evidence": "左下の口と、右側の吾を全部えらぶよ。左右の部品の大きさの比率だけを見立てる。",
        "tier": 3,
        "meaning": "声を出して読む",
        "grade": null,
        "rare": true,
        "readings": [
          "ゴ"
        ],
        "partHint": "左下の口と、右側の吾を全部えらぶよ。左右の部品の大きさの比率だけを見立てる。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "十",
        "reading": "ジュウ",
        "category": "position",
        "reason": "五の縦画は上の横画から下の横画までです。横画の上下へ突き出して交わる十の形とは違います。"
      },
      {
        "char": "古",
        "reading": "コ",
        "category": "position",
        "reason": "右上の五の一部は十にはなりません。線を途中で切って、下の口と組み合わせた古を作ることはできません。"
      },
      {
        "char": "叮",
        "reading": "テイ",
        "category": "position",
        "reason": "左下の口と右上の丁は上下にはなれていて、同じ高さで左右に並びません。線を動かして叮にはできません。"
      },
      {
        "char": "吅",
        "reading": "吅",
        "category": "shape",
        "reason": "2つの口が並ぶ形は候補ですが、今回の日本語辞書資料で単独漢字として確認できないため正解には登録していません。"
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
      "note": "KanjiVGの日本の筆画図・部品構造、KANJIDIC2の字・読み・学年を照合。候補の全一覧と除外理由は docs/kakure-kanji-answers-004-010.md。同じ画の組を共有する字は、一度の回答でまとめて発見する。曰は日へ統合。"
    }
  },
  {
    "id": "s010-sha",
    "number": 10,
    "kanji": "謝",
    "reading": "シャ・あやまる",
    "difficulty": "超上級",
    "structure": "左に言、まんなかに身、右に寸がある。離れた部品を組み合わせる字もさがしてみよう。身の右側の長い折れた画や、斜めの提は途中で切れない。",
    "answers": [
      {
        "char": "一",
        "strokeSets": [
          [
            2
          ],
          [
            3
          ],
          [
            4
          ],
          [
            7
          ],
          [
            11
          ],
          [
            12
          ],
          [
            15
          ]
        ],
        "rule": "strokes",
        "evidence": "独立した横画を1本えらぶよ。身の下の斜めの画は提なので、横画には数えない。",
        "tier": 1,
        "meaning": "ひとつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "イチ",
          "イツ",
          "ひとつ"
        ],
        "partHint": "独立した横画を1本えらぶよ。身の下の斜めの画は提なので、横画には数えない。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "二",
        "strokeSets": [
          [
            2,
            3
          ],
          [
            2,
            4
          ],
          [
            2,
            7
          ],
          [
            3,
            4
          ],
          [
            3,
            7
          ],
          [
            4,
            7
          ],
          [
            11,
            12
          ]
        ],
        "rule": "loose",
        "evidence": "左の言か、身の中にある横画から、横位置が重なる2本をえらぶよ。",
        "tier": 1,
        "meaning": "ふたつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "ニ",
          "ジ",
          "ふたたび"
        ],
        "partHint": "左の言か、身の中にある横画から、横位置が重なる2本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "三",
        "strokeSets": [
          [
            2,
            3,
            4
          ],
          [
            2,
            3,
            7
          ],
          [
            2,
            4,
            7
          ],
          [
            3,
            4,
            7
          ]
        ],
        "rule": "loose",
        "evidence": "左の言にある横画から3本をえらぶよ。",
        "tier": 2,
        "meaning": "みっつ",
        "grade": 1,
        "rare": false,
        "readings": [
          "サン",
          "ゾウ",
          "みっつ"
        ],
        "partHint": "左の言にある横画から3本をえらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "十",
        "strokeSets": [
          [
            15,
            16
          ]
        ],
        "rule": "loose",
        "evidence": "右の寸から、交わる横画と縦画だけをえらぶよ。縦画の小さなはねの有無だけを見立てる。",
        "tier": 1,
        "meaning": "とお・じゅう",
        "grade": 1,
        "rare": false,
        "readings": [
          "ジュウ",
          "ジッ",
          "そ"
        ],
        "partHint": "右の寸から、交わる横画と縦画だけをえらぶよ。縦画の小さなはねの有無だけを見立てる。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "口",
        "strokeSets": [
          [
            5,
            6,
            7
          ]
        ],
        "rule": "component",
        "evidence": "左下の口を全部えらぶよ。",
        "tier": 1,
        "meaning": "くち",
        "grade": 1,
        "rare": false,
        "readings": [
          "コウ",
          "ク",
          "くち"
        ],
        "partHint": "左下の口を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "言",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5,
            6,
            7
          ]
        ],
        "rule": "component",
        "evidence": "左の言を全部えらぶよ。",
        "tier": 1,
        "meaning": "いう・ことば",
        "grade": 2,
        "rare": false,
        "readings": [
          "ゲン",
          "ゴン",
          "こと"
        ],
        "partHint": "左の言を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "寸",
        "strokeSets": [
          [
            15,
            16,
            17
          ]
        ],
        "rule": "component",
        "evidence": "一番右の寸を全部えらぶよ。",
        "tier": 1,
        "meaning": "長さの単位・わずか",
        "grade": 6,
        "rare": false,
        "readings": [
          "スン"
        ],
        "partHint": "一番右の寸を全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "身",
        "strokeSets": [
          [
            8,
            9,
            10,
            11,
            12,
            13,
            14
          ]
        ],
        "rule": "component",
        "evidence": "まんなかの身を全部えらぶよ。偏の下の提も、その部品の1画として取り出す。",
        "tier": 2,
        "meaning": "からだ・み",
        "grade": 3,
        "rare": false,
        "readings": [
          "シン",
          "み"
        ],
        "partHint": "まんなかの身を全部えらぶよ。偏の下の提も、その部品の1画として取り出す。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "射",
        "strokeSets": [
          [
            8,
            9,
            10,
            11,
            12,
            13,
            14,
            15,
            16,
            17
          ]
        ],
        "rule": "component",
        "evidence": "まんなかの身と、右の寸を両方とも全部えらぶよ。",
        "tier": 2,
        "meaning": "矢をいる",
        "grade": 6,
        "rare": false,
        "readings": [
          "シャ",
          "いる",
          "うつ"
        ],
        "partHint": "まんなかの身と、右の寸を両方とも全部えらぶよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "討",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            15,
            16,
            17
          ]
        ],
        "rule": "loose",
        "evidence": "左の言と右の寸を全部えらぶよ。間の身を外しても、左右の位置関係は同じ。",
        "tier": 3,
        "meaning": "相手を攻める・よく調べる",
        "grade": 6,
        "rare": false,
        "readings": [
          "トウ",
          "うつ"
        ],
        "partHint": "左の言と右の寸を全部えらぶよ。間の身を外しても、左右の位置関係は同じ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      },
      {
        "char": "計",
        "strokeSets": [
          [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            15,
            16
          ]
        ],
        "rule": "loose",
        "evidence": "左の言を全部えらび、右の寸から十の形を足すよ。",
        "tier": 3,
        "meaning": "はかる・計画する",
        "grade": 2,
        "rare": false,
        "readings": [
          "ケイ",
          "はかる",
          "はからう"
        ],
        "partHint": "左の言を全部えらび、右の寸から十の形を足すよ。",
        "verification": {
          "status": "verified",
          "note": "日本の筆順・筆画図と対応する画の組を照合。線を動かさず、全画を使ったときの本数・種類・位置関係を確認。"
        }
      }
    ],
    "nearMisses": [
      {
        "char": "自",
        "reading": "ジ",
        "category": "shape",
        "reason": "身の右側の折れた画は、四角の下まで長く続く一画です。下の長い部分を切って、自の右辺にすることはできません。"
      },
      {
        "char": "目",
        "reading": "モク",
        "category": "shape",
        "reason": "身の下の斜めの画は提で、目の下の横画ではありません。折れた画の長い下半分を切ることもできません。"
      },
      {
        "char": "白",
        "reading": "ハク",
        "category": "shape",
        "reason": "身の右の折れた画と、下の斜めの提を白の画に変える必要があるため、登録していません。"
      },
      {
        "char": "月",
        "reading": "ゲツ",
        "category": "position",
        "reason": "身の上の短い払いは四角の左辺まで続いていません。身を部分的に切って月の形にすることはできません。"
      },
      {
        "char": "丁",
        "reading": "チョウ",
        "category": "position",
        "reason": "右の寸の縦画は横画より上へ突き出しています。上の部分を切って丁にすることはできません。"
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
      "checkedOn": "2026-10-17",
      "note": "KanjiVGの日本の筆画図・部品構造、KANJIDIC2の字・読み・学年を照合。候補の全一覧と除外理由は docs/kakure-kanji-answers-004-010.md。同じ画の組を共有する字は、一度の回答でまとめて発見する。曰は日へ統合。"
    }
  }
] satisfies Omit<Stage, "strokes">[];

export const STAGES_004_010: Stage[] = STAGE_DATA.map((stage) => ({
  ...stage,
  strokes: glyphs[stage.kanji as keyof typeof glyphs] as Stage["strokes"],
}));
