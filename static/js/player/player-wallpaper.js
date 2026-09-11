// DuoJukebox - Player Wallpaper
// Cyberpunk Wallpaper Theme Manager, auto-cycle background, thumbnails grid, and modal palette.

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
