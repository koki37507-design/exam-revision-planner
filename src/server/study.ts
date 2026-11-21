// Flashcard study: chapter choice, the day's session and ratings.
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  activity,
  cardStates,
  cards,
  chapterSelections,
  chapters,
  subjects,
  units,
} from "@/db/schema";
import { findProfile } from "./profile";
import { NEW_CARD, ratings, review } from "./srs";

export const selectionInput = z
  .object({ chapterIds: z.array(z.string().uuid()).max(500) })
  .strict();
export const rateInput = z
  .object({
    cardId: z.string().uuid(),
    rating: z.enum(ratings),
    seconds: z.number().int().min(0).max(3600),
  })
  .strict();

/** The longest a single card counts toward study time. */
const MAX_CARD_SECONDS = 300;

/** The stream's chapters that hold cards, grouped by subject, with the member's picks. */
export async function chapterChoices(userId: string, streamId: string) {
  const rows = await db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      unitName: units.name,
      chapterId: chapters.id,
      chapterName: chapters.name,
      cards: sql<number>`(select count(*) from ${cards} where ${cards.chapterId} = ${chapters.id})`,
    })
    .from(chapters)
    .innerJoin(units, eq(units.id, chapters.unitId))
    .innerJoin(subjects, eq(subjects.id, units.subjectId))
    .where(eq(subjects.streamId, streamId))
    .orderBy(
      asc(subjects.createdAt),
      asc(units.createdAt),
      asc(chapters.createdAt),
    );
  const picked = new Set(
    (
      await db
        .select({ id: chapterSelections.chapterId })
        .from(chapterSelections)
        .where(eq(chapterSelections.userId, userId))
    ).map((r) => r.id),
  );
  return rows
    .filter((r) => r.cards > 0)
    .map((r) => ({ ...r, selected: picked.has(r.chapterId) }));
}

export async function saveSelection(
  userId: string,
  streamId: string,
  chapterIds: string[],
) {
  const allowed = new Set(
    (await chapterChoices(userId, streamId)).map((c) => c.chapterId),
  );
  const keep = [...new Set(chapterIds)].filter((id) => allowed.has(id));
  await db.batch([
    db.delete(chapterSelections).where(eq(chapterSelections.userId, userId)),
    ...keep.map((chapterId) =>
      db.insert(chapterSelections).values({ userId, chapterId }),
    ),
  ]);
}

async function selectedChapterIds(userId: string) {
  return (
    await db
      .select({ id: chapterSelections.chapterId })
      .from(chapterSelections)
      .where(eq(chapterSelections.userId, userId))
  ).map((r) => r.id);
}

const cardFields = { id: cards.id, front: cards.front, back: cards.back };

/** Today's finite queue: overdue cards, cards due today, then new cards up to the daily limit. */
export async function buildSession(userId: string, today: string) {
  const profile = await findProfile(userId);
  const chapterIds = await selectedChapterIds(userId);
  if (!profile || chapterIds.length === 0)
    return { overdue: [], dueToday: [], fresh: [] };
  const reviewed = await db
    .select({ ...cardFields, due: cardStates.due })
    .from(cardStates)
    .innerJoin(cards, eq(cards.id, cardStates.cardId))
    .where(
      and(
        eq(cardStates.userId, userId),
        inArray(cards.chapterId, chapterIds),
        lte(cardStates.due, today),
      ),
    )
    .orderBy(asc(cardStates.due), asc(cards.createdAt));
  const [{ introduced }] = (await db
    .select({ introduced: sql<number>`count(*)` })
    .from(cardStates)
    .where(
      and(eq(cardStates.userId, userId), eq(cardStates.introducedOn, today)),
    )) as [{ introduced: number }];
  const room = Math.max(0, profile.newCardsPerDay - introduced);
  const fresh = room
    ? await db
        .select(cardFields)
        .from(cards)
        .where(
          and(
            inArray(cards.chapterId, chapterIds),
            sql`not exists (select 1 from ${cardStates} where ${cardStates.cardId} = ${cards.id} and ${cardStates.userId} = ${userId})`,
          ),
        )
        .orderBy(asc(cards.createdAt))
        .limit(room)
    : [];
  const strip = ({
    id,
    front,
    back,
  }: {
    id: string;
    front: string;
    back: string;
  }) => ({ id, front, back });
  return {
    overdue: reviewed.filter((c) => c.due < today).map(strip),
    dueToday: reviewed.filter((c) => c.due === today).map(strip),
    fresh,
  };
}

export async function rateCard(
  userId: string,
  input: z.infer<typeof rateInput>,
  today: string,
) {
  const chapterIds = await selectedChapterIds(userId);
  const [card] = await db
    .select({
      id: cards.id,
      chapterId: cards.chapterId,
      subjectId: units.subjectId,
    })
    .from(cards)
    .innerJoin(chapters, eq(chapters.id, cards.chapterId))
    .innerJoin(units, eq(units.id, chapters.unitId))
    .where(eq(cards.id, input.cardId));
  if (!card || !chapterIds.includes(card.chapterId))
    throw new Error("That card isn't in your chosen chapters.");
  const prev = await db.query.cardStates.findFirst({
    where: and(eq(cardStates.userId, userId), eq(cardStates.cardId, card.id)),
  });
  const next = review(prev ?? NEW_CARD, input.rating, today);
  await db.batch([
    db
      .insert(cardStates)
      .values({
        userId,
        cardId: card.id,
        ...next,
        introducedOn: today,
        lastReviewedOn: today,
      })
      .onConflictDoUpdate({
        target: [cardStates.userId, cardStates.cardId],
        set: {
          intervalDays: next.intervalDays,
          ease: next.ease,
          reps: next.reps,
          lapses: next.lapses,
          due: next.due,
          lastReviewedOn: today,
        },
      }),
    db.insert(activity).values({
      id: crypto.randomUUID(),
      userId,
      day: today,
      source: "card",
      subjectId: card.subjectId,
      chapterId: card.chapterId,
      seconds: Math.max(1, Math.min(MAX_CARD_SECONDS, input.seconds)),
    }),
  ]);
  return { due: next.due };
}

/** Lapses per chapter, for the review list and the plan's weak chapters. */
export async function lapsesByChapter(userId: string) {
  return db
    .select({
      chapterId: cards.chapterId,
      lapses: sql<number>`sum(${cardStates.lapses})`,
    })
    .from(cardStates)
    .innerJoin(cards, eq(cards.id, cardStates.cardId))
    .where(and(eq(cardStates.userId, userId), gte(cardStates.lapses, 1)))
    .groupBy(cards.chapterId);
}
