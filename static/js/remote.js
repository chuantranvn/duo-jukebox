// DuoJukebox - Remote Controller Logic (Mobile / Tablet)

const socket = io();

// State
let currentUser = (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function") 
    ? window.DuoIdentity.getProfile() 
    : { id: "user_anon", name: "Anonymous - 0000", icon: "🎧", color: "#ec4899" };
let currentUserId = currentUser.id;
let currentTab = "tab-search";
let lastSearchQuery = "";
let isModalOpen = false;
let userFavorites = [];
let lastState = null;

// UI Elements
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const searchLoading = document.getElementById("search-loading");

const queueList = document.getElementById("queue-list");
const queueBadgeCount = document.getElementById("queue-badge-count");
const navQueueBadge = document.getElementById("nav-queue-badge");
const fairPlayToggle = document.getElementById("fair-play-toggle");
const radioModeToggle = document.getElementById("radio-mode-toggle");
const btnClearQueue = document.getElementById("btn-clear-queue");

const favoritesList = document.getElementById("favorites-list");
const favProfileIcon = document.getElementById("fav-profile-icon");
const favProfileName = document.getElementById("fav-profile-name");
const btnAddAllFavs = document.getElementById("btn-add-all-favs");

// Mini player
const miniPlayer = document.getElementById("mini-player");
const miniPlayerBar = document.getElementById("mini-player-bar");
const miniThumb = document.getElementById("mini-thumb");
const miniThumbPlaceholder = document.getElementById("mini-thumb-placeholder");
const miniTitle = document.getElementById("mini-title");
const miniArtist = document.getElementById("mini-artist");
const miniRequester = document.getElementById("mini-requester");
const btnMiniPlay = document.getElementById("btn-mini-play");
const iconMiniPlay = document.getElementById("icon-mini-play");
const btnMiniNext = document.getElementById("btn-mini-next");
const miniProgressBar = document.getElementById("mini-progress-bar");
const miniPlayingIndicator = document.getElementById("mini-playing-indicator");

// Expanded modal
const expandedModal = document.getElementById("expanded-player-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const modalThumb = document.getElementById("modal-thumb");
const modalThumbPlaceholder = document.getElementById("modal-thumb-placeholder");
const modalTitle = document.getElementById("modal-title");
const modalArtist = document.getElementById("modal-artist");
const modalRequesterIcon = document.getElementById("modal-requester-icon");
const modalRequesterName = document.getElementById("modal-requester-name");
const modalRequesterBadge = document.getElementById("modal-requester-badge");
const modalSeekBar = document.getElementById("modal-seek-bar");
const modalCurrentTime = document.getElementById("modal-current-time");
const modalDuration = document.getElementById("modal-duration");
const btnModalPrev = document.getElementById("btn-modal-prev");
const btnModalPlay = document.getElementById("btn-modal-play");
const iconModalPlay = document.getElementById("icon-modal-play");
const btnModalNext = document.getElementById("btn-modal-next");
const modalVolume = document.getElementById("modal-volume");
const btnRemoteMute = document.getElementById("btn-remote-mute");
const iconRemoteMute = document.getElementById("icon-remote-mute");
const remoteVolumePercent = document.getElementById("remote-volume-percent");

let remoteVolume = parseInt(localStorage.getItem("duojukebox_volume") || "80", 10);
let remotePrevVolume = parseInt(localStorage.getItem("duojukebox_prev_volume") || "80", 10);

function updateRemoteVolumeUI(vol) {
    vol = parseInt(vol, 10);
    if (isNaN(vol)) vol = 80;
    vol = Math.max(0, Math.min(100, vol));

    remoteVolume = vol;
    if (vol > 0) {
        remotePrevVolume = vol;
        localStorage.setItem("duojukebox_prev_volume", vol);
    }
    localStorage.setItem("duojukebox_volume", vol);

    if (modalVolume) modalVolume.value = vol;
    if (remoteVolumePercent) remoteVolumePercent.textContent = `${vol}%`;

    if (btnRemoteMute) {
        let iconName = "volume-2";
        let colorClass = "text-pink-400";
        if (vol === 0) {
            iconName = "volume-x";
            colorClass = "text-red-400";
        } else if (vol < 50) {
            iconName = "volume-1";
            colorClass = "text-slate-200";
        }
        btnRemoteMute.innerHTML = `<i id="icon-remote-mute" data-lucide="${iconName}" class="w-5 h-5 ${colorClass}"></i>`;
        lucide.createIcons();
    }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    updateProfileDisplay();
    updateRemoteVolumeUI(remoteVolume);

    // Setup Nickname Modal
    if (window.DuoIdentity && typeof window.DuoIdentity.setupModal === "function") {
        window.DuoIdentity.setupModal({
            modalId: "profile-modal",
            openBtnId: "btn-open-profile-modal",
            closeBtnId: "btn-close-profile-modal",
            nameInputId: "input-profile-name",
            randomBtnId: "btn-random-name",
            avatarGridId: "profile-avatar-grid",
            previewAvatarId: "profile-preview-avatar",
            saveBtnId: "btn-save-profile",
            onSaved: (updated) => {
                updateProfileDisplay();
                loadFavorites();
                showToast(`Đã lưu danh xưng: ${updated.icon} ${updated.name}`);
            }
        });
    }

    loadFavorites();
    initEventListeners();
});

// ================= PROFILE / IDENTITY =================

function updateProfileDisplay() {
    if (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function") {
        currentUser = window.DuoIdentity.getProfile();
        currentUserId = currentUser.id;
    }

    const displayAvatar = document.getElementById("display-user-avatar");
    const displayName = document.getElementById("display-user-name");
    if (displayAvatar) displayAvatar.textContent = currentUser.icon;
    if (displayName) displayName.textContent = currentUser.name;

    if (favProfileIcon) favProfileIcon.textContent = currentUser.icon;
    if (favProfileName) favProfileName.textContent = currentUser.name;
}

// ================= TAB NAVIGATION =================

function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    const activeEl = document.getElementById(tabId);
    if (activeEl) activeEl.classList.remove("hidden");

    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
        const t = btn.getAttribute("data-tab");
        if (t === tabId) {
            btn.classList.add("text-pink-400");
            btn.classList.remove("text-slate-400");
        } else {
            btn.classList.remove("text-pink-400");
            btn.classList.add("text-slate-400");
        }
    });
}

// ================= EVENT LISTENERS =================

function initEventListeners() {
    // Profile clicks
    document.querySelectorAll(".profile-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setProfile(btn.getAttribute("data-user"));
        });
    });

    // Tab buttons
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            switchTab(btn.getAttribute("data-tab"));
        });
    });

    // Suggestion tags
    document.querySelectorAll(".tag-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            searchInput.value = btn.textContent;
            performSearch(btn.textContent);
        });
    });

    // Search submit
    searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = searchInput.value.trim();
        if (q) performSearch(q);
    });

    // Fair play toggle
    fairPlayToggle.addEventListener("change", () => {
        fetch("/api/queue/toggle_fair_play", { method: "POST" })
            .then(res => res.json())
            .then(data => {
                showToast(data.fair_play_mode ? "⚖️ Đã BẬT chế độ Xen kẽ (Chồng - Vợ)" : "📑 Đã chuyển về chế độ Tự do (FIFO)");
            });
    });

    // Radio Mode toggle
    if (radioModeToggle) {
        radioModeToggle.addEventListener("change", () => {
            fetch("/api/queue/toggle_radio", { method: "POST" })
                .then(res => res.json())
                .then(data => {
                    showToast(data.radio_mode ? "📻 Đã BẬT Chế độ Radio tự động nối bài" : "📻 Đã TẮT Chế độ Radio");
                });
        });
    }

    // Clear queue
    btnClearQueue.addEventListener("click", () => {
        if (confirm("Bạn có chắc muốn xóa hết danh sách bài trong hàng đợi?")) {
            fetch("/api/queue/clear", { method: "POST" });
        }
    });

    // Mini player bar click -> open modal
    miniPlayerBar.addEventListener("click", () => {
        openModal();
    });

    // Close modal
    btnCloseModal.addEventListener("click", () => {
        closeModal();
    });

    // Playback control buttons
    btnMiniPlay.addEventListener("click", togglePlay);
    btnModalPlay.addEventListener("click", togglePlay);
    btnMiniNext.addEventListener("click", skipNext);
    btnModalNext.addEventListener("click", skipNext);
    btnModalPrev.addEventListener("click", skipPrev);

    // Volume
    if (modalVolume) {
        modalVolume.addEventListener("input", (e) => {
            const v = parseInt(e.target.value, 10);
            updateRemoteVolumeUI(v);
            fetch("/api/control/volume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ volume: v })
            });
        });
    }

    if (btnRemoteMute) {
        btnRemoteMute.addEventListener("click", () => {
            if (remoteVolume > 0) {
                // Đang có tiếng -> Mute
                remotePrevVolume = remoteVolume;
                localStorage.setItem("duojukebox_prev_volume", remotePrevVolume);
                updateRemoteVolumeUI(0);
                fetch("/api/control/volume", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ volume: 0 })
                });
                showToast("🔇 Đã tắt tiếng (Mute)");
            } else {
                // Đang tắt tiếng -> Bật lại
                const targetVol = remotePrevVolume > 0 ? remotePrevVolume : 80;
                updateRemoteVolumeUI(targetVol);
                fetch("/api/control/volume", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ volume: targetVol })
                });
                showToast(`🔊 Đã bật lại âm thanh (${targetVol}%)`);
            }
        });
    }

    // Seek
    modalSeekBar.addEventListener("change", (e) => {
        const dur = lastState?.duration || 0;
        if (dur > 0) {
            const targetSecs = (e.target.value / 100) * dur;
            fetch("/api/control/seek", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seconds: targetSecs })
            });
        }
    });

    // Add all favorites to queue
    btnAddAllFavs.addEventListener("click", () => {
        if (!userFavorites || userFavorites.length === 0) {
            showToast("Danh sách bài tủ đang trống!");
            return;
        }
        userFavorites.forEach(song => {
            addToQueue(song, "bottom", false);
        });
        showToast(`Đã thêm ${userFavorites.length} bài vào hàng đợi!`);
        switchTab("tab-queue");
    });
}

// ================= MODAL CONTROLS =================

function openModal() {
    isModalOpen = true;
    expandedModal.classList.remove("translate-y-full");
    expandedModal.classList.add("translate-y-0");
}

function closeModal() {
    isModalOpen = false;
    expandedModal.classList.add("translate-y-full");
    expandedModal.classList.remove("translate-y-0");
}

function togglePlay() {
    if (!lastState || !lastState.current_song) return;
    if (lastState.playback_state === "playing") {
        fetch("/api/control/pause", { method: "POST" });
    } else {
        fetch("/api/control/play", { method: "POST" });
    }
}

let isSkipNextDebounced = false;
function skipNext() {
    if (isSkipNextDebounced) return;
    isSkipNextDebounced = true;
    setTimeout(() => { isSkipNextDebounced = false; }, 400);

    fetch("/api/control/next", { method: "POST" })
        .then(res => res.json())
        .then(data => {
            if (data && data.success) {
                if (data.current_song) {
                    showToast(`⏭️ Đang chuyển: ${data.current_song.title}`);
                } else {
                    showToast("⏭️ Đã hết bài trong hàng đợi");
                }
            }
        })
        .catch(err => console.error("Error skipNext:", err));
}

let isSkipPrevDebounced = false;
function skipPrev() {
    if (isSkipPrevDebounced) return;
    isSkipPrevDebounced = true;
    setTimeout(() => { isSkipPrevDebounced = false; }, 400);

    fetch("/api/control/prev", { method: "POST" })
        .then(res => res.json())
        .then(data => {
            if (data && data.success && data.current_song) {
                showToast(`⏮️ Phát lại: ${data.current_song.title}`);
            }
        })
        .catch(err => console.error("Error skipPrev:", err));
}

// ================= SEARCH =================

function performSearch(query) {
    lastSearchQuery = query;
    searchLoading.classList.remove("hidden");
    searchResults.innerHTML = "";

    fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(items => {
            searchLoading.classList.add("hidden");
            renderSearchResults(items);
        })
        .catch(err => {
            searchLoading.classList.add("hidden");
            searchResults.innerHTML = `<div class="text-center text-red-400 py-10 text-xs">Lỗi kết nối khi tìm kiếm: ${err.message}</div>`;
        });
}

function renderSearchResults(items) {
    if (!items || items.length === 0) {
        searchResults.innerHTML = `
            <div class="text-center py-10 px-4 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-xl space-y-2.5">
                <div class="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center mx-auto border border-white/10 shadow">
                    <i data-lucide="search-x" class="w-5 h-5"></i>
                </div>
                <h4 class="text-xs font-bold text-white">Không tìm thấy bài hát nào</h4>
                <p class="text-[11px] text-slate-300 max-w-xs mx-auto">Hãy thử tìm từ khóa khác hoặc dán link YouTube trực tiếp nhé!</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    searchResults.innerHTML = items.map(song => {
        const isFav = userFavorites.some(f => f.id === song.id);
        const songDataEscaped = encodeURIComponent(JSON.stringify(song));
        return `
            <div class="song-result-card flex items-center space-x-3 p-3 rounded-2xl bg-slate-900/95 border border-slate-700/80 hover:border-pink-500/60 transition shadow-lg">
                <div class="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                    <img src="${song.thumbnail}" alt="" draggable="false" class="w-full h-full object-cover pointer-events-none">
                    <span class="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[9px] font-mono text-white/90 leading-none">${song.duration}</span>
                </div>
                
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-white truncate leading-tight">${song.title}</h4>
                    <p class="text-[10px] text-slate-300 truncate mt-1">${song.artist}</p>
                    
                    <!-- Quick action buttons -->
                    <div class="flex items-center space-x-2 mt-2">
                        <button onclick="handleAddToQueue('${songDataEscaped}', 'bottom')" class="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-semibold flex items-center space-x-1 shadow transition">
                            <i data-lucide="plus" class="w-3 h-3"></i>
                            <span>Thêm Queue</span>
                        </button>
                        <button onclick="handleAddToQueue('${songDataEscaped}', 'next')" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium transition" title="Phát tiếp theo">
                            Phát tiếp
                        </button>
                        <button onclick="handleAddToQueue('${songDataEscaped}', 'now')" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium transition" title="Phát ngay">
                            Phát ngay
                        </button>
                        <button onclick="handleToggleFavorite('${songDataEscaped}')" class="p-1 rounded-lg text-slate-400 hover:text-pink-400 transition" title="Yêu thích">
                            <i data-lucide="heart" class="w-4 h-4 ${isFav ? 'text-pink-500 fill-pink-500' : ''}"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

window.handleAddToQueue = function (escapedSong, mode) {
    const song = JSON.parse(decodeURIComponent(escapedSong));
    addToQueue(song, mode, true);
};

function addToQueue(song, mode = "bottom", notify = true) {
    if (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function") {
        currentUser = window.DuoIdentity.getProfile();
        currentUserId = currentUser.id;
    }
    fetch("/api/queue/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            song: song,
            user_id: currentUser.id,
            user_info: currentUser,
            mode: mode
        })
    })
    .then(res => res.json())
    .then(data => {
        if (notify) {
            const userName = `${currentUser.icon} ${currentUser.name}`;
            if (mode === "now") {
                showToast(`${userName} đang phát: ${song.title}`);
            } else if (mode === "next") {
                showToast(`${userName} đã chèn phát tiếp theo: ${song.title}`);
            } else {
                showToast(`${userName} đã thêm vào hàng đợi!`);
            }
        }
    });
}

window.handleToggleFavorite = function (escapedSong) {
    const song = JSON.parse(decodeURIComponent(escapedSong));
    fetch("/api/favorites/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: currentUserId,
            song: song
        })
    })
    .then(res => res.json())
    .then(data => {
        userFavorites = data.favorites || [];
        showToast(data.is_favorite ? "❤️ Đã lưu vào bài tủ!" : "Đã xóa khỏi bài tủ!");
        renderFavorites();
        if (lastSearchQuery) {
            // refresh search icons
            const heartIcons = document.querySelectorAll(`[onclick*="${song.id}"] i`);
            heartIcons.forEach(icon => {
                if (data.is_favorite) {
                    icon.classList.add("text-pink-500", "fill-pink-500");
                } else {
                    icon.classList.remove("text-pink-500", "fill-pink-500");
                }
            });
        }
    });
};

// ================= FAVORITES =================

function loadFavorites() {
    fetch(`/api/favorites?user_id=${currentUserId}`)
        .then(res => res.json())
        .then(items => {
            userFavorites = items || [];
            renderFavorites();
        });
}

function renderFavorites() {
    if (!userFavorites || userFavorites.length === 0) {
        favoritesList.innerHTML = `
            <div class="text-center py-10 px-4 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-xl space-y-2.5">
                <div class="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center mx-auto border border-pink-500/30 shadow">
                    <i data-lucide="heart" class="w-5 h-5"></i>
                </div>
                <h4 class="text-xs font-bold text-white">Chưa có bài hát yêu thích</h4>
                <p class="text-[11px] text-slate-300 max-w-xs mx-auto leading-relaxed">
                    Bấm icon <span class="text-pink-400 font-bold">❤️</span> khi tìm kiếm để lưu bài hát vào đây nghe lại nhé!
                </p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    favoritesList.innerHTML = userFavorites.map(song => {
        const songDataEscaped = encodeURIComponent(JSON.stringify(song));
        return `
            <div class="fav-song-card flex items-center space-x-3 p-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-md hover:border-pink-500/50 transition">
                <img src="${song.thumbnail}" alt="" draggable="false" class="w-12 h-12 rounded-xl object-cover bg-slate-800 shrink-0 pointer-events-none">
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-white truncate">${song.title}</h4>
                    <p class="text-[10px] text-slate-300 truncate mt-0.5">${song.artist}</p>
                </div>
                <div class="flex items-center space-x-1 shrink-0">
                    <button onclick="handleAddToQueue('${songDataEscaped}', 'bottom')" class="p-2 rounded-xl bg-pink-600/20 text-pink-400 hover:bg-pink-600 hover:text-white transition text-xs font-semibold" title="Thêm vào queue">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                    </button>
                    <button onclick="handleToggleFavorite('${songDataEscaped}')" class="p-2 text-pink-500 hover:text-slate-300 transition" title="Bỏ yêu thích">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

// ================= QUEUE =================

function renderQueue(queue) {
    queueBadgeCount.textContent = queue.length;
    if (queue.length > 0) {
        navQueueBadge.textContent = queue.length;
        navQueueBadge.classList.remove("hidden");
    } else {
        navQueueBadge.classList.add("hidden");
    }

    if (!queue || queue.length === 0) {
        queueList.innerHTML = `
            <div class="text-center py-10 px-4 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-xl space-y-2.5">
                <div class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30 shadow">
                    <i data-lucide="music" class="w-5 h-5"></i>
                </div>
                <h4 class="text-xs font-bold text-white">Hàng đợi đang trống</h4>
                <p class="text-[11px] text-slate-300 max-w-xs mx-auto leading-relaxed">
                    Hãy chuyển sang tab <span class="text-pink-300 font-bold">Tìm bài</span> và bấm <span class="text-pink-400 font-bold">+ Thêm Queue</span> để cùng phát ra loa nhé!
                </p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const totalItems = queue.length;
    queueList.innerHTML = queue.map((item, idx) => {
        const canMoveUp = idx > 0;
        const canMoveDown = idx < totalItems - 1;
        const isPri = !!item.is_priority;
        return `
        <div class="queue-item flex items-center space-x-2.5 p-3 rounded-2xl transition select-none ${isPri ? 'bg-amber-950/30 border-2 border-amber-400/80 shadow-lg shadow-amber-500/10' : 'bg-slate-900 border border-slate-700/80 shadow-md'}"
             draggable="true"
             data-index="${idx}"
             data-uid="${item.uid}">
            <!-- Drag Handle -->
            <div class="drag-handle touch-none p-1.5 text-slate-400 hover:text-pink-400 cursor-grab active:cursor-grabbing shrink-0 transition" title="Kéo thả vị trí bài hát">
                <i data-lucide="grip-vertical" class="w-4 h-4"></i>
            </div>

            <!-- Position Index -->
            <span class="text-xs font-mono font-bold ${isPri ? 'text-amber-400' : 'text-pink-400'} w-4 text-center shrink-0">${idx + 1}</span>

            <!-- Thumbnail -->
            <div class="relative shrink-0">
                <img src="${item.thumbnail}" alt="" draggable="false" class="w-12 h-12 rounded-xl object-cover bg-slate-800 pointer-events-none border ${isPri ? 'border-amber-400/50' : 'border-white/10'}">
                ${isPri ? '<span class="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span></span>' : ''}
            </div>

            <!-- Title & Details -->
            <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-1.5">
                    <h4 class="text-xs font-bold ${isPri ? 'text-amber-200' : 'text-white'} truncate leading-tight">${item.title}</h4>
                    ${isPri ? '<span class="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-500/30 text-amber-300 border border-amber-400/60 animate-pulse">⚡ PHÁT TIẾP</span>' : ''}
                </div>
                <div class="flex items-center space-x-1.5 text-[10px] text-slate-300 mt-1">
                    <span class="truncate">${item.artist}</span>
                    <span>•</span>
                    <span class="font-mono text-slate-400">${item.duration}</span>
                </div>
                <div class="mt-1">
                    <span class="inline-flex items-center space-x-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style="background-color: ${item.added_by_color}25; color: ${item.added_by_color}; border: 1px solid ${item.added_by_color}50">
                        <span>${item.added_by_icon}</span>
                        <span>${item.added_by_name}</span>
                    </span>
                </div>
            </div>

            <!-- Action Controls: Priority + Up/Down Buttons + Move to Top + Delete -->
            <div class="flex items-center space-x-1 shrink-0">
                <!-- Priority Toggle Button -->
                <button onclick="handleTogglePriority('${item.uid}')" 
                        class="p-1.5 rounded-lg transition ${isPri ? 'text-amber-300 bg-amber-500/30 border border-amber-400/50 shadow' : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'}" 
                        title="${isPri ? 'Hủy ưu tiên phát tiếp' : 'Ưu tiên phát ở bài kế tiếp'}">
                    <i data-lucide="zap" class="w-4 h-4 ${isPri ? 'fill-current' : ''}"></i>
                </button>

                <!-- Move Up Button -->
                <button onclick="handleMoveStep(${idx}, -1)" 
                        class="p-1.5 rounded-lg transition ${canMoveUp ? 'text-slate-300 hover:text-pink-400 hover:bg-slate-800' : 'text-slate-600 opacity-40 cursor-not-allowed'}" 
                        ${canMoveUp ? '' : 'disabled'}
                        title="Đẩy lên 1 vị trí">
                    <i data-lucide="chevron-up" class="w-4 h-4"></i>
                </button>

                <!-- Move Down Button -->
                <button onclick="handleMoveStep(${idx}, 1)" 
                        class="p-1.5 rounded-lg transition ${canMoveDown ? 'text-slate-300 hover:text-pink-400 hover:bg-slate-800' : 'text-slate-600 opacity-40 cursor-not-allowed'}" 
                        ${canMoveDown ? '' : 'disabled'}
                        title="Hạ xuống 1 vị trí">
                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                </button>

                <!-- Move to Top Button -->
                <button onclick="handleMoveToTop('${item.uid}')" 
                        class="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition ${idx === 0 ? 'hidden' : ''}" 
                        title="Đẩy lên đầu hàng đợi">
                    <i data-lucide="arrow-up-to-line" class="w-4 h-4"></i>
                </button>

                <!-- Remove Button -->
                <button onclick="handleRemoveFromQueue('${item.uid}')" 
                        class="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition" 
                        title="Xóa khỏi hàng đợi">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
        `;
    }).join("");

    initQueueDragAndDrop(queueList, window.handleReorderQueue);
    lucide.createIcons();
}

function initQueueDragAndDrop(container, onReorder) {
    if (!container) return;
    let draggedItem = null;
    let draggedIndex = null;
    let currentOverItem = null;

    container.querySelectorAll(".queue-item").forEach((item) => {
        // Prevent native dragging on buttons and images
        item.querySelectorAll("img, button").forEach(el => {
            el.setAttribute("draggable", "false");
        });

        // Desktop HTML5 Drag and Drop
        item.addEventListener("dragstart", (e) => {
            if (e.target.closest("button")) {
                e.preventDefault();
                return;
            }
            draggedItem = item;
            draggedIndex = parseInt(item.getAttribute("data-index"), 10);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", draggedIndex);
            setTimeout(() => item.classList.add("dragging"), 0);
        });

        item.addEventListener("dragend", () => {
            item.classList.remove("dragging");
            container.querySelectorAll(".queue-item").forEach(el => el.classList.remove("drag-over"));
            draggedItem = null;
            draggedIndex = null;
            currentOverItem = null;
        });

        item.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (draggedItem && draggedItem !== item) {
                container.querySelectorAll(".queue-item").forEach(el => {
                    if (el !== item) el.classList.remove("drag-over");
                });
                item.classList.add("drag-over");
            }
        });

        item.addEventListener("dragleave", (e) => {
            if (!item.contains(e.relatedTarget)) {
                item.classList.remove("drag-over");
            }
        });

        item.addEventListener("drop", (e) => {
            e.preventDefault();
            item.classList.remove("drag-over");
            if (draggedIndex !== null) {
                const targetIndex = parseInt(item.getAttribute("data-index"), 10);
                if (draggedIndex !== targetIndex) {
                    onReorder(draggedIndex, targetIndex);
                }
            }
        });

        // Mobile Touch Support via Drag Handle
        const handle = item.querySelector(".drag-handle");
        if (handle) {
            handle.addEventListener("touchstart", (e) => {
                draggedItem = item;
                draggedIndex = parseInt(item.getAttribute("data-index"), 10);
                item.classList.add("dragging");
            }, { passive: true });

            handle.addEventListener("touchmove", (e) => {
                if (!draggedItem) return;
                e.preventDefault();
                const touch = e.touches[0];
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetItem = elementBelow ? elementBelow.closest(".queue-item") : null;

                if (targetItem && targetItem !== currentOverItem) {
                    if (currentOverItem) currentOverItem.classList.remove("drag-over");
                    currentOverItem = targetItem;
                    if (currentOverItem !== draggedItem) {
                        currentOverItem.classList.add("drag-over");
                    }
                }
            }, { passive: false });

            const handleTouchEnd = () => {
                if (!draggedItem) return;
                draggedItem.classList.remove("dragging");
                if (currentOverItem && currentOverItem !== draggedItem) {
                    currentOverItem.classList.remove("drag-over");
                    const targetIndex = parseInt(currentOverItem.getAttribute("data-index"), 10);
                    if (draggedIndex !== targetIndex) {
                        onReorder(draggedIndex, targetIndex);
                    }
                }
                draggedItem = null;
                draggedIndex = null;
                currentOverItem = null;
            };

            handle.addEventListener("touchend", handleTouchEnd);
            handle.addEventListener("touchcancel", handleTouchEnd);
        }
    });
}

window.handleMoveStep = function (fromIdx, direction) {
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || !lastState || !lastState.queue || toIdx >= lastState.queue.length) return;
    window.handleReorderQueue(fromIdx, toIdx);
};

window.handleReorderQueue = function (fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (window.roomNetwork && window.roomNetwork.currentRoom) {
        window.roomNetwork.sendReorderQueue(fromIdx, toIdx);
        showToast("Đã đổi thứ tự bài hát trong phòng!");
        return;
    }
    fetch("/api/queue/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_index: fromIdx, to_index: toIdx })
    })
    .then(res => res.json())
    .then(data => {
        showToast("Đã đổi thứ tự bài hát trong hàng đợi!");
    });
};

window.handleRemoveFromQueue = function (uid) {
    fetch("/api/queue/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uid })
    });
};

window.handleMoveToTop = function (uid) {
    fetch("/api/queue/move_top", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uid })
    });
};

window.handleTogglePriority = function (uid) {
    if (window.roomNet && roomNet.peer && !roomNet.isHost) {
        roomNet.sendTogglePriority(uid);
        return;
    }
    fetch("/api/queue/toggle_priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uid })
    })
    .then(res => res.json())
    .then(data => {
        const target = (data.state && data.state.queue) ? data.state.queue.find(s => s.uid === uid) : null;
        if (target && target.is_priority) {
            showToast(`⚡ Đã ưu tiên phát tiếp: ${target.title}`);
        } else {
            showToast("Đã hủy ưu tiên phát tiếp");
        }
    })
    .catch(err => console.error("Error handleTogglePriority:", err));
};

function updatePlayerConnectionStatus(hasPlayer) {
    const banner = document.getElementById("player-status-banner");
    const icon = document.getElementById("player-status-icon");
    const title = document.getElementById("player-status-title");
    const desc = document.getElementById("player-status-desc");
    const btn = document.getElementById("player-status-btn");
    if (!banner || !title || !desc) return;

    if (hasPlayer) {
        banner.classList.remove("border-amber-500/50", "bg-amber-950/20");
        banner.classList.add("border-emerald-500/40", "bg-slate-900/90");
        if (icon) {
            icon.className = "w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0";
        }
        title.innerHTML = `🟢 Màn hình Loa: <span class="text-emerald-400 font-bold">Đang kết nối</span>`;
        desc.textContent = "Nhạc đang phát trực tiếp trên màn hình Player của bạn.";
        if (btn) {
            btn.className = "px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 border border-emerald-500/30 shrink-0 hover:scale-105 active:scale-95";
            btn.innerHTML = `<span>Xem Player</span><i data-lucide="external-link" class="w-3.5 h-3.5"></i>`;
        }
    } else {
        banner.classList.remove("border-emerald-500/40");
        banner.classList.add("border-amber-500/50", "bg-amber-950/20");
        if (icon) {
            icon.className = "w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 shrink-0";
        }
        title.innerHTML = `⚠️ Màn hình Loa: <span class="text-amber-400 font-bold">Chưa mở</span>`;
        desc.textContent = "Nhạc chỉ phát ra loa khi mở Màn hình Player. Bấm nút bên cạnh để mở!";
        if (btn) {
            btn.className = "px-3.5 py-2 bg-gradient-to-r from-pink-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-pink-500/25 shrink-0 hover:scale-105 active:scale-95";
            btn.innerHTML = `<span>Mở Player</span><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>`;
        }
    }
}

// ================= SOCKET LISTENERS =================

socket.on("state_update", (state) => {
    lastState = state;
    renderQueue(state.queue);
    fairPlayToggle.checked = state.fair_play_mode;
    if (radioModeToggle) radioModeToggle.checked = !!state.radio_mode;

    if (state.has_active_player !== undefined) {
        updatePlayerConnectionStatus(state.has_active_player);
        if (state.current_song && state.has_active_player === false && !window.__warnedNoPlayer) {
            window.__warnedNoPlayer = true;
            showToast("📢 Nhạc đang chờ! Nhấn 'Mở Player' để nghe tiếng ra loa nhé");
        } else if (state.has_active_player === true) {
            window.__warnedNoPlayer = false;
        }
    }

    if (state.volume !== undefined && state.volume !== null) {
        updateRemoteVolumeUI(state.volume);
    }

    // Update Mini Player & Modal
    if (state.current_song) {
        miniPlayer.classList.remove("hidden");
        
        if (state.current_song.thumbnail) {
            miniThumb.src = state.current_song.thumbnail;
            miniThumb.classList.remove("hidden");
            if (miniThumbPlaceholder) miniThumbPlaceholder.classList.add("hidden");

            modalThumb.src = state.current_song.thumbnail;
            modalThumb.classList.remove("hidden");
            if (modalThumbPlaceholder) modalThumbPlaceholder.classList.add("hidden");
        } else {
            miniThumb.src = "";
            miniThumb.classList.add("hidden");
            if (miniThumbPlaceholder) miniThumbPlaceholder.classList.remove("hidden");

            modalThumb.src = "";
            modalThumb.classList.add("hidden");
            if (modalThumbPlaceholder) modalThumbPlaceholder.classList.remove("hidden");
        }

        miniTitle.textContent = state.current_song.title || "Chưa rõ";
        miniArtist.textContent = state.current_song.artist || "YouTube";
        
        miniRequester.textContent = `${state.current_song.added_by_icon || ''} ${state.current_song.added_by_name || ''}`;
        miniRequester.style.color = state.current_song.added_by_color || "#cbd5e1";

        // Modal
        modalTitle.textContent = state.current_song.title || "";
        modalArtist.textContent = state.current_song.artist || "";
        modalRequesterIcon.textContent = state.current_song.added_by_icon || "👤";
        modalRequesterName.textContent = state.current_song.added_by_name || "";
        modalRequesterBadge.style.backgroundColor = `${state.current_song.added_by_color || '#ec4899'}33`;
        modalRequesterBadge.style.borderColor = state.current_song.added_by_color || '#ec4899';

        const isPlaying = state.playback_state === "playing";
        const btnMini = document.getElementById("btn-mini-play");
        const btnModal = document.getElementById("btn-modal-play");
        const elMiniWave = document.getElementById("mini-sound-wave");
        const elModalWave = document.getElementById("modal-sound-wave");
        const elModalWaveLabel = document.getElementById("modal-sound-wave-label");

        if (btnMini) {
            btnMini.innerHTML = `<i data-lucide="${isPlaying ? 'pause' : 'play'}" class="w-6 h-6 fill-current"></i>`;
        }
        if (btnModal) {
            btnModal.innerHTML = `<i data-lucide="${isPlaying ? 'pause' : 'play'}" class="w-8 h-8 fill-current"></i>`;
        }
        if (isPlaying) {
            miniPlayingIndicator.classList.remove("hidden");
            if (elMiniWave) {
                elMiniWave.classList.remove("hidden");
                elMiniWave.classList.add("active");
            }
            if (elModalWave) {
                elModalWave.classList.remove("hidden");
                elModalWave.classList.add("active");
            }
            if (elModalWaveLabel) elModalWaveLabel.classList.remove("hidden");
        } else {
            miniPlayingIndicator.classList.add("hidden");
            if (elMiniWave) elMiniWave.classList.remove("active");
            if (elModalWave) elModalWave.classList.remove("active");
            if (elModalWaveLabel) elModalWaveLabel.classList.add("hidden");
        }
    } else {
        miniTitle.textContent = "Chưa phát bài nào";
        miniArtist.textContent = "DuoJukebox";
        miniRequester.textContent = "--";

        miniThumb.src = "";
        miniThumb.classList.add("hidden");
        if (miniThumbPlaceholder) miniThumbPlaceholder.classList.remove("hidden");

        modalThumb.src = "";
        modalThumb.classList.add("hidden");
        if (modalThumbPlaceholder) modalThumbPlaceholder.classList.remove("hidden");

        const btnMini = document.getElementById("btn-mini-play");
        const btnModal = document.getElementById("btn-modal-play");
        if (btnMini) btnMini.innerHTML = `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
        if (btnModal) btnModal.innerHTML = `<i data-lucide="play" class="w-8 h-8 fill-current"></i>`;
        miniPlayingIndicator.classList.add("hidden");

        const elMiniWave = document.getElementById("mini-sound-wave");
        const elModalWave = document.getElementById("modal-sound-wave");
        const elModalWaveLabel = document.getElementById("modal-sound-wave-label");
        if (elMiniWave) elMiniWave.classList.add("hidden");
        if (elModalWave) elModalWave.classList.add("hidden");
        if (elModalWaveLabel) elModalWaveLabel.classList.add("hidden");
    }

    if (state.volume !== undefined && state.volume !== null) {
        updateRemoteVolumeUI(state.volume);
    }
    lucide.createIcons();
});

socket.on("player_cmd", (data) => {
    if (data && data.command === "set_volume" && data.volume !== undefined) {
        updateRemoteVolumeUI(data.volume);
    }
});

socket.on("sync_progress", (data) => {
    const cur = data.current_time || 0;
    const dur = data.duration || 0;
    if (dur > 0) {
        const pct = (cur / dur) * 100;
        miniProgressBar.style.width = `${pct}%`;
        modalSeekBar.value = pct;
    }
    modalCurrentTime.textContent = formatTime(cur);
    modalDuration.textContent = formatTime(dur);
});

function formatTime(secs) {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Toast helper
function showToast(msg) {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-2xl backdrop-blur-xl bg-slate-900/95 border border-pink-500/30 text-white toast-animate max-w-xs text-center";
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Init Remote Wallpaper Sync
(function initRemoteWallpaper() {
    const WALLPAPERS = [
        '/static/images/bg/dj_neon_girl.jpg',
        '/static/images/bg/dj_neon_couple.jpg',
        '/static/images/bg/dj_neon_stage.jpg',
        '/static/images/bg/dj_neon_club.jpg',
        '/static/images/bg/dj_neon_vinyl.jpg'
    ];
    const savedIdx = parseInt(localStorage.getItem("duojukebox_bg_index") || "1", 10);
    const bgLayer = document.getElementById("custom-bg-layer");
    if (bgLayer && WALLPAPERS[savedIdx]) {
        bgLayer.style.backgroundImage = `url('${WALLPAPERS[savedIdx]}')`;
    }
})();
