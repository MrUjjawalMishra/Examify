const navigation = [
  "Overview",
  "Exams",
  "Students",
  "Reports",
  "Queries",
  "Groups",
];

const stats = [
  { label: "Schools", value: "12", change: "+2 this term" },
  { label: "Active exams", value: "47", change: "9 due today" },
  { label: "Completion rate", value: "91%", change: "+4.6% vs last week" },
  { label: "Pending queries", value: "23", change: "6 overdue" },
];

const examQueue = [
  {
    title: "Unit Test - Biology",
    className: "Grade 9A",
    time: "Today • 09:00",
    status: "Open",
  },
  {
    title: "Math Midterm Review",
    className: "Grade 8C",
    time: "Today • 13:30",
    status: "Draft",
  },
  {
    title: "History Essay Lab",
    className: "Grade 10B",
    time: "Tomorrow • 11:00",
    status: "Scheduled",
  },
];

const pendingActions = [
  "Review 5 AI-generated answer suggestions",
  "Approve group announcement for Grade 9C",
  "Resolve 3 student queries with overdue deadlines",
];

const classrooms = [
  {
    name: "Class 9C",
    teacher: "Ms. Aisha",
    attendance: "96%",
    progress: "81%",
  },
  { name: "Class 8A", teacher: "Mr. Rao", attendance: "92%", progress: "76%" },
  {
    name: "Class 10B",
    teacher: "Ms. Dutta",
    attendance: "94%",
    progress: "88%",
  },
];

function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-md shadow-indigo-200">
                E
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500">
                  Examify
                </p>
                <h1 className="text-lg font-semibold text-slate-900">
                  School Operations
                </h1>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              {navigation.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`rounded-full px-3 py-2 transition ${
                    item === "Overview"
                      ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                      : "hover:bg-slate-100"
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Invite teacher
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
              >
                New exam
              </button>
            </div>
          </div>
        </header>

        <main className="mt-6 space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">{stat.label}</p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <span className="text-3xl font-bold tracking-tight text-slate-900">
                    {stat.value}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                    {stat.change}
                  </span>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
                    Exam timeline
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Upcoming exams
                  </h2>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  View all
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {examQueue.map((exam) => (
                  <div
                    key={exam.title}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {exam.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {exam.className} • {exam.time}
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      {exam.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-indigo-900 p-5 text-white shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-200">
                Priority actions
              </p>
              <h2 className="mt-3 text-xl font-semibold">Needs attention</h2>
              <ul className="mt-5 space-y-3">
                {pendingActions.map((action) => (
                  <li
                    key={action}
                    className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-sm text-indigo-50"
                  >
                    <span
                      className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-400"
                      aria-hidden="true"
                    />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  Class performance
                </h2>
                <button
                  type="button"
                  className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700"
                >
                  Generate report
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {classrooms.map((room) => (
                  <div
                    key={room.name}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {room.name}
                        </p>
                        <p className="text-sm text-slate-500">{room.teacher}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium text-slate-700">Attendance</p>
                        <p className="font-semibold text-slate-900">
                          {room.attendance}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                        <span>Learning progress</span>
                        <span>{room.progress}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100">
                        <div
                          className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                          style={{ width: room.progress }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
                Quick notes
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Today’s summary
              </h2>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-700">
                    Positive trend
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    Math scores improved by 7.4%
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-700">
                    At-risk area
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    3 classes need revision support in chemistry
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-4">
                  <p className="text-sm font-medium text-sky-700">
                    Next action
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    Publish revised exam schedule before 18:00
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
