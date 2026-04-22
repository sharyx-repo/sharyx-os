import { SessionConfig } from './types';

export const DEFAULT_CONFIG: Required<SessionConfig> = {
  // Interruption
  interruption_mode: 'interrupt',     // 'interrupt' | 'ignore' | 'append'
  interruption_threshold: 3,          // Increased to 3 words for production stability
  interruption_min_duration: 200,     // ms of speech before interrupt allowed
  interruption_cooldown: 1200,        // Increased to 1200ms to better suppress initial echo

  // Silence
  silence_notify_ms: 10000,           // 10s before "are you there?"
  silence_timeout_ms: 20000,          // 20s total before hangup
  silence_max_tries: 2,
  silence_idle_messages: [
    "I can't hear you. Are you still on the call?",
    "Are you saying something?",
  ],
  silence_timeout_message: "Since I can't hear you, I'll disconnect now.",

  // Memory
  history_limit: 6,                   // Last N messages in context
  memory_extraction: true,            // Auto-extract name, phone, etc.
  summarization: true,                // Summarize long conversations

  // Audio configuration is handled by the STT/TTS providers
};
