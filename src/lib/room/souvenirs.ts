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

/**
 * 飾ったおみやげのところで、わんこがすること（おみやげごとにちがう）。
 * pose/say: 着いてすぐ → then: 少しあと。fx: ハートが出る・ぷるぷるふるえる・くるくる回る・ぴょんとはねる
 */
export type SouvenirAct = { pose: string; say: string; then: { pose: string; say: string }; fx?: "hearts" | "shiver" | "spin" | "hop" };
export const SOUVENIR_ACTS: Record<SouvenirId, SouvenirAct> = {
  pebble: { pose: "sniff", say: "ころころ…", then: { pose: "wink", say: "すべすべで きもちいい" } },
  feather: { pose: "sniff", say: "ふわふわ…くんくん…", then: { pose: "shake", say: "は…はっくしゅん！" } },
  twig: { pose: "stand-happy", say: "この えだ、いい感じ！", then: { pose: "cheer", say: "とってこい、して！" }, fx: "hop" },
  "heart-stone": { pose: "sit", say: "…きれい…", then: { pose: "smile", say: "ずっと たからもの" }, fx: "hearts" },
  sakura: { pose: "sniff", say: "さくらの においが する", then: { pose: "smile", say: "はるって いいね" } },
  dandelion: { pose: "stand-happy", say: "わた毛、ふーってしよう", then: { pose: "wink", say: "ふーっ！ とんでけ〜" } },
  clover: { pose: "bow", say: "おねがいごと…", then: { pose: "cheer", say: "かなうと いいな！" }, fx: "hop" },
  shell: { pose: "wonder", say: "…ざざーん…", then: { pose: "smile", say: "うみの音が きこえた！" } },
  sunflower: { pose: "front", say: "おひさまみたい！", then: { pose: "cheer", say: "なつ、だいすき！" } },
  "sakura-shell": { pose: "sit", say: "すきとおってる…", then: { pose: "wink", say: "めずらしいんだよ、これ" }, fx: "hearts" },
  acorn: { pose: "sniff", say: "どんぐり、ころころ〜", then: { pose: "stand-happy", say: "あきの においだ！" }, fx: "spin" },
  maple: { pose: "stand-happy", say: "がさがさっ！", then: { pose: "smile", say: "まっかで きれい" }, fx: "hop" },
  pinecone: { pose: "sniff", say: "くんくん…", then: { pose: "shake", say: "ちくっ！ いたた…" } },
  "gold-acorn": { pose: "wonder", say: "ぴかぴか…", then: { pose: "cheer", say: "どんぐりの 王さまだ！" }, fx: "hearts" },
  camellia: { pose: "sniff", say: "いい におい", then: { pose: "smile", say: "さむくても さいて えらいね" } },
  nanten: { pose: "sit", say: "おいしそう…", then: { pose: "bow", say: "…たべちゃ だめ。がまん" } },
  "snow-crystal": { pose: "sniff", say: "ひんやり…", then: { pose: "wonder", say: "つめたい！ ぷるぷる…" }, fx: "shiver" },
};

/**
 * 色ちがい：おみやげを1つもらうたびに、まれに（約1/SHINY_RATE）色のちがうものが来る。
 * 絵は同じで、色をまるごと変える（filter）。名前のうしろに「・色ちがい」をつける
 */
export const SHINY_RATE = 16;
export const SHINY_FILTER: Record<SouvenirId, string> = {
  pebble: "sepia(1) saturate(3) hue-rotate(150deg) brightness(1.05)",
  feather: "hue-rotate(140deg) saturate(2.2)",
  twig: "sepia(.6) hue-rotate(170deg) saturate(2.4) brightness(1.1)",
  "heart-stone": "hue-rotate(200deg) saturate(1.4)",
  sakura: "hue-rotate(230deg) saturate(1.3)",
  dandelion: "hue-rotate(180deg) saturate(1.3)",
  clover: "hue-rotate(-70deg) saturate(1.5) brightness(1.08)",
  shell: "hue-rotate(170deg) saturate(1.8)",
  sunflower: "hue-rotate(280deg) saturate(1.2)",
  "sakura-shell": "hue-rotate(140deg) saturate(1.4)",
  acorn: "saturate(0) brightness(1.35) contrast(1.1)",
  maple: "hue-rotate(60deg) saturate(1.3) brightness(1.1)",
  pinecone: "sepia(.5) hue-rotate(80deg) saturate(1.6)",
  "gold-acorn": "hue-rotate(160deg) saturate(1.3) brightness(1.05)",
  camellia: "hue-rotate(-40deg) saturate(1.1) brightness(1.15)",
  nanten: "hue-rotate(40deg) saturate(1.4) brightness(1.1)",
  "snow-crystal": "hue-rotate(110deg) saturate(1.6)",
};
/** 持っている数のキー（色ちがいは「id@iro」） */
export type SouvenirOwnedKey = SouvenirId | `${SouvenirId}@iro`;
export const ownedKey = (id: SouvenirId, shiny = false): SouvenirOwnedKey => (shiny ? `${id}@iro` : id);
export const isOwnedKey = (v: string): v is SouvenirOwnedKey => isSouvenirId(v.replace(/@iro$/, ""));
export const souvenirName = (id: SouvenirId, shiny = false) => (shiny ? `${SOUVENIRS[id].name}・色ちがい` : SOUVENIRS[id].name);
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

export const souvenirKey = (id: SouvenirId, shiny = false) => `souvenir:${id}${shiny ? "@iro" : ""}`;
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
): { key: string; id: SouvenirId; shiny: boolean; date: string; steps: number }[] {
  const done = new Set(brought);
  const from = dayOffset(today, -LOOKBACK_DAYS);
  const days = new Map<string, number>();
  for (const d of history) if (d.date >= from && d.date <= today) days.set(d.date, Math.max(days.get(d.date) ?? 0, d.steps));
  days.set(today, Math.max(days.get(today) ?? 0, todaySteps ?? 0));
  const out: { key: string; id: SouvenirId; shiny: boolean; date: string; steps: number }[] = [];
  for (const [date, steps] of [...days].sort(([a], [b]) => (a < b ? -1 : 1))) {
    for (const m of STEP_COIN_MILESTONES) {
      const key = `${date}:${m.steps}`;
      if (steps >= m.steps && !done.has(key)) out.push({ key, id: souvenirFor(date, m.steps), shiny: hash(`${key}:iro`) % SHINY_RATE === 0, date, steps: m.steps });
    }
  }
  return out;
}

/** 受け取りずみの記録のうち、古いものを捨てる */
export function pruneBrought(brought: readonly string[], today: string): string[] {
  const from = dayOffset(today, -KEEP_DAYS);
  return brought.filter((k) => k.slice(0, 10) >= from);
}
