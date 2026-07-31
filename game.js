import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
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
renderer.toneMappingExposure = 0.9;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#8fb9ce");
scene.fog = new THREE.FogExp2("#b9d0d7", 0.0068);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 500);
camera.position.set(12, 9, 17);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.1, 0.38, 1.18);
bloom.threshold = 1.18;
bloom.strength = 0.1;
bloom.radius = 0.38;
composer.addPass(bloom);

const clock = new THREE.Clock();
const world = new THREE.Group();
scene.add(world);

const mats = {
  grass: new THREE.MeshStandardMaterial({ color: "#708d59", roughness: 0.96 }),
  grassLight: new THREE.MeshStandardMaterial({ color: "#91aa6c", roughness: 0.93 }),
  rock: new THREE.MeshStandardMaterial({ color: "#64727a", roughness: 1, flatShading: true }),
  rockLight: new THREE.MeshStandardMaterial({ color: "#829099", roughness: 1, flatShading: true }),
  plaster: new THREE.MeshStandardMaterial({ color: "#dbcba8", roughness: 0.9 }),
  plasterWarm: new THREE.MeshStandardMaterial({ color: "#c9a36f", roughness: 0.88 }),
  timber: new THREE.MeshStandardMaterial({ color: "#68452f", roughness: 0.82 }),
  timberLight: new THREE.MeshStandardMaterial({ color: "#936640", roughness: 0.82 }),
  roof: new THREE.MeshStandardMaterial({ color: "#a95248", roughness: 0.9 }),
  roofBlue: new THREE.MeshStandardMaterial({ color: "#4a7888", roughness: 0.88 }),
  gold: new THREE.MeshStandardMaterial({ color: "#c79a43", metalness: 0.32, roughness: 0.42 }),
  window: new THREE.MeshStandardMaterial({ color: "#e8d58f", emissive: "#d89232", emissiveIntensity: 0.72, roughness: 0.36 }),
  leaf: new THREE.MeshStandardMaterial({ color: "#466f48", roughness: 0.94, flatShading: true }),
  leafGold: new THREE.MeshStandardMaterial({ color: "#b68143", roughness: 0.92, flatShading: true }),
  cloud: new THREE.MeshBasicMaterial({ color: "#d7e1df", transparent: true, opacity: 0.32, depthWrite: false }),
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

const ambient = new THREE.HemisphereLight("#cfe2e7", "#536b68", 1.5);
scene.add(ambient);
const sun = new THREE.DirectionalLight("#f2d29a", 2.4);
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
  new THREE.SphereGeometry(3.8, 32, 16),
  new THREE.MeshBasicMaterial({ color: "#e6c77f", transparent: true, opacity: 0.88, fog: false })
);
sunDisc.position.set(-78, 43, -105);
scene.add(sunDisc);

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(230, 32, 18),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color("#5f94b5") },
      horizonColor: { value: new THREE.Color("#b9d0d8") },
      lowerColor: { value: new THREE.Color("#c9d0c7") },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 lowerColor;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 color = h > 0.0
          ? mix(horizonColor, topColor, smoothstep(0.0, 0.78, h))
          : mix(horizonColor, lowerColor, smoothstep(0.0, -0.36, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
);
scene.add(skyDome);

const terrainSurfaces = [];
const bridgeSurfaces = [];

function createIsland(radiusX, radiusZ, topY, depth, x, z, material = mats.grass) {
  terrainSurfaces.push({ x, z, radiusX: radiusX * 0.96, radiusZ: radiusZ * 0.96, y: topY });
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

const expandedIslandSpecs = [
  { name: "北风原", x: 0, z: -39, rx: 19, rz: 15, y: 1.2, depth: 13, material: mats.grassLight },
  { name: "晨曦岭", x: 35, z: -36, rx: 16, rz: 13, y: 1.6, depth: 12, material: mats.grass },
  { name: "东境台地", x: 48, z: -3, rx: 18, rz: 14, y: 2.2, depth: 14, material: mats.grassLight },
  { name: "晴雨庭", x: 40, z: 31, rx: 17, rz: 13, y: -0.6, depth: 12, material: mats.grass },
  { name: "南星原", x: 6, z: 42, rx: 21, rz: 15, y: 1.0, depth: 15, material: mats.grassLight },
  { name: "暮色谷", x: -34, z: 36, rx: 17, rz: 13, y: 0.4, depth: 13, material: mats.grass },
  { name: "西风高地", x: -52, z: 8, rx: 19, rz: 15, y: 2.6, depth: 15, material: mats.grassLight },
  { name: "灰石坡", x: -39, z: -28, rx: 17, rz: 13, y: -0.4, depth: 13, material: mats.grass },
  { name: "极光台", x: -5, z: -69, rx: 20, rz: 14, y: 0.8, depth: 16, material: mats.grassLight },
  { name: "远帆脊", x: 66, z: -57, rx: 19, rz: 14, y: 2.0, depth: 15, material: mats.grass },
  { name: "云港", x: 79, z: 20, rx: 20, rz: 15, y: 0.6, depth: 16, material: mats.grassLight },
  { name: "星落原", x: 20, z: 73, rx: 21, rz: 16, y: -0.8, depth: 17, material: mats.grass },
  { name: "晚钟崖", x: -76, z: 40, rx: 20, rz: 15, y: 1.8, depth: 16, material: mats.grassLight },
  { name: "沉霞岛", x: -72, z: -29, rx: 20, rz: 16, y: 0.2, depth: 17, material: mats.grass },
];

expandedIslandSpecs.forEach((island) => {
  island.group = createIsland(island.rx, island.rz, island.y, island.depth, island.x, island.z, island.material);
});

function createCottage({ x, z, y = 0, scale = 1, rotation = 0, roof = mats.roof, material = mats.plaster }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
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

const expandedStructureSeeds = [
  { x: -6, z: -40, y: 1.2, scale: 0.9, rotation: 0.5, roof: mats.roofBlue },
  { x: 39, z: -37, y: 1.6, scale: 0.82, rotation: -0.8, roof: mats.roof },
  { x: 52, z: -6, y: 2.2, scale: 0.94, rotation: 1.2, roof: mats.roofBlue },
  { x: 8, z: 42, y: 1.0, scale: 0.88, rotation: 2.5, roof: mats.roof },
  { x: -55, z: 7, y: 2.6, scale: 0.92, rotation: -1.4, roof: mats.roofBlue },
  { x: 72, z: 20, y: 0.6, scale: 0.86, rotation: 0.2, roof: mats.roof },
  { x: -76, z: 43, y: 1.8, scale: 0.9, rotation: 1.8, roof: mats.roofBlue },
];
expandedStructureSeeds.forEach((seed) => createCottage(seed));

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

const expandedTreeSeeds = [];
expandedIslandSpecs.forEach((island, islandIndex) => {
  for (let treeIndex = 0; treeIndex < 3; treeIndex++) {
    const angle = islandIndex * 1.73 + treeIndex * 2.17;
    const radius = 0.38 + treeIndex * 0.13;
    const seed = {
      x: island.x + Math.cos(angle) * island.rx * radius,
      z: island.z + Math.sin(angle) * island.rz * radius,
      y: island.y,
      scale: 0.7 + ((islandIndex + treeIndex) % 5) * 0.09,
      gold: (islandIndex + treeIndex * 2) % 7 === 0,
    };
    expandedTreeSeeds.push(seed);
    createTree(seed.x, seed.z, seed.scale, seed.gold, seed.y);
  }
});

function createBridge(a, b, startY, endY) {
  bridgeSurfaces.push({
    a: new THREE.Vector2(a[0], a[1]),
    b: new THREE.Vector2(b[0], b[1]),
    ya: startY,
    yb: endY,
    width: 1.7,
  });
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
createBridge([0, -16], [0, -24], 0.15, 1.35);
createBridge([28.5, -20], [29.5, -25], 3.75, 1.75);
createBridge([18, 0], [30, -1], 0.15, 2.35);
createBridge([45, 10], [42, 18.5], 2.35, -0.45);
createBridge([6, 16], [6, 27.5], 0.15, 1.15);
createBridge([-27, 15], [-29, 24], -1.55, 0.55);
createBridge([-30, 10], [-34, 9], -1.55, 2.75);
createBridge([-16, -9], [-24, -18], 0.15, -0.25);
createBridge([-3, -53], [-5, -55.5], 1.35, 0.95);
createBridge([46, -44], [52, -49], 1.75, 2.15);
createBridge([64, 2], [61, 12], 2.35, 0.75);
createBridge([12, 56], [16, 58], 1.15, -0.65);
createBridge([-49, 40], [-57, 40], 0.55, 1.95);
createBridge([-55, -17], [-59, -22], -0.25, 0.35);

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
  color: "#d8e2df",
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
});
const cloudSeaCount = 176;
const cloudSea = new THREE.InstancedMesh(cloudGeometry, cloudSeaMaterial, cloudSeaCount);
const cloudDummy = new THREE.Object3D();
const cloudPalette = ["#d6e0de", "#c7d6d7", "#e0e0d5", "#bdced2"];
for (let i = 0; i < cloudSeaCount; i++) {
  const angle = i * 2.39996;
  const radius = 5 + Math.sqrt(i / cloudSeaCount) * 112;
  cloudDummy.position.set(
    Math.cos(angle) * radius,
    -11.4 + Math.sin(i * 1.83) * 1.35,
    Math.sin(angle) * radius
  );
  cloudDummy.rotation.y = angle * 0.35;
  cloudDummy.scale.set(5 + (i % 7) * 0.72, 1.18 + (i % 4) * 0.24, 3.9 + (i % 5) * 0.58);
  cloudDummy.updateMatrix();
  cloudSea.setMatrixAt(i, cloudDummy.matrix);
  cloudSea.setColorAt(i, new THREE.Color(cloudPalette[i % cloudPalette.length]));
}
cloudSea.instanceMatrix.needsUpdate = true;
cloudSea.instanceColor.needsUpdate = true;
scene.add(cloudSea);

const cloudFloor = new THREE.Mesh(
  new THREE.CircleGeometry(150, 64),
  new THREE.MeshBasicMaterial({
    color: "#aebfc3",
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
cloudFloor.rotation.x = -Math.PI / 2;
cloudFloor.position.y = -13.5;
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

// Creature slots stay intentionally empty until a model passes the project's art review.
const skyCreatures = [];

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
  particleArray[i * 3] = (Math.random() - .5) * 220;
  particleArray[i * 3 + 1] = Math.random() * 35 - 8;
  particleArray[i * 3 + 2] = (Math.random() - .5) * 220;
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
    initializeEnemies(gltf);
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
  level: 1,
  xp: 0,
  xpNext: 100,
  health: 100,
  maxHealth: 100,
  attack: 18,
  skillPower: 38,
  attackCooldown: 0,
  skillCooldown: 0,
  invulnerable: 0,
};

function groundAt(x, z) {
  for (const surface of terrainSurfaces) {
    const ellipse =
      ((x - surface.x) ** 2) / (surface.radiusX ** 2) +
      ((z - surface.z) ** 2) / (surface.radiusZ ** 2);
    if (ellipse <= 1) return surface.y;
  }

  const p = new THREE.Vector2(x, z);
  for (const bridge of bridgeSurfaces) {
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
expandedStructureSeeds.forEach((seed) => {
  colliders.push({ x: seed.x, z: seed.z, r: 3.1 * seed.scale });
});
expandedTreeSeeds.forEach((seed) => {
  colliders.push({ x: seed.x, z: seed.z, r: 1.05 * seed.scale });
});

function blocked(x, z) {
  return colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r);
}

const enemies = [];
const combatEffects = [];
let enemiesInitialized = false;

const enemySpawnConfigs = [
  { x: 14, z: -12, level: 1 },
  { x: -14, z: 10, level: 1 },
  { x: 29, z: -13, level: 2 },
  { x: -24, z: 11, level: 2 },
  ...expandedIslandSpecs.map((island, index) => ({
    x: island.x + Math.cos(index * 1.91) * island.rx * 0.34,
    z: island.z + Math.sin(index * 1.91) * island.rz * 0.34,
    level: Math.min(10, 2 + Math.floor(index * 0.68)),
  })),
  ...expandedIslandSpecs.filter((_, index) => index % 4 === 1).map((island, index) => ({
    x: island.x - island.rx * (0.24 + index * 0.03),
    z: island.z + island.rz * 0.24,
    level: Math.min(10, 4 + index * 2),
  })),
];

const combatHud = {
  level: document.querySelector("#levelValue"),
  attack: document.querySelector("#attackValue"),
  health: document.querySelector("#healthValue"),
  maxHealth: document.querySelector("#maxHealthValue"),
  healthFill: document.querySelector("#healthFill"),
  xp: document.querySelector("#xpValue"),
  xpNext: document.querySelector("#xpNextValue"),
  xpFill: document.querySelector("#xpFill"),
  enemyCount: document.querySelector("#enemyCount"),
  targetHud: document.querySelector("#targetHud"),
  targetName: document.querySelector("#targetName"),
  targetLevel: document.querySelector("#targetLevel"),
  targetHealthFill: document.querySelector("#targetHealthFill"),
  attackButton: document.querySelector("#attackButton"),
  skillButton: document.querySelector("#skillButton"),
};

function enemyTitle(level) {
  if (level >= 9) return "云蚀领主";
  if (level >= 6) return "深影猎手";
  if (level >= 3) return "云蚀兽";
  return "幼生云蚀兽";
}

function setEnemyAction(enemy, name, fade = 0.16) {
  const target =
    enemy.actions[name] ||
    enemy.actions[Object.keys(enemy.actions).find((key) => key.includes(name))];
  if (!target || target === enemy.activeAction) return;
  if (enemy.activeAction) enemy.activeAction.fadeOut(fade);
  target.reset().fadeIn(fade).play();
  enemy.activeAction = target;
}

function initializeEnemies(gltf) {
  if (enemiesInitialized) return;
  enemiesInitialized = true;

  enemySpawnConfigs.forEach((config, index) => {
    const root = new THREE.Group();
    const visual = SkeletonUtils.clone(gltf.scene);
    const scale = 0.0145 + Math.min(config.level, 10) * 0.00048;
    visual.scale.setScalar(scale);
    visual.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const tinted = materials.map((source) => {
        const material = source.clone();
        if (material.color) material.color.lerp(new THREE.Color("#4c3858"), 0.68);
        if (material.emissive) {
          material.emissive.set("#351d47");
          material.emissiveIntensity = config.level >= 7 ? 0.42 : 0.22;
          material.userData.restingEmissive = material.emissiveIntensity;
        }
        material.roughness = Math.max(0.58, material.roughness ?? 0.7);
        return material;
      });
      object.material = Array.isArray(object.material) ? tinted : tinted[0];
    });
    root.add(visual);

    const ground = groundAt(config.x, config.z);
    root.position.set(config.x, ground ?? 0, config.z);
    root.rotation.y = index * 1.37;
    world.add(root);

    const enemy = {
      root,
      visual,
      level: config.level,
      name: enemyTitle(config.level),
      maxHealth: 48 + config.level * 24,
      health: 48 + config.level * 24,
      attack: 6 + config.level * 2.4,
      xp: 30 + config.level * 14,
      mixer: new THREE.AnimationMixer(visual),
      actions: {},
      activeAction: null,
      attackTimer: 0.4 + (index % 4) * 0.23,
      hitFlash: 0,
      alive: true,
      deathTime: 0,
      home: root.position.clone(),
    };
    gltf.animations.forEach((clip) => {
      enemy.actions[clip.name.toLowerCase()] = enemy.mixer.clipAction(clip);
    });
    setEnemyAction(enemy, "survey", 0);
    enemies.push(enemy);
  });

  updateCombatHud();
}

function livingEnemies() {
  return enemies.filter((enemy) => enemy.alive);
}

function updateCombatHud() {
  combatHud.level.textContent = state.level;
  combatHud.attack.textContent = state.attack;
  combatHud.health.textContent = Math.max(0, Math.round(state.health));
  combatHud.maxHealth.textContent = state.maxHealth;
  combatHud.healthFill.style.width = `${THREE.MathUtils.clamp(state.health / state.maxHealth, 0, 1) * 100}%`;
  combatHud.xp.textContent = state.xp;
  combatHud.xpNext.textContent = state.xpNext;
  combatHud.xpFill.style.width = `${THREE.MathUtils.clamp(state.xp / state.xpNext, 0, 1) * 100}%`;
  combatHud.enemyCount.textContent = livingEnemies().length;
}

function showWorldPrompt(message, duration = 1500) {
  const prompt = document.querySelector("#prompt");
  prompt.textContent = message;
  prompt.classList.add("visible");
  window.clearTimeout(showWorldPrompt.timer);
  showWorldPrompt.timer = window.setTimeout(() => prompt.classList.remove("visible"), duration);
}

function createCombatEffect(position, color, radius, duration = 0.48, vertical = false) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const geometry = vertical
    ? new THREE.RingGeometry(radius * 0.58, radius * 0.72, 42, 1, -1.35, 2.7)
    : new THREE.RingGeometry(radius * 0.72, radius, 56);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.position.y += vertical ? 1.05 : 0.12;
  mesh.rotation.x = vertical ? 0 : -Math.PI / 2;
  if (vertical) mesh.rotation.y = heroRoot.rotation.y;
  scene.add(mesh);
  combatEffects.push({ mesh, age: 0, duration, baseRadius: radius });
}

function flashEnemy(enemy) {
  enemy.hitFlash = 0.16;
  enemy.visual.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material.emissive) {
        material.emissive.set("#efb4ff");
        material.emissiveIntensity = 1.65;
      }
    });
  });
}

function restoreEnemyTint(enemy) {
  enemy.visual.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material.emissive) {
        material.emissive.set("#351d47");
        material.emissiveIntensity = material.userData.restingEmissive ?? 0.22;
      }
    });
  });
}

function gainExperience(amount) {
  state.xp += amount;
  let levelsGained = 0;
  while (state.xp >= state.xpNext) {
    state.xp -= state.xpNext;
    state.level += 1;
    levelsGained += 1;
    state.xpNext = Math.round(100 * Math.pow(1.24, state.level - 1));
    state.maxHealth += 18;
    state.health = state.maxHealth;
    state.attack += 5;
    state.skillPower += 11;
  }
  if (levelsGained) {
    createCombatEffect(heroRoot.position, "#fff0a1", 4.2, 0.9);
    showWorldPrompt(`等级提升 · LV.${state.level}　攻击与星辉技能已增强`, 2800);
  }
  updateCombatHud();
}

function defeatEnemy(enemy) {
  if (!enemy.alive) return;
  enemy.alive = false;
  enemy.deathTime = 0;
  setEnemyAction(enemy, "survey", 0.1);
  createCombatEffect(enemy.root.position, "#b98ac8", 2.4, 0.72);
  gainExperience(enemy.xp);
  showWorldPrompt(`击退 ${enemy.name} · 获得 ${enemy.xp} 经验`);
  updateCombatHud();
}

function damageEnemy(enemy, amount) {
  if (!enemy?.alive) return;
  enemy.health = Math.max(0, enemy.health - amount);
  flashEnemy(enemy);
  if (enemy.health <= 0) defeatEnemy(enemy);
}

function facingVector() {
  return new THREE.Vector3(Math.sin(heroRoot.rotation.y), 0, Math.cos(heroRoot.rotation.y)).normalize();
}

function attack() {
  if (!state.started || state.attackCooldown > 0) return;
  state.attackCooldown = 0.46;
  const forward = facingVector();
  const origin = heroRoot.position.clone();
  createCombatEffect(origin.clone().add(forward.clone().multiplyScalar(1.2)), "#f5d77b", 1.7, 0.34, true);

  const target = livingEnemies()
    .map((enemy) => {
      const offset = enemy.root.position.clone().sub(origin);
      offset.y = 0;
      const distance = offset.length();
      const facing = distance > 0 ? offset.normalize().dot(forward) : 1;
      return { enemy, distance, facing };
    })
    .filter((candidate) => candidate.distance <= 3.25 && candidate.facing > 0.12)
    .sort((a, b) => a.distance - b.distance)[0];

  if (target) damageEnemy(target.enemy, state.attack);
}

function castSkill() {
  if (!state.started || state.skillCooldown > 0) return;
  state.skillCooldown = Math.max(4.5, 7.5 - state.level * 0.18);
  const radius = Math.min(7.2, 4.7 + state.level * 0.22);
  const damage = state.skillPower;
  createCombatEffect(heroRoot.position, "#8fc8e2", radius, 0.82);

  livingEnemies().forEach((enemy) => {
    if (enemy.root.position.distanceTo(heroRoot.position) <= radius) {
      damageEnemy(enemy, damage);
    }
  });
}

function damagePlayer(amount, source) {
  if (state.invulnerable > 0 || !state.started) return;
  state.invulnerable = 0.72;
  state.health = Math.max(0, state.health - amount);
  createCombatEffect(heroRoot.position, "#c9869a", 1.5, 0.38);
  document.querySelector("#game").classList.add("damage-flash");
  window.setTimeout(() => document.querySelector("#game").classList.remove("damage-flash"), 180);
  updateCombatHud();

  if (state.health <= 0) {
    state.health = state.maxHealth;
    state.invulnerable = 2.2;
    heroRoot.position.set(0, 0.2, 13);
    state.velocityY = 0;
    showWorldPrompt(`被 ${source?.name ?? "云蚀"} 击倒 · 已在钟楼旁苏醒`, 2600);
    updateCombatHud();
  }
}

function updateEnemies(dt) {
  let nearest = null;
  let nearestDistance = Infinity;

  enemies.forEach((enemy) => {
    if (!enemy.alive) {
      enemy.deathTime += dt;
      enemy.root.scale.setScalar(Math.max(0.001, 1 - enemy.deathTime / 0.7));
      enemy.root.position.y += dt * 0.35;
      if (enemy.deathTime > 0.72 && enemy.root.parent) world.remove(enemy.root);
      return;
    }

    enemy.attackTimer -= dt;
    enemy.hitFlash -= dt;
    if (enemy.hitFlash <= 0 && enemy.hitFlash + dt > 0) restoreEnemyTint(enemy);

    const toHero = heroRoot.position.clone().sub(enemy.root.position);
    toHero.y = 0;
    const distance = toHero.length();
    if (distance < nearestDistance) {
      nearest = enemy;
      nearestDistance = distance;
    }

    const detection = 10.5 + enemy.level * 0.7;
    if (state.started && distance < detection) {
      if (distance > 1.75) {
        const direction = toHero.normalize();
        const speed = 1.45 + enemy.level * 0.055;
        const nextX = enemy.root.position.x + direction.x * speed * dt;
        const nextZ = enemy.root.position.z + direction.z * speed * dt;
        const nextGround = groundAt(nextX, nextZ);
        if (nextGround !== null && !blocked(nextX, nextZ)) {
          enemy.root.position.x = nextX;
          enemy.root.position.z = nextZ;
          enemy.root.position.y = nextGround;
          enemy.root.rotation.y = Math.atan2(direction.x, direction.z);
          setEnemyAction(enemy, distance > 5 ? "run" : "walk");
        } else {
          setEnemyAction(enemy, "survey", 0.25);
        }
      } else {
        setEnemyAction(enemy, "survey", 0.2);
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = Math.max(0.72, 1.35 - enemy.level * 0.035);
          damagePlayer(enemy.attack, enemy);
        }
      }
    } else {
      setEnemyAction(enemy, "survey", 0.28);
    }
    enemy.mixer.update(dt * (distance < 5 ? 1.08 : 0.82));
  });

  if (nearest && nearestDistance < 10) {
    combatHud.targetHud.setAttribute("aria-hidden", "false");
    combatHud.targetName.textContent = nearest.name;
    combatHud.targetLevel.textContent = nearest.level;
    combatHud.targetHealthFill.style.width = `${Math.max(0, nearest.health / nearest.maxHealth) * 100}%`;
  } else {
    combatHud.targetHud.setAttribute("aria-hidden", "true");
  }
}

function updateCombatEffects(dt) {
  for (let index = combatEffects.length - 1; index >= 0; index--) {
    const effect = combatEffects[index];
    effect.age += dt;
    const progress = effect.age / effect.duration;
    effect.mesh.scale.setScalar(0.72 + progress * 0.65);
    effect.mesh.material.opacity = Math.max(0, (1 - progress) * 0.88);
    effect.mesh.rotation.z += dt * 0.8;
    if (progress >= 1) {
      scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      effect.mesh.material.dispose();
      combatEffects.splice(index, 1);
    }
  }
}

const cameraObstacles = [
  { center: new THREE.Vector3(-8.5, 3.2, -3.8), radius: 3.55 },
  { center: new THREE.Vector3(3.6, 3.0, -8.3), radius: 3.25 },
  { center: new THREE.Vector3(9.8, 3.1, 3.8), radius: 3.45 },
  { center: new THREE.Vector3(-1.8, 5.7, 6.6), radius: 4.5 },
  { center: new THREE.Vector3(24.8, 8.2, -15.2), radius: 4.1 },
  { center: new THREE.Vector3(5.5, 2.35, 1.6), radius: 2.55 },
];
expandedStructureSeeds.forEach((seed) => {
  cameraObstacles.push({
    center: new THREE.Vector3(seed.x, seed.y + 3.1 * seed.scale, seed.z),
    radius: 3.45 * seed.scale,
  });
});
expandedTreeSeeds.forEach((seed) => {
  cameraObstacles.push({
    center: new THREE.Vector3(seed.x, seed.y + 4.1 * seed.scale, seed.z),
    radius: 1.75 * seed.scale,
  });
});

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
  if (!event.repeat && event.code === "KeyF") attack();
  if (!event.repeat && event.code === "KeyQ") castSkill();
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
document.querySelector("#attackButton").addEventListener("pointerdown", attack);
document.querySelector("#skillButton").addEventListener("pointerdown", castSkill);

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
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);
  state.skillCooldown = Math.max(0, state.skillCooldown - dt);
  state.invulnerable = Math.max(0, state.invulnerable - dt);
  updateHero(dt, elapsed);
  updateEnemies(dt);
  updateCombatEffects(dt);
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
  if (combatHud.skillButton) {
    combatHud.skillButton.textContent = state.skillCooldown > 0 ? Math.ceil(state.skillCooldown) : "技";
  }
  composer.render();
  requestAnimationFrame(animate);
}
animate();
