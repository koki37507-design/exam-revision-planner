import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { todayIso } from "@/server/dates";
import { regeneratePlan, weekPlan } from "@/server/plan";
import { describeProfile } from "@/server/profile";

export const getWeek = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .strict()
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const today = todayIso();
    const profile = await describeProfile(context.user.id, today);
    if (!profile) return { profile: null, week: null, today };
    return {
      profile,
      week: await weekPlan(context.user.id, data.date ?? today, today),
      today,
    };
  });

export const regenerate = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => regeneratePlan(context.user.id, todayIso()));
