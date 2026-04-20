import { SttProvider, LiveSttConnection, SttOptions, LiveTranscriptionEvents } from '../interfaces/stt';
import { EventEmitter } from 'events';

/**
 * Deepgram STT Provider.
 * Updated for @deepgram/sdk v5.0.0 which uses:
 *   - DeepgramClient({ apiKey }) constructor
 *   - listen.v1.connect() returns a socket (startClosed=true)
 *   - socket.connect() + socket.waitForOpen() to actually open the WS
 *   - socket.sendMedia() to send audio
 *   - socket.close() to finish
 *   - socket.readyState property (not getReadyState())
 *   - 'message' event for all incoming data (not 'results')
 */
export class DeepgramSTT implements SttProvider {
    private sdk: any;

    constructor(private config: { apiKey: string }) { }

    private async getSDK() {
        if (!this.sdk) {
            try {
                // @ts-ignore
                const { DeepgramClient } = await import('@deepgram/sdk');
                this.sdk = new DeepgramClient({ apiKey: this.config.apiKey });
            } catch (err) {
                throw new Error('Deepgram SDK not found or failed to initialize. Install it with: npm install @deepgram/sdk');
            }
        }
        return this.sdk;
    }

    createLiveConnection(options?: SttOptions): LiveSttConnection {
        const emitter = new EventEmitter();
        let connection: any;
        let isReady = false;

        const initConnection = async () => {
            try {
                const deepgram = await this.getSDK();
                console.log('[DeepgramSTT] Creating live connection...');

                connection = await deepgram.listen.v1.connect({
                    model: options?.model || 'nova-2',
                    language: options?.language || 'en-US',
                    encoding: (options?.encoding === 'mulaw' || options?.encoding === 'pcm_mulaw') ? 'mulaw' : 'linear16',
                    sample_rate: options?.sampleRate || 16000,
                    smart_format: true,
                    interim_results: true,
                    endpointing: 200
                });

                // Register event handlers BEFORE connecting
                connection.on('open', () => {
                    console.log('[DeepgramSTT] ✅ WebSocket OPEN - ready to receive audio');
                    isReady = true;
                });

                // v5 SDK uses 'message' event for all incoming messages
                connection.on('message', (data: any) => {
                    // data could be a transcript result or other message
                    if (data?.type === 'Results') {
                        const transcript = data.channel?.alternatives?.[0]?.transcript;
                        if (transcript && transcript.trim() !== '') {
                            console.log(`[DeepgramSTT] Transcript (is_final=${data.is_final}): "${transcript}"`);
                            emitter.emit(LiveTranscriptionEvents.Transcript, data);
                        }
                    } else if (data?.type === 'SpeechStarted') {
                        emitter.emit(LiveTranscriptionEvents.SpeechStarted);
                    }
                });

                connection.on('error', (err: any) => {
                    console.error('[DeepgramSTT] ❌ Error:', err);
                    emitter.emit(LiveTranscriptionEvents.Error, err);
                });

                connection.on('close', () => {
                    console.log('[DeepgramSTT] WebSocket closed');
                    isReady = false;
                    emitter.emit(LiveTranscriptionEvents.Close);
                });

                // NOW actually open the WebSocket connection
                console.log('[DeepgramSTT] Calling connect()...');
                connection.connect();

                // Wait for the socket to be open
                await connection.waitForOpen();
                console.log('[DeepgramSTT] ✅ Connection established and ready!');

            } catch (err) {
                console.error('[DeepgramSTT] ❌ Failed to initialize connection:', err);
            }
        };

        initConnection();

        return {
            send: (audio: Buffer) => {
                if (isReady && connection) {
                    connection.sendMedia(audio);
                }
            },
            finish: () => {
                if (connection) {
                    isReady = false;
                    connection.close();
                }
            },
            getReadyState: () => isReady ? 1 : 0,
            addListener: (event: string, callback: (...args: any[]) => void) => emitter.addListener(event, callback)
        } as any;
    }
}
