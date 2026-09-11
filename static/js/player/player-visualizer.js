// DuoJukebox - Player Visualizer
// Cyberpunk Audio Visualizer Engine (Equalizer Bars + Waveform + Mic capture + Vinyl pulse rings).

const elVisualizerWrapper = document.getElementById("visualizer-wrapper");
const elVisualizerCanvas = document.getElementById("audio-visualizer-canvas");
const btnToggleVisualizer = document.getElementById("btn-toggle-visualizer");
const elVisualizerToggleText = document.getElementById("visualizer-toggle-text");
const btnVisStyleBars = document.getElementById("btn-vis-style-bars");
const btnVisStyleWave = document.getElementById("btn-vis-style-wave");
const btnVisMic = document.getElementById("btn-vis-mic");
const elVisMicText = document.getElementById("vis-mic-text");
const elVisualizerIndicator = document.getElementById("visualizer-indicator");
const elVisualizerModeLabel = document.getElementById("visualizer-mode-label");
const elVinylPulse1 = document.getElementById("vinyl-pulse-ring-1");
const elVinylPulse2 = document.getElementById("vinyl-pulse-ring-2");

let isVisualizerEnabled = localStorage.getItem("duojukebox_vis_enabled") !== "false";
let visStyle = localStorage.getItem("duojukebox_vis_style") || "bars"; // 'bars' | 'wave'
let isMicActive = false;
let micAudioCtx = null;
let micAnalyser = null;
let micStream = null;

const VIS_BAR_COUNT = 36;
const currentFftData = new Float32Array(VIS_BAR_COUNT);
const peakCaps = new Float32Array(VIS_BAR_COUNT);
let visAnimFrameId = null;
let visTimePhase = 0;
let smoothedEnergy = 0;

function initAudioVisualizer() {
    if (!elVisualizerCanvas) return;

    function resizeCanvas() {
        const rect = elVisualizerCanvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            const dpr = window.devicePixelRatio || 1;
            elVisualizerCanvas.width = rect.width * dpr;
            elVisualizerCanvas.height = rect.height * dpr;
        }
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Toggle Visualizer on/off
    if (btnToggleVisualizer) {
        btnToggleVisualizer.addEventListener("click", () => {
            isVisualizerEnabled = !isVisualizerEnabled;
            localStorage.setItem("duojukebox_vis_enabled", isVisualizerEnabled ? "true" : "false");
            updateVisualizerVisibility();
            showToast(isVisualizerEnabled ? "🌊 Đã BẬT Sóng nhạc visualizer!" : "🌊 Đã TẮT Sóng nhạc visualizer");
        });
    }

    // Switch style to Bars
    if (btnVisStyleBars) {
        btnVisStyleBars.addEventListener("click", () => {
            setVisualizerStyle("bars");
        });
    }

    // Switch style to Wave
    if (btnVisStyleWave) {
        btnVisStyleWave.addEventListener("click", () => {
            setVisualizerStyle("wave");
        });
    }

    // Toggle Mic mode
    if (btnVisMic) {
        btnVisMic.addEventListener("click", toggleMicMode);
    }

    updateVisualizerVisibility();
    updateVisualizerStyleUI();
    startVisualizerLoop();
}

function updateVisualizerVisibility() {
    if (elVisualizerWrapper) {
        if (isVisualizerEnabled) {
            elVisualizerWrapper.classList.remove("hidden");
        } else {
            elVisualizerWrapper.classList.add("hidden");
        }
    }
    if (btnToggleVisualizer && elVisualizerToggleText) {
        if (isVisualizerEnabled) {
            btnToggleVisualizer.className = "flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/30 cursor-pointer transition hover:scale-105 shadow-md shadow-pink-500/10";
            elVisualizerToggleText.textContent = "Sóng: BẬT";
        } else {
            btnToggleVisualizer.className = "flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 cursor-pointer transition hover:scale-105";
            elVisualizerToggleText.textContent = "Sóng: TẮT";
        }
    }
}

function setVisualizerStyle(style) {
    visStyle = style;
    localStorage.setItem("duojukebox_vis_style", style);
    updateVisualizerStyleUI();
}

function updateVisualizerStyleUI() {
    if (btnVisStyleBars) {
        if (visStyle === "bars") {
            btnVisStyleBars.className = "px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-600/30 text-pink-300 border border-pink-500/40 transition shadow-sm";
        } else {
            btnVisStyleBars.className = "px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition";
        }
    }
    if (btnVisStyleWave) {
        if (visStyle === "wave") {
            btnVisStyleWave.className = "px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition shadow-sm";
        } else {
            btnVisStyleWave.className = "px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition";
        }
    }
    if (elVisualizerModeLabel) {
        elVisualizerModeLabel.textContent = visStyle === "bars" ? "Sóng Nhạc Equalizer" : "Sóng Âm Uốn Lượn (Wave)";
    }
}

async function toggleMicMode() {
    if (isMicActive) {
        // Turn OFF mic
        if (micStream) {
            micStream.getTracks().forEach(t => t.stop());
            micStream = null;
        }
        if (micAudioCtx) {
            try { await micAudioCtx.close(); } catch(e) {}
            micAudioCtx = null;
            micAnalyser = null;
        }
        isMicActive = false;
        if (btnVisMic && elVisMicText) {
            btnVisMic.className = "flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition";
            elVisMicText.textContent = "Loa Mic: TẮT";
        }
        showToast("🎙️ Đã chuyển về chế độ Nhịp Điệu Tự Động!");
    } else {
        // Turn ON mic
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            micAudioCtx = new AudioContextClass();
            micAnalyser = micAudioCtx.createAnalyser();
            micAnalyser.fftSize = 128;
            micAnalyser.smoothingTimeConstant = 0.8;
            const source = micAudioCtx.createMediaStreamSource(micStream);
            source.connect(micAnalyser);
            isMicActive = true;
            if (btnVisMic && elVisMicText) {
                btnVisMic.className = "flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-500/20 transition";
                elVisMicText.textContent = "Loa Mic: BẬT 🟢";
            }
            showToast("🎤 Đã BẬT Bắt nhịp loa phòng khách qua Micro thành công!");
        } catch (err) {
            console.error("Mic access error:", err);
            showToast("Không thể kích hoạt Micro (yêu cầu cấp quyền trong trình duyệt)", "warning");
        }
    }
}

function startVisualizerLoop() {
    const ctx = elVisualizerCanvas.getContext("2d");
    const rawMicData = new Uint8Array(64);

    function render() {
        visAnimFrameId = requestAnimationFrame(render);
        if (!isVisualizerEnabled || !elVisualizerCanvas) return;

        const width = elVisualizerCanvas.width;
        const height = elVisualizerCanvas.height;
        if (width === 0 || height === 0) return;

        visTimePhase += 0.05;

        const isPlaying = !isPlaybackStopped && currentSong && player && typeof player.getPlayerState === "function" && player.getPlayerState() === YT.PlayerState.PLAYING;
        const targetVolMultiplier = (currentVolume || 80) / 100;
        const targetEnergy = isPlaying ? (0.85 * targetVolMultiplier) : 0.02;
        smoothedEnergy += (targetEnergy - smoothedEnergy) * 0.12;

        // Sync indicator in header / card
        if (elVisualizerIndicator) {
            if (isPlaying && smoothedEnergy > 0.15) {
                elVisualizerIndicator.classList.add("active");
            } else {
                elVisualizerIndicator.classList.remove("active");
            }
        }

        // Sync vinyl aura rings
        if (elVinylPulse1 && elVinylPulse2) {
            const playState = (isPlaying && !isVideoMode) ? "running" : "paused";
            elVinylPulse1.style.animationPlayState = playState;
            elVinylPulse2.style.animationPlayState = playState;
        }

        // Compute frequency data
        if (isMicActive && micAnalyser) {
            micAnalyser.getByteFrequencyData(rawMicData);
            for (let i = 0; i < VIS_BAR_COUNT; i++) {
                const rawVal = rawMicData[Math.floor(i * (rawMicData.length / VIS_BAR_COUNT))] / 255.0;
                currentFftData[i] += (rawVal - currentFftData[i]) * 0.25;
            }
        } else {
            // Procedural Cyberpunk Rhythm Engine
            for (let i = 0; i < VIS_BAR_COUNT; i++) {
                if (isPlaying) {
                    const normalizedIdx = i / VIS_BAR_COUNT;
                    const bassPulse = Math.sin(visTimePhase * 3.8) * Math.sin(visTimePhase * 1.9 + 1.0);
                    const midPulse = Math.cos(visTimePhase * 5.2 + i * 0.35);
                    const highPulse = Math.sin(visTimePhase * 8.4 + i * 0.7);

                    let barVal = 0.2;
                    if (normalizedIdx < 0.25) {
                        barVal = 0.45 + 0.5 * Math.max(0, bassPulse);
                    } else if (normalizedIdx < 0.65) {
                        barVal = 0.35 + 0.45 * Math.abs(midPulse);
                    } else {
                        barVal = 0.25 + 0.4 * Math.abs(highPulse);
                    }

                    const targetVal = Math.min(1.0, barVal * smoothedEnergy * (0.8 + 0.4 * Math.sin(visTimePhase * 2.1 + i)));
                    currentFftData[i] += (targetVal - currentFftData[i]) * 0.3;
                } else {
                    currentFftData[i] += (0.02 - currentFftData[i]) * 0.1;
                }
            }
        }

        ctx.clearRect(0, 0, width, height);

        if (visStyle === "bars") {
            // 📊 1. Cyberpunk Neon Equalizer Bars
            const barSpacing = Math.max(2, (width / VIS_BAR_COUNT) * 0.25);
            const barWidth = (width - (VIS_BAR_COUNT - 1) * barSpacing) / VIS_BAR_COUNT;
            const maxBarHeight = height * 0.88;

            for (let i = 0; i < VIS_BAR_COUNT; i++) {
                const val = Math.max(0.04, currentFftData[i]);
                const barHeight = val * maxBarHeight;
                const x = i * (barWidth + barSpacing);
                const y = height - barHeight;

                if (barHeight > peakCaps[i]) {
                    peakCaps[i] = barHeight;
                } else {
                    peakCaps[i] = Math.max(0, peakCaps[i] - 1.2);
                }

                const grad = ctx.createLinearGradient(0, height, 0, y);
                grad.addColorStop(0, "rgba(6, 182, 212, 0.9)");
                grad.addColorStop(0.5, "rgba(99, 102, 241, 0.95)");
                grad.addColorStop(1, "rgba(236, 72, 153, 1.0)");

                ctx.save();
                ctx.shadowColor = "rgba(236, 72, 153, 0.65)";
                ctx.shadowBlur = 8;
                ctx.fillStyle = grad;

                const radius = Math.min(barWidth / 2, 4);
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + barWidth - radius, y);
                ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
                ctx.lineTo(x + barWidth, height);
                ctx.lineTo(x, height);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
                ctx.fill();

                const capY = height - peakCaps[i] - 3;
                if (capY > 0 && capY < height) {
                    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
                    ctx.shadowBlur = 6;
                    ctx.fillRect(x, capY, barWidth, 2);
                }
                ctx.restore();
            }
        } else {
            // 🌊 2. Fluid Siri / Apple Music Multi-layer Sine Wave
            const layers = [
                { color: "rgba(236, 72, 153, 0.45)", stroke: "rgba(236, 72, 153, 0.9)", speed: 1.0, freq: 0.02, ampMult: 1.0 },
                { color: "rgba(168, 85, 247, 0.35)", stroke: "rgba(168, 85, 247, 0.85)", speed: -1.3, freq: 0.03, ampMult: 0.75 },
                { color: "rgba(6, 182, 212, 0.3)", stroke: "rgba(6, 182, 212, 0.85)", speed: 1.8, freq: 0.025, ampMult: 0.5 }
            ];

            const centerY = height * 0.55;
            const maxAmp = height * 0.42 * smoothedEnergy;

            layers.forEach((layer) => {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(0, centerY);

                for (let x = 0; x <= width; x += 4) {
                    const normalizedX = x / width;
                    const envelope = Math.sin(normalizedX * Math.PI);
                    const binIdx = Math.min(VIS_BAR_COUNT - 1, Math.floor(normalizedX * VIS_BAR_COUNT));
                    const binBoost = 0.5 + currentFftData[binIdx];
                    const y = centerY + Math.sin(x * layer.freq + visTimePhase * layer.speed) * maxAmp * layer.ampMult * envelope * binBoost;
                    ctx.lineTo(x, y);
                }

                ctx.lineTo(width, height);
                ctx.lineTo(0, height);
                ctx.closePath();

                ctx.fillStyle = layer.color;
                ctx.shadowColor = layer.stroke;
                ctx.shadowBlur = 10;
                ctx.fill();

                ctx.strokeStyle = layer.stroke;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            });
        }
    }

    render();
}

// Start Visualizer Engine
initAudioVisualizer();
