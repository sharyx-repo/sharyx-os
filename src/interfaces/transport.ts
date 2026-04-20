import { EventEmitter } from 'events';

export interface VoiceTransport extends EventEmitter {
  /**
   * Send TTS audio chunk to the caller.
   */
  sendAudio(payload: string | Buffer): void;

  /**
   * Signal the start of TTS playback.
   */
  sendStart(): void;

  /**
   * Clear any queued audio (for barge-in).
   */
  sendClear(): void;

  /**
   * Send a named mark for flow control.
   */
  sendMark(name: string): void;

  /**
   * Hang up the call.
   */
  hangup(): void;

  /**
   * Send any arbitrary message (e.g., partial transcripts for web).
   */
  sendMessage?(event: string, data: any): void;

  /**
   * Close the transport.
   */
  close(code?: number, reason?: string): void;

  /**
   * Events: 'audio' | 'close' | 'mark' | 'interrupt'
   */
}

export interface CallMetadata {
  from?: string;
  to?: string;
  direction?: 'inbound' | 'outbound';
  sampleRate?: number;
  encoding?: string;
  [key: string]: any;
}
