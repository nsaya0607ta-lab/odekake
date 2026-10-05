/**
 * とろけるゼリー：パステルのゼリー（メタボール）が、ゆっくりくっついたり、はなれたりする。
 * まとまった形を球のように見立てて、つやの光・ふちの明るさ・下にうすい影をつけている。
 */
import { seededRandom, startLoop, type LiveMount } from "./engine";
import { createGlSurface } from "./gl";

const BALLS = 8;

const FRAGMENT = `
uniform vec3 uBalls[${BALLS}];
uniform vec3 uCols[${BALLS}];

float field(vec2 p, out vec3 color, out vec2 grad) {
  float f = 0.0;
  float wsum = 0.0;
  color = vec3(0.0);
  grad = vec2(0.0);
  for (int i = 0; i < ${BALLS}; i++) {
    vec3 b = uBalls[i];
    vec2 d = p - b.xy;
    float d2 = dot(d, d) + 1.0;
    float k = b.z * b.z / d2;
    f += k;
    float w = k * k * k;
    color += uCols[i] * w;
    wsum += w;
    grad += -2.0 * k / d2 * d;
  }
  color /= max(wsum, 1e-6);
  return f;
}

void main() {
  vec2 p = cssPos();
  vec3 color;
  vec2 grad;
  float f = field(p, color, grad);

  // 下地（クリーム → うすいラベンダー）
  vec3 bg = mix(vec3(0.992, 0.972, 0.945), vec3(0.965, 0.948, 0.99), vUv.y);
  // ゼリーの下に落ちる、やわらかい色つきの影
  vec3 sc;
  vec2 sg;
  float fs = field(p - vec2(-6.0, 16.0), sc, sg);
  float shadow = smoothstep(0.45, 1.05, fs) * 0.12;
  bg = mix(bg, bg * (0.86 + sc * 0.12), shadow / 0.12 * 0.55);

  // 球のように見立てた高さ h = sqrt(1 - 1/f)。ふちは急で、まんなかは平ら
  float fc = max(f, 1.02);
  float hgt = sqrt(1.0 - 1.0 / fc);
  vec2 hg = grad * (0.5 / max(hgt, 0.05)) / (fc * fc);
  vec3 n = normalize(vec3(-hg * 58.0, 1.0));
  vec3 L = normalize(vec3(-0.5, -0.62, 0.62));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(clamp(dot(n, H), 0.0, 1.0), 110.0);
  float spec2 = pow(clamp(dot(n, normalize(vec3(0.55, 0.5, 0.7))), 0.0, 1.0), 18.0);
  float rim = pow(1.0 - n.z, 1.6);

  vec3 jelly = color * (0.78 + 0.32 * diff);
  jelly = mix(jelly, vec3(1.0), 0.18 * hgt);           // 中のほうが光を通して明るい
  jelly += color * rim * 0.35;                          // ふちは色が濃く光る
  jelly += vec3(1.0) * spec * 0.9 + vec3(1.0, 0.98, 0.95) * spec2 * 0.1;

  float inside = smoothstep(0.965, 1.035, f);
  vec3 col = mix(bg, jelly, inside);
  // ゼリーのふちに、ほんのり明るい線
  col += vec3(1.0) * (smoothstep(0.92, 1.0, f) - smoothstep(1.0, 1.1, f)) * 0.07;
  gl_FragColor = vec4(col, 1.0);
}`;

const COLORS: readonly [number, number, number][] = [
  [1.0, 0.7, 0.62], // ピーチ
  [0.6, 0.87, 0.75], // ミント
  [0.77, 0.69, 0.96], // ライラック
  [1.0, 0.86, 0.5], // バター
  [0.6, 0.79, 0.97], // 空色
  [0.98, 0.64, 0.78], // ピンク
  [0.8, 0.91, 0.58], // ライム
  [0.99, 0.76, 0.56], // アプリコット
];

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const surface = createGlSurface(host, FRAGMENT, { resolution: 0.5 });
  if (!surface) return { update: () => {}, destroy: () => {} };
  const { gl, size, uniform } = surface;

  const rand = seededRandom(7);
  const balls = Array.from({ length: BALLS }, (_, i) => ({
    ax: 0.32 + rand() * 0.14,
    ay: 0.36 + rand() * 0.12,
    fx: 0.05 + rand() * 0.06,
    fy: 0.04 + rand() * 0.05,
    px: rand() * Math.PI * 2,
    py: rand() * Math.PI * 2,
    r: 0.1 + rand() * 0.05 + (i % 3 === 0 ? 0.035 : 0),
    breathe: rand() * Math.PI * 2,
  }));
  const ballData = new Float32Array(BALLS * 3);
  gl.uniform3fv(uniform("uCols"), new Float32Array(COLORS.flat()));

  const frame = (t: number) => {
    const { w, h } = size;
    const unit = Math.min(w, h * 0.62);
    balls.forEach((b, i) => {
      ballData[i * 3] = w * (0.5 + b.ax * Math.sin(t * b.fx + b.px));
      ballData[i * 3 + 1] = h * (0.5 + b.ay * Math.sin(t * b.fy + b.py));
      ballData[i * 3 + 2] = unit * b.r * (1 + 0.07 * Math.sin(t * 0.35 + b.breathe));
    });
    gl.uniform3fv(uniform("uBalls"), ballData);
    surface.draw(t);
  };

  const stop = startLoop(host, frame, { still });
  if (still) surface.freeze();

  return {
    update: () => {},
    destroy: () => {
      stop();
      surface.destroy();
    },
  };
};
