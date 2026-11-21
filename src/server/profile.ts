import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles, streams } from "@/db/schema";
import { daysBetween } from "./dates";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const profileInput = z
  .object({
    streamId: z.string().uuid("Pick a stream"),
    examDate: isoDate,
    weeklyHours: z.number().int().min(1).max(80),
    daysPerWeek: z.number().int().min(1).max(7),
    useCards: z.boolean(),
    useExercises: z.boolean(),
    usePapers: z.boolean(),
    newCardsPerDay: z.number().int().min(0).max(200),
  })
  .strict()
  .refine((p) => p.useCards || p.useExercises || p.usePapers, {
    message: "Pick at least one tool",
  });

export type Profile = typeof profiles.$inferSelect;

export async function findProfile(userId: string): Promise<Profile | null> {
  return (
    (await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
    })) ?? null
  );
}

/** What pages show of the profile, with the countdown. */
export async function describeProfile(userId: string, today: string) {
  const profile = await findProfile(userId);
  if (!profile) return null;
  const stream = await db.query.streams.findFirst({
    where: eq(streams.id, profile.streamId),
  });
  return {
    streamId: profile.streamId,
    streamName: stream?.name ?? "",
    examDate: profile.examDate,
    weeklyHours: profile.weeklyHours,
    daysPerWeek: profile.daysPerWeek,
    useCards: profile.useCards,
    useExercises: profile.useExercises,
    usePapers: profile.usePapers,
    newCardsPerDay: profile.newCardsPerDay,
    daysLeft: Math.max(0, daysBetween(today, profile.examDate)),
  };
}

export async function upsertProfile(
  userId: string,
  input: z.infer<typeof profileInput>,
  today: string,
) {
  if (input.examDate <= today)
    throw new Error("The exam date must be after today.");
  const stream = await db.query.streams.findFirst({
    where: eq(streams.id, input.streamId),
  });
  if (!stream) throw new Error("That stream no longer exists.");
  await db
    .insert(profiles)
    .values({ userId, ...input })
    .onConflictDoUpdate({ target: profiles.userId, set: { ...input } });
}
