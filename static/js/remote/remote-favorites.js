// DuoJukebox - Remote Favorites
// Favorites tab rendering, toggle favorites, and add all favorites to queue.

let userFavorites = [];

const favoritesList = document.getElementById("favorites-list");
const btnAddAllFavs = document.getElementById("btn-add-all-favs");

function loadFavorites() {
    const uid = (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function") 
        ? window.DuoIdentity.getProfile().id 
        : currentUserId;

    DuoAPI.getFavorites(uid)
        .then(items => {
            userFavorites = items || [];
            renderFavorites();
        });
}

function renderFavorites() {
    if (!favoritesList) return;
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

window.handleToggleFavorite = function (escapedSong) {
    const song = JSON.parse(decodeURIComponent(escapedSong));
    const uid = (window.DuoIdentity && typeof window.DuoIdentity.getProfile === "function") 
        ? window.DuoIdentity.getProfile().id 
        : currentUserId;

    DuoAPI.toggleFavorite(uid, song)
        .then(data => {
            userFavorites = data.favorites || [];
            showToast(data.is_favorite ? "❤️ Đã lưu vào bài tủ!" : "Đã xóa khỏi bài tủ!");
            renderFavorites();
            if (typeof lastSearchQuery !== "undefined" && lastSearchQuery) {
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

if (btnAddAllFavs) {
    btnAddAllFavs.addEventListener("click", () => {
        if (!userFavorites || userFavorites.length === 0) {
            showToast("Danh sách bài tủ đang trống!");
            return;
        }
        userFavorites.forEach(song => {
            addToQueue(song, "bottom", false);
        });
        showToast(`Đã thêm ${userFavorites.length} bài vào hàng đợi!`);
        if (typeof switchTab === "function") {
            switchTab("tab-queue");
        }
    });
}
