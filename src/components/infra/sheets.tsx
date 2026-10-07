"use client";

/**
 * 下から出てくるシート：パーツを置く・パーツの様子を見る（大きさを変える・外す）。
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Glyph } from "./glyphs";
import { PARTS, SLOT_KIND, partCost, slotLabel, yen, type Placement, type SlotId } from "./model";
import type { InfraSim } from "./sim";
import styles from "./infra.module.css";

export function BottomSheet({ open, onClose, children, label, light }: { open: boolean; onClose: () => void; children: ReactNode; label: string; light?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <>
      <div className={styles.sheetVeil} data-light={light ? "1" : undefined} onClick={onClose} aria-hidden="true" />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={label}>
        <span className={styles.grabber} aria-hidden="true" />
        {children}
      </div>
    </>,
    document.body,
  );
}

type PartSheetProps = {
  slot: SlotId | null;
  placements: readonly Placement[];
  fixed: ReadonlySet<SlotId>;
  budget: number;
  sim: InfraSim | null;
  /** このパーツをはじめて見る（このステージで新しく出てきた） */
  isNew: boolean;
  onClose: () => void;
  onPlace: (slot: SlotId, size: number) => void;
  onRemove: (slot: SlotId) => void;
};

export function PartSheet({ slot, placements, fixed, budget, sim, isNew, onClose, onPlace, onRemove }: PartSheetProps) {
  const [, force] = useState(0);
  // 本番中は、数字を少しずつ新しくする
  useEffect(() => {
    if (!slot || !sim) return;
    const id = window.setInterval(() => force((n) => n + 1), 400);
    return () => window.clearInterval(id);
  }, [slot, sim]);

  if (!slot) return null;
  const kind = SLOT_KIND[slot];
  const spec = PARTS[kind];
  const current = placements.find((p) => p.slot === slot) ?? null;
  const total = placements.reduce((s, p) => s + partCost(p.kind, p.size), 0);
  const others = total - (current ? partCost(current.kind, current.size) : 0);
  const node = sim?.nodes.get(slot) ?? null;
  const isFixed = fixed.has(slot);

  return (
    <BottomSheet open onClose={onClose} label={spec.name} light={Boolean(sim)}>
      <div className={styles.partHead} style={{ "--c": spec.color } as CSSProperties}>
        <span className={styles.partIcon}>
          <Glyph id={kind} size={34} strokeWidth={1.7} />
        </span>
        <div>
          <p className={styles.partEn}>
            {spec.en}
            {isNew ? <span className={styles.newBadge}>NEW</span> : null}
          </p>
          <h2 className={styles.partName}>{current ? slotLabel(slot) : spec.name}</h2>
          <p className={styles.partRole}>{spec.role}</p>
        </div>
      </div>
      <p className={styles.analogy}>
        <span>たとえると</span>
        {spec.analogy}
      </p>

      {node ? <LiveStats sim={sim!} slot={slot} /> : null}

      <div className={styles.sizeList} role="radiogroup" aria-label="大きさ">
        {spec.sizes.map((s, i) => {
          const cost = s.cost;
          const over = others + cost > budget;
          const selected = current?.size === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={selected}
              className={styles.sizeOption}
              data-on={selected ? "1" : undefined}
              disabled={over && !selected}
              onClick={() => onPlace(slot, i)}
            >
              <span className={styles.sizeName}>{spec.sizes.length > 1 ? `${s.label} サイズ` : current ? "設置ずみ" : "置く"}</span>
              <span className={styles.sizeCap}>
                {kind === "worker" ? `同時に ${s.cap}件` : kind === "queue" ? "仕事をためておける" : `同時に ${s.cap}件・待ち ${s.queue}件まで`}
              </span>
              <span className={styles.sizeCost}>
                {yen(cost)}
                <small>/月</small>
              </span>
              {over && !selected ? <span className={styles.overBudget}>予算オーバー</span> : null}
            </button>
          );
        })}
      </div>
      <p className={styles.budgetLine}>
        いまの月額 {yen(total)}
        {Number.isFinite(budget) ? ` ／ 予算 ${yen(budget)}` : ""}
      </p>
      <div className={styles.sheetActions}>
        {current && !isFixed ? (
          <button type="button" className={styles.btnGhost} onClick={() => onRemove(slot)}>
            外す
          </button>
        ) : null}
        {current && isFixed ? <span className={styles.fixedNote}>はじめから置いてあるパーツは外せません</span> : null}
        <button type="button" className={styles.btn} onClick={onClose}>
          閉じる
        </button>
      </div>
    </BottomSheet>
  );
}

function LiveStats({ sim, slot }: { sim: InfraSim; slot: SlotId }) {
  const node = sim.nodes.get(slot);
  if (!node) return null;
  const rows: [string, string][] = [];
  if (node.down) rows.push(["状態", "停止中"]);
  else if (node.cap > 0 && node.kind !== "queue") rows.push(["処理中", `${node.busy.length} / ${node.cap}`]);
  if (node.qmax > 0 && node.kind !== "queue") rows.push(["待ち", `${node.wait.length} / ${node.qmax}`]);
  if (node.kind === "cache" || node.kind === "cdn") rows.push(["ヒット率", `${Math.round(sim.hitRate(node) * 100)}%`]);
  if (node.kind === "queue") rows.push(["たまっている仕事", `${node.jobs.length}件`]);
  if (node.kind === "waf") rows.push(["防いだ攻撃", `${node.blocked}件`]);
  if (node.kind === "db" || node.kind === "replica") rows.push(["役わり", sim.primaryDb === slot ? "本番" : "予備（読みこみ担当）"]);
  rows.push(["処理した数", `${node.served}件`]);
  if (node.dropped) rows.push(["断った数（503）", `${node.dropped}件`]);
  return (
    <dl className={styles.liveStats}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
