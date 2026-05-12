import { ISTTProvider } from '../types';

/**
 * Deepgram STT Provider implementation (v5 SDK)
 * 
 * The v5 SDK lifecycle is:
 *   1. deepgram.listen.v1.connect(options)  — creates the socket (closed)
 *   2. socket.on('open' | 'message' | ...)  — register handlers
 *   3. socket.connect()                     — actually opens the WebSocket
 *   4. socket.waitForOpen()                 — resolves once the WS is open
 *   5. socket.sendMedia(buffer)             — send audio
 *   6. socket.close()                       — tear down
 */
export class DeepgramSTT implements ISTTProvider {
  private sdk: any;
  private connection: any;
  private isReady: boolean = false;

  constructor(private config: { apiKey: string, model?: string }) {}

  private async getSDK() {
    if (!this.sdk) {
      try {
        const { DeepgramClient } = await import('@deepgram/sdk');
        this.sdk = new DeepgramClient({ apiKey: this.config.apiKey });
      } catch (err) {
        throw new Error('Deepgram SDK not found. Install it with: npm install @deepgram/sdk');
      }
    }
    return this.sdk;
  }

  public async start(onTranscript: (text: string, isFinal: boolean) => void): Promise<void> {
    const deepgram = await this.getSDK();

    console.info('[Deepgram] Creating live connection...');

    // Step 1: Create the socket (starts closed)
    this.connection = await deepgram.listen.v1.connect({
      model: this.config.model || 'nova-2',
      smart_format: true,
      interim_results: true,
      encoding: 'linear16',
      sample_rate: 16000,
      endpointing: 200,
    });

    // Step 2: Register event handlers BEFORE opening
    this.connection.on('open', () => {
      this.isReady = true;
      console.info('[Deepgram] ✅ WebSocket OPEN — ready to receive audio');
    });

    this.connection.on('message', (data: any) => {
      if (data?.type === 'Results') {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (transcript && transcript.trim() !== '') {
          console.info(`[Deepgram] Transcript (is_final=${data.is_final}): "${transcript}"`);
          onTranscript(transcript, data.is_final);
        }
      }
    });

    this.connection.on('error', (err: any) => {
      console.error('[Deepgram] ❌ Error:', err);
    });

    this.connection.on('close', () => {
      console.info('[Deepgram] 🔌 Connection closed');
      this.isReady = false;
    });

    // Step 3: Actually open the WebSocket connection
    this.connection.connect();

    // Step 4: Wait for the socket to be open (with timeout)
    await Promise.race([
      this.connection.waitForOpen(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Deepgram connection timeout (10s)')), 10000)
      ),
    ]);

    console.info('[Deepgram] ✅ Ready for audio');
  }

  public sendAudio(audio: Buffer): void {
    if (this.isReady && this.connection) {
      this.connection.sendMedia(audio);
    }
  }

  public async stop(): Promise<void> {
    if (this.connection) {
      this.isReady = false;
      this.connection.close();
      this.connection = null;
    }
  }
}
