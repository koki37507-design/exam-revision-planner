// Persistence: what members write survives a restart of the Workers.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { authorCurriculum, fillDialog, openLink, saveProfile } from "./lib.mjs";

const runtime = await startRuntime();
try {
  let owner = await (await runtime.context("owner")).newPage();
  await authorCurriculum(owner);
  let member = await (await runtime.context("member")).newPage();
  await saveProfile(member, { hours: 9 });
  await member.goto("/cards");
  await member.getByRole("checkbox", { name: "Derivatives" }).click();
  await member.getByRole("button", { name: "Save chapters" }).click();
  await member.getByRole("link", { name: "Start session" }).click();
  await member.getByRole("button", { name: "Show answer" }).click();
  await member.getByRole("button", { name: "Good", exact: true }).click();
  await expect(member.getByTestId("session-done")).toContainText("1 card");
  await member.goto("/exercises");
  await openLink(member, "Limit of a rational function");
  await member.getByTestId("status-partial").click();
  await member.getByLabel("Minutes", { exact: true }).fill("20");
  await member.getByRole("button", { name: "Log attempt" }).click();
  await expect(member.getByTestId("attempt")).toHaveCount(1);
  const exerciseUrl = member.url();
  await member.goto("/groups");
  await member.getByRole("button", { name: "New group" }).click();
  await fillDialog(member, { Name: "Weekend crammers" });
  const groupUrl = member.url();
  await member.goto("/");
  const tasks = await member.getByTestId("task").count();
  expect(tasks).toBeGreaterThan(0);

  await runtime.restart();

  member = await (await runtime.context("member")).newPage();
  await member.goto("/profile");
  await expect(
    member.getByLabel("Weekly study hours", { exact: true }),
  ).toHaveValue("9");
  await member.goto("/cards");
  await expect(
    member.getByRole("checkbox", { name: "Derivatives" }),
  ).toBeChecked();
  await expect(member.getByTestId("due-summary")).toContainText("0 due");
  await member.goto(exerciseUrl);
  await expect(member.getByTestId("latest-status")).toHaveText("Partial");
  await member.goto(groupUrl);
  await expect(member.getByRole("heading", { level: 1 })).toHaveText(
    "Weekend crammers",
  );
  await member.goto("/");
  await expect(member.getByTestId("task")).toHaveCount(tasks);
  owner = await (await runtime.context("owner")).newPage();
  await owner.goto("/curriculum");
  await openLink(owner, "Experimental sciences");
  await expect(owner.getByTestId("subject-row")).toHaveCount(2);
} finally {
  await runtime.close();
}
