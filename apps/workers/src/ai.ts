export interface DraftQuestionSuggestion {
  qType: 'mcq' | 'true_false' | 'short_answer';
  prompt: string;
  options?: string[];
  correctAnswer: string;
  marks: number;
  sourceReference: string;
  uncertainExtraction: boolean;
  requiresTeacherApproval: true;
}

export interface WrittenAnswerEvaluation {
  suggestedMarks: number;
  maxMarks: number;
  missingConcepts: string[];
  draftFeedback: string;
  requiresTeacherApproval: true;
}

export interface AIProviderAdapter {
  readonly providerName: string;
  generateQuestionDrafts(sourceText: string, subject: string): Promise<DraftQuestionSuggestion[]>;
  suggestWrittenGrade(
    questionPrompt: string,
    expectedKeywords: string[],
    studentAnswer: string,
    maxMarks: number
  ): Promise<WrittenAnswerEvaluation>;
}

export class MockAIProvider implements AIProviderAdapter {
  readonly providerName = 'mock-safe-adapter';

  async generateQuestionDrafts(sourceText: string, subject: string): Promise<DraftQuestionSuggestion[]> {
    const snippet = sourceText.trim().slice(0, 80) || `${subject} Core Chapter`;
    return [
      {
        qType: 'mcq',
        prompt: `[Draft from ${subject}] Which statement accurately reflects the core principle in "${snippet}"?`,
        options: [
          'Structured modular execution with verified inputs',
          'Unverified execution without boundary checks',
          'Skipping validation for faster runtime',
          'None of the above',
        ],
        correctAnswer: 'Structured modular execution with verified inputs',
        marks: 1,
        sourceReference: 'Uploaded Document — Section 1, Paragraph 2',
        uncertainExtraction: false,
        requiresTeacherApproval: true,
      },
      {
        qType: 'short_answer',
        prompt: `Explain two practical applications discussed in "${snippet}" with examples.`,
        correctAnswer: 'Any two valid curriculum examples with explanation',
        marks: 3,
        sourceReference: 'Uploaded Document — Section 2',
        uncertainExtraction: sourceText.trim().length < 30,
        requiresTeacherApproval: true,
      },
    ];
  }

  async suggestWrittenGrade(
    _questionPrompt: string,
    expectedKeywords: string[],
    studentAnswer: string,
    maxMarks: number
  ): Promise<WrittenAnswerEvaluation> {
    const normalized = studentAnswer.toLowerCase();
    const matched = expectedKeywords.filter((kw) => normalized.includes(kw.toLowerCase()));
    const missingConcepts = expectedKeywords.filter((kw) => !normalized.includes(kw.toLowerCase()));
    const ratio = expectedKeywords.length > 0 ? matched.length / expectedKeywords.length : 0.5;
    const suggestedMarks = Number((ratio * maxMarks).toFixed(1));

    return {
      suggestedMarks,
      maxMarks,
      missingConcepts,
      draftFeedback:
        missingConcepts.length === 0
          ? 'Strong conceptual coverage of all key points. Pending final teacher verification.'
          : `Good attempt. Consider revising: ${missingConcepts.join(', ')}.`,
      requiresTeacherApproval: true,
    };
  }
}

export function redactStudentPIIForAI(payload: Record<string, unknown>): Record<string, unknown> {
  const forbiddenKeys = new Set(['studentName', 'fullName', 'email', 'phone', 'rollNumber', 'studentId']);
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!forbiddenKeys.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
}