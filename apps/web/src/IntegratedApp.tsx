import { useEffect, useRef, useState, type FormEvent } from "react";
import { parseRoster, type RosterRow } from "./roster";
import { PrivateMedia } from "./PrivateMedia";
import "./integrated.css";
type Role = "platform_owner" | "school_admin" | "teacher" | "student";
interface Profile {
  id?: string;
  userId?: string;
  username?: string;
  email?: string;
  display_name?: string;
  role: Role;
}
interface School {
  id: string;
  code: string;
  name: string;
  status?: string;
}
interface Person {
  id: string;
  username: string;
  display_name: string;
  active: number;
  roll_number?: string;
  class_name?: string;
  section?: string;
}
interface Class {
  id: string;
  class_name: string;
  section: string;
}
interface Dashboard {
  profile: Profile;
  classes?: Class[];
  teachers?: Person[];
  students?: Person[];
  enrollment?: { class_name: string; section: string; roll_number: string };
}
interface Credential {
  id: string;
  username?: string;
  initialPassword?: string;
  replayed?: boolean;
}
async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...(data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
  });
  if(!response.headers.get("Content-Type")?.includes("application/json"))throw Error("Service temporarily unavailable. Completed import rows are safe to retry.");
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? "Request failed");
  return result as T;
}
function values(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const result: Record<string, FormDataEntryValue> = {};
  new FormData(e.currentTarget).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
export default function IntegratedApp() {
  const [owner, setOwner] = useState(location.pathname.startsWith("/owner"));
  const [code, setCode] = useState(
    sessionStorage.getItem("examify-school") ?? "",
  );
  const [profile, setProfile] = useState<Profile | null>(null),
    [data, setData] = useState<Dashboard | null>(null),
    [schools, setSchools] = useState<School[]>([]);
  const [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]),
    [rows, setRows] = useState<RosterRow[]>([]);
  const [schoolRequest, setSchoolRequest] = useState(() => crypto.randomUUID());
  const base = owner ? "/api/owner" : `/s/${encodeURIComponent(code)}/api`;
  const context = useRef({base,epoch:0});
  if(context.current.base!==base)context.current={base,epoch:context.current.epoch+1};
  async function refresh() {
    const epoch=context.current.epoch;
    if (owner) {
      const p = await api<Profile>("/api/owner/me");
      const listed=await api<School[]>("/api/owner/schools");
      if(epoch!==context.current.epoch)return;
      setProfile(p);
      setSchools(listed);
    } else {
      const d = await api<Dashboard>(base + "/dashboard");
      if(epoch!==context.current.epoch)return;
      setData(d);
      setProfile(d.profile);
    }
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    setProfile(null);
    setData(null);
    setCredentials([]);
    setRows([]);
    (async () => {
      try {
        if (owner || code) await refresh();
      } catch {
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, code]);
  async function login(e: FormEvent<HTMLFormElement>) {
    const d = values(e);
    await run(async () => {
      await api(owner ? "/api/owner/login" : base + "/auth/login", d);
      await refresh();
    });
  }
  async function logout() {
    context.current.epoch++;
    await run(async () => {
      await api(owner ? base + "/logout" : base + "/auth/logout", {});
      setProfile(null);
      setData(null);
      setCredentials([]);
    });
  }
  async function provision(e: FormEvent<HTMLFormElement>) {
    const d = values(e);
    await run(async () => {
      await api("/api/owner/schools", { ...d, requestId: schoolRequest });
      setSchoolRequest(crypto.randomUUID());
      await refresh();
      setNotice(
        "School activated. Deliver its administrator credentials securely.",
      );
    });
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    const d = values(e);
    await run(async () => {
      const c = await api<Credential>(base + "/users", {
        ...d,
        requestId: crypto.randomUUID(),
      });
      setCredentials([c]);
      await refresh();
    });
  }
  async function assign(e: FormEvent<HTMLFormElement>) {
    const d = values(e);
    await run(async () => {
      await api(base + "/assignments", d);
      await refresh();
      setNotice("Class and subject assigned.");
    });
  }
  async function importStudents() {
    await run(async () => {
      const current=await api<Dashboard>(base+"/dashboard");
      const normalize=(name:string)=>name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");
      const plan=rows.map((row,i)=>{
        const classroom=current.classes?.find(c=>c.class_name===row.className&&c.section===row.section);
        if(!classroom)throw Error(`No assigned class for row ${i+1}: ${row.className}${row.section}`);
        const existing=current.students?.find(s=>s.class_name===row.className&&s.section===row.section&&s.roll_number===row.rollNumber);
        if(existing&&normalize(existing.display_name)!==normalize(row.name))throw Error(`Row ${i+1}: roll number belongs to a different student. Correct the roster before importing.`);
        return {row,classroom,existing};
      });
      const output:Credential[]=[];
      setCredentials([]);
      for(let i=0;i<plan.length;i++){
        const {row,classroom,existing}=plan[i];
        const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([classroom.id,row.rollNumber,normalize(row.name)])));
        const requestId="roster-"+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
        const credential=existing?{id:existing.id,username:existing.username,replayed:true}:await api<Credential>(base+"/users",{name:row.name,classId:classroom.id,rollNumber:row.rollNumber,requestId});
        output.push(credential);setCredentials([...output]);setNotice(`Processed ${i+1} of ${rows.length}`);
      }
      await refresh();setNotice(`${rows.length} rows processed. Replayed rows do not reissue passwords.`);
    });
  }
  return (
    <div className="ex-app">
      <header>
        <a className="brand" href="/">
          E<span>Examify</span>
        </a>
        <span className="context">School workspace</span>
        {profile && (
          <button onClick={logout} disabled={busy}>
            Sign out
          </button>
        )}
      </header>
      <main>
        {error && (
          <div role="alert" className="alert">
            {error.replaceAll("_", " ")}
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        {checking ? (
          <p role="status">Checking your session…</p>
        ) : !profile ? (
          <div className="login">
            <section>
              <p className="eyebrow">EXAMIFY</p>
              <h1>
                One school.
                <br />A clearer school day.
              </h1>
              <p>
                Sign in to your school’s secure workspace. Your account is
                provided by your school.
              </p>
            </section>
            <section className="panel">
              <nav>
                <button
                  className={!owner ? "selected" : ""}
                  onClick={() => setOwner(false)}
                >
                  School sign in
                </button>
                <button
                  className={owner ? "selected" : ""}
                  onClick={() => setOwner(true)}
                >
                  Platform owner
                </button>
              </nav>
              <h2>{owner ? "Owner sign in" : "Welcome back"}</h2>
              {!owner && (
                <>
                  <form
                    onSubmit={(e) => {
                      const d = values(e);
                      void run(async () =>
                        setSchools(
                          await api<School[]>(
                            "/api/schools?q=" + encodeURIComponent(String(d.q)),
                          ),
                        ),
                      );
                    }}
                  >
                    <label>
                      Find your school
                      <input
                        name="q"
                        placeholder="School name or code"
                        required
                      />
                    </label>
                    <button disabled={busy}>Search</button>
                  </form>
                  <label>
                    School
                    <select
                      value={code}
                      onChange={(e) => {
                        sessionStorage.setItem(
                          "examify-school",
                          e.target.value,
                        );
                        setCode(e.target.value);
                      }}
                    >
                      <option value="">Choose your school</option>
                      {code && !schools.some((s) => s.code === code) && (
                        <option value={code}>{code}</option>
                      )}
                      {schools.map((s) => (
                        <option key={s.id} value={s.code}>
                          {s.name} · {s.code}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <form onSubmit={login}>
                <label>
                  {owner ? "Email" : "Account ID"}
                  <input
                    name={owner ? "email" : "username"}
                    type={owner ? "email" : "text"}
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <button
                  className="primary"
                  disabled={busy || (!owner && !code)}
                >
                  {busy ? "Signing in…" : "Sign in"}
                </button>
              </form>
              <p className="hint">
                No public registration. Contact your school for account help.
              </p>
            </section>
          </div>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">{profile.role.replaceAll("_", " ")}</p>
                <h1>
                  {owner
                    ? "Your schools"
                    : `Welcome, ${profile.display_name ?? profile.username}`}
                </h1>
                <p>
                  {owner
                    ? "Manage school access and administrator onboarding."
                    : `School ${code} · ${profile.username}`}
                </p>
              </div>
            </div>
            {owner ? (
              <div className="grid">
                <section className="panel">
                  <h2>School directory</h2>
                  {schools.length === 0 ? (
                    <p>No schools yet.</p>
                  ) : (
                    schools.map((s) => (
                      <article key={s.id}>
                        <strong>{s.name}</strong>
                        <p>
                          {s.code} · {s.status}
                        </p>
                        <button
                          disabled={busy || s.status === "provisioning"}
                          onClick={() =>
                            run(async () => {
                              await api("/api/owner/school-status", {
                                id: s.id,
                                status:
                                  s.status === "active"
                                    ? "suspended"
                                    : "active",
                              });
                              await refresh();
                            })
                          }
                        >
                          {s.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      </article>
                    ))
                  )}
                </section>
                <section className="panel">
                  <h2>Create school</h2>
                  <form onSubmit={provision}>
                    <label>
                      School name
                      <input name="name" required maxLength={120} />
                    </label>
                    <label>
                      School code
                      <input
                        name="code"
                        required
                        pattern="[A-Za-z0-9-]{1,24}"
                      />
                    </label>
                    <label>
                      Administrator ID
                      <input
                        name="adminId"
                        required
                        pattern="[A-Za-z0-9._-]{1,64}"
                      />
                    </label>
                    <label>
                      Initial administrator password
                      <input
                        name="password"
                        type="password"
                        minLength={12}
                        required
                        autoComplete="new-password"
                      />
                    </label>
                    <button disabled={busy} className="primary">
                      Create and activate school
                    </button>
                  </form>
                </section>
              </div>
            ) : (
              <>
                {profile.role === "school_admin" && (
                  <div className="grid">
                    <section className="panel">
                      <h2>Teachers</h2>
                      {!data?.teachers?.length && <p>No teachers yet.</p>}
                      {data?.teachers?.map((p) => (
                        <article key={p.id}>
                          <strong>{p.display_name}</strong>
                          <p>
                            {p.username} · {p.active ? "Active" : "Suspended"}
                          </p>
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await api(base + "/account-status", {
                                  userId: p.id,
                                  active: !p.active,
                                });
                                await refresh();
                              })
                            }
                          >
                            {p.active ? "Suspend" : "Activate"}
                          </button>
                        </article>
                      ))}
                      <h3>Add teacher</h3>
                      <form onSubmit={create}>
                        <label>
                          Full name
                          <input name="name" required />
                        </label>
                        <button disabled={busy}>Create teacher</button>
                      </form>
                    </section>
                    <section className="panel">
                      <h2>Class & subject assignments</h2>
                      <form onSubmit={assign}>
                        <label>
                          Teacher
                          <select name="teacherId" required>
                            <option value="">Select teacher</option>
                            {data?.teachers
                              ?.filter((t) => t.active)
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.display_name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Class
                          <input name="className" placeholder="9" required />
                        </label>
                        <label>
                          Section
                          <input name="section" placeholder="B" required />
                        </label>
                        <label>
                          Subject
                          <input
                            name="subject"
                            placeholder="Mathematics"
                            required
                          />
                        </label>
                        <button disabled={busy}>Assign teacher</button>
                      </form>
                      <h3>Classes</h3>
                      {data?.classes?.map((c) => (
                        <p key={c.id}>
                          Class {c.class_name}
                          {c.section.toUpperCase()}
                        </p>
                      ))}
                    </section>
                  </div>
                )}
                {profile.role === "teacher" && (
                  <>
                    <div className="grid">
                      <section className="panel">
                        <h2>Add a student</h2>
                        <form onSubmit={create}>
                          <label>
                            Student name
                            <input name="name" required />
                          </label>
                          <label>
                            Assigned class
                            <select name="classId" required>
                              <option value="">Select class</option>
                              {data?.classes?.map((c) => (
                                <option value={c.id} key={c.id}>
                                  {c.class_name}
                                  {c.section.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Roll number
                            <input
                              name="rollNumber"
                              pattern="[0-9]+"
                              required
                            />
                          </label>
                          <button disabled={busy}>Create student</button>
                        </form>
                      </section>
                      <section className="panel">
                        <h2>Import class roster</h2>
                        <p>CSV or XLSX · up to 300 students · 5 MB maximum.</p>
                        <p className="hint">
                          Headers: Student Name, Class, Section, Roll Number.
                        </p>
                        <input
                          aria-label="Roster file"
                          type="file"
                          accept=".csv,.xlsx"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file)
                              void run(async () => {
                                setRows(await parseRoster(file));
                                
                              });
                          }}
                        />
                        {rows.length > 0 && (
                          <>
                            <p>{rows.length} validated rows ready for review</p>
                            <div className="scroll">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Name</th>
                                    <th>Class</th>
                                    <th>Roll</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((r, i) => (
                                    <tr key={i}>
                                      <td>{r.name}</td>
                                      <td>
                                        {r.className}
                                        {r.section}
                                      </td>
                                      <td>{r.rollNumber}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={importStudents}
                            >
                              Import reviewed rows
                            </button>
                          </>
                        )}
                      </section>
                    </div>
                    <section className="panel">
                      <h2>Edit student name</h2>
                      <p>
                        Correct the display name without changing the account
                        ID.
                      </p>
                      <form
                        onSubmit={(e) => {
                          const d = values(e);
                          void run(async () => {
                            await api(base + "/students/profile", d);
                            await refresh();
                            setNotice("Student name updated.");
                          });
                        }}
                      >
                        <label>
                          Student
                          <select name="studentId" required>
                            <option value="">Select student</option>
                            {data?.students?.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.display_name} · {p.username}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Corrected name
                          <input name="name" required maxLength={100} />
                        </label>
                        <button disabled={busy}>Save name</button>
                      </form>
                    </section>
                    <section className="panel">
                      <h2>Your students</h2>
                      {!data?.students?.length ? (
                        <p>No students in your assigned classes.</p>
                      ) : (
                        <div className="scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Class</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.students.map((p) => (
                                <tr key={p.id}>
                                  <td>{p.display_name}</td>
                                  <td>{p.username}</td>
                                  <td>
                                    {p.class_name}
                                    {p.section}
                                  </td>
                                  <td>
                                    <button
                                      disabled={busy}
                                      onClick={() =>
                                        run(async () => {
                                          const result = await api<{
                                            initialPassword: string;
                                          }>(
                                            base + "/students/reset-password",
                                            { studentId: p.id },
                                          );
                                          setCredentials([
                                            {
                                              id: p.id,
                                              username: p.username,
                                              ...result,
                                            },
                                          ]);
                                        })
                                      }
                                    >
                                      Reset password
                                    </button>
                                    <button
                                      disabled={busy}
                                      onClick={() =>
                                        run(async () => {
                                          await api(base + "/account-status", {
                                            userId: p.id,
                                            active: !p.active,
                                          });
                                          await refresh();
                                        })
                                      }
                                    >
                                      {p.active ? "Suspend" : "Activate"}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </>
                )}
                {profile.role === "student" && (
                  <section className="panel">
                    <h2>My profile</h2>
                    <p>{profile.display_name}</p>
                    <p>Username: {profile.username}</p>
                    {data?.enrollment && (
                      <p>
                        Class {data.enrollment.class_name}
                        {data.enrollment.section.toUpperCase()} · Roll{" "}
                        {data.enrollment.roll_number}
                      </p>
                    )}
                    <p>
                      Examinations will appear here when the assessment workflow
                      is available.
                    </p>
                  </section>
                )}
                <PrivateMedia base={base} />
                <section className="panel">
                  <h2>Change my password</h2>
                  <p>
                    This is optional. Changing your password signs you out on
                    all devices.
                  </p>
                  <form
                    onSubmit={(e) => {
                      const d = values(e);
                      void run(async () => {
                        await api(base + "/auth/password", d);
                        setProfile(null);
                        setNotice(
                          "Password changed. Sign in with your new password.",
                        );
                      });
                    }}
                  >
                    <label>
                      Current password
                      <input
                        name="currentPassword"
                        type="password"
                        required
                        autoComplete="current-password"
                      />
                    </label>
                    <label>
                      New password
                      <input
                        name="newPassword"
                        type="password"
                        minLength={8}
                        required
                        autoComplete="new-password"
                      />
                    </label>
                    <button disabled={busy}>Change password</button>
                  </form>
                </section>
              </>
            )}
            {credentials.length > 0 && (
              <section className="panel credentials">
                <h2>Private credential slips</h2>
                <p>
                  Share only with the intended account holder. These passwords
                  are not stored in plaintext.
                </p>
                <button onClick={() => window.print()}>Print slips</button>
                {credentials.map((c) => (
                  <article key={c.id}>
                    <strong>{c.username ?? c.id}</strong>
                    <p>
                      {c.replayed
                        ? "Previously created. Reset the password if another copy is needed."
                        : `Initial password: ${c.initialPassword}`}
                    </p>
                    <p>School: {code}</p>
                  </article>
                ))}
                <button onClick={() => setCredentials([])}>
                  Clear credentials
                </button>
              </section>
            )}
          </>
        )}
      </main>
      <footer>Examify · Secure school workspaces</footer>
    </div>
  );
}

