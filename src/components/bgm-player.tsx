"use client";

import { useEffect, useRef } from "react";
import { getBgmVolume, getTapVolume, sliderToGain, SOUND_SETTINGS_EVENT } from "@/lib/sound-settings";
import { playTapSound, preloadTapSound } from "@/lib/tap-sound";

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

    audio.volume = sliderToGain(getBgmVolume());

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
      audio.volume = sliderToGain(volume);
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

  // タップ音を先読みしておき、実際に鳴らすときの遅延をなくす
  useEffect(() => {
    preloadTapSound();
  }, []);

  // ボタン・リンクを最後まで押し切って「クリック」が成立したときだけ操作音を鳴らす。
  // pointerdown(触れた瞬間)で鳴らすと、なぞっただけ・スクロール中でも反応してしまう。
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const volume = getTapVolume();
      if (volume <= 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("a[href], button, [role='button']")) return;
      playTapSound(sliderToGain(volume));
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return <audio ref={audioRef} src="/audio/bgm.mp3" loop preload="auto" />;
}
