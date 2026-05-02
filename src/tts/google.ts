import { TtsProvider, TtsOptions } from '../interfaces/tts';

/**
 * Google Cloud Text-to-Speech Provider.
 */
export class GoogleCloudTTS implements TtsProvider {
  private sdk: any;

  constructor(private config: { apiKey?: string; voiceId?: string }) {}

  private async getSDK() {
    if (!this.sdk) {
      try {
        // @ts-ignore
        const { TextToSpeechClient } = await import('@google-cloud/text-to-speech');
        
        // Use apiKey if provided, otherwise the SDK relies on GOOGLE_APPLICATION_CREDENTIALS automatically
        if (this.config.apiKey) {
            this.sdk = new TextToSpeechClient({ apiKey: this.config.apiKey });
        } else {
            this.sdk = new TextToSpeechClient();
        }
      } catch (err) {
        throw new Error('Google Cloud TTS SDK not found. Install it with: npm install @google-cloud/text-to-speech');
      }
    }
    return this.sdk;
  }

  async *streamSpeech(text: string, options?: TtsOptions): AsyncIterable<Buffer> {
    const client = await this.getSDK();

    const voiceName = options?.voiceId || this.config.voiceId || 'en-US-Journey-F';
    // Assume en-US language based on voice name for simplicity, 
    // real implementation might split the voice name correctly (e.g. 'en-US').
    const languageCode = voiceName.split('-').slice(0, 2).join('-');

    const request = {
      input: { text },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding: 'MP3' },
    };

    try {
        const [response] = await client.synthesizeSpeech(request);
        if (response.audioContent) {
            // Depending on the Node.js version, it's either a Buffer or a Uint8Array. 
            // We ensure it gets buffered correctly.
            yield Buffer.from(response.audioContent);
        }
    } catch (err) {
        console.error(`[GoogleCloudTTS] Error synthesizing speech:`, err);
    }
  }
}
