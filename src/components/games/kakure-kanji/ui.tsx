"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./kakure-kanji.module.css";

/** 下から出るシート（center のときはまんなかのダイアログ）。Esc・背景タップで閉じる */
export function Sheet({
  title,
  onClose,
  children,
  center = false,
  closable = true,
  hideTitle = false,
}: {
  title: string;
  hideTitle?: boolean;
  onClose: () => void;
  children: ReactNode;
  center?: boolean;
  closable?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closable) close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus?.({ preventScroll: true });
    };
  }, [closable]);

  return (
    <div
      className={styles.veil}
      data-center={center ? "true" : undefined}
      onPointerDown={(event) => {
        if (closable && event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={panel} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className={styles.sheetHead} style={hideTitle ? { marginBottom: 0 } : undefined}>
          <h2 id={titleId} className={hideTitle ? styles.srOnly : undefined}>
            {title}
          </h2>
          {closable && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="閉じる">
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stars({ value, max = 3, label }: { value: number; max?: number; label?: string }) {
  return (
    <span className={styles.stars} role="img" aria-label={label ?? `星${value}つ`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} data-on={i < value ? "true" : "false"} aria-hidden="true">
          ★
        </i>
      ))}
    </span>
  );
}

export function CoinPill({ coins, label = "墨コイン" }: { coins: number; label?: string }) {
  return (
    <span className={styles.pill} aria-label={`${label} ${coins}枚`}>
      <span className={styles.coinDot} aria-hidden="true" />
      {coins.toLocaleString("ja-JP")}
    </span>
  );
}

export function Segment<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <span className={styles.segment} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </span>
  );
}

/** 画面の高さを、キーボードが出ている分も含めた「見えている高さ」に合わせる（入力欄がかくれないように） */
export function useVisualViewport(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--kk-vh", `${Math.round(vv.height)}px`);
        el.style.top = `${Math.max(0, Math.round(vv.offsetTop))}px`;
      });
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, [ref]);
}
