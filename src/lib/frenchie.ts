/**
 * おでかけ記録のフレブル。
 *
 * 絵は public/characters/frenchie/ に 30 ポーズある。どれも足元の接地線と体の
 * 中心で位置を揃えてあるので、差し替えても地面がずれない。
 */

export const FRENCHIE_POSES = [
  "stand",
  "walk",
  "trot",
  "sniff",
  "sit",
  "stand-happy",
  "doze",
  "drink",
  "drink-down",
  "treat-down",
  "treat",
  "camera",
  "shake",
  "dig",
  "walk-tail",
  "bow-b",
  "front",
  "sit-side",
  "bark",
  "wonder",
  "smile",
  "wave",
  "wink",
  "cheer",
  "bow",
  "sleep",
  "lie",
  "roll",
  "yawn",
  "lie-wave",
] as const;

export type FrenchiePose = (typeof FRENCHIE_POSES)[number];

/** 素材はすべて同じキャンバスに載っている */
export const FRENCHIE_FRAME = { width: 300, height: 254 } as const;

export function frenchieSrc(pose: FrenchiePose) {
  return `/characters/frenchie/${pose}.webp`;
}

/* ── 時間帯 ──────────────────────────────────────────────────────── */

export type Daypart = "morning" | "day" | "evening" | "night";

export function daypartAt(hour: number): Daypart {
  if (hour < 5) return "night";
  if (hour < 10) return "morning";
  if (hour < 17) return "day";
  if (hour < 21) return "evening";
  return "night";
}

type Rest = { pose: FrenchiePose; min: number; max: number };

export type Mood = {
  /** 休憩が明けたときに歩き出す確率。低いほどその場でじっとしている */
  walkChance: number;
  /** バンド幅に対する移動速度（%/秒） */
  speed: number;
  /** 立ち姿と踏み出しを入れ替える間隔（ms）。speed と釣り合わせる */
  stepMs: number;
  rests: readonly Rest[];
  /** なでられたときの反応 */
  reactions: readonly FrenchiePose[];
};

/**
 * 速度と歩幅の関係。絵の踏み出し幅がバンド幅の約 3.6% ぶんなので、
 * 1 歩（stepMs）でそれだけ進むと足が地面を掴んでいるように見える。
 * 速度を変えるときは stepMs も一緒に動かすこと。
 */
const STRIDE_PERCENT = 3.6;
const stepFor = (speed: number) => Math.round((STRIDE_PERCENT / speed) * 1000);

export const MOODS: Record<Daypart, Mood> = {
  // 起きたばかり。あくびと伸びをしながら、ゆっくり動き出す
  morning: {
    walkChance: 0.62,
    speed: 8.5,
    stepMs: stepFor(8.5),
    rests: [
      { pose: "yawn", min: 2200, max: 3400 },
      { pose: "bow", min: 2000, max: 3200 },
      { pose: "stand", min: 1200, max: 2200 },
      { pose: "sniff", min: 1600, max: 2600 },
      { pose: "stand-happy", min: 1400, max: 2400 },
    ],
    reactions: ["yawn", "stand-happy", "wave"],
  },

  // いちばん元気な時間帯
  day: {
    walkChance: 0.86,
    speed: 10.5,
    stepMs: stepFor(10.5),
    rests: [
      { pose: "stand", min: 900, max: 1700 },
      { pose: "sniff", min: 1600, max: 2600 },
      { pose: "sit", min: 1800, max: 3200 },
      { pose: "stand-happy", min: 1400, max: 2400 },
      { pose: "shake", min: 1100, max: 1700 },
      { pose: "dig", min: 1800, max: 2800 },
    ],
    reactions: ["bark", "cheer", "wave", "roll", "shake"],
  },

  // 落ち着いてきて、座ったり寝そべったりが増える
  evening: {
    walkChance: 0.58,
    speed: 9,
    stepMs: stepFor(9),
    rests: [
      { pose: "sit", min: 2400, max: 4200 },
      { pose: "lie", min: 2600, max: 4400 },
      { pose: "sniff", min: 1600, max: 2400 },
      { pose: "stand-happy", min: 1300, max: 2200 },
      { pose: "stand", min: 1000, max: 1800 },
    ],
    reactions: ["stand-happy", "wave", "bark", "roll"],
  },

  // ほとんど寝ている。たまに寝返りを打つ程度
  night: {
    walkChance: 0.14,
    speed: 6.5,
    stepMs: stepFor(6.5),
    rests: [
      { pose: "sleep", min: 6000, max: 11000 },
      { pose: "doze", min: 5000, max: 9000 },
      { pose: "lie", min: 4000, max: 7000 },
      { pose: "yawn", min: 2000, max: 3200 },
    ],
    reactions: ["yawn", "doze", "lie-wave"],
  },
};

/**
 * その時間帯に実際に使う絵だけを集める。30 枚すべてを読むと重いので、
 * まずは歩行と仕草だけ。なでられたとき用は手が空いてから足す。
 */
export function posesForMood(mood: Mood, withReactions: boolean): FrenchiePose[] {
  const set = new Set<FrenchiePose>(["stand", "walk"]);
  for (const r of mood.rests) set.add(r.pose);
  set.add("cheer"); // 記録が増えたときのお祝い
  if (withReactions) for (const p of mood.reactions) set.add(p);
  return [...set];
}

/* ── 記録が増えたことに気づく ────────────────────────────────────── */

export type Progress = {
  prefectures: number;
  municipalities: number;
  visits: number;
};

const PROGRESS_KEY = "odekake:frenchie:progress";

/**
 * 前回このブラウザで見たときより記録が増えていれば true。
 * 初回は覚えるだけで、お祝いはしない（誰でも初回に祝われてしまうため）。
 */
export function claimProgressMilestone(current: Progress): boolean {
  if (typeof window === "undefined") return false;
  let previous: Progress | null = null;
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (raw) previous = JSON.parse(raw) as Progress;
  } catch {
    previous = null;
  }

  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(current));
  } catch {
    // プライベートブラウズなどで書けなくても、動きが止まるほどのことではない
  }

  if (!previous) return false;
  return (
    current.prefectures > previous.prefectures ||
    current.municipalities > previous.municipalities ||
    current.visits > previous.visits
  );
}
