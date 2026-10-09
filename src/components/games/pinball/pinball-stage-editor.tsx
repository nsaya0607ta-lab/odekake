"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction } from "react";
import { RedCoinArt } from "@/components/coin-art";
import { TOP_RAMP } from "@/lib/games/pinball/maps";
import {
  BUMPER_RADIUS,
  canRotatePart,
  cleanStageName,
  mirrorPart,
  partProblem,
  partRadius,
  partShape,
  partShapeDistance,
  PART_NAMES,
  placeableSpots,
  PINBALL_PARTS,
  RAMP_PART,
  rotatePart,
  snapStagePoint,
  stageSlingDef,
  stageArea,
  stageRampName,
  STAGE_GAP,
  STAGE_LOOKS,
  STAGE_NAME_MAX,
  STAGE_PART_KINDS,
  STAGE_RAMPS,
  buildStageTable,
  itemProblem,
  stagePartCounts,
  validateStage,
  type BumperSize,
  type OwnedParts,
  type StagePart,
  type StagePartKind,
  type StageSpec,
} from "@/lib/games/pinball/stage";
import { CX, type Pt } from "@/lib/games/pinball/table";
import type { PinballLobby } from "@/lib/games/pinball/tables";
import { getPinballTheme, type PinballTheme } from "@/lib/games/pinball/themes";
import { PinballPartArt, RAMP_ART } from "./pinball-part-art";
import { PinballStageBoard } from "./pinball-stage-board";
import type { ViewRect } from "./render";

export type StageDraft = { id: string | null; name: string; spec: StageSpec; shared: boolean };

type Props = {
  draft: StageDraft;
  /** 台に出すアイテム・バンパーの絵・床の県の形（遊ぶ画面と同じもの） */
  lobby: PinballLobby;
  /** 持っている部品の数（はじめのぶん＋買ったぶん） */
  owned: OwnedParts;
  redCoins: number | null;
  suspended?: boolean;
  onClose: () => void;
  onSaved: (saved: StageDraft & { id: string }) => void;
  onDeleted: (id: string) => void;
  onTestPlay: (spec: StageSpec, name: string) => void;
  onOpenShop: () => void;
};

type Selection = { type: "part" | "item"; index: number } | null;
/**
 * 指で動かしている間の、台の絵のもと。部品を動かしている間はその部品をのぞいた形のまま描き（動かすたびに台の絵を
 * 作りなおすと重い）、動かしている部品は上の SVG に描く。アイテムの場所は、その場所の絵だけを消す。
 * bumper は動かしているバンパーの番号（バンパーの中で何番目か。笠の絵はこの番号で決まるので、ほかのバンパーの絵がずれないようにする）
 */
type Frozen = { spec: StageSpec; part: number | null; item: number | null; bumper: number | null };
type Drag = { type: "part" | "item"; index: number; pointerId: number; start: Pt; origin: Pt; before: StageSpec; moved: boolean };
type Message = { text: string; tone: "error" | "info" | "ok" };

/** エディターに見せる台の範囲（台の上のほう。mm） */
const EDITOR_VIEW: ViewRect = { x0: -10, y0: 40, w: 542, h: 610 };
const FREE_EDITOR_VIEWS: Record<"all" | "top" | "bottom", ViewRect> = {
  all: { x0: -10, y0: -10, w: 542, h: 1020 },
  top: { x0: -10, y0: 40, w: 542, h: 540 },
  bottom: { x0: -10, y0: 450, w: 542, h: 540 },
};
const SIZE_LABEL: Record<BumperSize, string> = { s: "小", m: "中", l: "大" };

function clonePart(part: StagePart, at: Pt): StagePart {
  return { ...part, x: at.x, y: at.y };
}

function newPart(kind: StagePartKind, at: Pt): StagePart {
  switch (kind) {
    case "bumper":
      return { kind, x: at.x, y: at.y, size: "m" };
    case "pinwheel":
      return { kind, x: at.x, y: at.y, dir: 1 };
    case "bar":
      return { kind, x: at.x, y: at.y, dir: at.x < CX ? 1 : -1 };
    case "sling":
      // 台のまん中へ向けてはじく
      return { kind, x: at.x, y: at.y, face: at.x < CX ? "right" : "left" };
    case "rail":
    case "rubber":
      // 台のまん中へ向けて下がる向き（左がわは「＼」、右がわは「／」）
      return { kind, x: at.x, y: at.y, angle: at.x < CX ? 60 : 120 };
    case "drop":
      return { kind, x: at.x, y: at.y, angle: 0 };
    case "post":
    case "peg":
    case "block":
    case "spinner":
      return { kind, x: at.x, y: at.y };
  }
}

/** 指で動かしている部品（台の絵は置いたときに描きなおすので、動かしている間はこの簡単な絵で見せる。バンパーは笠の絵も出す） */
function PartGhost({ part, theme, ok, image }: { part: StagePart; theme: PinballTheme; ok: boolean; image?: string }) {
  const { colors } = theme;
  const ring = ok ? "#7dffb0" : "#ff4d4d";
  let body: ReactNode;
  switch (part.kind) {
    case "bumper": {
      const r = BUMPER_RADIUS[part.size];
      const cap = r - 5;
      body = (
        <>
          <circle cx={part.x} cy={part.y} r={r} fill={colors.accent} fillOpacity={0.85} stroke="#ffffff" strokeWidth={3} />
          {image ? (
            <>
              <clipPath id="stage-ghost-cap">
                <circle cx={part.x} cy={part.y} r={cap} />
              </clipPath>
              <circle cx={part.x} cy={part.y} r={cap} fill="#ffffff" />
              <image href={image} x={part.x - cap} y={part.y - cap} width={cap * 2} height={cap * 2} preserveAspectRatio="xMidYMid slice" clipPath="url(#stage-ghost-cap)" />
            </>
          ) : (
            <circle cx={part.x} cy={part.y} r={r * 0.55} fill="#ffffff" fillOpacity={0.75} />
          )}
        </>
      );
      break;
    }
    case "pinwheel":
      body = (
        <g stroke={colors.accent2} strokeWidth={9} strokeLinecap="round">
          <line x1={part.x - 19} y1={part.y} x2={part.x + 19} y2={part.y} />
          <line x1={part.x} y1={part.y - 19} x2={part.x} y2={part.y + 19} />
          <circle cx={part.x} cy={part.y} r={6.5} fill={colors.accent2} />
        </g>
      );
      break;
    case "post":
      body = <circle cx={part.x} cy={part.y} r={6} fill="#eef2f7" stroke="#2b3240" strokeWidth={2} />;
      break;
    case "peg":
      body = <circle cx={part.x} cy={part.y} r={4.5} fill="#e2b95c" stroke="#7a5a1c" strokeWidth={1.2} />;
      break;
    case "sling": {
      const s = stageSlingDef(part);
      body = <path d={`M${s.a.x} ${s.a.y}L${s.b.x} ${s.b.y}L${s.c.x} ${s.c.y}Z`} fill={colors.accent} fillOpacity={0.7} stroke="#ffffff" strokeWidth={3} strokeLinejoin="round" />;
      break;
    }
    case "bar": {
      // 回転バー：羽根のとどく円と、横にした2本の羽根
      const reach = partRadius(part);
      body = (
        <>
          <circle cx={part.x} cy={part.y} r={reach} fill="none" stroke={colors.accent} strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="4 4" />
          <line x1={part.x - reach + 4.5} y1={part.y} x2={part.x + reach - 4.5} y2={part.y} stroke={colors.accent2} strokeWidth={9} strokeLinecap="round" />
          <circle cx={part.x} cy={part.y} r={7} fill="#c9d2dc" />
        </>
      );
      break;
    }
    case "block": {
      // 当たり判定の形（中心線のひし形を、線の太さで太らせる）のとおりに描く
      const prims = partShape(part);
      const pts = prims.map((q) => `${q.ax},${q.ay}`).join(" ");
      body = <polygon points={pts} fill={colors.accent2} fillOpacity={0.8} stroke={colors.accent2} strokeWidth={(prims[0]?.r ?? 3) * 2} strokeLinejoin="round" />;
      break;
    }
    case "spinner": {
      const [pr] = partShape(part);
      if (!pr) break;
      body = (
        <>
          <line x1={pr.ax} y1={pr.ay} x2={pr.bx} y2={pr.by} stroke="#c9d2dc" strokeWidth={1.6} />
          <rect x={pr.ax + 3} y={part.y - 4.5} width={pr.bx - pr.ax - 6} height={9} fill="#d9dfe6" stroke={colors.accent} strokeWidth={2} />
        </>
      );
      break;
    }
    case "rail":
    case "rubber":
    case "drop": {
      // まっすぐな部品：当たり判定の太さのまま線で描く（ゴムは白、ターゲットは色）
      const [pr] = partShape(part);
      if (!pr) break;
      const color = part.kind === "rail" ? "#c9d2dc" : part.kind === "rubber" ? "#f4f0e7" : colors.accent;
      body = (
        <>
          <line x1={pr.ax} y1={pr.ay} x2={pr.bx} y2={pr.by} stroke={color} strokeWidth={pr.r * 2} strokeLinecap={part.kind === "drop" ? "butt" : "round"} />
          {part.kind === "rubber"
            ? [
                [pr.ax, pr.ay],
                [pr.bx, pr.by],
              ].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={2.6} fill="#9aa5b2" />)
            : null}
        </>
      );
      break;
    }
  }
  return (
    <g pointerEvents="none">
      <circle cx={part.x} cy={part.y} r={partRadius(part) + 7} fill={ring} fillOpacity={0.12} stroke={ring} strokeWidth={4} />
      {body}
    </g>
  );
}

export function PinballStageEditor({ draft, lobby, owned, redCoins, suspended = false, onClose, onSaved, onDeleted, onTestPlay, onOpenShop }: Props) {
  const [name, setName] = useState(draft.name);
  const [spec, setSpecState] = useState<StageSpec>(draft.spec);
  const [zoom, setZoom] = useState<"all" | "top" | "bottom">("all");
  const history = useRef<{ past: StageSpec[]; future: StageSpec[] }>({ past: [], future: [] });
  const [shared, setShared] = useState(draft.shared);
  const [stageId, setStageId] = useState<string | null>(draft.id);
  const [saved, setSaved] = useState(() => JSON.stringify([draft.name, draft.spec, draft.shared]));
  const [selected, setSelected] = useState<Selection>(null);
  const [placing, setPlacing] = useState<StagePartKind | null>(null);
  const [message, setMessage] = useState<Message | null>({ text: "部品をえらんで、点線の中をタップすると置けます。置いた部品はドラッグで動かせます。", tone: "info" });
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  /** 動かしている部品を置ける所（ドラッグを始めたときに数える） */
  const [dragGuide, setDragGuide] = useState<Pt[] | null>(null);
  const [frozen, setFrozen] = useState<Frozen | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;
  const setSpec = useCallback((value: SetStateAction<StageSpec>, record = true) => {
    const before = specRef.current;
    const next = typeof value === "function" ? value(before) : value;
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    if (record) {
      history.current.past = [...history.current.past.slice(-49), before];
      history.current.future = [];
    }
    specRef.current = next;
    setSpecState(next);
  }, []);
  const area = stageArea(spec);
  const view = spec.base === "blank" ? FREE_EDITOR_VIEWS[zoom] : EDITOR_VIEW;

  const theme = useMemo(() => getPinballTheme(spec.look), [spec.look]);
  // 台の絵のもと（指で動かしている間は、動かす前の形のまま）
  const renderSpec = frozen?.spec ?? spec;
  const renderTable = useMemo(() => buildStageTable(renderSpec), [renderSpec]);
  const bumperItems = useMemo(() => (frozen?.bumper != null ? lobby.bumperItems.filter((_, i) => i !== frozen.bumper) : lobby.bumperItems), [frozen, lobby]);
  const counts = useMemo(() => stagePartCounts(spec), [spec]);
  const issues = useMemo(() => validateStage(spec, owned), [spec, owned]);
  const badParts = useMemo(() => new Set(issues.flatMap((i) => (i.target.type === "part" ? [i.target.index] : []))), [issues]);
  const badItems = useMemo(() => new Set(issues.flatMap((i) => (i.target.type === "item" ? [i.target.index] : []))), [issues]);
  const dirty = JSON.stringify([name, spec, shared]) !== saved;
  // 置こうとしている部品を置ける所（点で見せる）
  const placeGuide = useMemo(() => (placing ? placeableSpots(spec, (at) => newPart(placing, at), null) : null), [placing, spec]);
  const guide = dragGuide ?? placeGuide;
  const guidePath = useMemo(() => (guide ? guide.map((pt) => `M${pt.x - 2.6} ${pt.y}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`).join("") : null), [guide]);

  // 後ろの画面を動かさない
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const say = useCallback((text: string, tone: Message["tone"] = "error") => setMessage({ text, tone }), []);
  /** その部品をもう置けないときのことば */
  const noneLeft = useCallback(
    (kind: StagePartKind) =>
      owned[kind] > 0 ? `持っている${PART_NAMES[kind]}は、ぜんぶ置きました（部品のお店で買えます）` : `${PART_NAMES[kind]}はまだ持っていません（部品のお店で買えます）`,
    [owned],
  );

  /** 画面の位置 → 台の位置（mm） */
  const toTable = useCallback((event: { clientX: number; clientY: number }): Pt | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }, []);

  /** その位置にある部品・アイテムの場所（いちばん近いもの） */
  const hitTest = useCallback((at: Pt): Selection => {
    const current = specRef.current;
    let best: { sel: Selection; d: number } | null = null;
    current.items.forEach((item, index) => {
      const d = Math.hypot(item.x - at.x, item.y - at.y);
      if (d < 24 && (!best || d < best.d)) best = { sel: { type: "item", index }, d };
    });
    current.parts.forEach((part, index) => {
      // 小さい部品（くぎ・ポスト）は、指で押しやすいように少し広くひろう
      const d = partShapeDistance(part, at);
      const slop = part.kind === "peg" || part.kind === "post" ? 12 : 6;
      if (d < slop && (!best || d - slop < best.d)) best = { sel: { type: "part", index }, d: d - slop };
    });
    return best ? (best as { sel: Selection }).sel : null;
  }, []);

  const placePart = useCallback(
    (kind: StagePartKind, at: Pt) => {
      const current = specRef.current;
      const have = owned[kind];
      if (stagePartCounts(current)[kind] >= have) {
        say(noneLeft(kind));
        return;
      }
      const next: StageSpec = { ...current, parts: [...current.parts, newPart(kind, snapStagePoint(at.x, at.y))] };
      const problem = partProblem(next, next.parts.length - 1);
      if (problem) {
        say(problem);
        return;
      }
      setSpec(next);
      setSelected({ type: "part", index: next.parts.length - 1 });
      say(`${PART_NAMES[kind]}を置きました`, "ok");
    },
    [owned, say, noneLeft, setSpec],
  );

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    const at = toTable(event);
    if (!at) return;
    if (placing) {
      placePart(placing, at);
      return;
    }
    const hit = hitTest(at);
    setSelected(hit);
    if (!hit) return;
    const current = specRef.current;
    const origin = hit.type === "part" ? { x: current.parts[hit.index]!.x, y: current.parts[hit.index]!.y } : { ...current.items[hit.index]! };
    dragRef.current = { type: hit.type, index: hit.index, pointerId: event.pointerId, start: at, origin, before: current, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (hit.type === "part") {
      const part = current.parts[hit.index]!;
      setDragGuide(placeableSpots(current, (to) => clonePart(part, to), hit.index));
    }
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const at = toTable(event);
    if (!at) return;
    const to = snapStagePoint(drag.origin.x + at.x - drag.start.x, drag.origin.y + at.y - drag.start.y);
    const current = specRef.current;
    if (!drag.moved) {
      if (Math.hypot(at.x - drag.start.x, at.y - drag.start.y) < 3) return;
      drag.moved = true;
      // 動かしはじめたら、台の絵はその部品をのぞいた形にする（アイテムは、その場所の絵だけを消す）
      const part = drag.type === "part" ? current.parts[drag.index]! : null;
      setFrozen(
        part
          ? {
              spec: { ...current, parts: current.parts.filter((_, i) => i !== drag.index) },
              part: drag.index,
              item: null,
              bumper: part.kind === "bumper" ? current.parts.slice(0, drag.index).filter((other) => other.kind === "bumper").length : null,
            }
          : { spec: current, part: null, item: drag.index, bumper: null },
      );
    }
    if (drag.type === "part") {
      const parts = current.parts.slice();
      parts[drag.index] = clonePart(parts[drag.index]!, to);
      const next = { ...current, parts };
      setSpec(next, false);
      const problem = partProblem(next, drag.index);
      setMessage(problem ? { text: problem, tone: "error" } : { text: "ここに置けます", tone: "ok" });
    } else {
      const items = current.items.slice() as StageSpec["items"];
      items[drag.index] = to;
      const next = { ...current, items };
      setSpec(next, false);
      const problem = itemProblem(next, drag.index);
      setMessage(problem ? { text: problem, tone: "error" } : { text: "ここに置けます", tone: "ok" });
    }
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragGuide(null);
    setFrozen(null);
    if (!drag.moved) return;
    const current = specRef.current;
    const problem = drag.type === "part" ? partProblem(current, drag.index) : itemProblem(current, drag.index);
    if (event.type === "pointercancel" || problem) {
      setSpec(drag.before, false);
      say(problem ? `${problem}。もとの場所にもどしました` : "移動を取り消しました", "info");
      return;
    }
    if (JSON.stringify(current) !== JSON.stringify(drag.before)) {
      history.current.past = [...history.current.past.slice(-49), drag.before];
      history.current.future = [];
      say("移動しました", "ok");
    }
  };

  const undo = () => {
    if (dragRef.current) return;
    const previous = history.current.past.pop();
    if (!previous) return;
    history.current.future.push(specRef.current);
    setSpec(previous, false);
    setSelected(null);
    setPlacing(null);
    say("ひとつ前にもどしました", "info");
  };
  const redo = () => {
    if (dragRef.current) return;
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(specRef.current);
    setSpec(next, false);
    setSelected(null);
    setPlacing(null);
    say("やり直しました", "info");
  };
  const clearParts = () => {
    if (!spec.parts.length || dragRef.current) return;
    setSpec({ ...spec, parts: [] });
    setSelected(null);
    setPlacing(null);
    say("部品をすべてはずしました。「元に戻す」で戻せます", "info");
  };
  const duplicateSelected = () => {
    if (!selectedPart) return;
    if (counts[selectedPart.kind] >= owned[selectedPart.kind]) {
      say(noneLeft(selectedPart.kind));
      return;
    }
    const spots = placeableSpots(spec, (at) => clonePart(selectedPart, at), null);
    const at = spots.reduce<Pt | null>((best, point) => !best || Math.hypot(point.x - selectedPart.x, point.y - selectedPart.y) < Math.hypot(best.x - selectedPart.x, best.y - selectedPart.y) ? point : best, null);
    if (!at) return say("コピーを置ける場所がありません");
    setSpec({ ...spec, parts: [...spec.parts, clonePart(selectedPart, at)] });
    setSelected({ type: "part", index: spec.parts.length });
    say("近くにコピーしました。ドラッグで動かせます", "ok");
  };

  /** えらんでいる部品を変える（変えたら置けなくなるときは変えない） */
  const changeSelected = (fn: (part: StagePart) => StagePart) => {
    if (selected?.type !== "part") return;
    const current = specRef.current;
    const parts = current.parts.slice();
    parts[selected.index] = fn(parts[selected.index]!);
    const next = { ...current, parts };
    const problem = partProblem(next, selected.index);
    if (problem) {
      say(problem);
      return;
    }
    setSpec(next);
  };

  /** えらんでいる部品の向きを次の向きにする（置けない向きはとばす。どの向きも置けなければ、そのまま） */
  const rotateSelected = () => {
    if (selected?.type !== "part") return;
    const current = specRef.current;
    const original = current.parts[selected.index];
    if (!original || !canRotatePart(original)) return;
    let part: StagePart = original;
    let firstProblem: string | null = null;
    for (let tries = 0; tries < 8; tries += 1) {
      part = rotatePart(part);
      if (!canRotatePart(part) || part.angle === original.angle) break;
      const parts = current.parts.slice();
      parts[selected.index] = part;
      const next = { ...current, parts };
      const problem = partProblem(next, selected.index);
      if (!problem) {
        setSpec(next);
        say(`${PART_NAMES[part.kind]}の向きを変えました（${part.angle}°）`, "ok");
        return;
      }
      firstProblem ??= problem;
    }
    say(`ほかの向きには置けません：${firstProblem ?? ""}`);
  };

  const removeSelected = () => {
    if (selected?.type !== "part") return;
    const current = specRef.current;
    const kind = current.parts[selected.index]?.kind;
    setSpec({ ...current, parts: current.parts.filter((_, i) => i !== selected.index) });
    setSelected(null);
    if (kind) say(`${PART_NAMES[kind]}をはずしました`, "info");
  };

  const mirrorSelected = () => {
    if (selected?.type !== "part") return;
    const current = specRef.current;
    const part = current.parts[selected.index]!;
    if (Math.abs(part.x - CX) < 2) {
      say("まん中にある部品は、反対がわに置けません");
      return;
    }
    if (stagePartCounts(current)[part.kind] >= owned[part.kind]) {
      say(noneLeft(part.kind));
      return;
    }
    const next = { ...current, parts: [...current.parts, mirrorPart(part)] };
    const problem = partProblem(next, next.parts.length - 1);
    if (problem) {
      say(`反対がわに置けません：${problem}`);
      return;
    }
    setSpec(next);
    setSelected({ type: "part", index: next.parts.length - 1 });
    say("反対がわにも置きました", "ok");
  };

  const save = async () => {
    const clean = cleanStageName(name);
    if (!clean) {
      say(`名前は1〜${STAGE_NAME_MAX}文字にしてね`);
      return;
    }
    if (issues.length) {
      say(issues[0]!.message);
      return;
    }
    setBusy("save");
    try {
      const response = await fetch("/api/games/pinball/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: stageId, name: clean, spec, shared }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; id?: string | null; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.id) throw new Error(payload?.error ?? "保存できませんでした。");
      setStageId(payload.id);
      setName(clean);
      setSaved(JSON.stringify([clean, spec, shared]));
      onSaved({ id: payload.id, name: clean, spec, shared });
      say(shared ? "保存しました！ フレンドも遊べます" : "保存しました！", "ok");
    } catch (error) {
      say(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!stageId || busy) return;
    if (!window.confirm(`「${name}」を消しますか？（もとにはもどせません）`)) return;
    setBusy("delete");
    try {
      const response = await fetch(`/api/games/pinball/stages?id=${encodeURIComponent(stageId)}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "消せませんでした。");
      onDeleted(stageId);
    } catch (error) {
      say(error instanceof Error ? error.message : "消せませんでした。");
      setBusy(null);
    }
  };

  const close = () => {
    if (dirty && !window.confirm("保存していない変更があります。とじますか？")) return;
    onClose();
  };

  const testPlay = () => {
    if (issues.length) {
      say(issues[0]!.message);
      return;
    }
    setPlacing(null);
    onTestPlay(spec, cleanStageName(name) ?? "テストプレイ");
  };

  const selectedPart = selected?.type === "part" ? spec.parts[selected.index] ?? null : null;
  // 次に置くバンパーの笠の絵（バンパーの絵は、置いた順に決まる）
  const nextBumperItem = lobby.bumperItems[Math.min(counts.bumper, lobby.bumperItems.length - 1)] ?? null;
  const rampExit = TOP_RAMP.path[TOP_RAMP.path.length - 1]!;

  // 編集状態・履歴は保ち、テストプレイとお店では台と部品プレビューの描画を解放する
  if (suspended) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0b0d14] text-white" role="dialog" aria-modal="true" aria-label="ステージを作る">
      <header data-dark-header className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/10 bg-[#0b0d14]/95 px-3 py-2 backdrop-blur" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
        <button type="button" onClick={close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-black active:scale-95" aria-label="エディターをとじる">
          ‹
        </button>
        <label className="min-w-0 flex-1">
          <span className="block text-[8px] font-black tracking-[0.18em] text-[#ff8a80]">STAGE EDITOR</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={STAGE_NAME_MAX * 2}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[15px] font-black text-white outline-none focus:border-[#ff8a80]/60"
            aria-label="ステージの名前"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy !== null || (!dirty && stageId !== null)}
          className="shrink-0 rounded-full bg-[#ff6b6b] px-4 py-2 text-[13px] font-black text-white active:scale-95 disabled:bg-white/10 disabled:text-white/40"
        >
          {busy === "save" ? "保存中…" : !dirty && stageId ? "保存ずみ" : "保存"}
        </button>
      </header>

      <div className="mx-auto max-w-[480px] px-2 pb-40 pt-2">
        <div className="mb-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[13px] font-black text-[#ffd166]">{spec.base === "blank" ? "白紙から、あなただけの台を作ろう" : "ステージを編集"}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/65">{spec.base === "blank" ? "基本設備は外枠・打ち出し口・左右のフリッパーだけ。ランプもレーンも置かれていません。上下を自由に作れます。★はアイテムが出る場所です。" : "この台は従来の骨組みを使います。新しく作るステージは、白紙から始まります。"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={undo} disabled={!history.current.past.length} className="rounded-full bg-white/10 px-3 py-2 text-[11px] font-bold disabled:opacity-30">↶ 元に戻す</button>
            <button type="button" onClick={redo} disabled={!history.current.future.length} className="rounded-full bg-white/10 px-3 py-2 text-[11px] font-bold disabled:opacity-30">↷ やり直す</button>
            <button type="button" onClick={clearParts} disabled={!spec.parts.length} className="ml-auto rounded-full bg-white/10 px-3 py-2 text-[11px] font-bold disabled:opacity-30">部品をすべてはずす</button>
          </div>
        </div>
        {spec.base === "blank" ? (
          <div className="sticky top-[68px] z-[5] mb-2 flex items-center gap-1 rounded-full border border-white/10 bg-[#0b0d14]/95 p-1 backdrop-blur">
            {([ ["all", "台全体"], ["top", "上を拡大"], ["bottom", "下を拡大"] ] as const).map(([key, label]) => (
              <button key={key} type="button" disabled={frozen !== null} onClick={() => setZoom(key)} aria-pressed={zoom === key} className={`flex-1 rounded-full py-2 text-[11px] font-black ${zoom === key ? "bg-[#ffd166] text-black" : "text-white/65"}`}>{label}</button>
            ))}
            <span className="px-2 text-[10px] font-bold text-white/50">{spec.parts.length}こ</span>
          </div>
        ) : null}
        <div className="relative">
          <PinballStageBoard
            table={renderTable}
            theme={theme}
            lobby={lobby}
            bumperItems={bumperItems}
            view={view}
            fitToScreen={spec.base === "blank" && zoom === "all"}
            hiddenItem={frozen?.item ?? null}
            svgRef={svgRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            cursor={placing ? "crosshair" : "default"}
            label="ステージの台。部品をタップしてえらび、ドラッグで動かす"
          >
            {/* 部品を置ける所（部品のまん中） */}
            <rect
              x={area.x0}
              y={area.y0}
              width={area.x1 - area.x0}
              height={area.y1 - area.y0}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={placing || frozen ? 0.6 : 0.22}
              strokeWidth={2}
              strokeDasharray="8 8"
              rx={10}
              pointerEvents="none"
            />
            {/* いまの部品を置ける所（点は数百こあるので、1本の path にまとめて描く） */}
            {guidePath ? <path d={guidePath} fill="#7dffb0" fillOpacity={0.7} pointerEvents="none" /> : null}
            {/* てっぺんランプの出口（玉が落ちてくる所） */}
            {spec.ramp === "top"
              ? [rampExit, { x: CX * 2 - rampExit.x, y: rampExit.y }].map((pt, i) => (
                  <circle key={`exit${i}`} cx={pt.x} cy={pt.y} r={40} fill="#ffffff" fillOpacity={0.06} stroke="#ffffff" strokeOpacity={0.35} strokeDasharray="4 6" strokeWidth={2} pointerEvents="none" />
                ))
              : null}
            {/* 部品のしるし（えらんでいる・置き方に問題がある。動かしている部品は下で描く） */}
            {spec.parts.map((part, index) => {
              if (frozen?.part === index) return null;
              const isSelected = selected?.type === "part" && selected.index === index;
              const bad = badParts.has(index);
              if (!isSelected && !bad) return null;
              return (
                <g key={`mark${index}`} pointerEvents="none">
                  {isSelected ? (
                    <circle cx={part.x} cy={part.y} r={partRadius(part) + STAGE_GAP} fill="none" stroke="#ffffff" strokeOpacity={0.4} strokeDasharray="5 6" strokeWidth={2} />
                  ) : null}
                  <circle cx={part.x} cy={part.y} r={partRadius(part) + 6} fill="none" stroke={bad ? "#ff4d4d" : "#ffffff"} strokeWidth={bad ? 5 : 4} />
                </g>
              );
            })}
            {/* アイテムが浮かぶ場所（自分で動かせる3か所） */}
            {spec.items.map((item, index) => {
              const isSelected = selected?.type === "item" && selected.index === index;
              const bad = badItems.has(index);
              const dragging = frozen?.item === index;
              return (
                <g key={`item${index}`} pointerEvents="none">
                  {dragging ? (
                    <>
                      <circle cx={item.x} cy={item.y} r={20} fill="#fff4d6" stroke={bad ? "#ff4d4d" : "#7dffb0"} strokeWidth={4} />
                      <text x={item.x} y={item.y + 7} textAnchor="middle" fontSize={20} fontWeight={900} fill="#d79a1e">
                        ★
                      </text>
                    </>
                  ) : (
                    <circle
                      cx={item.x}
                      cy={item.y}
                      r={25}
                      fill="none"
                      stroke={bad ? "#ff4d4d" : isSelected ? "#ffffff" : "#ffd166"}
                      strokeOpacity={bad || isSelected ? 1 : 0.55}
                      strokeWidth={isSelected || bad ? 4 : 2}
                      strokeDasharray={isSelected || bad ? undefined : "5 5"}
                    />
                  )}
                </g>
              );
            })}
            {/* 指で動かしている部品 */}
            {frozen?.part !== null && frozen?.part !== undefined && spec.parts[frozen.part] ? (
              <PartGhost
                part={spec.parts[frozen.part]!}
                theme={theme}
                ok={!badParts.has(frozen.part)}
                image={frozen.bumper !== null ? lobby.bumperItems[frozen.bumper]?.image ?? undefined : undefined}
              />
            ) : null}
          </PinballStageBoard>
          {placing ? (
            <p className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-black text-[#ffd166]">
              {PART_NAMES[placing]}を置く所をタップ（緑の点のところに置けます）
            </p>
          ) : null}
        </div>

        <p
          className={`mt-2 min-h-[34px] rounded-xl px-3 py-2 text-[11px] font-bold leading-snug ${
            message?.tone === "error" ? "bg-[#3a1418] text-[#ffb4a8]" : message?.tone === "ok" ? "bg-[#16301f] text-[#a6f0c0]" : "bg-white/[0.05] text-white/70"
          }`}
          role="status"
          aria-live="polite"
        >
          {message?.text ?? ""}
        </p>

        {/* えらんでいる部品・アイテムの操作 */}
        {selectedPart ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
            <span className="mr-1 text-[12px] font-black">{PART_NAMES[selectedPart.kind]}</span>
            {selectedPart.kind === "bumper"
              ? (["s", "m", "l"] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => changeSelected((part) => ({ ...(part as Extract<StagePart, { kind: "bumper" }>), size }))}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-black ${selectedPart.size === size ? "bg-[#ff6b6b] text-white" : "bg-white/10 text-white/80"}`}
                    aria-pressed={selectedPart.size === size}
                  >
                    {SIZE_LABEL[size]}
                  </button>
                ))
              : null}
            {selectedPart.kind === "pinwheel" || selectedPart.kind === "bar" ? (
              <button
                type="button"
                onClick={() => changeSelected((part) => (part.kind === "pinwheel" || part.kind === "bar" ? { ...part, dir: part.dir === 1 ? -1 : 1 } : part))}
                className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-black"
              >
                {selectedPart.dir === 1 ? "↻ 時計まわり" : "↺ 反時計まわり"}
              </button>
            ) : null}
            {canRotatePart(selectedPart) ? (
              <button type="button" onClick={rotateSelected} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-black" aria-label={`向きを変える（いまは ${selectedPart.angle}°）`}>
                ↻ 向きを変える
              </button>
            ) : null}
            {selectedPart.kind === "sling" ? (
              <button
                type="button"
                onClick={() => changeSelected((part) => ({ ...(part as Extract<StagePart, { kind: "sling" }>), face: (part as Extract<StagePart, { kind: "sling" }>).face === "left" ? "right" : "left" }))}
                className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-black"
              >
                {selectedPart.face === "left" ? "← 左へはじく" : "右へはじく →"}
              </button>
            ) : null}
            <button type="button" onClick={mirrorSelected} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-black">
              ⇋ 反対がわにも
            </button>
            <button type="button" onClick={duplicateSelected} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-black">コピー</button>
            <button type="button" onClick={removeSelected} className="ml-auto rounded-full bg-[#3a1418] px-3 py-1.5 text-[12px] font-black text-[#ffb4a8]">
              はずす
            </button>
          </div>
        ) : selected?.type === "item" ? (
          <p className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-[11px] font-bold text-white/70">★ はアイテムが浮かぶ場所（3か所）。ドラッグで動かせます。</p>
        ) : null}

        {/* 部品をえらぶ */}
        <div className="mt-3">
          <div className="flex items-end justify-between px-1">
            <p className="text-[12px] font-black">部品を置く</p>
            <button type="button" onClick={onOpenShop} className="flex items-center gap-1 rounded-full border border-[#ff8a80]/40 bg-[#3a1418] px-2.5 py-1 text-[11px] font-black text-[#ffd3cd] active:scale-95">
              <RedCoinArt className="h-3.5 w-3.5" />
              {redCoins !== null ? redCoins.toLocaleString("ja-JP") : "—"}
              <span className="ml-0.5">部品のお店 ›</span>
            </button>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {STAGE_PART_KINDS.map((kind) => {
              const left = owned[kind] - counts[kind];
              const active = placing === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    if (active) {
                      setPlacing(null);
                      say("置くのをやめました", "info");
                    } else if (left <= 0) {
                      say(noneLeft(kind));
                    } else {
                      setPlacing(kind);
                      say(`${PART_NAMES[kind]}：点線の中をタップすると置けます（もう一度押すとやめる）`, "info");
                    }
                  }}
                  className={`flex flex-col items-center rounded-2xl border px-1 pb-1.5 pt-2 active:scale-95 ${active ? "border-[#ffd166] bg-[#ffd166]/15" : "border-white/10 bg-white/[0.04]"} ${left <= 0 && !active ? "opacity-45" : ""}`}
                  aria-pressed={active}
                  aria-label={`${PART_NAMES[kind]}（のこり${Math.max(0, left)}こ）`}
                >
                  <PinballPartArt
                    art={kind}
                    theme={theme}
                    bumperItem={nextBumperItem}
                    className="h-10 w-10 rounded-xl shadow-[0_2px_6px_rgba(0,0,0,0.45)] ring-1 ring-white/15"
                  />
                  <span className="mt-1 text-center text-[9px] font-black leading-[1.15]">{PART_NAMES[kind]}</span>
                  <span className="mt-auto pt-0.5 text-[9px] font-bold tabular-nums text-white/60">
                    {counts[kind]}/{owned[kind]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ランプ・見た目・公開 */}
        <div className="mt-4 space-y-3 rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
          <div>
            <p className="text-[12px] font-black">ランプ</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {STAGE_RAMPS.map((ramp) => {
                const need = RAMP_PART[ramp];
                const locked = need !== null && owned[need] < 1;
                const active = spec.ramp === ramp;
                return (
                  <button
                    key={ramp}
                    type="button"
                    onClick={() => {
                      if (locked) {
                        const price = PINBALL_PARTS.find((p) => p.id === need)?.price ?? 0;
                        say(`${stageRampName(spec, ramp)}は、部品のお店で買えます（赤コイン${price.toLocaleString("ja-JP")}枚）`, "info");
                        onOpenShop();
                        return;
                      }
                      setSpec((current) => ({ ...current, ramp }));
                    }}
                    className={`overflow-hidden rounded-2xl border-2 text-[11px] font-black active:scale-95 ${active ? "border-[#ff6b6b] bg-[#ff6b6b]/20" : "border-white/10 bg-white/[0.04]"} ${locked ? "text-white/45" : ""}`}
                    aria-pressed={active}
                    aria-label={locked ? `${stageRampName(spec, ramp)}（部品のお店で買えます）` : stageRampName(spec, ramp)}
                  >
                    <span className="relative block">
                      {spec.base === "blank" && ramp === "standard" ? <span className="flex h-[58px] items-center justify-center text-2xl text-white/40" aria-hidden="true">∅</span> : <PinballPartArt art={RAMP_ART[ramp]} theme={theme} className={`block h-[58px] w-full ${locked ? "opacity-35" : ""}`} />}
                      {locked ? <span className="absolute inset-0 flex items-center justify-center text-[18px]">🔒</span> : null}
                    </span>
                    <span className="block px-1 py-1.5">{stageRampName(spec, ramp)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-black">色と曲</p>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {STAGE_LOOKS.map((look) => {
                const t = getPinballTheme(look);
                const active = spec.look === look;
                return (
                  <button
                    key={look}
                    type="button"
                    onClick={() => setSpec((current) => ({ ...current, look }))}
                    className={`rounded-2xl border p-1.5 text-[9px] font-black leading-tight ${active ? "border-white" : "border-white/10"}`}
                    style={{ background: `linear-gradient(135deg, ${t.colors.bg0}, ${t.colors.bg1})` }}
                    aria-pressed={active}
                    aria-label={`${t.name}の色と曲`}
                  >
                    <span className="mx-auto mb-1 block h-3 w-3 rounded-full" style={{ background: t.colors.accent }} />
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-[12px] font-black">フレンドに公開</span>
              <span className="block text-[10px] font-bold text-white/55">公開すると、フレンドがこのステージで遊べて、ランキングが出ます</span>
            </span>
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-6 w-6 shrink-0 accent-[#ff6b6b]" />
          </label>
          {stageId ? (
            <button type="button" onClick={() => void remove()} disabled={busy !== null} className="w-full rounded-full border border-[#ff8a80]/30 py-2 text-[12px] font-black text-[#ffb4a8] active:scale-[0.99] disabled:opacity-50">
              {busy === "delete" ? "消しています…" : "このステージを消す"}
            </button>
          ) : null}
        </div>
      </div>

      {/* 下のボタン */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[#0b0d14]/95 px-4 pt-2 backdrop-blur" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-2 flex max-w-[480px] items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-bold">
            <span className="shrink-0 text-white/60">部品</span>
            <select value={placing ?? ""} onChange={(e) => { setPlacing((e.target.value || null) as StagePartKind | null); setSelected(null); }} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#20232e] px-2 py-2 text-white" aria-label="置く部品を選ぶ">
              <option value="">選ぶ・動かす</option>
              {STAGE_PART_KINDS.map((kind) => <option key={kind} value={kind} disabled={owned[kind] <= counts[kind]}>{PART_NAMES[kind]}（残り{Math.max(0, owned[kind] - counts[kind])}）</option>)}
            </select>
          </label>
          {selectedPart ? <button type="button" onClick={removeSelected} className="rounded-full bg-[#3a1418] px-3 py-2 text-[11px] font-bold text-[#ffb4a8]">選んだ部品をはずす</button> : placing ? <button type="button" onClick={() => setPlacing(null)} className="rounded-full bg-white/10 px-3 py-2 text-[11px] font-bold">選択に戻る</button> : null}
        </div>
        <div className="mx-auto flex max-w-[480px] gap-2">
          <button type="button" onClick={testPlay} className="h-12 flex-1 rounded-full border border-white/15 bg-white/10 text-[14px] font-black active:scale-[0.99]">
            ▶ テストプレイ
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy !== null || (!dirty && stageId !== null)}
            className="h-12 flex-1 rounded-full bg-[#ff6b6b] text-[14px] font-black text-white active:scale-[0.99] disabled:bg-white/10 disabled:text-white/40"
          >
            {busy === "save" ? "保存中…" : !dirty && stageId ? "保存ずみ" : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
