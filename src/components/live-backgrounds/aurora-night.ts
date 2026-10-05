/**
 * オーロラの夜：シェーダーのオーロラ＋またたく星と流れ星（キャンバス2D）＋町と丘のシルエット（SVG）。
 * 丘の上には、オーロラを見上げる小さなフレンチーがすわっている。
 */
import { addCanvas, context2d, makeSprite, seededRandom, startLoop, type CanvasSize, type LiveMount } from "./engine";
import { createGlSurface } from "./gl";

const FRAGMENT = `
void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  // 夜空（地平線の近くは少し青緑、上は深い紺）
  vec3 col = mix(vec3(0.07, 0.13, 0.19), vec3(0.055, 0.075, 0.19), smoothstep(0.0, 0.38, uv.y));
  col = mix(col, vec3(0.02, 0.035, 0.10), smoothstep(0.38, 1.0, uv.y));

  float t = uTime * 0.05;
  vec3 aur = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = p.x * (2.6 + fi * 0.7) + fi * 11.7;
    // カーテンの下のふち（ゆっくり波うつ）
    float edge = 0.47 + fi * 0.1 + (fbm(vec2(x * 0.55 + t * (1.0 + fi * 0.35), fi * 3.1 + t * 0.45)) - 0.5) * 0.46;
    float d = uv.y - edge;
    float lower = smoothstep(-0.028, 0.01, d);
    float upper = exp(-max(d, 0.0) * (3.4 + fi * 1.8));
    // 縦のすじ（光の柱）と、明るいところ・暗いところのむら
    float rays = pow(vnoise(vec2(x * 13.0, t * 2.6 + fi * 5.0)), 1.5) * 0.8 + 0.3;
    float patchy = smoothstep(0.28, 0.78, fbm(vec2(x * 0.9 - t * 0.7, fi * 7.0 + t * 0.25)));
    float k = lower * upper * rays * (0.25 + 0.75 * patchy);
    vec3 c = mix(vec3(0.32, 1.0, 0.64), vec3(0.22, 0.8, 0.88), smoothstep(0.0, 0.1, d));
    c = mix(c, vec3(0.8, 0.42, 0.98), smoothstep(0.1, 0.36, d));
    aur += c * k * (0.7 - fi * 0.16);
  }
  // オーロラのまわりのにじみ（ふんわり明るく）
  col += aur + aur * aur * 0.25;
  // 町の灯りが、地平線の近くをほんのり照らす
  col += vec3(0.16, 0.11, 0.06) * smoothstep(0.24, 0.0, uv.y) * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

/** 町と丘とフレンチー。窓のいくつかは、ときどき灯りがつく・消える */
const TOWN_SVG = `
<svg viewBox="0 0 400 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <radialGradient id="lbWin" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/>
      <stop offset="1" stop-color="#ffd27a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="M0 98 C60 82 110 90 160 100 S270 78 320 88 S380 94 400 90 L400 170 L0 170Z" fill="#18224b"/>
  <g fill="#0f1738">
    <path d="M128 99 l5 -15 l5 15z"/><path d="M140 101 l4 -11 l4 11z"/>
    <path d="M352 92 l5 -16 l5 16z"/><path d="M364 93 l4 -11 l4 11z"/>
  </g>
  <g fill="#0d1532">
    <rect x="232" y="84" width="20" height="16"/><path d="M229 85 L242 74 L255 85Z"/>
    <rect x="256" y="78" width="15" height="22"/><path d="M254 79 L263.5 70 L273 79Z"/>
    <rect x="276" y="88" width="26" height="12"/><path d="M273 89 L289 79 L305 89Z"/><rect x="295" y="78" width="4" height="8"/>
    <rect x="310" y="76" width="9" height="24"/><path d="M308.5 77 L314.5 66 L320.5 77Z"/>
  </g>
  <g fill="url(#lbWin)">
    <circle cx="238.5" cy="90" r="8"/><circle cx="263.5" cy="84" r="8"/><circle cx="283" cy="93" r="7"/><circle cx="314.5" cy="82" r="6"/>
  </g>
  <g fill="#ffd58c">
    <rect x="237" y="88" width="3" height="4" rx=".5"/>
    <rect x="245" y="88" width="3" height="4" rx=".5" class="lb-twinkle" style="animation-duration:11s"/>
    <rect x="260" y="82" width="3" height="4" rx=".5"/>
    <rect x="265" y="90" width="3" height="4" rx=".5" class="lb-twinkle" style="animation-duration:14s;animation-delay:-5s"/>
    <rect x="281" y="91" width="4" height="3" rx=".5"/>
    <rect x="291" y="91" width="4" height="3" rx=".5" class="lb-twinkle" style="animation-duration:9s;animation-delay:-2s"/>
    <rect x="313" y="80" width="3" height="4" rx=".5"/>
  </g>
  <path d="M0 130 C70 114 130 120 190 128 S300 114 350 120 S390 126 400 124 L400 170 L0 170Z" fill="#0e1534"/>
  <g fill="#0a1029">
    <ellipse cx="74" cy="117.5" rx="6.2" ry="6.8"/>
    <circle cx="78.5" cy="108.8" r="4.6"/>
    <path d="M75.4 106.6 L74.4 100.6 L78.4 104.9Z"/>
    <path d="M80.4 105.1 L83.4 100.4 L83.2 107.2Z"/>
    <path d="M68.3 121.5 q-3 1.2 -4.2 -0.6" stroke="#0a1029" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

type Star = { x: number; y: number; r: number; a: number; f: number; p: number; tint: string };
type Meteor = { x: number; y: number; vx: number; vy: number; born: number; life: number; len: number };

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const surface = createGlSurface(host, FRAGMENT, { resolution: 0.5 });

  let staticField: HTMLCanvasElement | null = null;
  let twinkling: Star[] = [];
  const stars = addCanvas(host, { onResize: (size) => buildStars(size) });
  const ctx = context2d(stars.canvas, stars.size);

  const town = document.createElement("div");
  town.className = "lb-town";
  town.innerHTML = TOWN_SVG;
  host.appendChild(town);

  // 光の強い星のにじみ
  const glow = makeSprite(24, 24, (g) => {
    const grad = g.createRadialGradient(12, 12, 0, 12, 12, 12);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.25, "rgba(220,235,255,0.35)");
    grad.addColorStop(1, "rgba(220,235,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 24, 24);
  });

  function buildStars({ w, h, dpr }: CanvasSize) {
    const rand = seededRandom(20251005);
    const count = Math.min(320, Math.round((w * h) / 1500));
    const all: Star[] = [];
    for (let i = 0; i < count; i += 1) {
      const y = Math.pow(rand(), 1.35) * h * 0.82;
      const big = rand() < 0.07;
      all.push({
        x: rand() * w,
        y,
        r: big ? 1.1 + rand() * 0.7 : 0.35 + rand() * 0.75,
        a: 0.35 + rand() * 0.65,
        f: 0.6 + rand() * 2.2,
        p: rand() * Math.PI * 2,
        tint: rand() < 0.2 ? "205,222,255" : rand() < 0.1 ? "255,236,206" : "255,255,255",
      });
    }
    // またたくのは一部だけ。のこりは1枚の絵にしておく（毎回描かない）
    twinkling = all.filter((_, i) => i % 4 === 0 || all[i]!.r > 1);
    const fixed = all.filter((s) => !twinkling.includes(s));
    staticField = makeSprite(w * dpr, h * dpr, (g) => {
      g.scale(dpr, dpr);
      for (const s of fixed) {
        g.fillStyle = `rgba(${s.tint},${s.a * 0.85})`;
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        g.fill();
      }
    });
  }

  const rand = seededRandom(Date.now() & 0xffff);
  let meteor: Meteor | null = null;
  let nextMeteor = still ? 0 : 3 + rand() * 5;

  const launchMeteor = (t: number) => {
    const { w, h } = stars.size;
    const toLeft = rand() < 0.5;
    // 水平から少し下向き（0.3〜0.6ラジアン）に流れる
    const angle = 0.32 + rand() * 0.28;
    const speed = 620 + rand() * 360;
    meteor = {
      x: w * (toLeft ? 0.45 + rand() * 0.5 : 0.05 + rand() * 0.5),
      y: h * (0.04 + rand() * 0.3),
      vx: Math.cos(angle) * speed * (toLeft ? -1 : 1),
      vy: Math.sin(angle) * speed,
      born: t,
      life: 0.75 + rand() * 0.45,
      len: 110 + rand() * 90,
    };
  };

  const drawMeteor = (m: Meteor, age: number) => {
    if (!ctx) return;
    const k = age / m.life;
    const alpha = Math.min(1, k / 0.12) * (1 - Math.max(0, (k - 0.6) / 0.4));
    const x = m.x + m.vx * age;
    const y = m.y + m.vy * age;
    const speed = Math.hypot(m.vx, m.vy);
    const tx = x - (m.vx / speed) * m.len;
    const ty = y - (m.vy / speed) * m.len;
    const grad = ctx.createLinearGradient(x, y, tx, ty);
    grad.addColorStop(0, `rgba(255,255,255,${0.95 * alpha})`);
    grad.addColorStop(0.3, `rgba(200,225,255,${0.45 * alpha})`);
    grad.addColorStop(1, "rgba(200,225,255,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.drawImage(glow, x - 9, y - 9, 18, 18);
    ctx.globalAlpha = 1;
  };

  const frame = (t: number) => {
    surface?.draw(t);
    if (!ctx) return;
    const { w, h } = stars.size;
    ctx.setTransform(stars.size.dpr, 0, 0, stars.size.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (staticField) ctx.drawImage(staticField, 0, 0, w, h);
    for (const s of twinkling) {
      const a = s.a * (0.55 + 0.45 * Math.sin(t * s.f + s.p));
      if (s.r > 1) {
        ctx.globalAlpha = a;
        ctx.drawImage(glow, s.x - s.r * 5, s.y - s.r * 5, s.r * 10, s.r * 10);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = `rgba(${s.tint},${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (still) {
      // 見本には、流れ星を1つ描いておく
      drawMeteor({ x: w * 0.78, y: h * 0.1, vx: -560, vy: 230, born: 0, life: 1, len: Math.min(170, w * 0.45) }, 0.32);
      return;
    }
    if (!meteor && t >= nextMeteor) launchMeteor(t);
    if (meteor) {
      const age = t - meteor.born;
      if (age > meteor.life) {
        meteor = null;
        nextMeteor = t + 6 + rand() * 9;
      } else {
        drawMeteor(meteor, age);
      }
    }
  };

  const stop = startLoop(host, frame, { still });
  if (still) surface?.freeze();
  if (still) town.classList.add("is-still");

  return {
    update: () => {},
    destroy: () => {
      stop();
      surface?.destroy();
      stars.destroy();
      town.remove();
    },
  };
};
