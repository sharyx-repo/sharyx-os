import { LlmProvider, ChatMessage, LlmChunk, LlmOptions } from '../interfaces/llm';

/**
 * Groq LLM Provider.
 */
export class GroqLLM implements LlmProvider {
  private sdk: any;

  constructor(private config: { apiKey: string, model?: string }) {}

  private async getSDK() {
    if (!this.sdk) {
      try {
        // @ts-ignore
        const { default: Groq } = await import('groq-sdk');
        this.sdk = new Groq({ apiKey: this.config.apiKey });
      } catch (err) {
        throw new Error('Groq SDK not found. Install it with: npm install groq-sdk');
      }
    }
    return this.sdk;
  }

  async *streamChat(messages: ChatMessage[], options?: LlmOptions): AsyncIterable<LlmChunk> {
    const groq = await this.getSDK();
    const model = options?.model || this.config.model || 'llama-3.3-70b-versatile';

    const stream = await groq.chat.completions.create({
      model,
      messages: messages as any,
      stream: true,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      tools: options?.tools
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield { text: delta.content };
      }
      if (delta?.tool_calls) {
          yield { tool_calls: delta.tool_calls };
      }
    }
  }

  async chat(messages: ChatMessage[], options?: LlmOptions): Promise<{ text: string, toolCalls?: any[] }> {
    const groq = await this.getSDK();
    const model = options?.model || this.config.model || 'llama-3.3-70b-versatile';

    const completion = await groq.chat.completions.create({
      model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      tools: options?.tools
    });

    const choice = completion.choices[0]?.message;
    return {
      text: choice?.content || '',
      toolCalls: choice?.tool_calls
    };
  }
}
