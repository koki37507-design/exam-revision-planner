// Behavior: every frozen feature's main path, through the packaged release.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import {
  authorCurriculum,
  fillDialog,
  isoDay,
  openLink,
  saveProfile,
} from "./lib.mjs";

const runtime = await startRuntime();
try {
  // Server route: the health check answers members.
  const health = await runtime.fetch("/health", { role: "member" });
  expect(health.status).toBe(200);
  expect((await health.json()).ok).toBe(true);

  // F001: an admin authors the curriculum; edits and cascading deletes.
  const owner = await (await runtime.context("owner")).newPage();
  await authorCurriculum(owner);
  await owner.goto("/curriculum");
  await openLink(owner, "Experimental sciences");
  await openLink(owner, "Mathematics");
  await owner.getByRole("button", { name: "New unit" }).click();
  await fillDialog(owner, { Name: "Spare unit" });
  await owner
    .getByRole("button", { name: "New chapter in Spare unit" })
    .click();
  await fillDialog(owner, { Name: "Spare chapter" });
  await openLink(owner, "Spare chapter");
  await owner.getByRole("button", { name: "New card" }).click();
  await fillDialog(owner, { Front: "Spare front", Back: "Spare back" });
  await owner.getByRole("button", { name: "Edit Spare front" }).click();
  await fillDialog(owner, { Front: "Edited front" });
  await expect(owner.getByTestId("card-row")).toContainText("Edited front");
  await owner.goBack();
  await owner.getByRole("button", { name: "Delete Spare unit" }).click();
  await owner
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(owner.getByText("Spare chapter")).toHaveCount(0);
  const db = await runtime.database();
  const spare = await db
    .prepare("select count(*) as n from cards where front = 'Edited front'")
    .first();
  expect(spare.n).toBe(0);

  // Members browse read-only with counts.
  const member = await (await runtime.context("member")).newPage();
  await member.goto("/curriculum");
  await expect(member.getByRole("button", { name: "New stream" })).toHaveCount(
    0,
  );
  await openLink(member, "Experimental sciences");
  await openLink(member, "Mathematics");
  await expect(
    member.getByTestId("chapter-row").filter({ hasText: "Derivatives" }),
  ).toContainText("1 card");
  await expect(member.getByRole("button", { name: "New unit" })).toHaveCount(0);
  await openLink(member, "Limits and continuity");
  await expect(member.getByTestId("card-row")).toHaveCount(3);
  await expect(member.getByRole("button", { name: "New card" })).toHaveCount(0);

  // F002: until a profile exists the home page asks for one; then the countdown.
  await member.goto("/");
  await expect(member.getByTestId("setup-prompt")).toBeVisible();
  await saveProfile(member);
  await expect(member.getByTestId("countdown")).toContainText("60 days");
  await member.goto("/profile");
  await expect(
    member.getByLabel("Weekly study hours", { exact: true }),
  ).toHaveValue("10");
  await expect(
    member.getByRole("checkbox", { name: "Flashcards" }),
  ).toBeChecked();

  // F003: choose chapters, study a finite session, rate each card.
  await member.goto("/cards");
  await member.getByRole("checkbox", { name: "Limits and continuity" }).click();
  await member.getByRole("button", { name: "Save chapters" }).click();
  await expect(member.getByTestId("due-summary")).toContainText("3 new");
  await member.getByRole("link", { name: "Start session" }).click();
  for (const rating of ["Again", "Good", "Easy"]) {
    await expect(member.getByTestId("card-front")).toBeVisible();
    await expect(member.getByTestId("card-back")).toHaveCount(0);
    await member.getByRole("button", { name: "Show answer" }).click();
    await expect(member.getByTestId("card-back")).toBeVisible();
    await member.getByRole("button", { name: rating, exact: true }).click();
  }
  await expect(member.getByTestId("session-done")).toContainText("3 cards");
  const states = await db
    .prepare("select lapses, due from card_states order by lapses desc")
    .all();
  expect(states.results.length).toBe(3);
  expect(states.results[0].lapses).toBe(1);
  expect(states.results.every((s) => s.due > isoDay(0))).toBe(true);
  await member.goto("/cards");
  await expect(member.getByTestId("due-summary")).toContainText("0 due");
  await expect(member.getByRole("link", { name: "Start session" })).toHaveCount(
    0,
  );

  // F004: read an exercise, reveal the solution, log attempts, see history.
  await member.goto("/exercises");
  await openLink(member, "Tangent line");
  await expect(member.getByTestId("statement")).toContainText(
    "tangent to y = x³",
  );
  await expect(member.getByTestId("solution")).toHaveCount(0);
  await member.getByRole("button", { name: "Show solution" }).click();
  await expect(member.getByTestId("solution")).toContainText("y = 3x − 2");
  await member.getByTestId("status-stuck").click();
  await member.getByLabel("Minutes", { exact: true }).fill("10");
  await member.getByRole("button", { name: "Log attempt" }).click();
  await expect(member.getByTestId("attempt")).toHaveCount(1);
  await expect(member.getByTestId("latest-status")).toHaveText("Stuck");
  await member.getByTestId("status-partial").click();
  await member.getByLabel("Minutes", { exact: true }).fill("5");
  await member.getByRole("button", { name: "Log attempt" }).click();
  await expect(member.getByTestId("attempt")).toHaveCount(2);
  await expect(member.getByTestId("latest-status")).toHaveText("Partial");
  // Past papers by language subject.
  await member.goto("/exercises");
  await openLink(member, "June 2024 paper");
  await member.getByTestId("status-solved").click();
  await member.getByLabel("Minutes", { exact: true }).fill("50");
  await member.getByRole("button", { name: "Log attempt" }).click();
  await expect(member.getByTestId("latest-status")).toHaveText("Solved");
  await member.goto("/exercises");
  await expect(
    member.getByTestId("exercise-link").filter({ hasText: "Tangent line" }),
  ).toContainText("Partial");
  // The review list: stuck/partial chapters and lapsed cards, most often first.
  await member.goto("/review");
  const rows = member.getByTestId("review-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Derivatives");
  await expect(rows.nth(1)).toContainText("Limits and continuity");

  // F005: today's tasks become done only from real activity on their chapter.
  await member.goto("/plan");
  await member.getByRole("button", { name: "Regenerate plan" }).click();
  await member.goto("/");
  const tasks = member.getByTestId("task");
  await expect(tasks.first()).toBeVisible();
  const total = await tasks.count();
  const target = member
    .locator("[data-testid=task][data-kind=exercises]:not([data-state=done])")
    .first();
  await expect(target).toBeVisible();
  const chapterName = await target.getAttribute("data-chapter");
  await expect(member.getByTestId("progress")).toContainText(`/ ${total}`);
  await target.getByRole("link").click();
  await expect(member.getByTestId("exercise-link").first()).toBeVisible();
  await member.getByTestId("exercise-link").first().getByRole("link").click();
  await member.getByTestId("status-solved").click();
  await member.getByLabel("Minutes", { exact: true }).fill("45");
  await member.getByRole("button", { name: "Log attempt" }).click();
  await expect(member.getByTestId("attempt").first()).toContainText("Solved");
  await member.goto("/");
  await expect(
    member
      .locator(
        `[data-testid=task][data-kind=exercises][data-chapter="${chapterName}"]`,
      )
      .first(),
  ).toHaveAttribute("data-state", "done");
  await expect(member.getByTestId("progress")).not.toContainText(
    `0 / ${total}`,
  );
  await expect(member.getByTestId("streak")).toContainText("1 day");
  await expect(member.getByTestId("countdown")).toContainText("60 days");

  // Missed work is shown and carried into future days by the daily run.
  const profile = await db
    .prepare("select user_id, stream_id from profiles")
    .first();
  const derivatives = await db
    .prepare(
      "select c.id as chapter_id, u.subject_id from chapters c join units u on u.id = c.unit_id where c.name = 'Derivatives'",
    )
    .first();
  await db
    .prepare(
      "insert into plan_tasks (id, user_id, date, subject_id, chapter_id, kind, minutes) values (?, ?, ?, ?, ?, 'exercises', 30)",
    )
    .bind(
      crypto.randomUUID(),
      profile.user_id,
      isoDay(-1),
      derivatives.subject_id,
      derivatives.chapter_id,
    )
    .run();
  await runtime.scheduled("0 3 * * *");
  const carried = await db
    .prepare(
      "select date from plan_tasks where user_id = ? and carried_from = ?",
    )
    .bind(profile.user_id, isoDay(-1))
    .all();
  expect(carried.results.length).toBe(1);
  expect(carried.results[0].date >= isoDay(0)).toBe(true);
  await member.goto(`/plan?date=${isoDay(-1)}`);
  await expect(
    member
      .locator(
        `[data-testid=plan-day][data-date="${isoDay(-1)}"] [data-testid=task]`,
      )
      .first(),
  ).toHaveAttribute("data-state", "missed");
  await expect(member.getByTestId("overall-progress")).toBeVisible();
  await member.goto(`/plan?date=${carried.results[0].date}`);
  await expect(
    member.locator(
      `[data-testid=plan-day][data-date="${carried.results[0].date}"] [data-testid=task][data-carried=true]`,
    ),
  ).toHaveCount(1);
  // Rest days follow the days-per-week setting.
  await saveProfile(member, { days: 3 });
  const week = await db
    .prepare(
      "select count(distinct date) as n from plan_tasks where user_id = ? and date >= ? and date < ?",
    )
    .bind(profile.user_id, isoDay(0), isoDay(7))
    .first();
  expect(week.n).toBeLessThanOrEqual(4);
  await saveProfile(member, { days: 7 });

  // F006: groups, join codes and the weekly leaderboard.
  await member.goto("/groups");
  await member.getByRole("button", { name: "New group" }).click();
  await fillDialog(member, { Name: "Evening study circle" });
  await expect(member.getByRole("heading", { level: 1 })).toHaveText(
    "Evening study circle",
  );
  const code = (await member.getByTestId("join-code").textContent()).trim();
  expect(code.length).toBeGreaterThan(4);
  const groupUrl = member.url();
  await owner.goto("/groups");
  await owner.getByLabel("Join code", { exact: true }).fill(code);
  await owner.getByRole("button", { name: "Join" }).click();
  await expect(owner.getByRole("heading", { level: 1 })).toHaveText(
    "Evening study circle",
  );
  await expect(owner.getByTestId("leader-row")).toHaveCount(2);
  await expect(owner.getByTestId("leader-row").nth(1)).toHaveAttribute(
    "data-current",
    "true",
  );
  await owner.getByRole("button", { name: "Leave group" }).click();
  await owner
    .getByRole("alertdialog")
    .getByRole("button", { name: "Leave" })
    .click();
  await owner.waitForURL((url) => url.pathname === "/groups");
  await owner.getByLabel("Join code", { exact: true }).fill(code);
  await owner.getByRole("button", { name: "Join" }).click();
  await expect(owner.getByTestId("leader-row")).toHaveCount(2);

  await member.goto(groupUrl);
  const leaders = member.getByTestId("leader-row");
  await expect(leaders).toHaveCount(2);
  await expect(leaders.nth(0)).toHaveAttribute("data-current", "true");
  const points = Number(
    (await leaders.nth(0).getByTestId("points").textContent()).trim(),
  );
  expect(points).toBeGreaterThan(10);
  await member.getByRole("button", { name: "Rename" }).click();
  await fillDialog(member, { Name: "Evening revision circle" });
  await expect(member.getByRole("heading", { level: 1 })).toHaveText(
    "Evening revision circle",
  );
  await member.getByRole("button", { name: /^Remove / }).click();
  await member
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(leaders).toHaveCount(1);
  await owner.goto(groupUrl);
  await expect(owner.getByTestId("group-missing")).toBeVisible();

  await member.goto("/groups");
  await member.getByRole("button", { name: "New group" }).click();
  await fillDialog(member, { Name: "Scratch group" });
  await member.getByRole("button", { name: "Delete group" }).click();
  await member
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await member.waitForURL((url) => url.pathname === "/groups");
  await expect(member.getByText("Scratch group")).toHaveCount(0);
  await expect(member.getByText("Evening revision circle")).toBeVisible();

  // Phone-sized smoke.
  const phone = await (
    await runtime.context("member", {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage();
  await phone.goto("/");
  await expect(phone.getByTestId("countdown")).toBeVisible();
  await expect(phone.getByTestId("task").first()).toBeVisible();

  // The journey ends on today's plan with real progress on screen.
  await member.goto("/");
  await expect(member.getByTestId("task").first()).toBeVisible();
  await runtime.assertBackLink(member);
  await runtime.screenshot(member);
} finally {
  await runtime.close();
}
