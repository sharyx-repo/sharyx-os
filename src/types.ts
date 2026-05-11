/**
 * Sharyx OS Shared Type Definitions
 */

export type ConversationState = 
  | 'IDLE' 
  | 'LISTENING' 
  | 'TRANSCRIBING' 
  | 'THINKING' 
  | 'SPEAKING';

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: Role;
  content: string;
  id?: string;
  timestamp?: number;
  tool_call_id?: string;
  name?: string;
}

export interface AudioFrame {
  data: Buffer;
  timestamp: number;
}

/**
 * Provider-agnostic STT interface
 */
export interface ISTTProvider {
  /**
   * Start transcribing an audio stream
   * @param onTranscript Callback for partial/final transcripts
   */
  start(onTranscript: (text: string, isFinal: boolean) => void): Promise<void>;
  
  /**
   * Send audio data to the provider
   * @param audio Buffer containing raw audio data
   */
  sendAudio(audio: Buffer): void;
  
  /**
   * Stop transcription and cleanup resources
   */
  stop(): Promise<void>;
}

/**
 * Provider-agnostic LLM interface
 */
export interface ILLMProvider {
  /**
   * Generate a completion for a list of messages
   * @param messages List of conversation messages
   * @param options Completion options (temperature, tools, etc.)
   */
  generate(messages: Message[], options?: unknown): AsyncIterable<string>;
}

/**
 * Provider-agnostic TTS interface
 */
export interface ITTSProvider {
  /**
   * Synthesize text into audio stream
   * @param text The sentence to synthesize
   * @param onAudio Callback for audio frames
   */
  synthesize(text: string, onAudio: (frame: AudioFrame) => void): Promise<void>;
  
  /**
   * Interrupt current playback and flush buffers
   */
  interrupt(): Promise<void>;
}

import { IMemoryStore } from './memory/IMemoryStore';

/**
 * Transport interface for audio I/O
 */
export interface ITransport {
  /**
   * Start the transport
   * @param onAudio Callback for incoming audio from user
   */
  start(onAudio: (audio: Buffer) => void): Promise<void>;
  
  /**
   * Send audio to the user
   */
  sendAudio(audio: Buffer): void;
  
  /**
   * Stop the transport
   */
  stop(): Promise<void>;
  
  /**
   * Event for when user starts speaking (barge-in)
   */
  onBargeIn?(callback: () => void): void;
}

/**
 * Orchestration configuration
 */
export interface AgentConfig {
  stt: ISTTProvider;
  llm: ILLMProvider;
  tts: ITTSProvider;
  memory: IMemoryStore;
  systemPrompt: string;
  tools?: unknown[];
  maxToolDepth?: number;
  maxToolTimeout?: number;
}
