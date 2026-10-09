"use client";

import { useEffect, useRef, useState, type PointerEventHandler, type ReactNode, type RefObject } from "react";
import { capsuleItem, createGame, type Game, type PinballItem } from "@/lib/games/pinball/game";
import type { TableGeometry } from "@/lib/games/pinball/table";
import type { PinballLobby } from "@/lib/games/pinball/tables";
import type { PinballTheme } from "@/lib/games/pinball/themes";
import { PinballRenderer, type ViewRect } from "./render";

type Props = {
  /** 描く台の形（ステージの形。部品を動かしている間は、その部品をのぞいた形） */
  table: TableGeometry;
  theme: PinballTheme;
  lobby: PinballLobby;
  /** バンパーの笠の絵（バンパーの番号の順。バンパーを動かしている間は、その絵をのぞいたもの） */
  bumperItems: readonly PinballItem[];
  /** 見せる範囲（台の座標・mm）。この縦横比で表示する */
  view: ViewRect;
  /** 全体表示は操作パレットの上に台全体が収まる高さにする */
  fitToScreen: boolean;
  /** テストプレイ中は背景のエディターを描画しない */
  active: boolean;
  /** 描かないアイテムの場所（動かしている間は、上に重ねた絵で見せる） */
  hiddenItem: number | null;
  svgRef: RefObject<SVGSVGElement | null>;
  onPointerDown: PointerEventHandler<SVGSVGElement>;
  onPointerMove: PointerEventHandler<SVGSVGElement>;
  onPointerUp: PointerEventHandler<SVGSVGElement>;
  cursor: string;
  label: string;
  /** 上に重ねる SVG（台の座標・mm で描く） */
  children: ReactNode;
};

/**
 * ステージのエディターの台：遊ぶ画面と同じ描画（render.ts）で、台の上のほうを描く。上に透明な SVG を重ね、
 * えらんだ部品のしるし・置ける所の点・動かしている部品などは SVG に描く（SVG の座標は台の座標と同じ）。
 * 台の絵（床・部品）は形が変わるたびに作りなおす（部品を指で動かしている間は作りなおさない）
 */
export function PinballStageBoard({ table, theme, lobby, bumperItems, view, fitToScreen, active, hiddenItem, svgRef, onPointerDown, onPointerMove, onPointerUp, cursor, label, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<PinballRenderer | null>(null);
  const gameRef = useRef<Game | null>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const sizeRef = useRef<{ w: number; h: number; dpr: number } | null>(null);
  const hiddenRef = useRef(hiddenItem);
  hiddenRef.current = hiddenItem;
  const [viewBox, setViewBox] = useState<ViewRect>(view);

  // アイテムの絵（バンパーの笠と、浮かべるアイテム）
  useEffect(() => {
    const sources = new Set<string>();
    // 持っているアイテムが3つより少ないときは ？カプセルを浮かべる（ゲームと同じ capsuleItem）
    const first = [...lobby.pool.slice(0, 3), capsuleItem(0), capsuleItem(1), capsuleItem(2), ...lobby.bumperItems];
    for (const item of first) if (item.image) sources.add(item.image);
    const loading: HTMLImageElement[] = [];
    for (const src of sources) {
      if (imagesRef.current.has(src)) continue;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        imagesRef.current.set(src, img);
        rendererRef.current?.setImage(src, img);
      };
      img.src = src;
      loading.push(img);
    }
    return () => {
      for (const img of loading) img.onload = null;
    };
  }, [lobby]);

  // 台の形・見た目が変わったら、描画とゲーム（描くのに使うだけ。動かさない）を作りなおす
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createGame({ table, pool: lobby.pool, tableName: theme.name, conquestTitle: theme.conquestTitle, zukan: lobby.zukan });
    // 自分で動かせる3か所に、遊ぶときと同じようにアイテムを浮かべる
    game.lit = [0, 1, 2].map((spot) => ({ item: game.candidates[spot % game.candidates.length]!, spot, litAt: game.clock, encore: false, until: 0 }));
    const renderer = new PinballRenderer(canvas, { table, theme, shape: lobby.shape, bumperItems, view });
    for (const [src, img] of imagesRef.current) renderer.setImage(src, img);
    const size = sizeRef.current;
    if (size) {
      renderer.resize(size.w, size.h, size.dpr);
      setViewBox(renderer.visibleRect());
    }
    rendererRef.current = renderer;
    gameRef.current = game;
  }, [table, theme, lobby, bumperItems, view]);

  // 大きさが変わったら描きなおす（SVG の座標も、描画と同じ範囲にそろえる）
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const size = { w: Math.max(1, rect.width), h: Math.max(1, rect.height), dpr: Math.min(window.devicePixelRatio || 1, 2) };
      sizeRef.current = size;
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.resize(size.w, size.h, size.dpr);
      setViewBox(renderer.visibleRect());
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [view]);

  // 毎フレーム描く（かざぐるまは回し、アイテムはゆれる。玉は動かさない）
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gameRef.current;
      const renderer = rendererRef.current;
      if (!g || !renderer || !sizeRef.current) return;
      g.world.pinwheels.forEach((pw, k) => {
        pw.angle += (g.world.table.pinwheels[k]?.omega ?? 0) * dt;
      });
      const all = g.lit;
      if (hiddenRef.current !== null) g.lit = all.filter((l) => l.spot !== hiddenRef.current);
      renderer.draw(g, dt);
      g.lit = all;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-[20px] border border-white/10 bg-black" style={{ aspectRatio: `${view.w} / ${view.h}`, height: fitToScreen ? "clamp(280px, calc(100dvh - 370px), 660px)" : undefined }}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x0} ${viewBox.y0} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="none"
        className="absolute inset-0 block h-full w-full touch-none select-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={label}
      >
        {children}
      </svg>
    </div>
  );
}
