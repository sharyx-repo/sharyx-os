export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface LlmChunk {
  text?: string;
  tool_calls?: any[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LlmOptions {
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
}

/**
 * Interface for Large Language Model providers.
 * Implement this to add support for new models (Anthropic, Local LLMs, etc.)
 */
export interface LlmProvider {
  /**
   * Stream a chat completion.
   * Useful for real-time voice applications to reduce latency.
   * 
   * @param messages - conversation history
   * @param options - model configuration and tools
   */
  streamChat(messages: ChatMessage[], options?: LlmOptions): AsyncIterable<LlmChunk>;

  /**
   * Single-shot completion.
   * Useful for simulations, summaries, or non-realtime tasks.
   * 
   * @param messages - conversation history
   * @param options - model configuration and tools
   */
  chat(messages: ChatMessage[], options?: LlmOptions): Promise<{ text: string; toolCalls?: any[] }>;
}
