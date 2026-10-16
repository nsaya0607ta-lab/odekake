import { getAudioContext, resumeAudioContext } from "@/lib/audio-context";
import { getTapVolume, sliderToGain } from "@/lib/sound-settings";

/**
 * かくれ漢字の効果音。音のファイルは使わず、その場で合成する（読みこみ0・遅れなし）。
 * 音量はアプリの「タップ音」の設定にあわせる。
 */
export type Sfx = "correct" | "wrong" | "duplicate" | "clear" | "hint" | "star" | "tap";

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

const SCORES: Record<Sfx, Note[]> = {
  // 木琴のような明るい2音＋きらり
  correct: [
    { freq: 783.99, at: 0, dur: 0.16, type: "triangle", gain: 0.9 },
    { freq: 1174.66, at: 0.08, dur: 0.24, type: "triangle", gain: 0.8 },
    { freq: 2349.32, at: 0.12, dur: 0.18, type: "sine", gain: 0.18 },
  ],
  // ひかえめな低い「ぽこ」
  wrong: [{ freq: 220, at: 0, dur: 0.14, type: "sine", gain: 0.7 }, { freq: 196, at: 0.07, dur: 0.12, type: "sine", gain: 0.45 }],
  duplicate: [{ freq: 523.25, at: 0, dur: 0.1, type: "sine", gain: 0.4 }],
  hint: [{ freq: 659.25, at: 0, dur: 0.12, type: "sine", gain: 0.5 }, { freq: 987.77, at: 0.06, dur: 0.16, type: "sine", gain: 0.35 }],
  star: [{ freq: 1318.51, at: 0, dur: 0.22, type: "triangle", gain: 0.55 }, { freq: 2637.02, at: 0.02, dur: 0.14, type: "sine", gain: 0.12 }],
  tap: [{ freq: 880, at: 0, dur: 0.05, type: "sine", gain: 0.25 }],
  // 五音音階のかけ上がり
  clear: [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.51].map((freq, i) => ({ freq, at: i * 0.075, dur: 0.32, type: "triangle" as const, gain: 0.7 })),
};

export function playSfx(name: Sfx, enabled: boolean): void {
  if (!enabled || typeof window === "undefined") return;
  try {
    const ctx = getAudioContext();
    void resumeAudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.16 * sliderToGain(getTapVolume());
    if (master.gain.value <= 0) return;
    master.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.005;
    let end = t0;
    for (const note of SCORES[name]) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = note.type ?? "sine";
      osc.frequency.value = note.freq;
      const start = t0 + note.at;
      const stop = start + note.dur;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(note.gain ?? 0.6, start + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, stop);
      osc.connect(env).connect(master);
      osc.start(start);
      osc.stop(stop + 0.02);
      end = Math.max(end, stop);
    }
    window.setTimeout(() => master.disconnect(), (end - ctx.currentTime + 0.2) * 1000);
  } catch {
    /* 音が出せない環境でも遊べるようにする */
  }
}
