import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "https://examify-staging.mr-ujjawalmishra.workers.dev";
const studentRoll=process.env.EXAMIFY_TEST_ROLL??'1';
if(!/^(?:[1-9]|[12][0-9]|30)$/.test(studentRoll))throw Error('Invalid synthetic test roll');
const studentUsername=`test.student.9b${studentRoll}`,studentPassword=`test.9b${studentRoll}`;
const credentialFile = new URL(
  "../../../.local/staging-credentials.json",
  import.meta.url,
);
const c = JSON.parse(await readFile(credentialFile, "utf8"));
const browser = await chromium.launch({
  channel: process.env.EXAMIFY_BROWSER_CHANNEL ?? "chrome",
  headless: true,
});
const deadline = setTimeout(() => { console.error("Staging browser test exceeded 180 seconds"); process.exit(1); }, 180000);
const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
  }),
  page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const evidence = [];
const record = (s) => {
  evidence.push(s);
  console.log("PASS " + s);
};
const response = async (path, action) => {
  const waiter = page.waitForResponse(
    (r) => r.url() === origin + path && r.request().method() === "POST",
    { timeout: 90000 },
  );
  await action();
  const r = await waiter;
  assert.ok(r.ok(), `${path}: ${r.status()} ${await r.text()}`);
  let timer;
  try {
    return await Promise.race([r.json(),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error(`Response body timed out: ${path}`)),15000);
    })]);
  } finally {clearTimeout(timer);}
};
const login = async (username, password) => {
  await page.getByLabel("Account ID", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await response("/s/C8/api/auth/login", () =>
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  );
  await page.getByRole("button", { name: "Sign out" }).waitFor();
};
try {
  await page.goto(origin + "/owner");
  await page.getByLabel("Email", { exact: true }).fill(c.ownerEmail);
  await page.getByLabel("Password", { exact: true }).fill(c.ownerPassword);
  await response("/api/owner/login", () =>
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  );
  await page.getByRole("heading", { name: "Your schools" }).waitFor();
  record("Owner browser login");
  const existingSchools = await (
    await context.request.get(origin + "/api/owner/schools")
  ).json();
  for (const code of ["C8", "ABC"]) {
    if (!existingSchools.some((s) => s.code === code)) {
      await page
        .getByLabel("School name", { exact: true })
        .fill("Test School " + code);
      await page.getByLabel("School code", { exact: true }).fill(code);
      await page.getByLabel("Administrator ID", { exact: true }).fill("admin");
      await page
        .getByLabel("Initial administrator password", { exact: true })
        .fill(c.adminPassword);
      await response("/api/owner/schools", () =>
        page
          .getByRole("button", { name: "Create and activate school" })
          .click(),
      );
      await page.getByText(`Test School ${code}`, { exact: true }).waitFor();
    }
  }
  record("Two school environments verified and listed");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto(origin + "/");
  await page.getByLabel("Find your school").fill("C8");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("option", { name: "Test School C8 · C8" })
    .waitFor({ state: "attached" });
  await page.locator("select").first().selectOption("C8");
  await login("admin", c.adminPassword);
  await page.getByRole("heading", { name: "Teachers", exact: true }).waitFor();
  record("School selection and administrator browser login");
  if (!c.teacher) {
    await page.getByLabel("Full name").fill("Ujjwal Mishra");
    c.teacher = await response("/s/C8/api/users", () =>
      page.getByRole("button", { name: "Create teacher", exact: true }).click(),
    );
    await writeFile(credentialFile, JSON.stringify(c, null, 2));
  }
  await page.locator("select[name=teacherId]").selectOption(c.teacher.id);
  await page.getByLabel("Class", { exact: true }).fill("9");
  await page.getByLabel("Section", { exact: true }).fill("B");
  await page.getByLabel("Subject", { exact: true }).fill("Mathematics");
  await response("/s/C8/api/assignments", () =>
    page.getByRole("button", { name: "Assign teacher" }).click(),
  );
  record("Teacher account verified and Class 9B subject assignment saved");
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(c.teacher.username, c.teacher.initialPassword);
  await page.getByRole("heading", { name: "Your students" }).waitFor();
  {
    const csv =
      "Student Name,Class,Section,Roll Number\n" +
      Array.from({ length: 30 }, (_, i) => `Test Student,IX,B,${i + 1}`).join(
        "\n",
      );
    await page
      .getByLabel("Roster file")
      .setInputFiles({
        name: "class-9b.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv),
      });
    await page.getByText("30 validated rows ready for review").waitFor();
    await page.getByRole("button", { name: "Import reviewed rows" }).click();
    await page
      .getByText("30 rows processed. Replayed rows do not reissue passwords.")
      .waitFor({ timeout: 180000 });
  }
  assert.equal(
    await page.getByRole("cell", { name: /^test\.student\.9b\d+$/ }).count(),
    30,
  );
  record(
    "CSV preview and 30-student browser import with classroom credentials",
  );
  if (await page.getByRole("button", { name: "Clear credentials" }).count())
    await page.getByRole("button", { name: "Clear credentials" }).click();
  await mkdir(new URL("../../../test-results/", import.meta.url), {
    recursive: true,
  });
  await page.screenshot({
    path: new URL(
      "../../../test-results/teacher-dashboard.png",
      import.meta.url,
    ).pathname.replace(/^\/(\w:)/, "$1"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(studentUsername, studentPassword);
  await page.getByRole("heading", { name: "My profile" }).waitFor();
  record("Student browser login and database profile");
  record("Starting private-image upload");
  const upload = await response("/s/C8/api/media", () =>
    page
      .getByLabel("Private image")
      .setInputFiles({
        name: "test.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
  );
  await page
    .getByRole("link", { name: /Download PNG/ })
    .first()
    .waitFor();
  record("Private R2 image upload displayed in browser");
  const studentCookies = (await context.cookies())
    .filter((x) => x.name === "__Host-examify")
    .map((x) => `${x.name}=${x.value}`)
    .join(";");
  const api = async (path, data, cookie = studentCookies) => {
    const r = await fetch(origin + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return r;
  };
  assert.equal((await api("/s/ABC/api/dashboard")).status, 401);
  assert.equal((await api("/s/ABC/api/media/" + upload.id)).status, 401);
  assert.equal((await api("/api/owner/schools", {})).status, 401);
  record("Live cross-school and owner authorization denial");
  const me = await (await api("/s/C8/api/auth/me")).json();
  await page.getByLabel("Current password", { exact: true }).fill(studentPassword);
  await page
    .getByLabel("New password", { exact: true })
    .fill("Voluntary-test-change-2026");
  await response("/s/C8/api/auth/password", () =>
    page.getByRole("button", { name: "Change password", exact: true }).click(),
  );
  assert.equal((await api("/s/C8/api/dashboard")).status, 401);
  await login(studentUsername, "Voluntary-test-change-2026");
  record("Voluntary browser password change invalidates prior session");
  const changedCookie = (await context.cookies())
    .filter((x) => x.name === "__Host-examify")
    .map((x) => `${x.name}=${x.value}`)
    .join(";");
  assert.equal((await api("/s/C8/api/dashboard",undefined,changedCookie)).status,200);
  // Keep the student's server session alive; reset, not logout, must revoke it.
  await context.clearCookies();
  await page.reload();
  await login(c.teacher.username, c.teacher.initialPassword);
  const row = page
    .getByRole("row")
    .filter({
      has: page.getByRole("cell", { name: studentUsername, exact: true }),
    });
  await response("/s/C8/api/students/reset-password", () =>
    row.getByRole("button", { name: "Reset password" }).click(),
  );
  assert.equal(
    (await api("/s/C8/api/dashboard", undefined, changedCookie)).status,
    401,
  );
  record("Teacher browser reset and session invalidation");
  assert.ok(me.userId);
  assert.deepEqual(errors, []);
  record("No browser JavaScript errors");
  await writeFile(
    new URL("../../../test-results/staging-browser.json", import.meta.url),
    JSON.stringify(
      { origin, checkedAt: new Date().toISOString(), checks: evidence },
      null,
      2,
    ),
  );
} catch(error) {
  console.error("Staging browser failure: " + (error instanceof Error ? error.message.split("\n")[0] : "unknown"));
  throw error;
} finally {
  clearTimeout(deadline);
  const closeDeadline=setTimeout(()=>process.exit(1),10000);
  await browser.close();
  clearTimeout(closeDeadline);
}


