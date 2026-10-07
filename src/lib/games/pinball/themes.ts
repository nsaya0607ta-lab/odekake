/**
 * ご当地ピンボールの「着せ替え」
 * =============================================================
 * 台の形はすべて同じで、色・床の模様・曲・演出の言葉だけが県ごとに変わる。
 * 都道府県ガチャに新しい県が増えたら、ここに足す（無い県は FALLBACK から自動で作る）。
 * 曲は components/games/pinball/audio.ts が music を見て、その場で鳴らす（音のファイルは使わない）。
 */

export const DEFAULT_TABLE_ID = "default";

export type PinballPattern = "capsule" | "footprint" | "yama" | "asanoha" | "chabatake" | "shippo" | "seigaiha";

export type PinballMusic = {
  bpm: number;
  /** 主音（MIDIノート番号） */
  root: number;
  /** 使う音階（主音からの半音） */
  scale: readonly number[];
  /** メロディ（16分音符 64個。音階の何番目か（1〜）、0 は休み、負は1オクターブ下） */
  melody: readonly number[];
  /** 4小節のコードの根音（音階の何番目か） */
  chords: readonly [number, number, number, number];
  lead: "square" | "triangle" | "sine" | "sawtooth" | "koto" | "bell";
  kit: "pop" | "taiko" | "folk" | "bell" | "rock";
};

export type PinballTheme = {
  id: string;
  /** 「岐阜県」 */
  name: string;
  /** 台の名前（台えらびに出す） */
  title: string;
  /** ひとこと説明 */
  lead: string;
  colors: {
    /** 床のグラデーション（上・下） */
    bg0: string;
    bg1: string;
    /** 床の模様の色 */
    pattern: string;
    /** 光るもの（矢印・レーン・ゲージ） */
    accent: string;
    accent2: string;
    /** レール・壁 */
    rail: string;
    /** ランプのプラスチック */
    plastic: string;
    /** 県の形の光 */
    shape: string;
    /** 画面の外のふち */
    frame: string;
  };
  pattern: PinballPattern;
  music: PinballMusic;
  /** 県制覇の演出の言葉 */
  conquestTitle: string;
};

/* 曲：16分音符で 4小節（64個）。数字は音階の何番目か */
const POP_MELODY = [
  5, 0, 5, 6, 8, 0, 6, 5, 3, 0, 5, 0, 6, 5, 3, 0,
  2, 0, 3, 5, 6, 0, 5, 3, 2, 0, 1, 0, 2, 3, 0, 0,
  5, 0, 5, 6, 8, 0, 9, 8, 6, 0, 5, 0, 6, 8, 9, 0,
  10, 0, 9, 8, 6, 0, 5, 6, 8, 0, 6, 5, 3, 0, 1, 0,
];

export const PINBALL_THEMES: Record<string, PinballTheme> = {
  [DEFAULT_TABLE_ID]: {
    id: DEFAULT_TABLE_ID,
    name: "いつもの台",
    title: "ガチャカプセルの台",
    lead: "だれでも遊べる台。？カプセルを8個あつめると「コンプリート！」",
    colors: {
      bg0: "#123247",
      bg1: "#0a1a2a",
      pattern: "rgba(255,255,255,0.05)",
      accent: "#ffd166",
      accent2: "#ef6f8f",
      rail: "#c9d6e3",
      plastic: "rgba(120,200,255,0.28)",
      shape: "#ffd166",
      frame: "#071420",
    },
    pattern: "capsule",
    music: {
      bpm: 128,
      root: 60,
      scale: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19],
      melody: POP_MELODY,
      chords: [1, 6, 4, 5],
      lead: "square",
      kit: "pop",
    },
    conquestTitle: "カプセル コンプリート！",
  },
  "18": {
    id: "18",
    name: "福井県",
    title: "恐竜と荒波の台",
    lead: "恐竜の足あとと、越前の海。オービットで恐竜王国をかけぬけよう",
    colors: {
      bg0: "#2a2418",
      bg1: "#0f1d2a",
      pattern: "rgba(242,165,65,0.10)",
      accent: "#f2a541",
      accent2: "#59c3c3",
      rail: "#d8cdb8",
      plastic: "rgba(89,195,195,0.26)",
      shape: "#f2a541",
      frame: "#0b0f14",
    },
    pattern: "footprint",
    music: {
      bpm: 118,
      root: 62,
      scale: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19],
      melody: [
        1, 0, 1, 3, 5, 0, 3, 0, 4, 0, 3, 1, 2, 0, -7, 0,
        1, 0, 1, 3, 5, 0, 6, 5, 4, 0, 3, 0, 2, 0, 0, 0,
        8, 0, 7, 5, 6, 0, 5, 3, 4, 0, 5, 6, 5, 0, 3, 0,
        1, 0, 3, 5, 8, 0, 7, 6, 5, 0, 4, 3, 2, 0, 1, 0,
      ],
      chords: [1, 7, 6, 5],
      lead: "sawtooth",
      kit: "rock",
    },
    conquestTitle: "福井県 制覇！",
  },
  "20": {
    id: "20",
    name: "長野県",
    title: "アルプスと温泉の台",
    lead: "雪の高原をすべるように。松本城・善光寺・上高地をめぐろう",
    colors: {
      bg0: "#16332c",
      bg1: "#0b1a17",
      pattern: "rgba(199,232,243,0.08)",
      accent: "#f25c54",
      accent2: "#c7e8f3",
      rail: "#d5e3df",
      plastic: "rgba(199,232,243,0.26)",
      shape: "#c7e8f3",
      frame: "#07110f",
    },
    pattern: "yama",
    music: {
      bpm: 104,
      root: 65,
      scale: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19],
      melody: [
        5, 0, 0, 6, 5, 0, 3, 0, 2, 0, 3, 0, 5, 0, 0, 0,
        6, 0, 0, 8, 6, 0, 5, 0, 3, 0, 2, 0, 3, 0, 0, 0,
        5, 0, 0, 6, 8, 0, 9, 0, 10, 0, 9, 0, 8, 0, 6, 0,
        5, 0, 3, 0, 2, 0, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0,
      ],
      chords: [1, 4, 6, 5],
      lead: "triangle",
      kit: "folk",
    },
    conquestTitle: "長野県 制覇！",
  },
  "21": {
    id: "21",
    name: "岐阜県",
    title: "白川郷の雪あかりの台",
    lead: "合掌造りの冬の夜。鵜飼のかがり火と、飛騨の町並みの台",
    colors: {
      bg0: "#1b2142",
      bg1: "#0b0e1f",
      pattern: "rgba(242,193,78,0.08)",
      accent: "#f2c14e",
      accent2: "#e94f37",
      rail: "#d9dcef",
      plastic: "rgba(242,193,78,0.22)",
      shape: "#fff1c1",
      frame: "#06081a",
    },
    pattern: "asanoha",
    music: {
      bpm: 112,
      root: 62,
      // 陽音階（ヨナ抜き）
      scale: [0, 2, 5, 7, 9, 12, 14, 17, 19, 21, 24],
      melody: [
        4, 0, 4, 5, 6, 0, 5, 4, 3, 0, 2, 0, 3, 0, 0, 0,
        4, 0, 5, 6, 7, 0, 6, 5, 4, 0, 5, 4, 3, 0, 2, 0,
        6, 0, 6, 7, 8, 0, 7, 6, 5, 0, 4, 0, 5, 0, 6, 0,
        5, 4, 3, 0, 2, 0, 3, 4, 1, 0, 0, 0, 1, 0, 0, 0,
      ],
      chords: [1, 4, 5, 1],
      lead: "koto",
      kit: "taiko",
    },
    conquestTitle: "岐阜県 制覇！",
  },
  "22": {
    id: "22",
    name: "静岡県",
    title: "富士山と茶畑の台",
    lead: "茶畑の緑と、日本一の富士。さわやかに打ち上げよう",
    colors: {
      bg0: "#13382a",
      bg1: "#0a1d16",
      pattern: "rgba(159,211,86,0.09)",
      accent: "#9fd356",
      accent2: "#6cc5f0",
      rail: "#dbe9df",
      plastic: "rgba(108,197,240,0.26)",
      shape: "#e6ffc4",
      frame: "#06120d",
    },
    pattern: "chabatake",
    music: {
      bpm: 120,
      root: 67,
      scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24],
      melody: [
        3, 0, 4, 0, 5, 0, 4, 3, 2, 0, 3, 0, 1, 0, 0, 0,
        3, 0, 4, 0, 5, 0, 6, 5, 4, 0, 3, 0, 4, 0, 0, 0,
        6, 0, 6, 0, 7, 6, 5, 0, 4, 0, 5, 0, 6, 0, 0, 0,
        5, 0, 4, 3, 2, 0, 3, 0, 1, 0, 0, 0, 1, 0, 0, 0,
      ],
      chords: [1, 5, 6, 4],
      lead: "sine",
      kit: "pop",
    },
    conquestTitle: "静岡県 制覇！",
  },
  "23": {
    id: "23",
    name: "愛知県",
    title: "金のしゃちほこの台",
    lead: "名古屋城の金色にかがやく台。にぎやかにジャックポットをねらえ",
    colors: {
      bg0: "#16213f",
      bg1: "#0a0f22",
      pattern: "rgba(245,197,66,0.09)",
      accent: "#f5c542",
      accent2: "#2ec4b6",
      rail: "#e6dcc0",
      plastic: "rgba(245,197,66,0.24)",
      shape: "#f5c542",
      frame: "#070a18",
    },
    pattern: "shippo",
    music: {
      bpm: 136,
      root: 58,
      scale: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19],
      melody: [
        8, 0, 8, 0, 9, 8, 6, 0, 5, 0, 6, 0, 8, 0, 0, 0,
        6, 0, 6, 0, 8, 6, 5, 0, 3, 0, 5, 0, 6, 0, 0, 0,
        8, 0, 9, 0, 10, 0, 9, 8, 9, 0, 8, 6, 5, 0, 6, 0,
        8, 0, 6, 5, 3, 0, 5, 0, 1, 0, 3, 5, 8, 0, 0, 0,
      ],
      chords: [1, 4, 5, 1],
      lead: "square",
      kit: "pop",
    },
    conquestTitle: "愛知県 制覇！",
  },
  "24": {
    id: "24",
    name: "三重県",
    title: "お伊勢さんと真珠の海の台",
    lead: "青海波の海と、伊勢神宮。おごそかに、でも大胆に",
    colors: {
      bg0: "#0f2a3a",
      bg1: "#081520",
      pattern: "rgba(232,213,181,0.08)",
      accent: "#e8d5b5",
      accent2: "#e2574c",
      rail: "#e3e0d8",
      plastic: "rgba(232,213,181,0.24)",
      shape: "#fff6e5",
      frame: "#050d14",
    },
    pattern: "seigaiha",
    music: {
      bpm: 96,
      root: 64,
      // 律音階
      scale: [0, 2, 5, 7, 9, 12, 14, 17, 19, 21, 24],
      melody: [
        1, 0, 0, 2, 3, 0, 0, 0, 4, 0, 3, 0, 2, 0, 0, 0,
        3, 0, 0, 4, 5, 0, 0, 0, 6, 0, 5, 0, 4, 0, 0, 0,
        6, 0, 0, 5, 4, 0, 3, 0, 4, 0, 5, 0, 6, 0, 0, 0,
        5, 0, 4, 0, 3, 0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0,
      ],
      chords: [1, 4, 2, 5],
      lead: "bell",
      kit: "bell",
    },
    conquestTitle: "三重県 制覇！",
  },
};

const FALLBACK_COLORS: PinballTheme["colors"][] = [
  PINBALL_THEMES["21"]!.colors,
  PINBALL_THEMES["22"]!.colors,
  PINBALL_THEMES["24"]!.colors,
];

/** 台の着せ替え。ここに無い県（あとから増えた県）は、ほかの県の色と曲をかりて作る */
export function getPinballTheme(id: string, prefName?: string): PinballTheme {
  const theme = PINBALL_THEMES[id];
  if (theme) return theme;
  const n = Number(id) || 0;
  const base = PINBALL_THEMES[DEFAULT_TABLE_ID]!;
  const name = prefName ?? "ご当地";
  return {
    ...base,
    id,
    name,
    title: `${name.replace(/[都道府県]$/, "")}の台`,
    lead: `${name}のご当地アイテムが並ぶ台`,
    colors: FALLBACK_COLORS[n % FALLBACK_COLORS.length]!,
    pattern: (["asanoha", "seigaiha", "shippo"] as const)[n % 3]!,
    conquestTitle: `${name} 制覇！`,
  };
}
