// The revision plan's rules, free of the database so they can be tested.
import { addDays, weekday } from "./dates";

type TaskKind = "cards" | "exercises" | "paper" | "review";
export type TaskState = "pending" | "done" | "partial" | "missed";

export interface PlanSubject {
  id: string;
  coefficient: number;
  /** Chapters with cards the member chose to study. */
  cardChapters: string[];
  /** Chapters holding exercises. */
  exerciseChapters: string[];
  hasPapers: boolean;
}

interface PlanSettings {
  today: string;
  examDate: string;
  weeklyHours: number;
  daysPerWeek: number;
  useCards: boolean;
  useExercises: boolean;
  usePapers: boolean;
}

interface PlannedTask {
  date: string;
  subjectId: string;
  chapterId: string | null;
  kind: TaskKind;
  minutes: number;
}

/** Weekdays in the order they become study days: Monday first, Sunday last. */
const STUDY_ORDER = [1, 2, 3, 4, 5, 6, 0];
/** Every seventh study day goes to the weakest chapters. */
const REVIEW_EVERY = 7;
const SLOT_MINUTES = 30;

export function isStudyDay(day: string, daysPerWeek: number): boolean {
  return STUDY_ORDER.slice(0, daysPerWeek).includes(weekday(day));
}

/** Study days from `from` up to, not including, the exam. */
function studyDays(
  from: string,
  examDate: string,
  daysPerWeek: number,
): string[] {
  const days: string[] = [];
  for (let day = from; day < examDate; day = addDays(day, 1)) {
    if (isStudyDay(day, daysPerWeek)) days.push(day);
  }
  return days;
}

function slotsFor(weeklyHours: number, daysPerWeek: number): number[] {
  const daily = Math.round((weeklyHours * 60) / daysPerWeek);
  const count = Math.max(1, Math.round(daily / SLOT_MINUTES));
  const each = Math.max(10, Math.round(daily / count / 5) * 5);
  return Array.from({ length: count }, () => each);
}

/**
 * Tasks for every study day from today to the exam. Subjects take turns in
 * proportion to coefficient, raised for subjects with weak chapters; weak
 * chapters come first and twice as often; every seventh study day reviews
 * the weakest chapters.
 */
export function buildPlan(
  settings: PlanSettings,
  subjects: PlanSubject[],
  weak: { chapterId: string; subjectId: string; weight: number }[],
): PlannedTask[] {
  const weakOrder = [...weak].sort((a, b) => b.weight - a.weight);
  const weakIds = new Set(weakOrder.map((w) => w.chapterId));
  const kindsOf = (s: PlanSubject): TaskKind[] => {
    const kinds: TaskKind[] = [];
    if (settings.useExercises && s.exerciseChapters.length)
      kinds.push("exercises");
    if (settings.useCards && s.cardChapters.length) kinds.push("cards");
    if (settings.usePapers && s.hasPapers) kinds.push("paper");
    return kinds;
  };
  const active = subjects
    .map((s) => ({
      subject: s,
      kinds: kindsOf(s),
      weight:
        Math.max(1, s.coefficient) *
        (1 +
          0.25 *
            Math.min(4, weakOrder.filter((w) => w.subjectId === s.id).length)),
    }))
    .filter((s) => s.kinds.length > 0);
  if (active.length === 0) return [];

  const totalWeight = active.reduce((sum, s) => sum + s.weight, 0);
  const credit = new Map(active.map((s) => [s.subject.id, 0]));
  const kindTurn = new Map<string, number>();
  const chapterTurn = new Map<string, number>();
  const cycle = (chapters: string[]) => [
    ...weakOrder.map((w) => w.chapterId).filter((id) => chapters.includes(id)),
    ...chapters,
  ];
  const pickChapter = (s: PlanSubject, kind: TaskKind): string | null => {
    if (kind === "paper") return null;
    const list = cycle(kind === "cards" ? s.cardChapters : s.exerciseChapters);
    const key = `${s.id}:${kind}`;
    const turn = chapterTurn.get(key) ?? 0;
    chapterTurn.set(key, turn + 1);
    return list[turn % list.length]!;
  };

  const slots = slotsFor(settings.weeklyHours, settings.daysPerWeek);
  const tasks: PlannedTask[] = [];
  const days = studyDays(
    settings.today,
    settings.examDate,
    settings.daysPerWeek,
  );
  days.forEach((date, index) => {
    const reviewDay =
      index % REVIEW_EVERY === REVIEW_EVERY - 1 && weakIds.size > 0;
    slots.forEach((minutes, slot) => {
      if (reviewDay) {
        const w = weakOrder[slot % weakOrder.length]!;
        tasks.push({
          date,
          subjectId: w.subjectId,
          chapterId: w.chapterId,
          kind: "review",
          minutes,
        });
        return;
      }
      for (const s of active)
        credit.set(s.subject.id, credit.get(s.subject.id)! + s.weight);
      const chosen = active.reduce((best, s) =>
        credit.get(s.subject.id)! > credit.get(best.subject.id)! ? s : best,
      );
      credit.set(
        chosen.subject.id,
        credit.get(chosen.subject.id)! - totalWeight,
      );
      const turn = kindTurn.get(chosen.subject.id) ?? 0;
      kindTurn.set(chosen.subject.id, turn + 1);
      const kind = chosen.kinds[turn % chosen.kinds.length]!;
      tasks.push({
        date,
        subjectId: chosen.subject.id,
        chapterId: pickChapter(chosen.subject, kind),
        kind,
        minutes,
      });
    });
  });
  return tasks;
}

export interface ActivityEntry {
  day: string;
  source: "card" | "exercise" | "paper";
  subjectId: string;
  chapterId: string | null;
  seconds: number;
}

/** Seconds of that day's activity that count toward the task. */
export function creditFor(
  task: Pick<PlannedTask, "date" | "kind" | "subjectId" | "chapterId">,
  activity: ActivityEntry[],
): number {
  let seconds = 0;
  for (const a of activity) {
    if (a.day !== task.date) continue;
    const matches =
      task.kind === "paper"
        ? a.source === "paper" && a.subjectId === task.subjectId
        : a.chapterId === task.chapterId &&
          (task.kind === "review" ||
            (task.kind === "cards" && a.source === "card") ||
            (task.kind === "exercises" && a.source === "exercise"));
    if (matches) seconds += a.seconds;
  }
  return seconds;
}

/** Done or partial only from real activity; a past day without any is missed. */
export function taskState(
  task: Pick<
    PlannedTask,
    "date" | "kind" | "subjectId" | "chapterId" | "minutes"
  >,
  activity: ActivityEntry[],
  today: string,
): TaskState {
  const seconds = creditFor(task, activity);
  if (seconds >= task.minutes * 60) return "done";
  if (seconds > 0) return "partial";
  return task.date < today ? "missed" : "pending";
}

/** Consecutive days with a done task, ending today or, before today's first, yesterday. */
export function streak(doneDays: Set<string>, today: string): number {
  let day = doneDays.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (doneDays.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

/** Missed work goes onto the next study days, one carried task a day. */
export function carryForward<T extends { minutes: number }>(
  missed: T[],
  today: string,
  examDate: string,
  daysPerWeek: number,
): { task: T; date: string }[] {
  const days = studyDays(today, examDate, daysPerWeek);
  return missed
    .slice(0, days.length)
    .map((task, i) => ({ task, date: days[i]! }));
}
