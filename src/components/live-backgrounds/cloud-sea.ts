/**
 * 雲の上：朝焼けの空の下に、雲海がどこまでも広がる。雲はゆっくり手前へ流れてくる。
 * 地平線より下は「平らな雲の床」を遠近法で見下ろしたように描き（遠いほど細かく・かすむ）、
 * 雲のもりあがりの上側に太陽の光を当てる。空には高い筋雲が少しだけ流れる。
 */
import { startLoop, type LiveMount } from "./engine";
import { createGlSurface } from "./gl";

const FRAGMENT = `
float clouds(vec2 p) {
  float f = fbm(p);
  return smoothstep(0.32, 0.78, f);
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);         // 左上が0
  float aspect = uRes.x / uRes.y;
  float hz = 0.44;                              // 地平線の高さ
  vec2 sun = vec2(0.72, hz - 0.06);

  // 空：上は水色、地平線に向かって桃色・杏色
  vec3 top = vec3(0.56, 0.74, 0.93);
  vec3 mid = vec3(0.98, 0.83, 0.80);
  vec3 low = vec3(1.0, 0.86, 0.66);
  float ty = clamp(uv.y / hz, 0.0, 1.0);
  vec3 sky = mix(top, mid, smoothstep(0.15, 0.85, ty));
  sky = mix(sky, low, smoothstep(0.75, 1.0, ty));
  vec2 ds = (uv - sun) * vec2(aspect, 1.0);
  float sd = length(ds);
  sky += vec3(1.0, 0.78, 0.52) * (0.2 * exp(-sd * 10.0) + 0.07 * exp(-sd * 2.6));
  sky = mix(sky, vec3(1.0, 1.0, 0.96), smoothstep(0.03, 0.022, sd));    // お日さま
  sky += vec3(1.0, 0.95, 0.8) * smoothstep(0.06, 0.0, sd) * 0.25;

  vec3 col = sky;
  if (uv.y < hz) {
    // 高い筋雲（ゆっくり右へ）
    vec2 q = vec2(uv.x * aspect * 1.6 + uTime * 0.006, uv.y * 7.0);
    float w = smoothstep(0.55, 0.85, fbm(q * vec2(1.0, 0.6))) * smoothstep(hz, hz * 0.35, uv.y) * smoothstep(0.02, 0.18, uv.y);
    col = mix(col, vec3(1.0, 0.95, 0.93), w * 0.55);
  } else {
    // 雲海：地平線からの距離で奥行きを決める（遠いほど細かく、手前ほど大きく）
    float dy = max(uv.y - hz, 0.002);
    float z = 0.16 / dy;
    vec2 w = vec2((uv.x - 0.5) * aspect * z * 5.0, z * 3.2 + uTime * 0.09);
    // もこもこ：大きな雲のかたまり + 小さなふくらみ
    float big = fbm(w * 0.7);
    float small = fbm(w * 2.3 + 7.0);
    float d = big * 0.75 + small * 0.25;
    // 光は奥（太陽のほう）から：手前に少しずらした値との差で、もりあがりの向きを出す
    vec2 w2 = w + vec2(0.0, -0.22);
    float d2 = fbm(w2 * 0.7) * 0.75 + fbm(w2 * 2.3 + 7.0) * 0.25;
    float lit = clamp((d - d2) * 6.0 + 0.5, 0.0, 1.0);
    float puff = smoothstep(0.35, 0.75, d);
    vec3 deep = vec3(0.62, 0.66, 0.84);         // 雲のすきまのかげ（青むらさき）
    vec3 shade = vec3(0.84, 0.85, 0.94);
    vec3 light = vec3(1.0, 0.985, 0.96);
    vec3 warm = vec3(1.0, 0.86, 0.72);
    vec3 cloudCol = mix(shade, light, lit);
    cloudCol = mix(deep, cloudCol, puff);
    // 太陽に近いところは、雲の上が金色に
    float toSun = exp(-abs(uv.x - sun.x) * 2.6) * exp(-dy * 4.0);
    cloudCol = mix(cloudCol, warm, toSun * lit * 0.7);
    // 地平線のきわだけ、空の色にかすむ
    float haze = exp(-dy * 16.0);
    cloudCol = mix(cloudCol, mix(low, vec3(1.0), 0.3), haze * 0.7);
    col = cloudCol;
  }
  // 画面のふちを少しだけ暗く
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.18;
  gl_FragColor = vec4(col, 1.0);
}`;

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const surface = createGlSurface(host, FRAGMENT, { resolution: 0.5 });
  if (!surface) return { update: () => {}, destroy: () => {} };
  // 雲の流れはゆっくり。30回/秒も描き直さなくてよい
  const stop = startLoop(host, (t) => surface.draw(t + 40), { still, fps: 20 });
  if (still) surface.freeze();
  return {
    update: () => {},
    destroy: () => {
      stop();
      surface.destroy();
    },
  };
};
