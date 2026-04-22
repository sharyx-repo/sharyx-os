import 'dotenv/config';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createAgent, WebCallAdapter } from '../../src';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

// --- IN-MEMORY STORAGE ---
const sessionStore = new Map<string, any>();
const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 6)}`;
// -------------------------

// 1. Initialize Sharyx Agent
const agent = createAgent({
  apiKey: process.env.OPENAI_API_KEY,
  stt: { apiKey: process.env.DEEPGRAM_API_KEY!, provider: 'deepgram' },
  tts: { apiKey: process.env.CARTESIA_API_KEY!, provider: 'cartesia' },
  systemPrompt: `You are Sharyx Web Assistant, a clear and concise guide for Sharyx SDK developers.
  Handle understood topics (understanding, integration, troubleshooting) directly; ask for clarification on vague queries.
  Break technical explanations into steps with production-ready code examples and brief explanations.
  Use common terms first; highlight best practices and common pitfalls.
  Be professional yet approachable; match the user's emoji usage; avoid flattery or filler.
  Assume users are beginners unless stated; be factual and aligned with Sharyx SDK capabilities.`,
  firstMessage: 'Welcome to the Sharyx Web Demo! I am listening. How can I help you?'
});

// 2. Initialize WebCall Adapter
const webcall = new WebCallAdapter();
agent.use(webcall);

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(port, () => {
  console.log(`🚀 Sharyx Web Demo running at http://localhost:${port}`);
});

// 3. Setup WebSocket Server for Audio Streaming
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  const sessionId = generateId('sid');
  const userId = generateId('user');
  
  console.log(`🔌 New WebCall session: ${sessionId} (User: ${userId})`);
  
  // Send IDs to the client immediately
  ws.send(JSON.stringify({ 
    event: 'session_info', 
    payload: { sessionId, userId } 
  }));

  // Track state to capture the final transcript and metrics
  let finalTranscript = '';
  let finalMetrics = {};

  // Intercept messages to build the local transcript
  const originalSend = ws.send.bind(ws);
  ws.send = (data: any) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.event === 'transcript' && msg.payload.role === 'agent' && msg.payload.final) {
        finalTranscript += `\nAssistant: ${msg.payload.text}`;
      } else if (msg.event === 'transcript' && msg.payload.role === 'user' && msg.payload.final) {
        finalTranscript += `\nUser: ${msg.payload.text}`;
      } else if (msg.event === 'metrics') {
        finalMetrics = msg.payload;
      }
    } catch(e) {}
    return originalSend(data);
  };

  webcall.handleWebSocket(ws);

  ws.on('close', () => {
    console.log(`🔌 Session ${sessionId} ended. Saving to memory...`);
    
    // "Save" to in-memory store
    sessionStore.set(sessionId, {
      userId,
      timestamp: new Date().toISOString(),
      transcript: finalTranscript.trim() || 'No conversation recorded.',
      metrics: finalMetrics
    });

    console.log('--- SAVED SESSION ---');
    console.log(sessionStore.get(sessionId));
    console.log('----------------------');
  });
});