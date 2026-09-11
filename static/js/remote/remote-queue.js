// DuoJukebox - Remote Queue
// Queue rendering, drag-and-drop, step move, move to top, priority toggle, and clear queue.

const queueList = document.getElementById("queue-list");
const queueBadgeCount = document.getElementById("queue-badge-count");
const navQueueBadge = document.getElementById("nav-queue-badge");
const fairPlayToggle = document.getElementById("fair-play-toggle");
const radioModeToggle = document.getElementById("radio-mode-toggle");
const btnClearQueue = document.getElementById("btn-clear-queue");

function renderQueue(queue) {
    if (!queueList) return;
    if (queueBadgeCount) queueBadgeCount.textContent = queue.length;
    if (navQueueBadge) {
        if (queue.length > 0) {
            navQueueBadge.textContent = queue.length;
            navQueueBadge.classList.remove("hidden");
        } else {
            navQueueBadge.classList.add("hidden");
        }
    }

    if (!queue || queue.length === 0) {
        queueList.innerHTML = `
            <div class="text-center py-10 px-4 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-xl space-y-2.5">
                <div class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30 shadow">
                    <i data-lucide="music" class="w-5 h-5"></i>
                </div>
                <h4 class="text-xs font-bold text-white">Hàng đợi đang trống</h4>
                <p class="text-[11px] text-slate-300 max-w-xs mx-auto leading-relaxed">
                    Hãy chuyển sang tab <span class="text-pink-300 font-bold">Tìm bài</span> và bấm <span class="text-pink-400 font-bold">+ Thêm Queue</span> để cùng phát ra loa nhé!
                </p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const totalItems = queue.length;
    queueList.innerHTML = queue.map((item, idx) => {
        const canMoveUp = idx > 0;
        const canMoveDown = idx < totalItems - 1;
        const isPri = !!item.is_priority;
        return `
        <div class="queue-item flex items-center space-x-2.5 p-3 rounded-2xl transition select-none ${isPri ? 'bg-amber-950/30 border-2 border-amber-400/80 shadow-lg shadow-amber-500/10' : 'bg-slate-900 border border-slate-700/80 shadow-md'}"
             draggable="true"
             data-index="${idx}"
             data-uid="${item.uid}">
            <!-- Drag Handle -->
            <div class="drag-handle touch-none p-1.5 text-slate-400 hover:text-pink-400 cursor-grab active:cursor-grabbing shrink-0 transition" title="Kéo thả vị trí bài hát">
                <i data-lucide="grip-vertical" class="w-4 h-4"></i>
            </div>

            <!-- Position Index -->
            <span class="text-xs font-mono font-bold ${isPri ? 'text-amber-400' : 'text-pink-400'} w-4 text-center shrink-0">${idx + 1}</span>

            <!-- Thumbnail -->
            <div class="relative shrink-0">
                <img src="${item.thumbnail}" alt="" draggable="false" class="w-12 h-12 rounded-xl object-cover bg-slate-800 pointer-events-none border ${isPri ? 'border-amber-400/50' : 'border-white/10'}">
                ${isPri ? '<span class="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span></span>' : ''}
            </div>

            <!-- Title & Details -->
            <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-1.5">
                    <h4 class="text-xs font-bold ${isPri ? 'text-amber-200' : 'text-white'} truncate leading-tight">${item.title}</h4>
                    ${isPri ? '<span class="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-500/30 text-amber-300 border border-amber-400/60 animate-pulse">⚡ PHÁT TIẾP</span>' : ''}
                </div>
                <div class="flex items-center space-x-1.5 text-[10px] text-slate-300 mt-1">
                    <span class="truncate">${item.artist}</span>
                    <span>•</span>
                    <span class="font-mono text-slate-400">${item.duration}</span>
                </div>
                <div class="mt-1">
                    <span class="inline-flex items-center space-x-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style="background-color: ${item.added_by_color}25; color: ${item.added_by_color}; border: 1px solid ${item.added_by_color}50">
                        <span>${item.added_by_icon}</span>
                        <span>${item.added_by_name}</span>
                    </span>
                </div>
            </div>

            <!-- Action Controls -->
            <div class="flex items-center space-x-1 shrink-0">
                <button onclick="handleTogglePriority('${item.uid}')" 
                        class="p-1.5 rounded-lg transition ${isPri ? 'text-amber-300 bg-amber-500/30 border border-amber-400/50 shadow' : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'}" 
                        title="${isPri ? 'Hủy ưu tiên phát tiếp' : 'Ưu tiên phát ở bài kế tiếp'}">
                    <i data-lucide="zap" class="w-4 h-4 ${isPri ? 'fill-current' : ''}"></i>
                </button>

                <button onclick="handleMoveStep(${idx}, -1)" 
                        class="p-1.5 rounded-lg transition ${canMoveUp ? 'text-slate-300 hover:text-pink-400 hover:bg-slate-800' : 'text-slate-600 opacity-40 cursor-not-allowed'}" 
                        ${canMoveUp ? '' : 'disabled'}
                        title="Đẩy lên 1 vị trí">
                    <i data-lucide="chevron-up" class="w-4 h-4"></i>
                </button>

                <button onclick="handleMoveStep(${idx}, 1)" 
                        class="p-1.5 rounded-lg transition ${canMoveDown ? 'text-slate-300 hover:text-pink-400 hover:bg-slate-800' : 'text-slate-600 opacity-40 cursor-not-allowed'}" 
                        ${canMoveDown ? '' : 'disabled'}
                        title="Hạ xuống 1 vị trí">
                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                </button>

                <button onclick="handleMoveToTop('${item.uid}')" 
                        class="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition ${idx === 0 ? 'hidden' : ''}" 
                        title="Đẩy lên đầu hàng đợi">
                    <i data-lucide="arrow-up-to-line" class="w-4 h-4"></i>
                </button>

                <button onclick="handleRemoveFromQueue('${item.uid}')" 
                        class="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition" 
                        title="Xóa khỏi hàng đợi">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
        `;
    }).join("");

    initQueueDragAndDrop(queueList, window.handleReorderQueue);
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

        // Mobile Touch Support
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

window.handleMoveStep = function (fromIdx, direction) {
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || !lastState || !lastState.queue || toIdx >= lastState.queue.length) return;
    window.handleReorderQueue(fromIdx, toIdx);
};

window.handleReorderQueue = function (fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (window.roomNetwork && window.roomNetwork.currentRoom) {
        window.roomNetwork.sendReorderQueue(fromIdx, toIdx);
        showToast("Đã đổi thứ tự bài hát trong phòng!");
        return;
    }
    DuoAPI.reorderQueue(fromIdx, toIdx)
        .then(() => {
            showToast("Đã đổi thứ tự bài hát trong hàng đợi!");
        });
};

window.handleRemoveFromQueue = function (uid) {
    DuoAPI.removeFromQueue(uid);
};

window.handleMoveToTop = function (uid) {
    DuoAPI.moveToTop(uid);
};

window.handleTogglePriority = function (uid) {
    if (window.roomNet && roomNet.peer && !roomNet.isHost) {
        roomNet.sendTogglePriority(uid);
        return;
    }
    DuoAPI.togglePriority(uid)
        .then(data => {
            const target = (data.state && data.state.queue) ? data.state.queue.find(s => s.uid === uid) : null;
            if (target && target.is_priority) {
                showToast(`⚡ Đã ưu tiên phát tiếp: ${target.title}`);
            } else {
                showToast("Đã hủy ưu tiên phát tiếp");
            }
        })
        .catch(err => console.error("Error handleTogglePriority:", err));
};

// Queue toggles
if (fairPlayToggle) {
    fairPlayToggle.addEventListener("change", () => {
        DuoAPI.toggleFairPlay()
            .then(data => {
                showToast(data.fair_play_mode ? "⚖️ Đã BẬT chế độ Xen kẽ (Chồng - Vợ)" : "📑 Đã chuyển về chế độ Tự do (FIFO)");
            });
    });
}

if (radioModeToggle) {
    radioModeToggle.addEventListener("change", () => {
        DuoAPI.toggleRadio()
            .then(data => {
                showToast(data.radio_mode ? "📻 Đã BẬT Chế độ Radio tự động nối bài" : "📻 Đã TẮT Chế độ Radio");
            });
    });
}

if (btnClearQueue) {
    btnClearQueue.addEventListener("click", () => {
        if (confirm("Bạn có chắc muốn xóa hết danh sách bài trong hàng đợi?")) {
            DuoAPI.clearQueue();
        }
    });
}
