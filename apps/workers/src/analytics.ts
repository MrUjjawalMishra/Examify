export interface ScoreRecord {
  subjectName: string;
  topic: string;
  obtainedMarks: number;
  maxMarks: number;
  attemptedAt: string;
}

export interface StudentAnalyticsSummary {
  overallPercentage: number;
  completedTests: number;
  subjectAverages: Array<{ subject: string; percentage: number }>;
  strongTopics: string[];
  weakTopics: string[];
  improvementDelta: number;
}

/**
 * Documented Formula:
 * - Subject Average (%) = (SUM(obtainedMarks) / SUM(maxMarks)) * 100
 * - Weak Topics = Topics with accuracy < 60%
 * - Strong Topics = Topics with accuracy >= 80%
 * - Improvement Delta = Latest test % minus Earliest test %
 */
export function calculateStudentAnalytics(records: ScoreRecord[]): StudentAnalyticsSummary {
  if (records.length === 0) {
    return {
      overallPercentage: 0,
      completedTests: 0,
      subjectAverages: [],
      strongTopics: [],
      weakTopics: [],
      improvementDelta: 0,
    };
  }

  let totalObtained = 0;
  let totalMax = 0;
  const bySubject = new Map<string, { obtained: number; max: number }>();
  const byTopic = new Map<string, { obtained: number; max: number }>();

  const sorted = [...records].sort(
    (a, b) => new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime()
  );

  for (const r of sorted) {
    totalObtained += r.obtainedMarks;
    totalMax += r.maxMarks;

    const sub = bySubject.get(r.subjectName) ?? { obtained: 0, max: 0 };
    sub.obtained += r.obtainedMarks;
    sub.max += r.maxMarks;
    bySubject.set(r.subjectName, sub);

    const top = byTopic.get(r.topic) ?? { obtained: 0, max: 0 };
    top.obtained += r.obtainedMarks;
    top.max += r.maxMarks;
    byTopic.set(r.topic, top);
  }

  const subjectAverages = Array.from(bySubject.entries()).map(([subject, val]) => ({
    subject,
    percentage: val.max > 0 ? Number(((val.obtained / val.max) * 100).toFixed(1)) : 0,
  }));

  const strongTopics: string[] = [];
  const weakTopics: string[] = [];

  for (const [topic, val] of byTopic.entries()) {
    const pct = val.max > 0 ? (val.obtained / val.max) * 100 : 0;
    if (pct >= 80) strongTopics.push(topic);
    else if (pct < 60) weakTopics.push(topic);
  }

  const firstPct = sorted[0].maxMarks > 0 ? (sorted[0].obtainedMarks / sorted[0].maxMarks) * 100 : 0;
  const last = sorted[sorted.length - 1];
  const lastPct = last.maxMarks > 0 ? (last.obtainedMarks / last.maxMarks) * 100 : 0;

  return {
    overallPercentage: totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(1)) : 0,
    completedTests: records.length,
    subjectAverages,
    strongTopics,
    weakTopics,
    improvementDelta: Number((lastPct - firstPct).toFixed(1)),
  };
}