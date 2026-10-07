"use client";

/**
 * アプリの画面（iPhone のホーム画面のような一覧）。ホームを左にスワイプすると出る（ページの切りかえは home-pager.tsx）。
 *
 * iPhone と同じさわり心地にしていること
 * - アイコンを押すと少し縮んで暗くなり、はなすとアイコンから画面いっぱいに広がってアプリ（ページ）が開く
 * - フォルダはアイコンからふわっと広がって開き、まわりをタップすると閉じる
 * - 長押しでメニュー（すぐにできること・ホーム画面を編集）。メニューが出たまま指を動かすと、そのまま並べかえに入る
 * - 編集中はアイコンがぷるぷるし、ドラッグで並べかえ（ほかのアイコンがよける）。並び順はこの端末に覚える
 * - 下の「検索」から、アプリをさがして開ける
 * - いちばん上は、今日の歩数とレベルのウィジェット
 */
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BlueCoinArt, CoinArt } from "@/components/coin-art";
import { applyOrder, flattenApps, launcherItems, ORDER_KEY, type LauncherApp, type LauncherFolder, type LauncherItem, type LauncherOptions } from "./apps";
import styles from "./launcher.module.css";

export type LauncherData = {
  steps: number;
  level: number;
  progressPercent: number;
  toNext: number;
  coins: number;
  blueCoins: number | null;
  unreadNotices: number;
};

/** iPhone のアイコンと同じ、なめらかな角の四角（スーパー楕円 n=5） */
const SQUIRCLE = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const x = 50 + 50 * Math.sign(c) * Math.pow(Math.abs(c), 0.4);
    const y = 50 + 50 * Math.sign(s) * Math.pow(Math.abs(s), 0.4);
    pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='M${pts.join("L")}Z'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

type Rect = { left: number; top: number; width: number; height: number };
const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/* ------------------------------------------------------------------ 絵 */

function PawArt() {
  return (
    <svg viewBox="0 0 64 64" width="70%" height="70%" aria-hidden="true">
      {[[20, 44, -0.4], [40, 22, 0.35]].map(([x, y, a], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${(a as number) * 57})`} fill={i ? "#c98a4b" : "#a86a35"}>
          <ellipse cx="0" cy="4" rx="7" ry="6" />
          <ellipse cx="-7.5" cy="-4.5" rx="2.6" ry="3.3" />
          <ellipse cx="-2.6" cy="-8.6" rx="2.6" ry="3.4" />
          <ellipse cx="2.6" cy="-8.6" rx="2.6" ry="3.4" />
          <ellipse cx="7.5" cy="-4.5" rx="2.6" ry="3.3" />
        </g>
      ))}
    </svg>
  );
}

function ArtImage({ app, size }: { app: LauncherApp; size: number }) {
  if (app.art === "coin") return <span style={{ width: "66%", height: "66%" }}><CoinArt className="h-full w-full" /></span>;
  if (app.art === "paw") return <PawArt />;
  const px = Math.round(size * (app.cover ? 1 : app.artScale ?? 0.8) * 2);
  return (
    <Image
      src={app.art}
      alt=""
      width={px}
      height={px}
      draggable={false}
      style={app.cover ? undefined : { width: `${(app.artScale ?? 0.8) * 100}%`, height: `${(app.artScale ?? 0.8) * 100}%` }}
    />
  );
}

/** アプリのアイコン（色の地・絵・つや） */
function AppTile({ app, size }: { app: LauncherApp; size: number }) {
  return (
    <span className={styles.iconShadow} style={{ display: "block", width: size, height: size }}>
      <span className={`${styles.icon} ${styles.squircle}`} style={{ width: size, height: size, background: app.bg }}>
        <span className={styles.iconArt} data-cover={app.cover ? "true" : undefined}>
          <ArtImage app={app} size={size} />
        </span>
        <span className={styles.iconGloss} />
      </span>
    </span>
  );
}

/** フォルダのアイコン（すりガラスに、中のアプリを3×3で小さく） */
function FolderTile({ folder, size }: { folder: LauncherFolder; size: number }) {
  const mini = Math.round(size * 0.2);
  return (
    <span className={styles.iconShadow} style={{ display: "block", width: size, height: size }}>
      <span className={`${styles.folderIcon} ${styles.squircle}`} style={{ width: size, height: size }}>
        {folder.apps.slice(0, 9).map((app) => (
          <span key={app.id} className={styles.mini} style={{ width: mini, height: mini, background: app.bg }}>
            <span className={styles.iconArt} data-cover={app.cover ? "true" : undefined}>
              <ArtImage app={app} size={mini} />
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

function Tile({ item, size }: { item: LauncherItem; size: number }) {
  return item.kind === "folder" ? <FolderTile folder={item} size={size} /> : <AppTile app={item} size={size} />;
}

/* ------------------------------------------------------------------ 並べ方 */

type Geometry = { pad: number; cellW: number; icon: number; rowH: number; width: number };

function geometryFor(width: number): Geometry {
  const pad = Math.max(14, Math.round(width * 0.045));
  const cellW = (width - pad * 2) / 4;
  const icon = Math.min(66, Math.round(cellW * 0.72));
  return { pad, cellW, icon, rowH: icon + 33, width };
}

/** ウィジェットが上の2段（8マス）を使うので、アプリは9マス目から */
const WIDGET_SLOTS = 8;
const slotXY = (g: Geometry, slot: number) => ({ x: g.pad + (slot % 4) * g.cellW, y: Math.floor(slot / 4) * g.rowH });

/* ------------------------------------------------------------------ 本体 */

type Press = { id: string; pointerId: number; x0: number; y0: number; timer: number; long: boolean; moved: boolean; inFolder: boolean };
type Drag = { id: string; pointerId: number; dx: number; dy: number; x: number; y: number };
type MenuState = { item: LauncherItem; rect: Rect; open: boolean };
type FolderState = { folder: LauncherFolder; rect: Rect; open: boolean };
type LaunchState = { app: LauncherApp; rect: Rect; grown: boolean };

export function Launcher({
  options,
  data,
  page,
  pageCount,
  onBlockSwipe,
  onGoPage,
}: {
  options: LauncherOptions;
  data: LauncherData;
  /** いま見えているページ（0: ホーム、1: アプリ、2: 背景） */
  page: number;
  pageCount: number;
  /** 長押し・並べかえ・フォルダのあいだは、ページの横スワイプを止める */
  onBlockSwipe: (blocked: boolean) => void;
  onGoPage: (page: number) => void;
}) {
  const router = useRouter();
  const baseItems = useMemo(() => launcherItems(options), [options]);
  const [order, setOrder] = useState<string[] | null>(null);
  const items = useMemo(() => applyOrder(baseItems, order), [baseItems, order]);
  const [width, setWidth] = useState(390);
  const [height, setHeight] = useState(844);
  const [pressed, setPressed] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [folder, setFolder] = useState<FolderState | null>(null);
  const [launch, setLaunch] = useState<LaunchState | null>(null);
  const [search, setSearch] = useState<{ open: boolean; q: string } | null>(null);
  const press = useRef<Press | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const emptyPress = useRef<{ timer: number; x: number; y: number } | null>(null);

  // 並び順（この端末に覚える）
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ORDER_KEY);
      if (raw) setOrder(JSON.parse(raw) as string[]);
    } catch {
      // 読めなければ、いつもの並び
    }
  }, []);
  const saveOrder = useCallback((next: LauncherItem[]) => {
    const ids = next.map((item) => item.id);
    setOrder(ids);
    try {
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    } catch {
      // 覚えられなくても、この画面のあいだは並べかえたまま
    }
  }, []);

  useEffect(() => {
    const measure = () => {
      setWidth(Math.min(window.innerWidth, 520));
      setHeight(window.innerHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const g = geometryFor(width);
  const blocked = Boolean(menu || folder || search || drag || launch);
  useEffect(() => onBlockSwipe(blocked), [blocked, onBlockSwipe]);

  // アプリの画面からはなれたら、編集・メニューなどはおしまい
  useEffect(() => {
    if (page === 1) return;
    setEditing(false);
    setMenu(null);
    setSearch(null);
  }, [page]);

  /* ---------------------------------------------------------- 開く */

  const open = useCallback(
    (app: LauncherApp, el: Element | null, href = app.href) => {
      const rect = el ? rectOf(el) : { left: window.innerWidth / 2 - 30, top: window.innerHeight / 2 - 30, width: 60, height: 60 };
      router.prefetch(href);
      setLaunch({ app: { ...app, href }, rect, grown: false });
      setSearch(null);
      requestAnimationFrame(() => requestAnimationFrame(() => setLaunch((cur) => (cur ? { ...cur, grown: true } : cur))));
      window.setTimeout(() => router.push(href), 380);
      // うまく移れなかったときのために、しばらくしたら元にもどす
      window.setTimeout(() => setLaunch(null), 4000);
    },
    [router],
  );

  const openFolder = useCallback((f: LauncherFolder, el: Element) => {
    setFolder({ folder: f, rect: rectOf(el), open: false });
    requestAnimationFrame(() => requestAnimationFrame(() => setFolder((cur) => (cur ? { ...cur, open: true } : cur))));
  }, []);
  const closeFolder = useCallback(() => {
    setFolder((cur) => (cur ? { ...cur, open: false } : cur));
    window.setTimeout(() => setFolder(null), 420);
  }, []);

  const openMenu = useCallback((item: LauncherItem, el: Element) => {
    if ("vibrate" in navigator) navigator.vibrate?.(8);
    setMenu({ item, rect: rectOf(el), open: false });
    requestAnimationFrame(() => requestAnimationFrame(() => setMenu((cur) => (cur ? { ...cur, open: true } : cur))));
  }, []);
  const closeMenu = useCallback(() => {
    setMenu((cur) => (cur ? { ...cur, open: false } : cur));
    window.setTimeout(() => setMenu(null), 260);
  }, []);

  /* ---------------------------------------------------------- 押す・長押し・並べかえ */

  const startDrag = useCallback(
    (id: string, pointerId: number, clientX: number, clientY: number) => {
      const grid = gridRef.current;
      const index = items.findIndex((item) => item.id === id);
      if (!grid || index < 0) return;
      const box = grid.getBoundingClientRect();
      const pos = slotXY(g, index + WIDGET_SLOTS);
      setEditing(true);
      setDrag({ id, pointerId, dx: clientX - box.left - pos.x, dy: clientY - box.top - pos.y, x: pos.x, y: pos.y });
    },
    [items, g],
  );

  const onCellDown = (event: ReactPointerEvent, item: LauncherItem, inFolder = false) => {
    if (event.button !== 0 || launch) return;
    const el = event.currentTarget;
    if (editing && !inFolder) {
      // 編集中は、指を置いたらそのまま持ち上げる
      event.preventDefault();
      el.setPointerCapture(event.pointerId);
      startDrag(item.id, event.pointerId, event.clientX, event.clientY);
      return;
    }
    if (item.kind === "app") router.prefetch(item.href);
    setPressed(item.id);
    const timer = window.setTimeout(() => {
      if (!press.current || press.current.moved) return;
      press.current.long = true;
      setPressed(null);
      if (!inFolder) openMenu(item, el.querySelector("[data-tile]") ?? el);
    }, 460);
    press.current = { id: item.id, pointerId: event.pointerId, x0: event.clientX, y0: event.clientY, timer, long: false, moved: false, inFolder };
  };

  const onCellMove = (event: ReactPointerEvent) => {
    const p = press.current;
    if (drag && event.pointerId === drag.pointerId) {
      const box = gridRef.current?.getBoundingClientRect();
      if (!box) return;
      const x = event.clientX - box.left - drag.dx;
      const y = event.clientY - box.top - drag.dy;
      setDrag({ ...drag, x, y });
      // 指の下のマスへ入れかえる（ほかのアイコンはアニメーションでよける）
      const cx = x + g.cellW / 2, cy = y + g.icon / 2;
      const col = Math.max(0, Math.min(3, Math.floor((cx - g.pad) / g.cellW)));
      const row = Math.max(2, Math.floor(cy / g.rowH));
      const target = Math.max(0, Math.min(items.length - 1, row * 4 + col - WIDGET_SLOTS));
      const from = items.findIndex((item) => item.id === drag.id);
      if (from >= 0 && target !== from) {
        const next = [...items];
        const [moved] = next.splice(from, 1);
        next.splice(target, 0, moved!);
        saveOrder(next);
      }
      return;
    }
    if (!p || event.pointerId !== p.pointerId) return;
    const dist = Math.hypot(event.clientX - p.x0, event.clientY - p.y0);
    if (p.long && menu && dist > 12 && !p.inFolder) {
      // メニューが出たまま指を動かしたら、そのまま並べかえへ
      setMenu(null);
      press.current = null;
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      startDrag(p.id, event.pointerId, event.clientX, event.clientY);
      return;
    }
    if (!p.long && dist > 8) {
      p.moved = true;
      window.clearTimeout(p.timer);
      setPressed(null);
    }
  };

  const onCellUp = (event: ReactPointerEvent, item: LauncherItem) => {
    if (drag && event.pointerId === drag.pointerId) {
      setDrag(null);
      return;
    }
    const p = press.current;
    press.current = null;
    setPressed(null);
    if (!p || p.pointerId !== event.pointerId) return;
    window.clearTimeout(p.timer);
    if (p.long || p.moved || editing) return;
    const el = (event.currentTarget as Element).querySelector("[data-tile]") ?? event.currentTarget;
    if (item.kind === "folder") openFolder(item, el);
    else open(item, el);
  };

  const onCellCancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setPressed(null);
    setDrag(null);
  };

  // 何もないところを長押し → 編集。編集中に何もないところをタップ → 完了
  const onEmptyDown = (event: ReactPointerEvent) => {
    if (event.target !== event.currentTarget) return;
    if (editing) {
      setEditing(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if ("vibrate" in navigator) navigator.vibrate?.(8);
      setEditing(true);
    }, 520);
    emptyPress.current = { timer, x: event.clientX, y: event.clientY };
  };
  const onEmptyMove = (event: ReactPointerEvent) => {
    const e = emptyPress.current;
    if (e && Math.hypot(event.clientX - e.x, event.clientY - e.y) > 8) {
      window.clearTimeout(e.timer);
      emptyPress.current = null;
    }
  };
  const onEmptyUp = () => {
    if (emptyPress.current) window.clearTimeout(emptyPress.current.timer);
    emptyPress.current = null;
  };

  /* ---------------------------------------------------------- 描く */

  const cellStyle = (slot: number, override?: { x: number; y: number }): CSSProperties => {
    const { x, y } = override ?? slotXY(g, slot);
    return { width: g.cellW, transform: `translate3d(${x}px, ${y}px, 0)` };
  };

  const cell = (item: LauncherItem, slot: number, opts: { inFolder?: boolean; style?: CSSProperties } = {}) => {
    const dragging = drag?.id === item.id && !opts.inFolder;
    const badge = item.kind === "app" && item.badge === "notices" && data.unreadNotices > 0 ? data.unreadNotices : 0;
    return (
      <div
        key={item.id}
        className={styles.cell}
        style={opts.style ?? cellStyle(slot, dragging && drag ? { x: drag.x, y: drag.y } : undefined)}
        data-pressed={pressed === item.id ? "true" : undefined}
        data-editing={editing && !opts.inFolder ? "true" : undefined}
        data-dragging={dragging ? "true" : undefined}
        data-hidden={launch?.app.id === item.id || (menu?.item.id === item.id && !opts.inFolder) ? "true" : undefined}
        role="button"
        tabIndex={0}
        aria-label={item.kind === "folder" ? `${item.name}フォルダ（${item.apps.length}個のアプリ）` : `${item.name}${badge ? `（${badge}件）` : ""}`}
        onPointerDown={(e) => onCellDown(e, item, opts.inFolder)}
        onPointerMove={onCellMove}
        onPointerUp={(e) => onCellUp(e, item)}
        onPointerCancel={onCellCancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          const el = e.currentTarget.querySelector("[data-tile]") ?? e.currentTarget;
          if (item.kind === "folder") openFolder(item, el);
          else open(item, el);
        }}
      >
        <span className={styles.press} data-tile="">
          <Tile item={item} size={g.icon} />
          {badge ? <span className={styles.badge}>{badge > 99 ? "99+" : badge}</span> : null}
        </span>
        <span className={styles.label} style={{ width: g.cellW - 4 }}>{item.name}</span>
      </div>
    );
  };

  const widgetLeft = g.pad + (g.cellW - g.icon) / 2;
  const widgetW = width - widgetLeft * 2;
  const widgetH = g.rowH + g.icon - 2;
  const ringR = 19, ringC = 2 * Math.PI * ringR;
  const stepRatio = Math.min(1, data.steps / 10000);

  return (
    <div className={styles.grid} style={{ "--squircle": SQUIRCLE } as CSSProperties}>
      <div className={styles.scrim} />
      <div
        ref={gridRef}
        className={styles.grid}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 22px)", left: `max(0px, calc((100vw - ${width}px) / 2))`, width }}
        onPointerDown={onEmptyDown}
        onPointerMove={onEmptyMove}
        onPointerUp={onEmptyUp}
        onPointerCancel={onEmptyUp}
      >
        {/* ウィジェット：今日の歩数とレベル */}
        <button
          type="button"
          className={styles.widget}
          style={{ left: widgetLeft, top: 0, width: widgetW, height: widgetH }}
          onClick={() => !editing && router.push("/mypage/exp-history")}
          aria-label={`今日の歩数 ${data.steps.toLocaleString()}歩、おでかけレベル ${data.level}`}
        >
          <span className={styles.widgetHalf}>
            <span className="flex items-start justify-between">
              <span className={styles.widgetKicker}>今日の歩数</span>
              <svg className={styles.ring} viewBox="0 0 46 46" aria-hidden="true">
                <circle cx="23" cy="23" r={ringR} fill="none" stroke="rgba(120,100,70,.15)" strokeWidth="5" />
                <circle cx="23" cy="23" r={ringR} fill="none" stroke="#6fa85a" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${ringC * stepRatio} ${ringC}`} transform="rotate(-90 23 23)" />
                <text x="23" y="27" textAnchor="middle" fontSize="11" fontWeight="800" fill="#4a7a3c">{Math.round(stepRatio * 100)}%</text>
              </svg>
            </span>
            <span>
              <span className={styles.widgetBig}>{data.steps.toLocaleString()}</span>
              <span className={styles.widgetUnit}>歩</span>
            </span>
          </span>
          <span className={styles.widgetHalf}>
            <span className={styles.widgetKicker}>おでかけレベル</span>
            <span>
              <span className={styles.widgetUnit} style={{ marginLeft: 0 }}>Lv.</span>
              <span className={styles.widgetBig}>{data.level}</span>
            </span>
            <span className="block">
              <span className={styles.bar}><span style={{ width: `${data.progressPercent}%` }} /></span>
              <span className="mt-1.5 flex items-center gap-2 text-[11px] font-bold tabular-nums text-[#6b6156]">
                <span className="flex items-center gap-0.5"><CoinArt className="h-3.5 w-3.5" />{data.coins.toLocaleString()}</span>
                {data.blueCoins !== null ? <span className="flex items-center gap-0.5"><BlueCoinArt className="h-3.5 w-3.5" />{data.blueCoins.toLocaleString()}</span> : null}
              </span>
            </span>
          </span>
        </button>

        {items.map((item, index) => cell(item, index + WIDGET_SLOTS))}
      </div>

      {editing ? (
        <button type="button" className={styles.done} style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }} onClick={() => setEditing(false)}>
          完了
        </button>
      ) : null}

      {/* 検索とページの点 */}
      <div className={styles.bottom} style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 12px)" }}>
        {!editing ? (
          <button type="button" className={styles.search} onClick={() => setSearch({ open: false, q: "" })}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            検索
          </button>
        ) : null}
        <div className={styles.dots} role="tablist" aria-label="ページ" style={{ pointerEvents: "auto" }}>
          {Array.from({ length: pageCount }, (_, i) => (
            <button key={i} type="button" role="tab" aria-selected={page === i} aria-label={i === 0 ? "ホーム" : i === 1 ? "アプリ" : "背景"} className={styles.dot} data-on={page === i} onClick={() => onGoPage(i)} style={{ border: 0, padding: 0 }} />
          ))}
        </div>
      </div>

      {folder ? <FolderView state={folder} g={g} width={width} height={height} cell={cell} onClose={closeFolder} /> : null}
      {menu ? <ContextMenu state={menu} g={g} onClose={closeMenu} onEdit={() => { closeMenu(); setEditing(true); }} onOpen={(href) => { const m = menu; closeMenu(); if (m.item.kind === "app") open(m.item, null, href); }} onOpenFolderApp={(app) => { closeMenu(); open(app, null); }} /> : null}
      {search ? <Spotlight items={items} cell={cell} onClose={() => setSearch(null)} onOpen={(app) => { setSearch(null); open(app, null); }} /> : null}
      {launch ? <LaunchView state={launch} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ フォルダ */

function FolderView({ state, g, width, height, cell, onClose }: {
  state: FolderState;
  g: Geometry;
  width: number;
  height: number;
  cell: (item: LauncherItem, slot: number, opts?: { inFolder?: boolean; style?: CSSProperties }) => ReactNode;
  onClose: () => void;
}) {
  const { folder, rect, open } = state;
  const vw = typeof window === "undefined" ? width : window.innerWidth;
  const pw = Math.min(vw - 52, 330);
  const inner = 20;
  const cw = (pw - inner * 2) / 3;
  const rows = Math.max(1, Math.ceil(folder.apps.length / 3));
  const ph = inner * 2 + rows * g.rowH - 6;
  const x = (vw - pw) / 2;
  const y = Math.max(120, height * 0.46 - ph / 2);
  const from = `translate(${rect.left - x}px, ${rect.top - y}px) scale(${rect.width / pw}, ${rect.height / ph})`;
  return createPortal(
    <div className={styles.veil} data-open={open} onPointerDown={(e) => e.target === e.currentTarget && onClose()} style={{ "--squircle": SQUIRCLE } as CSSProperties}>
      <div className={styles.folderTitle} style={{ top: y - 58, opacity: open ? 1 : 0, transform: open ? "none" : "scale(0.85)" }}>{folder.name}</div>
      <div className={styles.folderPanel} style={{ left: x, top: y, width: pw, height: ph, transform: open ? "none" : from, borderRadius: open ? 38 : 16 }}>
        <div style={{ position: "absolute", inset: inner, opacity: open ? 1 : 0, transition: "opacity .25s" }}>
          {folder.apps.map((app, i) =>
            cell(app, i, { inFolder: true, style: { width: cw, transform: `translate3d(${(i % 3) * cw}px, ${Math.floor(i / 3) * g.rowH}px, 0)` } }),
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ 長押しのメニュー */

function ContextMenu({ state, g, onClose, onEdit, onOpen, onOpenFolderApp }: {
  state: MenuState;
  g: Geometry;
  onClose: () => void;
  onEdit: () => void;
  onOpen: (href: string) => void;
  onOpenFolderApp: (app: LauncherApp) => void;
}) {
  const { item, rect, open } = state;
  const vw = window.innerWidth, vh = window.innerHeight;
  const rows = item.kind === "folder" ? item.apps.length : (item.shortcuts?.length ?? 1);
  const menuH = rows * 44 + 8 + 44;
  const below = rect.top + rect.height + 14 + menuH < vh - 20;
  const left = Math.max(12, Math.min(vw - 252, rect.left + rect.width / 2 - 120));
  const top = below ? rect.top + rect.height + 14 : rect.top - 14 - menuH;
  const originX = rect.left + rect.width / 2 - left;
  return createPortal(
    <div className={styles.veil} data-open={open} onPointerDown={(e) => e.target === e.currentTarget && onClose()} style={{ "--squircle": SQUIRCLE } as CSSProperties}>
      <div className={styles.menuLift} style={{ left: rect.left, top: rect.top, transform: open ? "scale(1.08)" : "scale(1)" }}>
        <Tile item={item} size={g.icon} />
      </div>
      <div
        className={styles.menu}
        role="menu"
        style={{ left, top, opacity: open ? 1 : 0, transform: open ? "none" : "scale(0.6)", transformOrigin: `${originX}px ${below ? 0 : menuH}px` }}
      >
        {item.kind === "folder"
          ? item.apps.map((app) => (
              <button key={app.id} type="button" role="menuitem" onClick={() => onOpenFolderApp(app)}>
                {app.name}
                <span className={styles.mini} style={{ width: 22, height: 22, background: app.bg, display: "grid", placeItems: "center" }}>
                  <span className={styles.iconArt} data-cover={app.cover ? "true" : undefined}><ArtImage app={app} size={22} /></span>
                </span>
              </button>
            ))
          : (item.shortcuts ?? [{ label: "開く", href: item.href }]).map((s) => (
              <button key={s.label} type="button" role="menuitem" onClick={() => onOpen(s.href)}>
                {s.label}
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="#8a7f72" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ))}
        <div className={styles.menuGap} />
        <button type="button" role="menuitem" onClick={onEdit}>
          ホーム画面を編集
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="2" y="2" width="6" height="6" rx="1.8" fill="none" stroke="#5a5046" strokeWidth="1.5" /><rect x="10" y="2" width="6" height="6" rx="1.8" fill="none" stroke="#5a5046" strokeWidth="1.5" /><rect x="2" y="10" width="6" height="6" rx="1.8" fill="none" stroke="#5a5046" strokeWidth="1.5" /><rect x="10" y="10" width="6" height="6" rx="1.8" fill="none" stroke="#5a5046" strokeWidth="1.5" /></svg>
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ 検索 */

const kana = (s: string) => s.toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

function Spotlight({ items, cell, onClose, onOpen }: {
  items: LauncherItem[];
  cell: (item: LauncherItem, slot: number, opts?: { inFolder?: boolean; style?: CSSProperties }) => ReactNode;
  onClose: () => void;
  onOpen: (app: LauncherApp) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    inputRef.current?.focus();
  }, []);
  const close = () => {
    setOpen(false);
    window.setTimeout(onClose, 300);
  };
  const apps = flattenApps(items);
  const query = kana(q.trim());
  const hits = query ? apps.filter((app) => [app.name, ...app.keywords].some((w) => kana(w).includes(query))) : [];
  const folderOf = (app: LauncherApp) => items.find((item) => item.kind === "folder" && item.apps.some((a) => a.id === app.id))?.name;
  const cw = (Math.min(window.innerWidth, 520) - 32 - 12) / 4;
  return createPortal(
    <div className={styles.veil} data-open={open} onPointerDown={(e) => e.target === e.currentTarget && close()} style={{ "--squircle": SQUIRCLE } as CSSProperties}>
      <div className={styles.spot} style={{ top: "calc(env(safe-area-inset-top, 0px) + 14px)", opacity: open ? 1 : 0, transform: open ? "none" : "translateY(24px)", maxWidth: 520, margin: "0 auto" }}>
        <div className={styles.spotField}>
          <label className={styles.spotInput}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="#8a7f72" strokeWidth="2" /><path d="M11 11l3.5 3.5" stroke="#8a7f72" strokeWidth="2" strokeLinecap="round" /></svg>
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="アプリをさがす" aria-label="アプリをさがす" enterKeyHint="go" onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) onOpen(hits[0]); if (e.key === "Escape") close(); }} />
          </label>
          <button type="button" className={styles.spotCancel} onClick={close}>キャンセル</button>
        </div>
        {query ? (
          <>
            <p className={styles.spotSection}>アプリ</p>
            {hits.length ? (
              <div className={styles.spotList}>
                {hits.map((app) => (
                  <button key={app.id} type="button" className={styles.spotRow} onClick={() => onOpen(app)}>
                    <AppTile app={app} size={36} />
                    {app.name}
                    {folderOf(app) ? <small>{folderOf(app)}</small> : null}
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-1 text-[14px] font-bold text-[#8a7f72]">「{q}」は見つかりませんでした</p>
            )}
          </>
        ) : (
          <>
            <p className={styles.spotSection}>よく使うアプリ</p>
            <div className={styles.spotGrid}>
              {apps.slice(0, 8).map((app, i) => cell(app, i, { inFolder: true, style: { width: cw, position: "relative", transform: "none" } }))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ 開くときの広がり */

function LaunchView({ state }: { state: LaunchState }) {
  const { app, rect, grown } = state;
  const style: CSSProperties = grown
    ? { left: 0, top: 0, width: "100vw", height: "100dvh", borderRadius: 0, background: app.bg }
    : { left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: rect.width * 0.23, background: app.bg };
  return createPortal(
    <div className={styles.launch} style={style} aria-hidden="true">
      <div className={styles.launchArt} style={{ opacity: grown ? 0.9 : 1, transform: grown ? "scale(1)" : "scale(0.4)" }}>
        {app.art === "coin" ? <CoinArt className="h-full w-full" /> : app.art === "paw" ? <PawArt /> : <Image src={app.art} alt="" width={240} height={240} />}
      </div>
    </div>,
    document.body,
  );
}
