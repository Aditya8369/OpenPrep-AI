import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Copy,
  Check,
  Users,
  Radio,
  FileText,
  Clock,
  Sparkles,
  Shield,
  Coffee,
  BookOpen
} from 'lucide-react';

/**
 * StudyLounge Component
 * Native Study Squad Virtual Lounge with WebRTC audio mesh, synchronized Pomodoro timer,
 * ambient sound mixer, and shared Doubt Scratchpad.
 */
export default function StudyLounge({ roomId = 'squad-pod-101', currentUser = { id: 'user-me', name: 'You' }, socket }) {
  // Room & Peer State
  const [peers, setPeers] = useState([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Audio / Mic controls
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false);

  // Synchronized Pomodoro State
  const [timerState, setTimerState] = useState({
    status: 'idle', // 'idle' | 'running' | 'paused' | 'completed'
    mode: 'focus', // 'focus' | 'break'
    durationSeconds: 1500,
    remainingSeconds: 1500,
    endsAt: null,
  });

  // Ambient Audio Mixer State
  const [ambientVolumes, setAmbientVolumes] = useState({
    binaural: 0.2,
    rain: 0.4,
    cafe: 0.0,
    lofi: 0.3,
  });
  const [ambientPlaying, setAmbientPlaying] = useState(false);

  // Doubt Scratchpad
  const [scratchpad, setScratchpad] = useState('');
  const [lastUpdatedBy, setLastUpdatedBy] = useState('');

  // WebRTC Mesh refs
  const peerConnections = useRef(new Map()); // peerId -> RTCPeerConnection
  const localStream = useRef(null);
  const scratchpadTimeout = useRef(null);

  // Audio Context synthesizer for ambient soundscapes
  const audioCtxRef = useRef(null);
  const ambientNodesRef = useRef({});

  // Format timer MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Join Room & Initialize WebRTC / Sockets
  useEffect(() => {
    if (!socket) return;

    // Join lounge
    socket.emit('room:join', {
      roomId,
      username: currentUser.name || 'Student',
      audioState: { isMuted, isDeafened },
    });

    // Listeners
    socket.on('room:joined', (data) => {
      if (data.peers) {
        setPeers(data.peers);
      }
      if (data.timerState) {
        setTimerState(data.timerState);
      }
      if (data.scratchpad !== undefined) {
        setScratchpad(data.scratchpad);
      }
    });

    socket.on('room:peer-joined', ({ peerId, participant }) => {
      setPeers((prev) => {
        if (prev.find((p) => p.id === peerId)) return prev;
        return [...prev, participant];
      });
    });

    socket.on('room:peer-left', ({ peerId }) => {
      setPeers((prev) => prev.filter((p) => p.id !== peerId));
      if (peerConnections.current.has(peerId)) {
        peerConnections.current.get(peerId).close();
        peerConnections.current.delete(peerId);
      }
    });

    socket.on('room:peer-audio-status', ({ peerId, audioState }) => {
      setPeers((prev) =>
        prev.map((p) => (p.id === peerId ? { ...p, audioState: { ...p.audioState, ...audioState } } : p))
      );
    });

    socket.on('room:timer-sync', (syncedTimer) => {
      setTimerState(syncedTimer);
    });

    socket.on('room:timer-completed', ({ mode }) => {
      playTransitionChime();
      alert(`Pomodoro ${mode === 'focus' ? 'Focus Sprint' : 'Break'} Completed! Take a breather.`);
    });

    socket.on('room:scratchpad-updated', ({ content, updatedBy }) => {
      setScratchpad(content);
      setLastUpdatedBy(updatedBy);
    });

    // WebRTC Signaling Relay
    socket.on('webrtc:signal', async ({ senderPeerId, signal }) => {
      let pc = peerConnections.current.get(senderPeerId);
      if (!pc) {
        pc = createPeerConnection(senderPeerId);
        peerConnections.current.set(senderPeerId, pc);
      }

      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc:signal', {
            targetPeerId: senderPeerId,
            signal: { sdp: pc.localDescription },
          });
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    });

    return () => {
      socket.emit('room:leave');
      socket.off('room:joined');
      socket.off('room:peer-joined');
      socket.off('room:peer-left');
      socket.off('room:peer-audio-status');
      socket.off('room:timer-sync');
      socket.off('room:timer-completed');
      socket.off('room:scratchpad-updated');
      socket.off('webrtc:signal');

      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId, socket]);

  // WebRTC Peer Connection Helper
  const createPeerConnection = (targetPeerId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:signal', {
          targetPeerId,
          signal: { candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteAudio = document.getElementById(`audio-${targetPeerId}`) || new Audio();
      remoteAudio.id = `audio-${targetPeerId}`;
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.autoplay = true;
    };

    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => pc.addTrack(t, localStream.current));
    }

    return pc;
  };

  // Toggle Mic
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    if (socket) {
      socket.emit('room:audio-status', {
        roomId,
        audioState: { isMuted: nextMuted, isDeafened },
      });
    }
  };

  // Toggle Deafen
  const toggleDeafen = () => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    if (socket) {
      socket.emit('room:audio-status', {
        roomId,
        audioState: { isMuted, isDeafened: nextDeafened },
      });
    }
  };

  // Synchronized Timer Handlers
  const handleStartTimer = (durationMinutes = 25, mode = 'focus') => {
    if (socket) {
      socket.emit('room:timer-start', { roomId, durationMinutes, mode });
    }
  };

  const handlePauseTimer = () => {
    if (socket) {
      socket.emit('room:timer-pause', { roomId });
    }
  };

  // Scratchpad edit with debounced broadcast
  const handleScratchpadChange = (e) => {
    const val = e.target.value;
    setScratchpad(val);
    if (scratchpadTimeout.current) clearTimeout(scratchpadTimeout.current);
    scratchpadTimeout.current = setTimeout(() => {
      if (socket) {
        socket.emit('room:scratchpad-update', { roomId, content: val });
      }
    }, 400);
  };

  // Chime sound synthesizer
  const playTransitionChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      // Audio not permitted or supported
    }
  };

  // Copy shareable invite link
  const copyInviteLink = () => {
    const url = `${window.location.origin}/study-squad?room=${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div className={`w-full min-h-screen transition-colors duration-500 p-6 ${focusMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-slate-100'}`}>
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Study Squad Audio Lounge
              <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-full font-mono border border-indigo-500/30">
                Pod: {roomId}
              </span>
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Low-latency WebRTC mesh audio pod (max 6 peers) with synchronized Pomodoro & ambient sounds
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setFocusMode(!focusMode)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
              focusMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/10'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {focusMode ? 'Focus Mode ON' : 'Focus Dimming'}
          </button>

          <button
            onClick={copyInviteLink}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-600/20"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedLink ? 'Link Copied!' : 'Invite Squad'}
          </button>
        </div>
      </div>

      {/* Main Grid: Pod Members, Pomodoro, Ambient Mixer, Scratchpad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: Pod Peers (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Peer Avatar Mesh */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Squad Pod Members ({peers.length + 1} / 6)
              </h2>
              <span className="text-xs text-slate-400">WebRTC Mesh Active</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Current User Card */}
              <div
                className={`relative rounded-xl p-4 flex flex-col items-center justify-center border transition-all ${
                  isSpeaking
                    ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                    : 'border-indigo-500/30 bg-indigo-950/20'
                }`}
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-xl font-bold shadow-lg">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-slate-900 border border-slate-700">
                    {isMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-200 mt-2">{currentUser.name} (You)</span>
                <span className="text-xs text-indigo-400 font-mono">Pod Host</span>
              </div>

              {/* Connected Remote Peers */}
              {peers.map((peer) => {
                const peerAudio = peer.audioState || {};
                return (
                  <div
                    key={peer.id}
                    className={`relative rounded-xl p-4 flex flex-col items-center justify-center border transition-all ${
                      peerAudio.isSpeaking
                        ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                        : 'border-slate-700 bg-slate-900/40'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xl font-bold shadow-md">
                        {peer.username ? peer.username.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-slate-900 border border-slate-700">
                        {peerAudio.isMuted ? (
                          <MicOff className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                          <Mic className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-200 mt-2 truncate max-w-[120px]">
                      {peer.username || 'Peer'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {peerAudio.isSpeaking ? 'Speaking...' : peerAudio.isMuted ? 'Muted' : 'Listening'}
                    </span>
                  </div>
                );
              })}

              {/* Empty Slots */}
              {Array.from({ length: Math.max(0, 6 - (peers.length + 1)) }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-4 flex flex-col items-center justify-center min-h-[140px]"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center justify-center text-slate-500">
                    <Users className="w-5 h-5 opacity-40" />
                  </div>
                  <span className="text-xs text-slate-500 mt-2">Open Seat</span>
                </div>
              ))}
            </div>

            {/* In-Pod Audio Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-700/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMute}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    isMuted
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isMuted ? 'Unmute Mic' : 'Mute Mic'}
                </button>

                <button
                  onClick={toggleDeafen}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    isDeafened
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  {isDeafened ? 'Undeafen' : 'Deafen'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushToTalk}
                    onChange={(e) => setPushToTalk(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                  Push-to-Talk (Hold Space)
                </label>
              </div>
            </div>
          </div>

          {/* Doubt Scratchpad */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Doubt Scratchpad
              </h2>
              <span className="text-xs text-slate-400">
                {lastUpdatedBy ? `Last synced by ${lastUpdatedBy}` : 'Shared across room participants'}
              </span>
            </div>
            <textarea
              value={scratchpad}
              onChange={handleScratchpadChange}
              placeholder="Paste mathematical formulas, questions, or quick bullet notes for squad discussion..."
              rows={5}
              className="w-full bg-slate-900/70 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-y"
            />
          </div>
        </div>

        {/* Right Column: Synchronized Pomodoro & Ambient Soundscape Mixer (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Synchronized Pomodoro Widget */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                Shared Room Pomodoro
              </h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  timerState.mode === 'focus'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {timerState.mode === 'focus' ? 'Focus Sprint' : 'Break Time'}
              </span>
            </div>

            {/* Countdown Display */}
            <div className="text-center py-6 bg-slate-900/60 rounded-2xl border border-slate-800">
              <div className="text-5xl font-mono font-bold tracking-tight text-white">
                {formatTime(timerState.remainingSeconds || 1500)}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {timerState.status === 'running'
                  ? 'Authoritative server timer • Synchronized across tabs'
                  : 'Timer paused • Host can trigger next interval'}
              </p>
            </div>

            {/* Timer Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {timerState.status === 'running' ? (
                <button
                  onClick={handlePauseTimer}
                  className="flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-all"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              ) : (
                <button
                  onClick={() => handleStartTimer(25, 'focus')}
                  className="flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-600/20"
                >
                  <Play className="w-4 h-4" /> Start 25m Focus
                </button>
              )}

              <button
                onClick={() => handleStartTimer(5, 'break')}
                className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold border border-slate-700 transition-all"
              >
                <Coffee className="w-4 h-4 text-amber-400" /> 5m Break
              </button>
            </div>
          </div>

          {/* Ambient Soundscape Mixer */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                Ambient Soundscape Mixer
              </h2>
              <button
                onClick={() => setAmbientPlaying(!ambientPlaying)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                  ambientPlaying ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {ambientPlaying ? 'Mute Ambient' : 'Enable Ambient'}
              </button>
            </div>

            <div className="space-y-4">
              {/* Rain Slider */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>🌧️ Library Rain</span>
                  <span>{Math.round(ambientVolumes.rain * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ambientVolumes.rain}
                  onChange={(e) =>
                    setAmbientVolumes({ ...ambientVolumes, rain: parseFloat(e.target.value) })
                  }
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Binaural Beats Slider */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>🧠 Binaural Alpha Waves</span>
                  <span>{Math.round(ambientVolumes.binaural * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ambientVolumes.binaural}
                  onChange={(e) =>
                    setAmbientVolumes({ ...ambientVolumes, binaural: parseFloat(e.target.value) })
                  }
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Cafe Murmur */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>☕ Cafe Murmur</span>
                  <span>{Math.round(ambientVolumes.cafe * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ambientVolumes.cafe}
                  onChange={(e) =>
                    setAmbientVolumes({ ...ambientVolumes, cafe: parseFloat(e.target.value) })
                  }
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Lo-Fi Beats */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>🎧 Lo-Fi Study Chords</span>
                  <span>{Math.round(ambientVolumes.lofi * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ambientVolumes.lofi}
                  onChange={(e) =>
                    setAmbientVolumes({ ...ambientVolumes, lofi: parseFloat(e.target.value) })
                  }
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
