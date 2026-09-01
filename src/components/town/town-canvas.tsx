"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { townFootprint } from "@/lib/town/geometry";
import type {
  TownCatalogItem,
  TownPlacedItem,
  TownPlacementCandidate,
} from "@/lib/town/types";
import { createTownItemModel, createTownTree } from "./town-three-models";
import styles from "./town-canvas.module.css";

type Point = { x: number; y: number };
type ThreeObject = any;
type Runtime = {
  THREE: typeof import("three");
  renderer: InstanceType<typeof import("three")["WebGLRenderer"]>;
  scene: InstanceType<typeof import("three")["Scene"]>;
  camera: InstanceType<typeof import("three")["OrthographicCamera"]>;
  root: InstanceType<typeof import("three")["Group"]>;
  raycaster: InstanceType<typeof import("three")["Raycaster"]>;
  groundPlane: InstanceType<typeof import("three")["Plane"]>;
  target: InstanceType<typeof import("three")["Vector3"]>;
};

const WORLD_HALF = 7;
const MIN_ZOOM = 0.72;
const MAX_ZOOM = 1.85;
const SCENERY = [
  [1.0, 1.1, 0.88],
  [12.8, 1.2, 0.82],
  [13.0, 6.3, 0.72],
  [12.2, 12.1, 0.9],
  [7.7, 12.9, 0.72],
  [1.1, 11.7, 0.86],
  [0.8, 6.1, 0.7],
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function disposeObject(object: ThreeObject) {
  object.traverse((child: ThreeObject) => {
    if (!("isMesh" in child) || !child.isMesh) return;
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((entry: ThreeObject) => entry.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

export const TownCanvas = memo(function TownCanvas({
  catalog,
  items,
  unlockedAreas,
  selectedId,
  candidate,
  candidateCanPlace,
  editMode,
  onSelect,
  onCandidateChange,
}: {
  catalog: TownCatalogItem[];
  items: TownPlacedItem[];
  unlockedAreas: string[];
  selectedId: string | null;
  candidate: TownPlacementCandidate | null;
  candidateCanPlace: boolean;
  editMode: boolean;
  onSelect: (instanceId: string) => void;
  onCandidateChange: (candidate: TownPlacementCandidate) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef({
    moved: false,
    start: { x: 0, y: 0 },
    last: { x: 0, y: 0 },
    pinchDistance: 0,
  });
  const [readyVersion, setReadyVersion] = useState(0);
  const [webglFailed, setWebglFailed] = useState(false);

  const catalogById = useMemo(
    () => new Map(catalog.map((entry) => [entry.id, entry])),
    [catalog],
  );

  const renderScene = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.camera.lookAt(runtime.target);
    runtime.renderer.render(runtime.scene, runtime.camera);
  }, []);

  const resize = useCallback(() => {
    const runtime = runtimeRef.current;
    const node = mountRef.current;
    if (!runtime || !node) return;
    const width = Math.max(1, node.clientWidth);
    const height = Math.max(1, node.clientHeight);
    const aspect = width / height;
    const frustum = 18;
    runtime.camera.left = (-frustum * aspect) / 2;
    runtime.camera.right = (frustum * aspect) / 2;
    runtime.camera.top = frustum / 2;
    runtime.camera.bottom = -frustum / 2;
    runtime.camera.updateProjectionMatrix();
    runtime.renderer.setSize(width, height, false);
    renderScene();
  }, [renderScene]);

  useEffect(() => {
    let active = true;
    const mount = mountRef.current;
    if (!mount) return;

    async function initialize() {
      try {
        const THREE = await import("three");
        if (!active || !mountRef.current) return;

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.className = styles.canvas ?? "";
        renderer.domElement.setAttribute("aria-label", "3Dわんこタウン");
        mountRef.current.replaceChildren(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xd8eee0);
        scene.fog = new THREE.Fog(0xd8eee0, 22, 38);

        const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 80);
        camera.position.set(15.5, 17.5, 18.5);
        camera.zoom = 1.03;

        const target = new THREE.Vector3(0, 0.45, 0);
        const root = new THREE.Group();
        scene.add(root);

        const hemisphere = new THREE.HemisphereLight(0xfff8dc, 0x628456, 2.15);
        scene.add(hemisphere);
        const sun = new THREE.DirectionalLight(0xfff1c9, 3.4);
        sun.position.set(-8, 18, 10);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -12;
        sun.shadow.camera.right = 12;
        sun.shadow.camera.top = 12;
        sun.shadow.camera.bottom = -12;
        sun.shadow.bias = -0.0008;
        scene.add(sun);

        const ground = new THREE.Mesh(
          new THREE.BoxGeometry(15.2, 0.48, 15.2),
          new THREE.MeshStandardMaterial({ color: 0x91c873, roughness: 0.92 }),
        );
        ground.position.y = -0.27;
        ground.receiveShadow = true;
        scene.add(ground);

        const underGround = new THREE.Mesh(
          new THREE.BoxGeometry(16.2, 0.34, 16.2),
          new THREE.MeshStandardMaterial({ color: 0x527849, roughness: 1 }),
        );
        underGround.position.y = -0.62;
        underGround.receiveShadow = true;
        scene.add(underGround);

        const raycaster = new THREE.Raycaster();
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        runtimeRef.current = {
          THREE,
          renderer,
          scene,
          camera,
          root,
          raycaster,
          groundPlane,
          target,
        };
        resize();
        setReadyVersion((value) => value + 1);
      } catch {
        if (active) setWebglFailed(true);
      }
    }

    void initialize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    return () => {
      active = false;
      observer.disconnect();
      const runtime = runtimeRef.current;
      if (runtime) {
        disposeObject(runtime.root);
        runtime.renderer.dispose();
        runtime.renderer.domElement.remove();
      }
      runtimeRef.current = null;
    };
  }, [resize]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const { THREE, root } = runtime;
    for (const child of [...root.children]) {
      root.remove(child);
      disposeObject(child);
    }

    const pathMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9c28f,
      roughness: 1,
      transparent: true,
      opacity: 0.68,
    });
    const mainPath = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.035, 9.2), pathMaterial);
    mainPath.position.set(0, 0.025, 2.2);
    mainPath.receiveShadow = true;
    root.add(mainPath);
    const crossPath = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.035, 0.92), pathMaterial.clone());
    crossPath.position.set(0, 0.028, -0.8);
    crossPath.receiveShadow = true;
    root.add(crossPath);

    for (const area of [
      { id: "north", x: 2, y: 0, width: 10, height: 2 },
      { id: "east", x: 12, y: 2, width: 2, height: 10 },
      { id: "south", x: 2, y: 12, width: 10, height: 2 },
      { id: "west", x: 0, y: 2, width: 2, height: 10 },
    ]) {
      if (unlockedAreas.includes(area.id)) continue;
      const locked = new THREE.Mesh(
        new THREE.BoxGeometry(area.width - 0.08, 0.12, area.height - 0.08),
        new THREE.MeshStandardMaterial({
          color: 0x5e8d57,
          roughness: 1,
          transparent: true,
          opacity: 0.86,
        }),
      );
      locked.position.set(
        area.x + area.width / 2 - WORLD_HALF,
        0.07,
        area.y + area.height / 2 - WORLD_HALF,
      );
      locked.receiveShadow = true;
      root.add(locked);
    }

    for (const [gridX, gridY, scale] of SCENERY) {
      const tree = createTownTree(THREE, scale);
      tree.position.set(gridX - WORLD_HALF, 0, gridY - WORLD_HALF);
      root.add(tree);
    }

    for (const placed of items) {
      if (!placed.isPlaced || placed.instanceId === candidate?.instanceId) continue;
      const item = catalogById.get(placed.itemId);
      if (!item) continue;
      const footprint = townFootprint(item, placed.rotation);
      const model = createTownItemModel(THREE, item.id, footprint.width, footprint.height);
      model.position.set(
        placed.gridX + footprint.width / 2 - WORLD_HALF,
        0,
        placed.gridY + footprint.height / 2 - WORLD_HALF,
      );
      model.rotation.y = (-placed.rotation * Math.PI) / 180;
      model.userData.instanceId = placed.instanceId;
      model.traverse((child: ThreeObject) => {
        child.userData.instanceId = placed.instanceId;
        if (selectedId === placed.instanceId && "material" in child && child.material?.emissive) {
          child.material.emissive.setHex(0x294d1f);
          child.material.emissiveIntensity = 0.16;
        }
      });
      root.add(model);
    }

    if (candidate) {
      const item = catalogById.get(candidate.itemId);
      if (item) {
        const footprint = townFootprint(item, candidate.rotation);
        const model = createTownItemModel(THREE, item.id, footprint.width, footprint.height);
        model.position.set(
          candidate.gridX + footprint.width / 2 - WORLD_HALF,
          0.04,
          candidate.gridY + footprint.height / 2 - WORLD_HALF,
        );
        model.rotation.y = (-candidate.rotation * Math.PI) / 180;
        model.userData.isCandidate = true;
        model.traverse((child: ThreeObject) => {
          if (!("material" in child) || !child.material) return;
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.7;
          if (child.material.emissive) {
            child.material.emissive.setHex(candidateCanPlace ? 0x2e8b44 : 0xb83242);
            child.material.emissiveIntensity = 0.34;
          }
        });
        root.add(model);
      }
    }

    renderScene();
  }, [
    candidate,
    candidateCanPlace,
    catalogById,
    items,
    readyVersion,
    renderScene,
    selectedId,
    unlockedAreas,
  ]);

  function pointerPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = viewportRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

  function groundPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    const canvas = runtime?.renderer.domElement;
    if (!runtime || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const pointer = new runtime.THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    runtime.raycaster.setFromCamera(pointer, runtime.camera);
    const result = new runtime.THREE.Vector3();
    return runtime.raycaster.ray.intersectPlane(runtime.groundPlane, result);
  }

  function moveCandidate(event: ReactPointerEvent<HTMLDivElement>) {
    if (!candidate) return;
    const point = groundPoint(event);
    const item = catalogById.get(candidate.itemId);
    if (!point || !item) return;
    const footprint = townFootprint(item, candidate.rotation);
    const gridX = clamp(
      Math.round(point.x + WORLD_HALF - footprint.width / 2),
      0,
      14 - footprint.width,
    );
    const gridY = clamp(
      Math.round(point.z + WORLD_HALF - footprint.height / 2),
      0,
      14 - footprint.height,
    );
    if (gridX !== candidate.gridX || gridY !== candidate.gridY) {
      onCandidateChange({ ...candidate, gridX, gridY });
    }
  }

  function selectAt(event: ReactPointerEvent<HTMLDivElement>) {
    const runtime = runtimeRef.current;
    const canvas = runtime?.renderer.domElement;
    if (!runtime || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pointer = new runtime.THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    runtime.raycaster.setFromCamera(pointer, runtime.camera);
    const hit = runtime.raycaster.intersectObjects(runtime.root.children, true)
      .find((entry: ThreeObject) => typeof entry.object.userData.instanceId === "string");
    if (hit) onSelect(hit.object.userData.instanceId);
  }

  function beginPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('[data-town-control="true"]')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPoint(event);
    pointersRef.current.set(event.pointerId, point);
    gestureRef.current.start = point;
    gestureRef.current.last = point;
    gestureRef.current.moved = false;
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      gestureRef.current.pinchDistance = Math.hypot(b!.x - a!.x, b!.y - a!.y);
    }
    if (candidate) moveCandidate(event);
  }

  function movePointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    const point = pointerPoint(event);
    const previous = pointersRef.current.get(event.pointerId)!;
    pointersRef.current.set(event.pointerId, point);
    if (Math.hypot(point.x - gestureRef.current.start.x, point.y - gestureRef.current.start.y) > 6) {
      gestureRef.current.moved = true;
    }

    if (candidate) {
      moveCandidate(event);
      return;
    }

    const runtime = runtimeRef.current;
    if (!runtime) return;
    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      const distance = Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y);
      if (gestureRef.current.pinchDistance > 0) {
        runtime.camera.zoom = clamp(
          runtime.camera.zoom * (distance / gestureRef.current.pinchDistance),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        runtime.camera.updateProjectionMatrix();
      }
      gestureRef.current.pinchDistance = distance;
    } else {
      const factor = 0.018 / runtime.camera.zoom;
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      runtime.camera.position.x -= dx * factor;
      runtime.target.x -= dx * factor;
      runtime.camera.position.z -= dy * factor;
      runtime.target.z -= dy * factor;
      runtime.target.x = clamp(runtime.target.x, -4.5, 4.5);
      runtime.target.z = clamp(runtime.target.z, -4.5, 4.5);
      const cameraOffsetX = runtime.camera.position.x - runtime.target.x;
      const cameraOffsetZ = runtime.camera.position.z - runtime.target.z;
      runtime.camera.position.x = runtime.target.x + cameraOffsetX;
      runtime.camera.position.z = runtime.target.z + cameraOffsetZ;
    }
    gestureRef.current.last = point;
    renderScene();
  }

  function endPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const wasMoved = gestureRef.current.moved;
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointersRef.current.size < 2) gestureRef.current.pinchDistance = 0;
    if (!candidate && !wasMoved) selectAt(event);
  }

  function zoomBy(amount: number) {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.camera.zoom = clamp(runtime.camera.zoom + amount, MIN_ZOOM, MAX_ZOOM);
    runtime.camera.updateProjectionMatrix();
    renderScene();
  }

  return (
    <div
      ref={viewportRef}
      className={styles.viewport + (candidate ? " " + styles.viewportPlacement : "")}
      onPointerDown={beginPointer}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <div ref={mountRef} className={styles.threeMount} />
      {!readyVersion && !webglFailed ? <span className={styles.loading}>3Dタウンを準備中…</span> : null}
      {webglFailed ? (
        <span className={styles.loading}>この端末では3D表示を開始できませんでした</span>
      ) : null}
      <p className={styles.hint}>
        {candidate
          ? "地面をタップ、またはドラッグして配置"
          : editMode
            ? "建物をタップして編集できます"
            : "ドラッグで移動・ピンチで拡大"}
      </p>
      <span className={styles.threeBadge}>3D</span>
      <div className={styles.zoomControls} aria-label="ズーム操作">
        <button
          type="button"
          data-town-control="true"
          className={styles.zoomButton}
          onClick={() => zoomBy(-0.14)}
          aria-label="縮小"
        >
          −
        </button>
        <button
          type="button"
          data-town-control="true"
          className={styles.zoomButton}
          onClick={() => zoomBy(0.14)}
          aria-label="拡大"
        >
          ＋
        </button>
      </div>
    </div>
  );
});
