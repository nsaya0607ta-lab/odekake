type GachaCue = "turn" | "drop" | "charge" | "crack" | "flash" | "explosion" | "reveal";

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return null;

  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContextCtor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.13;
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
}

/** ガチャボタンのユーザー操作中にAudioContextを準備し、iOSの自動再生制限を避ける。 */
export function primeGachaAudio() {
  const context = getAudioContext();
  if (!context) return;

  void context.resume().catch(() => undefined);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0.00001;
  oscillator.connect(gain);
  gain.connect(masterGain ?? context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.01);
}

function tone(
  context: AudioContext,
  frequency: number,
  endFrequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
  delay = 0,
) {
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + Math.min(0.025, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(masterGain ?? context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise(context: AudioContext, duration: number, volume: number) {
  const length = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    const decay = 1 - index / length;
    data[index] = (Math.random() * 2 - 1) * decay * decay;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = 900;
  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain ?? context.destination);
  source.start();
}

export function playGachaCue(cue: GachaCue) {
  const context = getAudioContext();
  if (!context || context.state !== "running") return;

  if (cue === "turn") {
    tone(context, 220, 105, 0.32, 0.32, "triangle");
    tone(context, 170, 95, 0.26, 0.22, "square", 0.18);
    return;
  }
  if (cue === "drop") {
    tone(context, 150, 78, 0.22, 0.42, "sine");
    return;
  }
  if (cue === "charge") {
    tone(context, 180, 980, 1.15, 0.2, "sawtooth");
    return;
  }
  if (cue === "crack") {
    noise(context, 0.16, 0.32);
    tone(context, 460, 90, 0.18, 0.28, "square");
    return;
  }
  if (cue === "flash") {
    tone(context, 880, 1760, 0.34, 0.28, "sine");
    tone(context, 1320, 2240, 0.28, 0.14, "sine", 0.04);
    return;
  }
  if (cue === "explosion") {
    noise(context, 0.62, 0.52);
    tone(context, 92, 36, 0.58, 0.5, "sine");
    return;
  }

  tone(context, 520, 1040, 0.45, 0.24, "triangle");
  tone(context, 780, 1560, 0.52, 0.18, "sine", 0.09);
}

