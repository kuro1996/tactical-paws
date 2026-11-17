// Nusantara Strike — konfigurasi permainan (ekonomi & senjata sama persis dengan build beku v13).
// Semua teks dalam game berbahasa Indonesia asli.

export const ECONOMY = {
  START_MONEY: 800,
  KILL_REWARD: 300,
  WIN_REWARD: 1000,
  LOSS_REWARD: 500,
  ROUND_TIME: 100, // detik per ronde
  BUY_TIME: 20, // detik fase beli
  WIN_ROUNDS: 5, // pertama sampai 5 ronde menang
  MAX_ROUNDS: 9,
  TRAIN_TIME: 60, // detik latihan tembak
};

export const WEAPONS = [
  { name: 'M4 Assault Rifle', emoji: '🔫', price: 0, dmg: 34, rate: 0.17, ammoMax: 30, pellets: 1, reload: 850, desc: 'Gratis • Damage 34 • Ammo 30 • Seimbang' },
  { name: 'MP5 SMG', emoji: '⚡', price: 600, dmg: 22, rate: 0.085, ammoMax: 32, pellets: 1, reload: 900, desc: 'Sangat cepat • Damage 22 • Ammo 32' },
  { name: 'SPAS Shotgun', emoji: '💥', price: 900, dmg: 17, rate: 0.75, ammoMax: 6, pellets: 5, reload: 1200, desc: 'Sebaran 5 peluru • Damage 17/peluru • Ammo 6' },
  { name: 'AWP Sniper', emoji: '🎯', price: 1500, dmg: 105, rate: 1.05, ammoMax: 5, pellets: 1, reload: 1300, desc: 'Damage besar 105 • Ammo 5 • One-shot jarak jauh' },
  { name: 'Armor', emoji: '🛡️', price: 500, dmg: 0, rate: 0, ammoMax: 0, pellets: 0, reload: 0, armor: true, desc: '+50 HP ronde ini (maks 150 HP)' },
];

export const SMOKE_PRICE = 300;

export const MAPS = {
  salju: {
    key: 'salju',
    name: 'Puncak Salju',
    ground: 0xdfe8f0,
    groundRough: 0xc9d6e2,
    sky: 0x9fc4e0,
    fog: 0xbdd5e6,
    fogNear: 45,
    fogFar: 130,
    light: 0xfff2e0,
    ambient: 0xbfd4e6,
    crate: 0x8a6f4d,
    crateTop: 0x6b5638,
    tree: 0x1e5c3a,
    rock: 0x9aa7b0,
    vignette: 'radial-gradient(ellipse at center, transparent 55%, rgba(120,170,220,0.28) 100%)',
    exposure: 1.05,
  },
  gurun: {
    key: 'gurun',
    name: 'Gurun Pasir',
    ground: 0xe0c184,
    groundRough: 0xc9a55e,
    sky: 0xf2c98a,
    fog: 0xe8c98f,
    fogNear: 40,
    fogFar: 120,
    light: 0xffe6b0,
    ambient: 0xe8c98f,
    crate: 0x7a5c33,
    crateTop: 0x5d4526,
    tree: 0x4a7a2e,
    rock: 0xb59a6a,
    vignette: 'radial-gradient(ellipse at center, transparent 55%, rgba(200,140,40,0.30) 100%)',
    exposure: 1.12,
  },
};

// Pola recoil deterministik per senjata: daftar (x, y) derajat per tembakan berurutan.
export const RECOIL_PATTERN = {
  0: [[0, 0.55], [0.12, 0.6], [-0.1, 0.62], [0.18, 0.7], [-0.16, 0.72], [0.1, 0.8], [-0.08, 0.85], [0.14, 0.9]],
  1: [[0, 0.3], [0.08, 0.32], [-0.07, 0.34], [0.1, 0.36], [-0.09, 0.38], [0.06, 0.4]],
  2: [[0, 1.6], [0.2, 1.7]],
  3: [[0, 2.4], [0.1, 2.5]],
};

export const PLAYER = {
  EYE: 1.7,
  EYE_CROUCH: 1.15,
  WALK_SPEED: 5.2,
  SLOW_SPEED: 2.6,
  CROUCH_SPEED: 2.4,
  JUMP_VEL: 7.2,
  GRAVITY: 20,
  COYOTE_MS: 120,
  BUFFER_MS: 120,
  RADIUS: 0.45,
  HP: 100,
  MAX_HP: 150,
};

export const BOT = {
  HP: 100,
  SPEED: 3.4,
  EYE: 1.55,
  RADIUS: 0.45,
  // Akurasi bot: peluang kena per tembakan pada jarak dekat/menengah/jauh.
  ACC_CLOSE: 0.55,
  ACC_MID: 0.38,
  ACC_FAR: 0.22,
};
