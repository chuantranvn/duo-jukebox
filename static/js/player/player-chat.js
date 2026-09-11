// DuoJukebox - Player Chat
// Chat drawer controller, chat message rendering, history, and WebRTC chat callbacks.

const btnToggleChat = document.getElementById("btn-toggle-chat");
const chatUnreadBadge = document.getElementById("chat-unread-badge");
const chatDrawer = document.getElementById("chat-drawer");
const btnCloseChat = document.getElementById("btn-close-chat");
const chatRoomTitle = document.getElementById("chat-room-title");
const chatMessagesContainer = document.getElementById("chat-messages-container");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

let isChatOpen = false;
let chatUnreadCount = 0;

function openChatDrawer() {
    if (!chatDrawer) return;
    isChatOpen = true;
    chatDrawer.classList.remove("opacity-0", "pointer-events-none", "scale-95");
    chatDrawer.classList.add("opacity-100", "scale-100");
    chatUnreadCount = 0;
    if (chatUnreadBadge) chatUnreadBadge.classList.add("hidden");
    scrollChatToBottom();
    if (chatInput) setTimeout(() => chatInput.focus(), 100);
}

function closeChatDrawer() {
    if (!chatDrawer) return;
    isChatOpen = false;
    chatDrawer.classList.add("opacity-0", "pointer-events-none", "scale-95");
    chatDrawer.classList.remove("opacity-100", "scale-100");
}

if (btnToggleChat) {
    btnToggleChat.addEventListener("click", () => {
        if (isChatOpen) closeChatDrawer(); else openChatDrawer();
    });
}
if (btnCloseChat) {
    btnCloseChat.addEventListener("click", closeChatDrawer);
}

function scrollChatToBottom() {
    if (chatMessagesContainer) {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
}

function appendChatMessage(msg) {
    if (!chatMessagesContainer || !msg) return;

    const msgId = msg.id || msg.msgId;
    if (msgId && document.getElementById(`chat-msg-${msgId}`)) {
        return; // Already rendered in UI
    }

    if (chatMessagesContainer.querySelector(".italic")) {
        chatMessagesContainer.innerHTML = "";
    }

    const date = new Date(msg.timestamp || Date.now());
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (msg.isSystem) {
        const sysDiv = document.createElement("div");
        if (msgId) sysDiv.id = `chat-msg-${msgId}`;
        sysDiv.className = "text-center text-[10px] text-pink-300/80 bg-pink-500/10 py-1 px-2.5 rounded-full mx-auto w-fit max-w-[90%]";
        sysDiv.textContent = msg.text;
        chatMessagesContainer.appendChild(sysDiv);
    } else {
        const isMe = (msg.sender && window.roomNet && msg.sender.id === window.roomNet.user.id);
        const msgDiv = document.createElement("div");
        if (msgId) msgDiv.id = `chat-msg-${msgId}`;
        msgDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-0.5`;
        msgDiv.innerHTML = `
            <div class="flex items-center space-x-1 text-[10px] text-slate-400 px-1">
                <span>${msg.sender?.icon || '👤'}</span>
                <span class="font-bold text-slate-300">${isMe ? 'Bạn' : (msg.sender?.name || 'Thành viên')}</span>
                <span>•</span>
                <span class="font-mono text-[9px]">${timeStr}</span>
            </div>
            <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words ${isMe ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'}">
                ${escapeHtml(msg.text)}
            </div>
        `;
        chatMessagesContainer.appendChild(msgDiv);
    }

    scrollChatToBottom();

    const countBadge = document.getElementById("chat-msg-count");
    if (countBadge && window.localStore && window.roomNet && window.roomNet.roomCode) {
        window.localStore.getChatCount(window.roomNet.roomCode).then(cnt => {
            countBadge.textContent = `(${cnt})`;
        });
    }

    if (!isChatOpen) {
        chatUnreadCount++;
        if (chatUnreadBadge) {
            chatUnreadBadge.textContent = chatUnreadCount > 99 ? '99+' : chatUnreadCount;
            chatUnreadBadge.classList.remove("hidden");
        }
    }
}

async function renderChatHistory(roomCode) {
    if (!chatMessagesContainer) return;
    if (!window.roomNet || typeof window.roomNet.getChatHistory !== "function") return;

    const history = await window.roomNet.getChatHistory(roomCode);
    chatMessagesContainer.innerHTML = "";

    const countBadge = document.getElementById("chat-msg-count");
    if (countBadge) countBadge.textContent = `(${history ? history.length : 0})`;

    if (!history || history.length === 0) {
        chatMessagesContainer.innerHTML = `
            <div class="text-center text-slate-500 py-10 text-[11px] italic">
                Chưa có tin nhắn nào.<br>Hãy gửi lời chào đến mọi người trong phòng!
            </div>
        `;
        return;
    }
    history.forEach(msg => appendChatMessage(msg));
}

const btnClearChat = document.getElementById("btn-clear-chat");
if (btnClearChat) {
    btnClearChat.addEventListener("click", async () => {
        if (confirm("Bạn có chắc muốn xoá toàn bộ lịch sử trò chuyện của phòng này trong NoSQL Local?")) {
            const currentRoom = window.roomNet ? window.roomNet.roomCode : null;
            if (currentRoom) {
                await window.roomNet.clearChatHistory(currentRoom);
                await renderChatHistory(currentRoom);
                showToast("Đã xoá sạch lịch sử chat phòng này");
            }
        }
    });
}

if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text && window.roomNet) {
            window.roomNet.sendChatMessage(text);
            chatInput.value = "";
        }
    });
}

if (window.roomNet) {
    window.roomNet.onChatMessageCallback = function (msg) {
        appendChatMessage(msg);
    };
}
