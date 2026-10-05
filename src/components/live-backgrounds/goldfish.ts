/**
 * きんぎょの池：ゆらめく水面の光（シェーダー）の上を、金魚が泳ぐ（キャンバス2D）。
 * タップすると波紋が広がって、近くの金魚がびっくりしてにげる。ときどき金魚が水面をつついて、小さな波紋が立つ。
 */
import { addCanvas, clamp, context2d, onBackgroundTap, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";
import { createGlSurface } from "./gl";

const RIPPLES = 6;

const FRAGMENT = `
uniform vec4 uRip[${RIPPLES}];

/** 網目の光（となりあう2点との距離の差。0 のところが光の線） */
float cells(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 9.0;
  float f2 = 9.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(i + g);
      o = 0.5 + 0.42 * sin(t + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return sqrt(f2) - sqrt(f1);
}

void main() {
  vec2 p = cssPos();
  vec2 disp = vec2(0.0);
  float wave = 0.0;
  for (int i = 0; i < ${RIPPLES}; i++) {
    vec4 r = uRip[i];
    float age = uTime - r.z;
    if (age > 0.0 && age < 3.6) {
      vec2 d = p - r.xy;
      float dist = length(d) + 0.001;
      float x = dist - age * 145.0;
      float env = exp(-x * x / 650.0) * exp(-age * 1.05) * r.w;
      float w = sin(x * 0.12);
      disp += d / dist * w * env * 9.0;
      wave += w * env;
    }
  }
  float t = uTime * 0.55;
  vec2 q = (p + disp) / 104.0;
  q += (vec2(vnoise(q * 0.6 + vec2(t * 0.08, 0.0)), vnoise(q * 0.6 + vec2(5.2, -t * 0.08))) - 0.5) * 0.65;
  float c1 = cells(q, t);
  float c2 = cells(q * 1.7 + 3.1, t * 1.25 + 1.3);
  float lines = pow(1.0 - smoothstep(0.0, 0.13, c1), 3.0) * 0.8 + pow(1.0 - smoothstep(0.0, 0.09, c2), 3.0) * 0.35;
  // 光の網は、ところどころで強く・弱く（水面のうねり）
  lines *= 0.45 + 0.55 * vnoise(p / 170.0 + vec2(t * 0.06, -t * 0.04));

  float shade = vnoise(p / 240.0 + vec2(t * 0.02, 0.0));
  float yy = gl_FragCoord.y / uRes.y;
  vec3 deep = vec3(0.34, 0.68, 0.72);
  vec3 shallow = vec3(0.71, 0.9, 0.88);
  vec3 col = mix(deep, shallow, clamp(0.22 + yy * 0.55 + (shade - 0.5) * 0.3, 0.0, 1.0));
  col += vec3(1.0, 0.98, 0.86) * lines * 0.3;
  col += vec3(1.0) * clamp(wave, 0.0, 1.0) * 0.2 - vec3(0.05, 0.08, 0.08) * clamp(-wave, 0.0, 1.0) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}`;

type Kind = "orange" | "sarasa" | "demekin";

type Fish = {
  kind: Kind;
  x: number;
  y: number;
  heading: number;
  speed: number;
  cruise: number;
  tx: number;
  ty: number;
  phase: number;
  scared: number;
  len: number;
  patches: { u: number; side: number; r: number }[];
};

type Pad = { x: number; y: number; r: number; rot: number; spin: number; notch: number; lotus: boolean; bob: number };

/** 体のはば（頭→しっぽのつけ根を 0→1 で、長さに対する割合） */
const WIDTH: readonly [number, number][] = [
  [0, 0.06], [0.08, 0.125], [0.2, 0.165], [0.35, 0.175], [0.5, 0.16], [0.65, 0.125], [0.8, 0.08], [0.92, 0.05], [1, 0.04],
];
const widthAt = (u: number) => {
  for (let i = 1; i < WIDTH.length; i += 1) {
    const [u1, w1] = WIDTH[i]!;
    const [u0, w0] = WIDTH[i - 1]!;
    if (u <= u1) return w0 + ((w1 - w0) * (u - u0)) / (u1 - u0);
  }
  return 0.04;
};

const PALETTE: Record<Kind, { light: string; dark: string; fin: string; finTip: string }> = {
  orange: { light: "#ffb768", dark: "#ec6a2b", fin: "rgba(255,150,80,0.82)", finTip: "rgba(255,214,170,0.35)" },
  sarasa: { light: "#fffaf4", dark: "#f1d9cf", fin: "rgba(255,236,226,0.8)", finTip: "rgba(255,255,255,0.32)" },
  demekin: { light: "#4a4452", dark: "#1d1a22", fin: "rgba(52,46,60,0.78)", finTip: "rgba(120,110,135,0.3)" },
};

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const surface = createGlSurface(host, FRAGMENT, { resolution: 0.5 });
  const rand = seededRandom(still ? 11 : Date.now() & 0xffff);
  let fish: Fish[] = [];
  let pads: Pad[] = [];
  let clock = 0;
  let nextNibble = 3;
  const layer = addCanvas(host, { onResize: (size) => placeScene(size) });
  const ctx = context2d(layer.canvas, layer.size);

  const ripples = new Float32Array(RIPPLES * 4).fill(-100);
  let rippleIndex = 0;
  const addRipple = (x: number, y: number, t: number, strength: number) => {
    ripples.set([x, y, t, strength], rippleIndex * 4);
    rippleIndex = (rippleIndex + 1) % RIPPLES;
  };

  function placeScene({ w, h }: CanvasSize) {
    const r = seededRandom(5);
    const len = clamp(w * 0.14, 32, 60);
    const kinds: Kind[] = ["orange", "sarasa", "demekin", "orange"];
    const count = clamp(Math.round((w * h) / 110000), 2, 4);
    if (fish.length !== count) {
      fish = Array.from({ length: count }, (_, i) => {
        const kind = kinds[i % kinds.length]!;
        return {
          kind,
          x: w * (0.2 + r() * 0.6),
          y: h * (0.15 + r() * 0.7),
          heading: r() * Math.PI * 2,
          speed: 26,
          cruise: 22 + r() * 12,
          tx: w * r(),
          ty: h * r(),
          phase: r() * 10,
          scared: 0,
          len: len * (kind === "demekin" ? 0.86 : 0.9 + r() * 0.2),
          patches: kind === "sarasa" ? [{ u: 0.12, side: -0.3, r: 0.17 }, { u: 0.48, side: 0.25, r: 0.2 }, { u: 0.7, side: -0.1, r: 0.12 }] : [],
        };
      });
    }
    const padR = clamp(w * 0.075, 20, 36);
    pads = [
      { x: w * 0.1, y: h * 0.22, r: padR, rot: 0.4, spin: 0.012, notch: 0.6, lotus: false, bob: 0 },
      { x: w * 0.93, y: h * 0.5, r: padR * 1.2, rot: 2.2, spin: -0.008, notch: 2.6, lotus: true, bob: 1.3 },
      { x: w * 0.06, y: h * 0.74, r: padR * 0.85, rot: 4, spin: 0.01, notch: 4.1, lotus: false, bob: 2.1 },
      { x: w * 0.88, y: h * 0.9, r: padR * 0.75, rot: 1, spin: -0.012, notch: 5.3, lotus: false, bob: 3.4 },
    ];
  }

  const pickTarget = (f: Fish) => {
    const { w, h } = layer.size;
    f.tx = -w * 0.08 + rand() * w * 1.16;
    f.ty = h * 0.04 + rand() * h * 0.92;
  };
  fish.forEach(pickTarget);

  const stopTap = onBackgroundTap(host, mode, (x, y) => {
    addRipple(x, y, clock, 1);
    for (const f of fish) {
      const dx = f.x - x;
      const dy = f.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < 190) {
        const away = Math.atan2(dy, dx);
        f.tx = f.x + Math.cos(away) * 260;
        f.ty = f.y + Math.sin(away) * 260;
        f.scared = 1.4;
        f.speed = 160;
      }
    }
  });

  const steer = (f: Fish, dt: number) => {
    const desired = Math.atan2(f.ty - f.y, f.tx - f.x);
    let diff = desired - f.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = (f.scared > 0 ? 6 : 1.4) * dt;
    f.heading += clamp(diff, -turn, turn);
    f.scared = Math.max(0, f.scared - dt);
    const goal = f.scared > 0 ? 150 : f.cruise * (0.85 + 0.15 * Math.sin(clock * 0.4 + f.phase));
    f.speed += (goal - f.speed) * Math.min(1, dt * (f.scared > 0 ? 4 : 1.2));
    f.x += Math.cos(f.heading) * f.speed * dt;
    f.y += Math.sin(f.heading) * f.speed * dt;
    f.phase += dt * (2.2 + f.speed * 0.05) * Math.PI * 2 * 0.5;
    if (Math.hypot(f.tx - f.x, f.ty - f.y) < 36 && f.scared <= 0) pickTarget(f);
  };

  /** 体の輪郭（頭が +x）。sway はしっぽ側ほど大きく横にゆれる */
  const bodyPath = (c: CanvasRenderingContext2D, f: Fish, sway: (u: number) => number) => {
    const L = f.len;
    const top: [number, number][] = [];
    const bottom: [number, number][] = [];
    for (let i = 0; i <= 10; i += 1) {
      const u = i / 10;
      const x = L * (0.5 - u);
      const y = sway(u);
      const hw = widthAt(u) * L;
      top.push([x, y - hw]);
      bottom.push([x, y + hw]);
    }
    c.beginPath();
    c.moveTo(L * 0.53, sway(0));
    const pts = [...top, ...bottom.reverse()];
    let prev: [number, number] = [L * 0.53, sway(0)];
    for (const pt of pts) {
      c.quadraticCurveTo(prev[0], prev[1], (prev[0] + pt[0]) / 2, (prev[1] + pt[1]) / 2);
      prev = pt;
    }
    c.quadraticCurveTo(prev[0], prev[1], L * 0.53, sway(0));
    c.closePath();
  };

  const tailPath = (c: CanvasRenderingContext2D, L: number, baseY: number, swing: number, ripple: number, side: -1 | 1) => {
    const bx = -L * 0.5;
    c.beginPath();
    c.moveTo(bx + L * 0.02, baseY + side * L * 0.02);
    c.bezierCurveTo(
      bx - L * 0.18, baseY + side * L * 0.2 + swing * 0.6,
      bx - L * 0.42, baseY + side * L * 0.36 + swing + ripple,
      bx - L * 0.62, baseY + side * L * 0.3 + swing * 1.3 + ripple * 1.4,
    );
    c.quadraticCurveTo(bx - L * 0.5, baseY + side * L * 0.12 + swing * 1.1, bx - L * 0.4, baseY + side * L * 0.03 + swing);
    c.quadraticCurveTo(bx - L * 0.2, baseY + side * L * 0.0 + swing * 0.5, bx + L * 0.02, baseY + side * L * 0.02);
    c.closePath();
  };

  const drawFish = (c: CanvasRenderingContext2D, f: Fish, shadow: boolean) => {
    const L = f.len;
    const amp = L * (0.05 + Math.min(0.06, f.speed / 3000));
    const sway = (u: number) => amp * Math.sin(f.phase - u * 2.4) * Math.pow(u, 1.6);
    const tailY = sway(1);
    const swing = amp * 1.6 * Math.sin(f.phase - 2.9);
    const ripple = amp * 0.7 * Math.sin(f.phase * 1.3 - 1.2);
    const pal = PALETTE[f.kind];
    c.save();
    c.translate(f.x + (shadow ? 7 : 0), f.y + (shadow ? 11 : 0));
    c.rotate(f.heading);

    if (shadow) {
      c.fillStyle = "rgba(14,70,82,0.14)";
      tailPath(c, L, tailY, swing, ripple, -1);
      c.fill();
      tailPath(c, L, tailY, swing, ripple, 1);
      c.fill();
      bodyPath(c, f, sway);
      c.fill();
      c.restore();
      return;
    }

    // しっぽ（2まい。うすく透ける）
    for (const side of [-1, 1] as const) {
      const g = c.createLinearGradient(-L * 0.5, 0, -L * 1.1, 0);
      g.addColorStop(0, pal.fin);
      g.addColorStop(1, pal.finTip);
      c.fillStyle = g;
      tailPath(c, L, tailY, swing, ripple * side, side);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.18)";
      c.lineWidth = 0.6;
      for (let k = 1; k <= 3; k += 1) {
        c.beginPath();
        c.moveTo(-L * 0.5, tailY + side * L * 0.02);
        c.quadraticCurveTo(-L * (0.62 + k * 0.03), tailY + side * L * (0.06 + k * 0.06) + swing * 0.8, -L * (0.8 + k * 0.05), tailY + side * L * (0.08 + k * 0.07) + swing * 1.2 + ripple);
        c.stroke();
      }
    }
    // むなびれ（ぱたぱた）
    const flap = 0.35 + 0.25 * Math.sin(f.phase * 1.7);
    for (const side of [-1, 1] as const) {
      c.save();
      c.translate(L * 0.24, sway(0.25) + side * widthAt(0.25) * L * 0.85);
      c.rotate(side * (0.9 + flap));
      c.fillStyle = pal.fin;
      c.beginPath();
      c.ellipse(-L * 0.06, 0, L * 0.1, L * 0.045, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    // 体（まんなかが明るく、ふちが濃い）
    const body = c.createLinearGradient(0, -L * 0.2, 0, L * 0.2);
    body.addColorStop(0, pal.dark);
    body.addColorStop(0.5, pal.light);
    body.addColorStop(1, pal.dark);
    c.fillStyle = body;
    bodyPath(c, f, sway);
    c.fill();
    if (f.patches.length) {
      c.save();
      bodyPath(c, f, sway);
      c.clip();
      c.fillStyle = "#e8483a";
      for (const p of f.patches) {
        c.beginPath();
        c.ellipse(L * (0.5 - p.u), sway(p.u) + p.side * L * 0.16, L * p.r, L * p.r * 0.75, 0.3, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
    // 背中のつや
    c.strokeStyle = f.kind === "demekin" ? "rgba(190,180,215,0.35)" : "rgba(255,255,255,0.45)";
    c.lineWidth = L * 0.045;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(L * 0.34, sway(0.16));
    c.quadraticCurveTo(L * 0.15, sway(0.35), -L * 0.08, sway(0.58));
    c.stroke();
    // 目
    const eyeR = f.kind === "demekin" ? L * 0.06 : L * 0.034;
    const eyeOut = f.kind === "demekin" ? 1.05 : 0.8;
    for (const side of [-1, 1] as const) {
      const ex = L * 0.4;
      const ey = sway(0.1) + side * widthAt(0.1) * L * eyeOut;
      c.fillStyle = f.kind === "demekin" ? "#14121a" : "#2a1d18";
      c.beginPath();
      c.arc(ex, ey, eyeR, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.85)";
      c.beginPath();
      c.arc(ex + eyeR * 0.3, ey - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  };

  const drawPad = (c: CanvasRenderingContext2D, p: Pad, t: number) => {
    const bob = Math.sin(t * 0.6 + p.bob) * 1.5;
    c.save();
    c.translate(p.x + 5, p.y + 8 + bob);
    c.rotate(p.rot + t * p.spin);
    c.fillStyle = "rgba(14,70,82,0.13)";
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, p.r, p.notch + 0.22, p.notch - 0.22 + Math.PI * 2);
    c.closePath();
    c.fill();
    c.restore();

    c.save();
    c.translate(p.x, p.y + bob);
    c.rotate(p.rot + t * p.spin);
    const g = c.createRadialGradient(-p.r * 0.2, -p.r * 0.25, p.r * 0.1, 0, 0, p.r);
    g.addColorStop(0, "#a8d68f");
    g.addColorStop(0.75, "#74b062");
    g.addColorStop(1, "#5b9550");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, p.r, p.notch + 0.22, p.notch - 0.22 + Math.PI * 2);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(60,110,55,0.35)";
    c.lineWidth = 0.8;
    for (let k = 0; k < 9; k += 1) {
      const a = p.notch + 0.5 + (k * (Math.PI * 2 - 1)) / 8;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * p.r * 0.86, Math.sin(a) * p.r * 0.86);
      c.stroke();
    }
    c.restore();

    if (p.lotus) {
      // はすの花（ピンクの花びらを重ねる）
      c.save();
      c.translate(p.x - p.r * 0.2, p.y - p.r * 0.15 + bob);
      const R = p.r * 0.42;
      for (let ring = 0; ring < 2; ring += 1) {
        const n = ring === 0 ? 8 : 6;
        for (let k = 0; k < n; k += 1) {
          const a = (k / n) * Math.PI * 2 + ring * 0.3;
          c.save();
          c.rotate(a);
          const pg = c.createLinearGradient(0, 0, 0, -R * (ring === 0 ? 1 : 0.75));
          pg.addColorStop(0, "#fff3f6");
          pg.addColorStop(1, ring === 0 ? "#f39ab4" : "#f7b6c9");
          c.fillStyle = pg;
          c.beginPath();
          c.ellipse(0, -R * (ring === 0 ? 0.5 : 0.38), R * (ring === 0 ? 0.28 : 0.24), R * (ring === 0 ? 0.55 : 0.42), 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      }
      c.fillStyle = "#f6d36b";
      c.beginPath();
      c.arc(0, 0, R * 0.2, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  };

  const frame = (t: number, dt: number) => {
    clock = t;
    if (!still && t >= nextNibble && fish.length) {
      // 金魚が水面をつついて、小さな波紋
      const f = fish[Math.floor(rand() * fish.length)]!;
      addRipple(f.x + Math.cos(f.heading) * f.len * 0.5, f.y + Math.sin(f.heading) * f.len * 0.5, t, 0.45);
      nextNibble = t + 4 + rand() * 6;
    }
    if (surface) {
      surface.gl.uniform4fv(surface.uniform("uRip"), ripples);
      surface.draw(t);
    }
    if (!ctx) return;
    const { w, h, dpr } = layer.size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const f of fish) {
      if (dt > 0) steer(f, dt);
      // 画面の外に出すぎたら、反対側からまた入ってくる
      if (f.x < -w * 0.25) f.x = w * 1.2;
      if (f.x > w * 1.25) f.x = -w * 0.2;
      if (f.y < -h * 0.15) f.y = h * 1.1;
      if (f.y > h * 1.15) f.y = -h * 0.1;
    }
    for (const f of fish) drawFish(ctx, f, true);
    for (const f of fish) drawFish(ctx, f, false);
    for (const p of pads) drawPad(ctx, p, t);
  };

  if (still) {
    // 見本：金魚の向きをそろえて、波紋を1つ広げたところを描く
    const { w, h } = layer.size;
    fish.forEach((f, i) => {
      f.x = w * [0.32, 0.68, 0.5, 0.2][i % 4]!;
      f.y = h * [0.3, 0.52, 0.76, 0.6][i % 4]!;
      f.heading = [0.4, 2.6, -0.5, 1.2][i % 4]!;
      f.phase = i * 1.7;
    });
    addRipple(w * 0.56, h * 0.4, STILL_TIME - 0.9, 1);
  }

  const stop = startLoop(host, frame, { still });
  if (still) surface?.freeze();

  return {
    update: () => {},
    destroy: () => {
      stop();
      stopTap();
      surface?.destroy();
      layer.destroy();
    },
  };
};
