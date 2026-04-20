import { VoiceAgent } from '../core/voice-agent';
import { VoiceTransport, CallMetadata } from './transport';

export interface TelephonyAdapter {
  /** Unique name for this adapter */
  readonly name: string;

  /** Called when agent.use(adapter) is invoked */
  register(agent: VoiceAgent): void;

  /** Set up any required routes (for webhooks) */
  setupRoutes(app: any): void;

  /** Initiate an outbound call */
  makeCall(to: string, from?: string): Promise<{ callSid: string }>;

  /** Hang up a call by SID */
  hangup(callSid: string): Promise<void>;

  /** Handle a WebSocket connection (for media streams) */
  handleWebSocket(ws: any): void;
}
