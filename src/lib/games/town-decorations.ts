import type { ParkPart } from "./town-builder";

type Point = { x: number; y: number };
const ITEMS = new Set(["cherry", "pine", "hedge", "pond", "gazebo", "picnic", "swings", "sandbox", "sculpture", "clock", "trash", "bikeRack", "stones", "arch", "vending", "canopy", "planter"]);
const iso = (x: number, y: number, z = 0): Point => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
const noise = (i: number) => { const v = Math.sin(i * 71.3 + 19.7) * 42135.7; return v - Math.floor(v); };

/** The same model is used for the placed item, construction ghost and shop icon. */
export function drawTownDecoration(c: CanvasRenderingContext2D, kind: string, x: number, y: number, rotation = 0, night = false): boolean {
  if (!ITEMS.has(kind)) return false;
  const world = (u: number, v: number) => {
    const r = ((rotation % 4) + 4) % 4;
    return r === 1 ? { x: x + 1 - v, y: y + u } : r === 2 ? { x: x + 1 - u, y: y + 1 - v } : r === 3 ? { x: x + v, y: y + 1 - u } : { x: x + u, y: y + v };
  };
  const at = (u: number, v: number, z = 0) => { const p = world(u, v); return iso(p.x, p.y, z); };
  const poly = (ps: Point[], fill: string | CanvasGradient, stroke?: string, width = .5) => {
    c.beginPath(); ps.forEach((p, j) => j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  };
  const line = (a: Point, b: Point, color: string, width = .8) => { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.strokeStyle = color; c.lineWidth = width; c.stroke(); };
  const oval = (p: Point, rx: number, ry: number, color: string | CanvasGradient) => { c.beginPath(); c.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill(); };
  const visibleFaces = (u: number, v: number, w: number, d: number) => {
    const vertices = [[u, v], [u + w, v], [u + w, v + d], [u, v + d]].map(([a, b]) => ({ u: a!, v: b!, p: world(a!, b!) }));
    return vertices.map((a, j) => ({ a, b: vertices[(j + 1) % 4]! })).sort((a, b) => a.a.p.x + a.a.p.y + a.b.p.x + a.b.p.y - b.a.p.x - b.a.p.y - b.b.p.x - b.b.p.y).slice(2);
  };
  const box = (u: number, v: number, w: number, d: number, h: number, colors: string[], z = 1) => {
    const sides = visibleFaces(u, v, w, d);
    for (const { a, b } of sides) {
      // Sunlight is fixed in world space, independent of the item's rotation.
      const shade = Math.abs(a.p.x - b.p.x) < 1e-6 ? 1 : 0;
      poly([at(a.u, a.v, z), at(b.u, b.v, z), at(b.u, b.v, z + h), at(a.u, a.v, z + h)], colors[shade]!);
    }
    poly([at(u, v, z + h), at(u + w, v, z + h), at(u + w, v + d, z + h), at(u, v + d, z + h)], colors[2]!);
    for (const { a, b } of sides) line(at(a.u, a.v, z + h), at(b.u, b.v, z + h), "#f4edcb60", .45);
    return sides;
  };
  const assemble = (parts: { u: number; v: number; paint: () => void }[]) => parts.map(part => ({ ...part, p: world(part.u, part.v) })).sort((a, b) => a.p.x + a.p.y - b.p.x - b.p.y).forEach(part => part.paint());
  const wood = ["#b18b63", "#826345", "#d4b28a"], stone = ["#a8b09e", "#7c9289", "#d4d6bb"], metal = ["#6c8c80", "#476b65", "#adc1a7"];
  const leaf = (p: Point, rx: number, ry: number, palette: string[]) => { const g = c.createRadialGradient(p.x - rx * .3, p.y - ry * .4, 0, p.x, p.y, Math.max(rx, ry) * 1.2); g.addColorStop(0, palette[2]!); g.addColorStop(.55, palette[1]!); g.addColorStop(1, palette[0]!); oval(p, rx, ry, g); };
  const bloom = (p: Point, color: string, r = 1) => { for (let j = 0; j < 5; j++) { const a = j * Math.PI * .4; oval({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * .7 }, r * .65, r * .5, color); } oval(p, r * .32, r * .25, "#f6d786"); };
  if (kind !== "stones") oval(at(.53, .58), 17, 6.8, "#294f3c24");
  if (kind === "cherry") {
    box(.40, .40, .20, .20, 1, stone); line(at(.5, .5, 1), at(.49, .5, 21), "#8c7359", 2.3); line(at(.49, .5, 12), at(.3, .48, 24), "#8c7359", 1); line(at(.49, .5, 14), at(.72, .53, 24), "#8c7359", 1);
    for (const [u, v, z, r] of [[.28, .48, 22, 7], [.64, .52, 24, 8], [.45, .5, 30, 8.5], [.7, .48, 29, 5.5], [.32, .46, 29, 5.8]]) leaf(at(u!, v!, z), r!, r! * .84, ["#c77996", "#e4a7b8", "#ffe0df"]);
    for (let j = 0; j < 20; j++) bloom(at(.28 + noise(j + 1) * .43, .47 + noise(j + 43) * .08, 20 + noise(j + 18) * 13), j % 3 ? "#f7d6d9" : "#f9e5d7", .65);
    for (let j = 0; j < 8; j++) oval(at(.25 + noise(j * 3) * .6, .23 + noise(j * 7) * .6, 1), .65, .4, "#e8b8bf");
  } else if (kind === "pine") {
    line(at(.5, .5, 1), at(.5, .5, 15), "#827053", 2);
    for (let j = 0; j < 4; j++) { const z = 8 + j * 5.5, q = at(.5, .5, z), tip = at(.5, .5, z + 12), w = 11 - j * 2; poly([{ x: q.x - w, y: q.y }, tip, { x: q.x + w, y: q.y }, { x: q.x + w * .2, y: q.y + 3 }], j % 2 ? "#397757" : "#326e50"); poly([{ x: q.x - w, y: q.y }, tip, { x: q.x - 1, y: q.y + 1 }], "#6a9d6a"); line({ x: q.x - w + 1, y: q.y - .3 }, { x: q.x + 3, y: q.y + 2 }, "#9bb88555", .6); }
  } else if (kind === "hedge") {
    box(.1, .34, .8, .3, 2, stone); box(.12, .36, .76, .26, 6, ["#61815a", "#406b4e", "#82a269"], 3);
    for (let j = 0; j < 13; j++) leaf(at(.17 + j * .055, .48, 9), 2.2, 2.3, ["#4c7652", "#79a064", "#a1bb7d"]);
  } else if (kind === "stones") {
    for (let j = 0; j < 5; j++) { const u = .15 + j * .15, v = .45 + Math.sin(j * 1.5) * .08; const q = at(u, v, 1.5); oval({ x: q.x, y: q.y + 1 }, 4, 2, "#879276"); oval(q, 4, 2, "#d6ceb1"); line({ x: q.x - 2, y: q.y - .4 }, { x: q.x + 1, y: q.y - .6 }, "#ede4c9", .6); }
  } else if (kind === "pond") {
    const q = at(.5, .5, 1); oval({ x: q.x, y: q.y + 1 }, 21, 10, "#7d9071"); oval(q, 21, 10, "#c6c6a2");
    const g = c.createRadialGradient(q.x - 5, q.y - 3, 1, q.x, q.y, 21); g.addColorStop(0, "#b5dfcc"); g.addColorStop(.5, "#6db8b0"); g.addColorStop(1, "#447f83"); oval(q, 17.8, 8, g);
    for (let j = 0; j < 12; j++) { const a = j * Math.PI / 6; oval({ x: q.x + Math.cos(a) * 19.8, y: q.y + Math.sin(a) * 9 }, 2.5, 1.5, j % 2 ? "#d8d5b4" : "#a8b293"); }
    for (const [u, v] of [[.40, .42], [.63, .55], [.39, .66]]) { const p = at(u!, v!, 1.4); oval(p, 2.7, 1.2, "#80a969"); line(p, { x: p.x + 1.8, y: p.y + .7 }, "#b3c68b", .45); } bloom(at(.40, .42, 3), "#e7b7b6", .8);
    for (let j = 0; j < 5; j++) { line(at(.76 + j * .02, .27, 1), at(.76 + j * .02, .27, 6 + j % 2 * 2), "#6f9459", .55); }
    line({ x: q.x - 8, y: q.y - 2 }, { x: q.x - 2, y: q.y - 2 }, "#d4eee0a0", .8);
  } else if (kind === "picnic") {
    assemble([
      ...[.18, .76].map(v => ({ u: .50, v: v + .04, paint: () => {
        for (const u of [.26, .68]) box(u, v + .01, .04, .055, 4, metal);
        for (let j = 0; j < 2; j++) box(.16, v + j * .043, .68, .036, 1, wood, 5);
      } })),
      { u: .5, v: .5, paint: () => {
        for (const u of [.29, .66]) { line(at(u, .30, 1), at(u, .55, 10), "#8e7352", 1.5); line(at(u, .75, 1), at(u, .45, 10), "#8e7352", 1.5); }
        for (let j = 0; j < 4; j++) box(.18, .36 + j * .07, .64, .056, 1, wood, 10);
        oval(at(.44, .46, 11.1), 1.8, .8, "#e8ddbe"); box(.55, .50, .05, .05, 1.5, ["#a48b65", "#8d7959", "#e6cc97"], 11);
      } },
    ]);
  } else if (kind === "gazebo") {
    // Assemble the shelter from the deck upwards. Furniture belongs beneath
    // the roof, and every timber member meets a post, beam or floor.
    box(.12, .12, .76, .76, 2, wood);
    for (let j = 1; j < 8; j++) line(at(.12 + j * .095, .12, 3.05), at(.12 + j * .095, .88, 3.05), "#927857", .45);
    poly([at(.15, .15, 3.1), at(.85, .15, 3.1), at(.85, .85, 3.1), at(.15, .85, 3.1)], "#59613e24");
    box(.38, .88, .30, .07, .8, wood);

    const structure: { depth: number; paint: () => void }[] = [];
    const timber = (u: number, v: number, paint: () => void) => {
      const p = world(u, v); structure.push({ depth: p.x + p.y, paint });
    };
    const bench = (u: number, v: number, alongX: boolean) => {
      const block = (a: number, b: number, w: number, d: number, h: number, z: number) =>
        alongX ? box(u + a, v + b, w, d, h, wood, z) : box(u + b, v + a, d, w, h, wood, z);
      timber(u + (alongX ? .21 : .05), v + (alongX ? .05 : .21), () => {
        for (const a of [.035, .345]) {
          block(a, .025, .04, .05, 3.2, 3);
          block(a + .008, -.025, .025, .03, 8.2, 3);
        }
        for (let j = 0; j < 3; j++) block(0, j * .035, .42, .03, .8, 6.2);
        block(0, -.025, .42, .03, 2, 9.2);
      });
    };
    bench(.32, .25, true); bench(.25, .38, false);
    for (const [u, v] of [[.20, .20], [.80, .20], [.20, .80], [.80, .80]]) {
      timber(u!, v!, () => {
        box(u! - .035, v! - .035, .07, .07, .65, ["#a89475", "#88775c", "#d3bd95"], 3);
        box(u! - .024, v! - .024, .048, .048, 18.85, wood, 3.65);
        const inwardU = u! < .5 ? .13 : -.13, inwardV = v! < .5 ? .13 : -.13;
        line(at(u!, v!, 19), at(u! + inwardU, v!, 23), "#ad8a60", 1.1);
        line(at(u!, v!, 19), at(u!, v! + inwardV, 23), "#95744f", 1.1);
      });
    }
    structure.sort((a, b) => a.depth - b.depth).forEach(part => part.paint());
    const beams = [[.17, .17, .66, .055], [.17, .775, .66, .055], [.17, .225, .055, .55], [.775, .225, .055, .55]];
    beams.sort((a, b) => {
      const p = world(a[0]! + a[2]! / 2, a[1]! + a[3]! / 2), q = world(b[0]! + b[2]! / 2, b[1]! + b[3]! / 2);
      return p.x + p.y - q.x - q.y;
    }).forEach(([u, v, w, d]) => box(u!, v!, w!, d!, 1.8, wood, 22.5));

    const peak = at(.5, .5, 38);
    const corners = [[.08, .08], [.92, .08], [.92, .92], [.08, .92]].map(([u, v]) => ({ u: u!, v: v!, p: world(u!, v!) }));
    const faces = corners.map((a, j) => {
      const b = corners[(j + 1) % 4]!, cx = (a.p.x + b.p.x) / 2 - x - .5, cy = (a.p.y + b.p.y) / 2 - y - .5;
      return { a, b, depth: a.p.x + a.p.y + b.p.x + b.p.y,
        color: cx > .1 ? "#527d69" : cx < -.1 ? "#759a7f" : cy > .1 ? "#7b9f83" : "#9ab497" };
    }).sort((a, b) => a.depth - b.depth);
    for (const { a, b, color } of faces) {
      const left = at(a.u, a.v, 25), right = at(b.u, b.v, 25);
      poly([left, right, peak], color, "#bad0ac70", .45);
      // Tile courses follow the pitch instead of forming a flat diamond.
      const onRoof = (t: number, s: number) => ({ x: peak.x + ((left.x + (right.x - left.x) * s) - peak.x) * t, y: peak.y + ((left.y + (right.y - left.y) * s) - peak.y) * t });
      for (let row = 1; row < 6; row++) {
        const t = row / 6;
        line(onRoof(t, 0), onRoof(t, 1), "#d6dfba3b", .4);
        for (let j = 1; j <= row; j++) {
          const s = (j - (row % 2 ? .5 : 0)) / (row + 1);
          line(onRoof(t, s), onRoof(t + 1 / 6, s), "#365e482e", .35);
        }
      }
    }
    // Only the two camera-facing eaves have a visible fascia.
    for (const { a, b, color } of faces.slice(2)) {
      poly([at(a.u, a.v, 23.8), at(b.u, b.v, 23.8), at(b.u, b.v, 25), at(a.u, a.v, 25)], color, "#3e665459", .4);
      line(at(a.u, a.v, 25), at(b.u, b.v, 25), "#ccdab078", .5);
    }
  } else if (kind === "canopy") {
    box(.10, .12, .8, .76, 2, wood);
    for (let j = 1; j < 7; j++) line(at(.10 + j * .11, .12, 3.1), at(.10 + j * .11, .88, 3.1), "#927857", .5);
    const roofHeight = (v: number) => 19 - 2 * (v - .12) / .76;
    const roofAt = (u: number, v: number, below = 0) => at(u, v, roofHeight(v) - below);
    assemble([[.17, .19], [.83, .19], [.17, .81], [.83, .81]].map(([u, v]) => ({ u: u!, v: v!, paint: () => {
      box(u! - .02, v! - .02, .04, .04, roofHeight(v!) - .6 - 3, wood, 3);
      line(at(u!, v!, roofHeight(v!) - 3), roofAt(u! + (u! < .5 ? .12 : -.12), v!, .7), "#9c7e57", 1);
    } })));
    for (const v of [.19, .81]) box(.17, v - .02, .66, .04, 1, wood, roofHeight(v) - 1.2);
    for (const u of [.17, .83]) line(roofAt(u, .19, .9), roofAt(u, .81, .9), "#ac8c65", 1.3);
    for (const { a, b } of visibleFaces(.10, .12, .8, .76)) poly([roofAt(a.u, a.v, .7), roofAt(b.u, b.v, .7), roofAt(b.u, b.v), roofAt(a.u, a.v)], "#a7a990");
    for (let j = 0; j < 6; j++) poly([roofAt(.10 + j * .8 / 6, .12), roofAt(.10 + (j + 1) * .8 / 6, .12), roofAt(.10 + (j + 1) * .8 / 6, .88), roofAt(.10 + j * .8 / 6, .88)], j % 2 ? "#f0dfbf" : "#a5bfa2");
  } else if (kind === "swings") {
    box(.08, .12, .84, .74, .8, ["#a6ad87", "#8d9c75", "#c5c59a"]);
    assemble([
      ...[.16, .84].map(u => ({ u, v: .49, paint: () => { line(at(u, .22, 1.8), at(u, .48, 26), "#6c8f85", 2); line(at(u, .76, 1.8), at(u, .48, 26), "#517b73", 2); } })),
      ...[.31, .57].map(u => ({ u: u + .055, v: .55, paint: () => {
        for (const a of [0, .11]) line(at(u + a, .48, 25), at(u + a, .55, 7), "#d6d7b9", .65);
        box(u - .01, .49, .13, .14, 1, ["#be9167", "#926b4e", "#e0b787"], 6);
      } })),
    ]);
    line(at(.12, .48, 26), at(.88, .48, 26), "#9ebba6", 2);
  } else if (kind === "sandbox") {
    box(.10, .15, .8, .7, 2, ["#ae9270", "#8b775a", "#d3b791"]); box(.16, .21, .68, .58, .2, ["#bea56d", "#a79265", "#e4ce9d"], 3);
    for (let j = 0; j < 18; j++) oval(at(.20 + noise(j) * .58, .25 + noise(j + 17) * .48, 3.2), .55, .3, j % 2 ? "#bfa76f" : "#f4dfb6");
    box(.25, .32, .11, .09, 3, ["#b3a47a", "#96835e", "#e8d7a8"], 3); box(.26, .33, .025, .025, 2, stone, 6);
    const q = at(.64, .63, 5.5), foot = at(.64, .63, 3.2);
    poly([{ x: foot.x - 1.5, y: foot.y }, { x: foot.x + 1.5, y: foot.y }, { x: q.x + 2.2, y: q.y }, { x: q.x - 2.2, y: q.y }], "#bb876b");
    oval(q, 2.2, 1, "#e1b28a"); oval(q, 1.55, .65, "#987256");
    c.beginPath(); c.moveTo(q.x - 1.7, q.y); c.quadraticCurveTo(q.x, q.y - 4, q.x + 1.7, q.y); c.strokeStyle = "#9a8364"; c.lineWidth = .6; c.stroke();
  } else if (kind === "arch") {
    for (const u of [.17, .83]) { box(u - .05, .41, .10, .18, 3, stone); box(u - .015, .47, .03, .03, 21, metal, 4); }
    const points = Array.from({ length: 13 }, (_, j) => { const t = j / 12; return at(.17 + .66 * t, .49, 23 + Math.sin(t * Math.PI) * 8); });
    for (let j = 1; j < points.length; j++) line(points[j - 1]!, points[j]!, "#7e9e79", 1.8);
    for (let j = 0; j < 18; j++) { const t = j / 17, q = at(.17 + .66 * t, .49, 22 + Math.sin(t * Math.PI) * 8); leaf(q, 1.9, 1.5, ["#4c7651", "#80a36a", "#b2c88a"]); if (j % 2 === 0) bloom(q, j % 4 ? "#e5a7ad" : "#edce91", 1.05); }
  } else if (kind === "sculpture") {
    box(.30, .30, .40, .40, 3, stone); box(.37, .37, .26, .26, 6, stone, 4);
    // A solid bent prism meets the plinth and keeps its shape from every side.
    const sections = [[.43, .455, .14, .09, 10], [.38, .465, .14, .07, 20], [.53, .435, .08, .07, 26]].map(([u, v, w, d, z]) => ({ z: z!, corners: [[u!, v!], [u! + w!, v!], [u! + w!, v! + d!], [u!, v! + d!]] }));
    for (let k = 1; k < sections.length; k++) {
      const lower = sections[k - 1]!, upper = sections[k]!;
      const sides = lower.corners.map(([u, v], j) => ({ j, p: world((u! + lower.corners[(j + 1) % 4]![0]!) / 2, (v! + lower.corners[(j + 1) % 4]![1]!) / 2) })).sort((a, b) => a.p.x + a.p.y - b.p.x - b.p.y).slice(2);
      for (const { j } of sides) {
        const n = (j + 1) % 4, a = lower.corners[j]!, b = lower.corners[n]!, t = upper.corners[n]!, s = upper.corners[j]!;
        const p = world(a[0]!, a[1]!), q = world(b[0]!, b[1]!);
        poly([at(a[0]!, a[1]!, lower.z), at(b[0]!, b[1]!, lower.z), at(t[0]!, t[1]!, upper.z), at(s[0]!, s[1]!, upper.z)], Math.abs(p.x - q.x) < 1e-6 ? "#648779" : "#9ab5a1", "#c4d5b780", .45);
      }
    }
    oval(at(.57, .47, 28), 3.4, 3.4, "#b9c9a8");
  } else if (kind === "clock") {
    box(.37, .37, .26, .26, 2, stone); box(.46, .46, .08, .08, 22, metal, 3);
    const faces = box(.37, .38, .26, .24, 8, metal, 25);
    box(.35, .36, .30, .28, 1, ["#64796b", "#425f56", "#b1b998"], 33);
    for (const { a, b } of faces) {
      const u = (a.u + b.u) / 2, v = (a.v + b.v) / 2, du = Math.abs(a.u - b.u) > .1 ? .08 : 0, dv = du ? 0 : .08;
      const dial = (across: number, high: number) => at(u + du * across, v + dv * across, 29 + high * 2.9);
      poly(Array.from({ length: 32 }, (_, j) => { const t = j * Math.PI / 16; return dial(Math.cos(t), Math.sin(t)); }), night ? "#ffdf9d" : "#f4edd0", "#647b68", .35);
      for (let j = 0; j < 12; j++) { const t = j * Math.PI / 6; line(dial(Math.cos(t) * .77, Math.sin(t) * .77), dial(Math.cos(t) * .87, Math.sin(t) * .87), "#71806a", .35); }
      line(dial(0, 0), dial(.5, .55), "#4d695a", .6); line(dial(0, 0), dial(-.5, .10), "#4d695a", .6);
    }
  } else if (kind === "trash") {
    const faces = box(.34, .37, .32, .26, 10, ["#7e9988", "#577b6b", "#a5b69a"]); box(.31, .34, .38, .32, 1.5, ["#687f70", "#425f54", "#9dab90"], 11);
    for (const { a, b } of faces) for (let j = 1; j < 5; j++) {
      const u = a.u + (b.u - a.u) * j / 5, v = a.v + (b.v - a.v) * j / 5;
      line(at(u, v, 2), at(u, v, 10), "#c2c8a859", .5);
    }
    poly([at(.40, .43, 12.6), at(.60, .43, 12.6), at(.60, .53, 12.6), at(.40, .53, 12.6)], "#354e42");
  } else if (kind === "bikeRack") {
    box(.13, .23, .74, .50, 1, stone);
    assemble([
      ...[.24, .48, .72].map(u => ({ u, v: .49, paint: () => { line(at(u, .33, 2), at(u, .33, 9), "#819e93", 1.3); line(at(u, .33, 9), at(u, .65, 9), "#adc3b0", 1.3); line(at(u, .65, 9), at(u, .65, 2), "#587f75", 1.3); } })),
      { u: .30, v: .52, paint: () => {
        for (const v of [.36, .69]) {
          poly(Array.from({ length: 32 }, (_, j) => { const t = j * Math.PI / 16; return at(.30, v + Math.cos(t) * .078, 5 + Math.sin(t) * 3); }), "#ffffff00", "#53685b", .7);
          for (let j = 0; j < 6; j++) { const t = j * Math.PI / 3; line(at(.30, v, 5), at(.30, v + Math.cos(t) * .071, 5 + Math.sin(t) * 2.7), "#a7b4a455", .35); }
        }
        const rear = at(.30, .36, 5), front = at(.30, .69, 5), crank = at(.30, .52, 5.5), seat = at(.30, .47, 9), head = at(.30, .62, 9);
        for (const [a, b] of [[rear, seat], [seat, crank], [crank, rear], [seat, head], [head, crank], [head, front]]) line(a!, b!, "#c79872", .9);
        line(at(.30, .43, 9.5), at(.30, .50, 9.5), "#5d7669", 1);
        line(head, at(.30, .64, 10.5), "#6f8c7a", .7); line(at(.30, .61, 10.5), at(.30, .67, 10.5), "#6f8c7a", .8);
      } },
    ]);
  } else if (kind === "vending") {
    const faces = box(.27, .31, .46, .34, 23, ["#a7bab0", "#688d85", "#d9dac4"]);
    if (faces.some(({ a, b }) => Math.abs(a.v - .65) < 1e-6 && Math.abs(b.v - .65) < 1e-6)) {
      poly([at(.31, .655, 8), at(.60, .655, 8), at(.60, .655, 20), at(.31, .655, 20)], night ? "#c9e6c3" : "#6a9c9d");
      for (let row = 0; row < 3; row++) for (let j = 0; j < 4; j++) { const u = .335 + j * .062, z = 10 + row * 3.4; line(at(u, .66, z), at(u, .66, z + 2), ["#e5be7c", "#d98b85", "#dbe4bf", "#8fb2aa"][j]!, 1.3); }
      poly([at(.33, .66, 2), at(.59, .66, 2), at(.59, .66, 5), at(.33, .66, 5)], "#3b5c54"); for (const z of [9, 12, 15]) oval(at(.65, .66, z), .7, .7, "#e2dcb5");
    }
    for (const { a, b } of faces) if (Math.abs(a.u - b.u) < 1e-6) for (let j = 0; j < 4; j++) line(at(a.u, .40, 5 + j), at(a.u, .55, 5 + j), "#567c705c", .5);
  } else if (kind === "planter") {
    box(.31, .34, .38, .32, 7, ["#bf9d79", "#927856", "#dbbc94"]); box(.28, .31, .44, .38, 1.5, ["#c9ab88", "#a68b69", "#e8ccaa"], 8); oval(at(.50, .50, 9.6), 5.3, 2.5, "#6f7751");
    for (let j = 0; j < 7; j++) { const a = j * Math.PI * 2 / 7, p = at(.50 + Math.cos(a) * .09, .50 + Math.sin(a) * .09, 13 + j % 3 * 2); line(at(.5, .5, 9), p, "#678652", .6); leaf(p, 2.8, 3.1, ["#52774a", "#81a366", "#b2c481"]); }
  }
  return true;
}

export function decorationPickFaces(kind: ParkPart, x: number, y: number, rotation: number): Point[][] {
  const heights: Partial<Record<ParkPart, number>> = { cherry: 36, pine: 37, hedge: 12, gazebo: 34, picnic: 13, swings: 27, sandbox: 8, sculpture: 31, clock: 35, trash: 14, bikeRack: 14, arch: 33, pond: 3, stones: 2 };
  const h = heights[kind]; if (!h) return [];
  const corners = [[.15, .15], [.85, .15], [.85, .85], [.15, .85]].map(([u, v]) => { const r = rotation % 4; const a = r === 1 ? 1 - v! : r === 2 ? 1 - u! : r === 3 ? v! : u!; const b = r === 1 ? u! : r === 2 ? 1 - v! : r === 3 ? 1 - u! : v!; return { x: x + a, y: y + b }; });
  return corners.map((a, j) => { const b = corners[(j + 1) % 4]!; return [iso(a.x, a.y), iso(b.x, b.y), iso(b.x, b.y, h), iso(a.x, a.y, h)]; });
}
