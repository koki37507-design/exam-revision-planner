import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { todayIso } from "@/server/dates";
import { regeneratePlan } from "@/server/plan";
import { describeProfile, findProfile } from "@/server/profile";
import * as study from "@/server/study";

export const getCards = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const today = todayIso();
    const profile = await describeProfile(context.user.id, today);
    if (!profile) return { profile: null, chapters: [], session: null };
    const [chapters, session] = await Promise.all([
      study.chapterChoices(context.user.id, profile.streamId),
      study.buildSession(context.user.id, today),
    ]);
    return {
      profile,
      chapters,
      session: {
        overdue: session.overdue.length,
        dueToday: session.dueToday.length,
        fresh: session.fresh.length,
      },
    };
  });

export const saveChapters = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => study.selectionInput.parse(data))
  .handler(async ({ data, context }) => {
    const profile = await findProfile(context.user.id);
    if (!profile) throw new Error("Set up your study profile first.");
    await study.saveSelection(
      context.user.id,
      profile.streamId,
      data.chapterIds,
    );
    await regeneratePlan(context.user.id, todayIso());
  });

export const getSession = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const session = await study.buildSession(context.user.id, todayIso());
    return [...session.overdue, ...session.dueToday, ...session.fresh];
  });

export const rateCard = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => study.rateInput.parse(data))
  .handler(({ data, context }) =>
    study.rateCard(context.user.id, data, todayIso()),
  );
