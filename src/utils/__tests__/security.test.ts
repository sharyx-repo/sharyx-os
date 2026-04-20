import { describe, it, expect } from 'vitest';
import { verifyTwilioSignature } from '../security';

describe('verifyTwilioSignature', () => {
  const authToken = '12345';
  const url = 'https://mycompany.com/twiml';
  const signature = 'a9n8Y/qWv9Z3Yc+ZpY8YyUv8m9A='; // This depends on the hash logic
  const params = {
    CallSid: 'CA1234567890abcdef1234567890abcdef',
    From: '+15551234567',
    To: '+15557654321'
  };

  it('should verify a valid signature', () => {
    // We need to calculate the expected signature for our test case
    // 1. URL + params string
    // Sorted keys: CallSid, From, To
    const data = url + 'CallSid' + params.CallSid + 'From' + params.From + 'To' + params.To;
    const crypto = require('crypto');
    const expected = crypto
      .createHmac('sha1', authToken)
      .update(Buffer.from(data, 'utf-8'))
      .digest('base64');

    const result = verifyTwilioSignature(authToken, expected, url, params);
    expect(result).toBe(true);
  });

  it('should fail for an invalid signature', () => {
    const result = verifyTwilioSignature(authToken, 'invalid-signature', url, params);
    expect(result).toBe(false);
  });

  it('should fail if parameters are tampered with', () => {
    const data = url + 'CallSid' + params.CallSid + 'From' + params.From + 'To' + params.To;
    const crypto = require('crypto');
    const expected = crypto
      .createHmac('sha1', authToken)
      .update(Buffer.from(data, 'utf-8'))
      .digest('base64');

    const tamperedParams = { ...params, From: '+19999999999' };
    const result = verifyTwilioSignature(authToken, expected, url, tamperedParams);
    expect(result).toBe(false);
  });
});
