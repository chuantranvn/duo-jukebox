// DuoJukebox - Remote Init
// Tab navigation, event listeners initialization, and page startup.

let currentTab = "tab-search";

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

function initEventListeners() {
    // Tab navigation buttons
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            switchTab(btn.getAttribute("data-tab"));
        });
    });

    // Suggestion tags
    document.querySelectorAll(".tag-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const searchInput = document.getElementById("search-input");
            if (searchInput) searchInput.value = btn.textContent;
            if (typeof performSearch === "function") performSearch(btn.textContent);
        });
    });

    // Search form submit
    const searchForm = document.getElementById("search-form");
    if (searchForm) {
        searchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const searchInput = document.getElementById("search-input");
            const q = searchInput ? searchInput.value.trim() : "";
            if (q && typeof performSearch === "function") performSearch(q);
        });
    }

    // Mini player bar click -> open modal
    const miniPlayerBar = document.getElementById("mini-player-bar");
    if (miniPlayerBar) {
        miniPlayerBar.addEventListener("click", openModal);
    }

    // Close modal
    const btnCloseModal = document.getElementById("btn-close-modal");
    if (btnCloseModal) {
        btnCloseModal.addEventListener("click", closeModal);
    }

    // Playback control buttons
    const btnMiniPlay = document.getElementById("btn-mini-play");
    const btnModalPlay = document.getElementById("btn-modal-play");
    const btnMiniNext = document.getElementById("btn-mini-next");
    const btnModalNext = document.getElementById("btn-modal-next");
    const btnModalPrev = document.getElementById("btn-modal-prev");

    if (btnMiniPlay) btnMiniPlay.addEventListener("click", togglePlay);
    if (btnModalPlay) btnModalPlay.addEventListener("click", togglePlay);
    if (btnMiniNext) btnMiniNext.addEventListener("click", skipNext);
    if (btnModalNext) btnModalNext.addEventListener("click", skipNext);
    if (btnModalPrev) btnModalPrev.addEventListener("click", skipPrev);

    // Volume
    const modalVolume = document.getElementById("modal-volume");
    if (modalVolume) {
        modalVolume.addEventListener("input", (e) => {
            const v = parseInt(e.target.value, 10);
            updateRemoteVolumeUI(v);
            DuoAPI.setVolume(v);
        });
    }

    // Mute button
    const btnRemoteMute = document.getElementById("btn-remote-mute");
    if (btnRemoteMute) {
        btnRemoteMute.addEventListener("click", () => {
            if (remoteVolume > 0) {
                remotePrevVolume = remoteVolume;
                localStorage.setItem("duojukebox_prev_volume", remotePrevVolume);
                updateRemoteVolumeUI(0);
                DuoAPI.setVolume(0);
                showToast("🔇 Đã tắt tiếng (Mute)");
            } else {
                const targetVol = remotePrevVolume > 0 ? remotePrevVolume : 80;
                updateRemoteVolumeUI(targetVol);
                DuoAPI.setVolume(targetVol);
                showToast(`🔊 Đã bật lại âm thanh (${targetVol}%)`);
            }
        });
    }

    // Seek bar
    const modalSeekBar = document.getElementById("modal-seek-bar");
    if (modalSeekBar) {
        modalSeekBar.addEventListener("change", (e) => {
            const dur = lastState?.duration || 0;
            if (dur > 0) {
                const targetSecs = (e.target.value / 100) * dur;
                DuoAPI.seek(targetSecs);
            }
        });
    }
}

// Startup
document.addEventListener("DOMContentLoaded", () => {
    if (typeof updateProfileDisplay === "function") updateProfileDisplay();
    if (typeof updateRemoteVolumeUI === "function") updateRemoteVolumeUI(remoteVolume);

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
                if (typeof updateProfileDisplay === "function") updateProfileDisplay();
                if (typeof loadFavorites === "function") loadFavorites();
                showToast(`Đã lưu danh xưng: ${updated.icon} ${updated.name}`);
            }
        });
    }

    if (typeof loadFavorites === "function") loadFavorites();
    initEventListeners();
});
