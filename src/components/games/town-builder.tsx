"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILDINGS, MAP_SIZE, MILESTONES, advanceTown, buildLine, createTown, decodeTown, getTownStats, lineTiles, touchesRoad, upgradeTile, type Tool, type Town } from "@/lib/games/town-builder";
import { TownScene, drawTownIcon, type SceneOptions } from "@/lib/games/town-renderer";
import styles from "./town-builder.module.css";

type Mode = Tool | "inspect" | "pan";
type Panel = "build" | "inspect" | "help" | null;
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
  const key = "odekake-town-builder:v1:" + userId;
  const [town, setTown] = useState<Town>(() => createTown());
  const [loadedKey, setLoadedKey] = useState<string | null>(null), [welcome, setWelcome] = useState(false);
  const loaded = loadedKey === key;
  const [mode, setMode] = useState<Mode>("inspect"), [category, setCategory] = useState("交通");
  const [speed, setSpeed] = useState(1), [night, setNight] = useState(false), [grid, setGrid] = useState(false);
  const [selected, setSelected] = useState<number | null>(null), [hover, setHover] = useState<number | null>(null);
  const [preview, setPreview] = useState<number[]>([]), [undo, setUndo] = useState<{ changes: { i: number; before: Town["tiles"][number]; after: Town["tiles"][number]; beforeLevel: number; afterLevel: number }[]; cost: number }[]>([]);
  const [notice, setNotice] = useState("街へようこそ。道路を延ばして、自分だけの街を育てましょう。");
  const [saveStatus, setSaveStatus] = useState("読み込み中"), [panel, setPanel] = useState<Panel>(null);
  const [scenery, setScenery] = useState(false), [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [tileX, setTileX] = useState(10), [tileY, setTileY] = useState(11);
  const canvasRef = useRef<HTMLCanvasElement>(null), sceneRef = useRef<TownScene | null>(null);
  const gameRef = useRef<HTMLElement>(null);
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
  const stats = useMemo(() => getTownStats(town.tiles, town.levels), [town.tiles, town.levels]);
  const item = BUILDINGS.find(b => b.id === mode);
  const mission = MILESTONES.find(m => !town.rewards.includes(m.id));
  const active = selected === null ? null : town.tiles[selected];
  const connected = selected !== null && touchesRoad(town.tiles, selected % MAP_SIZE, Math.floor(selected / MAP_SIZE));
  const net = stats.income - stats.upkeep;
  const phase = stats.population >= 500 ? "小さな都市" : stats.population >= 150 ? "にぎやかな街" : "小さな集落";
  // One stable renderer reads current data without restarting the animation on React updates.
  useEffect(() => { stateRef.current = { town, options: { night, grid, hover, selected, preview, tool: mode, routes: stats.routes, paused: town.paused || welcome || !loaded, speed } }; }, [town, night, grid, hover, selected, preview, mode, stats.routes, welcome, loaded, speed]);
  useEffect(() => {
    setLoadedKey(null); setUndo([]); setSelected(null); setPanel(null); pendingSave.current = null;
    try { const saved = decodeTown(localStorage.getItem(key)); if (saved) { setTown(saved); setWelcome(false); } else { setTown(createTown()); setWelcome(true); setSaveStatus("開始すると自動保存"); } }
    catch { setTown(createTown()); setWelcome(true); setSaveStatus("保存できません"); }
    setLoadedKey(key);
  }, [key]);
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
    if (!loaded || town.paused || welcome) return;
    const timer = window.setInterval(() => setTown(prev => advanceTown(prev)), 2500 / speed);
    const onVisibility = () => { if (document.hidden) setTown(prev => ({ ...prev, paused: true })); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [loaded, town.paused, welcome, speed]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const c = canvas.getContext("2d", { alpha: false }); if (!c) { setNotice("このブラウザでは街の表示ができません"); return; }
    const scene = new TownScene(); sceneRef.current = scene;
    let frame = 0, last = 0, first = true;
    let rendered: typeof stateRef.current = null;
    let renderedCamera = { x: NaN, y: NaN, zoom: NaN };
    const resize = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect; if (!rect || rect.width < 1 || rect.height < 1) return;
      const old = sizeRef.current;
      sizeRef.current = { width: rect.width, height: rect.height };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      rendered = null;
      if (first) { scene.camera.zoom = rect.width < 600 ? .85 : 1.12;
        scene.camera.x = rect.width / 2 + 32 * scene.camera.zoom;
        scene.camera.y = rect.height * .48 - 20 * 16 * scene.camera.zoom;
        first = false; }
      else { scene.camera.x += (rect.width - old.width) / 2; scene.camera.y += (rect.height - old.height) / 2; }
    }); resize.observe(canvas);
    const animate = (timestamp: number) => {
      frame = requestAnimationFrame(animate);
      if (timestamp - last < 32 || document.hidden) return;
      const dt = last ? (timestamp - last) / 1000 : 0; last = timestamp;
      const state = stateRef.current;
      if (!state) return;
      const camera = scene.camera;
      if (state.options.paused && state === rendered && camera.x === renderedCamera.x && camera.y === renderedCamera.y && camera.zoom === renderedCamera.zoom) return;
      scene.render(c, sizeRef.current.width, sizeRef.current.height, state.town, state.options, dt);
      rendered = state; renderedCamera = { ...camera };
    }; frame = requestAnimationFrame(animate);
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); scene.zoomAt(Math.exp(-e.deltaY * .0015), e.clientX - r.left, e.clientY - r.top); };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => { cancelAnimationFrame(frame); resize.disconnect(); canvas.removeEventListener("wheel", wheel); sceneRef.current = null; };
  }, []);
  const chooseMode = (next: Mode) => { setMode(next); setPreview([]); setNotice(next === "pan" ? "ドラッグで街を移動。2本の指で拡大・縮小できます。" : next === "inspect" ? "建物をタップして調査。増築で大きくできます。" : BUILDINGS.find(b => b.id === next)?.info ?? ""); };
  const remember = (next: Town) => {
    const changes = town.tiles.flatMap((before, i) => before !== next.tiles[i] || town.levels[i] !== next.levels[i] ? [{ i, before, after: next.tiles[i]!, beforeLevel: town.levels[i]!, afterLevel: next.levels[i]! }] : []);
    setUndo(list => [...list.slice(-19), { changes, cost: town.money - next.money }]);
  };
  const commit = (path: number[]) => {
    if (!loaded || welcome || !path.length) return;
    if (mode === "pan") return;
    if (mode === "inspect") { setSelected(path[path.length - 1]!); setPanel("inspect"); return; }
    const result = buildLine(town, mode, path);
    if (result.town !== town) {
      remember(result.town);
      setTown(result.town); setSelected(path[path.length - 1]!);
    }
    setNotice(result.message);
  };
  const undoBuild = () => {
    const prev = undo[undo.length - 1]; if (!prev) return;
    setTown(current => {
      const tiles = current.tiles.slice(), levels = current.levels.slice();
      for (const change of prev.changes) { tiles[change.i] = change.before; levels[change.i] = change.beforeLevel; }
      return { ...current, tiles, levels, money: current.money + prev.cost };
    });
    setUndo(list => list.slice(0, -1)); setNotice("直前の工事を取り消しました");
  };
  const position = (e: React.PointerEvent<HTMLCanvasElement>) => { const rect = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; };
  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = position(e), scene = sceneRef.current;
    const tile = scene ? mode === "inspect" || mode === "bulldoze" ? scene.pickTile(p.x, p.y, town) : scene.tileAt(p.x, p.y) : null;
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size > 1) { if (drag.current) drag.current.multiple = true; setPreview([]); return; }
    drag.current = { ...p, from: tile, to: tile, pan: mode === "pan" || mode === "inspect" || e.button !== 0, moved: false, multiple: false };
    if (tile !== null && mode !== "pan" && mode !== "inspect") setPreview([tile]);
  };
  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = position(e), scene = sceneRef.current; if (!scene) return;
    const tile = mode === "inspect" || mode === "bulldoze" ? scene.pickTile(p.x, p.y, town) : scene.tileAt(p.x, p.y); setHover(tile);
    const old = pointers.current.get(e.pointerId); if (!old) return;
    if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(old.x - other.x, old.y - other.y), after = Math.hypot(p.x - other.x, p.y - other.y);
        if (before > 5) scene.zoomAt(after / before, (p.x + other.x) / 2, (p.y + other.y) / 2);
        scene.camera.x += (p.x - old.x) / 2; scene.camera.y += (p.y - old.y) / 2;
      }
    } else if (drag.current?.multiple) {
      scene.camera.x += p.x - old.x; scene.camera.y += p.y - old.y;
    } else if (drag.current) {
      const d = drag.current; if (Math.hypot(p.x - d.x, p.y - d.y) > 5) d.moved = true;
      if (d.pan && d.moved) { scene.camera.x += p.x - old.x; scene.camera.y += p.y - old.y; }
      else if (!d.pan && tile !== null) { d.to = tile; setPreview(["road", "rail", "bulldoze"].includes(mode) && d.from !== null ? lineTiles(d.from, tile) : [tile]); }
    }
    pointers.current.set(e.pointerId, p);
  };
  const pointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; pointers.current.delete(e.pointerId);
    if (d && !d.multiple && !welcome) {
      if (d.pan && !d.moved && mode === "inspect" && d.from !== null) commit([d.from]);
      else if (!d.pan && d.from !== null && d.to !== null) {
        const p = position(e);
        const scene = sceneRef.current;
        const onMap = p.x >= 0 && p.y >= 0 && p.x < sizeRef.current.width && p.y < sizeRef.current.height && document.elementFromPoint(e.clientX, e.clientY) === e.currentTarget;
        const to = onMap && scene ? mode === "bulldoze" ? scene.pickTile(p.x, p.y, town) : scene.tileAt(p.x, p.y) : null;
        if (to !== null) commit(["road", "rail", "bulldoze"].includes(mode) ? lineTiles(d.from, to) : [to]);
        else setNotice("マップの外で指を離したため、工事を取り消しました");
      }
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
    try { localStorage.removeItem(key); setSaveStatus("開始すると自動保存"); } catch { setSaveStatus("保存できません"); }
    setTown(createTown(false)); setUndo([]); setSelected(null); setPanel(null); setWelcome(true);
  };
  const viewScenery = (value: boolean) => { setScenery(value); setPanel(null); chooseMode("pan"); setHover(null); setSelected(null); if (!value) canvasRef.current?.focus(); };
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
  return <main ref={gameRef} className={styles.game} data-town-screen data-scenery={scenery} data-night={night} onKeyDown={e => {
    if (e.key === "Escape") { setPanel(null); if (scenery) viewScenery(false); }
  }}>
    <section className={styles.world} aria-label="街の建設マップ">
      <canvas ref={canvasRef} className={styles.canvas} tabIndex={0} aria-label="街のマップ。矢印キーでマスを選択、Enterで建設。ドラッグで道路・線路を敷設、移動モードではドラッグで街を移動。" onKeyDown={handleKey}
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
    <div className={styles.stats} aria-label="街の状況">
      {[{ icon: "people", label: "人口", value: F.format(stats.population), unit: "人" },
        { icon: "leaf", label: "満足度", value: String(stats.happiness), unit: "%" },
        { icon: "train", label: "鉄道", value: String(stats.routes.length), unit: "路線" },
        { icon: "chart", label: "6日ごとの収支", value: `${net >= 0 ? "+" : ""}${F.format(net)}`, unit: "円" }].map(s => <div key={s.label} className={styles.stat}>
        <span className={styles.statIcon}><Glyph name={s.icon} /></span><div><span>{s.label}</span><strong>{s.value}<small>{s.unit}</small></strong></div>
      </div>)}
    </div>
    <div className={styles.sceneButtons}>
      <button type="button" title={night ? "昼にする" : "夜にする"} aria-label={night ? "昼にする" : "夜にする"} onClick={() => setNight(v => !v)}><Glyph name={night ? "moon" : "sun"} /></button>
      <button type="button" title="マス目の表示" aria-label="マス目の表示" aria-pressed={grid} onClick={() => setGrid(v => !v)}><Glyph name="grid" /></button>
      <button type="button" title="マップ全体を表示" aria-label="マップ全体を表示" onClick={() => sceneRef.current?.fit(sizeRef.current.width, sizeRef.current.height)}><Glyph name="fit" /></button>
      <button type="button" title="街だけを眺める" aria-label="街だけを眺める" disabled={welcome} onClick={() => viewScenery(true)}><Glyph name="eye" /></button>
      <button type="button" title="全画面表示" aria-label={browserFullscreen ? "ブラウザの全画面表示を終了" : "ブラウザの全画面表示"} aria-pressed={browserFullscreen} onClick={toggleFullscreen}><Glyph name="fullscreen" /></button>
      <button type="button" aria-label="拡大" onClick={() => zoom(1.25)}>＋</button>
      <button type="button" aria-label="縮小" onClick={() => zoom(.8)}>−</button>
    </div>
    {mission && !panel && !welcome && <div className={styles.mission}>
      <span className={styles.missionMark}>✦</span><div><small>次の目標</small><b>{mission.title}</b><p>{mission.detail}</p><div className={styles.progress}><i style={{ width: `${Math.min(100, mission.progress(stats) * 100)}%` }} /></div></div><strong>+¥{F.format(mission.reward)}</strong>
    </div>}
    <div className={styles.clock}>
      <button type="button" aria-label={town.paused ? "時間を再開" : "時間を停止"} disabled={welcome || !loaded} onClick={() => setTown(t => ({ ...t, paused: !t.paused }))}>{town.paused ? "▶" : "Ⅱ"}</button>
      {[1, 2, 4].map(v => <button type="button" key={v} aria-pressed={speed === v} className={speed === v ? styles.chosenSpeed : ""} onClick={() => setSpeed(v)}>{v}×</button>)}
    </div>
    {panel && <aside id="town-panel" className={styles.sidebar} aria-label={panel === "build" ? "建設パネル" : panel === "inspect" ? "調査パネル" : "遊び方"}>
      <div className={styles.panelTitle}><h2>{panel === "build" ? "街に、新しい暮らしを。" : panel === "inspect" ? "建物を調べる" : "街づくりのヒント"}</h2><button type="button" aria-label="パネルを閉じる" onClick={() => setPanel(null)}>×</button></div>
      {panel === "build" && <>
        <div className={styles.categories}>{["交通", "建物", "環境"].map(c => <button type="button" key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className={styles.catalog}>{BUILDINGS.filter(b => b.category === category).map(b => <button type="button" key={b.id} aria-pressed={mode === b.id} onClick={() => {
          chooseMode(b.id); if (window.matchMedia("(max-width: 640px)").matches) setPanel(null);
        }} className={mode === b.id ? styles.selectedBuild : ""}><BuildingIcon kind={b.id} /><span><b>{b.title}</b><small>{b.price ? `¥${F.format(b.price)}` : "無料"}</small></span></button>)}</div>
        <p className={styles.toolDescription}>{item?.info ?? "つくりたいものを選び、街のマスを押して建設します。"}</p>
      </>}
      {panel === "inspect" && active && selected !== null && <div className={styles.inspector}>
        <small>マス {selected % MAP_SIZE + 1}, {Math.floor(selected / MAP_SIZE) + 1}</small><h3>{BUILDINGS.find(b => b.id === active)?.title ?? (active === "water" ? "川" : "更地")}{town.levels[selected]! > 0 && <span>Lv.{town.levels[selected]}</span>}</h3>
        {["house", "shop", "factory"].includes(active) && <><p>{connected ? "道路に接続しています" : "道路への接続がありません"}</p>{active === "house" && <p>定員 {(town.levels[selected] || 1) * 18}人</p>}<button type="button" onClick={upgrade} disabled={town.levels[selected]! >= 3 || !connected || town.money < (town.levels[selected] || 1) * 450}>{town.levels[selected]! >= 3 ? "最大まで発展しました" : `増築する ¥${F.format((town.levels[selected] || 1) * 450)}`}</button></>}
        {active === "station" && <p>{stats.routes.some(r => r[0] === selected || r[r.length - 1] === selected) ? "鉄道開通・列車が運行しています" : "もう1つの駅へ線路をつなげましょう"}</p>}
        {active === "grass" && <p>「建設」から建物や道路を選べます。</p>}
      </div>}
      {panel !== "help" && <div className={styles.finance}><div><span>税収・交通収入</span><b>+¥{F.format(stats.income)}</b></div><div><span>維持費</span><b>−¥{F.format(stats.upkeep)}</b></div><small>6日ごとに精算 · 次はDAY {Math.ceil((town.day + 1) / 6) * 6}<br />鉄道 {stats.linkedStations}駅が接続 · 雇用 {stats.jobs}人分</small></div>}
      {panel === "help" && <div className={styles.help}>
        <ol><li><b>道路を延ばす</b><span>「建設」から道路・線路を選び、始点から終点へドラッグします。</span></li><li><b>暮らしをつくる</b><span>道路沿いに住宅と商店。公園で満足度を上げると、街が自動で成長します。調査から増築もできます。</span></li><li><b>鉄道を開通する</b><span>離れた2駅を線路で結ぶと列車が運行。駅の周囲3マスの住宅が輸送収入につながります。</span></li><li><b>街を眺める</b><span>移動・調査モードでドラッグ移動。ピンチ・ホイールで拡大。「街だけを眺める」で操作表示を隠せます。</span></li></ol>
        <details><summary>キーボード・座標で操作</summary><p>マップを選択して矢印キー・Enterで建設。＋／−で拡大縮小。Ctrl／⌘＋Zで工事を取り消せます。</p><div className={styles.coordinates}><label>X<input type="number" min={1} max={24} value={tileX} onChange={e => setTileX(Number(e.target.value))} /></label><label>Y<input type="number" min={1} max={24} value={tileY} onChange={e => setTileY(Number(e.target.value))} /></label><button type="button" onClick={() => {
          if (Number.isInteger(tileX) && Number.isInteger(tileY) && tileX >= 1 && tileY >= 1 && tileX <= 24 && tileY <= 24) { const i = (tileY - 1) * MAP_SIZE + tileX - 1; focusTile(i); commit([i]); }
        }}>選択中の操作を実行</button></div></details>
        <div className={styles.helpFooter}><p>街はこの端末・このアカウントに自動保存されます。別端末とは同期しません。</p><button type="button" onClick={reset}>新しい街をはじめる</button></div>
      </div>}
    </aside>}
    <div className={styles.toolbar}>
      <p role="status" aria-live="polite" className={styles.notice}>{notice}</p>
      <div className={styles.tools}>
        <button type="button" className={styles.buildButton} aria-expanded={panel === "build"} aria-controls="town-panel" disabled={welcome || !loaded} onClick={() => setPanel(p => p === "build" ? null : "build")}><Glyph name="build" /><span>建設</span></button>
        {(["inspect", "pan"] as const).map(m => <button type="button" key={m} aria-pressed={mode === m} disabled={welcome} onClick={() => { chooseMode(m); setPanel(null); }}><Glyph name={m} /><span>{m === "inspect" ? "調査" : "移動"}</span></button>)}
        <button type="button" disabled={!undo.length} onClick={undoBuild}><Glyph name="undo" /><span>元に戻す</span></button>
        <button type="button" disabled={welcome} aria-expanded={panel === "help"} aria-controls="town-panel" onClick={() => setPanel(p => p === "help" ? null : "help")}><span className={styles.question} aria-hidden="true">?</span><span>遊び方</span></button>
      </div>
    </div>
    {scenery && <button type="button" ref={returnControlsRef} className={styles.returnControls} onClick={() => viewScenery(false)}><Glyph name="eye" />操作に戻る</button>}
  </main>;
}
