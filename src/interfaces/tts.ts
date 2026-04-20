export interface TtsOptions {
  voiceId?: string;
  model?: string;
  apiKey?: string;
  speed?: number;
  sampleRate?: number;
  encoding?: string;
}

export interface LiveTtsConnection {
  sendText(text: string, isFinal: boolean, contextId?: string): void;
  onAudio(callback: (chunk: Buffer, contextId?: string) => void): void;
  onCompletion(callback: (contextId?: string) => void): void;
  onError(callback: (err: any) => void): void;
  close(): void;
}

export interface TtsProvider {
  /**
   * Stream speech from text (Sentence-based).
   */
  streamSpeech(text: string, options?: TtsOptions): AsyncIterable<Buffer>;

  /**
   * Create a live real-time connection for token-by-token streaming.
   */
  createLiveConnection?(options?: TtsOptions): LiveTtsConnection;
}
