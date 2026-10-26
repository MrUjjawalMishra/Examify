import { describe, expect, it } from 'vitest';
import { MockAIProvider, redactStudentPIIForAI } from '../src/ai';

describe('Provider-Independent AI Layer & Privacy', () => {
  it('generates draft questions flagged for mandatory teacher approval', async () => {
    const ai = new MockAIProvider();
    const drafts = await ai.generateQuestionDrafts('SQL primary keys and foreign keys enforce relational integrity.', 'CS');
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((d) => d.requiresTeacherApproval === true)).toBe(true);
  });

  it('strips student PII before sending payloads to external AI adapters', () => {
    const sanitized = redactStudentPIIForAI({
      studentName: 'Aarav Verma',
      email: 'aarav@demo.edu',
      answerText: 'Binary search divides sorted arrays in half.',
    });
    expect(sanitized).not.toHaveProperty('studentName');
    expect(sanitized).not.toHaveProperty('email');
    expect(sanitized).toHaveProperty('answerText');
  });
});