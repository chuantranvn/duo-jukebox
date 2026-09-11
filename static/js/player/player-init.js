// DuoJukebox - Player Init
// Main entry point for the Player screen: wires Socket.IO listeners, fullscreen, and UI updates.

// Fullscreen toggle
const btnFullscreen = document.getElementById("btn-fullscreen");
if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen();
        }
    });
}

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
        stopPlayback();
    } else if (cmd === "set_volume") {
        updateVolumeUI(data.volume, isPlayerReady);
    } else if (cmd === "seek") {
        player.seekTo(data.seconds, true);
    }
});

socket.on("state_update", (state) => {
    if (typeof renderHostQueue === "function") {
        renderHostQueue(state.queue);
    }

    if (state.volume !== undefined && state.volume !== null) {
        updateVolumeUI(state.volume, isPlayerReady);
    }

    const elFairPlayBadge = document.getElementById("fair-play-badge");
    if (elFairPlayBadge) {
        if (state.fair_play_mode) {
            elFairPlayBadge.innerHTML = `<i data-lucide="scale" class="w-4 h-4"></i><span>Chế độ Xen kẽ (Fair-Play): BẬT</span>`;
            elFairPlayBadge.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-pointer";
        } else {
            elFairPlayBadge.innerHTML = `<i data-lucide="list-ordered" class="w-4 h-4"></i><span>Chế độ Tự do (FIFO)</span>`;
            elFairPlayBadge.className = "flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer";
        }
    }

    const btnToggleRadio = document.getElementById("btn-toggle-radio");
    if (btnToggleRadio) {
        if (state.radio_mode) {
            btnToggleRadio.className = "flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 cursor-pointer transition hover:scale-105 shadow-md shadow-purple-500/10";
            btnToggleRadio.innerHTML = `<i data-lucide="radio" class="w-3.5 h-3.5 text-purple-400 animate-pulse"></i><span id="radio-mode-text">Radio: BẬT</span>`;
        } else {
            btnToggleRadio.className = "flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 cursor-pointer transition hover:scale-105";
            btnToggleRadio.innerHTML = `<i data-lucide="radio" class="w-3.5 h-3.5 text-slate-400"></i><span id="radio-mode-text">Radio: TẮT</span>`;
        }
    }

    if (!state.current_song || state.playback_state === "stopped") {
        if (!isPlaybackStopped) {
            stopPlayback();
        }
    } else if (state.current_song) {
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

    if (window.lucide) {
        lucide.createIcons();
    }
});

// Initial icon rendering
if (window.lucide) {
    lucide.createIcons();
}
