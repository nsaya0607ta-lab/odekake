"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getFrenchieSrc, type DogSkinId } from "@/lib/dog-skins";
import {
  TOWN_AREAS,
  TOWN_GRID_SIZE,
  TOWN_WORLD_HEIGHT,
  TOWN_WORLD_WIDTH,
  areaPolygon,
  placementAnchor,
  placementPolygon,
  projectTownPoint,
  screenPointToGrid,
} from "@/lib/town/geometry";
import type {
  TownCatalogItem,
  TownPlacedItem,
  TownPlacementCandidate,
} from "@/lib/town/types";
import { BuildingArtwork } from "./building-artwork";
import { TownScenery } from "./town-scenery";
import styles from "./town-canvas.module.css";

type ViewState = { x: number; y: number; scale: number };
type LocalPoint = { x: number; y: number };

const MIN_ZOOM = 0.48;
const MAX_ZOOM = 1.2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointDistance(a: LocalPoint, b: LocalPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointCenter(a: LocalPoint, b: LocalPoint): LocalPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clampView(view: ViewState, width: number, height: number): ViewState {
  const margin = 92;
  const scaledWidth = TOWN_WORLD_WIDTH * view.scale;
  const scaledHeight = TOWN_WORLD_HEIGHT * view.scale;
  const minX = Math.min(margin, width - scaledWidth - margin);
  const maxX = Math.max(margin, width - scaledWidth - margin);
  const minY = Math.min(72, height - scaledHeight - 72);
  const maxY = Math.max(72, height - scaledHeight - 72);
  return {
    ...view,
    x: clamp(view.x, minX, maxX),
    y: clamp(view.y, minY, maxY),
  };
}

const SCENERY_DECOR = [
  { x: 2.1, y: 2.2, kind: "tree" },
  { x: 10.8, y: 2.3, kind: "tree" },
  { x: 12.2, y: 5.3, kind: "shrub" },
  { x: 12.1, y: 8.7, kind: "tree" },
  { x: 10.8, y: 11.8, kind: "flowers" },
  { x: 7.9, y: 12.5, kind: "shrub" },
  { x: 4.5, y: 12.2, kind: "tree" },
  { x: 1.8, y: 9.4, kind: "flowers" },
  { x: 1.8, y: 6.2, kind: "shrub" },
] as const;

export const TownCanvas = memo(function TownCanvas({
  catalog,
  items,
  unlockedAreas,
  dogSkin,
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
  dogSkin: DogSkinId;
  selectedId: string | null;
  candidate: TownPlacementCandidate | null;
  candidateCanPlace: boolean;
  editMode: boolean;
  onSelect: (instanceId: string) => void;
  onCandidateChange: (candidate: TownPlacementCandidate) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, LocalPoint>());
  const dragPointerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const queuedCandidateRef = useRef<TownPlacementCandidate | null>(null);
  const gestureRef = useRef<
    | { kind: "none" }
    | { kind: "pan"; pointerId: number; start: LocalPoint; view: ViewState }
    | { kind: "pinch"; distance: number; anchorWorld: LocalPoint }
  >({ kind: "none" });
  const [view, setView] = useState<ViewState>({ x: -20, y: 8, scale: 0.58 });

  const catalogById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog],
  );

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const updateInitialView = () => {
      if (initializedRef.current) return;
      const width = node.clientWidth;
      const scale = clamp((width - 18) / TOWN_WORLD_WIDTH, MIN_ZOOM, 0.7);
      const next = clampView(
        { x: (width - TOWN_WORLD_WIDTH * scale) / 2, y: 12, scale },
        width,
        node.clientHeight,
      );
      initializedRef.current = true;
      setView(next);
    };
    updateInitialView();
    const observer = new ResizeObserver(updateInitialView);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  function localPoint(event: ReactPointerEvent): LocalPoint {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  }

  function beginViewGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragPointerRef.current !== null) return;

    if (candidate) {
      if ((event.target as HTMLElement).closest('[data-town-control="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      moveCandidateToPoint(localPoint(event));
      gestureRef.current = { kind: "none" };
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = localPoint(event);
    pointersRef.current.set(event.pointerId, point);
    const points = [...pointersRef.current.values()];

    if (points.length === 1) {
      gestureRef.current = {
        kind: "pan",
        pointerId: event.pointerId,
        start: point,
        view,
      };
    } else if (points.length >= 2) {
      const center = pointCenter(points[0]!, points[1]!);
      gestureRef.current = {
        kind: "pinch",
        distance: Math.max(1, pointDistance(points[0]!, points[1]!)),
        anchorWorld: {
          x: (center.x - view.x) / view.scale,
          y: (center.y - view.y) / view.scale,
        },
      };
    }
  }

  function moveViewGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, localPoint(event));
    const node = viewportRef.current;
    if (!node) return;
    const gesture = gestureRef.current;
    const points = [...pointersRef.current.values()];

    if (points.length >= 2 && gesture.kind === "pinch") {
      const center = pointCenter(points[0]!, points[1]!);
      const distance = Math.max(1, pointDistance(points[0]!, points[1]!));
      const nextScale = clamp(view.scale * (distance / gesture.distance), MIN_ZOOM, MAX_ZOOM);
      const next = clampView(
        {
          scale: nextScale,
          x: center.x - gesture.anchorWorld.x * nextScale,
          y: center.y - gesture.anchorWorld.y * nextScale,
        },
        node.clientWidth,
        node.clientHeight,
      );
      gestureRef.current = {
        kind: "pinch",
        distance,
        anchorWorld: {
          x: (center.x - next.x) / next.scale,
          y: (center.y - next.y) / next.scale,
        },
      };
      setView(next);
      return;
    }

    if (points.length === 1 && gesture.kind === "pan" && gesture.pointerId === event.pointerId) {
      const point = points[0]!;
      setView(
        clampView(
          {
            ...gesture.view,
            x: gesture.view.x + point.x - gesture.start.x,
            y: gesture.view.y + point.y - gesture.start.y,
          },
          node.clientWidth,
          node.clientHeight,
        ),
      );
    }
  }

  function endViewGesture(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const remaining = [...pointersRef.current.entries()];
    if (remaining.length === 1) {
      gestureRef.current = {
        kind: "pan",
        pointerId: remaining[0]![0],
        start: remaining[0]![1],
        view,
      };
    } else {
      gestureRef.current = { kind: "none" };
    }
  }

  function queueCandidate(next: TownPlacementCandidate) {
    queuedCandidateRef.current = next;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (queuedCandidateRef.current) onCandidateChange(queuedCandidateRef.current);
    });
  }

  function moveCandidateToPoint(point: LocalPoint) {
    if (!candidate) return;
    const item = catalogById.get(candidate.itemId);
    if (!item) return;
    const position = screenPointToGrid({
      worldX: (point.x - view.x) / view.scale,
      worldY: (point.y - view.y) / view.scale,
      item,
      rotation: candidate.rotation,
    });
    if (position.gridX === candidate.gridX && position.gridY === candidate.gridY) return;
    queueCandidate({ ...candidate, ...position });
  }

  function updateCandidateFromPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!candidate || dragPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    moveCandidateToPoint(localPoint(event));
  }

  function startCandidateDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!candidate) return;
    event.preventDefault();
    event.stopPropagation();
    dragPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateCandidateFromPointer(event);
  }

  function endCandidateDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragPointerRef.current = null;
  }

  function zoomBy(amount: number) {
    const node = viewportRef.current;
    if (!node) return;
    const center = { x: node.clientWidth / 2, y: node.clientHeight / 2 };
    const nextScale = clamp(view.scale + amount, MIN_ZOOM, MAX_ZOOM);
    setView(
      clampView(
        {
          scale: nextScale,
          x: center.x - ((center.x - view.x) / view.scale) * nextScale,
          y: center.y - ((center.y - view.y) / view.scale) * nextScale,
        },
        node.clientWidth,
        node.clientHeight,
      ),
    );
  }

  const visibleItems = items
    .filter((item) => item.isPlaced && item.instanceId !== candidate?.instanceId)
    .flatMap((placed) => {
      const item = catalogById.get(placed.itemId);
      return item ? [{ placed, item, anchor: placementAnchor(placed, item) }] : [];
    })
    .sort((a, b) => a.placed.gridX + a.placed.gridY - (b.placed.gridX + b.placed.gridY));

  const candidateItem = candidate ? catalogById.get(candidate.itemId) ?? null : null;
  const candidateAnchor = candidate && candidateItem ? placementAnchor(candidate, candidateItem) : null;
  const dogAnchor = projectTownPoint(7, 11.35);
  const wholeGround = areaPolygon({ id: "all", x: 0, y: 0, width: TOWN_GRID_SIZE, height: TOWN_GRID_SIZE });

  return (
    <div
      ref={viewportRef}
      className={styles.viewport + (candidate ? " " + styles.viewportPlacement : "")}
      onPointerDown={beginViewGesture}
      onPointerMove={moveViewGesture}
      onPointerUp={endViewGesture}
      onPointerCancel={endViewGesture}
      aria-label="わんこタウン。ドラッグで見渡せます"
    >
      <div
        className={styles.world}
        style={{ transform: "translate3d(" + view.x + "px," + view.y + "px,0) scale(" + view.scale + ")" }}
      >
        <div className={styles.groundEdge} style={{ clipPath: wholeGround }} />
        <div className={styles.ground} style={{ clipPath: wholeGround }} />
        <div className={styles.landscape} style={{ clipPath: wholeGround }}>
          <span className={styles.pathMain} />
          <span className={styles.pathLeft} />
          <span className={styles.pathRight} />
          <span className={styles.grassPatchOne} />
          <span className={styles.grassPatchTwo} />
        </div>

        {TOWN_AREAS.filter((area) => !unlockedAreas.includes(area.id)).map((area) => {
          const center = projectTownPoint(area.x + area.width / 2, area.y + area.height / 2);
          return (
            <div key={area.id}>
              <div className={styles.lockedArea} style={{ clipPath: areaPolygon(area) }} />
              <span className={styles.lockedLabel} style={{ left: center.x, top: center.y }}>
                🔒 未開放
              </span>
            </div>
          );
        })}

        {SCENERY_DECOR.map((decor, index) => {
          const point = projectTownPoint(decor.x, decor.y);
          return (
            <span
              key={index}
              aria-hidden="true"
              className={styles.scenery}
              style={{ left: point.x, top: point.y, zIndex: Math.round((decor.x + decor.y) * 10) }}
            >
              <TownScenery kind={decor.kind} />
            </span>
          );
        })}

        {candidate && candidateItem ? (
          <div
            className={
              styles.placementMask + (candidateCanPlace ? "" : " " + styles.placementMaskInvalid)
            }
            style={{ clipPath: placementPolygon(candidate, candidateItem) }}
          />
        ) : null}

        {visibleItems.map(({ placed, item, anchor }) => (
          <button
            key={placed.instanceId}
            type="button"
            data-town-item="true"
            aria-label={item.name + "を選択"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onSelect(placed.instanceId)}
            className={
              styles.entity + (selectedId === placed.instanceId ? " " + styles.entitySelected : "")
            }
            style={{
              left: anchor.x,
              top: anchor.y,
              zIndex: 100 + Math.round((placed.gridX + placed.gridY) * 10),
            }}
          >
            <BuildingArtwork itemId={item.id} rotation={placed.rotation} />
          </button>
        ))}

        <img
          src={getFrenchieSrc(dogSkin, "stand-happy")}
          alt=""
          draggable={false}
          className={styles.dog}
          style={{ left: dogAnchor.x, top: dogAnchor.y, zIndex: 245 }}
        />

        {candidate && candidateItem && candidateAnchor ? (
          <button
            type="button"
            data-town-item="true"
            aria-label={candidateItem.name + "をドラッグして配置"}
            className={styles.entity + " " + styles.entityCandidate}
            onPointerDown={startCandidateDrag}
            onPointerMove={updateCandidateFromPointer}
            onPointerUp={endCandidateDrag}
            onPointerCancel={endCandidateDrag}
            style={{
              left: candidateAnchor.x,
              top: candidateAnchor.y,
              zIndex: 400,
            }}
          >
            <BuildingArtwork itemId={candidateItem.id} rotation={candidate.rotation} />
          </button>
        ) : null}
      </div>

      <p className={styles.hint}>
        {candidate ? "置きたい場所をタップ、または建物をドラッグ" : editMode ? "建物をタップして編集できます" : "指でドラッグ・ピンチできます"}
      </p>

      <div className={styles.zoomControls} aria-label="ズーム操作">
        <button type="button" data-town-control="true" className={styles.zoomButton} onClick={() => zoomBy(-0.12)} aria-label="縮小">−</button>
        <button type="button" data-town-control="true" className={styles.zoomButton} onClick={() => zoomBy(0.12)} aria-label="拡大">＋</button>
      </div>
    </div>
  );
});
