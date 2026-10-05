/**
 * 画面いっぱいに1枚の絵をシェーダーで描く（ゼリー・水面・オーロラ）。
 * ぼかしの多い絵なので、細かさを落として描いて引きのばし、軽くしている。
 * WebGL が使えない・途中で使えなくなったときは、キャンバスを隠して CSS の下地の色を見せる。
 */
import { addCanvas, type CanvasSize } from "./engine";

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/** どのシェーダーにも付ける前置き（精度と、よく使う乱数・ノイズ） */
export const GLSL_COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform vec2 uRes;
uniform float uScale;
uniform float uTime;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
/** 画面の位置（CSSピクセル、左上が0・下向きが+） */
vec2 cssPos() {
  return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
}
`;

export type GlSurface = {
  gl: WebGLRenderingContext;
  size: CanvasSize;
  uniform: (name: string) => WebGLUniformLocation | null;
  /** 共通の値（uRes・uScale・uTime）を入れて描く。そのほかの値は先に入れておく */
  draw: (time: number) => void;
  /** 一覧の見本：描いた絵を画像に移して、WebGL を手放す（同時に使える数に限りがあるため） */
  freeze: () => void;
  destroy: () => void;
};

export function createGlSurface(
  host: HTMLElement,
  fragment: string,
  { resolution = 0.5 }: { resolution?: number } = {},
): GlSurface | null {
  const { canvas, size, destroy: removeCanvas } = addCanvas(host, { resolution });
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    removeCanvas();
    return null;
  }

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("Live background shader failed", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, GLSL_COMMON + fragment);
  const program = gl.createProgram();
  if (!vs || !fs || !program) {
    removeCanvas();
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("Live background program failed", gl.getProgramInfoLog(program));
    removeCanvas();
    return null;
  }
  gl.useProgram(program);

  // 画面をおおう大きな三角形1枚
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const locations = new Map<string, WebGLUniformLocation | null>();
  const uniform = (name: string) => {
    if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
    return locations.get(name) ?? null;
  };

  let lost = false;
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    canvas.style.display = "none";
  };
  canvas.addEventListener("webglcontextlost", onLost);

  let frozen: HTMLImageElement | null = null;

  return {
    gl,
    size,
    uniform,
    draw: (time: number) => {
      if (lost) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniform("uRes"), canvas.width, canvas.height);
      gl.uniform1f(uniform("uScale"), canvas.width / Math.max(1, size.w));
      // 長く動かしても小数の細かさが落ちないよう、1時間でひとまわりさせる
      gl.uniform1f(uniform("uTime"), time % 3600);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    freeze: () => {
      if (lost || frozen) return;
      try {
        frozen = document.createElement("img");
        frozen.alt = "";
        frozen.src = canvas.toDataURL("image/png");
        frozen.style.cssText = canvas.style.cssText;
        host.insertBefore(frozen, canvas);
      } catch {
        frozen = null;
        return;
      }
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.style.display = "none";
    },
    destroy: () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      if (!lost && !frozen) gl.getExtension("WEBGL_lose_context")?.loseContext();
      frozen?.remove();
      removeCanvas();
    },
  };
}
