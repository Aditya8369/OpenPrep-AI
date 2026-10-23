/**
 * @fileoverview Socket.IO event handlers for Collaborative Study Squads.
 * Manages WebRTC audio mesh signaling, synchronized Pomodoro timer,
 * doubt scratchpad, and participant presence up to 6 peers per pod.
 */

let redisService;
try {
  redisService = require('../services/redisService');
} catch (e) {
  redisService = { isReady: false, client: null };
}

// Local fallback state
const localRooms = new Map();
const roomTimers = new Map(); // roomId -> { timerInterval, endsAt, durationSeconds, mode, status, startedAt }
const roomScratchpads = new Map(); // roomId -> string

const MAX_POD_MEMBERS = 6;

// Every event this module registers on a client socket. cleanupSocket() tears
// all of them down, so a new listener added below must be listed here too.
const ROOM_EVENTS = [
  'join_room',
  'study:room:join',
  'study:room:leave',
  'study:room:heartbeat',
  'draw_stroke',
  'clear_whiteboard',
  'send_chat_message',
  'room:join',
  'room:leave',
  'webrtc:signal',
  'room:audio-status',
  'room:timer-start',
  'room:timer-pause',
  'room:timer-sync-req',
  'room:scratchpad-update',
  'disconnect',
];

// Helper to get participants
async function getRoomParticipants(roomId) {
  const key = `room:${roomId}:participants`;
  if (redisService.isReady && redisService.client) {
    try {
      const data = await redisService.client.hgetall(key);
      const list = [];
      for (const field of Object.keys(data)) {
        list.push(JSON.parse(data[field]));
      }
      return list;
    } catch (err) {
      console.error('[studyRoomSocket] Failed to fetch participants from Redis:', err.message);
    }
  }

  // Local fallback
  const room = localRooms.get(roomId);
  return room ? Object.values(room.participants) : [];
}

// Helper to add participant
async function addRoomParticipant(roomId, userId, participant) {
  const key = `room:${roomId}:participants`;
  if (redisService.isReady && redisService.client) {
    try {
      await redisService.client.hset(key, userId, JSON.stringify(participant));
      await redisService.client.expire(key, 86400); // 24 hours expiry
      return;
    } catch (err) {
      console.error('[studyRoomSocket] Failed to add participant to Redis:', err.message);
    }
  }

  // Local fallback
  if (!localRooms.has(roomId)) {
    localRooms.set(roomId, { metadata: { roomId, createdAt: Date.now() }, participants: {}, whiteboard: [] });
  }
  localRooms.get(roomId).participants[userId] = participant;
}

// Helper to remove participant
async function removeRoomParticipant(roomId, userId) {
  const key = `room:${roomId}:participants`;
  if (redisService.isReady && redisService.client) {
    try {
      await redisService.client.hdel(key, userId);
      return;
    } catch (err) {
      console.error('[studyRoomSocket] Failed to remove participant from Redis:', err.message);
    }
  }

  // Local fallback
  const room = localRooms.get(roomId);
  if (room && room.participants[userId]) {
    delete room.participants[userId];
    if (Object.keys(room.participants).length === 0) {
      localRooms.delete(roomId);
      // Clean up timer if empty
      const t = roomTimers.get(roomId);
      if (t && t.timerInterval) clearInterval(t.timerInterval);
      roomTimers.delete(roomId);
      roomScratchpads.delete(roomId);
    }
  }
}

// Helper to get whiteboard strokes
async function getWhiteboardStrokes(roomId) {
  const key = `room:${roomId}:whiteboard`;
  if (redisService.isReady && redisService.client) {
    try {
      const data = await redisService.client.lrange(key, 0, -1);
      return data.map((item) => JSON.parse(item));
    } catch (err) {
      console.error('[studyRoomSocket] Failed to fetch whiteboard strokes from Redis:', err.message);
    }
  }

  const room = localRooms.get(roomId);
  return room ? room.whiteboard : [];
}

// Helper to add whiteboard stroke
async function addWhiteboardStroke(roomId, strokeData) {
  const key = `room:${roomId}:whiteboard`;
  if (redisService.isReady && redisService.client) {
    try {
      await redisService.client.rpush(key, JSON.stringify(strokeData));
      await redisService.client.ltrim(key, -1000, -1);
      await redisService.client.expire(key, 86400);
      return;
    } catch (err) {
      console.error('[studyRoomSocket] Failed to save stroke to Redis:', err.message);
    }
  }

  const room = localRooms.get(roomId);
  if (room) {
    room.whiteboard.push(strokeData);
    if (room.whiteboard.length > 1000) {
      room.whiteboard.shift();
    }
  }
}

// Helper to clear whiteboard
async function clearWhiteboard(roomId) {
  const key = `room:${roomId}:whiteboard`;
  if (redisService.isReady && redisService.client) {
    try {
      await redisService.client.del(key);
      return;
    } catch (err) {
      console.error('[studyRoomSocket] Failed to clear whiteboard in Redis:', err.message);
    }
  }

  const room = localRooms.get(roomId);
  if (room) {
    room.whiteboard = [];
  }
}

/**
 * Returns current timer status for a room.
 */
function getRoomTimerState(roomId) {
  const timer = roomTimers.get(roomId);
  if (!timer) {
    return {
      status: 'idle',
      mode: 'focus',
      durationSeconds: 1500, // 25 min default
      remainingSeconds: 1500,
      startedAt: null,
      endsAt: null,
      serverTime: Date.now(),
    };
  }

  let remaining = 0;
  if (timer.status === 'running') {
    remaining = Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
  } else {
    remaining = timer.remainingSeconds || 0;
  }

  return {
    status: timer.status,
    mode: timer.mode,
    durationSeconds: timer.durationSeconds,
    remainingSeconds: remaining,
    startedAt: timer.startedAt,
    endsAt: timer.endsAt,
    serverTime: Date.now(),
  };
}

/**
 * Starts or updates authoritative timer for a room.
 */
function startRoomTimer(io, roomId, { durationMinutes = 25, mode = 'focus' }) {
  let existing = roomTimers.get(roomId);
  if (existing && existing.timerInterval) {
    clearInterval(existing.timerInterval);
  }

  const durationSeconds = durationMinutes * 60;
  const startedAt = Date.now();
  const endsAt = startedAt + durationSeconds * 1000;

  const timerEntry = {
    status: 'running',
    mode,
    durationSeconds,
    remainingSeconds: durationSeconds,
    startedAt,
    endsAt,
    timerInterval: null,
  };

  // Broadcast sync pulse every second for tight synchronization (<100ms drift)
  timerEntry.timerInterval = setInterval(() => {
    const currentRemaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    timerEntry.remainingSeconds = currentRemaining;

    if (currentRemaining <= 0) {
      clearInterval(timerEntry.timerInterval);
      timerEntry.status = 'completed';
      io.to(roomId).emit('room:timer-completed', {
        roomId,
        mode,
        completedAt: Date.now(),
      });
    }

    io.to(roomId).emit('room:timer-sync', {
      roomId,
      status: timerEntry.status,
      mode: timerEntry.mode,
      durationSeconds: timerEntry.durationSeconds,
      remainingSeconds: currentRemaining,
      startedAt: timerEntry.startedAt,
      endsAt: timerEntry.endsAt,
      serverTime: Date.now(),
    });
  }, 1000);

  roomTimers.set(roomId, timerEntry);

  io.to(roomId).emit('room:timer-sync', {
    roomId,
    status: 'running',
    mode,
    durationSeconds,
    remainingSeconds: durationSeconds,
    startedAt,
    endsAt,
    serverTime: Date.now(),
  });
}

function pauseRoomTimer(io, roomId) {
  const timer = roomTimers.get(roomId);
  if (timer && timer.status === 'running') {
    if (timer.timerInterval) clearInterval(timer.timerInterval);
    timer.status = 'paused';
    timer.remainingSeconds = Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
    io.to(roomId).emit('room:timer-sync', {
      roomId,
      status: 'paused',
      mode: timer.mode,
      durationSeconds: timer.durationSeconds,
      remainingSeconds: timer.remainingSeconds,
      serverTime: Date.now(),
    });
  }
}

/**
 * Initializes Socket.IO event listeners for study room and WebRTC lounge features.
 * 
 * @param {Object} io - The Socket.IO server instance.
 */
const initializeStudyRoomSockets = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    /**
     * Cleans up room membership state and removes event listeners
     */
    const cleanupSocket = () => {
      for (const event of ROOM_EVENTS) {
        socket.removeAllListeners(event);
      }

      if (socket.heartbeatInterval) {
        clearInterval(socket.heartbeatInterval);
        socket.heartbeatInterval = null;
      }

      socket.data.roomId = null;
      socket.data.username = null;
    };

    /**
     * Study Squad WebRTC Lounge Join Handler
     */
    const handleLoungeJoin = async ({ roomId, username, audioState = {} }) => {
      if (!roomId) return;

      const currentPeers = await getRoomParticipants(roomId);
      if (currentPeers.length >= MAX_POD_MEMBERS && !currentPeers.find(p => p.id === socket.id)) {
        socket.emit('room:full', {
          roomId,
          message: `Study pod ${roomId} is at maximum capacity (6 peers).`,
        });
        return;
      }

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.username = username || 'Student';

      const participant = {
        id: socket.id,
        username: socket.data.username,
        audioState: {
          isMuted: audioState.isMuted ?? false,
          isSpeaking: false,
          isDeafened: audioState.isDeafened ?? false,
        },
      };

      await addRoomParticipant(roomId, socket.id, participant);

      // Notify other peers in the room
      socket.to(roomId).emit('room:peer-joined', {
        peerId: socket.id,
        participant,
      });

      // Send join response with all current peers, authoritative timer, and scratchpad
      const allPeers = await getRoomParticipants(roomId);
      socket.emit('room:joined', {
        roomId,
        peerId: socket.id,
        peers: allPeers,
        timerState: getRoomTimerState(roomId),
        scratchpad: roomScratchpads.get(roomId) || '',
      });
    };

    /**
     * WebRTC SDP / ICE Candidate Relay
     */
    socket.on('webrtc:signal', ({ targetPeerId, signal }) => {
      if (!targetPeerId || !signal) return;
      socket.to(targetPeerId).emit('webrtc:signal', {
        senderPeerId: socket.id,
        signal,
      });
    });

    /**
     * Microphone / Audio Status changes
     */
    socket.on('room:audio-status', async ({ roomId, audioState }) => {
      if (!roomId || !audioState) return;
      const room = localRooms.get(roomId);
      if (room && room.participants[socket.id]) {
        room.participants[socket.id].audioState = {
          ...room.participants[socket.id].audioState,
          ...audioState,
        };
      }
      socket.to(roomId).emit('room:peer-audio-status', {
        peerId: socket.id,
        audioState,
      });
    });

    /**
     * Authoritative Timer Events
     */
    socket.on('room:timer-start', ({ roomId, durationMinutes, mode }) => {
      if (!roomId) return;
      startRoomTimer(io, roomId, { durationMinutes, mode });
    });

    socket.on('room:timer-pause', ({ roomId }) => {
      if (!roomId) return;
      pauseRoomTimer(io, roomId);
    });

    socket.on('room:timer-sync-req', ({ roomId }) => {
      if (!roomId) return;
      socket.emit('room:timer-sync', {
        roomId,
        ...getRoomTimerState(roomId),
      });
    });

    /**
     * Doubt Scratchpad Synchronization
     */
    socket.on('room:scratchpad-update', ({ roomId, content }) => {
      if (!roomId) return;
      roomScratchpads.set(roomId, content);
      socket.to(roomId).emit('room:scratchpad-updated', {
        roomId,
        content,
        updatedBy: socket.data.username || socket.id,
      });
    });

    /**
     * General / Legacy Room Join
     */
    const handleJoinRoom = async ({ roomId, username }) => {
      await handleLoungeJoin({ roomId, username });

      socket.to(roomId).emit('user_joined', {
        username: socket.data.username,
        userId: socket.id,
        message: `${socket.data.username} has joined the study room.`,
      });

      const users = await getRoomParticipants(roomId);
      const whiteboard = await getWhiteboardStrokes(roomId);

      socket.emit('room_state_sync', {
        users,
        whiteboard,
      });
    };

    const handleLeaveRoom = async () => {
      const roomId = socket.data.roomId;
      const username = socket.data.username;

      if (roomId) {
        socket.leave(roomId);
        await removeRoomParticipant(roomId, socket.id);

        socket.to(roomId).emit('room:peer-left', {
          peerId: socket.id,
          username,
        });

        if (username) {
          socket.to(roomId).emit('user_left', {
            username,
            message: `${username} has left the study room.`,
          });
        }
        cleanupSocket();
      }
    };

    socket.on('join_room', handleJoinRoom);
    socket.on('study:room:join', handleJoinRoom);
    socket.on('room:join', handleLoungeJoin);
    socket.on('room:leave', handleLeaveRoom);
    socket.on('study:room:leave', handleLeaveRoom);

    socket.on('draw_stroke', async ({ roomId, strokeData }) => {
      if (!roomId || !strokeData || typeof strokeData.x !== 'number') return;
      await addWhiteboardStroke(roomId, strokeData);
      socket.to(roomId).emit('receive_stroke', {
        userId: socket.id,
        strokeData,
      });
    });

    socket.on('clear_whiteboard', async ({ roomId }) => {
      if (!roomId) return;
      await clearWhiteboard(roomId);
      socket.to(roomId).emit('whiteboard_cleared');
    });

    socket.on('send_chat_message', ({ roomId, username, message, timestamp }) => {
      if (!roomId || !message.trim()) return;
      const chatPayload = {
        id: Date.now().toString(),
        userId: socket.id,
        username,
        message: message.trim(),
        timestamp,
      };
      io.to(roomId).emit('receive_chat_message', chatPayload);
    });

    socket.on('study:room:heartbeat', () => {
      socket.emit('study:room:heartbeat_ack');
    });

    socket.on('disconnect', async () => {
      const roomId = socket.data.roomId;
      const username = socket.data.username;

      if (roomId) {
        await removeRoomParticipant(roomId, socket.id);
        socket.to(roomId).emit('room:peer-left', {
          peerId: socket.id,
          username,
        });
        if (username) {
          socket.to(roomId).emit('user_left', {
            username,
            message: `${username} has left the study room.`,
          });
        }
      }
      cleanupSocket();
    });
  });
};

module.exports = initializeStudyRoomSockets;
module.exports.activeRooms = localRooms;
module.exports.getRoomTimerState = getRoomTimerState;
module.exports.startRoomTimer = startRoomTimer;
module.exports.pauseRoomTimer = pauseRoomTimer;
