/**
 * ホームの犬（wandering-frenchie.tsx）と、歩数の看板（steps-tag.tsx）をつなぐ小さな連絡口。
 *
 * 歩数が増えていたら、看板は数字を書き換える前に「犬に書いてもらえるか」をたずねる。
 * 犬がいて引き受けたら、犬は看板の前まで歩いてペンを出し、書きはじめるときに write()、
 * 書きおわったら done() を呼ぶ。犬がいない（動きを減らす設定など）ときは false が返るので、
 * 看板は自分で数字を書き換える。
 */

export type StepsWriteRequest = {
  /** ペンを動かしはじめたとき（ここで数字を書き換えはじめる） */
  write: () => void;
  /** 書きおわって、犬が看板からはなれるとき */
  done: () => void;
};

type Writer = (request: StepsWriteRequest) => boolean;

let writer: Writer | null = null;

/** 犬が「書けます」と名のる。返り値で名のりを取り消す */
export function registerStepsWriter(fn: Writer): () => void {
  writer = fn;
  return () => {
    if (writer === fn) writer = null;
  };
}

/** 看板から犬に頼む。犬がいなければ false */
export function requestStepsWrite(request: StepsWriteRequest): boolean {
  return writer ? writer(request) : false;
}
