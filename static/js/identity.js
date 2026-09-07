// DuoJukebox - Identity & Profile Manager
// Handles custom nickname, random 'Anonymous - XXXX', and emoji avatars

(function () {
    const STORAGE_KEY = "duo_jukebox_user_profile";
    const AVATARS = ["🎧", "🎵", "🎸", "🐱", "🦊", "🐯", "🐼", "🚀", "⭐", "👑", "🔥", "☕", "🥑", "🌻", "🐶", "🦁", "🐰", "🌈"];

    function generateRandomName() {
        const num = Math.floor(1000 + Math.random() * 9000);
        return `Anonymous - ${num}`;
    }

    function getRandomAvatar() {
        return AVATARS[Math.floor(Math.random() * AVATARS.length)];
    }

    const DuoIdentity = {
        AVATARS: AVATARS,

        generateRandomName: generateRandomName,

        getProfile: function () {
            let p = null;
            try {
                p = JSON.parse(localStorage.getItem(STORAGE_KEY));
            } catch (e) {}

            if (!p || !p.id || !p.name) {
                p = {
                    id: "user_" + Math.random().toString(36).substring(2, 9),
                    name: generateRandomName(),
                    icon: getRandomAvatar(),
                    color: "#ec4899"
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
            }
            return p;
        },

        saveProfile: function (name, icon) {
            const current = this.getProfile();
            const cleanName = (name && name.trim()) ? name.trim().substring(0, 25) : generateRandomName();
            const cleanIcon = icon || current.icon || "🎧";

            const updated = {
                ...current,
                name: cleanName,
                icon: cleanIcon
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent("duo_profile_changed", { detail: updated }));

            // If roomNet active, update network profile as well
            if (window.roomNet && window.roomNet.user) {
                window.roomNet.user = {
                    ...window.roomNet.user,
                    name: updated.name,
                    icon: updated.icon
                };
                if (window.roomNet.isHost && typeof window.roomNet.broadcastMemberList === "function") {
                    window.roomNet.members = window.roomNet.members.map(m => {
                        if (m.isHost) return { ...m, name: updated.name, icon: updated.icon };
                        return m;
                    });
                    window.roomNet.broadcastMemberList();
                }
            }

            return updated;
        },

        setupModal: function (options) {
            const {
                modalId,
                openBtnId,
                closeBtnId,
                nameInputId,
                randomBtnId,
                avatarGridId,
                previewAvatarId,
                saveBtnId,
                onSaved
            } = options;

            const modal = document.getElementById(modalId);
            const openBtn = document.getElementById(openBtnId);
            const closeBtn = document.getElementById(closeBtnId);
            const nameInput = document.getElementById(nameInputId);
            const randomBtn = document.getElementById(randomBtnId);
            const avatarGrid = document.getElementById(avatarGridId);
            const previewAvatar = document.getElementById(previewAvatarId);
            const saveBtn = document.getElementById(saveBtnId);

            if (!modal) return;

            let selectedAvatar = this.getProfile().icon;

            function renderAvatarGrid() {
                if (!avatarGrid) return;
                avatarGrid.innerHTML = AVATARS.map(emoji => `
                    <button type="button" class="avatar-opt p-2 rounded-xl text-xl transition hover:scale-110 active:scale-95 ${emoji === selectedAvatar ? 'bg-pink-600/30 border border-pink-500 shadow-md' : 'bg-slate-800 hover:bg-slate-700'}" data-emoji="${emoji}">
                        ${emoji}
                    </button>
                `).join("");

                avatarGrid.querySelectorAll(".avatar-opt").forEach(btn => {
                    btn.addEventListener("click", () => {
                        selectedAvatar = btn.getAttribute("data-emoji");
                        if (previewAvatar) previewAvatar.textContent = selectedAvatar;
                        renderAvatarGrid();
                    });
                });
            }

            function open() {
                const profile = DuoIdentity.getProfile();
                selectedAvatar = profile.icon;
                if (nameInput) nameInput.value = profile.name;
                if (previewAvatar) previewAvatar.textContent = selectedAvatar;
                renderAvatarGrid();
                modal.classList.remove("hidden");
                modal.classList.add("flex");
                if (nameInput) {
                    setTimeout(() => nameInput.focus(), 100);
                }
                if (window.lucide) window.lucide.createIcons();
            }

            function close() {
                modal.classList.add("hidden");
                modal.classList.remove("flex");
            }

            if (openBtn) openBtn.addEventListener("click", open);
            if (closeBtn) closeBtn.addEventListener("click", close);

            modal.addEventListener("click", (e) => {
                if (e.target === modal) close();
            });

            if (randomBtn) {
                randomBtn.addEventListener("click", () => {
                    const newName = generateRandomName();
                    if (nameInput) nameInput.value = newName;
                    selectedAvatar = getRandomAvatar();
                    if (previewAvatar) previewAvatar.textContent = selectedAvatar;
                    renderAvatarGrid();
                });
            }

            function save() {
                const name = nameInput ? nameInput.value.trim() : "";
                const updated = DuoIdentity.saveProfile(name, selectedAvatar);
                close();
                if (onSaved) onSaved(updated);
            }

            if (saveBtn) saveBtn.addEventListener("click", save);
            if (nameInput) {
                nameInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        save();
                    }
                });
            }

            return { open, close };
        }
    };

    window.DuoIdentity = DuoIdentity;
})();
