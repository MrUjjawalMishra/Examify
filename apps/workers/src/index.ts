import { MockAIProvider } from './ai';
import { calculateStudentAnalytics } from './analytics';
import { getSecurityHeaders, SlidingWindowRateLimiter, validateUpload } from './security-hardening';

export interface Env {
  ENVIRONMENT?: string;
  AI_PROVIDER_MODE?: string;
  ALLOWED_ORIGIN?: string;
}

const limiter = new SlidingWindowRateLimiter(120, 60_000);
const aiAdapter = new MockAIProvider();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN ?? '*';
    const headers = {
      'Content-Type': 'application/json',
      ...getSecurityHeaders(origin),
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'local';
    if (!limiter.allow(clientIp)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), {
        status: 429,
        headers,
      });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          service: 'examify-workers-api',
          status: 'ok',
          environment: env.ENVIRONMENT ?? 'development',
          aiMode: env.AI_PROVIDER_MODE ?? aiAdapter.providerName,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers }
      );
    }

    if (url.pathname === '/api/ai/draft-questions' && request.method === 'POST') {
      const body = (await request.json()) as { sourceText?: string; subject?: string };
      const drafts = await aiAdapter.generateQuestionDrafts(
        body.sourceText ?? '',
        body.subject ?? 'Computer Science'
      );
      return new Response(JSON.stringify({ provider: aiAdapter.providerName, drafts }), {
        status: 200,
        headers,
      });
    }

    if (url.pathname === '/api/uploads/validate' && request.method === 'POST') {
      const file = (await request.json()) as { fileName: string; mimeType: string; sizeBytes: number };
      const check = validateUpload(file);
      return new Response(JSON.stringify(check), { status: check.valid ? 200 : 400, headers });
    }

    if (url.pathname === '/api/analytics/student-preview' && request.method === 'POST') {
      const body = (await request.json()) as { records: Parameters<typeof calculateStudentAnalytics>[0] };
      const summary = calculateStudentAnalytics(body.records ?? []);
      return new Response(JSON.stringify(summary), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers });
  },
};