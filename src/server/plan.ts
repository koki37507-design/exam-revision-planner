// The revision plan in the database: generating, carrying missed work and the day and week views.
import { and, asc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activity,
  cards,
  chapterSelections,
  chapters,
  exercises,
  planTasks,
  profiles,
  subjects,
  units,
} from "@/db/schema";
import { addDays, weekStart } from "./dates";
import { weakChapters } from "./exercises";
import {
  buildPlan,
  carryForward,
  creditFor,
  streak,
  taskState,
  type ActivityEntry,
  type PlanSubject,
  type TaskState,
} from "./planner";
import { findProfile, type Profile } from "./profile";

/** Missed days further back than this are not carried forward. */
const CARRY_WINDOW_DAYS = 14;
const STREAK_WINDOW_DAYS = 120;

type TaskRow = typeof planTasks.$inferSelect;

async function planSubjects(
  userId: string,
  streamId: string,
): Promise<PlanSubject[]> {
  const subjectRows = await db
    .select()
    .from(subjects)
    .where(eq(subjects.streamId, streamId))
    .orderBy(asc(subjects.createdAt));
  if (subjectRows.length === 0) return [];
  const ids = subjectRows.map((s) => s.id);
  const exerciseChapters = await db
    .selectDistinct({
      chapterId: exercises.chapterId,
      subjectId: exercises.subjectId,
    })
    .from(exercises)
    .innerJoin(chapters, eq(chapters.id, exercises.chapterId))
    .where(
      and(inArray(exercises.subjectId, ids), eq(exercises.kind, "exercise")),
    )
    .orderBy(asc(chapters.createdAt));
  const cardChapters = await db
    .selectDistinct({ chapterId: chapters.id, subjectId: units.subjectId })
    .from(chapterSelections)
    .innerJoin(chapters, eq(chapters.id, chapterSelections.chapterId))
    .innerJoin(units, eq(units.id, chapters.unitId))
    .where(
      and(
        eq(chapterSelections.userId, userId),
        inArray(units.subjectId, ids),
        sql`exists (select 1 from ${cards} where ${cards.chapterId} = ${chapters.id})`,
      ),
    )
    .orderBy(asc(chapters.createdAt));
  const papers = await db
    .selectDistinct({ subjectId: exercises.subjectId })
    .from(exercises)
    .where(and(inArray(exercises.subjectId, ids), eq(exercises.kind, "paper")));
  const withPapers = new Set(papers.map((p) => p.subjectId));
  return subjectRows.map((s) => ({
    id: s.id,
    coefficient: s.coefficient,
    exerciseChapters: exerciseChapters
      .filter((c) => c.subjectId === s.id)
      .map((c) => c.chapterId!),
    cardChapters: cardChapters
      .filter((c) => c.subjectId === s.id)
      .map((c) => c.chapterId),
    hasPapers: s.isLanguage && withPapers.has(s.id),
  }));
}

/** Insert many rows in a few statements, under D1's bound-parameter limit. */
function insertTasks(rows: (typeof planTasks.$inferInsert)[]) {
  const statements = [];
  for (let i = 0; i < rows.length; i += 10)
    statements.push(db.insert(planTasks).values(rows.slice(i, i + 10)));
  return statements;
}

async function activitySince(
  userIds: string[],
  from: string,
  to: string,
): Promise<(ActivityEntry & { userId: string })[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: activity.userId,
      day: activity.day,
      source: activity.source,
      subjectId: activity.subjectId,
      chapterId: activity.chapterId,
      seconds: activity.seconds,
    })
    .from(activity)
    .where(
      and(
        inArray(activity.userId, userIds),
        gte(activity.day, from),
        lte(activity.day, to),
      ),
    );
}

/** Rebuild the plan from today to the exam, then carry recent missed work into it. */
export async function regeneratePlan(userId: string, today: string) {
  const profile = await findProfile(userId);
  if (!profile) return;
  const [subjectsForPlan, weak] = await Promise.all([
    planSubjects(userId, profile.streamId),
    weakChapters(userId),
  ]);
  const tasks = buildPlan(
    {
      today,
      examDate: profile.examDate,
      weeklyHours: profile.weeklyHours,
      daysPerWeek: profile.daysPerWeek,
      useCards: profile.useCards,
      useExercises: profile.useExercises,
      usePapers: profile.usePapers,
    },
    subjectsForPlan,
    weak.map((w) => ({
      chapterId: w.chapterId,
      subjectId: w.subjectId,
      weight: w.total,
    })),
  );
  await db.batch([
    db
      .delete(planTasks)
      .where(and(eq(planTasks.userId, userId), gte(planTasks.date, today))),
    db
      .update(planTasks)
      .set({ rolled: false })
      .where(
        and(
          eq(planTasks.userId, userId),
          lt(planTasks.date, today),
          gte(planTasks.date, addDays(today, -CARRY_WINDOW_DAYS)),
        ),
      ),
    ...insertTasks(
      tasks.map((t) => ({ id: crypto.randomUUID(), userId, ...t })),
    ),
  ]);
  await rollMissed(profile, today);
}

/** Carry unfinished past tasks onto the next study days. */
async function rollMissed(profile: Profile, today: string) {
  const from = addDays(today, -CARRY_WINDOW_DAYS);
  const past = await db
    .select()
    .from(planTasks)
    .where(
      and(
        eq(planTasks.userId, profile.userId),
        eq(planTasks.rolled, false),
        gte(planTasks.date, from),
        lt(planTasks.date, today),
      ),
    )
    .orderBy(asc(planTasks.date), asc(planTasks.createdAt));
  const done = await activitySince([profile.userId], from, today);
  const unfinished = past
    .map((t) => ({
      task: t,
      left: t.minutes - Math.floor(creditFor(t, done) / 60),
    }))
    .filter((t) => t.left > 0)
    .map((t) => ({ ...t, minutes: Math.max(5, Math.ceil(t.left / 5) * 5) }));
  const moved = carryForward(
    unfinished,
    today,
    profile.examDate,
    profile.daysPerWeek,
  );
  await db.batch([
    db
      .update(profiles)
      .set({ rolledOn: today })
      .where(eq(profiles.userId, profile.userId)),
    ...(past.length
      ? [
          db
            .update(planTasks)
            .set({ rolled: true })
            .where(
              inArray(
                planTasks.id,
                past.map((t) => t.id),
              ),
            ),
        ]
      : []),
    ...insertTasks(
      moved.map(({ task: { task, minutes }, date }) => ({
        id: crypto.randomUUID(),
        userId: profile.userId,
        date,
        subjectId: task.subjectId,
        chapterId: task.chapterId,
        kind: task.kind,
        minutes,
        carriedFrom: task.carriedFrom ?? task.date,
        rolled: false,
      })),
    ),
  ]);
}

/** Runs the day's carry once per member: on their first visit, or from the daily cron. */
async function rollIfDue(userId: string, today: string) {
  const profile = await findProfile(userId);
  if (profile && profile.rolledOn !== today) await rollMissed(profile, today);
}

export async function rollEveryone(today: string) {
  const all = await db.select().from(profiles);
  for (const profile of all) await rollMissed(profile, today);
}

async function describeTasks(
  rows: TaskRow[],
  entries: ActivityEntry[],
  today: string,
) {
  const subjectIds = [...new Set(rows.map((r) => r.subjectId))];
  const chapterIds = [
    ...new Set(rows.map((r) => r.chapterId).filter((c): c is string => !!c)),
  ];
  const [subjectNames, chapterNames] = await Promise.all([
    subjectIds.length
      ? db
          .select({ id: subjects.id, name: subjects.name })
          .from(subjects)
          .where(inArray(subjects.id, subjectIds))
      : [],
    chapterIds.length
      ? db
          .select({ id: chapters.id, name: chapters.name })
          .from(chapters)
          .where(inArray(chapters.id, chapterIds))
      : [],
  ]);
  const subjectName = new Map(subjectNames.map((s) => [s.id, s.name]));
  const chapterName = new Map(chapterNames.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    kind: r.kind,
    minutes: r.minutes,
    subjectId: r.subjectId,
    subjectName: subjectName.get(r.subjectId) ?? "",
    chapterId: r.chapterId,
    chapterName: r.chapterId ? (chapterName.get(r.chapterId) ?? "") : null,
    carriedFrom: r.carriedFrom,
    state: taskState(r, entries, today) as TaskState,
  }));
}

type PlanTask = Awaited<ReturnType<typeof describeTasks>>[number];

const KIND_ORDER = sql`case ${planTasks.kind} when 'review' then 0 when 'exercises' then 1 when 'cards' then 2 else 3 end`;

export async function todayPlan(userId: string, today: string) {
  await rollIfDue(userId, today);
  const from = addDays(today, -STREAK_WINDOW_DAYS);
  const [rows, entries] = await Promise.all([
    db
      .select()
      .from(planTasks)
      .where(
        and(
          eq(planTasks.userId, userId),
          gte(planTasks.date, from),
          lte(planTasks.date, today),
        ),
      )
      .orderBy(asc(planTasks.date), asc(planTasks.createdAt), sql`rowid`),
    activitySince([userId], from, today),
  ]);
  const doneDays = new Set(
    rows
      .filter((r) => taskState(r, entries, today) === "done")
      .map((r) => r.date),
  );
  const todays = rows.filter((r) => r.date === today);
  const tasks = await describeTasks(todays, entries, today);
  return {
    tasks,
    totalMinutes: tasks.reduce((sum, t) => sum + t.minutes, 0),
    done: tasks.filter((t) => t.state === "done").length,
    streak: streak(doneDays, today),
  };
}

export async function weekPlan(userId: string, day: string, today: string) {
  await rollIfDue(userId, today);
  const start = weekStart(day);
  const end = addDays(start, 6);
  const [rows, entries, totals] = await Promise.all([
    db
      .select()
      .from(planTasks)
      .where(
        and(
          eq(planTasks.userId, userId),
          gte(planTasks.date, start),
          lte(planTasks.date, end),
        ),
      )
      .orderBy(
        asc(planTasks.date),
        KIND_ORDER,
        asc(planTasks.createdAt),
        sql`rowid`,
      ),
    activitySince([userId], start, end),
    overallProgress(userId, today),
  ]);
  const tasks = await describeTasks(rows, entries, today);
  return {
    start,
    days: Array.from({ length: 7 }, (_, i) => addDays(start, i)).map(
      (date) => ({ date, tasks: tasks.filter((t) => t.date === date) }),
    ),
    overall: totals,
  };
}

/** Done tasks against every task in the plan; a missed task that was carried counts through its copy. */
async function overallProgress(userId: string, today: string) {
  const rows = await db
    .select()
    .from(planTasks)
    .where(eq(planTasks.userId, userId));
  if (rows.length === 0) return { done: 0, total: 0 };
  const first = rows.reduce((min, r) => (r.date < min ? r.date : min), today);
  const entries = await activitySince([userId], first, today);
  const states = rows.map((r) => ({ r, state: taskState(r, entries, today) }));
  const counted = states.filter(
    ({ r, state }) => !(r.rolled && state !== "done"),
  );
  return {
    done: counted.filter((c) => c.state === "done").length,
    total: counted.length,
  };
}

/** Points per member for the week holding `today`: card reviews, attempts and completed tasks. */
export async function weeklyPoints(userIds: string[], today: string) {
  const start = weekStart(today);
  const entries = await activitySince(userIds, start, today);
  const rows = userIds.length
    ? await db
        .select()
        .from(planTasks)
        .where(
          and(
            inArray(planTasks.userId, userIds),
            gte(planTasks.date, start),
            lte(planTasks.date, today),
          ),
        )
    : [];
  return new Map(
    userIds.map((id) => {
      const mine = entries.filter((e) => e.userId === id);
      const reviews = mine.filter((e) => e.source === "card").length;
      const attemptsLogged = mine.length - reviews;
      const tasksDone = rows.filter(
        (r) => r.userId === id && taskState(r, mine, today) === "done",
      ).length;
      return [
        id,
        {
          reviews,
          attempts: attemptsLogged,
          tasksDone,
          points:
            reviews * POINTS.review +
            attemptsLogged * POINTS.attempt +
            tasksDone * POINTS.task,
        },
      ];
    }),
  );
}

const POINTS = { review: 1, attempt: 3, task: 5 };
