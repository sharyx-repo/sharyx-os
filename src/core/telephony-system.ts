import { EventEmitter } from 'events';
import { VoiceTransport, CallMetadata } from '../interfaces/transport';
import { ChatMessage } from '../interfaces/llm';
import { VoiceAgentConfig } from './types';

/**
 * TELEPHONY SERVICE
 * Handles outbound call initiation for Plivo and Twilio.
 */
export class TelephonyService {
  constructor(private config: { 
    plivo?: { authId: string, authToken: string, from: string },
    twilio?: { accountSid: string, authToken: string, from: string }
  }) {}

  async initiateOutboundCall(provider: 'plivo' | 'twilio', to: string, answerUrl: string): Promise<{ callSid: string }> {
    if (provider === 'plivo') {
      const { authId, authToken, from } = this.config.plivo || {};
      if (!authId || !authToken || !from) throw new Error('Plivo credentials missing');

      const response = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          answer_url: answerUrl,
          answer_method: 'POST',
        }),
      });

      const data: any = await response.json();
      if (!response.ok) throw new Error(`Plivo API Error: ${data.error || data.message}`);
      return { callSid: data.request_uuid };
    } else if (provider === 'twilio') {
      const { accountSid, authToken, from } = this.config.twilio || {};
      if (!accountSid || !authToken || !from) throw new Error('Twilio credentials missing');

      const params = new URLSearchParams();
      params.append('To', to);
      params.append('From', from);
      params.append('Url', answerUrl);
      params.append('Method', 'POST');

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data: any = await response.json();
      if (!response.ok) throw new Error(`Twilio API Error: ${data.message || response.statusText}`);
      return { callSid: data.sid };
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}

/**
 * TELEPHONY CONTROLLERS
 * Handles the HTTP/XML logic for handshakes.
 */
export class TelephonyControllers {
  static generatePlivoXml(streamUrl: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true" sampleRate="8000" encoding="l16">${streamUrl}</Stream>
    <Wait length="3600" />
</Response>`.trim();
  }

  static generateTwilioTwiML(streamUrl: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${streamUrl}" />
    </Connect>
</Response>`.trim();
  }
}
