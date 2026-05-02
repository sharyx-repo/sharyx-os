import { createAgent } from '../src/core/simple';
import { AnthropicLLM } from '../src/llm/anthropic';

function testAnthropicConfig() {
    console.log('--- Testing Anthropic Config ---');
    const agent = createAgent({
        llm: { provider: 'anthropic', apiKey: 'claude-key', model: 'claude-3-opus' }
    });
    
    const llm = (agent as any).config.llm;
    console.log('Provider Type:', llm.constructor.name);
    console.log('Config API Key:', (llm as any).config.apiKey);
    console.log('Config Model:', (llm as any).config.model);

    if (llm.constructor.name !== 'AnthropicLLM') {
        throw new Error('AnthropicLLM not correctly initialized');
    }
    if ((llm as any).config.apiKey !== 'claude-key' || (llm as any).config.model !== 'claude-3-opus') {
        throw new Error('AnthropicLLM config mismatch');
    }

    console.log('\n✅ Anthropic Configuration Test Passed!');
}

try {
    testAnthropicConfig();
} catch (err: any) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
}
