/**
 * おさんぽフレンチー：分かれ道のあとの景色（8種類）と、入口・出口のゲート
 * =============================================================
 * engine.ts が、入口ゲートと出口ゲートのあいだだけ切り抜いて（clip）呼ぶ。
 * 座標は論理ピクセル。base は入口ゲートの画面x（道と同じ速さで左へ流れる）。
 * 奥のものほど視差でゆっくり流し、時間帯の色（env）になじませる。夜は窓や灯りをともす。
 */
import { ell, font, glow, hex, mix, rgb, rr, type Ctx, type RGB } from "./draw";

export type RouteTheme = "park" | "stream" | "riverbank" | "ridge" | "kamakura" | "arcade" | "onsen" | "yatai";

/** 時間帯の色（engine.ts の Env のうち使う分） */
export type RouteEnv = { top: RGB; bot: RGB; far: RGB; near: RGB; night: number };

export type RouteView = {
  c: Ctx;
  e: RouteEnv;
  /** 犬の足もとの高さ */
  g: number;
  /** 経過秒（揺れ・流れ・湯けむり） */
  t: number;
  /** 入口ゲートの画面x */
  base: number;
  /** 描く範囲（画面x） */
  left: number;
  right: number;
  /** ゆったりモード：奥の層を流さない */
  still: boolean;
  /** 動きを減らす設定：揺れや舞うものを止める */
  calm: boolean;
  /** 左右の切れ目（ゲートの柱）が画面に入っているか */
  seamL: boolean;
  seamR: boolean;
};

/** 同じ場所にはいつも同じものが立つよう、番号から決まる 0〜1 の値 */
const h01 = (i: number, salt: number) => { const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return v - Math.floor(v); };
const pick = <T>(list: readonly T[], i: number, salt: number): T => list[Math.floor(h01(i, salt) * list.length) % list.length]!;
/** 順番に巡る（隣どうしが同じにならない）。step は list.length と互いに素にする */
const cycle = <T>(list: readonly T[], i: number, step = 3): T => list[(((i * step) % list.length) + list.length) % list.length]!;

type Tones = {
  /** 手前のもの。夕方は空の色が少し乗り、夜は暗く沈む */
  tone: (h: string, k?: number) => string;
  /** 奥のもの。空気の色に寄せて、かすませる */
  far: (h: string, k?: number) => string;
  /** 夜の度合い（0〜1） */
  n: number;
  /** 灯りの強さ。夕方から効きはじめる */
  lit: number;
};
function tones(e: RouteEnv): Tones {
  const n = e.night;
  return {
    tone: (h, k = 0) => rgb(mix(mix(hex(h), e.bot, 0.06), e.near, Math.min(0.9, 0.04 + k + n * 0.55))),
    far: (h, k = 0) => rgb(mix(mix(hex(h), e.far, Math.min(0.92, 0.38 + k)), e.near, n * 0.4)),
    n,
    lit: Math.max(0, Math.min(1, (n - 0.12) / 0.5)),
  };
}

/** 視差 f・間隔 gap で並ぶものを、描く範囲に入る分だけ順に呼ぶ（jitter で間隔をばらつかせる） */
function each(v: RouteView, gap: number, f: number, salt: number, jitter: number, fn: (x: number, i: number) => void): void {
  const b = v.base * (v.still && f < 1 ? 0 : f);
  const i0 = Math.floor((v.left - 160 - b) / gap);
  for (let i = i0; ; i++) {
    const x = b + i * gap + h01(i, salt) * gap * jitter;
    if (x > v.right + 160) break;
    fn(x, i);
  }
}
const sway = (v: RouteView, i: number, amt: number, speed = 1.4) => (v.calm ? 0 : Math.sin(v.t * speed + i * 1.91) * amt);
/** ゆったり流れるもの（川の流れ・雲など）のずれ */
const drift = (v: RouteView, speed: number, gap: number) => (v.calm ? 0 : (v.t * speed) % gap);
function shadow(c: Ctx, x: number, y: number, rx: number, a = 0.2): void {
  c.fillStyle = `rgba(20,18,40,${a})`; ell(c, x, y, rx, rx * 0.16); c.fill();
}
function vText(c: Ctx, s: string, x: number, y: number, size: number): void {
  c.font = font(size); c.textAlign = "center"; c.textBaseline = "middle";
  [...s].forEach((ch, k) => c.fillText(ch, x, y + k * (size + 1)));
}

/* ============================================================= */
/*  共通の小物                                                    */
/* ============================================================= */
const TREE_BLOBS: readonly (readonly [number, number, number])[] = [[-0.8, 0.25, 0.62], [0.8, 0.3, 0.6], [0, -0.1, 0.82], [-0.45, -0.55, 0.56], [0.45, -0.5, 0.58], [0, 0.45, 0.62]];
/** 丸い広葉樹。3段の色で立体に見せ、樹冠だけ風で揺らす */
function roundTree(c: Ctx, T: Tones, x: number, by: number, h: number, pal: readonly [string, string, string], sw: number): void {
  shadow(c, x + 8, by + 1, 28);
  c.fillStyle = T.tone("#6B4A32");
  c.beginPath(); c.moveTo(x - 4.5, by); c.lineTo(x - 2.4, by - h * 0.58); c.lineTo(x + 2.4, by - h * 0.58); c.lineTo(x + 4.5, by); c.closePath(); c.fill();
  c.fillStyle = T.tone("#47301F"); c.fillRect(x + 1, by - h * 0.52, 2.8, h * 0.52);
  c.strokeStyle = T.tone("#6B4A32"); c.lineWidth = 2; c.lineCap = "round";
  c.beginPath(); c.moveTo(x, by - h * 0.4); c.lineTo(x - 11 + sw * 0.5, by - h * 0.64); c.moveTo(x, by - h * 0.46); c.lineTo(x + 12 + sw * 0.5, by - h * 0.68); c.stroke();
  const cx = x + sw, cy = by - h * 0.74, R = 17 + h * 0.13;
  c.fillStyle = T.tone(pal[0]); for (const [dx, dy, r] of TREE_BLOBS) { ell(c, cx + dx * R, cy + dy * R + 3, r * R, r * R * 0.92); c.fill(); }
  c.fillStyle = T.tone(pal[1]); for (const [dx, dy, r] of TREE_BLOBS) { ell(c, cx + dx * R - 2, cy + dy * R - 1.5, r * R * 0.8, r * R * 0.72); c.fill(); }
  c.fillStyle = T.tone(pal[2]); for (const [dx, dy, r] of TREE_BLOBS) if (dy < 0.1) { ell(c, cx + dx * R - R * 0.2, cy + dy * R - R * 0.24, r * R * 0.42, r * R * 0.32); c.fill(); }
}
/** 雪をかぶった針葉樹 */
function snowPine(c: Ctx, T: Tones, x: number, by: number, h: number, sw: number): void {
  shadow(c, x + 6, by + 1, 20, 0.14);
  c.fillStyle = T.tone("#5A3E2A"); c.fillRect(x - 2.5, by - h * 0.2, 5, h * 0.2);
  for (let k = 0; k < 4; k++) {
    const y = by - h * 0.16 - k * h * 0.2, wd = 24 - k * 5, top = y - h * 0.3, s = sw * (k / 3);
    c.fillStyle = T.tone("#2F5E4A"); c.beginPath(); c.moveTo(x - wd, y); c.lineTo(x + s, top); c.lineTo(x + wd, y); c.closePath(); c.fill();
    c.fillStyle = T.tone("#24493A"); c.beginPath(); c.moveTo(x + s, top); c.lineTo(x + wd, y); c.lineTo(x + wd * 0.2, y); c.closePath(); c.fill();
    c.fillStyle = T.tone("#FFFFFF");
    c.beginPath(); c.moveTo(x - wd * 0.7, y - h * 0.08); c.quadraticCurveTo(x - wd * 0.2, y - h * 0.13, x + s, top + 1); c.quadraticCurveTo(x + wd * 0.35, y - h * 0.12, x + wd * 0.75, y - h * 0.07);
    c.quadraticCurveTo(x, y - h * 0.03, x - wd * 0.7, y - h * 0.08); c.fill();
  }
}
/** 提灯。揺れと灯り */
function lantern(c: Ctx, T: Tones, x: number, y: number, col: string, label: string, sw: number, size = 1): void {
  const lx = x + sw;
  if (T.lit > 0) glow(c, lx, y + 8 * size, 22 * size, col === "#E23B3B" ? "255,110,80" : "255,225,170", 0.55 * T.lit);
  c.strokeStyle = "#2A2440"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y - 3); c.lineTo(lx, y); c.stroke();
  const body = T.lit > 0.1 ? col : T.tone(col, -0.02);
  c.fillStyle = body; ell(c, lx, y + 8 * size, 5.2 * size, 7.2 * size); c.fill();
  c.strokeStyle = "rgba(0,0,0,0.18)"; c.lineWidth = 0.6;
  for (let k = -1; k <= 1; k++) { c.beginPath(); c.ellipse(lx, y + 8 * size, 5.2 * size * (1 - Math.abs(k) * 0.45), 7.2 * size, 0, 0, Math.PI * 2); c.stroke(); }
  c.fillStyle = "#2A2440"; c.fillRect(lx - 3 * size, y, 6 * size, 1.8 * size); c.fillRect(lx - 3 * size, y + 14.4 * size, 6 * size, 1.8 * size);
  if (label) { c.fillStyle = col === "#E23B3B" ? "#2A1414" : "#B23A3A"; c.font = font(5 * size); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(label, lx, y + 8.5 * size); }
}
/** 公園やお店の街灯 */
function streetLamp(c: Ctx, T: Tones, g: number, x: number, h: number, style: "park" | "gas"): void {
  const top = g - h;
  if (T.lit > 0) {
    c.fillStyle = `rgba(255,220,150,${0.18 * T.lit})`; ell(c, x, g + 7, 34, 7); c.fill();
    glow(c, x, top - 6, 48, "255,220,150", 0.5 * T.lit);
  }
  c.fillStyle = T.tone(style === "park" ? "#2E3B35" : "#2A2A30");
  rr(c, x - 5, g - 12, 10, 7, 2); c.fill();
  c.fillRect(x - 1.7, top, 3.4, h - 10);
  c.beginPath(); c.moveTo(x - 6, top - 2); c.lineTo(x + 6, top - 2); c.lineTo(x + 4, top - 13); c.lineTo(x - 4, top - 13); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(x - 7, top - 13); c.lineTo(x, top - 19); c.lineTo(x + 7, top - 13); c.closePath(); c.fill();
  c.fillStyle = T.lit > 0.05 ? `rgba(255,230,170,${0.55 + 0.45 * T.lit})` : T.tone("#DCE8EA");
  c.beginPath(); c.moveTo(x - 4.5, top - 3); c.lineTo(x + 4.5, top - 3); c.lineTo(x + 3, top - 12); c.lineTo(x - 3, top - 12); c.closePath(); c.fill();
}

/* ============================================================= */
/*  公園                                                          */
/* ============================================================= */
function park(v: RouteView, T: Tones): void {
  const { c, e, g, left, right } = v, W = right - left;
  // 奥の木立（ゆっくり流れる）
  each(v, 24, 0.45, 1, 0.4, (x, i) => {
    const y = g - 72 - h01(i, 2) * 12, rx = 16 + h01(i, 3) * 10, ry = 15 + h01(i, 4) * 8;
    c.fillStyle = T.far("#3F7A4E", 0.02); ell(c, x, y, rx, ry); c.fill();
    c.fillStyle = T.far("#6AA56E", 0.02); ell(c, x - rx * 0.3, y - ry * 0.35, rx * 0.5, ry * 0.42); c.fill();
  });
  c.fillStyle = T.far("#3F7A4E", 0.02); c.fillRect(left, g - 74, W, 14);
  // 芝生と刈り込みの縞
  const lg = c.createLinearGradient(0, g - 62, 0, g - 6);
  lg.addColorStop(0, T.tone("#86C66A")); lg.addColorStop(1, T.tone("#4D9243"));
  c.fillStyle = lg; c.fillRect(left, g - 62, W, 56);
  c.fillStyle = `rgba(255,255,255,${0.07 * (1 - T.n)})`;
  each(v, 60, 1, 0, 0, (x) => { c.beginPath(); c.moveTo(x, g - 62); c.lineTo(x + 30, g - 62); c.lineTo(x + 44, g - 6); c.lineTo(x + 14, g - 6); c.closePath(); c.fill(); });
  // 奥の生け垣
  each(v, 15, 0.92, 7, 0.2, (x, i) => {
    const y = g - 62 - h01(i, 8) * 3;
    c.fillStyle = T.tone("#3A7A42"); ell(c, x, y, 11, 8); c.fill();
    c.fillStyle = T.tone("#5EA25A"); ell(c, x - 3, y - 3, 6, 3.6); c.fill();
  });
  // 池とカモ
  each(v, 470, 1, 20, 0.2, (x, i) => {
    if (h01(i, 21) < 0.4) return;
    const cx = x + 70, cy = g - 30;
    const wg = c.createLinearGradient(0, cy - 9, 0, cy + 9);
    wg.addColorStop(0, rgb(mix(mix(hex("#6DB6DA"), e.top, 0.35), e.near, T.n * 0.5))); wg.addColorStop(1, rgb(mix(hex("#3E86B4"), e.near, 0.05 + T.n * 0.5)));
    c.fillStyle = T.tone("#8E8B80"); ell(c, cx, cy + 1.5, 56, 12.5); c.fill();
    c.fillStyle = wg; ell(c, cx, cy, 52, 10); c.fill();
    c.fillStyle = `rgba(255,255,255,${0.35 - T.n * 0.2})`;
    for (let k = 0; k < 3; k++) { c.fillRect(cx - 30 + k * 22 + sway(v, k, 3, 0.8), cy - 3 + k * 2.5, 12, 1.2); }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, sx = cx + Math.cos(a) * 54, sy = cy + Math.sin(a) * 11.5;
      c.fillStyle = T.tone(k % 2 ? "#A7A396" : "#8C897D"); ell(c, sx, sy, 4.2, 2.6); c.fill();
    }
    c.fillStyle = T.tone("#4F9A4A"); ell(c, cx + 26, cy + 2, 6, 2); c.fill(); ell(c, cx + 34, cy - 2, 4.5, 1.5); c.fill();
    const dx = cx - 14 + sway(v, i, 10, 0.35), dy = cy - 2 + sway(v, i + 2, 0.8, 2.2);
    c.fillStyle = "rgba(255,255,255,0.25)"; ell(c, dx, dy + 3, 8, 1.4); c.fill();
    c.fillStyle = T.tone("#F4F1E8"); ell(c, dx, dy, 7, 4); c.fill();
    c.fillStyle = T.tone("#2E6B45"); ell(c, dx - 6, dy - 4.5, 3.2, 3); c.fill();
    c.fillStyle = T.tone("#F0A030"); c.beginPath(); c.moveTo(dx - 9, dy - 4.5); c.lineTo(dx - 12.5, dy - 3.6); c.lineTo(dx - 9, dy - 3); c.fill();
  });
  // 木（ときどき桜）
  each(v, 112, 0.96, 3, 0.45, (x, i) => {
    const sakura = h01(i, 9) < 0.28;
    roundTree(c, T, x, g - 34 - h01(i, 5) * 10, 66 + h01(i, 4) * 40, sakura ? ["#D08AA4", "#EFAEC4", "#FFDDE8"] : ["#2E6B3A", "#4B984D", "#7CC46A"], sway(v, i, 1.8));
  });
  // 花壇
  each(v, 58, 1, 40, 0.5, (x, i) => {
    if (h01(i, 41) < 0.35) return;
    c.fillStyle = T.tone("#5A3F2C"); ell(c, x, g - 8, 19, 3.4); c.fill();
    c.fillStyle = T.tone("#3F8A45"); for (let k = 0; k < 7; k++) { ell(c, x - 15 + k * 5, g - 11 - h01(i + k, 42) * 3, 3.4, 2.2, 0.4); c.fill(); }
    const cols = ["#F26D8F", "#FFD166", "#FFFFFF", "#B48CF2", "#FF8E4A"];
    for (let k = 0; k < 8; k++) {
      const fx = x - 16 + k * 4.4, fy = g - 14 - h01(i * 3 + k, 43) * 5;
      c.fillStyle = T.tone(pick(cols, i * 5 + k, 44)); ell(c, fx, fy, 2.2, 2.2); c.fill();
      c.fillStyle = T.tone("#FFF3C4"); ell(c, fx, fy, 0.8, 0.8); c.fill();
    }
  });
  // ベンチと街灯
  each(v, 176, 1, 11, 0.3, (x, i) => {
    if (h01(i, 12) < 0.55) {
      shadow(c, x + 22, g - 5, 26);
      c.fillStyle = T.tone("#2E2E36"); c.fillRect(x + 4, g - 24, 3, 18); c.fillRect(x + 37, g - 24, 3, 18); c.fillRect(x + 6, g - 38, 2.4, 14); c.fillRect(x + 36, g - 38, 2.4, 14);
      for (let k = 0; k < 2; k++) { c.fillStyle = T.tone(k ? "#9A6A3E" : "#B07B48"); rr(c, x, g - 38 + k * 6, 44, 4, 1.5); c.fill(); }
      c.fillStyle = T.tone("#B07B48"); rr(c, x - 1, g - 25, 46, 4.5, 1.5); c.fill();
      c.fillStyle = T.tone("#7E5431"); c.fillRect(x - 1, g - 21, 46, 1.4);
    } else streetLamp(c, T, g, x + 20, 96, "park");
  });
  // 土の小道・縁石・小石
  const pg = c.createLinearGradient(0, g - 6, 0, g + 19);
  pg.addColorStop(0, T.tone("#E4CC98")); pg.addColorStop(1, T.tone("#C6A870"));
  c.fillStyle = pg; c.fillRect(left, g - 6, W, 25);
  c.fillStyle = "rgba(90,60,30,0.08)"; c.fillRect(left, g + 3, W, 2); c.fillRect(left, g + 12, W, 2);
  each(v, 13, 1, 31, 0.9, (x, i) => { c.fillStyle = T.tone(h01(i, 32) < 0.5 ? "#AF9364" : "#F2E3BF"); ell(c, x, g + h01(i, 33) * 17, 1.2 + h01(i, 34) * 1.8, 0.9 + h01(i, 35)); c.fill(); });
  each(v, 9, 1, 30, 0, (x, i) => { c.fillStyle = T.tone(i % 2 ? "#C2BBAA" : "#AAA393"); rr(c, x, g - 9.5, 8.6, 5, 2); c.fill(); });
  // 舞う花びらと葉
  if (!v.calm) {
    for (let k = 0; k < 18; k++) {
      const span = W + 60, x = left - 30 + ((((k * 97.3 - v.t * (16 + (k % 5) * 5)) % span) + span) % span);
      const y = g - 160 + ((v.t * (12 + (k % 3) * 6) + k * 41) % 170);
      c.fillStyle = k % 3 ? `rgba(255,196,214,${0.9 - T.n * 0.5})` : `rgba(140,196,110,${0.85 - T.n * 0.5})`;
      ell(c, x, y, 2.4, 1.3, v.t * 2.2 + k); c.fill();
    }
  }
}

/* ============================================================= */
/*  沢（山道）・河原（夏まつり）                                   */
/* ============================================================= */
function fern(c: Ctx, T: Tones, x: number, y: number, s: number, sw: number): void {
  c.strokeStyle = T.tone("#3F7A3E"); c.lineWidth = 1.1;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.42, len = (18 - Math.abs(k - 2) * 3) * s;
    const ex = x + Math.cos(a) * len + sw, ey = y + Math.sin(a) * len;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.6 - 2, ex, ey); c.stroke();
    c.fillStyle = T.tone(k % 2 ? "#4C8F48" : "#5FA555");
    for (let q = 1; q < 6; q++) { const t = q / 6; ell(c, x + (ex - x) * t, y + (ey - y) * t, 2.6 * (1 - t * 0.6) * s, 1.1 * s, a + 1.2); c.fill(); }
  }
}
function stream(v: RouteView, T: Tones): void {
  const { c, e, g, left, right } = v, W = right - left;
  // 奥の森（針葉樹のシルエット）と朝もや
  each(v, 17, 0.4, 1, 0.5, (x, i) => {
    const h = 38 + h01(i, 2) * 36, y = g - 54;
    c.fillStyle = T.far("#2E5A48", 0.04 + h01(i, 3) * 0.12);
    c.beginPath(); c.moveTo(x - 11, y); c.lineTo(x, y - h); c.lineTo(x + 11, y); c.closePath(); c.fill();
  });
  const mg = c.createLinearGradient(0, g - 96, 0, g - 50);
  mg.addColorStop(0, "rgba(255,255,255,0)"); mg.addColorStop(0.6, `rgba(255,255,255,${0.32 * (1 - T.n * 0.6)})`); mg.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = mg; c.fillRect(left, g - 96, W, 46);
  // 向こう岸の苔むした岩
  each(v, 28, 0.8, 4, 0.5, (x, i) => {
    const rx = 12 + h01(i, 5) * 9;
    c.fillStyle = T.tone("#6E7568", 0.08); ell(c, x, g - 52, rx, 8); c.fill();
    c.fillStyle = T.tone("#5E8F4A", 0.06); ell(c, x - 2, g - 57, rx * 0.8, 3.5); c.fill();
  });
  // 小さな滝
  each(v, 360, 0.8, 9, 0.2, (x, i) => {
    if (h01(i, 10) < 0.45) return;
    c.fillStyle = T.tone("#5B6158", 0.06); rr(c, x - 22, g - 84, 44, 34, 8); c.fill();
    c.fillStyle = `rgba(235,248,255,${0.85 - T.n * 0.4})`; c.fillRect(x - 9, g - 82, 18, 32);
    c.fillStyle = "rgba(160,200,215,0.6)";
    for (let k = 0; k < 4; k++) { const y = g - 82 + ((v.calm ? 0 : v.t * 60) + k * 9) % 32; c.fillRect(x - 7 + k * 4, y, 1.6, 6); }
    c.fillStyle = `rgba(255,255,255,${0.8 - T.n * 0.4})`; for (let k = 0; k < 5; k++) { ell(c, x - 12 + k * 6, g - 50 + sway(v, k, 1, 5), 5, 2.6); c.fill(); }
  });
  // 水面と流れ
  const wg = c.createLinearGradient(0, g - 50, 0, g - 6);
  wg.addColorStop(0, rgb(mix(mix(hex("#6CB8B4"), e.top, 0.25), e.near, T.n * 0.5))); wg.addColorStop(1, rgb(mix(hex("#2C6A7C"), e.near, 0.05 + T.n * 0.5)));
  c.fillStyle = wg; c.fillRect(left, g - 50, W, 44);
  const fl = drift(v, 44, 41);
  c.fillStyle = `rgba(255,255,255,${0.4 - T.n * 0.2})`;
  each(v, 41, 1, 16, 0, (x, i) => { rr(c, x - fl, g - 46 + h01(i, 17) * 36, 9 + h01(i, 18) * 14, 1.5, 1); c.fill(); });
  // 流れの中の岩と白波
  each(v, 118, 1, 6, 0.5, (x, i) => {
    const y = g - 26 - h01(i, 7) * 14, rx = 9 + h01(i, 8) * 8;
    c.fillStyle = "rgba(255,255,255,0.55)"; for (let k = 0; k < 3; k++) { ell(c, x + rx + 2 + k * 3, y + 2 + sway(v, i + k, 1.2, 6), 3.5 - k * 0.8, 1.6); c.fill(); }
    c.fillStyle = T.tone("#62675F"); ell(c, x, y, rx, rx * 0.55); c.fill();
    c.fillStyle = T.tone("#8A9086"); ell(c, x - rx * 0.25, y - rx * 0.2, rx * 0.55, rx * 0.25); c.fill();
    c.fillStyle = T.tone("#5E9A4A"); ell(c, x - rx * 0.1, y - rx * 0.45, rx * 0.5, rx * 0.14); c.fill();
  });
  // 手前の岩とシダ
  each(v, 66, 1, 12, 0.6, (x, i) => {
    if (h01(i, 13) < 0.3) return;
    const rx = 10 + h01(i, 14) * 9;
    c.fillStyle = T.tone("#6A6F66"); ell(c, x, g - 8, rx, rx * 0.6); c.fill();
    c.fillStyle = T.tone("#8F958A"); ell(c, x - rx * 0.3, g - 11, rx * 0.5, rx * 0.22); c.fill();
    c.fillStyle = T.tone("#5B9148"); ell(c, x, g - 8 - rx * 0.5, rx * 0.7, 2.2); c.fill();
    fern(c, T, x + rx + 6, g - 6, 0.9 + h01(i, 15) * 0.4, sway(v, i, 1.6));
  });
  // 土の山道・木の根
  const pg = c.createLinearGradient(0, g - 6, 0, g + 19);
  pg.addColorStop(0, T.tone("#A08462")); pg.addColorStop(1, T.tone("#7F6647"));
  c.fillStyle = pg; c.fillRect(left, g - 6, W, 25);
  each(v, 15, 1, 19, 0.9, (x, i) => { c.fillStyle = T.tone(h01(i, 20) < 0.5 ? "#8E8A80" : "#B3AEA2"); ell(c, x, g + 1 + h01(i, 21) * 15, 2 + h01(i, 22) * 2.4, 1.3 + h01(i, 23)); c.fill(); });
  c.strokeStyle = T.tone("#5E4630"); c.lineWidth = 2;
  each(v, 150, 1, 24, 0.4, (x) => { c.beginPath(); c.moveTo(x, g - 5); c.quadraticCurveTo(x + 18, g + 6, x + 40, g + 3); c.stroke(); });
  // ホタル（夜明け前）
  if (T.lit > 0.05 && !v.calm) {
    for (let k = 0; k < 10; k++) {
      const x = left + ((k * 71 + Math.sin(v.t * 0.7 + k) * 20) % Math.max(1, W)), y = g - 40 - ((k * 23) % 40) + Math.sin(v.t * 1.3 + k * 2) * 5;
      glow(c, x, y, 7, "210,255,140", (0.4 + 0.4 * Math.sin(v.t * 3 + k)) * T.lit);
    }
  }
}
function riverbank(v: RouteView, T: Tones): void {
  const { c, e, g, left, right } = v, W = right - left;
  // 向こう岸の町並みと灯り
  each(v, 13, 0.3, 1, 0.3, (x, i) => {
    const h = 8 + h01(i, 2) * 16;
    c.fillStyle = T.far("#48476A", 0.05); c.fillRect(x, g - 78 - h, 12, h);
    if (T.lit > 0.05 && h01(i, 3) < 0.6) { c.fillStyle = `rgba(255,214,140,${0.8 * T.lit})`; c.fillRect(x + 3, g - 76 - h * 0.6, 2, 2); c.fillRect(x + 7, g - 76 - h * 0.35, 2, 2); }
  });
  // 土手
  c.fillStyle = T.far("#5E8A52", -0.05); c.beginPath(); c.moveTo(left, g - 60); c.lineTo(left, g - 76); c.lineTo(right, g - 76); c.lineTo(right, g - 60); c.fill();
  c.fillStyle = T.far("#79A866", -0.05); c.fillRect(left, g - 78, W, 3);
  // 川面（空の色を映す）
  const wg = c.createLinearGradient(0, g - 60, 0, g - 12);
  wg.addColorStop(0, rgb(mix(mix(e.bot, hex("#4A7FA8"), 0.45), e.near, T.n * 0.35))); wg.addColorStop(1, rgb(mix(mix(e.top, hex("#1F4E78"), 0.6), e.near, T.n * 0.4)));
  c.fillStyle = wg; c.fillRect(left, g - 60, W, 48);
  // 鉄橋（ときどき）と、その灯りの映りこみ
  each(v, 560, 0.5, 3, 0.2, (x, i) => {
    if (h01(i, 4) < 0.4) return;
    const y = g - 88, len = 240;
    c.fillStyle = T.far("#3A3C52", -0.1); c.fillRect(x, y, len, 5);
    c.strokeStyle = T.far("#3A3C52", -0.1); c.lineWidth = 1.4;
    for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x + 20 + k * 40, y + 5, 20, Math.PI, 0); c.stroke(); c.fillRect(x + 38 + k * 40, y + 5, 4, 26); }
    for (let k = 0; k < 12; k++) {
      c.beginPath(); c.moveTo(x + k * 20, y); c.lineTo(x + k * 20 + 10, y - 12); c.lineTo(x + k * 20 + 20, y); c.stroke();
      if (T.lit > 0.05) { glow(c, x + k * 20 + 10, y - 2, 6, "255,220,150", 0.8 * T.lit); c.fillStyle = `rgba(255,220,150,${0.3 * T.lit})`; c.fillRect(x + k * 20 + 9, g - 56, 2, 12 + sway(v, k, 3, 2)); }
    }
  });
  // さざ波
  const fl = drift(v, 14, 37);
  c.fillStyle = `rgba(255,255,255,${0.32 - T.n * 0.14})`;
  each(v, 37, 1, 16, 0, (x, i) => { rr(c, x - fl, g - 56 + h01(i, 17) * 40, 10 + h01(i, 18) * 16, 1.3, 1); c.fill(); });
  // 灯籠流し（夜）
  if (T.lit > 0.05) {
    const lf = drift(v, 9, 64);
    each(v, 64, 1, 8, 0.8, (x, i) => {
      const lx = x - lf, ly = g - 30 - h01(i, 9) * 22 + sway(v, i, 0.8, 1.8);
      glow(c, lx, ly - 3, 16, "255,190,110", 0.55 * T.lit);
      c.fillStyle = `rgba(255,200,120,${0.35 * T.lit})`; c.fillRect(lx - 1, ly + 2, 2, 10);
      c.fillStyle = "#3A2A20"; c.fillRect(lx - 4, ly, 8, 1.5);
      c.fillStyle = `rgba(255,236,190,${0.9 * T.lit})`; c.fillRect(lx - 3, ly - 6, 6, 6);
    });
  }
  // 手前のヨシとガマ
  each(v, 76, 1, 19, 0.6, (x, i) => {
    const sw = sway(v, i, 2.2, 1.2);
    c.strokeStyle = T.tone("#5E8F3E"); c.lineWidth = 1.6;
    for (let k = 0; k < 7; k++) { const bx = x + k * 4; c.beginPath(); c.moveTo(bx, g - 11); c.quadraticCurveTo(bx + 2 + sw * 0.4, g - 40, bx + 5 - k * 0.5 + sw, g - 64 + h01(i + k, 20) * 18); c.stroke(); }
    c.fillStyle = T.tone("#7A5A3E"); for (let k = 0; k < 3; k++) { ell(c, x + 5 + k * 9 + sw, g - 60 + h01(i + k, 21) * 14, 2, 6.5); c.fill(); }
  });
  // 石ころの河原（道）
  c.fillStyle = T.tone("#B8AE9C"); c.fillRect(left, g - 12, W, 31);
  each(v, 9, 1, 23, 0.9, (x, i) => {
    const y = g - 9 + h01(i, 24) * 26, rx = 3 + h01(i, 25) * 4;
    c.fillStyle = T.tone(pick(["#9C9588", "#C9C1B2", "#8A8479", "#D8D0C0"], i, 26)); ell(c, x, y, rx, rx * 0.6); c.fill();
    c.fillStyle = "rgba(255,255,255,0.18)"; ell(c, x - rx * 0.3, y - rx * 0.2, rx * 0.4, rx * 0.18); c.fill();
  });
}

/* ============================================================= */
/*  尾根（山道）                                                  */
/* ============================================================= */
function ridge(v: RouteView, T: Tones): void {
  const { c, e, g, left, right } = v, W = right - left;
  // 遠くの山並みと雪
  c.fillStyle = T.far("#6C7FA0", -0.05);
  c.beginPath(); c.moveTo(left - 20, g - 70);
  const peaks: [number, number][] = [];
  each(v, 58, 0.15, 1, 0.5, (x, i) => { const y = g - 96 - h01(i, 2) * 46; peaks.push([x, y]); c.lineTo(x, y); c.lineTo(x + 29, g - 84 - h01(i, 3) * 16); });
  c.lineTo(right + 20, g - 70); c.closePath(); c.fill();
  c.fillStyle = T.far("#F2F5FA", -0.2);
  for (const [x, y] of peaks) { if (y > g - 118) continue; c.beginPath(); c.moveTo(x - 9, y + 11); c.lineTo(x, y); c.lineTo(x + 10, y + 12); c.lineTo(x + 3, y + 8); c.lineTo(x - 2, y + 12); c.closePath(); c.fill(); }
  // 雲海
  const cloud = rgb(mix(mix([255, 255, 255], e.bot, 0.3), e.near, T.n * 0.55), 0.92);
  c.fillStyle = cloud;
  const cf = drift(v, 5, 34);
  each(v, 34, 0.25, 5, 0.5, (x, i) => { ell(c, x - cf, g - 72 - h01(i, 6) * 6, 24 + h01(i, 7) * 14, 9 + h01(i, 8) * 5); c.fill(); });
  c.fillRect(left, g - 72, W, 18);
  // 奥の岩稜
  c.fillStyle = T.tone("#7A808C", 0.08);
  c.beginPath(); c.moveTo(left - 20, g - 20);
  each(v, 24, 0.7, 9, 0.4, (x, i) => { c.lineTo(x, g - 50 - h01(i, 10) * 30); });
  c.lineTo(right + 20, g - 20); c.closePath(); c.fill();
  // 岩場の地面（もとの柵が透けないよう、道の手前までふさぐ）
  const bg = c.createLinearGradient(0, g - 30, 0, g - 6);
  bg.addColorStop(0, T.tone("#80868F", 0.08)); bg.addColorStop(1, T.tone("#6A7078"));
  c.fillStyle = bg; c.fillRect(left, g - 30, W, 24);
  each(v, 13, 1, 40, 0.9, (x, i) => { c.fillStyle = T.tone(h01(i, 41) < 0.5 ? "#8E949C" : "#5C6168"); ell(c, x, g - 26 + h01(i, 42) * 18, 3 + h01(i, 43) * 4, 1.6 + h01(i, 44) * 1.4); c.fill(); });
  // ハイマツ
  each(v, 40, 0.85, 11, 0.6, (x, i) => {
    if (h01(i, 12) < 0.35) return;
    c.fillStyle = T.tone("#2F5A3A"); ell(c, x, g - 34, 16 + h01(i, 13) * 10, 7); c.fill();
    c.fillStyle = T.tone("#447A4C"); ell(c, x - 4, g - 37, 9, 3.4); c.fill();
  });
  // 手前の岩（光の当たる面と影の面）
  each(v, 90, 1, 14, 0.5, (x, i) => {
    const w = 34 + h01(i, 15) * 26, h = 22 + h01(i, 16) * 26, top = g - 8 - h;
    shadow(c, x + w * 0.55, g - 6, w * 0.6);
    c.fillStyle = T.tone("#6E7480"); c.beginPath(); c.moveTo(x, g - 7); c.lineTo(x + w * 0.2, top + h * 0.3); c.lineTo(x + w * 0.45, top); c.lineTo(x + w * 0.8, top + h * 0.25); c.lineTo(x + w, g - 7); c.closePath(); c.fill();
    c.fillStyle = T.tone("#9AA0AA"); c.beginPath(); c.moveTo(x + w * 0.2, top + h * 0.3); c.lineTo(x + w * 0.45, top); c.lineTo(x + w * 0.5, g - 7); c.lineTo(x + 4, g - 7); c.closePath(); c.fill();
    c.strokeStyle = T.tone("#545A64"); c.lineWidth = 1; c.beginPath(); c.moveTo(x + w * 0.62, top + h * 0.2); c.lineTo(x + w * 0.58, top + h * 0.6); c.lineTo(x + w * 0.66, g - 9); c.stroke();
    c.fillStyle = T.tone("#B8C07A", 0.1); ell(c, x + w * 0.3, top + h * 0.45, 3, 2); c.fill();
    if (h01(i, 17) < 0.4) {
      // 岩に塗られた道しるべの矢印
      const ax = x + w * 0.24, ay = top + h * 0.6;
      c.fillStyle = T.tone("#E8B830", 0.05);
      c.beginPath(); c.moveTo(ax, ay - 1.4); c.lineTo(ax + 6, ay - 1.4); c.lineTo(ax + 6, ay - 3.6); c.lineTo(ax + 10, ay); c.lineTo(ax + 6, ay + 3.6); c.lineTo(ax + 6, ay + 1.4); c.lineTo(ax, ay + 1.4); c.closePath(); c.fill();
    }
    if (h01(i, 18) < 0.25) {
      for (let k = 0; k < 4; k++) { c.fillStyle = T.tone(k % 2 ? "#8A909A" : "#A7ADB6"); ell(c, x + w + 12, top - 2 - k * 5.5, 7 - k * 1.3, 3); c.fill(); }
    }
  });
  // 道の杭とロープ
  const posts: number[] = [];
  each(v, 84, 1, 0, 0, (x) => { posts.push(x); c.fillStyle = T.tone("#7A5A3C"); c.fillRect(x - 1.8, g - 30, 3.6, 24); c.fillStyle = T.tone("#9A7650"); c.fillRect(x - 1.8, g - 30, 3.6, 3); });
  c.strokeStyle = T.tone("#D8C9A8"); c.lineWidth = 1.1;
  for (let k = 0; k < posts.length - 1; k++) { const a = posts[k]!, b = posts[k + 1]!; c.beginPath(); c.moveTo(a, g - 26); c.quadraticCurveTo((a + b) / 2, g - 16 + sway(v, k, 1.5, 2), b, g - 26); c.stroke(); }
  // 風になびく草
  each(v, 19, 1, 21, 0.8, (x, i) => {
    const sw = sway(v, i, 2.4, 2.2) + 2;
    c.strokeStyle = T.tone(h01(i, 22) < 0.5 ? "#8FA85A" : "#A8B870"); c.lineWidth = 1;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + k * 2, g - 6); c.quadraticCurveTo(x + k * 2 + sw * 0.5, g - 12, x + k * 2 + sw * 1.4, g - 17 - k * 2); c.stroke(); }
  });
  // 風の筋
  if (!v.calm) {
    c.strokeStyle = `rgba(255,255,255,${0.35 - T.n * 0.2})`; c.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const span = W + 120, x = left - 60 + ((((k * 131 - v.t * 150) % span) + span) % span), y = g - 120 + k * 16;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 20, y - 3, x + 44, y); c.stroke();
    }
  }
  // 岩の道
  c.fillStyle = T.tone("#6B6F76"); c.fillRect(left, g - 6, W, 25);
  each(v, 21, 1, 25, 0.8, (x, i) => {
    const w = 12 + h01(i, 26) * 10;
    c.fillStyle = T.tone(h01(i, 27) < 0.5 ? "#80858D" : "#5E6268"); rr(c, x, g - 4 + h01(i, 28) * 12, w, 6 + h01(i, 29) * 4, 3); c.fill();
    c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(x + 2, g - 3 + h01(i, 28) * 12, w - 4, 1.2);
  });
}

/* ============================================================= */
/*  かまくら広場（雪国）                                          */
/* ============================================================= */
function kamakura(v: RouteView, T: Tones): void {
  const { c, g, left, right } = v, W = right - left;
  // 遠くの雪山と家の灯り
  each(v, 80, 0.3, 1, 0.4, (x, i) => {
    c.fillStyle = T.far("#DCE6F4", -0.15); ell(c, x, g - 64, 60 + h01(i, 2) * 30, 22 + h01(i, 3) * 14); c.fill();
    if (h01(i, 4) < 0.5) {
      c.fillStyle = T.far("#6A5A58"); c.fillRect(x - 6, g - 80, 12, 9);
      c.fillStyle = T.far("#FFFFFF", -0.2); c.beginPath(); c.moveTo(x - 8, g - 80); c.lineTo(x, g - 86); c.lineTo(x + 8, g - 80); c.fill();
      if (T.lit > 0.05) { c.fillStyle = `rgba(255,210,140,${0.9 * T.lit})`; c.fillRect(x - 3, g - 77, 3, 3); }
    }
  });
  // 奥の雪の森（うしろの町並みが見えすぎないように）
  each(v, 15, 0.45, 30, 0.5, (x, i) => {
    const h = 30 + h01(i, 31) * 34, y = g - 60;
    c.fillStyle = T.far("#4E6E6A", 0.05 + h01(i, 32) * 0.1);
    c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x, y - h); c.lineTo(x + 10, y); c.closePath(); c.fill();
    c.fillStyle = T.far("#FFFFFF", -0.2);
    c.beginPath(); c.moveTo(x - 4, y - h * 0.62); c.lineTo(x, y - h); c.lineTo(x + 4, y - h * 0.62); c.closePath(); c.fill();
  });
  // 雪原（青い影のうねり・きらめき）
  const sg = c.createLinearGradient(0, g - 62, 0, g - 6);
  sg.addColorStop(0, T.tone("#F4F8FF")); sg.addColorStop(1, T.tone("#D5E1F2"));
  c.fillStyle = sg; c.fillRect(left, g - 62, W, 56);
  c.fillStyle = T.tone("#C4D3EA");
  each(v, 90, 0.95, 3, 0.3, (x, i) => { ell(c, x, g - 36 + h01(i, 4) * 12, 40, 5); c.fill(); });
  if (!v.calm) {
    each(v, 23, 1, 5, 0.9, (x, i) => {
      const a = Math.max(0, Math.sin(v.t * 2.2 + i * 2.3));
      if (a < 0.6) return;
      c.fillStyle = `rgba(255,255,255,${(a - 0.6) * 2})`; c.fillRect(x, g - 58 + h01(i, 6) * 48, 1.4, 1.4);
    });
  }
  // 雪の木
  each(v, 104, 0.95, 7, 0.45, (x, i) => { snowPine(c, T, x, g - 40 - h01(i, 8) * 8, 70 + h01(i, 9) * 40, sway(v, i, 1.2)); });
  // かまくら（中にろうそくの灯り）
  each(v, 176, 1, 9, 0.3, (x, i) => {
    if (h01(i, 10) < 0.3) return;
    const cx = x + 44, r = 30 + h01(i, 11) * 7, by = g - 8;
    shadow(c, cx + 6, by + 1, r + 6, 0.16);
    const dg = c.createLinearGradient(cx - r, 0, cx + r, 0);
    dg.addColorStop(0, T.tone("#FFFFFF")); dg.addColorStop(1, T.tone("#C9D7EC"));
    c.fillStyle = dg; c.beginPath(); c.ellipse(cx, by, r, r * 0.95, 0, Math.PI, 0); c.fill();
    c.strokeStyle = "rgba(160,180,210,0.35)"; c.lineWidth = 0.8;
    for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(cx, by, r, r * 0.95 * (k / 4), 0, Math.PI, 0); c.stroke(); }
    const lit = 0.35 + T.lit * 0.65;
    c.fillStyle = `rgba(40,30,50,0.85)`; c.beginPath(); c.ellipse(cx, by, 9.5, 14, 0, Math.PI, 0); c.fill();
    c.fillStyle = `rgba(255,170,80,${0.5 * lit})`; c.beginPath(); c.ellipse(cx, by, 8, 12, 0, Math.PI, 0); c.fill();
    glow(c, cx, by - 5, 22, "255,180,90", 0.45 * lit);
    c.fillStyle = "#FFF6D0"; ell(c, cx + 2, by - 4 + sway(v, i, 0.5, 9), 1.2, 2.2); c.fill();
    c.fillStyle = T.tone("#FFFFFF"); ell(c, cx, by - r * 0.93, r * 0.45, 3); c.fill();
  });
  // 雪灯籠
  each(v, 66, 1, 12, 0.3, (x, i) => {
    if (h01(i, 13) < 0.3) return;
    const fl = 0.8 + 0.2 * Math.sin(v.t * 11 + i);
    glow(c, x, g - 16, 18, "255,190,100", (0.3 + 0.5 * T.lit) * fl);
    c.fillStyle = T.tone("#F6F9FF"); rr(c, x - 6, g - 24, 12, 18, 5); c.fill();
    c.fillStyle = T.tone("#C9D6EA"); c.fillRect(x + 2, g - 22, 3, 15);
    c.fillStyle = "#3A3048"; rr(c, x - 3, g - 18, 6, 6, 2); c.fill();
    c.fillStyle = `rgba(255,200,110,${0.7 + 0.3 * fl})`; ell(c, x, g - 15, 1.6, 2.4 * fl); c.fill();
  });
  // 雪道（足あととソリの跡）
  const pg = c.createLinearGradient(0, g - 6, 0, g + 19);
  pg.addColorStop(0, T.tone("#EEF3FC")); pg.addColorStop(1, T.tone("#CCD9EE"));
  c.fillStyle = pg; c.fillRect(left, g - 6, W, 25);
  c.fillStyle = T.tone("#B8C8E2"); c.fillRect(left, g + 9, W, 1.2); c.fillRect(left, g + 14, W, 1.2);
  each(v, 17, 1, 14, 0.2, (x, i) => { c.fillStyle = T.tone("#C3D1E8"); ell(c, x, g - 1 + (i % 2) * 4, 2.6, 1.4, 0.2); c.fill(); });
  c.fillStyle = T.tone("#FFFFFF"); c.fillRect(left, g - 8, W, 3);
}

/* ============================================================= */
/*  商店街（まち）                                                */
/* ============================================================= */
type ShopKind = "bread" | "flower" | "veg" | "cafe" | "books" | "fish" | "case";
const ARCADE_SHOPS: readonly { name: string; col: string; kind: ShopKind }[] = [
  { name: "パン", col: "#C8793A", kind: "bread" },
  { name: "花", col: "#3E9A6A", kind: "flower" },
  { name: "八百屋", col: "#2F8A3E", kind: "veg" },
  { name: "喫茶", col: "#6B4A36", kind: "cafe" },
  { name: "本", col: "#2F5E9A", kind: "books" },
  { name: "精肉", col: "#B23A3A", kind: "case" },
  { name: "和菓子", col: "#7A3F6E", kind: "case" },
  { name: "鮮魚", col: "#2E6FA8", kind: "fish" },
];
function shopGoods(c: Ctx, T: Tones, kind: ShopKind, x: number, w: number, g: number, i: number): void {
  const fruit = ["#E0403A", "#F29A2E", "#8BC34A", "#FFD23F", "#9C4DCC"];
  if (kind === "veg") {
    c.fillStyle = T.tone("#8A6038"); c.fillRect(x + 10, g - 18, 3, 12); c.fillRect(x + w - 13, g - 18, 3, 12);
    for (let k = 0; k < 2; k++) {
      const bx = x + 8 + k * (w / 2 - 6), bw = w / 2 - 10;
      c.fillStyle = T.tone("#B98A52"); c.beginPath(); c.moveTo(bx, g - 20); c.lineTo(bx + bw, g - 20); c.lineTo(bx + bw - 3, g - 30); c.lineTo(bx + 3, g - 32); c.closePath(); c.fill();
      c.fillStyle = T.tone(pick(fruit, i * 3 + k, 50));
      for (let q = 0; q < 5; q++) { ell(c, bx + 5 + q * (bw - 10) / 4, g - 31 - (q % 2) * 2, 3.4, 3.2); c.fill(); }
      c.fillStyle = "rgba(255,255,255,0.35)"; for (let q = 0; q < 5; q++) { ell(c, bx + 4 + q * (bw - 10) / 4, g - 32.5 - (q % 2) * 2, 1, 0.8); c.fill(); }
    }
  } else if (kind === "flower") {
    for (let k = 0; k < 4; k++) {
      const bx = x + 12 + k * 18;
      c.fillStyle = T.tone("#3F8A45"); for (let q = 0; q < 5; q++) { c.fillRect(bx - 4 + q * 2, g - 30, 1, 12); }
      c.fillStyle = T.tone(pick(["#F26D8F", "#FFD166", "#FFFFFF", "#B48CF2", "#FF6A3D"], i + k, 51));
      for (let q = 0; q < 6; q++) { ell(c, bx - 5 + (q % 3) * 5, g - 32 - Math.floor(q / 3) * 4, 2.6, 2.4); c.fill(); }
      c.fillStyle = T.tone("#9AA3AD"); c.beginPath(); c.moveTo(bx - 6, g - 20); c.lineTo(bx + 6, g - 20); c.lineTo(bx + 4.5, g - 7); c.lineTo(bx - 4.5, g - 7); c.closePath(); c.fill();
    }
  } else if (kind === "cafe") {
    c.fillStyle = T.tone("#2F4A3A"); c.beginPath(); c.moveTo(x + 14, g - 7); c.lineTo(x + 20, g - 34); c.lineTo(x + 32, g - 34); c.lineTo(x + 38, g - 7); c.closePath(); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 0.8;
    for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + 21, g - 29 + k * 5); c.lineTo(x + 31, g - 29 + k * 5); c.stroke(); }
    c.fillStyle = T.tone("#B0602E"); rr(c, x + w - 26, g - 16, 12, 10, 2); c.fill();
    c.fillStyle = T.tone("#3F8A45"); ell(c, x + w - 20, g - 22, 9, 8); c.fill(); c.fillStyle = T.tone("#5EAA55"); ell(c, x + w - 23, g - 25, 4, 3); c.fill();
  } else if (kind === "books") {
    c.fillStyle = T.tone("#7A5230"); c.fillRect(x + 8, g - 26, w - 16, 3); c.fillRect(x + 10, g - 23, 3, 17); c.fillRect(x + w - 13, g - 23, 3, 17);
    for (let k = 0; k < 14; k++) { c.fillStyle = T.tone(pick(["#C23B3B", "#2F5E9A", "#E8B84A", "#3E8A5A", "#6A4A8A", "#EDE6D6"], i * 7 + k, 52)); c.fillRect(x + 10 + k * ((w - 20) / 14), g - 38 + h01(k, 53) * 3, (w - 20) / 14 - 0.6, 12 - h01(k, 53) * 3); }
  } else if (kind === "fish") {
    c.fillStyle = T.tone("#D8E6EE"); rr(c, x + 8, g - 24, w - 16, 16, 3); c.fill();
    c.fillStyle = T.tone("#F4FAFF"); c.fillRect(x + 10, g - 26, w - 20, 4);
    for (let k = 0; k < 5; k++) {
      const fx = x + 16 + k * ((w - 30) / 4);
      c.fillStyle = T.tone(k % 2 ? "#9FB2C2" : "#E07A5A"); ell(c, fx, g - 27, 6, 2.4, -0.2); c.fill();
      c.beginPath(); c.moveTo(fx + 5, g - 28); c.lineTo(fx + 9, g - 31); c.lineTo(fx + 9, g - 25); c.fill();
    }
  } else {
    c.fillStyle = T.tone("#E8EEF2"); rr(c, x + 8, g - 30, w - 16, 24, 3); c.fill();
    c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(x + 10, g - 28, w - 20, 2);
    c.fillStyle = T.tone(kind === "bread" ? "#C98A4A" : "#E7A0B4");
    for (let k = 0; k < 6; k++) { ell(c, x + 16 + k * ((w - 30) / 5), g - 18 + (k % 2) * 3, kind === "bread" ? 5.5 : 3.6, kind === "bread" ? 3.4 : 3.2); c.fill(); }
    if (kind === "bread") { c.strokeStyle = "rgba(90,50,20,0.5)"; c.lineWidth = 0.7; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(x + 14 + k * ((w - 30) / 5), g - 19 + (k % 2) * 3); c.lineTo(x + 18 + k * ((w - 30) / 5), g - 17 + (k % 2) * 3); c.stroke(); } }
  }
}
function arcade(v: RouteView, T: Tones): void {
  const { c, g, left, right } = v, W = right - left;
  const ry = Math.max(16, g - 160), top = g - 114, sw = 92;
  const walls = ["#EFE3CF", "#E3D3BF", "#D6E0E6", "#EAD6CF", "#DCE3CE", "#E9E1D3"];
  // 2階（窓・エアコン・縦看板）
  each(v, sw, 1, 0, 0, (x, i) => {
    c.fillStyle = T.tone(pick(walls, i, 1)); c.fillRect(x, ry + 20, sw, top - ry - 20);
    c.fillStyle = "rgba(0,0,0,0.08)"; c.fillRect(x + sw - 2, ry + 20, 2, top - ry - 20);
    for (let k = 0; k < 2; k++) {
      const wx = x + 12 + k * 42, wy = ry + 30, wh = Math.max(8, top - ry - 42);
      c.fillStyle = T.tone("#7A7068"); c.fillRect(wx - 1.5, wy - 1.5, 27, wh + 3);
      c.fillStyle = T.lit > 0.05 && h01(i * 2 + k, 2) < 0.6 ? `rgba(255,214,150,${0.5 + 0.5 * T.lit})` : T.tone("#A8C4D6");
      c.fillRect(wx, wy, 24, wh);
      c.fillStyle = T.tone(pick(["#F2E6D0", "#E7C9C9", "#D8E4D0"], i + k, 3)); c.fillRect(wx, wy, 6, wh); c.fillRect(wx + 18, wy, 6, wh);
      c.fillStyle = "rgba(255,255,255,0.25)"; c.beginPath(); c.moveTo(wx + 8, wy); c.lineTo(wx + 12, wy); c.lineTo(wx + 8, wy + wh * 0.6); c.fill();
    }
    if (h01(i, 4) < 0.4) { c.fillStyle = T.tone("#E8ECEE"); rr(c, x + 66, top - 16, 18, 11, 2); c.fill(); c.strokeStyle = T.tone("#B8BEC2"); c.lineWidth = 0.6; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + 68, top - 14 + k * 2.4); c.lineTo(x + 82, top - 14 + k * 2.4); c.stroke(); } }
  });
  // 2階から突き出た縦看板（隣の2階に隠れないよう、2階を描き終えてから）
  each(v, sw, 1, 0, 0, (x, i) => {
    if (h01(i, 5) < 0.45) return;
    const shop = cycle(ARCADE_SHOPS, i), vx = x + sw - 8, vy = ry + 24;
    if (T.lit > 0.05) glow(c, vx + 6, vy + 22, 24, "255,240,210", 0.35 * T.lit);
    c.fillStyle = T.tone("#5E6C7A"); c.fillRect(vx - 3, vy + 6, 4, 2); c.fillRect(vx - 3, vy + 36, 4, 2);
    c.fillStyle = T.lit > 0.05 ? "#FFFDF6" : T.tone("#FFFFFF"); rr(c, vx, vy, 14, 46, 2); c.fill();
    c.strokeStyle = shop.col; c.lineWidth = 1.6; rr(c, vx, vy, 14, 46, 2); c.stroke();
    c.fillStyle = shop.col; vText(c, shop.name.length > 3 ? shop.name.slice(0, 3) : shop.name, vx + 7, vy + 9, 8);
  });
  // お店（シャッター箱・看板・日よけ・店内・店先の品）
  each(v, sw, 1, 0, 0, (x, i) => {
    const shop = cycle(ARCADE_SHOPS, i);
    c.fillStyle = T.tone("#8E949A"); c.fillRect(x, top, sw, 7);
    c.fillStyle = "rgba(0,0,0,0.12)"; for (let k = 0; k < 3; k++) c.fillRect(x, top + 2 + k * 2, sw, 0.6);
    c.fillStyle = T.tone(shop.col); c.fillRect(x + 1, top + 7, sw - 2, 17);
    c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(x + 1, top + 7, sw - 2, 3);
    c.fillStyle = "#FFFFFF"; c.font = font(10); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(shop.name, x + sw / 2, top + 16.5);
    // 店内
    const iy = top + 38, ih = g - 6 - iy;
    const inner = c.createLinearGradient(0, iy, 0, g - 6);
    inner.addColorStop(0, T.lit > 0.05 ? `rgba(255,232,180,${0.75 + 0.25 * T.lit})` : T.tone("#F6EBD6")); inner.addColorStop(1, T.lit > 0.05 ? `rgba(230,190,130,${0.8 + 0.2 * T.lit})` : T.tone("#E2D2B6"));
    c.fillStyle = inner; c.fillRect(x + 3, iy, sw - 6, ih);
    for (let k = 0; k < 3; k++) {
      const sy = iy + 12 + k * 15;
      if (sy > g - 30) break;
      c.fillStyle = T.tone("#9A7A58"); c.fillRect(x + 6, sy, sw - 12, 1.6);
      for (let q = 0; q < 9; q++) { c.fillStyle = T.tone(pick(["#E0403A", "#F2B84A", "#5AA0D8", "#7ABF6A", "#EDE6D6", "#C58AD8"], i * 11 + k * 9 + q, 8)); c.fillRect(x + 8 + q * ((sw - 16) / 9), sy - 6 - h01(q + k, 9) * 3, (sw - 16) / 9 - 1.4, 6 + h01(q + k, 9) * 3); }
    }
    c.fillStyle = T.tone("#5A4C40"); c.fillRect(x + 2, iy, 2, ih); c.fillRect(x + sw - 4, iy, 2, ih); c.fillRect(x + sw / 2 - 1, iy, 2, ih * 0.55);
    c.fillStyle = "rgba(255,255,255,0.14)"; c.beginPath(); c.moveTo(x + 10, iy); c.lineTo(x + 22, iy); c.lineTo(x + 8, iy + ih * 0.7); c.lineTo(x + 4, iy + ih * 0.7); c.closePath(); c.fill();
    // 日よけ
    const ay = top + 24, stripes = 7, stw = (sw - 4) / stripes;
    for (let k = 0; k < stripes; k++) {
      c.fillStyle = k % 2 ? T.tone("#FFFFFF") : T.tone(shop.col);
      c.beginPath(); c.moveTo(x + 2 + k * stw, ay); c.lineTo(x + 2 + (k + 1) * stw, ay); c.lineTo(x + 2 + (k + 1) * stw + 1, ay + 14); c.lineTo(x + 2 + k * stw + 1, ay + 14); c.closePath(); c.fill();
      c.beginPath(); c.arc(x + 3 + (k + 0.5) * stw, ay + 14, stw / 2, 0, Math.PI); c.fill();
    }
    c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(x + 2, ay + 10, sw - 4, 4);
    c.fillStyle = "rgba(0,0,0,0.1)"; c.fillRect(x + 3, ay + 20, sw - 6, 3);
    shopGoods(c, T, shop.kind, x, sw, g, i);
    c.fillStyle = T.tone("#6A7078"); c.fillRect(x + sw - 1.5, top, 3, g - 6 - top);
  });
  // アーケードの屋根（透明な屋根・骨組み・吊り下げ飾り・照明）
  const rg = c.createLinearGradient(0, ry - 14, 0, ry + 18);
  rg.addColorStop(0, `rgba(236,246,255,${0.78 - T.n * 0.4})`); rg.addColorStop(1, `rgba(186,206,226,${0.62 - T.n * 0.3})`);
  c.fillStyle = rg; c.fillRect(left, ry - 12, W, 30);
  c.fillStyle = `rgba(255,255,255,${0.55 - T.n * 0.35})`; c.fillRect(left, ry - 12, W, 2);
  const steel = T.tone("#5E6C7A");
  c.strokeStyle = steel; c.lineWidth = 1.3;
  each(v, 23, 1, 0, 0, (x) => { c.beginPath(); c.moveTo(x, ry - 12); c.lineTo(x, ry + 18); c.stroke(); });
  c.fillStyle = steel; c.fillRect(left, ry + 16, W, 5);
  c.fillStyle = T.tone("#3E4A56"); c.fillRect(left, ry + 21, W, 1.5);
  each(v, sw * 2, 1, 0, 0, (x, i) => {
    c.fillStyle = steel; c.fillRect(x - 2.5, ry + 20, 5, g - 6 - ry - 20);
    c.fillStyle = T.tone("#4A5663"); c.fillRect(x - 4, g - 10, 8, 4);
    if (T.lit > 0.05) glow(c, x + sw, ry + 30, 40, "255,236,200", 0.35 * T.lit);
    c.fillStyle = T.lit > 0.05 ? "#FFF4DA" : T.tone("#E8ECEF"); rr(c, x + sw - 8, ry + 22, 16, 4, 2); c.fill();
    const s = sway(v, i, 1.6, 1.1);
    if (h01(i, 10) < 0.5) {
      c.strokeStyle = T.tone("#6A5A4A"); c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 46, ry + 22); c.lineTo(x + 46 + s, ry + 30); c.stroke();
      for (let k = 0; k < 7; k++) { c.fillStyle = T.tone(k % 2 ? "#FF9EC0" : "#FFD1E2"); ell(c, x + 46 + s + Math.cos(k) * 5, ry + 36 + Math.sin(k) * 5, 4, 4); c.fill(); }
      c.fillStyle = T.tone("#FF7FAA"); ell(c, x + 46 + s, ry + 36, 3.5, 3.5); c.fill();
    } else {
      c.fillStyle = T.tone(h01(i, 11) < 0.5 ? "#D63A3A" : "#2F6FD0");
      c.beginPath(); c.moveTo(x + 38, ry + 22); c.lineTo(x + 54, ry + 22); c.lineTo(x + 54 + s, ry + 52); c.lineTo(x + 46 + s, ry + 47); c.lineTo(x + 38 + s, ry + 52); c.closePath(); c.fill();
      c.fillStyle = "#FFFFFF"; vText(c, "商店街", x + 46 + s * 0.6, ry + 28, 5);
    }
  });
  // タイルの道と、店の灯りの映りこみ
  const tw = 18, rows = [[g - 6, 12], [g + 6, 13]] as const;
  rows.forEach(([y, h], r) => {
    each(v, tw, 1, 0, 0, (x, i) => {
      c.fillStyle = T.tone((i + r) % 2 ? "#C98A6A" : "#EAD6BC"); c.fillRect(x, y, tw, h);
      c.fillStyle = "rgba(255,255,255,0.1)"; c.fillRect(x, y, tw, 1);
    });
  });
  if (T.lit > 0.05) each(v, sw, 1, 0, 0, (x) => { const rgd = c.createLinearGradient(0, g - 6, 0, g + 19); rgd.addColorStop(0, `rgba(255,220,150,${0.3 * T.lit})`); rgd.addColorStop(1, "rgba(255,220,150,0)"); c.fillStyle = rgd; c.fillRect(x + 8, g - 6, sw - 16, 25); });
}

/* ============================================================= */
/*  温泉街（雪国）                                                */
/* ============================================================= */
const ONSEN_SIGNS = ["ゆきみ荘", "湯元", "松風", "おみやげ", "足湯", "甘味処", "ゆ"];
function onsen(v: RouteView, T: Tones): void {
  const { c, g, left, right } = v, W = right - left;
  const bw = 118;
  // 奥の山と湯けむり
  each(v, 90, 0.3, 1, 0.4, (x, i) => {
    c.fillStyle = T.far("#DDE6F2", -0.15); ell(c, x, g - 110, 70, 30 + h01(i, 2) * 12); c.fill();
    if (!v.calm && h01(i, 3) < 0.4) for (let k = 0; k < 4; k++) { c.fillStyle = `rgba(255,255,255,${0.25 - k * 0.05})`; ell(c, x + Math.sin(v.t * 0.6 + k) * 6, g - 128 - k * 10 - ((v.t * 6) % 10), 10 + k * 3, 6 + k); c.fill(); }
  });
  each(v, bw, 1, 0, 0, (x, i) => {
    const r1 = g - 58, r2 = g - 110;
    // 2階
    c.fillStyle = T.tone("#E8DDC8"); c.fillRect(x, r2, bw, r1 - r2 - 8);
    c.fillStyle = T.tone("#5A3E2A"); for (let k = 0; k < 5; k++) c.fillRect(x + k * (bw / 4) - 1.5, r2, 3, r1 - r2 - 8);
    for (let k = 0; k < 3; k++) {
      const wx = x + 8 + k * 36, wy = r2 + 8;
      c.fillStyle = T.lit > 0.05 ? `rgba(255,226,170,${0.65 + 0.35 * T.lit})` : T.tone("#F4EEDF"); c.fillRect(wx, wy, 28, 24);
      c.strokeStyle = T.tone("#6A4A32"); c.lineWidth = 0.7;
      for (let q = 1; q < 4; q++) { c.beginPath(); c.moveTo(wx + q * 7, wy); c.lineTo(wx + q * 7, wy + 24); c.stroke(); }
      for (let q = 1; q < 4; q++) { c.beginPath(); c.moveTo(wx, wy + q * 6); c.lineTo(wx + 28, wy + q * 6); c.stroke(); }
      if (T.lit > 0.05) glow(c, wx + 14, wy + 12, 22, "255,210,140", 0.3 * T.lit);
    }
    c.fillStyle = T.tone("#6A4A32"); c.fillRect(x, r1 - 16, bw, 2.4); for (let k = 0; k < 12; k++) c.fillRect(x + 4 + k * 10, r1 - 16, 1.4, 8);
    // 屋根（瓦と雪）
    const roof = (y: number, depth: number) => {
      c.fillStyle = T.tone("#3E4450"); c.beginPath(); c.moveTo(x - 4, y + depth); c.lineTo(x + 4, y); c.lineTo(x + bw - 4, y); c.lineTo(x + bw + 4, y + depth); c.closePath(); c.fill();
      c.strokeStyle = T.tone("#2E3440"); c.lineWidth = 0.8; for (let k = 0; k < 14; k++) { c.beginPath(); c.moveTo(x + k * 9, y + 1); c.lineTo(x + k * 9 - 2, y + depth); c.stroke(); }
      c.fillStyle = T.tone("#FFFFFF"); c.beginPath(); c.moveTo(x - 2, y + 2); c.quadraticCurveTo(x + bw / 2, y - 6, x + bw + 2, y + 2); c.lineTo(x + bw - 2, y + 3); c.quadraticCurveTo(x + bw / 2, y - 1, x + 2, y + 3); c.closePath(); c.fill();
    };
    roof(r2 - 12, 12);
    roof(r1 - 8, 9);
    // 1階（格子・のれん・入口）
    c.fillStyle = T.tone("#6B4A32"); c.fillRect(x, r1 + 1, bw, g - 6 - r1 - 1);
    const lx = x + 6, lw = bw * 0.46, ly = r1 + 8, lh = g - 14 - ly;
    c.fillStyle = T.lit > 0.05 ? `rgba(255,214,150,${0.7 + 0.3 * T.lit})` : T.tone("#E9D7B6"); c.fillRect(lx, ly, lw, lh);
    c.fillStyle = T.tone("#4A3222"); for (let k = 0; k < 13; k++) c.fillRect(lx + k * (lw / 12) - 0.8, ly, 1.6, lh);
    if (T.lit > 0.05) glow(c, lx + lw / 2, ly + lh / 2, 34, "255,200,120", 0.3 * T.lit);
    const dx = x + bw * 0.58, dw = bw * 0.36;
    c.fillStyle = T.lit > 0.05 ? `rgba(255,200,130,${0.75 + 0.25 * T.lit})` : T.tone("#D9C49E"); c.fillRect(dx, ly - 2, dw, lh + 8);
    const norenCol = pick(["#2F3F6E", "#7A2E2E", "#2E5A4A", "#5A2E6E"], i, 4);
    const ns = sway(v, i, 1.2, 1.6);
    for (let k = 0; k < 3; k++) { c.fillStyle = T.tone(norenCol); c.beginPath(); c.moveTo(dx + k * (dw / 3) + 1, ly - 2); c.lineTo(dx + (k + 1) * (dw / 3) - 1, ly - 2); c.lineTo(dx + (k + 1) * (dw / 3) - 1 + ns, ly + 22); c.lineTo(dx + k * (dw / 3) + 1 + ns, ly + 22); c.closePath(); c.fill(); }
    c.fillStyle = "#FFFFFF"; c.font = font(11); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("♨", dx + dw / 2 + ns * 0.5, ly + 9);
    // 看板
    const name = cycle(ONSEN_SIGNS, i);
    c.fillStyle = T.tone("#3A2718"); rr(c, x + bw * 0.28, r2 - 2, bw * 0.44, 14, 2); c.fill();
    c.fillStyle = T.tone("#F4E6C8"); c.font = font(8); c.fillText(name, x + bw / 2, r2 + 5);
    // 軒先の提灯
    lantern(c, T, x + 12, r1 + 1, "#E23B3B", "ゆ", sway(v, i, 1.5, 1.8), 0.9);
    lantern(c, T, x + bw - 12, r1 + 1, "#F6E7C8", "", sway(v, i + 1, 1.5, 1.8), 0.9);
  });
  // ガス灯と石灯籠
  each(v, 236, 1, 8, 0.3, (x, i) => {
    if (h01(i, 9) < 0.5) streetLamp(c, T, g, x + 30, 84, "gas");
    else {
      c.fillStyle = T.tone("#8E8A82"); rr(c, x + 24, g - 12, 16, 6, 1); c.fill(); c.fillRect(x + 29, g - 26, 6, 14);
      c.fillStyle = T.tone("#9E9A92"); rr(c, x + 22, g - 34, 20, 8, 2); c.fill();
      c.fillStyle = T.lit > 0.05 ? `rgba(255,200,120,${0.8 * T.lit + 0.2})` : "#3A3048"; c.fillRect(x + 28, g - 32, 8, 5);
      c.fillStyle = T.tone("#7E7A72"); c.beginPath(); c.moveTo(x + 20, g - 34); c.lineTo(x + 32, g - 42); c.lineTo(x + 44, g - 34); c.fill();
      c.fillStyle = T.tone("#FFFFFF"); c.beginPath(); c.moveTo(x + 23, g - 36); c.lineTo(x + 32, g - 42); c.lineTo(x + 41, g - 36); c.fill();
    }
  });
  // 湯けむり
  if (!v.calm) {
    each(v, 70, 1, 10, 0.5, (x, i) => {
      for (let k = 0; k < 4; k++) {
        const ph = (v.t * 0.5 + k * 0.25 + h01(i, 11)) % 1;
        c.fillStyle = `rgba(255,255,255,${0.32 * (1 - ph)})`;
        ell(c, x + Math.sin(ph * 6 + i) * 6, g - 8 - ph * 60, 6 + ph * 12, 4 + ph * 7); c.fill();
      }
    });
  }
  // 石畳（ぬれて光る）と、道ばたの雪
  c.fillStyle = T.tone("#7E7A74"); c.fillRect(left, g - 6, W, 25);
  const rows = [[g - 5, 8], [g + 4, 8], [g + 12, 7]] as const;
  rows.forEach(([y, h], r) => {
    each(v, 20, 1, 12 + r, 0, (x, i) => {
      const off = r % 2 ? 10 : 0;
      c.fillStyle = T.tone(pick(["#9A958D", "#8C877F", "#A7A29A"], i + r * 3, 13)); rr(c, x + off + 0.8, y, 18.4, h, 2.5); c.fill();
      c.fillStyle = `rgba(255,236,200,${0.1 + 0.15 * T.lit})`; c.fillRect(x + off + 3, y + 1, 10, 1);
    });
  });
  c.fillStyle = T.tone("#FFFFFF"); each(v, 30, 1, 14, 0.3, (x) => { ell(c, x, g - 6, 16, 3.5); c.fill(); });
}

/* ============================================================= */
/*  屋台通り（夏まつり）                                          */
/* ============================================================= */
const YATAI: readonly { name: string; col: string; kind: string }[] = [
  { name: "やきそば", col: "#E0413A", kind: "griddle" },
  { name: "たこ焼き", col: "#E88A1A", kind: "tako" },
  { name: "かき氷", col: "#2F6FD0", kind: "ice" },
  { name: "わたあめ", col: "#E07AB0", kind: "cotton" },
  { name: "お面", col: "#2E9A6A", kind: "mask" },
  { name: "金魚すくい", col: "#2F6FD0", kind: "goldfish" },
  { name: "射的", col: "#8A3FBF", kind: "shooting" },
  { name: "りんご飴", col: "#D63A3A", kind: "apple" },
];
function yataiGoods(v: RouteView, c: Ctx, T: Tones, kind: string, x: number, w: number, g: number, i: number): void {
  const cy = g - 30;
  if (kind === "griddle" || kind === "tako") {
    c.fillStyle = T.tone("#2E2E34"); rr(c, x + 12, cy - 4, w - 24, 6, 2); c.fill();
    if (kind === "griddle") { c.strokeStyle = T.tone("#C08A3A"); c.lineWidth = 1.2; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(x + 18 + k * 10, cy - 4); c.quadraticCurveTo(x + 22 + k * 10, cy - 9, x + 26 + k * 10, cy - 4); c.stroke(); } }
    else { c.fillStyle = T.tone("#C9803A"); for (let k = 0; k < 8; k++) { ell(c, x + 18 + k * 8, cy - 5, 3.2, 3); c.fill(); } }
    if (!v.calm) for (let k = 0; k < 3; k++) { const ph = (v.t * 0.7 + k / 3) % 1; c.fillStyle = `rgba(255,255,255,${0.35 * (1 - ph)})`; ell(c, x + w / 2 + Math.sin(ph * 6 + k) * 8, cy - 10 - ph * 30, 5 + ph * 6, 3 + ph * 4); c.fill(); }
  } else if (kind === "ice") {
    c.fillStyle = "#FFFFFF"; c.fillRect(x + w - 24, cy - 40, 18, 16);
    c.fillStyle = "#2F6FD0"; c.fillRect(x + w - 24, cy - 28, 18, 4);
    c.fillStyle = "#E23B3B"; c.font = font(10); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("氷", x + w - 15, cy - 34);
    for (let k = 0; k < 4; k++) { c.fillStyle = T.tone(["#E23B3B", "#4AA8E0", "#8BD05A", "#FFD23F"][k]!); c.beginPath(); c.moveTo(x + 14 + k * 12, cy - 2); c.lineTo(x + 22 + k * 12, cy - 2); c.lineTo(x + 20 + k * 12, cy - 10); c.lineTo(x + 16 + k * 12, cy - 10); c.closePath(); c.fill(); c.fillStyle = "#FFFFFF"; ell(c, x + 18 + k * 12, cy - 11, 5, 3.5); c.fill(); }
  } else if (kind === "cotton") {
    for (let k = 0; k < 6; k++) { const bx = x + 12 + k * 13; c.fillStyle = T.tone(pick(["#FFC0DA", "#BEE3FF", "#FFF0A8", "#D9C2FF"], i + k, 60)); rr(c, bx, cy - 42 + (k % 2) * 4, 11, 16, 5); c.fill(); c.fillStyle = "#3A2A30"; ell(c, bx + 3.5, cy - 35 + (k % 2) * 4, 0.9, 0.9); c.fill(); ell(c, bx + 7.5, cy - 35 + (k % 2) * 4, 0.9, 0.9); c.fill(); }
  } else if (kind === "mask") {
    for (let k = 0; k < 10; k++) {
      const mx = x + 14 + (k % 5) * 15, my = cy - 42 + Math.floor(k / 5) * 15;
      c.fillStyle = T.tone(pick(["#FFFFFF", "#FFE08A", "#FF9EC0", "#9FE0FF", "#C8F0A8"], i * 3 + k, 61)); ell(c, mx, my, 6, 6.5); c.fill();
      c.fillStyle = "#2A2440"; ell(c, mx - 2.2, my - 1, 0.9, 1.2); c.fill(); ell(c, mx + 2.2, my - 1, 0.9, 1.2); c.fill();
      c.fillStyle = "#E23B3B"; ell(c, mx, my + 2.5, 1.4, 0.8); c.fill();
    }
  } else if (kind === "goldfish") {
    c.fillStyle = T.tone("#3D8FD8"); rr(c, x + 10, cy - 6, w - 20, 8, 3); c.fill();
    c.fillStyle = "rgba(255,255,255,0.3)"; c.fillRect(x + 12, cy - 5, w - 24, 1.2);
    for (let k = 0; k < 5; k++) { const fx = x + 18 + ((k * 17 + (v.calm ? 0 : v.t * 14)) % (w - 36)); c.fillStyle = k % 2 ? "#FF6A2A" : "#FFFFFF"; ell(c, fx, cy - 2 + (k % 2), 2.8, 1.4); c.fill(); }
  } else if (kind === "shooting") {
    for (let k = 0; k < 2; k++) { c.fillStyle = T.tone("#B98A52"); c.fillRect(x + 10, cy - 20 - k * 14, w - 20, 2); for (let q = 0; q < 6; q++) { c.fillStyle = T.tone(pick(["#E0403A", "#FFD23F", "#4AA8E0", "#8BD05A", "#C58AD8"], i * 5 + q + k * 7, 62)); c.fillRect(x + 14 + q * 12, cy - 29 - k * 14, 8, 9); } }
  } else {
    for (let k = 0; k < 7; k++) { const ax = x + 14 + k * 10; c.strokeStyle = T.tone("#D8C8A8"); c.lineWidth = 1; c.beginPath(); c.moveTo(ax, cy - 2); c.lineTo(ax, cy - 12); c.stroke(); c.fillStyle = "#D6202E"; ell(c, ax, cy - 15, 4, 4); c.fill(); c.fillStyle = "rgba(255,255,255,0.6)"; ell(c, ax - 1.4, cy - 16.5, 1.2, 0.8); c.fill(); }
  }
}
function yatai(v: RouteView, T: Tones): void {
  const { c, g, left, right } = v, W = right - left;
  const sw = 102;
  // 鎮守の森と、遠くの鳥居
  each(v, 30, 0.4, 1, 0.5, (x, i) => { c.fillStyle = T.far("#243A34", 0.08 + h01(i, 2) * 0.08); ell(c, x, g - 120 - h01(i, 3) * 20, 24 + h01(i, 4) * 12, 22 + h01(i, 5) * 10); c.fill(); });
  c.fillStyle = T.far("#243A34", 0.1); c.fillRect(left, g - 122, W, 50);
  each(v, 640, 0.4, 6, 0.2, (x) => {
    c.fillStyle = T.far("#B0403A", -0.1);
    c.fillRect(x - 20, g - 140, 4, 60); c.fillRect(x + 16, g - 140, 4, 60); c.fillRect(x - 26, g - 144, 52, 4); c.fillRect(x - 22, g - 134, 44, 3);
  });
  // 屋台
  each(v, sw, 1, 0, 0, (x, i) => {
    const st = cycle(YATAI, i), roofY = g - 100, cnt = g - 30;
    c.fillStyle = T.tone("#3A2E28"); c.fillRect(x + 1, roofY, sw - 2, g - 6 - roofY);
    const back = c.createLinearGradient(0, roofY, 0, cnt);
    back.addColorStop(0, T.lit > 0.05 ? `rgba(255,214,150,${0.55 + 0.4 * T.lit})` : T.tone("#E9D7BC")); back.addColorStop(1, T.lit > 0.05 ? `rgba(240,170,90,${0.5 + 0.4 * T.lit})` : T.tone("#D8C09A"));
    c.fillStyle = back; c.fillRect(x + 4, roofY + 16, sw - 8, cnt - roofY - 16);
    yataiGoods(v, c, T, st.kind, x, sw, g, i);
    // カウンター
    c.fillStyle = T.tone("#F4EEE2"); c.fillRect(x + 2, cnt, sw - 4, 6);
    c.fillStyle = T.tone(st.col); c.fillRect(x + 2, cnt + 6, sw - 4, g - 6 - cnt - 6);
    c.fillStyle = "#FFFFFF"; c.font = font(9); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(st.name, x + sw / 2, cnt + 15);
    c.fillStyle = "rgba(0,0,0,0.15)"; c.fillRect(x + 2, cnt + 6, sw - 4, 2);
    // 柱
    c.fillStyle = T.tone("#8A6A4A"); c.fillRect(x + 1, roofY, 3, g - 6 - roofY); c.fillRect(x + sw - 4, roofY, 3, g - 6 - roofY);
    // テントの屋根と飾り幕
    const stripes = 8, stw = sw / stripes;
    for (let k = 0; k < stripes; k++) {
      c.fillStyle = k % 2 ? T.tone("#FFFFFF") : T.tone(st.col);
      c.beginPath(); c.moveTo(x + k * stw + 2, roofY - 10); c.lineTo(x + (k + 1) * stw + 2, roofY - 10); c.lineTo(x + (k + 1) * stw - 2, roofY + 6); c.lineTo(x + k * stw - 2, roofY + 6); c.closePath(); c.fill();
    }
    c.fillStyle = T.tone(st.col);
    for (let k = 0; k < stripes; k++) { c.beginPath(); c.arc(x + (k + 0.5) * stw, roofY + 6, stw / 2, 0, Math.PI); c.fill(); }
    // のれんの屋号
    if (T.lit > 0.05) glow(c, x + sw / 2, roofY + 20, 30, "255,236,190", 0.35 * T.lit);
    c.fillStyle = T.lit > 0.05 ? "#FFF6E0" : T.tone("#FFFFFF"); rr(c, x + sw / 2 - 26, roofY + 14, 52, 13, 2); c.fill();
    c.fillStyle = st.col; c.font = font(8); c.fillText(st.name, x + sw / 2, roofY + 21);
    // 裸電球
    for (let k = 0; k < 3; k++) {
      const bx = x + 18 + k * 32, by = roofY + 12;
      if (T.lit > 0.05) glow(c, bx, by, 18, "255,220,140", 0.5 * T.lit);
      c.strokeStyle = "#2A2440"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(bx, roofY + 7); c.lineTo(bx, by - 2); c.stroke();
      c.fillStyle = T.lit > 0.05 ? "#FFF2C0" : T.tone("#F4EEDC"); ell(c, bx, by, 2.6, 3.2); c.fill();
    }
  });
  // 頭上の提灯の列（ジグザグ）
  const ly = Math.max(20, g - 138);
  const pts: [number, number][] = [];
  each(v, 52, 1, 0, 0, (x, i) => pts.push([x, ly + (i % 2 ? 14 : 0)]));
  c.strokeStyle = T.tone("#2A2440"); c.lineWidth = 0.9;
  for (let k = 0; k < pts.length - 1; k++) { const [ax, ay] = pts[k]!, [bx, by] = pts[k + 1]!; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 8, bx, by); c.stroke(); }
  pts.forEach(([x, y], k) => { lantern(c, T, x, y, k % 3 === 0 ? "#F6E7C8" : "#E23B3B", k % 3 === 0 ? "" : "祭", sway(v, k, 1.8, 1.6)); });
  // 参道の石畳と砂利
  c.fillStyle = T.tone("#B6ADA0"); c.fillRect(left, g - 6, W, 25);
  each(v, 7, 1, 20, 0.9, (x, i) => { c.fillStyle = T.tone(h01(i, 21) < 0.5 ? "#9C9488" : "#CFC6B8"); ell(c, x, g - 4 + h01(i, 22) * 22, 1.4, 1); c.fill(); });
  each(v, 30, 1, 0, 0, (x, i) => { c.fillStyle = T.tone(i % 2 ? "#8E887E" : "#A39C92"); rr(c, x + 1, g + 1, 28, 11, 2); c.fill(); c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(x + 3, g + 2, 20, 1); });
  if (T.lit > 0.05) each(v, sw, 1, 0, 0, (x) => { c.fillStyle = `rgba(255,200,120,${0.16 * T.lit})`; ell(c, x + sw / 2, g + 4, 44, 8); c.fill(); });
}

/* ============================================================= */
/*  入口と出口                                                     */
/* ============================================================= */
/** 景色を描く。engine.ts 側で入口〜出口の範囲に切り抜いてから呼ぶ */
export function drawRouteScene(v: RouteView, theme: RouteTheme): void {
  const T = tones(v.e);
  switch (theme) {
    case "park": park(v, T); break;
    case "stream": stream(v, T); break;
    case "riverbank": riverbank(v, T); break;
    case "ridge": ridge(v, T); break;
    case "kamakura": kamakura(v, T); break;
    case "arcade": arcade(v, T); break;
    case "onsen": onsen(v, T); break;
    case "yatai": yatai(v, T); break;
  }
  veil(v);
  // 入口・出口のきわで、もとの道と自然につながるよう少し影を落とす
  const { c, g, left, right } = v;
  const edge = (x: number, dir: 1 | -1) => {
    const eg = c.createLinearGradient(x, 0, x + 18 * dir, 0);
    eg.addColorStop(0, "rgba(20,18,40,0.22)"); eg.addColorStop(1, "rgba(20,18,40,0)");
    c.fillStyle = eg; c.fillRect(Math.min(x, x + 18 * dir), g - 40, 18, 59);
  };
  if (v.seamL) edge(left, 1);
  if (v.seamR) edge(right, -1);
}

/**
 * 景色に空気の色のもやを薄くかける。お店や屋台は色が多く、障害物と同じ高さに並ぶので、
 * そのままだと障害物が背景にまぎれる。本道の背景（engine.ts の haze）と同じく一歩奥に引かせ、
 * 手前に描く障害物・アイテム・犬が浮いて見えるようにする。足もとの道は、もやを弱める
 */
const VEIL = { top: 0.25, wall: 0.5, ground: 0.16 };
function veil(v: RouteView): void {
  const { c, e, g, left, right } = v;
  const air = mix(mix(e.far, e.bot, 0.5), mix(e.far, e.near, 0.55), e.night);
  const bottom = g + 19;
  const k = (y: number) => Math.max(0, Math.min(1, y / bottom));
  const grad = c.createLinearGradient(0, 0, 0, bottom);
  grad.addColorStop(0, rgb(air, VEIL.top));
  grad.addColorStop(k(g - 70), rgb(air, VEIL.wall));
  grad.addColorStop(k(g - 2), rgb(air, VEIL.wall));
  grad.addColorStop(k(g + 4), rgb(air, VEIL.ground));
  grad.addColorStop(1, rgb(air, VEIL.ground));
  c.fillStyle = grad;
  c.fillRect(left, 0, right - left, bottom);
}

/** 入口・出口のゲートの半分の幅。景色の切れ目がちょうど柱の位置に来るようにする */
export const ROUTE_GATE_HALF = 40;

/** 景色ごとのゲート。柱2本で景色の切れ目を隠し、真ん中に道の名前 */
export function drawRouteGate(c: Ctx, e: RouteEnv, g: number, x: number, theme: RouteTheme, label: string, t: number): void {
  const T = tones(e), H = ROUTE_GATE_HALF;
  const plate = (y: number, bg: string, fg: string, border: string, size = 10) => {
    c.font = font(size); c.textAlign = "center"; c.textBaseline = "middle";
    const w = Math.max(58, c.measureText(label).width + 22);
    if (T.lit > 0.05) glow(c, x, y, w * 0.9, "255,230,180", 0.4 * T.lit);
    c.fillStyle = bg; rr(c, x - w / 2, y - 12, w, 24, 4); c.fill();
    c.strokeStyle = border; c.lineWidth = 2.2; rr(c, x - w / 2, y - 12, w, 24, 4); c.stroke();
    c.fillStyle = fg; c.fillText(label, x, y + 0.5);
  };
  const post = (px: number, top: number, col: string, w = 8) => {
    c.fillStyle = T.tone(col); c.fillRect(px - w / 2, top, w, g + 4 - top);
    c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(px + w / 2 - 2.5, top, 2.5, g + 4 - top);
    c.fillStyle = "rgba(255,255,255,0.15)"; c.fillRect(px - w / 2, top, 1.5, g + 4 - top);
  };
  if (theme === "park") {
    for (const px of [x - H, x + H]) {
      post(px, g - 58, "#B8A98E", 12);
      c.fillStyle = T.tone("#9E8F76"); c.fillRect(px - 8, g - 62, 16, 5); c.fillRect(px - 7, g - 12, 14, 8);
      c.fillStyle = T.tone("#3A7A42"); ell(c, px + (px < x ? -12 : 12), g - 10, 12, 8); c.fill();
    }
    c.strokeStyle = T.tone("#2E3B35"); c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(x - H, g - 58); c.quadraticCurveTo(x, g - 150, x + H, g - 58); c.stroke();
    c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - H + 5, g - 58); c.quadraticCurveTo(x, g - 138, x + H - 5, g - 58); c.stroke();
    for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(x + k * 9, g - 104 + Math.abs(k) * 5); c.lineTo(x + k * 9, g - 116 + Math.abs(k) * 9); c.stroke(); }
    plate(g - 124, T.tone("#F4EBD6"), "#2E4A2A", T.tone("#2E3B35"));
  } else if (theme === "arcade") {
    const top = g - 176;
    post(x - H, top, "#B23A3A", 10); post(x + H, top, "#B23A3A", 10);
    c.fillStyle = T.tone("#B23A3A"); rr(c, x - H - 8, top - 6, H * 2 + 16, 30, 4); c.fill();
    c.font = font(12); c.textAlign = "center"; c.textBaseline = "middle";
    const w = H * 2 + 6;
    c.fillStyle = T.lit > 0.05 ? "#FFF6D8" : T.tone("#FFF2D0"); rr(c, x - w / 2, top - 2, w, 22, 3); c.fill();
    for (let k = 0; k < 14; k++) {
      const on = T.lit > 0.05 ? (Math.floor(t * 4) + k) % 3 !== 0 : true;
      c.fillStyle = on ? "#FFD84A" : "#8A6A2A";
      ell(c, x - H - 4 + k * ((H * 2 + 8) / 13), top - 4, 1.6, 1.6); c.fill();
      ell(c, x - H - 4 + k * ((H * 2 + 8) / 13), top + 22, 1.6, 1.6); c.fill();
    }
    if (T.lit > 0.05) glow(c, x, top + 9, 70, "255,220,150", 0.4 * T.lit);
    c.fillStyle = "#B23A3A"; c.fillText(label, x, top + 9.5);
  } else if (theme === "onsen") {
    const top = g - 128;
    post(x - H, top, "#6B4A32", 9); post(x + H, top, "#6B4A32", 9);
    c.fillStyle = T.tone("#3E4450"); c.beginPath(); c.moveTo(x - H - 18, top + 2); c.lineTo(x - H + 2, top - 14); c.lineTo(x + H - 2, top - 14); c.lineTo(x + H + 18, top + 2); c.closePath(); c.fill();
    c.fillStyle = T.tone("#FFFFFF"); c.beginPath(); c.moveTo(x - H - 14, top - 1); c.quadraticCurveTo(x, top - 22, x + H + 14, top - 1); c.lineTo(x + H + 8, top - 1); c.quadraticCurveTo(x, top - 16, x - H - 8, top - 1); c.fill();
    plate(top + 18, T.tone("#3A2718"), "#F4E6C8", T.tone("#6B4A32"));
    lantern(c, T, x - H, top + 34, "#E23B3B", "ゆ", 0, 1.1);
    lantern(c, T, x + H, top + 34, "#E23B3B", "ゆ", 0, 1.1);
  } else if (theme === "yatai") {
    const top = g - 146, red = T.lit > 0.05 ? "#D8402F" : "#D8402F";
    post(x - H, top, red, 9); post(x + H, top, red, 9);
    c.fillStyle = T.tone("#2A2224"); c.beginPath(); c.moveTo(x - H - 22, top - 4); c.quadraticCurveTo(x, top - 2, x + H + 22, top - 4); c.lineTo(x + H + 18, top + 4); c.lineTo(x - H - 18, top + 4); c.closePath(); c.fill();
    c.fillStyle = T.tone(red); c.fillRect(x - H - 12, top + 4, H * 2 + 24, 7); c.fillRect(x - H - 8, top + 22, H * 2 + 16, 5);
    plate(top + 36, T.tone("#2A2224"), "#FFD166", T.tone(red), 9);
    lantern(c, T, x - H - 14, top + 12, "#E23B3B", "祭", 0);
    lantern(c, T, x + H + 14, top + 12, "#E23B3B", "祭", 0);
  } else if (theme === "kamakura") {
    for (const px of [x - H, x + H]) {
      c.fillStyle = T.tone("#F6F9FF"); rr(c, px - 9, g - 70, 18, 74, 6); c.fill();
      c.fillStyle = T.tone("#C9D6EA"); c.fillRect(px + 3, g - 66, 5, 68);
      glow(c, px, g - 78, 16, "255,190,100", 0.3 + 0.5 * T.lit);
      c.fillStyle = "#FFD08A"; ell(c, px, g - 78, 2, 3); c.fill();
    }
    c.fillStyle = T.tone("#F6F9FF"); c.beginPath(); c.moveTo(x - H - 9, g - 64); c.quadraticCurveTo(x, g - 130, x + H + 9, g - 64); c.lineTo(x + H - 7, g - 64); c.quadraticCurveTo(x, g - 112, x - H + 7, g - 64); c.closePath(); c.fill();
    plate(g - 112, T.tone("#FFFFFF"), "#2F5E8A", T.tone("#9FB8DA"));
  } else {
    // 山道・河原：丸太のゲートと木の看板
    const top = g - 118;
    post(x - H, top, "#8A6A4A", 9); post(x + H, top, "#8A6A4A", 9);
    c.fillStyle = T.tone("#7A5A3C"); rr(c, x - H - 12, top - 5, H * 2 + 24, 9, 4); c.fill();
    c.fillStyle = "rgba(0,0,0,0.15)"; c.fillRect(x - H - 12, top + 1, H * 2 + 24, 3);
    c.strokeStyle = T.tone("#D8C9A8"); c.lineWidth = 1; c.beginPath(); c.moveTo(x - 20, top + 4); c.lineTo(x - 20, top + 16); c.moveTo(x + 20, top + 4); c.lineTo(x + 20, top + 16); c.stroke();
    plate(top + 28, T.tone("#C9A472"), "#3A2A1C", T.tone("#7A5A3C"));
    c.fillStyle = T.tone("#3F7A3E"); for (const px of [x - H, x + H]) { fernLite(c, T, px + (px < x ? -10 : 10), g - 4); }
  }
}
function fernLite(c: Ctx, T: Tones, x: number, y: number): void {
  c.fillStyle = T.tone("#4C8F48");
  for (let k = 0; k < 5; k++) { ell(c, x - 8 + k * 4, y - 6 - (k % 2) * 3, 3, 7, -0.6 + k * 0.3); c.fill(); }
}
