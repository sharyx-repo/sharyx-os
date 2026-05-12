let ws;
let mediaRecorder;
let audioContext;
let processor;
let isCalling = false;
let nextPlayTime = 0;
let playingSources = [];
let currentSessionId = '';
let currentUserId = '';
let sessionHistory = [];
let sessionMetrics = {};

const callBtn = document.getElementById('callBtn');
const btnText = document.getElementById('btnText');
const btnIcon = callBtn.querySelector('i');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const bars = document.querySelectorAll('.bar');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const displayUserId = document.getElementById('displayUserId');
const displaySessionId = document.getElementById('displaySessionId');
const statConnState = document.getElementById('statConnState');
const statTrackState = document.getElementById('statTrackState');
const statTrackId = document.getElementById('statTrackId');
const statLatency = document.getElementById('statLatency');
const statInterrupts = document.getElementById('statInterrupts');
const statAiStatus = document.getElementById('statAiStatus');
const statUserVad = document.getElementById('statUserVad');
const statNetQuality = document.getElementById('statNetQuality');

let vadTimeout = null;

callBtn.onclick = async () => {
    if (isCalling) {
        stopCall();
        return;
    }
    startCall();
};

async function sendTextMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
        // 1. Add to UI
        addMessageToTranscript('user', text, true);
        
        // 2. Send to backend
        ws.send(JSON.stringify({ event: 'text', payload: text }));
        
        // 3. Clear input
        chatInput.value = '';
    }
}

sendBtn.onclick = () => sendTextMessage();
chatInput.onkeydown = (e) => {
    if (e.key === 'Enter') sendTextMessage();
};

async function startCall() {
    isCalling = true;
    btnText.innerText = 'Stop Call';
    btnIcon.className = 'ph-bold ph-stop';
    callBtn.classList.add('active');
    voiceInterface.classList.add('is-active');
    statusText.innerText = 'Connecting...';
    statusDot.classList.add('active');
    
    // Enable Chat Input
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();

    // 1. Initialize AudioContext early for AutoPlay policy and fast start
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
    } catch (e) {
        console.error('Failed to initialize AudioContext:', e);
    }

    // 2. Setup WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        statusText.innerText = 'Connected. Setting up mic...';
        setupMicrophone();
    };

    ws.onmessage = async (message) => {
        const data = JSON.parse(message.data);
        if (data.event === 'audio') {
            playAudio(data.payload);
        } else if (data.event === 'clear' || data.type === 'clear') {
            stopAudio();
        } else if (data.event === 'session_info') {
            currentSessionId = data.payload.sessionId;
            currentUserId = data.payload.userId;
            displayUserId.innerText = currentUserId;
            displaySessionId.innerText = currentSessionId;
            
            // Sidebar Update
            statTrackId.innerText = `TR_${currentSessionId.toUpperCase()}`;
            statConnState.innerText = 'Connected';
            statConnState.className = 'stat-value active';
            statTrackState.innerText = 'Subscribed';
            statTrackState.className = 'stat-value active';
        } else if (data.event === 'metrics') {
            sessionMetrics = data.payload;
            if (statLatency) statLatency.innerText = `${data.payload.avgLatencyMs}ms`;
            if (statInterrupts) statInterrupts.innerText = data.payload.interruptCount;
            
            // Calculate Network Health
            if (statNetQuality) {
                const latency = data.payload.avgLatencyMs;
                if (latency < 1000) {
                    statNetQuality.innerText = 'Excellent';
                    statNetQuality.style.color = 'var(--health-high)';
                } else if (latency < 2000) {
                    statNetQuality.innerText = 'Good';
                    statNetQuality.style.color = 'var(--health-mid)';
                } else {
                    statNetQuality.innerText = 'Poor';
                    statNetQuality.style.color = 'var(--health-low)';
                }
            }
            
            updateLastSessionWithMetrics(data.payload);
        } else if (data.event === 'status_update') {
            const { status, type } = data.payload;
            if (type === 'pipeline' && statAiStatus) {
                statAiStatus.innerText = status;
                statAiStatus.className = `stat-value ${status !== 'Idle' ? 'active' : ''}`;
            } else if (type === 'vad' && statUserVad) {
                statUserVad.innerText = status;
                statUserVad.className = 'stat-value active';
                
                // Clear VAD after 2 seconds of silence
                if (vadTimeout) clearTimeout(vadTimeout);
                vadTimeout = setTimeout(() => {
                    if (statUserVad) {
                        statUserVad.innerText = 'Silent';
                        statUserVad.className = 'stat-value';
                    }
                }, 2000);
            }
        } else if (data.event === 'transcript') {
            addMessageToTranscript(data.payload.role, data.payload.text, data.payload.final, data.payload.latency);
        } else if (data.event === 'clear') {
            playingSources.forEach(s => s.stop());
            playingSources = [];
            nextPlayTime = audioContext ? audioContext.currentTime : 0;
        }
    };

    ws.onerror = (err) => {
        statusText.innerText = 'Connection Error.';
        statusDot.classList.remove('active');
        console.error('WS Error:', err);
    };
}

async function setupMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusText.innerText = 'Mic access not supported.';
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        statusText.innerText = 'Listening...';

        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        }

        const source = audioContext.createMediaStreamSource(stream);

        // Use a buffer size that's a power of 2
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const volume = Math.max(...inputData);

            // Update visualizer bars
            bars.forEach((bar, index) => {
                const scale = volume * 150;
                const randomExtra = Math.random() * 5;
                const height = Math.max(8, scale + randomExtra + (index % 3) * 5);
                bar.style.height = `${height}px`;

                // Add slight brightness variation
                bar.style.opacity = 0.5 + (volume * 2);
            });

            // Convert to Int16
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }

            // Safer base64 conversion
            const bytes = new Uint8Array(pcmData.buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event: 'audio', payload: base64 }));
            }
        };
    } catch (err) {
        console.error('Microphone access denied:', err);
        statusDot.classList.remove('active');
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            statusText.innerText = 'Mic permission denied.';
        } else {
            statusText.innerText = `Error: ${err.message}`;
        }
        stopCall();
    }
}

let audioLeftover = null;

function playAudio(base64) {
    if (!audioContext) return;

    const binary = atob(base64);
    const len = binary.length;
    let bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) { bytes[i] = binary.charCodeAt(i); }

    // Handle leftover bytes from previous chunk
    if (audioLeftover !== null) {
        const newBytes = new Uint8Array(bytes.length + 1);
        newBytes[0] = audioLeftover;
        newBytes.set(bytes, 1);
        bytes = newBytes;
        audioLeftover = null;
    }

    // If we have an odd number of bytes, save the last one for the next chunk
    if (bytes.length % 2 !== 0) {
        audioLeftover = bytes[bytes.length - 1];
        bytes = bytes.slice(0, bytes.length - 1);
    }

    if (bytes.length === 0) return;

    // Decode Int16 PCM to Float32
    // IMPORTANT: Specify byteOffset and length because bytes might be a sliced view
    const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    // Create AudioBuffer (16kHz, 1 channel)
    const audioBuffer = audioContext.createBuffer(1, float32Array.length, 16000);
    audioBuffer.copyToChannel(float32Array, 0);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    // Smooth scheduling
    const playTime = Math.max(audioContext.currentTime, nextPlayTime);
    source.start(playTime);
    nextPlayTime = playTime + audioBuffer.duration;

    playingSources.push(source);
    source.onended = () => {
        playingSources = playingSources.filter(s => s !== source);
    };
}
function stopAudio() {
    console.log('🛑 Stopping all audio playback');
    playingSources.forEach(source => {
        try {
            source.stop();
        } catch (e) {}
    });
    playingSources = [];
    nextPlayTime = 0;
    audioLeftover = null;
}

function stopCall() {
    isCalling = false;
    btnText.innerText = 'Start Call';
    btnIcon.className = 'ph-bold ph-phone';
    callBtn.classList.remove('active');
    voiceInterface.classList.remove('is-active');
    statusDot.classList.remove('active');

    if (statusText.innerText !== 'Mic permission denied.' && !statusText.innerText.startsWith('Error')) {
        statusText.innerText = 'Call ended.';
    }
    if (ws) {
        ws.close();
        ws = null;
    }

    // Capture technical snapshot BEFORE resetting UI
    const technicalSpecs = getTechnicalSnapshot();

    // --- LOCAL STORAGE REMOVED ---
    console.log('📦 Session ended:', currentSessionId);

function getTechnicalSnapshot() {
    return {
        quality: statNetQuality?.innerText || 'N/A',
        aiStatus: statAiStatus?.innerText || 'Idle',
        userVad: statUserVad?.innerText || 'Silent',
        connection: statConnState?.innerText || 'Disconnected',
        trackState: statTrackState?.innerText || 'Unsubscribed',
        trackId: statTrackId?.innerText || 'N/A',
        latency: statLatency?.innerText || '0ms',
        interruptions: statInterrupts?.innerText || '0',
        userId: displayUserId?.innerText || '...',
        sessionId: displaySessionId?.innerText || '...',
        // Hardcoded specs from UI
        codec: 'Opus (48kHz)',
        encryption: 'DTLS-SRTP',
        protocol: 'Secure WS',
        bitrate: '48 kbps'
    };
}
    // ----------------------------

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    // Disable Chat Input
    chatInput.disabled = true;
    sendBtn.disabled = true;
    chatInput.value = '';

    // Sidebar Reset
    statConnState.innerText = 'Disconnected';
    statConnState.className = 'stat-value';
    statTrackState.innerText = 'Unsubscribed';
    statTrackState.className = 'stat-value';
}

function updateLastSessionWithMetrics(metrics) {
    // Local storage persistence removed. Metrics are handled by the backend Redis store.
}

let lastMessageElement = null;
let lastRole = null;

function addMessageToTranscript(role, text, final = true, latency = null) {
    if (!text) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isAgent = role === 'agent';
    
    // If it's the same role and the last message wasn't finished, update its target
    if (lastMessageElement && lastRole === role && !lastMessageElement.dataset.final) {
        const content = lastMessageElement.querySelector('.message-content');
        content.dataset.targetText = text;
        
        if (final) {
            lastMessageElement.dataset.final = "true";
            if (isAgent && latency) {
                const top = lastMessageElement.querySelector('.message-top');
                if (!top.querySelector('.latency-badge')) {
                    top.insertAdjacentHTML('beforeend', `<span class="latency-badge">latency: ${latency}ms</span>`);
                }
            }
        }
        return;
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isAgent ? 'agent' : 'user'}`;
    if (final) msgDiv.dataset.final = "true";
    
    const latencyHtml = (isAgent && latency) ? `<span class="latency-badge">latency: ${latency}ms</span>` : '';

    msgDiv.innerHTML = `
        <div class="avatar">${isAgent ? 'A' : 'U'}</div>
        <div class="message-body">
            <div class="message-top">
                <span class="sender-name">${isAgent ? 'Assistant' : 'User'}</span>
                <span class="timestamp">${time}</span>
                ${latencyHtml}
            </div>
            <div class="message-content typing" data-target-text="${text}"></div>
        </div>
    `;

    transcriptContainer.appendChild(msgDiv);
    lastMessageElement = msgDiv;
    lastRole = role;

    sessionHistory.push({ role, text, timestamp: new Date().toISOString() });
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
}

// --- TYPEWRITER ANIMATION CORE ---
function animateTypewriter() {
    const typingElements = document.querySelectorAll('.message-content.typing');
    
    typingElements.forEach(el => {
        const targetText = el.dataset.targetText || '';
        const currentText = el.innerText;
        
        if (currentText.length < targetText.length) {
            // Add next character
            el.innerText = targetText.slice(0, currentText.length + 1);
            transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
        } else {
            // Check if we should remove the typing cursor
            const parentMsg = el.closest('.message');
            if (parentMsg && parentMsg.dataset.final === "true") {
                el.classList.remove('typing');
            }
        }
    });
    
    requestAnimationFrame(animateTypewriter);
}

// Start the animation loop
animateTypewriter();

// --- INITIALIZE COLLAPSIBLE SECTIONS ---
document.querySelectorAll('.stats-section h3').forEach(header => {
    header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('collapsed');
    });
});

// --- DRAWER TOGGLE LOGIC ---
const statsDrawer = document.getElementById('statsDrawer');
const drawerToggle = document.getElementById('drawerToggle');
const drawerClose = document.getElementById('drawerClose');
const drawerOverlay = document.getElementById('drawerOverlay');

function openDrawer() {
    statsDrawer.classList.add('open');
    drawerOverlay.classList.add('active');
    drawerToggle.style.opacity = '0';
    drawerToggle.style.visibility = 'hidden';
}

function closeDrawer() {
    statsDrawer.classList.remove('open');
    drawerOverlay.classList.remove('active');
    drawerToggle.style.opacity = '1';
    drawerToggle.style.visibility = 'visible';
}

drawerToggle.onclick = openDrawer;
drawerClose.onclick = closeDrawer;
drawerOverlay.onclick = closeDrawer;
