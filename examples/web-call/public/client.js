let ws;
let mediaRecorder;
let audioContext;
let processor;
let isCalling = false;
let nextPlayTime = 0;
let playingSources = [];

const callBtn = document.getElementById('callBtn');
const status = document.getElementById('status');
const bars = document.querySelectorAll('.bar');

callBtn.onclick = async () => {
    if (isCalling) {
        stopCall();
        return;
    }
    startCall();
};

async function startCall() {
    isCalling = true;
    callBtn.innerText = '🛑 Stop Call';
    callBtn.classList.add('active');
    status.innerText = 'Connecting...';

    // 1. Initialize AudioContext early for AutoPlay policy and fast start
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
    } catch(e) {
        console.error('Failed to initialize AudioContext:', e);
    }

    // 2. Setup WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onopen = () => {
        status.innerText = '💻 Connected. Setting up microphone...';
        setupMicrophone();
    };

    ws.onmessage = async (message) => {
        const data = JSON.parse(message.data);
        if (data.event === 'audio') {
            playAudio(data.payload);
        } else if (data.event === 'clear') {
            playingSources.forEach(s => s.stop());
            playingSources = [];
            nextPlayTime = audioContext ? audioContext.currentTime : 0;
        }
    };

    ws.onerror = (err) => {
        status.innerText = '❌ Connection Error.';
        console.error('WS Error:', err);
    };
}

async function setupMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.innerText = '❌ Browser does not support microphone access.';
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
        status.innerText = '💻 Connected. Speak now!';
        
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
        bars.forEach(bar => bar.style.height = `${Math.random() * volume * 200 + 5}px`);

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
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            status.innerText = '❌ Microphone permission denied. Please allow access in browser settings.';
        } else {
            status.innerText = `❌ Error: ${err.message}`;
        }
        stopCall();
    }
}

function playAudio(base64) {
    if (!audioContext) return;

    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) { bytes[i] = binary.charCodeAt(i); }
    
    // Decode Int16 PCM to Float32
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for(let i = 0; i < int16Array.length; i++) {
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

function stopCall() {
    isCalling = false;
    callBtn.innerText = '📞 Click to Call';
    callBtn.classList.remove('active');
    if (status.innerText.startsWith('💻')) {
        status.innerText = 'Call ended.';
    }
    if (ws) {
        ws.close();
        ws = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}
