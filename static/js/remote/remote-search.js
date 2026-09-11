// DuoJukebox - Remote Search
// Search form, tag suggestions, result rendering, and add-to-queue actions.

let lastSearchQuery = "";

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const searchLoading = document.getElementById("search-loading");

function performSearch(query) {
    lastSearchQuery = query;
    if (searchLoading) searchLoading.classList.remove("hidden");
    if (searchResults) searchResults.innerHTML = "";

    DuoAPI.search(query)
        .then(items => {
            if (searchLoading) searchLoading.classList.add("hidden");
            renderSearchResults(items);
        })
        .catch(err => {
            if (searchLoading) searchLoading.classList.add("hidden");
            if (searchResults) searchResults.innerHTML = `<div class="text-center text-red-400 py-10 text-xs">Lỗi kết nối khi tìm kiếm: ${err.message}</div>`;
        });
}

function renderSearchResults(items) {
    if (!searchResults) return;
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
        const isFav = (typeof userFavorites !== "undefined") && userFavorites.some(f => f.id === song.id);
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
    DuoAPI.addToQueue(song, currentUser.id, mode, currentUser)
        .then(() => {
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
