/**
 * ご当地ピンボールのマップごとの「見た目」（名前・色・床の模様・曲・演出の言葉）
 * =============================================================
 * 台の形は maps.ts（同じ id）。新しいマップを足したら、ここにも足す（無いマップは、いつもの台の見た目になる）。
 * 曲は components/games/pinball/audio.ts が music を見て、その場で鳴らす（音のファイルは使わない）。
 */
import { DEFAULT_MAP_ID } from "./maps";

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
  /** マップの名前（「はねはね台」） */
  name: string;
  /** ひとことの見出し（台えらびに出す） */
  title: string;
  /** どんな台か（台えらびに出す） */
  lead: string;
  /** 台えらびに出す、しかけの短い説明（3つくらい） */
  features: readonly string[];
  /** むずかしさ（1〜3。台えらびの★） */
  difficulty: 1 | 2 | 3;
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
    /** 床に描く県の形の光 */
    shape: string;
    /** 画面の外のふち */
    frame: string;
  };
  pattern: PinballPattern;
  music: PinballMusic;
  /** スタンプ帳がそろったとき（制覇）の大きな文字 */
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
  [DEFAULT_MAP_ID]: {
    id: DEFAULT_MAP_ID,
    name: "いつもの台",
    title: "まずはここから",
    lead: "バンパー3つとかざぐるま。ランプは同じがわへ戻ってくるので、左右交互に打つと「8の字」でつながる",
    features: ["バンパー3つ", "かざぐるま", "8の字ランプ"],
    difficulty: 1,
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
    conquestTitle: "ご当地 制覇！",
  },
  bumper: {
    id: "bumper",
    name: "はねはね台",
    title: "バンパーだらけ",
    lead: "上のまん中に、バンパー6つとスリングショットの「はねはね部屋」。ランプをのぼった玉は部屋に飛びこんで、跳ね回る",
    features: ["バンパー6つ", "はねはね部屋", "ランプは部屋へ"],
    difficulty: 2,
    colors: {
      bg0: "#2b1440",
      bg1: "#120821",
      pattern: "rgba(255,138,214,0.09)",
      accent: "#ff7ac6",
      accent2: "#4fe3ff",
      rail: "#ecdff5",
      plastic: "rgba(79,227,255,0.26)",
      shape: "#ffd3ee",
      frame: "#0a0412",
    },
    pattern: "shippo",
    music: {
      bpm: 140,
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
    conquestTitle: "はねはね 制覇！",
  },
  pachinko: {
    id: "pachinko",
    name: "くぎと風車の台",
    title: "パチンコみたいに",
    lead: "くぎの間を、玉がカチカチ当たりながら落ちてくる。ガチャ穴は上があいていて、落ちてきた玉がそのまま入ることも",
    features: ["くぎ", "風車2つ", "上から入るガチャ穴"],
    difficulty: 2,
    colors: {
      bg0: "#3a1418",
      bg1: "#160709",
      pattern: "rgba(242,193,78,0.09)",
      accent: "#f2c14e",
      accent2: "#ff5a4e",
      rail: "#efe1c4",
      plastic: "rgba(242,193,78,0.22)",
      shape: "#ffe8b0",
      frame: "#0d0405",
    },
    pattern: "seigaiha",
    music: {
      bpm: 120,
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
    conquestTitle: "大当たり！ 制覇！",
  },
  coaster: {
    id: "coaster",
    name: "ジェットコースター台",
    title: "長いランプが交差する",
    lead: "左右のランプが X に交わって、反対がわのフリッパーへ帰ってくる。同じショットをくり返しねらえる、スピード勝負の台",
    features: ["交差するランプ", "反対がわへ帰る", "スピード勝負"],
    difficulty: 3,
    colors: {
      bg0: "#0f2a44",
      bg1: "#071526",
      pattern: "rgba(255,170,64,0.09)",
      accent: "#ffaa40",
      accent2: "#3fd6c4",
      rail: "#d9e6f2",
      plastic: "rgba(63,214,196,0.24)",
      shape: "#ffe2b8",
      frame: "#040b14",
    },
    pattern: "yama",
    music: {
      bpm: 150,
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
    conquestTitle: "ご当地 一周制覇！",
  },
};

/** マップの見た目（無いマップは、いつもの台の見た目） */
export function getPinballTheme(id: string): PinballTheme {
  return PINBALL_THEMES[id] ?? PINBALL_THEMES[DEFAULT_MAP_ID]!;
}

/**
 * 自分で作るステージの見た目。色・床の模様・曲・制覇のことばは、えらんだマップの見た目（look）のものを使い、
 * 名前だけステージの名前にする
 */
export function stageTheme(look: string, name: string): PinballTheme {
  const base = getPinballTheme(look);
  return { ...base, id: "stage", name, title: "ステージ", lead: "", features: [] };
}
