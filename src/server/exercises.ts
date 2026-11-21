// Exercises and exam papers: browsing, attempts and the review list.
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  activity,
  attempts,
  chapters,
  exercises,
  subjects,
  units,
} from "@/db/schema";
import { lapsesByChapter } from "./study";

const attemptStatuses = [
  "solved",
  "partial",
  "stuck",
  "skipped",
] as const;
export const attemptInput = z
  .object({
    exerciseId: z.string().uuid(),
    status: z.enum(attemptStatuses),
    minutes: z.number().int().min(0).max(600),
  })
  .strict();

type Status = (typeof attemptStatuses)[number];

/** The latest status of each exercise this member tried. */
async function latestStatuses(userId: string, exerciseIds: string[]) {
  if (exerciseIds.length === 0) return new Map<string, Status>();
  const rows = await db
    .select({ exerciseId: attempts.exerciseId, status: attempts.status })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        inArray(attempts.exerciseId, exerciseIds),
      ),
    )
    .orderBy(asc(attempts.createdAt), sql`rowid`);
  return new Map(rows.map((r) => [r.exerciseId, r.status]));
}

/** The stream's exercises by subject, unit and chapter, and its language papers. */
export async function browse(
  userId: string,
  streamId: string,
  chapterId?: string,
) {
  const subjectRows = await db
    .select()
    .from(subjects)
    .where(eq(subjects.streamId, streamId))
    .orderBy(asc(subjects.createdAt));
  const subjectIds = subjectRows.map((s) => s.id);
  if (subjectIds.length === 0) return { subjects: [] };
  const rows = await db
    .select({
      id: exercises.id,
      kind: exercises.kind,
      title: exercises.title,
      subjectId: exercises.subjectId,
      chapterId: exercises.chapterId,
      chapterName: chapters.name,
      unitId: units.id,
      unitName: units.name,
    })
    .from(exercises)
    .leftJoin(chapters, eq(chapters.id, exercises.chapterId))
    .leftJoin(units, eq(units.id, chapters.unitId))
    .where(
      and(
        inArray(exercises.subjectId, subjectIds),
        chapterId ? eq(exercises.chapterId, chapterId) : undefined,
      ),
    )
    .orderBy(
      asc(units.createdAt),
      asc(chapters.createdAt),
      asc(exercises.createdAt),
    );
  const latest = await latestStatuses(
    userId,
    rows.map((r) => r.id),
  );
  return {
    subjects: subjectRows
      .map((s) => {
        const mine = rows.filter((r) => r.subjectId === s.id);
        const chaptersOf = new Map<
          string,
          {
            id: string;
            name: string;
            unitName: string;
            exercises: { id: string; title: string; status: Status | null }[];
          }
        >();
        for (const r of mine.filter((r) => r.kind === "exercise")) {
          const entry = chaptersOf.get(r.chapterId!) ?? {
            id: r.chapterId!,
            name: r.chapterName!,
            unitName: r.unitName!,
            exercises: [],
          };
          entry.exercises.push({
            id: r.id,
            title: r.title,
            status: latest.get(r.id) ?? null,
          });
          chaptersOf.set(r.chapterId!, entry);
        }
        return {
          id: s.id,
          name: s.name,
          chapters: [...chaptersOf.values()],
          papers: mine
            .filter((r) => r.kind === "paper")
            .map((r) => ({
              id: r.id,
              title: r.title,
              status: latest.get(r.id) ?? null,
            })),
        };
      })
      .filter((s) => s.chapters.length > 0 || s.papers.length > 0),
  };
}

export async function getExercise(userId: string, exerciseId: string) {
  const [row] = await db
    .select({
      id: exercises.id,
      kind: exercises.kind,
      title: exercises.title,
      statement: exercises.statement,
      solution: exercises.solution,
      subjectName: subjects.name,
      chapterName: chapters.name,
    })
    .from(exercises)
    .innerJoin(subjects, eq(subjects.id, exercises.subjectId))
    .leftJoin(chapters, eq(chapters.id, exercises.chapterId))
    .where(eq(exercises.id, exerciseId));
  if (!row) return null;
  const history = await db
    .select({
      id: attempts.id,
      status: attempts.status,
      minutes: attempts.minutes,
      createdAt: attempts.createdAt,
    })
    .from(attempts)
    .where(
      and(eq(attempts.userId, userId), eq(attempts.exerciseId, exerciseId)),
    )
    .orderBy(desc(attempts.createdAt), sql`rowid desc`);
  return { exercise: row, attempts: history };
}

export async function logAttempt(
  userId: string,
  input: z.infer<typeof attemptInput>,
  today: string,
) {
  const exercise = await db.query.exercises.findFirst({
    where: eq(exercises.id, input.exerciseId),
  });
  if (!exercise) throw new Error("That exercise no longer exists.");
  await db.batch([
    db
      .insert(attempts)
      .values({
        id: crypto.randomUUID(),
        userId,
        exerciseId: exercise.id,
        status: input.status,
        minutes: input.minutes,
        day: today,
      }),
    db.insert(activity).values({
      id: crypto.randomUUID(),
      userId,
      day: today,
      source: exercise.kind === "paper" ? "paper" : "exercise",
      subjectId: exercise.subjectId,
      chapterId: exercise.chapterId,
      seconds: input.minutes * 60,
    }),
  ]);
}

/** Chapters where the member got stuck, half-solved or lapsed cards, most often first. */
export async function weakChapters(userId: string) {
  const struggles = await db
    .select({
      chapterId: exercises.chapterId,
      stuck: sql<number>`sum(case when ${attempts.status} = 'stuck' then 1 else 0 end)`,
      partial: sql<number>`sum(case when ${attempts.status} = 'partial' then 1 else 0 end)`,
    })
    .from(attempts)
    .innerJoin(exercises, eq(exercises.id, attempts.exerciseId))
    .where(
      and(
        eq(attempts.userId, userId),
        inArray(attempts.status, ["stuck", "partial"]),
        sql`${exercises.chapterId} is not null`,
      ),
    )
    .groupBy(exercises.chapterId);
  const lapses = await lapsesByChapter(userId);
  const by = new Map<
    string,
    { stuck: number; partial: number; lapses: number }
  >();
  for (const s of struggles)
    by.set(s.chapterId!, { stuck: s.stuck, partial: s.partial, lapses: 0 });
  for (const l of lapses) {
    const entry = by.get(l.chapterId) ?? { stuck: 0, partial: 0, lapses: 0 };
    entry.lapses = l.lapses;
    by.set(l.chapterId, entry);
  }
  if (by.size === 0) return [];
  const names = await db
    .select({
      id: chapters.id,
      name: chapters.name,
      unitName: units.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
    })
    .from(chapters)
    .innerJoin(units, eq(units.id, chapters.unitId))
    .innerJoin(subjects, eq(subjects.id, units.subjectId))
    .where(inArray(chapters.id, [...by.keys()]));
  return names
    .map((n) => {
      const c = by.get(n.id)!;
      return {
        chapterId: n.id,
        chapterName: n.name,
        unitName: n.unitName,
        subjectId: n.subjectId,
        subjectName: n.subjectName,
        ...c,
        total: c.stuck + c.partial + c.lapses,
      };
    })
    .sort(
      (a, b) => b.total - a.total || a.chapterName.localeCompare(b.chapterName),
    );
}
