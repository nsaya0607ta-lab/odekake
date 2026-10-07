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
import { applyHidden, applyOrder, flattenApps, HIDDEN_KEY, iconSrc, launcherItems, ORDER_KEY, type LauncherApp, type LauncherFolder, type LauncherItem, type LauncherOptions } from "./apps";
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

function geometryFor(width: number): Geometry {
  const pad = Math.max(14, Math.round(width * 0.045));
  const cellW = (width - pad * 2) / 4;
  const icon = Math.min(66, Math.round(cellW * 0.72));
  return { pad, cellW, icon, rowH: icon + 33, width };
}

/** ウィジェットが上の2段（8マス）を使うので、アプリは9マス目から */
const WIDGET_SLOTS = 8;
const slotXY = (g: Geometry, slot: number) => ({ x: g.pad + (slot % 4) * g.cellW, y: Math.floor(slot / 4) * g.rowH });

const initialWidth = () => (typeof window === "undefined" ? 390 : Math.min(window.innerWidth, 520));

/* ------------------------------------------------------------------ 本体 */

type Press = { id: string; pointerId: number; x0: number; y0: number; timer: number; long: boolean; moved: boolean; inFolder: boolean; editing: boolean };
type Drag = { id: string; pointerId: number; dx: number; dy: number; x: number; y: number };
type MenuState = { item: LauncherItem; rect: Rect; open: boolean };
type FolderState = { folder: LauncherFolder; rect: Rect; open: boolean };
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
  const [order, setOrder] = useState<string[] | null>(() => (typeof window === "undefined" ? null : readList(ORDER_KEY)));
  const [hidden, setHidden] = useState<string[]>(() => (typeof window === "undefined" ? [] : readList(HIDDEN_KEY) ?? []));
  const ordered = useMemo(() => applyOrder(baseItems, order), [baseItems, order]);
  const items = useMemo(() => applyHidden(ordered, new Set(hidden)), [ordered, hidden]);
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(() => (typeof window === "undefined" ? 844 : window.innerHeight));
  const [pressed, setPressed] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
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

  const saveOrder = useCallback(
    (next: LauncherItem[]) => {
      // 非表示のアプリは、いまの並びのうしろに覚えておく（再表示すると、いちばんうしろに出る）
      const shown = next.map((item) => item.id);
      const ids = [...shown, ...ordered.map((item) => item.id).filter((id) => !shown.includes(id))];
      setOrder(ids);
      writeList(ORDER_KEY, ids);
    },
    [ordered],
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

  const g = geometryFor(width);
  const blocked = Boolean(menu || folder || search || drag || launch || alert || screenMenu || hiddenSheet || weatherOpen);
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

  const openFolder = useCallback((f: LauncherFolder, el: Element) => {
    setFolder({ folder: f, rect: rectOf(el), open: false });
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
    if (live.apps.length !== folder.folder.apps.length) setFolder((cur) => (cur ? { ...cur, folder: live } : cur));
  }, [items, folder, closeFolder]);

  const openMenu = useCallback((item: LauncherItem, el: Element) => {
    if ("vibrate" in navigator) navigator.vibrate?.(8);
    setMenu({ item, rect: rectOf(el), open: false });
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
      const tops = ids.map((id) => baseItems.find((item) => item.id === id || (item.kind === "folder" && item.apps.some((a) => a.id === id)))?.id ?? id);
      setAppear(tops);
      window.setTimeout(() => setAppear([]), 700);
    },
    [hidden, saveHidden, baseItems],
  );

  const hiddenEntries = useMemo<HiddenEntry[]>(() => {
    const all = flattenApps(baseItems);
    return hidden.flatMap((id): HiddenEntry[] => {
      const top = baseItems.find((item) => item.id === id);
      if (top) return [{ id, name: top.name, tile: <Tile item={top} size={46} /> }];
      const app = all.find((a) => a.id === id);
      if (!app) return [];
      const parent = baseItems.find((item) => item.kind === "folder" && item.apps.some((a) => a.id === id));
      return [{ id, name: app.name, folder: parent?.name, tile: <Tile item={app} size={46} /> }];
    });
  }, [hidden, baseItems]);

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
    event.stopPropagation();
    if (event.button !== 0 || launch || removing) return;
    const el = event.currentTarget;
    if (editing) {
      // 編集中：指を動かしたら持ち上げて並べかえ、動かさずにはなしたらフォルダを開く
      (el as Element).setPointerCapture?.(event.pointerId);
      press.current = { id: item.id, pointerId: event.pointerId, x0: event.clientX, y0: event.clientY, timer: 0, long: false, moved: false, inFolder, editing: true };
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
    press.current = { id: item.id, pointerId: event.pointerId, x0: event.clientX, y0: event.clientY, timer, long: false, moved: false, inFolder, editing: false };
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
    if (p.editing) {
      if (!p.moved && dist > 6 && !p.inFolder) {
        p.moved = true;
        press.current = null;
        startDrag(p.id, event.pointerId, event.clientX, event.clientY);
      }
      return;
    }
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
    if (p.long || p.moved) return;
    const el = (event.currentTarget as Element).querySelector("[data-tile]") ?? event.currentTarget;
    if (item.kind === "folder") openFolder(item, el);
    else if (!p.editing) open(item, el);
  };

  const onCellCancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setPressed(null);
    setDrag(null);
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
        data-hidden={(launch?.app.id === item.id && !launch.fading) || (menu?.item.id === item.id && !opts.inFolder) ? "true" : undefined}
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
          style={{ left: leftX, top: 0, width: widgetW, height: widgetH, "--jd": "-0.11s" } as CSSProperties}
          onOpen={() => (hw ? setWeatherOpen(true) : null)}
          onLong={openScreenMenu}
        />
        <StepsWidget
          steps={data.steps}
          editing={editing}
          style={{ left: rightX, top: 0, width: widgetW, height: widgetH, "--jd": "-0.04s" } as CSSProperties}
          onOpen={() => {
            markLaunch("steps", "/mypage/exp-history");
            router.push("/mypage/exp-history");
          }}
          onLong={openScreenMenu}
        />

        {items.map((item, index) => cell(item, index + WIDGET_SLOTS))}
      </div>

      {/* 検索（編集中は「再表示」「完了」）とページの点 */}
      <div className={styles.bottom} style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 12px)" }}>
        {editing ? (
          <div className={styles.editBar}>
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

      {folder ? <FolderView state={folder} g={g} height={height} editing={editing} cell={cell} onClose={closeFolder} /> : null}
      {menu ? (
        <ContextMenu
          state={menu}
          g={g}
          onClose={closeMenu}
          onEdit={() => { closeMenu(); setEditing(true); }}
          onHide={() => { const m = menu; closeMenu(); window.setTimeout(() => setAlert(m.item), 200); }}
          onOpen={(href) => { const m = menu; closeMenu(); if (m.item.kind === "app") open(m.item, null, href); }}
          onOpenFolderApp={(app) => { closeMenu(); open(app, null); }}
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

function FolderView({ state, g, height, editing, cell, onClose }: {
  state: FolderState;
  g: Geometry;
  height: number;
  editing: boolean;
  cell: (item: LauncherItem, slot: number, opts?: CellOpts) => ReactNode;
  onClose: () => void;
}) {
  const { folder, rect, open } = state;
  const vw = window.innerWidth;
  const pw = Math.min(vw - 52, 330);
  const inner = 20;
  const cw = (pw - inner * 2) / 3;
  const rows = Math.max(1, Math.ceil(folder.apps.length / 3));
  const ph = inner * 2 + rows * g.rowH - 6;
  const x = (vw - pw) / 2;
  const y = Math.max(120, height * 0.46 - ph / 2);
  const from = `translate(${rect.left - x}px, ${rect.top - y}px) scale(${rect.width / pw}, ${rect.height / ph})`;
  return createPortal(
    <div className={styles.veil} data-open={open} onPointerDown={(e) => e.target === e.currentTarget && onClose()} style={ROOT_VARS}>
      <div className={styles.folderTitle} style={{ top: y - 58, opacity: open ? 1 : 0, transform: open ? "none" : "scale(0.85)" }}>{folder.name}</div>
      <div className={styles.folderPanel} style={{ left: x, top: y, width: pw, height: ph, transform: open ? "none" : from, borderRadius: open ? 38 : 16 }}>
        <div style={{ position: "absolute", inset: inner, opacity: open ? 1 : 0, transition: "opacity .25s" }}>
          {folder.apps.map((app, i) =>
            cell(app, i, { inFolder: true, style: { width: cw, transform: `translate3d(${(i % 3) * cw}px, ${Math.floor(i / 3) * g.rowH}px, 0)` } }),
          )}
        </div>
      </div>
      {editing ? <p className={styles.folderHint} style={{ top: y + ph + 18, opacity: open ? 1 : 0 }}>× を押すと、そのアプリだけ非表示にできます</p> : null}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ 長押しのメニュー */

function ContextMenu({ state, g, onClose, onEdit, onHide, onOpen, onOpenFolderApp }: {
  state: MenuState;
  g: Geometry;
  onClose: () => void;
  onEdit: () => void;
  onHide: () => void;
  onOpen: (href: string) => void;
  onOpenFolderApp: (app: LauncherApp) => void;
}) {
  const { item, rect, open } = state;
  const vw = window.innerWidth, vh = window.innerHeight;
  const rows = item.kind === "folder" ? item.apps.length : (item.shortcuts?.length ?? 1);
  const menuH = rows * 44 + 8 + 88;
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
