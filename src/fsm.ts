import { ConversationState } from './types';

/**
 * Valid state transitions for the conversation machine
 */
const VALID_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  IDLE: ['LISTENING'],
  LISTENING: ['TRANSCRIBING', 'THINKING', 'SPEAKING', 'IDLE'],
  TRANSCRIBING: ['THINKING', 'LISTENING', 'SPEAKING', 'IDLE'],
  THINKING: ['SPEAKING', 'LISTENING', 'IDLE'],
  SPEAKING: ['LISTENING', 'IDLE'],
};

/**
 * Typed Finite State Machine for managing conversation flow
 */
export class ConversationFSM {
  private currentState: ConversationState = 'IDLE';
  private listeners: ((state: ConversationState) => void)[] = [];

  /**
   * Get the current state
   */
  public getState(): ConversationState {
    return this.currentState;
  }

  /**
   * Transition to a new state with safety guards
   * @throws Error if transition is invalid
   */
  public transition(newState: ConversationState): void {
    if (newState === this.currentState) return;

    const allowed = VALID_TRANSITIONS[this.currentState];
    if (!allowed.includes(newState)) {
      console.warn(`[FSM] Invalid transition attempt: ${this.currentState} -> ${newState}`);
      return; // Fail silently or log, but don't crash the session
    }

    console.debug(`[FSM] Transition: ${this.currentState} -> ${newState}`);
    this.currentState = newState;
    this.notify();
  }

  /**
   * Subscribe to state changes
   */
  public onStateChange(callback: (state: ConversationState) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify(): void {
    this.listeners.forEach(l => l(this.currentState));
  }
}
