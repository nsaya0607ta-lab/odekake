/**
 * ローカル線：山と田んぼのあいだを、わんこたちを乗せた小さな電車がことこと走る。
 * 景色（山・田んぼ・線路・電柱）は大きさが変わったときに1回だけ描いておき、毎回は雲・鳥・電車だけを描く。
 * 画面をタップすると、電車がすぐに来る（走っているときは、窓のわんこがぴょんと跳ねる）。
 */
import { addCanvas, clamp, context2d, onBackgroundTap, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Train = { x: number; speed: number; jump: number; dogs: number[] };
type Bird = { x: number; y: number; v: number; flap: number };

const DOG_COLORS = ["#f4efe6", "#3b3632", "#d9b48a", "#f4efe6", "#8c8079", "#e8d3b8"];

/** 地平線のなめらかなでこぼこ */
function ridge(rand: () => number, w: number, base: number, amp: number, step: number): [number, number][] {
  const pts: [number, number][] = [];
  const a = rand() * 6, b = rand() * 6;
  for (let x = -step; x <= w + step; x += step) {
    pts.push([x, base - amp * (0.55 + 0.3 * Math.sin(x * 0.011 + a) + 0.15 * Math.sin(x * 0.031 + b))]);
  }
  return pts;
}

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 4 : Date.now() & 0xffff);
  let scale = 1;
  let trackY = 0;
  let train: Train | null = null;
  let wait = 2;
  let clouds: { x: number; y: number; s: number; v: number }[] = [];
  let birds: Bird[] = [];
  let birdWait = 4;
  let clock = 0;
  // 景色は、大きさが変わったら次に描くときに描きなおす（ここではキャンバスがまだ受けとれないため）
  let sceneDirty = true;

  const scene = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.75, 1.35);
      trackY = size.h - Math.max(104, size.h * 0.13);
      clouds = Array.from({ length: 4 }, (_, i) => ({ x: rand() * size.w, y: size.h * (0.08 + i * 0.12), s: (0.7 + rand() * 0.6) * scale, v: (4 + rand() * 4) * scale }));
      sceneDirty = true;
    },
  });
  const layer = addCanvas(host);
  const ctx = context2d(layer.canvas, layer.size);

  function paintScene(size: CanvasSize) {
    const g = context2d(scene.canvas, size);
    if (!g) return;
    const r = seededRandom(17);
    const { w, h } = size;
    g.clearRect(0, 0, w, h);
    const fillRidge = (pts: [number, number][], bottom: number, color: string | CanvasGradient) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(pts[0]![0], bottom);
      for (const [x, y] of pts) g.lineTo(x, y);
      g.lineTo(pts[pts.length - 1]![0], bottom);
      g.closePath();
      g.fill();
    };
    const horizon = trackY - 120 * scale;
    // 遠い山・近い山
    fillRidge(ridge(r, w, horizon - 30 * scale, 120 * scale, 12), trackY, "rgba(150,182,200,0.55)");
    fillRidge(ridge(r, w, horizon + 4 * scale, 70 * scale, 10), trackY, "rgba(126,170,128,0.75)");
    // 林（まるい木の列）
    for (let x = -10; x < w + 20; x += 13 * scale) {
      const y = horizon + 18 * scale + Math.sin(x * 0.05) * 4 * scale;
      g.fillStyle = r() < 0.5 ? "#6f9f68" : "#7fae72";
      g.beginPath(); g.arc(x, y, (9 + r() * 6) * scale, 0, Math.PI * 2); g.fill();
    }
    // 田んぼ
    const paddyTop = horizon + 22 * scale;
    const paddy = g.createLinearGradient(0, paddyTop, 0, trackY);
    paddy.addColorStop(0, "#c7df98");
    paddy.addColorStop(1, "#b4d47f");
    g.fillStyle = paddy;
    g.fillRect(0, paddyTop, w, trackY - paddyTop);
    // あぜ道（手前ほど間をあける）
    g.strokeStyle = "rgba(150,170,90,0.55)";
    g.lineWidth = 1;
    for (let i = 0, y = paddyTop + 6; y < trackY - 4; i++, y += 5 + i * 2.2) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    for (let x = 30 * scale; x < w; x += 90 * scale) {
      g.beginPath(); g.moveTo(x, paddyTop); g.lineTo(x + (x - w / 2) * 0.35, trackY); g.stroke();
    }
    // 小さな家
    const hx = w * 0.18, hy = paddyTop + 4 * scale, hs = scale;
    g.fillStyle = "#f6efe2"; g.fillRect(hx, hy - 16 * hs, 26 * hs, 16 * hs);
    g.fillStyle = "#c9655a";
    g.beginPath(); g.moveTo(hx - 4 * hs, hy - 15 * hs); g.lineTo(hx + 13 * hs, hy - 27 * hs); g.lineTo(hx + 30 * hs, hy - 15 * hs); g.closePath(); g.fill();
    g.fillStyle = "#7d6a55"; g.fillRect(hx + 10 * hs, hy - 9 * hs, 6 * hs, 9 * hs);
    // 土手
    const bank = g.createLinearGradient(0, trackY - 6 * scale, 0, h);
    bank.addColorStop(0, "#9fbf72");
    bank.addColorStop(0.25, "#8fae66");
    bank.addColorStop(1, "#7d9a5c");
    g.fillStyle = bank;
    g.fillRect(0, trackY + 2 * scale, w, h - trackY);
    // 線路（まくら木・2本のレール）
    g.fillStyle = "#b8a68a";
    g.fillRect(0, trackY + 3 * scale, w, 6 * scale);
    g.fillStyle = "#7a6650";
    for (let x = 0; x < w; x += 9 * scale) g.fillRect(x, trackY + 4 * scale, 4 * scale, 5 * scale);
    g.fillStyle = "#6c6f78";
    g.fillRect(0, trackY + 2 * scale, w, 1.6 * scale);
    g.fillRect(0, trackY + 6 * scale, w, 1.6 * scale);
    // 電柱と電線
    const poles: number[] = [];
    for (let x = 40 * scale; x < w + 140 * scale; x += 150 * scale) poles.push(x);
    g.strokeStyle = "#8a7e70";
    g.lineWidth = 2.2 * scale;
    for (const x of poles) {
      g.beginPath(); g.moveTo(x, trackY - 4 * scale); g.lineTo(x, trackY - 84 * scale); g.stroke();
      g.beginPath(); g.moveTo(x - 8 * scale, trackY - 78 * scale); g.lineTo(x + 8 * scale, trackY - 78 * scale); g.stroke();
    }
    g.strokeStyle = "rgba(90,80,70,0.45)";
    g.lineWidth = 0.8;
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i]!, b = poles[i + 1]!;
      for (const dx of [-7, 7]) {
        g.beginPath();
        g.moveTo(a + dx * scale, trackY - 78 * scale);
        g.quadraticCurveTo((a + b) / 2, trackY - 66 * scale, b + dx * scale, trackY - 78 * scale);
        g.stroke();
      }
    }
    // 手前の草
    g.strokeStyle = "rgba(90,130,70,0.55)";
    g.lineWidth = 1.2;
    for (let x = 0; x < w; x += 5) {
      const y = trackY + 14 * scale + r() * (h - trackY - 14 * scale);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - (4 + r() * 6) * scale); g.stroke();
    }
  }

  const newTrain = (): Train => ({ x: -280 * scale, speed: (58 + rand() * 18) * scale, jump: 0, dogs: Array.from({ length: 6 }, () => Math.floor(rand() * DOG_COLORS.length)) });

  const drawDog = (x: number, y: number, s: number, color: string, hop: number) => {
    if (!ctx) return;
    ctx.save();
    ctx.translate(x, y - hop);
    ctx.fillStyle = color;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 3 * s, -6 * s);
      ctx.lineTo(side * 7.5 * s, -12 * s);
      ctx.lineTo(side * 8 * s, -3 * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(0, 0, 7 * s, 6.4 * s, 0, 0, Math.PI * 2); ctx.fill();
    const darkFur = color === "#3b3632" || color === "#8c8079";
    ctx.fillStyle = darkFur ? "#f2ece4" : "#3b3632";
    ctx.beginPath(); ctx.arc(-2.6 * s, -0.8 * s, 1 * s, 0, Math.PI * 2); ctx.arc(2.6 * s, -0.8 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 1.8 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const drawTrain = (tr: Train) => {
    if (!ctx) return;
    const s = scale;
    const carW = 118 * s, carH = 40 * s, gap = 6 * s;
    // レールのつなぎ目で、ことこと小さくゆれる
    const bump = Math.abs(Math.sin(clock * 9)) < 0.12 ? -0.8 * s : 0;
    const base = trackY - 2 * s + bump;
    for (let c = 0; c < 2; c++) {
      const x = tr.x - c * (carW + gap);
      const top = base - carH - 6 * s;
      // かげ
      ctx.fillStyle = "rgba(40,50,30,0.18)";
      ctx.fillRect(x + 4 * s, trackY + 3 * s, carW - 8 * s, 4 * s);
      // 車体
      ctx.fillStyle = "#f7f1e3";
      ctx.beginPath();
      ctx.roundRect(x, top, carW, carH, [10 * s, c === 0 ? 16 * s : 10 * s, 4 * s, 4 * s]);
      ctx.fill();
      // 屋根
      ctx.fillStyle = "#b7b3ab";
      ctx.beginPath(); ctx.roundRect(x + 6 * s, top - 4 * s, carW - 12 * s, 6 * s, 3 * s); ctx.fill();
      // 帯
      ctx.fillStyle = "#4f9a6a";
      ctx.fillRect(x, top + carH - 13 * s, carW, 5 * s);
      ctx.fillStyle = "#e6b84e";
      ctx.fillRect(x, top + carH - 8 * s, carW, 2 * s);
      // 窓とわんこ
      for (let i = 0; i < 3; i++) {
        const wx = x + 10 * s + i * 34 * s;
        const wy = top + 7 * s;
        ctx.fillStyle = "#cfe6f2";
        ctx.beginPath(); ctx.roundRect(wx, wy, 26 * s, 16 * s, 3 * s); ctx.fill();
        ctx.save();
        ctx.beginPath(); ctx.roundRect(wx, wy, 26 * s, 16 * s, 3 * s); ctx.clip();
        const dog = tr.dogs[c * 3 + i]!;
        const hop = tr.jump > 0 ? Math.sin(Math.min(1, tr.jump) * Math.PI) * 6 * s * (1 + ((i + c) % 2) * 0.4) : Math.max(0, Math.sin(clock * 2 + i + c * 3)) * 1.2 * s;
        drawDog(wx + 13 * s, wy + 14 * s, s, DOG_COLORS[dog]!, hop);
        ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillRect(wx + 2 * s, wy + 2 * s, 5 * s, 2 * s);
      }
      // 車輪
      ctx.fillStyle = "#4b4a50";
      for (const wx of [x + 20 * s, x + 34 * s, x + carW - 34 * s, x + carW - 20 * s]) {
        ctx.beginPath(); ctx.arc(wx, base - 1 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#9a99a0";
        ctx.lineWidth = 1;
        const a = (tr.x / (5 * s)) % (Math.PI * 2);
        ctx.beginPath(); ctx.moveTo(wx, base - 1 * s); ctx.lineTo(wx + Math.cos(a) * 4 * s, base - 1 * s + Math.sin(a) * 4 * s); ctx.stroke();
      }
      if (c === 0) {
        // 前の窓・ライト・パンタグラフ
        ctx.fillStyle = "#cfe6f2";
        ctx.beginPath(); ctx.roundRect(x + carW - 14 * s, top + 7 * s, 9 * s, 14 * s, [2 * s, 6 * s, 2 * s, 2 * s]); ctx.fill();
        const glow = ctx.createRadialGradient(x + carW + 2 * s, top + carH - 17 * s, 0, x + carW + 2 * s, top + carH - 17 * s, 26 * s);
        glow.addColorStop(0, "rgba(255,240,180,0.7)");
        glow.addColorStop(1, "rgba(255,240,180,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x + carW + 2 * s, top + carH - 17 * s, 26 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff4c4";
        ctx.beginPath(); ctx.arc(x + carW - 4 * s, top + carH - 17 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#6c6f78";
        ctx.lineWidth = 1.4 * s;
        const px = x + carW * 0.55;
        ctx.beginPath();
        ctx.moveTo(px - 10 * s, top - 4 * s); ctx.lineTo(px, top - 16 * s); ctx.lineTo(px + 10 * s, top - 4 * s);
        ctx.moveTo(px - 8 * s, top - 16 * s); ctx.lineTo(px + 8 * s, top - 16 * s);
        ctx.stroke();
      }
    }
    // 連結
    ctx.fillStyle = "#6c6f78";
    ctx.fillRect(tr.x - gap - 1, base - 16 * s, gap + 2, 4 * s);
  };

  const step = (size: CanvasSize, dt: number) => {
    clock += dt;
    for (const c of clouds) { c.x += c.v * dt; if (c.x > size.w + 20) c.x = -120 * c.s; }
    if (train) {
      train.x += train.speed * dt;
      if (train.jump > 0) train.jump += dt * 1.6;
      if (train.jump > 1) train.jump = 0;
      if (train.x - 248 * scale > size.w) { train = null; wait = 9 + rand() * 8; }
    } else {
      wait -= dt;
      if (wait <= 0) train = newTrain();
    }
    birdWait -= dt;
    if (birdWait <= 0) {
      const y = size.h * (0.12 + rand() * 0.25);
      const n = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) birds.push({ x: -20 - i * 16 * scale, y: y + (i % 2) * 10 * scale, v: (34 + rand() * 6) * scale, flap: rand() * 6 });
      birdWait = 12 + rand() * 14;
    }
    for (const b of birds) { b.x += b.v * dt; b.flap += dt * 7; }
    birds = birds.filter((b) => b.x < size.w + 30);
  };

  const draw = (size: CanvasSize) => {
    if (!ctx) return;
    if (sceneDirty) {
      sceneDirty = false;
      paintScene(scene.size);
    }
    // 大きさが変わるとキャンバスの倍率が戻るので、毎回そろえる
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const c of clouds) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 20 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 24 * c.s, c.y - 9 * c.s, 26 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 52 * c.s, c.y, 20 * c.s, 0, Math.PI * 2);
      ctx.rect(c.x, c.y, 52 * c.s, 16 * c.s);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(70,70,80,0.6)";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (const b of birds) {
      const f = Math.sin(b.flap) * 3 * scale;
      ctx.beginPath();
      ctx.moveTo(b.x - 6 * scale, b.y - f);
      ctx.quadraticCurveTo(b.x - 2 * scale, b.y - 2 * scale, b.x, b.y);
      ctx.quadraticCurveTo(b.x + 2 * scale, b.y - 2 * scale, b.x + 6 * scale, b.y - f);
      ctx.stroke();
    }
    if (train) drawTrain(train);
  };

  const frame = (t: number, dt: number) => {
    const size = layer.size;
    if (still) {
      if (t === STILL_TIME) {
        train = newTrain();
        train.x = size.w * 0.72;
        draw(size);
      }
      return;
    }
    step(size, dt);
    draw(size);
  };

  const stopTap = onBackgroundTap(host, mode, () => {
    if (still) return;
    if (train) train.jump = train.jump || 0.01;
    else train = newTrain();
  });
  const stop = startLoop(host, frame, { still });

  return {
    update: () => {},
    destroy: () => {
      stop();
      stopTap();
      layer.destroy();
      scene.destroy();
    },
  };
};
