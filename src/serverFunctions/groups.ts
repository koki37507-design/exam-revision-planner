import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { todayIso } from "@/server/dates";
import * as groups from "@/server/groups";
import { rememberUser } from "@/server/users";

export const getGroups = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => groups.listGroups(context.user.id));

export const getGroup = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => groups.groupIdInput.parse(data))
  .handler(({ data, context }) =>
    groups.getGroup(context.user.id, data.groupId, todayIso()),
  );

export const createGroup = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => groups.createGroupInput.parse(data))
  .handler(async ({ data, context }) => {
    await rememberUser(context.user);
    return groups.createGroup(context.user.id, data);
  });

export const joinGroup = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => groups.joinGroupInput.parse(data))
  .handler(async ({ data, context }) => {
    await rememberUser(context.user);
    return groups.joinGroup(context.user.id, data);
  });

export const renameGroup = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => groups.renameGroupInput.parse(data))
  .handler(({ data, context }) => groups.renameGroup(context.user.id, data));

export const removeMember = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => groups.removeMemberInput.parse(data))
  .handler(({ data, context }) => groups.removeMember(context.user.id, data));

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => groups.groupIdInput.parse(data))
  .handler(({ data, context }) => groups.leaveGroup(context.user.id, data));

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => groups.groupIdInput.parse(data))
  .handler(({ data, context }) => groups.deleteGroup(context.user.id, data));
