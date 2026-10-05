/**
 * わんこの気分メーター
 * =============================================================
 * きょうの「おさんぽ（歩数）・きのうのおさんぽ・なでなで・いっしょに遊んだ回数・おへやのきれいさ・フレンドが来ている」から、
 * 0〜100 の気分を決める。雨・雷の日は おさんぽに行けないので、少し下がる。
 *4段階（さみしい・ふつう・ごきげん・るんるん）で、わんこの動きとセリフが変わる。
 * なでた回数・遊んだ回数は、この端末にきょうの分だけ残す（日付が変わると0から）。
 */

export type MoodLevel = "lonely" | "normal" | "happy" | "super";
export type MoodPartId = "walk" | "yesterday" | "pet" | "play" | "room" | "friend" | "weather";
/** minus: 気分を下げるもの（value はマイナス、max は下がりうるいちばん大きな幅） */
export type MoodPart = { id: MoodPartId; label: string; value: number; max: number; minus?: boolean };
export type Mood = { score: number; level: MoodLevel; parts: MoodPart[] };

export const MOOD_LEVELS: Record<MoodLevel, { name: string; min: number; color: string }> = {
  lonely: { name: "さみしい", min: 0, color: "#8FA3C8" },
  normal: { name: "ふつう", min: 25, color: "#9CC47A" },
  happy: { name: "ごきげん", min: 50, color: "#F2B53A" },
  super: { name: "るんるん", min: 75, color: "#F07A9A" },
};
const ORDER: MoodLevel[] = ["lonely", "normal", "happy", "super"];

/** 歩数の点が満点になる歩数 */
export const MOOD_WALK_FULL = 5000;
/** きのう、これだけ歩いていれば「きのうのおさんぽ」が満点 */
export const MOOD_YESTERDAY_STEPS = 2000;
const PET_PTS = 5, PLAY_PTS = 4;
/** 雨（小雨をふくむ）・雷のときに下がる点 */
export const MOOD_RAIN_PENALTY = 10, MOOD_THUNDER_PENALTY = 15;
export type MoodWeather = "rain" | "thunder" | null;
/** 窓の外の天気から、気分に効く天気を決める（雨・小雨 → rain、雷 → thunder、ほかは null） */
export function moodWeatherOf(kind: string | null | undefined): MoodWeather {
  return kind === "thunder" ? "thunder" : kind === "rain" || kind === "drizzle" ? "rain" : null;
}

export function moodLevelOf(score: number): MoodLevel {
  return [...ORDER].reverse().find((l) => score >= MOOD_LEVELS[l].min) ?? "lonely";
}
export const moodRank = (l: MoodLevel) => ORDER.indexOf(l);

export function moodOf(input: { steps: number; yesterday: number; pets: number; plays: number; dirt: number; guest: boolean; weather?: MoodWeather }): Mood {
  const parts: MoodPart[] = [
    { id: "walk", label: "きょうの おさんぽ", value: Math.round(40 * Math.min(1, Math.max(0, input.steps) / MOOD_WALK_FULL)), max: 40 },
    { id: "yesterday", label: "きのうの おさんぽ", value: Math.round(15 * Math.min(1, Math.max(0, input.yesterday) / MOOD_YESTERDAY_STEPS)), max: 15 },
    { id: "pet", label: "なでなで", value: Math.min(25, input.pets * PET_PTS), max: 25 },
    { id: "play", label: "いっしょに あそぶ", value: Math.min(20, input.plays * PLAY_PTS), max: 20 },
    { id: "room", label: "おへやの きれいさ", value: Math.round(15 * (1 - Math.min(1, Math.max(0, input.dirt)))), max: 15 },
    { id: "friend", label: "フレンドが あそびに来てる", value: input.guest ? 10 : 0, max: 10 },
  ];
  // 雨・雷の日だけ、マイナスの行を足す
  if (input.weather) {
    const thunder = input.weather === "thunder";
    parts.push({ id: "weather", label: thunder ? "かみなりの日" : "雨の日", value: -(thunder ? MOOD_THUNDER_PENALTY : MOOD_RAIN_PENALTY), max: MOOD_THUNDER_PENALTY, minus: true });
  }
  const score = Math.max(0, Math.min(100, parts.reduce((s, p) => s + p.value, 0)));
  return { score, level: moodLevelOf(score), parts };
}

/** 次の段階まであと何点か・何をするとよいか（いちばん手軽なものから） */
export function moodTip(m: Mood): string {
  const next = ORDER[moodRank(m.level) + 1];
  if (!next) return "さいこうの きぶん！ いっぱい なでてあげてね";
  const need = MOOD_LEVELS[next].min - m.score;
  const pet = m.parts.find((p) => p.id === "pet")!, play = m.parts.find((p) => p.id === "play")!, walk = m.parts.find((p) => p.id === "walk")!;
  const tips: string[] = [];
  if (pet.value < pet.max) tips.push(`なでる（あと${Math.ceil(Math.min(need, pet.max - pet.value) / PET_PTS)}回）`);
  if (play.value < play.max) tips.push(`家具やおみやげをタップして いっしょに あそぶ`);
  if (walk.value < walk.max) {
    const stepsNeed = Math.ceil((Math.min(need, walk.max - walk.value) / 40) * MOOD_WALK_FULL / 100) * 100;
    tips.push(`あと${Math.max(100, stepsNeed).toLocaleString("ja-JP")}歩 おさんぽ`);
  }
  const rainy = m.parts.some((p) => p.id === "weather");
  return `あと${need}で「${MOOD_LEVELS[next].name}」：${tips.slice(0, 2).join("・") || "もうすこし！"}${rainy ? "（雨の日は おうちで いっぱい あそんであげてね）" : ""}`;
}

/** 気分ごとの、なでたときのセリフ */
export const MOOD_LINES: Record<MoodLevel, readonly string[]> = {
  lonely: ["…あそんで？", "さみしかった…", "おさんぽ、いきたいな…", "もっと なでて…"],
  normal: ["わん！", "なでなで うれしい", "きょうは なにする？"],
  happy: ["ごきげんだよ！", "しっぽが とまらない！", "いっしょだと たのしいね"],
  super: ["だいすき！ だいすき！", "るんるん♪", "きょう さいこう！", "ぎゅーって して！"],
};
/** さみしいときに、窓のそばでつぶやくこと */
export const LONELY_SIGHS = ["…ごしゅじん、まだかな", "おさんぽ、いつかな…", "…くぅーん", "ひとりは さみしいな…"];
/** るんるんのときに、おどりながら言うこと */
export const SUPER_DANCE = ["るんるん♪", "おどっちゃう！", "らんらん〜♪", "うれしいダンス！"];
