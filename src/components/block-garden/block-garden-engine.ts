import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  BLOCK_DEFINITIONS,
  BLOCK_GARDEN_WORLD,
  type BlockGeometryKind,
  type BlockId,
  type PlaceableBlockId,
} from "@/lib/games/block-garden-config";
import {
  blockKey,
  blockOverlapsPlayer,
  createBlockGardenWorld,
  getPlayerGroundHeight,
  getVisibleBlocks,
  isInsideWorld,
  removeBlock,
  setBlock,
  type BlockPosition,
  type BlockWorld,
} from "@/lib/games/block-garden-world";

export type BlockGardenTarget = {
  blockId: BlockId;
  position: BlockPosition;
} | null;

export type BlockGardenInteractionResult =
  | {
      ok: true;
      blockId: BlockId;
      inventoryId?: PlaceableBlockId;
      label: string;
    }
  | { ok: false; message: string };

type EngineCallbacks = {
  onTargetChange: (target: BlockGardenTarget) => void;
  onContextLost: () => void;
};

type InternalTarget = Exclude<BlockGardenTarget, null> & { normal: BlockPosition };

const PLAYER_EYE_HEIGHT = 1.48;
const PLAYER_STEP_HEIGHT = 1.05;
const PLAYER_SPEED = 3.65;
const PLAYER_JUMP_VELOCITY = 5.8;
const PLAYER_GRAVITY = 15;
const TARGET_UPDATE_INTERVAL = 80;

function blockIds(): BlockId[] {
  return Object.keys(BLOCK_DEFINITIONS) as BlockId[];
}

function dominantAxisNormal(normal: THREE.Vector3): BlockPosition {
  const absoluteX = Math.abs(normal.x);
  const absoluteY = Math.abs(normal.y);
  const absoluteZ = Math.abs(normal.z);

  if (absoluteX >= absoluteY && absoluteX >= absoluteZ) {
    return { x: normal.x >= 0 ? 1 : -1, y: 0, z: 0 };
  }
  if (absoluteY >= absoluteX && absoluteY >= absoluteZ) {
    return { x: 0, y: normal.y >= 0 ? 1 : -1, z: 0 };
  }
  return { x: 0, y: 0, z: normal.z >= 0 ? 1 : -1 };
}

export class BlockGardenEngine {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.08, 48);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly world: BlockWorld = createBlockGardenWorld();
  private readonly worldGroup = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly centerPoint = new THREE.Vector2(0, 0);
  private readonly callbacks: EngineCallbacks;
  private readonly materials = new Map<BlockId, THREE.MeshStandardMaterial>();
  private readonly geometries: Record<BlockGeometryKind, THREE.BufferGeometry>;
  private readonly positionsByMesh = new Map<THREE.InstancedMesh, BlockPosition[]>();
  private readonly pressedKeys = new Set<string>();
  private readonly clock = new THREE.Clock();
  private readonly forwardVector = new THREE.Vector3();
  private readonly rightVector = new THREE.Vector3();
  private readonly movementVector = new THREE.Vector3();
  private readonly highlight: THREE.LineSegments;
  private readonly horizon: THREE.Mesh;
  private readonly resizeObserver: ResizeObserver;
  private pickableMeshes: THREE.InstancedMesh[] = [];
  private target: InternalTarget | null = null;
  private targetSignature = "";
  private touchStrafe = 0;
  private touchForward = 0;
  private verticalVelocity = 0;
  private grounded = true;
  private yaw = -Math.PI / 4;
  private pitch = -0.12;
  private animationFrame = 0;
  private lastTargetUpdate = 0;
  private disposed = false;
  private readonly player = { x: -8, feetY: 3.5, z: 8 };

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.callbacks = callbacks;

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !coarsePointer || window.devicePixelRatio <= 2,
      alpha: false,
      powerPreference: "high-performance",
      precision: "mediump",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.35 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.setClearColor(0xbfe7f3, 1);

    this.scene.background = new THREE.Color(0xbfe7f3);
    this.scene.fog = new THREE.Fog(0xbfe7f3, 15, 39);
    this.camera.rotation.order = "YXZ";
    this.raycaster.far = BLOCK_GARDEN_WORLD.reach;
    this.scene.add(this.worldGroup);

    this.geometries = {
      cube: new RoundedBoxGeometry(0.94, 0.94, 0.94, 1, 0.055),
      flower: new RoundedBoxGeometry(0.54, 0.7, 0.54, 1, 0.11).translate(0, -0.14, 0),
      water: new RoundedBoxGeometry(0.97, 0.7, 0.97, 1, 0.045).translate(0, -0.14, 0),
    };

    for (const blockId of blockIds()) {
      const definition = BLOCK_DEFINITIONS[blockId];
      const transparent = definition.opacity !== undefined && definition.opacity < 1;
      const material = new THREE.MeshStandardMaterial({
        color: definition.color,
        roughness: blockId === "water" ? 0.34 : 0.84,
        metalness: 0,
        transparent,
        opacity: definition.opacity ?? 1,
        depthWrite: !transparent,
      });
      this.materials.set(blockId, material);
    }

    const hemisphereLight = new THREE.HemisphereLight(0xf4fbff, 0x89a675, 2.25);
    this.scene.add(hemisphereLight);

    const sunLight = new THREE.DirectionalLight(0xfff2cf, 2.15);
    sunLight.position.set(-8, 16, 9);
    this.scene.add(sunLight);

    const horizonGeometry = new THREE.CircleGeometry(42, 48);
    const horizonMaterial = new THREE.MeshLambertMaterial({ color: 0xb8d99d });
    this.horizon = new THREE.Mesh(horizonGeometry, horizonMaterial);
    this.horizon.rotation.x = -Math.PI / 2;
    this.horizon.position.y = -0.54;
    this.scene.add(this.horizon);

    const highlightSourceGeometry = new RoundedBoxGeometry(1.035, 1.035, 1.035, 1, 0.075);
    const highlightGeometry = new THREE.EdgesGeometry(highlightSourceGeometry);
    highlightSourceGeometry.dispose();
    const highlightMaterial = new THREE.LineBasicMaterial({
      color: 0xfff5b5,
      transparent: true,
      opacity: 0.96,
    });
    this.highlight = new THREE.LineSegments(highlightGeometry, highlightMaterial);
    this.highlight.visible = false;
    this.highlight.renderOrder = 5;
    this.scene.add(this.highlight);

    this.player.feetY = getPlayerGroundHeight(this.world, this.player.x, this.player.z) ?? 3.5;
    this.updateCamera();
    this.rebuildWorldMeshes();
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    canvas.addEventListener("webglcontextlost", this.handleContextLost, false);
  }

  start(): void {
    this.clock.start();
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  setKey(code: string, pressed: boolean): void {
    if (pressed) this.pressedKeys.add(code);
    else this.pressedKeys.delete(code);
  }

  setTouchMovement(strafe: number, forward: number): void {
    this.touchStrafe = THREE.MathUtils.clamp(strafe, -1, 1);
    this.touchForward = THREE.MathUtils.clamp(forward, -1, 1);
  }

  addLookDelta(deltaX: number, deltaY: number, sensitivity = 0.0032): void {
    this.yaw -= deltaX * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - deltaY * sensitivity, -1.2, 1.08);
    this.updateCamera();
  }

  jump(): boolean {
    if (!this.grounded) return false;

    const ground = getPlayerGroundHeight(this.world, this.player.x, this.player.z);
    if (ground !== null) this.player.feetY = Math.max(this.player.feetY, ground);
    this.grounded = false;
    this.verticalVelocity = PLAYER_JUMP_VELOCITY;
    return true;
  }

  breakTarget(): BlockGardenInteractionResult {
    if (!this.target) return { ok: false, message: "照準をブロックに合わせてね" };

    const { blockId, position } = this.target;
    const definition = BLOCK_DEFINITIONS[blockId];
    if (!definition.breakable) return { ok: false, message: `${definition.shortLabel}は壊せません` };
    if (position.y <= BLOCK_GARDEN_WORLD.minY) {
      return { ok: false, message: "いちばん下の地面は残しておこう" };
    }

    removeBlock(this.world, position);
    this.rebuildWorldMeshes();
    this.clearTarget();
    return {
      ok: true,
      blockId,
      inventoryId: definition.collectAs,
      label: definition.shortLabel,
    };
  }

  placeTarget(blockId: PlaceableBlockId): BlockGardenInteractionResult {
    if (!this.target) return { ok: false, message: "置きたい面に照準を合わせてね" };

    const candidate: BlockPosition = {
      x: this.target.position.x + this.target.normal.x,
      y: this.target.position.y + this.target.normal.y,
      z: this.target.position.z + this.target.normal.z,
    };

    if (!isInsideWorld(candidate)) return { ok: false, message: "フィールドの外には置けません" };
    if (this.world.has(blockKey(candidate.x, candidate.y, candidate.z))) {
      return { ok: false, message: "そこにはすでにブロックがあります" };
    }
    if (blockOverlapsPlayer(candidate, this.player)) {
      return { ok: false, message: "自分と重なる場所には置けません" };
    }

    if (blockId === "flower") {
      const supportId = this.world.get(blockKey(candidate.x, candidate.y - 1, candidate.z));
      if (!supportId || !BLOCK_DEFINITIONS[supportId].solid) {
        return { ok: false, message: "花は地面の上に置いてね" };
      }
    }

    setBlock(this.world, candidate, blockId);
    this.rebuildWorldMeshes();
    this.clearTarget();
    return {
      ok: true,
      blockId,
      label: BLOCK_DEFINITIONS[blockId].shortLabel,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.clock.stop();
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost, false);
    this.disposeWorldMeshes();

    for (const geometry of new Set(Object.values(this.geometries))) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();

    this.horizon.geometry.dispose();
    const horizonMaterial = this.horizon.material;
    if (Array.isArray(horizonMaterial)) horizonMaterial.forEach((material) => material.dispose());
    else horizonMaterial.dispose();

    this.highlight.geometry.dispose();
    const highlightMaterial = this.highlight.material;
    if (Array.isArray(highlightMaterial)) highlightMaterial.forEach((material) => material.dispose());
    else highlightMaterial.dispose();

    this.renderer.dispose();
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.callbacks.onContextLost();
  };

  private readonly tick = (): void => {
    if (this.disposed) return;

    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (!document.hidden) {
      this.updateMovement(delta);
      this.updateVerticalMovement(delta);
      this.updateCamera();

      const now = performance.now();
      if (now - this.lastTargetUpdate >= TARGET_UPDATE_INTERVAL) {
        this.updateTarget();
        this.lastTargetUpdate = now;
      }
      this.renderer.render(this.scene, this.camera);
    }

    this.animationFrame = requestAnimationFrame(this.tick);
  };

  private updateMovement(delta: number): void {
    const keyboardForward =
      (this.pressedKeys.has("KeyW") || this.pressedKeys.has("ArrowUp") ? 1 : 0) -
      (this.pressedKeys.has("KeyS") || this.pressedKeys.has("ArrowDown") ? 1 : 0);
    const keyboardStrafe =
      (this.pressedKeys.has("KeyD") || this.pressedKeys.has("ArrowRight") ? 1 : 0) -
      (this.pressedKeys.has("KeyA") || this.pressedKeys.has("ArrowLeft") ? 1 : 0);

    let forwardInput = THREE.MathUtils.clamp(keyboardForward + this.touchForward, -1, 1);
    let strafeInput = THREE.MathUtils.clamp(keyboardStrafe + this.touchStrafe, -1, 1);
    const inputLength = Math.hypot(forwardInput, strafeInput);
    if (inputLength > 1) {
      forwardInput /= inputLength;
      strafeInput /= inputLength;
    }
    if (Math.abs(forwardInput) < 0.01 && Math.abs(strafeInput) < 0.01) return;

    const forward = this.forwardVector.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = this.rightVector.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const movement = this.movementVector.copy(forward).multiplyScalar(forwardInput).addScaledVector(right, strafeInput);
    if (movement.lengthSq() > 1) movement.normalize();
    movement.multiplyScalar(PLAYER_SPEED * delta);

    const nextX = this.player.x + movement.x;
    const nextZ = this.player.z + movement.z;
    const nextGround = getPlayerGroundHeight(this.world, nextX, nextZ);
    if (nextGround === null || nextGround > this.player.feetY + PLAYER_STEP_HEIGHT) return;

    this.player.x = nextX;
    this.player.z = nextZ;
    if (this.grounded) {
      if (nextGround < this.player.feetY - 0.08) {
        this.grounded = false;
      } else {
        const smoothing = 1 - Math.exp(-delta * 14);
        this.player.feetY = THREE.MathUtils.lerp(this.player.feetY, nextGround, smoothing);
      }
    }
  }

  private updateVerticalMovement(delta: number): void {
    const ground = getPlayerGroundHeight(this.world, this.player.x, this.player.z);
    if (ground === null) return;

    if (this.grounded) {
      if (this.player.feetY > ground + 0.08) {
        this.grounded = false;
      } else {
        const smoothing = 1 - Math.exp(-delta * 14);
        this.player.feetY = THREE.MathUtils.lerp(this.player.feetY, ground, smoothing);
        this.verticalVelocity = 0;
        return;
      }
    }

    this.verticalVelocity -= PLAYER_GRAVITY * delta;
    this.player.feetY += this.verticalVelocity * delta;

    if (this.verticalVelocity <= 0 && this.player.feetY <= ground) {
      this.player.feetY = ground;
      this.verticalVelocity = 0;
      this.grounded = true;
    }
  }

  private updateCamera(): void {
    this.camera.position.set(this.player.x, this.player.feetY + PLAYER_EYE_HEIGHT, this.player.z);
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.z = 0;
    this.camera.updateMatrixWorld();
  }

  private updateTarget(): void {
    this.raycaster.setFromCamera(this.centerPoint, this.camera);
    const intersections = this.raycaster.intersectObjects(this.pickableMeshes, false);
    const intersection = intersections[0];
    if (!intersection || intersection.instanceId === undefined) {
      this.clearTarget();
      return;
    }

    const mesh = intersection.object;
    if (!(mesh instanceof THREE.InstancedMesh)) {
      this.clearTarget();
      return;
    }
    const positions = this.positionsByMesh.get(mesh);
    const position = positions?.[intersection.instanceId];
    const faceNormal = intersection.face?.normal;
    if (!position || !faceNormal) {
      this.clearTarget();
      return;
    }

    const blockId = this.world.get(blockKey(position.x, position.y, position.z));
    if (!blockId) {
      this.clearTarget();
      return;
    }

    const normal = dominantAxisNormal(faceNormal);
    const signature = `${blockId}:${position.x},${position.y},${position.z}:${normal.x},${normal.y},${normal.z}`;
    this.target = { blockId, position, normal };
    this.highlight.position.set(position.x, position.y, position.z);
    this.highlight.visible = true;

    if (signature !== this.targetSignature) {
      this.targetSignature = signature;
      this.callbacks.onTargetChange({ blockId, position });
    }
  }

  private clearTarget(): void {
    this.target = null;
    this.highlight.visible = false;
    if (this.targetSignature !== "") {
      this.targetSignature = "";
      this.callbacks.onTargetChange(null);
    }
  }

  private rebuildWorldMeshes(): void {
    this.disposeWorldMeshes();
    const visibleByType = getVisibleBlocks(this.world);
    const transform = new THREE.Matrix4();

    for (const blockId of blockIds()) {
      const positions = visibleByType.get(blockId);
      const material = this.materials.get(blockId);
      if (!positions?.length || !material) continue;

      const definition = BLOCK_DEFINITIONS[blockId];
      const geometry = this.geometries[definition.geometry];
      const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
      mesh.name = `block-garden-${blockId}`;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.renderOrder = blockId === "water" ? 2 : 0;

      positions.forEach((position, index) => {
        transform.makeTranslation(position.x, position.y, position.z);
        mesh.setMatrixAt(index, transform);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.positionsByMesh.set(mesh, positions);
      this.pickableMeshes.push(mesh);
      this.worldGroup.add(mesh);
    }
  }

  private disposeWorldMeshes(): void {
    for (const child of [...this.worldGroup.children]) {
      this.worldGroup.remove(child);
      if (child instanceof THREE.InstancedMesh) child.dispose();
    }
    this.positionsByMesh.clear();
    this.pickableMeshes = [];
  }

  private resize(): void {
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? canvas.clientWidth);
    const height = Math.max(1, parent?.clientHeight ?? canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
