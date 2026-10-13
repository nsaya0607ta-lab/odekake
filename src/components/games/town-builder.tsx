"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILDINGS, FACILITY_PARTS, MAP_SIZE, MILESTONES, PARK_PARTS, PARK_SIZES, advanceTown, buildLine, buyFacilityPart, buyParkLot, createTown, decodeTown, expandParkLot, getTownStats, lineTiles, parkAt, placeParkPart, recordTownEdit, removeFacilityPart, removeParkLot, removeParkPart, touchesRoad, undoTownEdit, upgradeTile, type FacilityPart, type ParkLot, type ParkPart, type ParkSize, type Tool, type Town, type TownEdit } from "@/lib/games/town-builder";
import { TownScene, drawTownIcon, type SceneOptions } from "@/lib/games/town-renderer";
import { TownCanvas } from "@/lib/games/town-canvas";
import { FacilityWorkshop, ParkPurchase, ParkWorkshop } from "./town-workshop";
import styles from "./town-builder.module.css";

type Mode = Tool | "inspect" | "pan" | "decorate";
type Panel = "build" | "view" | "help" | "land" | "customize" | null;
const F = new Intl.NumberFormat("ja-JP");
function BuildingIcon({ kind }: { kind: Tool }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext("2d"); if (c) { c.setTransform(2, 0, 0, 2, 0, 0); drawTownIcon(c, kind, 76, 66); } }, [kind]);
  return <canvas ref={ref} width={152} height={132} className={styles.buildingIcon} aria-hidden="true" />;
}
function Glyph({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "build" ? <><path d="m3 15 12-12 6 6-12 12-6-6ZM6 12l6 6M13 5l6 6" /></> :
      name === "eye" ? <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> :
      name === "back" ? <path d="m14 5-7 7 7 7" /> :
      name === "pan" ? <><path d="M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 4-2 6-6 6h-2c-2 0-3-1-4-3l-4-6c-1-2 1-4 3-2l1 2" /></> :
      name === "inspect" ? <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></> :
      name === "settings" ? <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="currentColor" /><circle cx="16" cy="12" r="2" fill="currentColor" /><circle cx="10" cy="18" r="2" fill="currentColor" /></> :
      name === "undo" ? <><path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14" /></> :
      name === "fullscreen" ? <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /> :
      name === "fit" ? <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><circle cx="12" cy="12" r="3" /></> :
      name === "sun" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" /></> :
      name === "moon" ? <path d="M20 14A9 9 0 0 1 10 3 9 9 0 1 0 20 14Z" /> :
      name === "grid" ? <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18m6-18v18M3 9h18M3 15h18" /></> :
      name === "people" ? <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 4v2" /></> :
      name === "train" ? <><rect x="5" y="2" width="14" height="16" rx="4" /><path d="M5 10h14M12 2v8M8 18l-2 4m10-4 2 4" /><circle cx="8" cy="14" r=".7" /><circle cx="16" cy="14" r=".7" /></> :
      name === "leaf" ? <><path d="M4 20 16 8M5 17C1 5 12 2 21 3c1 11-5 17-16 14Z" /></> :
      <><path d="m3 17 6-6 4 4 8-10M16 5h5v5" /></>}
  </svg>;
}
export function TownBuilder({ userId }: { userId: string }) {
  const key = "odekake-town-builder:v3:" + userId, previousKey = "odekake-town-builder:v2:" + userId, legacyKey = "odekake-town-builder:v1:" + userId;
  const [town, setTown] = useState<Town>(() => createTown());
  const [loadedKey, setLoadedKey] = useState<string | null>(null), [welcome, setWelcome] = useState(false);
  const loaded = loadedKey === key;
  const [mode, setMode] = useState<Mode>("inspect"), [category, setCategory] = useState("交通");
  const [speed, setSpeed] = useState(1), [night, setNight] = useState(false), [grid, setGrid] = useState(false);
  const [selected, setSelected] = useState<number | null>(null), [hover, setHover] = useState<number | null>(null);
  const [preview, setPreview] = useState<number[]>([]), [undo, setUndo] = useState<TownEdit[]>([]);
  const [parkSize, setParkSize] = useState<ParkSize>("small"), [parkKind, setParkKind] = useState<ParkLot["kind"]>("park"), [parkRotated, setParkRotated] = useState(false);
  const [editingLotId, setEditingLotId] = useState<number | null>(null), [part, setPart] = useState<ParkPart | "remove">("tree"), [partRotation, setPartRotation] = useState(0);
  const [notice, updateNotice] = useState("1本指で移動、2本指で拡大・縮小。建物はタップで調べられます。");
  const [toast, setToast] = useState(false), noticeTimer = useRef<number | null>(null);
  const setNotice = useCallback((message: string) => {
    updateNotice(message); setToast(true);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setToast(false), 3200);
  }, []);
  const [saveStatus, setSaveStatus] = useState("読み込み中"), [panel, setPanel] = useState<Panel>(null);
  const [scenery, setScenery] = useState(false), [browserFullscreen, setBrowserFullscreen] = useState(false), [stroke, setStroke] = useState(false);
  const [tileX, setTileX] = useState(10), [tileY, setTileY] = useState(11);
  const canvasRef = useRef<HTMLCanvasElement>(null), sceneRef = useRef<TownScene | null>(null);
  const gameRef = useRef<HTMLElement>(null);
  const selectionRef = useRef<HTMLElement>(null), toolbarRef = useRef<HTMLDivElement>(null), statsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const activeToolRef = useRef<HTMLDivElement>(null);
  const returnControlsRef = useRef<HTMLButtonElement>(null);
  const pendingSave = useRef<{ key: string; town: Town } | null>(null);
  const flushSave = useCallback((showStatus = true) => {
    const snapshot = pendingSave.current; if (!snapshot) return;
    try { localStorage.setItem(snapshot.key, JSON.stringify(snapshot.town)); if (showStatus) setSaveStatus("自動保存済み"); }
    catch { if (showStatus) setSaveStatus("保存できません"); }
  }, []);
  const stateRef = useRef<{ town: Town; options: SceneOptions } | null>(null);
  const sizeRef = useRef({ width: 800, height: 600 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; from: number | null; to: number | null; pan: boolean; moved: boolean; multiple: boolean } | null>(null);
  const stats = useMemo(() => getTownStats(town.tiles, town.levels, town.parks, town.attachments), [town.tiles, town.levels, town.parks, town.attachments]);
  const item = BUILDINGS.find(b => b.id === mode);
  const mission = MILESTONES.find(m => !town.rewards.includes(m.id));
  const active = selected === null ? null : town.tiles[selected];
  const selectedLevel = selected === null ? 0 : town.levels[selected] || 0;
  const selectedLot = selected === null ? undefined : parkAt(town, selected), editingLot = town.parks.find(p => p.id === editingLotId);
  const selectedParts = town.attachments.find(a => a.tile === selected)?.parts;
  const canCustomize = Boolean(selectedLot || active && FACILITY_PARTS.some(p => p.kinds.includes(active)));
  const showSelection = mode === "inspect" && selected !== null && active !== "grass" && active !== "water" && !panel && !scenery && !welcome;
  const canUpgrade = active === "house" || active === "shop" || active === "factory";
  const linearTool = mode === "road" || mode === "rail";
  const connected = selected !== null && touchesRoad(town.tiles, selected % MAP_SIZE, Math.floor(selected / MAP_SIZE));
  const net = stats.income - stats.upkeep;
  const phase = stats.population >= 500 ? "小さな都市" : stats.population >= 150 ? "にぎやかな街" : "小さな集落";
  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);
  // One stable renderer reads current data without restarting the animation on React updates.
  useEffect(() => { stateRef.current = { town, options: { night, grid, hover, selected, preview, tool: mode, routes: stats.routes, paused: town.paused || welcome || !loaded, speed, parkSize, parkKind, parkRotated, editLot: mode === "decorate" ? editingLotId ?? undefined : undefined, parkPart: part, partRotation } }; }, [town, night, grid, hover, selected, preview, mode, stats.routes, welcome, loaded, speed, parkSize, parkKind, parkRotated, editingLotId, panel, part, partRotation]);
  useEffect(() => {
    setLoadedKey(null); setUndo([]); setSelected(null); setPanel(null); pendingSave.current = null;
    try { const saved = decodeTown(localStorage.getItem(key) ?? localStorage.getItem(previousKey) ?? localStorage.getItem(legacyKey)); if (saved) { setTown(saved); setWelcome(false); } else { setTown(createTown()); setWelcome(true); setSaveStatus("開始すると自動保存"); } }
    catch { setTown(createTown()); setWelcome(true); setSaveStatus("保存できません"); }
    setLoadedKey(key);
  }, [key, previousKey, legacyKey]);
  useEffect(() => {
    if (!loaded || welcome) { pendingSave.current = null; return; }
    pendingSave.current = { key, town }; setSaveStatus("保存中");
    const timer = window.setTimeout(() => flushSave(), 350);
    return () => window.clearTimeout(timer);
  }, [town, key, loaded, welcome, flushSave]);
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const oldHtmlOverflow = html.style.overflow, oldBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden"; body.style.overflow = "hidden";
    const save = () => flushSave(false);
    const visibility = () => { if (document.hidden) save(); };
    const fullscreen = () => setBrowserFullscreen(document.fullscreenElement === gameRef.current);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      save(); html.style.overflow = oldHtmlOverflow; body.style.overflow = oldBodyOverflow;
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [flushSave]);
  useEffect(() => { if (scenery) returnControlsRef.current?.focus(); }, [scenery]);
  useEffect(() => {
    if ((!showSelection && panel !== "customize" && mode !== "decorate") || selected === null) return;
    // Keep the selected roof and foundation above the compact card, without a modal backdrop.
    const keepVisible = () => {
      const scene = sceneRef.current, currentTown = stateRef.current?.town; if (!scene || !currentTown) return;
      const { width, height } = sizeRef.current;
      const top = (statsRef.current?.getBoundingClientRect().bottom ?? 110) + 14;
      const panelBounds = panel === "customize" ? panelRef.current?.getBoundingClientRect() : null;
      const sidePanel = panelBounds && panelBounds.width < width * .7;
      const right = sidePanel ? panelBounds.left - 14 : width - 24;
      const bottom = (panelBounds && !sidePanel ? panelBounds.top : selectionRef.current?.getBoundingClientRect().top ?? activeToolRef.current?.getBoundingClientRect().top ?? toolbarRef.current?.getBoundingClientRect().top ?? height - 90) - 18;
      let bounds = scene.tileBounds(selected, currentTown);
      const factor = Math.min((panel === "customize" || mode === "decorate") && scene.camera.zoom < 1.4 ? 1.4 / scene.camera.zoom : 1, Math.max(40, bottom - top) / (bounds.bottom - bounds.top), Math.max(40, right - 24) / (bounds.right - bounds.left));
      // Tall homes also fit above the card after rotating a phone into landscape.
      if (factor !== 1) { scene.zoomAt(factor, (bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2); bounds = scene.tileBounds(selected, currentTown); }
      scene.camera.x += bounds.left < 24 ? 24 - bounds.left : bounds.right > right ? right - bounds.right : 0;
      scene.camera.y += bounds.bottom > bottom ? bottom - bounds.bottom : bounds.top < top ? top - bounds.top : 0;
    };
    keepVisible();
    const resize = new ResizeObserver(keepVisible);
    if (gameRef.current) resize.observe(gameRef.current);
    if (selectionRef.current) resize.observe(selectionRef.current);
    if (panelRef.current && panel === "customize") resize.observe(panelRef.current);
    if (activeToolRef.current) resize.observe(activeToolRef.current);
    return () => resize.disconnect();
  }, [showSelection, selected, active, selectedLevel, panel, editingLotId, selectedLot?.width, selectedLot?.height, mode]);
  useEffect(() => {
    if (!loaded || town.paused || welcome) return;
    const timer = window.setInterval(() => setTown(prev => advanceTown(prev)), 2500 / speed);
    const onVisibility = () => { if (document.hidden) setTown(prev => ({ ...prev, paused: true })); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [loaded, town.paused, welcome, speed]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const scene = new TownScene(); sceneRef.current = scene;
    let viewport: TownCanvas;
    try { viewport = new TownCanvas(canvas, scene); } catch { setNotice("このブラウザでは街の表示ができません"); return; }
    let frame = 0, last = 0;
    let rendered: typeof stateRef.current = null;
    let renderedCamera = { x: NaN, y: NaN, zoom: NaN };
    const resize = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect; if (!rect || rect.width < 1 || rect.height < 1) return;
      sizeRef.current = { width: rect.width, height: rect.height };
      const state = stateRef.current;
      if (state) viewport.resize(rect.width, rect.height, window.devicePixelRatio, state.town, state.options);
      rendered = null;
    }); resize.observe(canvas);
    const animate = (timestamp: number) => {
      frame = requestAnimationFrame(animate);
      // Follow the display refresh rate during touch movement; cached artwork keeps this cheap.
      if (document.hidden) { last = 0; return; }
      const dt = last ? (timestamp - last) / 1000 : 0; last = timestamp;
      const state = stateRef.current;
      if (!state) return;
      const camera = scene.camera;
      if (state.options.paused && state === rendered && camera.x === renderedCamera.x && camera.y === renderedCamera.y && camera.zoom === renderedCamera.zoom) return;
      viewport.draw(state.town, state.options, dt);
      rendered = state; renderedCamera = { ...camera };
    }; frame = requestAnimationFrame(animate);
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); scene.zoomAt(Math.exp(-e.deltaY * .0015), e.clientX - r.left, e.clientY - r.top); };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => { cancelAnimationFrame(frame); resize.disconnect(); canvas.removeEventListener("wheel", wheel); sceneRef.current = null; };
  }, [setNotice]);
  const chooseMode = (next: Mode) => { setMode(next); setEditingLotId(null); setStroke(false); setPreview([]); setHover(null); setSelected(null); setNotice(next === "pan" || next === "inspect" ? "1本指で移動、2本指で拡大・縮小。建物はタップで調べられます。" : BUILDINGS.find(b => b.id === next)?.info ?? ""); };
  const closePanel = () => { setPanel(null); if (panel === "customize") { setMode("inspect"); setEditingLotId(null); setPreview([]); setHover(null); } };
  const openCustomize = () => { if (selected === null) return; setPanel("customize"); setEditingLotId(selectedLot?.id ?? null); setMode(selectedLot ? "decorate" : "inspect"); setPart("tree"); setPreview([]); setHover(null); };
  const remember = (next: Town) => {
    setUndo(list => [...list.slice(-19), recordTownEdit(town, next)]);
  };
  const applyEdit = (result: { town: Town; message: string }) => { if (result.town !== town) { remember(result.town); setTown(result.town); } setNotice(result.message); };
  const commit = (path: number[]) => {
    if (!loaded || welcome || !path.length) return;
    if (mode === "pan") return;
    if (mode === "inspect") { setSelected(path[path.length - 1]!); setPanel(null); return; }
    if (mode === "decorate") {
      if (!editingLot) return;
      const tile = path[path.length - 1]!;
      applyEdit(part === "remove" ? removeParkPart(town, editingLot.id, tile) : placeParkPart(town, editingLot.id, tile, part, partRotation)); return;
    }
    if (mode === "park") {
      const i = path[path.length - 1]!, result = buyParkLot(town, i % MAP_SIZE, Math.floor(i / MAP_SIZE), parkSize, parkKind, parkRotated);
      applyEdit(result);
      if (result.lotId !== undefined) { setSelected(result.lotId); setEditingLotId(result.lotId); setMode("decorate"); setPart("tree"); setPanel("customize"); setHover(null); }
      return;
    }
    const result = buildLine(town, mode, path);
    if (result.town !== town) {
      remember(result.town);
      setTown(result.town); setSelected(path[path.length - 1]!);
    }
    setNotice(result.message);
  };
  const undoBuild = () => {
    const prev = undo[undo.length - 1]; if (!prev) return;
    setTown(current => undoTownEdit(current, prev));
    if (editingLotId !== null && !undoTownEdit(town, prev).parks.some(p => p.id === editingLotId)) { setEditingLotId(null); setMode("inspect"); setPanel(null); setSelected(null); }
    setUndo(list => list.slice(0, -1)); setNotice("直前の工事を取り消しました");
  };
  const position = (e: React.PointerEvent<HTMLCanvasElement>) => { const rect = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; };
  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = position(e), scene = sceneRef.current;
    const tile = scene ? mode === "inspect" || mode === "bulldoze" || mode === "decorate" && part === "remove" ? scene.pickTile(p.x, p.y, town) : scene.tileAt(p.x, p.y) : null;
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size > 1) { if (drag.current) drag.current.multiple = true; setPreview([]); return; }
    setHover(null);
    drag.current = { ...p, from: tile, to: tile, pan: !(linearTool && stroke) || e.button !== 0, moved: false, multiple: false };
    if (tile !== null && mode !== "pan" && mode !== "inspect") setPreview([tile]);
  };
  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = position(e), scene = sceneRef.current; if (!scene) return;
    const old = pointers.current.get(e.pointerId);
    if (!old) { if (e.pointerType === "mouse" && mode !== "inspect" && mode !== "pan") setHover(scene.tileAt(p.x, p.y)); return; }
    if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(old.x - other.x, old.y - other.y), after = Math.hypot(p.x - other.x, p.y - other.y);
        if (before > 5) scene.zoomAt(after / before, (old.x + other.x) / 2, (old.y + other.y) / 2);
        scene.camera.x += (p.x - old.x) / 2; scene.camera.y += (p.y - old.y) / 2;
      }
    } else if (drag.current?.multiple) {
      scene.camera.x += p.x - old.x; scene.camera.y += p.y - old.y;
    } else if (drag.current) {
      const d = drag.current;
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > 8) {
        d.moved = true;
        if (d.pan) { scene.camera.x += p.x - d.x; scene.camera.y += p.y - d.y; setPreview([]); }
      } else if (d.pan && d.moved) { scene.camera.x += p.x - old.x; scene.camera.y += p.y - old.y; }
      if (!d.pan) { const tile = scene.tileAt(p.x, p.y); if (tile !== null && tile !== d.to) { d.to = tile; setPreview(d.from !== null ? lineTiles(d.from, tile) : [tile]); } }
    }
    pointers.current.set(e.pointerId, p);
  };
  const pointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; pointers.current.delete(e.pointerId);
    if (d && !d.multiple && !welcome && mode !== "pan" && (!d.pan || !d.moved)) {
      const p = position(e), scene = sceneRef.current;
      const onMap = p.x >= 0 && p.y >= 0 && p.x < sizeRef.current.width && p.y < sizeRef.current.height && document.elementFromPoint(e.clientX, e.clientY) === e.currentTarget;
      const wasTap = Math.hypot(p.x - d.x, p.y - d.y) <= 8;
      const to = onMap && scene && (!d.pan || wasTap) ? mode === "inspect" || mode === "bulldoze" || mode === "decorate" && part === "remove" ? scene.pickTile(p.x, p.y, town) : scene.tileAt(p.x, p.y) : null;
      if (to !== null) commit(!d.pan && d.from !== null ? lineTiles(d.from, to) : [to]);
      else if (mode !== "inspect" && !d.pan) setNotice("マップの外で指を離したため、工事を取り消しました");
    }
    if (!pointers.current.size) drag.current = null; setPreview([]);
  };
  const cancelPointer = () => { drag.current = null; pointers.current.clear(); setPreview([]); };
  const upgrade = () => {
    if (selected === null) return;
    const result = upgradeTile(town, selected);
    if (result.town !== town) { remember(result.town); setTown(result.town); }
    setNotice(result.message);
  };
  const reset = () => {
    if (!window.confirm("今の街を初期化します。よろしいですか？")) return;
    pendingSave.current = null;
    try { localStorage.setItem(key, "null"); localStorage.removeItem(previousKey); localStorage.removeItem(legacyKey); setSaveStatus("開始すると自動保存"); } catch { setSaveStatus("保存できません"); }
    setTown(createTown(false)); setUndo([]); setSelected(null); setPanel(null); setEditingLotId(null); setMode("inspect"); setWelcome(true);
  };
  const viewScenery = (value: boolean) => { setScenery(value); setPanel(null); chooseMode(value ? "pan" : "inspect"); if (!value) canvasRef.current?.focus(); };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (gameRef.current?.requestFullscreen) await gameRef.current.requestFullscreen();
      else viewScenery(true);
    } catch { viewScenery(true); }
  };
  const zoom = (factor: number) => { const { width, height } = sizeRef.current; sceneRef.current?.zoomAt(factor, width / 2, height / 2); };
  const focusTile = (i: number) => {
    const s = sceneRef.current; if (!s) return;
    const x = i % MAP_SIZE + .5, y = Math.floor(i / MAP_SIZE) + .5;
    s.camera.x = sizeRef.current.width / 2 - (x - y) * 32 * s.camera.zoom;
    s.camera.y = sizeRef.current.height / 2 - (x + y) * 16 * s.camera.zoom;
    setHover(i);
  };
  const handleKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const s = sceneRef.current; if (!s) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault(); const current = hover ?? 10 * MAP_SIZE + 10;
      const x = Math.max(0, Math.min(MAP_SIZE - 1, current % MAP_SIZE + (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0)));
      const y = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(current / MAP_SIZE) + (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0)));
      focusTile(y * MAP_SIZE + x);
    } else if (e.key === "Enter" && hover !== null) { e.preventDefault(); commit([hover]); }
    else if (e.key === "+" || e.key === "=") zoom(1.2);
    else if (e.key === "-") zoom(.8);
    else if (e.key === "Escape") { chooseMode("inspect"); setSelected(null); }
    else if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoBuild(); }
  };
  return <main ref={gameRef} className={styles.game} data-town-screen data-scenery={scenery} data-night={night} data-panel={panel ?? "none"} onKeyDown={e => {
    if (e.key === "Escape") { closePanel(); if (scenery) viewScenery(false); }
  }}>
    <section className={styles.world} aria-label="街の建設マップ">
      <canvas ref={canvasRef} className={styles.canvas} tabIndex={0} aria-label="街のマップ。1本指で移動、2本指で拡大縮小。建物をタップして調査。建設時はタップで配置、連続敷設を選ぶとドラッグで道路・線路を敷設。矢印キーとEnterでも操作できます。" onKeyDown={handleKey}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelPointer}
        onLostPointerCapture={() => { if (!pointers.current.size) drag.current = null; }} onPointerLeave={() => { if (!drag.current) setHover(null); }} onContextMenu={e => e.preventDefault()} />
      {welcome && <div className={styles.welcome}><div className={styles.welcomeCard}>
        <span className={styles.eyebrow}>ぼくのまちづくり</span><h2>ここから、<br />あなたの街がはじまる。</h2>
        <p>川のそばに家を建てて、道路を延ばして。<br />小さな暮らしが、にぎやかな街になる。</p>
        <button type="button" className={styles.primary} onClick={() => { setTown(createTown()); setWelcome(false); chooseMode("inspect"); }}>小さな集落からはじめる <span>→</span></button>
        <button type="button" className={styles.secondary} onClick={() => { setTown(createTown(false)); setWelcome(false); chooseMode("inspect"); }}>更地から自由につくる</button>
        <small>下の「建設」から、自由に街をつくれます。</small>
      </div></div>}
    </section>
    <header className={styles.header}>
      <div className={styles.identity}>
        <Link href="/games" className={styles.back} aria-label="ミニゲーム一覧へ戻る" onClick={() => flushSave()}><Glyph name="back" /></Link>
        <div><h1>ぼくのまちづくり</h1><p>{phase}<span> · </span>DAY {town.day}{town.paused || welcome ? " ・一時停止" : ""}</p></div>
      </div>
      <div className={styles.budget}><span>街の予算</span><strong>¥{F.format(town.money)}</strong><small aria-live="polite">{saveStatus}</small></div>
    </header>
    <div ref={statsRef} className={styles.stats} aria-label="街の状況">
      {[{ icon: "people", label: "人口", value: F.format(stats.population), unit: "人" },
        { icon: "leaf", label: "満足度", value: String(stats.happiness), unit: "%" },
        { icon: "train", label: "鉄道", value: String(stats.routes.length), unit: "路線" },
        { icon: "chart", label: "6日ごとの収支", value: `${net >= 0 ? "+" : ""}${F.format(net)}`, unit: "円" }].map(s => <div key={s.label} className={styles.stat}>
        <span className={styles.statIcon}><Glyph name={s.icon} /></span><div><span>{s.label}</span><strong>{s.value}<small>{s.unit}</small></strong></div>
      </div>)}
    </div>
    <div className={styles.sceneButtons}>
      <button type="button" aria-label={town.paused ? "時間を再開" : "時間を停止"} disabled={welcome || !loaded} onClick={() => setTown(t => ({ ...t, paused: !t.paused }))}>{town.paused ? "▶" : "Ⅱ"}</button>
      <button type="button" title="マップ全体を表示" aria-label="マップ全体を表示" onClick={() => sceneRef.current?.fit(sizeRef.current.width, sizeRef.current.height)}><Glyph name="fit" /></button>
      <button type="button" title="街だけを眺める" aria-label="街だけを眺める" disabled={welcome} onClick={() => viewScenery(true)}><Glyph name="eye" /></button>
    </div>
    {mission && !panel && !welcome && !showSelection && mode === "inspect" && <div className={styles.mission}>
      <span className={styles.missionMark}>✦</span><div><small>次の目標</small><b>{mission.title}</b><p>{mission.detail}</p><div className={styles.progress}><i style={{ width: `${Math.min(100, mission.progress(stats) * 100)}%` }} /></div></div><strong>+¥{F.format(mission.reward)}</strong>
    </div>}
    {panel && <aside ref={panelRef} id="town-panel" className={`${styles.sidebar} ${panel === "customize" ? styles.workshop : ""}`} aria-label={panel === "build" ? "建設パネル" : panel === "land" ? "敷地の購入" : panel === "customize" ? "施設の部品" : panel === "view" ? "表示と設定" : "遊び方"}>
      <div className={styles.panelTitle}><h2>{panel === "build" ? "建設" : panel === "land" ? "敷地を選ぶ" : panel === "customize" ? editingLot ? `${editingLot.kind === "park" ? "公園" : "広場"} ${editingLot.width}×${editingLot.height} · 部品` : `${BUILDINGS.find(b => b.id === active)?.title ?? "施設"}の部品` : panel === "view" ? "表示と設定" : "街づくりのヒント"}</h2><button type="button" aria-label="パネルを閉じる" onClick={closePanel}>×</button></div>
      {panel === "build" && <>
        <div className={styles.categories}>{["交通", "建物", "環境"].map(c => <button type="button" key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className={styles.catalog}>{BUILDINGS.filter(b => b.category === category).map(b => <button type="button" key={b.id} aria-pressed={mode === b.id} onClick={() => {
          if (b.id === "park") { chooseMode("inspect"); setPanel("land"); return; }
          chooseMode(b.id); setPanel(null);
        }} className={mode === b.id ? styles.selectedBuild : ""}><BuildingIcon kind={b.id} /><span><b>{b.title}</b><small>{b.price ? `¥${F.format(b.price)}` : "無料"}</small></span></button>)}</div>
        <p className={styles.toolDescription}>選んだら、街をタップして配置。指でドラッグすると移動できます。</p>
      </>}
      {panel === "land" && <ParkPurchase kind={parkKind} size={parkSize} rotated={parkRotated} money={town.money} onKind={setParkKind} onSize={setParkSize} onRotate={() => setParkRotated(v => !v)} onPlace={() => { chooseMode("park"); setPanel(null); }} />}
      {panel === "customize" && (editingLot ? <ParkWorkshop lot={editingLot} part={part} rotation={partRotation} money={town.money} onPart={p => { setPart(p); setPreview([]); setHover(null); setPanel(null); }} onRotate={() => setPartRotation(v => (v + 1) % 4)} onExpand={size => applyEdit(expandParkLot(town, editingLot.id, size))} onRemoveLot={() => {
        if (!window.confirm("この敷地と中の部品を撤去しますか？")) return;
        applyEdit(removeParkLot(town, editingLot.id)); setPanel(null); setEditingLotId(null); setMode("inspect"); setSelected(null);
      }} /> : active && selected !== null ? <FacilityWorkshop kind={active} installed={selectedParts ?? []} money={town.money} onBuy={(id: FacilityPart) => applyEdit(buyFacilityPart(town, selected, id))} onRemove={id => applyEdit(removeFacilityPart(town, selected, id))} /> : null)}
      {panel === "view" && <>
        <div className={styles.viewOptions}>
          <button type="button" aria-label={night ? "昼にする" : "夜にする"} onClick={() => setNight(v => !v)}><Glyph name={night ? "moon" : "sun"} />{night ? "昼にする" : "夜にする"}</button>
          <button type="button" aria-label="マス目の表示" aria-pressed={grid} onClick={() => setGrid(v => !v)}><Glyph name="grid" />マス目</button>
          <button type="button" aria-label="拡大" onClick={() => zoom(1.25)}>＋ 拡大</button>
          <button type="button" aria-label="縮小" onClick={() => zoom(.8)}>− 縮小</button>
          <button type="button" aria-label={browserFullscreen ? "ブラウザの全画面表示を終了" : "ブラウザの全画面表示"} aria-pressed={browserFullscreen} onClick={toggleFullscreen}><Glyph name="fullscreen" />全画面表示</button>
          <button type="button" onClick={() => setPanel("help")}><span className={styles.question} aria-hidden="true">?</span>遊び方</button>
        </div>
        <div className={styles.clock}><span>時間の速さ</span>{[1, 2, 4].map(v => <button type="button" key={v} aria-pressed={speed === v} className={speed === v ? styles.chosenSpeed : ""} onClick={() => setSpeed(v)}>{v}×</button>)}</div>
        <div className={styles.finance}><div><span>税収・交通収入</span><b>+¥{F.format(stats.income)}</b></div><div><span>維持費</span><b>−¥{F.format(stats.upkeep)}</b></div><small>6日ごとに精算 · 次はDAY {Math.ceil((town.day + 1) / 6) * 6}<br />鉄道 {stats.linkedStations}駅が接続 · 雇用 {stats.jobs}人分</small></div>
      </>}
      {panel === "help" && <div className={styles.help}>
        <ol><li><b>指で街を移動する</b><span>1本指でドラッグ、2本指で拡大・縮小。建設・部品の編集でも同じ操作です。</span></li><li><b>タップしてつくる</b><span>「建設」から選び、街をタップして配置。道路・線路は「連続敷設」でまとめてつなげられます。</span></li><li><b>公園をつくる</b><span>敷地の広さを選んで購入し、木・花壇・噴水などの部品を買って配置。通路の上にも設備を置けます。部品だけの撤去や敷地の拡張もできます。</span></li><li><b>施設を育てる</b><span>建物をタップして「部品」から設備を追加。増築や部品の購入は「元に戻す」で取り消せます。2駅を線路で結ぶと列車が運行します。</span></li></ol>
        <details><summary>キーボード・座標で操作</summary><p>マップを選択して矢印キー・Enterで建設。＋／−で拡大縮小。Ctrl／⌘＋Zで工事を取り消せます。</p><div className={styles.coordinates}><label>X<input type="number" min={1} max={24} value={tileX} onChange={e => setTileX(Number(e.target.value))} /></label><label>Y<input type="number" min={1} max={24} value={tileY} onChange={e => setTileY(Number(e.target.value))} /></label><button type="button" onClick={() => {
          if (Number.isInteger(tileX) && Number.isInteger(tileY) && tileX >= 1 && tileY >= 1 && tileX <= 24 && tileY <= 24) { const i = (tileY - 1) * MAP_SIZE + tileX - 1; focusTile(i); commit([i]); }
        }}>選択中の操作を実行</button></div></details>
        <div className={styles.helpFooter}><p>街はこの端末・このアカウントに自動保存されます。別端末とは同期しません。</p><button type="button" onClick={reset}>新しい街をはじめる</button></div>
      </div>}
    </aside>}
    {showSelection && active && selected !== null && <section ref={selectionRef} className={styles.selectionCard} aria-label="選択した建物" data-selected-tile={selected}>
      <div className={styles.selectionInfo}><strong>{selectedLot ? selectedLot.kind === "park" ? "公園" : "広場" : BUILDINGS.find(b => b.id === active)?.title}{town.levels[selected]! > 0 && <small>Lv.{town.levels[selected]}</small>}{selectedLot && <small>{selectedLot.width}×{selectedLot.height}</small>}</strong>
        <p>{selectedLot ? `部品 ${selectedLot.parts.length}点${selectedLot.parts.length ? "" : " · 部品を追加しよう"}` : canUpgrade ? connected ? `道路接続${active === "house" ? ` · 定員 ${(town.levels[selected] || 1) * 18 + (selectedParts?.includes("terrace") ? 6 : 0)}人` : ""}` : "道路への接続が必要です" : active === "station" ? stats.routes.some(r => r[0] === selected || r[r.length - 1] === selected) ? "列車が運行しています" : "もう1つの駅へ線路をつなごう" : "街をつなぐ道"}</p>
      </div>
      {canUpgrade && <button type="button" className={styles.upgrade} onClick={upgrade} disabled={town.levels[selected]! >= 3 || !connected || town.money < (town.levels[selected] || 1) * 450}>{town.levels[selected]! >= 3 ? "最大Lv." : <><span>増築する</span><small>¥{F.format((town.levels[selected] || 1) * 450)}</small></>}</button>}
      {canCustomize && <button type="button" className={styles.customize} aria-label="施設の部品を追加" onClick={openCustomize}>部品<small>追加</small></button>}
      <button type="button" className={styles.dismiss} aria-label="建物の選択を解除" onClick={() => setSelected(null)}>×</button>
    </section>}
    {mode === "decorate" && editingLot && !panel && !welcome && !scenery && <div ref={activeToolRef} className={styles.activeTool} data-decorate="true">
      <div><strong>{part === "remove" ? "部品を撤去" : PARK_PARTS.find(p => p.id === part)?.title}<small>{part === "remove" ? "無料" : `¥${PARK_PARTS.find(p => p.id === part)?.price}`}</small></strong><p>{part === "remove" ? "外す部品をタップ" : "敷地のマスをタップ"}</p></div>
      <button type="button" aria-label="公園の部品を選ぶ" onPointerUp={e => {
        // A mobile browser can suppress the first compatibility click after map panning.
        // Opening a panel is idempotent, so touch release and keyboard/mouse click can share it.
        if (e.pointerType !== "touch" || !e.isPrimary) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) setPanel("customize");
      }} onClick={() => setPanel("customize")}>部品</button>
      <button type="button" aria-label="部品の向きを変える" disabled={part === "remove"} onClick={() => setPartRotation(v => (v + 1) % 4)}>↻ {partRotation * 90}°</button>
      <button type="button" className={styles.dismiss} aria-label="公園の編集を終了" onClick={() => { setMode("inspect"); setEditingLotId(null); setPreview([]); setHover(null); }}>×</button>
    </div>}
    {item && !panel && !welcome && !scenery && <div ref={activeToolRef} className={styles.activeTool}>
      <div><strong>{mode === "park" ? `${parkKind === "park" ? "公園" : "広場"} ${parkRotated ? PARK_SIZES.find(s => s.id === parkSize)!.height : PARK_SIZES.find(s => s.id === parkSize)!.width}×${parkRotated ? PARK_SIZES.find(s => s.id === parkSize)!.width : PARK_SIZES.find(s => s.id === parkSize)!.height}` : item.title}<small>{mode === "park" ? `¥${F.format(PARK_SIZES.find(s => s.id === parkSize)!.price)}` : item.price ? `¥${F.format(item.price)}` : "無料"}</small></strong><p>{mode === "park" ? "空いた場所をタップして敷地を購入" : linearTool && stroke ? "ドラッグで敷設 · 2本指で移動" : "タップで配置 · ドラッグで移動"}</p></div>
      {linearTool && <button type="button" aria-pressed={stroke} onClick={() => { setStroke(v => !v); setPreview([]); }}>{stroke ? "移動に戻す" : "連続敷設"}</button>}
      <button type="button" className={styles.dismiss} aria-label="建設を終了" onClick={() => chooseMode("inspect")}>×</button>
    </div>}
    <div ref={toolbarRef} className={styles.toolbar}>
      <div className={styles.tools}>
        <button type="button" className={styles.buildButton} aria-expanded={panel === "build" || panel === "land"} aria-controls="town-panel" disabled={welcome || !loaded} onClick={() => { if (mode === "decorate") chooseMode("inspect"); setPanel(p => p === "build" ? null : "build"); }}><Glyph name="build" /><span>建設</span></button>
        <button type="button" aria-pressed={mode === "inspect" && !panel} disabled={welcome} onClick={() => { chooseMode("inspect"); setPanel(null); }}><Glyph name="pan" /><span>街を見る</span></button>
        <button type="button" disabled={!undo.length} onClick={undoBuild}><Glyph name="undo" /><span>元に戻す</span></button>
        <button type="button" disabled={welcome} aria-expanded={panel === "view" || panel === "help"} aria-controls="town-panel" onClick={() => { if (mode === "decorate") chooseMode("inspect"); setPanel(p => p === "view" || p === "help" ? null : "view"); }}><Glyph name="settings" /><span>表示・設定</span></button>
      </div>
    </div>
    <p role="status" aria-live="polite" className={styles.notice} data-visible={toast && !scenery && !welcome}>{notice}</p>
    {scenery && <button type="button" ref={returnControlsRef} className={styles.returnControls} onClick={() => viewScenery(false)}><Glyph name="eye" />操作に戻る</button>}
  </main>;
}
