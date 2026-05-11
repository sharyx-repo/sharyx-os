import { ITransport } from '../types';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

/**
 * Twilio Media Streams transport implementation
 */
export class TwilioTransport extends EventEmitter implements ITransport {
  private ws: WebSocket;
  private streamSid: string | null = null;
  private callSid: string | null = null;

  constructor(ws: WebSocket) {
    super();
    this.ws = ws;
  }

  /**
   * Start processing the Twilio WebSocket stream
   */
  public async start(onAudio: (audio: Buffer) => void): Promise<void> {
    this.ws.on('message', (data: string) => {
      const msg = JSON.parse(data);
      
      switch (msg.event) {
        case 'start':
          this.streamSid = msg.start.streamSid;
          this.callSid = msg.start.callSid;
          console.info(`[Twilio] Stream started: ${this.streamSid}`);
          break;
        
        case 'media':
          // Convert base64 mulaw to Buffer
          const audioBuffer = Buffer.from(msg.media.payload, 'base64');
          onAudio(audioBuffer);
          break;
          
        case 'stop':
          console.info(`[Twilio] Stream stopped: ${this.streamSid}`);
          this.emit('stop');
          break;
      }
    });

    this.ws.on('error', (err) => {
      console.error('[Twilio] WebSocket error', err);
    });
  }

  /**
   * Send audio back to Twilio (must be mulaw 8k)
   */
  public sendAudio(audio: Buffer): void {
    if (!this.streamSid || this.ws.readyState !== WebSocket.OPEN) return;

    const msg = {
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: audio.toString('base64'),
      },
    };

    this.ws.send(JSON.stringify(msg));
  }

  public async stop(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  /**
   * Twilio doesn't provide VAD events directly via Media Streams.
   * Consumers should use a VAD library like Silero on the incoming stream.
   * This hook allows the pipeline to register a callback.
   */
  public onBargeIn(callback: () => void): void {
    // Implementation would involve a VAD processor on the incoming buffer
    // For now, we provide the hook for the pipeline to use.
    this.on('barge-in', callback);
  }

  /**
   * Manually trigger barge-in (e.g. from an external VAD processor)
   */
  public triggerBargeIn(): void {
    this.emit('barge-in');
  }
}
