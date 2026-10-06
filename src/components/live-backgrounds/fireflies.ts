/**
 * ほたるの川辺：夜の川辺を、ほたるがふわふわ光りながら飛ぶ。
 * 画面をなぞると、ほたるが指のまわりに集まってきて輪をえがき、指を離すとまた散っていく。
 * 景色（月・山・川・草）は大きさが変わったときに1回だけ描き、ほたるの光は「足し算」で重ねて描く。
 */
import { addCanvas, clamp, context2d, makeSprite, onBackgroundDrag, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Fly = { x: number; y: number; vx: number; vy: number; phase: number; speed: number; wander: number; orbit: number; size: number };
type Spark = { x: number; y: number; life: number };

const glowSprite = makeGlow();
function makeGlow() {
  let sprite: HTMLCanvasElement | null = null;
  return () =>
    (sprite ??= makeSprite(64, 64, (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,220,1)");
      grad.addColorStop(0.12, "rgba(230,255,140,0.9)");
      grad.addColorStop(0.35, "rgba(190,240,90,0.35)");
      grad.addColorStop(1, "rgba(160,220,60,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }));
}

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 6 : Date.now() & 0xffff);
  const glow = glowSprite();
  let flies: Fly[] = [];
  let sparks: Spark[] = [];
  let scale = 1;
  let dirty = true;
  let finger: { x: number; y: number; at: number } | null = null;
  let clock = 0;

  const scene = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.8, 1.4);
      flies = Array.from({ length: Math.round(52 * clamp((size.w * size.h) / (390 * 844), 0.5, 1.6)) }, () => ({
        x: rand() * size.w, y: size.h * (0.25 + rand() * 0.7), vx: 0, vy: 0, phase: rand() * 10,
        speed: (14 + rand() * 16) * scale, wander: rand() * 6, orbit: rand() < 0.5 ? 1 : -1, size: (0.7 + rand() * 0.6) * scale,
      }));
      dirty = true;
    },
  });
  const layer = addCanvas(host);

  function paintScene(size: CanvasSize) {
    const g = context2d(scene.canvas, size);
    if (!g) return;
    const r = seededRandom(31);
    const { w, h } = size;
    g.clearRect(0, 0, w, h);
    // 星
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,255,240,${0.2 + r() * 0.5})`;
      g.beginPath(); g.arc(r() * w, r() * h * 0.45, r() * 1.1 + 0.3, 0, Math.PI * 2); g.fill();
    }
    // 月
    const mx = w * 0.78, my = h * 0.12, mr = 22 * scale;
    const halo = g.createRadialGradient(mx, my, mr, mx, my, mr * 5);
    halo.addColorStop(0, "rgba(255,246,210,0.25)");
    halo.addColorStop(1, "rgba(255,246,210,0)");
    g.fillStyle = halo;
    g.beginPath(); g.arc(mx, my, mr * 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff4d2";
    g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(220,205,160,0.35)";
    g.beginPath(); g.arc(mx - mr * 0.3, my + mr * 0.15, mr * 0.22, 0, Math.PI * 2); g.arc(mx + mr * 0.3, my - mr * 0.3, mr * 0.14, 0, Math.PI * 2); g.fill();
    // 山
    const hill = (base: number, amp: number, color: string, k: number) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w + 10; x += 10) g.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(x * k + base)));
      g.lineTo(w, h);
      g.closePath();
      g.fill();
    };
    hill(h * 0.5, 70 * scale, "#16243a", 0.009);
    hill(h * 0.56, 46 * scale, "#112033", 0.014);
    // 川（月の光がうつる）
    const riverTop = h * 0.66, riverBottom = h * 0.78;
    const river = g.createLinearGradient(0, riverTop, 0, riverBottom);
    river.addColorStop(0, "#1b3550");
    river.addColorStop(1, "#14283f");
    g.fillStyle = river;
    g.beginPath();
    g.moveTo(0, riverTop + 6 * scale);
    g.bezierCurveTo(w * 0.3, riverTop - 6 * scale, w * 0.6, riverTop + 10 * scale, w, riverTop);
    g.lineTo(w, riverBottom);
    g.bezierCurveTo(w * 0.6, riverBottom + 8 * scale, w * 0.3, riverBottom - 8 * scale, 0, riverBottom + 4 * scale);
    g.closePath();
    g.fill();
    for (let i = 0; i < 14; i++) {
      const y = riverTop + 6 * scale + i * ((riverBottom - riverTop - 8 * scale) / 14);
      const len = (16 + r() * 30) * scale * (1 - Math.abs(i - 6) / 12);
      g.strokeStyle = `rgba(255,240,190,${0.18 + r() * 0.2})`;
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(mx - len / 2 + (r() - 0.5) * 10, y); g.lineTo(mx + len / 2, y); g.stroke();
    }
    // 土手と草
    g.fillStyle = "#0b1726";
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(0, riverBottom + 2 * scale);
    for (let x = 0; x <= w + 10; x += 10) g.lineTo(x, riverBottom + 8 * scale + Math.sin(x * 0.02) * 5 * scale);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.strokeStyle = "#0e1d2e";
    g.lineWidth = 1.6;
    for (let x = 0; x < w; x += 3) {
      const y = riverBottom + 10 * scale + r() * 10 * scale;
      const len = (14 + r() * 40) * scale;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 10, y - len * 0.6, x + (r() - 0.5) * 18, y - len); g.stroke();
    }
    // 向こう岸の草
    g.strokeStyle = "#0f1e30";
    for (let x = 0; x < w; x += 4) {
      const y = riverTop + 4 * scale;
      const len = (6 + r() * 18) * scale;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y - len); g.stroke();
    }
  }

  const step = (size: CanvasSize, dt: number) => {
    clock += dt;
    const near = finger && clock - finger.at < 2.5 ? finger : null;
    for (const f of flies) {
      f.phase += dt;
      let ax: number, ay: number;
      const dx = near ? near.x - f.x : 0, dy = near ? near.y - f.y : 0;
      const dist = Math.hypot(dx, dy);
      if (near && dist < 260 * scale) {
        // 指のまわりを回る（近づきすぎたら少し離れる）
        const want = 34 * scale + (f.wander % 1) * 40 * scale;
        const pull = (dist - want) / (dist || 1);
        ax = dx * pull * 2.2 + (-dy / (dist || 1)) * f.orbit * 70 * scale;
        ay = dy * pull * 2.2 + (dx / (dist || 1)) * f.orbit * 70 * scale;
      } else {
        // ふらふら飛ぶ
        f.wander += (rand() - 0.5) * dt * 2.4;
        ax = Math.cos(f.wander) * f.speed * 3;
        ay = Math.sin(f.wander) * f.speed * 2 - (f.y - size.h * 0.6) * 0.05;
      }
      f.vx = (f.vx + ax * dt) * (1 - dt * 1.6);
      f.vy = (f.vy + ay * dt) * (1 - dt * 1.6);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < -20) f.x = size.w + 20;
      if (f.x > size.w + 20) f.x = -20;
      f.y = clamp(f.y, size.h * 0.12, size.h + 10);
    }
    for (const s of sparks) s.life -= dt * 1.4;
    sparks = sparks.filter((s) => s.life > 0);
  };

  const draw = (size: CanvasSize) => {
    const g = context2d(layer.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    g.globalCompositeOperation = "lighter";
    for (const s of sparks) {
      g.globalAlpha = s.life * 0.5;
      const d = 14 * scale;
      g.drawImage(glow, s.x - d / 2, s.y - d / 2, d, d);
    }
    for (const f of flies) {
      // ゆっくり明るくなって、ふっと消える光り方
      const k = (Math.sin(f.phase * 1.7) + 1) / 2;
      const on = Math.pow(k, 3);
      g.globalAlpha = 0.15 + on * 0.85;
      const d = (30 + on * 30) * f.size;
      g.drawImage(glow, f.x - d / 2, f.y - d / 2, d, d);
      // 水面にうつる光
      if (f.y > size.h * 0.55 && f.y < size.h * 0.66) {
        g.globalAlpha = on * 0.25;
        const ry = size.h * 0.66 * 2 - f.y + size.h * 0.04;
        g.drawImage(glow, f.x - d / 2, ry - d / 4, d, d / 2);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  const frame = (t: number, dt: number) => {
    const size = layer.size;
    if (dirty) {
      dirty = false;
      paintScene(scene.size);
    }
    if (still) {
      if (t === STILL_TIME) {
        // 見本：何匹かが指に集まっているところ
        finger = { x: size.w * 0.42, y: size.h * 0.45, at: 0 };
        for (let i = 0; i < 70; i++) step(size, 1 / 30);
        draw(size);
      }
      return;
    }
    step(size, dt);
    draw(size);
  };

  const stopDrag = onBackgroundDrag(host, mode, (x, y) => {
    if (still) return;
    finger = { x, y, at: clock };
    if (rand() < 0.5) sparks.push({ x: x + (rand() - 0.5) * 16, y: y + (rand() - 0.5) * 16, life: 1 });
  });
  const stop = startLoop(host, frame, { still });

  return {
    update: () => {},
    destroy: () => {
      stop();
      stopDrag();
      layer.destroy();
      scene.destroy();
    },
  };
};
