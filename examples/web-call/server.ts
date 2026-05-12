import 'dotenv/config';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { 
  VoicePipeline, 
  WebRTCTransport, 
  DeepgramSTT, 
  OpenAILLM, 
  CartesiaTTS, 
  InMemoryStore 
} from '../../src';
import path from 'path';
import { createClient } from 'redis';
import type { ILLMProvider, ITTSProvider } from '../../src/types';

const app = express();
const port = process.env.PORT || 3000;

// --- REDIS STORAGE ---
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('❌ Redis Client Error', err));

const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('✅ Connected to Redis');
  } catch (err) {
    console.error('❌ Failed to connect to Redis', err);
  }
};
connectRedis();

const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 6)}`;

// ------------------------------------------------------------------
// Provider Factories — reads LLM_PROVIDER / TTS_PROVIDER from .env
// ------------------------------------------------------------------

/**
 * Instantiate the configured LLM provider.
 * Set LLM_PROVIDER=openai (default) or LLM_PROVIDER=gemini in your .env
 */
async function createLLM(): Promise<ILLMProvider> {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

  switch (provider) {
    case 'openai': {
      if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
      return new OpenAILLM({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      });
    }
    case 'gemini': {
      if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini');
      // Dynamic import — only loads the Gemini SDK when needed
      const { GeminiLLM } = await import('../../src');
      return new GeminiLLM({
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      });
    }
    default:
      throw new Error(`Unknown LLM_PROVIDER "${provider}". Supported: openai, gemini`);
  }
}

/**
 * Instantiate the configured STT provider.
 */
async function createSTT(): Promise<any> {
  const provider = (process.env.STT_PROVIDER || 'deepgram').toLowerCase();

  switch (provider) {
    case 'deepgram': {
      if (!process.env.DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY is required when STT_PROVIDER=deepgram');
      return new DeepgramSTT({
        apiKey: process.env.DEEPGRAM_API_KEY,
        model: process.env.DEEPGRAM_MODEL || 'nova-2',
      });
    }
    default:
      throw new Error(`Unknown STT_PROVIDER "${provider}". Supported: deepgram`);
  }
}

/**
 * Instantiate the configured TTS provider.
 * Set TTS_PROVIDER=cartesia (default) or TTS_PROVIDER=elevenlabs in your .env
 */
async function createTTS(): Promise<ITTSProvider> {
  const provider = (process.env.TTS_PROVIDER || 'cartesia').toLowerCase();

  switch (provider) {
    case 'cartesia': {
      if (!process.env.CARTESIA_API_KEY) throw new Error('CARTESIA_API_KEY is required when TTS_PROVIDER=cartesia');
      return new CartesiaTTS({
        apiKey: process.env.CARTESIA_API_KEY,
        voiceId: process.env.CARTESIA_VOICE_ID,
        modelId: process.env.CARTESIA_MODEL,
      });
    }
    case 'elevenlabs': {
      if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is required when TTS_PROVIDER=elevenlabs');
      // Dynamic import — only loads the ElevenLabs SDK when needed
      const { ElevenLabsTTS } = await import('../../src');
      return new ElevenLabsTTS({
        apiKey: process.env.ELEVENLABS_API_KEY,
        voiceId: process.env.ELEVENLABS_VOICE_ID,
        modelId: process.env.ELEVENLABS_MODEL,
      });
    }
    default:
      throw new Error(`Unknown TTS_PROVIDER "${provider}". Supported: cartesia, elevenlabs`);
  }
}

// ------------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------------
async function main() {
  // Build providers from env
  const llm = await createLLM();
  const stt = await createSTT();
  const tts = await createTTS();

  console.log(`🤖 LLM provider : ${process.env.LLM_PROVIDER || 'openai'}`);
  console.log(`🎤 STT provider : ${process.env.STT_PROVIDER || 'deepgram'}`);
  console.log(`🔊 TTS provider : ${process.env.TTS_PROVIDER || 'cartesia'}`);

  const agentConfig = {
    stt,
    llm,
    tts,
    memory: new InMemoryStore(), // For the demo, we use InMemory. RedisMemoryStore is also available.
    systemPrompt: `You are Sharyx Web Assistant, a clear and concise guide for Sharyx SDK developers.
  Handle understood topics (understanding, integration, troubleshooting) directly; ask for clarification on vague queries.
  Break technical explanations into steps with production-ready code examples and brief explanations.
  Use common terms first; highlight best practices and common pitfalls.
  Be professional yet approachable; match the user's emoji usage; avoid flattery or filler.
  Assume users are beginners unless stated; be factual and aligned with Sharyx SDK capabilities.`,
    firstMessage: 'Welcome to the Sharyx Web Demo! I am listening. How can I help you?'
  };

  // Serve the frontend
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  const server = app.listen(port, () => {
    console.log(`🚀 Sharyx Web Demo running at http://localhost:${port}`);
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    const sessionId = generateId('sid');
    const userId = generateId('user');

    console.log(`🔌 New WebCall session: ${sessionId}`);

    // 1. Create Transport
    const transport = new WebRTCTransport(ws);

    // 2. Create Pipeline
    const pipeline = new VoicePipeline(agentConfig, transport, sessionId);

    // 3. Start Agent
    pipeline.start().catch(console.error);

    ws.on('close', async () => {
      console.log(`🔌 Session ${sessionId} ended.`);
      await pipeline.stop();
    });
  });
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});