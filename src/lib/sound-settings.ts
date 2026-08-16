// BGM・タップ音の音量設定を localStorage で共有するための小さなヘルパー。
// スライダー(SettingsButton)と再生側(BgmPlayer)が同じ値を参照・購読する。

export const BGM_VOLUME_KEY = "odekake-bgm-volume";
export const TAP_VOLUME_KEY = "odekake-tap-volume";
export const SOUND_SETTINGS_EVENT = "odekake-sound-settings-changed";

export const DEFAULT_BGM_VOLUME = 0.35;
export const DEFAULT_TAP_VOLUME = 1.0;

function readVolume(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

export function getBgmVolume(): number {
  return readVolume(BGM_VOLUME_KEY, DEFAULT_BGM_VOLUME);
}

export function getTapVolume(): number {
  return readVolume(TAP_VOLUME_KEY, DEFAULT_TAP_VOLUME);
}

export function setBgmVolume(value: number): void {
  window.localStorage.setItem(BGM_VOLUME_KEY, String(Math.min(1, Math.max(0, value))));
  window.dispatchEvent(new Event(SOUND_SETTINGS_EVENT));
}

export function setTapVolume(value: number): void {
  window.localStorage.setItem(TAP_VOLUME_KEY, String(Math.min(1, Math.max(0, value))));
  window.dispatchEvent(new Event(SOUND_SETTINGS_EVENT));
}

/**
 * スライダーの見た目上の位置(0〜1、線形)を、耳の感じ方に近づけた実際の
 * 再生ゲイン(0〜1)に変換する。
 *
 * 人の聴覚は音量を対数的に感じるため、そのまま線形の値を audio.volume に
 * 渡すと、低〜中間あたりの変化がほとんど感じられず「0か100かのように」
 * 聞こえてしまう。2乗カーブにすることで、スライダー全体で音量差が
 * 感じられるようにする。
 */
export function sliderToGain(position: number): number {
  const clamped = Math.min(1, Math.max(0, position));
  return clamped * clamped;
}
