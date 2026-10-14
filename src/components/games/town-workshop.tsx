"use client";

import { useEffect, useRef, useState } from "react";
import { FACILITY_PARTS, PARK_CATEGORIES, PARK_PARTS, PARK_SIZES, type FacilityPart, type ParkCategory, type ParkLot, type ParkPart, type ParkSize, type Tile } from "@/lib/games/town-builder";
import { drawTownPartIcon } from "@/lib/games/town-renderer";
import { WhitePrice } from "./town-rpg";
import styles from "./town-builder.module.css";

function PartIcon({ part }: { part: ParkPart | FacilityPart }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext("2d"); if (c) { c.setTransform(2, 0, 0, 2, 0, 0); drawTownPartIcon(c, part, 60, 48); } }, [part]);
  return <canvas ref={ref} width={120} height={96} className={styles.partIcon} aria-hidden="true" />;
}

export function ParkPurchase({ kind, size, rotated, money, onKind, onSize, onRotate, onPlace }: {
  kind: ParkLot["kind"]; size: ParkSize; rotated: boolean; money: number;
  onKind: (kind: ParkLot["kind"]) => void; onSize: (size: ParkSize) => void; onRotate: () => void; onPlace: () => void;
}) {
  const shape = PARK_SIZES.find(s => s.id === size)!;
  return <>
    <div className={styles.categories}>{(["park", "plaza"] as const).map(k => <button type="button" key={k} aria-pressed={kind === k} onClick={() => onKind(k)}>{k === "park" ? "公園" : "広場"}</button>)}</div>
    <div className={styles.landCatalog}>{PARK_SIZES.map(s => <button type="button" key={s.id} aria-label={`${rotated ? `${s.height}×${s.width}` : s.title}の敷地 白コイン${s.price}枚`} aria-pressed={size === s.id} onClick={() => onSize(s.id)}>
      <span className={styles.landShape} data-kind={kind} style={{ gridTemplateColumns: `repeat(${rotated ? s.height : s.width}, 1fr)` }} aria-hidden="true">{Array.from({ length: s.width * s.height }, (_, i) => <i key={i} />)}</span>
      <b>{rotated ? `${s.height}×${s.width}` : s.title}</b><small><WhitePrice amount={s.price} /></small>
    </button>)}</div>
    <div className={styles.purchaseActions}>
      <button type="button" className={styles.rotatePart} aria-label="敷地の向きを変える" aria-pressed={rotated} onClick={onRotate}>↻ 向き</button>
      <button type="button" className={styles.placeLot} disabled={money < shape.price} onClick={onPlace}>この敷地を置く <span><WhitePrice amount={shape.price} /></span></button>
    </div>
    <p className={styles.toolDescription}>敷地を置いたら、好きな部品を買って配置。</p>
  </>;
}

export function ParkWorkshop({ lot, part, rotation, money, onPart, onRotate, onExpand, onRemoveLot }: {
  lot: ParkLot; part: ParkPart | "remove"; rotation: number; money: number;
  onPart: (part: ParkPart | "remove") => void; onRotate: () => void; onExpand: (size: ParkSize) => void; onRemoveLot: () => void;
}) {
  const selected = PARK_PARTS.find(p => p.id === part);
  const [category, setCategory] = useState<ParkCategory>(selected?.category ?? "植栽");
  return <>
    <div className={styles.partCategories} aria-label="部品の種類">{PARK_CATEGORIES.map(k => <button type="button" key={k} aria-label={k} aria-pressed={category === k} onClick={() => setCategory(k)}>{k}<small>{PARK_PARTS.filter(p => p.category === k).length}</small></button>)}</div>
    <div className={styles.partCatalog}>{PARK_PARTS.filter(p => p.category === category).map(p => <button type="button" key={p.id} aria-label={`${p.title} 白コイン${p.price}枚`} aria-pressed={part === p.id} disabled={money < p.price} onClick={() => onPart(p.id)}>
      <PartIcon part={p.id} /><b>{p.title}</b><small><WhitePrice amount={p.price} /></small>
    </button>)}<button type="button" aria-label="部品を撤去" aria-pressed={part === "remove"} onClick={() => onPart("remove")}><span className={styles.partRemoveIcon} aria-hidden="true">−</span><b>撤去</b><small>敷地は残る</small></button></div>
    <div className={styles.workshopHint}><span>{part === "remove" ? "外す部品をタップ" : `${selected?.title} · 敷地のマスをタップ`}</span><button type="button" className={styles.rotatePart} aria-label="部品の向きを変える" disabled={part === "remove"} onClick={onRotate}>↻ {rotation * 90}°</button></div>
    <details className={styles.lotDetails}><summary>敷地の変更</summary><div className={styles.expandSizes}>{PARK_SIZES.map(s => <button type="button" key={s.id} disabled={s.width * s.height <= lot.width * lot.height || money < s.price - (PARK_SIZES.find(p => p.width * p.height === lot.width * lot.height)?.price ?? 140)} onClick={() => onExpand(s.id)}>{s.title}へ拡張<small><WhitePrice amount={Math.max(0, s.price - (PARK_SIZES.find(p => p.width * p.height === lot.width * lot.height)?.price ?? 140))} /></small></button>)}</div><button type="button" className={styles.removeLot} onClick={onRemoveLot}>敷地ごと撤去</button></details>
  </>;
}

export function FacilityWorkshop({ kind, installed, money, onBuy, onRemove }: {
  kind: Tile; installed: FacilityPart[]; money: number; onBuy: (part: FacilityPart) => void; onRemove: (part: FacilityPart) => void;
}) {
  return <div className={styles.facilityCatalog}>{FACILITY_PARTS.filter(p => p.kinds.includes(kind)).map(p => {
    const owned = installed.includes(p.id);
    return <div key={p.id} className={styles.facilityOption} data-owned={owned}>
      <button type="button" aria-label={`${p.title}を購入 白コイン${p.price}枚`} disabled={owned || money < p.price} onClick={() => onBuy(p.id)}><PartIcon part={p.id} /><b>{p.title}</b><small>{owned ? "✓ 購入済み" : <WhitePrice amount={p.price} />}</small><span>{p.id === "terrace" ? kind === "house" ? "定員＋6人" : "経済力＋14" : p.info}</span></button>
      {owned && <button type="button" className={styles.removeAttachment} aria-label={`${p.title}を取り外す`} onClick={() => onRemove(p.id)}>取り外す</button>}
    </div>;
  })}</div>;
}
