import * as crypto from 'crypto';

/**
 * Verify Twilio Webhook Signatures manually (without SDK)
 * Logic:
 * 1. Take the full URL (including query params)
 * 2. If it's a POST, sort all form parameters alphabetically
 * 3. Concatenate them to the end of the URL (keyvaluekeyvalue...)
 * 4. HMAC-SHA1 the string with the Auth Token
 * 5. Compare the base64 result with X-Twilio-Signature
 */
export function verifyTwilioSignature(
    authToken: string,
    signature: string,
    url: string,
    params: Record<string, string> = {}
): boolean {
    // 1. Sort parameters alphabetically
    const sortedKeys = Object.keys(params).sort();
    
    // 2. Build the string to hash
    let data = url;
    for (const key of sortedKeys) {
        data += key + params[key];
    }

    // 3. Generate HMAC-SHA1
    const expectedSignature = crypto
        .createHmac('sha1', authToken)
        .update(Buffer.from(data, 'utf-8'))
        .digest('base64');

    // 4. Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf-8'),
        Buffer.from(expectedSignature, 'utf-8')
    );
}
