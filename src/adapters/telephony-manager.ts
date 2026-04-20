import { EventEmitter } from 'events';
import { TelephonyAdapter } from '../interfaces/adapter';
import { VoiceTransport, CallMetadata } from '../interfaces/transport';

export class TelephonyManager extends EventEmitter {
    private adapters: Map<string, TelephonyAdapter> = new Map();

    registerAdapter(adapter: TelephonyAdapter) {
        this.adapters.set(adapter.name, adapter);
        console.log(`[TelephonyManager] Adapter registered: ${adapter.name}`);
    }

    async makeCall(adapterName: string, to: string, from?: string): Promise<{ callSid: string }> {
        const adapter = this.adapters.get(adapterName);
        if (!adapter) throw new Error(`Adapter ${adapterName} not found`);
        return adapter.makeCall(to, from);
    }

    async hangup(adapterName: string, callSid: string): Promise<void> {
        const adapter = this.adapters.get(adapterName);
        if (!adapter) throw new Error(`Adapter ${adapterName} not found`);
        return adapter.hangup(callSid);
    }

    // Unifies session events from different adapters
    handleIncomingSession(adapterName: string, transport: VoiceTransport, metadata: CallMetadata) {
        this.emit('session', {
            adapter: adapterName,
            transport,
            metadata
        });
    }
}
