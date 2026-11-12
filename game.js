/* =========================================================================
   DÍNH NHAU — game co-op 2 người trên cùng một bàn phím
   Hai nhân vật bị buộc vào nhau bằng một sợi dây. Phải phối hợp để qua màn.
   ========================================================================= */
(() => {
  'use strict';

  // ---------------------------------------------------------------- helpers
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const approach = (v, target, delta) =>
    v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
  const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    return String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function ellipse(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  }
  function heartPath(cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.46);
    ctx.bezierCurveTo(cx - s * 0.72, cy - s * 0.1, cx - s * 0.56, cy - s * 0.66, cx - s * 0.24, cy - s * 0.66);
    ctx.bezierCurveTo(cx - s * 0.05, cy - s * 0.66, cx, cy - s * 0.48, cx, cy - s * 0.36);
    ctx.bezierCurveTo(cx, cy - s * 0.48, cx + s * 0.05, cy - s * 0.66, cx + s * 0.24, cy - s * 0.66);
    ctx.bezierCurveTo(cx + s * 0.56, cy - s * 0.66, cx + s * 0.72, cy - s * 0.1, cx, cy + s * 0.46);
    ctx.closePath();
  }
  function starPath(cx, cy, r, points = 5, inner = 0.46) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = (i * Math.PI) / points - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * inner;
      const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // ------------------------------------------------------------------ setup
  const T = 64, COLS = 20, ROWS = 11, W = COLS * T, H = ROWS * T;
  const STEP = 1 / 120;

  const GRAV_UP = 2350, GRAV_DOWN = 2850, MAX_FALL = 1500;
  const RUN = 335, ACC_GROUND = 3000, ACC_AIR = 1850, FRICTION = 3400, AIR_DRAG = 950;
  const JUMP = 775, JUMP_BOOST = 1045, COYOTE = 0.1;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let DPR = Math.min(2, window.devicePixelRatio || 1);
  function sizeCanvas() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * DPR;
    canvas.height = H * DPR;
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  const $ = (id) => document.getElementById(id);
  const dom = {
    stage: $('stage'), hud: $('hud'), levelNum: $('levelNum'), levelName: $('levelName'),
    timer: $('timer'), btnSound: $('btnSound'), btnPause: $('btnPause'), starPill: $('starPill'), starCount: $('starCount'),
    banner: $('banner'), bannerKicker: $('bannerKicker'), bannerTitle: $('bannerTitle'), bannerHint: $('bannerHint'),
    screenStart: $('screenStart'), screenPause: $('screenPause'), screenClear: $('screenClear'), screenEnd: $('screenEnd'),
    name1: $('name1'), name2: $('name2'), ctrlName1: $('ctrlName1'), ctrlName2: $('ctrlName2'),
    btnStart: $('btnStart'), btnResume: $('btnResume'), btnRestartLevel: $('btnRestartLevel'), btnQuit: $('btnQuit'),
    clearKicker: $('clearKicker'), clearTitle: $('clearTitle'), clearLine: $('clearLine'), clearStats: $('clearStats'),
    btnNext: $('btnNext'), endTitle: $('endTitle'), endLine: $('endLine'), endStats: $('endStats'), endRank: $('endRank'),
    btnReplay: $('btnReplay'), btnHome: $('btnHome'), errorBanner: $('errorBanner'),
    // Online Lobby elements
    tabLocal: $('tabLocal'), tabOnline: $('tabOnline'), localNamesBlock: $('localNamesBlock'),
    onlineBox: $('onlineBox'), onlineMyName: $('onlineMyName'), btnConfigFirebase: $('btnConfigFirebase'),
    btnCreateRoom: $('btnCreateRoom'), btnJoinRoom: $('btnJoinRoom'), inputRoomCode: $('inputRoomCode'),
    roomStatus: $('roomStatus'), badgeRoomRole: $('badgeRoomRole'), roomCodeText: $('roomCodeText'), btnShareLink: $('btnShareLink'),
    btnCopyCode: $('btnCopyCode'), statusNote: $('statusNote'), btnCancelRoom: $('btnCancelRoom'),
    emoteBar: $('emoteBar'), modalFirebase: $('modalFirebase'), fbDbUrl: $('fbDbUrl'),
    fbApiKey: $('fbApiKey'), fbProjectId: $('fbProjectId'), btnSaveFirebase: $('btnSaveFirebase'),
    btnCloseFirebase: $('btnCloseFirebase'),
  };

  // ------------------------------------------------------------------ fonts
  const DISPLAY = '"Baloo 2", "Comic Sans MS", cursive';
  const BODY = '"Nunito", "Segoe UI", sans-serif';

  // ----------------------------------------------------------------- levels
  //  # = đất, ^ = bẫy, . = trống
  const LEVELS = [
    {
      name: 'Làm quen',
      tag: 'bắt đầu dính',
      hint: 'Mỗi đứa đứng lên một cái nút — cùng lúc cơ. Cửa sẽ mở.',
      theme: 'day',
      spawn: [{ x: 150, y: 640 }, { x: 245, y: 640 }],
      tiles: [
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '.......^^...........',
        '####################',
      ],
      stars: [
        { x: 3.4 * T, y: 512 },
        { x: 7.7 * T, y: 468 },
        { x: 12.1 * T, y: 500 },
      ],
      plates: [
        { id: 'a', kind: 'plate', x: 5.2 * T, y: 640, w: 88 },
        { id: 'b', kind: 'plate', x: 9.5 * T, y: 640, w: 88 },
      ],
      doors: [{ x: 13 * T, y: 320, w: 2 * T, h: 320, needs: ['a', 'b'] }],
      goal: { x: 16.3 * T, y: 640, w: 150, h: 190 },
      sign: { x: 280, y: 640, text: 'Hai cái nút. Cùng lúc. Hiểu chưa?' },
    },
    {
      name: 'Cõng nhau',
      tag: 'một đứa làm bệ',
      hint: 'Người nhẹ đứng lên đầu người kia, giữ nhảy thật cao. Nút ở trên cao đó.',
      theme: 'golden',
      spawn: [{ x: 150, y: 640 }, { x: 245, y: 640 }],
      tiles: [
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '..........^^........',
        '####################',
      ],
      stars: [
        { x: 4.4 * T, y: 512 },
        { x: 7.2 * T + 26, y: 310 },
        { x: 12.2 * T, y: 500 },
      ],
      plates: [
        { id: 'hi', kind: 'button', x: 7.2 * T, y: 326, w: 52, h: 52, latchOn: true, guide: 7.2 * T + 26 },
      ],
      doors: [{ x: 14 * T, y: 320, w: 2 * T, h: 320, needs: ['hi'] }],
      goal: { x: 16.9 * T, y: 640, w: 150, h: 190 },
      sign: { x: 380, y: 640, text: 'Cao quá. Hay là… cõng nhau đi?' },
    },
    {
      name: 'Bế em',
      tag: 'trái tim biết đi',
      hint: 'Cả hai phải ở gần thì trái tim mới chịu đi. Đừng bỏ rơi nó.',
      theme: 'mint',
      spawn: [{ x: 120, y: 640 }, { x: 205, y: 640 }],
      tiles: [
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....^^...#..^^......',
        '####################',
      ],
      stars: [
        { x: 5.6 * T, y: 508 },
        { x: 9.4 * T, y: 486 },
        { x: 14.4 * T, y: 508 },
      ],
      plates: [],
      doors: [],
      heart: { x: 3.1 * T, y: 566 },
      goal: { x: 16.4 * T, y: 640, w: 150, h: 190 },
      sign: { x: 470, y: 640, text: 'Bé tim chỉ đi khi cả hai đứa ở gần.' },
    },
    {
      name: 'Bập bênh',
      tag: 'một đứa bay',
      hint: 'Một đứa đứng bên phải bập bênh. Đứa kia nhảy thật mạnh lên bên trái để bật người kia lên bục.',
      theme: 'golden',
      spawn: [{ x: 150, y: 640 }, { x: 245, y: 640 }],
      tiles: [
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '............###.....',
        '....................',
        '....................',
        '####################',
      ],
      seesaw: { x: 560, w: 180, y: 640 },
      ropeMax: 380,
      stars: [
        { x: 650, y: 500 },
        { x: 850, y: 330 },
        { x: 1080, y: 500 },
      ],
      plates: [
        { id: 'hi', kind: 'plate', x: 820, y: 448, w: 88, latchOn: true },
      ],
      doors: [{ x: 1000, y: 320, w: 128, h: 320, needs: ['hi'] }],
      goal: { x: 1150, y: 640, w: 120, h: 190 },
      sign: { x: 420, y: 640, text: 'Đứa bên phải đứng yên. Đứa bên trái nhảy thiệt mạnh lên bập bênh.' },
    },
    {
      name: 'Về nhà',
      tag: 'màn cuối',
      hint: 'Bấm đủ hai nút, bế trái tim qua cổng cuối. Đừng để dây đứt.',
      theme: 'night',
      spawn: [{ x: 150, y: 640 }, { x: 245, y: 640 }],
      tiles: [
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '...............^^...',
        '####################',
      ],
      stars: [
        { x: 4.8 * T, y: 508 },
        { x: 6 * T + 26, y: 310 },
        { x: 14.3 * T, y: 492 },
      ],
      plates: [
        { id: 'hi', kind: 'button', x: 6 * T, y: 326, w: 52, h: 52, latchOn: true, guide: 6 * T + 26 },
        { id: 'lo', kind: 'plate', x: 8.5 * T, y: 640, w: 84, latchOn: true },
      ],
      doors: [{ x: 12 * T, y: 320, w: 2 * T, h: 320, needs: ['hi', 'lo'] }],
      heart: { x: 2.7 * T, y: 566 },
      goal: { x: 17.1 * T, y: 640, w: 140, h: 190 },
      sign: { x: 380, y: 640, text: 'Còn một đoạn nữa thôi. Bế tim về nhà nha.' },
    },
      {
      name: 'Đu dây vực sâu',
      tag: 'người làm trụ',
      hint: 'Vực sâu đầy gai! Một người giữ phím Neo (S / ↓) làm trụ, người kia nhảy qua vực rồi neo lại kéo bạn sang.',
      theme: 'mint',
      ropeMax: 330,
      spawn: [{ x: 140, y: 640 }, { x: 230, y: 640 }],
      tiles: [
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '....^^^^^^^^^^^^....',
        '....^^^^^^^^^^^^....',
        '####............####',
      ],
      stars: [
        { x: 5 * T, y: 440 },
        { x: 10 * T, y: 380 },
        { x: 15 * T, y: 440 },
      ],
      plates: [
        { id: 'hi_anchor', kind: 'button', x: 9.6 * T, y: 260, w: 52, h: 52, latchOn: true, guide: 9.6 * T + 26 },
      ],
      doors: [{ x: 16.5 * T, y: 320, w: 1.5 * T, h: 320, needs: ['hi_anchor'] }],
      goal: { x: 17.5 * T, y: 640, w: 130, h: 190 },
      sign: { x: 280, y: 640, text: 'Đừng buông Neo khi bạn chưa tiếp đất an toàn!' },
    },
    {
      name: 'Bậc thang đôi',
      tag: 'chia đôi ngả đường',
      hint: 'Hai tầng bậc thang riêng biệt. Bấm công tắc bên này để mở cầu thang bên kia cho người yêu.',
      theme: 'day',
      ropeMax: 360,
      spawn: [{ x: 120, y: 640 }, { x: 210, y: 640 }],
      tiles: [
        '....................',
        '....................',
        '....................',
        '...........#####....',
        '.......#####........',
        '....................',
        '....................',
        '....###.............',
        '....................',
        '.........^^.........',
        '####################',
      ],
      stars: [
        { x: 4.5 * T, y: 400 },
        { x: 8.5 * T, y: 220 },
        { x: 13.5 * T, y: 150 },
      ],
      plates: [
        { id: 'step1', kind: 'plate', x: 4.8 * T, y: 448, w: 76, latchOn: true },
        { id: 'step2', kind: 'button', x: 8.6 * T, y: 210, w: 52, h: 52, latchOn: true },
      ],
      doors: [{ x: 14.5 * T, y: 320, w: 1.8 * T, h: 320, needs: ['step1', 'step2'] }],
      goal: { x: 16.8 * T, y: 640, w: 140, h: 190 },
      sign: { x: 290, y: 640, text: 'Người tầng trên, người tầng dưới. Dây căng là kéo ngã đó!' },
    },
    {
      name: 'Nguyện ước bên nhau',
      tag: 'chạm tới đỉnh cao',
      hint: 'Màn thử thách tột đỉnh: vừa bế tim, vừa vượt bập bênh cao và phối hợp bật nhảy 3 tầng.',
      theme: 'night',
      ropeMax: 380,
      spawn: [{ x: 130, y: 640 }, { x: 210, y: 640 }],
      tiles: [
        '....................',
        '....................',
        '..............###...',
        '....................',
        '..........###.......',
        '....................',
        '......###...........',
        '....................',
        '....................',
        '....^^.......^^.....',
        '####################',
      ],
      seesaw: { x: 460, w: 180, y: 640 },
      stars: [
        { x: 7.5 * T, y: 340 },
        { x: 11.5 * T, y: 220 },
        { x: 15.5 * T, y: 110 },
      ],
      plates: [
        { id: 'peak', kind: 'button', x: 11.2 * T, y: 210, w: 52, h: 52, latchOn: true },
        { id: 'ground_pl', kind: 'plate', x: 13.5 * T, y: 640, w: 84, latchOn: true },
      ],
      doors: [{ x: 16 * T, y: 320, w: 1.8 * T, h: 320, needs: ['peak', 'ground_pl'] }],
      heart: { x: 2.5 * T, y: 566 },
      goal: { x: 17.2 * T, y: 640, w: 140, h: 190 },
      sign: { x: 340, y: 640, text: 'Đỉnh cao hạnh phúc là cùng nhau vượt qua mọi gian khó.' },
    },
      {
      name: 'Thử thách mê cung',
      tag: 'hầm ngục hiểm trở',
      hint: 'Mê cung 2 tầng gai nhọn! Người tầng trên phải dẫm công tắc liên tục để tắt cửa chông, bảo vệ người tầng dưới bế trái tim vượt cạm bẫy.',
      theme: 'mint',
      ropeMax: 390,
      spawn: [{ x: 130, y: 380 }, { x: 210, y: 640 }],
      tiles: [
        '....................',
        '....................',
        '....................',
        '..#################.',
        '....................',
        '....................',
        '....................',
        '....................',
        '.....^^^^^^..^^^^^^.',
        '....^^^^^^^^^^^^^^^^',
        '####################',
      ],
      stars: [
        { x: 6 * T, y: 180 },
        { x: 10 * T, y: 460 },
        { x: 15 * T, y: 180 },
      ],
      plates: [
        { id: 'maze_gate1', kind: 'plate', x: 6.5 * T, y: 256, w: 90, latchOn: true },
        { id: 'maze_btn2', kind: 'button', x: 11.2 * T, y: 150, w: 52, h: 52, latchOn: true },
      ],
      doors: [
        { x: 8.5 * T, y: 384, w: 1.5 * T, h: 256, needs: ['maze_gate1'] },
        { x: 16.5 * T, y: 384, w: 1.8 * T, h: 256, needs: ['maze_btn2'] },
      ],
      heart: { x: 3.2 * T, y: 566 },
      goal: { x: 17.6 * T, y: 640, w: 130, h: 190 },
      sign: { x: 290, y: 640, text: 'Người trên chạy trước bấm nút mở cửa, người dưới ôm tim vượt gai!' },
    },
    {
      name: 'Bất biến tình yêu',
      tag: 'màn cuối sinh tử',
      hint: 'Màn chơi dài và cam go nhất: vừa bập bênh, vừa đu dây qua 3 vực sâu liên hoàn, cõng nhau bật cao bấm nút trên nóc thế giới.',
      theme: 'night',
      ropeMax: 410,
      spawn: [{ x: 120, y: 640 }, { x: 210, y: 640 }],
      tiles: [
        '....................',
        '....................',
        '........###.........',
        '....................',
        '....###.....###.....',
        '....................',
        '....................',
        '....................',
        '..^^^^.......^^^^...',
        '..^^^^.......^^^^...',
        '##....#######....###',
      ],
      seesaw: { x: 420, w: 180, y: 640 },
      stars: [
        { x: 4.8 * T, y: 220 },
        { x: 9.5 * T, y: 90 },
        { x: 14.2 * T, y: 220 },
      ],
      plates: [
        { id: 'summit', kind: 'button', x: 9.3 * T, y: 100, w: 52, h: 52, latchOn: true },
        { id: 'deep_pl', kind: 'plate', x: 7.2 * T, y: 640, w: 84, latchOn: true },
      ],
      doors: [{ x: 15.5 * T, y: 320, w: 1.8 * T, h: 320, needs: ['summit', 'deep_pl'] }],
      heart: { x: 2.2 * T, y: 566 },
      goal: { x: 17.5 * T, y: 640, w: 135, h: 190 },
      sign: { x: 320, y: 640, text: 'Vượt qua màn này, hai bạn chính là định mệnh của đời nhau!' },
    },
  ];

  // ------------------------------------------------------------------ themes
  const THEMES = {
    day: {
      skyTop: '#ffe4ef', skyBottom: '#d4efff', sun: '#fff1b0', sunGlow: 'rgba(255,235,160,.55)',
      hillFar: '#cdeadd', hillMid: '#b3e2ca', hillNear: '#95d5b4',
      grass: '#8bdb9f', grassDark: '#63c184', dirt: '#e2b083', dirtDark: '#c99064',
      cloud: '#ffffff', cloudAlpha: 0.85, star: false, bird: true,
      tree: '#7fce9f', treeDark: '#5eb184', trunk: '#b98a6a',
      tint: 'rgba(255,240,220,.10)',
    },
    golden: {
      skyTop: '#ffd3c1', skyBottom: '#ffecc0', sun: '#ffd98a', sunGlow: 'rgba(255,200,120,.6)',
      hillFar: '#ecc9bd', hillMid: '#e0b3a4', hillNear: '#cf9c8e',
      grass: '#c8d98c', grassDark: '#a8bd69', dirt: '#d9a07c', dirtDark: '#bd8462',
      cloud: '#fff3e3', cloudAlpha: 0.8, star: false, bird: true,
      tree: '#c3cd83', treeDark: '#a3af66', trunk: '#a97a5c',
      tint: 'rgba(255,180,120,.10)',
    },
    mint: {
      skyTop: '#d9f7ee', skyBottom: '#fff2d3', sun: '#fff4bb', sunGlow: 'rgba(255,240,170,.5)',
      hillFar: '#c6e9d8', hillMid: '#a9ddc6', hillNear: '#8dcdb3',
      grass: '#83d6b0', grassDark: '#5db994', dirt: '#d8b18e', dirtDark: '#bd9272',
      cloud: '#ffffff', cloudAlpha: 0.9, star: false, bird: true,
      tree: '#78cbab', treeDark: '#59ae90', trunk: '#b08d70',
      tint: 'rgba(200,255,235,.08)',
    },
    night: {
      skyTop: '#25254b', skyBottom: '#5b5686', sun: '#fff3cf', sunGlow: 'rgba(255,243,207,.25)',
      hillFar: '#3e3d6d', hillMid: '#34335d', hillNear: '#2b2b4f',
      grass: '#5fb392', grassDark: '#438a72', dirt: '#5c4b67', dirtDark: '#473a50',
      cloud: '#a7a2cf', cloudAlpha: 0.35, star: true, bird: false,
      tree: '#3d6f62', treeDark: '#2e574e', trunk: '#3d3048',
      tint: 'rgba(120,110,200,.10)',
    },
  };

  // ------------------------------------------------------------------- state
  const G = {
    mode: 'menu',
    levelIndex: 0, level: null, theme: THEMES.day,
    players: [], plates: [], doors: [], heart: null, goal: null,
    time: 0, animT: 0, levelTime: 0, levelFalls: 0, levelTauts: 0, tautCd: 0,
    totalTime: 0, totalFalls: 0, totalTauts: 0, totalStars: 0,
    stars: [], levelStars: 0, ropeMax: 300, seesaw: null,
    particles: [], shake: 0, fade: 1, flash: 0, respawnT: 0, dead: false,
    names: ['Bông', 'Bắp'], sound: true, uiReady: true,
    clouds: [], decor: { tufts: [], flowers: [] }, trees: [], skyStars: [],
    menuPlayers: [], bannerTO: null, lastTimer: '',
    stats: [], ranks: null,
  };

  // ------------------------------------------------------------------- audio
  let actx = null;
  function initAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function tone(freq, dur, type = 'sine', vol = 0.05, freq2 = null, delay = 0) {
    if (!actx || !G.sound) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function sfx(name) {
    if (!actx || !G.sound) return;
    switch (name) {
      case 'jump': tone(430, 0.13, 'sine', 0.05, 660); break;
      case 'boost': tone(520, 0.18, 'triangle', 0.06, 980); tone(880, 0.2, 'sine', 0.03, 1320, 0.05); break;
      case 'land': tone(150, 0.08, 'sine', 0.045, 90); break;
      case 'plate': tone(880, 0.08, 'triangle', 0.045); tone(1320, 0.12, 'sine', 0.035, null, 0.07); break;
      case 'door': tone(240, 0.35, 'sine', 0.05, 520); tone(720, 0.25, 'triangle', 0.025, 900, 0.12); break;
      case 'heart': tone(660, 0.1, 'sine', 0.045); tone(990, 0.16, 'sine', 0.035, null, 0.08); break;
      case 'star': tone(1046, 0.08, 'triangle', 0.04); tone(1568, 0.14, 'sine', 0.03, null, 0.05); break;
      case 'boing': tone(110, 0.2, 'sine', 0.08, 320); tone(320, 0.24, 'triangle', 0.045, 620, 0.03); break;
      case 'die': tone(320, 0.4, 'sawtooth', 0.035, 70); break;
      case 'clear': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.045, null, i * 0.09)); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, 'triangle', 0.04, null, i * 0.1)); break;
      case 'click': tone(600, 0.05, 'square', 0.02); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------- input
  const held = new Set();
  const KEYS = [
    { left: 'KeyA', right: 'KeyD', jump: 'KeyW', anchor: 'KeyS' },
    { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', anchor: 'ArrowDown' },
  ];
  const GAME_CODES = new Set([
    'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
  ]);
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const code = e.code;
    if (GAME_CODES.has(code)) e.preventDefault();
    held.add(code);
    if (e.repeat) return;
    if (code === 'Escape' || code === 'KeyP') {
      if (G.mode === 'playing') { pauseGame(); return; }
      if (G.mode === 'paused') { resumeGame(); return; }
    }
    if (code === 'KeyM') { toggleSound(); return; }
    if (G.mode === 'playing') {
      if (code === KEYS[0].jump) G.players[0].jumpBuffer = 0.14;
      if (code === KEYS[1].jump) G.players[1].jumpBuffer = 0.14;
      if (code === 'KeyR' && e.altKey) { restartLevel(); }
    } else if (G.mode === 'clear') {
      if ((code === 'Enter' || code === 'Space') && G.uiReady) nextLevel();
    } else if (G.mode === 'menu') {
      if (code === 'Enter' || code === 'Space') startGame();
    }
  });
  window.addEventListener('keyup', (e) => {
    const code = e.code;
    held.delete(code);
    if (code === 'KeyM') return;
    if (G.mode !== 'playing') return;
    if (code === KEYS[0].jump) cutJump(G.players[0]);
    if (code === KEYS[1].jump) cutJump(G.players[1]);
  });
  window.addEventListener('blur', () => {
    held.clear();
    if (G.mode === 'playing') pauseGame();
  });
  function cutJump(p) {
    if (!p || p.launched > 0) return;
    if (p.vy < -470) p.vy = -470;
  }

  // ------------------------------------------------------------------- state helpers
  function screenHideAll() {
    [dom.screenStart, dom.screenPause, dom.screenClear, dom.screenEnd].forEach((el) => el.classList.add('hidden'));
  }
  function updateNames() {
    dom.ctrlName1.textContent = G.names[0];
    dom.ctrlName2.textContent = G.names[1];
    document.title = `${G.names[0]} ♥ ${G.names[1]} — Dính Nhau`;
  }
  function savePrefs() {
    try {
      localStorage.setItem('dinhnhau.names', JSON.stringify(G.names));
      localStorage.setItem('dinhnhau.mute', G.sound ? '0' : '1');
    } catch (e) {}
  }
  function loadPrefs() {
    try {
      const n = JSON.parse(localStorage.getItem('dinhnhau.names') || 'null');
      if (Array.isArray(n) && n.length === 2) {
        G.names[0] = String(n[0]).slice(0, 12) || 'Bông';
        G.names[1] = String(n[1]).slice(0, 12) || 'Bắp';
      }
      G.sound = localStorage.getItem('dinhnhau.mute') !== '1';
    } catch (e) {}
    dom.name1.value = G.names[0];
    dom.name2.value = G.names[1];
    updateNames();
    dom.btnSound.classList.toggle('off', !G.sound);
    dom.btnSound.textContent = G.sound ? '♪' : '♪';
  }
  function toggleSound() {
    G.sound = !G.sound;
    dom.btnSound.classList.toggle('off', !G.sound);
    savePrefs();
    if (G.sound) { initAudio(); sfx('click'); }
  }

  // ------------------------------------------------------------------- level build
  function tileAt(L, x, y) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return '.';
    return L.tiles[y] ? L.tiles[y][x] || '.' : '.';
  }
  function isSolid(x, y) {
    if (x < 0 || x >= COLS) return true;
    if (y < 0 || y >= ROWS) return false;
    return tileAt(G.level, x, y) === '#';
  }
  function isSpike(x, y) {
    return tileAt(G.level, x, y) === '^';
  }

  function makePlayer(i, sp) {
    const w = 42, h = 52;
    return {
      i, w, h,
      x: sp.x - w / 2, y: sp.y - h,
      vx: 0, vy: 0,
      onGround: false, wasGround: false, prevBottom: sp.y,
      coyote: 0, jumpBuffer: 0, standingOn: null, anchored: false,
      squash: 0, blink: rnd(1.2, 4), blinkT: 0, walk: 0, face: 1,
      bubble: null, spawn: { x: sp.x, y: sp.y },
      landImpact: 0, launched: 0,
    };
  }

  function buildClouds(seed) {
    const R = mulberry32(seed * 131 + 7);
    const arr = [];
    for (let i = 0; i < 6; i++) {
      arr.push({ x: R() * (W + 300) - 150, y: 70 + R() * 250, s: 0.55 + R() * 0.9, v: 4 + R() * 9, a: 0.35 + R() * 0.45 });
    }
    return arr;
  }
  function buildSkyStars(seed) {
    const R = mulberry32(seed * 73 + 3);
    const arr = [];
    for (let i = 0; i < 70; i++) {
      arr.push({ x: R() * W, y: R() * 420, r: 0.7 + R() * 1.8, p: R() * Math.PI * 2, s: 0.7 + R() * 1.8 });
    }
    return arr;
  }
  function buildDecor(L, seed) {
    const R = mulberry32(seed * 997 + 13);
    const tufts = [], flowers = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (tileAt(L, x, y) === '#' && tileAt(L, x, y - 1) !== '#') {
          const top = y * T;
          for (let i = 0; i < 3; i++) {
            tufts.push({ x: x * T + 6 + R() * (T - 12), y: top, s: 0.6 + R() * 0.8, lean: R() * 2 - 1 });
          }
          if (R() < 0.3) {
            flowers.push({ x: x * T + 12 + R() * (T - 24), y: top, c: pick(['#ffd1e3', '#fff1a8', '#ffffff', '#d9c8ff', '#ffb3c9']), s: 0.75 + R() * 0.45 });
          }
        }
      }
    }
    return { tufts, flowers };
  }

  function buildTrees(seed, L) {
    const R = mulberry32(seed * 37 + 11);
    const xs = [56, 330, 610, 780, 980, 1210];
    const out = [];
    for (const x0 of xs) {
      const x = x0 + R() * 26 - 13;
      let bad = false;
      for (const d of L.doors || []) {
        if (x > d.x - 150 && x < d.x + d.w + 80) bad = true;
      }
      if (L.goal && x > L.goal.x - 140 && x < L.goal.x + L.goal.w + 90) bad = true;
      if (L.seesaw && x > L.seesaw.x - 70 && x < L.seesaw.x + L.seesaw.w + 70) bad = true;
      if (!bad) out.push({ x, s: 0.62 + R() * 0.5, sway: R() * 6.28, base: 648 });
    }
    return out;
  }

  function buildLevel(idx) {
    if (idx < 0) idx = 0;
    if (idx >= LEVELS.length) { showEnding(); return; }
    const L = LEVELS[idx];
    G.levelIndex = idx;
    G.level = L;
    G.theme = THEMES[L.theme] || THEMES.day;
    G.players = [makePlayer(0, L.spawn[0]), makePlayer(1, L.spawn[1])];
    G.plates = (L.plates || []).map((p) => ({ ...p, live: false, wasLive: false, on: false, pressT: 0 }));
    G.doors = (L.doors || []).map((d) => ({ ...d, opened: false, openT: 0 }));
    G.heart = L.heart ? { x: L.heart.x, y: L.heart.y, homeX: L.heart.x, homeY: L.heart.y, held: false, gift: false } : null;
    G.goal = { ...L.goal };
    G.seesaw = L.seesaw ? { ...L.seesaw, tilt: 0, cd: 0, pulse: 0 } : null;
    G.ropeMax = L.ropeMax || 300;
    G.levelTime = 0;
    G.levelFalls = 0;
    G.levelTauts = 0;
    G.tautCd = 0;
    G.particles = [];
    G.shake = 0;
    G.flash = 0;
    G.fade = 1;
    G.respawnT = 0;
    G.dead = false;
    G.uiReady = false;
    G.clouds = buildClouds(idx + 1);
    G.skyStars = buildSkyStars(idx + 1);
    G.stars = (L.stars || []).map((s) => ({ ...s, got: false, phase: rnd(0, 6.28) }));
    G.levelStars = 0;
    G.trees = buildTrees(idx + 1, L);
    G.decor = buildDecor(L, idx + 1);
    G.mode = 'playing';
    G.lastTimer = '';
    screenHideAll();
    dom.hud.classList.remove('hidden');
    dom.levelNum.textContent = idx + 1;
    dom.levelName.textContent = L.name;
    dom.timer.textContent = '00:00';
    showBanner(L, idx);
    updateHUD();
    setTimeout(() => { G.uiReady = true; }, 350);
  }

  function showBanner(L, idx) {
    dom.bannerKicker.textContent = `MÀN ${idx + 1} · ${(L.tag || '').toUpperCase()}`;
    dom.bannerTitle.textContent = L.name;
    dom.bannerHint.textContent = L.hint;
    dom.banner.classList.add('show');
    clearTimeout(G.bannerTO);
    G.bannerTO = setTimeout(() => dom.banner.classList.remove('show'), 4000);
  }

  function startGame() {
    if (G.mode !== 'menu') return;
    initAudio();
    const n1 = (dom.name1.value || '').trim().slice(0, 12) || 'Bông';
    const n2 = (dom.name2.value || '').trim().slice(0, 12) || 'Bắp';
    G.names = [n1, n2];
    updateNames();
    savePrefs();
    G.totalTime = 0; G.totalFalls = 0; G.totalTauts = 0; G.totalStars = 0; G.stats = [];
    dom.btnStart.blur();
    buildLevel(0);
    sfx('click');
  }

  function restartLevel() {
    if (!G.level) return;
    G.totalStars = Math.max(0, G.totalStars - G.levelStars);
    G.totalFalls = Math.max(0, G.totalFalls - G.levelFalls);
    G.totalTauts = Math.max(0, G.totalTauts - G.levelTauts);
    hideScreensOnly();
    buildLevel(G.levelIndex);
  }
  function hideScreensOnly() {
    screenHideAll();
    dom.hud.classList.remove('hidden');
  }
  function pauseGame() {
    if (G.mode !== 'playing') return;
    G.mode = 'paused';
    held.clear();
    dom.banner.classList.remove('show');
    dom.screenPause.classList.remove('hidden');
    dom.btnResume.focus({ preventScroll: true });
  }
  function resumeGame() {
    if (G.mode !== 'paused') return;
    G.mode = 'playing';
    dom.screenPause.classList.add('hidden');
    held.clear();
    canvas.focus({ preventScroll: true });
  }
  function goMenu() {
    G.mode = 'menu';
    held.clear();
    G.players = [];
    G.heart = null;
    G.level = null;
    initMenu();
    screenHideAll();
    dom.screenStart.classList.remove('hidden');
    dom.hud.classList.add('hidden');
    dom.banner.classList.remove('show');
    if (dom.btnStart) dom.btnStart.blur();
  }

  // ------------------------------------------------------------------- physics
  function update(dt) {
    if (G.mode !== 'playing') return;
    G.levelTime += dt;
    G.tautCd = Math.max(0, G.tautCd - dt);
    G.flash = Math.max(0, G.flash - dt * 3);
    G.fade = Math.max(0, G.fade - dt * 3.2);

    const ps = G.players;
    for (const p of ps) {
      p.prevBottom = p.y + p.h;
      p.wasGround = p.onGround;
      p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);
      p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
      p.launched = Math.max(0, p.launched - dt);
      p.landImpact = 0;
      p.squash += (0 - p.squash) * Math.min(1, dt * 16);
      p.walk += Math.abs(p.vx) * dt * 0.055;
      p.blink -= dt;
      if (p.blink <= 0) { p.blink = rnd(2.2, 5.5); p.blinkT = 0.13; }
      if (p.blinkT > 0) p.blinkT = Math.max(0, p.blinkT - dt);
      if (p.bubble) { p.bubble.t -= dt; if (p.bubble.t <= 0) p.bubble = null; }
    }

    // Cập nhật input mạng nếu đang chơi online
    if (window.GameNetwork && window.GameNetwork.isOnline) {
      if (window.GameNetwork.isHost) {
        // Host nhận keys của Player 2 từ network
        const rk = window.GameNetwork.remoteKeys || {};
        if (rk.jump && ps[1].onGround && ps[1].jumpBuffer <= 0) ps[1].jumpBuffer = 0.14;
      } else {
        // Guest gửi keys của mình lên mạng
        const myKeys = {
          left: held.has(KEYS[1].left) || held.has(KEYS[0].left),
          right: held.has(KEYS[1].right) || held.has(KEYS[0].right),
          jump: held.has(KEYS[1].jump) || held.has(KEYS[0].jump),
          anchor: held.has(KEYS[1].anchor) || held.has(KEYS[0].anchor)
        };
        window.GameNetwork.sendGuestInput(myKeys);
      }
    }

    // anchor (chỉ có tác dụng khi đang đứng trên mặt đất)
    for (const p of ps) {
      let isHoldingAnchor = held.has(KEYS[p.i].anchor);
      if (window.GameNetwork && window.GameNetwork.isOnline && window.GameNetwork.isHost && p.i === 1) {
        isHoldingAnchor = !!(window.GameNetwork.remoteKeys && window.GameNetwork.remoteKeys.anchor);
      }
      p.anchored = p.onGround && isHoldingAnchor;
    }

    // nhảy
    for (const p of ps) {
      if (p.jumpBuffer > 0 && (p.onGround || p.coyote > 0)) {
        const boost = !!p.standingOn;
        p.vy = boost ? -JUMP_BOOST : -JUMP;
        p.onGround = false; p.coyote = 0; p.jumpBuffer = 0;
        p.standingOn = null; p.anchored = false;
        p.squash = -0.3;
        spawnDust(p.x + p.w / 2, p.y + p.h, boost ? 10 : 6, boost ? '#ffc4d8' : '#fff6ec');
        if (boost) {
          spawnHearts(p.x + p.w / 2, p.y + p.h - 10, 5);
          say(p, pick(LINES.boost));
          sfx('boost');
        } else {
          sfx('jump');
        }
      }
    }

    // di chuyển + trọng lực
    for (const p of ps) {
      p.onGround = false;
      p.standingOn = null;
      const k = KEYS[p.i];
      let dir = (held.has(k.right) ? 1 : 0) - (held.has(k.left) ? 1 : 0);
      if (window.GameNetwork && window.GameNetwork.isOnline && window.GameNetwork.isHost && p.i === 1) {
        const rk = window.GameNetwork.remoteKeys || {};
        dir = (rk.right ? 1 : 0) - (rk.left ? 1 : 0);
      }
      if (p.anchored) {
        p.vx = approach(p.vx, 0, 6000 * dt);
      } else if (dir !== 0) {
        p.vx = approach(p.vx, dir * RUN, (p.wasGround ? ACC_GROUND : ACC_AIR) * dt);
        p.face = dir;
      } else if (p.launched > 0) {
        // giữ đà bật bập bênh, không hãm ngang
      } else {
        p.vx = approach(p.vx, 0, (p.wasGround ? FRICTION : AIR_DRAG) * dt);
      }
      p.vy = Math.min(MAX_FALL, p.vy + (p.vy > 0 ? GRAV_DOWN : GRAV_UP) * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    resolvePlayers();
    applyRope();
    for (const p of ps) collide(p);

    // đứng trên đất thì có coyote time cho bước sau
    for (const p of ps) {
      if (p.onGround) p.coyote = COYOTE;
      checkSpikes(p);
    }
    if (G.seesaw) {
      seesawTick(dt);
      for (const p of ps) trySeesaw(p);
    }

    updatePlates(dt);
    updateHeart(dt);
    updateStars(dt);
    updateGoal();

    // Host đồng bộ state xuống Guest qua Firebase (gửi dạng tối ưu)
    if (window.GameNetwork && window.GameNetwork.isOnline && window.GameNetwork.isHost && G.mode === 'playing') {
      G._netSyncT = (G._netSyncT || 0) + dt;
      if (G._netSyncT >= 0.04) { // 25 lần / giây siêu mượt
        G._netSyncT = 0;
        window.GameNetwork.broadcastHostState({
          p1: { x: ps[0].x, y: ps[0].y, vx: ps[0].vx, vy: ps[0].vy, onGround: ps[0].onGround, anchored: ps[0].anchored, face: ps[0].face, walk: ps[0].walk, squash: ps[0].squash },
          p2: { x: ps[1].x, y: ps[1].y, vx: ps[1].vx, vy: ps[1].vy, onGround: ps[1].onGround, anchored: ps[1].anchored, face: ps[1].face, walk: ps[1].walk, squash: ps[1].squash },
          doors: (G.doors || []).map(d => ({ opened: d.opened, openT: d.openT })),
          plates: (G.plates || []).map(pl => ({ on: pl.on, live: pl.live, pressT: pl.pressT })),
          heart: G.heart ? { x: G.heart.x, y: G.heart.y, held: G.heart.held } : null,
          seesaw: G.seesaw ? { tilt: G.seesaw.tilt } : null,
          shake: G.shake
        });
      }
    }
  }

  // va chạm với đất
  function collide(p) {
    if (p.x < 0) { p.x = 0; if (p.vx < 0) p.vx = 0; }
    if (p.x + p.w > W) { p.x = W - p.w; if (p.vx > 0) p.vx = 0; }

    const EPS = 0.01;
    let x1 = Math.floor(p.x / T), x2 = Math.floor((p.x + p.w - EPS) / T);
    let y1 = Math.floor(p.y / T), y2 = Math.floor((p.y + p.h - EPS) / T);

    // trục X
    for (let ty = y1; ty <= y2; ty++) {
      for (let tx = x1; tx <= x2; tx++) {
        if (!isSolid(tx, ty)) continue;
        const ry = ty * T;
        // bỏ qua tile chỉ chạm vào chân (sàn nhà), tránh bị đẩy ngang
        const overlapY = Math.min(p.y + p.h, ry + T) - Math.max(p.y, ry);
        if (overlapY < 6) continue;
        const rx = tx * T;
        if (p.vx > 0) { p.x = rx - p.w; p.vx = 0; }
        else if (p.vx < 0) { p.x = rx + T; p.vx = 0; }
        else {
          const left = p.x + p.w - rx;
          const right = rx + T - p.x;
          if (left < right) p.x = rx - p.w; else p.x = rx + T;
        }
      }
    }

    x1 = Math.floor(p.x / T); x2 = Math.floor((p.x + p.w - EPS) / T);
    y1 = Math.floor(p.y / T); y2 = Math.floor((p.y + p.h - EPS) / T);
    let landedSpeed = 0;
    let onGround = false;

    // trục Y
    for (let tx = x1; tx <= x2; tx++) {
      for (let ty = y1; ty <= y2; ty++) {
        if (!isSolid(tx, ty)) continue;
        const ry = ty * T;
        if (p.vy > 0) {
          if (p.y + p.h > ry) {
            landedSpeed = Math.max(landedSpeed, p.vy);
            p.y = ry - p.h;
            p.vy = 0;
            onGround = true;
          }
        } else if (p.vy < 0) {
          if (p.y < ry + T) { p.y = ry + T; p.vy = 0; }
        } else {
          const top = p.y + p.h - ry;
          const bottom = ry + T - p.y;
          if (top <= bottom) { p.y = ry - p.h; onGround = true; }
          else { p.y = ry + T; }
        }
      }
    }
    if (onGround) {
      p.onGround = true;
      p.landImpact = Math.max(p.landImpact, landedSpeed);
      if (!p.wasGround && landedSpeed > 520) {
        spawnDust(p.x + p.w / 2, p.y + p.h, 6, '#fff5ea');
        p.squash = Math.min(0.42, landedSpeed / 2200);
        sfx('land');
      }
    }

    // cổng năng lượng
    for (const d of G.doors) {
      if (d.opened) continue;
      if (!aabb(p, d)) continue;
      const ox1 = (p.x + p.w) - d.x, ox2 = (d.x + d.w) - p.x;
      const oy1 = (p.y + p.h) - d.y, oy2 = (d.y + d.h) - p.y;
      const ox = Math.min(ox1, ox2), oy = Math.min(oy1, oy2);
      if (ox < oy) {
        if (ox1 < ox2) p.x = d.x - p.w; else p.x = d.x + d.w;
        p.vx = 0;
      } else {
        if (oy1 < oy2) { p.y = d.y - p.h; p.vy = 0; p.onGround = true; }
        else { p.y = d.y + d.h; p.vy = Math.max(0, p.vy); }
      }
    }
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function resolvePlayers() {
    const [a, b] = G.players;
    if (!a || !b) return;
    const dx = Math.abs((a.x + a.w / 2) - (b.x + b.w / 2));
    const nearHead = dx < (a.w + b.w) / 2 + 12;
    const aOnB = nearHead && a.vy >= 0 && a.prevBottom <= b.y + 14 && a.prevBottom >= b.y - 40 && a.y + a.h >= b.y - 4;
    const bOnA = nearHead && b.vy >= 0 && b.prevBottom <= a.y + 14 && b.prevBottom >= a.y - 40 && b.y + b.h >= a.y - 4;
    if (aOnB && !bOnA) { landOn(a, b); return; }
    if (bOnA && !aOnB) { landOn(b, a); return; }
    if (!aabb(a, b)) return;
    // đẩy nhau sang ngang
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (ox <= 0) return;
    const dir = (a.x + a.w / 2 < b.x + b.w / 2) ? -1 : 1;
    const aw = a.anchored ? 0 : 1;
    const bw = b.anchored ? 0 : 1;
    const sum = aw + bw || 1;
    a.x += dir * ox * (aw / sum) * 1.01;
    b.x -= dir * ox * (bw / sum) * 1.01;
  }
  function landOn(top, bottom) {
    top.y = bottom.y - top.h;
    top.vy = 0;
    top.onGround = true;
    top.standingOn = bottom;
    const targetX = bottom.x + (bottom.w - top.w) / 2;
    if (Math.abs(top.x - targetX) > 6) top.x += (targetX - top.x) * 0.35;
    bottom.squash = Math.min(0.25, bottom.squash + 0.12);
  }

  function applyRope() {
    const [a, b] = G.players;
    if (!a || !b) return;
    const ax = a.x + a.w / 2, ay = a.y + a.h * 0.52;
    const bx = b.x + b.w / 2, by = b.y + b.h * 0.52;
    const dx = bx - ax, dy = by - ay;
    const d = Math.hypot(dx, dy);
    if (d < 0.0001) return;
    G.ropeDist = d;
    const maxLen = G.ropeMax || 300;
    if (d > maxLen) {
      const nx = dx / d, ny = dy / d;
      const over = d - maxLen;
      const aw = a.anchored ? 0 : 1;
      const bw = b.anchored ? 0 : 1;
      const sum = aw + bw;
      if (sum > 0) {
        a.x += nx * over * (aw / sum);
        a.y += ny * over * (aw / sum);
        b.x -= nx * over * (bw / sum);
        b.y -= ny * over * (bw / sum);
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel > 0) {
          a.vx += nx * rel * (aw / sum);
          a.vy += ny * rel * (aw / sum);
          b.vx -= nx * rel * (bw / sum);
          b.vy -= ny * rel * (bw / sum);
        }
      }
      if (over > 9 && G.tautCd <= 0) {
        G.tautCd = 2.4;
        G.levelTauts++;
        G.totalTauts++;
        if (Math.random() < 0.55) say(Math.random() < 0.5 ? a : b, pick(LINES.taut));
      }
    }
  }

  function seesawTick(dt) {
    const s = G.seesaw;
    s.cd = Math.max(0, s.cd - dt);
    s.tilt += (0 - s.tilt) * Math.min(1, dt * 5.5);
    s.pulse = Math.max(0, s.pulse - dt * 1.6);
  }

  function trySeesaw(launcher) {
    const s = G.seesaw;
    if (!s || s.cd > 0 || G.dead) return;
    if (!launcher.onGround || launcher.landImpact < 380) return;
    const cx = launcher.x + launcher.w / 2;
    if (cx < s.x || cx > s.x + s.w) return;
    const half = s.x + s.w / 2;
    const side = cx < half ? -1 : 1;
    const mate = G.players[1 - launcher.i];
    if (!mate || !mate.onGround) return;
    const mx = mate.x + mate.w / 2;
    if (side === -1) {
      if (!(mx > half && mx < s.x + s.w)) return;
    } else if (!(mx > s.x && mx < half)) return;

    const dir = side === -1 ? 1 : -1;
    mate.vy = -1100;
    mate.vx = dir * 200;
    mate.onGround = false;
    mate.coyote = 0;
    mate.standingOn = null;
    mate.anchored = false;
    mate.squash = -0.4;
    mate.launched = 0.95;
    s.tilt = side === -1 ? -0.12 : 0.12;
    s.pulse = 1;
    s.cd = 0.9;
    G.shake = Math.max(G.shake, 9);
    sfx('boing');
    burst(mate.x + mate.w / 2, mate.y + mate.h - 4, 16, '#ffe6a8', 1.1);
    spawnHearts(mate.x + mate.w / 2, mate.y + 8, 5);
    say(mate, pick(LINES.launch));
    say(launcher, pick(LINES.seesaw));
  }

  function checkSpikes(p) {
    const bx1 = p.x + 7, bx2 = p.x + p.w - 7;
    const by1 = p.y + 8, by2 = p.y + p.h - 2;
    const tx1 = Math.floor(bx1 / T), tx2 = Math.floor(bx2 / T);
    const ty1 = Math.floor(by1 / T), ty2 = Math.floor(by2 / T);
    for (let ty = ty1; ty <= ty2; ty++) {
      for (let tx = tx1; tx <= tx2; tx++) {
        if (!isSpike(tx, ty)) continue;
        const sx = tx * T + 10, sw = T - 20;
        const sy = ty * T + 34, sh = T - 34;
        if (bx2 > sx && bx1 < sx + sw && by2 > sy && by1 < sy + sh) { die(); return; }
      }
    }
    if (p.y > H + 120) die();
  }

  function die() {
    if (G.mode !== 'playing' || G.dead || G.respawnT > 0) return;
    G.dead = true;
    G.respawnT = 0.55;
    G.levelFalls++;
    G.totalFalls++;
    G.shake = 15;
    G.flash = 1;
    for (const p of G.players) {
      p.vx = 0; p.vy = 0;
      burst(p.x + p.w / 2, p.y + p.h / 2, 12, '#ff9dbb', 1);
      spawnHearts(p.x + p.w / 2, p.y + p.h / 2 - 10, 3);
    }
    say(pick(G.players), pick(LINES.death));
    sfx('die');
  }
  function resetPlayers() {
    G.dead = false;
    for (const p of G.players) {
      p.x = p.spawn.x - p.w / 2;
      p.y = p.spawn.y - p.h;
      p.vx = 0; p.vy = 0;
      p.onGround = true; p.coyote = COYOTE; p.jumpBuffer = 0;
      p.standingOn = null; p.anchored = false; p.bubble = null;
      p.squash = 0.2;
    }
    G.respawnT = 0;
    G.tautCd = 0;
    if (G.heart) { G.heart.x = G.heart.homeX; G.heart.y = G.heart.homeY; G.heart.held = false; }
  }

  // ------------------------------------------------------------------- plates / doors / heart / goal
  function updatePlates(dt) {
    const ps = G.players;
    for (const pl of G.plates) {
      let live = false;
      for (const p of ps) {
        if (pl.kind === 'button') {
          if (aabb(p, pl)) live = true;
        } else {
          const cx = p.x + p.w / 2;
          if (p.onGround && cx > pl.x + 6 && cx < pl.x + pl.w - 6 && Math.abs((p.y + p.h) - pl.y) < 14) live = true;
        }
      }
      pl.wasLive = pl.live;
      pl.live = live;
      if (live && !pl.wasLive) {
        sfx('plate');
        burst(pl.x + (pl.w || 52) / 2, pl.kind === 'button' ? pl.y + 26 : pl.y - 8, 9, '#ffe39a', 0.8);
        if (pl.kind === 'button') say(pick(ps), pick(LINES.plate));
      }
      if (pl.latchOn && live) pl.on = true;
      pl.pressT = approach(pl.pressT || 0, live ? 1 : 0, dt * 9);
    }
    for (const d of G.doors) {
      if (d.opened) { d.openT = Math.min(1, d.openT + dt * 1.6); continue; }
      const ok = d.needs.every((id) => {
        const pl = G.plates.find((q) => q.id === id);
        return pl && (pl.latchOn ? pl.on : pl.live);
      });
      if (ok) {
        d.opened = true;
        d.openT = 0;
        G.shake = Math.max(G.shake, 5);
        sfx('door');
        burst(d.x + d.w / 2, d.y + d.h - 60, 22, '#ffe6a8', 1.2);
        spawnHearts(d.x + d.w / 2, d.y + 150, 8);
        say(pick(ps), pick(LINES.door));
      }
    }
  }

  function updateStars(dt) {
    for (const s of G.stars) {
      if (s.got) continue;
      s.phase += dt;
      for (const p of G.players) {
        if (dist(s.x, s.y, p.x + p.w / 2, p.y + p.h / 2) < 38) { collectStar(s); break; }
      }
    }
  }
  function collectStar(s) {
    s.got = true;
    G.levelStars++;
    G.totalStars++;
    sfx('star');
    burst(s.x, s.y, 10, '#ffe08a', 0.75);
    spawnHearts(s.x, s.y, 2);
    if (dom.starCount) dom.starCount.textContent = `${G.levelStars}/${G.stars.length}`;
    if (dom.starPill) {
      dom.starPill.classList.remove('pop');
      void dom.starPill.offsetWidth;
      dom.starPill.classList.add('pop');
    }
    if (Math.random() < 0.35) say(pick(G.players), pick(LINES.star));
  }

  function updateHeart(dt) {
    const h = G.heart;
    if (!h) return;
    const [a, b] = G.players;
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const d1 = dist(h.x, h.y, ac.x, ac.y);
    const d2 = dist(h.x, h.y, bc.x, bc.y);
    const near = d1 < 195 && d2 < 195;
    if (near && !h.held) {
      sfx('heart');
      spawnHearts(h.x, h.y, 7);
      say(pick([a, b]), pick(LINES.heart));
    }
    h.held = near;
    const tx = near ? (ac.x + bc.x) / 2 : h.homeX;
    const ty = near ? Math.min(a.y, b.y) - 64 : h.homeY;
    const k = near ? 9 : 2.4;
    h.x += (tx - h.x) * Math.min(1, dt * k);
    h.y += (ty - h.y) * Math.min(1, dt * k);
    h.x = clamp(h.x, 44, W - 44);
    h.y = clamp(h.y, 60, H - 48);
  }

  function updateGoal() {
    const g = G.goal;
    if (!g) return;
    const ps = G.players;
    const inGoal = (p) => {
      const cx = p.x + p.w / 2;
      return cx > g.x + 12 && cx < g.x + g.w - 12 && p.y + p.h > g.y - 170;
    };
    const both = ps.every(inGoal);
    G.inGoal = both;
    if (!both) return;
    if (G.heart) {
      const gx = g.x + g.w / 2, gy = g.y - 100;
      if (dist(G.heart.x, G.heart.y, gx, gy) > 130) return;
    }
    completeLevel();
  }

  // ------------------------------------------------------------------- level flow
  function completeLevel() {
    if (G.mode !== 'playing') return;
    G.mode = 'clear';
    held.clear();
    dom.banner.classList.remove('show');
    for (const p of G.players) p.bubble = null;
    G.totalTime += G.levelTime;
    G.stats[G.levelIndex] = { time: G.levelTime, falls: G.levelFalls, tauts: G.levelTauts };
    sfx('clear');
    for (let i = 0; i < 5; i++) burst(rnd(200, W - 200), rnd(160, 420), 14, pick(['#ff8fb1', '#ffd66e', '#9fd8f5', '#c9b6ff']), 1.3);
    confettiBurst(80);
    const L = G.level;
    dom.clearKicker.textContent = `MÀN ${G.levelIndex + 1} XONG`;
    dom.clearTitle.textContent = pick(['Qua rồi!', 'Dính nhau ghê!', 'Hai đứa giỏi quá!', 'Xong màn rồi!']);
    dom.clearLine.textContent = pick([
      'Sợi dây vẫn còn nguyên. Tốt.',
      'Cãi nhau chưa? Chưa là được rồi.',
      'Hai đứa phối hợp cũng ra gì đấy.',
      'Tim vẫn đập, dây vẫn căng.',
    ]);
    dom.clearStats.innerHTML = `
      <div class="stat"><div class="v">${fmtTime(G.levelTime)}</div><div class="k">THỜI GIAN</div></div>
      <div class="stat"><div class="v">${G.levelFalls}</div><div class="k">LẦN NGÃ</div></div>
      <div class="stat"><div class="v">${G.levelTauts}</div><div class="k">DÂY CĂNG</div></div>
      <div class="stat"><div class="v">★ ${G.levelStars}/${G.stars.length}</div><div class="k">NGÔI SAO</div></div>`;
    dom.btnNext.textContent = G.levelIndex + 1 >= LEVELS.length ? 'Về đích thôi' : 'Màn tiếp theo';
    dom.screenClear.classList.remove('hidden');
    G.uiReady = false;
    setTimeout(() => { G.uiReady = true; dom.btnNext.focus({ preventScroll: true }); }, 420);
  }

  function nextLevel() {
    if (!G.uiReady) return;
    dom.screenClear.classList.add('hidden');
    if (G.levelIndex + 1 >= LEVELS.length) { showEnding(); return; }
    buildLevel(G.levelIndex + 1);
  }

  function showEnding() {
    G.mode = 'ending';
    held.clear();
    dom.banner.classList.remove('show');
    for (const p of G.players) p.bubble = null;
    dom.screenClear.classList.add('hidden');
    dom.screenPause.classList.add('hidden');
    dom.hud.classList.add('hidden');
    const f = G.totalFalls, t = G.totalTauts;
    const totalPossible = LEVELS.reduce((n, l) => n + (l.stars ? l.stars.length : 0), 0);
    const perfect = G.totalStars >= totalPossible;
    let rank = 'Cặp đôi vô tri chính hiệu';
    if (perfect) rank = f <= 2 ? 'Cặp đôi hoàn hảo (thật luôn)' : 'Cặp đôi sưu tầm sao';
    else if (f === 0) rank = 'Cặp đôi hoàn hảo (hơi đáng ngờ)';
    else if (f <= 3) rank = 'Cặp đôi cứng cáp';
    else if (f <= 8) rank = 'Cặp đôi kiên nhẫn';
    else rank = 'Cặp đôi cần ôm nhau nhiều hơn';
    if (!perfect && t > 14) rank = 'Nhà vô địch kéo co';
    dom.endTitle.textContent = `${G.names[0]} & ${G.names[1]} về tới nhà!`;
    dom.endLine.textContent = perfect
      ? 'Nhặt đủ sao, qua đủ màn. Hai đứa giỏi nhất quả đất.'
      : pick([
        'Giờ thì ôm nhau một cái đi. Nhớ giữ dây.',
        'Hết game rồi. Nhưng dây thì không được tháo ra đâu.',
        'Trái tim đã về đích. Người yêu cũng nên về bên nhau.',
      ]);
    dom.endStats.innerHTML = `
      <div class="stat"><div class="v">${fmtTime(G.totalTime)}</div><div class="k">TỔNG THỜI GIAN</div></div>
      <div class="stat"><div class="v">${f}</div><div class="k">LẦN NGÃ</div></div>
      <div class="stat"><div class="v">${t}</div><div class="k">LẦN DÂY CĂNG</div></div>
      <div class="stat"><div class="v">★ ${G.totalStars}/${totalPossible}</div><div class="k">NGÔI SAO</div></div>`;
    dom.endRank.textContent = rank;
    dom.screenEnd.classList.remove('hidden');
    sfx('win');
    G.uiReady = false;
    setTimeout(() => { G.uiReady = true; dom.btnReplay.focus({ preventScroll: true }); }, 500);
    confettiBurst(160);
  }

  function replay() {
    if (!G.uiReady) return;
    G.totalTime = 0; G.totalFalls = 0; G.totalTauts = 0; G.totalStars = 0; G.stats = [];
    dom.screenEnd.classList.add('hidden');
    buildLevel(0);
  }

  // ------------------------------------------------------------------- dialogue
  const LINES = {
    taut: ['Từ từ thôi!', 'Căng quá rồi!', 'Kéo nhẹ thôi!', 'Đợi em với!', 'Dây sắp đứt rồi!'],
    boost: ['Cõng em nha!', 'Lên đi!', 'Nặng ghê!', 'Bám chắc nha!'],
    death: ['Úi!', 'Đau quá!', 'Chết chung rồi!', 'Em không sao!'],
    plate: ['Bấm rồi nè!', 'Nút này!', 'Cùng lúc nha!'],
    door: ['Cửa mở rồi kìa!', 'Đi thôi!', 'Qua được rồi!'],
    heart: ['Bế em đi!', 'Nhẹ tênh!', 'Đừng bỏ em lại!'],
    goal: ['Về rồi!', 'Tới nhà rồi!', 'Dính nhau ghê!'],
    star: ['Ngôi sao!', 'Nhặt được rồi!', 'Của em!', 'Nhanh ghê!'],
    launch: ['Bay lên!', 'Wheee!', 'Lên nào!', 'Cao quá!'],
    seesaw: ['Nặng ghê!', 'Bật lên!', 'Một, hai, ba...!'],
  };
  function say(p, text) {
    if (!p || !text) return;
    if (p.bubble && p.bubble.t > 1.1) return;
    p.bubble = { text, t: 2.8, max: 2.8 };
  }

  // ------------------------------------------------------------------- particles
  function addParticle(o) {
    if (G.particles.length > 420) G.particles.shift();
    G.particles.push({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 1, max: 1, size: 4, color: '#fff', type: 'dot', rot: 0, vr: 0, ...o });
  }
  function spawnDust(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      addParticle({
        x: x + rnd(-12, 12), y: y - rnd(0, 4),
        vx: rnd(-90, 90), vy: rnd(-120, -20), g: 260,
        life: rnd(0.35, 0.7), max: 0.7, size: rnd(2.5, 6), color, type: 'dot',
      });
    }
  }
  function spawnHearts(x, y, n) {
    for (let i = 0; i < n; i++) {
      addParticle({
        x: x + rnd(-14, 14), y: y + rnd(-10, 6),
        vx: rnd(-55, 55), vy: rnd(-120, -45), g: -30,
        life: rnd(0.7, 1.3), max: 1.3, size: rnd(7, 14), color: pick(['#ff7fa6', '#ff9fbe', '#ffc6d8']),
        type: 'heart', rot: rnd(-0.3, 0.3), vr: rnd(-1, 1),
      });
    }
  }
  function burst(x, y, n, color, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(60, 330) * power;
      addParticle({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 520,
        life: rnd(0.45, 1.0), max: 1, size: rnd(2.5, 6), color, type: 'dot',
      });
    }
  }
  function confettiBurst(n) {
    for (let i = 0; i < n; i++) {
      addParticle({
        x: rnd(0, W), y: rnd(-120, 80),
        vx: rnd(-90, 90), vy: rnd(60, 240), g: 70,
        life: rnd(2.2, 4.2), max: 4.2, size: rnd(5, 10),
        color: pick(['#ff7fa6', '#ffd66e', '#8fd8f8', '#c4b1ff', '#a8e6b8', '#ffffff']),
        type: 'confetti', rot: rnd(0, 6.28), vr: rnd(-7, 7),
      });
    }
  }
  function updateFx(dt) {
    G.animT += dt;
    G.shake = Math.max(0, G.shake - dt * 55);
    G.flash = Math.max(0, G.flash - dt * 3);
    G.fade = Math.max(0, G.fade - dt * 3.2);
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const q = G.particles[i];
      q.life -= dt;
      if (q.life <= 0) { G.particles.splice(i, 1); continue; }
      q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      if (q.type === 'confetti' && q.y > H + 40) q.life = Math.min(q.life, 0);
    }
    if ((G.mode === 'clear' || G.mode === 'ending') && Math.random() < dt * 5) {
      addParticle({
        x: rnd(0, W), y: -20, vx: rnd(-40, 40), vy: rnd(60, 140), g: 20,
        life: rnd(3, 4.5), max: 4.5, size: rnd(5, 9),
        color: pick(['#ff7fa6', '#ffd66e', '#8fd8f8', '#c4b1ff', '#ffffff']),
        type: 'confetti', rot: rnd(0, 6.28), vr: rnd(-6, 6),
      });
    }
    // mây trôi
    for (const c of G.clouds) {
      c.x += c.v * dt;
      if (c.x > W + 220) c.x = -240;
    }
    // menu
    if (G.mode === 'menu') {
      G.menuHeartT = (G.menuHeartT || 0) + dt;
      if (G.menuHeartT > 1.4) {
        G.menuHeartT = 0;
        const m = G.menuPlayers;
        if (m.length === 2) {
          spawnHearts((m[0].x + m[1].x) / 2 + rnd(-60, 60), 560 + rnd(-40, 40), 1);
        }
      }
    }
  }

  // ------------------------------------------------------------------- HUD
  function updateHUD() {
    if (!G.level) return;
    const num = String(G.levelIndex + 1);
    if (dom.levelNum.textContent !== num) dom.levelNum.textContent = num;
    const t = fmtTime(G.levelTime);
    if (t !== G.lastTimer) { G.lastTimer = t; dom.timer.textContent = t; }
    const sc = `${G.levelStars}/${G.stars.length}`;
    if (dom.starCount && dom.starCount.textContent !== sc) dom.starCount.textContent = sc;
  }

  // ------------------------------------------------------------------- render: background
  function drawSky(t, th, menu = false) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (th.star) {
      for (const s of G.skyStars) {
        const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
        ctx.globalAlpha = tw * 0.9;
        ctx.fillStyle = '#fff8dd';
        ellipse(s.x, s.y, s.r, s.r);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // trăng
      const mx = 1035, my = 128;
      const mg = ctx.createRadialGradient(mx, my, 8, mx, my, 110);
      mg.addColorStop(0, 'rgba(255,246,210,.55)');
      mg.addColorStop(1, 'rgba(255,246,210,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(mx - 120, my - 120, 240, 240);
      ctx.fillStyle = '#fff5d2';
      ellipse(mx, my, 52, 52); ctx.fill();
      ctx.fillStyle = 'rgba(210,195,150,.35)';
      ellipse(mx - 16, my - 12, 9, 8); ctx.fill();
      ellipse(mx + 14, my + 12, 6, 6); ctx.fill();
    } else {
      const sx = 1030, sy = 126;
      const sg = ctx.createRadialGradient(sx, sy, 20, sx, sy, 150);
      sg.addColorStop(0, th.sunGlow);
      sg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 160, sy - 160, 320, 320);
      ctx.fillStyle = th.sun;
      ellipse(sx, sy, 64, 64); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ellipse(sx - 16, sy - 18, 22, 16); ctx.fill();
    }

    // mây
    for (const c of G.clouds) {
      drawCloud(c.x, c.y, c.s, th, c.a * (menu ? 1 : 1));
    }

    // núi
    drawHill(548, 26, th.hillFar, 0.9, 0.004, 0.2);
    drawHill(578, 32, th.hillMid, 1, 0.005, 2.1);
    drawHill(612, 26, th.hillNear, 1, 0.006, 4.2);

    // chim
    if (th.bird) {
      ctx.strokeStyle = 'rgba(90,70,90,.28)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const bx = ((t * (14 + i * 5) + i * 320) % (W + 200)) - 100;
        const by = 170 + i * 42 + Math.sin(t * 1.3 + i) * 5;
        const s = 7 + i * 2;
        ctx.beginPath();
        ctx.moveTo(bx - s, by);
        ctx.quadraticCurveTo(bx - s / 2, by - s * 0.7, bx, by);
        ctx.quadraticCurveTo(bx + s / 2, by - s * 0.7, bx + s, by);
        ctx.stroke();
      }
    }
  }
  function drawCloud(x, y, s, th, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha * (th.cloudAlpha || 0.8);
    ctx.fillStyle = th.cloud;
    const parts = [[0, 0, 42], [38, -14, 34], [78, 2, 38], [30, 16, 30], [-28, 10, 26]];
    for (const [dx, dy, r] of parts) {
      ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.72);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawHill(baseY, amp, color, alpha, freq, phase) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) {
      const y = baseY + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 2) * amp * 0.25;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------- render: world
  function drawWorld(t) {
    drawSky(t, G.theme, false);
    drawProps(t);
    if (G.level) drawLevelTiles(t);
    drawDecorBack(t);
    drawStars(t);

    if (G.goal) drawGoal(t);
    if (G.doors) for (const d of G.doors) drawDoor(d, t);
    if (G.plates) for (const p of G.plates) drawPlate(p, t);
    if (G.seesaw) drawSeesaw(t);
    if (G.level && G.level.sign) drawSign(G.level.sign, t);

    if (G.heart && !G.heart.held) drawHeartItem(G.heart, t);
    drawRope(t);
    drawParticles('back');
    for (const p of G.players) drawPlayer(p, t);
    if (G.heart && G.heart.held) drawHeartItem(G.heart, t);
    drawParticles('front');
    for (const p of G.players) drawBubble(p, t);

    if (G.theme.star) {
      // đom đóm
      for (let i = 0; i < 10; i++) {
        const x = (i * 197 + Math.sin(t * 0.4 + i) * 40) % W;
        const y = 380 + Math.sin(t * 0.8 + i * 2) * 50 + (i % 3) * 40;
        ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + i));
        ctx.fillStyle = '#fff3b0';
        ellipse(x, y, 2.2, 2.2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawVignette();
  }

  function drawLevelTiles(t) {
    const th = G.theme;
    const L = G.level;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = tileAt(L, x, y);
        if (c === '#') drawDirtTile(x, y, th);
        else if (c === '^') drawSpikes(x, y, t);
      }
    }
    // viền trên của đất + cỏ
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (tileAt(L, x, y) !== '#') continue;
        if (tileAt(L, x, y - 1) === '#') continue;
        const px = x * T, py = y * T;
        ctx.fillStyle = th.grass;
        ctx.fillRect(px, py, T, 15);
        ctx.fillStyle = th.grassDark;
        ctx.fillRect(px, py + 15, T, 2);
        if (tileAt(L, x - 1, y) !== '#') {
          ctx.fillStyle = 'rgba(0,0,0,.06)';
          ctx.fillRect(px, py, 4, T);
        }
        if (tileAt(L, x + 1, y) !== '#') {
          ctx.fillStyle = 'rgba(0,0,0,.06)';
          ctx.fillRect(px + T - 4, py, 4, T);
        }
      }
    }
  }
  function drawDirtTile(x, y, th) {
    const px = x * T, py = y * T;
    ctx.fillStyle = th.dirt;
    ctx.fillRect(px, py, T, T);
    ctx.fillStyle = th.dirtDark;
    // đá lấm tấm, xác định theo vị trí
    const h = (x * 73856093) ^ (y * 19349663);
    for (let i = 0; i < 3; i++) {
      const a = Math.abs(Math.sin(h + i * 12.9898)) * 0.5 + 0.5;
      const b = Math.abs(Math.sin(h * 1.7 + i * 4.1)) * 0.5 + 0.5;
      ctx.globalAlpha = 0.35;
      ellipse(px + 8 + a * (T - 16), py + 22 + b * (T - 30), 2.5, 1.8);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawSpikes(x, y, t) {
    const px = x * T, py = y * T;
    ctx.fillStyle = 'rgba(70,40,60,.18)';
    ctx.fillRect(px + 6, py + T - 8, T - 12, 8);
    ctx.fillStyle = 'rgba(255,95,140,.16)';
    ellipse(px + T / 2, py + T - 6, T * 0.42, 5);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const sx = px + 8 + i * 17;
      const base = py + T - 4;
      ctx.beginPath();
      ctx.moveTo(sx, base);
      ctx.lineTo(sx + 7, py + 22);
      ctx.lineTo(sx + 14, base);
      ctx.closePath();
      const g = ctx.createLinearGradient(sx, py + 22, sx, base);
      g.addColorStop(0, '#fff6ff');
      g.addColorStop(0.55, '#d4cdf0');
      g.addColorStop(1, '#8d86b8');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,45,80,.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(px + 6, py + T - 6, T - 12, 2);
  }
  function drawDecorBack(t) {
    const th = G.theme;
    // hoa
    for (const f of G.decor.flowers) {
      const sway = Math.sin(t * 1.4 + f.x * 0.02) * 2;
      ctx.strokeStyle = 'rgba(70,120,80,.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.quadraticCurveTo(f.x + sway, f.y - 12, f.x + sway * 1.5, f.y - 22);
      ctx.stroke();
      ctx.fillStyle = f.c;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ellipse(f.x + sway * 1.5 + Math.cos(a) * 4.5 * f.s, f.y - 24 + Math.sin(a) * 4.5 * f.s, 3.3 * f.s, 3.3 * f.s);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd66e';
      ellipse(f.x + sway * 1.5, f.y - 24, 2.2 * f.s, 2.2 * f.s);
      ctx.fill();
    }
    // cỏ
    ctx.strokeStyle = th.grassDark;
    ctx.lineWidth = 2;
    for (const tuft of G.decor.tufts) {
      const sway = Math.sin(t * 1.6 + tuft.x * 0.03) * 2 * tuft.s;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(tuft.x, tuft.y);
      ctx.quadraticCurveTo(tuft.x + tuft.lean * 4, tuft.y - 7 * tuft.s, tuft.x + tuft.lean * 7 + sway, tuft.y - 12 * tuft.s);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // cây cối, bụi, cờ, nhà ở hậu cảnh
  function drawProps(t) {
    if (!G.theme) return;
    for (const tr of G.trees) drawTree(tr, t);
    drawBush(252, 642, 0.9, t);
    drawBush(806, 642, 0.7, t);
    drawBalloon(186, 286, 1.05, '#ff9fbe', t);
    drawBalloon(596, 232, 0.78, '#8fd8f8', t);
    drawBalloon(706, 246, 0.72, '#ffd66e', t);
    if (G.goal) {
      drawBunting(G.goal, t);
      if (G.levelIndex === LEVELS.length - 1) drawHouse(G.goal, t);
    }
  }
  function drawBalloon(x, y, s, color, t) {
    const bob = Math.sin(t * 1.1 + x * 0.01) * 7;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.strokeStyle = 'rgba(90,60,80,.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 19 * s);
    ctx.quadraticCurveTo(9 * s, 40 * s, 1 * s, 62 * s);
    ctx.stroke();
    ctx.fillStyle = color;
    ellipse(0, 0, 17 * s, 21 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    ellipse(-5 * s, -7 * s, 4 * s, 6.5 * s); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-3 * s, 19 * s);
    ctx.lineTo(3 * s, 19 * s);
    ctx.lineTo(0, 24 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawTree(tr, t) {
    const th = G.theme, s = tr.s, x = tr.x, base = tr.base;
    const sway = Math.sin(t * 0.9 + tr.sway) * 3 * s;
    ctx.save();
    ctx.fillStyle = th.trunk;
    rr(x - 7 * s + sway * 0.25, base - 112 * s, 14 * s, 114 * s, 6 * s); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    rr(x + 1 * s + sway * 0.25, base - 112 * s, 6 * s, 114 * s, 4 * s); ctx.fill();
    ctx.fillStyle = th.treeDark;
    ellipse(x - 26 * s + sway, base - 120 * s, 33 * s, 29 * s); ctx.fill();
    ellipse(x + 26 * s + sway, base - 124 * s, 31 * s, 27 * s); ctx.fill();
    ctx.fillStyle = th.tree;
    ellipse(x + sway, base - 150 * s, 42 * s, 36 * s); ctx.fill();
    ellipse(x - 15 * s + sway, base - 133 * s, 27 * s, 23 * s); ctx.fill();
    ellipse(x + 18 * s + sway, base - 138 * s, 24 * s, 21 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ellipse(x - 12 * s + sway, base - 166 * s, 16 * s, 9 * s); ctx.fill();
    ctx.restore();
  }
  function drawBush(x, y, s, t) {
    const th = G.theme;
    ctx.save();
    ctx.fillStyle = th.treeDark;
    ellipse(x - 20 * s, y - 14 * s, 24 * s, 17 * s); ctx.fill();
    ellipse(x + 20 * s, y - 12 * s, 22 * s, 15 * s); ctx.fill();
    ctx.fillStyle = th.tree;
    ellipse(x, y - 24 * s, 28 * s, 20 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ellipse(x - 8 * s, y - 32 * s, 10 * s, 5 * s); ctx.fill();
    ctx.restore();
  }
  function drawBunting(g, t) {
    const x0 = g.x - 145, x1 = g.x + g.w + 20, y0 = 208;
    const sag = 34;
    const flagColors = ['#ff8fae', '#ffd66e', '#8fd8f8', '#c9b6ff', '#a8e6b8'];
    ctx.save();
    ctx.strokeStyle = 'rgba(90,60,80,.38)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, y0 + sag * 2, x1, y0);
    ctx.stroke();
    const n = 13;
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const px = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * ((x0 + x1) / 2) + u * u * x1;
      const py = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * (y0 + sag * 2) + u * u * y0;
      ctx.fillStyle = flagColors[i % flagColors.length];
      ctx.beginPath();
      ctx.moveTo(px - 8, py);
      ctx.lineTo(px + 8, py);
      ctx.lineTo(px, py + 16 + Math.sin(t * 2 + i) * 1.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  function drawHouse(g, t) {
    const cx = g.x + g.w / 2, base = g.y;
    const w = 190, h = 148;
    ctx.save();
    // tường
    ctx.fillStyle = '#e7cdc1';
    rr(cx - w / 2, base - h, w, h, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    rr(cx - w / 2 + 10, base - h + 12, 60, h - 20, 6); ctx.fill();
    // mái
    ctx.fillStyle = '#a85473';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 18, base - h + 10);
    ctx.lineTo(cx, base - h - 62);
    ctx.lineTo(cx + w / 2 + 18, base - h + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 18, base - h + 10);
    ctx.lineTo(cx, base - h - 62);
    ctx.lineTo(cx - 8, base - h - 2);
    ctx.closePath();
    ctx.fill();
    // ống khói
    ctx.fillStyle = '#8e5a62';
    ctx.fillRect(cx + 54, base - h - 64, 24, 38);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(cx + 58, base - h - 64, 6, 38);
    // cửa sổ ấm
    for (const side of [-1, 1]) {
      const wx = cx + side * 66, wy = base - 88;
      const glow = ctx.createRadialGradient(wx, wy, 2, wx, wy, 40);
      glow.addColorStop(0, 'rgba(255,214,120,.55)');
      glow.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(wx - 40, wy - 40, 80, 80);
      ctx.fillStyle = '#ffe6a4';
      rr(wx - 17, wy - 16, 34, 32, 6); ctx.fill();
      ctx.strokeStyle = '#a85473'; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = 'rgba(168,84,115,.6)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx, wy - 16); ctx.lineTo(wx, wy + 16);
      ctx.moveTo(wx - 17, wy); ctx.lineTo(wx + 17, wy);
      ctx.stroke();
    }
    // khói
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#f4e9f2';
    for (let i = 0; i < 3; i++) {
      const yy = base - h - 74 - i * 16 + Math.sin(t * 1.4 + i) * 3;
      ellipse(cx + 66 + Math.sin(t + i * 2) * 8, yy, 9 + i * 4, 7 + i * 3); ctx.fill();
    }
    ctx.restore();
  }

  // ngôi sao nhặt được
  function drawStars(t) {
    for (const s of G.stars) {
      if (s.got) continue;
      const bob = Math.sin(t * 2.2 + s.phase) * 5;
      const x = s.x, y = s.y + bob;
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 34);
      glow.addColorStop(0, 'rgba(255,225,140,.55)');
      glow.addColorStop(1, 'rgba(255,225,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 36, y - 36, 72, 72);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 1.6 + s.phase) * 0.16);
      starPath(0, 0, 14, 5, 0.46);
      const sg = ctx.createLinearGradient(0, -14, 0, 14);
      sg.addColorStop(0, '#fff2b0');
      sg.addColorStop(1, '#ffc23e');
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = '#fff8dd'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ellipse(-4, -5, 2.6, 2); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 3 + s.phase);
      ctx.fillStyle = '#fff7cf';
      ellipse(x + 20, y - 16, 2, 2); ctx.fill();
      ellipse(x - 19, y + 12, 1.6, 1.6); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // sign
  function drawSign(sign, t) {
    const x = sign.x, y = sign.y;
    const near = G.levelTime > 2.6 && G.players.some((p) => Math.abs(p.x + p.w / 2 - x) < 82);
    ctx.save();
    // cọc
    ctx.fillStyle = '#b9855f';
    ctx.fillRect(x - 4, y - 52, 8, 52);
    ctx.fillStyle = '#a06f4f';
    ctx.fillRect(x - 4, y - 52, 3, 52);
    // biển
    ctx.translate(x, y - 56);
    ctx.rotate(-0.04);
    ctx.fillStyle = '#e8b98a';
    rr(-38, -24, 76, 38, 8); ctx.fill();
    ctx.strokeStyle = '#b9855f'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#7a5238';
    ctx.font = `800 14px ${BODY}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    heartPath(0, -10, 9); ctx.fillStyle = '#ff7f9e'; ctx.fill();
    ctx.fillStyle = '#7a5238';
    ctx.font = `900 11px ${BODY}`;
    ctx.fillText(near ? 'đọc đi' : '!', 0, 4);
    ctx.restore();
    if (near) {
      drawBubbleText(sign.text, x, y - 96, 230, '#fff7ec', '#b9855f');
    }
  }

  // door
  function drawDoor(d, t) {
    const k = d.opened ? d.openT : 0;
    const fieldA = 1 - k;
    const px = d.x, py = d.y, w = d.w, h = d.h;
    const cx = px + w / 2;

    // bóng
    ctx.fillStyle = 'rgba(60,35,70,.10)';
    ellipse(cx, py + h + 2, w * 0.6, 9); ctx.fill();

    // vòm phía trên
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ecddc9';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(px - 4, py + 22);
    ctx.quadraticCurveTo(cx, py - 62, px + w + 4, py + 22);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,110,120,.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    heartPath(cx, py - 58, 20);
    ctx.fillStyle = d.opened ? '#ffe08a' : '#ff8fae';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();

    // cột hai bên
    for (const side of [0, 1]) {
      const colX = side === 0 ? px - 10 : px + w + 10;
      const cg = ctx.createLinearGradient(colX - 9, 0, colX + 9, 0);
      cg.addColorStop(0, '#fbf1e4');
      cg.addColorStop(0.5, '#f0e2cf');
      cg.addColorStop(1, '#dfcdb8');
      ctx.fillStyle = cg;
      rr(colX - 9, py + 6, 18, h - 6, 9); ctx.fill();
      ctx.strokeStyle = 'rgba(130,100,105,.22)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      rr(colX - 6, py + 14, 5, h - 30, 3); ctx.fill();
      // đế cột
      ctx.fillStyle = '#e6d5c0';
      rr(colX - 15, py + h - 14, 30, 16, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(130,100,105,.2)'; ctx.lineWidth = 2; ctx.stroke();
      // nơ nhỏ
      ctx.fillStyle = d.opened ? '#ffd66e' : '#ff9fbe';
      ellipse(colX, py + h * 0.52, 4, 4); ctx.fill();
    }

    if (fieldA > 0.01) {
      ctx.save();
      ctx.globalAlpha = fieldA;
      const g = ctx.createLinearGradient(px, py, px + w, py + h);
      g.addColorStop(0, 'rgba(255,150,195,.22)');
      g.addColorStop(0.45, 'rgba(255,225,240,.30)');
      g.addColorStop(1, 'rgba(150,205,255,.20)');
      ctx.fillStyle = g;
      ctx.fillRect(px + 5, py + 12, w - 10, h - 12);
      // vân sáng chéo
      ctx.strokeStyle = 'rgba(255,255,255,.32)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const xx = px + 18 + (i / 3) * (w - 36);
        ctx.beginPath();
        ctx.moveTo(xx, py + 20);
        ctx.quadraticCurveTo(xx + Math.sin(t * 1.5 + i) * 10, py + h * 0.55, xx + Math.sin(t * 1.2 + i * 2) * 6, py + h);
        ctx.stroke();
      }
      // tim bay trong cổng
      for (let i = 0; i < 3; i++) {
        const hy = py + h * 0.28 + i * h * 0.2 + Math.sin(t * 1.3 + i * 2) * 8;
        const hx = cx + Math.sin(t * 0.9 + i * 2.1) * 26;
        ctx.globalAlpha = fieldA * (0.25 + 0.15 * Math.sin(t * 2 + i));
        heartPath(hx, hy, 9);
        ctx.fillStyle = '#ff7fa6'; ctx.fill();
      }
      ctx.globalAlpha = fieldA;
      // ổ khóa tim
      const ly = py + h * 0.52;
      ctx.shadowColor = 'rgba(255,120,160,.55)';
      ctx.shadowBlur = 26;
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ellipse(cx, ly, 44, 44); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
      ellipse(cx, ly, 44, 44); ctx.stroke();
      heartPath(cx, ly, 34);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
      ctx.strokeStyle = '#ff6f9c'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#d93a6c';
      ellipse(cx, ly - 2, 4, 5); ctx.fill();
      rr(cx - 2.5, ly + 1, 5, 10, 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      const g = ctx.createLinearGradient(px, py, px + w, py + h);
      g.addColorStop(0, 'rgba(255,235,170,0)');
      g.addColorStop(0.5, `rgba(255,235,170,${0.2 + 0.1 * Math.sin(t * 3)})`);
      g.addColorStop(1, 'rgba(255,235,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px + 5, py + 12, w - 10, h);
      ctx.restore();
    }
  }

  // plate / button
  function drawPlate(pl, t) {
    if (pl.kind === 'button') {
      const cx = pl.x + pl.w / 2, cy = pl.y + pl.h / 2;
      const on = pl.on || pl.live;
      // đường dóng xuống đất
      if (pl.guide != null) {
        ctx.save();
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = 'rgba(255,255,255,.32)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy + pl.h / 2 + 6);
        ctx.lineTo(pl.guide, 640);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255,255,255,.4)';
        ellipse(pl.guide, 640, 26, 7); ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(cx, cy);
      // vòng ngoài phát sáng
      ctx.strokeStyle = `rgba(255,226,150,${0.25 + 0.2 * Math.sin(t * 3)})`;
      ctx.lineWidth = 2;
      ellipse(0, 0, 35, 35); ctx.stroke();
      // đế kim loại
      ctx.fillStyle = '#f8e9c9';
      ellipse(0, 0, 29, 29); ctx.fill();
      ctx.strokeStyle = '#d9a94c'; ctx.lineWidth = 4;
      ellipse(0, 0, 29, 29); ctx.stroke();
      // nút đỏ
      const bg = ctx.createLinearGradient(0, -20, 0, 20);
      bg.addColorStop(0, on ? '#ffd98a' : '#ffa2c0');
      bg.addColorStop(1, on ? '#e8a72e' : '#e35b86');
      ctx.fillStyle = bg;
      ellipse(0, 0, 21, 21); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      ellipse(0, 0, 21, 21); ctx.stroke();
      heartPath(0, 0, 15);
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ellipse(-7, -8, 5, 3.5); ctx.fill();
      if (on) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#fff3b0';
        ellipse(0, 0, 27, 27); ctx.fill();
      }
      ctx.restore();
      return;
    }
    // plate dưới đất
    const press = pl.pressT || 0;
    const on = pl.live || pl.on;
    const cx = pl.x + pl.w / 2;
    const y = pl.y - 12 + press * 4;
    ctx.save();
    // cột sáng nhẹ
    const beam = ctx.createLinearGradient(0, pl.y - 82, 0, pl.y);
    beam.addColorStop(0, 'rgba(255,195,220,0)');
    beam.addColorStop(1, on ? 'rgba(255,220,140,.22)' : 'rgba(255,185,210,.17)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(cx - 24, pl.y - 82);
    ctx.lineTo(cx + 24, pl.y - 82);
    ctx.lineTo(cx + 46, pl.y);
    ctx.lineTo(cx - 46, pl.y);
    ctx.closePath();
    ctx.fill();
    heartPath(cx, pl.y - 58 + Math.sin(t * 2.2) * 4, 7.5);
    ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 2.2);
    ctx.fillStyle = on ? '#ffd66e' : '#ff9fbe';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(70,50,70,.16)';
    ellipse(cx, pl.y + 1, pl.w / 2 + 4, 6); ctx.fill();
    ctx.fillStyle = '#d9c6b2';
    rr(pl.x, y, pl.w, 14, 6); ctx.fill();
    ctx.fillStyle = '#f4e6d5';
    rr(pl.x + 4, y + 2, pl.w - 8, 7, 4); ctx.fill();
    ctx.fillStyle = on ? '#ffe08a' : '#ffc2d4';
    rr(pl.x + 8, y + 4, pl.w - 16, 5, 3); ctx.fill();
    ctx.shadowColor = on ? 'rgba(255,220,130,.9)' : 'transparent';
    ctx.shadowBlur = on ? 18 : 0;
    ctx.fillStyle = on ? '#ffcf4d' : '#ff8fae';
    ellipse(cx, y + 4, 5, 4); ctx.fill();
    ctx.restore();
  }

  // bập bênh
  function drawSeesaw(t) {
    const s = G.seesaw;
    if (!s) return;
    const cx = s.x + s.w / 2, base = s.y;
    const tilt = s.tilt || 0;
    ctx.save();
    ctx.fillStyle = 'rgba(60,35,70,.14)';
    ellipse(cx, base + 2, s.w * 0.55, 8); ctx.fill();
    // đế + trục
    ctx.fillStyle = '#a97652';
    rr(cx - 34, base - 5, 68, 9, 4); ctx.fill();
    ctx.fillStyle = '#c08a5e';
    ctx.beginPath();
    ctx.moveTo(cx - 26, base - 4);
    ctx.lineTo(cx, base - 30);
    ctx.lineTo(cx + 26, base - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,60,.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e8c39a';
    ellipse(cx, base - 10, 5, 5); ctx.fill();
    // ván
    ctx.save();
    ctx.translate(cx, base - 6);
    ctx.rotate(tilt);
    const hw = s.w / 2;
    ctx.fillStyle = '#e2a76f';
    rr(-hw, -6, s.w, 12, 6); ctx.fill();
    ctx.strokeStyle = '#a97652'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    rr(-hw + 9, -3.2, s.w - 18, 4, 2); ctx.fill();
    ctx.fillStyle = 'rgba(150,95,60,.45)';
    ctx.fillRect(-1, -6, 2, 12);
    for (const side of [-1, 1]) {
      ctx.fillStyle = 'rgba(255,246,214,.55)';
      ellipse(side * (hw - 8), 0, 8, 4.5); ctx.fill();
    }
    ctx.restore();
    // vạch đứng hai đầu
    const leftOn = G.players.some((p) => p.onGround && p.x + p.w / 2 > s.x && p.x + p.w / 2 < cx);
    const rightOn = G.players.some((p) => p.onGround && p.x + p.w / 2 > cx && p.x + p.w / 2 < s.x + s.w);
    for (const [side, px, occupied] of [[-1, s.x + 45, leftOn], [1, s.x + s.w - 45, rightOn]]) {
      ctx.save();
      ctx.globalAlpha = occupied ? 0.18 : 0.5 + 0.25 * Math.sin(t * 4 + side);
      ctx.strokeStyle = '#fff4ce';
      ctx.lineWidth = 2;
      ellipse(px, base - 3, 15, 5); ctx.stroke();
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.moveTo(px - 5, base - 50);
      ctx.lineTo(px + 5, base - 50);
      ctx.lineTo(px, base - 42);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // nhắc nhảy khi cả hai đã vào vị trí
    if (leftOn && rightOn) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 6);
      starPath(cx, base - 84, 10, 5, 0.46);
      ctx.fillStyle = '#ffd66e'; ctx.fill();
      ctx.strokeStyle = '#fff6cf'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#7a5238';
      ctx.font = `900 11px ${BODY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NHẢY!', cx, base - 64);
      ctx.restore();
    }
    if (s.pulse > 0) {
      ctx.save();
      ctx.globalAlpha = s.pulse * 0.45;
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = 3;
      ellipse(cx, base - 24, 36 + (1 - s.pulse) * 50, 9 + (1 - s.pulse) * 8);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // heart item
  function drawHeartItem(h, t) {
    const bob = Math.sin(t * 2.4) * 5;
    const x = h.x, y = h.y + bob;
    const s = 30 + Math.sin(t * 3.1) * 2;
    ctx.save();
    ctx.translate(x, y);
    // hào quang
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
    g.addColorStop(0, 'rgba(255,150,185,.45)');
    g.addColorStop(1, 'rgba(255,150,185,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-70, -70, 140, 140);
    // cánh
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    const flap = Math.sin(t * 10) * 0.35;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(-0.5 + flap);
      ellipse(26, -8, 14, 8); ctx.fill();
      ctx.restore();
    }
    // thân tim
    heartPath(0, 0, s * 1.35);
    const hg = ctx.createLinearGradient(0, -s, 0, s);
    hg.addColorStop(0, '#ff9fbe');
    hg.addColorStop(1, '#ff4f86');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = '#d93a6c'; ctx.lineWidth = 3; ctx.stroke();
    // mặt
    const blink = (Math.sin(t * 1.7) > 0.97) ? 0.15 : 1;
    ctx.fillStyle = '#4a2233';
    ellipse(-8, -3, 2.6, 3.4 * blink); ctx.fill();
    ellipse(8, -3, 2.6, 3.4 * blink); ctx.fill();
    ctx.strokeStyle = '#4a2233'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 4, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ellipse(-10, -12, 4, 3); ctx.fill();
    ctx.restore();
    if (h.held) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = 'rgba(255,140,175,.7)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 2;
      for (const p of G.players) {
        ctx.beginPath();
        ctx.moveTo(x, y + 4);
        ctx.quadraticCurveTo((x + p.x + p.w / 2) / 2, Math.min(y, p.y) - 16, p.x + p.w / 2, p.y + 14);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // goal arch
  function drawGoal(t) {
    const g = G.goal;
    const active = G.inGoal;
    const x = g.x, w = g.w;
    const base = g.y;
    const top = base - 168;
    ctx.save();
    // thảm sáng
    const glow = ctx.createRadialGradient(x + w / 2, base - 6, 10, x + w / 2, base - 6, 112);
    glow.addColorStop(0, active ? 'rgba(255,230,150,.55)' : 'rgba(255,190,215,.32)');
    glow.addColorStop(1, 'rgba(255,220,180,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 40, base - 120, w + 80, 150);
    ctx.fillStyle = active ? 'rgba(255,225,140,.5)' : 'rgba(255,185,210,.28)';
    ellipse(x + w / 2, base - 5, w * 0.52, 14); ctx.fill();

    // thảm "NHÀ"
    ctx.fillStyle = 'rgba(255,247,221,.72)';
    rr(x + w / 2 - 44, base - 13, 88, 13, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#8a6030';
    ctx.font = `900 11px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NHÀ', x + w / 2, base - 5.5);

    // cột dây leo
    for (const side of [0, 1]) {
      const px = side === 0 ? x + 10 : x + w - 10;
      ctx.strokeStyle = '#5f9f77';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, base);
      ctx.quadraticCurveTo(px + (side ? -8 : 8), base - 100, px + (side ? -16 : 16), top + 18);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.32)';
      ctx.lineWidth = 4;
      ctx.stroke();
      // lá
      for (let i = 1; i <= 4; i++) {
        const yy = base - i * 30;
        const xx = px + (side ? -1 : 1) * (4 + i * 2);
        ctx.fillStyle = i % 2 ? '#9adcae' : '#7cc794';
        ellipse(xx + (side ? -6 : 6), yy, 9, 4.5);
        ctx.fill();
      }
    }
    // dây vòm
    ctx.strokeStyle = '#5f9f77';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(x + 26, top + 26);
    ctx.quadraticCurveTo(x + w / 2, top - 38, x + w - 26, top + 26);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.3)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // quầng sáng trên đỉnh
    const tg = ctx.createRadialGradient(x + w / 2, top - 20, 4, x + w / 2, top - 20, 95);
    tg.addColorStop(0, active ? 'rgba(255,225,140,.5)' : 'rgba(255,190,215,.32)');
    tg.addColorStop(1, 'rgba(255,220,180,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(x + w / 2 - 100, top - 120, 200, 200);

    // tim treo
    const hs = active ? 42 + Math.sin(t * 4) * 3 : 36;
    heartPath(x + w / 2, top - 22, hs);
    ctx.fillStyle = active ? '#ffd66e' : '#ff8fae';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2.5; ctx.stroke();
    // bóng tim
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ellipse(x + w / 2 - 6, top - 32, 6, 4); ctx.fill();

    if (active) {
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 6);
      for (let i = 0; i < 3; i++) {
        const a = t * 1.6 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = '#fff0b0';
        ellipse(x + w / 2 + Math.cos(a) * 46, base - 40 + Math.sin(a) * 12, 3, 3);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // rope
  function drawRope(t) {
    const [a, b] = G.players;
    if (!a || !b) return;
    const ax = a.x + a.w / 2, ay = a.y + a.h * 0.55;
    const bx = b.x + b.w / 2, by = b.y + b.h * 0.55;
    const d = dist(ax, ay, bx, by);
    const maxLen = G.ropeMax || 300;
    const soft = maxLen * 0.7;
    const tension = clamp((d - soft) / (maxLen - soft), 0, 1);
    const sag = lerp(34, 3, tension) + Math.sin(t * 2.5) * 2 * (1 - tension);
    const mx = (ax + bx) / 2, my = (ay + by) / 2 + sag;
    ctx.save();
    ctx.lineCap = 'round';
    // bóng
    ctx.strokeStyle = 'rgba(70,30,60,.18)';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(ax, ay + 3); ctx.quadraticCurveTo(mx, my + 3, bx, by + 3); ctx.stroke();
    // viền
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
    // dây
    const g = ctx.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, tension > 0.75 ? '#ff4f7f' : '#ff86a9');
    g.addColorStop(0.5, tension > 0.75 ? '#ff6f8f' : '#ffb0c6');
    g.addColorStop(1, tension > 0.75 ? '#ff4f7f' : '#ff86a9');
    ctx.strokeStyle = g;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
    // nút thắt giữa dây
    if (tension < 0.9) {
      heartPath(mx, my, 7 + (1 - tension) * 2);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
      ctx.fillStyle = '#ff6f9c'; ctx.fill();
    }
    if (tension > 0.55) {
      ctx.globalAlpha = (tension - 0.55) / 0.45;
      for (let i = 1; i <= 3; i++) {
        const u = i / 4;
        const px = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * bx;
        const py = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * by;
        heartPath(px, py - 8 - Math.sin(t * 5 + i) * 3, 6);
        ctx.fillStyle = '#ff5f8f'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
    ctx.restore();
  }

  // player
  function drawPlayer(p, t) {
    const partner = G.players[1 - p.i];
    const cx = p.x + p.w / 2;
    const feet = p.y + p.h;
    const speed = Math.abs(p.vx);
    const walking = p.onGround && speed > 30;
    const bob = walking ? Math.sin(p.walk * 2) * 1.6 : Math.sin(t * 2 + p.i * 2) * 0.8;
    const moving = Math.abs(p.vx) > 20;

    ctx.save();
    // bóng
    const air = clamp(1 - (640 - feet) / 220, 0.15, 1);
    ctx.globalAlpha = 0.16 * air;
    ctx.fillStyle = '#3b2340';
    ellipse(cx, feet + 3, p.w * 0.55, 6);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.translate(cx, feet + bob);
    const sy = 1 + p.squash;
    const sx = 1 - p.squash * 0.65;
    ctx.scale(sx, sy);

    const col = p.i === 0
      ? { hi: '#ffc2d4', mid: '#ff8fb1', low: '#f26690', line: '#c94a74', blush: 'rgba(255,110,150,.4)' }
      : { hi: '#b5e6ff', mid: '#7cc8f0', low: '#54aede', line: '#3a86b8', blush: 'rgba(80,170,230,.32)' };

    // chân
    const step = walking ? Math.sin(p.walk * 2) * 4 : 0;
    ctx.fillStyle = col.line;
    ellipse(-9 + step, 1, 8, 5); ctx.fill();
    ellipse(9 - step, 1, 8, 5); ctx.fill();

    // thân
    ctx.beginPath();
    ctx.moveTo(-p.w / 2, -5);
    ctx.bezierCurveTo(-p.w / 2, -p.h * 0.98, p.w / 2, -p.h * 0.98, p.w / 2, -5);
    ctx.quadraticCurveTo(p.w / 2, 0, p.w / 2 - 9, 0);
    ctx.lineTo(-p.w / 2 + 9, 0);
    ctx.quadraticCurveTo(-p.w / 2, 0, -p.w / 2, -5);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, -p.h, 0, 0);
    bg.addColorStop(0, col.hi);
    bg.addColorStop(0.55, col.mid);
    bg.addColorStop(1, col.low);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = col.line;
    ctx.lineWidth = 3;
    ctx.stroke();

    // highlight
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#fff';
    ellipse(-p.w * 0.18, -p.h * 0.72, p.w * 0.16, p.h * 0.16);
    ctx.fill();
    ctx.globalAlpha = 1;

    // tai / phụ kiện
    if (p.i === 0) {
      // bông hoa
      ctx.save();
      ctx.translate(-p.w * 0.26, -p.h + 2);
      ctx.rotate(Math.sin(t * 2 + 0.4) * 0.12);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.fillStyle = '#fff4f8';
        ellipse(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 4.2, 4.2); ctx.fill();
        ctx.strokeStyle = 'rgba(220,120,150,.35)'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.fillStyle = '#ffd66e';
      ellipse(0, 0, 3.6, 3.6); ctx.fill();
      ctx.restore();
    } else {
      // mầm cây
      ctx.strokeStyle = '#5f9e6f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -p.h + 2);
      ctx.quadraticCurveTo(2, -p.h - 8, 8, -p.h - 12);
      ctx.stroke();
      ctx.fillStyle = '#8fd3a3';
      ctx.save();
      ctx.translate(8, -p.h - 12);
      ctx.rotate(0.4 + Math.sin(t * 2) * 0.1);
      ellipse(4, 0, 7, 3.5); ctx.fill();
      ctx.restore();
    }

    // tay
    const armsUp = G.heart && G.heart.held;
    ctx.strokeStyle = col.line;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    if (armsUp) {
      ctx.beginPath();
      ctx.moveTo(-p.w / 2 + 4, -p.h * 0.52);
      ctx.quadraticCurveTo(-p.w / 2 - 2, -p.h * 0.8, -p.w * 0.22, -p.h - 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.w / 2 - 4, -p.h * 0.52);
      ctx.quadraticCurveTo(p.w / 2 + 2, -p.h * 0.8, p.w * 0.22, -p.h - 4);
      ctx.stroke();
    } else {
      const swing = walking ? Math.sin(p.walk * 2) * 4 : 0;
      ctx.beginPath();
      ctx.moveTo(-p.w / 2 + 5, -p.h * 0.52);
      ctx.quadraticCurveTo(-p.w / 2 - 5, -p.h * 0.42 + swing, -p.w / 2 - 2, -p.h * 0.28 + swing);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.w / 2 - 5, -p.h * 0.52);
      ctx.quadraticCurveTo(p.w / 2 + 5, -p.h * 0.42 - swing, p.w / 2 + 2, -p.h * 0.28 - swing);
      ctx.stroke();
    }

    // mắt
    let look = moving ? clamp(p.vx / 260, -1, 1) : 0;
    if (!moving && partner) look = clamp(((partner.x + partner.w / 2) - cx) / 900, -0.5, 0.5);
    const eyeY = -p.h * 0.6;
    const blink = p.blinkT > 0;
    if (!blink) {
      for (const sx2 of [-1, 1]) {
        ctx.fillStyle = '#fff';
        ellipse(sx2 * 9.5 + look * 1.4, eyeY, 7.2, 7.8); ctx.fill();
        ctx.strokeStyle = 'rgba(80,40,70,.18)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#3a2438';
        ellipse(sx2 * 9.5 + look * 3.2, eyeY + 0.6, 3.4, 3.9); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ellipse(sx2 * 9.5 + look * 3.2 - 1.2, eyeY - 1.6, 1.2, 1.3); ctx.fill();
      }
    } else {
      ctx.strokeStyle = '#3a2438';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-13.5 + look * 1.4, eyeY); ctx.lineTo(-5.5 + look * 1.4, eyeY);
      ctx.moveTo(5.5 + look * 1.4, eyeY); ctx.lineTo(13.5 + look * 1.4, eyeY);
      ctx.stroke();
    }
    // lông mày khi neo / căng
    if (p.anchored || (G.ropeDist || 0) > (G.ropeMax || 300) - 3) {
      ctx.strokeStyle = col.line;
      ctx.lineWidth = 2;
      const fy = eyeY - 12;
      ctx.beginPath();
      ctx.moveTo(-14, fy + 2); ctx.lineTo(-6, fy - 1);
      ctx.moveTo(6, fy - 1); ctx.lineTo(14, fy + 2);
      ctx.stroke();
    }

    // má hồng
    ctx.fillStyle = col.blush;
    ellipse(-15, eyeY + 12, 5, 3); ctx.fill();
    ellipse(15, eyeY + 12, 5, 3); ctx.fill();

    // miệng
    const mouthY = eyeY + 12;
    ctx.strokeStyle = '#3a2438';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    if (armsUp) {
      ctx.beginPath(); ctx.ellipse(0, mouthY + 1, 4.5, 5, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (p.vy < -250) {
      ctx.beginPath(); ctx.ellipse(0, mouthY + 1, 4, 4.5, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, mouthY - 1, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }

    // neo: vòng tròn dưới chân
    if (p.anchored) {
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ellipse(0, -1, p.w * 0.7, 7); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawParticles(layer) {
    for (const q of G.particles) {
      if (layer === 'back' && (q.type === 'confetti' || q.type === 'heart')) continue;
      if (layer === 'front' && q.type !== 'confetti' && q.type !== 'heart') continue;
      const a = clamp(q.life / (q.max * 0.6), 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (q.type === 'heart') {
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        heartPath(0, 0, q.size);
        ctx.fillStyle = q.color;
        ctx.fill();
      } else if (q.type === 'confetti') {
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
      } else {
        ctx.fillStyle = q.color;
        ellipse(q.x, q.y, q.size, q.size);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // speech bubble
  function drawBubble(p, t) {
    if (!p.bubble) return;
    const b = p.bubble;
    const a = clamp(b.t / 0.35, 0, 1);
    const cx = p.x + p.w / 2;
    const top = p.y - 12;
    ctx.save();
    ctx.globalAlpha = a;
    drawBubbleText(b.text, cx, top, 210, '#fffaf4', p.i === 0 ? '#e6769b' : '#5fa9d4');
    ctx.restore();
  }
  function drawBubbleText(text, cx, bottomY, maxW, bg, border) {
    ctx.font = `800 15px ${BODY}`;
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    if (!lines.length) return;
    const lh = 19;
    const bw = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width))) + 24;
    const bh = lines.length * lh + 16;
    let x = cx - bw / 2;
    x = clamp(x, 8, W - bw - 8);
    const y = bottomY - bh - 12;
    ctx.fillStyle = bg;
    ctx.strokeStyle = border;
    ctx.lineWidth = 2.5;
    rr(x, y, bw, bh, 12);
    ctx.fill();
    ctx.stroke();
    // đuôi
    const tx = clamp(cx, x + 16, x + bw - 16);
    ctx.beginPath();
    ctx.moveTo(tx - 7, y + bh - 1);
    ctx.lineTo(tx, y + bh + 9);
    ctx.lineTo(tx + 7, y + bh - 1);
    ctx.closePath();
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = border; ctx.lineWidth = 2.5; ctx.stroke();
    // che đường nối
    ctx.fillStyle = bg;
    ctx.fillRect(tx - 6, y + bh - 4, 12, 4);
    ctx.fillStyle = '#4a3548';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x + bw / 2, y + 10 + i * lh + lh / 2 - 1));
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(40,20,45,0)');
    g.addColorStop(1, 'rgba(40,20,45,.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ------------------------------------------------------------------- menu scene
  function initMenu() {
    G.theme = THEMES.day;
    G.players = [];
    G.heart = null;
    G.level = null;
    G.clouds = buildClouds(3);
    G.skyStars = buildSkyStars(3);
    G.decor = { tufts: [], flowers: [] };
    G.menuPlayers = [
      { i: 0, w: 52, h: 64, x: 96, y: 580, vx: 0, vy: 0, onGround: true, anchored: false, squash: 0, blink: 2.5, blinkT: 0, walk: 0, face: 1, bubble: null, standingOn: null },
      { i: 1, w: 52, h: 64, x: W - 148, y: 580, vx: 0, vy: 0, onGround: true, anchored: false, squash: 0, blink: 1.2, blinkT: 0, walk: 0, face: -1, bubble: null, standingOn: null },
    ];
  }
  function drawMenu(t) {
    drawSky(t, THEMES.day, true);
    // đồi cỏ dưới chân
    ctx.fillStyle = '#9adcb8';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 60);
    ctx.quadraticCurveTo(W / 2, H - 110, W, H - 60);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    for (let i = 0; i < 12; i++) {
      const x = (i * 113 + 40) % W;
      const y = H - 58 + Math.sin(i) * 8;
      ellipse(x, y, 2.5, 1.5); ctx.fill();
    }
    const mp = G.menuPlayers;
    drawTree({ x: 34, base: 700, s: 1.15, sway: 1.4 }, t);
    drawTree({ x: W - 22, base: 700, s: 1.05, sway: 3.6 }, t);
    // dây
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(mp[0].x + mp[0].w / 2, mp[0].y + 28);
    ctx.quadraticCurveTo(W / 2, H - 12, mp[1].x + mp[1].w / 2, mp[1].y + 28);
    ctx.stroke();
    ctx.strokeStyle = '#ff8fae';
    ctx.lineWidth = 4;
    ctx.stroke();
    heartPath(W / 2, H - 10, 9);
    ctx.fillStyle = '#ff6f9c'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    for (const p of mp) {
      p.y = 580 + Math.sin(t * 1.8 + p.i * 1.7) * 2.5;
      drawPlayer(p, t);
    }
    // tim bay
    for (let i = 0; i < 4; i++) {
      const x = 80 + i * 340 + Math.sin(t * 0.6 + i) * 26;
      const y = 300 + Math.sin(t * 0.9 + i * 2) * 40;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t + i);
      heartPath(x, y, 12 + i * 2);
      ctx.fillStyle = '#ff9fbe'; ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawParticles('front');
    drawVignette();
  }

  // ------------------------------------------------------------------- master render
  function render(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (G.shake > 0.2) {
      ctx.translate(rnd(-G.shake, G.shake) * 0.5, rnd(-G.shake, G.shake) * 0.5);
    }
    if (G.mode === 'menu') drawMenu(t);
    else drawWorld(t);
    ctx.restore();

    if (G.flash > 0.01) {
      ctx.fillStyle = `rgba(255,80,120,${G.flash * 0.28})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (G.fade > 0.01) {
      ctx.fillStyle = G.theme.skyTop;
      ctx.globalAlpha = G.fade;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // viền trong
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }

  // ------------------------------------------------------------------- loop
  let last = performance.now();
  let acc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (!isFinite(dt)) dt = 0;
    dt = Math.min(dt, 0.05);

    if (G.mode === 'playing') {
      if (G.respawnT > 0) {
        G.respawnT -= dt;
        if (G.respawnT <= 0) resetPlayers();
        acc = 0;
      } else {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 8) {
          update(STEP);
          acc -= STEP;
          steps++;
          if (G.mode !== 'playing') break;
        }
      }
    } else {
      acc = 0;
    }
    updateFx(dt);
    render(G.animT);
    updateHUD();
  }

  // ------------------------------------------------------------------- UI wiring
  dom.btnStart.addEventListener('click', startGame);
  dom.btnResume.addEventListener('click', resumeGame);
  dom.btnRestartLevel.addEventListener('click', () => {
    dom.screenPause.classList.add('hidden');
    restartLevel();
  });
  dom.btnQuit.addEventListener('click', goMenu);
  dom.btnNext.addEventListener('click', nextLevel);
  dom.btnReplay.addEventListener('click', replay);
  dom.btnHome.addEventListener('click', goMenu);
  dom.btnPause.addEventListener('click', () => { G.mode === 'paused' ? resumeGame() : pauseGame(); });
  dom.btnSound.addEventListener('click', toggleSound);
  for (const el of [dom.name1, dom.name2]) {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); startGame(); }
    });
  }

  window.addEventListener('error', (e) => {
    dom.errorBanner.classList.remove('hidden');
    dom.errorBanner.textContent = 'Lỗi rồi: ' + (e.message || e.error) + (e.lineno ? ` (dòng ${e.lineno})` : '');
  });

  
  window.__triggerEmote = function(playerIndex, emoteType) {
    const p = G.players[playerIndex];
    if (!p) return;
    const icons = {
      love: '❤️ Yêu nè!',
      kiss: '😘 Chụt chụt!',
      cry: '😭 Hu hu...',
      angry: '😤 Dỗi nha!',
      sos: '🆘 Cứu em với!'
    };
    say(p, icons[emoteType] || '❤️');
    sfx('boost');
    spawnHearts(p.x + p.w / 2, p.y - 10, 4);
  };

  window.__applyNetworkState = function(st) {
    if (!window.GameNetwork || !window.GameNetwork.isOnline || window.GameNetwork.isHost) return;
    // Client áp dụng state từ Host
    if (st.p1 && G.players[0]) {
      Object.assign(G.players[0], st.p1);
    }
    if (st.p2 && G.players[1]) {
      Object.assign(G.players[1], st.p2);
    }
    if (st.doors && G.doors) {
      st.doors.forEach((d, idx) => { if (G.doors[idx]) Object.assign(G.doors[idx], d); });
    }
    if (st.plates && G.plates) {
      st.plates.forEach((pl, idx) => { if (G.plates[idx]) Object.assign(G.plates[idx], pl); });
    }
    if (st.heart && G.heart) {
      Object.assign(G.heart, st.heart);
    }
    if (st.seesaw && G.seesaw) {
      Object.assign(G.seesaw, st.seesaw);
    }
    if (st.shake) G.shake = st.shake;
  };

  window.__setNetworkLevel = function(lvl) {
    if (!window.GameNetwork || !window.GameNetwork.isOnline || window.GameNetwork.isHost) return;
    if (G.levelIndex !== lvl) {
      buildLevel(lvl);
    }
  };


  // ------------------------------------------------------------------- ONLINE & LOBBY EVENTS
  if (dom.tabLocal && dom.tabOnline) {
    dom.tabLocal.addEventListener('click', () => {
      dom.tabLocal.classList.add('active');
      dom.tabOnline.classList.remove('active');
      dom.localNamesBlock.classList.remove('hidden');
      dom.onlineBox.classList.add('hidden');
      dom.btnStart.classList.remove('hidden');
      if (window.GameNetwork) window.GameNetwork.leaveRoom();
    });

    dom.tabOnline.addEventListener('click', () => {
      dom.tabOnline.classList.add('active');
      dom.tabLocal.classList.remove('active');
      dom.localNamesBlock.classList.add('hidden');
      dom.onlineBox.classList.remove('hidden');
      dom.btnStart.classList.add('hidden');
      const cfg = window.GameNetwork ? window.GameNetwork.loadConfig() : null;
      if (cfg && cfg.databaseURL) {
        if (dom.fbDbUrl) dom.fbDbUrl.value = cfg.databaseURL || '';
        if (dom.fbApiKey) dom.fbApiKey.value = cfg.apiKey || '';
        if (dom.fbProjectId) dom.fbProjectId.value = cfg.projectId || '';
      }
    });
  }

  // Cấu hình Firebase Modal
  if (dom.btnConfigFirebase && dom.modalFirebase) {
    dom.btnConfigFirebase.addEventListener('click', () => {
      dom.modalFirebase.classList.remove('hidden');
      const cfg = window.GameNetwork ? window.GameNetwork.loadConfig() : null;
      if (cfg) {
        dom.fbDbUrl.value = cfg.databaseURL || '';
        dom.fbApiKey.value = cfg.apiKey || '';
        dom.fbProjectId.value = cfg.projectId || '';
      }
    });
    dom.btnCloseFirebase.addEventListener('click', () => dom.modalFirebase.classList.add('hidden'));
    dom.btnSaveFirebase.addEventListener('click', () => {
      const cfg = {
        databaseURL: (dom.fbDbUrl.value || '').trim(),
        apiKey: (dom.fbApiKey.value || '').trim(),
        projectId: (dom.fbProjectId.value || '').trim(),
      };
      if (window.GameNetwork) window.GameNetwork.saveConfig(cfg);
      dom.modalFirebase.classList.add('hidden');
      sfx('star');
    });
  }

  // Tạo phòng Online (Host)
  if (dom.btnCreateRoom) {
    dom.btnCreateRoom.addEventListener('click', async () => {
      const hostName = (dom.onlineMyName.value || '').trim() || 'Bông';
      dom.statusNote.textContent = 'Đang khởi tạo phòng Firebase...';
      dom.roomStatus.classList.remove('hidden');
      dom.btnCreateRoom.disabled = true;

      await window.GameNetwork.createRoom(
        hostName,
        (roomInfo) => {
          // Khi người thứ 2 vào phòng -> Vào game!
          dom.statusNote.textContent = 'Người yêu đã vào phòng! Đang khởi động...';
          sfx('win');
          setTimeout(() => {
            G.names = [hostName, roomInfo.partnerName || 'Bắp'];
            updateNames();
            buildLevel(0);
          }, 800);
        },
        (err) => {
          dom.statusNote.textContent = 'Lỗi: ' + err;
          dom.btnCreateRoom.disabled = false;
        }
      );

      dom.badgeRoomRole.textContent = 'Chủ phòng (P1 - Hồng)';
      if (window.GameNetwork && window.GameNetwork.currentRoomId) {
        dom.roomCodeText.textContent = window.GameNetwork.currentRoomId;
      }
    });
  }

  // Vào phòng Online (Guest)
  if (dom.btnJoinRoom) {
    dom.btnJoinRoom.addEventListener('click', async () => {
      const code = (dom.inputRoomCode.value || '').trim();
      if (!code) { alert('Vui lòng nhập mã phòng!'); return; }
      const guestName = (dom.onlineMyName.value || '').trim() || 'Bắp';
      dom.statusNote.textContent = 'Đang kết nối vào phòng ' + code + '...';
      dom.roomStatus.classList.remove('hidden');

      await window.GameNetwork.joinRoom(
        code,
        guestName,
        (roomInfo) => {
          dom.badgeRoomRole.textContent = 'Khách (P2 - Xanh)';
          dom.roomCodeText.textContent = code;
          dom.statusNote.textContent = 'Đã kết nối! Chuẩn bị dính nhau...';
          sfx('star');
          setTimeout(() => {
            G.names = [roomInfo.partnerName || 'Bông', guestName];
            updateNames();
            buildLevel(0);
          }, 800);
        },
        (err) => {
          dom.statusNote.textContent = 'Lỗi: ' + err;
        }
      );
    });
  }

  // Sao chép mã phòng
  if (dom.btnCopyCode) {
    dom.btnCopyCode.addEventListener('click', () => {
      const code = dom.roomCodeText.textContent;
      navigator.clipboard.writeText(code).then(() => {
        dom.btnCopyCode.textContent = '✅';
        setTimeout(() => { dom.btnCopyCode.textContent = '📋'; }, 1500);
      });
    });
  }

  // Hủy phòng
  if (dom.btnCancelRoom) {
    dom.btnCancelRoom.addEventListener('click', () => {
      if (window.GameNetwork) window.GameNetwork.leaveRoom();
      dom.roomStatus.classList.add('hidden');
      if (dom.btnCreateRoom) dom.btnCreateRoom.disabled = false;
    });
  }

  // Quick Emotes Phím tắt 1, 2, 3, 4, 5 và click nút
  document.querySelectorAll('.emote-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-emote');
      const myIdx = (window.GameNetwork && window.GameNetwork.isOnline) ? window.GameNetwork.role : 0;
      if (window.__triggerEmote) window.__triggerEmote(myIdx, type);
      if (window.GameNetwork && window.GameNetwork.isOnline) window.GameNetwork.sendEmote(type);
    });
  });

  window.addEventListener('keydown', (e) => {
    if (G.mode !== 'playing') return;
    const keyMap = { 'Digit1': 'love', 'Digit2': 'kiss', 'Digit3': 'cry', 'Digit4': 'angry', 'Digit5': 'sos' };
    if (keyMap[e.code]) {
      const myIdx = (window.GameNetwork && window.GameNetwork.isOnline) ? window.GameNetwork.role : 0;
      if (window.__triggerEmote) window.__triggerEmote(myIdx, keyMap[e.code]);
      if (window.GameNetwork && window.GameNetwork.isOnline) window.GameNetwork.sendEmote(keyMap[e.code]);
    }
  });


  // Sự kiện nút Gửi link mời người yêu
  if (dom.btnShareLink) {
    dom.btnShareLink.addEventListener('click', () => {
      const code = dom.roomCodeText.textContent;
      const shareUrl = window.location.origin + window.location.pathname + '?room=' + code;
      const shareData = {
        title: 'Dính Nhau — Chơi cùng em!',
        text: 'Vào phòng chơi game Dính Nhau với anh nè! Mã phòng: ' + code,
        url: shareUrl
      };

      if (navigator.share) {
        navigator.share(shareData).catch(() => {});
      } else {
        navigator.clipboard.writeText(shareUrl).then(() => {
          const oldText = dom.btnShareLink.textContent;
          dom.btnShareLink.textContent = '✅ Đã chép link mời!';
          setTimeout(() => { dom.btnShareLink.textContent = oldText; }, 2000);
        });
      }
    });
  }

  // Tự động điền mã phòng và chuyển sang tab Online nếu truy cập qua link ?room=xxxx
  try {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && dom.inputRoomCode) {
      dom.inputRoomCode.value = roomParam;
      if (dom.tabOnline) dom.tabOnline.click();
      if (dom.statusNote) {
        dom.statusNote.textContent = 'Đã nhận link mời phòng ' + roomParam + '. Bấm "Vào phòng" để dính nhau!';
        dom.roomStatus.classList.remove('hidden');
      }
    }
  } catch (e) {}

// ------------------------------------------------------------------- boot
  loadPrefs();
  initMenu();
  if (dom.btnStart) dom.btnStart.blur();

  // chế độ chụp thử: ?level=1..4
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('level')) {
      const n = clamp(parseInt(q.get('level'), 10) || 1, 1, LEVELS.length);
      G.names = [dom.name1.value || 'Bông', dom.name2.value || 'Bắp'];
      buildLevel(n - 1);
    }
  } catch (e) {}

  requestAnimationFrame(loop);

  // debug API (dùng để kiểm thử tự động)
  window.__game = {
    G, LEVELS, buildLevel, startGame, nextLevel, resetPlayers,
    win: () => completeLevel(),
    teleport: (i, x, y) => {
      const p = G.players[i];
      if (!p) return;
      p.x = x - p.w / 2; p.y = y - p.h; p.vx = 0; p.vy = 0;
    },
  };
})();
