"use client";
import { buildingStage } from "@/lib/games/town-building-models";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILDINGS, FACILITY_PARTS, MAP_SIZE, PARK_PARTS, PARK_SIZES, createTown, decodeTown, getTownStats, lineTiles, parkAt, touchesRoad, type FacilityPart, type ParkLot, type ParkPart, type ParkSize, type Tool, type Town } from "@/lib/games/town-builder";
import { TownScene, drawTownIcon, type SceneOptions } from "@/lib/games/town-renderer";
import { TownCanvas } from "@/lib/games/town-canvas";
import { TownTouchControls } from "@/lib/games/town-touch-controls";
import { FacilityWorkshop, ParkPurchase, ParkWorkshop } from "./town-workshop";
import { WhiteCoinArt } from "@/components/coin-art";
import { decodeTownSnapshot } from "@/lib/data/town-builder";
import type { TownCommand } from "@/lib/games/town-commands";
import { TOWN_QUESTS, townProgress, townQuestMetrics, townRank, type TownSnapshot } from "@/lib/games/town-progression";
import { TownCrest, TownRpgPanel, WhitePrice } from "./town-rpg";
import { useTownSky, type TownSkyModes } from "./use-town-sky";
import { townClockLabel } from "@/lib/games/town-environment";
import { WEATHER_LABEL } from "@/lib/room/weather";
import styles from "./town-builder.module.css";

type Mode = Tool | "inspect" | "pan" | "decorate";
type Panel = "build" | "view" | "help" | "land" | "customize" | "quests" | null;
type TownRequest = { userId: string; requestId: string; revision: number; action: "start" | "edit" | "undo" | "quest" | "daily" | "reset"; command?: TownCommand; questId?: string; starter?: boolean; legacy?: Town };
const F = new Intl.NumberFormat("ja-JP");
const compactMoney = new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 });
// Only our own Japanese errors are shown; browser fetch failures ("Failed to fetch", "Load failed") use the fallback.
const connectionMessage = (error: unknown, fallback: string) => error instanceof Error && error.name === "Error" && error.message ? error.message : fallback;
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
      name === "quests" ? <><path d="M6 3h12v18l-6-3-6 3V3Z" /><path d="m9 10 2 2 4-4" /></> :
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
type TownSky = ReturnType<typeof useTownSky>;
type SkyEnvironment = NonNullable<TownSky["environment"]>;
function skyIcon(env: SkyEnvironment) {
  if (env.night > .55 && (env.weather === "clear" || env.weather === "partly")) return "🌙";
  return WEATHER_LABEL[env.weather].icon;
}
function skyWord(env: SkyEnvironment) { return WEATHER_LABEL[env.weather].label; }
const TIME_CHOICES: { id: TownSkyModes["time"]; label: string }[] = [{ id: "real", label: "現実" }, { id: "morning", label: "朝" }, { id: "day", label: "昼" }, { id: "evening", label: "夕方" }, { id: "night", label: "夜" }];
const WEATHER_CHOICES: { id: TownSkyModes["weather"]; label: string }[] = [{ id: "real", label: "現実" }, { id: "clear", label: "晴れ" }, { id: "cloudy", label: "くもり" }, { id: "rain", label: "雨" }, { id: "snow", label: "雪" }];
/** The sky follows the real time and weather of the My Room place; it can also be fixed for viewing. */
function SkySettings({ sky }: { sky: TownSky }) {
  const env = sky.environment;
  return <section className={styles.skySettings} aria-label="空と天気">
    <div className={styles.skyNow}><span aria-hidden="true">{env ? skyIcon(env) : "☁️"}</span><div><b>{env ? `${skyWord(env)}${env.temperature === null ? "" : ` ${Math.round(env.temperature)}℃`}` : "空を読み込み中"}</b><small>{sky.placeName} · {env ? townClockLabel(env) : "--:--"}{env?.live ? " · 現実と同じ" : " · 表示を変更中"}</small></div></div>
    <div className={styles.skyChoices} role="group" aria-label="時間帯">{TIME_CHOICES.map(c => <button type="button" key={c.id} aria-pressed={sky.modes.time === c.id} onClick={() => sky.setMode({ time: c.id })}>{c.label}</button>)}</div>
    <div className={styles.skyChoices} role="group" aria-label="天気">{WEATHER_CHOICES.map(c => <button type="button" key={c.id} aria-pressed={sky.modes.weather === c.id} onClick={() => sky.setMode({ weather: c.id })}>{c.label}</button>)}</div>
    <small>「現実」は、マイルームで選んだ場所{sky.place.saved ? "" : "（未設定のため東京）"}の時刻と天気です。</small>
  </section>;
}
export function TownBuilder({ userId }: { userId: string }) {
  const key = "odekake-town-builder:v3:" + userId, previousKey = "odekake-town-builder:v2:" + userId, legacyKey = "odekake-town-builder:v1:" + userId;
  const [town, setTown] = useState<Town>(() => createTown());
  const [loadedKey, setLoadedKey] = useState<string | null>(null), [welcome, setWelcome] = useState(false);
  const loaded = loadedKey === key;
  const [mode, setMode] = useState<Mode>("inspect"), [category, setCategory] = useState("交通");
  const [speed, setSpeed] = useState(1), [grid, setGrid] = useState(false);
  const sky = useTownSky(), environment = sky.environment, night = (environment?.night ?? 0) > .55;
  const darkness = useRef(0); darkness.current = environment?.night ?? 0;
  const [selected, setSelected] = useState<number | null>(null), [hover, setHover] = useState<number | null>(null);
  const [preview, setPreview] = useState<number[]>([]);
  const [snapshot, setSnapshot] = useState<TownSnapshot | null>(null), [busy, setBusy] = useState(false), [connectionError, setConnectionError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const readVersion = useRef(0), readController = useRef<AbortController | null>(null), lastReadAt = useRef(-Infinity);
  const serverClock = useRef<{ time: number; received: number; wall: number } | null>(null);
  const economyRef = useRef<TownSnapshot | null>(null), inFlight = useRef(false), pendingRequest = useRef<TownRequest | null>(null);
  const accountRef = useRef(userId), interaction = useRef(0);
  accountRef.current = userId;
  const [rpgTab, setRpgTab] = useState<"quests" | "growth">("quests");
  const [levelUp, setLevelUp] = useState<{ level: number; reward: number } | null>(null);
  const [parkSize, setParkSize] = useState<ParkSize>("small"), [parkKind, setParkKind] = useState<ParkLot["kind"]>("park"), [parkRotated, setParkRotated] = useState(false);
  const [editingLotId, setEditingLotId] = useState<number | null>(null), [part, setPart] = useState<ParkPart | "remove">("tree"), [partRotation, setPartRotation] = useState(0);
  const [notice, updateNotice] = useState("1本指で移動、2本指で拡大・縮小。建物はタップで調べられます。");
  const [toast, setToast] = useState(false), noticeTimer = useRef<number | null>(null);
  const setNotice = useCallback((message: string, visible = true) => {
    updateNotice(message); setToast(visible);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = visible ? window.setTimeout(() => setToast(false), 3200) : null;
  }, []);
  const [saveStatus, setSaveStatus] = useState("読み込み中"), [panel, setPanel] = useState<Panel>(null);
  const [scenery, setScenery] = useState(false), [browserFullscreen, setBrowserFullscreen] = useState(false), [stroke, setStroke] = useState(false);
  const [tileX, setTileX] = useState(10), [tileY, setTileY] = useState(11);
  const canvasRef = useRef<HTMLCanvasElement>(null), sceneRef = useRef<TownScene | null>(null);
  const gameRef = useRef<HTMLElement>(null);
  const touchControls = useRef<TownTouchControls | null>(null);
  if (!touchControls.current) touchControls.current = new TownTouchControls();
  const headerRef = useRef<HTMLElement>(null), selectionRef = useRef<HTMLElement>(null), toolbarRef = useRef<HTMLDivElement>(null), statsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const activeToolRef = useRef<HTMLDivElement>(null);
  const returnControlsRef = useRef<HTMLButtonElement>(null);
  const pendingSave = useRef<{ key: string; town: Town } | null>(null);
  const flushSave = useCallback((showStatus = true) => {
    const snapshot = pendingSave.current; if (!snapshot) return;
    try { localStorage.setItem(snapshot.key, JSON.stringify(snapshot.town)); }
    catch { if (showStatus) setSaveStatus("保存できません"); }
  }, []);
  const stateRef = useRef<{ town: Town; options: SceneOptions } | null>(null);
  const sizeRef = useRef({ width: 800, height: 600 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; from: number | null; to: number | null; pan: boolean; moved: boolean; multiple: boolean } | null>(null);
  const cancelPointer = useCallback(() => { drag.current = null; pointers.current.clear(); touchControls.current?.cancel(); setPreview([]); }, []);
  useEffect(() => {
    cancelPointer();
    const visibility = () => { if (document.hidden) cancelPointer(); };
    window.addEventListener("blur", cancelPointer);
    window.addEventListener("resize", cancelPointer);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", cancelPointer);
      window.removeEventListener("resize", cancelPointer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [panel, welcome, loaded, cancelPointer]);
  const stats = useMemo(() => getTownStats(town.tiles, town.levels, town.parks, town.attachments), [town.tiles, town.levels, town.parks, town.attachments]);
  const item = BUILDINGS.find(b => b.id === mode);
  const progress = townProgress(snapshot?.xp ?? 0), rank = townRank(progress.level);
  const questMetrics = useMemo(() => townQuestMetrics({ tiles: town.tiles, levels: town.levels, parks: town.parks, attachments: town.attachments }, stats), [town.tiles, town.levels, town.parks, town.attachments, stats]);
  const readyQuests = snapshot ? TOWN_QUESTS.filter(q => q.level <= progress.level && !snapshot.claimedQuests.includes(q.id) && (questMetrics[q.id] ?? 0) >= q.target).length + (snapshot.dailyClaimed ? 0 : 1) + (!snapshot.dailyQuestClaimed && snapshot.dailySpent >= 500 ? 1 : 0) : 0;
  const active = selected === null ? null : town.tiles[selected];
  const selectedLevel = selected === null ? 0 : town.levels[selected] || 0;
  const selectedStage = buildingStage(active ?? undefined, selectedLevel), nextStage = selectedLevel < 3 ? buildingStage(active ?? undefined, selectedLevel + 1) : undefined;
  const selectedLot = selected === null ? undefined : parkAt(town, selected), editingLot = town.parks.find(p => p.id === editingLotId);
  const selectedParts = town.attachments.find(a => a.tile === selected)?.parts;
  const canCustomize = Boolean(selectedLot || active && FACILITY_PARTS.some(p => p.kinds.includes(active)));
  const showSelection = mode === "inspect" && selected !== null && active !== "grass" && active !== "water" && !panel && !scenery && !welcome;
  const canUpgrade = active === "house" || active === "shop" || active === "factory";
  const homeTile = town.tiles.indexOf("home");
  const linearTool = mode === "road" || mode === "rail";
  const connected = selected !== null && touchesRoad(town.tiles, selected % MAP_SIZE, Math.floor(selected / MAP_SIZE));
  const phase = stats.population >= 500 ? "小さな都市" : stats.population >= 150 ? "にぎやかな街" : "小さな集落";
  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);
  // One stable renderer reads current data without restarting the animation on React updates.
  useEffect(() => { stateRef.current = { town, options: { night, environment: environment ?? undefined, grid, hover, selected, preview, tool: mode, routes: stats.routes, paused: town.paused || welcome || !loaded, speed, parkSize, parkKind, parkRotated, editLot: mode === "decorate" ? editingLotId ?? undefined : undefined, parkPart: part, partRotation } }; }, [town, night, environment, grid, hover, selected, preview, mode, stats.routes, welcome, loaded, speed, parkSize, parkKind, parkRotated, editingLotId, panel, part, partRotation]);
  const receiveSnapshot = useCallback((next: TownSnapshot, celebrate = false) => {
    const previous = economyRef.current;
    if (previous && next.revision < previous.revision) return;
    if (celebrate && previous) {
      const beforeLevel = townProgress(previous.xp).level, afterLevel = townProgress(next.xp).level;
      if (afterLevel > beforeLevel) {
        let reward = 0;
        for (let l = Math.max(previous.maxLevel + 1, beforeLevel + 1); l <= afterLevel; l++) reward += 200 + l * 50;
        setLevelUp({ level: afterLevel, reward });
      }
    }
    economyRef.current = next; setSnapshot(next);
    // Every saved change raises the revision, so a same-revision refresh only updates the wallet.
    // Keeping the town arrays avoids redrawing the whole map and re-framing a selected building.
    if (previous?.revision === next.revision) { if (next.town) setTown(t => t.money === next.balance ? t : { ...t, money: next.balance }); }
    else if (next.town) {
      setTown(previousTown => ({ ...next.town!, money: next.balance, day: Math.max(previousTown.day, next.town!.day), paused: previousTown.paused }));
      setWelcome(false);
    } else { setWelcome(true); setTown(createTown()); }
    setConnectionError(""); setSaveStatus("アカウント保存済み");
  }, []);
  const readServerClock = useCallback((response: Response) => {
    const time = Date.parse(response.headers.get("date") ?? "");
    if (Number.isFinite(time)) serverClock.current = { time, received: performance.now(), wall: Date.now() };
  }, []);
  const cancelReads = useCallback(() => {
    readVersion.current++; readController.current?.abort(); readController.current = null;
  }, []);
  const loadGame = useCallback(async (signal?: AbortSignal, background = false) => {
    if (signal?.aborted || background && (inFlight.current || pendingRequest.current || readController.current)) return;
    const version = ++readVersion.current, account = userId;
    readController.current?.abort();
    const controller = new AbortController(); readController.current = controller;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const current = () => accountRef.current === account && version === readVersion.current && !signal?.aborted;
    const timeout = window.setTimeout(abort, 20_000);
    lastReadAt.current = performance.now(); setRefreshing(true);
    let saved: Town | null = null;
    try { saved = decodeTown(localStorage.getItem(key) ?? localStorage.getItem(previousKey) ?? localStorage.getItem(legacyKey)); } catch { /* Account save is still available. */ }
    if (saved && !economyRef.current) setTown(saved);
    try {
      const response = await fetch(`/api/games/town-builder?account=${encodeURIComponent(userId)}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json().catch(() => null);
      if (!current()) return;
      if (controller.signal.aborted) throw new DOMException("Connection timeout", "AbortError");
      if (!body || response.redirected) throw new Error("ログイン状態と通信を確認して、再試行してください。");
      const remote = decodeTownSnapshot(body.snapshot);
      if (!response.ok || !remote) throw new Error(body.error ?? "街の保存データに接続できません。");
      readServerClock(response);
      if (!remote.town && saved) {
        // Store the import request before sending it so an interrupted response can be retried safely.
        const importKey = `${key}:import-request`;
        let requestId: string;
        try { const oldId = localStorage.getItem(importKey); requestId = oldId && /^[0-9a-f-]{36}$/i.test(oldId) ? oldId : crypto.randomUUID(); localStorage.setItem(importKey, requestId); } catch { requestId = crypto.randomUUID(); }
        const imported = await fetch("/api/games/town-builder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, requestId, revision: remote.revision, action: "start", legacy: saved }), signal: controller.signal });
        const result = await imported.json().catch(() => null), importedSnapshot = decodeTownSnapshot(result?.snapshot);
        if (!current()) return;
        if (controller.signal.aborted) throw new DOMException("Connection timeout", "AbortError");
        if (!imported.ok || !importedSnapshot) throw new Error(result?.error ?? "街を引き継げませんでした。");
        readServerClock(imported);
        receiveSnapshot(importedSnapshot); setNotice("これまでの街を引き継ぎました。白コインで新しい開拓へ！");
      } else receiveSnapshot(remote);
      setLoadedKey(key);
    } catch (error) {
      if (!current()) return;
      setConnectionError(connectionMessage(error, error instanceof Error && error.name === "AbortError" ? "接続に時間がかかっています。街を残したまま再試行できます。" : "通信できませんでした。街を残したまま再試行できます。")); setSaveStatus("接続を確認");
      if (!economyRef.current) { setWelcome(!saved); setLoadedKey(key); }
    } finally {
      window.clearTimeout(timeout); signal?.removeEventListener("abort", abort);
      if (version === readVersion.current) { readController.current = null; if (accountRef.current === account) setRefreshing(false); }
    }
  }, [key, previousKey, legacyKey, userId, receiveSnapshot, readServerClock, setNotice]);
  useEffect(() => {
    const abort = new AbortController();
    economyRef.current = null; pendingRequest.current = null; inFlight.current = false; serverClock.current = null; setBusy(false); setSnapshot(null); setLoadedKey(null); setSelected(null); setPanel(null); pendingSave.current = null;
    void loadGame(abort.signal);
    return () => { abort.abort(); cancelReads(); };
  }, [loadGame, cancelReads]);
  useEffect(() => {
    if (!loaded) return;
    const refresh = (event?: Event) => {
      // Offline viewing stays quiet; the "online" event refreshes once the connection returns.
      if (document.hidden || !navigator.onLine || event?.type !== "online" && performance.now() - lastReadAt.current < 3000) return;
      if (event?.type === "online" && !inFlight.current && !pendingRequest.current) cancelReads();
      void loadGame(undefined, true);
    };
    const checkDay = () => {
      const clock = serverClock.current, saved = economyRef.current;
      if (!clock || !saved) return;
      // Some browsers pause performance.now() while the computer sleeps; the device clock's elapsed time covers that.
      // A device clock moved forward only causes one extra read, which re-anchors the server time.
      const elapsed = Math.max(performance.now() - clock.received, Date.now() - clock.wall);
      if (new Date(clock.time + elapsed + 9 * 60 * 60_000).toISOString().slice(0, 10) !== saved.date) refresh();
    };
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh); window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(checkDay, 15_000);
    return () => {
      window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh); window.clearInterval(timer);
    };
  }, [loaded, loadGame, cancelReads]);
  useEffect(() => {
    if (editingLotId !== null && !town.parks.some(p => p.id === editingLotId)) {
      setEditingLotId(null); setMode(m => m === "decorate" ? "inspect" : m); setPanel(p => p === "customize" ? null : p); setSelected(null);
    } else if (selected !== null && (town.tiles[selected] === "grass" || town.tiles[selected] === "water")) {
      setSelected(null); setPanel(p => p === "customize" ? null : p);
    }
  }, [town.parks, town.tiles, editingLotId, selected]);
  useEffect(() => {
    if (!levelUp) return;
    sceneRef.current?.celebrate(darkness.current > .45);
    const timer = window.setTimeout(() => setLevelUp(null), 4200);
    return () => window.clearTimeout(timer);
  }, [levelUp]);
  const runAction = async (action: Omit<TownRequest, "requestId" | "revision" | "userId">, retry = false) => {
    if (inFlight.current) return false;
    if (!economyRef.current) { setNotice("街のデータに接続してから、もう一度お試しください。"); return false; }
    if (pendingRequest.current && !retry) { setNotice("前の保存結果を確認しています。「再試行」を押してください。"); return false; }
    const payload = retry && pendingRequest.current ? pendingRequest.current : { ...action, userId, requestId: crypto.randomUUID(), revision: economyRef.current.revision };
    const account = userId;
    cancelReads(); setRefreshing(false);
    pendingRequest.current = payload; inFlight.current = true; setBusy(true); setSaveStatus("保存中");
    const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/games/town-builder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      const result = await response.json().catch(() => null), next = decodeTownSnapshot(result?.snapshot);
      if (accountRef.current !== account) return false;
      if (!result || response.redirected) throw new Error("ログイン状態と通信を確認して、再試行してください。");
      if (!response.ok || !next) {
        if (response.status < 500) { pendingRequest.current = null; setConnectionError(""); }
        if (response.status === 409) { await loadGame(); if (accountRef.current !== account) return false; setSelected(null); setPanel(p => p === "customize" ? null : p); setEditingLotId(null); }
        throw new Error(result.error ?? "保存結果を確認できませんでした。");
      }
      readServerClock(response);
      pendingRequest.current = null; receiveSnapshot(next, true);
      if (result.message) setNotice(result.message, payload.action === "quest" || payload.action === "daily");
      return true;
    } catch (error) {
      if (accountRef.current !== account) return false;
      const message = connectionMessage(error, "通信が途切れました。同じ操作を再試行できます。");
      setNotice(message);
      if (pendingRequest.current) { setConnectionError(message); setSaveStatus("保存を確認"); }
      else setSaveStatus("アカウント保存済み");
      return false;
    } finally { window.clearTimeout(timeout); if (accountRef.current === account) { inFlight.current = false; setBusy(false); } }
  };
  useEffect(() => {
    if (!loaded || welcome) { pendingSave.current = null; return; }
    pendingSave.current = { key, town };
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
      const top = Math.max(headerRef.current?.getBoundingClientRect().bottom ?? 0, statsRef.current?.getBoundingClientRect().bottom ?? 0) + 14;
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
  }, [showSelection, selected, active, selectedLevel, panel, editingLotId, selectedLot?.width, selectedLot?.height, town.attachments, mode]);
  useEffect(() => {
    if (!loaded || town.paused || welcome) return;
    // The visual clock never mints account currency or builds unpaid houses.
    const timer = window.setInterval(() => setTown(prev => prev.paused ? prev : { ...prev, day: Math.min(1e9, prev.day + 1) }), 2500 / speed);
    return () => window.clearInterval(timer);
  }, [loaded, town.paused, welcome, speed]);
  const autoPaused = useRef(false);
  useEffect(() => {
    // A hidden tab pauses the town; coming back resumes it, unless the player paused it themselves.
    const onVisibility = () => {
      if (document.hidden) setTown(prev => { if (prev.paused) return prev; autoPaused.current = true; return { ...prev, paused: true }; });
      else if (autoPaused.current) { autoPaused.current = false; setTown(prev => prev.paused ? { ...prev, paused: false } : prev); }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
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
  const chooseMode = (next: Mode) => { setMode(next); setEditingLotId(null); setStroke(false); setPreview([]); setHover(null); setSelected(null); setNotice(next === "pan" || next === "inspect" ? "1本指で移動、2本指で拡大・縮小。建物はタップで調べられます。" : BUILDINGS.find(b => b.id === next)?.info ?? "", false); };
  const closePanel = () => { setPanel(null); if (panel === "customize") { setMode("inspect"); setEditingLotId(null); setPreview([]); setHover(null); } };
  const openCustomize = () => { if (selected === null) return; setPanel("customize"); setEditingLotId(selectedLot?.id ?? null); setMode(selectedLot ? "decorate" : "inspect"); setPart("tree"); setPreview([]); setHover(null); };
  const edit = (command: TownCommand) => runAction({ action: "edit", command });
  const commit = (path: number[]) => {
    if (!loaded || welcome || !path.length) return;
    if (mode === "pan") return;
    if (mode === "inspect") { setSelected(path[path.length - 1]!); setPanel(null); return; }
    if (mode === "decorate") {
      if (!editingLot) return;
      const tile = path[path.length - 1]!;
      void edit(part === "remove" ? { type: "remove-park-part", lotId: editingLot.id, tile } : { type: "park-part", lotId: editingLot.id, tile, part, rotation: partRotation }); return;
    }
    if (mode === "park") {
      const i = path[path.length - 1]!;
      const intent = interaction.current;
      void edit({ type: "park", tile: i, size: parkSize, kind: parkKind, rotated: parkRotated }).then(ok => {
        if (ok && interaction.current === intent) { setSelected(i); setEditingLotId(i); setMode("decorate"); setPart("tree"); setPanel("customize"); setHover(null); }
      });
      return;
    }
    const intent = interaction.current;
    void edit({ type: "build", tool: mode, path }).then(ok => { if (ok && interaction.current === intent) setSelected(path[path.length - 1]!); });
  };
  const undoBuild = () => {
    if (!snapshot?.canUndo) return;
    if (inFlight.current || pendingRequest.current) return;
    chooseMode("inspect"); setPanel(null);
    void runAction({ action: "undo" });
  };
  const position = (e: React.PointerEvent<HTMLCanvasElement>) => { const rect = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; };
  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!loaded || welcome || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = position(e), scene = sceneRef.current;
    const tile = scene ? mode === "inspect" || mode === "bulldoze" || mode === "decorate" && part === "remove" ? scene.pickTile(p.x, p.y, town) : scene.tileAt(p.x, p.y) : null;
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size > 1) { if (drag.current) drag.current.multiple = true; setPreview([]); return; }
    setHover(null);
    drag.current = { ...p, from: tile, to: tile, pan: Boolean(panel) || !(linearTool && stroke), moved: false, multiple: false };
    if (!panel && tile !== null && mode !== "pan" && mode !== "inspect") setPreview([tile]);
  };
  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = position(e), scene = sceneRef.current; if (!scene) return;
    const old = pointers.current.get(e.pointerId);
    if (!old) { if (!panel && e.pointerType === "mouse" && mode !== "inspect" && mode !== "pan") setHover(scene.tileAt(p.x, p.y)); return; }
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
    if (!pointers.current.has(e.pointerId)) return;
    const d = drag.current; pointers.current.delete(e.pointerId);
    if (d && !d.multiple && loaded && !welcome && !panel && mode !== "pan" && (!d.pan || !d.moved)) {
      const p = position(e), scene = sceneRef.current;
      const onMap = p.x >= 0 && p.y >= 0 && p.x < sizeRef.current.width && p.y < sizeRef.current.height && document.elementFromPoint(e.clientX, e.clientY) === e.currentTarget;
      const wasTap = Math.hypot(p.x - d.x, p.y - d.y) <= 8;
      const to = onMap && scene && (!d.pan || wasTap) ? mode === "inspect" || mode === "bulldoze" || mode === "decorate" && part === "remove" ? scene.pickTile(p.x, p.y, town) : scene.tileAt(p.x, p.y) : null;
      if (to !== null) commit(!d.pan && d.from !== null ? lineTiles(d.from, to) : [to]);
      else if (mode !== "inspect" && !d.pan) setNotice("マップの外で指を離したため、工事を取り消しました");
    }
    if (!pointers.current.size) drag.current = null; setPreview([]);
  };
  const upgrade = () => {
    if (selected === null) return;
    void edit({ type: "upgrade", tile: selected });
  };
  const reset = () => {
    if (!window.confirm("今の街を更地に戻します。白コイン・経験値・達成したクエストは引き継ぎます。よろしいですか？")) return;
    const intent = interaction.current;
    void runAction({ action: "reset", starter: false }).then(ok => {
      if (ok && interaction.current === intent) { setSelected(null); setPanel(null); setEditingLotId(null); setMode("inspect"); }
    });
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
    if (panel || welcome || !loaded) return;
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
  const controlTarget = (target: EventTarget | null) => {
    const element = target instanceof Element ? target.closest<HTMLElement>("button, a[href]") : null;
    return element && gameRef.current?.contains(element) ? element : null;
  };
  return <main ref={gameRef} className={styles.game} data-town-screen data-scenery={scenery} data-night={night} data-welcome={welcome} data-panel={panel ?? "none"} data-revision={snapshot?.revision ?? 0} aria-busy={busy || refreshing}
    onPointerDownCapture={e => { interaction.current++; touchControls.current?.start(controlTarget(e.target), e); }}
    onKeyDownCapture={() => { interaction.current++; }}
    onWheelCapture={() => { interaction.current++; }}
    onPointerMoveCapture={e => touchControls.current?.move(e)}
    onPointerUpCapture={e => touchControls.current?.end(e)}
    onPointerCancelCapture={e => touchControls.current?.cancel(e.pointerId)}
    onClickCapture={e => { const native = e.nativeEvent as PointerEvent; if (touchControls.current?.suppressClick(e.detail, native.pointerType, native.pointerId)) { e.preventDefault(); e.stopPropagation(); } }}
    onKeyDown={e => {
    if (e.key === "Escape") { closePanel(); if (scenery) viewScenery(false); }
  }}>
    <section className={styles.world} aria-label="街の建設マップ">
      <canvas ref={canvasRef} className={styles.canvas} tabIndex={0} aria-label="街のマップ。1本指で移動、2本指で拡大縮小。建物をタップして調査。建設時はタップで配置、連続敷設を選ぶとドラッグで道路・線路を敷設。矢印キーとEnterでも操作できます。" onKeyDown={handleKey}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelPointer}
        onLostPointerCapture={e => { pointers.current.delete(e.pointerId); if (!pointers.current.size) drag.current = null; setPreview([]); }} onPointerLeave={() => { if (!drag.current) setHover(null); }} onContextMenu={e => e.preventDefault()} />
      {welcome && <div className={styles.welcome}><div className={styles.welcomeCard}>
        <span className={styles.eyebrow}>TOWN ADVENTURE</span><h2>小さな一歩が、<br />街の物語になる。</h2>
        <p>建てて、育てて、レベルアップ。<br />クエストを達成して、あなたらしい街へ。</p>
        <div className={styles.starterGift}><WhiteCoinArt /><span>はじまりの支援<b>白コイン 20,000枚</b></span></div>
        <button type="button" className={styles.primary} disabled={busy || !snapshot} onClick={() => { void runAction({ action: "start", starter: true }).then(ok => { if (ok) chooseMode("inspect"); }); }}>小さな集落からはじめる <span>→</span></button>
        <button type="button" className={styles.secondary} disabled={busy || !snapshot} onClick={() => { void runAction({ action: "start", starter: false }).then(ok => { if (ok) chooseMode("inspect"); }); }}>更地から自由につくる</button>
        <small>白コインは、街づくり専用のコインです。</small>
      </div></div>}
    </section>
    <header ref={headerRef} className={styles.header}>
      <div className={styles.identity}>
        <Link href="/games" className={styles.back} aria-label="ミニゲーム一覧へ戻る" onClick={() => flushSave()}><Glyph name="back" /></Link>
        <button type="button" className={styles.playerIdentity} disabled={welcome || !loaded} aria-label={`まちづくりレベル${progress.level} ${rank.title}。クエストと成長を見る`} onClick={() => { chooseMode("inspect"); setRpgTab("growth"); setPanel("quests"); }}>
          <TownCrest level={progress.level} /><span><h1>ぼくのまちづくり</h1><p>{rank.title}</p><span className={styles.headerExp} aria-label={progress.max ? "最高レベル" : `経験値 ${progress.current} / ${progress.required}`}><i style={{ width: `${progress.ratio * 100}%` }} /></span><small>{progress.max ? "MAX LEVEL" : `Lv.${progress.level} · ${progress.current} / ${progress.required} EXP`}</small></span>
        </button>
      </div>
      <button type="button" className={styles.budget} aria-label={`白コイン ${F.format(snapshot?.balance ?? 0)}枚。もらい方を見る`} disabled={welcome || !loaded} onClick={() => { chooseMode("inspect"); setRpgTab("quests"); setPanel("quests"); }}><span>白コイン</span><strong title={`${F.format(snapshot?.balance ?? 0)}枚`}><WhiteCoinArt />{(snapshot?.balance ?? 0) >= 1e7 ? `約${compactMoney.format(snapshot?.balance ?? 0)}` : F.format(snapshot?.balance ?? 0)}</strong><small aria-live="polite">{busy ? "保存中…" : refreshing ? "最新情報を確認中…" : saveStatus}</small></button>
    </header>
    <div ref={statsRef} className={styles.stats} aria-label="街の状況">
      {[{ icon: "people", label: "人口", value: F.format(stats.population), unit: "人" },
        { icon: "leaf", label: "満足度", value: String(stats.happiness), unit: "%" },
        { icon: "train", label: "鉄道", value: String(stats.routes.length), unit: "路線" },
        { icon: "chart", label: phase, value: String(town.day), unit: "日目" }].map(s => <div key={s.label} className={styles.stat}>
        <span className={styles.statIcon}><Glyph name={s.icon} /></span><div><span>{s.label}</span><strong>{s.value}<small>{s.unit}</small></strong></div>
      </div>)}
    </div>
    {environment && <button type="button" className={styles.skyChip} aria-label={`${sky.placeName} ${townClockLabel(environment)} ${skyWord(environment)}${environment.temperature === null ? "" : ` ${Math.round(environment.temperature)}度`}。空と天気の設定`} disabled={welcome} onClick={() => { if (mode === "decorate") chooseMode("inspect"); setPanel("view"); }}>
      <span aria-hidden="true">{skyIcon(environment)}</span><b>{townClockLabel(environment)}</b>{environment.temperature !== null && <small>{Math.round(environment.temperature)}℃</small>}<em>{environment.live ? sky.placeName : "表示中"}</em>
    </button>}
    <div className={styles.sceneButtons}>
      <button type="button" aria-label={town.paused ? "時間を再開" : "時間を停止"} disabled={welcome || !loaded} onClick={() => setTown(t => ({ ...t, paused: !t.paused }))}>{town.paused ? "▶" : "Ⅱ"}</button>
      <button type="button" title="マップ全体を表示" aria-label="マップ全体を表示" onClick={() => sceneRef.current?.fit(sizeRef.current.width, sizeRef.current.height)}><Glyph name="fit" /></button>
      <button type="button" title="街だけを眺める" aria-label="街だけを眺める" disabled={welcome} onClick={() => viewScenery(true)}><Glyph name="eye" /></button>
    </div>
    {panel && <aside key={panel === "quests" ? `${panel}:${rpgTab}` : panel} ref={panelRef} id="town-panel" className={`${styles.sidebar} ${panel === "customize" ? styles.workshop : ""} ${panel === "quests" ? styles.questPanel : ""}`} aria-label={panel === "build" ? "建設パネル" : panel === "land" ? "敷地の購入" : panel === "customize" ? "施設の部品" : panel === "view" ? "表示と設定" : panel === "quests" ? "クエストと成長" : "遊び方"}>
      <div className={styles.panelTitle}><h2>{panel === "build" ? "建設" : panel === "land" ? "敷地を選ぶ" : panel === "customize" ? editingLot ? `${editingLot.kind === "park" ? "公園" : "広場"} ${editingLot.width}×${editingLot.height} · 部品` : `${BUILDINGS.find(b => b.id === active)?.title ?? "施設"}の部品` : panel === "view" ? "表示と設定" : panel === "quests" ? "開拓の冒険手帳" : "街づくりのヒント"}</h2><button type="button" aria-label="パネルを閉じる" onClick={closePanel}>×</button></div>
      {panel === "quests" && <TownRpgPanel tab={rpgTab} onTab={setRpgTab} metrics={questMetrics} snapshot={snapshot} busy={busy || Boolean(pendingRequest.current)} onClaim={questId => { void runAction({ action: "quest", questId }); }} onDaily={() => { void runAction({ action: "daily" }); }} />}
      {panel === "build" && <>
        <div className={styles.categories}>{["交通", "建物", "環境"].map(c => <button type="button" key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className={styles.catalog}>{BUILDINGS.filter(b => b.category === category).map(b => <button type="button" key={b.id} aria-pressed={mode === b.id} aria-label={b.id === "home" && homeTile >= 0 ? "マイホーム 建設済み。家の場所を見る" : undefined} onClick={() => {
          if (b.id === "park") { chooseMode("inspect"); setPanel("land"); return; }
          if (b.id === "home" && homeTile >= 0) { chooseMode("inspect"); setPanel(null); focusTile(homeTile); setHover(null); setSelected(homeTile); setNotice("マイホームはここです。タップするとマイルームへ行けます。"); return; }
          chooseMode(b.id); setPanel(null);
        }} className={mode === b.id ? styles.selectedBuild : ""}><BuildingIcon kind={b.id} /><span><b>{b.title}</b><small>{b.id === "home" && homeTile >= 0 ? "建設済み" : b.price ? <WhitePrice amount={b.price} /> : "無料"}</small></span></button>)}</div>
        <p className={styles.toolDescription}>選んだら、街をタップして配置。指でドラッグすると移動できます。</p>
      </>}
      {panel === "land" && <ParkPurchase kind={parkKind} size={parkSize} rotated={parkRotated} money={snapshot && !pendingRequest.current && !busy ? town.money : -1} onKind={setParkKind} onSize={setParkSize} onRotate={() => setParkRotated(v => !v)} onPlace={() => { chooseMode("park"); setPanel(null); }} />}
      {panel === "customize" && (editingLot ? <ParkWorkshop lot={editingLot} part={part} rotation={partRotation} money={snapshot && !pendingRequest.current && !busy ? town.money : -1} onPart={p => { setPart(p); setPreview([]); setHover(null); setPanel(null); }} onRotate={() => setPartRotation(v => (v + 1) % 4)} onExpand={size => { void edit({ type: "expand", lotId: editingLot.id, size }); }} onRemoveLot={() => {
        if (!window.confirm("この敷地と中の部品を撤去しますか？")) return;
        const intent = interaction.current;
        void edit({ type: "remove-park", lotId: editingLot.id }).then(ok => { if (ok && interaction.current === intent) { setPanel(null); setEditingLotId(null); setMode("inspect"); setSelected(null); } });
      }} /> : active && selected !== null ? <FacilityWorkshop kind={active} installed={selectedParts ?? []} money={snapshot && !pendingRequest.current && !busy ? town.money : -1} onBuy={(id: FacilityPart) => { void edit({ type: "facility-part", tile: selected, part: id }); }} onRemove={id => { void edit({ type: "remove-facility-part", tile: selected, part: id }); }} /> : null)}
      {panel === "view" && <>
        <SkySettings sky={sky} />
        <div className={styles.viewOptions}>
          <button type="button" aria-label="マス目の表示" aria-pressed={grid} onClick={() => setGrid(v => !v)}><Glyph name="grid" />マス目</button>
          <button type="button" aria-label="拡大" onClick={() => zoom(1.25)}>＋ 拡大</button>
          <button type="button" aria-label="縮小" onClick={() => zoom(.8)}>− 縮小</button>
          <button type="button" aria-label={browserFullscreen ? "ブラウザの全画面表示を終了" : "ブラウザの全画面表示"} aria-pressed={browserFullscreen} onClick={toggleFullscreen}><Glyph name="fullscreen" />全画面表示</button>
          <button type="button" onClick={() => setPanel("help")}><span className={styles.question} aria-hidden="true">?</span>遊び方</button>
        </div>
        <div className={styles.clock}><span>時間</span><button type="button" aria-label={town.paused ? "時間を再開" : "時間を停止"} onClick={() => setTown(t => ({ ...t, paused: !t.paused }))}>{town.paused ? "▶" : "Ⅱ"}</button>{[1, 2, 4].map(v => <button type="button" key={v} aria-pressed={speed === v} className={speed === v ? styles.chosenSpeed : ""} onClick={() => setSpeed(v)}>{v}×</button>)}</div>
        <div className={styles.finance}><div><span>街づくりに使える白コイン</span><WhitePrice amount={snapshot?.balance ?? 0} /></div><div><span>まちづくりの経験値</span><b>{F.format(snapshot?.xp ?? 0)} EXP</b></div><div><span>街の経済力</span><b>{F.format(stats.income - stats.upkeep)} pt</b></div><small>白コインはクエスト・レベル報酬・毎日のログイン・ホームで集められます。<br />建物・敷地・部品の購入と増築に使います。<br />鉄道 {stats.linkedStations}駅が接続 · 雇用 {stats.jobs}人分</small><button type="button" className={styles.saveButton} disabled={busy} onClick={() => { flushSave(); if (pendingRequest.current) void runAction(pendingRequest.current, true); else void loadGame(); }}>{pendingRequest.current ? "保存結果を再確認" : "保存データを再読み込み"}</button>{saveStatus === "保存できません" && <small role="alert">端末へのバックアップを保存できません。街と白コインはアカウントに保存されています。</small>}</div>
      </>}
      {panel === "help" && <div className={styles.help}>
        <ol><li><b>街を育ててレベルアップ</b><span>白コインで建設・増築・部品購入をするとEXPを獲得。「クエスト」で条件を達成して報酬を受け取ると、さらに成長できます。アプリのレベルと、まちづくりLv.は別々です。</span></li><li><b>指で街を移動する</b><span>1本指でドラッグ、2本指で拡大・縮小。建設・部品の編集でも同じ操作です。</span></li><li><b>タップしてつくる</b><span>「建設」から選び、街をタップして配置。道路・線路は「連続敷設」でまとめてつなげられます。</span></li><li><b>公園をつくる</b><span>敷地の広さを選んで購入し、木・花壇・噴水などの部品を買って配置。通路の上にも設備を置けます。部品だけの撤去や敷地の拡張もできます。</span></li><li><b>施設を育てる</b><span>建物をタップして「部品」から設備を追加。増築や部品の購入は「元に戻す」で取り消せます。2駅を線路で結ぶと列車が運行します。工事の取り消しでは、その工事の白コインとEXPを戻します。</span></li></ol>
        <details><summary>キーボード・座標で操作</summary><p>マップを選択して矢印キー・Enterで建設。＋／−で拡大縮小。Ctrl／⌘＋Zで工事を取り消せます。</p><div className={styles.coordinates}><label>X<input type="number" inputMode="numeric" min={1} max={24} value={tileX} onChange={e => setTileX(Number(e.target.value))} /></label><label>Y<input type="number" inputMode="numeric" min={1} max={24} value={tileY} onChange={e => setTileY(Number(e.target.value))} /></label><button type="button" disabled={!Number.isInteger(tileX) || !Number.isInteger(tileY) || tileX < 1 || tileY < 1 || tileX > 24 || tileY > 24} onClick={() => {
          if (Number.isInteger(tileX) && Number.isInteger(tileY) && tileX >= 1 && tileY >= 1 && tileX <= 24 && tileY <= 24) { const i = (tileY - 1) * MAP_SIZE + tileX - 1; focusTile(i); commit([i]); }
        }}>選択中の操作を実行</button></div></details>
        <div className={styles.helpFooter}><p>街・白コイン・経験値はアカウントに保存されます。端末の以前の街は初回に引き継ぎます。</p><button type="button" disabled={busy || Boolean(pendingRequest.current)} onClick={reset}>新しい街をはじめる</button></div>
      </div>}
    </aside>}
    {showSelection && active && selected !== null && <section ref={selectionRef} className={styles.selectionCard} aria-label="選択した建物" data-selected-tile={selected}>
      <div className={styles.selectionInfo}><strong>{selectedLot ? selectedLot.kind === "park" ? "公園" : "広場" : selectedStage ?? BUILDINGS.find(b => b.id === active)?.title}{town.levels[selected]! > 0 && <small>Lv.{town.levels[selected]}</small>}{selectedLot && <small>{selectedLot.width}×{selectedLot.height}</small>}</strong>
        <p>{selectedLot ? `部品 ${selectedLot.parts.length}点${selectedLot.parts.length ? "" : " · 部品を追加しよう"}` : active === "home" ? "わんこが待っている、あなたの家です" : canUpgrade ? connected ? `道路接続${active === "house" ? ` · 定員 ${(town.levels[selected] || 1) * 18 + (selectedParts?.includes("terrace") ? 6 : 0)}人` : ""}` : "道路への接続が必要です" : active === "station" ? stats.routes.some(r => r[0] === selected || r[r.length - 1] === selected) ? "列車が運行しています" : "もう1つの駅へ線路をつなごう" : "街をつなぐ道"}</p>
      </div>
      {active === "home" && <Link href="/room" className={styles.roomLink} onClick={() => flushSave()}><span>マイルームへ</span><small>部屋に入る</small></Link>}
      {canUpgrade && <button type="button" className={styles.upgrade} aria-label={nextStage ? `${nextStage}へ増築する 建物Lv.${selectedLevel + 1}` : undefined} onClick={upgrade} disabled={!snapshot || Boolean(pendingRequest.current) || busy || town.levels[selected]! >= 3 || !connected || town.money < (town.levels[selected] || 1) * 450}>{town.levels[selected]! >= 3 ? "最大Lv." : <><span>増築する</span><small>建物Lv.{selectedLevel + 1} · <WhitePrice amount={(town.levels[selected] || 1) * 450} /></small></>}</button>}
      {canCustomize && <button type="button" className={styles.customize} aria-label="施設の部品を追加" onClick={openCustomize}>部品<small>追加</small></button>}
      <button type="button" className={styles.dismiss} aria-label="建物の選択を解除" onClick={() => setSelected(null)}>×</button>
    </section>}
    {mode === "decorate" && editingLot && !panel && !welcome && !scenery && <div ref={activeToolRef} className={styles.activeTool} data-decorate="true">
      <div><strong>{part === "remove" ? "部品を撤去" : PARK_PARTS.find(p => p.id === part)?.title}<small>{part === "remove" ? "無料" : <WhitePrice amount={PARK_PARTS.find(p => p.id === part)?.price ?? 0} />}</small></strong><p>{busy ? "工事を保存中…" : part === "remove" ? "外す部品をタップ" : "敷地のマスをタップ"}</p></div>
      <button type="button" aria-label="公園の部品を選ぶ" onClick={() => setPanel("customize")}>部品</button>
      <button type="button" aria-label="部品の向きを変える" disabled={part === "remove"} onClick={() => setPartRotation(v => (v + 1) % 4)}>↻ {partRotation * 90}°</button>
      <button type="button" className={styles.dismiss} aria-label="公園の編集を終了" onClick={() => { setMode("inspect"); setEditingLotId(null); setPreview([]); setHover(null); }}>×</button>
    </div>}
    {item && !panel && !welcome && !scenery && <div ref={activeToolRef} className={styles.activeTool}>
      <div><strong>{mode === "park" ? `${parkKind === "park" ? "公園" : "広場"} ${parkRotated ? PARK_SIZES.find(s => s.id === parkSize)!.height : PARK_SIZES.find(s => s.id === parkSize)!.width}×${parkRotated ? PARK_SIZES.find(s => s.id === parkSize)!.width : PARK_SIZES.find(s => s.id === parkSize)!.height}` : item.title}<small>{mode === "park" ? <WhitePrice amount={PARK_SIZES.find(s => s.id === parkSize)!.price} /> : item.price ? <WhitePrice amount={item.price} /> : "無料"}</small></strong><p>{busy ? "工事を保存中…" : mode === "park" ? "空いた場所をタップして敷地を購入" : linearTool && stroke ? "ドラッグで敷設 · 2本指で移動" : "タップで配置 · ドラッグで移動"}</p></div>
      {linearTool && <button type="button" aria-pressed={stroke} onClick={() => { setStroke(v => !v); setPreview([]); }}>{stroke ? "移動に戻す" : "連続敷設"}</button>}
      <button type="button" className={styles.dismiss} aria-label="建設を終了" onClick={() => chooseMode("inspect")}>×</button>
    </div>}
    <div ref={toolbarRef} className={styles.toolbar}>
      <div className={styles.tools}>
        <button type="button" className={styles.buildButton} aria-expanded={panel === "build" || panel === "land"} aria-controls="town-panel" disabled={welcome || !loaded} onClick={() => { if (mode === "decorate") chooseMode("inspect"); setPanel(p => p === "build" ? null : "build"); }}><Glyph name="build" /><span>建設</span></button>
        <button type="button" aria-expanded={panel === "quests"} aria-controls="town-panel" disabled={welcome} className={styles.questButton} onClick={() => { chooseMode("inspect"); setRpgTab("quests"); setPanel(p => p === "quests" && rpgTab === "quests" ? null : "quests"); }}><Glyph name="quests" /><span>クエスト</span>{readyQuests > 0 && <em aria-label={`受け取れる報酬${readyQuests}件`}>{readyQuests}</em>}</button>
        <button type="button" disabled={!snapshot?.canUndo || busy || Boolean(pendingRequest.current)} onClick={undoBuild}><Glyph name="undo" /><span>元に戻す</span></button>
        <button type="button" disabled={welcome} aria-expanded={panel === "view" || panel === "help"} aria-controls="town-panel" onClick={() => { if (mode === "decorate") chooseMode("inspect"); setPanel(p => p === "view" || p === "help" ? null : "view"); }}><Glyph name="settings" /><span>表示・設定</span></button>
      </div>
    </div>
    <p role="status" aria-live="polite" className={styles.notice} data-visible={toast && !scenery && !welcome}>{notice}</p>
    {connectionError && <div className={styles.connectionBanner} role="alert"><span>{connectionError}</span><button type="button" disabled={busy || refreshing} onClick={() => { if (pendingRequest.current) void runAction(pendingRequest.current, true); else void loadGame(); }}>再試行</button></div>}
    {levelUp && !scenery && !welcome && <button type="button" className={styles.levelUp} aria-label={`まちづくりレベル${levelUp.level}にアップ${levelUp.reward ? `、白コイン${levelUp.reward}枚獲得` : ""}`} onClick={() => { setLevelUp(null); chooseMode("inspect"); setRpgTab("growth"); setPanel("quests"); }}><TownCrest level={levelUp.level} /><span><small>LEVEL UP</small><b>{townRank(levelUp.level).title}</b>{levelUp.reward > 0 && <WhitePrice amount={levelUp.reward} />}</span><em>✦</em></button>}
    {scenery && <button type="button" ref={returnControlsRef} className={styles.returnControls} onClick={() => viewScenery(false)}><Glyph name="eye" />操作に戻る</button>}
  </main>;
}
