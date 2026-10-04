/**
 * おさんぽのおみやげ
 * =============================================================
 * その日の歩数が節目（STEP_COIN_MILESTONES：3,000歩から1,000歩ごと）を越えるたびに、
 * わんこがおさんぽ先で見つけたものを1つ持って帰ってくる。中身は季節で変わり、10,000歩のときはレアなもの。
 * 何が来るかは「日付と節目」で決まる（同じ日に何度開いても同じ。どの端末でも同じ）。
 * もらった数は部屋の飾り方（RoomLayout.souvenirs）にいっしょに保存し、もようがえで棚や床に飾れる。
 */
import { STEP_COIN_MILESTONES } from "@/lib/coins";

export const SOUVENIR_IDS = [
  "pebble", "feather", "twig", "heart-stone",
  "sakura", "dandelion", "clover",
  "shell", "sunflower", "sakura-shell",
  "acorn", "maple", "pinecone", "gold-acorn",
  "camellia", "nanten", "snow-crystal",
] as const;
export type SouvenirId = (typeof SOUVENIR_IDS)[number];

type Season = "spring" | "summer" | "autumn" | "winter";
/**
 * name: 名前 / seasons: 拾える季節（空ならいつでも） / rare: 10,000歩のときだけ
 * found: もらったときの、わんこのひとこと（どこで見つけたか） / talk: 飾ったものを見に行ったときに言うこと
 */
export type Souvenir = { name: string; seasons: Season[]; rare?: boolean; found: string; talk: readonly string[] };
export const SOUVENIRS: Record<SouvenirId, Souvenir> = {
  pebble: { name: "まるい石", seasons: [], found: "川のそばで ひろったよ。すべすべ！", talk: ["この石、すべすべなんだよ", "まるい石、ぼくのたからもの"] },
  feather: { name: "鳥のはね", seasons: [], found: "こうえんに ふわっと おちてたよ", talk: ["このはね、どの鳥さんのかな？", "ふわふわの はね…"] },
  twig: { name: "いい感じの小えだ", seasons: [], found: "いちばん いい感じの えだを えらんだよ！", talk: ["この えだ、くわえやすいんだ", "いい感じでしょ？"] },
  "heart-stone": { name: "ハートの石", seasons: [], rare: true, found: "ハートの形の石！ たからものだよ", talk: ["ハートの石、きらきら…", "これは とくべつな たからもの！"] },
  sakura: { name: "さくらの花びら", seasons: ["spring"], found: "さくら並木で ひらひら つかまえたよ", talk: ["さくら、きれいだったね", "はなびら、ひらひら〜"] },
  dandelion: { name: "たんぽぽ", seasons: ["spring"], found: "道ばたで さいてたよ。ふわふわもあるよ", talk: ["たんぽぽ、ふーって したいな", "きいろくて かわいいね"] },
  clover: { name: "よつばのクローバー", seasons: ["spring"], rare: true, found: "よつばだよ！ くんくん さがしたんだ", talk: ["よつばの クローバー、しあわせになれるかな", "ぼく、さがすの とくいなんだ"] },
  shell: { name: "貝がら", seasons: ["summer"], found: "すなはまで みつけたよ。うみの においがする", talk: ["貝がらから うみの音、するかな？", "うみ、また行きたいね"] },
  sunflower: { name: "ひまわり", seasons: ["summer"], found: "おひさまみたいな お花、もらったよ", talk: ["ひまわり、おひさまの ほう むいてる！", "なつって かんじ！"] },
  "sakura-shell": { name: "さくら貝", seasons: ["summer"], rare: true, found: "ピンクの 貝がら！ めずらしいんだって", talk: ["さくら貝、すきとおってて きれい", "めずらしいんだよ、これ"] },
  acorn: { name: "どんぐり", seasons: ["autumn"], found: "どんぐり いっぱい おちてたよ！", talk: ["このどんぐり、ぼくが みつけたんだ！", "どんぐり、ころころ…"] },
  maple: { name: "もみじ", seasons: ["autumn"], found: "まっかな はっぱ、きれいでしょ", talk: ["もみじ、まっか！", "あきの においが するね"] },
  pinecone: { name: "まつぼっくり", seasons: ["autumn"], found: "まつぼっくり、くわえて かえってきたよ", talk: ["まつぼっくり、かじっちゃ だめ…？", "ちくちく するね"] },
  "gold-acorn": { name: "ぴかぴかどんぐり", seasons: ["autumn"], rare: true, found: "ぴかぴかの どんぐり！ すごいでしょ！", talk: ["ぴかぴかどんぐり、みて みて！", "これ、きっと どんぐりの王さまだよ"] },
  camellia: { name: "つばきの花", seasons: ["winter"], found: "さむい中で さいてたよ。まっか！", talk: ["つばき、さむくても さくんだね", "まっかで きれい"] },
  nanten: { name: "なんてんの実", seasons: ["winter"], found: "あかい実、つやつや してたよ", talk: ["なんてんの実、つやつや", "たべちゃ だめ なんだって"] },
  "snow-crystal": { name: "とけない雪のけっしょう", seasons: ["winter"], rare: true, found: "ふしぎ！ とけない 雪のけっしょうだよ", talk: ["雪のけっしょう、ずっと とけないの", "まほうの 雪かな？"] },
};

/** 季節の名前（まだ持っていないおみやげのヒント） */
export const SEASON_NAMES: Record<Season, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
/** まだ持っていないおみやげの、見つかるときのヒント */
export function souvenirHint(id: SouvenirId): string {
  const s = SOUVENIRS[id];
  const when = s.seasons.length ? `${s.seasons.map((x) => SEASON_NAMES[x]).join("・")}の おさんぽで` : "いつでも おさんぽで";
  return s.rare ? `${when}、1日10,000歩 あるくと 見つかるかも` : `${when} 見つかるかも`;
}

export const souvenirKey = (id: SouvenirId) => `souvenir:${id}`;
export const isSouvenirId = (v: string): v is SouvenirId => (SOUVENIR_IDS as readonly string[]).includes(v);

/** 日付（YYYY-MM-DD）の季節 */
function seasonOf(date: string): Season {
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "autumn" : "winter";
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** レアが出る節目 */
const RARE_STEPS = 10000;

/** その日・その節目で持って帰ってくるもの。季節のもの と いつでも拾えるもの から選ぶ（季節のものが出やすい） */
export function souvenirFor(date: string, steps: number): SouvenirId {
  const season = seasonOf(date);
  const rare = steps >= RARE_STEPS;
  const pool = SOUVENIR_IDS.filter((id) => Boolean(SOUVENIRS[id].rare) === rare && (SOUVENIRS[id].seasons.length === 0 || SOUVENIRS[id].seasons.includes(season)));
  // 季節のものは2倍出やすい
  const weighted = pool.flatMap((id) => (SOUVENIRS[id].seasons.length ? [id, id] : [id]));
  return weighted[hash(`${date}:${steps}`) % weighted.length]!;
}

/** 何日前の分まで、あとから受け取れるか（アプリを開かなかった日の分） */
const LOOKBACK_DAYS = 3;
/** 受け取りずみの記録（「日付:節目」）を残しておく日数 */
const KEEP_DAYS = 14;

const dayOffset = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * まだ受け取っていないおみやげ。きょうと、さかのぼって LOOKBACK_DAYS 日の歩数から、越えた節目ごとに1つ。
 * brought は受け取りずみの「日付:節目」
 */
export function pendingSouvenirs(
  history: readonly { date: string; steps: number }[],
  todaySteps: number | null | undefined,
  today: string,
  brought: readonly string[],
): { key: string; id: SouvenirId; date: string; steps: number }[] {
  const done = new Set(brought);
  const from = dayOffset(today, -LOOKBACK_DAYS);
  const days = new Map<string, number>();
  for (const d of history) if (d.date >= from && d.date <= today) days.set(d.date, Math.max(days.get(d.date) ?? 0, d.steps));
  days.set(today, Math.max(days.get(today) ?? 0, todaySteps ?? 0));
  const out: { key: string; id: SouvenirId; date: string; steps: number }[] = [];
  for (const [date, steps] of [...days].sort(([a], [b]) => (a < b ? -1 : 1))) {
    for (const m of STEP_COIN_MILESTONES) {
      const key = `${date}:${m.steps}`;
      if (steps >= m.steps && !done.has(key)) out.push({ key, id: souvenirFor(date, m.steps), date, steps: m.steps });
    }
  }
  return out;
}

/** 受け取りずみの記録のうち、古いものを捨てる */
export function pruneBrought(brought: readonly string[], today: string): string[] {
  const from = dayOffset(today, -KEEP_DAYS);
  return brought.filter((k) => k.slice(0, 10) >= from);
}
