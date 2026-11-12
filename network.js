/* =========================================================================
   DÍNH NHAU — NETWORK MODULE (FIREBASE REALTIME CO-OP)
   Đồng bộ thời gian thực 2 người chơi qua Firebase Realtime Database
   ========================================================================= */
(() => {
  'use strict';

  // Cấu hình Firebase Realtime Database tích hợp sẵn
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCNGd8qjuyYcVIzU2NJsGe3eaFnp4H6nrg",
    authDomain: "theankem-4b09b.firebaseapp.com",
    databaseURL: "https://theankem-4b09b-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "theankem-4b09b",
    storageBucket: "theankem-4b09b.firebasestorage.app",
    messagingSenderId: "339996318183",
    appId: "1:339996318183:web:fbe368966bb440da43c542"
  };

  let fbApp = null;
  let fbDb = null;
  let roomRef = null;
  let isHost = false;
  let myRole = 0; // 0: Player 1 (Host - Hồng), 1: Player 2 (Guest - Xanh)

  const Network = {
    isOnline: false,
    isHost: false,
    role: 0,
    currentRoomId: null,
    remoteKeys: { left: false, right: false, jump: false, anchor: false },
    remoteEmote: null,

    init() {
      this.setupFirebase(DEFAULT_FIREBASE_CONFIG);
    },

    setupFirebase(cfg) {
      if (!window.firebase) {
        console.warn('Firebase SDK chưa được tải.');
        return false;
      }
      try {
        if (!firebase.apps.length) {
          fbApp = firebase.initializeApp(cfg);
        } else {
          fbApp = firebase.app();
        }
        fbDb = firebase.database();
        return true;
      } catch (e) {
        console.error('Lỗi khởi tạo Firebase:', e);
        return false;
      }
    },

    // Tạo mã phòng 4 số ngẫu nhiên
    generateRoomCode() {
      return String(Math.floor(1000 + Math.random() * 9000));
    },

    // Tạo phòng mới (Host)
    async createRoom(hostName, onReady, onError) {
      if (!fbDb && !this.setupFirebase(DEFAULT_FIREBASE_CONFIG)) {
        if (onError) onError('Không thể kết nối máy chủ Firebase.');
        return;
      }

      const roomId = this.generateRoomCode();
      this.currentRoomId = roomId;
      isHost = true;
      myRole = 0;
      this.isOnline = true;
      this.isHost = true;
      this.role = 0;

      roomRef = fbDb.ref('rooms/' + roomId);
      await roomRef.set({
        createdAt: Date.now(),
        status: 'waiting',
        levelIndex: 0,
        p1: { name: hostName || 'Bông', ready: true, connected: true },
        p2: null,
        state: null,
        inputP2: { left: false, right: false, jump: false, anchor: false },
        emote: null
      });

      // Lắng nghe người yêu vào phòng
      roomRef.child('p2').on('value', (snap) => {
        const val = snap.val();
        if (val && val.connected) {
          roomRef.update({ status: 'playing' });
          if (onReady) onReady({ roomId, isHost: true, partnerName: val.name || 'Bắp' });
        }
      });

      // Lắng nghe input từ Guest
      roomRef.child('inputP2').on('value', (snap) => {
        const keys = snap.val();
        if (keys) {
          Network.remoteKeys = keys;
        }
      });

      // Lắng nghe emote biểu cảm
      roomRef.child('emote').on('value', (snap) => {
        const em = snap.val();
        if (em && em.from !== myRole && Date.now() - em.time < 3000) {
          Network.remoteEmote = em;
          if (window.__triggerEmote) window.__triggerEmote(em.from, em.type);
        }
      });

      // Dọn phòng khi Host thoát
      roomRef.onDisconnect().remove();
      return roomId;
    },

    // Vào phòng của người yêu (Guest)
    async joinRoom(roomId, guestName, onSuccess, onError) {
      if (!fbDb && !this.setupFirebase(DEFAULT_FIREBASE_CONFIG)) {
        if (onError) onError('Không thể kết nối máy chủ Firebase.');
        return;
      }

      roomRef = fbDb.ref('rooms/' + roomId);
      const snap = await roomRef.once('value');
      const data = snap.val();

      if (!data) {
        if (onError) onError('Không tìm thấy phòng số ' + roomId);
        return;
      }
      if (data.p2 && data.p2.connected) {
        if (onError) onError('Phòng này đã có đủ 2 người rồi!');
        return;
      }

      this.currentRoomId = roomId;
      isHost = false;
      myRole = 1;
      this.isOnline = true;
      this.isHost = false;
      this.role = 1;

      await roomRef.child('p2').set({
        name: guestName || 'Bắp',
        ready: true,
        connected: true
      });

      roomRef.child('p2').onDisconnect().update({ connected: false });

      // Nhận state từ Host và render
      roomRef.child('state').on('value', (sSnap) => {
        const st = sSnap.val();
        if (st && window.__applyNetworkState) {
          window.__applyNetworkState(st);
        }
      });

      // Đồng bộ màn chơi
      roomRef.child('levelIndex').on('value', (lvlSnap) => {
        const lvl = lvlSnap.val();
        if (typeof lvl === 'number' && window.__setNetworkLevel) {
          window.__setNetworkLevel(lvl);
        }
      });

      // Nhận emote
      roomRef.child('emote').on('value', (eSnap) => {
        const em = eSnap.val();
        if (em && em.from !== myRole && Date.now() - em.time < 3000) {
          Network.remoteEmote = em;
          if (window.__triggerEmote) window.__triggerEmote(em.from, em.type);
        }
      });

      if (onSuccess) onSuccess({ roomId, isHost: false, partnerName: data.p1 ? data.p1.name : 'Bông' });
    },

    // Gửi Input của Guest
    sendGuestInput(keys) {
      if (this.isOnline && !this.isHost && roomRef) {
        roomRef.child('inputP2').set({
          left: !!keys.left,
          right: !!keys.right,
          jump: !!keys.jump,
          anchor: !!keys.anchor
        });
      }
    },

    // Host gửi trạng thái game cho Guest
    broadcastHostState(gameState) {
      if (this.isOnline && this.isHost && roomRef) {
        roomRef.child('state').set(gameState);
      }
    },

    // Đổi màn chơi
    changeLevel(levelIndex) {
      if (this.isOnline && this.isHost && roomRef) {
        roomRef.update({ levelIndex });
      }
    },

    // Gửi Emote
    sendEmote(emoteType) {
      if (this.isOnline && roomRef) {
        roomRef.child('emote').set({
          type: emoteType,
          from: myRole,
          time: Date.now()
        });
      }
    },

    // Rời phòng
    leaveRoom() {
      if (roomRef) {
        if (isHost) roomRef.remove();
        else roomRef.child('p2').remove();
        roomRef = null;
      }
      this.isOnline = false;
      this.isHost = false;
      this.currentRoomId = null;
    }
  };

  window.GameNetwork = Network;
  window.addEventListener('DOMContentLoaded', () => Network.init());
})();
