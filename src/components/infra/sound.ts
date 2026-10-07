/**
 * アプリ「インフラ」の効果音（Web Audio で、その場で作る小さな音）。
 * アプリ全体で共有の AudioContext を使う（src/lib/audio-context.ts）。
 */
import { getAudioContext, resumeAudioContext } from "@/lib/audio-context";

export type Sfx = "place" | "remove" | "start" | "alarm" | "good" | "drop" | "star" | "clear" | "fail" | "correct" | "wrong";

let enabled = true;
export function setSoundEnabled(v: boolean) {
  enabled = v;
}

/** 続けて鳴りすぎないように（秒） */
const MIN_GAP: Partial<Record<Sfx, number>> = { drop: 1, alarm: 0.9 };
const lastAt = new Map<Sfx, number>();

export function sfx(name: Sfx) {
  if (!enabled || typeof window === "undefined") return;
  let ctx: AudioContext;
  try {
    ctx = getAudioContext();
  } catch {
    return;
  }
  if (ctx.state !== "running") void resumeAudioContext();
  const now = ctx.currentTime;
  const gap = MIN_GAP[name];
  if (gap) {
    if (now - (lastAt.get(name) ?? -9) < gap) return;
    lastAt.set(name, now);
  }
  const out = ctx.createGain();
  out.gain.value = 0.2;
  out.connect(ctx.destination);
  const tone = (freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.8, slideTo?: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now + start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now + start + dur);
    g.gain.setValueAtTime(0.0001, now + start);
    g.gain.exponentialRampToValueAtTime(vol, now + start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    o.connect(g);
    g.connect(out);
    o.start(now + start);
    o.stop(now + start + dur + 0.03);
  };
  switch (name) {
    case "place":
      tone(520, 0, 0.1, "triangle", 0.8, 880);
      tone(1320, 0.06, 0.09, "sine", 0.35);
      break;
    case "remove":
      tone(620, 0, 0.12, "triangle", 0.6, 300);
      break;
    case "start":
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.16, "triangle", 0.6));
      break;
    case "alarm":
      [740, 554, 740, 554].forEach((f, i) => tone(f, i * 0.17, 0.15, "square", 0.22));
      break;
    case "good":
      tone(784, 0, 0.12, "sine", 0.5);
      tone(1175, 0.08, 0.2, "sine", 0.45);
      break;
    case "drop":
      tone(170, 0, 0.09, "square", 0.16, 110);
      break;
    case "star":
      tone(1046, 0, 0.24, "triangle", 0.6);
      tone(1568, 0.05, 0.32, "sine", 0.4);
      break;
    case "clear":
      [523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.16, "triangle", 0.6));
      tone(1046, 0.32, 0.45, "triangle", 0.7);
      tone(1318, 0.32, 0.45, "sine", 0.35);
      break;
    case "fail":
      tone(392, 0, 0.22, "triangle", 0.5, 330);
      tone(294, 0.2, 0.32, "triangle", 0.5, 247);
      break;
    case "correct":
      tone(880, 0, 0.1, "sine", 0.6);
      tone(1318, 0.08, 0.18, "sine", 0.55);
      break;
    case "wrong":
      tone(220, 0, 0.2, "square", 0.18, 180);
      break;
  }
}
