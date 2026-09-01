const PALETTE = {
  cream: 0xfff4d8,
  warmWhite: 0xfffbef,
  terracotta: 0xd97846,
  terracottaDark: 0xa94e32,
  wood: 0x8f5d3b,
  glass: 0x8fd3dc,
  leaf: 0x67a85d,
  leafLight: 0x8fc875,
  stone: 0xb9ad99,
  water: 0x78cad2,
};

function material(THREE: typeof import("three"), color: number, roughness = 0.78) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function mesh(
  THREE: typeof import("three"),
  geometry: unknown,
  color: number,
  roughness?: number,
) {
  const result = new THREE.Mesh(geometry, material(THREE, color, roughness));
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function addWindow(
  THREE: typeof import("three"),
  group: ReturnType<typeof THREE.Group>,
  x: number,
  y: number,
  z: number,
  scale = 1,
) {
  const frame = mesh(THREE, new THREE.BoxGeometry(0.48 * scale, 0.58 * scale, 0.08), PALETTE.warmWhite);
  frame.position.set(x, y, z);
  group.add(frame);
  const glass = mesh(THREE, new THREE.BoxGeometry(0.34 * scale, 0.42 * scale, 0.09), PALETTE.glass, 0.34);
  glass.position.set(x, y, z + 0.01);
  group.add(glass);
}

function addHouse(
  THREE: typeof import("three"),
  group: ReturnType<typeof THREE.Group>,
  width: number,
  depth: number,
  wallColor: number,
  roofColor: number,
  options: { tower?: boolean; awning?: boolean; chimney?: boolean } = {},
) {
  const bodyWidth = Math.max(1.8, width * 0.78);
  const bodyDepth = Math.max(1.7, depth * 0.72);
  const body = mesh(THREE, new THREE.BoxGeometry(bodyWidth, 1.45, bodyDepth), wallColor);
  body.position.y = 0.84;
  group.add(body);

  const roofRadius = Math.max(bodyWidth, bodyDepth) * 0.67;
  const roof = mesh(THREE, new THREE.ConeGeometry(roofRadius, 0.92, 4), roofColor);
  roof.position.y = 2.02;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  const front = bodyDepth / 2 + 0.045;
  const door = mesh(THREE, new THREE.BoxGeometry(0.48, 0.88, 0.1), PALETTE.wood);
  door.position.set(0, 0.56, front);
  group.add(door);
  addWindow(THREE, group, -bodyWidth * 0.28, 1.04, front + 0.01, 0.88);
  addWindow(THREE, group, bodyWidth * 0.28, 1.04, front + 0.01, 0.88);

  const step = mesh(THREE, new THREE.BoxGeometry(0.9, 0.16, 0.52), PALETTE.stone);
  step.position.set(0, 0.08, front + 0.24);
  group.add(step);

  if (options.awning) {
    const awning = mesh(THREE, new THREE.BoxGeometry(bodyWidth * 0.72, 0.12, 0.5), 0xf2bd55);
    awning.position.set(0, 1.42, front + 0.2);
    awning.rotation.x = -0.18;
    group.add(awning);
  }

  if (options.chimney) {
    const chimney = mesh(THREE, new THREE.BoxGeometry(0.38, 1.0, 0.38), PALETTE.terracottaDark);
    chimney.position.set(bodyWidth * 0.28, 2.15, 0);
    group.add(chimney);
    const cap = mesh(THREE, new THREE.BoxGeometry(0.52, 0.12, 0.52), PALETTE.cream);
    cap.position.set(bodyWidth * 0.28, 2.68, 0);
    group.add(cap);
  }

  if (options.tower) {
    const tower = mesh(THREE, new THREE.BoxGeometry(0.92, 1.16, 0.92), PALETTE.cream);
    tower.position.set(0, 2.42, 0);
    group.add(tower);
    const towerRoof = mesh(THREE, new THREE.ConeGeometry(0.82, 0.78, 4), PALETTE.terracotta);
    towerRoof.position.set(0, 3.34, 0);
    towerRoof.rotation.y = Math.PI / 4;
    group.add(towerRoof);
    const clock = mesh(THREE, new THREE.CylinderGeometry(0.24, 0.24, 0.06, 20), 0xffdf79);
    clock.rotation.x = Math.PI / 2;
    clock.position.set(0, 2.55, 0.49);
    group.add(clock);
  }
}

function addDogRun(
  THREE: typeof import("three"),
  group: ReturnType<typeof THREE.Group>,
  width: number,
  depth: number,
) {
  const lawn = mesh(THREE, new THREE.BoxGeometry(width * 0.88, 0.16, depth * 0.86), 0x8acb72);
  lawn.position.y = 0.08;
  group.add(lawn);
  const fenceMaterial = material(THREE, 0xf6e5bd);
  const halfW = width * 0.43;
  const halfD = depth * 0.42;
  for (let x = -halfW; x <= halfW + 0.01; x += 0.55) {
    for (const z of [-halfD, halfD]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.66, 0.1), fenceMaterial);
      post.position.set(x, 0.38, z);
      post.castShadow = true;
      group.add(post);
    }
  }
  for (let z = -halfD; z <= halfD + 0.01; z += 0.55) {
    for (const x of [-halfW, halfW]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.66, 0.1), fenceMaterial);
      post.position.set(x, 0.38, z);
      post.castShadow = true;
      group.add(post);
    }
  }
  const tunnel = mesh(THREE, new THREE.TorusGeometry(0.45, 0.13, 8, 18), 0xe8a95f);
  tunnel.position.set(0.25, 0.55, 0);
  group.add(tunnel);
}

function addHotSpring(
  THREE: typeof import("three"),
  group: ReturnType<typeof THREE.Group>,
  width: number,
  depth: number,
) {
  const radius = Math.min(width, depth) * 0.38;
  const stone = mesh(THREE, new THREE.CylinderGeometry(radius, radius * 1.06, 0.38, 20), PALETTE.stone);
  stone.position.y = 0.19;
  group.add(stone);
  const water = mesh(THREE, new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, 0.08, 24), PALETTE.water, 0.25);
  water.position.y = 0.42;
  group.add(water);
  const shelter = new THREE.Group();
  const roof = mesh(THREE, new THREE.ConeGeometry(0.92, 0.66, 4), PALETTE.terracotta);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.15;
  shelter.add(roof);
  for (const x of [-0.56, 0.56]) {
    for (const z of [-0.45, 0.45]) {
      const post = mesh(THREE, new THREE.CylinderGeometry(0.07, 0.08, 1.72, 8), PALETTE.wood);
      post.position.set(x, 1.0, z);
      shelter.add(post);
    }
  }
  shelter.position.set(-radius * 0.8, 0, -radius * 0.42);
  group.add(shelter);
}

export function createTownItemModel(
  THREE: typeof import("three"),
  itemId: string,
  width: number,
  depth: number,
) {
  const group = new THREE.Group();
  const base = mesh(THREE, new THREE.BoxGeometry(width * 0.94, 0.14, depth * 0.94), 0xb7d88c);
  base.position.y = 0.07;
  group.add(base);

  switch (itemId) {
    case "town-hall":
      addHouse(THREE, group, width, depth, PALETTE.cream, PALETTE.terracotta, { tower: true, chimney: true });
      break;
    case "dog-cafe":
      addHouse(THREE, group, width, depth, 0xf4d8aa, 0xbf6548, { awning: true });
      break;
    case "bakery":
      addHouse(THREE, group, width, depth, 0xffe8bd, 0xc96f43, { awning: true, chimney: true });
      break;
    case "dog-run":
      group.remove(base);
      addDogRun(THREE, group, width, depth);
      break;
    case "hot-spring":
      group.remove(base);
      addHotSpring(THREE, group, width, depth);
      break;
    default:
      addHouse(THREE, group, width, depth, PALETTE.cream, PALETTE.terracotta);
  }
  return group;
}

export function createTownTree(THREE: typeof import("three"), scale = 1) {
  const group = new THREE.Group();
  const trunk = mesh(THREE, new THREE.CylinderGeometry(0.13 * scale, 0.2 * scale, 1.25 * scale, 8), PALETTE.wood);
  trunk.position.y = 0.63 * scale;
  group.add(trunk);
  const crown = mesh(THREE, new THREE.DodecahedronGeometry(0.72 * scale, 0), PALETTE.leaf);
  crown.position.y = 1.58 * scale;
  group.add(crown);
  const crownLight = mesh(THREE, new THREE.DodecahedronGeometry(0.43 * scale, 0), PALETTE.leafLight);
  crownLight.position.set(-0.32 * scale, 1.8 * scale, 0.2 * scale);
  group.add(crownLight);
  return group;
}
