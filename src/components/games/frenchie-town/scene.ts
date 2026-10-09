import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SIZE, TILE, definition, residents, walkingPath, availableIncome, type Building, type Kind } from "@/lib/games/frenchie-town/state";

type Cell = { x: number; z: number };
export type Ghost = Cell & { kind: Kind; rotation: number; valid: boolean; movingId?: string };
type Hooks = { onCell: (cell: Cell) => void; onBuilding: (id: string) => void; onDog: (id: string) => void; onError: () => void };
type Dog = { group: THREE.Group; body: THREE.Group; legs: THREE.Mesh[]; tail: THREE.Mesh; path: Cell[]; x: number; z: number; wait: number; happy: number; id: string };
const world = (cell: number) => (cell - (SIZE - 1) / 2) * TILE;

/** ゲーム画面の中だけで読み込む、小さな本物の3Dジオラマ。 */
export class TownScene {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-12, 12, 12, -12, 0.1, 120);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private buildingsGroup = new THREE.Group();
  private ghostGroup = new THREE.Group();
  private dogGroup = new THREE.Group();
  private models = new Map<string, THREE.Group>();
  private geometries = new Map<string, THREE.BufferGeometry>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private textures: THREE.Texture[] = [];
  private dogs: Dog[] = [];
  private buildings: readonly Building[] = [];
  private coinTokens = new Map<string, THREE.Group>();
  private mills: THREE.Group[] = [];
  private steam: THREE.Mesh[] = [];
  private clouds: THREE.Group[] = [];
  private water: THREE.Mesh;
  private selecting = false;
  private movingId?: string;
  private ray = new THREE.Raycaster();
  private point = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
  private target = new THREE.Vector3();
  private frame = 0;
  private last = 0;
  private time = 0;
  private hidden = false;
  private disposed = false;
  private ro: ResizeObserver;
  private down: { x: number; y: number; id: number; moved: boolean } | null = null;
  private pointerCount = new Set<number>();
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private slowFrames = 0;
  private frameCount = 0;
  private frameTotal = 0;

  constructor(private element: HTMLElement, private hooks: Hooks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.domElement.setAttribute("aria-label", "回して眺められるフレンチーの3Dの街");
    this.renderer.domElement.setAttribute("role", "img");
    this.element.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog("#e4f1ed", 30, 75);
    this.scene.add(new THREE.HemisphereLight(0xfff7e4, 0x71979a, 1.9));
    const sun = new THREE.DirectionalLight(0xffead0, 2.6);
    sun.position.set(-10, 20, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    this.camera.position.set(17, 20, 17);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.2, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.65;
    this.controls.minZoom = 0.68; this.controls.maxZoom = 2.1;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.65;
    this.scene.add(this.buildingsGroup, this.ghostGroup, this.dogGroup);
    this.water = this.mesh(this.scene, this.geometry("box", [80, 0.4, 80]), "#91cfd2", 0, -1.2, 0);
    this.water.receiveShadow = false;
    this.environment();
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerUp);
    canvas.addEventListener("pointercancel", this.pointerCancel);
    canvas.addEventListener("lostpointercapture", this.pointerCancel);
    canvas.addEventListener("webglcontextlost", this.contextLost);
    document.addEventListener("visibilitychange", this.visibility);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(element); this.resize();
    this.renderer.shadowMap.needsUpdate = true;
    this.frame = requestAnimationFrame(this.animate);
  }

  private geometry(kind: string, sizes: number[]): THREE.BufferGeometry {
    const key = `${kind}:${sizes.join(",")}`;
    let geo = this.geometries.get(key);
    if (!geo) {
      if (kind === "box") geo = new THREE.BoxGeometry(...sizes as [number, number, number]);
      else if (kind === "sphere") geo = new THREE.SphereGeometry(sizes[0], sizes[1] ?? 12, sizes[2] ?? 8);
      else if (kind === "cone") geo = new THREE.ConeGeometry(sizes[0], sizes[1], sizes[2] ?? 8);
      else if (kind === "cylinder") geo = new THREE.CylinderGeometry(sizes[0], sizes[1], sizes[2], sizes[3] ?? 12);
      else if (kind === "torus") geo = new THREE.TorusGeometry(sizes[0], sizes[1], 8, 24);
      else geo = new THREE.CircleGeometry(sizes[0], 20);
      this.geometries.set(key, geo);
    }
    return geo;
  }
  private material(color: string): THREE.MeshStandardMaterial {
    let material = this.materials.get(color);
    if (!material) { material = new THREE.MeshStandardMaterial({ color, roughness: 0.85 }); this.materials.set(color, material); }
    return material;
  }
  private mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, this.material(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number) { return this.mesh(parent, this.geometry("box", [w, h, d]), color, x, y, z); }
  private sphere(parent: THREE.Object3D, color: string, x: number, y: number, z: number, radius: number, scale?: [number, number, number]) {
    const mesh = this.mesh(parent, this.geometry("sphere", [radius]), color, x, y, z);
    if (scale) mesh.scale.set(...scale);
    return mesh;
  }

  /** 動かない同色の部品はひとつの描画にまとめる。脚・風車・湯気は別に動かす。 */
  private batchParts(parent: THREE.Group, exclude: readonly THREE.Object3D[] = []) {
    const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of parent.children) {
      if (!(child instanceof THREE.Mesh) || exclude.includes(child) || Array.isArray(child.material) || !(child.material instanceof THREE.MeshStandardMaterial)) continue;
      const meshes = byMaterial.get(child.material) ?? []; meshes.push(child); byMaterial.set(child.material, meshes);
    }
    for (const [material, meshes] of byMaterial) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((mesh) => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
      const geometry = mergeGeometries(parts); parts.forEach((part) => part.dispose());
      if (!geometry) continue;
      const merged = new THREE.Mesh(geometry, material); merged.userData.ownGeometry = true;
      merged.castShadow = meshes.some((mesh) => mesh.castShadow); merged.receiveShadow = meshes.some((mesh) => mesh.receiveShadow);
      meshes.forEach((mesh) => parent.remove(mesh)); parent.add(merged);
    }
  }

  private environment() {
    this.box(this.scene, "#c3ab8c", 0, -0.47, 0, 13.8, 1.1, 13.8);
    this.box(this.scene, "#e1c6a3", 0, -0.03, 0, 13.92, 0.23, 13.92);
    const colors = ["#a3cbb1", "#a8cfb6", "#afd3ba"];
    const cells = new Map<string, { x: number; z: number }[]>();
    for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
      const color = x === 4 || z === 4 ? "#f0dbb5" : colors[(x + z * 2) % colors.length]!;
      const list = cells.get(color) ?? []; list.push({ x, z }); cells.set(color, list);
    }
    for (const [color, list] of cells) {
      const tiles = new THREE.InstancedMesh(this.geometry("box", [TILE - 0.015, 0.12, TILE - 0.015]), this.material(color), list.length);
      const matrix = new THREE.Matrix4();
      list.forEach((c, i) => tiles.setMatrixAt(i, matrix.makeTranslation(world(c.x), 0.045, world(c.z))));
      tiles.receiveShadow = true; this.scene.add(tiles);
    }
    this.mesh(this.scene, this.geometry("cylinder", [1.08, 1.08, 0.04, 32]), "#fae8c9", 0, 0.12, 0);
    const plaza = this.mesh(this.scene, this.geometry("torus", [0.76, 0.025]), "#d5c19d", 0, 0.15, 0); plaza.rotation.x = -Math.PI / 2;
    // 島のへりに丸い石と、海に浮かぶ小さな島。
    for (let i = 0; i < 8; i++) {
      const stone = this.sphere(this.scene, i % 2 ? "#c8b69d" : "#b09e88", -6.8 + i * 1.9, -0.6, 6.92, 0.35, [1.7, 0.8, 1]); stone.castShadow = false;
    }
    for (const [x, z] of [[-12, -9], [11, -12], [13, 10]] as const) {
      this.mesh(this.scene, this.geometry("cylinder", [1.3, 1.5, 0.5, 9]), "#91bbaa", x, -0.65, z);
      const tree = this.model("tree", 1); tree.scale.setScalar(0.65); tree.position.set(x, -0.4, z); this.scene.add(tree);
    }
    for (const [x, y, z] of [[-8, 5, -10], [9, 6, -9], [-12, 4, 7]] as const) {
      const cloud = new THREE.Group();
      for (let i = 0; i < 3; i++) { const part = this.sphere(cloud, "#fffaf0", (i - 1) * 0.65, i === 1 ? 0.2 : 0, 0, 0.62, [1.2, 0.65, 1]); part.castShadow = false; }
      cloud.position.set(x, y, z); this.scene.add(cloud); this.clouds.push(cloud);
    }
    // 小さな桟橋。ゲームのマスの外なので配置を邪魔しない。
    for (let i = 0; i < 5; i++) this.box(this.scene, "#c7a078", 0, -0.18, 7 + i * 0.4, 1.4, 0.15, 0.36);
    for (const x of [-0.6, 0.6]) this.box(this.scene, "#9d7655", x, -0.55, 8.6, 0.12, 1, 0.12);
  }

  private sign(parent: THREE.Group, label: string, color: string, y: number, z: number) {
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 72;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff8e8"; ctx.fillRect(0, 0, 256, 72);
    ctx.fillStyle = color; ctx.font = "bold 39px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, 128, 39);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sign = new THREE.Mesh(this.geometry("box", [0.8, 0.23, 0.026]), material); sign.position.set(0, y, z); parent.add(sign);
  }

  private model(kind: Kind, level: number): THREE.Group {
    const group = new THREE.Group();
    const color = definition(kind).color;
    const ground = this.box(group, "#ead9b4", 0, 0.15, 0, 1.33, 0.08, 1.33);
    ground.receiveShadow = true;
    if (["house", "bakery", "cafe", "windmill"].includes(kind)) {
      const height = kind === "windmill" ? 1.38 : 0.78 + (level - 1) * 0.12;
      const walls = kind === "house" ? "#fff0d7" : kind === "cafe" ? "#f4f2e5" : "#ffedcc";
      this.box(group, walls, 0, 0.2 + height / 2, 0, 1.07, height, 0.95);
      this.box(group, "#886d55", -0.17, 0.42, 0.49, 0.26, 0.5, 0.045);
      this.box(group, "#bdb285", -0.16, 0.42, 0.518, 0.19, 0.42, 0.018);
      this.sphere(group, "#e6c57c", -0.1, 0.42, 0.535, 0.025);
      this.box(group, "#92c8cd", 0.27, 0.55, 0.49, 0.28, 0.26, 0.035);
      for (const x of [0.12, 0.42]) this.box(group, "#fff7e2", x, 0.55, 0.52, 0.025, 0.3, 0.035);
      this.box(group, "#fff7e2", 0.27, 0.55, 0.53, 0.33, 0.025, 0.035);
      const roofY = height + 0.3;
      if (kind === "windmill") {
        this.mesh(group, this.geometry("cone", [0.78, 0.68, 4]), "#bf866a", 0, roofY + 0.24, 0).rotation.y = Math.PI / 4;
        const blades = new THREE.Group(); blades.position.set(0, roofY - 0.1, 0.6);
        for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; this.box(arm, "#e6c7a1", 0, 0.36, 0, 0.13, 0.8, 0.05); this.box(arm, "#fff1d2", 0.12, 0.53, 0.04, 0.29, 0.42, 0.025); blades.add(arm); }
        this.sphere(blades, "#9d7453", 0, 0, 0.08, 0.12); group.add(blades); this.mills.push(blades);
      } else {
        for (const side of [-1, 1]) { const roof = this.box(group, color, side * 0.3, roofY, 0, 0.75, 0.12, 1.2); roof.rotation.z = side * -0.48; }
        this.box(group, color, 0, roofY + 0.17, 0, 0.12, 0.12, 1.2);
        this.box(group, "#b5957b", -0.31, roofY + 0.27, -0.28, 0.17, 0.38, 0.2);
      }
      if (kind === "bakery" || kind === "cafe") {
        const awningY = 0.88;
        for (let i = 0; i < 6; i++) { const awning = this.box(group, i % 2 ? "#fff4df" : color, -0.48 + i * 0.19, awningY, 0.63, 0.19, 0.055, 0.43); awning.rotation.x = 0.18; this.box(group, i % 2 ? "#fff4df" : color, -0.48 + i * 0.19, awningY - 0.07, 0.83, 0.19, 0.1, 0.045); }
        this.sign(group, kind === "bakery" ? "BAKERY" : "CAFE", color, height + 0.03, 0.495);
        if (kind === "bakery") { this.box(group, "#be8a59", 0.47, 0.32, 0.86, 0.29, 0.2, 0.26); for (let i = 0; i < 3; i++) this.sphere(group, "#eac183", 0.4 + i * 0.07, 0.47, 0.86, 0.09, [0.65, 0.65, 1.2]); }
        else { this.mesh(group, this.geometry("cylinder", [0.17, 0.17, 0.04]), color, 0.57, 0.47, 0.84); this.box(group, "#b69a76", 0.57, 0.29, 0.84, 0.045, 0.35, 0.045); }
      }
      // 鉢植えと入口の小さな階段。
      this.box(group, "#d4b68d", -0.18, 0.19, 0.66, 0.4, 0.14, 0.28);
      this.mesh(group, this.geometry("cylinder", [0.1, 0.075, 0.15]), "#d0a184", -0.51, 0.28, 0.55);
      this.sphere(group, "#79b08c", -0.51, 0.42, 0.55, 0.15);
    } else if (kind === "onsen") {
      this.box(group, "#dfc9b0", 0, 0.31, -0.16, 1.18, 0.22, 0.9);
      this.box(group, "#91d2d0", 0, 0.44, -0.14, 0.93, 0.04, 0.67);
      for (const x of [-0.57, 0.57]) this.box(group, "#9d7a64", x, 0.78, -0.44, 0.09, 1.15, 0.09);
      this.box(group, color, 0, 1.38, -0.43, 1.35, 0.13, 0.52);
      this.sign(group, "SPA", "#917394", 0.64, 0.49);
      for (let i = 0; i < 3; i++) { const puff = this.sphere(group, "#f4f5df", (i - 1) * 0.25, 0.72 + i * 0.15, -0.1, 0.14, [0.7, 1.2, 0.7]); puff.castShadow = false; this.steam.push(puff); }
    } else if (kind === "tree") {
      this.mesh(group, this.geometry("cylinder", [0.095, 0.13, 0.8]), "#ae8468", 0, 0.57, 0);
      this.sphere(group, color, 0, 1.2, 0, 0.56, [0.95, 1.1, 0.95]);
      this.sphere(group, "#8dc3a0", -0.2, 1.48, 0.08, 0.32);
      this.sphere(group, "#a6cea8", 0.2, 1.27, 0.29, 0.3);
    } else if (kind === "flowers") {
      this.box(group, "#c3a384", 0, 0.23, 0, 1.12, 0.2, 0.88);
      this.box(group, "#8d785c", 0, 0.34, 0, 1.01, 0.025, 0.77);
      for (let i = 0; i < 6; i++) { const x = (i % 3 - 1) * 0.32, z = (Math.floor(i / 3) - 0.5) * 0.33; this.box(group, "#75a783", x, 0.44, z, 0.025, 0.24, 0.025); this.sphere(group, ["#efafbf", "#f5d481", "#bda9d6"][i % 3]!, x, 0.59, z, 0.14, [1, 0.6, 1]); this.sphere(group, "#fff0ba", x, 0.67, z, 0.045); }
    } else if (kind === "bench") {
      for (const x of [-0.4, 0.4]) { this.box(group, "#697a75", x, 0.35, 0, 0.065, 0.36, 0.45); this.box(group, "#697a75", x, 0.6, -0.22, 0.065, 0.52, 0.065); }
      for (let i = 0; i < 3; i++) this.box(group, color, 0, 0.5, -0.16 + i * 0.14, 1.08, 0.06, 0.11);
      for (let i = 0; i < 2; i++) this.box(group, color, 0, 0.7 + i * 0.15, -0.25, 1.08, 0.1, 0.07);
    } else if (kind === "fountain") {
      this.mesh(group, this.geometry("cylinder", [0.6, 0.65, 0.2, 20]), "#e0d8c2", 0, 0.28, 0);
      this.mesh(group, this.geometry("cylinder", [0.5, 0.5, 0.03, 20]), color, 0, 0.4, 0);
      this.mesh(group, this.geometry("cylinder", [0.075, 0.16, 0.67]), "#dfd7bf", 0, 0.61, 0);
      this.mesh(group, this.geometry("cylinder", [0.25, 0.18, 0.08, 20]), "#eae3cf", 0, 0.93, 0);
      this.sphere(group, color, 0, 1.12, 0, 0.105, [0.6, 1.8, 0.6]);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; this.sphere(group, "#c4e4df", Math.cos(a) * 0.2, 0.8, Math.sin(a) * 0.2, 0.04); }
    } else if (kind === "lamp") {
      this.mesh(group, this.geometry("cylinder", [0.045, 0.07, 1.25]), "#657c74", 0, 0.83, 0);
      this.box(group, "#fff0b7", 0, 1.57, 0, 0.25, 0.3, 0.25);
      this.mesh(group, this.geometry("cone", [0.23, 0.2, 4]), "#68827b", 0, 1.82, 0).rotation.y = Math.PI / 4;
      this.box(group, "#68827b", 0, 1.39, 0, 0.3, 0.07, 0.3);
    }
    if (level > 1) {
      const flag = this.box(group, "#e4be73", 0.59, 0.83, -0.42, 0.025, 1.1, 0.025);
      flag.castShadow = false;
      for (let i = 0; i < level - 1; i++) this.box(group, i ? "#ecaaae" : "#88bec1", 0.66, 1.26 - i * 0.18, -0.42, 0.23, 0.13, 0.03);
    }
    this.batchParts(group, this.steam);
    return group;
  }

  setBuildings(buildings: readonly Building[]) {
    if (this.disposed) return;
    this.buildings = buildings;
    for (const model of this.models.values()) this.disposeModel(model);
    this.models.clear(); this.buildingsGroup.clear(); this.coinTokens.clear(); this.mills = []; this.steam = [];
    for (const b of buildings) {
      const model = this.model(b.kind, b.level); model.position.set(world(b.x), 0, world(b.z)); model.rotation.y = b.rotation * Math.PI / 2;
      model.userData.building = b.id; this.models.set(b.id, model); this.buildingsGroup.add(model);
      if (definition(b.kind).income) {
        const token = new THREE.Group(); const coin = this.mesh(token, this.geometry("cylinder", [0.15, 0.15, 0.045, 20]), "#fff5d8"); coin.rotation.x = Math.PI / 2;
        const ring = this.mesh(token, this.geometry("torus", [0.117, 0.018]), "#e7c785", 0, 0, 0.026); ring.castShadow = false;
        token.position.set(0, 2.1, 0); token.userData.building = b.id; model.add(token); this.coinTokens.set(b.id, token);
      }
    }
    const count = residents({ buildings });
    while (this.dogs.length < count) this.addDog(this.dogs.length);
    while (this.dogs.length > count) { const dog = this.dogs.pop()!; this.disposeModel(dog.group); this.dogGroup.remove(dog.group); }
    for (const dog of this.dogs) {
      dog.path = [];
      if (buildings.some((b) => b.x === Math.round(dog.x) && b.z === Math.round(dog.z))) { dog.x = 4; dog.z = 4; }
    }
    if (this.movingId) { const moving = this.models.get(this.movingId); if (moving) moving.visible = false; }
    this.renderer.shadowMap.needsUpdate = true;
    this.setIncome(Date.now());
  }

  private addDog(index: number) {
    const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
    const fur = ["#fff0d4", "#aea99e", "#d6b395", "#f1e3c9"][index % 4]!;
    const shadow = this.mesh(group, this.geometry("circle", [0.34]), "#8da896", 0, 0.116, 0); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false;
    this.sphere(body, fur, 0, 0.43, 0, 0.31, [1, 0.88, 1.35]);
    this.sphere(body, fur, 0, 0.65, 0.32, 0.28, [1.05, 1, 0.9]);
    // フレブルの大きな立ち耳・短い鼻・片目のぶち。
    for (const x of [-0.18, 0.18]) { const ear = this.sphere(body, fur, x, 0.98, 0.26, 0.13, [0.75, 1.8, 0.62]); ear.rotation.z = x * -0.5; this.sphere(body, "#d99ba0", x, 0.99, 0.318, 0.08, [0.7, 1.7, 0.23]); }
    if (index % 4 === 0) this.sphere(body, "#8c8983", -0.13, 0.71, 0.53, 0.135, [1, 1.2, 0.3]);
    for (const x of [-0.12, 0.12]) { this.sphere(body, "#514b48", x, 0.73, 0.56, 0.043); this.sphere(body, "#fffaf2", x - 0.012, 0.747, 0.589, 0.013); }
    this.sphere(body, "#e6d4bb", 0, 0.59, 0.58, 0.13, [1.3, 0.75, 0.7]);
    this.sphere(body, "#60524b", 0, 0.64, 0.66, 0.063, [1.1, 0.7, 0.6]);
    this.sphere(body, "#df9da8", 0.018, 0.53, 0.66, 0.038, [0.8, 1.2, 0.3]);
    for (const x of [-0.22, 0.22]) this.sphere(body, "#e7b5a1", x, 0.62, 0.5, 0.045, [1, 0.6, 0.4]);
    const collar = this.mesh(body, this.geometry("torus", [0.215, 0.029]), ["#e49c8f", "#89b9bc", "#c5a3c6"][index % 3]!, 0, 0.48, 0.23); collar.rotation.x = -Math.PI / 2;
    const legs: THREE.Mesh[] = [];
    for (const x of [-0.18, 0.18]) for (const z of [-0.2, 0.2]) legs.push(this.sphere(body, fur, x, 0.23, z, 0.115, [0.8, 1.6, 0.9]));
    const tail = this.sphere(body, fur, 0, 0.56, -0.35, 0.09, [0.8, 0.9, 1.2]);
    this.batchParts(body, [...legs, tail]);
    group.scale.setScalar(0.83); group.userData.dog = `dog-${index}`;
    group.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = false; });
    this.dogGroup.add(group);
    const dog = { group, body, legs, tail, path: [], x: 4, z: 3 + index % 3, wait: index * 0.6, happy: 0, id: `dog-${index}` };
    group.position.set(world(dog.x), 0, world(dog.z)); this.dogs.push(dog);
  }

  setIncome(now: number) { for (const b of this.buildings) { const token = this.coinTokens.get(b.id); if (token) token.visible = availableIncome(b, now) > 0; } }
  happyDog(id: string) { const dog = this.dogs.find((d) => d.id === id); if (dog) { dog.happy = 2; dog.wait = 2; } }

  setGhost(ghost: Ghost | null) {
    if (this.disposed) return;
    for (const model of this.ghostGroup.children) this.disposeModel(model);
    this.ghostGroup.clear();
    this.selecting = ghost !== null; this.movingId = ghost?.movingId;
    for (const [id, model] of this.models) model.visible = id !== this.movingId;
    if (ghost) {
      const preview = this.model(ghost.kind, 1); preview.position.set(world(ghost.x), 0.04, world(ghost.z)); preview.rotation.y = ghost.rotation * Math.PI / 2;
      preview.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = false; });
      const marker = this.box(preview, ghost.valid ? "#72c8a2" : "#efaaa0", 0, 0.06, 0, 1.46, 0.1, 1.46); marker.castShadow = false;
      this.ghostGroup.add(preview);
    }
  }
  turn(direction: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 4);
    this.camera.position.copy(this.controls.target).add(offset); this.controls.update();
  }
  zoom(direction: number) { this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * (direction > 0 ? 1.18 : 1 / 1.18), 0.68, 2.1); this.camera.updateProjectionMatrix(); }
  reset() { this.camera.position.set(17, 20, 17); this.camera.zoom = 1; this.camera.updateProjectionMatrix(); this.controls.target.set(0, 0.2, 0); this.controls.update(); }

  private resize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.element.clientWidth), height = Math.max(1, this.element.clientHeight);
    const aspect = width / height;
    const span = aspect < 1 ? 10.6 / aspect : 10.6;
    this.camera.left = -span * aspect; this.camera.right = span * aspect;
    this.camera.top = span; this.camera.bottom = -span;
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height);
  };
  private pointerDown = (event: PointerEvent) => {
    this.pointerCount.add(event.pointerId);
    if (this.pointerCount.size > 1) { if (this.down) this.down.moved = true; return; }
    this.down = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
  };
  private pointerMove = (event: PointerEvent) => {
    if (this.down && (this.down.id !== event.pointerId || Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 7)) this.down.moved = true;
  };
  private pointerCancel = (event: PointerEvent) => { this.pointerCount.delete(event.pointerId); this.down = null; };
  private pointerUp = (event: PointerEvent) => {
    this.pointerCount.delete(event.pointerId);
    const down = this.down; this.down = null;
    if (!down || down.moved || down.id !== event.pointerId || this.pointerCount.size) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.point.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.ray.setFromCamera(this.point, this.camera);
    if (!this.selecting) {
      for (const hit of this.ray.intersectObjects([...this.dogGroup.children, ...this.buildingsGroup.children], true)) {
        let node: THREE.Object3D | null = hit.object;
        while (node) { if (node.userData.dog) { this.hooks.onDog(node.userData.dog); return; } if (node.userData.building) { this.hooks.onBuilding(node.userData.building); return; } node = node.parent; }
      }
    }
    if (!this.ray.ray.intersectPlane(this.plane, this.target)) return;
    const x = Math.round(this.target.x / TILE + 4), z = Math.round(this.target.z / TILE + 4);
    if (x >= 0 && x < SIZE && z >= 0 && z < SIZE) this.hooks.onCell({ x, z });
  };
  private contextLost = (event: Event) => { event.preventDefault(); this.hidden = true; this.hooks.onError(); };
  private visibility = () => { this.hidden = document.hidden; this.last = 0; };
  private animate = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (this.hidden || this.element.clientHeight === 0) { this.last = 0; return; }
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0; this.last = now; this.time += dt;
    // 小さな端末やソフトウェア描画では、操作を保ちながら解像度を調整する。
    if (this.time > 5 && dt > 0) {
      this.frameCount++; this.frameTotal += dt;
      if (this.frameCount >= 45) {
        if (this.frameTotal / this.frameCount > 0.035) this.slowFrames++; else this.slowFrames = 0;
        if (this.slowFrames >= 2 && this.renderer.getPixelRatio() > 0.75) { this.renderer.setPixelRatio(Math.max(0.75, this.renderer.getPixelRatio() * 0.8)); this.resize(); this.slowFrames = 0; }
        this.frameCount = 0; this.frameTotal = 0;
      }
    }
    this.controls.update();
    for (const dog of this.dogs) {
      if (dog.happy > 0) dog.happy = Math.max(0, dog.happy - dt);
      dog.wait = Math.max(0, dog.wait - dt);
      if (!dog.path.length && dog.wait <= 0) {
        const destination = { x: Math.floor(Math.random() * SIZE), z: Math.floor(Math.random() * SIZE) };
        dog.path = walkingPath(this.buildings, { x: dog.x, z: dog.z }, destination);
        dog.wait = 1.2 + Math.random() * 3;
      }
      const next = dog.path[0];
      const walking = !!next && dog.happy === 0;
      if (walking) {
        const dx = next.x - dog.x, dz = next.z - dog.z, distance = Math.hypot(dx, dz), step = dt * 0.55;
        if (distance < step + 0.001) { dog.x = next.x; dog.z = next.z; dog.path.shift(); }
        else { dog.x += dx / distance * step; dog.z += dz / distance * step; }
        const angle = Math.atan2(dx, dz); dog.group.rotation.y += Math.atan2(Math.sin(angle - dog.group.rotation.y), Math.cos(angle - dog.group.rotation.y)) * Math.min(1, dt * 9);
      }
      dog.group.position.set(world(dog.x), 0, world(dog.z));
      if (!this.reducedMotion) {
        dog.body.position.y = dog.happy > 0 ? Math.abs(Math.sin(this.time * 10)) * 0.17 : walking ? Math.sin(this.time * 8) * 0.025 : Math.sin(this.time * 2) * 0.01;
        dog.legs.forEach((leg, i) => { leg.rotation.x = walking ? Math.sin(this.time * 8 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.35 : 0; });
        dog.tail.rotation.y = Math.sin(this.time * (dog.happy > 0 ? 22 : 5)) * 0.4;
      }
    }
    if (!this.reducedMotion) {
      for (const mill of this.mills) mill.rotation.z -= dt * 0.6;
      this.steam.forEach((puff, i) => { puff.position.y = 0.7 + ((this.time * 0.14 + i * 0.18) % 0.65); puff.scale.setScalar(0.75 + Math.sin(this.time + i) * 0.2); });
      for (const token of this.coinTokens.values()) { token.rotation.y += dt; token.position.y = 2.05 + Math.sin(this.time * 2) * 0.08; }
      this.clouds.forEach((cloud, i) => { cloud.position.x += Math.sin(this.time * 0.12 + i) * dt * 0.05; });
    }
    this.renderer.render(this.scene, this.camera);
  };

  /** 共有する基本材質・形は残し、モデル固有の看板だけを解放する。 */
  private disposeModel(root: THREE.Object3D) {
    this.mills = this.mills.filter((mill) => !root.getObjectById(mill.id));
    this.steam = this.steam.filter((puff) => !root.getObjectById(puff.id));
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.userData.ownGeometry) object.geometry.dispose();
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of mats) if (material instanceof THREE.MeshBasicMaterial && material.map) {
        const i = this.textures.indexOf(material.map); if (i >= 0) this.textures.splice(i, 1);
        material.map.dispose(); material.dispose();
      }
    });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; cancelAnimationFrame(this.frame); this.ro.disconnect(); this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.pointerDown); canvas.removeEventListener("pointermove", this.pointerMove); canvas.removeEventListener("pointerup", this.pointerUp); canvas.removeEventListener("pointercancel", this.pointerCancel); canvas.removeEventListener("lostpointercapture", this.pointerCancel); canvas.removeEventListener("webglcontextlost", this.contextLost); document.removeEventListener("visibilitychange", this.visibility);
    this.disposeModel(this.scene);
    for (const geometry of this.geometries.values()) geometry.dispose(); for (const material of this.materials.values()) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); canvas.remove(); this.scene.clear();
  }
}
