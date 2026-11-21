// Shared steps for the suites: dates and the curriculum an admin authors.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export function isoDay(offset = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Fill the open dialog's labelled fields, then save. */
export async function fillDialog(page, fields, submit = "Save") {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const [label, value] of Object.entries(fields)) {
    await dialog.getByLabel(label, { exact: true }).fill(String(value));
  }
  await dialog.getByRole("button", { name: submit }).click();
  await expect(dialog).toBeHidden();
}

export async function openLink(page, name) {
  await page.getByRole("link", { name, exact: true }).first().click();
}

/**
 * The owner (an admin) authors a small curriculum through the pages:
 * one stream, a coefficient-5 maths subject with two chapters of cards and
 * exercises, and a language subject with a past paper.
 */
export async function authorCurriculum(page) {
  await page.goto("/curriculum");
  await page.getByRole("button", { name: "New stream" }).click();
  await fillDialog(page, { Name: "Experimental sciences" });
  await openLink(page, "Experimental sciences");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Experimental sciences",
  );

  await page.getByRole("button", { name: "New subject" }).click();
  await fillDialog(page, { Name: "Mathematics", Coefficient: 5 });
  await page.getByRole("button", { name: "New subject" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("English");
  await dialog.getByLabel("Coefficient", { exact: true }).fill("2");
  await dialog.getByRole("checkbox", { name: "Language subject" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("subject-row")).toHaveCount(2);

  await openLink(page, "Mathematics");
  await page.getByRole("button", { name: "New unit" }).click();
  await fillDialog(page, { Name: "Analysis" });
  await page.getByRole("button", { name: "New chapter in Analysis" }).click();
  await fillDialog(page, { Name: "Limits and continuity" });
  await page.getByRole("button", { name: "New chapter in Analysis" }).click();
  await fillDialog(page, { Name: "Derivatives" });

  await openLink(page, "Limits and continuity");
  const limitCards = [
    ["Limit of 1/x as x grows without bound", "0"],
    ["Limit of sin(x)/x as x approaches 0", "1"],
    ["When is f continuous at a?", "When the limit of f at a equals f(a)"],
  ];
  for (const [Front, Back] of limitCards) {
    await page.getByRole("button", { name: "New card" }).click();
    await fillDialog(page, { Front, Back });
  }
  await page.getByRole("button", { name: "New exercise" }).click();
  await fillDialog(page, {
    Title: "Limit of a rational function",
    Statement: "Find the limit of (3x² + 1)/(x² − 4) as x grows without bound.",
    Solution: "Divide numerator and denominator by x²: the limit is 3.",
  });
  await expect(page.getByTestId("card-row")).toHaveCount(3);
  await expect(page.getByTestId("exercise-row")).toHaveCount(1);

  await page.goBack();
  await openLink(page, "Derivatives");
  await page.getByRole("button", { name: "New card" }).click();
  await fillDialog(page, { Front: "Derivative of ln(x)", Back: "1/x" });
  await page.getByRole("button", { name: "New exercise" }).click();
  await fillDialog(page, {
    Title: "Tangent line",
    Statement: "Give the tangent to y = x³ at x = 1.",
    Solution: "y = 3x − 2",
  });
  await page.goBack();
  await expect(
    page
      .getByTestId("chapter-row")
      .filter({ hasText: "Limits and continuity" }),
  ).toContainText("3 cards");
  await expect(
    page
      .getByTestId("chapter-row")
      .filter({ hasText: "Limits and continuity" }),
  ).toContainText("1 exercise");

  await page.goBack();
  await openLink(page, "English");
  await page.getByRole("button", { name: "New paper" }).click();
  await fillDialog(page, {
    Title: "June 2024 paper",
    Statement:
      "Part one: read the text on renewable energy and answer the questions.",
  });
  await expect(page.getByTestId("paper-row")).toHaveCount(1);
}

/** A member saves their study profile on the exam stream. */
export async function saveProfile(
  page,
  { examDate = isoDay(60), hours = 10, days = 7, newCards = 10 } = {},
) {
  await page.goto("/profile");
  await page.getByTestId("stream-select").click();
  await page.getByRole("option", { name: "Experimental sciences" }).click();
  await page.getByLabel("Exam date", { exact: true }).fill(examDate);
  await page
    .getByLabel("Weekly study hours", { exact: true })
    .fill(String(hours));
  await page
    .getByLabel("Study days per week", { exact: true })
    .fill(String(days));
  await page
    .getByLabel("New cards per day", { exact: true })
    .fill(String(newCards));
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/"),
    page.getByRole("button", { name: "Save profile" }).click(),
  ]);
}
