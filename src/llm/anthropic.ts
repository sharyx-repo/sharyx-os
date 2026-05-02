import { LlmProvider, ChatMessage, LlmChunk, LlmOptions } from '../interfaces/llm';

/**
 * Anthropic Claude LLM Provider.
 */
export class AnthropicLLM implements LlmProvider {
  private sdk: any;

  constructor(private config: { apiKey: string, model?: string }) {}

  private async getSDK() {
    if (!this.sdk) {
      try {
        // @ts-ignore
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        this.sdk = new Anthropic({ apiKey: this.config.apiKey });
      } catch (err) {
        throw new Error('Anthropic SDK not found. Install it with: npm install @anthropic-ai/sdk');
      }
    }
    return this.sdk;
  }

  async *streamChat(messages: ChatMessage[], options?: LlmOptions): AsyncIterable<LlmChunk> {
    const anthropic = await this.getSDK();
    const model = options?.model || this.config.model || 'claude-3-5-sonnet-20241022';

    const system = messages.find(m => m.role === 'system')?.content;
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user' as any,
        content: m.content || ''
      }));

    const stream = anthropic.messages.stream({
      model,
      system,
      messages: anthropicMessages,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
      tools: options?.tools
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { text: event.delta.text };
      }
      
      if (event.type === 'message_delta' && (event.delta as any).stop_reason === 'tool_use') {
          // Tool calls are handled differently in Anthropic stream
          // For now we yield the tool use block if available
      }
    }
  }

  async chat(messages: ChatMessage[], options?: LlmOptions): Promise<{ text: string, toolCalls?: any[] }> {
    const anthropic = await this.getSDK();
    const model = options?.model || this.config.model || 'claude-3-5-sonnet-20241022';

    const system = messages.find(m => m.role === 'system')?.content;
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user' as any,
        content: m.content || ''
      }));

    const response = await anthropic.messages.create({
      model,
      system,
      messages: anthropicMessages,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
      tools: options?.tools
    });

    const textContent = response.content.find((c: any) => c.type === 'text');
    const toolCalls = response.content
        .filter((c: any) => c.type === 'tool_use')
        .map((c: any) => ({
            id: c.id,
            type: 'function',
            function: {
                name: c.name,
                arguments: JSON.stringify(c.input)
            }
        }));

    return {
      text: (textContent as any)?.text || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }
}
