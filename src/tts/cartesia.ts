import { ITTSProvider, AudioFrame } from '../types';
import { EventEmitter } from 'events';

/**
 * Cartesia TTS Provider implementation
 */
export class CartesiaTTS implements ITTSProvider {
  private ws: any;
  private isReady: boolean = false;
  private emitter = new EventEmitter();

  constructor(private config: { apiKey: string; voiceId?: string; modelId?: string }) {}

  private async getWS(): Promise<any> {
    if (this.ws && this.ws.readyState === 1) return this.ws;

    const wsUrl = `wss://api.cartesia.ai/tts/websocket?api_key=${this.config.apiKey}&cartesia_version=2024-06-10`;
    // @ts-ignore
    const { WebSocket } = await import('ws');
    this.ws = new WebSocket(wsUrl);

    return new Promise((resolve) => {
      this.ws.on('open', () => {
        this.isReady = true;
        resolve(this.ws);
      });

      this.ws.on('message', (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'chunk') {
            const audioBuffer = Buffer.from(msg.data, 'base64');
            this.emitter.emit('audio', audioBuffer);
          } else if (msg.type === 'done') {
            this.emitter.emit('done');
          }
        } catch (e) {}
      });
    });
  }

  public async synthesize(text: string, onAudio: (frame: AudioFrame) => void): Promise<void> {
    console.info(`[Cartesia] 🎙️ Synthesizing: "${text}"`);
    const ws = await this.getWS();
    
    const handler = (data: Buffer) => {
      onAudio({ data, timestamp: Date.now() });
    };
    
    this.emitter.on('audio', handler);

    ws.send(JSON.stringify({
      type: 'generation',
      model_id: this.config.modelId || 'sonic-english',
      transcript: text,
      voice: {
        mode: 'id',
        id: this.config.voiceId || '694f9389-aac1-45b6-b726-9d9369183238'
      },
      output_format: {
        container: 'raw',
        encoding: 'pcm_s16le',
        sample_rate: 16000
      }
    }));

    // Wait for the 'done' message from Cartesia
    await new Promise<void>(resolve => {
      const timeout = setTimeout(resolve, 5000); // Safety timeout
      this.emitter.once('done', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.emitter.off('audio', handler);
  }

  public async interrupt(): Promise<void> {
    this.emitter.removeAllListeners('audio');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isReady = false;
    }
  }
}
