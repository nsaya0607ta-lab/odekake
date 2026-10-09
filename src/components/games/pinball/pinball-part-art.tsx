"use client";

import { useEffect, useRef } from "react";
import { createGame, type PinballItem } from "@/lib/games/pinball/game";
import { buildStageTable, DEFAULT_STAGE_ITEMS, type PinballPartId, type StagePart, type StageRamp } from "@/lib/games/pinball/stage";
import type { PinballTheme } from "@/lib/games/pinball/themes";
import { PinballRenderer, type ViewRect } from "./render";

/** 絵にするもの：部品（お店の部品の id）か、ふつうのランプ */
export type PinballArtId = PinballPartId | "ramp_standard";

/** ランプ → 絵 */
export const RAMP_ART: Record<StageRamp, PinballArtId> = { standard: "ramp_standard", top: "ramp_top", cross: "ramp_cross" };

type ArtDef = { ramp: StageRamp; parts: StagePart[]; view: ViewRect; /** かざぐるまの羽根の向き */ angle?: number };

/** まん中が (cx, cy) の、幅 w・高さ h の範囲（mm） */
const around = (cx: number, cy: number, w: number, h = w): ViewRect => ({ x0: cx - w / 2, y0: cy - h / 2, w, h });

/**
 * 絵ごとの、置く部品と切りとる範囲。部品は台の上のほうの、ほかに何も無い所（240, 300 のあたり）に置く
 * （絵なので、すき間の決まりは気にしない。くぎ・ポストは、まとめて置いたときのようすを見せる）。
 * ランプは、そのランプのいちばん目立つ所（ふつう＝左のU字の上・てっぺん＝左のワイヤーのカーブ・コースター＝交わる所）
 */
const ARTS: Record<PinballArtId, ArtDef> = {
  bumper: { ramp: "standard", parts: [{ kind: "bumper", x: 240, y: 300, size: "m" }], view: around(241, 302, 66) },
  pinwheel: { ramp: "standard", parts: [{ kind: "pinwheel", x: 240, y: 300, dir: 1 }], view: around(241, 301, 58), angle: 0.4 },
  post: {
    ramp: "standard",
    parts: [
      { kind: "post", x: 227, y: 300 },
      { kind: "post", x: 253, y: 300 },
    ],
    view: around(240, 301, 46),
  },
  peg: {
    ramp: "standard",
    parts: [
      [228, 289],
      [240, 289],
      [252, 289],
      [234, 300],
      [246, 300],
      [228, 311],
      [240, 311],
      [252, 311],
    ].map(([x, y]) => ({ kind: "peg" as const, x: x!, y: y! })),
    view: around(240, 300, 44),
  },
  sling: { ramp: "standard", parts: [{ kind: "sling", x: 247, y: 300, face: "right" }], view: around(241, 301, 100) },
  ramp_standard: { ramp: "standard", parts: [], view: around(82, 424, 124) },
  ramp_top: { ramp: "top", parts: [], view: around(158, 232, 124) },
  ramp_cross: { ramp: "cross", parts: [], view: around(240, 292, 200) },
};

/* ---------- 画像と、描く順番 ---------- */

const images = new Map<string, Promise<HTMLImageElement | null>>();

/** 画像を読む（同じ画像は1回だけ。読めなければ null） */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  let loading = images.get(src);
  if (!loading) {
    loading = new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    images.set(src, loading);
  }
  return loading;
}

/** 描くのは1つずつ、あいだをあけて（部品えらびを開いたときに、まとめて描いて画面が止まらないように） */
const queue: (() => void)[] = [];
let running = false;

function enqueue(job: () => void): void {
  queue.push(job);
  if (running) return;
  running = true;
  const next = () => {
    const current = queue.shift();
    if (!current) {
      running = false;
      return;
    }
    current();
    setTimeout(next, 0);
  };
  setTimeout(next, 0);
}

/**
 * 描いた絵（色ごと。キーは絵・アイテムの絵・画素の大きさ）。台を1つ丸ごと描くので1枚 十数ms かかる。
 * エディター・お店を開きなおしたときや、色を前のものにもどしたときは、これをうつすだけにする
 */
const painted = new WeakMap<PinballTheme, Map<string, HTMLCanvasElement>>();

/**
 * 部品の絵：遊ぶ画面と同じ描画（render.ts）で、部品だけを置いた台の一部を描く（エディターの部品えらび・ランプえらび・部品のお店）。
 * 動かない1枚の絵なので、大きさが変わったときと画像を読みこんだときだけ描く
 */
export function PinballPartArt({ art, theme, bumperItem, className }: { art: PinballArtId; theme: PinballTheme; bumperItem?: PinballItem | null; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    const def = ARTS[art];
    const src = def.parts.some((part) => part.kind === "bumper") ? (bumperItem?.image ?? null) : null;
    const ready = src ? loadImage(src) : Promise.resolve(null);
    let byTheme = painted.get(theme);
    if (!byTheme) {
      byTheme = new Map();
      painted.set(theme, byTheme);
    }
    const cache = byTheme;

    const paint = (img: HTMLImageElement | null) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const key = `${art}|${img ? src : ""}|${Math.round(rect.width * dpr)}x${Math.round(rect.height * dpr)}`;
      const done = cache.get(key);
      if (done) {
        canvas.width = done.width;
        canvas.height = done.height;
        canvas.getContext("2d")?.drawImage(done, 0, 0);
        return;
      }
      enqueue(() => {
        if (!alive) return;
        const table = buildStageTable({ v: 1, look: "default", ramp: def.ramp, parts: def.parts, items: DEFAULT_STAGE_ITEMS });
        const renderer = new PinballRenderer(canvas, { table, theme, shape: null, bumperItems: bumperItem ? [bumperItem] : [], view: def.view });
        if (src && img) renderer.setImage(src, img);
        renderer.resize(rect.width, rect.height, dpr);
        const game = createGame({ table, pool: [], tableName: "" });
        // はじめに浮かぶアイテム（？カプセル）は出さない
        game.lit = [];
        for (const pw of game.world.pinwheels) pw.angle = def.angle ?? 0;
        renderer.draw(game, 0);
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        copy.getContext("2d")?.drawImage(canvas, 0, 0);
        cache.set(key, copy);
      });
    };

    // 大きさが決まったら（変わったら）描く。バンパーは、アイテムの絵を読みこんでから
    const ro = new ResizeObserver(() => {
      void ready.then((img) => {
        if (alive) paint(img);
      });
    });
    ro.observe(canvas);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [art, theme, bumperItem]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
