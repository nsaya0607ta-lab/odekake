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
 *   ブロックされた場合は次のユーザー操作で再生を開始する
 * - タブが非表示(他アプリ切り替え・スリープ等)になったらBGMを一時停止する。
 *   復帰時にも自動再生を試みるが、iOSはバックグラウンドから戻った直後の
 *   AudioContext再開をユーザー操作とみなさずブロックすることがあるため、
 *   その場合は次に画面のどこかを操作した瞬間に再開する
 */
export function BgmPlayer() {
  useEffect(() => {
    preloadBgm();
    preloadTapSound();
    setBgmGain(sliderToGain(getBgmVolume()));

    const tryPlay = async () => {
      if (getBgmVolume() <= 0 || document.visibilityState !== "visible") return;
      await resumeAudioContext();
      if (!isAudioContextRunning()) return;
      await playBgm();
    };

    // 本来鳴っているべきなのに鳴っていない状態で操作があったら、そのタップを
    // きっかけに再開を試みる。「一度だけ」ではなく毎回チェックすることで、
    // バックグラウンド復帰のたびにブロックされても、次の操作で必ず復帰する。
    const onUserGesture = () => {
      if (getBgmVolume() > 0 && document.visibilityState === "visible" && !isBgmPlaying()) {
        tryPlay();
      }
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
    window.addEventListener("pageshow", tryPlay);
    window.addEventListener("focus", tryPlay);
    window.addEventListener("pointerdown", onUserGesture);
    window.addEventListener("touchend", onUserGesture);
    window.addEventListener("keydown", onUserGesture);
    window.addEventListener(SOUND_SETTINGS_EVENT, onSoundSettingsChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", tryPlay);
      window.removeEventListener("focus", tryPlay);
      window.removeEventListener("pointerdown", onUserGesture);
      window.removeEventListener("touchend", onUserGesture);
      window.removeEventListener("keydown", onUserGesture);
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
