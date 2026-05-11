/**
 * Patterns commonly used in prompt injection attacks
 */
const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /system prompt/i,
  /you are now/i,
  /new role/i,
  /stop being/i,
  /dan mode/i,
  /as an unrestricted/i,
  /<script/i,
  /javascript:/i,
];

/**
 * Sanitizes user input to prevent prompt injection
 * @param input Raw user transcript
 * @returns Sanitized or flagged string
 */
export function inputSanitizer(input: string): string {
  let sanitized = input.trim();

  // 1. Check for known injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      console.warn(`[Security] Potential prompt injection detected: ${sanitized}`);
      // Strategy: Neutralize the input by wrapping it or returning a safe version
      return `[BLOCKED CONTENT]: ${sanitized.replace(/[<>]/g, '')}`;
    }
  }

  // 2. Basic character cleaning (remove non-printable characters)
  sanitized = sanitized.replace(/[^\x20-\x7E\n]/g, '');

  return sanitized;
}
