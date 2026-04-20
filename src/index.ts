/**
 * Sharyx Voice Agent SDK
 * Build AI voice agents in 5 lines of code.
 */

// === TIER 1: Simple API (what 90% of people use) ===
export { createAgent } from './core/simple';

// === TIER 2: Advanced API (power users) ===
export { VoiceAgent } from './core/voice-agent';
export { VoiceOrchestrator } from './providers/orchestrator/voice-orchestrator';
export { TelephonyService, TelephonyControllers } from './core/telephony-system';

// === Built-in Providers (no extra installs) ===
export { DeepgramSTT } from './stt/deepgram';
export { OpenAILLM } from './llm/openai';
export { GeminiLLM } from './llm/gemini';
export { ElevenLabsTTS } from './tts/elevenlabs';
export { CartesiaTTS } from './tts/cartesia';

// === Telephony Adapters ===
export { TwilioAdapter } from './adapters/twilio';
export { PlivoAdapter } from './adapters/plivo';
export { WebCallAdapter } from './adapters/webcall';
export { TelephonyManager } from './adapters/telephony-manager';

// === Agent Brain & Workflows ===
export { IntentDetector } from './providers/orchestrator/intent-detector';

// === Business Tools & Integrations ===
export { googleCalendarTools } from './tools/google-calendar';
export { hubspotTools } from './tools/hubspot-crm';

// === Notification Channels ===
export { WhatsAppChannel } from './channels/whatsapp-channel';

// === Observability & Telemetry ===
export { EvalLogger } from './utils/eval-logger';
export { SharyxTelemetry } from './utils/telemetry';
export type { TelemetryProvider, MetricEvent, ErrorEvent } from './interfaces/telemetry';

// === Mocks (for testing) ===
export { MockLLM } from './llm/mock-llm';
export { MockSTT } from './stt/mock-stt';
export { MockTTS } from './tts/mock-tts';

// === Memory & Persistence ===
export { InMemoryMemoryStore } from './memory/memory-store';
export { RedisMemoryStore } from './memory/redis-store';

// === Interfaces (for writing custom providers) ===
export type { SttProvider, LiveSttConnection, SttOptions } from './interfaces/stt';
export type { LlmProvider, ChatMessage, LlmChunk, LlmOptions } from './interfaces/llm';
export type { TtsProvider, TtsOptions } from './interfaces/tts';
export type { TelephonyAdapter } from './interfaces/adapter';
export type { VoiceTransport, CallMetadata } from './interfaces/transport';
export type { MemoryStore, CallSession, MemoryMessage } from './interfaces/memory';

// === Types ===
export type {
  SimpleAgentConfig,
  VoiceAgentConfig,
  SessionConfig,
  SimulateResult,
} from './core/types';

export type {
  SimpleTool,
  ToolParam
} from './tools/types';
