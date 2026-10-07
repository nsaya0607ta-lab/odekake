/**
 * ご当地ピンボールの音（Web Audio でその場で作る。音のファイルは使わない）
 * =============================================================
 * ・効果音はゲームの fx（sfx）を受けて鳴らす。台の材質やレア度で音を変える
 * ・曲は着せ替え（themes.ts の music）の音階・メロディ・リズムで、16分音符ずつ先読みして鳴らす
 * ・音量はアプリの設定（BGM・タップ音のスライダー）にしたがう。遊んでいる間はアプリのBGMを止める
 */
import { getAudioContext, resumeAudioContext } from "@/lib/audio-context";
import { setBgmSuppressed } from "@/lib/bgm-engine";
import type { GameFx, SfxId } from "@/lib/games/pinball/game";
import type { PinballMusic, PinballTheme } from "@/lib/games/pinball/themes";
import { DEFAULT_BGM_VOLUME, getBgmVolume, getTapVolume, SOUND_SETTINGS_EVENT, sliderToGain } from "@/lib/sound-settings";

type Rig = { ac: AudioContext; master: GainNode; sfx: GainNode; bgm: GainNode; noise: AudioBuffer };

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class PinballAudio {
  private rig: Rig | null = null;
  private music: PinballMusic;
  private musicOn = false;
  private step = 0;
  private nextAt = 0;
  private paused = false;
  private intensity = 0;
  private lastSfx = new Map<SfxId, number>();
  private onSettings = () => this.applyVolume();

  constructor(theme: PinballTheme) {
    this.music = theme.music;
    setBgmSuppressed(true);
    if (typeof window !== "undefined") window.addEventListener(SOUND_SETTINGS_EVENT, this.onSettings);
  }

  /** ユーザーが画面に触れたときに呼ぶ（iPhone はそれまで音を出せない） */
  ensure(): void {
    if (!this.rig) {
      try {
        const ac = getAudioContext();
        const master = ac.createGain();
        const sfx = ac.createGain();
        const bgm = ac.createGain();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        sfx.connect(master);
        bgm.connect(master);
        master.connect(comp);
        comp.connect(ac.destination);
        const noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
        this.rig = { ac, master, sfx, bgm, noise };
        this.applyVolume();
      } catch {
        this.rig = null;
      }
    }
    void resumeAudioContext();
  }

  private applyVolume(): void {
    const rig = this.rig;
    if (!rig) return;
    const bgmSlider = getBgmVolume();
    const bgmScale = bgmSlider <= 0 ? 0 : Math.min(1.6, sliderToGain(bgmSlider) / sliderToGain(DEFAULT_BGM_VOLUME));
    const t = rig.ac.currentTime;
    rig.master.gain.setTargetAtTime(this.paused ? 0 : 0.9, t, 0.03);
    rig.sfx.gain.setTargetAtTime(sliderToGain(getTapVolume()), t, 0.03);
    rig.bgm.gain.setTargetAtTime(bgmScale * 0.55, t, 0.05);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyVolume();
  }

  /** 0 = ふつう、1 = マルチボール・制覇モード（曲がにぎやかになる） */
  setIntensity(level: number): void {
    this.intensity = level;
  }

  startMusic(): void {
    if (this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextAt = 0;
  }

  stopMusic(): void {
    this.musicOn = false;
  }

  destroy(): void {
    this.musicOn = false;
    if (typeof window !== "undefined") window.removeEventListener(SOUND_SETTINGS_EVENT, this.onSettings);
    if (this.rig) {
      const t = this.rig.ac.currentTime;
      this.rig.master.gain.setTargetAtTime(0, t, 0.05);
      const { master } = this.rig;
      window.setTimeout(() => master.disconnect(), 400);
      this.rig = null;
    }
    setBgmSuppressed(false);
  }

  /* ---------- 音のもと ---------- */

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, opts: { to?: number; delay?: number; dest?: AudioNode; attack?: number } = {}): void {
    const rig = this.rig;
    if (!rig) return;
    const { ac } = rig;
    const t0 = ac.currentTime + (opts.delay ?? 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g);
    g.connect(opts.dest ?? rig.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  private noise(dur: number, vol: number, freq: number, opts: { type?: BiquadFilterType; q?: number; delay?: number; to?: number; dest?: AudioNode } = {}): void {
    const rig = this.rig;
    if (!rig) return;
    const { ac } = rig;
    const t0 = ac.currentTime + (opts.delay ?? 0);
    const src = ac.createBufferSource();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    src.buffer = rig.noise;
    f.type = opts.type ?? "bandpass";
    f.frequency.setValueAtTime(freq, t0);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    f.Q.value = opts.q ?? 1.2;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(opts.dest ?? rig.sfx);
    src.start(t0, Math.random() * 0.3);
    src.stop(t0 + dur + 0.02);
  }

  private arp(notes: readonly number[], gap: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    notes.forEach((m, i) => this.tone(mtof(m), dur, type, vol, { delay: delay + i * gap }));
  }

  /** 着せ替えの音階の音（n は何番目か、1〜） */
  private scaleNote(n: number, octave = 0): number {
    const { scale, root } = this.music;
    const idx = Math.abs(n) - 1;
    const len = scale.length;
    const wrap = Math.floor(idx / len);
    return root + scale[idx % len]! + 12 * wrap + (n < 0 ? -12 : 0) + octave * 12;
  }

  /* ---------- 効果音 ---------- */

  play(list: readonly GameFx[]): void {
    if (!this.rig || this.paused) return;
    const now = this.rig.ac.currentTime;
    for (const fx of list) {
      if (fx.type !== "sfx") continue;
      const last = this.lastSfx.get(fx.id) ?? -1;
      // 同じ音が重なりすぎないように
      const minGap = fx.id === "metal" || fx.id === "rubber" ? 0.035 : fx.id === "bumper" ? 0.03 : 0.012;
      if (now - last < minGap) continue;
      this.lastSfx.set(fx.id, now);
      this.sfx(fx.id, fx.level ?? 0);
    }
  }

  private sfx(id: SfxId, level: number): void {
    switch (id) {
      case "flipper":
        this.noise(0.04, 0.22, 1900, { q: 0.8 });
        this.tone(95, 0.07, "sine", 0.32, { to: 48 });
        break;
      case "flipperHit":
        this.tone(240, 0.06, "triangle", 0.12 + level * 0.15, { to: 120 });
        break;
      case "bumper": {
        const ring = [72, 76, 79][level] ?? 72;
        this.tone(620, 0.09, "sine", 0.32, { to: 170 });
        this.noise(0.05, 0.16, 2600, { q: 1.5 });
        this.tone(mtof(ring), 0.22, "triangle", 0.12, { delay: 0.01 });
        break;
      }
      case "sling":
        this.noise(0.06, 0.25, 950, { q: 1 });
        this.tone(340, 0.06, "square", 0.08, { to: 160 });
        break;
      case "drop":
        this.tone(190, 0.09, "triangle", 0.26, { to: 85 });
        this.noise(0.05, 0.12, 700);
        break;
      case "dropsAll":
        this.arp([this.scaleNote(5, 1), this.scaleNote(8, 1), this.scaleNote(10, 1)], 0.06, 0.18, "square", 0.08);
        break;
      case "lane":
        this.tone(880 + level * 110, 0.06, "square", 0.07);
        break;
      case "inlane":
        this.tone(660, 0.05, "triangle", 0.08);
        break;
      case "lanesAll":
        this.arp([this.scaleNote(1, 1), this.scaleNote(3, 1), this.scaleNote(5, 1), this.scaleNote(8, 1)], 0.07, 0.22, "square", 0.09);
        break;
      case "spinner": {
        const n = Math.min(14, Math.max(2, level));
        for (let i = 0; i < n; i += 1) this.noise(0.012, 0.12, 4200, { q: 3, delay: i * (0.022 + i * 0.004) });
        break;
      }
      case "rampUp":
        this.tone(220, 0.35, "sawtooth", 0.035, { to: 760 });
        break;
      case "rampDone":
        this.arp([this.scaleNote(5, 1), this.scaleNote(8, 1), this.scaleNote(10, 1), this.scaleNote(12, 1)], 0.05, 0.25, "triangle", 0.12 + Math.min(0.08, level * 0.02));
        break;
      case "rampFail":
        this.tone(420, 0.3, "sawtooth", 0.04, { to: 180 });
        break;
      case "orbit":
        this.noise(0.45, 0.12, 400, { to: 2600, q: 2 });
        this.tone(mtof(this.scaleNote(8, 1)), 0.2, "triangle", 0.08, { delay: 0.18 });
        break;
      case "scoop":
        this.tone(320, 0.18, "sine", 0.3, { to: 70 });
        break;
      case "eject":
        this.noise(0.08, 0.24, 800);
        this.tone(120, 0.12, "sine", 0.3, { to: 320 });
        break;
      case "gacha": {
        for (let i = 0; i < 5; i += 1) this.noise(0.03, 0.12, 3000, { q: 4, delay: i * 0.07 });
        this.arp([84, 88, 91, 96], 0.07, 0.4, "sine", 0.1, 0.4);
        break;
      }
      case "kickback":
        this.tone(80, 0.18, "sine", 0.45, { to: 200 });
        this.noise(0.3, 0.15, 500, { to: 2500 });
        break;
      case "save":
        this.arp([76, 81, 88, 81], 0.08, 0.2, "triangle", 0.12);
        break;
      case "drain":
        this.tone(330, 0.7, "sawtooth", 0.06, { to: 55 });
        this.tone(220, 0.7, "triangle", 0.08, { to: 45, delay: 0.05 });
        break;
      case "launch":
        this.noise(0.12, 0.2 + level * 0.15, 600, { to: 2400 });
        this.tone(140, 0.1, "sine", 0.25, { to: 70 });
        break;
      case "serve":
        this.noise(0.18, 0.06, 900, { to: 300 });
        break;
      case "item": {
        const base = this.scaleNote(5, 1);
        const notes = [base, base + 4, base + 7, base + 12, base + 16].slice(0, 3 + Math.min(2, Math.floor(level / 2)));
        this.arp(notes, 0.055, 0.35, "sine", 0.16);
        this.arp(notes.map((n) => n + 12), 0.055, 0.25, "triangle", 0.05, 0.02);
        break;
      }
      case "skill": {
        for (let i = 0; i < 6; i += 1) this.tone(mtof(this.scaleNote(1 + i * 2, 1)), 0.5, "sine", 0.06, { delay: i * 0.04, to: mtof(this.scaleNote(2 + i * 2, 1)) });
        break;
      }
      case "combo":
        this.tone(mtof(this.scaleNote(4 + level, 1)), 0.12, "square", 0.08);
        break;
      case "jackpot":
        this.arp([this.scaleNote(1, 1), this.scaleNote(5, 1), this.scaleNote(8, 1), this.scaleNote(12, 1)], 0.09, 0.4, "square", 0.12);
        this.tone(mtof(this.scaleNote(1)), 0.6, "sawtooth", 0.08);
        break;
      case "superJackpot":
        for (let r = 0; r < 3; r += 1) this.arp([this.scaleNote(1, 1), this.scaleNote(5, 1), this.scaleNote(8, 1), this.scaleNote(12, 1)], 0.07, 0.35, "square", 0.11, r * 0.32);
        break;
      case "conquest": {
        const mel = [1, 3, 5, 8, 0, 8, 10, 12];
        mel.forEach((n, i) => {
          if (n) this.tone(mtof(this.scaleNote(n, 1)), 0.32, "square", 0.12, { delay: i * 0.13 });
        });
        [1, 5, 8].forEach((n) => this.tone(mtof(this.scaleNote(n)), 1.6, "sawtooth", 0.05, { delay: 1.04 }));
        this.noise(1.4, 0.08, 6000, { type: "highpass", delay: 1.04 });
        break;
      }
      case "extraBall":
        this.arp([72, 76, 79, 84, 79, 84, 88], 0.08, 0.3, "triangle", 0.12);
        break;
      case "bonus":
        for (let i = 0; i < 8; i += 1) this.tone(700 + i * 60, 0.05, "square", 0.05, { delay: i * 0.08 });
        break;
      case "gameOver":
        this.arp([this.scaleNote(8), this.scaleNote(6), this.scaleNote(4), this.scaleNote(1)], 0.22, 0.5, "triangle", 0.12);
        break;
      case "skillShot":
        this.tone(1200, 0.25, "sawtooth", 0.05, { to: 2400 });
        this.arp([84, 88, 91, 96, 100], 0.05, 0.3, "square", 0.08, 0.1);
        break;
      case "outlane":
        this.tone(140, 0.4, "triangle", 0.12, { to: 70 });
        break;
      case "metal":
        this.noise(0.025, 0.06 + level * 0.18, 3600, { q: 2.5 });
        break;
      case "rubber":
        this.tone(160, 0.05, "sine", 0.06 + level * 0.18, { to: 90 });
        break;
      case "ballBall":
        this.noise(0.02, 0.1 + level * 0.2, 5200, { q: 3 });
        break;
    }
  }

  /* ---------- 曲 ---------- */

  /** 毎フレーム呼ぶ。少し先までの音を予約しておく */
  tick(): void {
    const rig = this.rig;
    if (!rig || !this.musicOn || this.paused) return;
    const bpm = this.music.bpm * (this.intensity > 0 ? 1.08 : 1);
    const spb = 60 / bpm / 4;
    const now = rig.ac.currentTime;
    if (this.nextAt < now) this.nextAt = now + 0.05;
    while (this.nextAt < now + 0.16) {
      this.musicStep(rig, this.step, this.nextAt, spb);
      this.nextAt += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  private note(rig: Rig, freq: number, t0: number, dur: number, kind: PinballMusic["lead"] | OscillatorType, vol: number): void {
    const { ac } = rig;
    const g = ac.createGain();
    g.connect(rig.bgm);
    const osc = (type: OscillatorType, f: number, v: number, d: number) => {
      const o = ac.createOscillator();
      const og = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      og.gain.setValueAtTime(0, t0);
      og.gain.linearRampToValueAtTime(v, t0 + 0.006);
      og.gain.exponentialRampToValueAtTime(0.0005, t0 + d);
      o.connect(og);
      og.connect(g);
      o.start(t0);
      o.stop(t0 + d + 0.03);
    };
    g.gain.value = 1;
    if (kind === "koto") {
      // 琴のようにはじく音：すぐ減衰する三角波＋2倍音
      osc("triangle", freq, vol, Math.min(0.7, dur * 2.4));
      osc("sine", freq * 2, vol * 0.35, Math.min(0.35, dur * 1.2));
      osc("sine", freq * 3.01, vol * 0.12, 0.12);
    } else if (kind === "bell") {
      osc("sine", freq, vol, 1.2);
      osc("sine", freq * 2.76, vol * 0.28, 0.6);
      osc("sine", freq * 5.4, vol * 0.08, 0.25);
    } else {
      osc(kind as OscillatorType, freq, vol, dur);
    }
  }

  private drum(rig: Rig, t0: number, f0: number, f1: number, dur: number, vol: number): void {
    const { ac } = rig;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.85);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g);
    g.connect(rig.bgm);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private hat(rig: Rig, t0: number, vol: number, hp = 7000, dur = 0.04): void {
    const { ac } = rig;
    const n = ac.createBufferSource();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    n.buffer = rig.noise;
    f.type = "highpass";
    f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    n.connect(f);
    f.connect(g);
    g.connect(rig.bgm);
    n.start(t0, Math.random() * 0.3);
    n.stop(t0 + dur + 0.01);
  }

  private musicStep(rig: Rig, i: number, t0: number, spb: number): void {
    const m = this.music;
    const bar = (i >> 4) & 3;
    const st = i & 15;
    const chordRoot = this.scaleNote(m.chords[bar]!, -1);
    const deg = m.melody[i] ?? 0;
    const hot = this.intensity > 0;
    // メロディ
    if (deg) {
      const leadVol = m.lead === "bell" ? 0.09 : m.lead === "koto" ? 0.12 : m.lead === "sine" ? 0.1 : 0.055;
      const leadType = m.lead === "koto" || m.lead === "bell" ? m.lead : m.lead;
      this.note(rig, mtof(this.scaleNote(deg, 1)), t0, spb * 1.9, leadType, leadVol);
    }
    // ベース
    if (m.kit === "bell") {
      if (st === 0) this.note(rig, mtof(chordRoot - 12), t0, spb * 14, "sine", 0.12);
      if (st === 0 || st === 8) {
        [0, 7, 12].forEach((d) => this.note(rig, mtof(chordRoot + d), t0, spb * 7, "sine", 0.025));
      }
    } else if (m.kit === "taiko") {
      if (st === 0 || st === 10) this.note(rig, mtof(chordRoot - 12), t0, spb * 3, "triangle", 0.13);
      if (st === 6) this.note(rig, mtof(chordRoot - 5), t0, spb * 2, "triangle", 0.08);
    } else {
      const pattern = m.kit === "rock" ? [0, 3, 6, 8, 11, 14] : [0, 6, 8, 14];
      if (pattern.includes(st)) this.note(rig, mtof(chordRoot - 12 + (st === 8 ? 12 : 0)), t0, spb * 1.7, m.kit === "rock" ? "sawtooth" : "triangle", m.kit === "rock" ? 0.05 : 0.12);
      if (st % 4 === 2) this.note(rig, mtof(chordRoot + 12 + (bar % 2 ? 4 : 7)), t0, spb * 0.9, "sine", 0.025);
    }
    // ドラム
    switch (m.kit) {
      case "pop":
        if (st === 0 || st === 8 || (hot && st === 10)) this.drum(rig, t0, 150, 42, 0.16, 0.3);
        if (st === 4 || st === 12) {
          this.hat(rig, t0, 0.07, 1800, 0.12);
          this.drum(rig, t0, 220, 160, 0.08, 0.06);
        }
        if (st % 2 === 1 || hot) this.hat(rig, t0, st % 4 === 3 ? 0.05 : 0.025);
        break;
      case "rock":
        if (st === 0 || st === 7 || st === 8 || (hot && st === 14)) this.drum(rig, t0, 130, 40, 0.18, 0.32);
        if (st === 4 || st === 12) this.hat(rig, t0, 0.1, 1500, 0.14);
        if (st % 2 === 0) this.hat(rig, t0, 0.03);
        if (bar === 3 && st >= 12) this.drum(rig, t0, 180 - (st - 12) * 25, 90, 0.12, 0.14);
        break;
      case "taiko":
        if (st === 0 || st === 3 || (hot && (st === 8 || st === 11))) this.drum(rig, t0, 120, 48, 0.32, st === 0 ? 0.42 : 0.26);
        if (st === 8 && !hot) this.drum(rig, t0, 120, 48, 0.32, 0.3);
        if (st === 6 || st === 14) this.hat(rig, t0, 0.07, 2600, 0.03);
        if (st === 12) this.hat(rig, t0, 0.05, 4500, 0.02);
        break;
      case "folk":
        if (st === 0 || st === 8) this.drum(rig, t0, 110, 50, 0.14, 0.22);
        if (st === 4 || st === 12) this.hat(rig, t0, 0.05, 5000, 0.08);
        if (hot && st % 2 === 1) this.hat(rig, t0, 0.025);
        break;
      case "bell":
        if (st === 0) this.drum(rig, t0, 90, 45, 0.5, 0.18);
        if (st === 8 && hot) this.drum(rig, t0, 90, 45, 0.5, 0.14);
        if (st === 4 || st === 12) this.hat(rig, t0, 0.025, 9000, 0.09);
        break;
    }
  }
}
