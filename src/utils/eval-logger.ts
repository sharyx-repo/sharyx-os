import * as fs from 'fs';
import * as path from 'path';

export interface EvalMetric {
    sessionId: string;
    latencyMs: number;
    success: boolean;
    turnCount: number;
    tokensTotal?: number;
}

export class EvalLogger {
    private logFile: string;

    constructor(logDir: string = './logs') {
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
        this.logFile = path.join(logDir, 'eval-metrics.jsonl');
    }

    logMetric(metric: EvalMetric) {
        const entry = JSON.stringify({
            timestamp: new Date().toISOString(),
            ...metric
        }) + '\n';
        fs.appendFileSync(this.logFile, entry);
    }

    logConversation(sessionId: string, transcript: any[]) {
        const conversationDir = path.join(path.dirname(this.logFile), 'conversations');
        if (!fs.existsSync(conversationDir)) fs.mkdirSync(conversationDir);
        
        fs.writeFileSync(
            path.join(conversationDir, `${sessionId}.json`),
            JSON.stringify(transcript, null, 2)
        );
    }
}
