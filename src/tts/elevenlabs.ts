import { ITTSProvider, AudioFrame } from '../types';

/**
 * ElevenLabs TTS Provider.
 */
export class ElevenLabsTTS implements ITTSProvider {
  private sdk: any;
  private currentStream: any;

  constructor(private config: { apiKey: string, voiceId?: string, modelId?: string }) {}

  private async getSDK() {
    if (!this.sdk) {
      try {
        // @ts-ignore
        const { ElevenLabsClient } = await import('elevenlabs');
        this.sdk = new ElevenLabsClient({ apiKey: this.config.apiKey });
      } catch (err) {
        throw new Error('ElevenLabs SDK not found. Install it with: npm install elevenlabs');
      }
    }
    return this.sdk;
  }

  public async synthesize(text: string, onAudio: (frame: AudioFrame) => void): Promise<void> {
    console.info(`[ElevenLabs] 🎙️ Synthesizing: "${text}"`);
    const elevenlabs = await this.getSDK();
    const voiceId = this.config.voiceId || 'JBFucSot9Snd9hQU9nzV';
    const modelId = this.config.modelId || 'eleven_multilingual_v2'; 

    console.debug(`[ElevenLabs] Requesting TTS - Voice: ${voiceId}, Model: ${modelId}`);

    try {
      this.currentStream = await elevenlabs.generate({
        stream: true,
        voice: voiceId,
        text: text,
        model_id: modelId,
        output_format: 'pcm_16000'
      });

      let chunkCount = 0;
      for await (const chunk of this.currentStream) {
        if (chunk && this.currentStream) {
          chunkCount++;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any);
          
          if (chunkCount === 1) {
            // Debug: Check for MP3 headers (ID3 or sync frame)
            const isMp3 = buffer.slice(0, 3).toString() === 'ID3' || (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0);
            if (isMp3) {
              console.warn('[ElevenLabs] ⚠️ Warning: Received MP3 data instead of PCM! This will sound like static.');
            }
            console.debug(`[ElevenLabs] First chunk size: ${buffer.length} bytes. Header: ${buffer.slice(0, 4).toString('hex')}`);
          }

          onAudio({
            data: buffer,
            timestamp: Date.now()
          });
        }
      }
      console.info(`[ElevenLabs] ✅ Synthesis complete. Sent ${chunkCount} chunks.`);
    } catch (error) {
      console.error('[ElevenLabs] ❌ Synthesis error:', error);
    } finally {
      this.currentStream = null;
    }
  }

  public async interrupt(): Promise<void> {
    // ElevenLabs SDK streaming doesn't have a direct "stop" on the async iterator,
    // but we clear the reference to signal we are done.
    this.currentStream = null;
  }
}
