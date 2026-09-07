// DuoJukebox - Frontend Local NoSQL Database Engine (IndexedDB via Dexie.js)
// Lưu trữ không giới hạn dung lượng trên máy tính cá nhân (phong cách Zalo Desktop)
// Quản lý: chats (tin nhắn phòng P2P), recent_rooms (phòng đã tham gia)

class LocalStore {
    constructor() {
        this.db = null;
        this.isReady = false;
        this.initPromise = this.initDB();
    }

    async initDB() {
        if (typeof Dexie === "undefined") {
            console.warn("[LocalStore] Dexie.js not loaded. Waiting...");
            await new Promise(r => setTimeout(r, 500));
        }

        try {
            if (typeof Dexie !== "undefined") {
                this.db = new Dexie("DuoJukeboxDB");
                this.db.version(1).stores({
                    chats: '++id, roomCode, timestamp, senderId, isSystem',
                    recent_rooms: 'roomCode, lastJoined, hostName'
                });
                await this.db.open();
                this.isReady = true;
                console.log("[LocalStore] IndexedDB (DuoJukeboxDB) initialized successfully via Dexie.js!");
                
                // Tự động quét dọn tin nhắn quá 7 ngày khi khởi động
                this.autoPurgeOldChats(7).catch(e => console.warn("[LocalStore] Purge error:", e));
            } else {
                console.warn("[LocalStore] Dexie still unavailable. Using memory fallback.");
            }
        } catch (e) {
            console.error("[LocalStore] Failed to initialize IndexedDB:", e);
        }
    }

    async ensureReady() {
        if (!this.isReady) {
            await this.initPromise;
        }
    }

    // ================= CHAT MESSAGES (NOSQL OBJECT STORE) =================

    async saveChatMessage(roomCode, msg) {
        if (!roomCode || !msg) return;
        await this.ensureReady();

        const doc = {
            roomCode: roomCode.toString(),
            msgId: msg.id || ('msg_' + Date.now()),
            text: msg.text || '',
            sender: msg.sender || { id: 'unknown', name: 'Ẩn danh', icon: '👤', color: '#94a3b8' },
            senderId: (msg.sender && msg.sender.id) ? msg.sender.id : (msg.senderId || 'unknown'),
            isSystem: !!msg.isSystem,
            timestamp: msg.timestamp || Date.now()
        };

        if (this.db) {
            try {
                await this.db.chats.add(doc);
            } catch (e) {
                console.error("[LocalStore] Error saving chat message:", e);
            }
        } else {
            // Fallback localStorage
            try {
                const key = `duo_chat_${roomCode}`;
                const list = JSON.parse(localStorage.getItem(key) || "[]");
                list.push(doc);
                localStorage.setItem(key, JSON.stringify(list));
            } catch (e) {}
        }
    }

    async getRoomChatHistory(roomCode, limit = 150) {
        if (!roomCode) return [];
        await this.ensureReady();

        if (this.db) {
            try {
                const results = await this.db.chats
                    .where('roomCode')
                    .equals(roomCode.toString())
                    .sortBy('timestamp');
                return results.slice(-limit);
            } catch (e) {
                console.error("[LocalStore] Error fetching chat history:", e);
                return [];
            }
        } else {
            // Fallback localStorage
            try {
                const key = `duo_chat_${roomCode}`;
                return JSON.parse(localStorage.getItem(key) || "[]").slice(-limit);
            } catch (e) {
                return [];
            }
        }
    }

    async getChatCount(roomCode) {
        if (!roomCode) return 0;
        await this.ensureReady();
        if (this.db) {
            try {
                return await this.db.chats.where('roomCode').equals(roomCode.toString()).count();
            } catch (e) {
                return 0;
            }
        }
        return 0;
    }

    async clearRoomChats(roomCode) {
        if (!roomCode) return;
        await this.ensureReady();
        console.log(`[LocalStore] Clearing all chats for room #${roomCode}`);
        if (this.db) {
            try {
                await this.db.chats.where('roomCode').equals(roomCode.toString()).delete();
            } catch (e) {
                console.error("[LocalStore] Error clearing room chats:", e);
            }
        }
        try {
            localStorage.removeItem(`duo_chat_${roomCode}`);
            localStorage.removeItem(`duo_jukebox_chat_${roomCode}`);
        } catch (e) {}
    }

    async searchRoomChats(roomCode, keyword) {
        if (!roomCode || !keyword) return [];
        await this.ensureReady();
        const kw = keyword.toLowerCase().trim();
        if (this.db) {
            try {
                const allMsgs = await this.db.chats.where('roomCode').equals(roomCode.toString()).toArray();
                return allMsgs.filter(m => (m.text && m.text.toLowerCase().includes(kw)) || (m.sender && m.sender.name.toLowerCase().includes(kw)));
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    async autoPurgeOldChats(days = 7) {
        await this.ensureReady();
        if (!this.db) return;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        try {
            const count = await this.db.chats.where('timestamp').below(cutoff).delete();
            if (count > 0) {
                console.log(`[LocalStore] Auto-purged ${count} expired chat messages (> ${days} days).`);
            }
        } catch (e) {
            console.warn("[LocalStore] Purge old chats error:", e);
        }
    }

    // ================= RECENT ROOMS (LỊCH SỬ PHÒNG ĐÃ THAM GIA) =================

    async saveRecentRoom(roomCode, hostName = "Chủ phòng", hostAvatar = "🎧") {
        if (!roomCode) return;
        await this.ensureReady();
        const doc = {
            roomCode: roomCode.toString(),
            hostName: hostName,
            hostAvatar: hostAvatar,
            lastJoined: Date.now()
        };
        if (this.db) {
            try {
                await this.db.recent_rooms.put(doc);
            } catch (e) {}
        }
    }

    async getRecentRooms(limit = 8) {
        await this.ensureReady();
        if (this.db) {
            try {
                const list = await this.db.recent_rooms.orderBy('lastJoined').reverse().limit(limit).toArray();
                return list;
            } catch (e) {
                return [];
            }
        }
        return [];
    }
}

// Global instance
window.localStore = new LocalStore();
