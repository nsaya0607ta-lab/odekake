"use client";

import { useEffect, useRef, useState } from "react";
import { IconSettings } from "./icons";
import {
  DEFAULT_BGM_VOLUME,
  DEFAULT_TAP_VOLUME,
  getBgmVolume,
  getTapVolume,
  setBgmVolume,
  setTapVolume,
} from "@/lib/sound-settings";

/**
 * ヘッダーに置く設定ボタン。押すとBGM・タップ音の音量スライダーを開く。
 */
export function SoundSettingsButton() {
  const [open, setOpen] = useState(false);
  const [bgmVolume, setBgmVolumeState] = useState(DEFAULT_BGM_VOLUME);
  const [tapVolume, setTapVolumeState] = useState(DEFAULT_TAP_VOLUME);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBgmVolumeState(getBgmVolume());
    setTapVolumeState(getTapVolume());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onClickOutside);
    return () => document.removeEventListener("pointerdown", onClickOutside);
  }, [open]);

  const onBgmChange = (value: number) => {
    setBgmVolumeState(value);
    setBgmVolume(value);
  };

  const onTapChange = (value: number) => {
    setTapVolumeState(value);
    setTapVolume(value);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="音量設定を開く"
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e8d4aa] bg-sun-soft/70 text-ink shadow-sm active:scale-95"
      >
        <IconSettings size={18} />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-[#e8d4aa] bg-card p-4 shadow-lg"
          role="dialog"
          aria-label="音量設定"
        >
          <p className="mb-3 text-sm font-bold text-ink">サウンド設定</p>

          <label className="mb-3 block text-xs text-ink-soft">
            <span className="mb-1 flex items-center justify-between">
              <span>BGM音量</span>
              <span className="tabular-nums">{Math.round(bgmVolume * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={bgmVolume}
              onChange={(e) => onBgmChange(Number(e.target.value))}
              className="w-full accent-leaf"
            />
          </label>

          <label className="block text-xs text-ink-soft">
            <span className="mb-1 flex items-center justify-between">
              <span>タップ音</span>
              <span className="tabular-nums">{Math.round(tapVolume * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={tapVolume}
              onChange={(e) => onTapChange(Number(e.target.value))}
              className="w-full accent-leaf"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
