import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as curriculum from "@/server/curriculum";

// Every member reads the curriculum; only admins change it.
function requireAdmin(user: Parameters<typeof isAdmin>[0]) {
  if (!isAdmin(user)) throw new Error("Only admins can change the curriculum.");
}

const byId = (data: unknown) => curriculum.idInput.parse(data);

export const getStreams = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => ({
    canEdit: isAdmin(context.user),
    streams: await curriculum.listStreams(),
  }));

export const getStream = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(byId)
  .handler(async ({ data, context }) => ({
    canEdit: isAdmin(context.user),
    found: await curriculum.getStream(data.id),
  }));

export const getSubject = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(byId)
  .handler(async ({ data, context }) => ({
    canEdit: isAdmin(context.user),
    found: await curriculum.getSubject(data.id),
  }));

export const getChapter = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(byId)
  .handler(async ({ data, context }) => ({
    canEdit: isAdmin(context.user),
    found: await curriculum.getChapter(data.id),
  }));

export const saveStream = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => curriculum.streamInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    return curriculum.saveStream(data);
  });

export const saveSubject = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => curriculum.subjectInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    return curriculum.saveSubject(data);
  });

export const saveUnit = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => curriculum.unitInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    return curriculum.saveUnit(data);
  });

export const saveChapter = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => curriculum.chapterInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    return curriculum.saveChapter(data);
  });

export const saveCard = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => curriculum.cardInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    return curriculum.saveCard(data);
  });

export const saveExercise = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => curriculum.exerciseInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    return curriculum.saveExercise(data);
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => curriculum.deleteInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    return curriculum.deleteItem(data);
  });
