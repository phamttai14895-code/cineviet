/**
 * Watch Party (Xem Chung) — Socket.io
 * Phòng: mã CINE-XXXX, host tạo phòng, sync video, chat, playlist.
 */
const ROOM_CODE_PREFIX = 'CINE-';
const ROOM_CODE_LENGTH = 4;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return ROOM_CODE_PREFIX + code;
}

function createRoomState(hostMember, videoUrl, movieTitle, maxMembers, isPublic) {
  return {
    code: null,
    hostSocketId: hostMember.socketId,
    members: [hostMember],
    videoUrl: videoUrl || '',
    movieTitle: movieTitle || 'Watch Party',
    currentTime: 0,
    playing: false,
    playIndex: 0,
    playlist: videoUrl ? [{ url: videoUrl, title: movieTitle || 'Watch Party' }] : [],
    messages: [],
    maxMembers: maxMembers || 8,
    isPublic: isPublic !== false,
    syncSettings: { autoSyncThreshold: 5, notifyOnPause: true },
  };
}

function sanitizeRoomState(room) {
  if (!room) return null;
  return {
    code: room.code,
    hostSocketId: room.hostSocketId,
    members: room.members.map((m) => ({ id: m.socketId, name: m.name })),
    videoUrl: room.videoUrl,
    movieTitle: room.movieTitle,
    currentTime: room.currentTime,
    playing: room.playing,
    playIndex: room.playIndex,
    playlist: room.playlist || [],
    messages: (room.messages || []).slice(-100),
    syncSettings: room.syncSettings || {},
  };
}

const rooms = new Map();
const roomDeleteTimers = new Map();

function scheduleRoomDeleteIfEmpty(code) {
  const room = rooms.get(code);
  if (!room || (room.members && room.members.length > 0)) return;
  const existing = roomDeleteTimers.get(code);
  if (existing) clearTimeout(existing);
  roomDeleteTimers.set(
    code,
    setTimeout(() => {
      roomDeleteTimers.delete(code);
      if (rooms.get(code)?.members?.length === 0) rooms.delete(code);
    }, 60000)
  );
}

function cancelRoomDeleteTimer(code) {
  const t = roomDeleteTimers.get(code);
  if (t) {
    clearTimeout(t);
    roomDeleteTimers.delete(code);
  }
}

/** Trả về danh sách phòng công khai (có ít nhất 1 thành viên) để hiển thị trên tab Vào phòng */
export function getPublicRooms() {
  const list = [];
  for (const [code, room] of rooms) {
    if (!room.isPublic || !room.members?.length) continue;
    list.push({
      code,
      movieTitle: room.movieTitle || 'Watch Party',
      memberCount: room.members.length,
      maxMembers: room.maxMembers || 8,
      memberNames: room.members.map((m) => m.name || 'Thành viên'),
    });
  }
  return list;
}

export function registerWatchParty(io) {
  io.on('connection', (socket) => {
    socket.on('create-room', (payload, cb) => {
      const {
        hostName = 'Chủ phòng',
        videoUrl = '',
        movieTitle = 'Watch Party',
        maxMembers = 8,
        isPublic = true,
      } = payload || {};
      let code = generateRoomCode();
      while (rooms.has(code)) code = generateRoomCode();

      const hostMember = { socketId: socket.id, name: String(hostName).trim() || 'Chủ phòng' };
      const room = createRoomState(hostMember, String(videoUrl).trim(), String(movieTitle).trim(), maxMembers, isPublic);
      room.code = code;
      rooms.set(code, room);
      socket.join(code);
      socket.roomCode = code;
      socket.isHost = true;

      room.messages.push({
        id: Date.now() + '-' + Math.random().toString(36).slice(2),
        type: 'system',
        payload: `Phòng đã được tạo. Chia sẻ mã ${code} để mời bạn bè.`,
      });

      if (typeof cb === 'function') cb({ code, room: sanitizeRoomState(room) });
    });

    socket.on('join-room', (payload, cb) => {
      const code = (payload?.code || '').toString().trim().toUpperCase();
      const userName = String(payload?.userName || 'Thành viên').trim() || 'Thành viên';
      if (!code || !code.startsWith(ROOM_CODE_PREFIX)) {
        if (typeof cb === 'function') cb({ error: 'Mã phòng không hợp lệ.' });
        return;
      }
      cancelRoomDeleteTimer(code);
      const room = rooms.get(code);
      if (!room) {
        if (typeof cb === 'function') cb({ error: 'Không tìm thấy phòng.' });
        return;
      }
      if (room.members.length >= room.maxMembers) {
        if (typeof cb === 'function') cb({ error: 'Phòng đã đủ người.' });
        return;
      }
      const member = { socketId: socket.id, name: userName };
      room.members.push(member);
      socket.join(code);
      socket.roomCode = code;
      // Nếu host hiện tại đã rời phòng (hostSocketId không còn trong members)
      // thì người đầu tiên join lại sẽ được làm host mới.
      const hasCurrentHost = room.members.some((m) => m.socketId === room.hostSocketId);
      if (!room.hostSocketId || !hasCurrentHost) {
        room.hostSocketId = socket.id;
        socket.isHost = true;
      } else {
        socket.isHost = socket.id === room.hostSocketId;
      }

      room.messages.push({
        id: Date.now() + '-' + Math.random().toString(36).slice(2),
        type: 'system',
        payload: `${userName} đã vào phòng.`,
      });

      io.to(code).emit('room-state', sanitizeRoomState(room));
      if (typeof cb === 'function') cb({ room: sanitizeRoomState(room) });
    });

    socket.on('leave-room', () => {
      const code = socket.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      room.members = room.members.filter((m) => m.socketId !== socket.id);
      room.messages.push({
        id: Date.now() + '-' + Math.random().toString(36).slice(2),
        type: 'system',
        payload: 'Một thành viên đã rời phòng.',
      });
      if (room.members.length === 0) {
        scheduleRoomDeleteIfEmpty(code);
      } else if (socket.isHost) {
        room.hostSocketId = room.members[0].socketId;
        room.messages.push({
          id: Date.now() + '-' + Math.random().toString(36).slice(2),
          type: 'system',
          payload: 'Chủ phòng mới: ' + room.members[0].name,
        });
      }
      socket.leave(code);
      socket.roomCode = null;
      socket.isHost = false;
      if (room.members.length > 0) {
        io.to(code).emit('room-state', sanitizeRoomState(room));
      } else {
        scheduleRoomDeleteIfEmpty(code);
      }
    });

    socket.on('sync-state', (data) => {
      const code = socket.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;

      const prevPlaying = room.playing;

      if (data && typeof data.playing === 'boolean') {
        room.playing = data.playing;
      }
      if (data && typeof data.currentTime === 'number') {
        // Không cập nhật currentTime khi chỉ từ pause -> play (resume),
        // để tránh bị nhảy về đầu; timeupdate tiếp theo sẽ sync lại nhẹ nhàng.
        const isResume = prevPlaying === false && data.playing === true;
        if (!isResume) {
          room.currentTime = data.currentTime;
        }
      }

      // Nếu bật notifyOnPause và trạng thái chuyển từ playing -> paused,
      // gửi tin hệ thống vào chat: "X đã tạm dừng video."
      if (
        room.syncSettings?.notifyOnPause !== false &&
        prevPlaying === true &&
        data &&
        data.playing === false
      ) {
        // Chống spam: cùng 1 người pause tại cùng 1 vị trí thời gian sẽ chỉ báo 1 lần
        const pauseKey = `${socket.id}:${Math.round(room.currentTime || 0)}`;
        if (room.lastPauseKey === pauseKey) {
          const payload = sanitizeRoomState(room);
          payload._from = socket.id;
          io.to(code).emit('room-state', payload);
          return;
        }
        room.lastPauseKey = pauseKey;

        const member = room.members.find((m) => m.socketId === socket.id);
        const msg = {
          id: Date.now() + '-' + Math.random().toString(36).slice(2),
          type: 'system',
          payload: `${member?.name || 'Một thành viên'} đã tạm dừng video.`,
        };
        room.messages.push(msg);
        io.to(code).emit('chat-message', msg);
      }

      const payload = sanitizeRoomState(room);
      payload._from = socket.id;
      io.to(code).emit('room-state', payload);
    });

    socket.on('chat-message', (data, cb) => {
      const code = socket.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      const text = (data?.text || '').toString().trim();
      if (!text) {
        if (typeof cb === 'function') cb();
        return;
      }
      const member = room.members.find((m) => m.socketId === socket.id);
      const msg = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2),
        type: 'text',
        payload: text,
        userName: member?.name || 'Thành viên',
      };
      room.messages.push(msg);
      io.to(code).emit('chat-message', msg);
      if (typeof cb === 'function') cb();
    });

    socket.on('reaction', (data) => {
      const code = socket.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      const member = room.members.find((m) => m.socketId === socket.id);
      const msg = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2),
        type: 'reaction',
        payload: data?.emoji || '❤️',
        userName: member?.name || 'Thành viên',
      };
      room.messages.push(msg);
      io.to(code).emit('chat-message', msg);
    });

    socket.on('playlist-add', (data) => {
      const code = socket.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (socket.id !== room.hostSocketId) return;
      const url = (data?.url || '').toString().trim();
      const title = (data?.title || 'Phim').toString().trim();
      if (url) {
        room.playlist = room.playlist || [];
        room.playlist.push({ url, title });
        io.to(code).emit('room-state', sanitizeRoomState(room));
      }
    });

    socket.on('playlist-play', (data) => {
      const code = socket.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (socket.id !== room.hostSocketId) return;
      const index = parseInt(data?.index, 10);
      if (!Number.isNaN(index) && room.playlist && room.playlist[index]) {
        room.playIndex = index;
        room.videoUrl = room.playlist[index].url;
        room.movieTitle = room.playlist[index].title || 'Phim';
        room.currentTime = 0;
        room.playing = false;
        room.messages.push({
          id: Date.now() + '-' + Math.random().toString(36).slice(2),
          type: 'system',
          payload: 'Video đã đồng bộ',
        });
        io.to(code).emit('room-state', sanitizeRoomState(room));
      }
    });

    socket.on('sync-settings', (data) => {
      const code = socket.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (socket.id !== room.hostSocketId) return;
      if (!room.syncSettings) room.syncSettings = {};
      if (data && typeof data.autoSyncThreshold !== 'undefined')
        room.syncSettings.autoSyncThreshold = data.autoSyncThreshold ? 5 : 0;
      if (data && typeof data.notifyOnPause !== 'undefined') room.syncSettings.notifyOnPause = !!data.notifyOnPause;
      io.to(code).emit('room-state', sanitizeRoomState(room));
    });

    socket.on('disconnect', () => {
      const code = socket.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      room.members = room.members.filter((m) => m.socketId !== socket.id);
      if (room.members.length === 0) {
        scheduleRoomDeleteIfEmpty(code);
      } else {
        if (room.hostSocketId === socket.id) room.hostSocketId = room.members[0].socketId;
        room.messages.push({
          id: Date.now() + '-' + Math.random().toString(36).slice(2),
          type: 'system',
          payload: 'Một thành viên đã rời phòng.',
        });
        io.to(code).emit('room-state', sanitizeRoomState(room));
      }
    });
  });
}
