// タップ音を Web Audio API で事前デコードしておき、鳴らすたびに
// ネットワーク取得やデコードの待ち時間が発生しないようにする。
// `new Audio(url).play()` を毎回呼ぶと、初回再生までに遅延が出るため。

let context: AudioContext | null = null;
let bufferPromise: Promise<AudioBuffer> | null = null;

function getContext(): AudioContext {
  if (!context) {
    context = new AudioContext();
  }
  return context;
}

function loadBuffer(ctx: AudioContext): Promise<AudioBuffer> {
  if (!bufferPromise) {
    bufferPromise = fetch("/audio/tap.mp3")
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data));
  }
  return bufferPromise;
}

/** 最初のユーザー操作までに、可能なら先読みしておく */
export function preloadTapSound(): void {
  const ctx = getContext();
  loadBuffer(ctx).catch(() => {});
}

export function playTapSound(gain: number): void {
  if (gain <= 0) return;
  const ctx = getContext();
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  loadBuffer(ctx)
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
