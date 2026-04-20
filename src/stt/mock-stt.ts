import { SttProvider, LiveSttConnection, SttOptions } from '../interfaces/stt';
import { EventEmitter } from 'events';

class MockSttConnection extends EventEmitter implements LiveSttConnection {
    send(audio: Buffer): void {
        // Mock: Ignore audio, but could emit 'speech_started'
    }
    finish(): void {
        this.emit('close');
    }
    getReadyState(): number {
        return 1; // Open
    }
}

/**
 * A mock STT provider for offline testing.
 */
export class MockSTT implements SttProvider {
    createLiveConnection(options?: SttOptions): LiveSttConnection {
        return new MockSttConnection();
    }
}
