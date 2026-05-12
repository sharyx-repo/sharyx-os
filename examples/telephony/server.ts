import 'dotenv/config';
import express from 'express';
import path from 'path';
import { WebSocketServer } from 'ws';
import { 
  VoicePipeline, 
  TwilioTransport, 
  DeepgramSTT, 
  OpenAILLM, 
  CartesiaTTS, 
  InMemoryStore,
  validateTwilioSignature
} from '../../src';
import { createClient } from 'redis';

const app = express();
const port = process.env.PORT || 8080;

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

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const agentConfig = {
  stt: new DeepgramSTT({ apiKey: process.env.DEEPGRAM_API_KEY! }),
  llm: new OpenAILLM({ apiKey: process.env.OPENAI_API_KEY! }),
  tts: new CartesiaTTS({ apiKey: process.env.CARTESIA_API_KEY! }),
  memory: new InMemoryStore(),
  systemPrompt: 'You are a professional receptionist for Sharyx Voice Labs. Handle incoming calls politely.',
};

// Twilio TwiML Endpoint
app.post('/twilio/twiml', (req, res) => {
  res.type('text/xml');
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const streamUrl = `wss://${host}/media-stream`;
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="${streamUrl}" />
      </Connect>
    </Response>`;
  
  res.send(twiml);
});

const server = app.listen(port, () => {
    console.log(`📞 Sharyx Telephony Receiver running on port ${port}`);
});

const wss = new WebSocketServer({ server, path: '/media-stream' });

wss.on('connection', (ws: any) => {
    console.log('🤖 New Twilio Media Stream connection');
    
    const transport = new TwilioTransport(ws);
    const pipeline = new VoicePipeline(agentConfig, transport);
    
    pipeline.start().catch(console.error);

    ws.on('close', async () => {
        console.log('🔌 Telephony Session ended.');
        await pipeline.stop();
    });
});
