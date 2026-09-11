// DuoJukebox - Shared API Client
// Centralized fetch wrapper for all backend API calls.

const DuoAPI = {

    /**
     * Search for songs on YouTube.
     * @param {string} query
     * @returns {Promise<Array>}
     */
    search(query) {
        return fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(res => res.json());
    },

    /**
     * Add a song to the queue.
     * @param {Object} song - Song data object
     * @param {string} userId - User ID
     * @param {string} mode - "bottom", "next", or "now"
     * @param {Object} [userInfo] - Optional user info override
     * @returns {Promise<Object>}
     */
    addToQueue(song, userId, mode = "bottom", userInfo = null) {
        const body = { song, user_id: userId, mode };
        if (userInfo) body.user_info = userInfo;
        return fetch("/api/queue/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }).then(res => res.json());
    },

    /**
     * Remove a song from the queue by UID.
     */
    removeFromQueue(uid) {
        return fetch("/api/queue/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid })
        }).then(res => res.json());
    },

    /**
     * Move a song to top of queue.
     */
    moveToTop(uid) {
        return fetch("/api/queue/move_top", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid })
        }).then(res => res.json());
    },

    /**
     * Reorder queue items.
     */
    reorderQueue(fromIndex, toIndex) {
        return fetch("/api/queue/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from_index: fromIndex, to_index: toIndex })
        }).then(res => res.json());
    },

    /**
     * Clear the entire queue.
     */
    clearQueue() {
        return fetch("/api/queue/clear", { method: "POST" }).then(res => res.json());
    },

    /**
     * Toggle fair play mode.
     */
    toggleFairPlay() {
        return fetch("/api/queue/toggle_fair_play", { method: "POST" }).then(res => res.json());
    },

    /**
     * Toggle priority for a song.
     */
    togglePriority(uid) {
        return fetch("/api/queue/toggle_priority", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid })
        }).then(res => res.json());
    },

    /**
     * Toggle radio mode.
     */
    toggleRadio() {
        return fetch("/api/queue/toggle_radio", { method: "POST" }).then(res => res.json());
    },

    // Playback controls
    play()  { return fetch("/api/control/play",  { method: "POST" }).then(r => r.json()); },
    pause() { return fetch("/api/control/pause", { method: "POST" }).then(r => r.json()); },
    next()  { return fetch("/api/control/next",  { method: "POST" }).then(r => r.json()); },
    prev()  { return fetch("/api/control/prev",  { method: "POST" }).then(r => r.json()); },

    setVolume(volume) {
        return fetch("/api/control/volume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ volume })
        }).then(res => res.json());
    },

    seek(seconds) {
        return fetch("/api/control/seek", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seconds })
        }).then(res => res.json());
    },

    /**
     * Get favorites for a user.
     */
    getFavorites(userId) {
        return fetch(`/api/favorites?user_id=${userId}`).then(res => res.json());
    },

    /**
     * Toggle favorite status.
     */
    toggleFavorite(userId, song) {
        return fetch("/api/favorites/toggle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, song })
        }).then(res => res.json());
    },

    /**
     * Log a client message to the server.
     */
    clientLog(msg) {
        fetch("/api/client_log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ msg })
        }).catch(() => {});
    }
};
