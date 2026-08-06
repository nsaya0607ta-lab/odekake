"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

export type MunicipalityArea = {
  code: string;
  name: string;
  d: string | null;
  center: [number, number] | null;
  span: number;
  spotCount: number;
  visitCount: number;
  favoriteCount: number;
  level: number;
};

export type MapFrame = { id: string; label: string; frame: [number, number, number, number] };

const FILL = ["#efece2", "#dfead0", "#c6dcae", "#a8c98a", "#8fb36c"];
const STROKE = ["#c9c2b1", "#b5c69c", "#9db684", "#82a76a", "#6b9455"];

function mapLabel(name: string): string {
  return name.replace(/^.+郡/, "");
}

function overlap(a: DOMRect, b: DOMRect, pad = 4) {
  return !(
    a.right + pad < b.left ||
    a.left - pad > b.right ||
    a.bottom + pad < b.top ||
    a.top - pad > b.bottom
  );
}

function parseViewBox(viewBox: string): [number, number, number, number] {
  const values = viewBox.split(" ").map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return [0, 0, 1, 1];
  return values as [number, number, number, number];
}

export function MunicipalityMap({
  prefectureName,
  viewBox,
  insets,
  areas,
  hrefBase,
  hrefSuffix = "",
  showLabels = false,
  className,
}: {
  prefectureName: string;
  viewBox: string;
  insets: MapFrame[];
  areas: MunicipalityArea[];
  hrefBase: string;
  hrefSuffix?: string;
  showLabels?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set());
  const fallbackViewBox = useMemo(() => parseViewBox(viewBox), [viewBox]);
  const [fittedViewBox, setFittedViewBox] = useState<[number, number, number, number]>(fallbackViewBox);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mapContentRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    setFittedViewBox(fallbackViewBox);
  }, [fallbackViewBox]);

  useEffect(() => {
    const group = mapContentRef.current;
    if (!group) return;

    const fit = () => {
      try {
        const box = group.getBBox();
        if (!box.width || !box.height) return;
        const pad = Math.max(box.width, box.height) * 0.06;
        setFittedViewBox([
          box.x - pad,
          box.y - pad,
          box.width + pad * 2,
          box.height + pad * 2,
        ]);
      } catch {
        setFittedViewBox(fallbackViewBox);
      }
    };

    const raf = window.requestAnimationFrame(() => {
      fit();
      window.requestAnimationFrame(fit);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [areas, insets, fallbackViewBox]);

  const [minX, minY, boxWidth, boxHeight] = fittedViewBox;
  const scale = Math.max(boxWidth, boxHeight);
  const strokeWidth = scale / 420;
  const markerRadius = scale / 90;
  const smallThreshold = markerRadius * 2.4;
  const labelSize = scale / (areas.length > 18 ? 54 : areas.length > 12 ? 48 : areas.length > 8 ? 42 : 36);
  const aspect = boxHeight > 0 ? boxWidth / boxHeight : 1;
  const frameHeight = Math.max(420, Math.min(720, 390 / Math.max(aspect, 0.55)));

  const activeCode = pressed ?? active;
  const activeArea = areas.find((municipality) => municipality.code === activeCode) ?? null;
  const hrefOf = (code: string) => `${hrefBase}/${code}${hrefSuffix}`;

  const beginPress = (code: string) => {
    const href = hrefOf(code);
    setActive(code);
    setPressed(code);
    router.prefetch(href);
  };

  const open = (code: string) => {
    const href = hrefOf(code);
    setActive(code);
    setPressed(code);
    router.push(href);
    window.setTimeout(() => {
      setPressed((current) => (current === code ? null : current));
    }, 900);
  };

  const onPointerLeave = (event: PointerEvent<SVGGElement>, code: string) => {
    if (event.pointerType === "mouse") {
      setActive((current) => (current === code ? null : current));
      setPressed((current) => (current === code ? null : current));
    }
  };

  const labelCodes = useMemo(() => areas.filter((area) => area.center).map((area) => area.code), [areas]);

  const recomputeLabels = () => {
    if (!showLabels || !svgRef.current) return;
    const nextHidden = new Set<string>();
    const boxes: DOMRect[] = [];
    for (const code of labelCodes) {
      const node = svgRef.current.querySelector<SVGTextElement>(`[data-label-code="${code}"]`);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      if (boxes.some((other) => overlap(box, other))) {
        nextHidden.add(code);
      } else {
        boxes.push(box);
      }
    }
    setHiddenLabels(nextHidden);
  };

  useEffect(() => {
    const raf = window.requestAnimationFrame(recomputeLabels);
    return () => window.cancelAnimationFrame(raf);
  }, [showLabels, fittedViewBox, labelCodes]);

  return (
    <div className={className}>
      <div className="w-full overflow-hidden" style={{ height: `${frameHeight}px` }}>
        <svg
          ref={svgRef}
          viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label={`${prefectureName}の市区町村地図`}
          className="h-full w-full"
          style={{ touchAction: "manipulation" }}
        >
          <g ref={mapContentRef}>
            {insets.map((inset) => (
              <g key={inset.id} pointerEvents="none">
                <rect
                  x={inset.frame[0]}
                  y={inset.frame[1]}
                  width={inset.frame[2]}
                  height={inset.frame[3]}
                  rx={scale / 50}
                  fill="#fbf8f0"
                  stroke="#c8c1b0"
                  strokeWidth={strokeWidth * 1.3}
                  strokeDasharray={`${strokeWidth * 5} ${strokeWidth * 4}`}
                />
                <text
                  x={inset.frame[0] + inset.frame[2] / 2}
                  y={inset.frame[1] - scale / 110}
                  textAnchor="middle"
                  fontSize={scale / 38}
                  fill="#7b7466"
                >
                  {inset.label}
                </text>
              </g>
            ))}

            {areas.map((area) => {
              if (!area.d) return null;
              const isActive = activeCode === area.code;
              return (
                <g
                  key={area.code}
                  role="link"
                  tabIndex={0}
                  aria-label={`${area.name}${area.level > 0 ? "（訪問済み）" : "（未訪問）"}`}
                  onPointerDown={() => beginPress(area.code)}
                  onPointerCancel={() => setPressed((current) => (current === area.code ? null : current))}
                  onPointerEnter={() => setActive(area.code)}
                  onPointerLeave={(event) => onPointerLeave(event, area.code)}
                  onClick={() => open(area.code)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      open(area.code);
                    }
                  }}
                  onFocus={() => setActive(area.code)}
                  onBlur={() => {
                    setActive((current) => (current === area.code ? null : current));
                    setPressed((current) => (current === area.code ? null : current));
                  }}
                  className="cursor-pointer outline-none"
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    transform: pressed === area.code ? "scale(0.975)" : "scale(1)",
                    filter: pressed === area.code ? "brightness(0.93)" : "none",
                    transition: "transform 70ms ease-out, filter 70ms ease-out",
                  }}
                >
                  <title>{area.name}</title>
                  <path
                    d={area.d}
                    fill={FILL[area.level] ?? FILL[0]}
                    stroke={isActive ? "#5d8049" : (STROKE[area.level] ?? STROKE[0])}
                    strokeWidth={isActive ? strokeWidth * 3 : strokeWidth}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {area.center ? (
                    <circle
                      cx={area.center[0]}
                      cy={area.center[1]}
                      r={Math.max(markerRadius * 2.6, scale / 55)}
                      fill="transparent"
                      pointerEvents="all"
                    />
                  ) : null}
                  {area.center && area.span < smallThreshold ? (
                    <circle
                      cx={area.center[0]}
                      cy={area.center[1]}
                      r={markerRadius}
                      fill={FILL[area.level] ?? FILL[0]}
                      stroke={isActive ? "#5d8049" : (STROKE[area.level] ?? STROKE[0])}
                      strokeWidth={isActive ? strokeWidth * 2.6 : strokeWidth * 1.4}
                    />
                  ) : null}
                </g>
              );
            })}

            {showLabels
              ? areas.map((area) =>
                  area.center ? (
                    <text
                      data-label-code={area.code}
                      key={`label-${area.code}`}
                      x={area.center[0]}
                      y={area.center[1]}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={labelSize}
                      fontWeight={activeCode === area.code ? 700 : 600}
                      fill={activeCode === area.code ? "#4f743d" : "#3c382f"}
                      stroke="#fdfbf5"
                      strokeWidth={labelSize * 0.36}
                      paintOrder="stroke"
                      strokeLinejoin="round"
                      pointerEvents="none"
                      opacity={hiddenLabels.has(area.code) ? 0 : 1}
                    >
                      {mapLabel(area.name)}
                    </text>
                  ) : null,
                )
              : activeArea?.center ? (
                  <text
                    x={activeArea.center[0]}
                    y={activeArea.center[1] - markerRadius * 2.2}
                    textAnchor="middle"
                    fontSize={scale / 26}
                    fontWeight={700}
                    fill="#3c382f"
                    stroke="#fdfbf5"
                    strokeWidth={scale / 90}
                    paintOrder="stroke"
                    strokeLinejoin="round"
                    pointerEvents="none"
                  >
                    {activeArea.name}
                  </text>
                ) : null}
          </g>
        </svg>
      </div>

      {showLabels ? (
        <button type="button" className="sr-only" onClick={recomputeLabels}>
          ラベル配置を再計算
        </button>
      ) : null}

      <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-ink-faint">
        <span>未訪問</span>
        {FILL.map((fill, index) => (
          <span
            key={fill}
            aria-hidden
            className="inline-block h-3 w-5 rounded-[3px] border"
            style={{ backgroundColor: fill, borderColor: STROKE[index] }}
          />
        ))}
        <span>訪問が多い</span>
      </div>
    </div>
  );
}
