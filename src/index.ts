/**
 * Sharyx OS - Professional Voice AI Framework
 * @module sharyx-os
 */

// Core exports
export { ConversationFSM } from './fsm';
export { VoicePipeline } from './pipeline';

// Types
export * from './types';

// Memory
export { IMemoryStore } from './memory/IMemoryStore';
export { RedisMemoryStore } from './memory/RedisMemoryStore';
export { InMemoryStore } from './memory/InMemoryStore';

// Security
export { validateTwilioSignature, twilioValidator } from './security/webhookValidator';
export { inputSanitizer } from './security/inputSanitizer';

// Transports
export { TwilioTransport } from './transports/TwilioTransport';
export { WebRTCTransport } from './transports/WebRTCTransport';

// Helper factories
import { VoicePipeline } from './pipeline';
import { AgentConfig, ITransport } from './types';
import { TwilioTransport } from './transports/TwilioTransport';
import { WebRTCTransport } from './transports/WebRTCTransport';
import type { WebSocket } from 'ws';

/**
 * Factory to create a voice pipeline for a given transport
 */
export function createVoiceAgent(config: AgentConfig, transport: ITransport): VoicePipeline {
  return new VoicePipeline(config, transport);
}

/**
 * Framework-agnostic handler creation
 */
export const handlers = {
  twilio: (config: AgentConfig) => {
    return (ws: WebSocket) => {
      const transport = new TwilioTransport(ws);
      const agent = new VoicePipeline(config, transport);
      agent.start().catch(console.error);
      
      ws.on('close', () => {
        agent.stop().catch(console.error);
      });
    };
  },

  web: (config: AgentConfig) => {
    return (ws: WebSocket) => {
      const transport = new WebRTCTransport(ws);
      const agent = new VoicePipeline(config, transport);
      agent.start().catch(console.error);

      ws.on('close', () => {
        agent.stop().catch(console.error);
      });
    };
  }
};
