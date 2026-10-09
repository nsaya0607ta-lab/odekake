"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BUILDINGS, MAP_SIZE, advanceTown, buildTile, createTown,
  decodeTown, getTownStats, neighbours,
  type Tile, type Tool, type Town,
} from "@/lib/games/town-builder";

const TILE_W = 20, TILE_H = 10, ORIGIN_X = 500, ORIGIN_Y = 66;
const ORDER = Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, i) => i)
  .sort((a, b) => (Math.floor(a / MAP_SIZE) + a % MAP_SIZE) -
    (Math.floor(b / MAP_SIZE) + b % MAP_SIZE) || a - b);
const FORMAT = new Intl.NumberFormat("ja-JP");
const PALETTE: Record<Exclude<Tile, "grass" | "road" | "rail" | "park">, {
  roof: string; left: string; right: string; height: number;
}> = {
  station: { roof: "#6b94c8", left: "#a4c0db", right: "#6e95bb", height: 13 },
  house: { roof: "#e78173", left: "#ffe5bd", right: "#e8c58f", height: 17 },
  shop: { roof: "#e8af62", left: "#fff0cf", right: "#f3cd9b", height: 19 },
  factory: { roof: "#a89cba", left: "#d9d5df", right: "#aaa2b5", height: 28 },
};

function Cube({ kind, x, y }: { kind: keyof typeof PALETTE; x: number; y: number }) {
  const style = PALETTE[kind], h = style.height;
  const roof = [[x, y - h - 9], [x + 16, y - h], [x, y - h + 9], [x - 16, y - h]];
  const left = [[x - 16, y - h], [x, y - h + 9], [x, y + 9], [x - 16, y]];
  const right = [[x, y - h + 9], [x + 16, y - h], [x + 16, y], [x, y + 9]];
  const points = (v: number[][]) => v.map(p => p.join(",")).join(" ");
  return (
    <g pointerEvents="none">
      <polygon points={points(left)} fill={style.left} stroke="#867d69" strokeWidth=".7" />
      <polygon points={points(right)} fill={style.right} stroke="#867d69" strokeWidth=".7" />
      <polygon points={points(roof)} fill={style.roof} stroke="#867d69" strokeWidth=".9" />
      <path d={"M" + (x - 9) + " " + (y - 8) + "v5 M" + (x + 10) + " " + (y - 8) + "v5"}
        stroke="#fff9ec" strokeWidth="3" strokeLinecap="round" />
      {kind === "house" && <path d={"M" + (x - 3) + " " + (y + 6) + "v-7h6v10"} fill="#90663c" />}
      {kind === "station" && <text x={x} y={y - h + 1} fontSize="9" textAnchor="middle" fill="white" fontWeight="900">駅</text>}
      {kind === "factory" && <rect x={x + 5} y={y - h - 14} width="6" height="12" fill="#908a95" stroke="#7f7885" strokeWidth="1" />}
    </g>
  );
}
function TileArt({ tile, index, tiles, selected, hovered, onSelect, onHover }: {
  tile: Tile; index: number; tiles: Tile[]; selected: boolean; hovered: boolean;
  onSelect: (index: number) => void; onHover: (index: number | null) => void;
}) {
  const x = index % MAP_SIZE, y = Math.floor(index / MAP_SIZE);
  const cx = ORIGIN_X + (x - y) * TILE_W, cy = ORIGIN_Y + (x + y) * TILE_H;
  const corners = [[cx, cy - TILE_H], [cx + TILE_W, cy], [cx, cy + TILE_H], [cx - TILE_W, cy]];
  const points = corners.map(p => p.join(",")).join(" ");
  const ground = tile === "grass" ? ((x + y) % 2 ? "#9bcf91" : "#a7d69a") :
    tile === "road" ? "#89949e" : tile === "rail" ? "#b7a48d" :
    tile === "park" ? "#73ba79" : "#b4ce9a";
  const conn = neighbours(x, y).filter(n => tiles[n] === tile ||
    (tile === "rail" && tiles[n] === "station") || (tile === "station" && tiles[n] === "rail"));
  return (
    <g onClick={() => onSelect(index)} onPointerEnter={() => onHover(index)}
      onPointerLeave={() => onHover(null)} style={{ cursor: "pointer" }}>
      <polygon points={points} fill={ground} stroke="#719d75" strokeWidth=".7" />
      {tile === "road" && <>
        <circle cx={cx} cy={cy} r="2" fill="#fff1a0" pointerEvents="none" />
        {neighbours(x, y).filter(n => tiles[n] === "road").map(n => {
          const nx = n % MAP_SIZE, ny = Math.floor(n / MAP_SIZE);
          return <line key={n} x1={cx} y1={cy} x2={cx + (nx - x - (ny - y)) * TILE_W * .5}
            y2={cy + (nx - x + ny - y) * TILE_H * .5}
            stroke="#f9e8a9" strokeWidth="1.7" strokeDasharray="3 2" pointerEvents="none" />;
        })}
      </>}
      {tile === "rail" && <>
        {conn.length ? conn.map(n => {
          const nx = n % MAP_SIZE, ny = Math.floor(n / MAP_SIZE);
          return <line key={n} x1={cx} y1={cy} x2={cx + (nx - x - (ny - y)) * TILE_W * .52}
            y2={cy + (nx - x + ny - y) * TILE_H * .52}
            stroke="#4e5158" strokeWidth="5" strokeDasharray="2 3" pointerEvents="none" />;
        }) : <path d={"M" + (cx - 8) + " " + (cy - 4) + "l16 8"}
          stroke="#4e5158" strokeWidth="3" pointerEvents="none" />}
        <circle cx={cx} cy={cy} r="2" fill="#414955" pointerEvents="none" />
      </>}
      {tile === "park" && <g pointerEvents="none">
        <ellipse cx={cx + 1} cy={cy + 2} rx="12" ry="5" fill="#65a967" />
        <rect x={cx - 1.5} y={cy - 14} width="3" height="14" fill="#936946" />
        <circle cx={cx - 5} cy={cy - 13} r="8" fill="#3e9866" />
        <circle cx={cx + 5} cy={cy - 16} r="9" fill="#60b77a" />
      </g>}
      {tile !== "grass" && tile !== "road" && tile !== "rail" && tile !== "park" &&
        <Cube kind={tile} x={cx} y={cy} />}
      {tile === "grass" && (index * 17) % 47 === 0 &&
        <circle cx={cx + 2} cy={cy - 1} r="2" fill="#79b47f" pointerEvents="none" />}
      {(selected || hovered) && <polygon points={points}
        fill={selected ? "#fff1ac" : "#fff"} fillOpacity={selected ? ".22" : ".17"}
        stroke={selected ? "#f3bc47" : "#fff"} strokeWidth={selected ? "2.2" : "1.6"}
        pointerEvents="none" />}
    </g>
  );
}
export function TownBuilder({ userId }: { userId: string }) {
  const key = "odekake-town-builder:v1:" + userId;
  const [town, setTown] = useState<Town>(createTown);
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<Tool>("road");
  const [zoom, setZoom] = useState(0.82);
  const [hover, setHover] = useState<number | null>(null);
  const [notice, setNotice] = useState("まず道路を引いて、道路沿いに住宅を建ててみましょう。");
  const [inspect, setInspect] = useState(false);
  const stats = useMemo(() => getTownStats(town.tiles), [town.tiles]);
  const tiles = town.tiles;

  useEffect(() => {
    try {
      const saved = decodeTown(localStorage.getItem(key));
      if (saved) setTown(saved);
    } catch {
      // Storage can be disabled in private browsing; the game still works.
    }
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(key, JSON.stringify(town)); } catch { /* no storage available */ }
  }, [key, loaded, town]);
  useEffect(() => {
    if (!loaded || town.paused) return;
    const timer = window.setInterval(() => setTown(prev => advanceTown(prev)), 2500);
    return () => window.clearInterval(timer);
  }, [loaded, town.paused]);

  const place = (i: number) => {
    if (!loaded) return;
    const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
    if (inspect) {
      const tile = tiles[i];
      setNotice("場所 " + (x + 1) + "," + (y + 1) + "： " +
        (BUILDINGS.find(v => v.id === tile)?.title ?? "更地"));
      return;
    }
    const result = buildTile(town, tool, x, y);
    if (result.town !== town) setTown(result.town);
    setNotice(result.message);
  };
  const reset = () => {
    if (!window.confirm("この端末の街データを初期化します。元に戻せません。よろしいですか？")) return;
    setTown(createTown());
    setNotice("新しい街を始めました。");
  };
  const stat = (label: string, value: string, unit?: string) =>
    <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-2.5 text-center shadow-sm">
      <p className="text-[10px] font-bold text-[#557b61]">{label}</p>
      <p className="mt-1 text-base font-black tabular-nums text-[#304d43]">{value}<span className="ml-0.5 text-[10px]">{unit}</span></p>
    </div>;
  return (
    <main className="mx-auto max-w-[1120px] px-3 pb-16 pt-4 text-[#304d43] sm:px-6">
      <div className="rounded-[28px] border border-[#bcd6b7] bg-gradient-to-br from-[#eff9e7] via-[#e8f4e4] to-[#e0f1ed] p-4 shadow-[0_12px_30px_rgba(69,118,84,.14)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black tracking-[.14em] text-[#628d6c]">おでかけタウン・交通と街づくり</p>
            <h1 className="mt-1 text-[26px] font-black tracking-tight">ぼくのまちづくり</h1>
            <p className="mt-1 text-xs text-[#587461]">自由に建てて、街を育てよう。OpenTTDの発想を参考にしたオリジナルモード。</p>
          </div>
          <div className="rounded-2xl bg-[#377957] px-4 py-3 text-right text-white shadow-sm">
            <p className="text-[10px] font-bold opacity-80">街の予算</p>
            <p className="text-xl font-black tabular-nums">¥{FORMAT.format(town.money)}</p>
            <p className="text-[9px] opacity-75">ゲーム内専用資金</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {stat("人口", FORMAT.format(stats.population), "人")}
          {stat("駅の接続数", String(stats.linkedStations), "駅")}
          {stat("住宅", String(stats.homes), "棟")}
          {stat("商店・工場", String(stats.shops + stats.factories), "棟")}
          {stat("満足度", String(stats.happiness), "%")}
          {stat("6日ごとの収支", (stats.income - stats.upkeep >= 0 ? "+" : "") + FORMAT.format(stats.income - stats.upkeep), "円")}
        </div>
      </div>

      <div className="mt-4 rounded-[25px] border border-[#d6e3ca] bg-[#f6faef] p-3 shadow-[0_8px_20px_rgba(67,96,62,.09)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-extrabold text-[#4c6e57]">DAY {town.day}　{town.paused ? "一時停止中" : "街が成長中"}</div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setTown(prev => ({ ...prev, paused: !prev.paused }))}
              className="rounded-xl bg-[#487c60] px-3 py-2 text-xs font-bold text-white">
              {town.paused ? "▶ 再開" : "Ⅱ 一時停止"}
            </button>
            <button type="button" onClick={() => setZoom(v => Math.max(.62, +(v - .12).toFixed(2)))}
              className="rounded-xl border border-[#c6d7bc] bg-white px-3 py-2 font-bold">−</button>
            <span className="w-10 text-center text-[11px] font-bold">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom(v => Math.min(1.38, +(v + .12).toFixed(2)))}
              className="rounded-xl border border-[#c6d7bc] bg-white px-3 py-2 font-bold">＋</button>
          </div>
        </div>
        <div className="relative max-h-[580px] min-h-[340px] overflow-auto rounded-[20px] border border-[#a6cbb2] bg-gradient-to-b from-[#c9ebdf] via-[#d9f0d1] to-[#b6dab2]">
          <svg viewBox="0 0 1000 585" width={Math.round(1000 * zoom)}
            height={Math.round(585 * zoom)} role="img"
            aria-label="24×24マスの街の建設マップ。タイルを選んで建設できます。"
            className="mx-auto block max-w-none select-none">
            <defs>
              <radialGradient id="town-sky"><stop stopColor="#edfad9"/><stop offset="1" stopColor="#b8e6cd"/></radialGradient>
            </defs>
            <rect width="1000" height="585" fill="url(#town-sky)" />
            <ellipse cx="500" cy="314" rx="490" ry="245" fill="#75bd9a" opacity=".23" />
            {ORDER.map(i => <TileArt key={i} index={i} tile={tiles[i]} tiles={tiles}
              hovered={hover === i} selected={false} onSelect={place} onHover={setHover} />)}
            <text x="500" y="560" textAnchor="middle" fontSize="13" fill="#487c60" fontWeight="bold">
              マップを横にスクロールできます • タップで建設
            </text>
          </svg>
        </div>
        <p role="status" aria-live="polite" className="mt-2 min-h-8 rounded-xl bg-white/70 px-3 py-2 text-[12px] font-bold text-[#4b7554]">{notice}</p>
      </div>

      <section className="mt-4 rounded-[25px] border border-[#d6dfca] bg-white/90 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black">建設メニュー</h2>
            <p className="text-[11px] text-[#718278]">建てたいものを選び、マップのマスをタップ</p>
          </div>
          <button type="button" onClick={() => setInspect(v => !v)}
            className={"rounded-xl px-3 py-2 text-[11px] font-bold " + (inspect ? "bg-[#397e60] text-white" : "bg-[#edf4e9] text-[#397e60]")}>
            {inspect ? "調査中 ✓" : "🔍 調査"}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BUILDINGS.map(item => <button key={item.id} type="button"
            aria-pressed={tool === item.id && !inspect} title={item.info}
            onClick={() => { setTool(item.id); setInspect(false); setNotice(item.info); }}
            className={"flex items-center gap-3 rounded-2xl border p-3 text-left transition-transform active:scale-[.98] " +
              (tool === item.id && !inspect ? "border-[#38835c] bg-[#dff2da] ring-2 ring-[#69a779]" :
                "border-[#d9e8d6] bg-[#f8fbf4]")}>
            <span className="text-2xl">{item.icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-black">{item.title}</span>
              <span className="block text-[11px] font-bold text-[#67806d]">{item.price ? "¥" + FORMAT.format(item.price) : "無料"}</span>
            </span>
          </button>)}
        </div>
      </section>

      <section className="mt-4 rounded-[25px] border border-[#d6dfca] bg-white/90 p-4 text-xs leading-relaxed text-[#5c7462] shadow-sm">
        <h2 className="text-base font-black text-[#304d43]">街の育てかた</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1">
          <li>道路を5マス以上つなぎ、道路の隣に住宅を2つ以上建てる</li>
          <li>商店・工場を追加して街の収入を増やす</li>
          <li>駅を2つ作り、線路でつなぐと輸送収入と街の成長速度が上がる</li>
          <li>時間を進めると道路沿いに建物が増えていく</li>
        </ol>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10px] text-[#789080]">この端末・このアカウントに自動保存。既存のコイン・ランキングには影響しません。</span>
          <button type="button" onClick={reset} className="rounded-xl border border-[#efd3c5] bg-[#fff7f1] px-3 py-2 text-[11px] font-black text-[#a55f4d]">
            街をはじめから作る
          </button>
        </div>
      </section>
    </main>
  );
}
