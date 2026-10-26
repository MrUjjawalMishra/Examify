import { describe, expect, it } from 'vitest';
import { calculateStudentAnalytics } from '../src/analytics';

describe('Documented Analytics Calculations', () => {
  it('computes subject averages, topic strengths/weaknesses, and improvement trend', () => {
    const summary = calculateStudentAnalytics([
      {
        subjectName: 'Computer Science',
        topic: 'Python Loops',
        obtainedMarks: 10,
        maxMarks: 20,
        attemptedAt: '2026-08-01T10:00:00Z',
      },
      {
        subjectName: 'Computer Science',
        topic: 'SQL Joins',
        obtainedMarks: 18,
        maxMarks: 20,
        attemptedAt: '2026-09-01T10:00:00Z',
      },
    ]);

    expect(summary.overallPercentage).toBe(70);
    expect(summary.strongTopics).toContain('SQL Joins');
    expect(summary.weakTopics).toContain('Python Loops');
    expect(summary.improvementDelta).toBe(40);
  });
});