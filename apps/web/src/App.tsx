import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Lock,
  LogOut,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import type {
  AppNotification,
  CommunityGroup,
  ExamRecord,
  QuestionItem,
  QuestionType,
  SchoolTenant,
  StudentQuery,
  SubmissionRecord,
  UserRole,
} from './types';
import {
  DEMO_SCHOOLS,
  INITIAL_EXAMS,
  INITIAL_GROUPS,
  INITIAL_NOTIFICATIONS,
  INITIAL_QUERIES,
  INITIAL_SUBMISSIONS,
} from './data/syntheticData';

type NavTab =
  | 'overview'
  | 'schools'
  | 'academics'
  | 'exams'
  | 'take_exam'
  | 'grading'
  | 'queries'
  | 'communities'
  | 'analytics'
  | 'settings';

const ROLE_LABELS: Record<UserRole, { title: string; subtitle: string }> = {
  platform_owner: { title: 'Platform Owner', subtitle: 'Multi-School Tenant Operations & Health' },
  school_admin: { title: 'School Admin', subtitle: 'Green Valley Public School (GREENVALLEY-VNS)' },
  teacher: { title: 'Teacher Workspace', subtitle: 'Computer Science & Applications (Classes 9C, 11A)' },
  student: { title: 'Student Portal', subtitle: 'Aarav Verma • Class 11A • Roll 11A-07' },
  parent: { title: 'Parent Progress Portal', subtitle: 'Verified Child: Aarav Verma (Class 11A)' },
};

const AUTOSAVE_STORAGE_KEY = 'examify_demo_autosave_v1';

export function App() {
  const [signedIn, setSignedIn] = useState<boolean>(true);
  const [role, setRole] = useState<UserRole>('teacher');
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [loginUsername, setLoginUsername] = useState('faculty.cs');
  const [loginSchoolCode, setLoginSchoolCode] = useState('GREENVALLEY-VNS');
  const [toast, setToast] = useState<string | null>(null);

  // Stateful Application Data (Synthetic Prototype State)
  const [schools, setSchools] = useState<SchoolTenant[]>(DEMO_SCHOOLS);
  const [exams, setExams] = useState<ExamRecord[]>(INITIAL_EXAMS);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(INITIAL_SUBMISSIONS);
  const [queries, setQueries] = useState<StudentQuery[]>(INITIAL_QUERIES);
  const [groups, setGroups] = useState<CommunityGroup[]>(INITIAL_GROUPS);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Exam Builder State
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamClass, setNewExamClass] = useState('Class 11');
  const [newExamSection, setNewExamSection] = useState('A');
  const [newExamDuration, setNewExamDuration] = useState(45);
  const [newExamMarks, setNewExamMarks] = useState(70);
  const [sourceMaterialText, setSourceMaterialText] = useState('');
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);
  const [builderQuestions, setBuilderQuestions] = useState<QuestionItem[]>([]);
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualType, setManualType] = useState<QuestionType>('mcq');
  const [manualMarks, setManualMarks] = useState(2);

  // Student Live Exam Runner State
  const [activeExamId, setActiveExamId] = useState<string>('ex-101');
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(45 * 60);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [answerAttachments, setAnswerAttachments] = useState<Record<string, string>>({});
  const [tabViolations, setTabViolations] = useState(0);
  const [examPausedByViolation, setExamPausedByViolation] = useState(false);

  // Queries & Community Interactive Inputs
  const [selectedQueryId, setSelectedQueryId] = useState<string>(INITIAL_QUERIES[0].id);
  const [replyText, setReplyText] = useState('');
  const [newQueryTitle, setNewQueryTitle] = useState('');
  const [newQuerySubject, setNewQuerySubject] = useState('Computer Science (083)');
  const [selectedSlaHours, setSelectedSlaHours] = useState(72);
  const [newGroupPost, setNewGroupPost] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(INITIAL_GROUPS[0].id);

  // AI Assistant Draft Modal
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [aiDraftOutput, setAiDraftOutput] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 4000);
  };

  // Autosave student answers
  useEffect(() => {
    try {
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(studentAnswers));
    } catch {
      // Ignore storage quota errors in restricted browsers
    }
  }, [studentAnswers]);

  // Countdown timer for active student exam
  useEffect(() => {
    if (!examStarted || examSubmitted || examPausedByViolation) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setExamSubmitted(true);
          notify('Time expired — saved answers submitted automatically.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [examStarted, examSubmitted, examPausedByViolation]);

  // Browser tab visibility integrity detector during active exam
  useEffect(() => {
    if (!examStarted || examSubmitted) return;
    const handleVisibility = () => {
      if (document.hidden) {
        setTabViolations((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setExamPausedByViolation(true);
            notify('Attempt paused after 3 focus/tab violations. Teacher unlock required.');
          } else {
            notify(`Integrity Warning (${next}/3): Tab switch logged.`);
          }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [examStarted, examSubmitted]);

  const navItems = useMemo(() => {
    const items: Array<{ id: NavTab; label: string; icon: React.ReactNode; roles: UserRole[] }> = [
      {
        id: 'overview',
        label: 'Dashboard',
        icon: <BarChart3 className="w-4 h-4" />,
        roles: ['platform_owner', 'school_admin', 'teacher', 'student', 'parent'],
      },
      {
        id: 'schools',
        label: 'Registered Schools',
        icon: <Building2 className="w-4 h-4" />,
        roles: ['platform_owner'],
      },
      {
        id: 'academics',
        label: 'Classes & Users',
        icon: <Users className="w-4 h-4" />,
        roles: ['school_admin'],
      },
      {
        id: 'exams',
        label: role === 'teacher' ? 'Exam Builder & Bank' : 'Examinations',
        icon: <FileText className="w-4 h-4" />,
        roles: ['school_admin', 'teacher', 'student'],
      },
      {
        id: 'take_exam',
        label: 'Live Test Engine',
        icon: <Clock className="w-4 h-4" />,
        roles: ['student', 'teacher'],
      },
      {
        id: 'grading',
        label: 'Submissions & AI Grading',
        icon: <Award className="w-4 h-4" />,
        roles: ['teacher', 'school_admin'],
      },
      {
        id: 'queries',
        label: 'Student Queries (SLA)',
        icon: <HelpCircle className="w-4 h-4" />,
        roles: ['school_admin', 'teacher', 'student'],
      },
      {
        id: 'communities',
        label: 'Class Communities',
        icon: <BookOpen className="w-4 h-4" />,
        roles: ['school_admin', 'teacher', 'student'],
      },
      {
        id: 'analytics',
        label: 'Analytics & Reports',
        icon: <BarChart3 className="w-4 h-4" />,
        roles: ['platform_owner', 'school_admin', 'teacher', 'student', 'parent'],
      },
      {
        id: 'settings',
        label: 'Policies & Settings',
        icon: <Settings className="w-4 h-4" />,
        roles: ['platform_owner', 'school_admin'],
      },
    ];
    return items.filter((item) => item.roles.includes(role));
  }, [role]);

  const roleNotifications = useMemo(
    () => notifications.filter((n) => n.roles.includes(role)),
    [notifications, role]
  );

  const unreadCount = roleNotifications.filter((n) => !n.read).length;
  const activeExam = exams.find((e) => e.id === activeExamId) ?? exams[0];
  const selectedQuery = queries.find((q) => q.id === selectedQueryId) ?? queries[0];
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0];

  const handleRoleSwitch = (nextRole: UserRole) => {
    setRole(nextRole);
    setActiveTab('overview');
    notify(`Switched demo workspace to ${ROLE_LABELS[nextRole].title}`);
  };

  const handleGenerateAIDrafts = () => {
    const contextLabel = uploadedDocName || sourceMaterialText.slice(0, 40) || 'CBSE Class 11 SQL & Python Notes';
    const generated: QuestionItem[] = [
      {
        id: `ai-${Date.now()}-1`,
        qType: 'mcq',
        prompt: `[AI Draft • ${contextLabel}] Which constraint ensures that a column cannot store NULL values and uniquely identifies rows?`,
        marks: 1,
        topic: 'Relational Constraints',
        options: ['FOREIGN KEY', 'PRIMARY KEY', 'CHECK', 'DEFAULT'],
        correctAnswer: 'PRIMARY KEY',
        sourceRef: `${uploadedDocName ?? 'Pasted Notes'} — Sec 1.2`,
        aiGenerated: true,
        approved: false,
      },
      {
        id: `ai-${Date.now()}-2`,
        qType: 'short_answer',
        prompt: `[AI Draft • ${contextLabel}] Write a Python function to count vowels in a text file and explain file closing best practices.`,
        marks: 4,
        topic: 'File Handling',
        correctAnswer: 'with open(...) context manager and vowel loop',
        sourceRef: `${uploadedDocName ?? 'Pasted Notes'} — Sec 2.4`,
        aiGenerated: true,
        approved: false,
      },
    ];
    setBuilderQuestions((prev) => [...prev, ...generated]);
    notify('Generated 2 AI draft questions. Teacher review & approval required before publishing.');
  };

  const handleAddManualQuestion = () => {
    if (!manualPrompt.trim()) {
      notify('Please enter a question prompt.');
      return;
    }
    const item: QuestionItem = {
      id: `manual-${Date.now()}`,
      qType: manualType,
      prompt: manualPrompt.trim(),
      marks: manualMarks,
      topic: 'Curriculum Topic',
      options:
        manualType === 'mcq'
          ? ['Option A', 'Option B', 'Option C', 'Option D']
          : manualType === 'true_false'
          ? ['True', 'False']
          : undefined,
      correctAnswer: manualType === 'true_false' ? 'True' : 'Option A',
      approved: true,
    };
    setBuilderQuestions((prev) => [...prev, item]);
    setManualPrompt('');
    notify('Question added to draft bank.');
  };

  const handlePublishExam = () => {
    if (!newExamTitle.trim()) {
      notify('Validation Error: Exam Title is required.');
      return;
    }
    if (builderQuestions.length === 0) {
      notify('Validation Error: Add at least one question before publishing.');
      return;
    }
    if (builderQuestions.some((q) => !q.approved)) {
      notify('Approval Required: Review and approve all AI-extracted questions before publishing.');
      return;
    }
    const created: ExamRecord = {
      id: `ex-${Date.now()}`,
      schoolId: 'sch-greenvalley',
      title: newExamTitle.trim(),
      subject: 'Computer Science (083)',
      targetClass: newExamClass,
      targetSection: newExamSection,
      durationMinutes: newExamDuration,
      totalMarks: newExamMarks,
      scheduledAt: '2026-11-02 09:30 AM',
      deadlineAt: '2026-11-02 11:00 AM',
      status: 'published',
      resultsPublished: false,
      maxViolations: 3,
      instructions: 'Read all instructions carefully. Progress autosaves continuously.',
      questions: builderQuestions,
    };
    setExams((prev) => [created, ...prev]);
    setNewExamTitle('');
    setBuilderQuestions([]);
    notify(`Exam "${created.title}" published to ${created.targetClass}-${created.targetSection}.`);
  };

  const handleApproveSubmissionGrade = (subId: string, marks: number) => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === subId
          ? {
              ...s,
              finalApprovedMarks: marks,
              status: 'approved',
            }
          : s
      )
    );
    notify('Final written grade confirmed by teacher and logged to audit trail.');
  };

  const handlePublishResults = () => {
    setSubmissions((prev) =>
      prev.map((s) => (s.status === 'approved' ? { ...s, status: 'published' } : s))
    );
    notify('Approved student results published to authorized Student & Parent portals.');
  };

  const handleSendQueryReply = (markResolved: boolean) => {
    if (!replyText.trim()) {
      notify('Enter a response message first.');
      return;
    }
    setQueries((prev) =>
      prev.map((q) =>
        q.id === selectedQuery.id
          ? {
              ...q,
              status: markResolved ? 'resolved' : 'in_progress',
              slaHours: selectedSlaHours,
              deadlineLabel: markResolved ? 'Resolved within SLA' : `Due within ${selectedSlaHours}h SLA`,
              messages: [
                ...q.messages,
                {
                  sender: ROLE_LABELS[role].title,
                  role: role === 'student' ? 'Student' : 'Teacher',
                  text: replyText.trim(),
                  time: 'Just now',
                },
              ],
            }
          : q
      )
    );
    setReplyText('');
    notify(markResolved ? 'Query marked as Resolved.' : 'Reply posted to query thread.');
  };

  const handleCreateStudentQuery = () => {
    if (!newQueryTitle.trim()) {
      notify('Enter your subject question first.');
      return;
    }
    const created: StudentQuery = {
      id: `QR-${Math.floor(910 + Math.random() * 80)}`,
      schoolId: 'sch-greenvalley',
      studentName: 'Aarav Verma (Demo)',
      classSection: 'Class 11A',
      subject: newQuerySubject,
      assignedTeacher: 'CS Faculty (Demo)',
      title: newQueryTitle.trim(),
      status: 'assigned',
      slaHours: 48,
      deadlineLabel: 'Due in 48h (Default SLA)',
      helpfulVote: null,
      adminWarnings: 0,
      messages: [
        {
          sender: 'Aarav Verma (Demo)',
          role: 'Student',
          text: newQueryTitle.trim(),
          time: 'Just now',
        },
      ],
    };
    setQueries((prev) => [created, ...prev]);
    setSelectedQueryId(created.id);
    setNewQueryTitle('');
    notify(`Query ${created.id} routed to ${created.assignedTeacher}.`);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!signedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-900 text-white flex items-center justify-center font-bold">
              E
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Examify SaaS</h1>
              <p className="text-xs text-slate-500">Multi-School Examination & Academic Support</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            <strong>Prototype Demo Mode:</strong> Uses isolated synthetic records. Restricted school login requires assigned username & school code.
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role Access</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="platform_owner">Platform Owner</option>
                <option value="school_admin">School Administrator</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
                <option value="parent">Parent / Guardian</option>
              </select>
            </div>

            {role !== 'platform_owner' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">School Tenant Code</label>
                <input
                  value={loginSchoolCode}
                  onChange={(e) => setLoginSchoolCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. GREENVALLEY-VNS"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Username</label>
              <input
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="assigned.username"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                defaultValue="demo-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={() => {
                setSignedIn(true);
                setActiveTab('overview');
                notify(`Signed in as ${ROLE_LABELS[role].title}`);
              }}
              className="w-full bg-indigo-900 hover:bg-indigo-800 text-white font-semibold rounded-lg py-2.5 text-sm transition"
            >
              Sign In to Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-slate-900 text-slate-100 flex-shrink-0 flex flex-col justify-between">
        <div>
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center">
                E
              </div>
              <div>
                <div className="font-bold tracking-tight text-white">Examify</div>
                <div className="text-[11px] text-slate-400">Multi-Tenant EdTech SaaS</div>
              </div>
            </div>
          </div>

          {/* Quick Role Switcher for Demo Verification */}
          <div className="p-4 border-b border-slate-800">
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
              Active Demo Role
            </label>
            <select
              value={role}
              onChange={(e) => handleRoleSwitch(e.target.value as UserRole)}
              className="w-full bg-slate-800 text-slate-100 text-xs rounded-lg px-2.5 py-2 border border-slate-700 focus:outline-none focus:border-indigo-400"
            >
              <option value="platform_owner">1. Platform Owner</option>
              <option value="school_admin">2. School Admin</option>
              <option value="teacher">3. Teacher</option>
              <option value="student">4. Student</option>
              <option value="parent">5. Parent / Guardian</option>
            </select>
          </div>

          <nav className="p-3 space-y-1 flex lg:flex-col overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition w-full text-left ${
                  activeTab === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="hidden lg:block p-4 border-t border-slate-800 space-y-3">
          <div className="bg-slate-800/80 rounded-lg p-3 text-[11px] text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Tenant Isolation Active
            </div>
            <p className="text-slate-400">Synthetic Demo Dataset • No live student PII exposed.</p>
          </div>
          <button
            onClick={() => setSignedIn(false)}
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-300 hover:text-white py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            Switch Account / Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{ROLE_LABELS[role].title}</h1>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                Synthetic Demo Data
              </span>
            </div>
            <p className="text-xs text-slate-500">{ROLE_LABELS[role].subtitle}</p>
          </div>

          <div className="flex items-center gap-3 relative">
            <button
              onClick={() => setShowNotifPanel((prev) => !prev)}
              className="relative p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifPanel && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg border border-slate-200 p-4 z-30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">In-App Notifications</span>
                  <button
                    onClick={() =>
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
                    }
                    className="text-[11px] text-indigo-700 hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
                {roleNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-lg border text-xs ${
                      n.read ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50/60 border-indigo-200'
                    }`}
                  >
                    <div className="font-semibold text-slate-800">{n.title}</div>
                    <div className="text-slate-600 mt-0.5">{n.detail}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{n.time}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        {toast && (
          <div className="mx-6 mt-4 bg-indigo-950 text-white px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between shadow-sm">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-indigo-200 hover:text-white ml-4">
              Dismiss
            </button>
          </div>
        )}

        <main className="p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* TAB 1: ROLE-SPECIFIC OVERVIEW DASHBOARD */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {role === 'platform_owner' && (
                  <>
                    <MetricCard label="Registered Schools" value={String(schools.length)} sub="Strict RLS Isolation" />
                    <MetricCard label="Active Students (Demo)" value="1,620" sub="Across 2 Pilot Tenants" />
                    <MetricCard label="Worker API Health" value="99.9%" sub="Mock AI Adapter Ready" />
                    <MetricCard label="R2 Storage Egress" value="0 GB" sub="Private Bucket Policy" />
                  </>
                )}
                {role === 'school_admin' && (
                  <>
                    <MetricCard label="School Teachers" value="34" sub="Green Valley Public School" />
                    <MetricCard label="Enrolled Students" value="680" sub="Classes 6 to 12" />
                    <MetricCard label="Active / Scheduled Exams" value={String(exams.length)} sub="CBSE 70/30 Blueprints" />
                    <MetricCard
                      label="Overdue Queries"
                      value={String(queries.filter((q) => q.status === 'overdue').length)}
                      sub="48h–7d SLA Monitored"
                    />
                  </>
                )}
                {role === 'teacher' && (
                  <>
                    <MetricCard label="Published / Scheduled Exams" value={String(exams.length)} sub="Classes 9C & 11A" />
                    <MetricCard
                      label="Pending Grading Approvals"
                      value={String(submissions.filter((s) => s.status === 'pending_review').length)}
                      sub="AI Suggestions Ready"
                    />
                    <MetricCard label="Assigned Student Queries" value={String(queries.length)} sub="1 Requires Escalation Review" />
                    <MetricCard label="Private Class Groups" value={String(groups.length)} sub="Authorized Members Only" />
                  </>
                )}
                {role === 'student' && (
                  <>
                    <MetricCard label="Assigned Active Exams" value={String(exams.length)} sub="Autosave Enabled" />
                    <MetricCard label="Overall Average (Demo)" value="81.4%" sub="+6.2% Improvement" />
                    <MetricCard label="Open / Active Doubts" value={String(queries.length)} sub="Tracked with Teacher SLA" />
                    <MetricCard label="Authorized Communities" value="2" sub="Class 11A Verified" />
                  </>
                )}
                {role === 'parent' && (
                  <>
                    <MetricCard label="Verified Child Average" value="81.4%" sub="Aarav Verma (11A)" />
                    <MetricCard label="Tests Completed" value="8 / 8" sub="100% Exam Attendance" />
                    <MetricCard label="Upcoming Exam" value="Oct 27" sub="CS Mid-Term (70 Marks)" />
                    <MetricCard label="Focus / Revision Area" value="Python File IO" sub="Teacher Feedback Available" />
                  </>
                )}
              </div>

              {/* AI Read-Only / Draft Assistant for Teacher & Owners */}
              {(role === 'teacher' || role === 'platform_owner' || role === 'school_admin') && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-700" />
                      <h2 className="text-sm font-bold text-slate-900">
                        AI Copilot (Read-Only Summary & Draft Mode — Provider-Independent Mock)
                      </h2>
                    </div>
                    <span className="text-[11px] text-slate-500">Human confirmation required for actions</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={aiPromptInput}
                      onChange={(e) => setAiPromptInput(e.target.value)}
                      placeholder='Try: "Summarize Class 11A performance" or "Draft reminder for tomorrow exam"'
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                    <button
                      onClick={() => {
                        const text = aiPromptInput.trim() || 'Summarize Class 11A performance';
                        setAiDraftOutput(
                          `[Draft Response for "${text}"]: Class 11A shows 84% accuracy in SQL Joins & Primary Keys, while 31% of students need revision in DDL vs DML edge cases. 1 Mathematics query in 9C is currently overdue. (Draft only — no grades or announcements were sent automatically.)`
                        );
                      }}
                      className="bg-indigo-900 hover:bg-indigo-800 text-white px-4 py-2 rounded-lg text-xs font-semibold"
                    >
                      Generate Draft
                    </button>
                  </div>
                  {aiDraftOutput && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
                      {aiDraftOutput}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Action Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Active & Upcoming Examinations</h3>
                  <div className="divide-y divide-slate-100">
                    {exams.map((ex) => (
                      <div key={ex.id} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold text-slate-900">{ex.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {ex.subject} • {ex.targetClass}-{ex.targetSection} • {ex.totalMarks} Marks • {ex.durationMinutes} mins
                          </div>
                        </div>
                        {role === 'student' ? (
                          <button
                            onClick={() => {
                              setActiveExamId(ex.id);
                              setActiveTab('take_exam');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-900 text-white text-xs font-semibold"
                          >
                            Open Test
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {ex.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Student Query SLA Watchlist</h3>
                  <div className="divide-y divide-slate-100">
                    {queries.map((q) => (
                      <div key={q.id} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            {q.id}: {q.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {q.classSection} • {q.subject} • {q.deadlineLabel}
                          </div>
                        </div>
                        <StatusBadge status={q.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLATFORM OWNER SCHOOL MANAGEMENT */}
          {activeTab === 'schools' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Registered Multi-Tenant Schools</h2>
                  <p className="text-xs text-slate-500">
                    Strict PostgreSQL `school_id` isolation. Platform Owners view operational health without unrestricted student PII exposure.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next: SchoolTenant = {
                      id: `sch-${Date.now()}`,
                      code: `PILOT-${schools.length + 1}01`,
                      name: `New Pilot School #${schools.length + 1} (Synthetic)`,
                      city: 'Prayagraj, UP',
                      status: 'pilot',
                      teachers: 12,
                      students: 240,
                      activeExams: 1,
                    };
                    setSchools((prev) => [...prev, next]);
                    notify(`Onboarded ${next.name} with isolated school_id.`);
                  }}
                  className="bg-indigo-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Register Pilot School
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 pr-4">School Name</th>
                      <th className="py-2.5 pr-4">Tenant Code</th>
                      <th className="py-2.5 pr-4">City</th>
                      <th className="py-2.5 pr-4">Teachers / Students</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schools.map((s) => (
                      <tr key={s.id}>
                        <td className="py-3 pr-4 font-semibold text-slate-900">{s.name}</td>
                        <td className="py-3 pr-4 font-mono text-[11px]">{s.code}</td>
                        <td className="py-3 pr-4">{s.city}</td>
                        <td className="py-3 pr-4">
                          {s.teachers} Teachers • {s.students} Students
                        </td>
                        <td className="py-3 pr-4">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-800">
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => {
                              setSchools((prev) =>
                                prev.map((item) =>
                                  item.id === s.id
                                    ? { ...item, status: item.status === 'suspended' ? 'active' : 'suspended' }
                                    : item
                                )
                              );
                              notify(`Updated status for ${s.code}`);
                            }}
                            className="text-indigo-700 hover:underline font-medium"
                          >
                            {s.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SCHOOL ADMIN CLASSES, SECTIONS & USERS */}
          {activeTab === 'academics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">Class Wise Sections & Subject Mapping</h2>
                <div className="space-y-2 text-xs">
                  {[
                    { cls: 'Class 9 — Section A & C', subj: 'Computer Applications (165), Mathematics (041)', teacher: 'CS Faculty, Mr. R. K. Pandey' },
                    { cls: 'Class 11 — Section A', subj: 'Computer Science (083), Information Practices (065)', teacher: 'CS Faculty (70-Mark Theory Blueprint)' },
                    { cls: 'Class 12 — Section A', subj: 'Artificial Intelligence (843), Computer Science (083)', teacher: 'CS & AI Department' },
                  ].map((row, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="font-bold text-slate-900">{row.cls}</div>
                      <div className="text-slate-600 mt-0.5">Subjects: {row.subj}</div>
                      <div className="text-slate-500 mt-0.5">Assigned: {row.teacher}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">Restricted User Provisioning & CSV Template</h2>
                <p className="text-xs text-slate-600">
                  Public arbitrary sign-up is disabled. Only School Admins provision teacher/student usernames for this school tenant.
                </p>
                <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center space-y-2">
                  <Upload className="w-5 h-5 text-indigo-700 mx-auto" />
                  <div className="text-xs font-semibold">Import Validated Student/Teacher Spreadsheet (.CSV)</div>
                  <button
                    onClick={() =>
                      notify('Validated synthetic CSV template: 35 student usernames ready for dry-run preview.')
                    }
                    className="bg-indigo-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    Simulate Validated CSV Check
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXAM BUILDER & QUESTION BANK */}
          {activeTab === 'exams' && (
            <div className="space-y-6">
              {role === 'teacher' || role === 'school_admin' ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Guided Exam Builder & AI Question Extraction
                    </h2>
                    <p className="text-xs text-slate-500">
                      Upload PDF/DOCX/Images or paste notes to extract draft questions. Every AI-generated question requires explicit teacher approval.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <label className="font-semibold block mb-1">Exam Title *</label>
                      <input
                        value={newExamTitle}
                        onChange={(e) => setNewExamTitle(e.target.value)}
                        placeholder="e.g. Class 11 Computer Science Theory Exam"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Class & Section</label>
                      <div className="flex gap-1.5">
                        <select
                          value={newExamClass}
                          onChange={(e) => setNewExamClass(e.target.value)}
                          className="w-2/3 border border-slate-300 rounded-lg px-2 py-2"
                        >
                          <option>Class 9</option>
                          <option>Class 10</option>
                          <option>Class 11</option>
                          <option>Class 12</option>
                        </select>
                        <select
                          value={newExamSection}
                          onChange={(e) => setNewExamSection(e.target.value)}
                          className="w-1/3 border border-slate-300 rounded-lg px-2 py-2"
                        >
                          <option>A</option>
                          <option>B</option>
                          <option>C</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="font-semibold block mb-1">Max Marks</label>
                        <input
                          type="number"
                          value={newExamMarks}
                          onChange={(e) => setNewExamMarks(Number(e.target.value))}
                          className="w-full border border-slate-300 rounded-lg px-2 py-2"
                        />
                      </div>
                      <div>
                        <label className="font-semibold block mb-1">Mins</label>
                        <input
                          type="number"
                          value={newExamDuration}
                          onChange={(e) => setNewExamDuration(Number(e.target.value))}
                          className="w-full border border-slate-300 rounded-lg px-2 py-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Document Upload + AI Extraction */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Step 2A: Upload Study Material (PDF, DOCX, Image, Text — Max 10 MB)
                      </span>
                      <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-indigo-700" />
                        <span>{uploadedDocName ?? 'Choose Document'}</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setUploadedDocName(f.name);
                              notify(`Validated "${f.name}" (${Math.round(f.size / 1024)} KB) for extraction.`);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <textarea
                      value={sourceMaterialText}
                      onChange={(e) => setSourceMaterialText(e.target.value)}
                      rows={2}
                      placeholder="Or paste chapter notes / syllabus excerpt here for AI draft question extraction..."
                      className="w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                    />
                    <button
                      onClick={handleGenerateAIDrafts}
                      className="bg-indigo-700 hover:bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Generate AI Draft Questions (Mock Adapter)
                    </button>
                  </div>

                  {/* Manual Question Entry */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                    <div className="font-bold text-slate-800">Step 2B: Add Question Manually (All 6 Formats Supported)</div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <select
                        value={manualType}
                        onChange={(e) => setManualType(e.target.value as QuestionType)}
                        className="border border-slate-300 rounded-lg px-2.5 py-2"
                      >
                        <option value="mcq">Multiple Choice (MCQ)</option>
                        <option value="true_false">True / False</option>
                        <option value="fill_blank">Fill in the Blank</option>
                        <option value="matching">Matching Pairs</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="long_answer">Long Answer</option>
                      </select>
                      <input
                        value={manualPrompt}
                        onChange={(e) => setManualPrompt(e.target.value)}
                        placeholder="Type question prompt..."
                        className="sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={manualMarks}
                          onChange={(e) => setManualMarks(Number(e.target.value))}
                          className="w-20 border border-slate-300 rounded-lg px-2 py-2"
                        />
                        <button
                          onClick={handleAddManualQuestion}
                          className="flex-1 bg-slate-900 text-white rounded-lg px-3 py-2 font-semibold"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Review & Approve Draft Questions */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800">
                      Step 3: Teacher Review & Approval Queue ({builderQuestions.length} Questions)
                    </div>
                    {builderQuestions.length === 0 ? (
                      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
                        No draft questions added yet. Use AI Extraction or Manual Add above.
                      </div>
                    ) : (
                      builderQuestions.map((q) => (
                        <div
                          key={q.id}
                          className="p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="uppercase font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 mr-2">
                              {q.qType} • {q.marks}M
                            </span>
                            <span className="font-medium text-slate-900">{q.prompt}</span>
                            {q.sourceRef && (
                              <div className="text-[11px] text-slate-500 mt-0.5">Source: {q.sourceRef}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {q.approved ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  setBuilderQuestions((prev) =>
                                    prev.map((item) => (item.id === q.id ? { ...item, approved: true } : item))
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-semibold hover:bg-amber-200"
                              >
                                Approve AI Draft
                              </button>
                            )}
                            <button
                              onClick={() =>
                                setBuilderQuestions((prev) => prev.filter((item) => item.id !== q.id))
                              }
                              className="text-rose-600 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handlePublishExam}
                      className="bg-indigo-900 hover:bg-indigo-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold"
                    >
                      Verify & Publish Exam to Class
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
                  <h2 className="text-base font-bold text-slate-900">Your Assigned Examinations</h2>
                  {exams.map((ex) => (
                    <div key={ex.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold">{ex.title}</div>
                        <div className="text-xs text-slate-500">
                          {ex.subject} • {ex.durationMinutes} mins • {ex.totalMarks} Marks
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setActiveExamId(ex.id);
                          setActiveTab('take_exam');
                        }}
                        className="bg-indigo-900 text-white px-4 py-2 rounded-lg text-xs font-semibold"
                      >
                        Proceed to Exam
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: STUDENT ONLINE EXAMINATION ENGINE */}
          {activeTab === 'take_exam' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{activeExam.title}</h2>
                  <p className="text-xs text-slate-500">
                    {activeExam.subject} • Max Marks: {activeExam.totalMarks} • Autosave Active • Integrity Violations:{' '}
                    <strong>
                      {tabViolations}/{activeExam.maxViolations}
                    </strong>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-mono text-sm font-bold">
                    ⏱ {formatTimer(secondsLeft)}
                  </div>
                  {!examStarted && !examSubmitted && (
                    <button
                      onClick={() => {
                        setExamStarted(true);
                        document.documentElement.requestFullscreen?.().catch(() => {});
                        notify('Exam started. Answers are automatically saved locally & synced.');
                      }}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold"
                    >
                      Start Attempt (Fullscreen Optional)
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
                <strong>Honest Integrity Notice:</strong> Browser focus/tab switches are logged ({tabViolations}/
                {activeExam.maxViolations}). While repeated violations pause the attempt for teacher review, standard web browsers cannot block secondary devices or OS-level tools.
              </div>

              {examPausedByViolation ? (
                <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-3">
                  <Lock className="w-8 h-8 text-rose-700 mx-auto" />
                  <h3 className="text-sm font-bold text-rose-950">Attempt Paused Due to Repeated Focus Violations</h3>
                  <p className="text-xs text-rose-800">
                    All your progress has been safely preserved. A teacher or school administrator can authorize recovery.
                  </p>
                  {(role === 'teacher' || role === 'school_admin') && (
                    <button
                      onClick={() => {
                        setExamPausedByViolation(false);
                        setTabViolations(0);
                        notify('Teacher authorized recovery — student attempt unlocked.');
                      }}
                      className="bg-indigo-900 text-white px-4 py-2 rounded-lg text-xs font-semibold"
                    >
                      Authorize Attempt Recovery (Teacher Action)
                    </button>
                  )}
                </div>
              ) : examSubmitted ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
                  <h3 className="text-sm font-bold text-emerald-950">Submission Recorded Successfully</h3>
                  <p className="text-xs text-emerald-800">
                    Written responses are queued for teacher-approved evaluation. Results appear once published by your teacher.
                  </p>
                  <button
                    onClick={() => {
                      setExamSubmitted(false);
                      setExamStarted(false);
                      setSecondsLeft(activeExam.durationMinutes * 60);
                    }}
                    className="text-xs text-indigo-800 underline font-semibold pt-2"
                  >
                    Reset Demo Attempt
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Question Navigator */}
                  <div className="flex flex-wrap gap-2">
                    {activeExam.questions.map((q, idx) => (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQIndex(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          currentQIndex === idx
                            ? 'bg-indigo-900 text-white border-indigo-900'
                            : studentAnswers[q.id]
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Q{idx + 1} ({q.marks}M)
                      </button>
                    ))}
                  </div>

                  {/* Current Question Card */}
                  {activeExam.questions[currentQIndex] && (() => {
                    const q = activeExam.questions[currentQIndex];
                    return (
                      <div className="p-5 rounded-xl border border-slate-200 space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-sm font-semibold text-slate-900">
                            Q{currentQIndex + 1}. {q.prompt}
                          </span>
                          <span className="text-xs font-bold text-indigo-800 whitespace-nowrap">
                            {q.marks} Marks
                          </span>
                        </div>

                        {(q.qType === 'mcq' || q.qType === 'true_false') && q.options && (
                          <div className="space-y-2">
                            {q.options.map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs"
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  checked={studentAnswers[q.id] === opt}
                                  onChange={() =>
                                    setStudentAnswers((prev) => ({ ...prev, [q.id]: opt }))
                                  }
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {(q.qType === 'fill_blank' || q.qType === 'short_answer' || q.qType === 'long_answer') && (
                          <div className="space-y-3">
                            <textarea
                              rows={q.qType === 'fill_blank' ? 2 : 4}
                              value={studentAnswers[q.id] ?? ''}
                              onChange={(e) =>
                                setStudentAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                              }
                              placeholder="Type your answer here (autosaved immediately)..."
                              className="w-full rounded-lg border border-slate-300 p-3 text-xs"
                            />

                            {/* Camera / Handwritten Answer Image Upload */}
                            {q.qType !== 'fill_blank' && (
                              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-xs text-slate-600">
                                  {answerAttachments[q.id]
                                    ? `Attached handwritten scan: ${answerAttachments[q.id]}`
                                    : 'Optional: Capture or upload handwritten diagram/answer sheet'}
                                </div>
                                <label className="cursor-pointer inline-flex items-center gap-1.5 bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100">
                                  <Camera className="w-3.5 h-3.5 text-indigo-700" />
                                  <span>Camera / Upload Image</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        setAnswerAttachments((prev) => ({ ...prev, [q.id]: file.name }));
                                        notify(`Saved image attachment "${file.name}" to attempt draft.`);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <button
                            disabled={currentQIndex === 0}
                            onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
                            className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold disabled:opacity-40"
                          >
                            Previous
                          </button>
                          <span className="text-[11px] text-emerald-700 font-medium">
                            ✓ Autosaved to local recovery store
                          </span>
                          {currentQIndex < activeExam.questions.length - 1 ? (
                            <button
                              onClick={() => setCurrentQIndex((i) => i + 1)}
                              className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                            >
                              Save & Next
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setExamSubmitted(true);
                                notify('Exam attempt submitted! Confirmation logged.');
                              }}
                              className="px-4 py-2 rounded-lg bg-indigo-900 text-white text-xs font-bold"
                            >
                              Confirm & Submit Attempt
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SUBMISSIONS & TEACHER-APPROVED AI GRADING */}
          {activeTab === 'grading' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Submissions & AI-Assisted Evaluation Queue
                  </h2>
                  <p className="text-xs text-slate-500">
                    AI suggests marks and feedback for written responses, but teachers hold mandatory final approval authority.
                  </p>
                </div>
                <button
                  onClick={handlePublishResults}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold"
                >
                  Publish Approved Results
                </button>
              </div>

              <div className="space-y-4">
                {submissions.map((sub) => (
                  <GradingCard
                    key={sub.id}
                    submission={sub}
                    onApprove={handleApproveSubmissionGrade}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: STUDENT QUERY MANAGEMENT SYSTEM (48h–7d SLA) */}
          {activeTab === 'queries' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">Student Query Queue</h2>

                {role === 'student' && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                    <div className="font-semibold">Raise New Subject Doubt</div>
                    <select
                      value={newQuerySubject}
                      onChange={(e) => setNewQuerySubject(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5"
                    >
                      <option>Computer Science (083)</option>
                      <option>Mathematics</option>
                      <option>Computer Applications (165)</option>
                    </select>
                    <input
                      value={newQueryTitle}
                      onChange={(e) => setNewQueryTitle(e.target.value)}
                      placeholder="Describe your doubt..."
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                    />
                    <button
                      onClick={handleCreateStudentQuery}
                      className="w-full bg-indigo-900 text-white py-1.5 rounded font-semibold"
                    >
                      Submit Query to Teacher
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {queries.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQueryId(q.id)}
                      className={`w-full text-left p-3 rounded-lg border text-xs transition ${
                        selectedQuery.id === q.id
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{q.id}</span>
                        <StatusBadge status={q.status} />
                      </div>
                      <div className="font-medium text-slate-800 mt-1 line-clamp-2">{q.title}</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {q.classSection} • {q.subject} • {q.deadlineLabel}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{selectedQuery.title}</h3>
                      <StatusBadge status={selectedQuery.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Raised by {selectedQuery.studentName} ({selectedQuery.classSection}) • Assigned:{' '}
                      {selectedQuery.assignedTeacher} • Warnings: {selectedQuery.adminWarnings}
                    </p>
                  </div>

                  {(role === 'teacher' || role === 'school_admin') && (
                    <div className="flex items-center gap-2 text-xs">
                      <label className="text-slate-600 font-medium">SLA Window:</label>
                      <select
                        value={selectedSlaHours}
                        onChange={(e) => setSelectedSlaHours(Number(e.target.value))}
                        className="border border-slate-300 rounded-lg px-2 py-1"
                      >
                        <option value={48}>48 Hours (Min)</option>
                        <option value={72}>72 Hours (3 Days)</option>
                        <option value={120}>120 Hours (5 Days)</option>
                        <option value={168}>168 Hours (7 Days Max)</option>
                      </select>
                    </div>
                  )}
                </div>

                {role === 'school_admin' && selectedQuery.status === 'overdue' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Overdue SLA Alert — Send documented administrative reminder?
                    </span>
                    <button
                      onClick={() => {
                        setQueries((prev) =>
                          prev.map((q) =>
                            q.id === selectedQuery.id
                              ? { ...q, adminWarnings: q.adminWarnings + 1 }
                              : q
                          )
                        );
                        notify(`Documented reminder logged in audit trail for ${selectedQuery.assignedTeacher}.`);
                      }}
                      className="bg-amber-900 text-white px-3 py-1 rounded font-semibold"
                    >
                      Send Official Reminder
                    </button>
                  </div>
                )}

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {selectedQuery.messages.map((m, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>
                          {m.sender} ({m.role})
                        </span>
                        <span className="text-slate-400 font-normal">{m.time}</span>
                      </div>
                      <p className="text-slate-700 mt-1">{m.text}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write clarification, explanation, or follow-up..."
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                  />
                  <div className="flex flex-wrap gap-2 justify-end">
                    {role === 'student' && selectedQuery.status === 'resolved' && (
                      <button
                        onClick={() => {
                          setQueries((prev) =>
                            prev.map((q) =>
                              q.id === selectedQuery.id ? { ...q, status: 'reopened' } : q
                            )
                          );
                          notify('Query reopened by student.');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-amber-400 bg-amber-50 text-amber-900 text-xs font-semibold"
                      >
                        Still Need Help (Reopen)
                      </button>
                    )}
                    <button
                      onClick={() => handleSendQueryReply(false)}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Post Reply
                    </button>
                    {(role === 'teacher' || role === 'school_admin') && (
                      <button
                        onClick={() => handleSendQueryReply(true)}
                        className="px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold"
                      >
                        Reply & Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: TEACHER COMMUNITIES & PRIVATE CLASS GROUPS */}
          {activeTab === 'communities' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <h2 className="text-sm font-bold text-slate-900">Authorized Class Communities</h2>
                <p className="text-xs text-slate-500">
                  Private section-level access enforced: Class 9A/9B students cannot read Class 9C groups.
                </p>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    className={`w-full text-left p-3 rounded-lg border text-xs ${
                      selectedGroup.id === g.id
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900">{g.name}</div>
                    <div className="text-slate-500 mt-0.5">
                      {g.memberCount} Authorized Members • {g.teacherName}
                    </div>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900">{selectedGroup.name}</h3>
                  <p className="text-xs text-slate-500">
                    Private Group • Moderator: {selectedGroup.teacherName}
                  </p>
                </div>

                {(role === 'teacher' || role === 'school_admin') && (
                  <div className="flex gap-2">
                    <input
                      value={newGroupPost}
                      onChange={(e) => setNewGroupPost(e.target.value)}
                      placeholder="Post exam reminder, revision note, or class announcement..."
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                    <button
                      onClick={() => {
                        if (!newGroupPost.trim()) return;
                        setGroups((prev) =>
                          prev.map((g) =>
                            g.id === selectedGroup.id
                              ? {
                                  ...g,
                                  posts: [
                                    {
                                      id: `p-${Date.now()}`,
                                      author: ROLE_LABELS[role].title,
                                      tag: 'Announcement',
                                      content: newGroupPost.trim(),
                                      createdAt: 'Just now',
                                    },
                                    ...g.posts,
                                  ],
                                }
                              : g
                          )
                        );
                        setNewGroupPost('');
                        notify(`Posted announcement to ${selectedGroup.name}.`);
                      }}
                      className="bg-indigo-900 text-white px-4 py-2 rounded-lg text-xs font-semibold"
                    >
                      Publish Post
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {selectedGroup.posts.map((post) => (
                    <div key={post.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-900">{post.tag}</span>
                        <span className="text-slate-400">{post.createdAt}</span>
                      </div>
                      <p className="text-slate-800">{post.content}</p>
                      <div className="text-[11px] text-slate-500">Posted by {post.author}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: ROLE-SCOPED ANALYTICS & PARENT REPORTS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-950">
                <strong>Labelled Synthetic Analytics:</strong> Metrics below are computed from synthetic pilot records using documented formulas (`SUM(obtained)/SUM(max)*100`). Real student scores appear only after Supabase production connection.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Subject-Wise Accuracy Breakdown</h3>
                  {[
                    { subject: 'Computer Science (083)', pct: 86 },
                    { subject: 'Computer Applications (165)', pct: 82 },
                    { subject: 'Mathematics (041)', pct: 74 },
                    { subject: 'Artificial Intelligence (843)', pct: 89 },
                  ].map((s) => (
                    <div key={s.subject} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span>{s.subject}</span>
                        <span>{s.pct}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-700 rounded-full"
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 text-xs">
                  <h3 className="text-sm font-bold text-slate-900">Topic-Level Strengths & Learning Gaps</h3>
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="font-bold text-emerald-900">Strong Topics (≥ 80% Accuracy)</div>
                    <p className="text-emerald-800 mt-1">
                      SQL Joins & Aggregation, Cyber Safety Protocols, Python Lists & Dictionaries
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                    <div className="font-bold text-rose-900">Needs Revision (&lt; 60% Accuracy)</div>
                    <p className="text-rose-800 mt-1">
                      Binary File `seek()/tell()` Offsets, Heron’s Formula Multi-Step Word Problems
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900">Suggested Revision Action (AI Suggestion)</div>
                    <p className="text-slate-600 mt-1">
                      Assign 15-minute practice worksheet on Python binary file pointers before final 70-mark theory exam.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: PLATFORM & SCHOOL POLICY SETTINGS */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 text-xs">
              <h2 className="text-base font-bold text-slate-900">School Exam & Query SLA Policies</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">Query Resolution SLA Policy</div>
                  <p className="text-slate-600">
                    Minimum 48 hours • Maximum 7 days (168 hours), excluding configured school holidays.
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">Exam Focus-Violation Policy</div>
                  <p className="text-slate-600">
                    Warn on 1st & 2nd tab switch; pause attempt on 3rd switch while preserving all autosaved answers.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1 shadow-sm">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] text-indigo-700 font-medium">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: StudentQuery['status'] }) {
  const styles: Record<StudentQuery['status'], string> = {
    open: 'bg-slate-100 text-slate-800',
    assigned: 'bg-blue-50 text-blue-800',
    in_progress: 'bg-indigo-50 text-indigo-800',
    resolved: 'bg-emerald-50 text-emerald-800',
    reopened: 'bg-amber-100 text-amber-900',
    overdue: 'bg-rose-100 text-rose-900',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function GradingCard({
  submission,
  onApprove,
}: {
  submission: SubmissionRecord;
  onApprove: (id: string, marks: number) => void;
}) {
  const [marksInput, setMarksInput] = useState<number>(
    submission.finalApprovedMarks ?? submission.aiSuggestedMarks
  );

  return (
    <div className="p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold text-slate-900">{submission.studentName}</span>
          <span className="text-slate-500 ml-2">
            Roll: {submission.rollNo} • Submitted {submission.submittedAt} • Tab Switches: {submission.tabViolations}
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-800 uppercase text-[10px]">
          {submission.status.replace('_', ' ')}
        </span>
      </div>

      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
        <div className="font-semibold text-slate-700">Question: {submission.writtenQuestion}</div>
        <div className="text-slate-900">Student Answer: “{submission.studentWrittenAnswer}”</div>
        {submission.attachedImageName && (
          <div className="text-indigo-700 font-medium">
            📷 Attached Answer Scan: {submission.attachedImageName}
          </div>
        )}
      </div>

      <div className="bg-indigo-50/70 p-3 rounded-lg border border-indigo-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-bold text-indigo-950">
            AI Suggested Written Score: {submission.aiSuggestedMarks} / {submission.maxWrittenMarks} (Auto MCQ:{' '}
            {submission.mcqAutoMarks}/{submission.maxMcqMarks})
          </div>
          <div className="text-indigo-900 mt-0.5">AI Draft Feedback: {submission.aiDraftFeedback}</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Teacher Final Marks:</label>
          <input
            type="number"
            step="0.5"
            min={0}
            max={submission.maxWrittenMarks}
            value={marksInput}
            onChange={(e) => setMarksInput(Number(e.target.value))}
            className="w-16 border border-slate-300 rounded px-2 py-1 bg-white"
          />
          <button
            onClick={() => onApprove(submission.id, marksInput)}
            className="bg-indigo-900 text-white px-3 py-1.5 rounded-lg font-semibold"
          >
            Approve Final Grade
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;