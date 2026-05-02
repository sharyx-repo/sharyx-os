import { VoiceAgent } from './voice-agent';
import { SimpleAgentConfig, VoiceAgentConfig } from './types';
import { DEFAULT_CONFIG } from './defaults';
import { OpenAILLM } from '../llm/openai';
import { GeminiLLM } from '../llm/gemini';
import { AnthropicLLM } from '../llm/anthropic';
import { GroqLLM } from '../llm/groq';
import { DeepgramSTT } from '../stt/deepgram';
import { ElevenLabsTTS } from '../tts/elevenlabs';
import { CartesiaTTS } from '../tts/cartesia';
import { GoogleCloudTTS } from '../tts/google';
import { MockLLM } from '../llm/mock-llm';
import { MockSTT } from '../stt/mock-stt';
import { MockTTS } from '../tts/mock-tts';
import { LlmProvider } from '../interfaces/llm';
import { SttProvider } from '../interfaces/stt';
import { TtsProvider } from '../interfaces/tts';

/**
 * Simplified factory to create a Voice Agent with minimal configuration.
 */
export function createAgent(config: SimpleAgentConfig = {}): VoiceAgent {
    const resolved = resolveProviders(config);

    const agentConfig: VoiceAgentConfig = {
        stt: resolved.stt,
        llm: resolved.llm,
        tts: resolved.tts,
        systemPrompt: config.systemPrompt || 'You are a helpful voice assistant.',
        firstMessage: config.firstMessage,
        tools: config.tools,
        config: {
            ...DEFAULT_CONFIG,
            ...config.config,
        },
    };

    const agent = new VoiceAgent(agentConfig);
    
    const llmName = (resolved.llm as any).constructor.name;
    const ttsName = (resolved.tts as any).constructor.name;
    const sttName = (resolved.stt as any).constructor.name;
    
    console.log(`[Sharyx] 🤖 Agent initialized with: ${llmName} (LLM), ${sttName} (STT), ${ttsName} (TTS)`);
    
    return agent;
}

function resolveProviders(config: SimpleAgentConfig) {
    // LLM Resolution: config.apiKey > config.llm.apiKey > process.env.OPENAI_API_KEY
    let llm: LlmProvider;
    
    const llmOptions = config.llm as { apiKey?: string; provider?: string; model?: string };
    const apiKey = config.apiKey || llmOptions?.apiKey || process.env.OPENAI_API_KEY;
    const model = llmOptions?.model || config.model;

    if (config.llm && typeof (config.llm as any).chat === 'function') {
        llm = config.llm as LlmProvider;
    } else if (apiKey) {
        const provider = llmOptions?.provider || 'openai';
        if (provider === 'openai') {
            llm = new OpenAILLM({ apiKey, model: model || 'gpt-4o-mini' });
        } else if (provider === 'gemini') {
            llm = new GeminiLLM({ apiKey, model: model });
        } else if (provider === 'anthropic') {
            llm = new AnthropicLLM({ apiKey, model: model || 'claude-3-5-sonnet-20241022' });
        } else if (provider === 'groq') {
            llm = new GroqLLM({ apiKey, model: model || 'llama-3.3-70b-versatile' });
        } else {
            llm = new OpenAILLM({ apiKey, model: model || 'gpt-4o-mini' });
        }
    } else {
        // Zero-config: No key found anywhere
        console.warn(`[Sharyx] ⚠️ No API key found. Falling back to Mock Mode (offline).`);
        console.warn(`         To use real AI, set OPENAI_API_KEY in your .env or pass it to createAgent().`);
        llm = new MockLLM();
    }

    // STT Resolution
    let stt: SttProvider;
    if (config.stt && typeof (config.stt as any).createLiveConnection === 'function') {
        stt = config.stt as SttProvider;
    } else {
        const sttOptions = config.stt as { apiKey: string, provider?: string };
        const apiKey = sttOptions?.apiKey || process.env.DEEPGRAM_API_KEY;

        if (apiKey) {
            stt = new DeepgramSTT({ apiKey });
        } else {
            stt = new MockSTT();
        }
    }

    // TTS Resolution
    let tts: TtsProvider;
    if (config.tts && typeof (config.tts as any).streamSpeech === 'function') {
        tts = config.tts as TtsProvider;
    } else {
        const ttsOptions = config.tts as { apiKey: string, provider?: string };
        const provider = ttsOptions?.provider;
        const ttsApiKey = ttsOptions?.apiKey;

        if (provider === 'cartesia' && ttsApiKey) {
            tts = new CartesiaTTS({ apiKey: ttsApiKey, voiceId: config.voice });
        } else if (provider === 'elevenlabs' && ttsApiKey) {
            tts = new ElevenLabsTTS({ apiKey: ttsApiKey, voiceId: config.voice });
        } else if (provider === 'googlecloud') {
            tts = new GoogleCloudTTS({ apiKey: ttsApiKey, voiceId: config.voice });
        } else if (process.env.CARTESIA_API_KEY) {
            tts = new CartesiaTTS({ apiKey: process.env.CARTESIA_API_KEY, voiceId: config.voice });
        } else if (ttsApiKey || process.env.ELEVENLABS_API_KEY) {
            tts = new ElevenLabsTTS({ apiKey: ttsApiKey || process.env.ELEVENLABS_API_KEY!, voiceId: config.voice });
        } else {
            tts = new MockTTS();
        }
    }

    return { stt, llm, tts };
}
