import { Message } from '../types';

/**
 * Interface for conversation memory providers
 */
export interface IMemoryStore {
  /**
   * Append a single message to a conversation thread
   * @param conversationId Unique identifier for the conversation
   * @param message Message object to store
   */
  appendMessage(conversationId: string, message: Message): Promise<void>;

  /**
   * Retrieve all messages for a conversation
   * @param conversationId Unique identifier for the conversation
   */
  getHistory(conversationId: string): Promise<Message[]>;

  /**
   * Clear all messages for a conversation
   * @param conversationId Unique identifier for the conversation
   */
  clear(conversationId: string): Promise<void>;

  /**
   * Trim the conversation history based on token counts or message limits
   * @param conversationId Unique identifier for the conversation
   * @param maxTokens Maximum number of tokens to keep
   */
  trimContext(conversationId: string, maxTokens: number): Promise<void>;
}
