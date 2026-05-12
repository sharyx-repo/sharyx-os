import { 
  AgentConfig, 
  ConversationState, 
  ITransport, 
  Message 
} from './types';
import { ConversationFSM } from './fsm';
import { inputSanitizer } from '@/security/inputSanitizer';

/**
 * Core orchestration engine for real-time voice AI
 */
export class VoicePipeline {
  private fsm: ConversationFSM;
  private config: AgentConfig;
  private transport: ITransport;
  private conversationId: string;
  private isProcessing: boolean = false;

  constructor(config: AgentConfig, transport: ITransport, conversationId: string = 'default') {
    this.config = config;
    this.transport = transport;
    this.conversationId = conversationId;
    this.fsm = new ConversationFSM();

    this.setupBargeIn();
  }

  /**
   * Initialize and start the pipeline
   */
  public async start(): Promise<void> {
    try {
      this.fsm.transition('LISTENING');

      // 1. Start the transport first so the WebSocket is wired up
      await this.transport.start((audio) => {
        this.config.stt.sendAudio(audio);
      });
      console.info('[Pipeline] ✅ Transport started');

      // 2. Start STT (connect to Deepgram)
      await this.config.stt.start(async (text, isFinal) => {
        if (isFinal) {
          console.info(`[Pipeline] Final transcript: "${text}"`);
          await this.handleUserUtterance(text);
        } else {
          // INTERRUPT ON SPEECH: If we're talking and user starts speaking, stop immediately
          if (this.fsm.getState() === 'SPEAKING' || this.fsm.getState() === 'THINKING') {
            console.info('[Pipeline] Speech detected! Interrupting...');
            await this.interrupt();
          }
          this.fsm.transition('TRANSCRIBING');
        }
      });
      console.info('[Pipeline] ✅ STT started');

      // 3. Speak first message if provided
      if (this.config.firstMessage) {
        console.info(`[Pipeline] Speaking first message: "${this.config.firstMessage}"`);
        await this.speak(this.config.firstMessage);
        if (this.fsm.getState() === 'SPEAKING') {
          this.fsm.transition('LISTENING');
        }
      }

    } catch (error) {
      console.error('[Pipeline] Start failed', error);
      throw error;
    }
  }

  /**
   * Internal interrupt logic to stop current AI activity
   */
  private async interrupt(): Promise<void> {
    // 1. Cancel TTS
    await this.config.tts.interrupt();

    // 2. Clear Transport/Client Audio
    if (this.transport.clearAudio) {
      this.transport.clearAudio();
    }
    
    // 3. Clear Queue
    this.speechQueue = [];
    this.isSpeaking = false;
    this.isProcessing = false;
  }

  /**
   * Stop all components and cleanup
   */
  public async stop(): Promise<void> {
    try {
      await this.config.stt.stop();
    } catch (e) { /* ignore */ }
    try {
      await this.transport.stop();
    } catch (e) { /* ignore */ }
    this.fsm.transition('IDLE');
  }

  /**
   * Handle user input with sanitization and LLM streaming
   */
  private speechQueue: string[] = [];
  private isSpeaking: boolean = false;

  private sessionCounter: number = 0;

  /**
   * Handle user input with sanitization and LLM streaming
   */
  private async handleUserUtterance(text: string): Promise<void> {
    // If we're already doing something, interrupt it first
    if (this.isProcessing) {
      console.info('[Pipeline] Interrupted by new final utterance');
      await this.interrupt();
    }
    
    this.isProcessing = true;
    
    // Each utterance starts a new session to handle interruptions
    this.sessionCounter++;
    const currentSession = this.sessionCounter;

    try {
      // If we interrupted, we are already in TRANSCRIBING or LISTENING
      if (this.fsm.getState() !== 'TRANSCRIBING') {
        this.fsm.transition('THINKING');
      }

      const sanitizedText = inputSanitizer(text);
      
      await this.config.memory.appendMessage(this.conversationId, {
        role: 'user',
        content: sanitizedText
      });

      const history = await this.config.memory.getHistory(this.conversationId);
      const messages: Message[] = [
        { role: 'system', content: this.config.systemPrompt },
        ...history
      ];

      let currentSentence = '';
      const sentenceBoundaries = /[.!?\n]/;

      for await (const chunk of this.config.llm.generate(messages)) {
        // If session changed (interrupted), stop this loop immediately
        if (this.sessionCounter !== currentSession) {
          console.debug('[Pipeline] Session changed, stopping LLM loop');
          return;
        }

        currentSentence += chunk;

        if (sentenceBoundaries.test(currentSentence)) {
          const lastChar = currentSentence.charAt(currentSentence.length - 1);
          if (/[.!?\n]/.test(lastChar)) {
            const sentence = currentSentence.trim();
            if (sentence.length > 0) {
              this.enqueueSpeech(sentence);
              currentSentence = '';
            }
          }
        }
      }

      if (currentSentence.trim()) {
        this.enqueueSpeech(currentSentence.trim());
      }
    } catch (error) {
      console.error('[Pipeline] Error handling utterance', error);
      this.isProcessing = false;
      this.fsm.transition('LISTENING');
    }
  }

  private enqueueSpeech(text: string): void {
    this.speechQueue.push(text);
    this.processSpeechQueue();
  }

  private async processSpeechQueue(): Promise<void> {
    if (this.isSpeaking || this.speechQueue.length === 0) {
      if (this.speechQueue.length === 0 && !this.isSpeaking) {
        this.isProcessing = false;
        if (this.fsm.getState() !== 'LISTENING') {
          this.fsm.transition('LISTENING');
        }
      }
      return;
    }

    this.isSpeaking = true;
    const text = this.speechQueue.shift();

    if (text) {
      try {
        await this.speak(text);
      } catch (error) {
        console.error('[Pipeline] Speech error:', error);
      }
    }

    this.isSpeaking = false;
    this.processSpeechQueue();
  }

  /**
   * Send text to TTS and pipe to transport
   */
  private async speak(text: string): Promise<void> {
    this.fsm.transition('SPEAKING');
    
    await this.config.tts.synthesize(text, (frame) => {
      if (this.fsm.getState() === 'SPEAKING') {
        this.transport.sendAudio(frame.data);
      }
    });
  }

  /**
   * ISSUE 3: Barge-in handling
   */
  private setupBargeIn(): void {
    if (this.transport.onBargeIn) {
      this.transport.onBargeIn(async () => {
        if (this.fsm.getState() === 'SPEAKING' || this.fsm.getState() === 'THINKING') {
          console.info('[Pipeline] Barge-in detected via transport! Interrupting...');
          this.sessionCounter++; // Invalidate current session
          await this.interrupt();
          this.fsm.transition('LISTENING');
        }
      });
    }
  }
}
