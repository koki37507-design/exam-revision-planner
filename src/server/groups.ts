// Study groups: join codes, membership and the weekly leaderboard.
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { groupMembers, studyGroups, users } from "@/db/schema";
import { weeklyPoints } from "./plan";

const name = z.string().trim().min(1, "Name is required").max(80);
export const groupIdInput = z.object({ groupId: z.string().uuid() }).strict();
export const createGroupInput = z.object({ name }).strict();
export const renameGroupInput = z
  .object({ groupId: z.string().uuid(), name })
  .strict();
export const joinGroupInput = z
  .object({ code: z.string().trim().min(1).max(20) })
  .strict();
export const removeMemberInput = z
  .object({ groupId: z.string().uuid(), userId: z.string().min(1) })
  .strict();

// No 0/O or 1/I, so a code read aloud is typed right.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes]
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join("");
}

export async function listGroups(userId: string) {
  const mine = await db
    .select({
      id: studyGroups.id,
      name: studyGroups.name,
      ownerId: studyGroups.ownerId,
    })
    .from(groupMembers)
    .innerJoin(studyGroups, eq(studyGroups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(asc(studyGroups.name));
  if (mine.length === 0) return [];
  const sizes = await db
    .select({ groupId: groupMembers.groupId, n: count() })
    .from(groupMembers)
    .where(
      inArray(
        groupMembers.groupId,
        mine.map((g) => g.id),
      ),
    )
    .groupBy(groupMembers.groupId);
  const by = new Map(sizes.map((s) => [s.groupId, s.n]));
  return mine.map((g) => ({
    id: g.id,
    name: g.name,
    isOwner: g.ownerId === userId,
    members: by.get(g.id) ?? 0,
  }));
}

export async function createGroup(
  userId: string,
  input: z.infer<typeof createGroupInput>,
) {
  const id = crypto.randomUUID();
  await db.batch([
    db
      .insert(studyGroups)
      .values({ id, name: input.name, ownerId: userId, joinCode: newCode() }),
    db.insert(groupMembers).values({ groupId: id, userId }),
  ]);
  return { id };
}

export async function joinGroup(
  userId: string,
  input: z.infer<typeof joinGroupInput>,
) {
  const group = await db.query.studyGroups.findFirst({
    where: eq(studyGroups.joinCode, input.code.toUpperCase()),
  });
  if (!group) throw new Error("No group has that code.");
  await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId })
    .onConflictDoNothing();
  return { id: group.id };
}

async function membership(userId: string, groupId: string) {
  const [row] = await db
    .select({
      id: studyGroups.id,
      name: studyGroups.name,
      ownerId: studyGroups.ownerId,
      joinCode: studyGroups.joinCode,
    })
    .from(groupMembers)
    .innerJoin(studyGroups, eq(studyGroups.id, groupMembers.groupId))
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    );
  return row ?? null;
}

/** The group and this week's leaderboard, for its members only. */
export async function getGroup(userId: string, groupId: string, today: string) {
  const group = await membership(userId, groupId);
  if (!group) return null;
  const members = await db
    .select({ userId: groupMembers.userId, email: users.email })
    .from(groupMembers)
    .leftJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId));
  const points = await weeklyPoints(
    members.map((m) => m.userId),
    today,
  );
  const leaderboard = members
    .map((m) => ({
      userId: m.userId,
      email: m.email ?? "",
      isOwner: m.userId === group.ownerId,
      isYou: m.userId === userId,
      ...points.get(m.userId)!,
    }))
    .sort((a, b) => b.points - a.points || a.email.localeCompare(b.email));
  return {
    id: group.id,
    name: group.name,
    joinCode: group.joinCode,
    isOwner: group.ownerId === userId,
    leaderboard,
  };
}

async function ownedGroup(userId: string, groupId: string) {
  const group = await db.query.studyGroups.findFirst({
    where: and(eq(studyGroups.id, groupId), eq(studyGroups.ownerId, userId)),
  });
  if (!group) throw new Error("Only the group's owner can do that.");
  return group;
}

export async function renameGroup(
  userId: string,
  input: z.infer<typeof renameGroupInput>,
) {
  await ownedGroup(userId, input.groupId);
  await db
    .update(studyGroups)
    .set({ name: input.name })
    .where(eq(studyGroups.id, input.groupId));
}

export async function removeMember(
  userId: string,
  input: z.infer<typeof removeMemberInput>,
) {
  await ownedGroup(userId, input.groupId);
  if (input.userId === userId) throw new Error("Delete the group instead.");
  await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, input.groupId),
        eq(groupMembers.userId, input.userId),
      ),
    );
}

export async function deleteGroup(
  userId: string,
  input: z.infer<typeof groupIdInput>,
) {
  await ownedGroup(userId, input.groupId);
  await db.delete(studyGroups).where(eq(studyGroups.id, input.groupId));
}

/** Leaving hands an owner's group to its longest-standing member, or deletes it when empty. */
export async function leaveGroup(
  userId: string,
  input: z.infer<typeof groupIdInput>,
) {
  const group = await membership(userId, input.groupId);
  if (!group) throw new Error("You aren't in that group.");
  const others = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, input.groupId))
    .orderBy(asc(groupMembers.joinedAt));
  const heir = others.find((o) => o.userId !== userId);
  if (group.ownerId === userId && !heir) {
    await db.delete(studyGroups).where(eq(studyGroups.id, input.groupId));
    return;
  }
  await db.batch([
    db
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, input.groupId),
          eq(groupMembers.userId, userId),
        ),
      ),
    ...(group.ownerId === userId
      ? [
          db
            .update(studyGroups)
            .set({ ownerId: heir!.userId })
            .where(eq(studyGroups.id, input.groupId)),
        ]
      : []),
  ]);
}
