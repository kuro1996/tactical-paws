// Nusantara Strike — logika inti: ronde, ekonomi, tembak, asap, HUD, minimap, latihan.
// 5v5 Tim Biru vs Tim Merah, pertama sampai 5 ronde (maks 9), ronde 100 detik, beli 20 detik.

import * as THREE from 'three';
import { ECONOMY, WEAPONS, SMOKE_PRICE, RECOIL_PATTERN, PLAYER, BOT } from './config.js';
import { createBot, updateBot, botBuy, resetBot, trackPin, BLUE_NAMES, RED_NAMES } from './bots.js';
import * as Snd from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

export class Game {
  constructor(scene, camera, renderer, world) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.world = world;
    this.state = 'menu'; // menu | playing | over
    this.phase = 'lobby'; // lobby | buy | combat | roundEnd | train
    this.mode = 'match';
    this.mapKey = 'salju';
    this.time = 0;
    this.round = 1;
    this.scoreBlue = 0;
    this.scoreRed = 0;
    this.phaseT = 0; // sisa waktu fase
    this.bots = [];
    this.ray = new THREE.Raycaster();
    this.tmpV = new THREE.Vector3();
    this.smokes = [];
    this.tracers = [];
    this.dmgPool = [];
    this.killfeedT = [];
    this.shake = localStorage.getItem('ns_shake') !== '0';
    this.fx = localStorage.getItem('ns_fx') !== '0';

    // Pemain
    this.p = {
      pos: new THREE.Vector3(0, 0, 25), yaw: Math.PI, pitch: 0,
      velY: 0, hp: PLAYER.HP, maxHp: PLAYER.HP, money: ECONOMY.START_MONEY,
      alive: true, crouch: false, onGround: true, coyote: 0, jumpBuf: 0,
      lastStep: 0, moveMag: 0,
    };
    this.curWeapon = 0;
    this.weaponAmmo = WEAPONS.map((w) => w.ammoMax);
    this.ammo = WEAPONS[0].ammoMax;
    this.owned = [true, false, false, false];
    this.smokeCount = 0;
    this.reloading = false;
    this.fireCd = 0;
    this.recoilIdx = 0;
    this.recoilPitch = 0;
    this.bloom = 0;
    this.trauma = 0;
    this.hitStopT = 0;
    this.kills = 0;
    this.roundKills = 0;
    this.roundDmg = 0;
    this.firstBlood = false;
    this.spectateBot = null;
    this.trainScore = 0;
    this.trainBest = parseInt(localStorage.getItem('ns_train_best') || '0', 10);
    this.trainHits = 0;
    this.trainShots = 0;
    this.firing = false;
    this.fireEdge = false;
    this.emoteT = 0;

    this._buildTracers();
    this._buildDmgPool();
    this._bindMenu();
    this.updateHUD();
  }

  // ---------- Setup ----------
  _buildTracers() {
    for (let i = 0; i < 24; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
      l.frustumCulled = false;
      this.scene.add(l);
      this.tracers.push({ line: l, t: 0 });
    }
  }
  _tracer(a, b, color) {
    const tr = this.tracers.find((t) => t.t <= 0) || this.tracers[0];
    const pos = tr.line.geometry.attributes.position;
    pos.setXYZ(0, a.x, a.y, a.z);
    pos.setXYZ(1, b.x, b.y, b.z);
    pos.needsUpdate = true;
    tr.line.material.color.setHex(color);
    tr.line.material.opacity = 0.9;
    tr.t = 0.09;
  }
  _buildDmgPool() {
    const layer = $('dmgLayer');
    for (let i = 0; i < 24; i++) {
      const el = document.createElement('div');
      el.className = 'dmgNum';
      el.style.display = 'none';
      layer.appendChild(el);
      this.dmgPool.push({ el, t: 0, x: 0, y: 0 });
    }
  }
  _showDamage(point, dmg, isHead) {
    const d = this.dmgPool.find((x) => x.t <= 0) || this.dmgPool[0];
    const v = point.clone().project(this.camera);
    d.x = (v.x * 0.5 + 0.5) * window.innerWidth;
    d.y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    d.el.textContent = (isHead ? 'HEADSHOT ' : '') + Math.round(dmg);
    d.el.style.color = isHead ? '#ffd23d' : '#fff';
    d.el.style.left = d.x + 'px';
    d.el.style.top = d.y + 'px';
    d.el.style.display = 'block';
    d.t = 0.8;
  }
  _killfeed(text, good) {
    const kf = $('killfeed');
    const el = document.createElement('div');
    el.className = 'kf' + (good ? ' good' : ' bad');
    el.textContent = text;
    kf.prepend(el);
    while (kf.children.length > 4) kf.removeChild(kf.lastChild);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4200);
  }
  _toast(text, ms = 2600) {
    const t = $('toast');
    t.textContent = text;
    t.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.style.opacity = '0'; }, ms);
  }

  // ---------- Menu ----------
  _bindMenu() {
    document.querySelectorAll('.mapBtn').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.mapBtn').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        this.mapKey = b.dataset.map;
        Snd.sClick();
      });
    });
    $('btnMulai').addEventListener('click', () => { Snd.unlockAudio(); Snd.sClick(); this.startMatch(this.mapKey); });
    $('btnLatih').addEventListener('click', () => { Snd.unlockAudio(); Snd.sClick(); this.startTraining(this.mapKey); });
    $('btnTutupBeli').addEventListener('click', () => { Snd.sClick(); this._startCombat(); });
    $('btnLanjut').addEventListener('click', () => { Snd.sClick(); this._nextRound(); });
    $('btnMainLagi').addEventListener('click', () => { Snd.sClick(); if (this.mode === 'train') this.startTraining(this.mapKey); else this.startMatch(this.mapKey); });
    $('btnKeMenu').addEventListener('click', () => { Snd.sClick(); this.quitToMenu(); });
    $('btnLanjutMain').addEventListener('click', () => { this.togglePause(false); });
    $('btnKeluar').addEventListener('click', () => { this.togglePause(false); this.quitToMenu(); });
    $('tglShake').addEventListener('change', (e) => { this.shake = e.target.checked; localStorage.setItem('ns_shake', this.shake ? '1' : '0'); });
    $('tglFx').addEventListener('change', (e) => { this.fx = e.target.checked; localStorage.setItem('ns_fx', this.fx ? '1' : '0'); this._applyFx(); });
    $('tglShake').checked = this.shake;
    $('tglFx').checked = this.fx;
    $('trainBest').textContent = this.trainBest;
  }
  _applyFx() {
    $('vig').style.background = this.fx ? this.world.cfg.vignette : 'none';
    $('vig').style.display = this.fx ? 'block' : 'none';
  }

  // ---------- Alur pertandingan ----------
  startMatch(mapKey) {
    this.mapKey = mapKey;
    this.mode = 'match';
    this.round = 1;
    this.scoreBlue = 0;
    this.scoreRed = 0;
    this.kills = 0;
    this.p.money = ECONOMY.START_MONEY;
    this.owned = [true, false, false, false];
    this.smokeCount = 0;
    this.curWeapon = 0;
    this.weaponAmmo = WEAPONS.map((w) => w.ammoMax);
    this.ammo = WEAPONS[0].ammoMax;
    this._spawnAll();
    this.state = 'playing';
    $('menu').style.display = 'none';
    $('matchEnd').style.display = 'none';
    $('roundEnd').style.display = 'none';
    $('btnMainLagi').textContent = '🔁 MAIN LAGI';
    $('hud').style.display = 'block';
    $('trainHud').style.display = 'none';
    this._applyFx();
    this._startBuyPhase();
    this._lockPointer();
  }

  startTraining(mapKey) {
    this.mapKey = mapKey;
    this.mode = 'train';
    this.trainScore = 0;
    this.trainHits = 0;
    this.trainShots = 0;
    this.p.money = 0;
    this.owned = [true, false, false, false];
    this.curWeapon = 0;
    this.weaponAmmo = WEAPONS.map((w) => w.ammoMax);
    this.ammo = WEAPONS[0].ammoMax;
    this._clearBots();
    this.p.pos.set(-28, 0, 0);
    this.p.yaw = -Math.PI / 2; // menghadap +x ke arah target
    this.p.pitch = 0;
    this.p.hp = this.p.maxHp = PLAYER.HP;
    this.p.alive = true;
    this.state = 'playing';
    this.phase = 'train';
    this.phaseT = ECONOMY.TRAIN_TIME;
    $('menu').style.display = 'none';
    $('matchEnd').style.display = 'none';
    $('hud').style.display = 'block';
    $('trainHud').style.display = 'block';
    $('trainScore').textContent = '0';
    $('trainBest').textContent = this.trainBest;
    this._applyFx();
    this._toast('🎯 Latihan Tembak — 60 detik, 5 target!');
    Snd.sRoundStart();
    this._lockPointer();
  }

  quitToMenu() {
    this.state = 'menu';
    this.phase = 'lobby';
    this._clearBots();
    document.exitPointerLock && document.exitPointerLock();
    $('menu').style.display = 'flex';
    $('hud').style.display = 'none';
    $('buyMenu').style.display = 'none';
    $('roundEnd').style.display = 'none';
    $('matchEnd').style.display = 'none';
    $('pauseMenu').style.display = 'none';
    $('trainHud').style.display = 'none';
    this.updateHUD();
  }

  _spawnAll() {
    this._clearBots();
    const w = this.world;
    BLUE_NAMES.forEach((n, i) => {
      const b = createBot(this.scene, 'biru', n, w.spawnsBlue[i + 1] || w.spawnsBlue[0], i);
      b.money = ECONOMY.START_MONEY;
      this.bots.push(b);
    });
    RED_NAMES.forEach((n, i) => {
      const b = createBot(this.scene, 'merah', n, w.spawnsRed[i], i + 2);
      b.money = ECONOMY.START_MONEY;
      this.bots.push(b);
    });
    // Pemain di tengah barisan biru.
    this.p.pos.copy(w.spawnsBlue[0]);
    this.p.pos.y = 0;
    this.p.yaw = Math.PI;
    this.p.pitch = 0;
    this.p.hp = this.p.maxHp;
    this.p.alive = true;
    this.spectateBot = null;
  }
  _clearBots() {
    for (const b of this.bots) this.scene.remove(b.group);
    this.bots = [];
  }

  _startBuyPhase() {
    this.phase = 'buy';
    this.phaseT = ECONOMY.BUY_TIME;
    // Bot belanja sesuai uangnya.
    for (const b of this.bots) { botBuy(b); resetBot(b, b.team === 'biru' ? this.world.spawnsBlue[this.bots.indexOf(b) % 5] : this.world.spawnsRed[this.bots.indexOf(b) % 5]); }
    this.p.pos.copy(this.world.spawnsBlue[0]);
    this.p.yaw = Math.PI;
    this.p.hp = this.p.maxHp;
    this.p.alive = true;
    this.spectateBot = null;
    this.roundKills = 0;
    this.roundDmg = 0;
    this.firstBlood = false;
    this._renderBuy();
    $('buyMenu').style.display = 'block';
    $('roundEnd').style.display = 'none';
    this._roundIntro('RONDE ' + this.round);
    this.updateHUD();
  }

  _renderBuy() {
    const g = $('buyGrid');
    g.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const owned = this.owned[i];
      const d = document.createElement('div');
      d.className = 'buyItem' + (owned ? ' owned' : '');
      d.innerHTML = `<div class="bi-emoji">${w.emoji}</div><div class="bi-name">${w.name}</div><div class="bi-desc">${w.desc}</div><div class="bi-price">${owned ? 'DIMILIKI' : '$' + w.price}</div>`;
      if (!owned) d.addEventListener('click', () => this.buyWeapon(i));
      else if (!w.armor) d.addEventListener('click', () => this.selectWeapon(i));
      g.appendChild(d);
    });
    const s = document.createElement('div');
    s.className = 'buyItem' + (this.smokeCount > 0 ? ' owned' : '');
    s.innerHTML = `<div class="bi-emoji">💨</div><div class="bi-name">Smoke Grenade</div><div class="bi-desc">Asap tebal 12 detik • Blokir pandangan • Tekan G</div><div class="bi-price">${this.smokeCount > 0 ? 'DIMILIKI x' + this.smokeCount : '$' + SMOKE_PRICE}</div>`;
    s.addEventListener('click', () => this.buySmoke());
    g.appendChild(s);
    $('buyMoney').textContent = '$' + this.p.money;
  }

  buyWeapon(i) {
    const w = WEAPONS[i];
    if (this.owned[i]) { this.selectWeapon(i); return; }
    if (this.p.money < w.price) { Snd.sDeny(); this._toast('Uang tidak cukup!'); return; }
    this.p.money -= w.price;
    if (w.armor) {
      this.p.maxHp = Math.min(PLAYER.MAX_HP, this.p.maxHp + 50);
      this.p.hp = this.p.maxHp;
      this._toast('🛡️ Armor dipakai! HP maks ' + this.p.maxHp);
    } else {
      this.owned[i] = true;
      this.selectWeapon(i);
      this._toast(w.emoji + ' ' + w.name + ' dibeli!');
    }
    Snd.sBuy();
    this._renderBuy();
    this.updateHUD();
  }
  buySmoke() {
    if (this.p.money < SMOKE_PRICE) { Snd.sDeny(); this._toast('Uang tidak cukup!'); return; }
    this.p.money -= SMOKE_PRICE;
    this.smokeCount++;
    Snd.sBuy();
    this._toast('💨 Smoke Grenade dibeli! (x' + this.smokeCount + ')');
    this._renderBuy();
    this.updateHUD();
  }
  selectWeapon(i) {
    if (!this.owned[i] || WEAPONS[i].armor) return;
    this.weaponAmmo[this.curWeapon] = this.ammo;
    this.curWeapon = i;
    this.ammo = this.weaponAmmo[i];
    this.reloading = false;
    Snd.sClick();
    this.updateHUD();
  }

  _startCombat() {
    if (this.phase !== 'buy') return;
    $('buyMenu').style.display = 'none';
    this.phase = 'combat';
    this.phaseT = ECONOMY.ROUND_TIME;
    this._roundIntro('MULAI!');
    Snd.sRoundStart();
    this._lockPointer();
  }

  _nextRound() {
    if (this.phase !== 'roundEnd') return;
    $('roundEnd').style.display = 'none';
    if (this.scoreBlue >= ECONOMY.WIN_ROUNDS || this.scoreRed >= ECONOMY.WIN_ROUNDS || this.round >= ECONOMY.MAX_ROUNDS) {
      this._endMatch();
      return;
    }
    this.round++;
    this._startBuyPhase();
  }

  _roundIntro(text) {
    const el = $('roundIntro');
    el.textContent = text;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1)';
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translate(-50%,-50%) scale(1.15)'; }, 1400);
  }

  _endRound(winner, reason) {
    if (this.phase !== 'combat') return;
    this.phase = 'roundEnd';
    this.phaseT = 5;
    let title, good;
    if (winner === 'biru') { this.scoreBlue++; this.p.money += ECONOMY.WIN_REWARD; title = '🏆 RONDE DIMENANGKAN!'; good = true; Snd.sRoundWin(); }
    else if (winner === 'merah') { this.scoreRed++; this.p.money += ECONOMY.LOSS_REWARD; title = '💥 RONDE KALAH'; good = false; Snd.sRoundLose(); }
    else { this.p.money += ECONOMY.LOSS_REWARD; title = '🤝 RONDE SERI'; good = false; Snd.sRoundWin(); }
    for (const b of this.bots) b.money += winner === b.team ? ECONOMY.WIN_REWARD : ECONOMY.LOSS_REWARD;
    // MVP ronde: bot biru kill terbanyak.
    const mvp = this.bots.filter((b) => b.team === 'biru').sort((a, b) => b.kills - a.kills)[0];
    $('roundEndTitle').textContent = title;
    $('roundEndTitle').style.color = good ? '#37d67a' : '#ff6b5e';
    $('roundEndStats').innerHTML =
      `Alasan: ${reason}<br>Skor: <b style="color:#6ea8ff">Biru ${this.scoreBlue}</b> — <b style="color:#ff6b5e">Merah ${this.scoreRed}</b><br>` +
      `Kill kamu ronde ini: <b>${this.roundKills}</b> • Damage: <b>${Math.round(this.roundDmg)}</b><br>` +
      `MVP Tim Biru: <b>${mvp ? mvp.name + ' (' + mvp.kills + ' kill)' : '-'}</b><br>` +
      `Bonus: <b>+$${winner === 'biru' ? ECONOMY.WIN_REWARD : ECONOMY.LOSS_REWARD}</b> • Uang kamu: <b>$${this.p.money}</b>`;
    $('roundEnd').style.display = 'block';
    this.updateHUD();
  }

  _endMatch() {
    this.state = 'over';
    this.phase = 'lobby';
    document.exitPointerLock && document.exitPointerLock();
    const win = this.scoreBlue > this.scoreRed;
    $('matchTitle').textContent = win ? '🏆 TIM BIRU MENANG!' : this.scoreBlue === this.scoreRed ? '🤝 SERI!' : '💥 TIM MERAH MENANG';
    $('matchTitle').style.color = win ? '#37d67a' : '#ff6b5e';
    $('matchStats').innerHTML =
      `Skor akhir: <b style="color:#6ea8ff">Biru ${this.scoreBlue}</b> — <b style="color:#ff6b5e">Merah ${this.scoreRed}</b><br>` +
      `Total kill kamu: <b>${this.kills}</b> • Ronde dimainkan: <b>${this.round}</b><br>` +
      `Peta: <b>${this.world.cfg.name}</b>`;
    $('matchEnd').style.display = 'block';
    $('buyMenu').style.display = 'none';
    if (win) Snd.sRoundWin(); else Snd.sRoundLose();
  }

  _lockPointer() {
    const el = this.renderer.domElement;
    if (!el.requestPointerLock) return;
    try {
      const p = el.requestPointerLock();
      if (p && p.catch) p.catch(() => {}); // gagal di headless/tanpa gestur: abaikan diam-diam
    } catch (_) { /* pointer lock tidak tersedia */ }
  }

  togglePause(force) {
    const show = force !== undefined ? force : $('pauseMenu').style.display !== 'block';
    if (this.state !== 'playing') return;
    $('pauseMenu').style.display = show ? 'block' : 'none';
    if (show) document.exitPointerLock && document.exitPointerLock();
    else this._lockPointer();
  }

  // ---------- Update utama ----------
  update(dt, input) {
    this.time += dt;
    // Hit-stop: beku sesaat setelah kill/headshot (60/80ms).
    if (this.hitStopT > 0) { this.hitStopT -= dt; return; }
    if (this.state !== 'playing') return;

    // Timer fase.
    if (this.phase === 'buy' || this.phase === 'combat' || this.phase === 'train') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.phase === 'buy') this._startCombat();
        else if (this.phase === 'combat') this._decideByTimer();
        else if (this.phase === 'train') this._endTraining();
      }
    }
    if (this.phase === 'roundEnd') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) { $('roundEnd').style.display = 'none'; this._nextRound(); }
    }

    this._updatePlayer(dt, input);
    this._updateBots(dt);
    this._updateTracers(dt);
    this._updateSmokes(dt);
    this._updateDmgNums(dt);
    this.world.update(dt, this.time);
    this._updateCamera(dt);
    this._updateMinimap();
    this._updateHUDTimer();
  }

  _decideByTimer() {
    const blueAlive = this.bots.filter((b) => b.team === 'biru' && b.alive).length + (this.p.alive ? 1 : 0);
    const redAlive = this.bots.filter((b) => b.team === 'merah' && b.alive).length;
    if (blueAlive > redAlive) this._endRound('biru', 'Waktu habis — Tim Biru lebih banyak bertahan');
    else if (redAlive > blueAlive) this._endRound('merah', 'Waktu habis — Tim Merah lebih banyak bertahan');
    else this._endRound(null, 'Waktu habis — jumlah bertahan sama');
  }

  // ---------- Pemain ----------
  _updatePlayer(dt, input) {
    const p = this.p;
    if (!p.alive) return; // spectate ditangani _updateCamera
    // Mouse look.
    p.yaw -= (input.mdx || 0) * 0.0022;
    p.pitch = clamp(p.pitch - (input.mdy || 0) * 0.0022, -1.5, 1.5);
    // Recoil recovery.
    this.recoilPitch *= Math.pow(0.02, dt);
    this.bloom = Math.max(0, this.bloom - dt * 3);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);

    const slow = input.slow || input.crouch;
    p.crouch = !!input.crouch;
    const speed = p.crouch ? PLAYER.CROUCH_SPEED : slow ? PLAYER.SLOW_SPEED : PLAYER.WALK_SPEED;
    let ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let iz = (input.fwd ? 1 : 0) - (input.back ? 1 : 0);
    const len = Math.hypot(ix, iz) || 1;
    ix /= len; iz /= len;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const vx = (-sin * iz + cos * ix) * speed;
    const vz = (-cos * iz - sin * ix) * speed;
    p.moveMag = Math.hypot(ix, iz) * (iz || ix ? 1 : 0);

    // Tabrakan dinding (lingkaran vs AABB).
    const r = PLAYER.RADIUS;
    const tryX = p.pos.x + vx * dt;
    if (!this._hitsWall(tryX, p.pos.z, p.pos.y, r)) p.pos.x = tryX;
    const tryZ = p.pos.z + vz * dt;
    if (!this._hitsWall(p.pos.x, tryZ, p.pos.y, r)) p.pos.z = tryZ;
    p.pos.x = clamp(p.pos.x, -this.world.bounds, this.world.bounds);
    p.pos.z = clamp(p.pos.z, -this.world.bounds, this.world.bounds);

    // Lompat: coyote 120ms + buffer 120ms.
    const gy = this.world.groundAt(p.pos.x, p.pos.z);
    if (p.onGround) p.coyote = PLAYER.COYOTE_MS / 1000;
    else p.coyote -= dt;
    if (input.jump) p.jumpBuf = PLAYER.BUFFER_MS / 1000;
    else p.jumpBuf -= dt;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.velY = PLAYER.JUMP_VEL;
      p.onGround = false;
      p.jumpBuf = 0; p.coyote = 0;
    }
    p.velY -= PLAYER.GRAVITY * dt;
    const prevVy = p.velY;
    p.pos.y += p.velY * dt;
    if (p.pos.y <= gy) {
      if (prevVy < -7) { this.world.spawnDust(p.pos, 10, 0.8, 0.5); Snd.sStep(true); }
      p.pos.y = gy; p.velY = 0; p.onGround = true;
    } else if (p.pos.y > gy + 0.05) p.onGround = false;

    // Debu saat berlari di gurun.
    if (p.moveMag > 0.5 && p.onGround && this.mapKey === 'gurun') {
      this._stepT = (this._stepT || 0) - dt;
      if (this._stepT <= 0) { this._stepT = 0.4; this.world.spawnDust(p.pos, 3, 0.4, 0.3); }
    }
    if (p.moveMag > 0.5 && p.onGround) {
      if (this.time - p.lastStep > 0.45) { p.lastStep = this.time; Snd.sStep(false); }
    }

    // Tembak / isi ulang.
    this.fireCd -= dt;
    const w = WEAPONS[this.curWeapon];
    const semi = this.curWeapon >= 2;
    const wantFire = semi ? this.fireEdge : this.firing;
    if (wantFire && this.fireCd <= 0 && !this.reloading && (this.phase === 'combat' || this.phase === 'train')) {
      this._shoot();
    }
    if (input.reload) this._reload();
    if (input.smoke) this._throwSmoke();
    if (input.digit !== undefined && input.digit !== null) {
      const d = input.digit;
      if (d >= 0 && d < 4 && this.owned[d] && !WEAPONS[d].armor) this.selectWeapon(d);
    }
    this.fireEdge = false;
    input.jump = false; input.reload = false; input.smoke = false; input.digit = null;
    input.mdx = 0; input.mdy = 0;
  }

  _hitsWall(x, z, y, r) {
    for (const c of this.world.colliders) {
      if (y + 1.7 < c.min.y || y > c.max.y) continue;
      if (x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z) return true;
    }
    return false;
  }

  _shoot() {
    const w = WEAPONS[this.curWeapon];
    if (this.ammo <= 0) {
      Snd.sHit(false);
      this._reload();
      this.fireCd = 0.25;
      return;
    }
    this.ammo--;
    this.fireCd = w.rate;
    this.trainShots++;
    // Recoil deterministik + bloom.
    const pat = RECOIL_PATTERN[this.curWeapon];
    const step = pat[this.recoilIdx % pat.length];
    this.recoilIdx++;
    this.p.pitch += (step[1] * Math.PI) / 180;
    this.p.yaw += (step[0] * Math.PI) / 180 * (Math.random() < 0.5 ? 1 : -1);
    this.recoilPitch += (step[1] * Math.PI) / 180;
    this.bloom = Math.min(1, this.bloom + (this.curWeapon === 2 ? 0.9 : 0.25));
    if (this.shake) this.trauma = Math.min(0.6, this.trauma + (this.curWeapon === 3 ? 0.5 : 0.18));
    Snd.sShoot(this.curWeapon, 1);
    // Sebaran: gerak + udara + bloom.
    const moveSpread = this.p.moveMag * 0.02 + (this.p.onGround ? 0 : 0.03);
    const spread = 0.008 + moveSpread + this.bloom * 0.02 + (this.curWeapon === 2 ? 0.05 : 0);
    const origin = this.camera.position.clone();
    for (let i = 0; i < w.pellets; i++) {
      const dir = new THREE.Vector3((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread * 2, -1)
        .applyQuaternion(this.camera.quaternion);
      this.ray.set(origin, dir);
      this.ray.far = 120;
      const hits = this.ray.intersectObjects(this._shootTargets(), false);
      if (hits.length) {
        const h = hits[0];
        const end = h.point.clone();
        this._tracer(this._muzzlePos(), end, 0xffe08a);
        this._onShotHit(h, w);
        break;
      } else {
        this._tracer(this._muzzlePos(), origin.clone().add(dir.clone().multiplyScalar(60)), 0xffe08a);
      }
    }
    if (this.ammo === 0) setTimeout(() => this._reload(), 250);
    this.updateHUD();
  }

  _muzzlePos() {
    const v = new THREE.Vector3(0.3, -0.25, -0.8);
    return v.applyQuaternion(this.camera.quaternion).add(this.camera.position);
  }

  _shootTargets() {
    const arr = [];
    for (const b of this.bots) if (b.alive) arr.push(...b.parts);
    if (this.phase === 'train') for (const t of this.world.targets) arr.push(t.disc);
    // Dinding/peti untuk titik benturan (hanya mesh, bukan partikel).
    arr.push(...this.world.group.children.filter((o) => o.isMesh));
    return arr;
  }

  _onShotHit(h, w) {
    const o = h.object;
    if (o.userData.bot) {
      const bot = o.userData.bot;
      const isHead = !!o.userData.isHead;
      const dmg = w.dmg * (isHead ? 2 : 1);
      this._damageBot(bot, dmg, true, isHead, h.point);
      return;
    }
    if (o.userData.target) {
      this.trainHits++;
      const gained = 1;
      this.trainScore += gained;
      $('trainScore').textContent = this.trainScore;
      const tg = this.world.targets.find((t) => t.disc === o || t.ring === o || t.bull === o);
      if (tg) tg.flash = 0.4;
      Snd.sTarget();
      this._showDamage(h.point, gained, false);
      return;
    }
    // Benturan dinding: debu kecil.
    this.world.spawnDust(h.point, 4, 0.3, 0.2);
  }

  _damageBot(bot, dmg, byPlayer, isHead, point) {
    if (!bot.alive) return;
    bot.hp -= dmg;
    if (byPlayer) {
      this.roundDmg += dmg;
      trackPin(bot, dmg, this.time);
      Snd.sHit(isHead);
      $('hitmarker').style.opacity = '1';
      $('hitmarker').style.borderColor = isHead ? '#ffd23d' : '#fff';
      setTimeout(() => { $('hitmarker').style.opacity = '0'; }, 120);
      if (point) this._showDamage(point, dmg, isHead);
      if (this.shake) this.trauma = Math.min(0.7, this.trauma + 0.1);
    }
    if (bot.hp <= 0) this._killBot(bot, byPlayer, isHead);
    this.updateHUD();
  }

  _killBot(bot, byPlayer, isHead) {
    bot.alive = false;
    bot.group.visible = false;
    if (!this.firstBlood) { this.firstBlood = true; }
    if (byPlayer) {
      this.kills++;
      this.roundKills++;
      this.p.money += ECONOMY.KILL_REWARD;
      Snd.sKill();
      this._killfeed(`Kamu ▸ ${bot.name} ${isHead ? '(HEADSHOT)' : ''} +$${ECONOMY.KILL_REWARD}`, true);
      this.hitStopT = isHead ? 0.08 : 0.06; // hit-stop item 22
      if (this.fx) {
        const f = $('killFlash');
        f.style.opacity = '0.5';
        setTimeout(() => { f.style.opacity = '0'; }, 90);
      }
    } else {
      this._killfeed(`${bot.name} gugur`, false);
    }
    // Cek akhir ronde.
    const redAlive = this.bots.filter((b) => b.team === 'merah' && b.alive).length;
    const blueAlive = this.bots.filter((b) => b.team === 'biru' && b.alive).length + (this.p.alive ? 1 : 0);
    if (this.phase === 'combat') {
      if (redAlive === 0) this._endRound('biru', 'Semua Tim Merah gugur');
      else if (blueAlive === 0) this._endRound('merah', 'Semua Tim Biru gugur');
    }
    this.updateHUD();
  }

  _damagePlayer(dmg, fromBot) {
    const p = this.p;
    if (!p.alive || this.phase !== 'combat') return;
    p.hp -= dmg;
    Snd.sHurt();
    if (this.fx) {
      const v = $('dmgVig');
      v.style.opacity = '0.75';
      setTimeout(() => { v.style.opacity = '0'; }, 220);
    }
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      this._killfeed(`${fromBot ? fromBot.name : 'Musuh'} ▸ Kamu`, false);
      this._toast('Kamu gugur! Menonton rekan tim…');
      const aliveBlue = this.bots.find((b) => b.team === 'biru' && b.alive);
      this.spectateBot = aliveBlue || null;
      const blueAlive = this.bots.filter((b) => b.team === 'biru' && b.alive).length;
      if (blueAlive === 0) this._endRound('merah', 'Semua Tim Biru gugur');
    }
    this.updateHUD();
  }

  _reload() {
    if (this.reloading || this.ammo === WEAPONS[this.curWeapon].ammoMax) return;
    if (this.phase !== 'combat' && this.phase !== 'train') return;
    this.reloading = true;
    Snd.sReload();
    const rt = WEAPONS[this.curWeapon].reload;
    const cw = this.curWeapon;
    setTimeout(() => {
      if (this.curWeapon === cw) this.ammo = WEAPONS[cw].ammoMax;
      this.reloading = false;
      this.updateHUD();
    }, rt);
    this.updateHUD();
  }

  _throwSmoke() {
    if (this.smokeCount <= 0) { if (this.phase === 'combat') this._toast('Tidak punya Smoke Grenade — beli di fase beli ($300)'); return; }
    this.smokeCount--;
    Snd.sSmoke();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const pos = this.camera.position.clone().add(dir.multiplyScalar(9));
    pos.y = Math.max(0.8, this.world.groundAt(pos.x, pos.z) + 1.2);
    const geo = new THREE.SphereGeometry(3.4, 14, 10);
    const mat = new THREE.MeshLambertMaterial({ color: 0xcfd6dd, transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.smokes.push({ pos, mesh, t: 12 });
    this._toast('💨 Smoke dilempar!');
    this.updateHUD();
  }

  _smokeBetween(a, b) {
    for (const s of this.smokes) {
      // Jarak segmen a-b ke pusat asap.
      const ab = new THREE.Vector3().subVectors(b, a);
      const t = clamp(new THREE.Vector3().subVectors(s.pos, a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1);
      const closest = a.clone().add(ab.multiplyScalar(t));
      if (closest.distanceTo(s.pos) < 3.4) return true;
    }
    return false;
  }

  // ---------- Bot ----------
  _updateBots(dt) {
    if (this.phase !== 'combat') return;
    const playerTarget = {
      pos: this.p.pos, alive: this.p.alive, isPlayer: true, ref: 'player',
    };
    const ctx = {
      world: this.world, time: this.time, scene: this.scene,
      enemiesOf: (bot) => {
        const list = [];
        if (bot.team === 'merah') {
          if (this.p.alive) list.push(playerTarget);
          for (const o of this.bots) if (o.team === 'biru' && o.alive) list.push({ pos: o.group.position, alive: true, isPlayer: false, ref: o });
        } else {
          for (const o of this.bots) if (o.team === 'merah' && o.alive) list.push({ pos: o.group.position, alive: true, isPlayer: false, ref: o });
        }
        return list;
      },
      enemyBase: (team) => (team === 'biru' ? new THREE.Vector3(0, 0, -25) : new THREE.Vector3(0, 0, 25)),
      smokeBetween: (a, b) => this._smokeBetween(a, b),
      spawnTracer: (a, b, c) => this._tracer(a, b, c),
      playShot: (idx, dist) => Snd.sShoot(idx, Math.max(1, dist)),
      damageTarget: (target, dmg, fromBot) => {
        if (target.isPlayer) this._damagePlayer(dmg, fromBot);
        else {
          const bot = target.ref;
          bot.hp -= dmg;
          if (bot.hp <= 0) this._killBot(bot, false, false);
        }
      },
    };
    for (const b of this.bots) updateBot(b, dt, ctx);
  }

  // ---------- Efek & HUD ----------
  _updateTracers(dt) {
    for (const t of this.tracers) {
      if (t.t > 0) {
        t.t -= dt;
        t.line.material.opacity = Math.max(0, t.t / 0.09) * 0.9;
      }
    }
  }
  _updateSmokes(dt) {
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.t -= dt;
      s.mesh.material.opacity = Math.min(0.55, s.t * 0.1);
      s.mesh.scale.setScalar(1 + Math.sin(this.time * 2 + i) * 0.05);
      if (s.t <= 0) { this.scene.remove(s.mesh); this.smokes.splice(i, 1); }
    }
  }
  _updateDmgNums(dt) {
    for (const d of this.dmgPool) {
      if (d.t > 0) {
        d.t -= dt;
        d.y -= dt * 40;
        d.el.style.top = d.y + 'px';
        d.el.style.opacity = String(Math.max(0, d.t / 0.8));
        if (d.t <= 0) d.el.style.display = 'none';
      }
    }
  }
  _updateCamera(dt) {
    const p = this.p;
    if (!p.alive && this.spectateBot) {
      const bp = this.spectateBot.group.position;
      const yaw = this.spectateBot.yaw;
      this.camera.position.set(bp.x - Math.sin(yaw) * 3, bp.y + 2.6, bp.z - Math.cos(yaw) * 3);
      this.camera.lookAt(bp.x, bp.y + 1.4, bp.z);
      return;
    }
    if (!p.alive) return;
    const eye = p.crouch ? PLAYER.EYE_CROUCH : PLAYER.EYE;
    let sx = 0, sy = 0;
    if (this.shake && this.trauma > 0) {
      const s = this.trauma * this.trauma;
      sx = (Math.random() - 0.5) * s * 0.12;
      sy = (Math.random() - 0.5) * s * 0.12;
    }
    this.camera.position.set(p.pos.x + sx, p.pos.y + eye + sy, p.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch + this.recoilPitch * 0.4;
    this.camera.rotation.z = 0;
  }
  _updateMinimap() {
    const cv = $('minimap');
    if (!cv || this.state !== 'playing') return;
    const c = cv.getContext('2d');
    const S = cv.width, B = this.world.bounds;
    const to = (x, z) => [(x / B * 0.5 + 0.5) * S, (z / B * 0.5 + 0.5) * S];
    c.clearRect(0, 0, S, S);
    c.fillStyle = this.mapKey === 'salju' ? '#dfe8f0' : '#e0c184';
    c.fillRect(0, 0, S, S);
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.strokeRect(1, 1, S - 2, S - 2);
    // Menara
    const [tx, ty] = to(0, 0);
    c.fillStyle = '#7a5c33';
    c.fillRect(tx - 4, ty - 4, 8, 8);
    // Asap
    for (const s of this.smokes) {
      const [sx, sy] = to(s.pos.x, s.pos.z);
      c.fillStyle = 'rgba(200,200,200,0.8)';
      c.beginPath(); c.arc(sx, sy, 6, 0, Math.PI * 2); c.fill();
    }
    // Bot
    for (const b of this.bots) {
      if (!b.alive) continue;
      const [bx, by] = to(b.group.position.x, b.group.position.z);
      c.fillStyle = b.team === 'biru' ? '#2563eb' : '#dc2626';
      c.beginPath(); c.arc(bx, by, 3.2, 0, Math.PI * 2); c.fill();
    }
    // Pemain
    if (this.p.alive) {
      const [px, py] = to(this.p.pos.x, this.p.pos.z);
      c.fillStyle = '#fff';
      c.strokeStyle = '#2563eb';
      c.lineWidth = 2;
      c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px - Math.sin(this.p.yaw) * 9, py - Math.cos(this.p.yaw) * 9);
      c.strokeStyle = '#2563eb';
      c.stroke();
    }
  }
  _updateHUDTimer() {
    if (this.state !== 'playing') return;
    const t = Math.max(0, Math.ceil(this.phaseT));
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    $('timerText').textContent =
      this.phase === 'buy' ? 'BELI ' + mm + ':' + ss :
      this.phase === 'train' ? 'LATIHAN ' + mm + ':' + ss :
      this.phase === 'combat' ? mm + ':' + ss : '';
    $('buyTimer').textContent = this.phase === 'buy' ? 'Fase beli berakhir dalam ' + t + ' detik' : '';
  }

  updateHUD() {
    const p = this.p;
    $('hpText').textContent = Math.max(0, Math.ceil(p.hp)) + ' / ' + p.maxHp;
    $('hpBar').style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
    $('ammoText').textContent = this.ammo + ' / ' + WEAPONS[this.curWeapon].ammoMax;
    $('weaponName').textContent = WEAPONS[this.curWeapon].emoji + ' ' + WEAPONS[this.curWeapon].name;
    $('moneyText').textContent = '$' + p.money;
    $('scoreText').textContent = `Biru ${this.scoreBlue} — ${this.scoreRed} Merah`;
    $('roundText').textContent = this.mode === 'train' ? 'LATIHAN TEMBAK' : 'Ronde ' + this.round + ' / ' + ECONOMY.MAX_ROUNDS;
    $('smokeCount').textContent = this.smokeCount > 0 ? '💨 x' + this.smokeCount : '';
    $('reloadHint').style.display = this.ammo === 0 && !this.reloading ? 'inline' : 'none';
    // Crosshair dinamis (item 20).
    const gap = 6 + this.bloom * 14 + this.p.moveMag * 4 + (this.p.onGround ? 0 : 6);
    const ch = $('crosshair');
    ch.style.setProperty('--gap', gap + 'px');
    ch.classList.toggle('spread', this.bloom > 0.4);
  }

  // ---------- Latihan ----------
  _endTraining() {
    this.phase = 'lobby';
    document.exitPointerLock && document.exitPointerLock();
    const acc = this.trainShots > 0 ? Math.round((this.trainHits / this.trainShots) * 100) : 0;
    const isBest = this.trainScore > this.trainBest;
    if (isBest) {
      this.trainBest = this.trainScore;
      localStorage.setItem('ns_train_best', String(this.trainBest));
    }
    $('matchTitle').textContent = '🎯 LATIHAN SELESAI';
    $('matchTitle').style.color = '#ffd23d';
    $('matchStats').innerHTML =
      `Skor: <b>${this.trainScore}</b> target kena<br>` +
      `Akurasi: <b>${acc}%</b> (${this.trainHits}/${this.trainShots} tembakan)<br>` +
      `Rekor terbaik: <b>${this.trainBest}</b>${isBest ? ' — REKOR BARU! 🏆' : ''}`;
    $('matchEnd').style.display = 'block';
    $('btnMainLagi').textContent = '🔁 LATIHAN LAGI';
    Snd.sRoundWin();
  }
}
