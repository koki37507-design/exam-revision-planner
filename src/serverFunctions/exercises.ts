import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { todayIso } from "@/server/dates";
import * as exercises from "@/server/exercises";
import { describeProfile } from "@/server/profile";

export const getExercises = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z.object({ chapterId: z.string().uuid().optional() }).strict().parse(data),
  )
  .handler(async ({ data, context }) => {
    const profile = await describeProfile(context.user.id, todayIso());
    if (!profile) return { profile: null, subjects: [] };
    const found = await exercises.browse(
      context.user.id,
      profile.streamId,
      data.chapterId,
    );
    return { profile, subjects: found.subjects };
  });

export const getExercise = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid() }).strict().parse(data),
  )
  .handler(({ data, context }) =>
    exercises.getExercise(context.user.id, data.id),
  );

export const logAttempt = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => exercises.attemptInput.parse(data))
  .handler(({ data, context }) =>
    exercises.logAttempt(context.user.id, data, todayIso()),
  );

export const getReviewList = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => exercises.weakChapters(context.user.id));
