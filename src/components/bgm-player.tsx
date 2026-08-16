"use client";

import { useEffect, useRef } from "react";
import { getBgmVolume, getTapVolume, SOUND_SETTINGS_EVENT } from "@/lib/sound-settings";

/**
 * アプリ起動時にBGMをループ再生し、タップ操作には効果音を鳴らす。
 * 音量は設定ボタン(SettingsButton)で調整でき、localStorageで共有する。
 *
 * - ブラウザの自動再生制限があるため、即時再生を試みつつ、
 *   ブロックされた場合は最初のユーザー操作で再生を開始する
 * - タブが非表示(他アプリ切り替え・スリープ等)になったらBGMを一時停止し、
 *   戻ってきたら再開する。サイトを閉じている間は鳴らさない
 */
export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = getBgmVolume();

    const tryPlay = () => {
      if (getBgmVolume() <= 0 || document.visibilityState !== "visible") return;
      audio.play().catch(() => {
        // 自動再生がブロックされた場合は、最初のユーザー操作で再試行する
        const resume = () => {
          tryPlay();
          window.removeEventListener("pointerdown", resume);
          window.removeEventListener("keydown", resume);
        };
        window.addEventListener("pointerdown", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tryPlay();
      } else {
        audio.pause();
      }
    };

    const onSoundSettingsChange = () => {
      const volume = getBgmVolume();
      audio.volume = volume;
      if (volume <= 0) {
        audio.pause();
      } else if (audio.paused && document.visibilityState === "visible") {
        tryPlay();
      }
    };

    tryPlay();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener(SOUND_SETTINGS_EVENT, onSoundSettingsChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener(SOUND_SETTINGS_EVENT, onSoundSettingsChange);
    };
  }, []);

  // タップした要素(ボタン・リンク)ごとに軽い操作音を鳴らす
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const volume = getTapVolume();
      if (volume <= 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("a[href], button, [role='button']")) return;
      const tap = new Audio("/audio/tap.mp3");
      tap.volume = volume;
      tap.play().catch(() => {});
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return <audio ref={audioRef} src="/audio/bgm.mp3" loop preload="auto" />;
}
