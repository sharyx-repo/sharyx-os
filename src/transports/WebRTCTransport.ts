import { ITransport } from '../types';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

/**
 * WebSocket transport for Web/Mobile clients
 */
export class WebRTCTransport extends EventEmitter implements ITransport {
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    super();
    this.ws = ws;
  }

  public async start(onAudio: (audio: Buffer) => void): Promise<void> {
    this.ws.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.event === 'audio' && msg.payload) {
          const buffer = Buffer.from(msg.payload, 'base64');
          onAudio(buffer);
        } else if (msg.type === 'barge-in' || msg.event === 'barge-in') {
          this.emit('barge-in');
        }
      } catch (e) {
        // If not JSON, check if it's raw binary
        if (Buffer.isBuffer(data)) {
          onAudio(data);
        }
      }
    });

    this.ws.on('close', () => this.emit('stop'));
  }

  public sendAudio(audio: Buffer): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      console.debug(`[Transport] Sending audio: ${audio.length} bytes`);
      // Send as JSON for the web example
      this.ws.send(JSON.stringify({
        event: 'audio',
        payload: audio.toString('base64')
      }));
    }
  }

  public async stop(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  public onBargeIn(callback: () => void): void {
    this.on('barge-in', callback);
  }
}
