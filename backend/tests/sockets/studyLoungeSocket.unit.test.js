const test = require('node:test');
const assert = require('node:assert/strict');
const initializeStudyRoomSockets = require('../../sockets/studyRoomSocket');

test('Study Squad WebRTC Lounge & Pomodoro Synchronizer Unit Tests', async (t) => {
  // Mock Socket.io Server & Clients
  class MockSocket {
    constructor(id) {
      this.id = id;
      this.listeners = new Map();
      this.data = {};
      this.rooms = new Set();
      this.emitted = [];
    }

    on(event, cb) {
      this.listeners.set(event, cb);
    }

    emit(event, data) {
      this.emitted.push({ event, data });
    }

    join(room) {
      this.rooms.add(room);
    }

    leave(room) {
      this.rooms.delete(room);
    }

    to(targetIdOrRoom) {
      return {
        emit: (event, data) => {
          this.emitted.push({ to: targetIdOrRoom, event, data });
        },
      };
    }

    trigger(event, data) {
      const cb = this.listeners.get(event);
      if (cb) return cb(data);
    }

    removeAllListeners(event) {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
      }
    }
  }

  class MockIO {
    constructor() {
      this.connectionListeners = [];
      this.broadcasts = [];
    }

    on(event, cb) {
      if (event === 'connection') {
        this.connectionListeners.push(cb);
      }
    }

    to(room) {
      return {
        emit: (event, data) => {
          this.broadcasts.push({ room, event, data });
        },
      };
    }

    connectSocket(socket) {
      this.connectionListeners.forEach((cb) => cb(socket));
    }
  }

  const io = new MockIO();
  initializeStudyRoomSockets(io);

  await t.test('Peer can join study lounge and receives current peers & timer state', async () => {
    const socket = new MockSocket('peer-1');
    io.connectSocket(socket);

    await socket.trigger('room:join', {
      roomId: 'test-room-1',
      username: 'Alice',
      audioState: { isMuted: false, isDeafened: false },
    });

    const joinedEvt = socket.emitted.find((e) => e.event === 'room:joined');
    assert.ok(joinedEvt, 'Peer receives room:joined event');
    assert.equal(joinedEvt.data.roomId, 'test-room-1');
    assert.equal(joinedEvt.data.peerId, 'peer-1');
    assert.ok(Array.isArray(joinedEvt.data.peers));
    assert.ok(joinedEvt.data.timerState);
  });

  await t.test('WebRTC signal is relayed to target peer', async () => {
    const socket = new MockSocket('peer-1');
    io.connectSocket(socket);

    socket.trigger('webrtc:signal', {
      targetPeerId: 'peer-2',
      signal: { sdp: { type: 'offer', sdp: 'mock-sdp-data' } },
    });

    const signalRelay = socket.emitted.find((e) => e.event === 'webrtc:signal');
    assert.ok(signalRelay, 'Signal is relayed');
    assert.equal(signalRelay.to, 'peer-2');
    assert.equal(signalRelay.data.senderPeerId, 'peer-1');
    assert.equal(signalRelay.data.signal.sdp.type, 'offer');
  });

  await t.test('Authoritative timer starts and broadcasts to room', async () => {
    const socket = new MockSocket('peer-host');
    io.connectSocket(socket);

    socket.trigger('room:timer-start', {
      roomId: 'timer-room',
      durationMinutes: 25,
      mode: 'focus',
    });

    const timerSync = io.broadcasts.find((b) => b.room === 'timer-room' && b.event === 'room:timer-sync');
    assert.ok(timerSync, 'Server broadcasts room:timer-sync to room');
    assert.equal(timerSync.data.status, 'running');
    assert.equal(timerSync.data.mode, 'focus');
    assert.equal(timerSync.data.durationSeconds, 1500);
    assert.ok(timerSync.data.endsAt > Date.now());

    // Pause timer
    socket.trigger('room:timer-pause', { roomId: 'timer-room' });
    const timerPaused = io.broadcasts.find((b) => b.room === 'timer-room' && b.data.status === 'paused');
    assert.ok(timerPaused, 'Server pauses timer and broadcasts state');
  });

  await t.test('Doubt scratchpad updates broadcast to other peers in room', async () => {
    const socket = new MockSocket('peer-1');
    io.connectSocket(socket);

    socket.data.username = 'Alice';
    socket.trigger('room:scratchpad-update', {
      roomId: 'test-room-1',
      content: 'E = mc^2 formula breakdown',
    });

    const scratchpadEvt = socket.emitted.find((e) => e.event === 'room:scratchpad-updated');
    assert.ok(scratchpadEvt, 'Scratchpad update broadcast emitted');
    assert.equal(scratchpadEvt.data.content, 'E = mc^2 formula breakdown');
  });

  await t.test('Peer disconnect cleans up and notifies room', async () => {
    const socket = new MockSocket('peer-to-leave');
    io.connectSocket(socket);

    await socket.trigger('room:join', {
      roomId: 'leave-room',
      username: 'Bob',
    });

    await socket.trigger('disconnect');
    const leftEvt = socket.emitted.find((e) => e.event === 'room:peer-left');
    assert.ok(leftEvt, 'Peer-left event broadcast to room');
    assert.equal(leftEvt.data.peerId, 'peer-to-leave');
  });
});
