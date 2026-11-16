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
    screenLevelSelect: $('screenLevelSelect'), levelGrid: $('levelGrid'),
    btnOpenLevelSelect: $('btnOpenLevelSelect'), btnPauseLevelSelect: $('btnPauseLevelSelect'),
    btnCloseLevelSelect: $('btnCloseLevelSelect'),
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
  // =========================================================================
  // MÀN 1: Làm quen (Thảo nguyên Ban Mai)
  // Nhập môn: Di chuyển, làm quen dây tơ hồng, nhảy qua mỏm đá 1 tầng và hố hoa gai
  // =========================================================================
  {
    name: 'Làm quen',
    tag: 'bước đầu gắn kết',
    icon: '🪢',
    difficulty: 'Nhập môn',
    hint: 'Chào mừng hai bạn! Dùng A/D (hoặc Mũi tên) để bước đi, W (hoặc Mũi tên lên) để nhảy. Nhấn Space để dắt tay bạn đời!',
    theme: 'day',
    ropeMax: 350,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '.......##...........',
      '.......##......^^...',
      '#######..#####.#####',
    ],
  },

  // =========================================================================
  // MÀN 2: Cõng nhau (Bật nhảy tình yêu)
  // Bông làm bệ đỡ, Bắp nhảy lên đầu để được BOOST vút lên đập nút mở cổng
  // =========================================================================
  {
    name: 'Cõng nhau',
    tag: 'bật nhảy tình yêu',
    icon: '👟',
    difficulty: 'Cơ bản',
    hint: 'Bức tường thành cao 2 tầng chắn lối! Bông đứng sát chân tường, Bắp nhảy lên đầu Bông để được BOOST vút lên đập nút mở cổng!',
    theme: 'day',
    ropeMax: 360,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    plates: [{ id: 'p1', kind: 'button', x: 512, y: 440, w: 52, latchOn: true }],
    doors: [{ x: 768, y: 448, w: 80, h: 192, needs: ['p1'] }],
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '.......###..........',
      '.......###..........',
      '.......###..........',
      '####################',
    ],
  },

  // =========================================================================
  // MÀN 3: Bế em (Nâng niu Trái Tim)
  // Xuất hiện Trái Tim! Cùng nhau ôm Tim đi sát nhau vượt bậc thềm hoa về đích
  // =========================================================================
  {
    name: 'Bế em',
    tag: 'nâng niu trái tim',
    icon: '💖',
    difficulty: 'Khéo léo',
    hint: 'Trái Tim Tình Yêu đã xuất hiện! Hai bạn đi gần nhau để cùng nâng niu Trái Tim vượt các bậc đá hoa về đích.',
    theme: 'golden',
    ropeMax: 350,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    heart: { x: 288, y: 566 },
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '..........##........',
      '.......##.##.##.....',
      '.......##.##.##.....',
      '######...^......####',
    ],
  },

  // =========================================================================
  // MÀN 4: Bập bênh (Đòn bẩy hạnh phúc)
  // Cơ chế Seesaw: P1 nhảy dậm đầu trái phóng P2 đầu phải vút lên vách đá
  // =========================================================================
  {
    name: 'Bập bênh',
    tag: 'đòn bẩy hạnh phúc',
    icon: '⚖️',
    difficulty: 'Khéo léo',
    hint: 'Bông đứng ở đầu phải bập bênh, Bắp leo bậc thang nhảy dậm thật mạnh xuống đầu kia phóng Bông lên vách đá cao!',
    theme: 'golden',
    ropeMax: 380,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 448, w: 130, h: 190 },
    seesaw: { x: 576, y: 596, w: 190, h: 20 },
    plates: [{ id: 'see_btn', kind: 'button', x: 1024, y: 384, w: 52, latchOn: true }],
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '................####',
      '................####',
      '....###.........####',
      '....###.........####',
      '....###.........####',
      '####################',
    ],
  },

  // =========================================================================
  // MÀN 5: Về nhà (Cổng liên hoàn)
  // Hai phòng liên hoàn. Bông mở cổng cho Bắp, Bắp mở cổng cho Bông
  // =========================================================================
  {
    name: 'Về nhà',
    tag: 'cổng vào tổ ấm',
    icon: '🏡',
    difficulty: 'Khéo léo',
    hint: 'Hai cánh cổng sắt liên hoàn. Bông mở cổng trước cho Bắp vào phòng 2, Bắp đạp công tắc mở cổng tiếp theo để cùng về đích!',
    theme: 'mint',
    ropeMax: 360,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    doors: [
      { x: 512, y: 384, w: 80, h: 256, needs: ['p1'] },
      { x: 960, y: 384, w: 80, h: 256, needs: ['p2'] },
    ],
    plates: [
      { id: 'p1', kind: 'button', x: 320, y: 460, w: 52, latchOn: true },
      { id: 'p2', kind: 'button', x: 736, y: 460, w: 52, latchOn: true },
    ],
    tiles: [
      '........#......#....',
      '........#......#....',
      '........#......#....',
      '........#......#....',
      '........#......#....',
      '........#......#....',
      '....................',
      '....................',
      '....##......##......',
      '....##......##......',
      '####################',
    ],
  },

  // =========================================================================
  // MÀN 6: Đu dây mạo hiểm (Mỏ neo tình yêu)
  // Vực sâu 5 ô! P1 cắm mỏ neo (S / Down) cho P2 đu dây tơ hồng qua hòn đảo giữa
  // =========================================================================
  {
    name: 'Đu dây vực sâu',
    tag: 'vực thẳm lòng tin',
    icon: '⚓',
    difficulty: 'Thử thách',
    hint: 'Vực sâu hun hút! Nhấn S / Mũi tên xuống để CẮM MỎ NEO cho bạn mình đu dây tơ hồng qua mỏm đá giữa vực an toàn!',
    theme: 'sunset',
    ropeMax: 400,
    spawn: [{ x: 96, y: 512 }, { x: 160, y: 512 }],
    goal: { x: 1120, y: 512, w: 130, h: 190 },
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '......##............',
      '#####.##....##.#####',
      '#####.......##.#####',
      '#####...^^..##.#####',
    ],
  },

  // =========================================================================
  // MÀN 7: Bậc thang đôi (Đồng lòng tiến bước)
  // Bậc thang xen kẽ trên hố chông pha lê. Phải nhịp nhàng không giật dây nhau
  // =========================================================================
  {
    name: 'Bậc thang đôi',
    tag: 'đồng điệu bước chân',
    icon: '🪜',
    difficulty: 'Thử thách',
    hint: 'Các bậc đá nhỏ lơ lửng trên bẫy gai! Hai bạn phải lần lượt nhảy từng bước, đừng nhảy vội kẻo dây kéo bạn rơi xuống gai!',
    theme: 'sunset',
    ropeMax: 360,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '..........##........',
      '.......##....##.....',
      '....##..........##..',
      '....................',
      '####^^^^^^^^^^^^####',
    ],
  },

  // =========================================================================
  // MÀN 8: Nguyện ước dưới sao (Bập bênh & Trái Tim)
  // Ôm Trái Tim phóng qua bập bênh nhặt 3 ngôi sao băng lấp lánh
  // =========================================================================
  {
    name: 'Nguyện ước bên nhau',
    tag: 'ngàn vì sao sáng',
    icon: '🌟',
    difficulty: 'Thử thách',
    hint: 'Ôm chặt Trái Tim cùng bước lên bập bênh! Phóng vút lên vách đá để thắp sáng ngôi sao ước nguyện của hai người.',
    theme: 'night',
    ropeMax: 420,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 448, w: 130, h: 190 },
    heart: { x: 256, y: 566 },
    seesaw: { x: 576, y: 596, w: 190, h: 20 },
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '................####',
      '................####',
      '....###.........####',
      '....###.........####',
      '....###.........####',
      '####################',
    ],
  },

  // =========================================================================
  // MÀN 9: Thử thách mê cung (Công tắc & Cửa sập)
  // Mê cung 2 tầng: Bông đi tầng trên đạp nút tắt gai cho Bắp đi tầng dưới
  // =========================================================================
  {
    name: 'Thử thách mê cung',
    tag: 'rẽ lối tìm nhau',
    icon: '🧩',
    difficulty: 'Gian nan',
    hint: 'Hai tầng mê cung tách biệt! Người đi tầng trên phải dẫm công tắc mở lối đi an toàn cho người ở tầng dưới.',
    theme: 'lavender',
    ropeMax: 380,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    plates: [
      { id: 'gate_btn', kind: 'button', x: 448, y: 320, w: 52, latchOn: true },
      { id: 'gate_btn2', kind: 'button', x: 832, y: 320, w: 52, latchOn: true },
    ],
    doors: [
      { x: 640, y: 448, w: 64, h: 192, needs: ['gate_btn'] },
      { x: 960, y: 448, w: 64, h: 192, needs: ['gate_btn2'] },
    ],
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....######..######..',
      '....######..######..',
      '....................',
      '....................',
      '....................',
      '....................',
      '####################',
    ],
  },

  // =========================================================================
  // MÀN 10: Bất biến tình duyên (Dây xích ngắn 220px)
  // Dây tơ hồng bị co ngắn! Hai bạn phải sát cánh từng bước không được rời xa
  // =========================================================================
  {
    name: 'Bất biến tình yêu',
    tag: 'sợi tơ gắn kết',
    icon: '💍',
    difficulty: 'Gian nan',
    hint: 'Sợi dây tơ hồng bị rút ngắn chỉ còn 220px! Hai bạn phải di chuyển cực kỳ đồng điệu, một bước lùi một bước tiến.',
    theme: 'day',
    ropeMax: 240,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    plates: [{ id: 'lock_btn', kind: 'plate', x: 640, y: 440, w: 70, latchOn: true }],
    doors: [{ x: 896, y: 448, w: 80, h: 192, needs: ['lock_btn'] }],
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '.........##.........',
      '......##.##.##......',
      '......##.##.##......',
      '####..##.##.##..####',
    ],
  },

  // =========================================================================
  // MÀN 11: Dốc băng trơn trượt (Sân trượt băng)
  // Giới thiệu cơ chế Băng (`~`): Ma sát cực thấp, trượt vun vút
  // =========================================================================
  {
    name: 'Dốc băng trơn trượt',
    tag: 'lướt gió cùng em',
    icon: '⛸️',
    difficulty: 'Gian nan',
    hint: 'Sàn băng ma sát cực trượt! Lấy đà phi nhanh qua hố chông băng, nhấn S để cắm mỏ neo dừng lại đúng lúc!',
    theme: 'mint',
    ropeMax: 380,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '.......~~~~.........',
      '..~~~~.~~~~..^^.....',
      '######.####.########',
    ],
  },

  // =========================================================================
  // MÀN 12: Cơn gió tình ca (Cột gió Thung lũng)
  // Giới thiệu cột gió thẳng đứng (`V` / vents): Bay bổng lên chín tầng mây
  // =========================================================================
  {
    name: 'Cơn gió tình ca',
    tag: 'bay trên chín tầng mây',
    icon: '🍃',
    difficulty: 'Gian nan',
    hint: 'Cột gió lốc đưa hai bạn bay bổng lên trời cao! Cùng nhau thả mình theo luồng gió để đáp xuống đài quan sát.',
    theme: 'day',
    ropeMax: 400,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 256, w: 130, h: 190 },
    vents: [{ x: 384, y: 256, w: 128, h: 384, power: 1750 }],
    tiles: [
      '....................',
      '....................',
      '................####',
      '................####',
      '......####......####',
      '......####......####',
      '....................',
      '....................',
      '....................',
      '....................',
      '####............####',
    ],
  },

  // =========================================================================
  // MÀN 13: Băng chuyền ngược lối (Băng chuyền cơ học)
  // Giới thiệu băng chuyền `<` và `>`: Bông chạy ngược dòng dẫm nút hỗ trợ Bắp
  // =========================================================================
  {
    name: 'Băng chuyền ngược lối',
    tag: 'ngược dòng tìm nhau',
    icon: '⚙️',
    difficulty: 'Thử thách cao',
    hint: 'Băng chuyền cuộn ngược đẩy lùi người chơi! Một người neo chắc chân để người kia dốc sức đạp nút hãm băng chuyền!',
    theme: 'sunset',
    ropeMax: 380,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    plates: [{ id: 'conv_btn', kind: 'button', x: 768, y: 396, w: 52, latchOn: true }],
    doors: [{ x: 960, y: 448, w: 80, h: 192, needs: ['conv_btn'] }],
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '...........##.......',
      '...........##.......',
      '.....<<<<<<##.......',
      '.....<<<<<<##...^^..',
      '#####<<<<<<##.######',
    ],
  },

  // =========================================================================
  // MÀN 14: Cổng không gian song sinh (Tinh vân Portal)
  // Giới thiệu Portal (@): Bước vào cổng xanh, phóng ra cổng cam vút qua vực
  // =========================================================================
  {
    name: 'Cổng không gian song sinh',
    tag: 'vượt không gian',
    icon: '🌀',
    difficulty: 'Thử thách cao',
    hint: 'Cổng dịch chuyển thời không! Bước vào cổng xanh ở bờ này, bạn sẽ lập tức bay vút ra từ cổng cam ở bờ bên kia!',
    theme: 'lavender',
    ropeMax: 420,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    portals: [{ a: { x: 384, y: 576 }, b: { x: 832, y: 448 } }],
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '............###.....',
      '............###.....',
      '............###.....',
      '....................',
      '#####^^^^^^^^^^^####',
    ],
  },

  // =========================================================================
  // MÀN 15: Đồng hồ định mệnh (Đếm ngược 8 giây)
  // Nút bấm có timer: 8 giây chạy nước rút vượt chướng ngại vật
  // =========================================================================
  {
    name: 'Đồng hồ định mệnh',
    tag: 'chạy đua thời gian',
    icon: '⏱️',
    difficulty: 'Cực hạn',
    hint: 'Tiếng còi đếm ngược 8 giây vang lên! Cả hai dắt tay nhau phi nước đại qua các rào chắn trước khi cửa sập đóng chặt!',
    theme: 'golden',
    ropeMax: 400,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    plates: [{ id: 'timer_btn', kind: 'button', x: 256, y: 460, w: 52, timer: 8.5 }],
    doors: [{ x: 960, y: 384, w: 80, h: 256, needs: ['timer_btn'] }],
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '...##...............',
      '...##...##..........',
      '...##...##......^^..',
      '##########......####',
    ],
  },

  // =========================================================================
  // MÀN 16: Đêm đen soi bóng (Bóng tối & Trái Tim)
  // Màn chơi bóng tối: Trái Tim là nguồn sáng duy nhất soi lối
  // =========================================================================
  {
    name: 'Đêm đen soi bóng',
    tag: 'ánh sáng con tim',
    icon: '🕯️',
    difficulty: 'Cực hạn',
    hint: 'Màn đêm buông xuống, chỉ Trái Tim và tình yêu quanh hai bạn mới thấu suốt đường đi. Luôn ôm Tim đi sát nhau để soi đường!',
    theme: 'night',
    ropeMax: 360,
    darkness: true,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    heart: { x: 288, y: 566 },
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '..........##........',
      '.....##...##........',
      '.....##...##...##...',
      '.....##...##...##...',
      '####...^^....^^..###',
    ],
  },

  // =========================================================================
  // MÀN 17: Tia sáng phân sắc (Laser hồng & xanh)
  // Laser hồng Bông đi qua, laser xanh Bắp đi qua
  // =========================================================================
  {
    name: 'Tia sáng phân sắc',
    tag: 'sắc màu tình yêu',
    icon: '⚡',
    difficulty: 'Cực hạn',
    hint: 'Laser hồng chỉ cho Bông qua, laser xanh cho Bắp qua. Bông dũng cảm qua laser hồng ấn nút tắt laser xanh cứu bạn!',
    theme: 'lavender',
    ropeMax: 400,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    lasers: [
      { x: 448, y: 448, w: 16, h: 192, color: 'pink' },
      { x: 768, y: 448, w: 16, h: 192, color: 'blue', needs: ['blue_off'] },
    ],
    plates: [{ id: 'blue_off', kind: 'button', x: 608, y: 440, w: 52, latchOn: true }],
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '.........###........',
      '.........###........',
      '.........###........',
      '####################',
    ],
  },

  // =========================================================================
  // MÀN 18: Bão tuyết & Bập bênh (Băng giá + Gió lốc)
  // Trượt băng lao vào bập bênh phóng thẳng vào luồng bão tuyết nhặt Tim
  // =========================================================================
  {
    name: 'Băng giá & Bão gió',
    tag: 'vượt ngàn sóng gió',
    icon: '❄️',
    difficulty: 'Cực hạn',
    hint: 'Trượt băng tốc độ cao lao vào bập bênh, phóng thẳng vào luồng bão tuyết bay vút lên trời nhặt Trái Tim trên đỉnh mây!',
    theme: 'mint',
    ropeMax: 440,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 384, w: 130, h: 190 },
    heart: { x: 704, y: 160 },
    seesaw: { x: 512, y: 596, w: 190, h: 20 },
    vents: [{ x: 672, y: 192, w: 128, h: 448, power: 1800 }],
    tiles: [
      '....................',
      '....................',
      '................####',
      '................####',
      '................####',
      '................####',
      '................####',
      '................####',
      '.......~~~~.....####',
      '....~~~~~~~.....####',
      '######.####.....####',
    ],
  },

  // =========================================================================
  // MÀN 19: Vực thẳm thời gian (Băng chuyền + Portal + Cửa hẹn giờ)
  // Tổ hợp cao cấp: Băng chuyền ngược, cổng dịch chuyển và đồng hồ đếm ngược
  // =========================================================================
  {
    name: 'Vực thẳm thời gian',
    tag: 'thử thách đỉnh cao',
    icon: '⏳',
    difficulty: 'Bậc thầy',
    hint: 'Băng chuyền ngược, cổng thời không và đồng hồ đếm ngược! Bông lên cổng kích hoạt 7.5s, cả hai ôm Tim lao ngược dòng vào đích!',
    theme: 'golden',
    ropeMax: 440,
    spawn: [{ x: 96, y: 640 }, { x: 160, y: 640 }],
    goal: { x: 1120, y: 640, w: 130, h: 190 },
    heart: { x: 128, y: 566 },
    portals: [{ a: { x: 256, y: 576 }, b: { x: 512, y: 256 } }],
    plates: [{ id: 'final_timer', kind: 'button', x: 512, y: 200, w: 52, timer: 7.5 }],
    doors: [{ x: 896, y: 384, w: 80, h: 256, needs: ['final_timer'] }],
    tiles: [
      '....................',
      '....................',
      '....................',
      '.......###..........',
      '.......###..........',
      '....................',
      '....................',
      '....................',
      '.....<<<<<<<<<......',
      '.....<<<<<<<<<......',
      '#####<<<<<<<<<######',
    ],
  },

  // =========================================================================
  // MÀN 20: Lâu đài định mệnh (Đại kết cục)
  // Hai tòa tháp đôi hoa hồng. Bông leo tháp trái, Bắp leo tháp phải mở Cổng Lễ Đường
  // =========================================================================
  {
    name: 'Lâu đài định mệnh',
    tag: 'chạm tới hạnh phúc',
    icon: '🏰',
    difficulty: 'Đại kết cục',
    hint: 'Đại Lâu Đài Tình Yêu ngập tràn hoa hồng! Bông leo tháp trái, Bắp leo tháp phải kích hoạt 2 công tắc mở Cổng Lễ Đường kết duyên!',
    theme: 'day',
    ropeMax: 460,
    spawn: [{ x: 608, y: 640 }, { x: 672, y: 640 }],
    goal: { x: 576, y: 640, w: 140, h: 190 },
    heart: { x: 640, y: 544 },
    plates: [
      { id: 'castle_left', kind: 'plate', x: 180, y: 256, w: 70, latchOn: true },
      { id: 'castle_right', kind: 'plate', x: 1056, y: 256, w: 70, latchOn: true },
    ],
    doors: [{ x: 576, y: 384, w: 128, h: 256, needs: ['castle_left', 'castle_right'] }],
    tiles: [
      '....................',
      '....................',
      '....................',
      '....................',
      '..####........####..',
      '..####........####..',
      '....................',
      '...##..........##...',
      '..###..........###..',
      '.####..........####.',
      '####################',
    ],
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
      const isOnlineHost = !!(window.GameNetwork && window.GameNetwork.isOnline && window.GameNetwork.isHost);
      if (isOnlineHost) {
        if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') {
          if (G.players[0]) G.players[0].jumpBuffer = 0.16;
        }
      } else {
        if (code === KEYS[0].jump && G.players[0]) G.players[0].jumpBuffer = 0.16;
        if (code === KEYS[1].jump && G.players[1]) G.players[1].jumpBuffer = 0.16;
        if (code === 'Space') {
          if (G.players[0]) G.players[0].jumpBuffer = 0.16;
          if (G.players[1] && !held.has('ArrowUp')) G.players[1].jumpBuffer = 0.16;
        }
      }
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
    const isOnlineHost = !!(window.GameNetwork && window.GameNetwork.isOnline && window.GameNetwork.isHost);
    if (isOnlineHost) {
      if ((code === 'KeyW' || code === 'ArrowUp' || code === 'Space') && G.players[0]) cutJump(G.players[0]);
    } else {
      if (code === KEYS[0].jump && G.players[0]) cutJump(G.players[0]);
      if (code === KEYS[1].jump && G.players[1]) cutJump(G.players[1]);
      if (code === 'Space') {
        if (G.players[0]) cutJump(G.players[0]);
        if (G.players[1] && !held.has('ArrowUp')) cutJump(G.players[1]);
      }
    }
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
    [dom.screenStart, dom.screenPause, dom.screenClear, dom.screenEnd, dom.screenLevelSelect].forEach((el) => {
      if (el) el.classList.add('hidden');
    });
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
    const c = tileAt(G.level, x, y);
    return c === '#' || c === '~' || c === '>' || c === '<';
  }
  function isSpike(x, y) {
    return tileAt(G.level, x, y) === '^';
  }
  function getGroundTile(p) {
    if (!G.level) return '.';
    const tx = Math.floor((p.x + p.w / 2) / T);
    const ty = Math.floor((p.y + p.h + 2) / T);
    return tileAt(G.level, tx, ty);
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
      landImpact: 0, launched: 0, portalCooldown: 0,
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
    G.vents = (L.vents || []).map(v => ({ ...v }));
    G.portals = (L.portals || []).map(p => ({ ...p }));
    G.lasers = (L.lasers || []).map(lz => ({ ...lz, opened: false }));
    G.darkness = !!L.darkness;
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

    if (dom.emoteBar) {
      if (window.GameNetwork && window.GameNetwork.isOnline) {
        dom.emoteBar.classList.remove('hidden');
      } else {
        dom.emoteBar.classList.add('hidden');
      }
    }

    if (window.GameNetwork && window.GameNetwork.isOnline && window.GameNetwork.isHost) {
      window.GameNetwork.changeLevel(idx);
    }

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
    if (window.GameNetwork && window.GameNetwork.isOnline && window.GameNetwork.isHost) {
      window.GameNetwork.changeLevel(G.levelIndex);
    }
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
    if (dom.emoteBar) dom.emoteBar.classList.add('hidden');
    if (window.GameNetwork && window.GameNetwork.isOnline) {
      window.GameNetwork.leaveRoom();
    }
    if (dom.roomStatus) dom.roomStatus.classList.add('hidden');
    if (dom.btnCreateRoom) dom.btnCreateRoom.disabled = false;
  }

  // ------------------------------------------------------------------- network sync payload helper
  function getHostSyncPayload(customMode) {
    const ps = G.players || [];
    const p1 = ps[0] || {};
    const p2 = ps[1] || {};
    return {
      p1: {
        x: Math.round(p1.x || 0),
        y: Math.round(p1.y || 0),
        vx: Math.round(p1.vx || 0),
        vy: Math.round(p1.vy || 0),
        onGround: !!p1.onGround,
        anchored: !!p1.anchored,
        face: p1.face || 1,
        walk: Math.round((p1.walk || 0) * 100) / 100,
        squash: Math.round((p1.squash || 0) * 100) / 100,
        bubble: p1.bubble ? { text: p1.bubble.text } : null
      },
      p2: {
        x: Math.round(p2.x || 0),
        y: Math.round(p2.y || 0),
        vx: Math.round(p2.vx || 0),
        vy: Math.round(p2.vy || 0),
        onGround: !!p2.onGround,
        anchored: !!p2.anchored,
        face: p2.face || 1,
        walk: Math.round((p2.walk || 0) * 100) / 100,
        squash: Math.round((p2.squash || 0) * 100) / 100,
        bubble: p2.bubble ? { text: p2.bubble.text } : null
      },
      doors: (G.doors || []).map(d => ({ opened: !!d.opened, openT: Math.round(d.openT * 100) / 100 })),
      plates: (G.plates || []).map(pl => ({ on: !!pl.on, live: !!pl.live, pressT: Math.round(pl.pressT * 100) / 100 })),
      lasers: (G.lasers || []).map(lz => ({ opened: !!lz.opened })),
      heart: G.heart ? { x: Math.round(G.heart.x), y: Math.round(G.heart.y), held: !!G.heart.held } : null,
      seesaw: G.seesaw ? { tilt: Math.round((G.seesaw.tilt || 0) * 100) / 100 } : null,
      stars: (G.stars || []).map(s => !!s.got),
      levelIndex: G.levelIndex,
      levelTime: Math.round((G.levelTime || 0) * 10) / 10,
      levelStars: G.levelStars || 0,
      levelFalls: G.levelFalls || 0,
      levelTauts: G.levelTauts || 0,
      shake: G.shake || 0,
      flash: G.flash || 0,
      dead: !!G.dead,
      mode: customMode || G.mode || 'playing'
    };
  }

  let prevRkJump = false;

  // ------------------------------------------------------------------- physics
  function update(dt) {
    if (G.mode !== 'playing') return;

    const isOnline = !!(window.GameNetwork && window.GameNetwork.isOnline);
    const isHost = !isOnline || window.GameNetwork.isHost;
    const isGuest = isOnline && !window.GameNetwork.isHost;

    if (isGuest) {
      // GUEST CLIENT-SIDE: Gửi phím và nội suy mượt từ Host (không chạy vật lý độc lập)
      const guestKeys = {
        left: held.has('KeyA') || held.has('ArrowLeft'),
        right: held.has('KeyD') || held.has('ArrowRight'),
        jump: held.has('KeyW') || held.has('ArrowUp') || held.has('Space'),
        anchor: held.has('KeyS') || held.has('ArrowDown'),
      };
      window.GameNetwork.sendGuestInput(guestKeys);

      const ps = G.players;
      for (const p of ps) {
        p.wasGround = p.onGround;
        p.blink -= dt;
        if (p.blink <= 0) { p.blink = rnd(2.2, 5.5); p.blinkT = 0.13; }
        if (p.blinkT > 0) p.blinkT = Math.max(0, p.blinkT - dt);
        if (p.bubble) { p.bubble.t -= dt; if (p.bubble.t <= 0) p.bubble = null; }
        p.squash += (0 - p.squash) * Math.min(1, dt * 16);
        p.portalCooldown = Math.max(0, (p.portalCooldown || 0) - dt);

        if (p.targetX !== undefined && p.targetY !== undefined) {
          const d = Math.hypot(p.targetX - p.x, p.targetY - p.y);
          if (d > 140) {
            p.x = p.targetX;
            p.y = p.targetY;
          } else {
            const lerpRate = Math.min(1, dt * 26);
            p.x += (p.targetX - p.x) * lerpRate;
            p.y += (p.targetY - p.y) * lerpRate;
          }
        }
      }

      if (G.heart && G.heart.targetX !== undefined && G.heart.targetY !== undefined) {
        const lerpRate = Math.min(1, dt * 24);
        G.heart.x += (G.heart.targetX - G.heart.x) * lerpRate;
        G.heart.y += (G.heart.targetY - G.heart.y) * lerpRate;
      }

      if (G.seesaw) seesawTick(dt);

      if (G.doors) {
        for (const d of G.doors) {
          if (d.targetOpenT !== undefined) {
            d.openT += (d.targetOpenT - d.openT) * Math.min(1, dt * 12);
          }
        }
      }
      if (G.plates) {
        for (const pl of G.plates) {
          if (pl.targetPressT !== undefined) {
            pl.pressT += (pl.targetPressT - pl.pressT) * Math.min(1, dt * 12);
          }
        }
      }

      G.flash = Math.max(0, G.flash - dt * 3);
      G.fade = Math.max(0, G.fade - dt * 3.2);

      if (ps[0] && ps[1]) {
        G.ropeDist = Math.hypot(ps[1].x - ps[0].x, ps[1].y - ps[0].y);
      }

      if (G.stars) {
        for (const s of G.stars) {
          if (!s.got) s.phase += dt * 3;
        }
      }

      return;
    }

    // AUTHORITATIVE SIMULATION (HOST & LOCAL)
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

    // Host nhận phím từ Guest Player 2
    if (isOnline && isHost) {
      const rk = window.GameNetwork.remoteKeys || {};
      if (rk.jump && !prevRkJump) {
        ps[1].jumpBuffer = 0.18;
      }
      if (!rk.jump && prevRkJump) {
        cutJump(ps[1]);
      }
      prevRkJump = !!rk.jump;
    }

    // anchor (chỉ có tác dụng khi đang đứng trên mặt đất)
    for (const p of ps) {
      let isHoldingAnchor = false;
      if (isOnline && isHost) {
        if (p.i === 0) {
          isHoldingAnchor = held.has('KeyS') || held.has('ArrowDown');
        } else {
          isHoldingAnchor = !!(window.GameNetwork.remoteKeys && window.GameNetwork.remoteKeys.anchor);
        }
      } else {
        isHoldingAnchor = held.has(KEYS[p.i].anchor);
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
      let dir = 0;
      if (isOnline && isHost) {
        if (p.i === 0) {
          dir = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
        } else {
          const rk = window.GameNetwork.remoteKeys || {};
          dir = (rk.right ? 1 : 0) - (rk.left ? 1 : 0);
        }
      } else {
        const k = KEYS[p.i];
        const manualDir = (held.has(k.right) ? 1 : 0) - (held.has(k.left) ? 1 : 0);
        if (p.i === 1 && manualDir === 0 && (held.has('Space') || (ps[0] && Math.hypot(ps[0].x - p.x, ps[0].y - p.y) > (G.ropeMax || 300) * 0.82))) {
          // Companion Follow Assist: P2 dắt tay theo P1 khi giữ Space hoặc khi dây tơ hồng kéo căng
          const distToP1 = ps[0].x - p.x;
          if (Math.abs(distToP1) > 52) {
            dir = Math.sign(distToP1);
          }
          if (ps[0].vy < -260 && p.onGround && Math.random() < 0.3) {
            p.jumpBuffer = 0.16;
          }
        } else {
          dir = manualDir;
        }
      }

      if (p.anchored) {
        p.vx = approach(p.vx, 0, 6000 * dt);
      } else if (dir !== 0) {
        p.vx = approach(p.vx, dir * RUN, (p.wasGround ? ACC_GROUND : ACC_AIR) * dt);
        p.face = dir;
      } else if (p.launched > 0) {
        // giữ đà bật bập bênh, không hãm ngang
      } else {
        const gt = p.wasGround ? getGroundTile(p) : '.';
        const f = gt === '~' ? 120 : (p.wasGround ? FRICTION : AIR_DRAG);
        p.vx = approach(p.vx, 0, f * dt);
      }

      // Băng chuyền đẩy (Conveyor belt push)
      if (p.onGround || p.wasGround) {
        const gt = getGroundTile(p);
        if (gt === '>') {
          p.vx = approach(p.vx, RUN * 1.15, 900 * dt);
        } else if (gt === '<') {
          p.vx = approach(p.vx, -RUN * 1.15, 900 * dt);
        }
      }

      p.portalCooldown = Math.max(0, (p.portalCooldown || 0) - dt);
      p.vy = Math.min(MAX_FALL, p.vy + (p.vy > 0 ? GRAV_DOWN : GRAV_UP) * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    resolvePlayers();
    applyRope();
    for (const p of ps) collide(p);

    // Cột gió đẩy lên (Wind Vents)
    if (G.vents) {
      for (const v of G.vents) {
        for (const p of ps) {
          if (p.x + p.w > v.x && p.x < v.x + v.w && p.y + p.h > v.y && p.y < v.y + v.h) {
            p.vy -= (v.power || 1600) * dt;
            p.onGround = false;
            if (Math.random() < 0.25) {
              spawnDust(p.x + rnd(2, p.w - 2), p.y + p.h, 1, '#bae6fd');
            }
          }
        }
      }
    }

    // Cổng dịch chuyển thời không (Portals)
    if (G.portals) {
      for (const pt of G.portals) {
        for (const p of ps) {
          if ((p.portalCooldown || 0) <= 0) {
            const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
            const da = Math.hypot(pcx - pt.a.x, pcy - pt.a.y);
            const db = Math.hypot(pcx - pt.b.x, pcy - pt.b.y);
            if (da < 36) {
              p.x = pt.b.x - p.w / 2;
              p.y = pt.b.y - p.h / 2;
              p.portalCooldown = 0.9;
              burst(pt.b.x, pt.b.y, 14, '#c084fc', 1.2);
              spawnHearts(pt.b.x, pt.b.y, 4);
              sfx('boost');
            } else if (db < 36) {
              p.x = pt.a.x - p.w / 2;
              p.y = pt.a.y - p.h / 2;
              p.portalCooldown = 0.9;
              burst(pt.a.x, pt.a.y, 14, '#38bdf8', 1.2);
              spawnHearts(pt.a.x, pt.a.y, 4);
              sfx('boost');
            }
          }
        }
      }
    }

    // Tia Laser nguy hiểm (Lasers)
    if (G.lasers) {
      for (const lz of G.lasers) {
        if (lz.opened) continue;
        for (const p of ps) {
          if (lz.color === 'pink' && p.i === 0) continue;
          if (lz.color === 'blue' && p.i === 1) continue;
          const bx1 = p.x + 6, bx2 = p.x + p.w - 6;
          const by1 = p.y + 6, by2 = p.y + p.h - 2;
          if (bx2 > lz.x && bx1 < lz.x + lz.w && by2 > lz.y && by1 < lz.y + lz.h) {
            die();
            return;
          }
        }
      }
    }

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

    // Host đồng bộ state xuống Guest qua Firebase (20 lần / giây)
    if (isOnline && isHost) {
      G._netSyncT = (G._netSyncT || 0) + dt;
      if (G._netSyncT >= 0.05) {
        G._netSyncT = 0;
        window.GameNetwork.broadcastHostState(getHostSyncPayload());
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
      if (d.opened || (d.openT !== undefined && d.openT > 0.7)) continue;
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
        // Đàn hồi mềm mại: triệt tiêu hiện tượng giật cục giật màn hình
        const relax = over > 24 ? 0.95 : 0.85;
        a.x += nx * over * (aw / sum) * relax;
        a.y += ny * over * (aw / sum) * relax;
        b.x -= nx * over * (bw / sum) * relax;
        b.y -= ny * over * (bw / sum) * relax;

        // Triệt tiêu vận tốc ly tâm dọc sợi dây
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel > 0) {
          a.vx += nx * rel * (aw / sum) * 0.86;
          a.vy += ny * rel * (aw / sum) * 0.86;
          b.vx -= nx * rel * (bw / sum) * 0.86;
          b.vy -= ny * rel * (bw / sum) * 0.86;
        }

        // Lực kéo đàn hồi tự nhiên mượt mà
        const pullSpring = Math.min(2200, over * 40);
        a.vx += nx * pullSpring * (aw / sum) * STEP;
        b.vx -= nx * pullSpring * (bw / sum) * STEP;
      }
      if (over > 12 && G.tautCd <= 0) {
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

    if (window.GameNetwork && window.GameNetwork.isOnline && window.GameNetwork.isHost) {
      window.GameNetwork.broadcastHostState(getHostSyncPayload());
    }
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
      if (pl.timer) {
        if (live && !pl.wasLive) {
          pl.timeLeft = pl.timer;
          pl.on = true;
        }
        if (pl.timeLeft > 0) {
          pl.timeLeft -= dt;
          if (pl.timeLeft <= 0) {
            pl.timeLeft = 0;
            pl.on = false;
          }
        }
      }
      pl.pressT = approach(pl.pressT || 0, live ? 1 : 0, dt * 9);
    }

    // Cập nhật trạng thái mở tia Laser từ công tắc/nút bấm
    if (G.lasers) {
      for (const lz of G.lasers) {
        if (lz.needs) {
          const needsArr = Array.isArray(lz.needs) ? lz.needs : [lz.needs];
          const ok = needsArr.every(id => {
            const pl = G.plates.find(q => q.id === id);
            return pl && (pl.timer ? (pl.timeLeft > 0) : (pl.latchOn ? pl.on : pl.live));
          });
          lz.opened = ok;
        }
      }
    }

    for (const d of G.doors) {
      const ok = d.needs.every((id) => {
        const pl = G.plates.find((q) => q.id === id);
        return pl && (pl.timer ? (pl.timeLeft > 0) : (pl.latchOn ? pl.on : pl.live));
      });
      const hasTimer = d.needs.some(id => G.plates.find(q => q.id === id && q.timer));
      if (hasTimer) {
        d.opened = ok;
        d.openT = approach(d.openT || 0, ok ? 1 : 0, dt * 2.5);
      } else {
        if (d.opened) { d.openT = Math.min(1, d.openT + dt * 1.6); continue; }
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
    saveLevelProgress(G.levelIndex, G.levelStars);
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

    const isOnline = !!(window.GameNetwork && window.GameNetwork.isOnline);
    const isGuest = isOnline && !window.GameNetwork.isHost;

    if (isGuest) {
      dom.btnNext.textContent = 'Chờ chủ phòng bấm tiếp...';
      dom.btnNext.disabled = true;
    } else {
      dom.btnNext.textContent = G.levelIndex + 1 >= LEVELS.length ? 'Về đích thôi' : 'Màn tiếp theo';
      dom.btnNext.disabled = false;
      if (isOnline && window.GameNetwork.isHost) {
        window.GameNetwork.broadcastHostState(getHostSyncPayload('clear'));
      }
    }

    dom.screenClear.classList.remove('hidden');
    G.uiReady = false;
    setTimeout(() => {
      G.uiReady = true;
      if (!isGuest) dom.btnNext.focus({ preventScroll: true });
    }, 420);
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

    if (window.GameNetwork && window.GameNetwork.isOnline && window.GameNetwork.isHost) {
      window.GameNetwork.broadcastHostState(getHostSyncPayload('ending'));
    }
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
    if (G.vents) for (const v of G.vents) drawWindVent(v, t);
    if (G.portals) for (const pt of G.portals) drawPortal(pt, t);
    if (G.lasers) for (const lz of G.lasers) drawLaser(lz, t);
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
    if (G.darkness) drawDarkness(t);
    drawVignette();
  }

  function drawLevelTiles(t) {
    const th = G.theme;
    const L = G.level;

    // Lớp nền gạch chính
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = tileAt(L, x, y);
        if (c === '#') drawDirtTile(x, y, th);
        else if (c === '^') drawSpikes(x, y, t);
        else if (c === '~') drawIceTile(x, y, t);
        else if (c === '>') drawConveyorTile(x, y, t, 1);
        else if (c === '<') drawConveyorTile(x, y, t, -1);
      }
    }

    // Viền trên cỏ xanh/hoa rủ mềm mại (Organic Lush Grass Crest)
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (tileAt(L, x, y) !== '#') continue;
        if (tileAt(L, x, y - 1) === '#') continue;
        const px = x * T, py = y * T;
        const leftHas = tileAt(L, x - 1, y) === '#';
        const rightHas = tileAt(L, x + 1, y) === '#';

        // Lớp cỏ gợn sóng chính
        ctx.fillStyle = th.grass;
        ctx.beginPath();
        ctx.moveTo(px, py + 16);
        ctx.lineTo(px, py + 4);
        if (!leftHas) ctx.quadraticCurveTo(px, py, px + 6, py);
        else ctx.lineTo(px, py);
        
        ctx.lineTo(rightHas ? px + T : px + T - 6, py);
        if (!rightHas) ctx.quadraticCurveTo(px + T, py, px + T, py + 4);
        ctx.lineTo(px + T, py + 16);
        // viền đáy lượn sóng tự nhiên
        for (let s = T; s >= 0; s -= 16) {
          const wave = Math.sin((x * T + s) * 0.15) * 3;
          ctx.lineTo(px + s, py + 15 + wave);
        }
        ctx.closePath();
        ctx.fill();

        // Viền bóng dưới lớp cỏ
        ctx.fillStyle = th.grassDark;
        ctx.fillRect(px, py + 16, T, 2.5);

        // Hoa dại lay động trên đỉnh cỏ
        const flowerSeed = (x * 47 + y * 97) % 5;
        if (flowerSeed === 1 || flowerSeed === 3) {
          const fx = px + 16 + flowerSeed * 8;
          const sway = Math.sin(t * 3 + x) * 1.5;
          ctx.fillStyle = flowerSeed === 1 ? '#ffaec9' : '#fff3a8';
          ellipse(fx + sway, py - 3, 3.5, 3.5);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ellipse(fx + sway, py - 3, 1.5, 1.5);
          ctx.fill();
        }

        // Bóng đổ mép trái/phải nếu là bờ vực
        if (!leftHas) {
          ctx.fillStyle = 'rgba(0,0,0,.08)';
          ctx.fillRect(px, py + 4, 4, T - 4);
        }
        if (!rightHas) {
          ctx.fillStyle = 'rgba(0,0,0,.08)';
          ctx.fillRect(px + T - 4, py + 4, 4, T - 4);
        }
      }
    }
  }

  function drawDirtTile(x, y, th) {
    const px = x * T, py = y * T;
    // Nền đất ấm áp
    ctx.fillStyle = th.dirt;
    ctx.fillRect(px, py, T, T);

    // Vân đá ngầm sỏi sọc
    ctx.fillStyle = th.dirtDark;
    const h = (x * 73856093) ^ (y * 19349663);
    for (let i = 0; i < 3; i++) {
      const a = Math.abs(Math.sin(h + i * 12.9898)) * 0.5 + 0.5;
      const b = Math.abs(Math.sin(h * 1.7 + i * 4.1)) * 0.5 + 0.5;
      ctx.globalAlpha = 0.32;
      ellipse(px + 8 + a * (T - 16), py + 22 + b * (T - 30), 3, 2);
      ctx.fill();
    }
    // Vân sọc địa tầng nằm ngang
    ctx.globalAlpha = 0.12;
    ctx.fillRect(px, py + 28, T, 3);
    ctx.fillRect(px + 4, py + 46, T - 8, 2);
    ctx.globalAlpha = 1;
  }

  // Chông Gai Tinh Thể Pha Lê Thạch Anh (Amethyst & Rose Quartz Gemstone Spikes)
  function drawSpikes(x, y, t) {
    const px = x * T, py = y * T;

    // Chân đế kim loại mạ đồng bảo vệ
    ctx.fillStyle = '#2d1b33';
    rr(px + 4, py + T - 8, T - 8, 8, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 77, 132, 0.25)';
    ellipse(px + T / 2, py + T - 5, T * 0.44, 4);
    ctx.fill();

    // 3 tinh thể pha lê giác cắt sắc nét
    for (let i = 0; i < 3; i++) {
      const sx = px + 8 + i * 17;
      const base = py + T - 6;
      const tipY = py + 16 + (i === 1 ? 0 : 5);
      const tipX = sx + 7;

      // Hào quang nguy hiểm quanh mũi chông
      ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
      ellipse(tipX, tipY + 4, 9, 12);
      ctx.fill();

      // Mặt trái tinh thể (tối hơn)
      ctx.beginPath();
      ctx.moveTo(sx, base);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(tipX, base);
      ctx.closePath();
      const gLeft = ctx.createLinearGradient(sx, tipY, sx, base);
      gLeft.addColorStop(0, '#fbcfe8');
      gLeft.addColorStop(0.5, '#db2777');
      gLeft.addColorStop(1, '#831843');
      ctx.fillStyle = gLeft;
      ctx.fill();

      // Mặt phải tinh thể (sáng hơn, phản chiếu)
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(sx + 14, base);
      ctx.lineTo(tipX, base);
      ctx.closePath();
      const gRight = ctx.createLinearGradient(sx + 7, tipY, sx + 7, base);
      gRight.addColorStop(0, '#ffffff');
      gRight.addColorStop(0.4, '#f472b6');
      gRight.addColorStop(1, '#9d174d');
      ctx.fillStyle = gRight;
      ctx.fill();

      // Viền sắc cạnh tinh thể
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx, base);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(sx + 14, base);
      ctx.stroke();

      // Đốm sáng lóe lên ở đỉnh chông nhọn
      const glint = Math.sin(t * 5 + i * 2) > 0.6;
      if (glint) {
        ctx.fillStyle = '#ffffff';
        ellipse(tipX, tipY, 2, 2);
        ctx.fill();
      }
    }
  }

  // Sàn Băng Tuyết Pha Lê (Glacial Crystal Ice)
  function drawIceTile(x, y, t) {
    const px = x * T, py = y * T;
    const grad = ctx.createLinearGradient(px, py, px, py + T);
    grad.addColorStop(0, '#f0f9ff');
    grad.addColorStop(0.4, '#bae6fd');
    grad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = grad;
    rr(px, py, T, T, 4);
    ctx.fill();

    // Vệt sáng lấp lánh phản quang (Sheen)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(px, py, T, 4);

    // Vết nứt tinh thể băng nghệ thuật
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 12);
    ctx.lineTo(px + 22, py + 36);
    ctx.lineTo(px + 30, py + 30);
    ctx.moveTo(px + 36, py + 8);
    ctx.lineTo(px + 50, py + 42);
    ctx.stroke();

    // Bụi tuyết bay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ellipse(px + 14, py + 22, 1.8, 1.8); ctx.fill();
    ellipse(px + 44, py + 32, 1.5, 1.5); ctx.fill();
  }

  // Băng Chuyền Cơ Khí Steampunk (Mechanical Conveyor Belt)
  function drawConveyorTile(x, y, t, dir) {
    const px = x * T, py = y * T;
    // Khung kim loại đúc đồng
    ctx.fillStyle = '#1e293b';
    rr(px, py, T, T, 4);
    ctx.fill();

    // Mặt đường ray cơ khí
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px, py + 2, T, 16);

    // Mũi tên neon chuyển động mượt mà
    const offset = ((t * 90 * dir) % 20 + 20) % 20;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let ox = -20; ox <= T + 20; ox += 20) {
      const cx = px + ox + offset;
      if (cx >= px + 6 && cx <= px + T - 6) {
        ctx.beginPath();
        if (dir > 0) {
          ctx.moveTo(cx - 4, py + 5);
          ctx.lineTo(cx + 3, py + 10);
          ctx.lineTo(cx - 4, py + 15);
        } else {
          ctx.moveTo(cx + 4, py + 5);
          ctx.lineTo(cx - 3, py + 10);
          ctx.lineTo(cx + 4, py + 15);
        }
        ctx.stroke();
      }
    }

    // Bánh răng xoay tròn ở hai đầu
    const rot = t * 6 * dir;
    for (const bx of [px + 16, px + T - 16]) {
      const by = py + 38;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rot);
      ctx.fillStyle = '#475569';
      ellipse(0, 0, 9, 9); ctx.fill();
      // răng cưa
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
      ctx.moveTo(0, -10); ctx.lineTo(0, 10);
      ctx.stroke();
      // trục giữa
      ctx.fillStyle = '#cbd5e1';
      ellipse(0, 0, 4, 4); ctx.fill();
      ctx.restore();
    }
  }

  // Cột Gió Lốc Thần Tiên (Zephyr Air Updraft Vent)
  function drawWindVent(v, t) {
    const by = v.y + v.h - 16;
    // Bệ phát gió mạ kim loại
    ctx.fillStyle = '#334155';
    rr(v.x + 4, by, v.w - 8, 16, 6); ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(v.x + 10, by + 4, v.w - 20, 2);
    ctx.fillRect(v.x + 10, by + 9, v.w - 20, 2);

    ctx.save();
    // Vùng gió thần tiên phát sáng
    const grad = ctx.createLinearGradient(v.x, by, v.x, v.y);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
    grad.addColorStop(0.65, 'rgba(186, 230, 253, 0.22)');
    grad.addColorStop(1, 'rgba(224, 242, 254, 0.01)');
    ctx.fillStyle = grad;
    ctx.fillRect(v.x + 6, v.y, v.w - 12, v.h - 16);

    // Các dải lụa gió uốn lượn hình sin và cánh hoa bay bổng
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) {
      const lx = v.x + 14 + i * ((v.w - 28) / 3);
      const shift = ((t * 240 + i * 80) % (v.h - 24));
      const ly = by - shift;
      const wave = Math.sin(t * 6 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.quadraticCurveTo(lx + wave, ly - 16, lx, ly - 32);
      ctx.stroke();

      // Cánh hoa/bụi tiên lấp lánh
      ctx.fillStyle = i % 2 === 0 ? '#fbcfe8' : '#e0f2fe';
      ellipse(lx + wave, ly - 16, 2.5, 2.5);
      ctx.fill();
    }
    ctx.restore();
  }

  // Cổng Thời Không Lượng Tử (Astral Celestial Vortex Portal)
  function drawPortalRing(cx, cy, color1, color2, t) {
    ctx.save();
    const pulse = Math.sin(t * 4) * 3;
    const rx = 24 + pulse;
    const ry = 38 + pulse * 0.6;

    // Hào quang vũ trụ tỏa rộng
    const aura = ctx.createRadialGradient(cx, cy, 6, cx, cy, rx + 16);
    aura.addColorStop(0, color1);
    aura.addColorStop(0.7, color2);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 16, ry + 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tâm không gian đen huyền bí
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vòng rune xoay ngoài
    ctx.strokeStyle = color1;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, t * 2, 0, Math.PI * 2);
    ctx.stroke();

    // Vòng rune xoay trong ngược chiều
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.65, ry * 0.65, -t * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Vì sao lấp lánh quay quanh tâm
    for (let s = 0; s < 3; s++) {
      const ang = t * 4 + s * ((Math.PI * 2) / 3);
      const px = cx + Math.cos(ang) * (rx * 0.5);
      const py = cy + Math.sin(ang) * (ry * 0.5);
      ctx.fillStyle = '#ffffff';
      ellipse(px, py, 2.5, 2.5);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPortal(pt, t) {
    drawPortalRing(pt.a.x, pt.a.y, '#f43f5e', 'rgba(244, 63, 94, 0.3)', t);
    drawPortalRing(pt.b.x, pt.b.y, '#06b6d4', 'rgba(6, 182, 212, 0.3)', t + Math.PI);
  }

  // Rào Chắn Laser Công Nghệ Cao (Neon Beam Deflector)
  function drawLaser(lz, t) {
    ctx.save();
    const isOff = !!lz.opened;
    const col = lz.color === 'pink' ? '#ff3377' : (lz.color === 'blue' ? '#00b4d8' : '#ef4444');
    const glowCol = lz.color === 'pink' ? 'rgba(255, 51, 119, 0.5)' : (lz.color === 'blue' ? 'rgba(0, 180, 216, 0.5)' : 'rgba(239, 68, 68, 0.5)');

    // Chân đế kim loại phát laser
    ctx.fillStyle = '#1e293b';
    rr(lz.x - 5, lz.y, lz.w + 10, 10, 3); ctx.fill();
    rr(lz.x - 5, lz.y + lz.h - 10, lz.w + 10, 10, 3); ctx.fill();

    if (isOff) {
      // Đèn báo xanh an toàn
      ctx.fillStyle = '#22c55e';
      ellipse(lz.x + lz.w / 2, lz.y + 5, 3, 3); ctx.fill();
      ellipse(lz.x + lz.w / 2, lz.y + lz.h - 5, 3, 3); ctx.fill();
      ctx.restore();
      return;
    }

    // Đèn báo năng lượng nguy hiểm
    ctx.fillStyle = col;
    ellipse(lz.x + lz.w / 2, lz.y + 5, 3.5, 3.5); ctx.fill();
    ellipse(lz.x + lz.w / 2, lz.y + lz.h - 5, 3.5, 3.5); ctx.fill();

    const beamW = lz.w + Math.sin(t * 20) * 2;
    const cx = lz.x + lz.w / 2;

    // Hào quang laser nở rộng
    ctx.fillStyle = glowCol;
    ctx.fillRect(cx - beamW * 1.6, lz.y + 10, beamW * 3.2, lz.h - 20);

    // Lõi laser màu chủ đạo
    ctx.fillStyle = col;
    ctx.fillRect(cx - beamW / 2, lz.y + 10, beamW, lz.h - 20);

    // Lõi plasma trắng tinh khiết
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 2, lz.y + 10, 4, lz.h - 20);

    // Hạt điện từ phát tán
    if (Math.random() < 0.35) {
      const py = lz.y + rnd(12, lz.h - 12);
      ctx.fillStyle = '#ffffff';
      ellipse(cx + rnd(-6, 6), py, 2, 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Tối ưu hóa Darkness (Cached Canvas)
  let darknessCanvas = null;
  function drawDarkness(t) {
    ctx.save();
    if (!darknessCanvas) {
      darknessCanvas = document.createElement('canvas');
      darknessCanvas.width = W;
      darknessCanvas.height = H;
    }
    const octx = darknessCanvas.getContext('2d');
    octx.clearRect(0, 0, W, H);

    octx.fillStyle = 'rgba(10, 15, 28, 0.94)';
    octx.fillRect(0, 0, W, H);

    octx.globalCompositeOperation = 'destination-out';

    for (const p of G.players) {
      const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
      const rad = 185 + Math.sin(t * 3 + p.i) * 6;
      const g = octx.createRadialGradient(pcx, pcy, 35, pcx, pcy, rad);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      octx.fillStyle = g;
      octx.beginPath();
      octx.arc(pcx, pcy, rad, 0, Math.PI * 2);
      octx.fill();
    }

    if (G.goal) {
      const gcx = G.goal.x + G.goal.w / 2, gcy = G.goal.y + G.goal.h / 2;
      const g = octx.createRadialGradient(gcx, gcy, 20, gcx, gcy, 130);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      octx.fillStyle = g;
      octx.beginPath();
      octx.arc(gcx, gcy, 130, 0, Math.PI * 2);
      octx.fill();
    }

    if (G.heart) {
      const hx = G.heart.x, hy = G.heart.y;
      const g = octx.createRadialGradient(hx, hy, 15, hx, hy, 140);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      octx.fillStyle = g;
      octx.beginPath();
      octx.arc(hx, hy, 140, 0, Math.PI * 2);
      octx.fill();
    }

    octx.globalCompositeOperation = 'source-over';
    ctx.drawImage(darknessCanvas, 0, 0);
    ctx.restore();
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
      if (pl.timer && pl.timeLeft > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(pl.timeLeft) + 's', 0, -32);
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
        if (window.GameNetwork && window.GameNetwork.isOnline && window.GameNetwork.isHost) {
          G._netSyncT = (G._netSyncT || 0) + dt;
          if (G._netSyncT >= 0.05) {
            G._netSyncT = 0;
            window.GameNetwork.broadcastHostState(getHostSyncPayload());
          }
        }
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

  // ------------------------------------------------------------------- level select & progress
  function getLevelRecords() {
    try {
      const raw = localStorage.getItem('dinhnhau.progress');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { maxUnlocked: 0, stars: {} };
  }

  function saveLevelProgress(lvlIdx, starsCount) {
    try {
      const rec = getLevelRecords();
      rec.stars = rec.stars || {};
      rec.stars[lvlIdx] = Math.max(rec.stars[lvlIdx] || 0, starsCount || 0);
      rec.maxUnlocked = Math.max(rec.maxUnlocked || 0, lvlIdx + 1);
      localStorage.setItem('dinhnhau.progress', JSON.stringify(rec));
    } catch (e) {}
  }

  function renderLevelGrid() {
    if (!dom.levelGrid) return;
    const rec = getLevelRecords();
    dom.levelGrid.innerHTML = '';

    LEVELS.forEach((lvl, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-card-btn' + (idx === G.levelIndex ? ' active' : '');
      const starsEarned = (rec.stars && rec.stars[idx]) || 0;
      const starText = '★'.repeat(starsEarned) + '☆'.repeat(3 - starsEarned);
      const icon = lvl.icon || '🌸';
      const numStr = '#' + (idx + 1).toString().padStart(2, '0');
      const diff = lvl.difficulty || 'Thử thách';

      btn.innerHTML = `
        <div class="lvl-header">
          <span class="lvl-num">${numStr}</span>
          <span class="lvl-icon">${icon}</span>
        </div>
        <span class="lvl-name">${lvl.name}</span>
        <span class="lvl-tag">${lvl.tag || ''}</span>
        <span class="lvl-diff">${diff}</span>
        <span class="lvl-stars">${starText}</span>
      `;

      btn.addEventListener('click', () => {
        closeLevelSelect();
        if (window.GameNetwork && window.GameNetwork.isOnline && !window.GameNetwork.isHost) {
          alert('Chỉ chủ phòng mới có thể chọn đổi màn chơi online!');
          return;
        }
        buildLevel(idx);
        canvas.focus({ preventScroll: true });
      });

      dom.levelGrid.appendChild(btn);
    });
  }

  function openLevelSelect() {
    renderLevelGrid();
    dom.screenLevelSelect.classList.remove('hidden');
    dom.screenPause.classList.add('hidden');
    dom.screenStart.classList.add('hidden');
  }

  function closeLevelSelect() {
    dom.screenLevelSelect.classList.add('hidden');
    if (G.mode === 'paused') {
      dom.screenPause.classList.remove('hidden');
    } else if (G.mode === 'menu') {
      dom.screenStart.classList.remove('hidden');
    }
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
  if (dom.btnOpenLevelSelect) dom.btnOpenLevelSelect.addEventListener('click', openLevelSelect);
  if (dom.btnPauseLevelSelect) dom.btnPauseLevelSelect.addEventListener('click', openLevelSelect);
  if (dom.btnCloseLevelSelect) dom.btnCloseLevelSelect.addEventListener('click', closeLevelSelect);
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
    if (!window.GameNetwork || !window.GameNetwork.isOnline || window.GameNetwork.isHost || !st) return;

    // Đồng bộ màn nếu lệch
    if (typeof st.levelIndex === 'number' && st.levelIndex !== G.levelIndex) {
      buildLevel(st.levelIndex);
      return;
    }

    // Đồng bộ trạng thái chơi / kết thúc màn / kết game
    if (st.mode === 'clear' && G.mode !== 'clear') {
      G.levelTime = st.levelTime || G.levelTime;
      G.levelFalls = st.levelFalls || G.levelFalls;
      G.levelTauts = st.levelTauts || G.levelTauts;
      G.levelStars = st.levelStars || G.levelStars;
      completeLevel();
      return;
    }
    if (st.mode === 'playing' && G.mode === 'clear') {
      dom.screenClear.classList.add('hidden');
      G.mode = 'playing';
    }
    if (st.mode === 'ending' && G.mode !== 'ending') {
      showEnding();
      return;
    }

    // Đồng bộ chết / hồi sinh
    if (st.dead && !G.dead) {
      die();
    } else if (!st.dead && G.dead) {
      resetPlayers();
    }

    // Cập nhật vị trí đích để nội suy mượt 60fps trên Guest
    if (st.p1 && G.players[0]) {
      const p = G.players[0];
      p.targetX = st.p1.x;
      p.targetY = st.p1.y;
      p.vx = st.p1.vx;
      p.vy = st.p1.vy;
      p.onGround = st.p1.onGround;
      p.anchored = st.p1.anchored;
      p.face = st.p1.face;
      p.walk = st.p1.walk;
      p.squash = st.p1.squash;
      if (st.p1.bubble && (!p.bubble || p.bubble.text !== st.p1.bubble.text)) {
        say(p, st.p1.bubble.text);
      }
    }
    if (st.p2 && G.players[1]) {
      const p = G.players[1];
      p.targetX = st.p2.x;
      p.targetY = st.p2.y;
      p.vx = st.p2.vx;
      p.vy = st.p2.vy;
      p.onGround = st.p2.onGround;
      p.anchored = st.p2.anchored;
      p.face = st.p2.face;
      p.walk = st.p2.walk;
      p.squash = st.p2.squash;
      if (st.p2.bubble && (!p.bubble || p.bubble.text !== st.p2.bubble.text)) {
        say(p, st.p2.bubble.text);
      }
    }

    // Đồng bộ cửa
    if (st.doors && G.doors) {
      st.doors.forEach((d, idx) => {
        if (G.doors[idx]) {
          G.doors[idx].opened = d.opened;
          G.doors[idx].targetOpenT = d.openT;
        }
      });
    }

    // Đồng bộ công tắc
    if (st.plates && G.plates) {
      st.plates.forEach((pl, idx) => {
        if (G.plates[idx]) {
          G.plates[idx].on = pl.on;
          G.plates[idx].live = pl.live;
          G.plates[idx].targetPressT = pl.pressT;
        }
      });
    }

    // Đồng bộ tia laze
    if (st.lasers && G.lasers) {
      st.lasers.forEach((lz, idx) => {
        if (G.lasers[idx]) {
          G.lasers[idx].opened = lz.opened;
        }
      });
    }

    // Đồng bộ sao
    if (st.stars && G.stars) {
      st.stars.forEach((got, idx) => {
        if (G.stars[idx]) {
          if (!G.stars[idx].got && got) {
            spawnHearts(G.stars[idx].x, G.stars[idx].y, 5);
            sfx('star');
          }
          G.stars[idx].got = got;
        }
      });
    }

    // Đồng bộ tim
    if (st.heart && G.heart) {
      G.heart.targetX = st.heart.x;
      G.heart.targetY = st.heart.y;
      G.heart.held = st.heart.held;
    }

    // Đồng bộ bập bênh
    if (st.seesaw && G.seesaw) {
      G.seesaw.tilt = st.seesaw.tilt;
    }

    if (typeof st.shake === 'number') G.shake = st.shake;
    if (typeof st.flash === 'number' && st.flash > G.flash) G.flash = st.flash;
    if (typeof st.levelTime === 'number') G.levelTime = st.levelTime;
    if (typeof st.levelStars === 'number') G.levelStars = st.levelStars;
  };

  window.__setNetworkLevel = function(lvl) {
    if (!window.GameNetwork || !window.GameNetwork.isOnline || window.GameNetwork.isHost) return;
    if (G.levelIndex !== lvl) {
      buildLevel(lvl);
    }
  };

  if (window.GameNetwork) {
    window.GameNetwork.onPartnerDisconnect = () => {
      if (dom.statusNote) {
        dom.statusNote.textContent = 'Người yêu đã tạm ngắt kết nối. Đang chờ kết nối lại...';
        dom.roomStatus.classList.remove('hidden');
      }
    };
    window.GameNetwork.onRoomClosed = () => {
      alert('Chủ phòng đã rời hoặc kết thúc phòng chơi.');
      goMenu();
    };
  }

  // ------------------------------------------------------------------- ONLINE & LOBBY EVENTS
  const fineprintEl = document.querySelector('.fineprint');
  if (dom.tabLocal && dom.tabOnline) {
    dom.tabLocal.addEventListener('click', () => {
      dom.tabLocal.classList.add('active');
      dom.tabOnline.classList.remove('active');
      dom.localNamesBlock.classList.remove('hidden');
      dom.onlineBox.classList.add('hidden');
      dom.btnStart.classList.remove('hidden');
      if (fineprintEl) fineprintEl.innerHTML = 'Giữ <b>S</b> / <b>↓</b> để <b>neo</b> — làm điểm tựa, không bị kéo đi. Cần 2 người ngồi cùng một máy. Chơi bằng bàn phím.';
      if (window.GameNetwork) window.GameNetwork.leaveRoom();
      if (dom.roomStatus) dom.roomStatus.classList.add('hidden');
      if (dom.btnCreateRoom) dom.btnCreateRoom.disabled = false;
    });

    dom.tabOnline.addEventListener('click', () => {
      dom.tabOnline.classList.add('active');
      dom.tabLocal.classList.remove('active');
      dom.localNamesBlock.classList.add('hidden');
      dom.onlineBox.classList.remove('hidden');
      dom.btnStart.classList.add('hidden');
      if (fineprintEl) fineprintEl.innerHTML = '🌐 <b>Chơi Online:</b> Mỗi người chơi trên máy của mình. Bạn có thể dùng phím <kbd>A</kbd><kbd>D</kbd> hoặc <kbd>←</kbd><kbd>→</kbd> để đi, <kbd>W</kbd>/<kbd>↑</kbd>/<kbd>Space</kbd> nhảy, <kbd>S</kbd>/<kbd>↓</kbd> neo.';
    });
  }

  if (dom.inputRoomCode) {
    dom.inputRoomCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (dom.btnJoinRoom) dom.btnJoinRoom.click();
      }
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

      const copyToClipboard = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            const oldText = dom.btnShareLink.textContent;
            dom.btnShareLink.textContent = '✅ Đã chép link mời!';
            setTimeout(() => { dom.btnShareLink.textContent = oldText; }, 2000);
          }).catch(() => fallbackCopy(shareUrl));
        } else {
          fallbackCopy(shareUrl);
        }
      };

      const fallbackCopy = (text) => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          const oldText = dom.btnShareLink.textContent;
          dom.btnShareLink.textContent = '✅ Đã chép link mời!';
          setTimeout(() => { dom.btnShareLink.textContent = oldText; }, 2000);
        } catch (e) {}
        document.body.removeChild(ta);
      };

      if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
        navigator.share(shareData).catch(() => copyToClipboard());
      } else {
        copyToClipboard();
      }
    });
  }

  // Tự động điền mã phòng và chuyển sang tab Online nếu truy cập qua link ?room=xxxx
  try {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && dom.inputRoomCode) {
      dom.inputRoomCode.value = roomParam;
      if (dom.roomCodeText) dom.roomCodeText.textContent = roomParam;
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
