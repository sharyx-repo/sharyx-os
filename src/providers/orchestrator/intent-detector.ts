import { LlmProvider, ChatMessage } from '../../interfaces/llm';

export interface Intent {
    name: string;
    description: string;
}

export class IntentDetector {
    constructor(private llm: LlmProvider, private intents: Intent[]) {}

    async detect(history: ChatMessage[]): Promise<string | null> {
        const lastUserMessage = [...history].reverse().find(m => m.role === 'user');
        if (!lastUserMessage) return null;

        const systemPrompt = `
            Identify the user's intent from the following list. 
            Respond ONLY with the name of the intent. 
            If no intent matches, respond with "unknown".

            Intents:
            ${this.intents.map(i => `- ${i.name}: ${i.description}`).join('\n')}

            User message: "${lastUserMessage.content}"
        `.trim();

        const response = await this.llm.chat([
            { role: 'system', content: systemPrompt },
            lastUserMessage
        ]);

        const detected = response.text.trim().toLowerCase();
        return this.intents.find(i => i.name.toLowerCase() === detected)?.name || null;
    }
}
