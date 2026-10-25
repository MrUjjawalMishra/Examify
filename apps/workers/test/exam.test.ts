import { describe, expect, it } from "vitest";
import {
  calculateExamTotalMarks,
  canPublishExam,
  evaluateExamScore,
} from "../src/exam.js";

describe("exam system rules", () => {
  it("lets a teacher publish a valid exam in the same school", () => {
    const exam = {
      id: "exam-1",
      schoolId: "school-a",
      title: "Midterm Science",
      status: "draft",
      questions: [
        { id: "q1", prompt: "What is gravity?", marks: 5, type: "mcq" },
      ],
      durationMinutes: 30,
    };

    expect(
      canPublishExam(
        "teacher",
        "school-a",
        exam.schoolId,
        exam.status,
        exam.questions,
      ),
    ).toBe(true);
    expect(calculateExamTotalMarks(exam.questions)).toBe(5);
  });

  it("blocks cross-school publishing and student access", () => {
    const questions = [
      { id: "q1", prompt: "Solve this", marks: 10, type: "descriptive" },
    ];
    expect(
      canPublishExam("teacher", "school-a", "school-b", "draft", questions),
    ).toBe(false);
    expect(
      canPublishExam("student", "school-a", "school-a", "draft", questions),
    ).toBe(false);
  });

  it("calculates score and pass percentage correctly", () => {
    const result = evaluateExamScore({
      correctAnswers: 8,
      totalQuestions: 10,
      totalMarks: 20,
    });

    expect(result.score).toBe(16);
    expect(result.percentage).toBe(80);
    expect(result.passed).toBe(true);
  });
});
