import { EventEmitter } from 'events';
import { VoiceAgent } from '../core/voice-agent';
import { TelephonyAdapter } from '../interfaces/adapter';
import { VoiceTransport, CallMetadata } from '../interfaces/transport';
import { WebSocket } from 'ws';

export class PlivoAdapter implements TelephonyAdapter {
  public readonly name = 'plivo';
  private agent?: VoiceAgent;

  register(agent: VoiceAgent): void {
    this.agent = agent;
  }

  setupRoutes(app: any): void {
    /**
     * Plivo XML Endpoint for Answer Callbacks
     */
    app.post('/plivo/xml', (req: any, res: any) => {
      console.log(`📥 Plivo XML Request Headers:`, JSON.stringify(req.headers, null, 2));
      res.type('text/xml');
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      let streamUrl = process.env.PLIVO_MEDIA_STREAM_URL || `wss://${host}/plivo-stream`;
      
      if (process.env.WS_SHARED_SECRET) {
        const separator = streamUrl.includes('?') ? '&' : '?';
        streamUrl += `${separator}token=${process.env.WS_SHARED_SECRET}`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true" sampleRate="8000" encoding="l16">${streamUrl}</Stream>
    <Wait length="3600" />
</Response>`.trim();
      
      console.log(`✉️ Sending Plivo XML to ${host}:\n${xml}`);
      res.send(xml);
    });
  }

  /**
   * Bridges Plivo WebSocket messages to Sharyx Pipeline
   */
  handleWebSocket(ws: WebSocket): void {
    if (!this.agent) throw new Error('PlivoAdapter not registered with an agent');

    console.log('☎️ Plivo Media Stream detected');
    let callSid: string;

    let audioBuffer = Buffer.alloc(0);
    const FRAME_SIZE = 320; // 20ms @ 8kHz 16-bit PCM

    const transport = new class extends EventEmitter implements VoiceTransport {
      sendAudio(payload: string | Buffer) {
        if (ws.readyState === ws.OPEN) {
          const newChunk = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'base64');
          audioBuffer = Buffer.concat([audioBuffer, newChunk]);

          // Drain the buffer in FRAME_SIZE increments
          while (audioBuffer.length >= FRAME_SIZE) {
            const frame = audioBuffer.subarray(0, FRAME_SIZE);
            audioBuffer = audioBuffer.subarray(FRAME_SIZE);

            const base64 = frame.toString('base64');
            
            ws.send(JSON.stringify({ 
              event: 'playAudio', 
              media: { 
                payload: base64,
                contentType: 'audio/x-l16',
                sampleRate: 8000
              }
            }));
          }
          
          if (Math.random() < 0.05) {
            console.log(`📤 Dispatched chunks (8kHz LE). Remaining buffer: ${audioBuffer.length} bytes. Target streamId: ${callSid}`);
          }
        } else {
          console.warn(`⚠️ Cannot send audio: WebSocket state is ${ws.readyState}`);
        }
      }
      sendStart() {}
      sendClear() { audioBuffer = Buffer.alloc(0); }
      sendMark(name: string) { /* Optional: Mark implementation */ }
      hangup() { ws.close(); }
      close() { ws.close(); }
    };

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log(`📥 Plivo Event: ${data.event}`);
        
        switch (data.event) {
          case 'start':
            console.log('📥 Plivo Start Data:', JSON.stringify(data, null, 2));
            callSid = data.streamId || data.start?.streamId || data.start?.callId || data.start?.callUuid || data.callId || data.callUuid;
            if (this.agent) {
              // Standard telephony: 8kHz Mu-Law
              this.agent.handleSession(transport, { 
                callSid,
                sampleRate: 8000,
                encoding: 'pcm_s16le'
              });
            }
            break;
          case 'media':
            if (data.media?.payload) {
              if (Math.random() < 0.01) { // Log occasionally to avoid spam
                console.log(`📥 Inbound media payload length: ${data.media.payload.length}`);
              }
              transport.emit('audio', { payload: data.media.payload });
            } else if (data.payload) {
              if (Math.random() < 0.01) {
                console.log(`📥 Inbound fallback payload length: ${data.payload.length}`);
              }
              transport.emit('audio', { payload: data.payload });
            }
            break;
          case 'stop':
            console.log('📥 Plivo Stop Event received');
            transport.emit('close');
            break;
          case 'incorrectPayload':
            console.error('❌ Plivo Error: incorrectPayload - The audio format sent doesn\'t match the XML configuration.');
            break;
        }
      } catch (err) {
        console.error('Error in Plivo stream:', err);
      }
    });

    ws.on('close', () => transport.emit('close'));
  }

  async makeCall(to: string, from?: string, options?: { answerUrl?: string }): Promise<{ callSid: string }> {
    const authId = process.env.PLIVO_AUTH_ID;
    const authToken = process.env.PLIVO_AUTH_TOKEN;
    const fromNumber = from || process.env.PLIVO_PHONE_NUMBER;

    if (!authId || !authToken || !fromNumber) {
      throw new Error('Missing Plivo credentials (PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, or PLIVO_PHONE_NUMBER)');
    }

    let domain = process.env.NGROK_DOMAIN || 'your-domain';
    if (!domain.startsWith('http')) {
      domain = `https://${domain}`;
    }
    const answerUrl = options?.answerUrl || process.env.PLIVO_ANSWER_URL || `${domain}/plivo/xml`;

    const response = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to: to,
        answer_url: answerUrl,
        answer_method: 'POST',
      }),
    });

    const data: any = await response.json();

    if (!response.ok) {
      const errorMessage = data.error || data.message || response.statusText;
      throw new Error(`Plivo API Error: ${typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage}`);
    }

    return { callSid: data.request_uuid };
  }

  async hangup(callSid: string): Promise<void> {
     throw new Error('Remote hangup not yet implemented for PlivoAdapter');
  }
}
