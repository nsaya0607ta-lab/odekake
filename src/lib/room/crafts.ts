/**
 * おみやげクラフト
 * =============================================================
 * おさんぽのおみやげ（飾っていない分）を材料に、壁に飾る作品をつくる。つくると材料はなくなる。
 * 色ちがいのおみやげは材料にしない（とっておけるように）。作品の数は RoomLayout.crafts に保存する。
 */
import type { SouvenirId } from "./souvenirs";

export const CRAFT_IDS = ["acorn-wreath", "maple-garland", "shell-mobile", "pressed-flowers", "sunflower-swag", "new-year", "pinecone-ornament", "treasure-box"] as const;
export type CraftId = (typeof CRAFT_IDS)[number];

/**
 * name: 名前 / needs: 材料 / width: 壁に掛けたときの幅（部屋の幅に対する %） / talk: わんこのひとこと / made: できたときのひとこと
 */
export const CRAFTS: Record<CraftId, { name: string; needs: Partial<Record<SouvenirId, number>>; width: number; made: string; talk: readonly string[] }> = {
  "acorn-wreath": { name: "どんぐりのリース", needs: { acorn: 5, twig: 2 }, width: 17, made: "どんぐり、まあるく ならんだね！", talk: ["リース、あきの においがする", "どんぐり、ぼくが あつめたんだよ"] },
  "maple-garland": { name: "もみじのガーランド", needs: { maple: 5 }, width: 30, made: "まっかな ガーランド、できた！", talk: ["もみじ、ひらひら きれい", "おへやが あきに なった！"] },
  "shell-mobile": { name: "貝がらのモビール", needs: { shell: 4, feather: 1 }, width: 15, made: "ゆらゆら モビール！ うみみたい", talk: ["貝がら、ゆらゆら…", "うみの音が きこえそう"] },
  "pressed-flowers": { name: "おし花の額", needs: { sakura: 3, dandelion: 2 }, width: 15, made: "はるが ずっと のこるね！", talk: ["おし花、きれいに できたね", "はるの おもいで！"] },
  "sunflower-swag": { name: "ひまわりのスワッグ", needs: { sunflower: 3, twig: 1 }, width: 13, made: "おひさまの たば、できた！", talk: ["ひまわり、げんきが でるね", "なつの おもいで！"] },
  "new-year": { name: "お正月かざり", needs: { camellia: 2, nanten: 3 }, width: 15, made: "おめでたい かざり、できた！", talk: ["ことしも よろしくね", "なんてんで なんを てんじる！"] },
  "pinecone-ornament": { name: "まつぼっくりのオーナメント", needs: { pinecone: 4 }, width: 24, made: "まつぼっくり、ぴかぴかに なった！", talk: ["まつぼっくり、かわいいね", "ふゆの じゅんび ばっちり"] },
  "treasure-box": { name: "たからものの標本箱", needs: { pebble: 3, feather: 2, twig: 1 }, width: 16, made: "ぼくの たからもの、ぜんぶ ここに！", talk: ["たからものの はこ！", "どれも ぼくが みつけたんだ"] },
};

export const craftKey = (id: CraftId) => `craft:${id}`;
export const isCraftId = (v: string): v is CraftId => (CRAFT_IDS as readonly string[]).includes(v);
