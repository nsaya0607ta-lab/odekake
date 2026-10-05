/**
 * 歩いて咲く花畑：きょうの歩数で、画面の左右のふちのつると、下の花畑が育つ。
 * - つるは 10,000 歩で画面の上まで届く（ホームでもカードの左右のすきまに見える）
 * - お花は 500 歩ごとに1つ咲く（全部で20こ。下の花畑に12こ、つるに8こ）
 * - 5,000 歩でちょうちょが1ぴき、8,000 歩で2ひき。10,000 歩で満開になって、花びらが舞う
 * 絵は SVG。のびる・咲く・ゆれるは CSS のアニメーション（lb-grow / lb-sway / lb-flap / lb-petal-fall）。
 * ずっと動くもの（お花のゆれ・ちょうちょ・花びら）は HTML の要素にして、画面の合成だけで動かしている。
 * スクリプトは歩数が変わったときにだけ動く（電池にやさしい）。見えていないものの動きは止めておく。
 */
import { clamp, seededRandom, type LiveMount } from "./engine";

const GOAL = 10000;
const SVG_NS = "http://www.w3.org/2000/svg";

type FlowerKind = "daisy" | "tulip" | "pompom" | "star";
const COLORS = ["#f4a3b6", "#f6a487", "#f5cf5f", "#c2a6ea", "#9cc6ef", "#f7b8d0"];

type Slot = { threshold: number; el: HTMLElement | SVGElement; sprout?: SVGGElement };

const svg = (tag: string, attrs: Record<string, string | number> = {}, children: string = "") => {
  const attr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ");
  return `<${tag} ${attr}>${children}</${tag}>`;
};

/** お花の頭（中心が 0,0） */
function flowerHead(kind: FlowerKind, color: string, r: number): string {
  if (kind === "daisy") {
    let petals = "";
    for (let i = 0; i < 10; i += 1) petals += svg("ellipse", { cx: 0, cy: -r * 0.55, rx: r * 0.24, ry: r * 0.55, fill: "#fffaf3", stroke: "#efe3d3", "stroke-width": 0.4, transform: `rotate(${i * 36})` });
    return petals + svg("circle", { r: r * 0.36, fill: "#f5c84f" }) + svg("circle", { r: r * 0.36, fill: "none", stroke: "#e2a93a", "stroke-width": 0.8 });
  }
  if (kind === "tulip") {
    return (
      svg("path", { d: `M${-r * 0.75} ${-r * 0.2} C${-r * 0.8} ${r * 0.7} ${r * 0.8} ${r * 0.7} ${r * 0.75} ${-r * 0.2} L${r * 0.42} ${-r * 0.75} L${r * 0.12} ${-r * 0.3} L0 ${-r * 0.85} L${-r * 0.12} ${-r * 0.3} L${-r * 0.42} ${-r * 0.75} Z`, fill: color }) +
      svg("path", { d: `M${-r * 0.3} ${-r * 0.1} C${-r * 0.25} ${r * 0.45} ${r * 0.25} ${r * 0.45} ${r * 0.3} ${-r * 0.1}`, fill: "none", stroke: "rgba(255,255,255,0.45)", "stroke-width": 0.9, "stroke-linecap": "round" })
    );
  }
  if (kind === "pompom") {
    let dots = "";
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2;
      dots += svg("circle", { cx: (Math.cos(a) * r * 0.5).toFixed(2), cy: (Math.sin(a) * r * 0.5).toFixed(2), r: r * 0.42, fill: color });
    }
    return dots + svg("circle", { r: r * 0.45, fill: color }) + svg("circle", { cx: -r * 0.2, cy: -r * 0.25, r: r * 0.16, fill: "rgba(255,255,255,0.55)" });
  }
  let petals = "";
  for (let i = 0; i < 5; i += 1) petals += svg("ellipse", { cx: 0, cy: -r * 0.5, rx: r * 0.42, ry: r * 0.55, fill: color, transform: `rotate(${i * 72})` });
  return petals + svg("circle", { r: r * 0.28, fill: "#fff6d8" }) + svg("circle", { r: r * 0.13, fill: "#e9b44c" });
}

const leafPath = (len: number) => `M0 0 C${len * 0.3} ${-len * 0.36} ${len * 0.78} ${-len * 0.34} ${len} 0 C${len * 0.78} ${len * 0.34} ${len * 0.3} ${len * 0.36} 0 0 Z`;

export const mount: LiveMount = (host, { mode, reducedMotion, signals }) => {
  const still = mode === "still" || reducedMotion;
  const root = document.createElement("div");
  root.className = still ? "lb-garden is-still" : "lb-garden";
  host.appendChild(root);

  let steps = signals.steps ?? 0;
  let slots: Slot[] = [];
  let vines: { path: SVGPathElement; length: number }[] = [];
  let butterflies: HTMLElement[] = [];
  let petals: HTMLElement | null = null;

  const build = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    const u = clamp(w / 390, 0.75, 1.3);
    const rand = seededRandom(Math.floor(Date.now() / 86_400_000) % 1000);
    root.innerHTML = "";
    slots = [];
    vines = [];

    // ---- 左右のつる ----
    const vineThresholds: Record<"left" | "right", [number, number][]> = {
      left: [[0.15, 2500], [0.35, 4500], [0.55, 6500], [0.75, 8500]],
      right: [[0.25, 3500], [0.45, 5500], [0.65, 7500], [0.85, 9500]],
    };
    for (const side of ["left", "right"] as const) {
      const seed = side === "left" ? 0.4 : 2.1;
      const points: [number, number][] = [];
      for (let y = h + 4; y >= -10; y -= 10) points.push([10 + 4.5 * Math.sin(y * 0.03 + seed) + 2 * Math.sin(y * 0.071 + seed * 2), y]);
      let length = 0;
      for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
      const d = `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;
      let leaves = "";
      const xAt = (y: number) => 10 + 4.5 * Math.sin(y * 0.03 + seed) + 2 * Math.sin(y * 0.071 + seed * 2);
      for (let y = h - 18, k = 0; y > 10; y -= 26 * u, k += 1) {
        const left = k % 2 === 0;
        const at = (h - y) / h;
        leaves += `<g transform="translate(${xAt(y).toFixed(1)} ${y.toFixed(1)}) rotate(${left ? -145 : -35})"><path class="lb-grow lb-vine-leaf" data-at="${at.toFixed(3)}" d="${leafPath(13 * u)}" fill="${k % 3 === 0 ? "#8fc27a" : "#7db369"}"/></g>`;
      }
      let blooms = "";
      for (const [at, threshold] of vineThresholds[side]) {
        const y = h * (1 - at);
        blooms += `<g transform="translate(${xAt(y).toFixed(1)} ${y.toFixed(1)})"><g class="lb-grow lb-vine-flower" data-threshold="${threshold}">${flowerHead("star", COLORS[Math.floor(rand() * COLORS.length)]!, 9 * u)}</g></g>`;
      }
      const el = document.createElement("div");
      el.className = `lb-vine lb-vine-${side}`;
      el.innerHTML = `<svg xmlns="${SVG_NS}" width="44" height="${h}" viewBox="0 0 44 ${h}"><path class="lb-vine-stem" d="${d}" fill="none" stroke="#79ad63" stroke-width="${(2.4 * u).toFixed(1)}" stroke-linecap="round" stroke-dasharray="${length.toFixed(0)} ${length.toFixed(0)}" stroke-dashoffset="${length.toFixed(0)}"/>${leaves}${blooms}</svg>`;
      root.appendChild(el);
      const path = el.querySelector("path.lb-vine-stem") as SVGPathElement | null;
      if (path) vines.push({ path, length });
      el.querySelectorAll<SVGGElement>(".lb-vine-flower").forEach((g) => slots.push({ threshold: Number(g.dataset.threshold), el: g }));
    }

    // ---- 下の花畑 ----
    const m = clamp(h * 0.24, 140, 230);
    const top = (x: number) => m * 0.6 - m * 0.08 * Math.sin((x / w) * Math.PI * 1.6 + 0.6) - m * 0.04 * Math.sin((x / w) * Math.PI * 4.2);
    let hill = `M0 ${top(0).toFixed(1)}`;
    for (let x = 0; x <= w; x += 8) hill += ` L${x} ${top(x).toFixed(1)}`;
    hill += ` L${w} ${m} L0 ${m} Z`;
    let grass = "";
    for (let x = 2; x < w; x += 5 + rand() * 4) {
      const y = top(x) + 2;
      const g = (6 + rand() * 7) * u;
      const lean = (rand() - 0.5) * 5;
      grass += `M${(x - 1.6).toFixed(1)} ${y.toFixed(1)} Q${(x + lean * 0.4).toFixed(1)} ${(y - g * 0.6).toFixed(1)} ${(x + lean).toFixed(1)} ${(y - g).toFixed(1)} Q${(x + lean * 0.3 + 0.8).toFixed(1)} ${(y - g * 0.5).toFixed(1)} ${(x + 1.6).toFixed(1)} ${y.toFixed(1)}Z `;
    }
    const meadowThresholds = [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
    const kinds: FlowerKind[] = ["daisy", "tulip", "pompom", "star"];
    const xs = meadowThresholds.map((_, i) => ((i + 0.5) / meadowThresholds.length) * w + (rand() - 0.5) * (w / meadowThresholds.length) * 0.7);
    // 咲く順番は、左右にちらばるようにまぜる
    const order = [5, 2, 9, 0, 7, 3, 11, 1, 6, 10, 4, 8];
    let sprouts = "";
    let flowers = "";
    order.forEach((xi, i) => {
      const x = xs[xi]!;
      const base = top(x) + 6 + rand() * 10;
      const stem = (30 + rand() * 30) * u;
      const lean = (rand() - 0.5) * 8;
      const kind = kinds[(xi + i) % kinds.length]!;
      const color = COLORS[(xi * 7 + i) % COLORS.length]!;
      const head = (kind === "daisy" ? 12 : 11) * u * (0.9 + rand() * 0.25);
      const threshold = meadowThresholds[i]!;
      sprouts += `<g class="lb-sprout" data-threshold="${threshold}" transform="translate(${x.toFixed(1)} ${base.toFixed(1)})"><path d="M0 0 L0 -6" stroke="#86b96f" stroke-width="1.4"/><path d="${leafPath(6 * u)}" transform="translate(0 -5) rotate(-150)" fill="#9ccc85"/><path d="${leafPath(6 * u)}" transform="translate(0 -5) rotate(-30)" fill="#8fc27a"/></g>`;
      // お花は1本ずつの要素にして、ゆれる・咲くを画面の合成だけで動かす（毎回の描き直しをしない）
      const half = Math.ceil(head + Math.abs(lean) + 10 * u);
      const height = Math.ceil(stem + head + 3);
      const svgFlower =
        `<svg xmlns="${SVG_NS}" width="${half * 2}" height="${height}" viewBox="${-half} ${-height} ${half * 2} ${height}">` +
        `<path d="M0 0 Q${(lean * 0.2).toFixed(1)} ${(-stem * 0.5).toFixed(1)} ${lean.toFixed(1)} ${(-stem).toFixed(1)}" fill="none" stroke="#79ad63" stroke-width="${(1.7 * u).toFixed(1)}" stroke-linecap="round"/>` +
        `<path d="${leafPath(9 * u)}" transform="translate(${(lean * 0.15).toFixed(1)} ${(-stem * 0.32).toFixed(1)}) rotate(-28)" fill="#8fc27a"/>` +
        `<path d="${leafPath(8 * u)}" transform="translate(${(lean * 0.25).toFixed(1)} ${(-stem * 0.5).toFixed(1)}) rotate(-152)" fill="#7db369"/>` +
        `<g transform="translate(${lean.toFixed(1)} ${(-stem).toFixed(1)})">${flowerHead(kind, color, head)}</g>` +
        `</svg>`;
      flowers +=
        `<div class="lb-flower" style="left:${(x - half).toFixed(1)}px;top:${(base - height).toFixed(1)}px;width:${half * 2}px;height:${height}px;animation-duration:${(3.2 + rand() * 2).toFixed(2)}s;animation-delay:${(-rand() * 4).toFixed(2)}s">` +
        `<div class="lb-bloom" data-threshold="${threshold}">${svgFlower}</div></div>`;
    });
    const meadow = document.createElement("div");
    meadow.className = "lb-meadow";
    meadow.style.height = `${m}px`;
    meadow.innerHTML =
      `<svg xmlns="${SVG_NS}" width="${w}" height="${m}" viewBox="0 0 ${w} ${m}">` +
      `<path d="M0 ${(m * 0.42).toFixed(1)} C${w * 0.3} ${(m * 0.22).toFixed(1)} ${w * 0.62} ${(m * 0.5).toFixed(1)} ${w} ${(m * 0.3).toFixed(1)} L${w} ${m} L0 ${m} Z" fill="#d9ebc6"/>` +
      `<path d="${hill}" fill="#bfdba6"/>` +
      `<path d="${grass}" fill="#a9cd8e"/>` +
      sprouts +
      `</svg>` +
      flowers;
    root.appendChild(meadow);
    meadow.querySelectorAll<HTMLElement>(".lb-bloom").forEach((el) => {
      const sprout = meadow.querySelector<SVGGElement>(`.lb-sprout[data-threshold="${el.dataset.threshold}"]`) ?? undefined;
      slots.push({ threshold: Number(el.dataset.threshold), el, sprout });
    });

    // ---- ちょうちょ（羽は CSS の図形。飛ぶ道すじ・ぱたぱたも CSS だけで動かし、スクリプトは使わない） ----
    butterflies = [0, 1].map((i) => {
      const el = document.createElement("div");
      el.className = `lb-fly lb-fly-${i + 1}`;
      const [a, b] = i === 0 ? ["#f7d36b", "#f2a75b"] : ["#a9cff2", "#6fa4dc"];
      el.style.setProperty("--a", a);
      el.style.setProperty("--b", b);
      el.innerHTML = `<div class="lb-fly-y"><div class="lb-butterfly"><i class="lb-wing lb-wing-l"></i><i class="lb-wing lb-wing-r"></i><b class="lb-body"></b></div></div>`;
      root.appendChild(el);
      return el;
    });

    // ---- 満開のときの花びら（縦に長い通り道ごと、上から下へ動かす） ----
    petals = document.createElement("div");
    petals.className = "lb-petals";
    let petalHtml = "";
    for (let i = 0; i < 12; i += 1) {
      const fall = still ? `transform:translateY(${(rand() * 90).toFixed(1)}%);` : `animation-duration:${(7 + rand() * 6).toFixed(1)}s;animation-delay:${(-rand() * 12).toFixed(1)}s;`;
      petalHtml += `<span class="lb-petal" style="left:${(rand() * 100).toFixed(1)}%;${fall}"><i style="background:${COLORS[i % COLORS.length]};animation-duration:${(2.4 + rand() * 1.6).toFixed(1)}s;animation-delay:${(-rand() * 3).toFixed(1)}s"></i></span>`;
    }
    petals.innerHTML = petalHtml;
    root.appendChild(petals);

    apply();
  };

  /** 歩数に合わせて、つるの長さ・咲いているお花・ちょうちょ・花びらを切りかえる */
  const apply = () => {
    const progress = clamp(steps / GOAL, 0, 1);
    for (const vine of vines) {
      vine.path.style.strokeDashoffset = String(vine.length * (1 - (0.04 + progress * 0.96)));
    }
    root.querySelectorAll<SVGPathElement>(".lb-vine-leaf").forEach((leaf) => {
      leaf.classList.toggle("is-on", Number(leaf.dataset.at) <= 0.04 + progress * 0.96);
    });
    // いっしょに咲くお花は、少しずつずらして咲かせる
    let opening = 0;
    for (const slot of [...slots].sort((a, b) => a.threshold - b.threshold)) {
      const open = steps >= slot.threshold;
      if (open && !slot.el.classList.contains("is-on")) {
        slot.el.style.transitionDelay = still ? "" : `${(0.6 + opening * 0.12).toFixed(2)}s`;
        opening += 1;
      }
      slot.el.classList.toggle("is-on", open);
      slot.sprout?.classList.toggle("is-off", open);
    }
    butterflies.forEach((b, i) => b.classList.toggle("is-on", steps >= (i === 0 ? 5000 : 8000)));
    petals?.classList.toggle("is-on", steps >= GOAL);
  };

  let lastW = host.clientWidth;
  let lastH = host.clientHeight;
  build();
  const observer = new ResizeObserver(() => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    // 高さが少し変わるだけ（スマホのアドレスバーの出入り）なら作り直さない
    if (Math.abs(w - lastW) < 1 && Math.abs(h - lastH) < 80) return;
    lastW = w;
    lastH = h;
    build();
  });
  observer.observe(host);

  return {
    update: (next) => {
      const value = next.steps ?? 0;
      if (value === steps) return;
      steps = value;
      apply();
    },
    destroy: () => {
      observer.disconnect();
      root.remove();
    },
  };
};
