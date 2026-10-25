import type { UserRole } from "./security.js";

export type ExamQuestionType = "mcq" | "descriptive";

export type ExamQuestion = {
  id: string;
  prompt: string;
  marks: number;
  type: ExamQuestionType;
};

export type ExamStatus = "draft" | "published" | "archived";

export type Exam = {
  id: string;
  schoolId: string;
  title: string;
  status: ExamStatus;
  questions: ExamQuestion[];
  durationMinutes: number;
};

export function calculateExamTotalMarks(questions: ExamQuestion[]): number {
  return questions.reduce(
    (total, question) => total + Math.max(0, question.marks),
    0,
  );
}

export function canPublishExam(
  userRole: UserRole,
  userSchoolId: string,
  examSchoolId: string,
  examStatus: ExamStatus,
  questions: ExamQuestion[],
): boolean {
  if (userSchoolId !== examSchoolId) return false;
  if (examStatus !== "draft") return false;

  const allowedRoles: UserRole[] = ["teacher", "school_admin"];
  if (!allowedRoles.includes(userRole)) return false;

  const totalMarks = calculateExamTotalMarks(questions);
  return questions.length > 0 && totalMarks > 0;
}

export function evaluateExamScore(payload: {
  correctAnswers: number;
  totalQuestions: number;
  totalMarks: number;
}): {
  score: number;
  percentage: number;
  passed: boolean;
} {
  const totalQuestions = Math.max(0, payload.totalQuestions);
  const correctAnswers = Math.max(
    0,
    Math.min(payload.correctAnswers, totalQuestions),
  );
  const totalMarks = Math.max(0, payload.totalMarks);

  const percentage =
    totalQuestions > 0
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : 0;
  const score =
    totalMarks > 0
      ? Math.round((correctAnswers / totalQuestions) * totalMarks)
      : 0;

  return {
    score: Number.isFinite(score) ? score : 0,
    percentage: Number.isFinite(percentage) ? percentage : 0,
    passed: percentage >= 50,
  };
}
