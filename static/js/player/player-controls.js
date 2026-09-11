// DuoJukebox - Player Controls
// Play/Pause/Next/Prev/Volume/Seek/Mute/Fullscreen button handlers.

let isHostNextDebounced = false;

// Play / Pause toggle
document.getElementById("btn-host-play").addEventListener("click", () => {
    if (!player || !isPlayerReady) return;
    try {
        const state = player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            player.pauseVideo();
            updatePlayIcon(false);
            DuoAPI.pause();
        } else {
            player.playVideo();
            updatePlayIcon(true);
            DuoAPI.play();
        }
    } catch (e) {
        DuoAPI.play();
    }
});

// Next
document.getElementById("btn-host-next").addEventListener("click", () => {
    if (isHostNextDebounced) return;
    isHostNextDebounced = true;
    setTimeout(() => { isHostNextDebounced = false; }, 400);
    logToServer("User clicked btn-host-next");
    DuoAPI.next()
        .then(data => {
            logToServer("btn-host-next response:", data ? (data.current_song ? data.current_song.title : "queue empty") : "null");
            if (data && data.success) {
                if (data.current_song) playSong(data.current_song);
                else stopPlayback();
            }
        })
        .catch(err => logToServer("Error host next:", err));
});

// Previous
document.getElementById("btn-host-prev").addEventListener("click", () => {
    logToServer("User clicked btn-host-prev");
    DuoAPI.prev()
        .then(data => {
            logToServer("btn-host-prev response:", data ? (data.current_song ? data.current_song.title : "history empty") : "null");
            if (data && data.success && data.current_song) playSong(data.current_song);
        })
        .catch(err => logToServer("Error host prev:", err));
});

// Volume slider
const elHostVolume = document.getElementById("host-volume");
if (elHostVolume) {
    elHostVolume.addEventListener("input", (e) => {
        const vol = parseInt(e.target.value, 10);
        updateVolumeUI(vol, true);
        DuoAPI.setVolume(vol);
    });
}

// Mute toggle
const btnHostMute = document.getElementById("btn-host-mute");
if (btnHostMute) {
    btnHostMute.addEventListener("click", () => {
        if (currentVolume > 0) {
            previousVolume = currentVolume;
            localStorage.setItem("duojukebox_prev_volume", previousVolume);
            updateVolumeUI(0, true);
            DuoAPI.setVolume(0);
            showToast("🔇 Đã tắt tiếng (Mute)");
        } else {
            const restoreVol = previousVolume > 0 ? previousVolume : 80;
            updateVolumeUI(restoreVol, true);
            DuoAPI.setVolume(restoreVol);
            showToast(`🔊 Đã bật lại âm thanh (${restoreVol}%)`);
        }
    });
}

// Seek (click on progress bar)
if (elProgressContainer) {
    elProgressContainer.addEventListener("click", (e) => {
        if (!player || !isPlayerReady) return;
        const rect = elProgressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = clickX / rect.width;
        const dur = player.getDuration() || 0;
        if (dur > 0) player.seekTo(pct * dur, true);
    });
}

// Video / Vinyl toggle
if (elBtnToggleVideo) {
    elBtnToggleVideo.addEventListener("click", () => {
        isVideoMode = !isVideoMode;
        if (isVideoMode) elVinylOverlay.classList.add("hidden");
        else elVinylOverlay.classList.remove("hidden");
    });
}

// Fullscreen
document.getElementById("btn-fullscreen").addEventListener("click", () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
});
