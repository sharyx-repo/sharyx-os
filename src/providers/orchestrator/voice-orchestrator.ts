import { BaseOrchestrator } from './base-orchestrator';
import { VoiceTransport, CallMetadata } from '../../interfaces/transport';
import { LiveTranscriptionEvents } from '../../interfaces/stt';
import { ChatMessage } from '../../interfaces/llm';
import { DEFAULT_CONFIG } from '../../core/defaults';

export class VoiceOrchestrator extends BaseOrchestrator {
    private isRunning = false;

    async run(transport: VoiceTransport, metadata?: CallMetadata) {
        console.log(`[Sharyx] 🧠 Modular Orchestrator 2.0 starting session: ${metadata?.callSid || 'sim_session'}`);
        this.isRunning = true;
        const session: any = {
            id: metadata?.callSid || `session_${Date.now()}`,
            history: [] as ChatMessage[],
            isAiSpeaking: false,
            currentTurnId: 0,
            config: { ...DEFAULT_CONFIG, ...this.config.config },
            metadata: metadata || {},
            lastProcessedTranscript: '',
            processingTurn: false,
            liveTts: null,
            activeTtsContextId: '',
            firstAudioTime: 0,
            firstTokenTime: 0,
            turnStartTime: 0,
            sessionStartTime: performance.now(),
            aiSpeechStartTime: 0,
            completionResolvers: new Map<string, () => void>(),
            latencies: [] as number[],
            totalBargeIns: 0
        };

        // Pre-initialize Live TTS connection for the entire session (WebSocket)
        if (this.config.tts.createLiveConnection) {
            try {
                session.liveTts = this.config.tts.createLiveConnection({
                    sampleRate: session.metadata?.sampleRate,
                    encoding: session.metadata?.encoding
                });
                session.liveTts.onError((err: any) => console.error('[VoiceOrchestrator] Session TTS Error:', err));

                // CENTRALIZED AUDIO ROUTER: Listen once for the entire session 
                session.liveTts.onAudio((chunk: Buffer, ttsContextId?: string) => {
                    const isCorrectContext = ttsContextId ? session.activeTtsContextId === ttsContextId : true;

                    if (isCorrectContext && session.isAiSpeaking) {
                        if (session.firstAudioTime === 0) {
                            session.firstAudioTime = performance.now();
                            session.aiSpeechStartTime = session.firstAudioTime;
                            const ttts = (session.firstAudioTime - (session.firstTokenTime || session.turnStartTime)).toFixed(0);
                            console.log(`[Latency] 🔊 Turn ${session.currentTurnId} -> TTS (First Token to Audio): ${ttts}ms`);
                        }
                        transport.sendAudio(chunk);
                    } else if (!isCorrectContext && session.config.debug) {
                        console.log(`[Sharyx Debug] 🛡️ Ignored mis-matched audio context: ${ttsContextId} (Active: ${session.activeTtsContextId})`);
                    }
                });

                session.liveTts.onCompletion((ttsContextId?: string) => {
                    if (ttsContextId) {
                        const resolve = session.completionResolvers.get(ttsContextId);
                        if (resolve) {
                            resolve();
                            session.completionResolvers.delete(ttsContextId);
                        }
                    }
                });
            } catch (err) {
                console.warn('[VoiceOrchestrator] Failed to pre-initialize live TTS:', err);
            }
        }

        const sttStream = this.config.stt.createLiveConnection({
            sampleRate: metadata?.sampleRate,
            encoding: metadata?.encoding
        });

        transport.on('audio', (data: any) => {
            if (this.isRunning && data?.payload) {
                const audioBuffer = Buffer.from(data.payload, 'base64');
                if (sttStream.getReadyState() === 1) {
                    sttStream.send(audioBuffer);
                }
            }
        });

        // State for Multi-Barge-in tracking
        session.totalBargeIns = 0;

        const handleInterruption = (source: string, transcript?: string) => {
            if (session.isAiSpeaking && session.config.interruption_mode === 'interrupt') {
                // GUARD: Interruption Cooldown (prevent self-interruption from echo)
                const timeSinceAiStarted = session.aiSpeechStartTime > 0 ? performance.now() - session.aiSpeechStartTime : -1;
                if (timeSinceAiStarted !== -1 && timeSinceAiStarted < session.config.interruption_cooldown) {
                    if (session.config.debug) {
                        console.log(`[Sharyx Debug] 🛡️ Barge-in (${source}) ignored - within cooldown (${timeSinceAiStarted.toFixed(0)}ms < ${session.config.interruption_cooldown}ms)`);
                    }
                    return;
                }

                session.totalBargeIns++;
                console.log(`[Sharyx] 🚫 Barge-in #${session.totalBargeIns} detected (${source})! Interrupting Turn ${session.currentTurnId}${transcript ? ` - "${transcript}"` : ''}`);

                // Atomic Stop Sequence
                transport.sendClear();
                session.isAiSpeaking = false;
                session.processingTurn = false;
                session.aiSpeechStartTime = 0; // Reset

                // Update UI metrics immediately
                this.sendMetrics(session, transport);
            }
        };

        sttStream.addListener(LiveTranscriptionEvents.Error, (err: any) => {
            console.error('[Sharyx] ❌ STT Stream Error:', err);
            // Don't crash, just log and optionally notify UI
            transport.sendMessage?.('transcript', {
                payload: { role: 'agent', text: 'Connection issue detected. Reconnecting...', final: true }
            });
        });

        sttStream.addListener(LiveTranscriptionEvents.Transcript, async (data: any) => {
            const transcript = data.channel?.alternatives?.[0]?.transcript?.trim();
            if (!transcript) return;

            if (session.config.debug) {
                console.log(`[Sharyx Debug] Transcript: "${transcript}" (is_final: ${data.is_final}, isAiSpeaking: ${session.isAiSpeaking})`);
            }

            if (!data.is_final) {
                // Forward partial transcript to UI
                transport.sendMessage?.('transcript', {
                    payload: { role: 'user', text: transcript, final: false }
                });

                // VAD INDICATOR: Inform UI that user is actively speaking
                transport.sendMessage?.('status_update', { payload: { status: 'User Speaking', type: 'vad' } });

                // Responsive Interruption: Be extremely careful with partials
                const words = transcript.split(' ').length;
                const confidence = data.channel?.alternatives?.[0]?.confidence || 1.0;
                
                if (session.isAiSpeaking) {
                    if (words >= (session.config.interruption_threshold + 2) && confidence > 0.4) {
                        handleInterruption(`PartialTranscript`, transcript);
                    } else if (session.config.debug && words > 1) {
                        console.log(`[Barge-in Logic] Ignored partial: "${transcript}" (words: ${words} < 5 OR conf: ${confidence.toFixed(2)} <= 0.4)`);
                    }
                }
                return;
            }

            // Final Interruption: Require the threshold (3 words) and decent confidence
            const finalWords = transcript.split(' ').length;
            const finalConfidence = data.channel?.alternatives?.[0]?.confidence || 1.0;

            if (session.isAiSpeaking) {
                if (finalWords >= session.config.interruption_threshold && finalConfidence > 0.3) {
                    handleInterruption('FinalTranscript', transcript);
                } else if (session.config.debug) {
                    console.log(`[Barge-in Logic] Ignored final: "${transcript}" (words: ${finalWords} < 3 OR conf: ${finalConfidence.toFixed(2)} <= 0.3)`);
                }
            }

            // Forward final transcript to UI
            transport.sendMessage?.('transcript', {
                payload: { role: 'user', text: transcript, final: true }
            });

            // Debounce & Lock
            if (session.lastProcessedTranscript === transcript && !session.processingTurn) return;
            if (session.processingTurn) return;

            session.lastProcessedTranscript = transcript;
            session.history.push({ role: 'user', content: transcript });

            session.processingTurn = true;
            session.turnStartTime = performance.now();
            console.log(`[Sharyx] 🔊 Starting Turn ${session.currentTurnId + 1}. AI Status: SPEAKING`);
            session.isAiSpeaking = true;
            transport.sendMessage?.('status_update', { payload: { status: 'Thinking', type: 'pipeline' } });

            try {
                await this.handleResponse(session, transport);
            } finally {
                session.processingTurn = false;
                transport.sendMessage?.('status_update', { payload: { status: 'Idle', type: 'pipeline' } });
            }
        });

        // TEXT CHAT INTEGRATION: Handle typed messages from UI
        transport.on('text', async (data: { text: string }) => {
            const text = data.text?.trim();
            if (!text || !this.isRunning) return;

            console.log(`[Sharyx] ⌨️ Text Input Received: "${text}"`);

            // 1. Interrupt AI if speaking
            handleInterruption('TextChat', text);

            // 2. Lock & Process
            if (session.processingTurn) return; // Prevent double-processing

            session.history.push({ role: 'user', content: text });
            session.processingTurn = true;
            session.turnStartTime = performance.now();
            session.isAiSpeaking = true;

            try {
                await this.handleResponse(session, transport);
            } finally {
                session.processingTurn = false;
            }
        });

        // Initial Greeting
        if (this.config.firstMessage) {
            session.history.push({ role: 'assistant', content: this.config.firstMessage });
            console.log('[Sharyx] 🔊 Starting initial greeting...');

            // Forward greeting to UI
            transport.sendMessage?.('transcript', {
                payload: { role: 'agent', text: this.config.firstMessage, final: true }
            });

            session.isAiSpeaking = true;
            try {
                transport.sendStart();
                await this.speak(session, transport, this.config.firstMessage);
                transport.sendMark('greeting_complete');
            } finally {
                if (session.currentTurnId === 0) session.isAiSpeaking = false;
            }
        }

        transport.on('close', () => {
            this.stop();
            sttStream.finish();
            if (session.liveTts) session.liveTts.close();

            // Final metrics check
            this.sendMetrics(session, transport);
        });
    }

    private sendMetrics(session: any, transport: VoiceTransport) {
        const duration = ((performance.now() - session.sessionStartTime) / 1000).toFixed(1);
        const avgLatency = session.latencies.length > 0
            ? (session.latencies.reduce((a: any, b: any) => a + b, 0) / session.latencies.length).toFixed(0)
            : 0;

        transport.sendMessage?.('metrics', {
            payload: {
                durationSec: parseFloat(duration),
                avgLatencyMs: parseInt(avgLatency as string),
                interruptCount: session.totalBargeIns,
                turnCount: session.currentTurnId
            }
        });
    }

    async stop() {
        this.isRunning = false;
    }

    private async handleResponse(session: any, transport: VoiceTransport) {
        const turnId = ++session.currentTurnId;
        const ttsContextId = `ctx_${session.id}_${turnId}`;

        session.activeTtsContextId = ttsContextId;
        session.firstAudioTime = 0;
        session.firstTokenTime = 0;

        let fullText = '';
        const liveTts = session.liveTts;

        transport.sendStart();
        const stream = this.config.llm.streamChat(session.history, { tools: this.config.tools });
        session.isAiSpeaking = true;

        let firstTokenTime = 0;
        let ttsSentFirst = false;
        let ttsBuffer = '';

        for await (const chunk of stream) {
            if (turnId !== session.currentTurnId) break;

            if (chunk.text) {
                if (firstTokenTime === 0) {
                    firstTokenTime = performance.now();
                    session.firstTokenTime = firstTokenTime;
                    const ttft = (firstTokenTime - session.turnStartTime).toFixed(0);
                    session.latencies.push(parseInt(ttft));
                    console.log(`[Latency] 🧠 Turn ${turnId} -> LLM (Transcript to First Token): ${ttft}ms`);

                    // STATUS: Agent is now speaking
                    transport.sendMessage?.('status_update', { payload: { status: 'Speaking', type: 'pipeline' } });
                }

                fullText += chunk.text;
                session.currentTurnLatency = (firstTokenTime - session.turnStartTime).toFixed(0);

                if (liveTts) {
                    // OPTIMIZATION: Buffer first few tokens to give TTS enough context to start fast/stable
                    if (!ttsSentFirst && fullText.length < 25) {
                        ttsBuffer += chunk.text;
                    } else if (!ttsSentFirst) {
                        liveTts.sendText(ttsBuffer + chunk.text, false, ttsContextId);
                        ttsSentFirst = true;
                    } else {
                        liveTts.sendText(chunk.text, false, ttsContextId);
                    }
                }
            }
        }

        if (turnId === session.currentTurnId) {
            if (liveTts) {
                if (!ttsSentFirst && ttsBuffer) {
                    liveTts.sendText(ttsBuffer, false, ttsContextId);
                }
                liveTts.sendText('', true, ttsContextId);

                // Wait for synthesis to fully complete or hit safety timeout
                const completionPromise = new Promise<void>((resolve) => {
                    session.completionResolvers.set(ttsContextId, resolve);
                    setTimeout(resolve, 2000); // 2s safety fallback
                });

                await completionPromise;

                if (turnId === session.currentTurnId) {
                    transport.sendMark(`turn_complete_${turnId}`);
                    session.isAiSpeaking = false;
                }
            } else {
                session.isAiSpeaking = false;
            }
            if (fullText) {
                session.history.push({ role: 'assistant', content: fullText });

                transport.sendMessage?.('transcript', {
                    payload: {
                        role: 'agent',
                        text: fullText,
                        final: true,
                        latency: session.currentTurnLatency
                    }
                });

                // Update metrics after each turn
                this.sendMetrics(session, transport);
            }
        }
    }

    private async speak(session: any, transport: VoiceTransport, text: string) {
        const audioChunks = this.config.tts.streamSpeech(text, {
            sampleRate: session.metadata?.sampleRate,
            encoding: session.metadata?.encoding
        });
        try {
            for await (const chunk of audioChunks) {
                if (session.isAiSpeaking) {
                    if (session.aiSpeechStartTime === 0) session.aiSpeechStartTime = performance.now();
                    transport.sendAudio(chunk);
                }
            }
        } catch (err) {
            console.error('[Sharyx] ❌ Speak Error (TTS Service):', err);
            transport.sendMessage?.('status_update', {
                payload: { status: 'TTS Error: Voice service unreachable', type: 'error' }
            });
        }
    }
}
