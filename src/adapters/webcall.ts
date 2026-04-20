import { EventEmitter } from 'events';
import { VoiceAgent } from '../core/voice-agent';
import { TelephonyAdapter } from '../interfaces/adapter';
import { VoiceTransport, CallMetadata } from '../interfaces/transport';

export class WebCallAdapter implements TelephonyAdapter {
  public readonly name = 'webcall';
  private agent?: VoiceAgent;

  register(agent: VoiceAgent): void {
    this.agent = agent;
  }

  setupRoutes(app: any): void {
    // WebCall doesn't require HTTP routes normally, just WebSocket
  }

  /**
   * Bridges a raw Browser WebSocket to the Sharyx Pipeline.
   * Handles Buffer-to-Base64 conversion automatically.
   */
  handleWebSocket(ws: any): void {
    if (!this.agent) throw new Error('WebCallAdapter not registered with an agent');

    const transport = new class extends EventEmitter implements VoiceTransport {
      sendAudio(payload: string | Buffer) {
        if (ws.readyState === 1) { // WebSocket.OPEN
          let base64: string;
          if (Buffer.isBuffer(payload)) {
            base64 = payload.toString('base64');
          } else {
            base64 = payload;
          }
          ws.send(JSON.stringify({ event: 'audio', payload: base64 }));
        }
      }
      sendStart() { ws.send(JSON.stringify({ event: 'start' })); }
      sendClear() { ws.send(JSON.stringify({ event: 'clear' })); }
      sendMark(name: string) { ws.send(JSON.stringify({ event: 'mark', name })); }
      hangup() { ws.close(); }
      close() { ws.close(); }
      sendMessage(event: string, data: any) { ws.send(JSON.stringify({ event, ...data })); }
    };

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.event === 'audio') {
          transport.emit('audio', { payload: data.payload });
        }
      } catch (err) {
        console.error('[WebCallAdapter] Error parsing message:', err);
      }
    });

    // Start the session (Browser is 16kHz default)
    this.agent.handleSession(transport, { 
      sampleRate: 16000, 
      encoding: 'pcm_s16le' 
    });

    ws.on('close', () => transport.emit('close'));
  }

  async makeCall(to: string): Promise<{ callSid: string }> {
    throw new Error('WebCallAdapter does not support outbound telephony calls.');
  }

  async hangup(callSid: string): Promise<void> {
     // WebCall hangup is usually client-initiated
  }
}
