// DuoJukebox - Remote Core
// Socket connection, state management, mini player, expanded modal, profile, volume, and wallpaper.

const socket = io();

// State
let currentUser = (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function") 
    ? window.DuoIdentity.getProfile() 
    : { id: "user_anon", name: "Anonymous - 0000", icon: "🎧", color: "#ec4899" };
let currentUserId = currentUser.id;
let isModalOpen = false;
let lastState = null;

// Mini player elements
const miniPlayer = document.getElementById("mini-player");
const miniPlayerBar = document.getElementById("mini-player-bar");
const miniThumb = document.getElementById("mini-thumb");
const miniThumbPlaceholder = document.getElementById("mini-thumb-placeholder");
const miniTitle = document.getElementById("mini-title");
const miniArtist = document.getElementById("mini-artist");
const miniRequester = document.getElementById("mini-requester");
const btnMiniPlay = document.getElementById("btn-mini-play");
const btnMiniNext = document.getElementById("btn-mini-next");
const miniProgressBar = document.getElementById("mini-progress-bar");
const miniPlayingIndicator = document.getElementById("mini-playing-indicator");

// Expanded modal elements
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
const btnModalNext = document.getElementById("btn-modal-next");
const modalVolume = document.getElementById("modal-volume");
const btnRemoteMute = document.getElementById("btn-remote-mute");
const remoteVolumePercent = document.getElementById("remote-volume-percent");

// Volume
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

    const favProfileIcon = document.getElementById("fav-profile-icon");
    const favProfileName = document.getElementById("fav-profile-name");
    if (favProfileIcon) favProfileIcon.textContent = currentUser.icon;
    if (favProfileName) favProfileName.textContent = currentUser.name;
}

// ================= MODAL CONTROLS =================
function openModal() {
    isModalOpen = true;
    if (expandedModal) {
        expandedModal.classList.remove("translate-y-full");
        expandedModal.classList.add("translate-y-0");
    }
}

function closeModal() {
    isModalOpen = false;
    if (expandedModal) {
        expandedModal.classList.add("translate-y-full");
        expandedModal.classList.remove("translate-y-0");
    }
}

function togglePlay() {
    if (!lastState || !lastState.current_song) return;
    if (lastState.playback_state === "playing") {
        DuoAPI.pause();
    } else {
        DuoAPI.play();
    }
}

let isSkipNextDebounced = false;
function skipNext() {
    if (isSkipNextDebounced) return;
    isSkipNextDebounced = true;
    setTimeout(() => { isSkipNextDebounced = false; }, 400);

    DuoAPI.next()
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

    DuoAPI.prev()
        .then(data => {
            if (data && data.success && data.current_song) {
                showToast(`⏮️ Phát lại: ${data.current_song.title}`);
            }
        })
        .catch(err => console.error("Error skipPrev:", err));
}

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
    if (typeof renderQueue === "function") {
        renderQueue(state.queue);
    }

    const fairPlayToggle = document.getElementById("fair-play-toggle");
    if (fairPlayToggle) fairPlayToggle.checked = state.fair_play_mode;

    const radioModeToggle = document.getElementById("radio-mode-toggle");
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
        if (miniPlayer) miniPlayer.classList.remove("hidden");

        if (state.current_song.thumbnail) {
            if (miniThumb) {
                miniThumb.src = state.current_song.thumbnail;
                miniThumb.classList.remove("hidden");
            }
            if (miniThumbPlaceholder) miniThumbPlaceholder.classList.add("hidden");

            if (modalThumb) {
                modalThumb.src = state.current_song.thumbnail;
                modalThumb.classList.remove("hidden");
            }
            if (modalThumbPlaceholder) modalThumbPlaceholder.classList.add("hidden");
        } else {
            if (miniThumb) {
                miniThumb.src = "";
                miniThumb.classList.add("hidden");
            }
            if (miniThumbPlaceholder) miniThumbPlaceholder.classList.remove("hidden");

            if (modalThumb) {
                modalThumb.src = "";
                modalThumb.classList.add("hidden");
            }
            if (modalThumbPlaceholder) modalThumbPlaceholder.classList.remove("hidden");
        }

        if (miniTitle) miniTitle.textContent = state.current_song.title || "Chưa rõ";
        if (miniArtist) miniArtist.textContent = state.current_song.artist || "YouTube";

        if (miniRequester) {
            miniRequester.textContent = `${state.current_song.added_by_icon || ''} ${state.current_song.added_by_name || ''}`;
            miniRequester.style.color = state.current_song.added_by_color || "#cbd5e1";
        }

        // Modal
        if (modalTitle) modalTitle.textContent = state.current_song.title || "";
        if (modalArtist) modalArtist.textContent = state.current_song.artist || "";
        if (modalRequesterIcon) modalRequesterIcon.textContent = state.current_song.added_by_icon || "👤";
        if (modalRequesterName) modalRequesterName.textContent = state.current_song.added_by_name || "";
        if (modalRequesterBadge) {
            modalRequesterBadge.style.backgroundColor = `${state.current_song.added_by_color || '#ec4899'}33`;
            modalRequesterBadge.style.borderColor = state.current_song.added_by_color || '#ec4899';
        }

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
            if (miniPlayingIndicator) miniPlayingIndicator.classList.remove("hidden");
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
            if (miniPlayingIndicator) miniPlayingIndicator.classList.add("hidden");
            if (elMiniWave) elMiniWave.classList.remove("active");
            if (elModalWave) elModalWave.classList.remove("active");
            if (elModalWaveLabel) elModalWaveLabel.classList.add("hidden");
        }
    } else {
        if (miniTitle) miniTitle.textContent = "Chưa phát bài nào";
        if (miniArtist) miniArtist.textContent = "DuoJukebox";
        if (miniRequester) miniRequester.textContent = "--";

        if (miniThumb) {
            miniThumb.src = "";
            miniThumb.classList.add("hidden");
        }
        if (miniThumbPlaceholder) miniThumbPlaceholder.classList.remove("hidden");

        if (modalThumb) {
            modalThumb.src = "";
            modalThumb.classList.add("hidden");
        }
        if (modalThumbPlaceholder) modalThumbPlaceholder.classList.remove("hidden");

        const btnMini = document.getElementById("btn-mini-play");
        const btnModal = document.getElementById("btn-modal-play");
        if (btnMini) btnMini.innerHTML = `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
        if (btnModal) btnModal.innerHTML = `<i data-lucide="play" class="w-8 h-8 fill-current"></i>`;
        if (miniPlayingIndicator) miniPlayingIndicator.classList.add("hidden");

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
    if (window.lucide) lucide.createIcons();
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
        if (miniProgressBar) miniProgressBar.style.width = `${pct}%`;
        if (modalSeekBar) modalSeekBar.value = pct;
    }
    if (modalCurrentTime) modalCurrentTime.textContent = formatTime(cur);
    if (modalDuration) modalDuration.textContent = formatTime(dur);
});

// Remote Wallpaper Sync
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
