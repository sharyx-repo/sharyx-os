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
            completionResolvers: new Map<string, () => void>()
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
        session.bargeInCount = 0;

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

                session.bargeInCount++;
                console.log(`[Sharyx] 🚫 Barge-in #${session.bargeInCount} detected (${source})! Interrupting Turn ${session.currentTurnId}${transcript ? ` - "${transcript}"` : ''}`);
                
                // Atomic Stop Sequence
                transport.sendClear();
                session.isAiSpeaking = false;
                session.processingTurn = false; 
                session.aiSpeechStartTime = 0; // Reset
            }
        };

        // INSTANT VAD INTERRUPTION: Listen for SpeechStarted event
        sttStream.addListener(LiveTranscriptionEvents.SpeechStarted, () => {
            handleInterruption('VAD');
        });

        sttStream.addListener(LiveTranscriptionEvents.Transcript, async (data: any) => {
            const transcript = data.channel?.alternatives?.[0]?.transcript?.trim();
            if (!transcript) return;

            if (session.config.debug) {
                console.log(`[Sharyx Debug] Transcript: "${transcript}" (is_final: ${data.is_final}, isAiSpeaking: ${session.isAiSpeaking})`);
            }

            if (!data.is_final) {
                // Responsive Interruption: Interrupt on partial transcript if it meets word threshold
                const words = transcript.split(' ').length;
                if (words >= (session.config.interruption_threshold || 1)) {
                    handleInterruption(`PartialTranscript`, transcript);
                }
                return;
            }
            
            // Final Interruption
            handleInterruption('FinalTranscript', transcript);

            // Debounce & Lock
            if (session.lastProcessedTranscript === transcript && !session.processingTurn) return;
            if (session.processingTurn) return;

            session.lastProcessedTranscript = transcript;
            session.history.push({ role: 'user', content: transcript });
            
            session.processingTurn = true;
            session.turnStartTime = performance.now();
            console.log(`[Sharyx] 🔊 Starting Turn ${session.currentTurnId + 1}. AI Status: SPEAKING`);
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
                    console.log(`[Latency] 🧠 Turn ${turnId} -> LLM (Transcript to First Token): ${ttft}ms`);
                }

                fullText += chunk.text;

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
            if (fullText) session.history.push({ role: 'assistant', content: fullText });
        }
    }

    private async speak(session: any, transport: VoiceTransport, text: string) {
        const audioChunks = this.config.tts.streamSpeech(text, {
            sampleRate: session.metadata?.sampleRate,
            encoding: session.metadata?.encoding
        });
        for await (const chunk of audioChunks) {
            if (session.isAiSpeaking) {
                if (session.aiSpeechStartTime === 0) session.aiSpeechStartTime = performance.now();
                transport.sendAudio(chunk);
            }
        }
    }
}
