"use client";

/**
 * アプリの画面（iPhone のホーム画面のような一覧）。ホームを左にスワイプすると出る（ページの切りかえは home-pager.tsx）。
 *
 * iPhone と同じさわり心地にしていること
 * - アイコンを押すと少し縮んで暗くなり、はなすとアイコンから画面いっぱいに広がってアプリ（ページ）が開く。
 *   そのページで「戻る」を押すと、画面がアイコンへ吸いこまれるようにして、この画面へもどる
 * - フォルダはアイコンからふわっと広がって開き、まわりをタップすると閉じる
 * - アイコンを長押しでメニュー（すぐにできること・ホーム画面を編集・非表示）。メニューが出たまま指を動かすと、そのまま並べかえに入る
 * - 何もないところ（ウィジェットも）を長押しすると、「ホーム画面を編集」「非表示のアプリを再表示」のメニュー
 * - 編集中はアイコンがぷるぷるし、左上の × で非表示（消すのではなく、かくすだけ）。ドラッグで並べかえ（ほかのアイコンがよける）。
 *   フォルダをタップすると、中のアプリも同じように非表示にできる。並び順・非表示はこの端末に覚える
 * - 下の「検索」から、アプリをさがして開ける
 * - いちばん上は、時計と天気・今日の歩数のウィジェット
 */
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useHomeWeather, WeatherSheet } from "@/components/home-weather";
import { markLaunch } from "@/lib/launcher-return";
import { applyHidden, applyOrder, buildItems, flattenApps, folderNameFor, HIDDEN_KEY, iconSrc, LAYOUT_KEY, launcherItems, ORDER_KEY, toStored, type LauncherApp, type LauncherFolder, type LauncherItem, type LauncherOptions, type StoredEntry } from "./apps";
import { EditGlyph, EyeGlyph, HiddenSheet, HideAlert, ScreenMenu, type HiddenEntry } from "./sheets";
import { ClockWeatherWidget, StepsWidget } from "./widgets";
import styles from "./launcher.module.css";

export type LauncherData = {
  steps: number;
  unreadNotices: number;
};

/** iPhone のアイコンと同じ、なめらかな角の四角（スーパー楕円 n=5）。フォルダとメニューの小さなアイコンに使う */
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
const ROOT_VARS = { "--squircle": SQUIRCLE } as CSSProperties;

type Rect = { left: number; top: number; width: number; height: number };
const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

const readList = (key: string): string[] | null => {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? "null") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
};
const writeList = (key: string, list: string[]) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 覚えられなくても、この画面のあいだはそのまま
  }
};

const readLayout = (): StoredEntry[] | null => {
  try {
    const v = JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? "null") as unknown;
    return Array.isArray(v) ? (v as StoredEntry[]) : null;
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ アイコン */

/** アプリのアイコン（色の地・絵・影・ふちの光まで1枚に焼いた絵） */
function AppIcon({ app, size }: { app: LauncherApp; size: number }) {
  return (
    <Image
      className={styles.appIcon}
      src={iconSrc(app.id)}
      alt=""
      width={384}
      height={384}
      sizes={`${Math.round(size)}px`}
      loading="eager"
      draggable={false}
      style={{ width: size, height: size }}
    />
  );
}

/** フォルダのアイコン（すりガラスに、中のアプリを3×3で小さく） */
function FolderTile({ folder, size }: { folder: LauncherFolder; size: number }) {
  const mini = Math.round(size * 0.205);
  return (
    <span className={`${styles.folderIcon} ${styles.squircle}`} style={{ width: size, height: size }}>
      {folder.apps.slice(0, 9).map((app) => (
        <AppIcon key={app.id} app={app} size={mini} />
      ))}
    </span>
  );
}

function Tile({ item, size }: { item: LauncherItem; size: number }) {
  return (
    <span className={styles.iconShadow} style={{ display: "block", width: size, height: size }}>
      {item.kind === "folder" ? <FolderTile folder={item} size={size} /> : <AppIcon app={item} size={size} />}
    </span>
  );
}

/* ------------------------------------------------------------------ 並べ方 */

type Geometry = { pad: number; cellW: number; icon: number; rowH: number; width: number };

/** 下の「検索」とページの点のぶん（いちばん下のアイコンの文字から、ここまでは空ける） */
const BOTTOM_STACK = 36 + 10 + 17;
const BOTTOM_GAP = 22;

/**
 * アイコンの大きさと段の高さ。avail（ウィジェットの上はしから、下の「検索」の上の余白まで）に
 * rows 段が収まるように、まず段のあいだをつめ、それでも入らなければアイコンを少し小さくする
 */
function geometryFor(width: number, avail?: number | null, rows?: number): Geometry {
  const pad = Math.max(14, Math.round(width * 0.045));
  const cellW = (width - pad * 2) / 4;
  let icon = Math.min(66, Math.round(cellW * 0.72));
  let rowH = icon + 33;
  if (avail && rows && rows > 1) {
    // いちばん下の段は、アイコンと名前（約20px）だけ
    const fit = (i: number) => Math.floor((avail - i - 20) / (rows - 1));
    rowH = Math.min(icon + 33, fit(icon));
    if (rowH < icon + 27) {
      icon = Math.max(40, Math.min(icon, Math.floor((avail - 20 - 25 * (rows - 1)) / rows)));
      rowH = Math.max(icon + 24, Math.min(icon + 33, fit(icon)));
    }
  }
  return { pad, cellW, icon, rowH, width };
}

/** ウィジェットが上の2段（8マス）を使うので、アプリは9マス目から */
const WIDGET_SLOTS = 8;
const slotXY = (g: Geometry, slot: number) => ({ x: g.pad + (slot % 4) * g.cellW, y: Math.floor(slot / 4) * g.rowH });

/** 開いたフォルダの大きさと場所 */
function folderGeometry(appCount: number, g: Geometry, height: number) {
  const vw = typeof window === "undefined" ? 390 : window.innerWidth;
  const pw = Math.min(vw - 52, 330);
  const inner = 20;
  const cw = (pw - inner * 2) / 3;
  const rows = Math.max(1, Math.ceil(appCount / 3));
  const ph = inner * 2 + rows * g.rowH - 6;
  const x = (vw - pw) / 2;
  const y = Math.max(120, height * 0.46 - ph / 2);
  return { pw, ph, inner, cw, x, y };
}

const initialWidth = () => (typeof window === "undefined" ? 390 : Math.min(window.innerWidth, 520));

/* ------------------------------------------------------------------ 本体 */

type Press = { id: string; pointerId: number; x0: number; y0: number; timer: number; long: boolean; moved: boolean; inFolder: boolean; editing: boolean };
type Drag = { id: string; pointerId: number; dx: number; dy: number; x: number; y: number };
/** フォルダの中でのドラッグ（x, y は画面の上の指の位置、ox, oy は指がアイコンのどこを持っているか） */
type FolderDrag = { id: string; folderId: string; pointerId: number; ox: number; oy: number; x: number; y: number };
/** ドラッグ中のアイコンを重ねようとしている相手（ready になったら、はなすとフォルダになる） */
type Merge = { id: string; ready: boolean };
/** folderId：フォルダの中のアプリを長押ししたとき */
type MenuState = { item: LauncherItem; rect: Rect; open: boolean; folderId?: string };
type FolderState = { folder: LauncherFolder; rect: Rect; open: boolean; focusName?: boolean };
/** closing：アプリから戻ってきたとき（画面がアイコンへ吸いこまれる） */
type LaunchState = { app: LauncherApp; rect: Rect | null; grown: boolean; closing?: boolean; fading?: boolean };
type CellOpts = { inFolder?: boolean; plain?: boolean; style?: CSSProperties; jiggle?: number };

export function Launcher({
  options,
  data,
  page,
  pageCount,
  returnFrom,
  onBlockSwipe,
  onGoPage,
}: {
  options: LauncherOptions;
  data: LauncherData;
  /** いま見えているページ（0: ホーム、1: アプリ、2: 背景） */
  page: number;
  pageCount: number;
  /** アプリから戻ってきたとき、そのアプリの id（画面がアイコンへもどる動きを見せる） */
  returnFrom: string | null;
  /** 長押し・並べかえ・フォルダのあいだは、ページの横スワイプを止める */
  onBlockSwipe: (blocked: boolean) => void;
  onGoPage: (page: number) => void;
}) {
  const router = useRouter();
  const hw = useHomeWeather();
  const baseItems = useMemo(() => launcherItems(options), [options]);
  // 並びとフォルダ（前の版で並び順だけを覚えていたら、それを引きつぐ）
  const [layout, setLayout] = useState<StoredEntry[] | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = readLayout();
    if (saved) return saved;
    const order = readList(ORDER_KEY);
    return order ? toStored(applyOrder(launcherItems(options), order)) : null;
  });
  const [hidden, setHidden] = useState<string[]>(() => (typeof window === "undefined" ? [] : readList(HIDDEN_KEY) ?? []));
  const ordered = useMemo(() => buildItems(baseItems, layout), [baseItems, layout]);
  const items = useMemo(() => applyHidden(ordered, new Set(hidden)), [ordered, hidden]);
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(() => (typeof window === "undefined" ? 844 : window.innerHeight));
  const [pressed, setPressed] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [fdrag, setFdrag] = useState<FolderDrag | null>(null);
  const [merge, setMerge] = useState<Merge | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [folder, setFolder] = useState<FolderState | null>(null);
  const [launch, setLaunch] = useState<LaunchState | null>(null);
  const [search, setSearch] = useState(false);
  const [alert, setAlert] = useState<LauncherItem | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [appear, setAppear] = useState<string[]>([]);
  const [screenMenu, setScreenMenu] = useState<{ x: number; y: number } | null>(null);
  const [hiddenSheet, setHiddenSheet] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const press = useRef<Press | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const emptyPress = useRef<{ timer: number; x: number; y: number } | null>(null);
  const removeDown = useRef<string | null>(null);
  const folderPanelRef = useRef<HTMLDivElement>(null);
  // ドラッグは画面全体で受けるので、いちばん新しい値を ref からも読めるようにしておく
  const orderedRef = useRef(ordered);
  const itemsRef = useRef(items);
  const dragRef = useRef(drag);
  const fdragRef = useRef(fdrag);
  const folderRef = useRef(folder);
  folderRef.current = folder;
  const mergeRef = useRef(merge);
  orderedRef.current = ordered;
  itemsRef.current = items;
  dragRef.current = drag;
  fdragRef.current = fdrag;
  mergeRef.current = merge;
  const mergeTimer = useRef(0);
  const reorderTimer = useRef<{ idx: number; timer: number } | null>(null);

  /** 並びとフォルダ（非表示のものもふくめた全部）を覚える */
  const commit = useCallback((full: LauncherItem[]) => {
    const stored = toStored(full);
    orderedRef.current = full;
    setLayout(stored);
    writeList(LAYOUT_KEY, stored as unknown as string[]);
  }, []);

  /** 見えている並びを覚える（非表示のアプリは、いまの並びのうしろに置いておく。再表示すると、いちばんうしろに出る） */
  const saveOrder = useCallback(
    (visible: LauncherItem[]) => {
      const full = orderedRef.current;
      const byId = new Map(full.map((item) => [item.id, item]));
      const shown = new Set(visible.map((item) => item.id));
      commit([...visible.map((item) => byId.get(item.id) ?? item), ...full.filter((item) => !shown.has(item.id))]);
    },
    [commit],
  );

  /** アプリを、ほかのアプリ（→新しいフォルダ）かフォルダに入れる。できたフォルダの id を返す */
  const mergeInto = useCallback(
    (dragId: string, targetId: string): string | null => {
      const full = orderedRef.current;
      const dragged = full.find((item) => item.id === dragId);
      if (!dragged || dragged.kind !== "app") return null;
      let made: string | null = null;
      const next = full.flatMap((item): LauncherItem[] => {
        if (item.id === dragId) return [];
        if (item.id !== targetId) return [item];
        if (item.kind === "folder") return [{ ...item, apps: [...item.apps, dragged] }];
        made = `folder-${Date.now().toString(36)}`;
        return [{ kind: "folder", id: made, name: folderNameFor([item, dragged]), apps: [item, dragged], keywords: [] }];
      });
      commit(next);
      return made;
    },
    [commit],
  );

  /** フォルダからアプリを出す（フォルダのすぐうしろに置く。フォルダがからになったら消す） */
  const takeOut = useCallback(
    (folderId: string, appId: string) => {
      const full = orderedRef.current;
      const at = full.findIndex((item) => item.id === folderId);
      const box = full[at];
      if (!box || box.kind !== "folder") return;
      const app = box.apps.find((a) => a.id === appId);
      if (!app) return;
      const apps = box.apps.filter((a) => a.id !== appId);
      const next = [...full];
      next.splice(at, 1, ...(apps.length ? [{ ...box, apps }] : []), app);
      commit(next);
    },
    [commit],
  );

  /** フォルダの中の並びを覚える（中の非表示のアプリは、うしろに置いておく） */
  const reorderInFolder = useCallback(
    (folderId: string, visibleApps: LauncherApp[]) => {
      commit(orderedRef.current.map((item) => {
        if (item.id !== folderId || item.kind !== "folder") return item;
        const shown = new Set(visibleApps.map((a) => a.id));
        return { ...item, apps: [...visibleApps, ...item.apps.filter((a) => !shown.has(a.id))] };
      }));
    },
    [commit],
  );

  const renameFolder = useCallback(
    (folderId: string, name: string) => {
      const clean = name.trim().slice(0, 20);
      if (!clean) return;
      commit(orderedRef.current.map((item) => (item.id === folderId && item.kind === "folder" ? { ...item, name: clean } : item)));
    },
    [commit],
  );

  const saveHidden = useCallback((next: string[]) => {
    setHidden(next);
    writeList(HIDDEN_KEY, next);
  }, []);

  useEffect(() => {
    const measure = () => {
      setWidth(Math.min(window.innerWidth, 520));
      setHeight(window.innerHeight);
    };
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // ウィジェットからアイコンの最後の段までが、下のナビ（と検索・ページの点）にかからないように、空いている高さをはかる
  const bottomRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState<number | null>(null);
  useLayoutEffect(() => {
    const grid = gridRef.current?.getBoundingClientRect();
    const bottom = bottomRef.current?.getBoundingClientRect();
    if (!grid || !bottom) return;
    const next = Math.floor(bottom.bottom - BOTTOM_STACK - BOTTOM_GAP - grid.top);
    setAvail((cur) => (cur === next ? cur : next));
  }, [width, height]);
  const rows = 2 + Math.ceil(items.length / 4);
  const roomy = geometryFor(width, avail, rows);
  // 小さな画面で、それでも入らないときは「検索」を出さず、そのぶん下まで使う（編集中のボタンは、ページの点の横に小さく）
  const compact = avail != null && (rows - 1) * roomy.rowH + roomy.icon + 20 > avail;
  const g = compact ? geometryFor(width, (avail ?? 0) + 36 + 10, rows) : roomy;
  const blocked = Boolean(menu || folder || search || drag || fdrag || launch || alert || screenMenu || hiddenSheet || weatherOpen);
  useEffect(() => onBlockSwipe(blocked), [blocked, onBlockSwipe]);

  // アプリの画面からはなれたら、編集・メニューなどはおしまい
  useEffect(() => {
    if (page === 1) return;
    setEditing(false);
    setMenu(null);
    setSearch(false);
    setScreenMenu(null);
  }, [page]);

  /* ---------------------------------------------------------- 開く・もどる */

  const open = useCallback(
    (app: LauncherApp, el: Element | null, href = app.href) => {
      if (app.external) {
        // 外のサイト：指をはなしたその場で開く（間をあけると、ブラウザに止められることがある）
        setSearch(false);
        const win = window.open(href, "_blank");
        if (win) win.opener = null;
        else window.location.assign(href);
        return;
      }
      markLaunch(app.id, href);
      router.prefetch(href);
      setLaunch({ app, rect: el ? rectOf(el) : null, grown: false });
      setSearch(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setLaunch((cur) => (cur ? { ...cur, grown: true } : cur))));
      window.setTimeout(() => router.push(href), 380);
      // うまく移れなかったときのために、しばらくしたら元にもどす
      window.setTimeout(() => setLaunch(null), 4000);
    },
    [router],
  );

  // アプリから戻ってきた：画面いっぱいから、アイコン（フォルダの中ならフォルダ）へ吸いこまれる
  const returned = useRef(false);
  useLayoutEffect(() => {
    if (!returnFrom || returned.current) return;
    returned.current = true;
    const app = flattenApps(baseItems).find((a) => a.id === returnFrom);
    if (!app) return;
    const holder = items.find((item) => item.id === app.id || (item.kind === "folder" && item.apps.some((a) => a.id === app.id)));
    const el = holder ? gridRef.current?.querySelector(`[data-id="${holder.id}"] [data-tile]`) : null;
    setLaunch({ app, rect: el ? rectOf(el) : null, grown: true, closing: true });
    requestAnimationFrame(() => requestAnimationFrame(() => setLaunch((cur) => (cur?.closing ? { ...cur, grown: false } : cur))));
    window.setTimeout(() => setLaunch((cur) => (cur?.closing ? { ...cur, fading: true } : cur)), 440);
    window.setTimeout(() => setLaunch((cur) => (cur?.closing ? null : cur)), 600);
  }, [returnFrom, baseItems, items]);

  const openFolder = useCallback((f: LauncherFolder, el: Element, focusName = false) => {
    setFolder({ folder: f, rect: rectOf(el), open: false, focusName });
    requestAnimationFrame(() => requestAnimationFrame(() => setFolder((cur) => (cur ? { ...cur, open: true } : cur))));
  }, []);
  const closeFolder = useCallback(() => {
    setFolder((cur) => (cur ? { ...cur, open: false } : cur));
    window.setTimeout(() => setFolder(null), 420);
  }, []);

  // 開いているフォルダの中身を、非表示に合わせて新しくする（中がからになったら閉じる）
  useEffect(() => {
    if (!folder) return;
    const live = items.find((item) => item.id === folder.folder.id);
    if (!live || live.kind !== "folder") {
      if (folder.open) closeFolder();
      return;
    }
    const sig = (f: LauncherFolder) => `${f.name}|${f.apps.map((a) => a.id).join(",")}`;
    if (sig(live) !== sig(folder.folder)) setFolder((cur) => (cur ? { ...cur, folder: live } : cur));
  }, [items, folder, closeFolder]);

  const openMenu = useCallback((item: LauncherItem, el: Element, folderId?: string) => {
    if ("vibrate" in navigator) navigator.vibrate?.(8);
    setMenu({ item, rect: rectOf(el), open: false, folderId });
    requestAnimationFrame(() => requestAnimationFrame(() => setMenu((cur) => (cur ? { ...cur, open: true } : cur))));
  }, []);
  const closeMenu = useCallback(() => {
    setMenu((cur) => (cur ? { ...cur, open: false } : cur));
    window.setTimeout(() => setMenu(null), 260);
  }, []);

  /* ---------------------------------------------------------- 非表示・再表示 */

  const hideItem = useCallback(
    (item: LauncherItem) => {
      setRemoving(item.id);
      window.setTimeout(() => {
        saveHidden([...hidden.filter((id) => id !== item.id), item.id]);
        setRemoving(null);
      }, 300);
    },
    [hidden, saveHidden],
  );

  const reshow = useCallback(
    (ids: string[]) => {
      saveHidden(hidden.filter((id) => !ids.includes(id)));
      // もどったアプリ（フォルダの中なら、そのフォルダ）を、ぽんと出す
      const tops = ids.map((id) => orderedRef.current.find((item) => item.id === id || (item.kind === "folder" && item.apps.some((a) => a.id === id)))?.id ?? id);
      setAppear(tops);
      window.setTimeout(() => setAppear([]), 700);
    },
    [hidden, saveHidden],
  );

  const hiddenEntries = useMemo<HiddenEntry[]>(() => {
    const all = flattenApps(ordered);
    return hidden.flatMap((id): HiddenEntry[] => {
      const top = ordered.find((item) => item.id === id);
      if (top) return [{ id, name: top.name, tile: <Tile item={top} size={46} /> }];
      const app = all.find((a) => a.id === id);
      if (!app) return [];
      const parent = ordered.find((item) => item.kind === "folder" && item.apps.some((a) => a.id === id));
      return [{ id, name: app.name, folder: parent?.name, tile: <Tile item={app} size={46} /> }];
    });
  }, [hidden, ordered]);

  /* ---------------------------------------------------------- 押す・長押し・並べかえ */

  const startDrag = useCallback(
    (id: string, pointerId: number, clientX: number, clientY: number, at?: { index: number; dx: number; dy: number }) => {
      const grid = gridRef.current;
      const index = at?.index ?? itemsRef.current.findIndex((item) => item.id === id);
      if (!grid || index < 0) return;
      const box = grid.getBoundingClientRect();
      const pos = slotXY(g, index + WIDGET_SLOTS);
      const dx = at?.dx ?? clientX - box.left - pos.x;
      const dy = at?.dy ?? clientY - box.top - pos.y;
      setEditing(true);
      setDrag({ id, pointerId, dx, dy, x: clientX - box.left - dx, y: clientY - box.top - dy });
    },
    [g],
  );

  /** フォルダの中でアイコンを持ち上げる */
  const startFolderDrag = useCallback((id: string, pointerId: number, clientX: number, clientY: number, tile: Element) => {
    const f = folderRef.current;
    if (!f) return;
    const r = tile.getBoundingClientRect();
    setEditing(true);
    setFdrag({ id, folderId: f.folder.id, pointerId, ox: clientX - r.left, oy: clientY - r.top, x: clientX, y: clientY });
  }, []);

  const clearReorder = () => {
    if (reorderTimer.current) window.clearTimeout(reorderTimer.current.timer);
    reorderTimer.current = null;
  };
  const clearMerge = () => {
    window.clearTimeout(mergeTimer.current);
    if (mergeRef.current) setMerge(null);
  };

  // ドラッグ中の指の動き（画面全体で受ける。フォルダの外へ出したアイコンも、そのまま並べかえへ続けられるように）
  const onDragMove = (e: PointerEvent) => {
    const fd = fdragRef.current;
    if (fd && e.pointerId === fd.pointerId) {
      setFdrag({ ...fd, x: e.clientX, y: e.clientY });
      const panel = folderPanelRef.current?.getBoundingClientRect();
      if (!panel) return;
      const out = 16;
      if (e.clientX < panel.left - out || e.clientX > panel.right + out || e.clientY < panel.top - out || e.clientY > panel.bottom + out) {
        // フォルダの外へ出した → フォルダから外して、ホーム画面の並べかえへ
        const list = itemsRef.current;
        const at = list.findIndex((item) => item.id === fd.folderId);
        const box = list[at];
        const remains = box?.kind === "folder" && box.apps.length > 1;
        takeOut(fd.folderId, fd.id);
        closeFolder();
        setFdrag(null);
        startDrag(fd.id, fd.pointerId, e.clientX, e.clientY, { index: remains ? at + 1 : Math.max(0, at), dx: fd.ox + (g.cellW - g.icon) / 2, dy: fd.oy });
        return;
      }
      // フォルダの中での並べかえ
      const box = itemsRef.current.find((item) => item.id === fd.folderId);
      if (!box || box.kind !== "folder") return;
      const geo = folderGeometry(box.apps.length, g, height);
      const cx = e.clientX - fd.ox + g.icon / 2 - (panel.left + geo.inner);
      const cy = e.clientY - fd.oy + g.icon / 2 - (panel.top + geo.inner);
      const col = Math.max(0, Math.min(2, Math.floor(cx / geo.cw)));
      const row = Math.max(0, Math.floor(cy / g.rowH));
      const to = Math.max(0, Math.min(box.apps.length - 1, row * 3 + col));
      const from = box.apps.findIndex((a) => a.id === fd.id);
      if (from >= 0 && to !== from) {
        const next = [...box.apps];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        reorderInFolder(box.id, next);
      }
      return;
    }

    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const grid = gridRef.current?.getBoundingClientRect();
    if (!grid) return;
    const x = e.clientX - grid.left - d.dx;
    const y = e.clientY - grid.top - d.dy;
    setDrag({ ...d, x, y });
    const list = itemsRef.current;
    const from = list.findIndex((item) => item.id === d.id);
    const cx = x + g.cellW / 2, cy = y + g.icon / 2;
    const col = Math.max(0, Math.min(3, Math.floor((cx - g.pad) / g.cellW)));
    const row = Math.max(2, Math.floor(cy / g.rowH));
    const idx = Math.max(0, Math.min(list.length - 1, row * 4 + col - WIDGET_SLOTS));
    const target = list[idx];
    const tp = slotXY(g, idx + WIDGET_SLOTS);
    const near = Math.abs(cx - (tp.x + g.cellW / 2)) < g.icon * 0.36 && Math.abs(cy - (tp.y + g.icon / 2)) < g.icon * 0.38;
    // アイコンのまん中に重ねたら：少し待ってフォルダにする用意（重ねる相手が大きくなる）
    if (target && idx !== from && near && list[from]?.kind === "app") {
      clearReorder();
      if (mergeRef.current?.id !== target.id) {
        window.clearTimeout(mergeTimer.current);
        setMerge({ id: target.id, ready: false });
        mergeTimer.current = window.setTimeout(() => {
          setMerge((m) => (m?.id === target.id ? { ...m, ready: true } : m));
          if ("vibrate" in navigator) navigator.vibrate?.(6);
        }, 280);
      }
      return;
    }
    clearMerge();
    // アイコンのあいだに来たら：少しとまったところで入れかえる（ほかのアイコンはアニメーションでよける）
    if (idx === from) {
      clearReorder();
      return;
    }
    if (reorderTimer.current?.idx === idx) return;
    clearReorder();
    reorderTimer.current = {
      idx,
      timer: window.setTimeout(() => {
        reorderTimer.current = null;
        const now = itemsRef.current;
        const f = now.findIndex((item) => item.id === d.id);
        if (f < 0 || f === idx || idx >= now.length) return;
        const next = [...now];
        const [moved] = next.splice(f, 1);
        next.splice(idx, 0, moved!);
        saveOrder(next);
      }, 260),
    };
  };

  const onDragEnd = (e: PointerEvent) => {
    const fd = fdragRef.current;
    if (fd && e.pointerId === fd.pointerId) {
      setFdrag(null);
      return;
    }
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    clearReorder();
    window.clearTimeout(mergeTimer.current);
    const m = mergeRef.current;
    setMerge(null);
    setDrag(null);
    if (!m?.ready) return;
    const made = mergeInto(d.id, m.id);
    if (!made) return;
    // 新しくできたフォルダを開く（名前をすぐ変えられるように）
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const box = itemsRef.current.find((item) => item.id === made);
      const el = gridRef.current?.querySelector(`[data-id="${made}"] [data-tile]`);
      if (box?.kind === "folder" && el) openFolder(box, el);
    }));
  };

  const dragHandlers = useRef({ move: onDragMove, end: onDragEnd });
  dragHandlers.current = { move: onDragMove, end: onDragEnd };
  const anyDrag = Boolean(drag || fdrag);
  useEffect(() => {
    if (!anyDrag) return;
    const move = (e: PointerEvent) => dragHandlers.current.move(e);
    const end = (e: PointerEvent) => dragHandlers.current.end(e);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [anyDrag]);

  const onCellDown = (event: ReactPointerEvent, item: LauncherItem, inFolder = false) => {
    event.stopPropagation();
    if (event.button !== 0 || launch || removing) return;
    const el = event.currentTarget;
    if (editing) {
      // 編集中：指を動かしたら持ち上げて並べかえ、動かさずにはなしたらフォルダを開く
      (el as Element).setPointerCapture?.(event.pointerId);
      press.current = { id: item.id, pointerId: event.pointerId, x0: event.clientX, y0: event.clientY, timer: 0, long: false, moved: false, inFolder, editing: true };
      return;
    }
    if (item.kind === "app" && !item.external) router.prefetch(item.href);
    setPressed(item.id);
    const timer = window.setTimeout(() => {
      if (!press.current || press.current.moved) return;
      press.current.long = true;
      setPressed(null);
      openMenu(item, el.querySelector("[data-tile]") ?? el, inFolder ? folderRef.current?.folder.id : undefined);
    }, 460);
    press.current = { id: item.id, pointerId: event.pointerId, x0: event.clientX, y0: event.clientY, timer, long: false, moved: false, inFolder, editing: false };
  };

  const onCellMove = (event: ReactPointerEvent) => {
    const p = press.current;
    if (!p || event.pointerId !== p.pointerId) return;
    const dist = Math.hypot(event.clientX - p.x0, event.clientY - p.y0);
    const lift = () => {
      press.current = null;
      const tile = (event.currentTarget as Element).querySelector("[data-tile]") ?? event.currentTarget;
      if (p.inFolder) startFolderDrag(p.id, event.pointerId, event.clientX, event.clientY, tile);
      else startDrag(p.id, event.pointerId, event.clientX, event.clientY);
    };
    if (p.editing) {
      if (!p.moved && dist > 6) {
        p.moved = true;
        lift();
      }
      return;
    }
    if (p.long && menu && dist > 12) {
      // メニューが出たまま指を動かしたら、そのまま並べかえへ
      setMenu(null);
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      lift();
      return;
    }
    if (!p.long && dist > 8) {
      p.moved = true;
      window.clearTimeout(p.timer);
      setPressed(null);
    }
  };

  const onCellUp = (event: ReactPointerEvent, item: LauncherItem) => {
    if (dragRef.current || fdragRef.current) return;
    const p = press.current;
    press.current = null;
    setPressed(null);
    if (!p || p.pointerId !== event.pointerId) return;
    window.clearTimeout(p.timer);
    if (p.long || p.moved) return;
    const el = (event.currentTarget as Element).querySelector("[data-tile]") ?? event.currentTarget;
    if (item.kind === "folder") openFolder(item, el);
    else if (!p.editing) open(item, el);
  };

  const onCellCancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setPressed(null);
  };

  // 何もないところを長押し → メニュー（編集・非表示のアプリを再表示）。編集中に何もないところをタップ → 完了
  const openScreenMenu = useCallback((x: number, y: number) => {
    if ("vibrate" in navigator) navigator.vibrate?.(8);
    setScreenMenu({ x, y });
  }, []);
  const onEmptyDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    if (editing) {
      setEditing(false);
      return;
    }
    const x = event.clientX, y = event.clientY;
    const timer = window.setTimeout(() => {
      emptyPress.current = null;
      openScreenMenu(x, y);
    }, 520);
    emptyPress.current = { timer, x, y };
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

  const cell = (item: LauncherItem, slot: number, opts: CellOpts = {}) => {
    const dragging = drag?.id === item.id && !opts.inFolder;
    const badge = item.kind === "app" && item.badge === "notices" && data.unreadNotices > 0 ? data.unreadNotices : 0;
    const jiggling = editing && !opts.plain;
    const size = opts.plain ? Math.min(g.icon, 60) : g.icon;
    const cellWidth = typeof opts.style?.width === "number" ? opts.style.width : g.cellW;
    return (
      <div
        key={item.id}
        data-id={item.id}
        className={styles.cell}
        style={{
          ...(opts.style ?? cellStyle(slot, dragging && drag ? { x: drag.x, y: drag.y } : undefined)),
          // ぷるぷるの始まりを1つずつずらす（みんな同じ動きにならないように）
          "--jd": `${-((slot * 0.173) % 0.3).toFixed(3)}s`,
        } as CSSProperties}
        data-pressed={pressed === item.id ? "true" : undefined}
        data-editing={jiggling ? "true" : undefined}
        data-odd={slot % 2 ? "true" : undefined}
        data-dragging={dragging ? "true" : undefined}
        data-removing={removing === item.id ? "true" : undefined}
        data-appear={appear.includes(item.id) ? "true" : undefined}
        data-hidden={(launch?.app.id === item.id && !launch.fading) || menu?.item.id === item.id || (opts.inFolder && fdrag?.id === item.id) ? "true" : undefined}
        data-merge={merge?.id === item.id && !opts.inFolder ? (merge.ready ? "ready" : "near") : undefined}
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
          else if (!editing) open(item, el);
        }}
      >
        <span className={styles.press} data-tile="">
          {merge?.id === item.id && merge.ready && !opts.inFolder ? <span className={`${styles.mergeHalo} ${styles.squircle}`} aria-hidden="true" /> : null}
          <Tile item={item} size={size} />
          {badge && !jiggling ? <span className={styles.badge}>{badge > 99 ? "99+" : badge}</span> : null}
          {jiggling && !dragging ? (
            <button
              type="button"
              className={styles.remove}
              aria-label={`${item.name}を非表示にする`}
              onPointerDown={(e) => {
                // 指の位置が × から離れていたら（ブラウザが近くのボタンへ寄せたとき）、アイコンを押したことにする
                const r = e.currentTarget.getBoundingClientRect();
                if (e.clientX < r.left - 10 || e.clientX > r.right + 10 || e.clientY < r.top - 10 || e.clientY > r.bottom + 10) {
                  removeDown.current = null;
                  return;
                }
                e.stopPropagation();
                removeDown.current = item.id;
              }}
              onPointerUp={(e) => {
                if (removeDown.current === item.id) e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                // × の上で押しはじめたときだけ（フォルダを開いた直後のクリックなどで出ないように）
                if (e.detail !== 0 && removeDown.current !== item.id) return;
                removeDown.current = null;
                setAlert(item);
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          ) : null}
        </span>
        <span className={styles.label} style={{ width: cellWidth - 4 }}>{item.name}</span>
      </div>
    );
  };

  // ウィジェット（2×2 マスを2つ）
  const widgetW = g.cellW + g.icon;
  const widgetH = g.rowH + g.icon - 4;
  const leftX = g.pad + (g.cellW - g.icon) / 2;
  const rightX = g.pad + g.cellW * 2 + (g.cellW - g.icon) / 2;
  // 小さな画面で段をつめたときは、文字がきゅうくつにならないよう、ウィジェットをまるごと縮める（中の並びはいつもの大きさのまま）
  const wk = Math.min(1, widgetH / 154);
  const widgetBox = (left: number): CSSProperties => (wk < 1 ? { left: left / wk, top: 0, width: widgetW / wk, height: widgetH / wk, zoom: wk } : { left, top: 0, width: widgetW, height: widgetH });

  return (
    <div className={styles.grid} style={ROOT_VARS}>
      <div className={styles.scrim} />
      <div
        ref={gridRef}
        className={styles.grid}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 24px)", left: `max(0px, calc((100vw - ${width}px) / 2))`, width }}
        onPointerDown={onEmptyDown}
        onPointerMove={onEmptyMove}
        onPointerUp={onEmptyUp}
        onPointerCancel={onEmptyUp}
      >
        <ClockWeatherWidget
          hw={hw}
          editing={editing}
          style={{ ...widgetBox(leftX), "--jd": "-0.11s" } as CSSProperties}
          onOpen={() => (hw ? setWeatherOpen(true) : null)}
          onLong={openScreenMenu}
        />
        <StepsWidget
          steps={data.steps}
          editing={editing}
          style={{ ...widgetBox(rightX), "--jd": "-0.04s" } as CSSProperties}
          onOpen={() => {
            markLaunch("steps", "/mypage/exp-history");
            router.push("/mypage/exp-history");
          }}
          onLong={openScreenMenu}
        />

        {items.map((item, index) => cell(item, index + WIDGET_SLOTS))}
      </div>

      {/* 検索（編集中は「再表示」「完了」）とページの点 */}
      <div ref={bottomRef} className={styles.bottom} style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 12px)" }}>
        {compact && !editing ? null : editing ? (
          <div className={styles.editBar} data-compact={compact ? "true" : undefined}>
            {hidden.length ? (
              <button type="button" className={styles.glassPill} onClick={() => setHiddenSheet(true)}>
                <EyeGlyph size={16} />
                再表示
                <small>{hidden.length}</small>
              </button>
            ) : null}
            <button type="button" className={styles.glassPill} data-strong="true" onClick={() => setEditing(false)}>
              完了
            </button>
          </div>
        ) : (
          <button type="button" className={styles.search} onClick={() => setSearch(true)}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            検索
          </button>
        )}
        <div className={styles.dots} role="tablist" aria-label="ページ" style={{ pointerEvents: "auto" }}>
          {Array.from({ length: pageCount }, (_, i) => (
            <button key={i} type="button" role="tab" aria-selected={page === i} aria-label={i === 0 ? "ホーム" : i === 1 ? "アプリ" : "背景"} className={styles.dot} data-on={page === i} onClick={() => onGoPage(i)} style={{ border: 0, padding: 0 }} />
          ))}
        </div>
      </div>

      {folder ? (
        <FolderView
          state={folder}
          g={g}
          height={height}
          editing={editing}
          cell={cell}
          panelRef={folderPanelRef}
          drag={fdrag}
          onClose={closeFolder}
          onRename={(name) => renameFolder(folder.folder.id, name)}
        />
      ) : null}
      {menu ? (
        <ContextMenu
          state={menu}
          g={g}
          onClose={closeMenu}
          onEdit={() => { closeMenu(); setEditing(true); }}
          onHide={() => { const m = menu; closeMenu(); window.setTimeout(() => setAlert(m.item), 200); }}
          onOpen={(href) => { const m = menu; closeMenu(); if (m.item.kind === "app") open(m.item, null, href); }}
          onOpenFolderApp={(app) => { closeMenu(); open(app, null); }}
          onTakeOut={menu.folderId ? () => { const m = menu; closeMenu(); takeOut(m.folderId!, m.item.id); } : undefined}
          onRename={menu.item.kind === "folder" ? () => {
            const m = menu;
            closeMenu();
            const el = gridRef.current?.querySelector(`[data-id="${m.item.id}"] [data-tile]`);
            if (m.item.kind === "folder" && el) { setEditing(true); openFolder(m.item, el, true); }
          } : undefined}
        />
      ) : null}
      {search ? <Spotlight items={items} cell={cell} onClose={() => setSearch(false)} onOpen={(app) => { setSearch(false); open(app, null); }} /> : null}
      {alert ? (
        <HideAlert
          name={alert.name}
          isFolder={alert.kind === "folder"}
          icon={<Tile item={alert} size={58} />}
          rootStyle={ROOT_VARS}
          onCancel={() => setAlert(null)}
          onHide={() => { const target = alert; setAlert(null); hideItem(target); }}
        />
      ) : null}
      {screenMenu ? (
        <ScreenMenu
          x={screenMenu.x}
          y={screenMenu.y}
          hiddenCount={hidden.length}
          rootStyle={ROOT_VARS}
          onClose={() => setScreenMenu(null)}
          onEdit={() => { setScreenMenu(null); setEditing(true); }}
          onReshow={() => { setScreenMenu(null); setHiddenSheet(true); }}
        />
      ) : null}
      {hiddenSheet ? (
        <HiddenSheet
          entries={hiddenEntries}
          rootStyle={ROOT_VARS}
          onClose={() => setHiddenSheet(false)}
          onReshow={(id) => reshow([id])}
          onReshowAll={() => reshow([...hidden])}
        />
      ) : null}
      {weatherOpen && hw ? <WeatherSheet hw={hw} onClose={() => setWeatherOpen(false)} /> : null}
      {launch ? <LaunchView state={launch} size={g.icon} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ フォルダ */

function FolderView({ state, g, height, editing, cell, panelRef, drag, onClose, onRename }: {
  state: FolderState;
  g: Geometry;
  height: number;
  editing: boolean;
  cell: (item: LauncherItem, slot: number, opts?: CellOpts) => ReactNode;
  panelRef: React.RefObject<HTMLDivElement | null>;
  drag: FolderDrag | null;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const { folder, rect, open } = state;
  const { pw, ph, inner, cw, x, y } = folderGeometry(folder.apps.length, g, height);
  const from = `translate(${rect.left - x}px, ${rect.top - y}px) scale(${rect.width / pw}, ${rect.height / ph})`;
  const dragged = drag ? folder.apps.find((a) => a.id === drag.id) : undefined;
  return createPortal(
    <div className={styles.veil} data-open={open} onPointerDown={(e) => e.target === e.currentTarget && onClose()} style={ROOT_VARS}>
      <div className={styles.folderTitle} style={{ top: y - 62, opacity: open ? 1 : 0, transform: open ? "none" : "scale(0.85)" }}>
        {editing ? <FolderName name={folder.name} focus={Boolean(state.focusName && open)} onRename={onRename} /> : folder.name}
      </div>
      <div ref={panelRef} className={styles.folderPanel} style={{ left: x, top: y, width: pw, height: ph, transform: open ? "none" : from, borderRadius: open ? 38 : 16 }}>
        <div style={{ position: "absolute", inset: inner, opacity: open ? 1 : 0, transition: "opacity .25s" }}>
          {folder.apps.map((app, i) =>
            cell(app, i, { inFolder: true, style: { width: cw, transform: `translate3d(${(i % 3) * cw}px, ${Math.floor(i / 3) * g.rowH}px, 0)` } }),
          )}
        </div>
      </div>
      {editing ? (
        <p className={styles.folderHint} style={{ top: y + ph + 18, opacity: open && !drag ? 1 : 0 }}>
          フォルダの外へドラッグすると、フォルダから外せます
        </p>
      ) : null}
      {drag && dragged ? (
        <div className={styles.floatTile} style={{ left: drag.x - drag.ox, top: drag.y - drag.oy }}>
          <Tile item={dragged} size={g.icon} />
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

/** 編集中のフォルダの名前（タップして書きかえられる） */
function FolderName({ name, focus, onRename }: { name: string; focus: boolean; onRename: (name: string) => void }) {
  const [value, setValue] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setValue(name), [name]);
  useEffect(() => {
    if (focus) ref.current?.select();
  }, [focus]);
  const save = () => {
    if (value.trim() && value.trim() !== name) onRename(value);
    else setValue(name);
  };
  return (
    <span className={styles.folderNameField} onPointerDown={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        value={value}
        maxLength={20}
        aria-label="フォルダの名前"
        enterKeyHint="done"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setValue(name); (e.target as HTMLInputElement).blur(); }
        }}
      />
      {value ? (
        <button type="button" aria-label="名前を消す" onPointerDown={(e) => e.preventDefault()} onClick={() => { setValue(""); ref.current?.focus(); }}>
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ 長押しのメニュー */

function ContextMenu({ state, g, onClose, onEdit, onHide, onOpen, onOpenFolderApp, onTakeOut, onRename }: {
  state: MenuState;
  g: Geometry;
  onClose: () => void;
  onEdit: () => void;
  onHide: () => void;
  onOpen: (href: string) => void;
  onOpenFolderApp: (app: LauncherApp) => void;
  /** フォルダの中のアプリのとき */
  onTakeOut?: () => void;
  /** フォルダのとき */
  onRename?: () => void;
}) {
  const { item, rect, open } = state;
  const vw = window.innerWidth, vh = window.innerHeight;
  const rows = (item.kind === "folder" ? item.apps.length : (item.shortcuts?.length ?? 1)) + (onTakeOut || onRename ? 1 : 0);
  const menuH = rows * 46 + 8 + 92;
  const below = rect.top + rect.height + 14 + menuH < vh - 20;
  const left = Math.max(12, Math.min(vw - 252, rect.left + rect.width / 2 - 120));
  const top = below ? rect.top + rect.height + 14 : Math.max(12, rect.top - 14 - menuH);
  const originX = rect.left + rect.width / 2 - left;
  return createPortal(
    <div className={styles.veil} data-open={open} onPointerDown={(e) => e.target === e.currentTarget && onClose()} style={ROOT_VARS}>
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
                <AppIcon app={app} size={24} />
              </button>
            ))
          : (item.shortcuts ?? [{ label: "開く", href: item.href }]).map((s) => (
              <button key={s.label} type="button" role="menuitem" onClick={() => onOpen(s.href)}>
                {s.label}
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ))}
        <div className={styles.menuGap} />
        {onRename ? (
          <button type="button" role="menuitem" onClick={onRename}>
            名前を変更
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 13.5V15h1.5l8.6-8.6-1.5-1.5L3 13.5Zm11.8-8.1a1 1 0 0 0 0-1.4l-.8-.8a1 1 0 0 0-1.4 0l-.9.9 1.5 1.5.9-.9Z" fill="currentColor" /></svg>
          </button>
        ) : null}
        {onTakeOut ? (
          <button type="button" role="menuitem" onClick={onTakeOut}>
            フォルダから外す
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="2" y="5" width="9" height="9" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M9 9l6.5-6.5M11 2.5h4.5V7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        ) : null}
        <button type="button" role="menuitem" onClick={onEdit}>
          ホーム画面を編集
          <EditGlyph />
        </button>
        <button type="button" role="menuitem" className={styles.destructive} onClick={onHide}>
          {item.kind === "folder" ? "フォルダを非表示" : "アプリを非表示"}
          <EyeGlyph slash />
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
  cell: (item: LauncherItem, slot: number, opts?: CellOpts) => ReactNode;
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
    <div className={styles.veil} data-open={open} onPointerDown={(e) => e.target === e.currentTarget && close()} style={ROOT_VARS}>
      <div className={styles.spot} style={{ top: "calc(env(safe-area-inset-top, 0px) + 14px)", opacity: open ? 1 : 0, transform: open ? "none" : "translateY(24px)", maxWidth: 520, margin: "0 auto" }}>
        <div className={styles.spotField}>
          <label className={styles.spotInput}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="#8a8580" strokeWidth="2" /><path d="M11 11l3.5 3.5" stroke="#8a8580" strokeWidth="2" strokeLinecap="round" /></svg>
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
                    <Tile item={app} size={38} />
                    {app.name}
                    {folderOf(app) ? <small>{folderOf(app)}</small> : null}
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.spotEmpty}>「{q}」は見つかりませんでした</p>
            )}
          </>
        ) : (
          <>
            <p className={styles.spotSection}>よく使うアプリ</p>
            <div className={styles.spotGrid}>
              {apps.slice(0, 8).map((app, i) => cell(app, i, { inFolder: true, plain: true, style: { width: cw, position: "relative", transform: "none" } }))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ 開くとき・もどるときの動き */

function LaunchView({ state, size }: { state: LaunchState; size: number }) {
  const { app, grown, fading } = state;
  const vw = window.innerWidth, vh = window.innerHeight;
  const rect = state.rect ?? { left: vw / 2 - size / 2, top: vh / 2 - size / 2, width: size, height: size };
  const style: CSSProperties = grown
    ? { left: 0, top: 0, width: vw, height: vh, borderRadius: 0 }
    : { left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: rect.width * 0.225 };
  return createPortal(
    <div className={styles.launch} data-grown={grown ? "true" : undefined} data-closing={state.closing ? "true" : undefined} style={{ ...style, opacity: fading ? 0 : 1 }} aria-hidden="true">
      <Image
        className={styles.launchIcon}
        src={iconSrc(app.id)}
        alt=""
        width={384}
        height={384}
        sizes={`${Math.round(size)}px`}
        loading="eager"
        draggable={false}
      />
    </div>,
    document.body,
  );
}
