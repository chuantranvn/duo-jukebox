// DuoJukebox - Online Room WebRTC Peer Network (PeerJS) & Public MQTT Lobby
// Zero central server, 100% P2P with decentralized room discovery, kick member, host migration & chat

class RoomNetwork {
    constructor() {
        this.peer = null;
        this.roomCode = null;
        this.isHost = false;
        this.connections = {}; // peerId -> DataConnection (if Host)
        this.hostConn = null;  // DataConnection to Host (if Client)
        
        const defaultProfile = (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function")
            ? window.DuoIdentity.getProfile()
            : { id: 'user_' + Math.random().toString(36).substring(2, 8), name: 'Anonymous', icon: '🎧', color: '#ec4899' };

        this.user = {
            id: defaultProfile.id,
            name: defaultProfile.name,
            icon: defaultProfile.icon,
            color: defaultProfile.color || '#ec4899',
            isHost: false,
            joinedAt: Date.now()
        };

        this.members = [];
        this.heartbeatTimer = null;
        this.pruneRoomsTimer = null;
        this.activeRoomsMap = {}; // roomCode -> roomData

        // Callbacks
        this.onStateSyncCallback = null;
        this.onProgressSyncCallback = null;
        this.onMembersChangeCallback = null;
        this.onHostCommandCallback = null;
        this.onAddQueueCallback = null;
        this.onReorderQueueCallback = null;
        this.requestCurrentStateCallback = null;
        this.onActiveRoomsChangeCallback = null;
        this.onChatMessageCallback = null;
        this.onKickedCallback = null;
        this.onNewHostCallback = null;

        // MQTT Lobby Client for Public Room Discovery
        this.mqttClient = null;
        this.initMqttLobby();

        // Clean expired chat history (> 7 days) at startup
        this.cleanExpiredChatHistory();
    }

    // ================= MQTT PUBLIC LOBBY =================
    initMqttLobby() {
        if (typeof mqtt === "undefined") {
            console.warn("[RoomNetwork] MQTT library not yet loaded. Will retry.");
            setTimeout(() => this.initMqttLobby(), 1500);
            return;
        }

        const brokerUrls = [
            "wss://broker.emqx.io:8084/mqtt",
            "wss://broker.hivemq.com:8884/mqtt"
        ];
        const brokerUrl = brokerUrls[Math.floor(Math.random() * brokerUrls.length)];

        try {
            this.mqttClient = mqtt.connect(brokerUrl, {
                clientId: "dj_lobby_" + Math.random().toString(36).substring(2, 9),
                keepalive: 30,
                clean: true
            });

            this.mqttClient.on("connect", () => {
                console.log("[Lobby] Connected to public MQTT broker:", brokerUrl);
                this.mqttClient.subscribe("duojukebox/lobby/rooms", { qos: 0 });
            });

            this.mqttClient.on("message", (topic, message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleLobbyMessage(data);
                } catch (e) {
                    // Ignore parse error
                }
            });

            this.mqttClient.on("error", (err) => {
                console.warn("[Lobby] MQTT error:", err);
            });

            // Prune inactive rooms every 3 seconds (rooms that haven't sent a heartbeat for > 7s)
            if (!this.pruneRoomsTimer) {
                this.pruneRoomsTimer = setInterval(() => this.pruneInactiveRooms(), 3000);
            }
        } catch (e) {
            console.error("[Lobby] Failed to init MQTT:", e);
        }
    }

    handleLobbyMessage(data) {
        if (!data || !data.roomCode) return;

        if (data.type === "ROOM_CLOSED" || data.memberCount <= 0) {
            // Delete room immediately
            delete this.activeRoomsMap[data.roomCode];
            this.notifyActiveRoomsChange();
            return;
        }

        // Room heartbeat
        this.activeRoomsMap[data.roomCode] = {
            roomCode: data.roomCode,
            hostName: data.hostName || "Chủ phòng",
            hostAvatar: data.hostAvatar || "🎧",
            memberCount: data.memberCount || 1,
            currentSong: data.currentSong || "Đang chờ bài...",
            isPlaying: !!data.isPlaying,
            lastSeen: Date.now()
        };

        this.notifyActiveRoomsChange();
    }

    pruneInactiveRooms() {
        const now = Date.now();
        let changed = false;
        Object.keys(this.activeRoomsMap).forEach(code => {
            const room = this.activeRoomsMap[code];
            // If no heartbeat for > 7.5 seconds, room is offline/empty -> auto delete
            if (now - room.lastSeen > 7500) {
                delete this.activeRoomsMap[code];
                changed = true;
            }
        });
        if (changed) {
            this.notifyActiveRoomsChange();
        }
    }

    notifyActiveRoomsChange() {
        if (this.onActiveRoomsChangeCallback) {
            const list = Object.values(this.activeRoomsMap).sort((a, b) => b.memberCount - a.memberCount);
            this.onActiveRoomsChangeCallback(list);
        }
    }

    startHostHeartbeat(getCurrentSongFn) {
        this.stopHostHeartbeat();
        const sendHeartbeat = () => {
            if (!this.isHost || !this.roomCode || !this.mqttClient || !this.mqttClient.connected) return;
            const song = getCurrentSongFn ? getCurrentSongFn() : null;
            const songTitle = song ? `${song.title} - ${song.artist}` : "Đang chờ phát bài...";
            const payload = {
                roomCode: this.roomCode,
                hostName: this.user.name,
                hostAvatar: this.user.icon,
                memberCount: this.members.length,
                currentSong: songTitle,
                timestamp: Date.now()
            };
            this.mqttClient.publish("duojukebox/lobby/rooms", JSON.stringify(payload), { qos: 0 });
        };

        sendHeartbeat();
        this.heartbeatTimer = setInterval(sendHeartbeat, 3000);
    }

    stopHostHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.isHost && this.roomCode && this.mqttClient && this.mqttClient.connected) {
            // Send room closed notice
            try {
                this.mqttClient.publish("duojukebox/lobby/rooms", JSON.stringify({
                    roomCode: this.roomCode,
                    type: "ROOM_CLOSED"
                }), { qos: 0 });
            } catch (e) {}
        }
    }

    // Generate random 6-digit room code
    generateRoomCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // ================= SINGLE ROOM ENFORCEMENT =================
    leaveCurrentRoomIfAny() {
        if (this.roomCode) {
            console.log(`[RoomNetwork] Leaving previous room #${this.roomCode} before joining/creating new one.`);
            this.disconnect();
        }
    }

    // ================= HOST: CREATE ROOM =================
    createRoom(roomCode, userInfo, onReady, onError) {
        this.leaveCurrentRoomIfAny();

        this.isHost = true;
        this.roomCode = (roomCode || this.generateRoomCode()).toString().trim();
        this.user = { 
            ...this.user, 
            ...userInfo, 
            isHost: true, 
            joinedAt: Date.now() 
        };
        this.members = [this.user];

        const peerId = `duojuke-${this.roomCode}`;
        console.log(`[RoomNetwork] Creating room with Peer ID: ${peerId}`);

        this.peer = new Peer(peerId, {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id) => {
            console.log(`[RoomNetwork] Host peer open. Room code: ${this.roomCode}`);
            this.startHostHeartbeat(() => {
                if (this.requestCurrentStateCallback) {
                    const st = this.requestCurrentStateCallback();
                    return st ? st.current_song : null;
                }
                return null;
            });
            if (onReady) onReady(this.roomCode);
            if (this.onMembersChangeCallback) this.onMembersChangeCallback(this.members);
        });

        this.peer.on('connection', (conn) => {
            this.handleIncomingClientConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('[RoomNetwork] Peer error:', err);
            if (err.type === 'unavailable-id') {
                // Try another code if collision
                this.createRoom(this.generateRoomCode(), userInfo, onReady, onError);
            } else if (onError) {
                onError(err);
            }
        });
    }

    handleIncomingClientConnection(conn) {
        console.log(`[RoomNetwork] Client connecting: ${conn.peer}`);
        this.connections[conn.peer] = conn;

        conn.on('open', () => {
            console.log(`[RoomNetwork] Client connection opened: ${conn.peer}`);
        });

        conn.on('data', (data) => {
            this.handleHostReceivedData(conn, data);
        });

        conn.on('close', () => {
            console.log(`[RoomNetwork] Client disconnected: ${conn.peer}`);
            delete this.connections[conn.peer];
            this.members = this.members.filter(m => m.peerId !== conn.peer);
            this.broadcastMemberList();
            if (this.onMembersChangeCallback) this.onMembersChangeCallback(this.members);
        });
    }

    handleHostReceivedData(conn, data) {
        if (!data || !data.type) return;

        if (data.type === 'JOIN') {
            const newMember = {
                id: data.user.id || conn.peer,
                peerId: conn.peer,
                name: data.user.name || 'Thành viên',
                icon: data.user.icon || '👤',
                color: data.user.color || '#3b82f6',
                isHost: false,
                joinedAt: data.user.joinedAt || Date.now()
            };
            // Add if not exists
            if (!this.members.some(m => m.peerId === conn.peer)) {
                this.members.push(newMember);
            }
            // Sort by joinedAt: earliest member is always first (Host)
            this.members.sort((a, b) => a.joinedAt - b.joinedAt);

            this.broadcastMemberList();
            if (this.onMembersChangeCallback) this.onMembersChangeCallback(this.members);

            // Send current state
            if (this.requestCurrentStateCallback) {
                const currentState = this.requestCurrentStateCallback();
                conn.send({ type: 'FULL_STATE_SYNC', state: currentState });
            }

            // System chat announce
            this.broadcastSystemChat(`👋 ${newMember.icon} ${newMember.name} đã tham gia phòng!`);
        } else if (data.type === 'QUEUE_ADD') {
            if (this.onAddQueueCallback) {
                this.onAddQueueCallback(data.song, data.user, data.mode);
            }
        } else if (data.type === 'QUEUE_REORDER') {
            if (this.onReorderQueueCallback) {
                this.onReorderQueueCallback(data.fromIndex, data.toIndex);
            } else {
                fetch("/api/queue/reorder", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ from_index: data.fromIndex, to_index: data.toIndex })
                });
            }
        } else if (data.type === 'QUEUE_TOGGLE_PRIORITY') {
            fetch("/api/queue/toggle_priority", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: data.uid })
            });
        } else if (data.type === 'CONTROL_CMD') {
            if (this.onHostCommandCallback) {
                this.onHostCommandCallback(data.command, data.payload);
            }
        } else if (data.type === 'CHAT_MESSAGE') {
            // Save & forward chat message to all clients
            this.saveChatMessage(this.roomCode, data.message);
            if (this.onChatMessageCallback) this.onChatMessageCallback(data.message);
            // Broadcast to all other peers
            Object.values(this.connections).forEach(c => {
                if (c && c.peer !== conn.peer && c.open) {
                    c.send({ type: 'CHAT_MESSAGE', message: data.message });
                }
            });
        }
    }

    // ================= CLIENT: JOIN ROOM =================
    joinRoom(roomCode, userInfo, onConnected, onError) {
        this.leaveCurrentRoomIfAny();

        this.isHost = false;
        this.roomCode = roomCode.toString().trim();
        this.user = { 
            ...this.user, 
            ...userInfo, 
            isHost: false,
            joinedAt: Date.now()
        };

        const clientPeerId = `duoclient-${Math.random().toString(36).substring(2, 9)}`;
        console.log(`[RoomNetwork] Client joining room ${this.roomCode} as ${clientPeerId}`);

        this.peer = new Peer(clientPeerId, {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id) => {
            const hostPeerId = `duojuke-${this.roomCode}`;
            this.hostConn = this.peer.connect(hostPeerId, { reliable: true });

            this.hostConn.on('open', () => {
                console.log(`[RoomNetwork] Connected to host ${hostPeerId}!`);
                this.hostConn.send({
                    type: 'JOIN',
                    user: this.user
                });
                if (onConnected) onConnected(this.roomCode);
            });

            this.hostConn.on('data', (data) => {
                this.handleClientReceivedData(data);
            });

            this.hostConn.on('close', () => {
                console.warn('[RoomNetwork] Host connection closed. Triggering Host Migration...');
                this.handleHostMigration();
            });

            this.hostConn.on('error', (err) => {
                console.error('[RoomNetwork] Connection error to host:', err);
                if (onError) onError(err);
            });
        });

        this.peer.on('error', (err) => {
            console.error('[RoomNetwork] Client peer error:', err);
            if (onError) onError(err);
        });
    }

    handleClientReceivedData(data) {
        if (!data || !data.type) return;

        if (data.type === 'MEMBER_LIST') {
            this.members = data.members || [];
            if (this.onMembersChangeCallback) this.onMembersChangeCallback(this.members);
        } else if (data.type === 'FULL_STATE_SYNC') {
            if (this.onStateSyncCallback) this.onStateSyncCallback(data.state);
        } else if (data.type === 'PROGRESS_SYNC') {
            if (this.onProgressSyncCallback) this.onProgressSyncCallback(data);
        } else if (data.type === 'PLAYER_CMD') {
            if (this.onHostCommandCallback) this.onHostCommandCallback(data.command, data.payload);
        } else if (data.type === 'KICK_MEMBER') {
            if (data.targetId === this.user.id) {
                console.warn('[RoomNetwork] You were kicked from the room!');
                const reason = data.reason || "Chủ phòng đã mời bạn ra khỏi phòng!";
                this.disconnect();
                if (this.onKickedCallback) this.onKickedCallback(reason);
            }
        } else if (data.type === 'CHAT_MESSAGE') {
            this.saveChatMessage(this.roomCode, data.message);
            if (this.onChatMessageCallback) this.onChatMessageCallback(data.message);
        }
    }

    // ================= HOST MIGRATION (KHI HOST OFF) =================
    handleHostMigration() {
        if (this.isHost || !this.roomCode) return;

        // Find remaining members excluding the old host
        const remaining = this.members
            .filter(m => !m.isHost && m.id !== this.user.id || (m.id === this.user.id))
            .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

        if (remaining.length === 0) {
            console.warn('[HostMigration] No remaining members.');
            this.disconnect();
            return;
        }

        const nextHostCandidate = remaining[0];
        console.log(`[HostMigration] Next host candidate is: ${nextHostCandidate.name} (${nextHostCandidate.id})`);

        if (nextHostCandidate.id === this.user.id) {
            // I become the new Host!
            console.log('[HostMigration] I am becoming the new Host!');
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            this.hostConn = null;

            setTimeout(() => {
                this.createRoom(this.roomCode, { ...this.user, isHost: true }, (readyCode) => {
                    this.broadcastSystemChat(`👑 ${this.user.icon} ${this.user.name} đã trở thành Chủ Phòng mới!`);
                    if (this.onNewHostCallback) this.onNewHostCallback(this.user);
                });
            }, 600);
        } else {
            // Wait for new host to claim peer, then reconnect
            console.log(`[HostMigration] Waiting for new host (${nextHostCandidate.name}) to claim room...`);
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            this.hostConn = null;

            setTimeout(() => {
                console.log(`[HostMigration] Reconnecting to room #${this.roomCode}...`);
                this.joinRoom(this.roomCode, this.user, (code) => {
                    console.log('[HostMigration] Reconnected successfully to new host!');
                }, (err) => {
                    console.warn('[HostMigration] Reconnection failed:', err);
                });
            }, 2500);
        }
    }

    // ================= KICK MEMBER (HOST ONLY) =================
    kickMember(targetPeerId, targetUserId, memberName) {
        if (!this.isHost) return;

        console.log(`[RoomNetwork] Kicking member ${memberName} (${targetUserId})`);

        // Send kick message
        if (targetPeerId && this.connections[targetPeerId]) {
            try {
                this.connections[targetPeerId].send({
                    type: 'KICK_MEMBER',
                    targetId: targetUserId,
                    reason: 'Chủ phòng đã mời bạn ra khỏi phòng!'
                });
                this.connections[targetPeerId].close();
            } catch (e) {}
            delete this.connections[targetPeerId];
        }

        // Remove from members
        this.members = this.members.filter(m => m.id !== targetUserId);
        this.broadcastMemberList();
        if (this.onMembersChangeCallback) this.onMembersChangeCallback(this.members);

        // System chat announce
        this.broadcastSystemChat(`🚫 ${memberName || 'Thành viên'} đã bị mời ra khỏi phòng.`);
    }

    // ================= CHAT SYSTEM =================
    sendChatMessage(text) {
        if (!text || !text.trim() || !this.roomCode) return;
        const msg = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            roomCode: this.roomCode,
            sender: {
                id: this.user.id,
                name: this.user.name,
                icon: this.user.icon,
                color: this.user.color
            },
            text: text.trim(),
            timestamp: Date.now()
        };

        // Save locally
        this.saveChatMessage(this.roomCode, msg);
        if (this.onChatMessageCallback) this.onChatMessageCallback(msg);

        if (this.isHost) {
            // Broadcast to all clients
            this.broadcast({
                type: 'CHAT_MESSAGE',
                message: msg
            });
        } else if (this.hostConn && this.hostConn.open) {
            this.hostConn.send({
                type: 'CHAT_MESSAGE',
                message: msg
            });
        }
    }

    broadcastSystemChat(systemText) {
        const sysMsg = {
            id: 'sys_' + Date.now(),
            roomCode: this.roomCode,
            isSystem: true,
            text: systemText,
            timestamp: Date.now()
        };
        this.saveChatMessage(this.roomCode, sysMsg);
        if (this.onChatMessageCallback) this.onChatMessageCallback(sysMsg);
        if (this.isHost) {
            this.broadcast({
                type: 'CHAT_MESSAGE',
                message: sysMsg
            });
        }
    }

    // ================= CHAT STORAGE (NOSQL INDEXEDDB) =================
    async saveChatMessage(roomCode, msg) {
        if (!roomCode || !msg) return;
        if (window.localStore) {
            await window.localStore.saveChatMessage(roomCode, msg);
        } else {
            try {
                const key = `duo_jukebox_chat_${roomCode}`;
                const history = JSON.parse(localStorage.getItem(key) || "[]");
                history.push(msg);
                if (history.length > 200) history.shift();
                localStorage.setItem(key, JSON.stringify(history));
            } catch (e) {}
        }
    }

    async getChatHistory(roomCode) {
        if (!roomCode) return [];
        if (window.localStore) {
            return await window.localStore.getRoomChatHistory(roomCode);
        }
        try {
            return JSON.parse(localStorage.getItem(`duo_jukebox_chat_${roomCode}`)) || [];
        } catch (e) {
            return [];
        }
    }

    async clearChatHistory(roomCode) {
        if (!roomCode) return;
        console.log(`[RoomNetwork] Clearing chat history for room #${roomCode}`);
        if (window.localStore) {
            await window.localStore.clearRoomChats(roomCode);
        }
        try {
            localStorage.removeItem(`duo_jukebox_chat_${roomCode}`);
        } catch (e) {}
    }

    cleanExpiredChatHistory() {
        if (window.localStore) {
            window.localStore.autoPurgeOldChats(7);
        }
    }

    // ================= BROADCAST METHODS =================
    broadcast(data) {
        if (!this.isHost) return;
        Object.values(this.connections).forEach(conn => {
            if (conn && conn.open) {
                conn.send(data);
            }
        });
    }

    broadcastMemberList() {
        this.broadcast({
            type: 'MEMBER_LIST',
            members: this.members
        });
    }

    broadcastState(state) {
        if (this.isHost) {
            this.broadcast({
                type: 'FULL_STATE_SYNC',
                state: state
            });
        }
    }

    broadcastProgress(currentTime, duration, isPlaying) {
        if (this.isHost) {
            this.broadcast({
                type: 'PROGRESS_SYNC',
                currentTime: currentTime,
                duration: duration,
                isPlaying: isPlaying,
                timestamp: Date.now()
            });
        }
    }

    // ================= CLIENT ACTION SENDERS =================
    sendAddToQueue(song, mode = 'bottom') {
        if (this.isHost) {
            if (this.onAddQueueCallback) {
                this.onAddQueueCallback(song, this.user, mode);
            }
        } else if (this.hostConn && this.hostConn.open) {
            this.hostConn.send({
                type: 'QUEUE_ADD',
                song: song,
                user: this.user,
                mode: mode
            });
        }
    }

    sendReorderQueue(fromIndex, toIndex) {
        if (this.isHost) {
            if (this.onReorderQueueCallback) {
                this.onReorderQueueCallback(fromIndex, toIndex);
            } else {
                fetch("/api/queue/reorder", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ from_index: fromIndex, to_index: toIndex })
                });
            }
        } else if (this.hostConn && this.hostConn.open) {
            this.hostConn.send({
                type: 'QUEUE_REORDER',
                fromIndex: fromIndex,
                toIndex: toIndex
            });
        }
    }

    sendTogglePriority(uid) {
        if (this.isHost) {
            fetch("/api/queue/toggle_priority", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: uid })
            });
        } else if (this.hostConn && this.hostConn.open) {
            this.hostConn.send({
                type: 'QUEUE_TOGGLE_PRIORITY',
                uid: uid
            });
        }
    }

    sendCommand(command, payload = {}) {
        if (this.isHost) {
            if (this.onHostCommandCallback) {
                this.onHostCommandCallback(command, payload);
            }
        } else if (this.hostConn && this.hostConn.open) {
            this.hostConn.send({
                type: 'CONTROL_CMD',
                command: command,
                payload: payload
            });
        }
    }

    // ================= DISCONNECT / OUT ROOM =================
    disconnect() {
        // Stop heartbeat and announce room closed if host
        this.stopHostHeartbeat();

        if (this.peer) {
            try {
                this.peer.destroy();
            } catch (e) {}
            this.peer = null;
        }
        this.connections = {};
        this.hostConn = null;
        this.members = [];
        this.isHost = false;
        this.roomCode = null;
    }
}

// Global instance
window.roomNet = new RoomNetwork();
