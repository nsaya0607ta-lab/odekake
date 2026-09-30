/**
 * おさんぽフレンチー：ふだんの道の背景（中景・近景・足もと）
 * =============================================================
 * まち・山道・雪国・夏まつりの4ステージぶん。空と遠くの山並みは engine.ts が描く。
 * 中景（建物・木・屋台）と近景（電柱・塀・自販機など）は背景の流れ（bgCam）に、
 * 足もと（歩道・車道）は道の流れ（cam）に合わせて動く。
 * 置くもの・色は位置から決まる値で選ぶので、同じ場所にはいつも同じものが立つ。
 */
import type { OsanpoRunStageId } from "@/lib/games/osanpo-run/config";
import { ell, font, glow, hex, mix, rgb, rr, shade, type Ctx, type RGB } from "./draw";

export type MidItem = {
  x: number; w: number; h: number; gap: number; tone: number;
  type: "building" | "house" | "pine" | "round" | "torii" | "stall";
  cols: number; rows: number; lit: boolean[]; roof: "flat" | "tank" | "antenna" | "gable"; blink: number;
  label: string; colors: [string, string];
  /** マンションのベランダの手すり */
  balcony: boolean;
};
export type NearItem = { x: number; w: number; gap: number; lamp: boolean; vend: boolean; tr: boolean };

/** 時間帯の色（engine.ts の Env と同じ形） */
export type StageEnv = { m: number; top: RGB; bot: RGB; far: RGB; mid: RGB; near: RGB; night: number; side: RGB; road: RGB };

export type StageView = {
  c: Ctx;
  e: StageEnv;
  stage: OsanpoRunStageId;
  /** 犬の足もとの高さ・画面の幅と高さ */
  g: number; vw: number; vh: number;
  /** 経過秒 */
  t: number;
  /** 動きを減らす設定 */
  calm: boolean;
  /** 日の光の色と強さ（夕方・朝方ほど warm が大きい） */
  sun: { warm: number; rgb: string; day: number };
};

/** 位置から決まる 0〜1 の値 */
const h01 = (i: number, salt: number) => { const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return v - Math.floor(v); };
const pick = <T>(list: readonly T[], i: number, salt: number): T => list[Math.floor(h01(i, salt) * list.length) % list.length]!;
/** 灯りの強さ。夕方から効きはじめる */
const litOf = (e: StageEnv) => Math.max(0, Math.min(1, (e.night - 0.1) / 0.5));
const sway = (v: StageView, i: number, amt: number, speed = 1.3) => (v.calm ? 0 : Math.sin(v.t * speed + i * 1.7) * amt);

/* ============================================================= */
/*  中景：まち・雪国の建物                                         */
/* ============================================================= */
const WALLS = ["#E8D7C3", "#D6E0E8", "#EAD6CF", "#DCE6D2", "#E4DDEE", "#F0E4CC", "#D2D6DE"];
const ROOFS = ["#9A4A3A", "#3E5578", "#4E6A58", "#6A5A4E", "#7A3E4A"];

function drawBuilding(v: StageView, b: MidItem, x: number): void {
  const { c, e, g } = v, base = g - 6, top = base - b.h, snowy = v.stage === "snow", n = e.night, L = litOf(e);
  const seed = b.x * 0.013;
  const body = mix(shade(e.mid, b.tone), hex(pick(WALLS, seed, 1)), 0.32 * (1 - n * 0.75));
  const snow = mix([246, 249, 255], e.mid, 0.08 + n * 0.45);
  const bg = c.createLinearGradient(0, top, 0, base);
  bg.addColorStop(0, rgb(mix(body, hex("#FFE2C4"), 0.12 * v.sun.warm * v.sun.day))); bg.addColorStop(1, rgb(shade(body, -0.1)));
  c.fillStyle = bg; c.fillRect(x, top, b.w, b.h);
  // 日の当たらない側面
  c.fillStyle = rgb(shade(body, -0.14)); c.fillRect(x + b.w * 0.8, top, b.w * 0.2, b.h);
  // 屋上のふちと、夕日の当たるへり
  c.fillStyle = rgb(shade(body, -0.2)); c.fillRect(x - 1, top - 3, b.w + 2, 3);
  c.fillStyle = `rgba(${v.sun.rgb},${0.15 + 0.4 * v.sun.warm * v.sun.day})`; c.fillRect(x - 1, top - 3, b.w * 0.8 + 1, 1.2);
  if (snowy) { c.fillStyle = rgb(snow); rr(c, x - 2, top - 7, b.w + 4, 6, 3); c.fill(); }
  // 屋上のもの
  const roofCol = rgb(shade(body, -0.28));
  if (b.roof === "tank") {
    const tx = x + b.w * 0.56;
    c.fillStyle = roofCol; c.fillRect(tx + 2, top - 7, 2, 7); c.fillRect(tx + 13, top - 7, 2, 7);
    const tg = c.createLinearGradient(tx, 0, tx + 17, 0);
    tg.addColorStop(0, rgb(shade(body, 0.05))); tg.addColorStop(1, rgb(shade(body, -0.3)));
    c.fillStyle = tg; rr(c, tx, top - 18, 17, 11, 2); c.fill();
    if (snowy) { c.fillStyle = rgb(snow); rr(c, tx - 1, top - 20, 19, 4, 2); c.fill(); }
  } else if (b.roof === "antenna") {
    c.fillStyle = roofCol; c.fillRect(x + b.w * 0.3, top - 22, 1.6, 22); c.fillRect(x + b.w * 0.3 - 6, top - 18, 13, 1.4); c.fillRect(x + b.w * 0.3 - 4, top - 13, 9, 1.4);
  }
  if (h01(seed, 2) < 0.5) {
    // 屋上の手すり
    c.strokeStyle = rgb(shade(body, -0.3), 0.8); c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x + 1, top - 7); c.lineTo(x + b.w - 1, top - 7); c.stroke();
    for (let k = 0; k <= b.w; k += 6) { c.beginPath(); c.moveTo(x + k, top - 7); c.lineTo(x + k, top - 3); c.stroke(); }
  }
  if (b.label || (b.h > 110 && h01(seed, 3) < 0.35)) {
    // 屋上の看板（label があれば、プレイヤーが行ったお店の名前）
    const sw = b.label ? Math.min(b.w - 8, 76) : Math.min(b.w - 8, 46), sx = x + 4;
    c.fillStyle = roofCol; c.fillRect(sx + 4, top - 12, 2, 9); c.fillRect(sx + sw - 6, top - 12, 2, 9);
    if (L > 0.05) glow(c, sx + sw / 2, top - 18, sw * 0.7, "255,236,190", 0.3 * L);
    c.fillStyle = L > 0.05 ? "#FFF4DA" : rgb(mix(hex("#FFFFFF"), e.mid, 0.3)); rr(c, sx, top - 24, sw, 12, 2); c.fill();
    c.fillStyle = pick(["#C23B3B", "#2F5E9A", "#2E7A5A"], seed, 4); c.font = font(b.label ? 8 : 7); c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(b.label || pick(["おでかけ", "わんこ堂", "ホテル", "クリニック"], seed, 5), sx + sw / 2, top - 17.5, sw - 4);
  }
  if (b.h > 130 && n > 0.3 && Math.sin(v.t * 3 + b.blink) > 0.2) { c.fillStyle = `rgba(255,70,70,${n})`; c.beginPath(); c.arc(x + b.w / 2, top - 4, 1.8, 0, Math.PI * 2); c.fill(); }
  // 窓（昼は空を映し、夜はカーテン越しに灯る）
  const ww = 7, wh = 9, gx = 13, gyy = 17;
  const sx0 = x + (b.w - (b.cols * gx - (gx - ww))) / 2, sy0 = top + 8;
  const sky = mix(mix(e.top, e.bot, 0.5), body, 0.45);
  for (let r = 0; r < b.rows; r++) {
    for (let i = 0; i < b.cols; i++) {
      const k = r * b.cols + i, lit = b.lit[k] && n > 0.05, wx = sx0 + i * gx, wy = sy0 + r * gyy;
      c.fillStyle = rgb(shade(body, -0.25), 0.8); c.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
      if (lit) {
        c.fillStyle = k % 3 ? `rgba(255,214,130,${0.3 + 0.7 * n})` : `rgba(255,236,196,${0.3 + 0.7 * n})`; c.fillRect(wx, wy, ww, wh);
        c.fillStyle = `rgba(${k % 2 ? "200,120,90" : "120,150,200"},${0.35 * n})`; c.fillRect(wx, wy, 2.2, wh);
      } else {
        c.fillStyle = rgb(sky, 0.85); c.fillRect(wx, wy, ww, wh);
        c.fillStyle = `rgba(255,255,255,${0.16 * (1 - n)})`; c.beginPath(); c.moveTo(wx + 1, wy); c.lineTo(wx + 4, wy); c.lineTo(wx + 1, wy + 5); c.fill();
      }
    }
    if (b.balcony) {
      const ry = sy0 + r * gyy + wh + 2;
      c.fillStyle = rgb(shade(body, -0.2)); c.fillRect(x + 2, ry, b.w - 4, 3);
      c.fillStyle = rgb(shade(body, 0.12), 0.6); c.fillRect(x + 2, ry, b.w - 4, 0.8);
      // 干した洗濯物と室外機
      if (h01(seed + r, 6) < 0.25 && n < 0.6) {
        const lx = x + 4 + h01(seed + r, 7) * (b.w - 20);
        for (let q = 0; q < 3; q++) { c.fillStyle = rgb(mix(hex(pick(["#F2F2F2", "#8FB8E0", "#F2B8C6", "#F5D76E"], seed + r + q, 8)), e.mid, 0.35)); c.fillRect(lx + q * 5, ry - 6, 4, 6); }
      }
      if (h01(seed + r, 9) < 0.3) { c.fillStyle = rgb(shade(body, 0.2)); c.fillRect(x + b.w - 11, ry - 5, 8, 5); c.strokeStyle = rgb(shade(body, -0.2)); c.lineWidth = 0.5; c.beginPath(); c.arc(x + b.w - 7, ry - 2.5, 1.8, 0, Math.PI * 2); c.stroke(); }
    }
  }
}

function drawHouse(v: StageView, b: MidItem, x: number): void {
  const { c, e, g } = v, base = g - 6, top = base - b.h, snowy = v.stage === "snow", n = e.night, L = litOf(e);
  const seed = b.x * 0.013;
  const body = mix(shade(e.mid, b.tone), hex(pick(WALLS, seed, 11)), 0.36 * (1 - n * 0.75));
  const roof = mix(shade(e.mid, b.tone - 0.1), hex(pick(ROOFS, seed, 12)), 0.4 * (1 - n * 0.7));
  const snow = mix([246, 249, 255], e.mid, 0.08 + n * 0.45);
  // 壁
  c.fillStyle = rgb(body); c.fillRect(x + 3, top, b.w - 6, b.h);
  c.fillStyle = rgb(shade(body, -0.12)); c.fillRect(x + b.w - 3 - (b.w - 6) * 0.22, top, (b.w - 6) * 0.22, b.h);
  // 窓と玄関
  const lit = n > 0.05 && h01(seed, 13) < 0.7;
  const wy = top + b.h * 0.3, wx = x + b.w * 0.18;
  c.fillStyle = rgb(shade(body, -0.28)); c.fillRect(wx - 1, wy - 1, 14, 12);
  c.fillStyle = lit ? `rgba(255,214,140,${0.35 + 0.65 * n})` : rgb(mix(mix(e.top, e.bot, 0.5), body, 0.4)); c.fillRect(wx, wy, 12, 10);
  c.fillStyle = rgb(shade(body, -0.28)); c.fillRect(wx + 5.5, wy, 1, 10); c.fillRect(wx, wy + 4.5, 12, 1);
  if (lit) glow(c, wx + 6, wy + 5, 14, "255,210,140", 0.3 * L);
  c.fillStyle = rgb(shade(body, -0.34)); rr(c, x + b.w * 0.62, base - 17, 9, 17, 1.5); c.fill();
  if (L > 0.05) { glow(c, x + b.w * 0.62 + 11, base - 16, 8, "255,220,150", 0.6 * L); c.fillStyle = "#FFE8B0"; ell(c, x + b.w * 0.62 + 11, base - 16, 1.4, 1.4); c.fill(); }
  // 屋根（瓦の筋・軒の影）
  const peak = top - b.w * 0.3;
  c.fillStyle = rgb(roof);
  c.beginPath(); c.moveTo(x - 4, top + 3); c.lineTo(x + b.w / 2, peak); c.lineTo(x + b.w + 4, top + 3); c.closePath(); c.fill();
  c.fillStyle = rgb(shade(roof, -0.2));
  c.beginPath(); c.moveTo(x + b.w / 2, peak); c.lineTo(x + b.w + 4, top + 3); c.lineTo(x + b.w / 2 + 4, top + 3); c.closePath(); c.fill();
  c.strokeStyle = rgb(shade(roof, -0.25), 0.7); c.lineWidth = 0.6;
  for (let k = 1; k < 4; k++) { const t = k / 4, y = peak + (top + 3 - peak) * t; c.beginPath(); c.moveTo(x + b.w / 2 - (b.w / 2 + 4) * t, y); c.lineTo(x + b.w / 2 + (b.w / 2 + 4) * t, y); c.stroke(); }
  c.fillStyle = "rgba(0,0,0,0.14)"; c.fillRect(x + 3, top + 3, b.w - 6, 3);
  if (h01(seed, 14) < 0.4) { c.fillStyle = rgb(shade(roof, -0.1)); c.fillRect(x + b.w * 0.7, peak + (top - peak) * 0.3 - 8, 5, 10); }
  else if (h01(seed, 14) < 0.65 && !snowy) {
    // 太陽光パネル
    c.fillStyle = rgb(mix(hex("#2C3E6A"), e.mid, 0.3)); c.beginPath(); c.moveTo(x + 6, top + 1); c.lineTo(x + b.w / 2 - 4, peak + 6); c.lineTo(x + b.w / 2 - 1, peak + 9); c.lineTo(x + 10, top + 3); c.closePath(); c.fill();
  }
  if (snowy) {
    c.fillStyle = rgb(snow);
    c.beginPath(); c.moveTo(x - 5, top + 1); c.lineTo(x + b.w / 2, peak - 3); c.lineTo(x + b.w + 5, top + 1); c.lineTo(x + b.w + 3, top + 4); c.lineTo(x + b.w / 2, peak + 3); c.lineTo(x - 3, top + 4); c.closePath(); c.fill();
    // つらら
    c.fillStyle = rgb(mix(snow, hex("#BFD6F0"), 0.3));
    for (let k = 0; k < 6; k++) { const ix = x + 2 + k * (b.w / 6), len = 3 + h01(seed + k, 15) * 5; c.beginPath(); c.moveTo(ix, top + 4); c.lineTo(ix + 1.2, top + 4 + len); c.lineTo(ix + 2.4, top + 4); c.fill(); }
  }
  // 生け垣
  c.fillStyle = rgb(mix(hex(snowy ? "#E8EEF8" : "#4E7A52"), e.mid, 0.45 + n * 0.3));
  for (let k = 0; k < 4; k++) { ell(c, x + 6 + k * (b.w / 4), base - 3, b.w / 7, 4.5); c.fill(); }
}

function drawTreeMid(v: StageView, b: MidItem, x: number): void {
  const { c, e, g } = v, base = g - 6, col = shade(e.mid, b.tone), sw = sway(v, b.x * 0.01, 1.2, 0.9);
  const autumn = v.stage === "hiking" && b.type === "round" && h01(b.x * 0.013, 121) < 0.35;
  const base0 = autumn ? mix(col, hex(h01(b.x * 0.013, 122) < 0.5 ? "#D8743A" : "#E0A83A"), 0.45 * (1 - e.night * 0.7)) : col;
  const hi = mix(base0, hex(autumn ? "#F2C26A" : v.stage === "hiking" ? "#9AD08A" : "#B0D8A0"), 0.2 * (1 - e.night * 0.8));
  if (b.type === "pine") {
    c.fillStyle = rgb(shade(col, -0.25)); c.fillRect(x + b.w / 2 - 2, base - 14, 4, 14);
    for (let k = 0; k < 3; k++) {
      const ty = base - 10 - k * b.h * 0.28, tw = b.w * (1 - k * 0.22), tip = ty - b.h * 0.45, cx = x + b.w / 2 + sw * (k / 2);
      c.fillStyle = rgb(col); c.beginPath(); c.moveTo(cx - tw / 2, ty); c.lineTo(cx, tip); c.lineTo(cx + tw / 2, ty); c.closePath(); c.fill();
      c.fillStyle = rgb(shade(col, -0.18)); c.beginPath(); c.moveTo(cx, tip); c.lineTo(cx + tw / 2, ty); c.lineTo(cx + tw * 0.08, ty); c.closePath(); c.fill();
      c.fillStyle = rgb(hi, 0.7); c.beginPath(); c.moveTo(cx - tw * 0.1, tip + 4); c.lineTo(cx - tw * 0.35, ty - 1); c.lineTo(cx - tw * 0.18, ty - 1); c.closePath(); c.fill();
    }
  } else {
    c.fillStyle = rgb(shade(col, -0.22)); c.fillRect(x + b.w / 2 - 2.5, base - 20, 5, 20);
    const cx = x + b.w / 2 + sw;
    c.fillStyle = rgb(shade(base0, -0.1)); c.beginPath();
    c.arc(cx, base - b.h * 0.6, b.w * 0.5, 0, Math.PI * 2); c.arc(cx - b.w * 0.2, base - b.h * 0.45, b.w * 0.32, 0, Math.PI * 2); c.arc(cx + b.w * 0.22, base - b.h * 0.42, b.w * 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = rgb(shade(base0, 0.06)); c.beginPath();
    c.arc(cx - b.w * 0.06, base - b.h * 0.66, b.w * 0.34, 0, Math.PI * 2); c.arc(cx - b.w * 0.24, base - b.h * 0.5, b.w * 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = rgb(hi, 0.8); c.beginPath(); c.arc(cx - b.w * 0.14, base - b.h * 0.74, b.w * 0.16, 0, Math.PI * 2); c.fill();
  }
  // 根もとの茂み
  c.fillStyle = rgb(shade(col, -0.05));
  ell(c, x + b.w * 0.2, base - 2, 9, 4); c.fill(); ell(c, x + b.w * 0.85, base - 2, 7, 3.5); c.fill();
}

function drawStall(v: StageView, b: MidItem, x: number): void {
  const { c, e, g } = v, base = g - 6, top = base - b.h, n = e.night, L = litOf(e);
  c.fillStyle = rgb(shade(e.mid, -0.12)); c.fillRect(x + 3, top + 10, b.w - 6, b.h - 10);
  if (L > 0.05) { c.save(); c.globalCompositeOperation = "lighter"; glow(c, x + b.w / 2, top + 24, b.w * 0.75, "255,190,110", 0.4 * L); c.restore(); }
  const inner = c.createLinearGradient(0, top + 14, 0, top + 34);
  inner.addColorStop(0, L > 0.05 ? `rgba(255,220,160,${0.55 + 0.4 * n})` : rgb(shade(e.mid, 0.2))); inner.addColorStop(1, L > 0.05 ? `rgba(240,170,90,${0.5 + 0.4 * n})` : rgb(shade(e.mid, 0.08)));
  c.fillStyle = inner; c.fillRect(x + 6, top + 14, b.w - 12, 18);
  // 品物のシルエット
  c.fillStyle = rgb(shade(e.mid, -0.2), 0.55);
  for (let k = 0; k < 5; k++) { ell(c, x + 12 + k * ((b.w - 24) / 4), top + 29, 3.4, 2.6); c.fill(); }
  c.fillStyle = rgb(mix(hex("#F4EEE2"), e.mid, 0.3 + n * 0.3)); c.fillRect(x + 4, top + 32, b.w - 8, 3);
  const [c1, c2] = b.colors, sw = 9;
  for (let i = 0; i * sw < b.w + 4; i++) {
    c.fillStyle = rgb(mix(hex(i % 2 ? c2 : c1), e.mid, 0.12 + n * 0.2));
    c.beginPath(); c.moveTo(x - 2 + i * sw, top); c.lineTo(x - 2 + (i + 1) * sw, top); c.lineTo(x - 2 + (i + 1) * sw, top + 10); c.arc(x - 2 + i * sw + sw / 2, top + 10, sw / 2, 0, Math.PI); c.closePath(); c.fill();
  }
  c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(x, top + 10, b.w, 3);
  for (let k = 0; k < 3; k++) {
    const bx = x + 12 + k * ((b.w - 24) / 2);
    if (L > 0.05) glow(c, bx, top + 16, 12, "255,220,140", 0.55 * L);
    c.fillStyle = L > 0.05 ? "#FFF2C0" : rgb(shade(e.mid, 0.3)); ell(c, bx, top + 16, 1.8, 2.2); c.fill();
  }
  if (L > 0.05) glow(c, x + b.w / 2, top - 7, 30, "255,236,190", 0.3 * L);
  c.fillStyle = L > 0.05 ? "#FFF6E0" : rgb(mix(hex("#FFFFFF"), e.mid, 0.25)); rr(c, x + b.w / 2 - 22, top - 13, 44, 12, 2); c.fill();
  c.fillStyle = "#C23030"; c.font = font(8); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(b.label, x + b.w / 2, top - 6.5);
}

function drawTorii(v: StageView, b: MidItem, x: number): void {
  const { c, e, g } = v, base = g - 6, n = e.night;
  const red = mix(hex("#D63A2E"), e.mid, 0.22 + n * 0.35), dark = shade(red, -0.35), black = mix(hex("#2A2224"), e.mid, 0.2 + n * 0.3);
  const top = base - b.h;
  c.fillStyle = rgb(red); c.fillRect(x + 12, top + 14, 7, b.h - 14); c.fillRect(x + b.w - 19, top + 14, 7, b.h - 14);
  c.fillStyle = rgb(dark); c.fillRect(x + 16, top + 14, 3, b.h - 14); c.fillRect(x + b.w - 15, top + 14, 3, b.h - 14);
  c.fillStyle = rgb(black); c.fillRect(x + 10, base - 8, 11, 8); c.fillRect(x + b.w - 21, base - 8, 11, 8);
  c.fillStyle = rgb(red); c.fillRect(x + 4, top + 26, b.w - 8, 5);
  c.fillStyle = rgb(black); c.beginPath(); c.moveTo(x - 6, top + 4); c.quadraticCurveTo(x + b.w / 2, top + 10, x + b.w + 6, top + 4); c.lineTo(x + b.w + 3, top + 9); c.quadraticCurveTo(x + b.w / 2, top + 14, x - 3, top + 9); c.closePath(); c.fill();
  c.fillStyle = rgb(red); c.fillRect(x + 1, top + 9, b.w - 2, 5);
  c.fillStyle = rgb(black); c.fillRect(x + b.w / 2 - 6, top + 14, 12, 12);
  c.fillStyle = rgb(mix(hex("#E8C06A"), e.mid, 0.3 + n * 0.3)); c.fillRect(x + b.w / 2 - 4, top + 16, 8, 8);
}

/** 中景（建物・木・屋台・鳥居）を描く */
export function drawStageMid(v: StageView, items: readonly MidItem[], off: number): void {
  for (const b of items) {
    const x = b.x - off;
    if (x > v.vw + 20 || x + b.w < -20) continue;
    if (b.type === "building") drawBuilding(v, b, x);
    else if (b.type === "house") drawHouse(v, b, x);
    else if (b.type === "pine" || b.type === "round") drawTreeMid(v, b, x);
    else if (b.type === "stall") drawStall(v, b, x);
    else drawTorii(v, b, x);
  }
}

/* ============================================================= */
/*  近景：電柱・塀・庭木・自販機・小物                              */
/* ============================================================= */
function drawPole(v: StageView, x: number, top: number, base: number, p: NearItem, lamps: [number, number][]): void {
  const { c, e } = v, L = litOf(e), seed = p.x * 0.013;
  const pole = mix(e.near, hex("#C8C2B8"), 0.18 * (1 - e.night * 0.8));
  const pg = c.createLinearGradient(x, 0, x + 6, 0);
  pg.addColorStop(0, rgb(shade(pole, 0.08))); pg.addColorStop(1, rgb(shade(pole, -0.2)));
  c.fillStyle = pg; c.fillRect(x, top, 6, base - top);
  c.fillStyle = rgb(pole); c.fillRect(x - 10, top + 5, 26, 3);
  c.fillStyle = rgb(mix(hex("#E8E4DC"), e.near, 0.3 + e.night * 0.4));
  for (const ix of [x - 8, x + 12]) { ell(c, ix, top + 3.5, 1.6, 2); c.fill(); }
  // 足場ボルト
  c.fillStyle = rgb(shade(pole, -0.3));
  for (let k = 0; k < 5; k++) c.fillRect(k % 2 ? x + 6 : x - 2.5, top + 60 + k * 12, 2.5, 1.2);
  if (p.tr) {
    const tg = c.createLinearGradient(x + 6, 0, x + 16, 0);
    tg.addColorStop(0, rgb(shade(pole, 0.05))); tg.addColorStop(1, rgb(shade(pole, -0.25)));
    c.fillStyle = tg; rr(c, x + 6, top + 26, 10, 17, 3); c.fill();
    c.fillStyle = rgb(shade(pole, -0.3)); c.fillRect(x + 6, top + 30, 10, 1); c.fillRect(x + 6, top + 38, 10, 1);
  }
  // 電柱の住所札
  if (v.stage !== "summer" && h01(seed, 21) < 0.6) {
    c.fillStyle = rgb(mix(hex(h01(seed, 22) < 0.5 ? "#2F5E9A" : "#F4F1EA"), e.near, 0.25 + e.night * 0.4)); c.fillRect(x - 1, base - 58, 8, 20);
    c.fillStyle = rgb(mix(hex(h01(seed, 22) < 0.5 ? "#FFFFFF" : "#2A2440"), e.near, 0.2 + e.night * 0.4)); c.font = font(4.5); c.textAlign = "center"; c.textBaseline = "middle";
    (v.stage === "snow" ? ["雪", "町", "3"] : ["東", "町", "2"]).forEach((ch, k) => c.fillText(ch, x + 3, base - 54 + k * 5.5));
  }
  if (p.lamp && v.stage !== "summer") {
    c.strokeStyle = rgb(pole); c.lineWidth = 2;
    c.beginPath(); c.moveTo(x + 6, top + 52); c.quadraticCurveTo(x + 16, top + 44, x + 24, top + 48); c.stroke();
    c.fillStyle = rgb(shade(pole, -0.1)); rr(c, x + 18, top + 45, 13, 4, 2); c.fill();
    c.fillStyle = L > 0.05 ? `rgba(255,236,190,${0.45 + 0.55 * L})` : rgb(shade(pole, 0.25)); rr(c, x + 19, top + 48, 11, 3, 1.5); c.fill();
    lamps.push([x + 24.5, top + 51]);
  }
}

function drawGardenBehindWall(v: StageView, x0: number, x1: number, seed: number): void {
  const { c, e, g } = v, snowy = v.stage === "snow", n = e.night;
  const leaf = (h: string, k: number) => rgb(mix(hex(h), e.near, 0.45 + k + n * 0.35));
  const snow = rgb(mix([246, 249, 255], e.near, 0.1 + n * 0.45));
  for (let k = 0; k < 3; k++) {
    if (h01(seed + k, 31) < 0.3) continue;
    const x = x0 + 30 + (x1 - x0 - 60) * h01(seed + k, 32), sw = sway(v, seed + k, 1.2, 1);
    const tall = h01(seed + k, 33) < 0.35, r = tall ? 18 : 13, cy = g - 41 - (tall ? 30 : 8);
    if (tall) { c.fillStyle = leaf("#5A3E2A", 0); c.fillRect(x - 2, cy, 4, g - 41 - cy); }
    const special = !snowy && h01(seed + k, 34) < 0.25;
    c.fillStyle = leaf(special ? "#D890A8" : "#3E6E42", 0); ell(c, x + sw, cy, r, r * 0.85); c.fill();
    c.fillStyle = leaf(special ? "#F2B8CC" : "#5C9458", -0.05); ell(c, x + sw - r * 0.3, cy - r * 0.3, r * 0.55, r * 0.45); c.fill();
    if (!snowy && !special && h01(seed + k, 35) < 0.3) {
      // 柿の実
      c.fillStyle = rgb(mix(hex("#F08A2A"), e.near, 0.3 + n * 0.4));
      for (let q = 0; q < 4; q++) { ell(c, x + sw - 8 + q * 5, cy + 2 - (q % 2) * 4, 1.8, 1.8); c.fill(); }
    }
    if (snowy) { c.fillStyle = snow; ell(c, x + sw, cy - r * 0.55, r * 0.8, r * 0.35); c.fill(); }
  }
}

function drawBlockWall(v: StageView, off: number): void {
  const { c, e, g, vw } = v, snowy = v.stage === "snow", n = e.night;
  const wall = mix(e.near, hex(snowy ? "#C8CCD8" : "#D2CCBE"), 0.3 * (1 - n * 0.8));
  const wg = c.createLinearGradient(0, g - 38, 0, g - 6);
  wg.addColorStop(0, rgb(shade(wall, 0.1))); wg.addColorStop(1, rgb(shade(wall, -0.06)));
  c.fillStyle = wg; c.fillRect(0, g - 38, vw, 32);
  c.fillStyle = rgb(shade(wall, 0.22)); c.fillRect(0, g - 41, vw, 4);
  c.fillStyle = "rgba(0,0,0,0.1)"; c.fillRect(0, g - 37, vw, 2);
  c.strokeStyle = rgb(shade(wall, -0.14)); c.lineWidth = 0.8; c.beginPath();
  const bw = 24, s0 = -(off % bw);
  for (const y of [g - 30, g - 22, g - 14]) { c.moveTo(0, y); c.lineTo(vw, y); }
  for (let x = s0 - bw; x < vw + bw; x += bw) {
    c.moveTo(x, g - 37); c.lineTo(x, g - 30); c.moveTo(x + bw / 2, g - 30); c.lineTo(x + bw / 2, g - 22);
    c.moveTo(x, g - 22); c.lineTo(x, g - 14); c.moveTo(x + bw / 2, g - 14); c.lineTo(x + bw / 2, g - 6);
  }
  c.stroke();
  // 透かしブロック
  const pw = bw * 7, p0 = -(off % pw);
  for (let x = p0; x < vw + pw; x += pw) {
    c.fillStyle = rgb(shade(wall, -0.3), 0.8);
    for (const dx of [3, 15]) { ell(c, x + dx + 3, g - 26, 2.4, 2.4); c.fill(); ell(c, x + dx + 3, g - 26, 1, 2.8); c.fill(); }
  }
  // 雨だれのしみ
  c.fillStyle = "rgba(40,40,50,0.05)";
  const d0 = -(off % 53);
  for (let x = d0; x < vw + 53; x += 53) c.fillRect(x + 7, g - 37, 3, 12);
  if (snowy) {
    c.fillStyle = rgb(mix([246, 249, 255], e.near, e.night * 0.45));
    for (let x = -(off % 30) - 30; x < vw + 30; x += 30) { c.beginPath(); c.ellipse(x + 15, g - 42, 17, 5, 0, 0, Math.PI * 2); c.fill(); }
    // つらら
    c.fillStyle = rgb(mix(hex("#DCEBFA"), e.near, 0.1 + e.night * 0.4));
    for (let x = -(off % 11); x < vw + 11; x += 11) { const len = 2 + h01(Math.round((x + off) / 11), 41) * 6; c.beginPath(); c.moveTo(x, g - 39); c.lineTo(x + 1.2, g - 39 + len); c.lineTo(x + 2.4, g - 39); c.fill(); }
    // 塀ぎわの雪だまり
    c.fillStyle = rgb(mix([240, 245, 252], e.near, e.night * 0.45));
    for (let x = -(off % 40) - 40; x < vw + 40; x += 40) { ell(c, x + 20, g - 6, 24, 5); c.fill(); }
  }
}

function drawKohaku(v: StageView, off: number): void {
  const { c, e, g, vw } = v, n = e.night;
  const sw = 14, k0 = -(off % (sw * 2));
  for (let x = k0; x < vw + sw * 2; x += sw * 2) {
    for (const [dx, h] of [[0, "#E0413A"], [sw, "#F6F1EA"]] as const) {
      const col = mix(hex(h), e.near, 0.12 + n * 0.3);
      const fg = c.createLinearGradient(x + dx, 0, x + dx + sw, 0);
      fg.addColorStop(0, rgb(shade(col, 0.06))); fg.addColorStop(0.6, rgb(col)); fg.addColorStop(1, rgb(shade(col, -0.12)));
      c.fillStyle = fg; c.fillRect(x + dx, g - 38, sw, 32);
    }
  }
  c.fillStyle = rgb(mix(hex("#2A2440"), e.near, 0.3)); c.fillRect(0, g - 41, vw, 3);
  c.strokeStyle = rgb(mix(hex("#E8D8B0"), e.near, 0.3 + n * 0.3)); c.lineWidth = 1;
  const r0 = -(off % 28);
  c.beginPath(); for (let x = r0 - 28; x < vw + 28; x += 28) { c.moveTo(x, g - 39); c.quadraticCurveTo(x + 14, g - 35, x + 28, g - 39); } c.stroke();
}

function drawVending(v: StageView, vx: number, seed: number): void {
  const { c, e, g } = v, L = litOf(e);
  const brand = pick(["#D63A3A", "#2F6FD0", "#F4F4F4", "#2E9A6A"], seed, 51);
  const body = mix(hex(brand), e.near, 0.3 + e.night * 0.25);
  const bg = c.createLinearGradient(vx, 0, vx + 28, 0);
  bg.addColorStop(0, rgb(shade(body, 0.08))); bg.addColorStop(1, rgb(shade(body, -0.18)));
  c.fillStyle = bg; rr(c, vx, g - 56, 28, 50, 3); c.fill();
  const panel = L > 0.05 ? `rgba(225,242,255,${0.6 + 0.4 * L})` : "rgba(215,235,250,.85)";
  c.fillStyle = panel; c.fillRect(vx + 3, g - 52, 22, 21);
  const cans = ["#E4572E", "#FFC857", "#5CC8B5", "#7A8CFF", "#F28FB1", "#FFFFFF", "#8A5A3A", "#2E6FD0"];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
    const col = cans[(i + r * 3 + Math.floor(seed * 10)) % cans.length]!;
    c.fillStyle = col; rr(c, vx + 4.5 + i * 5.2, g - 50.5 + r * 6.8, 3.6, 5.2, 1); c.fill();
    c.fillStyle = "rgba(255,255,255,0.4)"; c.fillRect(vx + 4.8 + i * 5.2, g - 50 + r * 6.8, 0.8, 4);
  }
  c.fillStyle = rgb(shade(body, -0.3)); c.fillRect(vx + 3, g - 29, 22, 2);
  c.fillStyle = "#20242E"; c.fillRect(vx + 17, g - 25, 6, 5);
  c.fillStyle = "#6AF0A0"; c.fillRect(vx + 18, g - 24, 4, 1.6);
  c.fillStyle = rgb(shade(body, -0.4)); c.fillRect(vx + 5, g - 16, 18, 6);
  if (v.stage === "snow") { c.fillStyle = rgb(mix([246, 249, 255], e.near, e.night * 0.45)); rr(c, vx - 1, g - 60, 30, 5, 2.5); c.fill(); }
  if (L > 0.05) {
    glow(c, vx + 14, g - 40, 48, "200,230,255", 0.32 * L);
    c.fillStyle = `rgba(200,230,255,${0.14 * L})`; ell(c, vx + 14, g + 6, 30, 6); c.fill();
  }
}

function drawCurveMirror(v: StageView, x: number): void {
  const { c, e, g } = v, n = e.night;
  const orange = mix(hex("#F07A2A"), e.near, 0.2 + n * 0.4);
  c.fillStyle = rgb(orange); c.fillRect(x - 1.5, g - 82, 3, 76);
  c.fillStyle = rgb(shade(orange, -0.2)); c.fillRect(x + 0.5, g - 82, 1, 76);
  c.fillStyle = rgb(orange); ell(c, x, g - 92, 11, 11); c.fill();
  const mg = c.createLinearGradient(0, g - 101, 0, g - 83);
  mg.addColorStop(0, rgb(mix(e.top, e.near, 0.2))); mg.addColorStop(1, rgb(mix(e.bot, e.near, 0.3)));
  c.fillStyle = mg; ell(c, x, g - 92, 9, 9); c.fill();
  c.fillStyle = `rgba(255,255,255,${0.35 - n * 0.2})`; ell(c, x - 3, g - 95, 3, 2, -0.5); c.fill();
}

function drawPropNear(v: StageView, x: number, seed: number): void {
  const { c, e, g } = v, n = e.night;
  const t = h01(seed, 61);
  if (v.stage === "summer") {
    // のぼり旗
    const col = pick(["#D63A3A", "#2F6FD0", "#E88A1A", "#2E9A6A"], seed, 62), s = sway(v, seed, 1.6, 1.8);
    c.fillStyle = rgb(mix(hex("#8A6A4A"), e.near, 0.3 + n * 0.3)); c.fillRect(x, g - 96, 2, 90);
    c.fillStyle = rgb(mix(hex(col), e.near, 0.12 + n * 0.3));
    c.beginPath(); c.moveTo(x + 2, g - 92); c.lineTo(x + 16, g - 92); c.lineTo(x + 16 + s, g - 40); c.lineTo(x + 2 + s * 0.5, g - 40); c.closePath(); c.fill();
    c.fillStyle = rgb(mix(hex("#FFFFFF"), e.near, 0.15 + n * 0.3)); c.font = font(8); c.textAlign = "center"; c.textBaseline = "middle";
    ["夏", "ま", "つ", "り"].forEach((ch, k) => c.fillText(ch, x + 9 + s * (k / 6), g - 84 + k * 11));
    return;
  }
  if (t < 0.3) drawCurveMirror(v, x);
  else if (t < 0.5 && v.stage === "town") {
    // 郵便ポスト
    const red = mix(hex("#D8322A"), e.near, 0.18 + n * 0.4);
    c.fillStyle = rgb(red); rr(c, x - 6, g - 32, 12, 26, 5); c.fill();
    c.fillStyle = rgb(shade(red, -0.25)); c.fillRect(x + 2, g - 30, 4, 22);
    c.fillStyle = rgb(shade(red, -0.45)); c.fillRect(x - 4, g - 24, 8, 1.6);
    c.fillStyle = rgb(mix(hex("#FFFFFF"), e.near, 0.3 + n * 0.3)); c.font = font(4); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("〒", x, g - 17);
  } else if (t < 0.7) {
    // 植木鉢
    for (let k = 0; k < 3; k++) {
      const px = x + k * 11;
      c.fillStyle = rgb(mix(hex("#B8663A"), e.near, 0.2 + n * 0.4)); c.beginPath(); c.moveTo(px - 4, g - 14); c.lineTo(px + 4, g - 14); c.lineTo(px + 3, g - 6); c.lineTo(px - 3, g - 6); c.closePath(); c.fill();
      c.fillStyle = rgb(mix(hex(v.stage === "snow" ? "#F0F4FA" : "#4E8A48"), e.near, 0.3 + n * 0.35)); ell(c, px, g - 17, 6, 5); c.fill();
      if (v.stage !== "snow") { c.fillStyle = rgb(mix(hex(pick(["#F26D8F", "#FFD166", "#FFFFFF"], seed + k, 63)), e.near, 0.2 + n * 0.4)); ell(c, px + 1, g - 19, 1.8, 1.8); c.fill(); }
    }
  } else if (v.stage === "town") {
    // 止めてある自転車
    const fr = mix(hex(pick(["#3A6FB0", "#C23B3B", "#E8E8E8"], seed, 64)), e.near, 0.2 + n * 0.4);
    c.strokeStyle = rgb(mix(hex("#2A2A30"), e.near, 0.2)); c.lineWidth = 1.4;
    for (const wx of [x, x + 22]) { c.beginPath(); c.arc(wx, g - 12, 6.5, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = rgb(fr); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, g - 12); c.lineTo(x + 8, g - 22); c.lineTo(x + 18, g - 22); c.lineTo(x + 22, g - 12); c.moveTo(x + 8, g - 22); c.lineTo(x + 11, g - 12); c.lineTo(x + 18, g - 22); c.stroke();
    c.fillStyle = rgb(fr); c.fillRect(x + 5, g - 25, 6, 2); c.fillRect(x + 18, g - 27, 2, 5);
    c.fillStyle = rgb(mix(hex("#8A8A90"), e.near, 0.3)); rr(c, x + 18, g - 30, 8, 4, 1); c.fill();
  } else {
    // 雪かき用のスコップと雪山
    c.fillStyle = rgb(mix([244, 248, 255], e.near, 0.05 + n * 0.45)); ell(c, x + 10, g - 8, 16, 8); c.fill();
    c.fillStyle = rgb(mix(hex("#8A6A4A"), e.near, 0.3)); c.save(); c.translate(x + 14, g - 12); c.rotate(-0.4); c.fillRect(-1, -24, 2, 24); c.restore();
    c.fillStyle = rgb(mix(hex("#E0413A"), e.near, 0.2 + n * 0.4)); c.save(); c.translate(x + 14, g - 12); c.rotate(-0.4); rr(c, -5, -2, 10, 8, 2); c.fill(); c.restore();
  }
}

function drawLanternString(v: StageView, items: readonly NearItem[], off: number, top: number): void {
  const { c, e } = v, L = litOf(e);
  for (let i = 0; i < items.length - 1; i++) {
    const ax = items[i]!.x - off + 3, bx = items[i + 1]!.x - off + 3;
    if (bx < -20 || ax > v.vw + 20) continue;
    const y0 = top + 40, sag = 26;
    c.strokeStyle = rgb(e.near); c.lineWidth = 1;
    c.beginPath(); c.moveTo(ax, y0); c.quadraticCurveTo((ax + bx) / 2, y0 + sag * 2, bx, y0); c.stroke();
    for (let k = 1; k < 7; k++) {
      const t = k / 7;
      const lx = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * ((ax + bx) / 2) + t * t * bx + sway(v, i * 7 + k, 0.8, 1.6);
      const ly = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
      if (L > 0.05) glow(c, lx, ly + 7, 18, k % 2 ? "255,90,60" : "255,220,160", 0.45 * L);
      const col = k % 2 ? "#E23B3B" : "#F6E7C8";
      c.fillStyle = L > 0.05 ? col : rgb(mix(hex(col), e.near, 0.25)); ell(c, lx, ly + 7, 4.6, 6); c.fill();
      c.strokeStyle = "rgba(0,0,0,0.18)"; c.lineWidth = 0.5; c.beginPath(); c.ellipse(lx, ly + 7, 2.4, 6, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = "#2A2440"; c.fillRect(lx - 3, ly, 6, 1.6); c.fillRect(lx - 3, ly + 12.4, 6, 1.6);
    }
  }
}

/** 山道の近景：丸太の柵・道しるべ・草花・岩 */
function drawHikingNear(v: StageView, items: readonly NearItem[], off: number, dist: number): void {
  const { c, e, g, vw } = v, n = e.night;
  const wood = mix(hex("#8A6242"), e.near, 0.35 + n * 0.35), woodL = shade(wood, 0.15), woodD = shade(wood, -0.25);
  // 草むら（柵のうしろ）
  const pw = 46, s0 = -(off % pw);
  for (let x = s0 - pw; x < vw + pw; x += pw) {
    const i = Math.round((x + off) / pw);
    c.fillStyle = rgb(mix(hex("#4E7A48"), e.near, 0.4 + n * 0.3)); ell(c, x + 20, g - 30, 22 + h01(i, 71) * 8, 9); c.fill();
    c.fillStyle = rgb(mix(hex("#6A9A58"), e.near, 0.4 + n * 0.3)); ell(c, x + 16, g - 34, 10, 4); c.fill();
  }
  // 丸太の横木
  for (const y of [g - 32, g - 18]) {
    const lg = c.createLinearGradient(0, y - 2.5, 0, y + 2.5);
    lg.addColorStop(0, rgb(woodL)); lg.addColorStop(1, rgb(woodD));
    c.fillStyle = lg; c.fillRect(0, y - 2.5, vw, 5);
  }
  // 杭
  for (let x = s0; x < vw + pw; x += pw) {
    const pg = c.createLinearGradient(x, 0, x + 6, 0);
    pg.addColorStop(0, rgb(woodL)); pg.addColorStop(1, rgb(woodD));
    c.fillStyle = pg; rr(c, x, g - 40, 6, 36, 2); c.fill();
    c.fillStyle = rgb(shade(wood, 0.3)); ell(c, x + 3, g - 40, 3, 1.4); c.fill();
  }
  // 足もとの草花と岩
  const fw = 23, f0 = -(off % fw);
  for (let x = f0 - fw; x < vw + fw; x += fw) {
    const i = Math.round((x + off) / fw), sw = sway(v, i, 1.4, 1.6);
    c.strokeStyle = rgb(mix(hex("#5E8F48"), e.near, 0.35 + n * 0.3)); c.lineWidth = 1;
    for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + k * 3, g - 6); c.quadraticCurveTo(x + k * 3 + sw * 0.4, g - 11, x + k * 3 + sw, g - 15 - (k % 2) * 3); c.stroke(); }
    if (h01(i, 72) < 0.4) { c.fillStyle = rgb(mix(hex(pick(["#F2E26A", "#FFFFFF", "#C8A0F0", "#F08AA8"], i, 73)), e.near, 0.2 + n * 0.45)); ell(c, x + 6 + sw, g - 16, 2, 2); c.fill(); }
    if (h01(i, 74) < 0.12) { c.fillStyle = rgb(mix(hex("#8E9088"), e.near, 0.3 + n * 0.35)); ell(c, x + 14, g - 8, 7, 4); c.fill(); c.fillStyle = rgb(mix(hex("#A8AAA2"), e.near, 0.3 + n * 0.35)); ell(c, x + 12, g - 10, 3.5, 1.5); c.fill(); }
  }
  // 道しるべ
  for (const p of items) {
    if (!p.vend) continue;
    const x = p.x - off + 60;
    if (x > vw + 50 || x < -60) continue;
    c.fillStyle = rgb(woodD); c.fillRect(x + 18, g - 76, 5, 70);
    const board = mix(hex("#D8B07A"), e.near, 0.25 + n * 0.4);
    c.fillStyle = rgb(board);
    c.beginPath(); c.moveTo(x, g - 74); c.lineTo(x + 40, g - 74); c.lineTo(x + 47, g - 67); c.lineTo(x + 40, g - 60); c.lineTo(x, g - 60); c.closePath(); c.fill();
    c.fillStyle = rgb(shade(board, -0.15)); c.fillRect(x, g - 62, 40, 2);
    c.strokeStyle = rgb(shade(board, -0.1)); c.lineWidth = 0.5; c.beginPath(); c.moveTo(x + 2, g - 70); c.lineTo(x + 36, g - 70); c.stroke();
    const kind = Math.floor(p.x / 7) % 3, left = Math.max(0.1, 3 - (dist / 50 / 1000) * 3).toFixed(1);
    c.fillStyle = "#4A2E1A"; c.font = font(8); c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(kind === 0 ? `山頂 ${left}km` : kind === 1 ? "水場 →" : "展望台 →", x + 21, g - 67);
  }
}

/** 近景を描く。街灯の位置を lamps に足す（夜の光の筋に使う） */
export function drawStageNear(v: StageView, items: readonly NearItem[], off: number, lamps: [number, number][], dist: number): void {
  const { c, e, g } = v;
  if (v.stage === "hiking") { drawHikingNear(v, items, off, dist); return; }
  const base = g - 6, top = Math.max(18, g - 168);
  // 電線
  c.strokeStyle = rgb(e.near, 0.95); c.lineWidth = 1.1;
  for (let i = 0; i < items.length - 1; i++) {
    const ax = items[i]!.x - off + 3, bx = items[i + 1]!.x - off + 3;
    if (bx < -20 || ax > v.vw + 20) continue;
    for (let k = 0; k < 3; k++) {
      const y = top + 7 + k * 6;
      c.beginPath(); c.moveTo(ax, y); c.quadraticCurveTo((ax + bx) / 2, y + 20 + k * 3, bx, y); c.stroke();
    }
  }
  // 塀のうしろの庭木
  if (v.stage !== "summer") {
    for (let i = 0; i < items.length - 1; i++) {
      const ax = items[i]!.x - off, bx = items[i + 1]!.x - off;
      if (bx < -60 || ax > v.vw + 60) continue;
      drawGardenBehindWall(v, ax, bx, items[i]!.x * 0.013);
    }
  }
  for (const p of items) {
    const x = p.x - off;
    if (x > v.vw + 60 || x < -60) continue;
    drawPole(v, x, top, base, p, lamps);
  }
  if (v.stage === "summer") drawLanternString(v, items, off, top);
  if (v.stage === "summer") drawKohaku(v, off); else drawBlockWall(v, off);
  for (const p of items) {
    const seed = p.x * 0.013;
    if (p.vend) {
      const vx = p.x - off + 80;
      if (vx < v.vw + 40 && vx > -40) drawVending(v, vx, seed);
    }
    const px = p.x - off + (p.vend ? 150 : 110) + h01(seed, 81) * 40;
    if (px < v.vw + 40 && px > -40 && h01(seed, 82) < 0.7) drawPropNear(v, px, seed);
  }
}

/* ============================================================= */
/*  足もと：歩道・縁石・車道                                        */
/* ============================================================= */
/** 歩道と車道を描く。cam は道の流れ、lamps は近景の街灯（夜の光の筋） */
export function drawStageGround(v: StageView, cam: number, lamps: readonly [number, number][]): void {
  const { c, e, g, vw, vh, stage } = v, n = e.night;
  const side = e.side, road = e.road;
  // 歩道
  const sg = c.createLinearGradient(0, g - 6, 0, g + 19);
  sg.addColorStop(0, rgb(shade(side, -0.1))); sg.addColorStop(0.35, rgb(side)); sg.addColorStop(1, rgb(shade(side, 0.05)));
  c.fillStyle = sg; c.fillRect(0, g - 6, vw, 25);
  if (stage === "town") {
    // インターロッキングの敷石
    const tw = 14, rows = [g - 5, g + 1, g + 7, g + 13];
    rows.forEach((y, r) => {
      const o = r % 2 ? tw / 2 : 0, t0 = -((cam + o) % tw) - tw;
      for (let x = t0; x < vw + tw; x += tw) {
        const i = Math.round((x + cam + o) / tw) + r * 1000;
        c.fillStyle = rgb(shade(side, (h01(i, 91) - 0.5) * 0.12)); c.fillRect(x + 0.6, y, tw - 1.2, 5.4);
      }
    });
    c.fillStyle = rgb(shade(side, -0.18), 0.5); for (const y of rows) c.fillRect(0, y - 0.6, vw, 0.6);
  } else if (stage === "summer") {
    // 参道の石畳
    const tw = 26, t0 = -(cam % tw) - tw;
    for (let x = t0; x < vw + tw; x += tw) {
      const i = Math.round((x + cam) / tw);
      c.fillStyle = rgb(shade(side, (h01(i, 92) - 0.5) * 0.14)); rr(c, x + 1, g - 4, tw - 2, 10, 2); c.fill();
      c.fillStyle = rgb(shade(side, (h01(i, 93) - 0.5) * 0.14)); rr(c, x + 1 + tw / 2, g + 7, tw - 2, 10, 2); c.fill();
    }
  } else if (stage === "snow") {
    // 踏み固めた雪と足あと
    const fw = 19, f0 = -(cam % fw) - fw;
    for (let x = f0; x < vw + fw; x += fw) {
      const i = Math.round((x + cam) / fw);
      c.fillStyle = rgb(shade(side, -0.08), 0.8); ell(c, x, g + 1 + (i % 2) * 5, 2.6, 1.4, 0.2); c.fill();
      if (!v.calm && h01(i, 94) < 0.3 && Math.sin(v.t * 3 + i) > 0.7) { c.fillStyle = `rgba(255,255,255,${0.8 - n * 0.4})`; c.fillRect(x + 6, g + 10, 1.4, 1.4); }
    }
    c.fillStyle = rgb(mix([255, 255, 255], side, 0.3 + n * 0.3)); c.fillRect(0, g - 6, vw, 2);
  } else {
    // 山道：土と小石と木の根
    const pw = 15, p0 = -(cam % pw) - pw;
    for (let x = p0; x < vw + pw; x += pw) {
      const i = Math.round((x + cam) / pw);
      c.fillStyle = rgb(shade(side, h01(i, 95) < 0.5 ? -0.18 : 0.12)); ell(c, x, g + 1 + h01(i, 96) * 14, 1.8 + h01(i, 97) * 2, 1.2 + h01(i, 98)); c.fill();
    }
    const rw = 170, r0 = -(cam % rw) - rw;
    c.strokeStyle = rgb(shade(side, -0.3)); c.lineWidth = 2;
    for (let x = r0; x < vw + rw; x += rw) { c.beginPath(); c.moveTo(x, g - 5); c.quadraticCurveTo(x + 16, g + 5, x + 38, g + 2); c.stroke(); }
  }
  if (stage !== "hiking") {
    c.strokeStyle = rgb(shade(side, -0.05)); c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, g + 6); c.lineTo(vw, g + 6); c.stroke();
  }
  // 縁石（つなぎ目つき）
  const curb = shade(side, 0.25);
  c.fillStyle = rgb(curb); c.fillRect(0, g + 19, vw, 5);
  c.fillStyle = rgb(shade(side, -0.2)); c.fillRect(0, g + 23, vw, 1.5);
  if (stage !== "hiking") {
    c.fillStyle = rgb(shade(curb, -0.15));
    const cw = 30, c0 = -(cam % cw);
    for (let x = c0; x < vw + cw; x += cw) c.fillRect(x, g + 19, 1, 5);
  }
  // 車道
  const rg = c.createLinearGradient(0, g + 24, 0, vh);
  rg.addColorStop(0, rgb(shade(road, 0.05))); rg.addColorStop(1, rgb(shade(road, -0.18)));
  c.fillStyle = rg; c.fillRect(0, g + 24, vw, vh - g - 24);
  const ly = g + 24 + (vh - g - 24) * 0.5;
  if (stage === "hiking") {
    // 草地：草の葉と小さな花
    const gw = 13, g0 = -(cam % gw) - gw;
    for (let x = g0; x < vw + gw; x += gw) {
      const i = Math.round((x + cam) / gw);
      const y = g + 30 + h01(i, 101) * (vh - g - 40);
      c.strokeStyle = rgb(shade(road, h01(i, 102) < 0.5 ? -0.18 : 0.12)); c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 1.5, y - 5); c.moveTo(x + 2, y); c.lineTo(x + 2.5, y - 6); c.moveTo(x + 4, y); c.lineTo(x + 6, y - 4); c.stroke();
      if (h01(i, 103) < 0.12) { c.fillStyle = rgb(mix(hex(pick(["#FFFFFF", "#F2E26A", "#F08AA8"], i, 104)), road, 0.25 + n * 0.5)); ell(c, x + 2, y - 7, 1.8, 1.8); c.fill(); }
    }
  } else {
    // アスファルトの粒と補修あと
    const aw = 11, a0 = -(cam % aw) - aw;
    for (let x = a0; x < vw + aw; x += aw) {
      const i = Math.round((x + cam) / aw);
      c.fillStyle = rgb(shade(road, h01(i, 105) < 0.5 ? -0.12 : 0.1), 0.8);
      c.fillRect(x, g + 28 + h01(i, 106) * (vh - g - 32), 1.3, 1.3);
    }
    const pw = 420, p0 = -(cam % pw) - pw;
    for (let x = p0; x < vw + pw; x += pw) {
      const i = Math.round((x + cam) / pw);
      c.fillStyle = rgb(shade(road, -0.06)); rr(c, x + 60, g + 34 + h01(i, 107) * 10, 44, 10, 2); c.fill();
      // マンホール
      const mx = x + 250, my = g + 24 + (vh - g - 24) * 0.72;
      c.fillStyle = rgb(shade(road, -0.14)); ell(c, mx, my, 14, 4); c.fill();
      c.strokeStyle = rgb(shade(road, 0.08)); c.lineWidth = 0.6; ell(c, mx, my, 10, 2.8); c.stroke(); ell(c, mx, my, 5, 1.4); c.stroke();
    }
    if (stage === "town" || stage === "summer") { c.fillStyle = rgb(mix(road, [255, 255, 255], 0.35)); c.fillRect(0, g + 30, vw, 1.6); }
    if (stage === "town") {
      c.fillStyle = rgb(mix(road, [255, 255, 255], 0.26));
      const dw = 96, d0 = -(cam % dw);
      for (let x = d0; x < vw + dw; x += dw) c.fillRect(x, ly - 1.5, 44, 3);
    } else if (stage === "snow") {
      // わだち
      c.fillStyle = rgb(shade(road, -0.12)); c.fillRect(0, ly - 8, vw, 4); c.fillRect(0, ly + 6, vw, 4);
      c.fillStyle = rgb(mix([255, 255, 255], road, 0.3 + n * 0.3));
      const sw = 29, s0 = -(cam % sw);
      for (let x = s0; x < vw + sw; x += sw) { ell(c, x + 10, ly - 1, 10, 2); c.fill(); }
    } else if (stage === "summer") {
      c.fillStyle = rgb(mix(road, hex("#FFD166"), 0.35));
      const dw = 96, d0 = -(cam % dw);
      for (let x = d0; x < vw + dw; x += dw) c.fillRect(x, ly - 1.5, 44, 3);
    }
  }
  // 夜の街灯の光
  if (n > 0.1) {
    c.save(); c.globalCompositeOperation = "lighter";
    for (const [lx, ly2] of lamps) {
      const lg = c.createLinearGradient(0, ly2, 0, g + 10);
      lg.addColorStop(0, `rgba(255,220,150,${0.16 * n})`); lg.addColorStop(1, `rgba(255,220,150,${0.03 * n})`);
      c.fillStyle = lg;
      c.beginPath(); c.moveTo(lx - 5, ly2); c.lineTo(lx + 5, ly2); c.lineTo(lx + 46, g + 12); c.lineTo(lx - 46, g + 12); c.closePath(); c.fill();
      glow(c, lx, ly2, 20, "255,230,170", 0.5 * n);
      c.fillStyle = `rgba(255,220,150,${0.16 * n})`; ell(c, lx, g + 7, 50, 9); c.fill();
    }
    c.restore();
  }
}

/* ============================================================= */
/*  空のおまけ：鳥の群れ（昼）と流れ星（夜）                          */
/* ============================================================= */
export function drawSkyLife(v: StageView): void {
  const { c, e, g, vw } = v;
  if (v.calm) return;
  const cyc = 38, ph = (v.t % cyc) / cyc, round = Math.floor(v.t / cyc);
  if (e.night < 0.4 && ph < 0.45) {
    // 右から左へ渡っていく鳥の群れ
    const p = ph / 0.45, bx = vw + 40 - p * (vw + 120), by = g * (0.22 + h01(round, 111) * 0.2);
    c.strokeStyle = rgb(mix(hex("#3A3550"), e.bot, 0.35)); c.lineWidth = 1.1;
    for (let k = 0; k < 5; k++) {
      const x = bx + k * 13 + (k % 2) * 4, y = by + Math.abs(k - 2) * 5, f = Math.sin(v.t * 9 + k) * 2.2;
      c.beginPath(); c.moveTo(x - 4, y - f); c.quadraticCurveTo(x - 2, y - 1, x, y); c.quadraticCurveTo(x + 2, y - 1, x + 4, y - f); c.stroke();
    }
  } else if (e.night > 0.6 && ph > 0.8 && ph < 0.86) {
    // 流れ星
    const p = (ph - 0.8) / 0.06, sx = vw * (0.3 + h01(round, 112) * 0.6) - p * 90, sy = g * (0.08 + h01(round, 113) * 0.2) + p * 40;
    const lg = c.createLinearGradient(sx, sy, sx + 40, sy - 18);
    lg.addColorStop(0, `rgba(255,255,240,${0.9 * (1 - p)})`); lg.addColorStop(1, "rgba(255,255,240,0)");
    c.strokeStyle = lg; c.lineWidth = 1.4; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 40, sy - 18); c.stroke();
  }
}
