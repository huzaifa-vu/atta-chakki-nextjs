/**
 * QR Code Parsing and Audio/Haptic Feedback Utilities
 */

export interface ParsedQRResult {
  orderId: string | null;
  code: string | null;
  rawText: string;
}

/**
 * Robust extractor for QR codes across the application.
 * Handles:
 * - Direct tracking root URLs: https://domain/?track=<uuid>
 * - Legacy URLs: https://domain/track?id=<uuid>&code=<pin>
 * - Raw UUID strings
 * - 4-digit PIN codes
 */
export function extractOrderInfoFromQR(decodedText: string): ParsedQRResult {
  const rawText = (decodedText || '').trim();
  if (!rawText) {
    return { orderId: null, code: null, rawText };
  }

  // 1. Try URL parsing if it looks like a URL or query string
  if (
    rawText.includes('://') ||
    rawText.includes('?') ||
    rawText.includes('/') ||
    rawText.includes('&')
  ) {
    try {
      const urlString = rawText.startsWith('http://') || rawText.startsWith('https://')
        ? rawText
        : `https://${rawText}`;
      const url = new URL(urlString);

      // Check track or id parameter
      const trackParam = url.searchParams.get('track');
      const idParam = url.searchParams.get('id');
      const codeParam = url.searchParams.get('code');

      const extractedId = trackParam || idParam || null;

      // Also check if path ends with a UUID (e.g. /track/uuid or /order/uuid)
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1] || '';
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (extractedId && uuidRegex.test(extractedId)) {
        return { orderId: extractedId, code: codeParam, rawText };
      }

      if (uuidRegex.test(lastSegment)) {
        return { orderId: lastSegment, code: codeParam, rawText };
      }

      if (extractedId) {
        return { orderId: extractedId, code: codeParam, rawText };
      }
    } catch {
      // Fall through to regex matching
    }
  }

  // 2. Check for standalone UUID format
  const standaloneUuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const uuidMatch = rawText.match(standaloneUuidRegex);
  if (uuidMatch) {
    return { orderId: uuidMatch[0], code: null, rawText };
  }

  // 3. Check for standalone 4-digit PIN
  if (/^\d{4}$/.test(rawText)) {
    return { orderId: null, code: rawText, rawText };
  }

  return { orderId: null, code: null, rawText };
}

/**
 * Triggers a subtle audio chime (Web Audio API) and mobile haptic vibration
 * for snappy native-feeling QR scan feedback.
 */
export function playSuccessFeedback() {
  if (typeof window === 'undefined') return;

  // 1. Mobile Haptic vibration (50ms pulse)
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(60);
    }
  } catch {
    // Ignore vibration restrictions
  }

  // 2. Subtle Web Audio synthesizer chime
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Pleasant positive 2-step chime: D5 (587.33Hz) -> A5 (880Hz)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch {
    // Ignore autoplay or audio policy issues
  }
}
