import Redis from 'ioredis';
import { MemoryStore, CallSession } from '../interfaces/memory';

/**
 * Production-ready Redis session store.
 * Allows multiple agent instances to share conversation state.
 */
export class RedisMemoryStore implements MemoryStore {
    private redis: Redis;
    private ttl: number;

    constructor(options: { url?: string; host?: string; port?: number; ttl?: number } = {}) {
        if (options.url) {
            this.redis = new Redis(options.url);
        } else {
            this.redis = new Redis({
                host: options.host || 'localhost',
                port: options.port || 6379,
            });
        }
        this.ttl = options.ttl || 3600; // Default 1 hour
    }

    async getSession(sessionId: string): Promise<CallSession> {
        const data = await this.redis.get(`session:${sessionId}`);
        if (data) {
            return JSON.parse(data);
        }

        const newSession: CallSession = {
            sessionId,
            dynamicMemory: {},
            conversationSummary: '',
            messages: [],
            createdAt: Date.now()
        };

        await this.saveSession(newSession);
        return newSession;
    }

    async saveSession(session: CallSession): Promise<void> {
        await this.redis.set(
            `session:${session.sessionId}`,
            JSON.stringify(session),
            'EX',
            this.ttl
        );
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.redis.del(`session:${sessionId}`);
    }
}
