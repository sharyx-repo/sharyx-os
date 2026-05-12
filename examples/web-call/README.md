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
    ```bash
    cp .env.example .env
    ```
    Then edit `.env` and fill in your API keys. The key variables:
    ```env
    # Pick your LLM provider: openai (default) or gemini
    LLM_PROVIDER=openai
    OPENAI_API_KEY=sk-your-key        # if LLM_PROVIDER=openai
    GEMINI_API_KEY=your-key            # if LLM_PROVIDER=gemini

    # Speech-to-Text (required)
    DEEPGRAM_API_KEY=your-key

    # Pick your TTS provider: cartesia (default) or elevenlabs
    TTS_PROVIDER=cartesia
    CARTESIA_API_KEY=your-key          # if TTS_PROVIDER=cartesia
    CARTESIA_VOICE_ID=your-voice-id    # optional, has default
    ELEVENLABS_API_KEY=your-key        # if TTS_PROVIDER=elevenlabs
    ELEVENLABS_VOICE_ID=your-voice-id  # optional, has default
    ```

3.  **Run the server**:
    ```bash
    npm run start
    ```

4.  **Open in Browser**:
    Visit `http://localhost:3000` and click "Call".

---

## 🛠️ Key Technologies
-   **SDK**: [sharyx-voice-agent](https://www.npmjs.com/package/sharyx-voice-agent)
-   **Backend**: Node.js + Express + WebSockets (`ws`)
-   **Frontend**: Vanilla JavaScript (Web Audio API)
-   **Execution**: `tsx` (TypeScript Execute)

## 📄 License
MIT © 2026 Sharyx
