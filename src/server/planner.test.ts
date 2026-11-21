import { describe, expect, it } from "vitest";
import {
  buildPlan,
  carryForward,
  isStudyDay,
  streak,
  taskState,
} from "./planner";

const settings = {
  today: "2026-03-02", // a Monday
  examDate: "2026-03-30",
  weeklyHours: 10,
  daysPerWeek: 5,
  useCards: true,
  useExercises: true,
  usePapers: true,
};
const subjects = [
  {
    id: "math",
    coefficient: 5,
    cardChapters: ["limits"],
    exerciseChapters: ["limits", "derivs"],
    hasPapers: false,
  },
  {
    id: "eng",
    coefficient: 2,
    cardChapters: [],
    exerciseChapters: [],
    hasPapers: true,
  },
];

describe("buildPlan", () => {
  const plan = buildPlan(settings, subjects, []);

  it("rests on days beyond the days-per-week setting", () => {
    expect(isStudyDay("2026-03-07", 5)).toBe(false);
    expect(
      plan.some((t) => t.date === "2026-03-07" || t.date === "2026-03-08"),
    ).toBe(false);
    expect(
      plan.every((t) => t.date >= settings.today && t.date < settings.examDate),
    ).toBe(true);
  });

  it("splits weekly hours across study days", () => {
    const monday = plan.filter((t) => t.date === "2026-03-02");
    expect(monday.reduce((sum, t) => sum + t.minutes, 0)).toBe(120);
  });

  it("weights subjects by coefficient", () => {
    const math = plan.filter((t) => t.subjectId === "math").length;
    const eng = plan.filter((t) => t.subjectId === "eng").length;
    expect(math / eng).toBeGreaterThan(2);
    expect(
      plan
        .filter((t) => t.subjectId === "eng")
        .every((t) => t.kind === "paper"),
    ).toBe(true);
  });

  it("boosts weak chapters and holds review days", () => {
    const weakPlan = buildPlan(settings, subjects, [
      { chapterId: "derivs", subjectId: "math", weight: 3 },
    ]);
    const ex = weakPlan.filter((t) => t.kind === "exercises");
    expect(ex[0]!.chapterId).toBe("derivs");
    expect(ex.filter((t) => t.chapterId === "derivs").length).toBeGreaterThan(
      ex.filter((t) => t.chapterId === "limits").length,
    );
    expect(weakPlan.some((t) => t.kind === "review")).toBe(true);
  });

  it("leaves out tools the member turned off", () => {
    const noPapers = buildPlan({ ...settings, usePapers: false }, subjects, []);
    expect(noPapers.some((t) => t.kind === "paper")).toBe(false);
  });
});

describe("task state", () => {
  const task = {
    date: "2026-03-02",
    kind: "exercises" as const,
    subjectId: "math",
    chapterId: "limits",
    minutes: 30,
  };
  it("counts only activity on the task's chapter that day", () => {
    expect(taskState(task, [], "2026-03-02")).toBe("pending");
    expect(taskState(task, [], "2026-03-03")).toBe("missed");
    const other = {
      day: "2026-03-02",
      source: "exercise" as const,
      subjectId: "math",
      chapterId: "derivs",
      seconds: 3600,
    };
    expect(taskState(task, [other], "2026-03-02")).toBe("pending");
    const some = { ...other, chapterId: "limits", seconds: 600 };
    expect(taskState(task, [some], "2026-03-02")).toBe("partial");
    expect(
      taskState(task, [some, { ...some, seconds: 1200 }], "2026-03-02"),
    ).toBe("done");
  });

  it("counts a streak of consecutive done days", () => {
    expect(streak(new Set(["2026-03-01", "2026-03-02"]), "2026-03-03")).toBe(2);
    expect(streak(new Set(["2026-03-01", "2026-03-03"]), "2026-03-03")).toBe(1);
  });

  it("carries missed tasks onto the next study days", () => {
    const moved = carryForward(
      [{ minutes: 30 }, { minutes: 20 }],
      "2026-03-06",
      "2026-03-30",
      5,
    );
    expect(moved.map((m) => m.date)).toEqual(["2026-03-06", "2026-03-09"]);
  });
});
