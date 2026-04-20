import { EventEmitter } from 'events';
import { VoiceAgentConfig, SimulateResult, SessionConfig } from './types';
import { DEFAULT_CONFIG } from './defaults';
import { ChatMessage, LlmProvider } from '../interfaces/llm';
import { SttProvider } from '../interfaces/stt';
import { TtsProvider } from '../interfaces/tts';
import { TelephonyAdapter } from '../interfaces/adapter';
import { VoiceTransport, CallMetadata } from '../interfaces/transport';
import { VoiceOrchestrator } from '../providers/orchestrator/voice-orchestrator';

import { TelephonyManager } from '../adapters/telephony-manager';
import { EvalLogger } from '../utils/eval-logger';
import * as readline from 'readline';

/**
 * Sharyx Voice Agent Core Class.
 * This class orchestrates the connection between telephony adapters, 
 * LLM intelligence, STT transcription, and TTS synthesis.
 * 
 * @example
 * const agent = new VoiceAgent({ ...config });
 * agent.use(new TwilioAdapter()).start();
 */
export class VoiceAgent extends EventEmitter {
    private adapters: TelephonyAdapter[] = [];
    private orchestrator: VoiceOrchestrator;
    private telephony: TelephonyManager;
    private evalLogger: EvalLogger;
    private app: any;

    constructor(private config: VoiceAgentConfig) {
        super();
        this.orchestrator = new VoiceOrchestrator(this.config);
        this.telephony = new TelephonyManager();
        this.evalLogger = new EvalLogger();
    }

    /**
     * Register a telephony adapter (plugin).
     */
    use(adapter: TelephonyAdapter): this {
        adapter.register(this);
        this.telephony.registerAdapter(adapter);
        if (this.app) {
            adapter.setupRoutes(this.app);
        }
        this.adapters.push(adapter);
        return this;
    }

    /**
     * Start the HTTP server for telephony webhooks.
     */
    async start(options?: { port?: number; host?: string, app?: any }) {
        if (options?.app) {
            this.app = options.app;
        } else {
            try {
                // @ts-ignore
                const express = await import('express');
                this.app = (express as any).default();
            } catch {
                throw new Error('Express not found. Install it with: npm install express');
            }
        }

        this.adapters.forEach(adapter => adapter.setupRoutes(this.app));

        const port = options?.port || 3000;
        if (!options?.app) {
            this.app.listen(port, () => {
                console.log(`🎙️ Voice Agent running on port ${port}`);
                this.adapters.forEach(a => console.log(`  📞 ${a.name} adapter ready`));
            });
        }
    }

    /**
     * Enable or disable debug logs.
     */
    debug(enabled: boolean): this {
        this.config.debug = enabled;
        if (enabled) {
            console.log(`[Sharyx] 🛡️ Debug mode enabled.`);
            console.log(`[Sharyx] 🧠 Provider: ${this.config.llm.constructor.name}`);
        }
        return this;
    }

    /**
     * Main entry point to handle a voice session (from an adapter).
     */
    async handleSession(transport: VoiceTransport, metadata?: CallMetadata) {
        return this.orchestrator.run(transport, metadata);
    }

    /**
     * Text-based simulation of a conversation.
     * Useful for rapid testing without burning telephony costs.
     */
    async simulate(input: string | string[]): Promise<SimulateResult> {
        const messages: ChatMessage[] = [
            { role: 'system', content: this.config.systemPrompt || 'You are a helpful voice assistant.' }
        ];

        const transcript: { role: 'user' | 'agent', text: string }[] = [];

        // Add greeting if provided
        if (this.config.firstMessage) {
            transcript.push({ role: 'agent', text: this.config.firstMessage });
            messages.push({ role: 'assistant', content: this.config.firstMessage });
        }

        const inputs = Array.isArray(input) ? input : [input];

        for (const userText of inputs) {
            if (this.config.debug) console.log(`[Sharyx] 🗨️ User Simulation: ${userText}`);

            transcript.push({ role: 'user', text: userText });
            messages.push({ role: 'user', content: userText });

            const response = await this.config.llm.chat(messages, {
                tools: this.config.tools
            });

            if (this.config.debug) console.log(`[Sharyx] 🤖 Agent Response: ${response.text}`);

            // Note: Simplistic tool execution for simulation
            // In the real pipeline, it uses ToolExecutor service.
            if (response.toolCalls && response.toolCalls.length > 0) {
                 // Simulate tool output for now
                 const toolResult = `[Executed tool calls: ${response.toolCalls.length}]`;
                 messages.push({ role: 'assistant', content: toolResult });
                 transcript.push({ role: 'agent', text: toolResult });
            } else {
                messages.push({ role: 'assistant', content: response.text });
                transcript.push({ role: 'agent', text: response.text });
            }
        }

        return {
            text: transcript[transcript.length - 1]?.text || '',
            transcript,
            turns: inputs.length,
            provider: this.config.llm.constructor.name.toLowerCase().replace('llm', '')
        };
    }

    /**
     * Interactive terminal chat.
     */
    async chat(): Promise<void> {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        const firstMsg = this.config.firstMessage || 'Hello! How can I help?';
        console.log(`\n🤖 Agent: ${firstMsg}\n`);

        const messages: ChatMessage[] = [
            { role: 'system', content: this.config.systemPrompt || 'You are a helpful voice assistant.' },
            { role: 'assistant', content: firstMsg }
        ];

        const loop = () => {
            rl.question('You: ', async (input) => {
                if (input.toLowerCase() === '/exit' || input.toLowerCase() === '/quit') {
                    console.log('Exiting chat...');
                    rl.close();
                    return;
                }

                messages.push({ role: 'user', content: input });
                
                process.stdout.write('\n🤖 Agent: ');
                let fullResponse = '';
                
                try {
                    const stream = this.config.llm.streamChat(messages, { tools: this.config.tools });
                    for await (const chunk of stream) {
                        if (chunk.text) {
                            process.stdout.write(chunk.text);
                            fullResponse += chunk.text;
                        }
                    }
                    console.log('\n'); // New line after stream ends
                    messages.push({ role: 'assistant', content: fullResponse });
                } catch (err) {
                    console.error(`\n❌ LLM Error: ${err}. Falling back to single-shot chat...`);
                    const response = await this.config.llm.chat(messages, { tools: this.config.tools });
                    messages.push({ role: 'assistant', content: response.text });
                    console.log(response.text);
                }

                loop();
            });
        };

        loop();
    }
}
