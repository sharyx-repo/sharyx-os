import { ILLMProvider, Message } from '../types';

/**
 * OpenAI LLM Provider implementation
 */
export class OpenAILLM implements ILLMProvider {
  private sdk: any;

  constructor(private config: { apiKey: string; model?: string }) {}

  private async getSDK() {
    if (!this.sdk) {
      const { default: OpenAI } = await import('openai');
      this.sdk = new OpenAI({ apiKey: this.config.apiKey });
    }
    return this.sdk;
  }

  public async *generate(messages: Message[], options?: any): AsyncIterable<string> {
    const openai = await this.getSDK();
    const model = options?.model || this.config.model || 'gpt-4o-mini';

    const completion = await openai.chat.completions.create({
      model,
      messages: messages as any,
      stream: true,
      temperature: options?.temperature ?? 0.7,
    });

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}
