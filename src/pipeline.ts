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
          this.fsm.transition('TRANSCRIBING');
        }
      });
      console.info('[Pipeline] ✅ STT started');

      // 3. Speak first message if provided
      if (this.config.firstMessage) {
        console.info(`[Pipeline] Speaking first message: "${this.config.firstMessage}"`);
        await this.speak(this.config.firstMessage);
        this.fsm.transition('LISTENING');
      }

    } catch (error) {
      console.error('[Pipeline] Start failed', error);
      throw error;
    }
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
  private async handleUserUtterance(text: string): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      this.fsm.transition('THINKING');

      // ISSUE 6: Input Sanitization
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

      // ISSUE 2: Sentence-boundary streaming
      let currentSentence = '';
      const sentenceBoundaries = /[.!?\n]+/;

      for await (const chunk of this.config.llm.generate(messages)) {
        currentSentence += chunk;

        if (sentenceBoundaries.test(currentSentence)) {
          const parts = currentSentence.split(sentenceBoundaries);
          // The last part might be an incomplete sentence
          const readyToSpeak = parts.slice(0, -1).join(' ').trim();
          currentSentence = parts[parts.length - 1];

          if (readyToSpeak) {
            await this.speak(readyToSpeak);
          }
        }
      }

      // Handle any remaining text
      if (currentSentence.trim()) {
        await this.speak(currentSentence.trim());
      }

      this.fsm.transition('LISTENING');
    } catch (error) {
      console.error('[Pipeline] Error handling utterance', error);
      this.fsm.transition('LISTENING');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send text to TTS and pipe to transport
   */
  private async speak(text: string): Promise<void> {
    this.fsm.transition('SPEAKING');
    
    await this.config.tts.synthesize(text, (frame) => {
      // If user interrupted while synthesizing, this should be caught by barge-in
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
          console.info('[Pipeline] Barge-in detected! Interrupting...');
          
          // 1. Cancel TTS
          await this.config.tts.interrupt();
          
          // 2. Reset state
          this.isProcessing = false;
          this.fsm.transition('LISTENING');
        }
      });
    }
  }
}
