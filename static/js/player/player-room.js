// DuoJukebox - Player Room
// Online room hub, lobby, create/join room, member list, and WebRTC synchronization callbacks.

const roomHubModal = document.getElementById("room-hub-modal");
const btnOpenRoomHub = document.getElementById("btn-open-room-hub");
const btnCloseRoomHub = document.getElementById("btn-close-room-hub");

// Tabs
const tabBtnLobby = document.getElementById("tab-btn-lobby");
const tabBtnCreateRoom = document.getElementById("tab-btn-create-room");
const tabBtnJoinRoom = document.getElementById("tab-btn-join-room");

// Panels
const panelLobbyRooms = document.getElementById("panel-lobby-rooms");
const panelCreateRoom = document.getElementById("panel-create-room");
const panelJoinRoom = document.getElementById("panel-join-room");

// Lobby elements
const activeRoomsBadgeCount = document.getElementById("active-rooms-badge-count");
const lobbyRoomsList = document.getElementById("lobby-rooms-list");

// Create / Join elements
const createRoomCodeInput = document.getElementById("create-room-code-input");
const btnRegenRoomCode = document.getElementById("btn-regen-room-code");
const createRoomName = document.getElementById("create-room-name");
const btnSubmitCreateRoom = document.getElementById("btn-submit-create-room");

const joinRoomCodeInput = document.getElementById("join-room-code-input");
const joinRoomName = document.getElementById("join-room-name");
const btnSubmitJoinRoom = document.getElementById("btn-submit-join-room");

// Room active indicators
const activeRoomBadge = document.getElementById("active-room-badge");
const activeRoomCodeText = document.getElementById("active-room-code");
const btnViewMembers = document.getElementById("btn-view-members");
const memberCountText = document.getElementById("member-count-text");

// Members modal
const roomMembersModal = document.getElementById("room-members-modal");
const btnCloseMembersModal = document.getElementById("btn-close-members-modal");
const roomMembersList = document.getElementById("room-members-list");
const modalMemberCount = document.getElementById("modal-member-count");
const btnLeaveRoom = document.getElementById("btn-leave-room");

let selectedCreateAvatar = "👨";
let selectedJoinAvatar = "👩";

// Open Room Hub Modal
if (btnOpenRoomHub) {
    btnOpenRoomHub.addEventListener("click", () => {
        if (createRoomCodeInput && !createRoomCodeInput.value) {
            const randomCode = (window.roomNet && typeof window.roomNet.generateRoomCode === "function")
                ? window.roomNet.generateRoomCode()
                : Math.floor(100000 + Math.random() * 900000).toString();
            createRoomCodeInput.value = randomCode;
        }
        if (roomHubModal) {
            roomHubModal.classList.remove("hidden");
            roomHubModal.classList.add("flex");
        }
        if (tabBtnLobby) tabBtnLobby.click();
        lucide.createIcons();
    });
}
if (btnCloseRoomHub) {
    btnCloseRoomHub.addEventListener("click", () => {
        if (roomHubModal) {
            roomHubModal.classList.add("hidden");
            roomHubModal.classList.remove("flex");
        }
    });
}
if (roomHubModal) {
    roomHubModal.addEventListener("click", (e) => {
        if (e.target === roomHubModal) {
            roomHubModal.classList.add("hidden");
            roomHubModal.classList.remove("flex");
        }
    });
}

// Switch tabs: Lobby vs Create vs Join
function switchRoomHubTab(activeTab) {
    const tabActiveCls = "py-2 rounded-xl text-xs font-bold transition bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow";
    const tabInactiveCls = "py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white";

    if (panelLobbyRooms) panelLobbyRooms.classList.toggle("hidden", activeTab !== "lobby");
    if (panelCreateRoom) panelCreateRoom.classList.toggle("hidden", activeTab !== "create");
    if (panelJoinRoom) panelJoinRoom.classList.toggle("hidden", activeTab !== "join");

    if (tabBtnLobby) tabBtnLobby.className = activeTab === "lobby" ? "py-2 rounded-xl text-xs font-bold transition bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow flex items-center justify-center space-x-1" : "py-2 rounded-xl text-xs font-bold transition text-slate-400 hover:text-white flex items-center justify-center space-x-1";
    if (tabBtnCreateRoom) tabBtnCreateRoom.className = activeTab === "create" ? tabActiveCls : tabInactiveCls;
    if (tabBtnJoinRoom) tabBtnJoinRoom.className = activeTab === "join" ? "py-2 rounded-xl text-xs font-bold transition bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow" : tabInactiveCls;
}

if (tabBtnLobby) tabBtnLobby.addEventListener("click", () => switchRoomHubTab("lobby"));
if (tabBtnCreateRoom) tabBtnCreateRoom.addEventListener("click", () => switchRoomHubTab("create"));
if (tabBtnJoinRoom) tabBtnJoinRoom.addEventListener("click", () => switchRoomHubTab("join"));

// Regen room code
if (btnRegenRoomCode) {
    btnRegenRoomCode.addEventListener("click", () => {
        createRoomCodeInput.value = window.roomNet.generateRoomCode();
    });
}

// Avatar pickers
function setupAvatarPicker(containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll(".avatar-opt").forEach(btn => {
        btn.addEventListener("click", () => {
            container.querySelectorAll(".avatar-opt").forEach(b => {
                b.className = "avatar-opt p-1.5 px-2 rounded-xl bg-slate-800 text-base";
            });
            btn.className = "avatar-opt p-1.5 px-2 rounded-xl bg-pink-600/30 border border-pink-500 text-base";
            onSelect(btn.getAttribute("data-icon"));
        });
    });
}
setupAvatarPicker("create-avatar-picker", (icon) => selectedCreateAvatar = icon);
setupAvatarPicker("join-avatar-picker", (icon) => selectedJoinAvatar = icon);

// Copy Room Code when clicking badge
if (activeRoomBadge) {
    activeRoomBadge.addEventListener("click", () => {
        const code = activeRoomCodeText.textContent;
        navigator.clipboard.writeText(code).then(() => {
            showToast(`Đã sao chép mã phòng: ${code}`);
        }).catch(() => {
            showToast(`Mã phòng: ${code}`);
        });
    });
}

// Members Modal
if (btnViewMembers && roomMembersModal) {
    btnViewMembers.addEventListener("click", () => {
        roomMembersModal.classList.remove("hidden");
        roomMembersModal.classList.add("flex");
        lucide.createIcons();
    });
}
if (btnCloseMembersModal && roomMembersModal) {
    btnCloseMembersModal.addEventListener("click", () => {
        roomMembersModal.classList.add("hidden");
        roomMembersModal.classList.remove("flex");
    });
}
if (roomMembersModal) {
    roomMembersModal.addEventListener("click", (e) => {
        if (e.target === roomMembersModal) {
            roomMembersModal.classList.add("hidden");
            roomMembersModal.classList.remove("flex");
        }
    });
}

// UI State Management for Room
function updateRoomActiveUI(roomCode) {
    btnOpenRoomHub.classList.add("hidden");
    activeRoomBadge.classList.remove("hidden");
    activeRoomBadge.classList.add("flex");
    activeRoomCodeText.textContent = roomCode;
    btnViewMembers.classList.remove("hidden");
    btnViewMembers.classList.add("flex");

    // Show floating chat button & init chat
    const btnToggleChat = document.getElementById("btn-toggle-chat");
    const chatRoomTitle = document.getElementById("chat-room-title");
    if (btnToggleChat) {
        btnToggleChat.classList.remove("hidden");
        btnToggleChat.classList.add("flex");
    }
    if (chatRoomTitle) chatRoomTitle.textContent = `#${roomCode}`;
    if (typeof renderChatHistory === "function") {
        renderChatHistory(roomCode);
    }
    lucide.createIcons();
}

function resetRoomUI() {
    activeRoomBadge.classList.add("hidden");
    activeRoomBadge.classList.remove("flex");
    btnViewMembers.classList.add("hidden");
    btnViewMembers.classList.remove("flex");
    btnOpenRoomHub.classList.remove("hidden");
    roomMembersModal.classList.add("hidden");

    const btnToggleChat = document.getElementById("btn-toggle-chat");
    const chatMessagesContainer = document.getElementById("chat-messages-container");
    if (btnToggleChat) {
        btnToggleChat.classList.add("hidden");
        btnToggleChat.classList.remove("flex");
    }
    if (typeof closeChatDrawer === "function") {
        closeChatDrawer();
    }
    if (chatMessagesContainer) {
        chatMessagesContainer.innerHTML = `<div class="text-center text-slate-500 py-10 text-[11px] italic">Bạn chưa vào phòng nào.</div>`;
    }
    lucide.createIcons();
}

// Leave Room
if (btnLeaveRoom) {
    btnLeaveRoom.addEventListener("click", () => {
        if (confirm("Bạn có chắc muốn rời khỏi phòng này?")) {
            window.roomNet.disconnect();
            resetRoomUI();
            showToast("Đã rời khỏi phòng Online");
        }
    });
}

// ================= ACTION: CREATE ROOM =================
if (btnSubmitCreateRoom) {
    btnSubmitCreateRoom.addEventListener("click", () => {
        const code = createRoomCodeInput.value.trim() || window.roomNet.generateRoomCode();
        const profile = window.DuoIdentity.getProfile();
        const name = createRoomName.value.trim() || profile.name || "Chủ phòng";

        btnSubmitCreateRoom.disabled = true;
        btnSubmitCreateRoom.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang tạo phòng...</span>`;
        lucide.createIcons();

        window.roomNet.createRoom(code, {
            name: name,
            icon: selectedCreateAvatar || profile.icon,
            color: '#ec4899'
        }, (readyCode) => {
            btnSubmitCreateRoom.disabled = false;
            btnSubmitCreateRoom.innerHTML = `<i data-lucide="crown" class="w-4 h-4"></i><span>Tạo Phòng & Bắt Đầu Nghe</span>`;
            roomHubModal.classList.add("hidden");

            updateRoomActiveUI(readyCode);
            showToast(`👑 Đã tạo phòng #${readyCode}! Bạn là Chủ phòng.`);
            lucide.createIcons();
        }, (err) => {
            btnSubmitCreateRoom.disabled = false;
            btnSubmitCreateRoom.innerHTML = `<i data-lucide="crown" class="w-4 h-4"></i><span>Tạo Phòng & Bắt Đầu Nghe</span>`;
            alert("Lỗi khi tạo phòng: " + (err.message || err));
            lucide.createIcons();
        });
    });
}

// ================= ACTION: JOIN ROOM =================
function performJoinRoom(code) {
    const profile = (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function")
        ? window.DuoIdentity.getProfile()
        : { name: "Thành viên", icon: "🎧", color: "#3b82f6" };
    const name = (joinRoomName && joinRoomName.value.trim()) ? joinRoomName.value.trim() : (profile.name || "Thành viên");

    code = (code || (joinRoomCodeInput ? joinRoomCodeInput.value : "") || "").toString().trim();
    if (!code || code.length < 5) {
        showToast("Vui lòng nhập đúng mã phòng gồm 6 số!");
        return;
    }

    const resetJoinButton = () => {
        if (btnSubmitJoinRoom) {
            btnSubmitJoinRoom.disabled = false;
            btnSubmitJoinRoom.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>Tham Gia Phòng Ngay</span>`;
            if (window.lucide) lucide.createIcons();
        }
    };

    if (btnSubmitJoinRoom) {
        btnSubmitJoinRoom.disabled = true;
        btnSubmitJoinRoom.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang kết nối...</span>`;
        if (window.lucide) lucide.createIcons();
    }

    window.roomNet.joinRoom(code, {
        name: name,
        icon: selectedJoinAvatar || profile.icon || "🎧",
        color: profile.color || '#3b82f6'
    }, (connectedCode) => {
        resetJoinButton();
        if (roomHubModal) {
            roomHubModal.classList.add("hidden");
            roomHubModal.classList.remove("flex");
        }

        updateRoomActiveUI(connectedCode);
        showToast(`🟢 Đã tham gia phòng #${connectedCode}! Đang đồng bộ...`);
        if (window.lucide) lucide.createIcons();
    }, (err) => {
        resetJoinButton();
        const errMsg = (err && err.message) ? err.message : ("Không thể kết nối đến phòng #" + code + ". Vui lòng kiểm tra lại mã phòng!");
        showToast(errMsg);
        if (window.lucide) lucide.createIcons();
    });
}

if (btnSubmitJoinRoom) {
    btnSubmitJoinRoom.addEventListener("click", () => {
        const code = (joinRoomCodeInput ? joinRoomCodeInput.value : "").trim();
        performJoinRoom(code);
    });
}

// Quick Join from Lobby
window.quickJoinRoom = function (code) {
    if (joinRoomCodeInput) joinRoomCodeInput.value = code;
    if (typeof switchRoomHubTab === "function") switchRoomHubTab("join");
    performJoinRoom(code);
};

// ================= LOBBY ACTIVE ROOMS RENDERING =================
if (window.roomNet) {
    window.roomNet.onActiveRoomsChangeCallback = function (rooms) {
        if (activeRoomsBadgeCount) activeRoomsBadgeCount.textContent = rooms.length;
        if (!lobbyRoomsList) return;

        if (!rooms || rooms.length === 0) {
            lobbyRoomsList.innerHTML = `
                <div class="text-center text-slate-500 py-10 text-xs italic">
                    Hiện chưa có phòng nào đang mở.<br>Hãy là người đầu tiên bấm <b>👑 Tạo Phòng</b> nhé!
                </div>
            `;
            return;
        }

        lobbyRoomsList.innerHTML = rooms.map(room => `
            <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 border border-white/5 hover:border-indigo-500/40 transition group">
                <div class="flex items-center space-x-3 min-w-0 flex-1 mr-2">
                    <div class="text-2xl p-2 rounded-xl bg-slate-800/80 shrink-0">${room.hostAvatar || '🎧'}</div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center space-x-2">
                            <h5 class="text-xs font-bold text-white truncate">Phòng ${room.hostName}</h5>
                            <span class="font-mono text-[11px] font-bold px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300">#${room.roomCode}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 truncate mt-0.5 flex items-center space-x-1.5">
                            <span class="text-emerald-400 font-semibold">👥 ${room.memberCount} người</span>
                            <span>•</span>
                            <span class="truncate text-slate-300">🎵 ${room.currentSong || 'Đang chờ...'}</span>
                        </p>
                    </div>
                </div>
                <button onclick="window.quickJoinRoom('${room.roomCode}')" class="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow transition shrink-0 flex items-center space-x-1">
                    <span>Vào</span>
                    <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `).join("");
        lucide.createIcons();
    };

    // Kick member (Host only)
    window.handleKickMember = function (peerId, userId, name) {
        if (confirm(`Bạn có chắc muốn mời "${name}" ra khỏi phòng không?`)) {
            window.roomNet.kickMember(peerId, userId, name);
            showToast(`Đã mời ${name} ra khỏi phòng.`);
        }
    };

    // Kicked callback
    window.roomNet.onKickedCallback = function (reason) {
        resetRoomUI();
        showToast(`🚫 ${reason}`, "warning");
        alert(reason);
    };

    // Host Migration callback
    window.roomNet.onNewHostCallback = function (newHostUser) {
        showToast(`👑 Bạn đã trở thành Chủ Phòng mới!`);
        activeRoomBadge.classList.add("animate-pulse");
        setTimeout(() => activeRoomBadge.classList.remove("animate-pulse"), 3000);
        if (window.roomNet.onMembersChangeCallback) {
            window.roomNet.onMembersChangeCallback(window.roomNet.members);
        }
    };

    // When member list changes
    window.roomNet.onMembersChangeCallback = function (members) {
        if (memberCountText) memberCountText.textContent = members.length;
        if (modalMemberCount) modalMemberCount.textContent = members.length;

        if (roomMembersList) {
            const isMeHost = window.roomNet.isHost;
            roomMembersList.innerHTML = members.map(m => {
                const isMe = (m.id === window.roomNet.user.id);
                return `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                    <div class="flex items-center space-x-3 min-w-0 flex-1">
                        <span class="text-xl p-1 rounded-lg bg-slate-800 shrink-0">${m.icon || '👤'}</span>
                        <div class="flex-1 min-w-0">
                            <h5 class="text-xs font-bold text-white truncate flex items-center space-x-1.5">
                                <span>${m.name}</span>
                                ${isMe ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold">Bạn</span>' : ''}
                                ${m.isHost ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 font-semibold">👑 Chủ phòng</span>' : ''}
                            </h5>
                            <span class="text-[10px] text-emerald-400 flex items-center space-x-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                <span>Đang nghe chung</span>
                            </span>
                        </div>
                    </div>
                    ${(isMeHost && !m.isHost && !isMe) ? `
                        <button onclick="handleKickMember('${m.peerId}', '${m.id}', '${m.name}')" class="px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-[10px] font-semibold transition flex items-center space-x-1 shrink-0 ml-2" title="Mời ra khỏi phòng">
                            <i data-lucide="user-x" class="w-3 h-3"></i>
                            <span>Đá</span>
                        </button>
                    ` : ''}
                </div>
                `;
            }).join("");
            lucide.createIcons();
        }
    };

    // Host: provide current state when new peer connects
    window.roomNet.requestCurrentStateCallback = function () {
        return {
            current_song: currentSong,
            queue: Array.from(document.querySelectorAll("#host-queue-list [data-uid]")).length ? [] : [],
            current_time: (player && isPlayerReady && player.getCurrentTime) ? player.getCurrentTime() : 0,
            is_playing: (player && isPlayerReady && player.getPlayerState) ? (player.getPlayerState() === YT.PlayerState.PLAYING) : false
        };
    };

    // Host: receive song from client
    window.roomNet.onAddQueueCallback = function (song, user, mode) {
        DuoAPI.addToQueue(song, user.id || 'guest', mode || 'bottom', user)
            .then(() => {
                showToast(`${user.name} đã thêm bài: ${song.title}`);
            });
    };

    // Client: sync state from Host
    window.roomNet.onStateSyncCallback = function (state) {
        if (!state) return;
        if (state.queue && typeof renderHostQueue === "function") renderHostQueue(state.queue);
        if (state.current_song) {
            if (!currentSong || currentSong.uid !== state.current_song.uid) {
                playSong(state.current_song);
            }
        }
    };

    // Client: sync progress from Host
    window.roomNet.onProgressSyncCallback = function (data) {
        if (!player || !isPlayerReady) return;

        if (player.getCurrentTime && player.getDuration) {
            const localTime = player.getCurrentTime() || 0;
            const hostTime = data.currentTime || 0;
            const dur = data.duration || 0;

            if (typeof updateProgressUI === "function") updateProgressUI(hostTime, dur);

            if (Math.abs(localTime - hostTime) > 1.5) {
                player.seekTo(hostTime, true);
            }

            const localState = player.getPlayerState();
            if (data.isPlaying && localState !== YT.PlayerState.PLAYING) {
                player.unMute();
                player.playVideo();
                updatePlayIcon(true);
            } else if (!data.isPlaying && localState === YT.PlayerState.PLAYING) {
                player.pauseVideo();
                updatePlayIcon(false);
            }
        }
    };

    // Host & Client: receive command
    window.roomNet.onHostCommandCallback = function (cmd, payload) {
        if (!player || !isPlayerReady) return;
        if (cmd === "play") {
            player.playVideo();
            updatePlayIcon(true);
        } else if (cmd === "pause") {
            player.pauseVideo();
            updatePlayIcon(false);
        } else if (cmd === "seek" && payload && payload.seconds !== undefined) {
            player.seekTo(payload.seconds, true);
        }
    };
}
