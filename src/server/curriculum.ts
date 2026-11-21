import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  cards,
  chapters,
  exercises,
  streams,
  subjects,
  units,
} from "@/db/schema";

const id = z.string().uuid();
const name = z.string().trim().min(1, "Name is required").max(120);
const longText = z.string().trim().min(1).max(20_000);

export const idInput = z.object({ id }).strict();
export const streamInput = z.object({ id: id.optional(), name }).strict();
export const subjectInput = z
  .object({
    id: id.optional(),
    streamId: id,
    name,
    coefficient: z.number().int().min(1).max(20),
    isLanguage: z.boolean(),
  })
  .strict();
export const unitInput = z
  .object({ id: id.optional(), subjectId: id, name })
  .strict();
export const chapterInput = z
  .object({ id: id.optional(), unitId: id, name })
  .strict();
export const cardInput = z
  .object({
    id: id.optional(),
    chapterId: id,
    front: longText,
    back: longText,
  })
  .strict();
export const exerciseInput = z
  .object({
    id: id.optional(),
    kind: z.enum(["exercise", "paper"]),
    // The chapter for an exercise, the language subject for a paper.
    parentId: id,
    title: name,
    statement: longText,
    solution: z.string().trim().max(20_000).optional(),
  })
  .strict();

class NotFound extends Error {
  constructor(what = "That item no longer exists.") {
    super(what);
  }
}

export async function listStreams() {
  const rows = await db.select().from(streams).orderBy(asc(streams.name));
  const counts = await db
    .select({ streamId: subjects.streamId, n: count() })
    .from(subjects)
    .groupBy(subjects.streamId);
  const by = new Map(counts.map((c) => [c.streamId, c.n]));
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    subjects: by.get(s.id) ?? 0,
  }));
}

export async function getStream(streamId: string) {
  const stream = await db.query.streams.findFirst({
    where: eq(streams.id, streamId),
  });
  if (!stream) return null;
  const rows = await db
    .select()
    .from(subjects)
    .where(eq(subjects.streamId, streamId))
    .orderBy(asc(subjects.createdAt), asc(subjects.name));
  const unitCounts = rows.length
    ? await db
        .select({ subjectId: units.subjectId, n: count() })
        .from(units)
        .where(
          inArray(
            units.subjectId,
            rows.map((r) => r.id),
          ),
        )
        .groupBy(units.subjectId)
    : [];
  const by = new Map(unitCounts.map((c) => [c.subjectId, c.n]));
  return {
    stream: { id: stream.id, name: stream.name },
    subjects: rows.map((s) => ({
      id: s.id,
      name: s.name,
      coefficient: s.coefficient,
      isLanguage: s.isLanguage,
      units: by.get(s.id) ?? 0,
    })),
  };
}

export async function getSubject(subjectId: string) {
  const subject = await db.query.subjects.findFirst({
    where: eq(subjects.id, subjectId),
  });
  if (!subject) return null;
  const stream = await db.query.streams.findFirst({
    where: eq(streams.id, subject.streamId),
  });
  const unitRows = await db
    .select()
    .from(units)
    .where(eq(units.subjectId, subjectId))
    .orderBy(asc(units.createdAt));
  const chapterRows = unitRows.length
    ? await db
        .select()
        .from(chapters)
        .where(
          inArray(
            chapters.unitId,
            unitRows.map((u) => u.id),
          ),
        )
        .orderBy(asc(chapters.createdAt))
    : [];
  const ids = chapterRows.map((c) => c.id);
  const [cardCounts, exerciseCounts] = ids.length
    ? await Promise.all([
        db
          .select({ chapterId: cards.chapterId, n: count() })
          .from(cards)
          .where(inArray(cards.chapterId, ids))
          .groupBy(cards.chapterId),
        db
          .select({ chapterId: exercises.chapterId, n: count() })
          .from(exercises)
          .where(inArray(exercises.chapterId, ids))
          .groupBy(exercises.chapterId),
      ])
    : [[], []];
  const cardsBy = new Map(cardCounts.map((c) => [c.chapterId, c.n]));
  const exercisesBy = new Map(exerciseCounts.map((c) => [c.chapterId, c.n]));
  const paperRows = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.subjectId, subjectId), eq(exercises.kind, "paper")))
    .orderBy(asc(exercises.createdAt));
  return {
    stream: { id: stream!.id, name: stream!.name },
    subject: {
      id: subject.id,
      name: subject.name,
      coefficient: subject.coefficient,
      isLanguage: subject.isLanguage,
    },
    units: unitRows.map((u) => ({
      id: u.id,
      name: u.name,
      chapters: chapterRows
        .filter((c) => c.unitId === u.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          cards: cardsBy.get(c.id) ?? 0,
          exercises: exercisesBy.get(c.id) ?? 0,
        })),
    })),
    papers: paperRows.map((p) => ({
      id: p.id,
      title: p.title,
      statement: p.statement,
      solution: p.solution,
    })),
  };
}

export async function getChapter(chapterId: string) {
  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
  });
  if (!chapter) return null;
  const unit = (await db.query.units.findFirst({
    where: eq(units.id, chapter.unitId),
  }))!;
  const subject = (await db.query.subjects.findFirst({
    where: eq(subjects.id, unit.subjectId),
  }))!;
  const [cardRows, exerciseRows] = await Promise.all([
    db
      .select()
      .from(cards)
      .where(eq(cards.chapterId, chapterId))
      .orderBy(asc(cards.createdAt)),
    db
      .select()
      .from(exercises)
      .where(eq(exercises.chapterId, chapterId))
      .orderBy(asc(exercises.createdAt)),
  ]);
  return {
    chapter: { id: chapter.id, name: chapter.name },
    unit: { id: unit.id, name: unit.name },
    subject: { id: subject.id, name: subject.name },
    cards: cardRows.map((c) => ({ id: c.id, front: c.front, back: c.back })),
    exercises: exerciseRows.map((e) => ({
      id: e.id,
      title: e.title,
      statement: e.statement,
      solution: e.solution,
    })),
  };
}

const uuid = () => crypto.randomUUID();

async function mustExist(found: unknown) {
  if (!found) throw new NotFound();
}

export async function saveStream(input: z.infer<typeof streamInput>) {
  if (input.id) {
    const [row] = await db
      .update(streams)
      .set({ name: input.name })
      .where(eq(streams.id, input.id))
      .returning({ id: streams.id });
    await mustExist(row);
    return row!;
  }
  const [row] = await db
    .insert(streams)
    .values({ id: uuid(), name: input.name })
    .returning({ id: streams.id });
  return row!;
}

export async function saveSubject(input: z.infer<typeof subjectInput>) {
  await mustExist(
    await db.query.streams.findFirst({ where: eq(streams.id, input.streamId) }),
  );
  const values = {
    name: input.name,
    coefficient: input.coefficient,
    isLanguage: input.isLanguage,
  };
  if (input.id) {
    const [row] = await db
      .update(subjects)
      .set(values)
      .where(eq(subjects.id, input.id))
      .returning({ id: subjects.id });
    await mustExist(row);
    return row!;
  }
  const [row] = await db
    .insert(subjects)
    .values({ id: uuid(), streamId: input.streamId, ...values })
    .returning({ id: subjects.id });
  return row!;
}

export async function saveUnit(input: z.infer<typeof unitInput>) {
  await mustExist(
    await db.query.subjects.findFirst({
      where: eq(subjects.id, input.subjectId),
    }),
  );
  if (input.id) {
    const [row] = await db
      .update(units)
      .set({ name: input.name })
      .where(eq(units.id, input.id))
      .returning({ id: units.id });
    await mustExist(row);
    return row!;
  }
  const [row] = await db
    .insert(units)
    .values({ id: uuid(), subjectId: input.subjectId, name: input.name })
    .returning({ id: units.id });
  return row!;
}

export async function saveChapter(input: z.infer<typeof chapterInput>) {
  await mustExist(
    await db.query.units.findFirst({ where: eq(units.id, input.unitId) }),
  );
  if (input.id) {
    const [row] = await db
      .update(chapters)
      .set({ name: input.name })
      .where(eq(chapters.id, input.id))
      .returning({ id: chapters.id });
    await mustExist(row);
    return row!;
  }
  const [row] = await db
    .insert(chapters)
    .values({ id: uuid(), unitId: input.unitId, name: input.name })
    .returning({ id: chapters.id });
  return row!;
}

export async function saveCard(input: z.infer<typeof cardInput>) {
  await mustExist(
    await db.query.chapters.findFirst({
      where: eq(chapters.id, input.chapterId),
    }),
  );
  if (input.id) {
    const [row] = await db
      .update(cards)
      .set({ front: input.front, back: input.back })
      .where(eq(cards.id, input.id))
      .returning({ id: cards.id });
    await mustExist(row);
    return row!;
  }
  const [row] = await db
    .insert(cards)
    .values({
      id: uuid(),
      chapterId: input.chapterId,
      front: input.front,
      back: input.back,
    })
    .returning({ id: cards.id });
  return row!;
}

export async function saveExercise(input: z.infer<typeof exerciseInput>) {
  let subjectId: string;
  let chapterId: string | null = null;
  if (input.kind === "exercise") {
    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, input.parentId),
    });
    await mustExist(chapter);
    const unit = await db.query.units.findFirst({
      where: eq(units.id, chapter!.unitId),
    });
    subjectId = unit!.subjectId;
    chapterId = chapter!.id;
  } else {
    const subject = await db.query.subjects.findFirst({
      where: eq(subjects.id, input.parentId),
    });
    await mustExist(subject);
    if (!subject!.isLanguage)
      throw new Error("Exam papers belong to language subjects.");
    subjectId = subject!.id;
  }
  const values = {
    title: input.title,
    statement: input.statement,
    solution: input.solution || null,
  };
  if (input.id) {
    const [row] = await db
      .update(exercises)
      .set(values)
      .where(eq(exercises.id, input.id))
      .returning({ id: exercises.id });
    await mustExist(row);
    return row!;
  }
  const [row] = await db
    .insert(exercises)
    .values({ id: uuid(), kind: input.kind, subjectId, chapterId, ...values })
    .returning({ id: exercises.id });
  return row!;
}

const tables = {
  stream: streams,
  subject: subjects,
  unit: units,
  chapter: chapters,
  card: cards,
  exercise: exercises,
} as const;
export const deleteInput = z
  .object({
    id,
    type: z.enum(["stream", "subject", "unit", "chapter", "card", "exercise"]),
  })
  .strict();

/** Deletes the item; foreign keys remove everything under it. */
export async function deleteItem({
  id: itemId,
  type,
}: z.infer<typeof deleteInput>) {
  const table = tables[type];
  const [row] = await db
    .delete(table)
    .where(eq(table.id, itemId))
    .returning({ id: table.id });
  await mustExist(row);
  return row!;
}
