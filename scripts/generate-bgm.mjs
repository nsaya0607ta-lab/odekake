// 起動BGM(ループ用WAV)をプログラムで合成するスクリプト。
// 外部素材に依存せず、明るい雰囲気の短いループを生成する。
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_PATH = fileURLToPath(new URL("../public/audio/bgm.wav", import.meta.url));
const SAMPLE_RATE = 44100;
const LOOP_SECONDS = 16; // 4拍 x 4小節 x 4コードのループ
const BPM = 100;
const beatSec = 60 / BPM;

// C - G - Am - F の明るい進行。各コードでアルペジオを鳴らす。
const chords = [
  [261.63, 329.63, 392.0, 523.25], // C E G C
  [196.0, 246.94, 329.63, 392.0], // G B D G
  [220.0, 261.63, 329.63, 440.0], // A C E A
  [174.61, 220.0, 261.63, 349.23], // F A C F
];

const totalSamples = Math.round(SAMPLE_RATE * LOOP_SECONDS);
const left = new Float32Array(totalSamples);
const right = new Float32Array(totalSamples);

function envelope(tSec, durSec) {
  const attack = 0.02;
  const release = durSec * 0.6;
  if (tSec < attack) return tSec / attack;
  const rel = tSec - (durSec - release);
  if (rel > 0) return Math.max(0, 1 - rel / release);
  return 1;
}

// グロッケン風の音: 基音 + 倍音を弱めに重ねる
function tone(freq, tSec) {
  return (
    Math.sin(2 * Math.PI * freq * tSec) * 1.0 +
    Math.sin(2 * Math.PI * freq * 2 * tSec) * 0.25 +
    Math.sin(2 * Math.PI * freq * 3 * tSec) * 0.1
  );
}

const notesPerChord = 8; // 1コードあたり8個のアルペジオ音符
const noteDur = (beatSec * 4) / notesPerChord;

let cursor = 0;
for (let c = 0; c < chords.length; c++) {
  const notes = chords[c];
  for (let n = 0; n < notesPerChord; n++) {
    const freq = notes[n % notes.length];
    const startSample = Math.round(cursor * SAMPLE_RATE);
    const durSamples = Math.round(noteDur * SAMPLE_RATE * 1.4); // 余韻を残して重なる
    for (let i = 0; i < durSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;
      const tSec = i / SAMPLE_RATE;
      const dur = (durSamples / SAMPLE_RATE);
      const env = envelope(tSec, dur);
      const sample = tone(freq, tSec) * env * 0.12;
      left[idx] += sample;
      right[idx] += sample * 0.95;
    }
    cursor += noteDur;
  }
}

// 柔らかいパッド(ルート音のロングトーン)を薄く重ねてループ全体を滑らかに
for (let c = 0; c < chords.length; c++) {
  const root = chords[c][0] / 2;
  const segStart = c * (LOOP_SECONDS / chords.length);
  const segDur = LOOP_SECONDS / chords.length;
  const startSample = Math.round(segStart * SAMPLE_RATE);
  const durSamples = Math.round(segDur * SAMPLE_RATE);
  for (let i = 0; i < durSamples; i++) {
    const idx = startSample + i;
    if (idx >= totalSamples) break;
    const tSec = i / SAMPLE_RATE;
    const fadeLen = SAMPLE_RATE * 0.5;
    let fade = 1;
    if (i < fadeLen) fade = i / fadeLen;
    if (durSamples - i < fadeLen) fade = Math.min(fade, (durSamples - i) / fadeLen);
    const sample = Math.sin(2 * Math.PI * root * tSec) * 0.04 * fade;
    left[idx] += sample;
    right[idx] += sample;
  }
}

// クリッピング防止のソフトリミッタ
function limit(x) {
  return Math.tanh(x);
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, limit(input[i])));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeWavStereo(left, right, sampleRate) {
  const numFrames = left.length;
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample * 2;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 2, true); // stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-1, Math.min(1, limit(left[i])));
    const r = Math.max(-1, Math.min(1, limit(right[i])));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    offset += 2;
    view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 2;
  }

  return Buffer.from(buffer);
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
const wav = writeWavStereo(left, right, SAMPLE_RATE);
writeFileSync(OUT_PATH, wav);
console.log(`Generated ${OUT_PATH} (${(wav.length / 1024).toFixed(1)} KB, ${LOOP_SECONDS}s loop)`);
