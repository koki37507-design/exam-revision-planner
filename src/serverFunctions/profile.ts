import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { listStreams } from "@/server/curriculum";
import { todayIso } from "@/server/dates";
import { regeneratePlan, todayPlan } from "@/server/plan";
import { describeProfile, profileInput, upsertProfile } from "@/server/profile";
import { rememberUser } from "@/server/users";

export const getProfileForm = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => ({
    profile: await describeProfile(context.user.id, todayIso()),
    streams: await listStreams(),
    today: todayIso(),
  }));

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => profileInput.parse(data))
  .handler(async ({ data, context }) => {
    const today = todayIso();
    await rememberUser(context.user);
    await upsertProfile(context.user.id, data, today);
    await regeneratePlan(context.user.id, today);
  });

/** The home page: the countdown and today's tasks, or the ask to set up. */
export const getToday = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const today = todayIso();
    await rememberUser(context.user);
    const profile = await describeProfile(context.user.id, today);
    if (!profile) return { profile: null, plan: null, today };
    return { profile, plan: await todayPlan(context.user.id, today), today };
  });
