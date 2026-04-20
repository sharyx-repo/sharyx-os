export interface MetricEvent {
    name: string;
    value: number;
    unit: 'ms' | 'tokens' | 'count';
    labels?: Record<string, string>;
    sessionId?: string;
    timestamp?: number;
}

export interface ErrorEvent {
    provider: string;
    error: string;
    code?: string;
    sessionId?: string;
    timestamp?: number;
}

export interface TelemetryProvider {
    /** Record a numeric metric (e.g. latency) */
    recordMetric(event: MetricEvent): void;
    
    /** Record a system or provider error */
    recordError(event: ErrorEvent): void;
    
    /** Flush logs/metrics to external storage if applicable */
    flush?(): Promise<void>;
}
