import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const canvas = document.querySelector("#world");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#9edcff");
scene.fog = new THREE.FogExp2("#dff5ff", 0.0075);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 500);
camera.position.set(12, 9, 17);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.72, 0.9);
bloom.threshold = 0.86;
bloom.strength = 0.24;
bloom.radius = 0.56;
composer.addPass(bloom);

const clock = new THREE.Clock();
const world = new THREE.Group();
scene.add(world);

const mats = {
  grass: new THREE.MeshStandardMaterial({ color: "#87bd62", roughness: 0.94 }),
  grassLight: new THREE.MeshStandardMaterial({ color: "#abd77d", roughness: 0.9 }),
  rock: new THREE.MeshStandardMaterial({ color: "#697b89", roughness: 1, flatShading: true }),
  rockLight: new THREE.MeshStandardMaterial({ color: "#90a2ad", roughness: 1, flatShading: true }),
  plaster: new THREE.MeshStandardMaterial({ color: "#fff0ca", roughness: 0.86 }),
  plasterWarm: new THREE.MeshStandardMaterial({ color: "#f4c98b", roughness: 0.84 }),
  timber: new THREE.MeshStandardMaterial({ color: "#68452f", roughness: 0.82 }),
  timberLight: new THREE.MeshStandardMaterial({ color: "#936640", roughness: 0.82 }),
  roof: new THREE.MeshStandardMaterial({ color: "#d46858", roughness: 0.88 }),
  roofBlue: new THREE.MeshStandardMaterial({ color: "#4f91a8", roughness: 0.84 }),
  gold: new THREE.MeshStandardMaterial({ color: "#f2c85f", metalness: 0.45, roughness: 0.3 }),
  window: new THREE.MeshStandardMaterial({ color: "#fff2a5", emissive: "#ffb93f", emissiveIntensity: 1.5, roughness: 0.22 }),
  leaf: new THREE.MeshStandardMaterial({ color: "#4f9b55", roughness: 0.9, flatShading: true }),
  leafGold: new THREE.MeshStandardMaterial({ color: "#e8ad54", roughness: 0.88, flatShading: true }),
  cloud: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.46, depthWrite: false }),
};

const shadow = (mesh, receive = true) => {
  mesh.castShadow = true;
  mesh.receiveShadow = receive;
  return mesh;
};

const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
  const mesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material));
  mesh.position.set(x, y, z);
  return mesh;
};

const cylinder = (rt, rb, h, sides, material) =>
  shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, sides), material));

const ambient = new THREE.HemisphereLight("#fff8dc", "#78bad5", 3.15);
scene.add(ambient);
const sun = new THREE.DirectionalLight("#fff0bd", 5.15);
sun.position.set(-30, 42, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.00045;
scene.add(sun);

const sunDisc = new THREE.Mesh(
  new THREE.SphereGeometry(4.8, 32, 16),
  new THREE.MeshBasicMaterial({ color: "#fff0a6", fog: false })
);
sunDisc.position.set(-78, 43, -105);
scene.add(sunDisc);

function createIsland(radiusX, radiusZ, topY, depth, x, z, material = mats.grass) {
  const group = new THREE.Group();
  group.position.set(x, topY, z);
  const top = cylinder(radiusX, radiusX * 0.97, 1.1, 48, material);
  top.scale.z = radiusZ / radiusX;
  top.position.y = -0.55;
  group.add(top);

  const underside = new THREE.Mesh(new THREE.ConeGeometry(radiusX * 0.92, depth, 18, 5), mats.rock);
  underside.position.y = -depth / 2 - 0.8;
  underside.scale.z = radiusZ / radiusX;
  underside.rotation.y = 0.16;
  underside.castShadow = true;
  underside.receiveShadow = true;
  group.add(underside);

  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + Math.sin(i * 7.2) * 0.08;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.2 + (i % 4) * 0.24, 0),
      i % 3 ? mats.rock : mats.rockLight
    );
    rock.scale.set(1.2, 0.6 + (i % 5) * 0.12, 0.85);
    rock.position.set(Math.cos(angle) * radiusX * 0.92, -0.7, Math.sin(angle) * radiusZ * 0.92);
    rock.rotation.set(i * 0.4, angle, i * 0.17);
    shadow(rock);
    group.add(rock);
  }
  world.add(group);
  return group;
}

const mainIsland = createIsland(20, 17, 0, 14, 0, 0);
const chapelIsland = createIsland(8.2, 7.2, 3.6, 9, 25, -15, mats.grassLight);
const gardenIsland = createIsland(5.5, 5, -1.7, 7, -25, 12, mats.grass);

function createCottage({ x, z, scale = 1, rotation = 0, roof = mats.roof, material = mats.plaster }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotation;
  g.scale.setScalar(scale);

  const body = box(4.2, 3.2, 3.5, material, 0, 1.6, 0);
  g.add(body);
  const upper = box(4.55, 1.4, 3.8, material, 0, 3.65, 0);
  g.add(upper);

  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(3.7, 2.5, 4), roof);
  roofMesh.position.y = 5.15;
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.scale.z = 0.82;
  shadow(roofMesh);
  g.add(roofMesh);

  const door = box(1.05, 2.05, 0.18, mats.timber, 0, 1.03, 1.84);
  g.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mats.gold);
  knob.position.set(0.3, 1.1, 1.96);
  g.add(knob);

  [-1.25, 1.25].forEach((wx) => {
    const frame = box(0.9, 1.05, 0.18, mats.timber, wx, 2.05, 1.85);
    const glass = box(0.64, 0.78, 0.2, mats.window, wx, 2.05, 1.94);
    g.add(frame, glass);
  });

  const beams = [
    box(0.18, 3.2, 0.16, mats.timber, -2.0, 2.4, 1.87),
    box(0.18, 3.2, 0.16, mats.timber, 2.0, 2.4, 1.87),
    box(4.25, 0.17, 0.16, mats.timber, 0, 3.1, 1.87),
  ];
  beams.forEach((beam) => g.add(beam));

  const chimney = box(0.7, 2.2, 0.7, mats.timberLight, 1.55, 5.3, -0.4);
  chimney.rotation.z = -0.04;
  g.add(chimney);
  world.add(g);
  return g;
}

createCottage({ x: -8.5, z: -3.8, scale: 1.0, rotation: 0.3 });
createCottage({ x: 3.6, z: -8.3, scale: 0.88, rotation: -0.38, roof: mats.roofBlue, material: mats.plasterWarm });
createCottage({ x: 9.8, z: 3.8, scale: 0.95, rotation: -1.75 });

function createTower() {
  const g = new THREE.Group();
  g.position.set(-1.8, 0, 6.6);
  const base = cylinder(3.0, 3.35, 8.7, 12, mats.plaster);
  base.position.y = 4.35;
  g.add(base);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const brace = box(0.38, 6.8, 0.35, mats.timber);
    brace.position.set(Math.sin(angle) * 2.95, 4.0, Math.cos(angle) * 2.95);
    brace.rotation.y = angle;
    g.add(brace);
  }
  const top = cylinder(3.8, 3.8, 0.65, 12, mats.timber);
  top.position.y = 8.85;
  g.add(top);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 4.4, 12), mats.roofBlue);
  roof.position.y = 11.35;
  shadow(roof);
  g.add(roof);
  const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.18, 32), mats.plasterWarm);
  clockFace.rotation.x = Math.PI / 2;
  clockFace.position.set(0, 6.55, 3.13);
  shadow(clockFace);
  g.add(clockFace);
  const hand = box(0.12, 0.95, 0.1, mats.timber);
  hand.position.set(0, 6.75, 3.25);
  hand.rotation.z = -0.55;
  g.add(hand);
  const hand2 = box(0.1, 0.7, 0.1, mats.timber);
  hand2.position.set(0.2, 6.45, 3.26);
  hand2.rotation.z = 1.05;
  g.add(hand2);
  world.add(g);
}
createTower();

function createWindmill() {
  const g = new THREE.Group();
  g.position.set(24.8, 3.6, -15.2);
  g.rotation.y = -0.58;
  const tower = cylinder(2.4, 3.15, 6.8, 12, mats.plasterWarm);
  tower.position.y = 3.4;
  g.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3.0, 2.7, 12), mats.roof);
  cap.position.y = 7.8;
  shadow(cap);
  g.add(cap);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), mats.gold);
  hub.position.set(0, 5.7, 2.55);
  g.add(hub);
  const blades = new THREE.Group();
  blades.position.copy(hub.position);
  for (let i = 0; i < 4; i++) {
    const bladeRoot = new THREE.Group();
    bladeRoot.rotation.z = i * Math.PI / 2;
    const stem = box(0.18, 3.4, 0.18, mats.timber, 0, 1.75, 0);
    const sail = box(0.88, 2.15, 0.09, mats.plaster, 0, 2.25, 0.12);
    sail.rotation.z = -0.08;
    bladeRoot.add(stem, sail);
    blades.add(bladeRoot);
  }
  g.add(blades);
  g.userData.blades = blades;
  world.add(g);
  return g;
}
const windmill = createWindmill();

function createTree(x, z, scale = 1, gold = false, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  const trunk = cylinder(0.32, 0.48, 3.3, 7, mats.timber);
  trunk.position.y = 1.65;
  trunk.rotation.z = 0.05;
  g.add(trunk);
  const leafMat = gold ? mats.leafGold : mats.leaf;
  const crowns = [
    [-0.65, 3.8, 0.1, 1.4],
    [0.7, 4.0, -0.1, 1.55],
    [0, 5.0, 0, 1.75],
  ];
  crowns.forEach(([cx, cy, cz, s]) => {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), leafMat);
    crown.position.set(cx, cy, cz);
    crown.scale.y = 0.9;
    shadow(crown);
    g.add(crown);
  });
  world.add(g);
}

[
  [-14, 5, 1.0], [-13, -9, .82], [-7, 11.8, .72], [12.5, -5.5, .85],
  [14.2, 9.4, 1.1], [6.4, 12.2, .68], [-15, -1, .7]
].forEach(([x, z, s], i) => createTree(x, z, s, i === 4));
createTree(28, -17.5, .78, true, 3.6);
createTree(22, -11.5, .68, false, 3.6);
createTree(-25, 12, .82, true, -1.7);

function createBridge(a, b, startY, endY) {
  const start = new THREE.Vector3(a[0], startY, a[1]);
  const end = new THREE.Vector3(b[0], endY, b[1]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  const steps = Math.ceil(length / 1.25);
  const bridge = new THREE.Group();
  for (let i = 0; i < steps; i++) {
    const t = i / Math.max(steps - 1, 1);
    const p = start.clone().lerp(end, t);
    const plank = box(1.5, 0.22, 1.05, i % 2 ? mats.timberLight : mats.timber);
    plank.position.copy(p);
    plank.rotation.y = Math.atan2(delta.x, delta.z);
    plank.rotation.z = Math.sin(i * 1.7) * 0.012;
    bridge.add(plank);
  }
  world.add(bridge);
}
createBridge([15.5, -7.8], [20.5, -11.2], 0.35, 3.95);
createBridge([-18.5, 6], [-21, 9.5], -0.15, -1.25);

function createMarketStall(x, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  g.add(box(3.6, .25, 1.5, mats.timber, 0, 1.45, 0));
  [-1.55, 1.55].forEach((px) => g.add(box(.16, 2.9, .16, mats.timber, px, 1.45, 0)));
  const canopy = box(4.0, .18, 2.3, mats.roof, 0, 3.0, 0);
  canopy.rotation.z = .04;
  g.add(canopy);
  for (let i = 0; i < 5; i++) {
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(.18 + (i % 2) * .03, 10, 8),
      new THREE.MeshStandardMaterial({ color: i % 2 ? "#d39258" : "#9d4f3d", roughness: .8 })
    );
    fruit.position.set(-.8 + i * .4, 1.75, .1 + Math.sin(i) * .2);
    shadow(fruit);
    g.add(fruit);
  }
  world.add(g);
}
createMarketStall(5.5, 1.6, -0.35);

for (let i = 0; i < 28; i++) {
  const angle = (i / 28) * Math.PI * 2 + i * 0.24;
  const r = 10 + (i % 4) * 2.1;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.25 + (i % 3) * .14, 0), mats.rockLight);
  rock.position.set(Math.cos(angle) * r, .08, Math.sin(angle) * r);
  rock.scale.y = .55;
  rock.rotation.set(i, angle, i * .3);
  shadow(rock);
  world.add(rock);
}

const cloudGeometry = new THREE.SphereGeometry(1, 12, 8);
for (let i = 0; i < 26; i++) {
  const g = new THREE.Group();
  const count = 3 + (i % 4);
  for (let j = 0; j < count; j++) {
    const puff = new THREE.Mesh(cloudGeometry, mats.cloud);
    puff.position.set(j * 1.3, Math.sin(j * 1.8) * .2, Math.cos(j) * .5);
    puff.scale.set(2.2 + j * .3, .7 + (j % 2) * .2, 1.2);
    g.add(puff);
  }
  const angle = i * 2.4;
  const radius = 35 + (i % 6) * 10;
  g.position.set(Math.cos(angle) * radius, -8 + (i % 5) * 4.2, Math.sin(angle) * radius);
  g.userData.speed = .12 + (i % 4) * .03;
  scene.add(g);
}

const cloudSeaMaterial = new THREE.MeshBasicMaterial({
  color: "#f8fdff",
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
});
const cloudSea = new THREE.InstancedMesh(cloudGeometry, cloudSeaMaterial, 190);
const cloudDummy = new THREE.Object3D();
for (let i = 0; i < 190; i++) {
  const angle = i * 2.39996;
  const radius = 5 + Math.sqrt(i / 190) * 112;
  cloudDummy.position.set(
    Math.cos(angle) * radius,
    -11.2 + Math.sin(i * 1.83) * 1.15,
    Math.sin(angle) * radius
  );
  cloudDummy.rotation.y = angle * 0.35;
  cloudDummy.scale.set(5.2 + (i % 7) * 0.75, 1.35 + (i % 4) * 0.28, 4.1 + (i % 5) * 0.62);
  cloudDummy.updateMatrix();
  cloudSea.setMatrixAt(i, cloudDummy.matrix);
}
cloudSea.instanceMatrix.needsUpdate = true;
scene.add(cloudSea);

const cloudFloor = new THREE.Mesh(
  new THREE.CircleGeometry(150, 64),
  new THREE.MeshBasicMaterial({
    color: "#e9f9ff",
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
cloudFloor.rotation.x = -Math.PI / 2;
cloudFloor.position.y = -13.1;
scene.add(cloudFloor);

const creatureMaterials = {
  whale: new THREE.MeshStandardMaterial({ color: "#4d86a8", roughness: 0.66, flatShading: true }),
  whaleLight: new THREE.MeshStandardMaterial({ color: "#bde4e8", roughness: 0.72, flatShading: true }),
  dolphin: new THREE.MeshStandardMaterial({ color: "#54a7c5", roughness: 0.62, flatShading: true }),
  eye: new THREE.MeshBasicMaterial({ color: "#173346" }),
};

function createCloudCreature({ dolphin = false, scale = 1 }) {
  const g = new THREE.Group();
  const bodyMat = dolphin ? creatureMaterials.dolphin : creatureMaterials.whale;
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), bodyMat);
  body.scale.set(dolphin ? 2.7 : 3.8, dolphin ? 0.62 : 1.12, dolphin ? 0.72 : 1.28);
  shadow(body, false);
  g.add(body);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), bodyMat);
  snout.position.x = dolphin ? 2.45 : 3.15;
  snout.scale.set(dolphin ? 1.45 : 1.1, dolphin ? 0.35 : 0.8, dolphin ? 0.42 : 0.95);
  shadow(snout, false);
  g.add(snout);

  if (!dolphin) {
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), creatureMaterials.whaleLight);
    belly.position.set(0.55, -0.42, 0);
    belly.scale.set(2.9, 0.55, 1.04);
    g.add(belly);
  }

  const tail = new THREE.Group();
  tail.position.x = dolphin ? -2.72 : -3.78;
  [-1, 1].forEach((side) => {
    const fluke = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 7), bodyMat);
    fluke.position.z = side * (dolphin ? 0.45 : 0.72);
    fluke.rotation.y = side * 0.48;
    fluke.scale.set(dolphin ? 0.95 : 1.4, 0.16, dolphin ? 0.74 : 1.08);
    shadow(fluke, false);
    tail.add(fluke);
  });
  g.add(tail);

  [-1, 1].forEach((side) => {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(dolphin ? 0.28 : 0.42, dolphin ? 1.4 : 2.05, 3), bodyMat);
    fin.position.set(dolphin ? -0.15 : -0.35, -0.35, side * (dolphin ? 0.62 : 1.12));
    fin.rotation.x = side * 1.12;
    fin.rotation.z = -0.25;
    shadow(fin, false);
    g.add(fin);
  });

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(dolphin ? 0.3 : 0.48, dolphin ? 1.15 : 1.55, 3), bodyMat);
  dorsal.position.set(dolphin ? -0.45 : -0.7, dolphin ? 0.72 : 1.15, 0);
  dorsal.rotation.z = -0.16;
  shadow(dorsal, false);
  g.add(dorsal);

  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(dolphin ? 0.07 : 0.1, 8, 6), creatureMaterials.eye);
    eye.position.set(dolphin ? 2.1 : 2.78, dolphin ? 0.18 : 0.34, side * (dolphin ? 0.5 : 0.82));
    g.add(eye);
  });

  g.scale.setScalar(scale);
  g.userData.tail = tail;
  scene.add(g);
  return g;
}

const skyCreatures = [
  { object: createCloudCreature({ scale: 2.05 }), duration: 29, phase: 0.08, span: 104, baseY: -12.4, height: 24, z: -38 },
  { object: createCloudCreature({ dolphin: true, scale: 0.86 }), duration: 15, phase: 0.06, span: 68, baseY: -11.5, height: 15, z: 28 },
  { object: createCloudCreature({ dolphin: true, scale: 0.72 }), duration: 15, phase: 0.12, span: 68, baseY: -11.5, height: 13, z: 31 },
  { object: createCloudCreature({ dolphin: true, scale: 0.62 }), duration: 15, phase: 0.18, span: 68, baseY: -11.5, height: 11, z: 25 },
];

function updateSkyCreatures(elapsed) {
  skyCreatures.forEach((creature, index) => {
    const p = ((elapsed / creature.duration) + creature.phase) % 1;
    const x = (p - 0.5) * creature.span;
    const y = creature.baseY + Math.sin(p * Math.PI) * creature.height;
    const z = creature.z + Math.sin(p * Math.PI * 2) * (index ? 2.4 : 5.5);
    creature.object.position.set(x, y, z);
    const slope = (Math.PI * creature.height * Math.cos(p * Math.PI)) / creature.span;
    creature.object.rotation.z = Math.atan(slope);
    creature.object.rotation.y = -Math.atan((Math.PI * 2 * (index ? 2.4 : 5.5) * Math.cos(p * Math.PI * 2)) / creature.span);
    creature.object.userData.tail.rotation.z = Math.sin(elapsed * (index ? 5.5 : 2.4) + index) * (index ? 0.18 : 0.1);
  });
}

const shardMaterial = new THREE.MeshStandardMaterial({
  color: "#ffefad",
  emissive: "#e5bb58",
  emissiveIntensity: 2.4,
  metalness: .28,
  roughness: .2,
});
const shardSpawns = [
  { position: [-12.5, 1.0, -7.5], hint: "主岛西南草坡" },
  { position: [-10.5, 1.0, 9.0], hint: "钟楼西侧林缘" },
  { position: [3.0, 1.15, 2.1], hint: "集市外的草地" },
  { position: [12.5, 1.0, 9.5], hint: "主岛东北高地" },
  { position: [8.0, 1.0, -11.0], hint: "蓝顶小屋后的坡地" },
  { position: [28.2, 4.9, -18.0], hint: "风车岛外缘" },
  { position: [-27.2, -0.55, 9.6], hint: "西侧花园岛" },
];
const shards = shardSpawns.map(({ position: p, hint }, index) => {
  const g = new THREE.Group();
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.42, 0), shardMaterial);
  crystal.scale.y = 1.55;
  crystal.castShadow = true;
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(.72, .025, 8, 32),
    new THREE.MeshBasicMaterial({ color: "#ffe99a", transparent: true, opacity: .48 })
  );
  halo.rotation.x = Math.PI / 2;
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(.08, .42, 4.8, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: "#fff4a9",
      transparent: true,
      opacity: .16,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  beacon.position.y = 2.25;
  const upperRing = halo.clone();
  upperRing.material = halo.material.clone();
  upperRing.position.y = 1.35;
  upperRing.scale.setScalar(.7);
  g.add(crystal, halo, beacon, upperRing);
  g.position.set(...p);
  g.userData.index = index;
  g.userData.baseY = p[1];
  g.userData.hint = hint;
  g.userData.beacon = beacon;
  g.userData.upperRing = upperRing;
  world.add(g);
  return g;
});

const particlesGeometry = new THREE.BufferGeometry();
const particleCount = 320;
const particleArray = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  particleArray[i * 3] = (Math.random() - .5) * 90;
  particleArray[i * 3 + 1] = Math.random() * 35 - 8;
  particleArray[i * 3 + 2] = (Math.random() - .5) * 90;
}
particlesGeometry.setAttribute("position", new THREE.BufferAttribute(particleArray, 3));
const particles = new THREE.Points(
  particlesGeometry,
  new THREE.PointsMaterial({ color: "#ffe8a3", size: .055, transparent: true, opacity: .65, depthWrite: false })
);
scene.add(particles);

const heroRoot = new THREE.Group();
heroRoot.position.set(0, .05, 13.0);
world.add(heroRoot);

function createFallbackHero() {
  const g = new THREE.Group();
  const cloakMat = new THREE.MeshStandardMaterial({ color: "#3d5d58", roughness: .8 });
  const fur = new THREE.MeshStandardMaterial({ color: "#b86e3e", roughness: .88 });
  const cream = new THREE.MeshStandardMaterial({ color: "#e4c59f", roughness: .9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42, 1.0, 6, 10), cloakMat);
  body.position.y = 1.05;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.46, 16, 12), fur);
  head.position.set(0, 1.92, .03);
  head.scale.z = .85;
  head.castShadow = true;
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.25, 12, 8), cream);
  muzzle.position.set(0, 1.82, .37);
  muzzle.scale.set(1.25, .7, .8);
  const earGeo = new THREE.ConeGeometry(.18, .55, 4);
  [-.25, .25].forEach((x) => {
    const ear = new THREE.Mesh(earGeo, fur);
    ear.position.set(x, 2.35, 0);
    ear.rotation.z = x > 0 ? -.15 : .15;
    ear.castShadow = true;
    g.add(ear);
  });
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(.18, .95, 5, 8), fur);
  tail.position.set(0, .98, -.45);
  tail.rotation.x = -1.05;
  tail.rotation.z = .35;
  tail.castShadow = true;
  g.add(body, head, muzzle, tail);
  g.userData.tail = tail;
  heroRoot.add(g);
  return g;
}

let heroVisual = createFallbackHero();
let mixer = null;
let actions = {};
let activeAction = null;

const loadingStatus = document.querySelector("#loadingStatus");
const loader = new GLTFLoader();
const foxUrl = "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb";
loader.load(
  foxUrl,
  (gltf) => {
    heroRoot.remove(heroVisual);
    heroVisual = gltf.scene;
    heroVisual.scale.setScalar(.018);
    heroVisual.rotation.y = 0;
    heroVisual.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    heroRoot.add(heroVisual);
    mixer = new THREE.AnimationMixer(heroVisual);
    gltf.animations.forEach((clip) => {
      actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
    });
    setAction("survey", .2);
    loadingStatus.textContent = "岛屿已苏醒 · 100%";
    window.setTimeout(() => {
      document.querySelector("#startButton").classList.add("ready");
    }, 250);
  },
  (event) => {
    if (event.total) loadingStatus.textContent = `正在唤醒岛屿 · ${Math.min(99, Math.round(event.loaded / event.total * 100))}%`;
  },
  () => {
    loadingStatus.textContent = "岛屿已苏醒 · 100%";
  }
);

function setAction(name, fade = .16) {
  if (!mixer) return;
  const target = actions[name] || actions[Object.keys(actions).find((key) => key.includes(name))];
  if (!target || target === activeAction) return;
  if (activeAction) activeAction.fadeOut(fade);
  target.reset().fadeIn(fade).play();
  activeAction = target;
}

const state = {
  started: false,
  keys: {},
  velocityY: 0,
  grounded: true,
  yaw: -0.15,
  pitch: .27,
  distance: 10.8,
  cameraAvoidanceOffset: 0,
  dragging: false,
  pointerX: 0,
  pointerY: 0,
  collected: 0,
  joyX: 0,
  joyY: 0,
  audioOn: true,
};

function groundAt(x, z) {
  const main = (x * x) / (19.2 * 19.2) + (z * z) / (16.2 * 16.2);
  if (main <= 1) return 0;
  const chapel = ((x - 25) ** 2) / (7.7 ** 2) + ((z + 15) ** 2) / (6.7 ** 2);
  if (chapel <= 1) return 3.6;
  const garden = ((x + 25) ** 2) / (5.1 ** 2) + ((z - 12) ** 2) / (4.6 ** 2);
  if (garden <= 1) return -1.7;

  const bridges = [
    { a: new THREE.Vector2(15.5, -7.8), b: new THREE.Vector2(20.5, -11.2), ya: .35, yb: 3.95, width: 1.7 },
    { a: new THREE.Vector2(-18.5, 6), b: new THREE.Vector2(-21, 9.5), ya: -.15, yb: -1.25, width: 1.7 },
  ];
  const p = new THREE.Vector2(x, z);
  for (const bridge of bridges) {
    const ab = bridge.b.clone().sub(bridge.a);
    const t = THREE.MathUtils.clamp(p.clone().sub(bridge.a).dot(ab) / ab.lengthSq(), 0, 1);
    const nearest = bridge.a.clone().add(ab.multiplyScalar(t));
    if (nearest.distanceTo(p) < bridge.width) return THREE.MathUtils.lerp(bridge.ya, bridge.yb, t);
  }
  return null;
}

const colliders = [
  { x: -8.5, z: -3.8, r: 3.25 },
  { x: 3.6, z: -8.3, r: 2.95 },
  { x: 9.8, z: 3.8, r: 3.15 },
  { x: -1.8, z: 6.6, r: 3.65 },
  { x: 24.8, z: -15.2, r: 3.45 },
  { x: 5.5, z: 1.6, r: 2.1 },
  { x: -14, z: 5, r: 1.1 },
  { x: -13, z: -9, r: .95 },
  { x: -7, z: 11.8, r: .9 },
  { x: 12.5, z: -5.5, r: 1.0 },
  { x: 14.2, z: 9.4, r: 1.2 },
  { x: 6.4, z: 12.2, r: .85 },
  { x: -15, z: -1, r: .85 },
  { x: 28, z: -17.5, r: .95 },
  { x: 22, z: -11.5, r: .85 },
  { x: -25, z: 12, r: 1.0 },
];

function blocked(x, z) {
  return colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r);
}

const cameraObstacles = [
  { center: new THREE.Vector3(-8.5, 3.2, -3.8), radius: 3.55 },
  { center: new THREE.Vector3(3.6, 3.0, -8.3), radius: 3.25 },
  { center: new THREE.Vector3(9.8, 3.1, 3.8), radius: 3.45 },
  { center: new THREE.Vector3(-1.8, 5.7, 6.6), radius: 4.5 },
  { center: new THREE.Vector3(24.8, 8.2, -15.2), radius: 4.1 },
  { center: new THREE.Vector3(5.5, 2.35, 1.6), radius: 2.55 },
];

[
  [-14, 0, 5, 1.0], [-13, 0, -9, .82], [-7, 0, 11.8, .72], [12.5, 0, -5.5, .85],
  [14.2, 0, 9.4, 1.1], [6.4, 0, 12.2, .68], [-15, 0, -1, .7],
  [28, 3.6, -17.5, .78], [22, 3.6, -11.5, .68], [-25, -1.7, 12, .82],
].forEach(([x, y, z, scale]) => {
  cameraObstacles.push({
    center: new THREE.Vector3(x, y + 4.15 * scale, z),
    radius: 1.75 * scale,
  });
});

function cameraClearance(start, end) {
  const segment = end.clone().sub(start);
  const length = segment.length();
  if (length < .001) return length;
  const direction = segment.multiplyScalar(1 / length);
  let nearest = length;
  for (const obstacle of cameraObstacles) {
    const toCenter = obstacle.center.clone().sub(start);
    const projection = toCenter.dot(direction);
    if (projection <= 0 || projection >= nearest + obstacle.radius) continue;
    const perpendicularSq = toCenter.lengthSq() - projection * projection;
    const radiusSq = obstacle.radius * obstacle.radius;
    if (perpendicularSq >= radiusSq) continue;
    const hit = projection - Math.sqrt(radiusSq - perpendicularSq);
    if (hit > .2) nearest = Math.min(nearest, hit);
  }
  return nearest;
}

function collectNearby() {
  for (const shard of [...shards]) {
    if (!shard.parent) continue;
    if (shard.position.distanceTo(heroRoot.position) < 1.65) {
      shard.userData.collected = true;
      state.collected += 1;
      document.querySelector("#shardCount").textContent = state.collected;
      document.querySelector("#progressFill").style.width = `${(state.collected / shards.length) * 100}%`;
      const prompt = document.querySelector("#prompt");
      prompt.textContent = `获得星辉碎片 · ${state.collected} / ${shards.length}`;
      prompt.classList.add("visible");
      window.setTimeout(() => prompt.classList.remove("visible"), 1500);
      world.remove(shard);
      if (state.collected === shards.length) {
        window.setTimeout(() => document.querySelector("#completeCard").classList.add("visible"), 550);
      } else if (state.collected === shards.length - 1) {
        const remaining = shards.find((item) => item.parent);
        if (remaining) {
          window.setTimeout(() => {
            prompt.textContent = `最后一枚星屑：${remaining.userData.hint}`;
            prompt.classList.add("visible");
            window.setTimeout(() => prompt.classList.remove("visible"), 4200);
          }, 1650);
        }
      }
    }
  }
}

function updateHero(dt, elapsed) {
  if (!state.started) return;
  const forwardInput = (state.keys.KeyW || state.keys.ArrowUp ? 1 : 0) - (state.keys.KeyS || state.keys.ArrowDown ? 1 : 0) - state.joyY;
  const sideInput = (state.keys.KeyD || state.keys.ArrowRight ? 1 : 0) - (state.keys.KeyA || state.keys.ArrowLeft ? 1 : 0) + state.joyX;
  const input = new THREE.Vector2(sideInput, forwardInput);
  const moving = input.lengthSq() > .025;
  if (input.length() > 1) input.normalize();

  const sprint = state.keys.ShiftLeft || state.keys.ShiftRight;
  const speed = sprint ? 7.4 : 4.4;
  if (moving) {
    const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    const direction = forward.multiplyScalar(input.y).add(right.multiplyScalar(input.x)).normalize();
    const nextX = heroRoot.position.x + direction.x * speed * dt;
    const nextZ = heroRoot.position.z + direction.z * speed * dt;
    const ground = groundAt(nextX, nextZ);
    if (ground !== null && !blocked(nextX, nextZ)) {
      heroRoot.position.x = nextX;
      heroRoot.position.z = nextZ;
      heroRoot.rotation.y = Math.atan2(direction.x, direction.z);
    }
    setAction(sprint ? "run" : "walk");
  } else {
    setAction("survey", .28);
  }

  state.velocityY -= 17.5 * dt;
  heroRoot.position.y += state.velocityY * dt;
  const ground = groundAt(heroRoot.position.x, heroRoot.position.z);
  if (ground !== null && heroRoot.position.y <= ground) {
    heroRoot.position.y = ground;
    state.velocityY = 0;
    state.grounded = true;
  } else if (ground === null) {
    state.grounded = false;
  }
  if (heroRoot.position.y < -18) {
    heroRoot.position.set(0, .2, 13);
    state.velocityY = 0;
  }
  if (!mixer && heroVisual?.userData?.tail) {
    heroVisual.userData.tail.rotation.z = .35 + Math.sin(elapsed * (moving ? 8 : 3)) * .16;
    heroVisual.position.y = moving ? Math.abs(Math.sin(elapsed * 8)) * .05 : Math.sin(elapsed * 2) * .02;
  }
  if (mixer) mixer.update(dt * (sprint ? 1.18 : 1));
  collectNearby();
}

function jump() {
  if (!state.started || !state.grounded) return;
  state.velocityY = 7.15;
  state.grounded = false;
}

function updateCamera(dt) {
  const target = heroRoot.position.clone().add(new THREE.Vector3(0, 1.55, 0));
  const cp = Math.cos(state.pitch);
  const makeCandidate = (yawOffset, distance = state.distance) => target.clone().add(new THREE.Vector3(
    Math.sin(state.yaw + yawOffset) * cp * distance,
    Math.sin(state.pitch) * distance + 1.0,
    Math.cos(state.yaw + yawOffset) * cp * distance
  ));

  const sampleOffsets = [state.cameraAvoidanceOffset, 0, .52, -.52, .96, -.96];
  let bestOffset = sampleOffsets[0];
  let bestClearance = cameraClearance(target, makeCandidate(bestOffset));
  for (const offset of sampleOffsets.slice(1)) {
    const clearance = cameraClearance(target, makeCandidate(offset));
    const preferencePenalty = Math.abs(offset) * .16;
    if (clearance - preferencePenalty > bestClearance + .2) {
      bestOffset = offset;
      bestClearance = clearance;
    }
  }

  const directClearance = cameraClearance(target, makeCandidate(0));
  const desiredOffset = directClearance >= state.distance * .96 ? 0 : bestOffset;
  state.cameraAvoidanceOffset = THREE.MathUtils.damp(
    state.cameraAvoidanceOffset,
    desiredOffset,
    desiredOffset === 0 ? 3.5 : 7.5,
    dt
  );

  const fullCandidate = makeCandidate(state.cameraAvoidanceOffset);
  const clearance = cameraClearance(target, fullCandidate);
  const safeDistance = Math.min(state.distance, Math.max(3.25, clearance - .6));
  const desired = makeCandidate(state.cameraAvoidanceOffset, safeDistance);
  if (safeDistance < state.distance * .58) desired.y += 1.15;
  camera.position.lerp(desired, 1 - Math.pow(.00035, dt));
  camera.lookAt(target);
}

window.addEventListener("keydown", (event) => {
  state.keys[event.code] = true;
  if (event.code === "Space") {
    event.preventDefault();
    jump();
  }
});
window.addEventListener("keyup", (event) => { state.keys[event.code] = false; });

canvas.addEventListener("pointerdown", (event) => {
  state.dragging = true;
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!state.dragging) return;
  const dx = event.clientX - state.pointerX;
  const dy = event.clientY - state.pointerY;
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;
  state.yaw -= dx * .0045;
  state.pitch = THREE.MathUtils.clamp(state.pitch + dy * .0032, .08, .78);
});
canvas.addEventListener("pointerup", () => { state.dragging = false; });
canvas.addEventListener("pointercancel", () => { state.dragging = false; });
canvas.addEventListener("wheel", (event) => {
  state.distance = THREE.MathUtils.clamp(state.distance + event.deltaY * .008, 6.2, 15.5);
}, { passive: true });

const joystick = document.querySelector("#joystick");
const joystickKnob = document.querySelector("#joystickKnob");
let joyPointer = null;
function updateJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  const length = Math.hypot(x, y);
  const max = rect.width * .32;
  const scale = length > max ? max / length : 1;
  const px = x * scale;
  const py = y * scale;
  joystickKnob.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
  state.joyX = px / max;
  state.joyY = py / max;
}
joystick.addEventListener("pointerdown", (event) => {
  joyPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});
joystick.addEventListener("pointermove", (event) => {
  if (event.pointerId === joyPointer) updateJoystick(event);
});
function resetJoystick() {
  joyPointer = null;
  state.joyX = 0;
  state.joyY = 0;
  joystickKnob.style.transform = "translate(-50%, -50%)";
}
joystick.addEventListener("pointerup", resetJoystick);
joystick.addEventListener("pointercancel", resetJoystick);
document.querySelector("#jumpButton").addEventListener("pointerdown", jump);

document.querySelector("#startButton").addEventListener("click", () => {
  state.started = true;
  document.querySelector("#startScreen").classList.add("hidden");
  document.querySelector("#touchControls").setAttribute("aria-hidden", "false");
});
document.querySelector("#helpButton").addEventListener("click", () => document.querySelector("#helpDialog").showModal());
document.querySelector("#closeHelp").addEventListener("click", () => document.querySelector("#helpDialog").close());
document.querySelector("#continueButton").addEventListener("click", () => document.querySelector("#completeCard").classList.remove("visible"));
document.querySelector("#soundButton").addEventListener("click", (event) => {
  state.audioOn = !state.audioOn;
  event.currentTarget.classList.toggle("muted", !state.audioOn);
});

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, innerWidth < 700 ? 1.35 : 1.75));
}
window.addEventListener("resize", resize);

function animate() {
  const dt = Math.min(clock.getDelta(), .033);
  const elapsed = clock.elapsedTime;
  updateHero(dt, elapsed);
  updateCamera(dt);
  updateSkyCreatures(elapsed);
  windmill.userData.blades.rotation.z = elapsed * .28;
  shards.forEach((shard, index) => {
    if (!shard.parent) return;
    shard.rotation.y = elapsed * .8 + index;
    shard.position.y = shard.userData.baseY + Math.sin(elapsed * 1.7 + index) * .18;
    shard.userData.beacon.material.opacity = .12 + (Math.sin(elapsed * 2.2 + index) + 1) * .055;
    shard.userData.upperRing.rotation.z = elapsed * .55 + index;
    shard.userData.upperRing.scale.setScalar(.66 + Math.sin(elapsed * 1.9 + index) * .08);
  });
  scene.children.forEach((obj) => {
    if (obj.userData?.speed) obj.position.x += Math.sin(elapsed * .05 + obj.position.z) * obj.userData.speed * dt;
  });
  cloudSea.rotation.y = elapsed * .0018;
  cloudFloor.rotation.z = -elapsed * .0009;
  particles.rotation.y = elapsed * .015;
  composer.render();
  requestAnimationFrame(animate);
}
animate();
