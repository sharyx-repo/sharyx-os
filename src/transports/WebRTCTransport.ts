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
      // In WebRTC/Web environment, we often send binary frames directly
      if (Buffer.isBuffer(data)) {
        onAudio(data);
      } else {
        // Handle JSON control messages if any
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'barge-in') {
            this.emit('barge-in');
          }
        } catch (e) {
          // ignore
        }
      }
    });

    this.ws.on('close', () => this.emit('stop'));
  }

  public sendAudio(audio: Buffer): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audio);
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
