const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
]);

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export interface FileUploadCandidate {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export function validateUpload(file: FileUploadCandidate): { valid: boolean; reason?: string } {
  if (!file.fileName || file.fileName.includes('..') || file.fileName.includes('/') || file.fileName.includes('\\')) {
    return { valid: false, reason: 'Invalid file name or path traversal detected' };
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    return { valid: false, reason: `Unsupported file type: ${file.mimeType}` };
  }
  if (file.sizeBytes <= 0 || file.sizeBytes > MAX_UPLOAD_BYTES) {
    return { valid: false, reason: 'File size must be between 1 byte and 10 MB' };
  }
  return { valid: true };
}

export function sanitizeTextInput(input: string, maxLength = 5000): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, (ch) => (ch === '<' ? '&lt;' : '&gt;'))
    .trim()
    .slice(0, maxLength);
}

export class SlidingWindowRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly maxRequests: number, private readonly windowMs: number) {}

  allow(key: string, nowMs = Date.now()): boolean {
    const windowStart = nowMs - this.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    if (timestamps.length >= this.maxRequests) {
      this.hits.set(key, timestamps);
      return false;
    }
    timestamps.push(nowMs);
    this.hits.set(key, timestamps);
    return true;
  }
}

export function getSecurityHeaders(allowedOrigin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}