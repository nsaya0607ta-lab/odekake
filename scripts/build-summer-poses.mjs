import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PARTS_DIR = join(ROOT, "scripts", "summer-pose-sprite");
const OUTPUT_DIR = join(ROOT, "public", "characters", "summer");

const POSES = [
  "stand",
  "walk",
  "sit",
  "sniff",
  "stand-happy",
  "shake",
  "sleep",
  "wonder",
  "sit-side",
  "wave",
  "wink",
  "smile",
  "bark",
  "cheer",
  "trot",
  "front",
  "yawn",
  "walk-tail",
  "lie-wave",
  "bow-b",
  "bow",
];

const COLS = 7;
const CELL_WIDTH = 90;
const CELL_HEIGHT = 76;
const SPRITE_WIDTH = COLS * CELL_WIDTH;
const SPRITE_HEIGHT = 3 * CELL_HEIGHT;

const parts = await Promise.all(
  Array.from({ length: 8 }, (_, index) =>
    readFile(join(PARTS_DIR, `part${index}.b64`), "utf8"),
  ),
);
const sprite = parts.join("").replace(/\s+/g, "");

await mkdir(OUTPUT_DIR, { recursive: true });

await Promise.all(
  POSES.map(async (pose, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = -(col * CELL_WIDTH);
    const y = -(row * CELL_HEIGHT);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="254" viewBox="0 0 ${CELL_WIDTH} ${CELL_HEIGHT}" preserveAspectRatio="xMidYMid meet"><image href="data:image/webp;base64,${sprite}" x="${x}" y="${y}" width="${SPRITE_WIDTH}" height="${SPRITE_HEIGHT}" preserveAspectRatio="none"/></svg>`;

    await writeFile(join(OUTPUT_DIR, `${pose}.svg`), svg, "utf8");
  }),
);

console.log(`Generated ${POSES.length} summer Frenchie pose files.`);
