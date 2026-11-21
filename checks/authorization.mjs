// Authorization: private paths, admin-only curriculum edits, per-member data.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { fillDialog, openLink, saveProfile, authorCurriculum } from "./lib.mjs";

const runtime = await startRuntime();

/** Run `action` on the page and return the server-function request it sent. */
async function captureServerCall(page, action) {
  const [request] = await Promise.all([
    page.waitForRequest(
      (r) => r.url().includes("/_serverFn/") && r.method() === "POST",
    ),
    action(),
  ]);
  return request;
}

/** Send a captured server-function call again as another role. */
async function replay(request, role) {
  const url = new URL(request.url());
  const headers = { ...request.headers() };
  delete headers.cookie;
  delete headers.host;
  return runtime.fetch(url.pathname + url.search, {
    role,
    method: "POST",
    headers,
    body: request.postData() ?? undefined,
  });
}

/** A refused server-function call: an error status, or the error TanStack Start serializes with 200. */
async function expectRefused(response) {
  if (response.status >= 400) return;
  const body = await response.text();
  expect(body).toContain("$TSR/Error");
  expect(body).toMatch(/Only|isn't|aren't|no longer/);
}

try {
  const paths = [
    "/",
    "/plan",
    "/profile",
    "/cards",
    "/exercises",
    "/review",
    "/groups",
    "/curriculum",
    "/health",
  ];
  await runtime.assertPrivateAccess(paths);
  for (const path of ["/", "/curriculum"]) {
    expect((await runtime.fetch(path)).status).toBeGreaterThanOrEqual(401);
  }

  // The app serves no sign-in of its own.
  for (const path of [
    "/login",
    "/signin",
    "/sign-in",
    "/signup",
    "/register",
    "/logout",
    "/auth/login",
  ]) {
    const response = await runtime.fetch(path, { role: "member" });
    expect(response.status, path).toBe(404);
  }
  const home = await (await runtime.fetch("/", { role: "member" })).text();
  expect(home).not.toMatch(/type="password"/);

  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();
  const db = await runtime.database();
  await authorCurriculum(owner);

  // Admin-only: a member sees no editing and a replayed admin call is refused.
  await owner.goto("/curriculum");
  await owner.getByRole("button", { name: "New stream" }).click();
  await owner
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Literature and philosophy");
  const createStream = await captureServerCall(owner, () =>
    owner.getByRole("dialog").getByRole("button", { name: "Save" }).click(),
  );
  await expect(
    owner.getByRole("link", { name: "Literature and philosophy" }),
  ).toBeVisible();
  const before = (await db.prepare("select count(*) as n from streams").first())
    .n;
  const refused = await replay(createStream, "member");
  await expectRefused(refused);
  expect(
    (await db.prepare("select count(*) as n from streams").first()).n,
  ).toBe(before);
  const outsider = await replay(createStream, "outsider");
  expect([401, 403]).toContain(outsider.status);

  const deleteCall = await (async () => {
    await owner.goto("/curriculum");
    await owner
      .getByRole("button", { name: "Delete Literature and philosophy" })
      .click();
    return captureServerCall(owner, () =>
      owner
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete" })
        .click(),
    );
  })();
  await expect(
    owner.getByRole("link", { name: "Literature and philosophy" }),
  ).toHaveCount(0);
  // The same call, aimed by a member at a stream that exists, is refused.
  const sciences = await db
    .prepare("select id from streams where name = 'Experimental sciences'")
    .first();
  const body = deleteCall.postData() ?? "";
  const deleteHeaders = { ...deleteCall.headers() };
  delete deleteHeaders.cookie;
  delete deleteHeaders.host;
  const deleteUrl = new URL(deleteCall.url());
  const stolenDelete = await runtime.fetch(
    deleteUrl.pathname + deleteUrl.search,
    {
      role: "member",
      method: "POST",
      headers: deleteHeaders,
      body: body.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
        sciences.id,
      ),
    },
  );
  await expectRefused(stolenDelete);
  expect(
    (
      await db
        .prepare("select count(*) as n from streams where id = ?")
        .bind(sciences.id)
        .first()
    ).n,
  ).toBe(1);

  await member.goto("/curriculum");
  await expect(
    member.getByRole("link", { name: "Experimental sciences" }),
  ).toBeVisible();
  await expect(member.getByRole("button", { name: "New stream" })).toHaveCount(
    0,
  );
  await expect(member.getByRole("button", { name: /^Delete / })).toHaveCount(0);

  // Profiles are per member.
  await saveProfile(owner, { hours: 6 });
  await member.goto("/");
  await expect(member.getByTestId("setup-prompt")).toBeVisible();

  // Attempts are per member.
  await owner.goto("/exercises");
  await openLink(owner, "Tangent line");
  await owner.getByTestId("status-stuck").click();
  await owner.getByLabel("Minutes", { exact: true }).fill("12");
  await owner.getByRole("button", { name: "Log attempt" }).click();
  await expect(owner.getByTestId("attempt")).toHaveCount(1);
  const exerciseUrl = owner.url();
  await saveProfile(member, { hours: 8 });
  await member.goto(exerciseUrl);
  await expect(member.getByTestId("statement")).toBeVisible();
  await expect(member.getByTestId("attempt")).toHaveCount(0);
  await member.goto("/review");
  await expect(member.getByTestId("review-row")).toHaveCount(0);

  // Groups: only members see one; only the group owner manages it.
  await owner.goto("/groups");
  await owner.getByRole("button", { name: "New group" }).click();
  await fillDialog(owner, { Name: "Owner's circle" });
  const groupUrl = owner.url();
  await owner.getByRole("button", { name: "Rename" }).click();
  await owner
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Owner's study circle");
  const rename = await captureServerCall(owner, () =>
    owner.getByRole("dialog").getByRole("button", { name: "Save" }).click(),
  );
  await expect(owner.getByRole("heading", { level: 1 })).toHaveText(
    "Owner's study circle",
  );

  await member.goto(groupUrl);
  await expect(member.getByTestId("group-missing")).toBeVisible();
  await expect(member.getByTestId("leader-row")).toHaveCount(0);
  await expect(member.getByTestId("join-code")).toHaveCount(0);
  const renamed = await replay(rename, "member");
  await expectRefused(renamed);
  const group = await db
    .prepare("select name, join_code from study_groups")
    .first();
  expect(group.name).toBe("Owner's study circle");

  // A joined member still cannot rename, remove or delete.
  await member.goto("/groups");
  await member.getByLabel("Join code", { exact: true }).fill(group.join_code);
  await member.getByRole("button", { name: "Join" }).click();
  await expect(member.getByTestId("leader-row")).toHaveCount(2);
  await expect(member.getByRole("button", { name: "Rename" })).toHaveCount(0);
  await expect(
    member.getByRole("button", { name: "Delete group" }),
  ).toHaveCount(0);
  await expect(member.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  const renamedAgain = await replay(rename, "member");
  await expectRefused(renamedAgain);
  expect((await db.prepare("select name from study_groups").first()).name).toBe(
    "Owner's study circle",
  );
  // A wrong code joins nothing.
  await member.goto("/groups");
  await member.getByLabel("Join code", { exact: true }).fill("NOPE0000");
  await member.getByRole("button", { name: "Join" }).click();
  await expect(member.getByRole("alert")).toBeVisible();
} finally {
  await runtime.close();
}
