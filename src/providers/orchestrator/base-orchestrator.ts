import { EventEmitter } from 'events';
import { VoiceTransport, CallMetadata } from '../../interfaces/transport';
import { VoiceAgentConfig } from '../../core/types';
import { ChatMessage } from '../../interfaces/llm';

export abstract class BaseOrchestrator extends EventEmitter {
    constructor(protected config: VoiceAgentConfig) {
        super();
    }

    /**
     * Main entry point to start the orchestration for a session.
     */
    abstract run(transport: VoiceTransport, metadata?: CallMetadata): Promise<void>;

    /**
     * Stop the current session.
     */
    abstract stop(): Promise<void>;
}
