import { ILLMProvider, Message } from '../types';

/**
 * Google Gemini LLM Provider.
 */
export class GeminiLLM implements ILLMProvider {
  private sdk: any;

  constructor(private config: { apiKey: string, model?: string }) {}

  private async getSDK() {
    if (!this.sdk) {
      try {
        // @ts-ignore
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        this.sdk = new GoogleGenerativeAI(this.config.apiKey);
      } catch (err) {
        throw new Error('Gemini SDK not found. Install it with: npm install @google/generative-ai');
      }
    }
    return this.sdk;
  }

  public async *generate(messages: Message[], options?: any): AsyncIterable<string> {
    const genAI = await this.getSDK();
    const modelName = options?.model || this.config.model || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    // Separate system prompt from messages for Gemini
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const chatHistory = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || '' }]
      }));

    const chat = model.startChat({
        history: chatHistory.slice(0, -1),
        systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined
    });

    const lastMessage = chatHistory[chatHistory.length - 1]?.parts[0]?.text || '';
    const result = await chat.sendMessageStream(lastMessage);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }
}
