"use client";

/**
 * アプリの画面のダイアログたち（iPhone の最新の見た目に寄せている）
 * - HideAlert：× を押したときの「○○を非表示にしますか？」
 * - ScreenMenu：何もないところ（ウィジェットも）を長押ししたときのメニュー（編集・非表示のアプリを再表示）
 * - HiddenSheet：非表示にしたアプリの一覧。「再表示」でホーム画面にもどす
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./launcher.module.css";

/** 出すときに1フレームおいて、ふわっと出す */
function useShown(): [boolean, () => void] {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return [shown, () => setShown(false)];
}

export function HideAlert({ name, icon, isFolder, onCancel, onHide, rootStyle }: {
  name: string;
  icon: ReactNode;
  isFolder: boolean;
  onCancel: () => void;
  onHide: () => void;
  rootStyle: CSSProperties;
}) {
  const [shown, hide] = useShown();
  const close = (then: () => void) => {
    hide();
    window.setTimeout(then, 200);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(onCancel);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return createPortal(
    <div className={styles.alertVeil} data-open={shown} style={rootStyle} onPointerDown={(e) => e.stopPropagation()}>
      <div className={styles.alert} role="alertdialog" aria-modal="true" aria-labelledby="launcher-alert-title" aria-describedby="launcher-alert-msg">
        <div className={styles.alertIcon}>{icon}</div>
        <p id="launcher-alert-title" className={styles.alertTitle}>「{name}」を非表示にしますか？</p>
        <p id="launcher-alert-msg" className={styles.alertMsg}>
          {isFolder ? "フォルダの中のアプリもいっしょに、" : ""}ホーム画面から見えなくなります。消えるわけではないので、画面を長押しして「再表示」からいつでも元にもどせます。
        </p>
        <div className={styles.alertActions}>
          <button type="button" onClick={() => close(onCancel)} autoFocus>キャンセル</button>
          <button type="button" className={styles.destructive} onClick={() => close(onHide)}>非表示</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ScreenMenu({ x, y, hiddenCount, onClose, onEdit, onReshow, rootStyle }: {
  x: number;
  y: number;
  hiddenCount: number;
  onClose: () => void;
  onEdit: () => void;
  onReshow: () => void;
  rootStyle: CSSProperties;
}) {
  const [shown, hide] = useShown();
  const close = (then: () => void) => {
    hide();
    window.setTimeout(then, 220);
  };
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = 250, h = 2 * 48;
  const left = Math.max(12, Math.min(vw - w - 12, x - w / 2));
  const below = y + 18 + h < vh - 110;
  const top = below ? y + 18 : Math.max(12, y - 18 - h);
  return createPortal(
    <div className={styles.veil} data-open={shown} data-light="true" style={rootStyle} onPointerDown={(e) => e.target === e.currentTarget && close(onClose)}>
      <div
        className={styles.menu}
        role="menu"
        style={{ left, top, width: w, opacity: shown ? 1 : 0, transform: shown ? "none" : "scale(0.6)", transformOrigin: `${x - left}px ${below ? 0 : h}px` }}
      >
        <button type="button" role="menuitem" onClick={() => close(onEdit)}>
          ホーム画面を編集
          <EditGlyph />
        </button>
        <button type="button" role="menuitem" onClick={() => close(onReshow)} aria-disabled={hiddenCount === 0} data-dim={hiddenCount === 0 ? "true" : undefined}>
          <span>
            非表示のアプリを再表示
            {hiddenCount ? <small className={styles.menuCount}>{hiddenCount}</small> : null}
          </span>
          <EyeGlyph />
        </button>
      </div>
    </div>,
    document.body,
  );
}

export type HiddenEntry = { id: string; name: string; folder?: string; tile: ReactNode };

export function HiddenSheet({ entries, onReshow, onReshowAll, onClose, rootStyle }: {
  entries: HiddenEntry[];
  onReshow: (id: string) => void;
  onReshowAll: () => void;
  onClose: () => void;
  rootStyle: CSSProperties;
}) {
  const [shown, hide] = useShown();
  const [leaving, setLeaving] = useState<string[]>([]);
  const close = () => {
    hide();
    window.setTimeout(onClose, 380);
  };
  const reshow = (id: string) => {
    setLeaving((l) => [...l, id]);
    window.setTimeout(() => onReshow(id), 260);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return createPortal(
    <div className={styles.sheetVeil} data-open={shown} style={rootStyle} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="launcher-sheet-title" style={{ transform: shown ? "none" : "translateY(calc(100% + 40px))" }}>
        <span className={styles.sheetGrabber} aria-hidden="true" />
        <div className={styles.sheetHead}>
          <button type="button" className={styles.sheetClose} onClick={close} aria-label="とじる">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <h2 id="launcher-sheet-title">非表示のアプリ</h2>
          <span style={{ width: 32 }} />
        </div>
        {entries.length ? (
          <>
            <p className={styles.sheetLead}>「再表示」を押すと、ホーム画面にもどります</p>
            <div className={styles.sheetList}>
              {entries.map((e) => (
                <div key={e.id} className={styles.sheetRow} data-leaving={leaving.includes(e.id) ? "true" : undefined}>
                  <span className={styles.sheetTile}>{e.tile}</span>
                  <span className={styles.sheetName}>
                    {e.name}
                    {e.folder ? <small>{e.folder}フォルダ</small> : null}
                  </span>
                  <button type="button" className={styles.reshow} onClick={() => reshow(e.id)}>再表示</button>
                </div>
              ))}
            </div>
            {entries.length > 1 ? (
              <div className={styles.sheetFoot}>
                <button type="button" onClick={() => { setLeaving(entries.map((e) => e.id)); window.setTimeout(onReshowAll, 260); }}>すべて再表示</button>
              </div>
            ) : null}
          </>
        ) : (
          <div className={styles.sheetEmpty}>
            <EyeGlyph size={34} />
            <p>非表示のアプリはありません</p>
            <small>ホーム画面を編集して、アイコンの左上の × から非表示にできます</small>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function EditGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {[[2, 2], [10, 2], [2, 10], [10, 10]].map(([x, y]) => (
        <rect key={`${x}${y}`} x={x} y={y} width="6" height="6" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

export function EyeGlyph({ size = 18, slash = false }: { size?: number; slash?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M1.8 10S5 4.4 10 4.4 18.2 10 18.2 10 15 15.6 10 15.6 1.8 10 1.8 10Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {slash ? <path d="M3.5 3.5l13 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : null}
    </svg>
  );
}
