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
export type MunicipalityLabelStyle = "inline" | "callout";

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

type CalloutEntry = {
  area: MunicipalityArea & { center: [number, number] };
  side: "left" | "right";
  y: number;
};

export function MunicipalityMap({
  prefectureName,
  viewBox,
  insets,
  areas,
  hrefBase,
  hrefSuffix = "",
  showLabels = false,
  labelStyle = "inline",
  className,
}: {
  prefectureName: string;
  viewBox: string;
  insets: MapFrame[];
  areas: MunicipalityArea[];
  hrefBase: string;
  hrefSuffix?: string;
  showLabels?: boolean;
  labelStyle?: MunicipalityLabelStyle;
  className?: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set());
  const fallbackViewBox = useMemo(() => parseViewBox(viewBox), [viewBox]);
  const [fittedViewBox, setFittedViewBox] = useState<[number, number, number, number]>(fallbackViewBox);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setFittedViewBox(fallbackViewBox);
  }, [fallbackViewBox]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const fit = () => {
      try {
        const shapes = Array.from(svg.querySelectorAll<SVGPathElement>("[data-map-shape='true']"));
        if (shapes.length === 0) return;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const shape of shapes) {
          const box = shape.getBBox();
          if (!box.width || !box.height) continue;
          minX = Math.min(minX, box.x);
          minY = Math.min(minY, box.y);
          maxX = Math.max(maxX, box.x + box.width);
          maxY = Math.max(maxY, box.y + box.height);
        }

        if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;
        const width = Math.max(maxX - minX, 0.001);
        const height = Math.max(maxY - minY, 0.001);

        if (labelStyle === "callout") {
          // 参考画像のように中央に地図、左右に市区町村名を置くため横方向だけ広めに余白を作る。
          // 地図自体は表示領域の約60%を使うので、従来のように中央で潰れない。
          const padX = width * 0.34;
          const padY = height * 0.07;
          setFittedViewBox([minX - padX, minY - padY, width + padX * 2, height + padY * 2]);
        } else {
          const pad = Math.max(width, height) * 0.055;
          setFittedViewBox([minX - pad, minY - pad, width + pad * 2, height + pad * 2]);
        }
      } catch {
        setFittedViewBox(fallbackViewBox);
      }
    };

    const first = window.requestAnimationFrame(() => {
      fit();
      window.requestAnimationFrame(fit);
    });
    return () => window.cancelAnimationFrame(first);
  }, [areas, fallbackViewBox, labelStyle]);

  const [minX, minY, boxWidth, boxHeight] = fittedViewBox;
  const scale = Math.max(boxWidth, boxHeight);
  const strokeWidth = scale / 420;
  const markerRadius = scale / 90;
  const smallThreshold = markerRadius * 2.4;
  const labelSize = scale / (areas.length > 18 ? 54 : areas.length > 12 ? 48 : areas.length > 8 ? 42 : 36);
  const aspect = boxHeight > 0 ? boxWidth / boxHeight : 1;
  const frameHeight =
    labelStyle === "callout"
      ? Math.max(500, Math.min(620, 520 / Math.max(aspect, 0.82)))
      : Math.max(420, Math.min(720, 390 / Math.max(aspect, 0.55)));

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

  const recomputeLabels = useMemo(
    () => () => {
      if (!showLabels || labelStyle !== "inline" || !svgRef.current) return;
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
    },
    [showLabels, labelStyle, labelCodes],
  );

  useEffect(() => {
    const raf = window.requestAnimationFrame(recomputeLabels);
    return () => window.cancelAnimationFrame(raf);
  }, [recomputeLabels, fittedViewBox]);

  const callouts = useMemo<CalloutEntry[]>(() => {
    if (!showLabels || labelStyle !== "callout") return [];
    const positioned = areas.filter(
      (area): area is MunicipalityArea & { center: [number, number] } => area.center !== null && area.d !== null,
    );
    if (positioned.length === 0) return [];

    const byX = [...positioned].sort((a, b) => a.center[0] - b.center[0]);
    const leftCount = Math.ceil(byX.length / 2);
    const left = byX.slice(0, leftCount).sort((a, b) => a.center[1] - b.center[1]);
    const right = byX.slice(leftCount).sort((a, b) => a.center[1] - b.center[1]);

    const distribute = (
      list: Array<MunicipalityArea & { center: [number, number] }>,
      side: "left" | "right",
    ): CalloutEntry[] => {
      if (list.length === 0) return [];
      const top = minY + boxHeight * 0.09;
      const usable = boxHeight * 0.82;
      return list.map((area, index) => ({
        area,
        side,
        y: top + (usable * (index + 0.5)) / list.length,
      }));
    };

    return [...distribute(left, "left"), ...distribute(right, "right")];
  }, [areas, boxHeight, labelStyle, minY, showLabels]);

  const calloutWidth = boxWidth * 0.235;
  const maxCalloutsPerSide = Math.max(
    1,
    callouts.filter((item) => item.side === "left").length,
    callouts.filter((item) => item.side === "right").length,
  );
  const calloutHeight = Math.min(boxHeight * 0.105, (boxHeight * 0.72) / maxCalloutsPerSide);
  const calloutFontSize = Math.min(calloutHeight * 0.42, boxWidth * 0.027);

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
          {labelStyle === "inline"
            ? insets.map((inset) => (
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
              ))
            : null}

          {labelStyle === "callout"
            ? callouts.map(({ area, side, y }) => {
                const labelX = side === "left" ? minX + boxWidth * 0.025 : minX + boxWidth * 0.975 - calloutWidth;
                const lineStartX = side === "left" ? labelX + calloutWidth : labelX;
                return (
                  <line
                    key={`line-${area.code}`}
                    x1={lineStartX}
                    y1={y}
                    x2={area.center[0]}
                    y2={area.center[1]}
                    stroke="#c8c1b0"
                    strokeWidth={strokeWidth * 1.15}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                );
              })
            : null}

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
                  data-map-shape="true"
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
                {labelStyle === "inline" && area.center && area.span < smallThreshold ? (
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

          {showLabels && labelStyle === "inline"
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
            : showLabels && labelStyle === "callout"
              ? callouts.map(({ area, side, y }) => {
                  const x = side === "left" ? minX + boxWidth * 0.025 : minX + boxWidth * 0.975 - calloutWidth;
                  const isActive = activeCode === area.code;
                  return (
                    <g
                      key={`callout-${area.code}`}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer outline-none"
                      aria-label={`${area.name}を開く`}
                      onPointerDown={() => beginPress(area.code)}
                      onPointerEnter={() => setActive(area.code)}
                      onPointerLeave={(event) => onPointerLeave(event, area.code)}
                      onClick={() => open(area.code)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          open(area.code);
                        }
                      }}
                    >
                      <rect
                        x={x}
                        y={y - calloutHeight / 2}
                        width={calloutWidth}
                        height={calloutHeight}
                        rx={calloutHeight / 2}
                        fill={isActive ? "#eef5e6" : "#fffdf8"}
                        stroke={isActive ? "#7da25f" : "#c8c1b0"}
                        strokeWidth={strokeWidth * (isActive ? 2 : 1.2)}
                      />
                      <text
                        x={x + calloutWidth / 2}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={calloutFontSize}
                        fontWeight={700}
                        fill="#3c382f"
                        pointerEvents="none"
                      >
                        {mapLabel(area.name)}
                      </text>
                    </g>
                  );
                })
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
        </svg>
      </div>

      {showLabels && labelStyle === "inline" ? (
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
