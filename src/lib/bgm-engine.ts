// BGMをWeb Audio APIで再生するための小さなエンジン。
// GainNodeで音量を制御するため、iOS Safariでも音量スライダーが効く。

import { getAudioContext, resumeAudioContext } from "./audio-context";
import { SOUND_SETTINGS_EVENT } from "./sound-settings";

let bufferPromise: Promise<AudioBuffer> | null = null;
let gainNode: GainNode | null = null;
let source: AudioBufferSourceNode | null = null;
let startedAtContextTime = 0;
let offsetAtStart = 0;
let playing = false;
/** 独自の曲を流すミニゲームの間は、アプリのBGMを止めておく */
let suppressed = false;

function loadBuffer(): Promise<AudioBuffer> {
  if (!bufferPromise) {
    const ctx = getAudioContext();
    bufferPromise = fetch("/audio/bgm.mp3")
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data));
  }
  return bufferPromise;
}

function getGainNode(): GainNode {
  if (!gainNode) {
    const ctx = getAudioContext();
    gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
  }
  return gainNode;
}

export function setBgmGain(value: number): void {
  getGainNode().gain.value = value;
}

export function isBgmPlaying(): boolean {
  return playing;
}

export async function playBgm(): Promise<void> {
  if (playing || suppressed) return;
  await resumeAudioContext();
  const buffer = await loadBuffer().catch(() => null);
  // 読み込みを待つ間に止める指示が来ていたら鳴らさない
  if (!buffer || playing || suppressed) return;

  const ctx = getAudioContext();
  const node = ctx.createBufferSource();
  node.buffer = buffer;
  node.loop = true;
  node.connect(getGainNode());

  const offset = offsetAtStart % buffer.duration;
  node.start(0, offset);

  source = node;
  startedAtContextTime = ctx.currentTime;
  offsetAtStart = offset;
  playing = true;
}

export function pauseBgm(): void {
  if (!playing || !source) return;
  const ctx = getAudioContext();
  const elapsed = ctx.currentTime - startedAtContextTime;
  offsetAtStart = offsetAtStart + elapsed;
  try {
    source.stop();
  } catch {
    // すでに停止している場合は無視
  }
  source.disconnect();
  source = null;
  playing = false;
}

/**
 * ミニゲームが自分の曲を流している間、アプリのBGMを止める。
 * 解除すると BgmPlayer が次の操作（または設定変更イベント）で再開する。
 */
export function setBgmSuppressed(value: boolean): void {
  suppressed = value;
  if (value) {
    pauseBgm();
  } else if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SOUND_SETTINGS_EVENT));
  }
}
