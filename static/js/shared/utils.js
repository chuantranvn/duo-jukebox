// DuoJukebox - Shared Utilities
// Common helper functions used by both Player and Remote.

/**
 * Format seconds into "m:ss" or "h:mm:ss" display string.
 */
function formatTime(secs) {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
}

/**
 * Show a toast notification at the bottom-right.
 * @param {string} msg - The message to display
 * @param {string} type - "info" (default) or "warning"
 */
function showToast(msg, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-2xl backdrop-blur-xl bg-slate-900/95 border border-pink-500/30 text-white toast-animate max-w-xs text-center";
    if (type === "warning") toast.classList.add("border-amber-500/50", "text-amber-200");
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3500);
}
