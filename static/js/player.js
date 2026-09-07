// DuoJukebox - Host Player Logic

let player = null;
let isPlayerReady = false;
let currentSong = null;
let pendingSongToPlay = null;
let lastSongLoadTime = 0;
let lastEndedEmitTime = 0;
let isHostNextDebounced = false;
let progressInterval = null;
let isVideoMode = true;

const socket = io();

function logToServer(...args) {
    const msg = args.map(a => {
        try {
            return typeof a === "object" ? JSON.stringify(a) : String(a);
        } catch (e) {
            return String(a);
        }
    }).join(" ");
    console.log("[PLAYER]", ...args);
    fetch("/api/client_log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg: "[PLAYER] " + msg })
    }).catch(() => {});
}

window.onerror = function (msg, url, lineNo, columnNo, error) {
    logToServer("UNCAUGHT ERROR:", msg, "at", url, ":", lineNo, error ? error.stack : "");
};

// Ensure Host Player is always registered immediately upon connection/reconnection
function registerAsHostPlayer() {
    logToServer("Registering as Host Player on DuoJukebox server...");
    socket.emit("register_player");
}
registerAsHostPlayer();
socket.on("connect", registerAsHostPlayer);

// UI Elements
const elTitle = document.getElementById("song-title");
const elArtist = document.getElementById("song-artist");
const elAmbientBg = document.getElementById("ambient-bg");
const elProgressBar = document.getElementById("progress-bar");
const elProgressContainer = document.getElementById("progress-container");
const elTimeCurrent = document.getElementById("time-current");
const elTimeDuration = document.getElementById("time-duration");
const elIconPlay = document.getElementById("icon-host-play");
const elHostQueueList = document.getElementById("host-queue-list");
const elQueueCountBadge = document.getElementById("queue-count-badge");
const elFairPlayBadge = document.getElementById("fair-play-badge");
const elRequesterBadge = document.getElementById("current-requester-badge");
const elRequesterIcon = document.getElementById("requester-icon");
const elRequesterName = document.getElementById("requester-name");
const elHostVolume = document.getElementById("host-volume");
const elHostVolumeText = document.getElementById("host-volume-text");
const btnHostMute = document.getElementById("btn-host-mute");
const iconHostVolume = document.getElementById("icon-host-volume");

let currentVolume = parseInt(localStorage.getItem("duojukebox_volume") || "80", 10);
let previousVolume = parseInt(localStorage.getItem("duojukebox_prev_volume") || "80", 10);

function updateVolumeUI(vol, syncPlayer = true) {
    vol = parseInt(vol, 10);
    if (isNaN(vol)) vol = 80;
    vol = Math.max(0, Math.min(100, vol));

    currentVolume = vol;
    if (vol > 0) {
        previousVolume = vol;
        localStorage.setItem("duojukebox_prev_volume", vol);
    }
    localStorage.setItem("duojukebox_volume", vol);

    if (elHostVolume) elHostVolume.value = vol;
    if (elHostVolumeText) elHostVolumeText.textContent = `${vol}%`;

    if (btnHostMute) {
        let iconName = "volume-2";
        let colorClass = "text-pink-400";
        if (vol === 0) {
            iconName = "volume-x";
            colorClass = "text-red-400";
        } else if (vol < 50) {
            iconName = "volume-1";
            colorClass = "text-slate-200";
        }
        btnHostMute.innerHTML = `<i id="icon-host-volume" data-lucide="${iconName}" class="w-5 h-5 ${colorClass}"></i>`;
        lucide.createIcons();
    }

    if (syncPlayer && player && isPlayerReady) {
        try {
            if (vol === 0) {
                player.mute();
            } else {
                if (typeof player.isMuted === "function" && player.isMuted()) {
                    player.unMute();
                }
                player.setVolume(vol);
            }
        } catch (e) {
            console.warn("Error syncing volume with YouTube player:", e);
        }
    }
}
const elVinylOverlay = document.getElementById("vinyl-overlay");
const elOverlayArt = document.getElementById("overlay-art");
const elBtnToggleVideo = document.getElementById("btn-toggle-video");

// YouTube iFrame API Ready Callback & Dynamic Loader
function initYouTubePlayer() {
    if (player || !window.YT || !window.YT.Player) return;
    logToServer("initYouTubePlayer initializing...");
    player = new YT.Player("yt-player", {
        width: "100%",
        height: "100%",
        playerVars: {
            autoplay: 1,
            controls: 1, // Hiển thị controls để người dùng có thể thao tác trực tiếp nếu muốn
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
        }
    });
}

window.onYouTubeIframeAPIReady = function () {
    logToServer("window.onYouTubeIframeAPIReady fired");
    initYouTubePlayer();
};

// If YT already loaded before script executed
if (window.YT && window.YT.Player) {
    logToServer("window.YT.Player already exists at execution");
    initYouTubePlayer();
} else {
    // Dynamically inject YT script if not loaded
    if (!document.querySelector('script[src*="iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
    }
}

function onPlayerReady(event) {
    logToServer("onPlayerReady fired! Player is READY!");
    isPlayerReady = true;
    updateVolumeUI(currentVolume, true);
    showToast("Dàn loa đã sẵn sàng phát nhạc!", "info");
    
    // Nếu đã có bài hát được yêu cầu trước đó thì load ngay
    const songToPlay = pendingSongToPlay || currentSong;
    if (songToPlay && songToPlay.id) {
        logToServer("onPlayerReady auto-playing song:", songToPlay.title);
        playSong(songToPlay);
    } else {
        socket.emit("request_state");
    }
}

function onPlayerStateChange(event) {
    logToServer("onPlayerStateChange event.data:", event.data);
    const now = Date.now();
    if (event.data === YT.PlayerState.PLAYING) {
        updatePlayIcon(true);
        startProgressTracking();
        socket.emit("player_state_change", { state: "playing" });
    } else if (event.data === YT.PlayerState.PAUSED) {
        // Nếu vừa nạp bài mới (< 4s), YouTube thường tạm phát ra trạng thái PAUSED của bài cũ trong lúc dỡ bài hoặc đang nạp iframe.
        // Chỉ đơn thuần bỏ qua sự kiện PAUSED này, tuyệt đối không gọi playVideo() kẻo làm YouTube phát tiếp bài cũ!
        if (now - lastSongLoadTime < 4000) {
            logToServer("Bỏ qua PAUSED chuyển tiếp (< 4s) khi đang tải bài mới");
            return;
        }
        updatePlayIcon(false);
        stopProgressTracking();
        socket.emit("player_state_change", { state: "paused" });
    } else if (event.data === YT.PlayerState.CUED) {
        // Video ở trạng thái CUED: video đã sẵn sàng nhưng chưa tự chạy, kích hoạt playVideo()
        logToServer("Video CUED (đã sẵn sàng), gọi playVideo()");
        if (player && typeof player.playVideo === "function") {
            player.playVideo();
        }
    } else if (event.data === YT.PlayerState.ENDED) {
        // Guard 1: Ignore false ENDED event if the song was loaded less than 5 seconds ago (API transition artifact)
        if (now - lastSongLoadTime < 5000) {
            logToServer("Bỏ qua ENDED giả lúc chuyển bài (< 5s)");
            return;
        }
        // Guard 2: Ignore if an ENDED event was already emitted recently (< 3s)
        if (now - lastEndedEmitTime < 3000) {
            logToServer("Bỏ qua ENDED trùng lặp (< 3s)");
            return;
        }
        // Guard 3: If video has known duration (> 15s) and current time is far from the end, ignore
        try {
            if (player && player.getDuration && player.getCurrentTime) {
                const dur = player.getDuration() || 0;
                const cur = player.getCurrentTime() || 0;
                if (dur > 15 && cur < dur - 5) {
                    logToServer("Bỏ qua ENDED giả (chưa phát hết): cur=" + cur + " dur=" + dur);
                    return;
                }
            }
        } catch (e) {
            console.warn("Lỗi kiểm tra thời lượng:", e);
        }

        lastEndedEmitTime = now;
        updatePlayIcon(false);
        stopProgressTracking();
        logToServer("Bài hát đã kết thúc thật sự, socket.emit('player_song_ended')");
        socket.emit("player_song_ended");
    }
}

function onPlayerError(event) {
    logToServer("onPlayerError event.data:", event.data);
    showToast("Video này bị giới hạn bản quyền hoặc không cho nhúng (Mã lỗi: " + event.data + "). Bấm 'Next' để chuyển bài!", "warning");
}

function updatePlayIcon(isPlaying) {
    const btnPlay = document.getElementById("btn-host-play");
    if (btnPlay) {
        btnPlay.innerHTML = `<i data-lucide="${isPlaying ? 'pause' : 'play'}" class="w-8 h-8 fill-current"></i>`;
        lucide.createIcons();
    }
}

function startProgressTracking() {
    stopProgressTracking();
    progressInterval = setInterval(() => {
        if (player && player.getCurrentTime && player.getDuration) {
            const cur = player.getCurrentTime() || 0;
            const dur = player.getDuration() || 0;
            updateProgressUI(cur, dur);
            socket.emit("player_progress", { current_time: cur, duration: dur });
            
            // Broadcast tiến trình qua WebRTC cho các thành viên trong phòng online
            if (window.roomNet && roomNet.isHost) {
                const isPlaying = player.getPlayerState && player.getPlayerState() === YT.PlayerState.PLAYING;
                roomNet.broadcastProgress(cur, dur, isPlaying);
            }
        }
    }, 1000);
}

function stopProgressTracking() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

function updateProgressUI(current, duration) {
    elTimeCurrent.textContent = formatTime(current);
    elTimeDuration.textContent = formatTime(duration);
    if (duration > 0) {
        const pct = (current / duration) * 100;
        elProgressBar.style.width = `${pct}%`;
    }
}

function formatTime(secs) {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Play specific song
function playSong(song) {
    if (!song || !song.id) return;
    lastSongLoadTime = Date.now();
    currentSong = song;
    elTitle.textContent = song.title || "Không rõ tiêu đề";
    elArtist.textContent = song.artist || "YouTube";
    
    if (song.thumbnail) {
        elAmbientBg.style.backgroundImage = `url('${song.thumbnail}')`;
        elOverlayArt.src = song.thumbnail;
    }

    if (song.added_by_name) {
        elRequesterBadge.classList.remove("hidden");
        elRequesterBadge.classList.add("flex");
        elRequesterIcon.textContent = song.added_by_icon || "👤";
        elRequesterName.textContent = song.added_by_name;
        elRequesterBadge.style.backgroundColor = `${song.added_by_color || '#ec4899'}33`;
        elRequesterBadge.style.borderColor = song.added_by_color || '#ec4899';
    } else {
        elRequesterBadge.classList.add("hidden");
    }

    logToServer("▶️ playSong invoked for:", song.title, "ID:", song.id, "UID:", song.uid);
    if (isPlayerReady && player && typeof player.loadVideoById === "function") {
        logToServer("Đang gọi player.loadVideoById cho ID:", song.id);
        try {
            player.loadVideoById({
                videoId: song.id,
                startSeconds: 0
            });
            if (currentVolume > 0 && typeof player.unMute === "function") {
                player.unMute();
            }
            if (typeof player.setVolume === "function") {
                player.setVolume(currentVolume);
            }
        } catch (err) {
            logToServer("Lỗi khi load video bằng object, thử fallback:", err);
            try {
                player.loadVideoById(song.id, 0);
            } catch (e2) {
                logToServer("Lỗi fallback loadVideoById:", e2);
            }
        }
        updatePlayIcon(true);
        pendingSongToPlay = null;
    } else {
        logToServer("Dàn loa chưa sẵn sàng (isPlayerReady=" + isPlayerReady + "), lưu bài vào pendingSongToPlay:", song.title);
        pendingSongToPlay = song;
        if (window.YT && window.YT.Player && !player) {
            initYouTubePlayer();
        }
    }
}

// Audio Unlock Banner logic (Bypass Chrome Autoplay policy)
const audioUnlockBanner = document.getElementById("audio-unlock-banner");
let hasUserInteracted = false;

function unlockAudio() {
    hasUserInteracted = true;
    if (audioUnlockBanner) {
        audioUnlockBanner.classList.add("hidden");
    }
    if (player && isPlayerReady) {
        try {
            if (typeof player.unMute === "function") player.unMute();
            if (currentSong && currentSong.id) {
                player.playVideo();
            }
        } catch (e) {
            console.warn("Unlock audio error:", e);
        }
    }
}

if (audioUnlockBanner) {
    audioUnlockBanner.addEventListener("click", unlockAudio);
}
document.addEventListener("pointerdown", unlockAudio, { capture: true, once: true });
document.addEventListener("keydown", unlockAudio, { capture: true, once: true });

// Socket Listeners
socket.on("connect", () => {
    registerAsHostPlayer();
});

socket.on("player_play_song", (data) => {
    if (data && data.song) {
        playSong(data.song);
    }
});

socket.on("player_cmd", (data) => {
    if (!player || !isPlayerReady) return;
    const cmd = data.command;
    if (cmd === "play") {
        if (currentSong && currentSong.id) {
            try {
                if (player.getPlayerState && (player.getPlayerState() === -1 || player.getPlayerState() === 5)) {
                    player.loadVideoById(currentSong.id);
                }
            } catch (e) {}
        }
        player.unMute();
        player.playVideo();
    } else if (cmd === "pause") {
        player.pauseVideo();
    } else if (cmd === "stop") {
        player.stopVideo();
        elTitle.textContent = "Đã dừng phát";
        elArtist.textContent = "Hàng đợi đã hết bài";
        elRequesterBadge.classList.add("hidden");
        updatePlayIcon(false);
    } else if (cmd === "set_volume") {
        updateVolumeUI(data.volume, isPlayerReady);
    } else if (cmd === "seek") {
        player.seekTo(data.seconds, true);
    }
});

socket.on("state_update", (state) => {
    renderHostQueue(state.queue);

    if (state.volume !== undefined && state.volume !== null) {
        updateVolumeUI(state.volume, isPlayerReady);
    }
    
    if (state.fair_play_mode) {
        elFairPlayBadge.innerHTML = `<i data-lucide="scale" class="w-4 h-4"></i><span>Chế độ Xen kẽ (Fair-Play): BẬT</span>`;
        elFairPlayBadge.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
    } else {
        elFairPlayBadge.innerHTML = `<i data-lucide="list-ordered" class="w-4 h-4"></i><span>Chế độ Tự do (FIFO)</span>`;
        elFairPlayBadge.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700";
    }

    if (state.current_song) {
        if (!currentSong || currentSong.uid !== state.current_song.uid) {
            playSong(state.current_song);
        }
    }

    // Luôn đồng bộ nút Play/Pause theo đúng trạng thái đang phát
    const isPlaying = state.playback_state === "playing";
    updatePlayIcon(isPlaying);

    // Broadcast full state qua WebRTC nếu là Chủ phòng
    if (window.roomNet && roomNet.isHost) {
        roomNet.broadcastState(state);
    }

    lucide.createIcons();
});

// Render Queue on Host screen
function renderHostQueue(queue) {
    elQueueCountBadge.textContent = `${queue.length} bài`;
    if (!queue || queue.length === 0) {
        elHostQueueList.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full py-6 text-center space-y-2">
                <div class="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/30 shadow-md">
                    <i data-lucide="list-music" class="w-5 h-5"></i>
                </div>
                <p class="text-xs font-bold text-white">Hàng đợi đang trống</p>
                <p class="text-[11px] text-slate-300 max-w-[240px] leading-relaxed">
                    Tìm bài ở khung bên dưới để thêm bài cùng nghe nhé!
                </p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const totalItems = queue.length;
    elHostQueueList.innerHTML = queue.map((item, index) => {
        const canMoveUp = index > 0;
        const canMoveDown = index < totalItems - 1;
        return `
        <div class="queue-item flex items-center space-x-2 p-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-pink-500/50 transition group shadow-sm select-none"
             draggable="true"
             data-index="${index}"
             data-uid="${item.uid}">
            <div class="drag-handle touch-none p-1 text-slate-400 hover:text-pink-400 cursor-grab active:cursor-grabbing shrink-0 transition" title="Kéo lên/xuống để đổi thứ tự">
                <i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i>
            </div>
            <span class="text-[11px] font-mono font-bold text-pink-400 w-3.5 text-center shrink-0">${index + 1}</span>
            <img src="${item.thumbnail}" alt="" draggable="false" class="w-9 h-9 rounded-lg object-cover bg-slate-900 shrink-0 pointer-events-none border border-white/10">
            <div class="flex-1 min-w-0">
                <h4 class="text-xs font-bold text-white truncate">${item.title}</h4>
                <div class="flex items-center space-x-2 text-[10px] text-slate-300 mt-0.5">
                    <span class="truncate">${item.artist}</span>
                    <span>•</span>
                    <span class="font-mono text-slate-400">${item.duration}</span>
                </div>
            </div>
            <div class="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center space-x-1" 
                 style="background-color: ${item.added_by_color}25; color: ${item.added_by_color}; border: 1px solid ${item.added_by_color}50">
                <span>${item.added_by_icon}</span>
                <span>${item.added_by_name}</span>
            </div>
            <div class="flex items-center space-x-0.5 shrink-0">
                <button onclick="hostMoveStep(${index}, -1)" 
                        class="p-1 rounded transition ${canMoveUp ? 'text-slate-300 hover:text-pink-400 hover:bg-slate-800' : 'text-slate-600 opacity-40 cursor-not-allowed'}" 
                        ${canMoveUp ? '' : 'disabled'}
                        title="Đẩy lên 1 vị trí">
                    <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
                </button>
                <button onclick="hostMoveStep(${index}, 1)" 
                        class="p-1 rounded transition ${canMoveDown ? 'text-slate-300 hover:text-pink-400 hover:bg-slate-800' : 'text-slate-600 opacity-40 cursor-not-allowed'}" 
                        ${canMoveDown ? '' : 'disabled'}
                        title="Hạ xuống 1 vị trí">
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                </button>
                <button onclick="hostRemoveFromQueue('${item.uid}')" class="text-slate-400 hover:text-red-400 p-1 rounded transition" title="Xóa bài">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>
        `;
    }).join("");

    initQueueDragAndDrop(elHostQueueList, window.hostReorderQueue);
    lucide.createIcons();
}

function initQueueDragAndDrop(container, onReorder) {
    if (!container) return;
    let draggedItem = null;
    let draggedIndex = null;
    let currentOverItem = null;

    container.querySelectorAll(".queue-item").forEach((item) => {
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

window.hostMoveStep = function (fromIdx, direction) {
    const toIdx = fromIdx + direction;
    if (toIdx < 0) return;
    window.hostReorderQueue(fromIdx, toIdx);
};

window.hostReorderQueue = function (fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (window.roomNet && roomNet.peer && !roomNet.isHost) {
        roomNet.sendReorderQueue(fromIdx, toIdx);
        showToast("Đã gửi yêu cầu đổi thứ tự bài!");
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

// User Interaction Controls on Host
document.getElementById("btn-host-play").addEventListener("click", () => {
    if (!player || !isPlayerReady) return;
    try {
        const state = player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            player.pauseVideo();
            updatePlayIcon(false);
            fetch("/api/control/pause", { method: "POST" });
        } else {
            player.playVideo();
            updatePlayIcon(true);
            fetch("/api/control/play", { method: "POST" });
        }
    } catch (e) {
        fetch("/api/control/play", { method: "POST" });
    }
});

document.getElementById("btn-host-next").addEventListener("click", () => {
    if (isHostNextDebounced) return;
    isHostNextDebounced = true;
    setTimeout(() => { isHostNextDebounced = false; }, 400);
    logToServer("User clicked btn-host-next");
    fetch("/api/control/next", { method: "POST" })
        .then(res => res.json())
        .then(data => {
            logToServer("btn-host-next response:", data ? (data.current_song ? data.current_song.title : "queue empty") : "null");
            if (data && data.success) {
                if (data.current_song) {
                    playSong(data.current_song);
                } else {
                    if (player && typeof player.stopVideo === "function") player.stopVideo();
                    elTitle.textContent = "Đã dừng phát";
                    elArtist.textContent = "Hàng đợi đã hết bài";
                    updatePlayIcon(false);
                }
            }
        })
        .catch(err => logToServer("Error host next:", err));
});

document.getElementById("btn-host-prev").addEventListener("click", () => {
    logToServer("User clicked btn-host-prev");
    fetch("/api/control/prev", { method: "POST" })
        .then(res => res.json())
        .then(data => {
            logToServer("btn-host-prev response:", data ? (data.current_song ? data.current_song.title : "history empty") : "null");
            if (data && data.success && data.current_song) {
                playSong(data.current_song);
            }
        })
        .catch(err => logToServer("Error host prev:", err));
});

if (elHostVolume) {
    elHostVolume.addEventListener("input", (e) => {
        const vol = parseInt(e.target.value, 10);
        updateVolumeUI(vol, true);
        fetch("/api/control/volume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ volume: vol })
        });
    });
}

if (btnHostMute) {
    btnHostMute.addEventListener("click", () => {
        if (currentVolume > 0) {
            // Đang có tiếng -> Mute về 0
            previousVolume = currentVolume;
            localStorage.setItem("duojukebox_prev_volume", previousVolume);
            updateVolumeUI(0, true);
            fetch("/api/control/volume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ volume: 0 })
            });
            showToast("🔇 Đã tắt tiếng (Mute)");
        } else {
            // Đang tắt tiếng (0%) -> Khôi phục mức âm lượng trước đó
            const restoreVol = previousVolume > 0 ? previousVolume : 80;
            updateVolumeUI(restoreVol, true);
            fetch("/api/control/volume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ volume: restoreVol })
            });
            showToast(`🔊 Đã bật lại âm thanh (${restoreVol}%)`);
        }
    });
}

elProgressContainer.addEventListener("click", (e) => {
    if (!player || !isPlayerReady) return;
    const rect = elProgressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = clickX / rect.width;
    const dur = player.getDuration() || 0;
    if (dur > 0) {
        const targetSecs = pct * dur;
        player.seekTo(targetSecs, true);
    }
});

// Toggle Video vs Vinyl Overlay
elBtnToggleVideo.addEventListener("click", () => {
    isVideoMode = !isVideoMode;
    if (isVideoMode) {
        elVinylOverlay.classList.add("hidden");
    } else {
        elVinylOverlay.classList.remove("hidden");
    }
});

// Host Identity & Nickname Setup
let hostUser = (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function")
    ? window.DuoIdentity.getProfile()
    : { id: "user_host", name: "Anonymous - 0000", icon: "🎧", color: "#ec4899" };

function updateHostIdentityUI() {
    if (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function") {
        hostUser = window.DuoIdentity.getProfile();
    }
    const hostAvatarDisplay = document.getElementById("host-avatar-display");
    const hostNameDisplay = document.getElementById("host-name-display");
    const hostAddAvatar = document.getElementById("host-add-avatar");
    const hostAddName = document.getElementById("host-add-name");

    if (hostAvatarDisplay) hostAvatarDisplay.textContent = hostUser.icon;
    if (hostNameDisplay) hostNameDisplay.textContent = hostUser.name;
    if (hostAddAvatar) hostAddAvatar.textContent = hostUser.icon;
    if (hostAddName) hostAddName.textContent = hostUser.name;

    // Prefill Room Hub inputs
    const createRoomNameInput = document.getElementById("create-room-name");
    if (createRoomNameInput && (!createRoomNameInput.value || createRoomNameInput.value === "Chuẩn")) {
        createRoomNameInput.value = hostUser.name;
    }
    const joinRoomNameInput = document.getElementById("join-room-name");
    if (joinRoomNameInput && (!joinRoomNameInput.value || joinRoomNameInput.value === "Bạn bè")) {
        joinRoomNameInput.value = hostUser.name;
    }
}

let nicknameModalHandler = null;
if (window.DuoIdentity && typeof window.DuoIdentity.setupModal === "function") {
    nicknameModalHandler = window.DuoIdentity.setupModal({
        modalId: "nickname-modal",
        openBtnId: "btn-host-profile",
        closeBtnId: "btn-close-nickname-modal",
        nameInputId: "input-nickname-name",
        randomBtnId: "btn-random-nickname",
        avatarGridId: "nickname-avatar-grid",
        previewAvatarId: "nickname-preview-avatar",
        saveBtnId: "btn-save-nickname",
        onSaved: (updated) => {
            updateHostIdentityUI();
            showToast(`Đã đổi danh xưng: ${updated.icon} ${updated.name}`);
        }
    });

    const btnHostUserIdentity = document.getElementById("btn-host-user-identity");
    if (btnHostUserIdentity && nicknameModalHandler) {
        btnHostUserIdentity.addEventListener("click", () => {
            nicknameModalHandler.open();
        });
    }
}

updateHostIdentityUI();

// Fair-play toggle on Host
elFairPlayBadge.addEventListener("click", () => {
    fetch("/api/queue/toggle_fair_play", { method: "POST" })
        .then(res => res.json())
        .then(data => {
            showToast(data.fair_play_mode ? "⚖️ Đã BẬT chế độ Xen kẽ (Fair-Play)" : "📑 Đã chuyển về chế độ Tự do (FIFO)");
        });
});

// Clear queue on Host
const btnHostClearQueue = document.getElementById("btn-host-clear-queue");
if (btnHostClearQueue) {
    btnHostClearQueue.addEventListener("click", () => {
        if (confirm("Xóa toàn bộ bài hát trong hàng đợi?")) {
            fetch("/api/queue/clear", { method: "POST" });
        }
    });
}

// Remove single song from Host queue
window.hostRemoveFromQueue = function (uid) {
    fetch("/api/queue/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uid })
    });
};

// ================= HOST MANUAL SEARCH & ADD =================

const hostSearchForm = document.getElementById("host-search-form");
const hostSearchInput = document.getElementById("host-search-input");
const hostSearchResults = document.getElementById("host-search-results");
const hostSearchLoading = document.getElementById("host-search-loading");

if (hostSearchForm) {
    hostSearchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = hostSearchInput.value.trim();
        if (q) performHostSearch(q);
    });
}

document.querySelectorAll(".host-tag-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        hostSearchInput.value = btn.textContent;
        performHostSearch(btn.textContent);
    });
});

function performHostSearch(query) {
    if (hostSearchLoading) hostSearchLoading.classList.remove("hidden");
    if (hostSearchResults) hostSearchResults.innerHTML = "";

    fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(items => {
            if (hostSearchLoading) hostSearchLoading.classList.add("hidden");
            renderHostSearchResults(items);
        })
        .catch(err => {
            if (hostSearchLoading) hostSearchLoading.classList.add("hidden");
            if (hostSearchResults) hostSearchResults.innerHTML = `<div class="text-center text-red-400 py-4 text-xs">Lỗi kết nối: ${err.message}</div>`;
        });
}

function renderHostSearchResults(items) {
    if (!hostSearchResults) return;
    if (!items || items.length === 0) {
        hostSearchResults.innerHTML = `
            <div class="text-center py-6 text-xs text-slate-300 font-medium">
                Không tìm thấy bài hát phù hợp. Thử từ khóa khác nhé!
            </div>
        `;
        return;
    }

    hostSearchResults.innerHTML = items.map(song => {
        const songEscaped = encodeURIComponent(JSON.stringify(song));
        return `
            <div class="flex items-center space-x-2.5 p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-pink-500/60 transition shadow-sm">
                <img src="${song.thumbnail}" alt="" class="w-10 h-10 rounded-lg object-cover bg-slate-900 shrink-0">
                <div class="flex-1 min-w-0">
                    <h5 class="text-xs font-bold text-white truncate leading-tight">${song.title}</h5>
                    <div class="flex items-center space-x-1 text-[10px] text-slate-300 mt-0.5">
                        <span class="truncate">${song.artist}</span>
                        <span>•</span>
                        <span class="font-mono">${song.duration}</span>
                    </div>
                </div>
                <div class="flex items-center space-x-1 shrink-0">
                    <button onclick="hostAddToQueue('${songEscaped}', 'bottom')" class="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-semibold transition" title="Thêm vào hàng đợi">
                        + Queue
                    </button>
                    <button onclick="hostAddToQueue('${songEscaped}', 'now')" class="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-medium transition" title="Phát ngay lập tức">
                        Phát ngay
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

window.hostAddToQueue = function (escapedSong, mode) {
    const song = JSON.parse(decodeURIComponent(escapedSong));
    if (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function") {
        hostUser = window.DuoIdentity.getProfile();
    }
    
    // Nếu đang ở trong phòng Online với tư cách Khách: gửi qua WebRTC
    if (window.roomNet && roomNet.peer && !roomNet.isHost) {
        roomNet.sendAddToQueue(song, mode);
        showToast(`${roomNet.user.name} đã gửi bài: ${song.title}`);
        return;
    }

    // Nếu là Host hoặc chạy Local: gửi lên backend cục bộ
    const userInfo = (window.roomNet && roomNet.user) ? roomNet.user : hostUser;
    fetch("/api/queue/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            song: song,
            user_id: userInfo.id || hostUser.id,
            user_info: userInfo,
            mode: mode
        })
    })
    .then(res => res.json())
    .then(data => {
        const userName = `${userInfo.icon} ${userInfo.name}`;
        if (mode === "now") {
            showToast(`${userName} đang phát: ${song.title}`);
        } else {
            showToast(`${userName} đã thêm bài: ${song.title}`);
        }
    });
};

// ================= ONLINE ROOM HUB & CHAT CONTROLLER =================

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

// Chat elements
const btnToggleChat = document.getElementById("btn-toggle-chat");
const chatUnreadBadge = document.getElementById("chat-unread-badge");
const chatDrawer = document.getElementById("chat-drawer");
const btnCloseChat = document.getElementById("btn-close-chat");
const chatRoomTitle = document.getElementById("chat-room-title");
const chatMessagesContainer = document.getElementById("chat-messages-container");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

let selectedCreateAvatar = "👨";
let selectedJoinAvatar = "👩";
let isChatOpen = false;
let chatUnreadCount = 0;

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
        // Default to lobby tab if rooms available
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
    if (btnToggleChat) {
        btnToggleChat.classList.remove("hidden");
        btnToggleChat.classList.add("flex");
    }
    if (chatRoomTitle) chatRoomTitle.textContent = `#${roomCode}`;
    renderChatHistory(roomCode);
    lucide.createIcons();
}

function resetRoomUI() {
    activeRoomBadge.classList.add("hidden");
    activeRoomBadge.classList.remove("flex");
    btnViewMembers.classList.add("hidden");
    btnViewMembers.classList.remove("flex");
    btnOpenRoomHub.classList.remove("hidden");
    roomMembersModal.classList.add("hidden");

    // Hide chat button and close drawer
    if (btnToggleChat) {
        btnToggleChat.classList.add("hidden");
        btnToggleChat.classList.remove("flex");
    }
    closeChatDrawer();
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
    const profile = window.DuoIdentity.getProfile();
    const name = (joinRoomName && joinRoomName.value.trim()) ? joinRoomName.value.trim() : (profile.name || "Thành viên");
    
    if (!code || code.length < 5) {
        alert("Vui lòng nhập đúng mã phòng gồm 6 số!");
        return;
    }

    if (btnSubmitJoinRoom) {
        btnSubmitJoinRoom.disabled = true;
        btnSubmitJoinRoom.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang kết nối...</span>`;
        lucide.createIcons();
    }

    window.roomNet.joinRoom(code, {
        name: name,
        icon: selectedJoinAvatar || profile.icon,
        color: '#3b82f6'
    }, (connectedCode) => {
        if (btnSubmitJoinRoom) {
            btnSubmitJoinRoom.disabled = false;
            btnSubmitJoinRoom.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>Tham Gia Phòng Ngay</span>`;
        }
        roomHubModal.classList.add("hidden");

        updateRoomActiveUI(connectedCode);
        showToast(`🟢 Đã tham gia phòng #${connectedCode}! Đang đồng bộ...`);
        lucide.createIcons();
    }, (err) => {
        if (btnSubmitJoinRoom) {
            btnSubmitJoinRoom.disabled = false;
            btnSubmitJoinRoom.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>Tham Gia Phòng Ngay</span>`;
        }
        alert("Không thể kết nối đến phòng #" + code + ". Vui lòng kiểm tra lại mã phòng!");
        lucide.createIcons();
    });
}

if (btnSubmitJoinRoom) {
    btnSubmitJoinRoom.addEventListener("click", () => {
        const code = joinRoomCodeInput.value.trim();
        performJoinRoom(code);
    });
}

// Quick Join from Lobby
window.quickJoinRoom = function (code) {
    if (joinRoomCodeInput) joinRoomCodeInput.value = code;
    performJoinRoom(code);
};

// ================= LOBBY ACTIVE ROOMS RENDERING =================
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

// ================= KICK MEMBER (HOST ONLY) =================
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

// ================= CHAT ROOM CONTROLLER =================

function openChatDrawer() {
    if (!chatDrawer) return;
    isChatOpen = true;
    chatDrawer.classList.remove("opacity-0", "pointer-events-none", "scale-95");
    chatDrawer.classList.add("opacity-100", "scale-100");
    chatUnreadCount = 0;
    if (chatUnreadBadge) chatUnreadBadge.classList.add("hidden");
    scrollChatToBottom();
    if (chatInput) setTimeout(() => chatInput.focus(), 100);
}

function closeChatDrawer() {
    if (!chatDrawer) return;
    isChatOpen = false;
    chatDrawer.classList.add("opacity-0", "pointer-events-none", "scale-95");
    chatDrawer.classList.remove("opacity-100", "scale-100");
}

if (btnToggleChat) {
    btnToggleChat.addEventListener("click", () => {
        if (isChatOpen) closeChatDrawer(); else openChatDrawer();
    });
}
if (btnCloseChat) {
    btnCloseChat.addEventListener("click", closeChatDrawer);
}

function scrollChatToBottom() {
    if (chatMessagesContainer) {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
}

function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
}

function appendChatMessage(msg) {
    if (!chatMessagesContainer) return;
    if (chatMessagesContainer.querySelector(".italic")) {
        chatMessagesContainer.innerHTML = "";
    }

    const date = new Date(msg.timestamp || Date.now());
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (msg.isSystem) {
        const sysDiv = document.createElement("div");
        sysDiv.className = "text-center text-[10px] text-pink-300/80 bg-pink-500/10 py-1 px-2.5 rounded-full mx-auto w-fit max-w-[90%]";
        sysDiv.textContent = msg.text;
        chatMessagesContainer.appendChild(sysDiv);
    } else {
        const isMe = (msg.sender && msg.sender.id === window.roomNet.user.id);
        const msgDiv = document.createElement("div");
        msgDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-0.5`;
        msgDiv.innerHTML = `
            <div class="flex items-center space-x-1 text-[10px] text-slate-400 px-1">
                <span>${msg.sender?.icon || '👤'}</span>
                <span class="font-bold text-slate-300">${isMe ? 'Bạn' : (msg.sender?.name || 'Thành viên')}</span>
                <span>•</span>
                <span class="font-mono text-[9px]">${timeStr}</span>
            </div>
            <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words ${isMe ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'}">
                ${escapeHtml(msg.text)}
            </div>
        `;
        chatMessagesContainer.appendChild(msgDiv);
    }

    scrollChatToBottom();

    const countBadge = document.getElementById("chat-msg-count");
    if (countBadge && window.localStore && window.roomNet.roomCode) {
        window.localStore.getChatCount(window.roomNet.roomCode).then(cnt => {
            countBadge.textContent = `(${cnt})`;
        });
    }

    if (!isChatOpen) {
        chatUnreadCount++;
        if (chatUnreadBadge) {
            chatUnreadBadge.textContent = chatUnreadCount > 99 ? '99+' : chatUnreadCount;
            chatUnreadBadge.classList.remove("hidden");
        }
    }
}

async function renderChatHistory(roomCode) {
    if (!chatMessagesContainer) return;
    const history = await window.roomNet.getChatHistory(roomCode);
    chatMessagesContainer.innerHTML = "";

    const countBadge = document.getElementById("chat-msg-count");
    if (countBadge) countBadge.textContent = `(${history ? history.length : 0})`;

    if (!history || history.length === 0) {
        chatMessagesContainer.innerHTML = `
            <div class="text-center text-slate-500 py-10 text-[11px] italic">
                Chưa có tin nhắn nào.<br>Hãy gửi lời chào đến mọi người trong phòng!
            </div>
        `;
        return;
    }
    history.forEach(msg => appendChatMessage(msg));
}

const btnClearChat = document.getElementById("btn-clear-chat");
if (btnClearChat) {
    btnClearChat.addEventListener("click", async () => {
        if (confirm("Bạn có chắc muốn xoá toàn bộ lịch sử trò chuyện của phòng này trong NoSQL Local?")) {
            const currentRoom = window.roomNet.roomCode;
            if (currentRoom) {
                await window.roomNet.clearChatHistory(currentRoom);
                await renderChatHistory(currentRoom);
                showToast("Đã xoá sạch lịch sử chat phòng này");
            }
        }
    });
}

if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text) {
            window.roomNet.sendChatMessage(text);
            chatInput.value = "";
        }
    });
}

window.roomNet.onChatMessageCallback = function (msg) {
    appendChatMessage(msg);
};

// ================= WIRE WEBRTC ROOMNET CALLBACKS =================

// Khi danh sách thành viên thay đổi
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

// Host: Cung cấp full state hiện tại khi có client mới kết nối
window.roomNet.requestCurrentStateCallback = function () {
    return {
        current_song: currentSong,
        queue: Array.from(document.querySelectorAll("#host-queue-list [data-uid]")).length ? [] : [],
        current_time: (player && isPlayerReady && player.getCurrentTime) ? player.getCurrentTime() : 0,
        is_playing: (player && isPlayerReady && player.getPlayerState) ? (player.getPlayerState() === YT.PlayerState.PLAYING) : false
    };
};

// Host: Nhận yêu cầu thêm bài từ Client và đưa vào queue của Host
window.roomNet.onAddQueueCallback = function (song, user, mode) {
    fetch("/api/queue/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            song: song,
            user_id: user.id || 'guest',
            user_info: user,
            mode: mode || 'bottom'
        })
    })
    .then(res => res.json())
    .then(data => {
        showToast(`${user.name} đã thêm bài: ${song.title}`);
    });
};

// Client: Đồng bộ trạng thái từ Host
window.roomNet.onStateSyncCallback = function (state) {
    if (!state) return;
    if (state.queue) renderHostQueue(state.queue);
    if (state.current_song) {
        if (!currentSong || currentSong.uid !== state.current_song.uid) {
            playSong(state.current_song);
        }
    }
};

// Client: Đồng bộ tiến trình phát nhạc từ Host (Độ lệch chuẩn xác)
window.roomNet.onProgressSyncCallback = function (data) {
    if (!player || !isPlayerReady) return;
    
    // Đồng bộ thời gian nếu lệch > 1.5 giây
    if (player.getCurrentTime && player.getDuration) {
        const localTime = player.getCurrentTime() || 0;
        const hostTime = data.currentTime || 0;
        const dur = data.duration || 0;

        updateProgressUI(hostTime, dur);

        if (Math.abs(localTime - hostTime) > 1.5) {
            player.seekTo(hostTime, true);
        }

        // Đồng bộ Play/Pause
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

// Host & Client: Nhận lệnh điều khiển
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

// Fullscreen
document.getElementById("btn-fullscreen").addEventListener("click", () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
});

// Toast notification helper
function showToast(msg, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "px-4 py-2 rounded-xl text-xs font-medium shadow-xl backdrop-blur-md toast-animate border bg-slate-900/90 text-white border-white/10";
    if (type === "warning") toast.classList.add("border-amber-500/50", "text-amber-200");
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3500);
}

// ================= CYBERPUNK WALLPAPER THEME MANAGER =================

const WALLPAPERS = [
    { id: 'dj_girl', title: 'DJ Nữ Neon', file: '/static/images/bg/dj_neon_girl.jpg' },
    { id: 'dj_couple', title: 'Cặp Đôi DuoJukebox', file: '/static/images/bg/dj_neon_couple.jpg' },
    { id: 'dj_stage', title: 'DJ Sân Khấu Sôi Động', file: '/static/images/bg/dj_neon_stage.jpg' },
    { id: 'dj_club', title: 'Music Vibes Club', file: '/static/images/bg/dj_neon_club.jpg' },
    { id: 'dj_vinyl', title: 'Bàn Đĩa Than Cyberpunk', file: '/static/images/bg/dj_neon_vinyl.jpg' }
];

let currentBgIndex = 0;
let isAutoCycleBg = localStorage.getItem("duojukebox_bg_auto") !== "false";
let bgCycleInterval = null;

const customBgLayer = document.getElementById("custom-bg-layer");
const btnToggleBgModal = document.getElementById("btn-toggle-bg-modal");
const bgPaletteMenu = document.getElementById("bg-palette-menu");
const btnAutoCycleBg = document.getElementById("btn-auto-cycle-bg");
const bgThumbnailsGrid = document.getElementById("bg-thumbnails-grid");

function setWallpaper(index, save = true) {
    if (index < 0 || index >= WALLPAPERS.length) index = 0;
    currentBgIndex = index;
    const wp = WALLPAPERS[index];
    
    if (customBgLayer) {
        customBgLayer.style.backgroundImage = `url('${wp.file}')`;
    }
    if (save) {
        localStorage.setItem("duojukebox_bg_index", index);
    }
    renderBgThumbnails();
}

function nextWallpaper() {
    const nextIdx = (currentBgIndex + 1) % WALLPAPERS.length;
    setWallpaper(nextIdx, true);
}

function renderBgThumbnails() {
    if (!bgThumbnailsGrid) return;
    bgThumbnailsGrid.innerHTML = WALLPAPERS.map((wp, idx) => {
        const isSelected = (idx === currentBgIndex);
        return `
            <div onclick="window.selectWallpaper(${idx})" 
                 class="relative rounded-xl overflow-hidden cursor-pointer border-2 transition group aspect-video ${isSelected ? 'border-pink-500 shadow-lg shadow-pink-500/30 ring-2 ring-pink-500/50' : 'border-white/10 hover:border-slate-400'}">
                <img src="${wp.file}" alt="${wp.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-end p-1.5">
                    <span class="text-[10px] font-bold text-white truncate drop-shadow">${wp.title}</span>
                </div>
                ${isSelected ? '<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-pink-500 ring-2 ring-white"></span>' : ''}
            </div>
        `;
    }).join("");
}

window.selectWallpaper = function(idx) {
    setWallpaper(idx, true);
    showToast(`Đã đổi hình nền: ${WALLPAPERS[idx].title}`);
};

function updateAutoCycleUI() {
    if (!btnAutoCycleBg) return;
    if (isAutoCycleBg) {
        btnAutoCycleBg.textContent = "🔄 Tự đổi: BẬT";
        btnAutoCycleBg.className = "text-[10px] px-2 py-0.5 rounded-full bg-pink-600/30 text-pink-300 border border-pink-500/30 hover:bg-pink-600/50 transition font-bold";
        startBgCycle();
    } else {
        btnAutoCycleBg.textContent = "⏸️ Tự đổi: TẮT";
        btnAutoCycleBg.className = "text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700 transition font-medium";
        stopBgCycle();
    }
}

function startBgCycle() {
    stopBgCycle();
    bgCycleInterval = setInterval(() => {
        if (isAutoCycleBg) {
            nextWallpaper();
        }
    }, 35000);
}

function stopBgCycle() {
    if (bgCycleInterval) {
        clearInterval(bgCycleInterval);
        bgCycleInterval = null;
    }
}

if (btnToggleBgModal && bgPaletteMenu) {
    btnToggleBgModal.addEventListener("click", (e) => {
        e.stopPropagation();
        bgPaletteMenu.classList.toggle("hidden");
        lucide.createIcons();
    });

    document.addEventListener("click", (e) => {
        if (!bgPaletteMenu.contains(e.target) && e.target !== btnToggleBgModal) {
            bgPaletteMenu.classList.add("hidden");
        }
    });
}

if (btnAutoCycleBg) {
    btnAutoCycleBg.addEventListener("click", () => {
        isAutoCycleBg = !isAutoCycleBg;
        localStorage.setItem("duojukebox_bg_auto", isAutoCycleBg ? "true" : "false");
        updateAutoCycleUI();
        showToast(isAutoCycleBg ? "Đã bật tự động đổi hình nền (mỗi 35s)" : "Đã tắt tự động đổi hình nền");
    });
}

// Init Wallpaper
const savedBgIdx = parseInt(localStorage.getItem("duojukebox_bg_index") || "0", 10);
setWallpaper(savedBgIdx, false);
updateAutoCycleUI();
