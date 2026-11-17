// Nusantara Strike — bot: prajurit AI Tim Biru & Tim Merah.
// Visual manusia kotak (tanpa aset eksternal), taktik: cari musuh, strafe, berlindung,
// flank, naik menara, suppression saat kena damage pemain (item 43).

import * as THREE from 'three';
import { BOT, WEAPONS } from './config.js';

export const BLUE_NAMES = ['Budi', 'Agus', 'Sinta', 'Dewi'];
export const RED_NAMES = ['Joko', 'Slamet', 'Bambang', 'Udin', 'Tono'];

const SKIN = [0xc98d64, 0xa06b42, 0x8a5a34, 0xd9a878, 0x6e4526];
const TEAM_COLOR = { biru: 0x2563eb, merah: 0xdc2626 };
const TEAM_DARK = { biru: 0x1e3a8a, merah: 0x7f1d1d };

let botSeq = 0;

export function createBot(scene, team, name, spawn, skinIdx = 0) {
  const id = ++botSeq;
  const g = new THREE.Group();
  const skin = SKIN[skinIdx % SKIN.length];
  const tc = TEAM_COLOR[team];
  const td = TEAM_DARK[team];
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const parts = [];

  function part(w, h, d, c, x, y, z, head = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    m.userData.isHead = head;
    g.add(m);
    parts.push(m);
    return m;
  }

  const legL = part(0.22, 0.8, 0.26, td, -0.14, 0.4, 0);
  const legR = part(0.22, 0.8, 0.26, td, 0.14, 0.4, 0);
  const torso = part(0.62, 0.72, 0.34, tc, 0, 1.16, 0);
  const vest = part(0.66, 0.4, 0.38, td, 0, 1.2, 0);
  const head = part(0.34, 0.34, 0.34, skin, 0, 1.72, 0, true);
  const helm = part(0.4, 0.16, 0.4, tc, 0, 1.9, 0, true);
  const armL = part(0.16, 0.6, 0.2, skin, -0.4, 1.2, 0.1);
  const armR = part(0.16, 0.6, 0.2, skin, 0.4, 1.2, 0.1);
  const gun = part(0.09, 0.12, 0.85, 0x1a1a1a, 0.18, 1.32, 0.45);

  g.position.copy(spawn);
  scene.add(g);

  const bot = {
    id, team, name, group: g, head, parts, legL, legR, armL, armR, gun,
    hp: BOT.HP, maxHp: BOT.HP, alive: true,
    speed: BOT.SPEED * (0.9 + Math.random() * 0.25),
    yaw: team === 'biru' ? Math.PI : 0,
    weapon: 0, money: 800, kills: 0,
    state: 'seek', waypoint: null, wpT: 0,
    shootCd: 1 + Math.random(), burstLeft: 0, burstT: 0,
    strafeDir: Math.random() < 0.5 ? -1 : 1, strafeT: 2 + Math.random() * 2,
    tactic: 'fight', tacticT: 1 + Math.random() * 2,
    pinSum: 0, pinT0: 0, pinnedUntil: 0,
    walkPhase: Math.random() * 6, moving: false,
    velY: 0, groundY: 0, target: null, losT: 0, hasLos: false,
  };
  for (const p of parts) p.userData.bot = bot;
  return bot;
}

function hitsWall(world, x, z, y, r) {
  for (const c of world.colliders) {
    if (y + 1.7 < c.min.y || y > c.max.y) continue;
    if (x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z) return true;
  }
  return false;
}

function moveBot(world, bot, dx, dz, dt) {
  const p = bot.group.position;
  const r = BOT.RADIUS;
  const nx = p.x + dx;
  if (!hitsWall(world, nx, p.z, p.y, r)) p.x = nx;
  const nz = p.z + dz;
  if (!hitsWall(world, p.x, nz, p.y, r)) p.z = nz;
  p.x = Math.max(-world.bounds, Math.min(world.bounds, p.x));
  p.z = Math.max(-world.bounds, Math.min(world.bounds, p.z));
  const gy = world.groundAt(p.x, p.z);
  // Jatuh / naik halus mengikuti tanah (tangga menara).
  if (p.y > gy + 0.05) { bot.velY -= 20 * dt; p.y += bot.velY * dt; if (p.y < gy) { p.y = gy; bot.velY = 0; } }
  else { p.y = gy; bot.velY = 0; }
  bot.groundY = gy;
}

function pickWaypoint(bot, world, enemyBase) {
  const r = Math.random();
  if (r < 0.18) {
    // Taktik menara: naik lewat ramp selatan.
    bot.tactic = 'tower';
    bot.waypoints = [new THREE.Vector3(0, 0, 12), new THREE.Vector3(0, 0, 6), new THREE.Vector3(0, 0, 0)];
    bot.wpIdx = 0;
    return;
  }
  bot.tactic = 'fight';
  if (r < 0.45 && enemyBase) {
    bot.waypoint = new THREE.Vector3(
      enemyBase.x + (Math.random() - 0.5) * 14,
      0,
      enemyBase.z + (Math.random() - 0.5) * 14,
    );
  } else {
    bot.waypoint = new THREE.Vector3((Math.random() - 0.5) * 52, 0, (Math.random() - 0.5) * 52);
  }
  bot.waypoints = null;
  bot.wpT = 6 + Math.random() * 4;
}

export function botBuy(bot) {
  const m = bot.money;
  const r = Math.random();
  if (m >= 1500 && r < 0.3) { bot.weapon = 3; bot.money -= 1500; }
  else if (m >= 900 && r < 0.55) { bot.weapon = 2; bot.money -= 900; }
  else if (m >= 600 && r < 0.75) { bot.weapon = 1; bot.money -= 600; }
  else bot.weapon = 0;
  if (bot.money >= 500 && Math.random() < 0.3) { bot.money -= 500; bot.maxHp = 150; }
  else bot.maxHp = 100;
  bot.hp = bot.maxHp;
}

export function resetBot(bot, spawn) {
  bot.group.position.copy(spawn);
  bot.hp = bot.maxHp;
  bot.alive = true;
  bot.group.visible = true;
  bot.yaw = bot.team === 'biru' ? Math.PI : 0;
  bot.group.rotation.y = bot.yaw;
  bot.waypoint = null;
  bot.waypoints = null;
  bot.shootCd = 1 + Math.random();
  bot.pinnedUntil = 0;
  bot.pinSum = 0;
}

export function updateBot(bot, dt, ctx) {
  const { world, time } = ctx;
  if (!bot.alive) return;
  const p = bot.group.position;
  const pinned = time < bot.pinnedUntil;

  // Cari musuh terdekat yang hidup.
  let target = null, bestD = Infinity;
  for (const o of ctx.enemiesOf(bot)) {
    if (!o.alive) continue;
    const d = p.distanceTo(o.pos);
    if (d < bestD) { bestD = d; target = o; }
  }
  bot.target = target;

  // Garis pandang (cek berkala).
  bot.losT -= dt;
  if (target && bot.losT <= 0) {
    bot.losT = 0.25;
    const from = new THREE.Vector3(p.x, p.y + BOT.EYE, p.z);
    const to = new THREE.Vector3(target.pos.x, target.pos.y + (target.isPlayer ? 1.4 : 1.3), target.pos.z);
    bot.hasLos = !world.losBlocked(from, to) && !ctx.smokeBetween(from, to);
  }
  const inRange = target && bestD < 48;

  // --- Menembak ---
  bot.shootCd -= dt;
  if (target && inRange && bot.hasLos && !pinned && bot.shootCd <= 0) {
    const w = WEAPONS[bot.weapon];
    const acc = bestD < 10 ? BOT.ACC_CLOSE : bestD < 25 ? BOT.ACC_MID : BOT.ACC_FAR;
    const muzzle = new THREE.Vector3(p.x, p.y + 1.35, p.z);
    const aim = new THREE.Vector3(target.pos.x, target.pos.y + (target.isPlayer ? 1.35 : 1.3), target.pos.z);
    ctx.spawnTracer(muzzle, aim, bot.team === 'biru' ? 0x7db4ff : 0xff9a7d);
    ctx.playShot(bot.weapon, bestD);
    if (Math.random() < acc) {
      const dmg = w.dmg * (Math.random() < 0.12 ? 1.6 : 1); // sesekali headshot
      ctx.damageTarget(target, dmg, bot);
    }
    bot.shootCd = w.rate * (bot.weapon === 1 ? 3 : 1) + 0.35 + Math.random() * 0.5;
    if (bot.weapon === 1) bot.shootCd = 0.28 + Math.random() * 0.3;
  }

  // --- Bergerak ---
  let mx = 0, mz = 0;
  bot.moving = false;
  if (!pinned) {
    if (target && inRange && bot.hasLos) {
      // Strafe sambil menembak.
      bot.strafeT -= dt;
      if (bot.strafeT <= 0) { bot.strafeDir *= -1; bot.strafeT = 1.5 + Math.random() * 2; }
      const dx = target.pos.x - p.x, dz = target.pos.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len * bot.strafeDir, pz = dx / len * bot.strafeDir;
      const want = bestD < 6 ? -0.7 : bestD > 22 ? 0.6 : 0; // jaga jarak
      mx = (px * 0.8 + (dx / len) * want) * bot.speed;
      mz = (pz * 0.8 + (dz / len) * want) * bot.speed;
      bot.moving = true;
    } else {
      // Jalan ke waypoint / menara.
      bot.wpT -= dt;
      if (bot.tactic === 'tower' && bot.waypoints) {
        const wp = bot.waypoints[bot.wpIdx];
        if (wp) {
          const dx = wp.x - p.x, dz = wp.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.9) { bot.wpIdx++; if (bot.wpIdx >= bot.waypoints.length) { bot.tactic = 'hold'; bot.wpT = 5 + Math.random() * 4; } }
          else { mx = (dx / d) * bot.speed; mz = (dz / d) * bot.speed; bot.moving = true; }
        }
      } else if (!bot.waypoint || bot.wpT <= 0 || p.distanceTo(new THREE.Vector3(bot.waypoint.x, p.y, bot.waypoint.z)) < 1.2) {
        pickWaypoint(bot, world, ctx.enemyBase(bot.team));
      } else {
        const dx = bot.waypoint.x - p.x, dz = bot.waypoint.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        mx = (dx / d) * bot.speed; mz = (dz / d) * bot.speed;
        bot.moving = true;
      }
      if (bot.tactic === 'hold') {
        bot.wpT -= dt;
        if (bot.wpT <= 0) pickWaypoint(bot, world, ctx.enemyBase(bot.team));
      }
    }
  }
  if (bot.moving) moveBot(world, bot, mx * dt, mz * dt, dt);

  // Hadap ke target / arah jalan.
  let targetYaw = bot.yaw;
  if (target && (inRange && bot.hasLos)) {
    targetYaw = Math.atan2(target.pos.x - p.x, target.pos.z - p.z);
  } else if (bot.moving) {
    targetYaw = Math.atan2(mx, mz);
  }
  let dy = targetYaw - bot.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  bot.yaw += dy * Math.min(1, dt * 8);
  bot.group.rotation.y = bot.yaw;

  // Animasi jalan sederhana (kaki & lengan mengayun).
  if (bot.moving) {
    bot.walkPhase += dt * 9;
    const s = Math.sin(bot.walkPhase) * 0.45;
    bot.legL.rotation.x = s;
    bot.legR.rotation.x = -s;
    bot.armL.rotation.x = -s * 0.7;
    bot.armR.rotation.x = s * 0.7;
  } else {
    bot.legL.rotation.x *= 0.8;
    bot.legR.rotation.x *= 0.8;
    bot.armL.rotation.x *= 0.8;
    bot.armR.rotation.x *= 0.8;
  }
  // Miring saat tertembak (suppression visual).
  bot.group.rotation.z = pinned ? 0.12 : 0;
}

// Item 43: damage pemain >= 40 dalam 2 detik -> bot pinned 1,5 detik.
export function trackPin(bot, dmg, time) {
  if (time - bot.pinT0 > 2) { bot.pinSum = 0; bot.pinT0 = time; }
  bot.pinSum += dmg;
  if (bot.pinSum >= 40) {
    bot.pinnedUntil = time + 1.5;
    bot.pinSum = 0;
  }
}
