// DuoJukebox - Player Core
// YouTube iFrame API initialization, playSong, progress tracking, audio unlock.

let player = null;
let isPlayerReady = false;
let currentSong = null;
let pendingSongToPlay = null;
let lastSongLoadTime = 0;
let lastEndedEmitTime = 0;
let progressInterval = null;
let isVideoMode = true;
let isPlaybackStopped = false;

const socket = io();

function logToServer(...args) {
    const msg = args.map(a => {
        try {
            if (a instanceof Error) return a.stack || a.message || String(a);
            return typeof a === "object" ? JSON.stringify(a) : String(a);
        } catch (e) { return String(a); }
    }).join(" ");
    console.log("[PLAYER]", ...args);
    DuoAPI.clientLog("[PLAYER] " + msg);
}

window.onerror = function (msg, url, lineNo, columnNo, error) {
    logToServer("UNCAUGHT ERROR:", msg, "at", url, ":", lineNo, error ? error.stack : "");
};

// Register as Host Player
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
const elVinylOverlay = document.getElementById("vinyl-overlay");
const elOverlayArt = document.getElementById("overlay-art");
const elBtnToggleVideo = document.getElementById("btn-toggle-video");
const elRequesterBadge = document.getElementById("current-requester-badge");
const elRequesterIcon = document.getElementById("requester-icon");
const elRequesterName = document.getElementById("requester-name");

// Volume state
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

    const elHostVolume = document.getElementById("host-volume");
    const elHostVolumeText = document.getElementById("host-volume-text");
    const btnHostMute = document.getElementById("btn-host-mute");

    if (elHostVolume) elHostVolume.value = vol;
    if (elHostVolumeText) elHostVolumeText.textContent = `${vol}%`;

    if (btnHostMute) {
        let iconName = "volume-2";
        let colorClass = "text-pink-400";
        if (vol === 0) { iconName = "volume-x"; colorClass = "text-red-400"; }
        else if (vol < 50) { iconName = "volume-1"; colorClass = "text-slate-200"; }
        btnHostMute.innerHTML = `<i id="icon-host-volume" data-lucide="${iconName}" class="w-5 h-5 ${colorClass}"></i>`;
        lucide.createIcons();
    }

    if (syncPlayer && player && isPlayerReady) {
        try {
            if (vol === 0) { player.mute(); }
            else {
                if (typeof player.isMuted === "function" && player.isMuted()) player.unMute();
                player.setVolume(vol);
            }
        } catch (e) { console.warn("Error syncing volume with YouTube player:", e); }
    }
}

function updatePlayIcon(isPlaying) {
    const btnPlay = document.getElementById("btn-host-play");
    if (btnPlay) {
        btnPlay.innerHTML = `<i data-lucide="${isPlaying ? 'pause' : 'play'}" class="w-8 h-8 fill-current"></i>`;
        lucide.createIcons();
    }
}

// ================= YOUTUBE PLAYER =================

function initYouTubePlayer() {
    if (player || !window.YT || !window.YT.Player) return;
    logToServer("initYouTubePlayer initializing...");
    player = new YT.Player("yt-player", {
        width: "100%",
        height: "100%",
        playerVars: {
            autoplay: 1,
            controls: 1,
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

if (window.YT && window.YT.Player) {
    logToServer("window.YT.Player already exists at execution");
    initYouTubePlayer();
} else {
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
        if (now - lastSongLoadTime < 4000) {
            logToServer("Bỏ qua PAUSED chuyển tiếp (<4s) khi đang tải bài mới");
            return;
        }
        updatePlayIcon(false);
        stopProgressTracking();
        socket.emit("player_state_change", { state: "paused" });
    } else if (event.data === YT.PlayerState.CUED) {
        logToServer("Video CUED (event.data = 5), isPlaybackStopped:", isPlaybackStopped);
        if (!isPlaybackStopped && currentSong && currentSong.id) {
            logToServer("Đang có bài hát hợp lệ, tự động kích hoạt playVideo()");
            if (player && typeof player.playVideo === "function") player.playVideo();
        }
    } else if (event.data === YT.PlayerState.ENDED) {
        if (now - lastSongLoadTime < 5000) { logToServer("Bỏ qua ENDED giả lúc chuyển bài (<5s)"); return; }
        if (now - lastEndedEmitTime < 3000) { logToServer("Bỏ qua ENDED trùng lặp (<3s)"); return; }
        try {
            if (player && player.getDuration && player.getCurrentTime) {
                const dur = player.getDuration() || 0;
                const cur = player.getCurrentTime() || 0;
                if (dur > 15 && cur < dur - 5) {
                    logToServer("Bỏ qua ENDED giả (chưa phát hết): cur=" + cur + " dur=" + dur);
                    return;
                }
            }
        } catch (e) { console.warn("Lỗi kiểm tra thời lượng:", e); }

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

// ================= PROGRESS TRACKING =================

function startProgressTracking() {
    stopProgressTracking();
    progressInterval = setInterval(() => {
        if (player && player.getCurrentTime && player.getDuration) {
            const cur = player.getCurrentTime() || 0;
            const dur = player.getDuration() || 0;
            updateProgressUI(cur, dur);
            socket.emit("player_progress", { current_time: cur, duration: dur });

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
    if (elTimeCurrent) elTimeCurrent.textContent = formatTime(current);
    if (elTimeDuration) elTimeDuration.textContent = formatTime(duration);
    if (duration > 0 && elProgressBar) {
        elProgressBar.style.width = `${(current / duration) * 100}%`;
    }
}

// ================= PLAY / STOP =================

function stopPlayback() {
    isPlaybackStopped = true;
    currentSong = null;
    pendingSongToPlay = null;
    if (player && typeof player.pauseVideo === "function") {
        try {
            player.pauseVideo();
            if (typeof player.seekTo === "function") player.seekTo(0, true);
        } catch (e) {}
    }
    stopProgressTracking();
    updateProgressUI(0, 0);
    if (elTitle) elTitle.textContent = "Đã dừng phát";
    if (elArtist) elArtist.textContent = "Hàng đợi đã hết bài";
    if (elRequesterBadge) elRequesterBadge.classList.add("hidden");
    updatePlayIcon(false);
}

function playSong(song) {
    if (!song || !song.id) return;
    isPlaybackStopped = false;

    if (currentSong && song && (currentSong.uid === song.uid || (currentSong.id === song.id && !song.uid)) && (Date.now() - lastSongLoadTime < 1500)) {
        logToServer("Bỏ qua playSong trùng lặp trong 1.5s cho:", song.title);
        return;
    }

    lastSongLoadTime = Date.now();
    currentSong = song;
    if (elTitle) elTitle.textContent = song.title || "Không rõ tiêu đề";
    if (elArtist) elArtist.textContent = song.artist || "YouTube";

    if (song.thumbnail) {
        if (elAmbientBg) elAmbientBg.style.backgroundImage = `url('${song.thumbnail}')`;
        if (elOverlayArt) elOverlayArt.src = song.thumbnail;
    }

    if (song.added_by_name) {
        if (elRequesterBadge) {
            elRequesterBadge.classList.remove("hidden");
            elRequesterBadge.classList.add("flex");
            elRequesterBadge.style.backgroundColor = `${song.added_by_color || '#ec4899'}33`;
            elRequesterBadge.style.borderColor = song.added_by_color || '#ec4899';
        }
        if (elRequesterIcon) elRequesterIcon.textContent = song.added_by_icon || "👤";
        if (elRequesterName) elRequesterName.textContent = song.added_by_name;
    } else {
        if (elRequesterBadge) elRequesterBadge.classList.add("hidden");
    }

    logToServer("▶️ playSong invoked for:", song.title, "ID:", song.id, "UID:", song.uid);
    if (isPlayerReady && player && typeof player.loadVideoById === "function") {
        logToServer("Đang gọi player.loadVideoById cho ID:", song.id);
        try {
            player.loadVideoById({ videoId: song.id, startSeconds: 0 });
            if (currentVolume > 0 && typeof player.unMute === "function") player.unMute();
            if (typeof player.setVolume === "function") player.setVolume(currentVolume);
            if (typeof player.playVideo === "function") player.playVideo();
        } catch (err) {
            logToServer("Lỗi khi load video bằng object, thử fallback:", err);
            try {
                player.loadVideoById(song.id, 0);
                if (typeof player.playVideo === "function") player.playVideo();
            } catch (e2) { logToServer("Lỗi fallback loadVideoById:", e2); }
        }
        updatePlayIcon(true);
        pendingSongToPlay = null;

        setTimeout(() => {
            try {
                if (!isPlaybackStopped && currentSong && player && typeof player.getPlayerState === "function") {
                    const st = player.getPlayerState();
                    if (st !== YT.PlayerState.PLAYING && st !== YT.PlayerState.BUFFERING) {
                        logToServer("Tự động kích hoạt playVideo() dự phòng (state=" + st + ")");
                        if (typeof player.playVideo === "function") player.playVideo();
                    }
                }
            } catch (e) {}
        }, 1200);
    } else {
        logToServer("Dàn loa chưa sẵn sàng (isPlayerReady=" + isPlayerReady + "), lưu bài vào pendingSongToPlay:", song.title);
        pendingSongToPlay = song;
        if (window.YT && window.YT.Player && !player) initYouTubePlayer();
    }
}

// ================= AUDIO UNLOCK BANNER =================

const audioUnlockBanner = document.getElementById("audio-unlock-banner");
let hasUserInteracted = false;

function unlockAudio() {
    hasUserInteracted = true;
    if (audioUnlockBanner) audioUnlockBanner.classList.add("hidden");
    if (player && isPlayerReady) {
        try {
            if (typeof player.unMute === "function") player.unMute();
            if (currentSong && currentSong.id) player.playVideo();
        } catch (e) { console.warn("Unlock audio error:", e); }
    }
}

if (audioUnlockBanner) audioUnlockBanner.addEventListener("click", unlockAudio);
document.addEventListener("pointerdown", unlockAudio, { capture: true, once: true });
document.addEventListener("keydown", unlockAudio, { capture: true, once: true });
