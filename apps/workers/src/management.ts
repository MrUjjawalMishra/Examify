import type { D1Database } from "@cloudflare/workers-types";
import type { TenantSession } from "./sessions";
import { normalizeClass } from "./credentials";
export async function dashboard(db: D1Database, s: TenantSession) {
  const profile = await db
    .prepare("SELECT id,username,display_name,role FROM users WHERE id=?")
    .bind(s.userId)
    .first();
  if (s.role === "school_admin")
    return {
      profile,
      classes: (
        await db
          .prepare("SELECT * FROM classes ORDER BY class_name,section")
          .all()
      ).results,
      subjects: (await db.prepare("SELECT * FROM subjects ORDER BY name").all())
        .results,
      teachers: (
        await db
          .prepare(
            "SELECT id,username,display_name,active FROM users WHERE role='teacher' ORDER BY display_name",
          )
          .all()
      ).results,
      assignments: (
        await db
          .prepare(
            "SELECT a.teacher_id,a.class_id,s.name AS subject FROM teacher_subjects a JOIN subjects s ON s.id=a.subject_id",
          )
          .all()
      ).results,
    };
  if (s.role === "teacher")
    return {
      profile,
      classes: (
        await db
          .prepare(
            "SELECT c.* FROM classes c JOIN teacher_assignments a ON a.class_id=c.id WHERE a.teacher_id=?",
          )
          .bind(s.userId)
          .all()
      ).results,
      students: (
        await db
          .prepare(
            "SELECT u.id,u.username,u.display_name,u.active,e.roll_number,c.class_name,c.section,c.id AS class_id FROM users u JOIN student_enrollments e ON e.student_id=u.id JOIN classes c ON c.id=e.class_id JOIN teacher_assignments a ON a.class_id=c.id WHERE a.teacher_id=? ORDER BY c.class_name,c.section,e.roll_number",
          )
          .bind(s.userId)
          .all()
      ).results,
    };
  return {
    profile,
    enrollment: await db
      .prepare(
        "SELECT c.class_name,c.section,e.roll_number FROM student_enrollments e JOIN classes c ON c.id=e.class_id WHERE e.student_id=?",
      )
      .bind(s.userId)
      .first(),
  };
}
export async function assignClass(
  db: D1Database,
  s: TenantSession,
  d: Record<string, unknown>,
) {
  if (s.role !== "school_admin") throw new Error("FORBIDDEN");
  if (
    typeof d.className !== "string" ||
    typeof d.section !== "string" ||
    typeof d.subject !== "string" ||
    !d.subject.trim() ||
    d.subject.length > 80 ||
    typeof d.teacherId !== "string"
  )
    throw new Error("INVALID_CLASS");
  const className = normalizeClass(d.className),
    section = d.section.trim().toLowerCase();
  if (!/^[a-z]{1,3}$/.test(section)) throw new Error("INVALID_SECTION");
  if (
    !(await db
      .prepare(
        "SELECT id FROM users WHERE id=? AND role='teacher' AND active=1",
      )
      .bind(d.teacherId)
      .first())
  )
    throw new Error("INVALID_TEACHER");
  const classId = `${className}-${section}`,
    subject = d.subject.trim();
  await db.batch([
    db
      .prepare("INSERT INTO classes VALUES(?,?,?) ON CONFLICT DO NOTHING")
      .bind(classId, className, section),
    db
      .prepare("INSERT INTO subjects VALUES(?,?) ON CONFLICT(name) DO NOTHING")
      .bind(crypto.randomUUID(), subject),
    db
      .prepare(
        "INSERT INTO teacher_assignments VALUES(?,?) ON CONFLICT DO NOTHING",
      )
      .bind(d.teacherId, classId),
    db
      .prepare(
        "INSERT INTO teacher_subjects SELECT ?,?,id FROM subjects WHERE name=? ON CONFLICT DO NOTHING",
      )
      .bind(d.teacherId, classId, subject),
    db
      .prepare("INSERT INTO audit_events VALUES(?,?,?,?,?)")
      .bind(
        crypto.randomUUID(),
        s.userId,
        "teacher_assigned",
        d.teacherId,
        Date.now(),
      ),
  ]);
  return { ok: true };
}
export async function setAccountStatus(
  db: D1Database,
  s: TenantSession,
  d: Record<string, unknown>,
) {
  if (typeof d.userId !== "string" || typeof d.active !== "boolean")
    throw new Error("INVALID_ACCOUNT");
  const allowed =
    s.role === "school_admin"
      ? await db
          .prepare("SELECT id FROM users WHERE id=? AND role='teacher'")
          .bind(d.userId)
          .first()
      : s.role === "teacher"
        ? await db
            .prepare(
              "SELECT u.id FROM users u JOIN student_enrollments e ON e.student_id=u.id JOIN teacher_assignments a ON a.class_id=e.class_id WHERE u.id=? AND u.role='student' AND a.teacher_id=?",
            )
            .bind(d.userId, s.userId)
            .first()
        : null;
  if (!allowed) throw new Error("FORBIDDEN");
  await db.batch([
    db
      .prepare(
        "UPDATE users SET active=?,credential_version=credential_version+1 WHERE id=?",
      )
      .bind(d.active ? 1 : 0, d.userId),
    db
      .prepare("INSERT INTO audit_events VALUES(?,?,?,?,?)")
      .bind(
        crypto.randomUUID(),
        s.userId,
        d.active ? "account_activated" : "account_suspended",
        d.userId,
        Date.now(),
      ),
  ]);
  return { ok: true };
}
export async function editStudent(
  db: D1Database,
  s: TenantSession,
  d: Record<string, unknown>,
) {
  if (s.role !== "teacher") throw new Error("FORBIDDEN");
  if (
    typeof d.studentId !== "string" ||
    typeof d.name !== "string" ||
    !d.name.trim() ||
    d.name.length > 100
  )
    throw new Error("INVALID_ACCOUNT");
  const allowed = await db
    .prepare(
      "SELECT u.id FROM users u JOIN student_enrollments e ON e.student_id=u.id JOIN teacher_assignments a ON a.class_id=e.class_id WHERE u.id=? AND u.role='student' AND a.teacher_id=?",
    )
    .bind(d.studentId, s.userId)
    .first();
  if (!allowed) throw new Error("FORBIDDEN");
  await db.batch([
    db
      .prepare("UPDATE users SET display_name=? WHERE id=?")
      .bind(d.name.normalize("NFKC").trim(), d.studentId),
    db
      .prepare("INSERT INTO audit_events VALUES(?,?,?,?,?)")
      .bind(
        crypto.randomUUID(),
        s.userId,
        "student_profile_updated",
        d.studentId,
        Date.now(),
      ),
  ]);
  return { ok: true };
}
