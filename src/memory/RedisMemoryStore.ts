import { IMemoryStore } from './IMemoryStore';
import { Message } from '../types';

/**
 * Redis-backed memory store with TTL support
 * Uses dynamic imports to avoid hard dependency on ioredis
 */
export class RedisMemoryStore implements IMemoryStore {
  private redis: any;
  private ttl: number;

  constructor(options: { host?: string; port?: number; password?: string; ttl?: number } = {}) {
    this.ttl = options.ttl || 3600; // Default 1 hour
  }

  private async getRedis(): Promise<any> {
    if (this.redis) return this.redis;
    
    try {
      const { Redis } = await import('ioredis');
      this.redis = new Redis();
      return this.redis;
    } catch (e) {
      throw new Error(
        'The "ioredis" package is required for RedisMemoryStore. ' +
        'Please install it with: npm install ioredis'
      );
    }
  }

  public async appendMessage(conversationId: string, message: Message): Promise<void> {
    const client = await this.getRedis();
    const key = `conv:${conversationId}`;
    await client.rpush(key, JSON.stringify(message));
    await client.expire(key, this.ttl);
  }

  public async getHistory(conversationId: string): Promise<Message[]> {
    const client = await this.getRedis();
    const data = await client.lrange(`conv:${conversationId}`, 0, -1);
    return data.map((item: string) => JSON.parse(item) as Message);
  }

  public async clear(conversationId: string): Promise<void> {
    const client = await this.getRedis();
    await client.del(`conv:${conversationId}`);
  }

  /**
   * ISSUE 7: Token trimming logic
   * Note: This is a simplified version using character count as a proxy for tokens.
   * In production, use a library like 'tiktoken'.
   */
  public async trimContext(conversationId: string, maxTokens: number): Promise<void> {
    const client = await this.getRedis();
    const key = `conv:${conversationId}`;
    const history = await this.getHistory(conversationId);
    
    let currentTokens = 0;
    let cutIndex = 0;

    // Estimate tokens from back to front
    for (let i = history.length - 1; i >= 0; i--) {
      const tokens = Math.ceil(history[i].content.length / 4); // rough estimate
      if (currentTokens + tokens > maxTokens) {
        cutIndex = i + 1;
        break;
      }
      currentTokens += tokens;
    }

    if (cutIndex > 0) {
      await client.ltrim(key, cutIndex, -1);
    }
  }
}
