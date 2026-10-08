"use client";

/**
 * 盤面。canvas（線・光る点・効果）の上に、パーツのタイルと利用者を DOM で重ねる。
 * シミュレーターは、この部品の requestAnimationFrame で進める（本番中だけ）。
 * タイルの数字やランプは React を通さず、毎こま直接書きかえる（なめらかに動かすため）。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Glyph } from "./glyphs";
import { computeLayout, computeWires, expandWires, type Link } from "./layout";
import { PARTS, USER_COUNT, kindOf, partSize, slotLabel, yen, type NodeId, type Placement } from "./model";
import { BoardRenderer } from "./render";
import type { InfraSim, SimNode } from "./sim";
import styles from "./infra.module.css";

type Props = {
  /** 盤面に出すマス（ラボでは、置いてあるパーツそのもの） */
  slots: readonly NodeId[];
  placements: readonly Placement[];
  /** つなぎ方（ラボ）。省くと、置いたパーツからふつうのつなぎ方を決める（ステージ） */
  links?: readonly Link[];
  fixed: ReadonlySet<NodeId>;
  sim: InfraSim | null;
  paused: boolean;
  speed: number;
  /** 攻撃のロボットを出す */
  bot: boolean;
  /** 遠くの町の利用者の人数 */
  farUsers: number;
  /** 光らせるマス（ヒント） */
  hint?: ReadonlySet<NodeId>;
  selected?: NodeId | null;
  onSlot: (slot: NodeId) => void;
  /** 線をつなぐモード（ラボ）：利用者の列もタップできる。usersSelected なら利用者の列を光らせる */
  onUsers?: () => void;
  usersSelected?: boolean;
  /** パーツの行を並べる高さの範囲（ラボ。盤面が縦に長いとき） */
  rowRange?: { top: number; bottom: number };
  /** 1秒に8回ほど呼ぶ（成績の表示・お知らせ用） */
  onTick?: (sim: InfraSim) => void;
};

type TileRefs = { root: HTMLElement; ring: SVGCircleElement | null; stat: HTMLElement | null; circ: number };
type Cache = { load: number; stat: string; state: string; role: string };

function statText(sim: InfraSim, node: SimNode): string {
  if (node.down) return node.downKind === "restart" ? "再起動中" : "停止中";
  switch (node.kind) {
    case "app":
      if (node.asleep) return "おやすみ中";
      if (node.bootUntil > sim.now) return "起動中…";
      if (node.draining) return "片づけ中";
      return `${node.slowUntil > sim.now ? "不調 " : ""}${node.busy.length}/${node.cap}${node.wait.length ? `・待${node.wait.length}` : ""}`;
    case "worker":
    case "region":
      return `${node.busy.length}/${node.cap}${node.wait.length ? `・待${node.wait.length}` : ""}`;
    case "cache":
    case "cdn":
      return `ヒット ${Math.round(sim.hitRate(node) * 100)}%`;
    case "db":
    case "replica":
      if (node.lost) return sim.restoreAt < Infinity ? "復元中…" : "データ消失";
      return `${node.busy.length}/${node.cap}${node.wait.length ? `・待${node.wait.length}` : ""}`;
    case "queue":
      return `${node.jobs.length}件`;
    case "waf":
      return `防いだ ${node.blocked}`;
    case "dns":
      return `${node.served}回`;
    case "lb":
      return `${node.served}件`;
    case "auto": {
      const apps = sim.apps();
      return `動いている ${apps.filter((a) => !a.asleep).length}/${apps.length}台`;
    }
    case "monitor":
      return node.served ? `アラート ${node.served}回` : "見張り中";
    case "backup":
      return sim.restoreAt < Infinity ? "復元中…" : `保存 ${node.served}回`;
  }
}

/** タイルの見た目の状態（infra.module.css の data-state） */
function tileState(sim: InfraSim, node: SimNode): string {
  if (node.down) return node.downKind === "restart" ? "restart" : "down";
  if (node.lost) return "lost";
  if (node.asleep) return "sleep";
  if (node.bootUntil > sim.now) return "boot";
  if (node.slowUntil > sim.now) return "slow";
  const hot = node.qmax > 0 && node.wait.length >= Math.max(2, Math.ceil(node.qmax * 0.45));
  return hot ? "hot" : node.busy.length ? "busy" : "";
}

export function Board({ slots, placements, links, fixed, sim, paused, speed, bot, farUsers, hint, selected, onSlot, onUsers, usersSelected, rowRange, onTick }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const tiles = useRef(new Map<NodeId, TileRefs>());
  const users = useRef<(HTMLElement | null)[]>([]);
  const botRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, Cache>());

  const rangeTop = rowRange?.top, rangeBottom = rowRange?.bottom;
  const layout = useMemo(
    () => computeLayout(slots, { bot, farUsers, range: rangeTop != null && rangeBottom != null ? { top: rangeTop, bottom: rangeBottom } : undefined }),
    [slots, bot, farUsers, rangeTop, rangeBottom],
  );
  const placed = useMemo(() => new Set(placements.map((p) => p.slot)), [placements]);
  const wires = useMemo(() => (links ? expandWires(links) : computeWires(placed)), [links, placed]);
  const tile = Math.round(Math.max(40, Math.min(58, size.w * 0.135, size.h * 0.1)));
  // 段と段のあいだがせまい（小さい画面）ときは、タイルの下の数字の行を出さない（下の段のタイルに重なるので）
  const compact = useMemo(() => {
    const ys = [...new Set(slots.map((s) => layout.pos.get(s)?.y ?? 0))].sort((a, b) => a - b);
    let gap = Infinity;
    // DNS・予備の拠点は、同じ段で少しだけ上にずらしてあるので、そのくらいの差は数えない
    for (let i = 1; i < ys.length; i++) if ((ys[i]! - ys[i - 1]!) * size.h > 40) gap = Math.min(gap, (ys[i]! - ys[i - 1]!) * size.h);
    return gap < tile + 38;
  }, [slots, layout, size.h, tile]);

  // 最新の値は ref からも読む（毎こまの処理で使う）
  const live = useRef({ sim, paused, speed, onTick, links });
  live.current = { sim, paused, speed, onTick, links };

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const r = box.getBoundingClientRect();
      setSize((cur) => (Math.abs(cur.w - r.width) < 0.5 && Math.abs(cur.h - r.height) < 0.5 ? cur : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!backRef.current || !frontRef.current) return;
    const r = new BoardRenderer(backRef.current, frontRef.current);
    r.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    rendererRef.current = r;
    return () => {
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !size.w) return;
    r.resize(size.w, size.h, Math.min(2, window.devicePixelRatio || 1), tile, compact);
    r.setLayout(layout, wires);
    r.draw(live.current.sim, 0);
  }, [size, tile, compact, layout, wires]);

  useEffect(() => {
    rendererRef.current?.clearFx();
    cache.current.clear();
  }, [sim]);

  /** タイル・利用者の見た目を、シミュレーターの今に合わせる */
  const syncDom = useCallback((s: InfraSim) => {
    for (const [slot, refs] of tiles.current) {
      const node = s.nodes.get(slot);
      if (!node) continue;
      const load = node.down ? 0 : Math.min(1, node.busy.length / Math.max(1, node.cap));
      const state = tileState(s, node);
      const role = node.kind === "db" || node.kind === "replica" ? (s.primaryDb === slot ? "primary" : "replica") : "";
      const stat = statText(s, node);
      const prev = cache.current.get(slot);
      if (!prev || Math.abs(prev.load - load) > 0.01) {
        if (refs.ring) refs.ring.style.strokeDashoffset = String(refs.circ * (1 - load));
      }
      if (!prev || prev.state !== state) refs.root.dataset.state = state;
      if (!prev || prev.role !== role) refs.root.dataset.role = role;
      if (refs.stat && (!prev || prev.stat !== stat)) refs.stat.textContent = stat;
      cache.current.set(slot, { load, stat, state, role });
    }
    for (let i = 0; i < USER_COUNT; i++) {
      const el = users.current[i];
      const u = s.users[i];
      if (!el || !u) continue;
      const mood = u.mood > 0.9 ? "happy" : u.mood < -1.6 ? "angry" : u.mood < -0.4 ? "sad" : "ok";
      const flash = s.now - u.failAt < 0.45 ? "ng" : s.now - u.okAt < 0.3 ? "ok" : "";
      if (el.dataset.mood !== mood) el.dataset.mood = mood;
      if (el.dataset.flash !== flash) el.dataset.flash = flash;
    }
    if (botRef.current) {
      const on = (s.setup.traffic(s.now).attack ?? 0) > 0 && !s.finished ? "1" : "";
      if (botRef.current.dataset.active !== on) botRef.current.dataset.active = on;
    }
  }, []);

  // 本番中は毎こま進めて描く
  useEffect(() => {
    if (!sim) return;
    let raf = 0;
    let last = performance.now();
    let tickAt = 0;
    let doneAt = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { sim: s, paused: p, speed: sp, onTick: cb } = live.current;
      if (s) {
        if (!p && !s.finished) s.step(dt * sp);
        rendererRef.current?.draw(s, p ? 0 : dt);
        syncDom(s);
        if (cb && now - tickAt > 120) {
          tickAt = now;
          cb(s);
        }
        // 終わったら、残りの効果が消えるまで描いて止める（電池のため）
        if (s.finished) {
          doneAt ||= now;
          if (now - doneAt > 2500) {
            cb?.(s);
            return;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sim, syncDom]);

  // 置いたパーツを、すぐにシミュレーターへ。組み立て中は、タイルの下に月額を出す
  useLayoutEffect(() => {
    if (sim) {
      sim.setPlacements(placements, live.current.links);
      syncDom(sim);
      return;
    }
    for (const p of placements) {
      const refs = tiles.current.get(p.slot);
      if (!refs) continue;
      if (refs.stat) refs.stat.textContent = yen(partSize(p.kind, p.size).cost);
      refs.root.dataset.state = "";
      refs.root.dataset.role = "";
      if (refs.ring) refs.ring.style.strokeDashoffset = String(refs.circ);
    }
    cache.current.clear();
  }, [sim, placements, links, syncDom, size, tile]);

  const setTileRef = (slot: NodeId) => (el: HTMLButtonElement | null) => {
    if (!el) {
      tiles.current.delete(slot);
      return;
    }
    const ring = el.querySelector<SVGCircleElement>("[data-ring]");
    const stat = el.querySelector<HTMLElement>("[data-stat]");
    const r = ring ? Number(ring.getAttribute("r")) : 0;
    tiles.current.set(slot, { root: el, ring, stat, circ: 2 * Math.PI * r });
    cache.current.delete(slot);
  };

  const at = (id: string): CSSProperties => {
    const p = layout.pos.get(id);
    return p ? { left: p.x * size.w, top: p.y * size.h } : { display: "none" };
  };
  const ringR = tile / 2 + 4;

  return (
    <div ref={boxRef} className={styles.board} data-compact={compact ? "1" : undefined} style={{ "--tile": `${tile}px` } as CSSProperties}>
      <canvas ref={backRef} className={styles.canvas} aria-hidden="true" />
      {size.w > 0 ? (
        <>
          {layout.rows.map((row) => (
            <span key={row.label} className={styles.rowLabel} style={{ top: row.y * size.h }}>
              {row.label}
            </span>
          ))}
          {layout.farSpan ? (
            <div
              className={styles.farZone}
              style={{ left: layout.farSpan.from * size.w, width: (layout.farSpan.to - layout.farSpan.from) * size.w, top: layout.usersY * size.h - 26, height: 52 }}
            >
              <span>遠くの町</span>
            </div>
          ) : null}
          {Array.from({ length: USER_COUNT }, (_, i) => (
            <div
              key={i}
              ref={(el) => {
                users.current[i] = el;
              }}
              className={styles.user}
              style={at(`u${i}`)}
              data-mood="ok"
              aria-hidden="true"
            >
              <UserFace />
            </div>
          ))}
          {onUsers ? (
            <button
              type="button"
              className={styles.usersHit}
              data-selected={usersSelected ? "1" : undefined}
              style={{ top: layout.usersY * size.h - 26, height: 52 }}
              onClick={onUsers}
              aria-label="利用者（つなぐ）"
            />
          ) : null}
          {bot ? (
            <div ref={botRef} className={styles.bot} style={at("bot")} aria-label="あやしいロボット">
              <Glyph id="bot" size={20} />
            </div>
          ) : null}
          {slots.map((slot) => {
            const kind = kindOf(slot);
            const spec = PARTS[kind];
            const p = placements.find((x) => x.slot === slot);
            const style = { ...at(slot), "--c": spec.color } as CSSProperties;
            if (!p) {
              return (
                <button
                  key={slot}
                  type="button"
                  className={styles.slot}
                  style={style}
                  data-hint={hint?.has(slot) ? "1" : undefined}
                  data-selected={selected === slot ? "1" : undefined}
                  onClick={() => onSlot(slot)}
                  aria-label={`${spec.name}を置く`}
                >
                  <span className={styles.slotFace}>
                    <Glyph id={kind} size={Math.round(tile * 0.42)} strokeWidth={1.6} />
                    <i aria-hidden="true">+</i>
                  </span>
                  <span className={styles.slotName}>{spec.short}</span>
                </button>
              );
            }
            const sizeLabel = spec.sizes.length > 1 ? partSize(kind, p.size).label : "";
            return (
              <button
                key={`${slot}:${kind}`}
                ref={setTileRef(slot)}
                type="button"
                className={styles.tile}
                style={style}
                data-selected={selected === slot ? "1" : undefined}
                data-fixed={fixed.has(slot) ? "1" : undefined}
                onClick={() => onSlot(slot)}
                aria-label={`${slotLabel(slot)}（${spec.name}）`}
              >
                <svg className={styles.ring} width={ringR * 2 + 4} height={ringR * 2 + 4} viewBox={`0 0 ${ringR * 2 + 4} ${ringR * 2 + 4}`} aria-hidden="true">
                  <circle className={styles.ringBg} cx={ringR + 2} cy={ringR + 2} r={ringR} />
                  <circle
                    data-ring=""
                    className={styles.ringFg}
                    cx={ringR + 2}
                    cy={ringR + 2}
                    r={ringR}
                    strokeDasharray={2 * Math.PI * ringR}
                    strokeDashoffset={2 * Math.PI * ringR}
                    transform={`rotate(-90 ${ringR + 2} ${ringR + 2})`}
                  />
                </svg>
                <span className={styles.tileFace}>
                  <Glyph id={kind} size={Math.round(tile * 0.5)} strokeWidth={1.7} />
                  <span className={styles.led} aria-hidden="true" />
                </span>
                {sizeLabel ? <span className={styles.sizeBadge}>{sizeLabel}</span> : null}
                <span className={styles.roleBadge} aria-hidden="true" />
                <span className={styles.tileName}>{slotLabel(slot)}</span>
                <span className={styles.tileStat} data-stat="" />
              </button>
            );
          })}
        </>
      ) : null}
      <canvas ref={frontRef} className={`${styles.canvas} ${styles.front}`} aria-hidden="true" />
    </div>
  );
}

/** 利用者（スマホを持った人の顔） */
function UserFace() {
  return (
    <svg viewBox="0 0 28 34" width="28" height="34" aria-hidden="true">
      <rect className={styles.phone} x="2" y="1.5" width="24" height="31" rx="6" />
      <rect className={styles.screen} x="4.6" y="4.4" width="18.8" height="22.6" rx="3.6" />
      <g className={styles.faceParts}>
        <circle cx="10.6" cy="13.6" r="1.35" />
        <circle cx="17.4" cy="13.6" r="1.35" />
        <path data-m="happy" d="M10.3 18.2q3.7 3.6 7.4 0" />
        <path data-m="ok" d="M10.8 19.4h6.4" />
        <path data-m="sad" d="M10.6 20.6q3.4-2.8 6.8 0" />
        <path data-m="angry" d="M10.6 20.8q3.4-3.2 6.8 0M8.8 10.6l3 1.2M19.2 10.6l-3 1.2" />
      </g>
      <rect className={styles.home} x="11.4" y="28.6" width="5.2" height="1.4" rx=".7" />
    </svg>
  );
}
