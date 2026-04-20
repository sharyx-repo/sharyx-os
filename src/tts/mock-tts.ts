import { TtsProvider, TtsOptions } from '../interfaces/tts';

/**
 * A mock TTS provider for offline testing.
 * Returns empty/silent buffers.
 */
export class MockTTS implements TtsProvider {
  async *streamSpeech(text: string, options?: TtsOptions): AsyncIterable<Buffer> {
    // Mock: Simply yield a single silent chunk of data
    yield Buffer.alloc(0);
  }
}
