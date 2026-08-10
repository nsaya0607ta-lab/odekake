import type { ItemArtKey } from "@/lib/collection/items";

type SilhouetteShape = {
  viewBox: string;
  path: string;
};

/**
 * ユーザー提供の夏・雪国・登山フレブル画像から外周輪郭を抽出したシルエット。
 * 未取得時だけ使用し、簡易SVGの輪郭ではなく元画像そのものの形を見せる。
 */
const EXACT_SILHOUETTES: Partial<Record<ItemArtKey, SilhouetteShape>> = {
  dogSummer: {
    viewBox: "0 0 179 282",
    path: "M 50 17 L 35 30 L 36 35 L 33 36 L 28 49 L 29 55 L 26 56 L 28 62 L 24 64 L 27 69 L 8 74 L 2 88 L 5 90 L 8 104 L 18 107 L 16 124 L 10 129 L 12 133 L 8 136 L 8 146 L 17 163 L 29 173 L 24 188 L 29 195 L 29 201 L 26 202 L 26 222 L 30 224 L 31 231 L 26 232 L 27 236 L 17 247 L 17 254 L 20 255 L 21 262 L 31 262 L 34 270 L 52 267 L 55 270 L 60 267 L 64 257 L 67 262 L 71 261 L 73 271 L 97 271 L 101 265 L 110 272 L 130 268 L 134 270 L 141 265 L 144 267 L 145 263 L 154 258 L 155 251 L 167 250 L 172 246 L 169 245 L 172 228 L 154 220 L 153 213 L 150 212 L 149 198 L 135 175 L 131 152 L 133 142 L 146 143 L 156 128 L 146 111 L 162 72 L 157 38 L 144 32 L 125 41 L 112 54 L 106 49 L 103 51 L 90 44 L 78 43 L 71 31 L 72 27 L 62 19 L 64 16 Z",
  },
  dogSnow: {
    viewBox: "0 0 179 286",
    path: "M 47 16 L 34 28 L 28 55 L 24 56 L 27 63 L 13 83 L 13 102 L 20 111 L 9 143 L 12 144 L 12 151 L 18 156 L 17 159 L 24 165 L 23 189 L 28 197 L 28 206 L 24 218 L 27 236 L 17 236 L 16 246 L 12 247 L 15 248 L 17 260 L 27 268 L 30 266 L 32 272 L 38 275 L 48 273 L 49 276 L 50 273 L 63 271 L 64 274 L 60 275 L 88 279 L 99 270 L 116 278 L 117 273 L 134 270 L 139 267 L 138 263 L 143 263 L 145 258 L 150 259 L 151 253 L 154 255 L 155 251 L 164 249 L 170 242 L 165 220 L 153 219 L 146 190 L 149 186 L 142 185 L 143 174 L 150 173 L 150 140 L 144 140 L 147 114 L 150 113 L 147 112 L 150 108 L 148 103 L 150 97 L 155 94 L 153 91 L 161 75 L 161 45 L 157 32 L 140 30 L 127 40 L 119 41 L 112 32 L 106 33 L 102 28 L 84 36 L 77 44 L 71 40 L 68 26 L 63 24 L 61 18 Z",
  },
  dogHiking: {
    viewBox: "0 0 201 264",
    path: "M 56 8 L 56 11 L 45 21 L 44 32 L 40 35 L 42 37 L 38 48 L 40 64 L 30 69 L 22 81 L 22 88 L 32 103 L 29 107 L 30 113 L 27 115 L 28 120 L 25 121 L 27 125 L 25 131 L 30 143 L 40 155 L 39 161 L 36 162 L 36 167 L 40 170 L 36 177 L 37 196 L 40 197 L 42 204 L 40 210 L 44 214 L 42 221 L 46 229 L 36 242 L 40 250 L 43 248 L 47 255 L 72 253 L 82 249 L 90 250 L 89 255 L 93 255 L 97 260 L 118 261 L 119 256 L 153 255 L 154 251 L 160 252 L 169 240 L 181 236 L 190 227 L 187 202 L 180 200 L 182 183 L 178 177 L 179 172 L 176 171 L 177 159 L 174 157 L 175 151 L 181 145 L 181 126 L 173 118 L 168 119 L 165 114 L 158 112 L 153 103 L 153 98 L 156 97 L 156 83 L 163 74 L 163 67 L 166 66 L 165 57 L 168 55 L 166 29 L 163 29 L 159 22 L 150 20 L 145 23 L 144 21 L 142 25 L 138 24 L 133 30 L 130 29 L 122 43 L 117 43 L 108 38 L 98 39 L 95 35 L 85 36 L 81 26 L 77 25 L 79 21 L 69 10 Z",
  },
};

export function ExactSilhouette({ art, className = "" }: { art?: ItemArtKey; className?: string }) {
  if (!art) return null;
  const shape = EXACT_SILHOUETTES[art];
  if (!shape) return null;

  return (
    <svg
      viewBox={shape.viewBox}
      role="img"
      aria-label="未取得のアイテム"
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full ${className}`}
    >
      <path d={shape.path} fill="#181613" />
    </svg>
  );
}

export function hasExactSilhouette(art?: ItemArtKey): boolean {
  return Boolean(art && EXACT_SILHOUETTES[art]);
}
