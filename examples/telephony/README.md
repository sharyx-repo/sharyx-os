# Sharyx Telephony Demo (Twilio) 📞

A production-ready example of how to connect the **Sharyx Voice Agent SDK** to a real phone number using **Twilio Media Streams**.

---

## 🏗️ How it Works (A-to-Z Flow)

1.  **Phone Call**: A user dials your Twilio phone number.
2.  **TwiML**: Twilio sends a webhook to this server, which responds with `<Connect><Stream/></Connect>`.
3.  **Media Stream**: Twilio opens a WebSocket and sends raw 8kHz μ-law audio.
4.  **Sharyx SDK**:
    -   **STT**: Processes the phone audio in real-time.
    -   **LLM**: Analyzes the conversation and generates a response.
    -   **TTS**: Converts the response into voice audio.
5.  **PSTN Playback**: Sharyx sends the audio back to Twilio, and the user hears the AI on their phone.

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
    ```

3.  **Expose your local server**:
    Use Ngrok to create a public URL:
    ```bash
    ngrok http 8080
    ```

4.  **Configure Twilio**:
    Go to your Twilio console and set the **Incoming Call Webhook** to:
    `https://your-ngrok-url.ngrok.io/twiml`

5.  **Run the server**:
    ```bash
    npm start
    ```

---

## 📄 License
MIT © 2026 Sharyx
