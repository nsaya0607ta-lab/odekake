/**
 * 市区町村の境界パス
 * =============================================================
 * 都道府県ごとにファイルを分けてあり、開いている都道府県の分だけを
 * サーバーコンポーネントから読み込む（全国分＝約2MBを端末へ送らないため）。
 * クライアントコンポーネントからは import しないこと。
 * 生成は scripts/build-municipality-paths.mjs。
 *
 * 座標は「都道府県地図」の縮尺（prefecture スコープ）に合わせてある。
 */
export type MunicipalityShape = {
  code: string;
  /** SVG の path データ。飛び地は複数のサブパスになる */
  d: string;
  /** ラベルと目印を置く点 */
  center: [number, number];
  /** 描画したときの大きさ。小さいものには目印を重ねる */
  span: number;
};

type RawShape = { code: string; d: string; center: number[]; span: number };

const cache = new Map<string, MunicipalityShape[]>();

export async function loadMunicipalityShapes(prefectureCode: string): Promise<MunicipalityShape[]> {
  const cached = cache.get(prefectureCode);
  if (cached) return cached;

  if (!/^\d{2}$/.test(prefectureCode)) return [];

  try {
    const loaded = (await import(`./municipality-paths/${prefectureCode}.json`)) as {
      default: RawShape[];
    };
    const shapes: MunicipalityShape[] = loaded.default.map((item) => ({
      code: item.code,
      d: item.d,
      center: [item.center[0] ?? 0, item.center[1] ?? 0],
      span: item.span,
    }));
    cache.set(prefectureCode, shapes);
    return shapes;
  } catch {
    // 境界データが無い都道府県では、地図を出さずに一覧だけを見せる
    return [];
  }
}
