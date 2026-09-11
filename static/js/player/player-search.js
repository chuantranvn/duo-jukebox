// DuoJukebox - Player Search
// Host manual search form and result rendering for the Player page.

const hostSearchForm = document.getElementById("host-search-form");
const hostSearchInput = document.getElementById("host-search-input");
const hostSearchResults = document.getElementById("host-search-results");
const hostSearchLoading = document.getElementById("host-search-loading");

// Host Identity
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

    const createRoomNameInput = document.getElementById("create-room-name");
    if (createRoomNameInput && (!createRoomNameInput.value || createRoomNameInput.value === "Chuẩn")) {
        createRoomNameInput.value = hostUser.name;
    }
    const joinRoomNameInput = document.getElementById("join-room-name");
    if (joinRoomNameInput && (!joinRoomNameInput.value || joinRoomNameInput.value === "Bạn bè")) {
        joinRoomNameInput.value = hostUser.name;
    }
}

// Nickname Modal
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
        btnHostUserIdentity.addEventListener("click", () => nicknameModalHandler.open());
    }
}

updateHostIdentityUI();

// Search form
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

    DuoAPI.search(query)
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

    if (window.roomNet && (roomNet.peer || roomNet.isConnected) && !roomNet.isHost && roomNet.roomCode) {
        roomNet.sendAddToQueue(song, mode);
        showToast(`${roomNet.user.name} đã gửi bài: ${song.title}`);
        return;
    }

    const userInfo = (window.roomNet && roomNet.user) ? roomNet.user : hostUser;
    DuoAPI.addToQueue(song, userInfo.id || hostUser.id, mode, userInfo)
        .then(() => {
            const userName = `${userInfo.icon} ${userInfo.name}`;
            showToast(mode === "now" ? `${userName} đang phát: ${song.title}` : `${userName} đã thêm bài: ${song.title}`);
        });
};
