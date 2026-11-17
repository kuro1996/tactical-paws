// Nusantara Strike — entrypoint: renderer, input, loop, ganti peta.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Game } from './game.js';

const input = {
  fwd: false, back: false, left: false, right: false,
  jump: false, crouch: false, slow: false,
  fire: false, reload: false, smoke: false,
  digit: null, mdx: 0, mdy: 0,
};

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'game';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc3e8);
scene.fog = new THREE.Fog(0x9fc3e8, 60, 160);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 12, 40);

let world = buildWorld(scene, 'salju');
const game = new Game(scene, camera, renderer, world);

// Ganti peta: buang dunia lama, bangun baru.
game.rebuildWorld = (key) => {
  scene.remove(world.group);
  world.dispose();
  world = buildWorld(scene, key);
  scene.background = new THREE.Color(world.cfg.sky);
  scene.fog.color.setHex(world.cfg.sky);
  return world;
};
// Sisipkan pergantian peta ke startMatch/startTraining.
for (const fn of ['startMatch', 'startTraining']) {
  const orig = game[fn].bind(game);
  game[fn] = (key) => {
    if (world.mapKey !== key) {
      game.world = game.rebuildWorld(key);
    }
    orig(key);
  };
}

// ---------- Input: keyboard ----------
const keyMap = {
  KeyW: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'slow', ShiftRight: 'slow',
  KeyC: 'crouch',
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'KeyR') input.reload = true;
  if (e.code === 'KeyG') input.smoke = true;
  if (e.code === 'KeyP') game.togglePause();
  if (e.code.startsWith('Digit')) {
    const d = parseInt(e.code.slice(5), 10) - 1;
    if (d >= 0 && d < 4) input.digit = d;
  }
  const k = keyMap[e.code];
  if (k) input[k] = true;
});
window.addEventListener('keyup', (e) => {
  const k = keyMap[e.code];
  if (k) input[k] = false;
});

// ---------- Input: mouse ----------
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (game.state !== 'playing') return;
  if (document.pointerLockElement !== renderer.domElement) return;
  game.firing = true;
  game.fireEdge = true;
  input.fire = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  game.firing = false;
  input.fire = false;
});
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  if (game.state !== 'playing') return;
  input.mdx += e.movementX || 0;
  input.mdy += e.movementY || 0;
});
// Esc keluar dari pointer lock -> jeda otomatis (hanya saat bermain).
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (!locked && game.state === 'playing' && document.getElementById('pauseMenu').style.display !== 'block') {
    // Jangan jeda saat panel akhir ronde/pertandingan tampil.
    if (document.getElementById('roundEnd').style.display === 'block') return;
    if (document.getElementById('matchEnd').style.display === 'block') return;
    if (document.getElementById('buyMenu').style.display === 'block') return;
    game.togglePause(true);
  }
});

// ---------- Input: sentuh ----------
const isTouch = window.matchMedia('(pointer: coarse)').matches;
if (isTouch) {
  const stick = document.getElementById('stick');
  const knob = document.getElementById('stickKnob');
  let stickId = null;
  const setStick = (dx, dy) => {
    const cl = Math.max(-1, Math.min(1, dx / 45));
    const cf = Math.max(-1, Math.min(1, -dy / 45));
    knob.style.left = 35 + cl * 35 + 'px';
    knob.style.top = 35 + dy * 0.7 + 'px';
    input.right = cl > 0.25; input.left = cl < -0.25;
    input.fwd = cf > 0.25; input.back = cf < -0.25;
  };
  stick.addEventListener('touchstart', (e) => { stickId = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
  stick.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== stickId) continue;
      const r = stick.getBoundingClientRect();
      setStick(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2));
    }
    e.preventDefault();
  }, { passive: false });
  const endStick = (e) => {
    for (const t of e.changedTouches) if (t.identifier === stickId) { stickId = null; setStick(0, 0); knob.style.left = '35px'; knob.style.top = '35px'; }
  };
  stick.addEventListener('touchend', endStick);
  stick.addEventListener('touchcancel', endStick);

  const bindBtn = (id, down, up) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { down(); e.preventDefault(); }, { passive: false });
    if (up) el.addEventListener('touchend', (e) => { up(); e.preventDefault(); }, { passive: false });
  };
  bindBtn('btnFire', () => { game.firing = true; game.fireEdge = true; }, () => { game.firing = false; });
  bindBtn('btnJump', () => { input.jump = true; });
  bindBtn('btnReloadT', () => { input.reload = true; });
  let crouchOn = false;
  bindBtn('btnCrouch', () => { crouchOn = !crouchOn; input.crouch = crouchOn; });
  // Seret di area game untuk membidik.
  let lookId = null, lastX = 0, lastY = 0;
  renderer.domElement.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    lookId = t.identifier; lastX = t.clientX; lastY = t.clientY;
  }, { passive: true });
  renderer.domElement.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      input.mdx += (t.clientX - lastX) * 2.2;
      input.mdy += (t.clientY - lastY) * 2.2;
      lastX = t.clientX; lastY = t.clientY;
    }
  }, { passive: true });
  renderer.domElement.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
  });
}

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Loop ----------
const clock = new THREE.Clock();
let menuAngle = 0;
let shotReady = false;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (game.state === 'menu') {
    menuAngle += dt * 0.08;
    camera.position.set(Math.sin(menuAngle) * 34, 14, Math.cos(menuAngle) * 34);
    camera.lookAt(0, 4, 0);
    world.update(dt, clock.elapsedTime);
  } else if (game.state === 'playing') {
    game.update(dt, input);
  }
  renderer.render(scene, camera);
  // Penanda untuk perekam screenshot: game sudah tergambar sekali.
  if (!shotReady) { shotReady = true; window.__shotReady = true; }
}
loop();

// Untuk harness pengujian / screenshot.
window.__game = game;
window.__world = world;
window.__ready = true;
