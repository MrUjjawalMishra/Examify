# Milestone 7 — AI integration

## 1) Goal

Add a secure, provider-independent AI integration layer for Examify.

This milestone includes:

- AI adapter pattern for multiple providers
- document processing for PDFs, DOCX, text, and image uploads
- draft question generation and suggestion workflows
- suggested grading and explanation support
- read-only dashboards summarization and assistant workflows
- explicit human approval for consequential actions
- usage guards, privacy controls, and failure handling

The critical rule is simple: AI is never allowed to publish, grade final answers, send large announcements, change permissions, or take consequential actions without explicit human review and permission.

## 2) Prerequisites

Before starting this milestone:

- Milestones 3, 4, 5, and 6 foundations are in place or planned
- school data remains synthetic and isolated
- the database schema has school_id on every relevant table
- auth and role checks are designed for server-side enforcement
- no real student data or private files are used in the prototype

## 3) Cost

Expected cost:

- AI provider usage is optional and should not be enabled until approved
- local development remains free
- Cloudflare and Supabase remain in their free or low-cost prototype tiers
- no production AI workload should be enabled without explicit budget approval

Billing risks:

- AI APIs can be charged per request, token, or model usage
- document processing and OCR workflows can increase cost quickly
- AI usage limits and quotas may change without warning
- do not connect a paid provider during the prototype stage without explicit approval

## 4) Exact steps

1. Define the AI adapter contract
   - create an interface with methods for question generation, document extraction, and summarization
   - provider-specific logic lives behind the adapter
   - all calls go through a single wrapper so the app can swap models later

2. Add a mock AI provider first
   - implement a synthetic provider that returns deterministic demo responses
   - keep this in place until a real provider is approved
   - mock replies should be clearly labeled as demo content

3. Build the document ingestion workflow
   - teacher uploads PDF, DOCX, text, or image file
   - upload is stored in a school-scoped storage path
   - system extracts text or metadata in a read-only draft workflow
   - teacher reviews the extracted content before using it

4. Add AI draft generation for questions
   - AI can suggest questions from uploaded content or existing question bank
   - teacher can accept, reject, or edit the suggestions
   - only approved content can be inserted into a question bank or exam

5. Add AI-assisted grading support
   - AI can suggest marks for short/long answers
   - suggested grade is shown as provisional only
   - teacher must explicitly approve before it becomes final

6. Add assistant tasks for teacher dashboard
   - draft summary of pending queries
   - draft performance summary by subject
   - draft announcement text for groups
   - safe, read-only suggestions only

7. Add approval gates for consequential actions
   - publish exam
   - change marks
   - send large group message
   - change permissions
   - issue official warnings
   - each requires a human confirmation step and a role check

8. Add privacy and safety controls
   - no AI provider should see raw student data unless approved and necessary
   - keep prompts and file content inside school-scoped controlled paths
   - redact sensitive content before sending to third-party AI if required

9. Add failure handling and rate limiting
   - retry logic for transient errors
   - safe fallback to a mock provider when real provider fails
   - log failures and timeouts for teacher review

10. Verify the workflow

- AI suggestions appear as drafts only
- teacher approval is required before finalization
- cross-school access is blocked under all AI-assisted tasks

## 5) Code files

### apps/workers/src/ai/types.ts

```ts
export type AIProvider = "mock" | "openai" | "anthropic" | "custom";

export type AIDraftRequest = {
  schoolId: string;
  userId: string;
  prompt: string;
  context?: Record<string, unknown>;
};

export type AIResponse = {
  ok: boolean;
  provider: AIProvider;
  content?: string;
  suggestions?: string[];
  error?: string;
};
```

### apps/workers/src/ai/provider.ts

```ts
import type { AIResponse, AIDraftRequest, AIProvider } from "./types";

export class AIAdapter {
  provider: AIProvider;

  constructor(provider: AIProvider = "mock") {
    this.provider = provider;
  }

  async generateDraft(request: AIDraftRequest): Promise<AIResponse> {
    if (this.provider === "mock") {
      return {
        ok: true,
        provider: "mock",
        content: "Draft AI suggestion: review this question before publishing.",
        suggestions: [
          "Use a shorter answer format",
          "Add one conceptual check question",
        ],
      };
    }

    return {
      ok: false,
      provider: this.provider,
      error: "Real AI provider not configured yet.",
    };
  }
}
```

### apps/workers/src/ai/approvalGate.ts

```ts
export function requiresApproval(action: string): boolean {
  return [
    "publish_exam",
    "change_marks",
    "send_group_message",
    "change_permissions",
    "issue_warning",
  ].includes(action);
}
```

### apps/web/src/features/ai/AIAssistantPanel.tsx

```tsx
export function AIAssistantPanel() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
            AI assistant
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Draft suggestions
          </h2>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
          Approval needed
        </span>
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <p className="text-sm text-slate-700">
          Suggested question: "Explain the difference between mitosis and
          meiosis in one paragraph."
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Approve
        </button>
        <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
          Edit
        </button>
        <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
          Reject
        </button>
      </div>
    </div>
  );
}
```

## 6) Configuration

Required variables:

- `AI_PROVIDER` = `mock` initially
- `OPENAI_API_KEY` only after provider approval
- `ANTHROPIC_API_KEY` only after provider approval
- `APP_ENV`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Where to set them:

- local env file for early testing
- Cloudflare Worker or server environment for production paths
- never in GitHub or frontend source files

## 7) Commands

Run frontend validation:

```bash
cd /workspaces/Examify/apps/web
npm run build
npm run lint
```

If the AI Worker layer is added:

```bash
cd /workspaces/Examify/apps/workers
npm install
npm run build
```

## 8) Verification

Expected results:

- AI adapter exists and supports mock mode
- draft suggestions appear without final publishing rights
- teacher approval is clearly required before final action
- no consequential action can happen without a review gate
- cross-school data remains isolated under AI-assisted workflows
- AI errors are handled gracefully and logged

## 9) Troubleshooting

Problem: AI provider not configured

- likely cause: provider credentials are missing or unapproved
- fix: keep the mock provider active and do not enable the real provider until you approve the budget and security review

Problem: draft suggestions are accidentally treated as final answers

- likely cause: approval gate not enforced in the UI or API
- fix: add server-side validation and explicit human approval state before finalization

Problem: AI sees sensitive student data

- likely cause: provider is connected too early or prompts include student identifiers unnecessarily
- fix: use school-scoped contexts only and redact identifying fields before external AI calls

Problem: failure handling is silent

- likely cause: no fallback or error logging
- fix: add fallback to mock mode and log provider failures to a secure audit trail

## 10) Security check

Before moving to production, confirm:

- AI is never finalizing or publishing anything without approval
- any AI provider stays behind a secure server-side route
- no secret API keys are in the frontend or GitHub
- prompts are limited to approved data
- school-level isolation applies to AI outputs and storage paths
- AI-generated grades are not published as final without an explicit review step
- requests and failures are logged for audit and debugging

## 11) GitHub checkpoint

Before continuing:

```bash
cd /workspaces/Examify
git add .
git commit -m "feat: add AI adapter and approval gate foundation"
git push origin main
```

Then confirm:

```bash
git status
git log -1
```

## 12) Completion checklist

- [ ] AI adapter contract defined
- [ ] mock provider implemented
- [ ] document draft flow designed
- [ ] AI grading approval flow defined
- [ ] approval gates implemented for consequential actions
- [ ] provider secrets kept out of source control
- [ ] usage and privacy protections documented
- [ ] GitHub checkpoint completed

## 13) Next step

The next step is Milestone 8: Security, performance, and pilot.

This milestone focuses on:

- auth and permission tests
- input validation and file upload checks
- tenant isolation verification
- rate limit and recovery testing
- load testing and bottleneck discovery
- pilot readiness with synthetic data only

These checks must pass before any production readiness claims are made.
