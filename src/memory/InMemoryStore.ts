import { IMemoryStore } from './IMemoryStore';
import { Message } from '../types';

/**
 * In-memory storage for development and testing
 */
export class InMemoryStore implements IMemoryStore {
  private stores: Map<string, Message[]> = new Map();

  public async appendMessage(conversationId: string, message: Message): Promise<void> {
    const history = this.stores.get(conversationId) || [];
    history.push(message);
    this.stores.set(conversationId, history);
  }

  public async getHistory(conversationId: string): Promise<Message[]> {
    return this.stores.get(conversationId) || [];
  }

  public async clear(conversationId: string): Promise<void> {
    this.stores.delete(conversationId);
  }

  public async trimContext(conversationId: string, maxTokens: number): Promise<void> {
    const history = this.stores.get(conversationId) || [];
    let currentTokens = 0;
    const keptMessages: Message[] = [];

    for (let i = history.length - 1; i >= 0; i--) {
      const tokens = Math.ceil(history[i].content.length / 4);
      if (currentTokens + tokens > maxTokens) break;
      keptMessages.unshift(history[i]);
      currentTokens += tokens;
    }

    this.stores.set(conversationId, keptMessages);
  }
}
