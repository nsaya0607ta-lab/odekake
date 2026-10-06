type GachaCue = "turn" | "drop" | "charge" | "crack" | "flash" | "explosion" | "reveal" | "tick" | "ding" | "pop" | "land" | "door";

/** ランプの「ピン」の高さ（段がすすむほど高くなる） */
const DING_NOTES = [880, 1046.5, 1318.5, 1568, 2093];

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let cuePlaybackRate = 1;

export function setGachaAudioPlaybackRate(rate: 1 | 2 | 3) {
  cuePlaybackRate = rate;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return null;

  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContextCtor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.12;
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
  const scaledDuration = duration / cuePlaybackRate;
  const start = context.currentTime + delay / cuePlaybackRate;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + scaledDuration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + Math.min(0.025 / cuePlaybackRate, scaledDuration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + scaledDuration);
  oscillator.connect(gain);
  gain.connect(masterGain ?? context.destination);
  oscillator.start(start);
  oscillator.stop(start + scaledDuration + 0.02);
}

type NoiseOptions = {
  type?: BiquadFilterType;
  frequency?: number;
  q?: number;
  delay?: number;
  attack?: number;
};

function noise(context: AudioContext, duration: number, volume: number, options: NoiseOptions = {}) {
  const scaledDuration = duration / cuePlaybackRate;
  const start = context.currentTime + (options.delay ?? 0) / cuePlaybackRate;
  const length = Math.ceil(context.sampleRate * scaledDuration);
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
  filter.type = options.type ?? "lowpass";
  filter.frequency.value = options.frequency ?? 900;
  filter.Q.value = options.q ?? 0.7;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + Math.min((options.attack ?? 0.008) / cuePlaybackRate, scaledDuration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + scaledDuration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain ?? context.destination);
  source.start(start);
  source.stop(start + scaledDuration + 0.02);
}

function ratchetClick(context: AudioContext, delay: number, pitch: number) {
  noise(context, 0.045, 0.2, { type: "bandpass", frequency: 2300, q: 2.2, delay, attack: 0.002 });
  tone(context, pitch, pitch * 0.68, 0.052, 0.12, "triangle", delay);
}

/** level は ding（ランプの段）と tick（ハンドルのカチッ）の高さに使う */
export function playGachaCue(cue: GachaCue, level = 0) {
  const context = getAudioContext();
  if (!context || context.state !== "running") return;

  if (cue === "tick") {
    ratchetClick(context, 0, 880 + (level % 4) * 36);
    return;
  }
  if (cue === "ding") {
    const note = DING_NOTES[Math.min(DING_NOTES.length - 1, Math.max(0, level))] ?? 880;
    tone(context, note, note, 0.5, 0.13, "sine");
    tone(context, note * 2, note * 2, 0.32, 0.05, "sine", 0.01);
    tone(context, note * 1.5, note * 1.5, 0.42, 0.04, "triangle", 0.05);
    return;
  }
  if (cue === "pop") {
    tone(context, 520, 1180, 0.09, 0.2, "triangle");
    noise(context, 0.06, 0.12, { type: "highpass", frequency: 2600, attack: 0.002 });
    return;
  }
  if (cue === "land") {
    tone(context, 360, 170, 0.08, 0.16, "triangle");
    noise(context, 0.05, 0.1, { type: "lowpass", frequency: 900, attack: 0.002 });
    return;
  }
  if (cue === "door") {
    noise(context, 0.07, 0.16, { type: "bandpass", frequency: 1400, q: 1.4, attack: 0.002 });
    tone(context, 240, 150, 0.09, 0.14, "triangle");
    return;
  }

  if (cue === "turn") {
    tone(context, 96, 58, 0.46, 0.34, "sine");
    for (let index = 0; index < 6; index += 1) {
      ratchetClick(context, 0.045 + index * 0.07, 920 - index * 42);
    }
    return;
  }
  if (cue === "drop") {
    noise(context, 0.115, 0.28, { type: "lowpass", frequency: 520, q: 0.8, attack: 0.003 });
    tone(context, 112, 46, 0.19, 0.52, "sine");
    tone(context, 330, 175, 0.075, 0.09, "triangle");
    return;
  }
  if (cue === "charge") {
    tone(context, 124, 760, 0.94, 0.17, "triangle");
    tone(context, 248, 1520, 0.78, 0.07, "sine", 0.12);
    noise(context, 0.66, 0.055, { type: "bandpass", frequency: 1250, q: 0.9, delay: 0.16, attack: 0.18 });
    return;
  }
  if (cue === "crack") {
    noise(context, 0.09, 0.58, { type: "highpass", frequency: 1300, q: 0.8, attack: 0.002 });
    noise(context, 0.22, 0.26, { type: "lowpass", frequency: 480, delay: 0.025, attack: 0.003 });
    tone(context, 190, 48, 0.19, 0.44, "triangle");
    return;
  }
  if (cue === "flash") {
    noise(context, 0.12, 0.07, { type: "highpass", frequency: 4800, q: 0.7, attack: 0.002 });
    tone(context, 720, 1440, 0.3, 0.16, "sine");
    tone(context, 1080, 2160, 0.34, 0.08, "sine", 0.035);
    return;
  }
  if (cue === "explosion") {
    noise(context, 0.72, 0.66, { type: "lowpass", frequency: 680, q: 0.75, attack: 0.003 });
    noise(context, 0.34, 0.3, { type: "bandpass", frequency: 1650, q: 0.9, attack: 0.002 });
    tone(context, 82, 28, 0.7, 0.78, "sine");
    tone(context, 148, 44, 0.34, 0.25, "triangle");
    return;
  }

  tone(context, 523, 523, 0.34, 0.14, "triangle");
  tone(context, 659, 659, 0.38, 0.13, "triangle", 0.07);
  tone(context, 784, 784, 0.42, 0.13, "triangle", 0.14);
  tone(context, 1046, 1046, 0.56, 0.11, "sine", 0.21);
  noise(context, 0.18, 0.045, { type: "highpass", frequency: 4200, delay: 0.2, attack: 0.004 });
}
