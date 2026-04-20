import { TtsProvider, TtsOptions, LiveTtsConnection } from '../interfaces/tts';
import { EventEmitter } from 'events';

/**
 * Cartesia TTS Provider.
 * Supports both REST-based speech generation and Real-time WebSocket streaming.
 */
export class CartesiaTTS implements TtsProvider {
  constructor(private config: { apiKey: string, voiceId?: string }) {}

  createLiveConnection(options?: TtsOptions): LiveTtsConnection {
    const emitter = new EventEmitter();
    const voiceId = options?.voiceId || this.config.voiceId || '694f9389-aac1-45b6-b726-9d9369183238';
    const sampleRate = options?.sampleRate || 16000;
    
    // Cartesia WS URL
    const wsUrl = `wss://api.cartesia.ai/tts/websocket?api_key=${this.config.apiKey}&cartesia_version=2024-06-10`;
    
    // @ts-ignore
    const WebSocket = require('ws');
    const ws = new WebSocket(wsUrl);

    let isReady = false;

    ws.on('open', () => {
        isReady = true;
        console.log('[CartesiaTTS] ✅ WebSocket connection opened');
    });

    ws.on('message', (data: any) => {
        try {
            const msg = JSON.parse(data.toString());
            
            if (msg.type === 'chunk') {
                // Audio data is base64 encoded in 'data' field
                const audioBuffer = Buffer.from(msg.data, 'base64');
                emitter.emit('audio', audioBuffer, msg.context_id);
            } else if (msg.type === 'error') {
                console.error('[CartesiaTTS] WS Error:', msg.error);
            } else if (msg.type === 'done') {
                emitter.emit('completion', msg.context_id);
            }
        } catch (err) {
            // If parsing fails, it might be raw binary (though Sony usually sends JSON)
            if (Buffer.isBuffer(data)) {
                emitter.emit('audio', data);
            }
        }
    });

    ws.on('error', (err: any) => {
        console.error('[CartesiaTTS] WS Transport Error:', err);
    });

    ws.on('close', () => {
        console.log('[CartesiaTTS] ✅ WebSocket connection closed');
    });

    return {
        sendText: (text: string, isFinal: boolean, contextId?: string) => {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({
                    type: 'generation',
                    context_id: contextId || 'default',
                    model_id: options?.model || 'sonic-english',
                    transcript: text,
                    continue: !isFinal,
                    voice: {
                        mode: 'id',
                        id: voiceId
                    },
                    output_format: {
                        container: 'raw',
                        encoding: 'pcm_s16le',
                        sample_rate: sampleRate
                    }
                }));
            }
        },
        onAudio: (callback: (chunk: Buffer, contextId?: string) => void) => {
            emitter.on('audio', (chunk, ctx) => callback(chunk, ctx));
        },
        onCompletion: (callback: (contextId?: string) => void) => {
            emitter.on('completion', callback);
        },
        onError: (callback: (err: any) => void) => {
            emitter.on('error', callback);
        },
        close: () => {
            if (ws.readyState === 1 || ws.readyState === 0) {
                ws.close();
            }
        }
    };
  }

  async *streamSpeech(text: string, options?: TtsOptions): AsyncIterable<Buffer> {
    const voiceId = options?.voiceId || this.config.voiceId || '694f9389-aac1-45b6-b726-9d9369183238';
    const sampleRate = options?.sampleRate || 16000;
    
    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: {
            'X-API-Key': this.config.apiKey,
            'Cartesia-Version': '2024-06-10',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model_id: options?.model || 'sonic-english',
            transcript: text,
            voice: {
                mode: 'id',
                id: voiceId
            },
            output_format: {
                container: 'raw',
                encoding: 'pcm_s16le',
                sample_rate: sampleRate
            }
        })
    });

    if (!response.ok || !response.body) {
        const errorBody = await response.text();
        throw new Error(`Cartesia HTTP error: ${response.status} - ${errorBody}`);
    }

    const reader = response.body.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) yield Buffer.from(value);
        }
    } finally {
        reader.releaseLock();
    }
  }
}
