export type UserRole = 'platform_owner' | 'school_admin' | 'teacher' | 'student' | 'parent';

export type QuestionType = 'mcq' | 'true_false' | 'fill_blank' | 'matching' | 'short_answer' | 'long_answer';

export interface QuestionItem {
  id: string;
  qType: QuestionType;
  prompt: string;
  marks: number;
  topic: string;
  options?: string[];
  matchingPairs?: Array<{ left: string; right: string }>;
  correctAnswer: string;
  sourceRef?: string;
  aiGenerated?: boolean;
  approved: boolean;
}

export interface ExamRecord {
  id: string;
  schoolId: string;
  title: string;
  subject: string;
  targetClass: string;
  targetSection: string;
  durationMinutes: number;
  totalMarks: number;
  scheduledAt: string;
  deadlineAt: string;
  status: 'draft' | 'scheduled' | 'published' | 'completed';
  resultsPublished: boolean;
  maxViolations: number;
  instructions: string;
  questions: QuestionItem[];
}

export interface SubmissionRecord {
  id: string;
  examId: string;
  examTitle: string;
  studentName: string;
  rollNo: string;
  submittedAt: string;
  tabViolations: number;
  writtenQuestion: string;
  studentWrittenAnswer: string;
  attachedImageName?: string;
  maxWrittenMarks: number;
  aiSuggestedMarks: number;
  aiDraftFeedback: string;
  finalApprovedMarks: number | null;
  mcqAutoMarks: number;
  maxMcqMarks: number;
  status: 'pending_review' | 'approved' | 'published';
}

export type QueryStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'reopened' | 'overdue';

export interface StudentQuery {
  id: string;
  schoolId: string;
  studentName: string;
  classSection: string;
  subject: string;
  assignedTeacher: string;
  title: string;
  status: QueryStatus;
  slaHours: number;
  deadlineLabel: string;
  helpfulVote?: boolean | null;
  adminWarnings: number;
  messages: Array<{ sender: string; role: string; text: string; time: string }>;
}

export interface CommunityGroup {
  id: string;
  schoolId: string;
  name: string;
  classSection: string;
  subject: string;
  teacherName: string;
  memberCount: number;
  authorizedRoles: UserRole[];
  posts: Array<{ id: string; author: string; tag: string; content: string; createdAt: string }>;
}

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  category: 'exam' | 'query' | 'community' | 'result' | 'alert';
  time: string;
  read: boolean;
  roles: UserRole[];
}

export interface SchoolTenant {
  id: string;
  code: string;
  name: string;
  city: string;
  status: 'active' | 'pilot' | 'suspended';
  teachers: number;
  students: number;
  activeExams: number;
}