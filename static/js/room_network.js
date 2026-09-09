// DuoJukebox - Online Room WebRTC Peer Network (PeerJS) & MQTT Dual-Channel Room Network
// Zero central server, 100% P2P & Instant Dual-Channel Relay (WebRTC + MQTT), Kick Member, Host Migration & Decentralized Discovery

const PEER_ICE_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelay',
            credential: 'openrelay'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelay',
            credential: 'openrelay'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelay',
            credential: 'openrelay'
        }
    ]
};

const BROKER_URLS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt"
];

class RoomNetwork {
    constructor() {
        this.peer = null;
        this.roomCode = null;
        this.isHost = false;
        this.isConnected = false;
        this.isConnecting = false;
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
        this.joinTimeoutTimer = null;
        this.pendingJoinCallbacks = null;
        this.activeRoomsMap = {}; // roomCode -> roomData
        this.announcedMembers = new Set();
        this.recentActionIds = new Set();
        this.processedMessageIds = new Set();
        this.lastMqttProgressTime = 0;

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

        // MQTT Client for Public Lobby + Room Relay
        this.mqttClient = null;
        this.currentBrokerIdx = 0;
        this.initMqttLobby();

        // Clean expired chat history (> 7 days) at startup
        this.cleanExpiredChatHistory();
    }

    // ================= MQTT PUBLIC LOBBY & ROOM RELAY =================
    initMqttLobby() {
        if (typeof mqtt === "undefined") {
            console.warn("[RoomNetwork] MQTT library not yet loaded. Will retry.");
            setTimeout(() => this.initMqttLobby(), 1000);
            return;
        }

        const brokerUrl = BROKER_URLS[this.currentBrokerIdx % BROKER_URLS.length];
        console.log(`[RoomNetwork] Connecting to primary MQTT broker: ${brokerUrl}`);

        try {
            this.mqttClient = mqtt.connect(brokerUrl, {
                clientId: "dj_node_" + Math.random().toString(36).substring(2, 9),
                keepalive: 30,
                clean: true,
                connectTimeout: 5000,
                reconnectPeriod: 4000
            });

            this.mqttClient.on("connect", () => {
                console.log("[RoomNetwork] Connected to MQTT broker:", brokerUrl);
                // Subscribe to public lobby
                this.mqttClient.subscribe("duojukebox/lobby/rooms", { qos: 0 });

                // If currently in or joining a room, re-subscribe to room topics
                if (this.roomCode) {
                    this.subscribeRoomMqttTopics();
                }
            });

            this.mqttClient.on("message", (topic, message) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (topic === "duojukebox/lobby/rooms") {
                        this.handleLobbyMessage(data);
                    } else if (topic.startsWith("duojukebox/rooms/")) {
                        this.handleRoomMqttMessage(topic, data);
                    }
                } catch (e) {
                    // Ignore malformed message
                }
            });

            this.mqttClient.on("error", (err) => {
                console.warn("[RoomNetwork] MQTT connection error:", err);
            });

            // Prune inactive rooms every 3 seconds
            if (!this.pruneRoomsTimer) {
                this.pruneRoomsTimer = setInterval(() => this.pruneInactiveRooms(), 3000);
            }
        } catch (e) {
            console.error("[RoomNetwork] Failed to init MQTT:", e);
        }
    }

    // Subscribe to MQTT topics based on current role (Host or Client)
    subscribeRoomMqttTopics() {
        if (!this.mqttClient || !this.mqttClient.connected || !this.roomCode) return;

        if (this.isHost) {
            // Host listens for client commands/join requests on to_host topic
            const toHostTopic = `duojukebox/rooms/${this.roomCode}/to_host`;
            this.mqttClient.subscribe(toHostTopic, { qos: 0 }, (err) => {
                if (!err) console.log(`[RoomNetwork] Host subscribed to MQTT: ${toHostTopic}`);
            });
        } else {
            // Client listens to broadcasts & direct messages to its user ID
            const broadcastTopic = `duojukebox/rooms/${this.roomCode}/broadcast`;
            const toClientTopic = `duojukebox/rooms/${this.roomCode}/to_client/${this.user.id}`;
            this.mqttClient.subscribe([broadcastTopic, toClientTopic], { qos: 0 }, (err) => {
                if (!err) console.log(`[RoomNetwork] Client subscribed to MQTT: ${broadcastTopic}, ${toClientTopic}`);
            });
        }
    }

    unsubscribeRoomMqttTopics(roomCode) {
        if (!this.mqttClient || !this.mqttClient.connected || !roomCode) return;
        const toHostTopic = `duojukebox/rooms/${roomCode}/to_host`;
        const broadcastTopic = `duojukebox/rooms/${roomCode}/broadcast`;
        const toClientTopic = `duojukebox/rooms/${roomCode}/to_client/${this.user.id}`;
        try {
            this.mqttClient.unsubscribe([toHostTopic, broadcastTopic, toClientTopic]);
        } catch (e) {}
    }

    // Deduplication check for dual-channel events
    isDuplicateAction(actionId) {
        if (!actionId) return false;
        if (this.recentActionIds.has(actionId)) {
            return true;
        }
        this.recentActionIds.add(actionId);
        if (this.recentActionIds.size > 500) {
            const it = this.recentActionIds.values();
            for (let i = 0; i < 100; i++) {
                this.recentActionIds.delete(it.next().value);
            }
        }
        return false;
    }

    // Route incoming MQTT room messages
    handleRoomMqttMessage(topic, data) {
        if (!data || !data.type) return;
        if (data.actionId && this.isDuplicateAction(data.actionId)) return;

        if (this.isHost) {
            // If Host receives client request via MQTT
            this.handleHostReceivedData(null, data);
        } else {
            // If Client receives broadcast or direct message via MQTT
            this.handleClientReceivedData(data);
        }
    }

    handleLobbyMessage(data) {
        if (!data || !data.roomCode) return;

        if (data.type === "ROOM_CLOSED" || data.memberCount <= 0) {
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
        this.isConnected = true;
        this.isConnecting = false;
        this.roomCode = (roomCode || this.generateRoomCode()).toString().trim();
        this.user = { 
            ...this.user, 
            ...userInfo, 
            isHost: true, 
            joinedAt: Date.now() 
        };
        this.members = [this.user];
        this.announcedMembers = new Set([this.user.id]);

        // Subscribe to MQTT room topics for Host
        this.subscribeRoomMqttTopics();

        const peerId = `duojuke-${this.roomCode}`;
        console.log(`[RoomNetwork] Creating room with Peer ID: ${peerId}`);

        try {
            this.peer = new Peer(peerId, {
                config: PEER_ICE_CONFIG
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
                console.error('[RoomNetwork] Host Peer error:', err);
                if (err.type === 'unavailable-id') {
                    // Try another code if collision
                    this.createRoom(this.generateRoomCode(), userInfo, onReady, onError);
                } else if (onError) {
                    onError(err);
                }
            });
        } catch (e) {
            console.error('[RoomNetwork] Peer initialization failed, relying on MQTT relay:', e);
            if (onReady) onReady(this.roomCode);
        }
    }

    handleIncomingClientConnection(conn) {
        console.log(`[RoomNetwork] Client WebRTC connecting: ${conn.peer}`);
        this.connections[conn.peer] = conn;

        conn.on('open', () => {
            console.log(`[RoomNetwork] Client WebRTC connection opened: ${conn.peer}`);
        });

        conn.on('data', (data) => {
            this.handleHostReceivedData(conn, data);
        });

        conn.on('close', () => {
            console.log(`[RoomNetwork] Client WebRTC disconnected: ${conn.peer}`);
            delete this.connections[conn.peer];
            this.members = this.members.filter(m => m.peerId !== conn.peer);
            this.broadcastMemberList();
            if (this.onMembersChangeCallback) this.onMembersChangeCallback(this.members);
        });
    }

    handleHostReceivedData(conn, data) {
        if (!data || !data.type) return;

        // Deduplication check for both WebRTC and MQTT dual-channels
        const actionId = data.actionId || (data.message ? data.message.id : null);
        if (actionId && this.isDuplicateAction(actionId)) return;

        if (data.type === 'JOIN') {
            const userId = (data.user && data.user.id) ? data.user.id : (conn ? conn.peer : ('user_' + Math.random().toString(36).substring(2, 7)));
            const newMember = {
                id: userId,
                peerId: conn ? conn.peer : (data.user ? data.user.peerId : null),
                name: (data.user && data.user.name) ? data.user.name : 'Thành viên',
                icon: (data.user && data.user.icon) ? data.user.icon : '👤',
                color: (data.user && data.user.color) ? data.user.color : '#3b82f6',
                isHost: false,
                joinedAt: (data.user && data.user.joinedAt) ? data.user.joinedAt : Date.now()
            };

            const existingIdx = this.members.findIndex(m => m.id === newMember.id);
            if (existingIdx === -1) {
                this.members.push(newMember);
            } else {
                if (conn && conn.peer) this.members[existingIdx].peerId = conn.peer;
                this.members[existingIdx].name = newMember.name;
                this.members[existingIdx].icon = newMember.icon;
            }
            this.members.sort((a, b) => a.joinedAt - b.joinedAt);

            // Send instant JOIN_ACK + FULL_STATE_SYNC directly to client
            const currentState = this.requestCurrentStateCallback ? this.requestCurrentStateCallback() : null;
            const joinAckPayload = {
                type: 'JOIN_ACK',
                roomCode: this.roomCode,
                members: this.members,
                timestamp: Date.now()
            };

            // Send via WebRTC if open
            if (conn && conn.open) {
                try {
                    conn.send(joinAckPayload);
                    if (currentState) conn.send({ type: 'FULL_STATE_SYNC', state: currentState });
                } catch (e) {}
            }

            // Always send via MQTT to specific client topic for instant delivery
            this.sendMqttToClient(userId, joinAckPayload);
            if (currentState) {
                this.sendMqttToClient(userId, { type: 'FULL_STATE_SYNC', state: currentState });
            }

            this.broadcastMemberList();
            if (this.onMembersChangeCallback) this.onMembersChangeCallback(this.members);

            // System chat announce (deduplicated per user)
            if (!this.announcedMembers.has(newMember.id)) {
                this.announcedMembers.add(newMember.id);
                this.broadcastSystemChat(`👋 ${newMember.icon} ${newMember.name} đã tham gia phòng!`);
            }
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
            const msg = data.message;
            if (!msg) return;

            // If message was sent by Host itself, ignore echo
            if (msg.sender && msg.sender.id === this.user.id) return;

            const msgId = msg.id || actionId;
            if (msgId && this.processedMessageIds.has(msgId)) return;
            if (msgId) this.processedMessageIds.add(msgId);

            this.saveChatMessage(this.roomCode, msg);
            if (this.onChatMessageCallback) this.onChatMessageCallback(msg);

            // Broadcast to all clients
            this.broadcast({
                type: 'CHAT_MESSAGE',
                actionId: msgId,
                message: msg
            });
        } else if (data.type === 'LEAVE') {
            const leaveUserId = data.userId;
            this.members = this.members.filter(m => m.id !== leaveUserId);
            this.broadcastMemberList();
            if (this.onMembersChangeCallback) this.onMembersChangeCallback(this.members);
        }
    }

    // ================= CLIENT: JOIN ROOM =================
    joinRoom(roomCode, userInfo, onConnected, onError) {
        this.leaveCurrentRoomIfAny();

        this.isHost = false;
        this.isConnected = false;
        this.isConnecting = true;
        this.roomCode = roomCode.toString().trim();
        this.user = { 
            ...this.user, 
            ...userInfo, 
            isHost: false, 
            joinedAt: Date.now() 
        };

        this.pendingJoinCallbacks = { onConnected, onError };

        console.log(`[RoomNetwork] Initiating dual-channel join for room #${this.roomCode}...`);

        // Set 7s fail-safe timeout
        if (this.joinTimeoutTimer) clearTimeout(this.joinTimeoutTimer);
        this.joinTimeoutTimer = setTimeout(() => {
            if (!this.isConnected) {
                console.warn(`[RoomNetwork] Join room #${this.roomCode} timed out after 7s.`);
                this.triggerJoinError(new Error(`Không thể kết nối đến phòng #${this.roomCode} sau 7 giây. Phòng có thể không tồn tại hoặc Chủ phòng đã ngắt kết nối!`));
            }
        }, 7000);

        // 1. MQTT Fast Path (instant connection & state retrieval)
        this.subscribeRoomMqttTopics();
        const sendMqttJoinRequest = () => {
            if (!this.isConnected && this.isConnecting && this.mqttClient && this.mqttClient.connected) {
                const joinMsg = {
                    type: 'JOIN',
                    actionId: `join_${this.user.id}_${Date.now()}`,
                    user: this.user
                };
                console.log(`[RoomNetwork] Publishing JOIN to MQTT topic duojukebox/rooms/${this.roomCode}/to_host`);
                this.mqttClient.publish(`duojukebox/rooms/${this.roomCode}/to_host`, JSON.stringify(joinMsg), { qos: 0 });
            }
        };

        sendMqttJoinRequest();
        // Retry MQTT JOIN every 1.5s until connected or timeout
        const mqttJoinInterval = setInterval(() => {
            if (this.isConnected || !this.isConnecting) {
                clearInterval(mqttJoinInterval);
            } else {
                sendMqttJoinRequest();
            }
        }, 1500);

        // 2. WebRTC P2P Path (in parallel with Enhanced STUN/TURN)
        const clientPeerId = `duoclient-${Math.random().toString(36).substring(2, 9)}`;
        this.user.peerId = clientPeerId;

        try {
            this.peer = new Peer(clientPeerId, {
                config: PEER_ICE_CONFIG
            });

            this.peer.on('open', (id) => {
                const hostPeerId = `duojuke-${this.roomCode}`;
                console.log(`[RoomNetwork] Client peer opened. Connecting to host ${hostPeerId}...`);
                this.hostConn = this.peer.connect(hostPeerId, { reliable: true });

                this.hostConn.on('open', () => {
                    console.log(`[RoomNetwork] WebRTC P2P DataConnection opened with host!`);
                    this.hostConn.send({
                        type: 'JOIN',
                        actionId: `join_p2p_${this.user.id}_${Date.now()}`,
                        user: this.user
                    });
                    this.triggerJoinSuccess(this.roomCode);
                });

                this.hostConn.on('data', (data) => {
                    this.handleClientReceivedData(data);
                });

                this.hostConn.on('close', () => {
                    console.warn('[RoomNetwork] Host WebRTC connection closed.');
                    // If room closed, trigger migration
                    if (this.isConnected) {
                        this.handleHostMigration();
                    }
                });

                this.hostConn.on('error', (err) => {
                    console.warn('[RoomNetwork] WebRTC HostConn error (falling back to MQTT):', err);
                });
            });

            this.peer.on('error', (err) => {
                console.warn('[RoomNetwork] WebRTC Client Peer error (falling back to MQTT):', err);
            });
        } catch (e) {
            console.warn('[RoomNetwork] WebRTC not supported or failed to init. Relying 100% on MQTT relay:', e);
        }
    }

    triggerJoinSuccess(code) {
        if (this.joinTimeoutTimer) {
            clearTimeout(this.joinTimeoutTimer);
            this.joinTimeoutTimer = null;
        }
        if (!this.isConnected) {
            this.isConnected = true;
            this.isConnecting = false;
            console.log(`[RoomNetwork] Successfully connected to room #${code}!`);
            if (this.pendingJoinCallbacks && this.pendingJoinCallbacks.onConnected) {
                this.pendingJoinCallbacks.onConnected(code);
                this.pendingJoinCallbacks.onConnected = null;
            }
        }
    }

    triggerJoinError(err) {
        if (this.joinTimeoutTimer) {
            clearTimeout(this.joinTimeoutTimer);
            this.joinTimeoutTimer = null;
        }
        this.isConnecting = false;
        this.isConnected = false;
        const cb = this.pendingJoinCallbacks ? this.pendingJoinCallbacks.onError : null;
        this.disconnect();
        if (cb) cb(err);
    }

    handleClientReceivedData(data) {
        if (!data || !data.type) return;

        // Deduplication check for both WebRTC and MQTT dual-channels
        const actionId = data.actionId || (data.message ? data.message.id : null);
        if (actionId && this.isDuplicateAction(actionId)) return;

        if (data.type === 'JOIN_ACK') {
            console.log(`[RoomNetwork] Received JOIN_ACK from host for room #${data.roomCode}`);
            if (data.members) {
                this.members = data.members;
                if (this.onMembersChangeCallback) this.onMembersChangeCallback(this.members);
            }
            this.triggerJoinSuccess(this.roomCode);
        } else if (data.type === 'MEMBER_LIST') {
            this.members = data.members || [];
            if (this.onMembersChangeCallback) this.onMembersChangeCallback(this.members);
            // Receiving member list also confirms room connectivity
            if (this.isConnecting) this.triggerJoinSuccess(this.roomCode);
        } else if (data.type === 'FULL_STATE_SYNC') {
            if (this.isConnecting) this.triggerJoinSuccess(this.roomCode);
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
            const msg = data.message;
            if (!msg) return;

            // If this message was sent by myself, ignore echo (we already rendered it locally)
            if (msg.sender && msg.sender.id === this.user.id) return;

            const msgId = msg.id || actionId;
            if (msgId && this.processedMessageIds.has(msgId)) return;
            if (msgId) this.processedMessageIds.add(msgId);

            this.saveChatMessage(this.roomCode, msg);
            if (this.onChatMessageCallback) this.onChatMessageCallback(msg);
        }
    }

    // ================= HOST MIGRATION (KHI HOST OFF) =================
    handleHostMigration() {
        if (this.isHost || !this.roomCode) return;

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
            console.log('[HostMigration] I am becoming the new Host!');
            if (this.peer) {
                try { this.peer.destroy(); } catch (e) {}
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
            console.log(`[HostMigration] Waiting for new host (${nextHostCandidate.name}) to claim room...`);
            if (this.peer) {
                try { this.peer.destroy(); } catch (e) {}
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

        const kickPayload = {
            type: 'KICK_MEMBER',
            actionId: `kick_${targetUserId}_${Date.now()}`,
            targetId: targetUserId,
            reason: 'Chủ phòng đã mời bạn ra khỏi phòng!'
        };

        // Send via WebRTC
        if (targetPeerId && this.connections[targetPeerId]) {
            try {
                this.connections[targetPeerId].send(kickPayload);
                this.connections[targetPeerId].close();
            } catch (e) {}
            delete this.connections[targetPeerId];
        }

        // Send via MQTT broadcast & direct client channel
        this.sendMqttToClient(targetUserId, kickPayload);
        this.broadcast(kickPayload);

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

        if (this.processedMessageIds) this.processedMessageIds.add(msg.id);
        if (this.recentActionIds) this.recentActionIds.add(msg.id);

        this.saveChatMessage(this.roomCode, msg);
        if (this.onChatMessageCallback) this.onChatMessageCallback(msg);

        if (this.isHost) {
            this.broadcast({
                type: 'CHAT_MESSAGE',
                actionId: msg.id,
                message: msg
            });
        } else {
            this.sendToHost({
                type: 'CHAT_MESSAGE',
                actionId: msg.id,
                message: msg
            });
        }
    }

    broadcastSystemChat(systemText) {
        const sysMsg = {
            id: 'sys_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            roomCode: this.roomCode,
            isSystem: true,
            text: systemText,
            timestamp: Date.now()
        };
        if (this.processedMessageIds) this.processedMessageIds.add(sysMsg.id);
        if (this.recentActionIds) this.recentActionIds.add(sysMsg.id);

        this.saveChatMessage(this.roomCode, sysMsg);
        if (this.onChatMessageCallback) this.onChatMessageCallback(sysMsg);
        if (this.isHost) {
            this.broadcast({
                type: 'CHAT_MESSAGE',
                actionId: sysMsg.id,
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
                if (history.some(m => m.id === msg.id)) return;
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

    // ================= DUAL-CHANNEL SENDERS =================
    // Host: broadcast to all clients via WebRTC + MQTT
    broadcast(data) {
        if (!this.isHost || !this.roomCode) return;
        if (!data.actionId) {
            data.actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }

        // 1. WebRTC DataConnections
        Object.values(this.connections).forEach(conn => {
            if (conn && conn.open) {
                try { conn.send(data); } catch (e) {}
            }
        });

        // 2. MQTT Broadcast Topic
        if (this.mqttClient && this.mqttClient.connected) {
            try {
                this.mqttClient.publish(`duojukebox/rooms/${this.roomCode}/broadcast`, JSON.stringify(data), { qos: 0 });
            } catch (e) {}
        }
    }

    // Host: Send direct message to a specific client via MQTT
    sendMqttToClient(userId, data) {
        if (!this.isHost || !this.roomCode || !this.mqttClient || !this.mqttClient.connected || !userId) return;
        try {
            this.mqttClient.publish(`duojukebox/rooms/${this.roomCode}/to_client/${userId}`, JSON.stringify(data), { qos: 0 });
        } catch (e) {}
    }

    // Client: Send command/request to Host via WebRTC + MQTT
    sendToHost(data) {
        if (this.isHost || !this.roomCode) return;
        if (!data.actionId) {
            data.actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }

        let sentP2P = false;
        if (this.hostConn && this.hostConn.open) {
            try {
                this.hostConn.send(data);
                sentP2P = true;
            } catch (e) {
                sentP2P = false;
            }
        }

        // Always also send over MQTT to guarantee delivery across any network/NAT
        if (this.mqttClient && this.mqttClient.connected) {
            try {
                this.mqttClient.publish(`duojukebox/rooms/${this.roomCode}/to_host`, JSON.stringify(data), { qos: 0 });
            } catch (e) {}
        }
    }

    broadcastMemberList() {
        this.broadcast({
            type: 'MEMBER_LIST',
            actionId: `mlist_${Date.now()}`,
            members: this.members
        });
    }

    broadcastState(state) {
        if (this.isHost) {
            this.broadcast({
                type: 'FULL_STATE_SYNC',
                actionId: `state_${Date.now()}`,
                state: state
            });
        }
    }

    broadcastProgress(currentTime, duration, isPlaying) {
        if (!this.isHost || !this.roomCode) return;
        const data = {
            type: 'PROGRESS_SYNC',
            currentTime: currentTime,
            duration: duration,
            isPlaying: isPlaying,
            timestamp: Date.now()
        };

        // WebRTC DataConnections (real-time low latency)
        Object.values(this.connections).forEach(conn => {
            if (conn && conn.open) {
                try { conn.send(data); } catch (e) {}
            }
        });

        // Throttle MQTT progress broadcast to max 1 per second to prevent network saturation
        const now = Date.now();
        if (!this.lastMqttProgressTime || now - this.lastMqttProgressTime >= 1000) {
            this.lastMqttProgressTime = now;
            if (this.mqttClient && this.mqttClient.connected) {
                try {
                    this.mqttClient.publish(`duojukebox/rooms/${this.roomCode}/broadcast`, JSON.stringify(data), { qos: 0 });
                } catch (e) {}
            }
        }
    }

    // ================= CLIENT ACTION SENDERS =================
    sendAddToQueue(song, mode = 'bottom') {
        if (this.isHost) {
            if (this.onAddQueueCallback) {
                this.onAddQueueCallback(song, this.user, mode);
            }
        } else {
            this.sendToHost({
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
        } else {
            this.sendToHost({
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
        } else {
            this.sendToHost({
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
        } else {
            this.sendToHost({
                type: 'CONTROL_CMD',
                command: command,
                payload: payload
            });
        }
    }

    // ================= DISCONNECT / OUT ROOM =================
    disconnect() {
        if (this.joinTimeoutTimer) {
            clearTimeout(this.joinTimeoutTimer);
            this.joinTimeoutTimer = null;
        }

        const prevRoom = this.roomCode;
        this.stopHostHeartbeat();

        if (prevRoom) {
            if (!this.isHost) {
                try {
                    this.sendToHost({ type: 'LEAVE', userId: this.user.id });
                } catch (e) {}
            }
            this.unsubscribeRoomMqttTopics(prevRoom);
        }

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
        this.isConnected = false;
        this.isConnecting = false;
        this.roomCode = null;
        this.pendingJoinCallbacks = null;
    }
}

// Global instance
window.roomNet = new RoomNetwork();
