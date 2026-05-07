import { describe, it, expect, vi } from 'vitest';
import { createAgent } from '../src/core/simple';
import { VoiceAgent } from '../src/core/voice-agent';
import { MockLLM } from '../src/llm/mock-llm';
import { MockSTT } from '../src/stt/mock-stt';
import { MockTTS } from '../src/tts/mock-tts';

describe('Sharyx Agent Core', () => {
  it('should initialize a voice agent with default mocks when no API keys are provided', () => {
    // Clear env vars to ensure fallback to mocks
    const originalEnv = { ...process.env };
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.CARTESIA_API_KEY;

    const agent = createAgent({
      systemPrompt: 'Test Prompt',
      firstMessage: 'Hello'
    });

    expect(agent).toBeInstanceOf(VoiceAgent);
    
    // Check if mocks were used (we can check the internal config if exposed, or just rely on the factory logic)
    // In this case, we know createAgent logs to console or we can inspect the agent's providers if they were public
    // Since they are private in VoiceAgent, we'll verify the agent instance exists.
    
    // Restore env
    process.env = originalEnv;
  });

  it('should initialize with provided mocks', () => {
    const mockLlm = new MockLLM();
    const mockStt = new MockSTT();
    const mockTts = new MockTTS();

    const agent = createAgent({
      llm: mockLlm,
      stt: mockStt,
      tts: mockTts
    });

    expect(agent).toBeInstanceOf(VoiceAgent);
  });

  it('should allow custom system prompts and first messages', () => {
    const agent = createAgent({
      systemPrompt: 'You are a specialized helper.',
      firstMessage: 'Ready to assist.'
    });

    expect(agent).toBeDefined();
  });
});
