export interface MemoryStore {
  /** Get or create a session for a call */
  getSession(sessionId: string): Promise<CallSession> | CallSession;

  /** Update session data (e.g., adding messages) */
  saveSession(session: CallSession): Promise<void> | void;

  /** Destroy session data when the call ends */
  deleteSession(sessionId: string): Promise<void> | void;
}

export interface CallSession {
  sessionId: string;
  dynamicMemory: Record<string, string>;
  conversationSummary: string;
  messages: MemoryMessage[];
  createdAt: number;
}

export interface MemoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
