import { createAgent } from '../src/core/simple';

function testGoogleTTSConfig() {
    console.log('--- Testing Google Cloud TTS Config ---');
    
    const agent = createAgent({
        tts: { provider: 'googlecloud', apiKey: 'google-mock-key' },
        voice: 'en-US-Standard-C'
    });
    
    const tts = (agent as any).config.tts;
    console.log('Provider Type:', tts.constructor.name);
    console.log('Config API Key:', (tts as any).config.apiKey);
    console.log('Voice ID Configured:', (tts as any).config.voiceId);

    if (tts.constructor.name !== 'GoogleCloudTTS') {
        throw new Error('GoogleCloudTTS not correctly initialized');
    }
    if ((tts as any).config.apiKey !== 'google-mock-key' || (tts as any).config.voiceId !== 'en-US-Standard-C') {
        throw new Error('GoogleCloudTTS config mismatch');
    }

    console.log('\n✅ Google Cloud TTS Configuration Test Passed!');
}

try {
    testGoogleTTSConfig();
} catch (err: any) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
}
