// アプリ全体で共有する単一の AudioContext。
//
// iOS Safari では <audio>/<video> 要素の .volume を JS から変更できず
// (ハードウェアの音量ボタンでしか変わらない)、音量スライダーがBGMに効かない
// 原因になっていた。Web Audio API の GainNode はこの制限を受けないため、
// BGM・タップ音ともに GainNode 経由で音量を制御する。

let context: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!context) {
    context = new AudioContext();
  }
  return context;
}

export function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    return ctx.resume().catch(() => {});
  }
  return Promise.resolve();
}

export function isAudioContextRunning(): boolean {
  return getAudioContext().state === "running";
}
