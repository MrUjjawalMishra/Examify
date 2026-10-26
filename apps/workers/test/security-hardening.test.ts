import { describe, expect, it } from 'vitest';
import { sanitizeTextInput, SlidingWindowRateLimiter, validateUpload } from '../src/security-hardening';

describe('Upload Validation, Input Sanitization & Rate Limiting', () => {
  it('accepts safe PDF and image uploads under 10MB', () => {
    expect(
      validateUpload({ fileName: 'chapter1_notes.pdf', mimeType: 'application/pdf', sizeBytes: 1_200_000 }).valid
    ).toBe(true);
  });

  it('rejects path traversal and executable files', () => {
    expect(
      validateUpload({ fileName: '../secrets.env', mimeType: 'text/plain', sizeBytes: 200 }).valid
    ).toBe(false);
    expect(
      validateUpload({ fileName: 'payload.exe', mimeType: 'application/x-msdownload', sizeBytes: 4000 }).valid
    ).toBe(false);
  });

  it('strips inline script tags from user inputs', () => {
    const dirty = 'Hello <script>alert("xss")</script> Class 9C';
    expect(sanitizeTextInput(dirty)).toBe('Hello  Class 9C');
  });

  it('enforces sliding window rate limits', () => {
    const limiter = new SlidingWindowRateLimiter(2, 10_000);
    expect(limiter.allow('ip-1', 1000)).toBe(true);
    expect(limiter.allow('ip-1', 2000)).toBe(true);
    expect(limiter.allow('ip-1', 3000)).toBe(false);
  });
});