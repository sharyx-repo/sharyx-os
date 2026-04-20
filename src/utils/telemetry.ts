import { TelemetryProvider, MetricEvent, ErrorEvent } from '../interfaces/telemetry';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Standard Telemetry provider that logs to console and a JSONL file.
 */
export class SharyxTelemetry implements TelemetryProvider {
    private logFile: string;

    constructor(logDir: string = './logs') {
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        this.logFile = path.join(logDir, 'telemetry.jsonl');
    }

    recordMetric(event: MetricEvent): void {
        const payload = {
            type: 'metric',
            timestamp: event.timestamp || Date.now(),
            ...event
        };

        // Console log for immediate visibility in debug mode
        const logMsg = `[Telemetry] 📊 Metric: ${event.name} = ${event.value}${event.unit} (${event.sessionId || 'global'})`;
        console.log(logMsg);

        // Persistent log
        this.save(payload);
    }

    recordError(event: ErrorEvent): void {
        const payload = {
            type: 'error',
            timestamp: event.timestamp || Date.now(),
            ...event
        };

        console.error(`[Telemetry] ❌ Error [${event.provider}]: ${event.error} (${event.sessionId || 'global'})`);
        
        this.save(payload);
    }

    private save(data: any): void {
        try {
            fs.appendFileSync(this.logFile, JSON.stringify(data) + '\n');
        } catch (err) {
            console.error('[Telemetry] Failed to write to log file:', err);
        }
    }
}
