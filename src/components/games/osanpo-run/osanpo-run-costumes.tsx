"use client";

import { useEffect, useRef, useState } from "react";
import {
  OSANPO_RUN_COSTUME_SLOT_LABELS,
  OSANPO_RUN_COSTUMES,
  OSANPO_RUN_OUTFIT_EVENT,
  OSANPO_RUN_OUTFIT_KEY,
  OSANPO_RUN_STORAGE_PREFIX,
  type OsanpoRunCostume,
  type OsanpoRunCostumeSlot,
  type OsanpoRunOutfit,
} from "@/lib/games/osanpo-run/config";
import { drawFaceCostume, drawHeadCostume, drawTrailBit } from "./draw";

type Props = {
  /** 買ってあるきせかえ（サーバーから） */
  owned: string[];
  balance: number;
  /** DBの準備ができているか（マイグレーション未適用なら false） */
  ready: boolean;
};

const OUTFIT_STORAGE = OSANPO_RUN_STORAGE_PREFIX + OSANPO_RUN_OUTFIT_KEY;
const SLOTS: readonly OsanpoRunCostumeSlot[] = ["head", "face", "trail"];

function readOutfit(): OsanpoRunOutfit {
  try {
    const raw = window.localStorage.getItem(OUTFIT_STORAGE);
    return raw ? (JSON.parse(raw) as OsanpoRunOutfit) : {};
  } catch {
    return {};
  }
}

/** きせかえを付けたフレブルの見本（スマイルのポーズ） */
function Preview({ costume }: { costume: OsanpoRunCostume }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    const c = cv?.getContext("2d");
    if (!cv || !c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 84, H = 72;
    cv.width = W * dpr; cv.height = H * dpr;
    const img = new Image();
    img.src = "/characters/default/smile.webp";
    const draw = () => {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      const k = W / 300;
      if (costume.slot === "trail") {
        for (let i = 0; i < 7; i++) drawTrailBit(c, costume.id, 8 + i * 7, H - 16 - Math.sin(i) * 8, 3.2, 1 - i * 0.08, i * 50);
      }
      c.save();
      // 犬の画像は左向きなので、ゲームと同じく右向きに反転する
      c.translate(W, H - 254 * k); c.scale(-k, k);
      if (img.complete && img.naturalWidth) c.drawImage(img, 0, 0, 300, 254);
      if (costume.slot === "face") drawFaceCostume(c, costume.id, 100, 106);
      if (costume.slot === "head") drawHeadCostume(c, costume.id, 100, 44, 0.3);
      c.restore();
    };
    if (img.complete) draw(); else img.onload = draw;
    return () => { img.onload = null; };
  }, [costume]);
  return <canvas ref={ref} className="osr-cs-preview" aria-hidden="true" />;
}

/**
 * きせかえ画面。コインで買って、頭・顔・足あとに1つずつ付けられる。
 * 何を付けているかはこの端末に保存し、ゲーム側へ合図を送って読み直してもらう。
 */
export function OsanpoRunCostumes({ owned: ownedInitial, balance: balanceInitial, ready }: Props) {
  const [owned, setOwned] = useState(() => new Set(ownedInitial));
  const [balance, setBalance] = useState(balanceInitial);
  const [outfit, setOutfit] = useState<OsanpoRunOutfit>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { setOutfit(readOutfit()); }, []);

  const saveOutfit = (next: OsanpoRunOutfit) => {
    setOutfit(next);
    try { window.localStorage.setItem(OUTFIT_STORAGE, JSON.stringify(next)); } catch { /* 保存できない端末 */ }
    window.dispatchEvent(new Event(OSANPO_RUN_OUTFIT_EVENT));
  };

  const toggle = (costume: OsanpoRunCostume) => {
    const next = { ...outfit };
    if (next[costume.slot] === costume.id) delete next[costume.slot];
    else next[costume.slot] = costume.id;
    saveOutfit(next);
  };

  const buy = async (costume: OsanpoRunCostume) => {
    setBusy(costume.id); setMessage(null);
    try {
      const response = await fetch("/api/games/osanpo-run/costume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costumeId: costume.id }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; balance?: number; error?: string } | null;
      if (typeof payload?.balance === "number") setBalance(payload.balance);
      if (!response.ok || !payload?.ok) { setMessage(payload?.error ?? "買えませんでした。"); return; }
      setOwned((prev) => new Set(prev).add(costume.id));
      saveOutfit({ ...outfit, [costume.slot]: costume.id });
      setMessage(`「${costume.name}」を買って、付けました！`);
    } catch {
      setMessage("通信できませんでした。");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="osr-cs">
      <div className="osr-cs-head">
        <p>頭・顔・足あとに1つずつ付けられます。1回買えばずっと使えます。</p>
        <span className="osr-cs-coins">🪙 {balance.toLocaleString()}</span>
      </div>
      {!ready ? <p className="osr-cs-msg">きせかえは準備中です（データベースの設定が反映されると買えます）。</p> : null}
      {message ? <p className="osr-cs-msg" role="status">{message}</p> : null}
      {SLOTS.map((slot) => (
        <section key={slot} className="osr-cs-group">
          <h3>{OSANPO_RUN_COSTUME_SLOT_LABELS[slot]}</h3>
          <ul>
            {OSANPO_RUN_COSTUMES.filter((c) => c.slot === slot).map((costume) => {
              const have = owned.has(costume.id), worn = outfit[slot] === costume.id;
              return (
                <li key={costume.id} className={worn ? "osr-cs-worn" : undefined}>
                  <Preview costume={costume} />
                  <b>{costume.name}</b>
                  <small>{costume.desc}</small>
                  {have ? (
                    <button type="button" aria-pressed={worn} onClick={() => toggle(costume)}>{worn ? "付けている" : "付ける"}</button>
                  ) : (
                    <button
                      type="button"
                      className="osr-cs-buy"
                      disabled={!ready || busy !== null || balance < costume.price}
                      onClick={() => void buy(costume)}
                    >
                      {busy === costume.id ? "購入中…" : `🪙 ${costume.price.toLocaleString()}`}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
