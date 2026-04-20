# Sharyx Web Call Demo 🎙️

A production-ready example of how to build a real-time AI voice assistant for the web using the **Sharyx Voice Agent SDK**.

---

## 🏗️ How it Works (A-to-Z Flow)

1.  **Browser**: Captures raw audio from your microphone using the Web Audio API.
2.  **Streaming**: Sends the audio packets to the Node.js server via **WebSockets**.
3.  **Sharyx SDK**:
    -   **STT**: Streams audio to Deepgram for real-time transcription.
    -   **LLM**: Processes the transcript and generates an intelligent response via OpenAI.
    -   **TTS**: Converts the AI's response into high-quality speech via ElevenLabs.
4.  **Playback**: The server streams the AI voice back to the browser for instant playback.

---

## 🚀 Quick Start (60 Seconds)

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Setup your keys**:
    Create a `.env` file and add:
    ```env
    OPENAI_API_KEY=sk-your-key
    DEEPGRAM_API_KEY=your-key
    ELEVENLABS_API_KEY=your-key
    CARTESIA_API_KEY=your-key
    CARTESIA_VOICE_ID=your-key
    CARTESIA_MODEL_ID=your-key
    TWILIO_ACCOUNT_SID=your-key
    TWILIO_AUTH_TOKEN=your-key
    TWILIO_PHONE_NUMBER=your-key
    PLIVO_AUTH_ID=your-key
    PLIVO_AUTH_TOKEN=your-key
    PLIVO_PHONE_NUMBER=your-key
    WS_SHARED_SECRET=your-key
    NGROK_DOMAIN=your-key
    ```

3.  **Run the server**:
    ```bash
    npm run start
    ```

4.  **Open in Browser**:
    Visit `http://localhost:3000` and click "Call",
    Visit `http://localhost:8080/index.html` and click "Call",

---

## 🛠️ Key Technologies
-   **SDK**: [sharyx-voice-agent](https://www.npmjs.com/package/sharyx-voice-agent)
-   **Backend**: Node.js + Express + WebSockets (`ws`)
-   **Frontend**: Vanilla JavaScript (Web Audio API)
-   **Execution**: `tsx` (TypeScript Execute)

## 📄 License
MIT © 2026 Sharyx
