import { createHmac } from 'crypto';

/**
 * Validates Twilio webhook signatures
 * @param authToken Twilio Auth Token
 * @param signature X-Twilio-Signature header
 * @param url Full webhook URL including query params
 * @param params POST parameters
 * @returns boolean
 */
export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, any>
): boolean {
  // 1. Sort the params alphabetically by key
  const keys = Object.keys(params).sort();
  
  // 2. Concatenate key/value pairs to the URL
  let data = url;
  for (const key of keys) {
    data += key + params[key];
  }

  // 3. Compute HMAC-SHA1
  const hash = createHmac('sha1', authToken)
    .update(data)
    .digest('base64');

  return hash === signature;
}

/**
 * Express middleware for Twilio validation
 */
export function twilioValidator(authToken: string) {
  return (req: any, res: any, next: any): void => {
    const signature = req.headers['x-twilio-signature'] as string;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['host'];
    const url = `${protocol}://${host}${req.originalUrl}`;

    if (validateTwilioSignature(authToken, signature, url, req.body)) {
      next();
    } else {
      res.status(403).send('Invalid Twilio Signature');
    }
  };
}
