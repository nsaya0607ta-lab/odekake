"use client";

import { useEffect } from "react";
import { getBgmVolume, getTapVolume, sliderToGain, SOUND_SETTINGS_EVENT } from "@/lib/sound-settings";
import { isAudioContextRunning, resumeAudioContext } from "@/lib/audio-context";
import { isBgmPlaying, pauseBgm, playBgm, preloadBgm, setBgmGain } from "@/lib/bgm-engine";
import { playTapSound, preloadTapSound } from "@/lib/tap-sound";

/**
 * アプリ起動時にBGMをループ再生し、タップ操作には効果音を鳴らす。
 * どちらもWeb Audio APIのGainNodeで音量制御する
 * (<audio>要素の.volumeはiOS Safariでは変更できないため)。
 * 音量は設定ボタン(SettingsButton)で調整でき、localStorageで共有する。
 *
 * - ブラウザの自動再生制限があるため、即時再生を試みつつ、
 *   ブロックされた場合は最初のユーザー操作で再生を開始する
 * - タブが非表示(他アプリ切り替え・スリープ等)になったらBGMを一時停止し、
 *   戻ってきたら再開する。サイトを閉じている間は鳴らさない
 */
export function BgmPlayer() {
  useEffect(() => {
    preloadBgm();
    preloadTapSound();
    setBgmGain(sliderToGain(getBgmVolume()));

    const tryPlay = async () => {
      if (getBgmVolume() <= 0 || document.visibilityState !== "visible") return;

      await resumeAudioContext();
      if (!isAudioContextRunning()) {
        // 自動再生がブロックされている場合は、最初のユーザー操作で再試行する。
        // 起動スプラッシュのタップでも即座に始まるよう、複数の操作イベントを見る
        // (iOS Safariはイベントの種類によって「有効な操作」と認識しないことがあるため)
        const gestureEvents = ["pointerdown", "touchend", "keydown"] as const;
        const resume = () => {
          tryPlay();
          gestureEvents.forEach((type) => window.removeEventListener(type, resume));
        };
        gestureEvents.forEach((type) => window.addEventListener(type, resume, { once: true }));
        return;
      }

      await playBgm();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tryPlay();
      } else {
        pauseBgm();
      }
    };

    const onSoundSettingsChange = () => {
      const volume = getBgmVolume();
      setBgmGain(sliderToGain(volume));
      if (volume <= 0) {
        pauseBgm();
      } else if (!isBgmPlaying() && document.visibilityState === "visible") {
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

  return null;
}
