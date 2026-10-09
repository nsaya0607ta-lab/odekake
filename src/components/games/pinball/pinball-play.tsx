"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BlueCoinArt, RedCoinArt } from "@/components/coin-art";
import { FULL_PLUNGE_POWER, MAX_SCORE, PINBALL_BALLS, SKILL_SHOT_POWER } from "@/lib/games/pinball/config";
import {
  canLaunch,
  collectedCount,
  createGame,
  isBallSaveOn,
  launch,
  scoreMult,
  bumperMult,
  setFlipper,
  setPlungerPull,
  stepGame,
  takeFx,
  type Game,
  type GameFx,
  type Tone,
} from "@/lib/games/pinball/game";
import { getPinballTable } from "@/lib/games/pinball/maps";
import { buildStageTable, type StageSpec } from "@/lib/games/pinball/stage";
import type { PinballLobby } from "@/lib/games/pinball/tables";
import type { PinballTheme } from "@/lib/games/pinball/themes";
import { DEFAULT_BGM_VOLUME, DEFAULT_TAP_VOLUME, getBgmVolume, getTapVolume, setBgmVolume, setTapVolume } from "@/lib/sound-settings";
import { PinballAudio } from "./audio";
import styles from "./pinball.module.css";
import { PinballRenderer } from "./render";

export type PinballResult = {
  score: number;
  isBest: boolean;
  coins: number | null;
  balance: number | null;
};

/**
 * 遊ぶ台：マップか、自分で作るステージ。ステージの test はエディターのテストプレイ（記録しない・コインもつかない）。
 * key は、ベストを覚えておく名前（マップの id か "stage:<ステージの番号>"）
 */
export type PinballCourse =
  | { type: "map"; id: string }
  | { type: "stage"; id: string | null; spec: StageSpec; test: boolean };

export function courseKey(course: PinballCourse): string {
  return course.type === "map" ? course.id : `stage:${course.id ?? "test"}`;
}

type Props = {
  /** 遊ぶ台 */
  course: PinballCourse;
  /** 台に出すアイテム・図鑑ボーナス・床の県の形（どのマップも同じ） */
  lobby: PinballLobby;
  theme: PinballTheme;
  best: number | null;
  onExit: () => void;
  onRestart: () => void;
  onRecorded: (key: string, result: PinballResult) => void;
};

type Hud = {
  score: number;
  ball: number;
  extra: number;
  mult: number;
  /** スタンプ帳：入ったもの（done）→ いま台に浮かんでいるもの（lit）→ まだ空いているところ（image が null） */
  stamps: { image: string | null; name: string; done: boolean; lit: boolean }[];
  collected: number;
  chips: { label: string; sec: number | null; hot: boolean }[];
  launchable: boolean;
  skillLane: number;
  pull: number;
  phase: Game["phase"];
};

type Banner = { title: string; sub?: string; tone: Tone; ms: number; key: number };

type Submit =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "done"; coins: number; balance: number | null; isBest: boolean; kind: "red" | "blue" }
  | { state: "offline" }
  | { state: "test" }
  | { state: "error"; message: string };

const LANE_LETTERS = ["お", "で", "か", "け"];
/** プランジャーを引ききるまでの指の移動（px） */
const PULL_PX = 150;
const LEFT_KEYS = new Set(["KeyZ", "ArrowLeft", "ShiftLeft"]);
const RIGHT_KEYS = new Set(["Slash", "ArrowRight", "ShiftRight", "KeyM"]);
const PLUNGE_KEYS = new Set(["Space", "ArrowDown", "Enter"]);

function makeRoundId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** 長い知らせは文字を小さくして、1行（むりなら空白のところで2行）に収める */
function bannerFont(title: string, epic: boolean): CSSProperties | undefined {
  const base = epic ? 11 : 8.6; // CSS の大きさ（vw）
  const max = epic ? 48 : 38;
  const perChar = (n: number) => 88 / Math.max(1, n); // 画面の幅に n 文字ならべるときの1文字（vw）
  const len = [...title].length;
  const one = perChar(len);
  if (one >= base) return undefined;
  const longest = Math.max(...title.split(/\s+/).map((w) => [...w].length));
  const two = Math.min(base, perChar(longest));
  // 1行だと小さくなりすぎるとき（大きな知らせは、少しでも大きく見せたいとき）は空白で2行にする
  const twoLines = longest < len && (one < 6.2 || (epic && two > one * 1.25));
  if (!twoLines) return { fontSize: `min(${one.toFixed(2)}vw, ${max}px)` };
  return { fontSize: `max(17px, min(${two.toFixed(2)}vw, ${max}px))` };
}

function readStamps(g: Game): Hud["stamps"] {
  const waiting = g.mode === "normal" ? g.lit.filter((l) => !l.encore).map((l) => l.item) : [];
  let next = 0;
  return g.book.map((item) => {
    if (item) return { image: item.image, name: item.name, done: true, lit: false };
    const lit = waiting[next];
    next += 1;
    return lit ? { image: lit.image, name: lit.name, done: false, lit: true } : { image: null, name: "", done: false, lit: false };
  });
}

function readHud(g: Game): Hud {
  const chips: Hud["chips"] = [];
  const left = (until: number) => Math.max(0, Math.ceil(until - g.clock));
  // 1行に収まらないときは右がかくれるので、大事なものから並べる
  if (g.mode === "conquest") chips.push({ label: g.superLit ? "スーパーJP点灯" : "制覇モード", sec: null, hot: true });
  const mult = scoreMult(g);
  if (mult > 1) chips.push({ label: `得点×${mult}`, sec: left(Math.max(...g.mults.map((m) => m.until))), hot: true });
  if (bumperMult(g) > 1) chips.push({ label: `バンパー×${bumperMult(g)}`, sec: left(Math.max(...g.bumperMults.map((m) => m.until))), hot: true });
  if (isBallSaveOn(g) && g.phase !== "serve") chips.push({ label: "セーブ", sec: left(g.saveUntil), hot: false });
  if (g.clock < g.gateUntil) chips.push({ label: "ふさぐ", sec: left(g.gateUntil), hot: false });
  if (g.clock < g.slowUntil) chips.push({ label: "スロー", sec: left(g.slowUntil), hot: false });
  if (g.clock < g.comboAddUntil) chips.push({ label: "コンボ受付", sec: left(g.comboAddUntil), hot: false });
  if (g.clock < g.magnetUntil) chips.push({ label: "マグネット", sec: left(g.magnetUntil), hot: true });
  if (g.clock < g.stamp2Until) chips.push({ label: "スタンプ2倍", sec: left(g.stamp2Until), hot: true });
  if (g.reserves.length) chips.push({ label: g.reserves.length > 1 ? `JP予約×${g.reserves.length}` : "JP予約", sec: null, hot: true });
  if (g.kickbackLit[0] || g.kickbackLit[1]) chips.push({ label: g.kickbackLit[0] && g.kickbackLit[1] ? "キック左右" : g.kickbackLit[0] ? "キック左" : "キック右", sec: null, hot: false });
  const onPlunger = canLaunch(g);
  return {
    score: g.score,
    ball: g.ball,
    extra: g.extraBalls,
    mult,
    stamps: readStamps(g),
    collected: collectedCount(g),
    chips,
    launchable: onPlunger,
    skillLane: g.phase === "serve" ? g.skillLane : -1,
    pull: g.world.plungerPull,
    phase: g.phase,
  };
}

function sameHud(a: Hud, b: Hud): boolean {
  return (
    a.score === b.score
    && a.ball === b.ball
    && a.extra === b.extra
    && a.mult === b.mult
    && a.collected === b.collected
    && a.launchable === b.launchable
    && a.skillLane === b.skillLane
    && Math.abs(a.pull - b.pull) < 0.01
    && a.phase === b.phase
    && a.stamps.length === b.stamps.length
    && a.stamps.every((s, i) => s.lit === b.stamps[i]!.lit && s.done === b.stamps[i]!.done && s.image === b.stamps[i]!.image)
    && a.chips.length === b.chips.length
    && a.chips.every((c, i) => c.label === b.chips[i]!.label && c.sec === b.chips[i]!.sec)
  );
}

/** ゲーム中は後ろの画面を動かさない（iPhone のラバーバンドやスクロールを止める） */
function useScreenLock(): void {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    const block = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-pinball-scroll]")) return;
      event.preventDefault();
    };
    document.addEventListener("touchmove", block, { passive: false });
    return () => {
      document.removeEventListener("touchmove", block);
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, []);
}

export function PinballPlay({ course, lobby, theme, best, onExit, onRestart, onRecorded }: Props) {
  useScreenLock();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const rendererRef = useRef<PinballRenderer | null>(null);
  const audioRef = useRef<PinballAudio | null>(null);
  const pausedRef = useRef(false);
  const roundIdRef = useRef(makeRoundId());
  const pointers = useRef(new Map<number, { role: "left" | "right" | "plunger"; startY: number; pull: number }>());
  const keyPull = useRef<{ at: number } | null>(null);
  const heldKeys = useRef(new Set<string>());
  const [held, setHeld] = useState<[boolean, boolean]>([false, false]);
  const bannerQueue = useRef<Banner[]>([]);
  const [hud, setHud] = useState<Hud | null>(null);
  const [banner, setBanner] = useState<(Banner & { out?: boolean }) | null>(null);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [submit, setSubmit] = useState<Submit>({ state: "idle" });
  const [bgm, setBgm] = useState(DEFAULT_BGM_VOLUME);
  const [tap, setTap] = useState(DEFAULT_TAP_VOLUME);

  const cssVars = useMemo(
    () =>
      ({
        "--pb-accent": theme.colors.accent,
        "--pb-accent2": theme.colors.accent2,
        "--pb-accent-soft": `${theme.colors.accent}66`,
      }) as CSSProperties,
    [theme],
  );

  /* ---------- 大きな文字 ---------- */

  // いま出ている知らせ（state の更新関数の中で queue をさわらないよう、ref にも持っておく）
  const bannerNow = useRef<(Banner & { out?: boolean }) | null>(null);
  const showBanner = useCallback((next: (Banner & { out?: boolean }) | null) => {
    bannerNow.current = next;
    setBanner(next);
  }, []);

  useEffect(() => {
    if (!banner) return;
    if (banner.out) {
      const t = window.setTimeout(() => showBanner(bannerQueue.current.shift() ?? null), 260);
      return () => window.clearTimeout(t);
    }
    // 次が待っていたら、少し早めに切りかえる
    const wait = bannerQueue.current.length ? Math.min(banner.ms, 900) : banner.ms;
    const t = window.setTimeout(() => {
      if (bannerNow.current?.key === banner.key) showBanner({ ...banner, out: true });
    }, wait);
    return () => window.clearTimeout(t);
  }, [banner, showBanner]);

  const queueBanner = useCallback((fx: Extract<GameFx, { type: "msg" }>) => {
    const item: Banner = { title: fx.title, sub: fx.sub, tone: fx.tone, ms: fx.ms ?? 1400, key: Date.now() + Math.random() };
    const q = bannerQueue.current;
    // ためすぎない（だいじなものは残す）
    while (q.length >= 3) {
      const i = q.findIndex((b) => b.tone === "info" || b.tone === "good");
      q.splice(i >= 0 ? i : 0, 1);
    }
    // 制覇・ジャックポットなどの大きな知らせは、いま出ている小さな知らせを待たずにすぐ出す
    if (item.tone === "epic") q.unshift(item);
    else q.push(item);
    const current = bannerNow.current;
    if (!current) showBanner(q.shift() ?? null);
    else if (item.tone === "epic" && current.tone !== "epic" && !current.out) showBanner({ ...current, out: true });
  }, [showBanner]);

  /* ---------- 記録を送る ---------- */

  const sendResult = useCallback(async () => {
    const g = gameRef.current;
    if (!g) return;
    // エディターのテストプレイは記録しない（保存する前の形なので）
    if (course.type === "stage" && (course.test || !course.id)) {
      setSubmit({ state: "test" });
      return;
    }
    const key = courseKey(course);
    setSubmit({ state: "sending" });
    try {
      const response = await fetch("/api/games/pinball/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: roundIdRef.current,
          ...(course.type === "map" ? { table: course.id } : { stageId: course.id }),
          // 記録できるのは MAX_SCORE まで（こえたぶんはカンスト。赤コインはそれよりずっと手前で上限になる）
          score: Math.min(MAX_SCORE, g.score),
          durationMs: Math.round(g.playTime * 1000),
          items: g.stats.items,
          conquests: g.conquests,
          jackpots: g.stats.jackpots,
          maxCombo: g.stats.maxCombo,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; ready?: boolean; kind?: string; coins?: number; balance?: number; isBest?: boolean; error?: string }
        | null;
      if (response.ok && payload?.ready === false) {
        setSubmit({ state: "offline" });
        const kept = Math.min(MAX_SCORE, g.score);
        onRecorded(key, { score: kept, isBest: best === null || kept > best, coins: null, balance: null });
        return;
      }
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "記録できませんでした。");
      const coins = typeof payload.coins === "number" ? payload.coins : 0;
      // もらったコインの色（赤コインにもどす前の DB では青コイン）
      const kind = payload.kind === "blue" ? "blue" : "red";
      const balance = typeof payload.balance === "number" ? payload.balance : null;
      const isBest = payload.isBest === true;
      setSubmit({ state: "done", coins, balance, isBest, kind });
      onRecorded(key, { score: Math.min(MAX_SCORE, g.score), isBest, coins, balance: kind === "red" ? balance : null });
    } catch (error) {
      setSubmit({ state: "error", message: error instanceof Error ? error.message : "記録できませんでした。" });
    }
  }, [best, onRecorded, course]);

  /* ---------- 準備と毎フレーム ---------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const geometry = course.type === "map" ? getPinballTable(course.id) : buildStageTable(course.spec);
    const game = createGame({ table: geometry, pool: lobby.pool, tableName: theme.name, conquestTitle: theme.conquestTitle, zukan: lobby.zukan });
    gameRef.current = game;
    // 開発中だけ、ブラウザから台を動かせるようにする（画面の確認・自動テスト用）
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __pinball?: unknown }).__pinball = { game, setFlipper, launch, setPlungerPull };
    }
    const renderer = new PinballRenderer(canvas, { table: geometry, theme, shape: lobby.shape, bumperItems: lobby.bumperItems });
    rendererRef.current = renderer;
    const audio = new PinballAudio(theme);
    audioRef.current = audio;
    setBgm(getBgmVolume());
    setTap(getTapVolume());

    // アイテムの絵を読みこむ
    const sources = new Set<string>();
    for (const item of [...lobby.pool, ...lobby.bumperItems.slice(0, geometry.bumpers.length), ...game.candidates]) if (item.image) sources.add(item.image);
    const images: HTMLImageElement[] = [];
    for (const src of sources) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => renderer.setImage(src, img);
      img.src = src;
      images.push(img);
    }

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.resize(Math.max(1, rect.width), Math.max(1, rect.height), dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    let prevHud: Hud | null = null;
    let overTimer = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gameRef.current!;
      if (!pausedRef.current) {
        // キーボードでプランジャーを引いている間は、だんだん強くなる
        if (keyPull.current) setPlungerPull(g, Math.min(1, (now - keyPull.current.at) / 900));
        stepGame(g, dt);
        const fx = takeFx(g);
        if (fx.length) {
          renderer.pushFx(fx);
          audio.play(fx);
          for (const f of fx) {
            if (f.type === "msg") queueBanner(f);
            if (f.type === "gameOver") {
              audio.stopMusic();
              overTimer = window.setTimeout(() => {
                setOver(true);
                void sendResult();
              }, 1300);
            }
          }
        }
        audio.setIntensity(g.mode === "conquest" || g.world.balls.length > 1 ? 1 : 0);
        audio.tick();
        renderer.draw(g, dt);
      } else {
        renderer.draw(g, 0);
      }
      if (now - hudAt > 70) {
        hudAt = now;
        const next = readHud(g);
        if (!prevHud || !sameHud(prevHud, next)) {
          prevHud = next;
          setHud(next);
        }
      }
    };
    raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      if (!pausedRef.current && gameRef.current?.phase !== "over") {
        pausedRef.current = true;
        pointers.current.clear();
        heldKeys.current.clear();
        keyPull.current = null;
        setFlipper(game, 0, false);
        setFlipper(game, 1, false);
        setPlungerPull(game, 0);
        setHeld([false, false]);
        setPaused(true);
        audio.setPaused(true);
      }
    };
    const onHidden = () => { if (document.hidden) onVisibility(); };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(overTimer);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onVisibility);
      audio.destroy();
      for (const img of images) img.onload = null;
    };
    // 台が変わったときだけ作りなおす（もう一度遊ぶときは親が key を変える）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 操作 ---------- */

  const wake = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.ensure();
    audio.startMusic();
    setStarted(true);
  }, []);

  const pressSide = useCallback((side: 0 | 1, down: boolean) => {
    const g = gameRef.current;
    if (!g || pausedRef.current) return;
    const role = side === 0 ? "left" : "right";
    const keys = side === 0 ? LEFT_KEYS : RIGHT_KEYS;
    const pressed = down || [...pointers.current.values()].some((p) => p.role === role) || [...heldKeys.current].some((key) => keys.has(key) || key.startsWith(`button:${side}:`));
    setFlipper(g, side, pressed);
    setHeld((previous) => previous[side] === pressed ? previous : side === 0 ? [pressed, previous[1]] : [previous[0], pressed]);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sideHeld = (role: "left" | "right") => [...pointers.current.values()].some((p) => p.role === role);
    const onDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const control = target?.closest("[data-pinball-control]");
      if (!control && target?.closest("button, a, input, select, [data-pinball-ui]")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      wake();
      const g = gameRef.current;
      if (!g || pausedRef.current || g.phase === "over") return;
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let role: "left" | "right" | "plunger" = control?.getAttribute("data-pinball-control") === "left" ? "left" : control ? "right" : x < rect.width / 2 ? "left" : "right";
      if (!control && canLaunch(g) && x > rect.width * 0.6 && y > rect.height * 0.45 && ![...pointers.current.values()].some((p) => p.role === "plunger") && !keyPull.current) role = "plunger";
      pointers.current.set(e.pointerId, { role, startY: e.clientY, pull: 0 });
      try {
        root.setPointerCapture(e.pointerId);
      } catch {
        // 取れなくても動く
      }
      if (role === "left") pressSide(0, true);
      if (role === "right") pressSide(1, true);
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.current.get(e.pointerId);
      if (!p || p.role !== "plunger") return;
      const g = gameRef.current;
      if (!g) return;
      const dist = Math.min(PULL_PX, root.getBoundingClientRect().height * 0.28);
      p.pull = Math.max(0, Math.min(1, (e.clientY - p.startY) / dist));
      setPlungerPull(g, p.pull);
    };
    const onUp = (e: PointerEvent) => {
      const p = pointers.current.get(e.pointerId);
      if (!p) return;
      pointers.current.delete(e.pointerId);
      const g = gameRef.current;
      if (!g) return;
      if (p.role === "plunger") {
        if (e.type === "pointerup" && p.pull > 0.04 && !pausedRef.current) launch(g, p.pull);
        else setPlungerPull(g, 0);
      } else if (!sideHeld(p.role)) {
        pressSide(p.role === "left" ? 0 : 1, false);
      }
    };
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    root.addEventListener("lostpointercapture", onUp);
    const ctxMenu = (e: Event) => e.preventDefault();
    root.addEventListener("contextmenu", ctxMenu);
    return () => {
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      root.removeEventListener("lostpointercapture", onUp);
      root.removeEventListener("contextmenu", ctxMenu);
    };
  }, [pressSide, wake]);

  // パソコンのキーボード（左：Z / ←、右：/ / →、打ち出し：スペース / ↓、一時停止：Esc / P）
  useEffect(() => {
    const left = LEFT_KEYS;
    const right = RIGHT_KEYS;
    const plunge = PLUNGE_KEYS;
    const onDown = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.repeat) {
        if (plunge.has(e.code) || left.has(e.code) || right.has(e.code)) e.preventDefault();
        return;
      }
      const g = gameRef.current;
      if (!g) return;
      if (e.code === "Escape" || e.code === "KeyP") {
        if (g.phase !== "over") togglePause();
        return;
      }
      if (pausedRef.current) return;
      if (left.has(e.code)) {
        e.preventDefault();
        heldKeys.current.add(e.code);
        wake();
        pressSide(0, true);
      } else if (right.has(e.code)) {
        e.preventDefault();
        heldKeys.current.add(e.code);
        wake();
        pressSide(1, true);
      } else if (plunge.has(e.code) && canLaunch(g)) {
        e.preventDefault();
        wake();
        heldKeys.current.add(e.code);
        keyPull.current ??= { at: performance.now() };
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const buttonSides = ([0, 1] as const).filter((side) => heldKeys.current.delete(`button:${side}:${e.code}`));
      heldKeys.current.delete(e.code);
      const g = gameRef.current;
      if (!g) return;
      if (buttonSides.length) {
        e.preventDefault();
        buttonSides.forEach((side) => pressSide(side, false));
        return;
      }
      if (left.has(e.code)) pressSide(0, false);
      else if (right.has(e.code)) pressSide(1, false);
      else if (plunge.has(e.code) && keyPull.current && ![...heldKeys.current].some((key) => plunge.has(key))) {
        const power = Math.min(1, (performance.now() - keyPull.current.at) / 900);
        keyPull.current = null;
        if (!pausedRef.current) launch(g, power);
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // togglePause は ref だけを見るので、作りなおさなくてよい
  }, [pressSide, wake]);

  const togglePause = () => {
    const g = gameRef.current;
    if (!g) return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    audioRef.current?.setPaused(next);
    if (next) {
      setFlipper(g, 0, false);
      setFlipper(g, 1, false);
      pointers.current.clear();
      heldKeys.current.clear();
      keyPull.current = null;
      setHeld([false, false]);
      setPlungerPull(g, 0);
    }
  };

  /* ---------- 表示 ---------- */

  const g = gameRef.current;
  const ballsLeft = hud ? Math.max(0, PINBALL_BALLS - hud.ball + 1) + hud.extra : PINBALL_BALLS;
  const showPlunger = Boolean(hud?.launchable) && !over && !paused;
  const markFor = (power: number) => `${power * 100}%`;

  return (
    <div ref={rootRef} className={styles.play} style={cssVars} aria-label={`ご当地ピンボール ${theme.name}`}>
      <div className={styles.hud} data-pinball-ui>
        <div className={styles.hudRow}>
          <button type="button" className={styles.iconButton} onClick={togglePause} aria-label="一時停止">
            ❚❚
          </button>
          <div className={styles.scoreBox}>
            <span className={styles.tableName}>
              {theme.name}
              {lobby.zukan > 1 ? <span className={styles.zukan}>図鑑ボーナス×{lobby.zukan.toFixed(2)}</span> : null}
            </span>
            <span className={styles.score} aria-live="off">
              {(hud?.score ?? 0).toLocaleString("ja-JP")}
              {hud && hud.mult > 1 ? <span className={styles.mult}>×{hud.mult}</span> : null}
            </span>
          </div>
          <div className={styles.balls} aria-label={`のこりボール ${ballsLeft}`}>
            <div className={styles.ballDots}>
              {Array.from({ length: PINBALL_BALLS }, (_, i) => (
                <span key={i} className={`${styles.ballDot} ${hud && i < hud.ball - 1 ? styles.ballDotUsed : ""}`} />
              ))}
            </div>
            <span className={styles.ballLabel}>{hud?.extra ? `+${hud.extra} ` : ""}ボール{hud?.ball ?? 1}</span>
          </div>
        </div>
        <div className={styles.stamps} aria-label={`スタンプ帳 ${hud?.collected ?? 0} / ${hud?.stamps.length ?? 8}`}>
          {(hud?.stamps ?? []).map((s, i) => (
            <span key={`${i}-${s.image}`} className={`${styles.stamp} ${s.done ? styles.stampDone : s.lit ? styles.stampLit : styles.stampEmpty}`} title={s.name || undefined}>
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" draggable={false} />
              ) : (
                "？"
              )}
              {s.done ? <span className={styles.stampMark}>✓</span> : null}
            </span>
          ))}
          <span className={styles.stampCount}>
            {hud?.collected ?? 0}/{hud?.stamps.length ?? 8}
          </span>
        </div>
        <div className={styles.chips}>
          {(hud?.chips ?? []).map((c) => (
            <span key={c.label} className={`${styles.chip} ${c.hot ? styles.chipHot : ""}`}>
              {c.label}
              {c.sec !== null ? <b>{c.sec}</b> : null}
            </span>
          ))}
        </div>
      </div>

      <div ref={stageRef} className={`${styles.stage} touch-none`}>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

        {banner ? (
          <div key={banner.key} className={`${styles.banner} ${styles[`tone-${banner.tone}`]} ${banner.out ? styles.bannerOut : ""}`}>
            <span className={styles.bannerTitle} style={bannerFont(banner.title, banner.tone === "epic")}>{banner.title}</span>
            {banner.sub ? <span className={styles.bannerSub}>{banner.sub}</span> : null}
          </div>
        ) : null}

        {!started && !over ? (
          <div className={styles.touchGuide} aria-hidden="true">
            <div className={styles.touchHalf}>
              <span>ここを押すと 左フリッパー</span>
            </div>
            <div className={styles.touchHalf}>
              <span>ここで 右フリッパー</span>
            </div>
          </div>
        ) : null}

        {showPlunger ? (
          <div className={styles.plunger} aria-hidden="true">
            <span className={styles.plungerHint}>
              右下を ↓ 引いて離す
              {hud && hud.skillLane >= 0 ? (
                <>
                  <br />
                  <b>「{LANE_LETTERS[hud.skillLane]}」</b>でスキルショット
                </>
              ) : null}
            </span>
            <div className={styles.gaugeWrap}>
              <div className={styles.gaugeLabels}>
                {(course.type === "stage" && course.spec.base === "blank" ? [] : SKILL_SHOT_POWER).map((power, lane) => (
                  <span key={lane} className={`${styles.gaugeLabel} ${hud?.skillLane === lane ? styles.gaugeLabelOn : ""}`} style={{ top: markFor(power) }}>
                    {LANE_LETTERS[lane]}
                  </span>
                ))}
                <span className={styles.gaugeLabel} style={{ top: markFor(0.86) }}>
                  {course.type === "stage" && course.spec.base === "blank" ? "強い" : "1周"}
                </span>
              </div>
              <div className={styles.gauge}>
                <div className={styles.gaugeFill} style={{ height: `${(hud?.pull ?? 0) * 100}%` }} />
                {(course.type === "stage" && course.spec.base === "blank" ? [] : SKILL_SHOT_POWER).map((power) => (
                  <span key={power} className={styles.gaugeMark} style={{ top: markFor(power) }} />
                ))}
                <span className={styles.gaugeMark} style={{ top: markFor(FULL_PLUNGE_POWER) }} />
              </div>
            </div>
          </div>
        ) : null}

        {paused && !over ? (
          <div className={styles.sheetBack} data-pinball-ui data-pinball-scroll>
            <div className={styles.sheet}>
              <p className={styles.sheetTitle}>一時停止</p>
              <p className={styles.sheetSub}>
                {theme.name} ・ ボール{g?.ball ?? 1} ・ {(g?.score ?? 0).toLocaleString("ja-JP")}点
              </p>
              <div className={styles.volume}>
                <label>
                  曲の音量
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={bgm}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setBgm(v);
                      setBgmVolume(v);
                    }}
                  />
                </label>
                <label>
                  効果音
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={tap}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTap(v);
                      setTapVolume(v);
                    }}
                  />
                </label>
              </div>
              <div className={styles.buttons}>
                <button type="button" className={styles.primary} onClick={togglePause}>
                  つづける
                </button>
                <button type="button" className={styles.secondary} onClick={onRestart}>
                  最初からやりなおす
                </button>
                <button type="button" className={styles.secondary} onClick={onExit}>
                  {course.type === "stage" && course.test ? "やめてエディターへ" : "やめて台えらびへ"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {over && g ? (
          <div className={styles.sheetBack} data-pinball-ui data-pinball-scroll>
            <div className={styles.sheet}>
              <p className={styles.sheetTitle}>ゲームオーバー</p>
              <p className={styles.sheetSub}>
                {theme.name} ・ {Math.floor(g.playTime / 60)}分{Math.round(g.playTime % 60)}秒
              </p>
              <p className={styles.bigScore}>{g.score.toLocaleString("ja-JP")}</p>
              {submit.state === "test" ? null : (submit.state === "done" && submit.isBest) || (submit.state !== "done" && (best === null || g.score > best) && g.score > 0) ? (
                <p className={styles.best}>ベスト更新！</p>
              ) : best !== null ? (
                <p className={styles.sheetSub}>ベスト {best.toLocaleString("ja-JP")}</p>
              ) : null}
              <div className={styles.statGrid}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>集めたアイテム</span>
                  <span className={styles.statValue}>{g.stats.items}個</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>制覇</span>
                  <span className={styles.statValue}>{g.conquests}回</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>ジャックポット</span>
                  <span className={styles.statValue}>{g.stats.jackpots}回</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>最大コンボ</span>
                  <span className={styles.statValue}>{g.stats.maxCombo}</span>
                </div>
              </div>
              <div className={styles.coins} data-kind={submit.state === "done" ? submit.kind : "red"}>
                {submit.state === "done" && submit.kind === "blue" ? <BlueCoinArt className="h-7 w-7" /> : <RedCoinArt className="h-7 w-7" />}
                {submit.state === "done" ? (
                  <span>
                    <span className={styles.coinsGain}>+{submit.coins.toLocaleString("ja-JP")}</span> {submit.kind === "blue" ? "青コイン" : "赤コイン"}
                    {submit.balance !== null ? <span className={styles.coinsBalance}> （のこり {submit.balance.toLocaleString("ja-JP")}枚）</span> : null}
                  </span>
                ) : submit.state === "test" ? (
                  <span className={styles.coinsBalance}>テストプレイなので、記録と赤コインはありません</span>
                ) : submit.state === "sending" || submit.state === "idle" ? (
                  <span className={styles.coinsBalance}>記録しています…</span>
                ) : submit.state === "offline" ? (
                  <span className={styles.coinsBalance}>赤コインは準備中です（スコアだけ表示）</span>
                ) : (
                  <span className={styles.coinsBalance}>
                    {submit.message}{" "}
                    <button type="button" className="underline" onClick={() => void sendResult()}>
                      もう一度送る
                    </button>
                  </span>
                )}
              </div>
              <div className={styles.buttons}>
                <button type="button" className={styles.primary} onClick={onRestart}>
                  もう一度あそぶ
                </button>
                <button type="button" className={styles.secondary} onClick={onExit}>
                  {course.type === "stage" && course.test ? "エディターにもどる" : "台えらびにもどる"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className={styles.controls}>
        {([0, 1] as const).map((side) => (
          <button key={side} type="button" data-pinball-control={side === 0 ? "left" : "right"} className={`${styles.flipperButton} ${held[side] ? styles.flipperButtonHeld : ""}`} disabled={paused || over} aria-pressed={held[side]} aria-label={`${side === 0 ? "左" : "右"}フリッパー`} onKeyDown={(event) => {
            if (event.code !== "Space" && event.code !== "Enter") return;
            event.preventDefault();
            event.stopPropagation();
            if (event.repeat) return;
            heldKeys.current.add(`button:${side}:${event.code}`);
            wake();
            pressSide(side, true);
          }}>
            <span aria-hidden="true">{side === 0 ? "◀" : "▶"}</span> {side === 0 ? "左" : "右"}フリッパー
          </button>
        ))}
      </div>
    </div>
  );
}
