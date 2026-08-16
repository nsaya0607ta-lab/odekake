// タップ音を Web Audio API で事前デコードしておき、鳴らすたびに
// ネットワーク取得やデコードの待ち時間が発生しないようにする。
// `new Audio(url).play()` を毎回呼ぶと、初回再生までに遅延が出るため。

import { getAudioContext, resumeAudioContext } from "./audio-context";

let bufferPromise: Promise<AudioBuffer> | null = null;

function loadBuffer(): Promise<AudioBuffer> {
  if (!bufferPromise) {
    const ctx = getAudioContext();
    bufferPromise = fetch("/audio/tap.mp3")
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data));
  }
  return bufferPromise;
}

/** 最初のユーザー操作までに、可能なら先読みしておく */
export function preloadTapSound(): void {
  loadBuffer().catch(() => {});
}

export function playTapSound(gain: number): void {
  if (gain <= 0) return;
  const ctx = getAudioContext();
  resumeAudioContext();
  loadBuffer()
    .then((buffer) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = gain;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start();
    })
    .catch(() => {});
}
