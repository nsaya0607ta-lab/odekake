export type RegionSlug =
  | "hokkaido"
  | "tohoku"
  | "kanto"
  | "chubu"
  | "kinki"
  | "chugoku"
  | "shikoku"
  | "kyushu-okinawa";

export type Region = {
  slug: RegionSlug;
  name: string;
  /** 地方の識別色。訪問済みの塗り分けと凡例に使う */
  tone: "pink" | "green" | "blue" | "yellow" | "purple" | "orange" | "teal" | "rose";
  prefectureCodes: readonly string[];
};

export const REGIONS: readonly Region[] = [
  { slug: "hokkaido", name: "北海道", tone: "pink", prefectureCodes: ["01"] },
  {
    slug: "tohoku",
    name: "東北",
    tone: "blue",
    prefectureCodes: ["02", "03", "04", "05", "06", "07"],
  },
  {
    slug: "kanto",
    name: "関東",
    tone: "green",
    prefectureCodes: ["08", "09", "10", "11", "12", "13", "14"],
  },
  {
    slug: "chubu",
    name: "中部",
    tone: "yellow",
    prefectureCodes: ["15", "16", "17", "18", "19", "20", "21", "22", "23"],
  },
  {
    slug: "kinki",
    name: "近畿",
    tone: "purple",
    prefectureCodes: ["24", "25", "26", "27", "28", "29", "30"],
  },
  { slug: "chugoku", name: "中国", tone: "teal", prefectureCodes: ["31", "32", "33", "34", "35"] },
  { slug: "shikoku", name: "四国", tone: "orange", prefectureCodes: ["36", "37", "38", "39"] },
  {
    slug: "kyushu-okinawa",
    name: "九州・沖縄",
    tone: "rose",
    prefectureCodes: ["40", "41", "42", "43", "44", "45", "46", "47"],
  },
] as const;

const REGION_BY_SLUG = new Map(REGIONS.map((r) => [r.slug, r]));

const REGION_BY_PREFECTURE = new Map<string, Region>();
for (const region of REGIONS) {
  for (const code of region.prefectureCodes) {
    REGION_BY_PREFECTURE.set(code, region);
  }
}

export function getRegion(slug: string): Region | undefined {
  return REGION_BY_SLUG.get(slug as RegionSlug);
}

export function getRegionByPrefecture(prefectureCode: string): Region | undefined {
  return REGION_BY_PREFECTURE.get(prefectureCode);
}
