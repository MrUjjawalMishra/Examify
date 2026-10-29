import { expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { buildSync } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../src/passwords";

it("runs owner → two isolated schools → teacher → 30 students through gateway service bindings", async () => {
  const bundle = (entry: string) =>
    buildSync({
      entryPoints: [fileURLToPath(new URL("../" + entry, import.meta.url))],
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      external: ["node:*"],
    }).outputFiles[0].text;
  const common = {
    modules: true,
    compatibilityDate: "2026-10-19",
    compatibilityFlags: ["nodejs_compat"],
    bindings: { INTERNAL_KEY: "local-test-only-internal-key-32-characters" },
  };
  const tenant = bundle("src/tenant-entry.ts");
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          ...common,
          name: "gateway",
          script: bundle("src/index.ts"),
          d1Databases: ["CONTROL"],
          serviceBindings: { TENANT_1: "school-a", TENANT_2: "school-b" },
        },
        {
          ...common,
          name: "school-a",
          script: tenant,
          d1Databases: { DB: "school-a-db" },
          r2Buckets: { FILES: "school-a-files" },
        },
        {
          ...common,
          name: "school-b",
          script: tenant,
          d1Databases: { DB: "school-b-db" },
          r2Buckets: { FILES: "school-b-files" },
        },
      ],
    }),
  );
  try {
    const control = await mf.getD1Database("CONTROL", "gateway");
    for (const [db, dir] of [
      [control, "control"],
      [await mf.getD1Database("DB", "school-a"), "tenant"],
      [await mf.getD1Database("DB", "school-b"), "tenant"],
    ] as const) {
      for (const file of (
        await readdir(new URL("../migrations/" + dir, import.meta.url))
      ).sort()) {
        const sql = await readFile(
          new URL(`../migrations/${dir}/${file}`, import.meta.url),
          "utf8",
        );
        const triggers = sql.match(/CREATE TRIGGER[\s\S]*?END;/g) ?? [];
        for (const s of sql
          .replace(/CREATE TRIGGER[\s\S]*?END;/g, "")
          .split(";")
          .filter((s) => s.trim()))
          await db.prepare(s).run();
        for (const s of triggers) await db.prepare(s).run();
      }
    }
    await control
      .prepare("INSERT INTO owners(id,email,password_hash) VALUES(?,?,?)")
      .bind(
        "owner",
        "owner@example.test",
        await hashPassword("owner-test-password"),
      )
      .run();
    const call = (
      path: string,
      data?: unknown,
      cookie = "",
      headers: Record<string, string> = {},
    ) =>
      mf.dispatchFetch("https://examify.test" + path, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          Origin: "https://examify.test",
          "Content-Type": "application/json",
          Cookie: cookie,
          ...headers,
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    const login = async (path: string, data: unknown) => {
      const r = await call(path, data);
      expect(r.status, await r.clone().text()).toBe(200);
      return r.headers.get("set-cookie")!.split(";")[0];
    };
    expect((await call("/api/owner/schools", {})).status).toBe(401);
    expect(
      (
        await call("/api/owner/login", {
          email: "owner@example.test",
          password: "wrong",
        })
      ).status,
    ).toBe(401);
    const owner = await login("/api/owner/login", {
      email: "owner@example.test",
      password: "owner-test-password",
    });
    let schoolId = "";
    for (const code of ["C8", "ABC"]) {
      const input = {
        code,
        name: `Test ${code}`,
        adminId: "admin",
        password: "admin-test-password",
        requestId: `school-request-${code}-0001`,
      };
      const r = await call("/api/owner/schools", input, owner);
      expect(r.status, await r.clone().text()).toBe(201);
      if (code === "C8") schoolId = ((await r.json()) as { id: string }).id;
      expect((await call("/api/owner/schools", input, owner)).status).toBe(200);
    }
    const admin = await login("/s/C8/api/auth/login", {
      username: "admin",
      password: "admin-test-password",
    });
    expect((await call("/s/ABC/api/dashboard", undefined, admin)).status).toBe(
      401,
    );
    const teacherR = await call(
      "/s/C8/api/users",
      { name: "Ujjwal Mishra", requestId: "teacher-request-0001" },
      admin,
    );
    expect(teacherR.status, await teacherR.clone().text()).toBe(201);
    const teacher = (await teacherR.json()) as {
      id: string;
      username: string;
      initialPassword: string;
    };
    expect(
      (
        await call(
          "/s/C8/api/assignments",
          {
            teacherId: teacher.id,
            className: "IX",
            section: "B",
            subject: "Math",
          },
          admin,
        )
      ).status,
    ).toBe(200);
    const teacherCookie = await login("/s/C8/api/auth/login", {
      username: teacher.username,
      password: teacher.initialPassword,
    });
    let pupil:
      { id: string; username: string; initialPassword: string } | undefined;
    for (let i = 1; i <= 30; i++) {
      const input = {
        name: "Test Student",
        classId: "9-b",
        rollNumber: String(i),
        requestId: `roster-test-row-${String(i).padStart(4, "0")}`,
      };
      const r = await call("/s/C8/api/users", input, teacherCookie);
      expect(r.status, await r.clone().text()).toBe(201);
      if (i === 1) {
        pupil = (await r.json()) as typeof pupil;
        expect(
          await (await call("/s/C8/api/users", input, teacherCookie)).json(),
        ).toMatchObject({ replayed: true });
      }
    }
    const dashboard = (await (
      await call("/s/C8/api/dashboard", undefined, teacherCookie)
    ).json()) as { students: unknown[] };
    expect(dashboard.students).toHaveLength(30);
    const student = await login("/s/C8/api/auth/login", {
      username: pupil!.username,
      password: pupil!.initialPassword,
    });
    expect(
      (
        await call(
          "/s/C8/api/students/profile",
          { studentId: pupil!.id, name: "Corrected Student" },
          student,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "/s/C8/api/students/profile",
          { studentId: pupil!.id, name: "Test Student" },
          teacherCookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "/s/C8/api/users",
          { name: "Denied", requestId: "denied-request-0001" },
          student,
        )
      ).status,
    ).toBe(403);
    const upload = await mf.dispatchFetch(
      "https://examify.test/s/C8/api/media",
      {
        method: "POST",
        headers: {
          Origin: "https://examify.test",
          Cookie: student,
          "Content-Type": "image/png",
        },
        body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
      },
    );
    expect(upload.status, await upload.clone().text()).toBe(201);
    const media = (await upload.json()) as { id: string };
    expect(
      (await call("/s/C8/api/media/" + media.id, undefined, student)).status,
    ).toBe(200);
    expect(
      (await call("/s/C8/api/media/" + media.id, undefined, teacherCookie))
        .status,
    ).toBe(404);
    expect(
      (await call("/s/ABC/api/media/" + media.id, undefined, student)).status,
    ).toBe(401);
    expect(
      (
        await call(
          "/s/C8/api/students/reset-password",
          { studentId: pupil!.id },
          teacherCookie,
        )
      ).status,
    ).toBe(200);
    expect((await call("/s/C8/api/dashboard", undefined, student)).status).toBe(
      401,
    );
    expect(
      (
        await call(
          "/s/C8/api/account-status",
          { userId: pupil!.id, active: false },
          teacherCookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call("/s/C8/api/auth/login", {
          username: pupil!.username,
          password: pupil!.initialPassword,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await call(
          "/api/owner/school-status",
          { id: schoolId, status: "suspended" },
          owner,
        )
      ).status,
    ).toBe(200);
    expect(
      (await call("/s/C8/api/dashboard", undefined, teacherCookie)).status,
    ).toBe(403);
    expect(
      (
        await call("/s/C8/api/auth/login", {
          username: "admin",
          password: "admin-test-password",
        })
      ).status,
    ).toBe(403);
    const direct = await mf.getWorker("school-a");
    expect((await direct.fetch("https://direct.test/api/auth/me")).status).toBe(
      404,
    );
    expect((await call("/api/owner/logout", {}, owner)).status).toBe(200);
    expect((await call("/api/owner/me", undefined, owner)).status).toBe(401);
  } finally {
    await mf.dispose();
  }
}, 120000);
