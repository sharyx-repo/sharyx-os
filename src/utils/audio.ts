/**
 * Audio Utility for Telephony Conversions
 */

/**
 * Converts 16-bit Linear PCM (L16) to 8-bit Mu-law (G.711).
 * Expects input buffer to be little-endian 16-bit signed integers.
 */
export function linear16ToMulaw(pcm: Buffer): Buffer {
    const muLaw = Buffer.alloc(pcm.length / 2);
    
    for (let i = 0, j = 0; i < pcm.length; i += 2, j++) {
        // Read 16-bit sample (LE)
        let sample = pcm.readInt16LE(i);
        
        muLaw[j] = encodeMuLawSample(sample);
    }
    
    return muLaw;
}

/**
 * Mu-law encoding logic for a single 16-bit sample.
 */
function encodeMuLawSample(sample: number): number {
    const SIGN_BIT = 0x80;
    const QUANT_MASK = 0xf;
    const SEG_MASK = 0x70;
    const SEG_SHIFT = 4;
    const BIAS = 0x84;

    let sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    sample += BIAS;

    if (sample > 32635) sample = 32635;

    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--) {
        expMask >>= 1;
    }

    let mantissa = (sample >> (exponent + 3)) & QUANT_MASK;
    let digit = sign | (exponent << SEG_SHIFT) | mantissa;

    return ~(digit) & 0xff;
}
