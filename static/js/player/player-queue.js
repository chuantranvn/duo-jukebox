// DuoJukebox - Player Queue
// Queue rendering, drag-and-drop, reorder, remove, priority for the Host Player screen.

const elHostQueueList = document.getElementById("host-queue-list");
const elQueueCountBadge = document.getElementById("queue-count-badge");

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
        const isPri = !!item.is_priority;
        return `
        <div class="queue-item flex items-center space-x-2 p-2 rounded-xl transition group select-none ${isPri ? 'bg-amber-950/30 border-2 border-amber-400/80 shadow-lg shadow-amber-500/10' : 'bg-slate-900 border border-slate-700/80 hover:border-pink-500/50 shadow-sm'}"
             draggable="true"
             data-index="${index}"
             data-uid="${item.uid}">
            <div class="drag-handle touch-none p-1 text-slate-400 hover:text-pink-400 cursor-grab active:cursor-grabbing shrink-0 transition" title="Kéo lên/xuống để đổi thứ tự">
                <i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i>
            </div>
            <span class="text-[11px] font-mono font-bold ${isPri ? 'text-amber-400' : 'text-pink-400'} w-3.5 text-center shrink-0">${index + 1}</span>
            <div class="relative shrink-0">
                <img src="${item.thumbnail}" alt="" draggable="false" class="w-9 h-9 rounded-lg object-cover bg-slate-900 pointer-events-none border ${isPri ? 'border-amber-400/50' : 'border-white/10'}">
                ${isPri ? '<span class="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span></span>' : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-1.5">
                    <h4 class="text-xs font-bold ${isPri ? 'text-amber-200' : 'text-white'} truncate">${item.title}</h4>
                    ${isPri ? '<span class="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-500/30 text-amber-300 border border-amber-400/60 animate-pulse">⚡ PHÁT TIẾP</span>' : ''}
                </div>
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
                <button onclick="hostTogglePriority('${item.uid}')"
                        class="p-1 rounded transition ${isPri ? 'text-amber-300 bg-amber-500/30 border border-amber-400/50 shadow' : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'}"
                        title="${isPri ? 'Hủy ưu tiên phát tiếp' : 'Ưu tiên phát ở bài kế tiếp'}">
                    <i data-lucide="zap" class="w-3.5 h-3.5 ${isPri ? 'fill-current' : ''}"></i>
                </button>
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

// Drag and Drop for queue items (Desktop + Mobile Touch)
function initQueueDragAndDrop(container, onReorder) {
    if (!container) return;
    let draggedItem = null;
    let draggedIndex = null;
    let currentOverItem = null;

    container.querySelectorAll(".queue-item").forEach((item) => {
        item.querySelectorAll("img, button").forEach(el => el.setAttribute("draggable", "false"));

        item.addEventListener("dragstart", (e) => {
            if (e.target.closest("button")) { e.preventDefault(); return; }
            draggedItem = item;
            draggedIndex = parseInt(item.getAttribute("data-index"), 10);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", draggedIndex);
            setTimeout(() => item.classList.add("dragging"), 0);
        });
        item.addEventListener("dragend", () => {
            item.classList.remove("dragging");
            container.querySelectorAll(".queue-item").forEach(el => el.classList.remove("drag-over"));
            draggedItem = null; draggedIndex = null; currentOverItem = null;
        });
        item.addEventListener("dragover", (e) => {
            e.preventDefault(); e.dataTransfer.dropEffect = "move";
            if (draggedItem && draggedItem !== item) {
                container.querySelectorAll(".queue-item").forEach(el => { if (el !== item) el.classList.remove("drag-over"); });
                item.classList.add("drag-over");
            }
        });
        item.addEventListener("dragleave", (e) => { if (!item.contains(e.relatedTarget)) item.classList.remove("drag-over"); });
        item.addEventListener("drop", (e) => {
            e.preventDefault(); item.classList.remove("drag-over");
            if (draggedIndex !== null) {
                const targetIndex = parseInt(item.getAttribute("data-index"), 10);
                if (draggedIndex !== targetIndex) onReorder(draggedIndex, targetIndex);
            }
        });

        // Mobile Touch
        const handle = item.querySelector(".drag-handle");
        if (handle) {
            handle.addEventListener("touchstart", () => {
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
                    if (currentOverItem !== draggedItem) currentOverItem.classList.add("drag-over");
                }
            }, { passive: false });
            const handleTouchEnd = () => {
                if (!draggedItem) return;
                draggedItem.classList.remove("dragging");
                if (currentOverItem && currentOverItem !== draggedItem) {
                    currentOverItem.classList.remove("drag-over");
                    const targetIndex = parseInt(currentOverItem.getAttribute("data-index"), 10);
                    if (draggedIndex !== targetIndex) onReorder(draggedIndex, targetIndex);
                }
                draggedItem = null; draggedIndex = null; currentOverItem = null;
            };
            handle.addEventListener("touchend", handleTouchEnd);
            handle.addEventListener("touchcancel", handleTouchEnd);
        }
    });
}

// Queue action handlers (global)
window.hostMoveStep = function (fromIdx, direction) {
    const toIdx = fromIdx + direction;
    if (toIdx < 0) return;
    window.hostReorderQueue(fromIdx, toIdx);
};

window.hostReorderQueue = function (fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (window.roomNet && (roomNet.peer || roomNet.isConnected) && !roomNet.isHost && roomNet.roomCode) {
        roomNet.sendReorderQueue(fromIdx, toIdx);
        showToast("Đã gửi yêu cầu đổi thứ tự bài!");
        return;
    }
    DuoAPI.reorderQueue(fromIdx, toIdx).then(() => showToast("Đã đổi thứ tự bài hát trong hàng đợi!"));
};

window.hostRemoveFromQueue = function (uid) {
    DuoAPI.removeFromQueue(uid);
};

window.hostTogglePriority = function (uid) {
    if (window.roomNet && (roomNet.peer || roomNet.isConnected) && !roomNet.isHost && roomNet.roomCode) {
        roomNet.sendTogglePriority(uid);
        return;
    }
    DuoAPI.togglePriority(uid).then(data => {
        const target = (data.state && data.state.queue) ? data.state.queue.find(s => s.uid === uid) : null;
        if (target && target.is_priority) showToast(`⚡ Đã ưu tiên phát tiếp: ${target.title}`);
        else showToast("Đã hủy ưu tiên phát tiếp");
    }).catch(err => logToServer("Error hostTogglePriority:", err));
};

// Fair-play toggle
const elFairPlayBadge = document.getElementById("fair-play-badge");
elFairPlayBadge.addEventListener("click", () => {
    DuoAPI.toggleFairPlay().then(data => {
        showToast(data.fair_play_mode ? "⚖️ Đã BẬT chế độ Xen kẽ (Fair-Play)" : "📑 Đã chuyển về chế độ Tự do (FIFO)");
    });
});

// Radio Mode toggle
const btnToggleRadio = document.getElementById("btn-toggle-radio");
if (btnToggleRadio) {
    btnToggleRadio.addEventListener("click", () => {
        DuoAPI.toggleRadio().then(data => {
            if (data && data.success) {
                showToast(data.radio_mode ? "📻 Đã BẬT Chế độ Radio (Tự động nối bài khi hết queue)!" : "📻 Đã TẮT Chế độ Radio!");
            }
        });
    });
}

// Clear queue
const btnHostClearQueue = document.getElementById("btn-host-clear-queue");
if (btnHostClearQueue) {
    btnHostClearQueue.addEventListener("click", () => {
        if (confirm("Xóa toàn bộ bài hát trong hàng đợi?")) DuoAPI.clearQueue();
    });
}
