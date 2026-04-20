export interface WorkflowContext {
    sessionId: string;
    history: any[];
    metadata: any;
    state: Record<string, any>;
}

export interface WorkflowResult {
    nextMessage?: string;
    isComplete?: boolean;
    stateUpdates?: Record<string, any>;
}

export interface AgentWorkflow {
    name: string;
    description: string;
    triggerIntents: string[];
    
    /**
     * Called when the workflow is triggered or on each turn while active.
     */
    execute(input: string, context: WorkflowContext): Promise<WorkflowResult>;
}
