export interface LiveSttConnection {
  send(audio: Buffer): void;
  finish(): void;
  getReadyState(): number;
  addListener(event: string, callback: (...args: any[]) => void): void;
}

export enum LiveTranscriptionEvents {
  Transcript = 'transcript',
  SpeechStarted = 'speech_started',
  Error = 'error',
  Close = 'close',
}

export interface SttOptions {
  model?: string;
  language?: string;
  apiKey?: string;
  encoding?: string;
  sampleRate?: number;
}

export interface SttProvider {
  createLiveConnection(options?: SttOptions): LiveSttConnection;
}
