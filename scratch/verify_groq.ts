import { createAgent } from '../src/core/simple';
import { GroqLLM } from '../src/llm/groq';

function testGroqConfig() {
    console.log('--- Testing Groq Config ---');
    const agent = createAgent({
        llm: { provider: 'groq', apiKey: 'gsk-mock-key', model: 'llama-3.3-70b-versatile' }
    });
    
    const llm = (agent as any).config.llm;
    console.log('Provider Type:', llm.constructor.name);
    console.log('Config API Key:', (llm as any).config.apiKey);
    console.log('Config Model:', (llm as any).config.model);

    if (llm.constructor.name !== 'GroqLLM') {
        throw new Error('GroqLLM not correctly initialized');
    }
    if ((llm as any).config.apiKey !== 'gsk-mock-key' || (llm as any).config.model !== 'llama-3.3-70b-versatile') {
        throw new Error('GroqLLM config mismatch');
    }

    console.log('\n✅ Groq Configuration Test Passed!');
}

try {
    testGroqConfig();
} catch (err: any) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
}
