// Nusantara Strike — pembangunan peta: Puncak Salju & Gurun Pasir.
// Arena 64x64, menara pengawas di tengah, peti, pepohonan/batu, dan Lapangan Latih.
// Geometri sama untuk kedua peta; hiasan & warna mengikuti tema.

import * as THREE from 'three';
import { MAPS } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARENA = 30; // setengah lebar arena (x,z dalam [-30, 30])

function segHitsBox(a, b, box) {
  // Uji segmen a->b terhadap AABB (metode slab).
  const d = new THREE.Vector3().subVectors(b, a);
  let tmin = 0, tmax = 1;
  for (const ax of ['x', 'y', 'z']) {
    const o = a[ax], dd = d[ax];
    const mn = box.min[ax], mx = box.max[ax];
    if (Math.abs(dd) < 1e-9) { if (o < mn || o > mx) return false; }
    else {
      let t1 = (mn - o) / dd, t2 = (mx - o) / dd;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

export function buildWorld(scene, mapKey) {
  const cfg = MAPS[mapKey];
  const rand = mulberry32(mapKey === 'salju' ? 1337 : 7331);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'world-' + mapKey;
  scene.add(group);

  scene.background = new THREE.Color(cfg.sky);
  scene.fog = new THREE.Fog(cfg.fog, cfg.fogNear, cfg.fogFar);

  const sun = new THREE.DirectionalLight(cfg.light, 2.4);
  sun.position.set(30, 45, 18);
  scene.add(sun);
  const amb = new THREE.AmbientLight(cfg.ambient, 1.1);
  scene.add(amb);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function addBox(x, y, z, w, h, d, color, collide = true, ry = 0) {
    const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.rotation.y = ry;
    m.castShadow = false;
    group.add(m);
    if (collide) {
      colliders.push({
        min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
        max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
      });
    }
    return m;
  }

  // --- Tanah + bercak ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2 + 12, ARENA * 2 + 12),
    new THREE.MeshLambertMaterial({ color: cfg.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  for (let i = 0; i < 26; i++) {
    const p = new THREE.Mesh(
      new THREE.CircleGeometry(1.5 + rand() * 3.5, 10),
      new THREE.MeshLambertMaterial({ color: cfg.groundRough }),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set((rand() - 0.5) * 56, 0.02, (rand() - 0.5) * 56);
    group.add(p);
  }

  // --- Dinding pembatas ---
  const W = 2, H = 4;
  addBox(0, H / 2, -ARENA - 1, ARENA * 2 + 4, H, W, cfg.rock);
  addBox(0, H / 2, ARENA + 1, ARENA * 2 + 4, H, W, cfg.rock);
  addBox(-ARENA - 1, H / 2, 0, W, H, ARENA * 2 + 4, cfg.rock);
  addBox(ARENA + 1, H / 2, 0, W, H, ARENA * 2 + 4, cfg.rock);

  // --- Garis tengah + marka tim ---
  const mid = new THREE.Mesh(new THREE.PlaneGeometry(0.6, ARENA * 2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  mid.rotation.x = -Math.PI / 2; mid.position.set(0, 0.03, 0);
  group.add(mid);

  // --- Peti (rintangan + perlindungan) ---
  const crateSpots = [
    [-18, -18, 2.4], [-10, -14, 1.8], [8, -20, 2.4], [16, -12, 1.8], [-20, -4, 2.2],
    [20, -6, 2.2], [-14, 6, 1.8], [12, 8, 2.4], [-6, 14, 1.8], [18, 16, 2.2],
    [-22, 12, 1.8], [6, -8, 1.6], [-4, -22, 2.0], [22, 22, 2.0], [-26, -24, 1.6],
  ];
  for (const [x, z, s] of crateSpots) {
    addBox(x, s / 2, z, s, s, s, cfg.crate, true, (rand() - 0.5) * 0.4);
    addBox(x, s + 0.3, z, s * 0.7, 0.6, s * 0.7, cfg.crateTop, false);
  }
  // Peti susun dua tingkat (titik tinggi)
  addBox(-16, 1.1, 18, 2.2, 2.2, 2.2, cfg.crate);
  addBox(-16, 3.3, 18, 2.2, 2.2, 2.2, cfg.crateTop);
  addBox(16, 1.1, -18, 2.2, 2.2, 2.2, cfg.crate);
  addBox(16, 3.3, -18, 2.2, 2.2, 2.2, cfg.crateTop);

  // --- Menara pengawas tengah (platform 6x6 di y=4.5, tangga + ramp) ---
  const TOWER_H = 4.5;
  for (const [lx, lz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
    addBox(lx, TOWER_H / 2, lz, 0.5, TOWER_H, 0.5, 0x5d4526);
  }
  addBox(0, TOWER_H + 0.25, 0, 6.4, 0.5, 6.4, 0x7a5c33); // lantai menara
  addBox(0, TOWER_H + 1.1, -3.1, 6.4, 1.2, 0.3, 0x7a5c33, false); // pagar belakang
  addBox(-3.1, TOWER_H + 1.1, 0, 0.3, 1.2, 6.4, 0x7a5c33, false);
  addBox(3.1, TOWER_H + 1.1, 0, 0.3, 1.2, 6.4, 0x7a5c33, false);
  // Ramp naik dari selatan (z=10 -> z=3), lebar 2.4
  const rampLen = 7, ramp = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8a6f4d }));
  ramp.scale.set(2.4, 0.3, Math.hypot(rampLen, TOWER_H) + 0.4);
  ramp.position.set(0, TOWER_H / 2, 6.5);
  ramp.rotation.x = Math.atan2(TOWER_H, rampLen);
  group.add(ramp);
  // Anak tangga visual di atas ramp
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    addBox(0, 0.15 + t * TOWER_H, 10 - t * rampLen, 2.4, 0.3, 0.7, 0x6b5638, false);
  }
  // Bendera di puncak menara
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
  pole.position.set(0, TOWER_H + 2, 0);
  group.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshBasicMaterial({ color: 0xd43d2a, side: THREE.DoubleSide }));
  flag.position.set(0.85, TOWER_H + 3, 0);
  group.add(flag);

  // --- Hiasan per tema ---
  if (mapKey === 'salju') {
    for (let i = 0; i < 22; i++) {
      const x = (rand() - 0.5) * 56, z = (rand() - 0.5) * 56;
      if (Math.abs(x) < 9 && Math.abs(z) < 12) continue; // jaga area menara & jalan tengah
      const h = 2.5 + rand() * 2.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1, 6), new THREE.MeshLambertMaterial({ color: 0x5d4526 }));
      trunk.position.set(x, 0.5, z); group.add(trunk);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, h, 8), new THREE.MeshLambertMaterial({ color: cfg.tree }));
      cone.position.set(x, 1 + h / 2, z); group.add(cone);
      colliders.push({ min: new THREE.Vector3(x - 0.3, 0, z - 0.3), max: new THREE.Vector3(x + 0.3, 1.2, z + 0.3) });
    }
  } else {
    for (let i = 0; i < 16; i++) {
      const x = (rand() - 0.5) * 56, z = (rand() - 0.5) * 56;
      if (Math.abs(x) < 9 && Math.abs(z) < 12) continue;
      const h = 1.6 + rand() * 1.6;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, h, 8), new THREE.MeshLambertMaterial({ color: cfg.tree }));
      c.position.set(x, h / 2, z); group.add(c);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 6), new THREE.MeshLambertMaterial({ color: cfg.tree }));
      arm.rotation.z = Math.PI / 2; arm.position.set(x + 0.5, h * 0.55, z); group.add(arm);
      colliders.push({ min: new THREE.Vector3(x - 0.35, 0, z - 0.35), max: new THREE.Vector3(x + 0.35, h, z + 0.35) });
    }
    // Bukit pasir
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(3 + rand() * 3, 10, 6), new THREE.MeshLambertMaterial({ color: cfg.groundRough }));
      d.scale.y = 0.22;
      d.position.set((rand() - 0.5) * 52, 0, (rand() - 0.5) * 52);
      group.add(d);
    }
  }
  // Batu-batu
  for (let i = 0; i < 14; i++) {
    const x = (rand() - 0.5) * 56, z = (rand() - 0.5) * 56;
    if (Math.abs(x) < 8 && Math.abs(z) < 11) continue;
    const s = 0.5 + rand() * 1.1;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), new THREE.MeshLambertMaterial({ color: cfg.rock }));
    r.position.set(x, s * 0.5, z); r.rotation.set(rand() * 3, rand() * 3, 0);
    group.add(r);
    colliders.push({ min: new THREE.Vector3(x - s * 0.7, 0, z - s * 0.7), max: new THREE.Vector3(x + s * 0.7, s, z + s * 0.7) });
  }

  // --- Lapangan Latih (barat, garis tembak x=-28 menghadap +x) ---
  const targets = [];
  const targetDefs = [
    { x: -22, z: -4, moving: false, label: '6m' },
    { x: -18, z: 0, moving: false, label: '10m' },
    { x: -14, z: 4, moving: false, label: '14m' },
    { x: -20, z: -6, moving: true, range: 5, speed: 1.6, label: 'Gerak 1' },
    { x: -20, z: 6, moving: true, range: 5, speed: 2.1, label: 'Gerak 2' },
  ];
  for (const def of targetDefs) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0x444444 }));
    post.position.set(def.x, 0.6, def.z);
    group.add(post);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }),
    );
    disc.rotation.z = Math.PI / 2; // sumbu silinder jadi X: muka cakram menghadap pemain (-x)
    disc.position.set(def.x, 1.5, def.z);
    disc.userData.target = true;
    group.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.07, 8, 20),
      new THREE.MeshLambertMaterial({ color: 0xd43d2a }),
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(def.x - 0.08, 1.5, def.z);
    ring.userData.target = true;
    group.add(ring);
    const bull = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshLambertMaterial({ color: 0xd43d2a }));
    bull.rotation.y = -Math.PI / 2;
    bull.userData.target = true;
    bull.position.set(def.x - 0.09, 1.5, def.z);
    group.add(bull);
    targets.push({ disc, ring, bull, post, baseX: def.x, baseZ: def.z, moving: def.moving, range: def.range || 0, speed: def.speed || 0, phase: rand() * 6, label: def.label, flash: 0 });
  }
  // Papan penanda lapangan
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshLambertMaterial({ color: 0x223344, side: THREE.DoubleSide }));
  sign.position.set(-27.5, 3.1, 0); sign.rotation.y = Math.PI / 2; // di atas jalur tembak (bawah papan 2.5)
  group.add(sign);

  // --- Titik spawn ---
  const spawnsBlue = [], spawnsRed = [];
  for (let i = 0; i < 5; i++) {
    spawnsBlue.push(new THREE.Vector3(-12 + i * 6, 0, 25));
    spawnsRed.push(new THREE.Vector3(-12 + i * 6, 0, -25));
  }

  // --- Debu / salju beterbangan (pool partikel) ---
  const DUST_N = 240;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_N * 3);
  const dustLife = new Float32Array(DUST_N);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: mapKey === 'salju' ? 0xffffff : 0xd9b878,
    size: 0.35, transparent: true, opacity: 0.75, depthWrite: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  group.add(dust);
  let dustCursor = 0;
  function spawnDust(p, n = 8, spread = 0.5, up = 0.6) {
    for (let i = 0; i < n; i++) {
      const idx = dustCursor = (dustCursor + 1) % DUST_N;
      dustPos[idx * 3] = p.x + (rand() - 0.5) * spread;
      dustPos[idx * 3 + 1] = Math.max(0.05, p.y + rand() * up * 0.5);
      dustPos[idx * 3 + 2] = p.z + (rand() - 0.5) * spread;
      dustLife[idx] = 0.7 + rand() * 0.5;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }
  function updateDust(dt) {
    let any = false;
    for (let i = 0; i < DUST_N; i++) {
      if (dustLife[i] > 0) {
        dustLife[i] -= dt;
        dustPos[i * 3 + 1] += dt * 0.35;
        dustPos[i * 3] += dt * 0.25;
        if (dustLife[i] <= 0) dustPos[i * 3 + 1] = -10;
        any = true;
      }
    }
    if (any) dustGeo.attributes.position.needsUpdate = true;
  }

  function groundAt(x, z) {
    // Platform menara
    if (Math.abs(x) < 3.1 && Math.abs(z) < 3.1) return TOWER_H + 0.5;
    // Ramp selatan menara: z 3..10, |x| < 1.2
    if (Math.abs(x) < 1.2 && z >= 3 && z <= 10) return ((10 - z) / 7) * TOWER_H + 0.3;
    return 0;
  }

  function losBlocked(a, b) {
    for (const c of colliders) {
      // Abaikan collider rendah (peti pendek tidak menghalangi pandangan berdiri)
      if (c.max.y < 1.2) continue;
      if (segHitsBox(a, b, c)) return true;
    }
    return false;
  }

  function update(dt, t) {
    updateDust(dt);
    for (const tg of targets) {
      if (tg.moving) {
        const off = Math.sin(t * tg.speed + tg.phase) * tg.range;
        tg.disc.position.z = tg.baseZ + off;
        tg.ring.position.z = tg.baseZ + off;
        tg.bull.position.z = tg.baseZ + off;
      }
      if (tg.flash > 0) {
        tg.flash -= dt;
        const f = tg.flash > 0;
        tg.disc.material.color.setHex(f ? 0x37d67a : 0xe8e8e8);
      }
    }
    flag.rotation.y = t * 0.8;
  }

  return {
    mapKey, cfg, group, colliders, spawnsBlue, spawnsRed, targets, groundAt, losBlocked, spawnDust, update,
    bounds: ARENA, towerTop: new THREE.Vector3(0, TOWER_H + 0.5, 0),
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    },
  };
}
