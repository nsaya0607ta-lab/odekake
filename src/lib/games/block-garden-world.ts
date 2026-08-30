import {
  BLOCK_DEFINITIONS,
  BLOCK_GARDEN_WORLD,
  type BlockId,
} from "@/lib/games/block-garden-config";

export type BlockPosition = Readonly<{ x: number; y: number; z: number }>;
export type BlockWorld = Map<string, BlockId>;

const NEIGHBOR_OFFSETS: readonly BlockPosition[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

export function blockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function getBlock(world: BlockWorld, position: BlockPosition): BlockId | undefined {
  return world.get(blockKey(position.x, position.y, position.z));
}

export function setBlock(world: BlockWorld, position: BlockPosition, blockId: BlockId): void {
  world.set(blockKey(position.x, position.y, position.z), blockId);
}

export function removeBlock(world: BlockWorld, position: BlockPosition): void {
  world.delete(blockKey(position.x, position.y, position.z));
}

function coordinateNoise(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function terrainHeight(x: number, z: number): number {
  const wave = Math.sin((x + 2) * 0.42) * 0.7 + Math.cos((z - 1) * 0.36) * 0.65;
  return Math.max(2, Math.min(4, Math.round(2.7 + wave * 0.55 + coordinateNoise(x, z) * 0.28)));
}

function isPondCell(x: number, z: number): boolean {
  const dx = (x + 3.5) / 3.7;
  const dz = (z - 1.5) / 3;
  return dx * dx + dz * dz < 1;
}

function topSolidBlockY(world: BlockWorld, x: number, z: number): number | null {
  for (let y = BLOCK_GARDEN_WORLD.maxY; y >= BLOCK_GARDEN_WORLD.minY; y -= 1) {
    const blockId = world.get(blockKey(x, y, z));
    if (blockId && BLOCK_DEFINITIONS[blockId].solid) return y;
  }
  return null;
}

function addTree(world: BlockWorld, x: number, z: number): void {
  const groundY = topSolidBlockY(world, x, z);
  if (groundY === null) return;

  for (let y = groundY + 1; y <= groundY + 3; y += 1) {
    setBlock(world, { x, y, z }, "wood");
  }

  const crownY = groundY + 4;
  const crownOffsets: readonly BlockPosition[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
    { x: 1, y: 0, z: 1 },
    { x: -1, y: 0, z: -1 },
    { x: 0, y: 1, z: 0 },
  ];

  for (const offset of crownOffsets) {
    setBlock(world, { x: x + offset.x, y: crownY + offset.y, z: z + offset.z }, "leaves");
  }
}

function addFlower(world: BlockWorld, x: number, z: number): void {
  const groundY = topSolidBlockY(world, x, z);
  if (groundY === null) return;
  const position = { x, y: groundY + 1, z };
  if (!getBlock(world, position)) setBlock(world, position, "flower");
}

export function createBlockGardenWorld(): BlockWorld {
  const world: BlockWorld = new Map();

  for (let x = BLOCK_GARDEN_WORLD.min; x <= BLOCK_GARDEN_WORLD.max; x += 1) {
    for (let z = BLOCK_GARDEN_WORLD.min; z <= BLOCK_GARDEN_WORLD.max; z += 1) {
      const pond = isPondCell(x, z);
      const topY = pond ? 1 : terrainHeight(x, z);

      for (let y = BLOCK_GARDEN_WORLD.minY; y <= topY; y += 1) {
        const depth = topY - y;
        const blockId: BlockId = y === 0 || depth >= 3 ? "stone" : depth === 0 ? "grass" : "dirt";
        setBlock(world, { x, y, z }, blockId);
      }

      if (pond) setBlock(world, { x, y: 2, z }, "water");
    }
  }

  addTree(world, 5, 4);
  addTree(world, 7, -5);
  addTree(world, -7, -5);
  addTree(world, -2, -8);

  const flowerCells: readonly [number, number][] = [
    [-8, 5],
    [-6, 7],
    [1, 6],
    [4, 7],
    [8, 2],
    [4, -2],
    [-8, -1],
    [1, -6],
  ];
  for (const [x, z] of flowerCells) addFlower(world, x, z);

  return world;
}

export function getVisibleBlocks(world: BlockWorld): Map<BlockId, BlockPosition[]> {
  const visible = new Map<BlockId, BlockPosition[]>();

  for (const [key, blockId] of world) {
    const [xValue, yValue, zValue] = key.split(",").map(Number);
    if (xValue === undefined || yValue === undefined || zValue === undefined) continue;
    const position = { x: xValue, y: yValue, z: zValue };

    const exposed = NEIGHBOR_OFFSETS.some((offset) => {
      const neighborId = world.get(blockKey(position.x + offset.x, position.y + offset.y, position.z + offset.z));
      return !neighborId || !BLOCK_DEFINITIONS[neighborId].occludes;
    });
    if (!exposed) continue;

    const positions = visible.get(blockId) ?? [];
    positions.push(position);
    visible.set(blockId, positions);
  }

  return visible;
}

export function getGroundHeight(world: BlockWorld, x: number, z: number): number | null {
  const blockX = Math.round(x);
  const blockZ = Math.round(z);
  if (
    blockX < BLOCK_GARDEN_WORLD.min ||
    blockX > BLOCK_GARDEN_WORLD.max ||
    blockZ < BLOCK_GARDEN_WORLD.min ||
    blockZ > BLOCK_GARDEN_WORLD.max
  ) {
    return null;
  }

  const topY = topSolidBlockY(world, blockX, blockZ);
  return topY === null ? null : topY + 0.5;
}

export function getPlayerGroundHeight(world: BlockWorld, x: number, z: number, radius = 0.28): number | null {
  const samples: readonly [number, number][] = [
    [x - radius, z - radius],
    [x + radius, z - radius],
    [x - radius, z + radius],
    [x + radius, z + radius],
  ];
  const heights = samples.map(([sampleX, sampleZ]) => getGroundHeight(world, sampleX, sampleZ));
  if (heights.some((height) => height === null)) return null;
  return Math.max(...(heights as number[]));
}

export function isInsideWorld(position: BlockPosition): boolean {
  return (
    position.x >= BLOCK_GARDEN_WORLD.min &&
    position.x <= BLOCK_GARDEN_WORLD.max &&
    position.z >= BLOCK_GARDEN_WORLD.min &&
    position.z <= BLOCK_GARDEN_WORLD.max &&
    position.y >= BLOCK_GARDEN_WORLD.minY &&
    position.y <= BLOCK_GARDEN_WORLD.maxY
  );
}

export function blockOverlapsPlayer(
  position: BlockPosition,
  player: { x: number; feetY: number; z: number },
): boolean {
  const horizontalOverlap = Math.abs(position.x - player.x) < 0.82 && Math.abs(position.z - player.z) < 0.82;
  const blockBottom = position.y - 0.5;
  const blockTop = position.y + 0.5;
  const playerTop = player.feetY + 1.72;
  const verticalOverlap = blockTop > player.feetY + 0.05 && blockBottom < playerTop;
  return horizontalOverlap && verticalOverlap;
}
