import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { UserMinus } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CopyButton } from "@/client/components/CopyButton";
import { EmptyState } from "@/client/components/EmptyState";
import { FieldsDialog } from "@/client/components/FieldsDialog";
import { Page, Section, panel } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { useAction } from "@/client/lib/useAction";
import {
  deleteGroup,
  getGroup,
  leaveGroup,
  removeMember,
  renameGroup,
} from "@/serverFunctions/groups";

export const Route = createFileRoute("/groups/$groupId")({
  loader: ({ params }) => getGroup({ data: { groupId: params.groupId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? "Group"} · Exam Revision Planner` }],
  }),
  component: GroupPage,
});

type Confirm =
  | { kind: "leave" }
  | { kind: "delete" }
  | { kind: "remove"; userId: string; email: string };

function GroupPage() {
  const group = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const { run, pending } = useAction();
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const back = <BackLink to="/groups">Groups</BackLink>;

  if (!group) {
    return (
      <Page>
        <PageHeader title="Group not found" backLink={back} />
        <div data-testid="group-missing">
          <EmptyState
            title="You aren't in this group"
            description="Ask a member for its join code."
          />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={group.name}
        backLink={back}
        description={
          <span className="inline-flex items-center gap-2">
            Join code{" "}
            <code className="font-mono text-foreground" data-testid="join-code">
              {group.joinCode}
            </code>
            <CopyButton
              value={group.joinCode}
              successMessage="Copied the join code."
            />
          </span>
        }
        actions={
          group.isOwner ? (
            <>
              <Button variant="outline" onClick={() => setRenaming(true)}>
                Rename
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirm({ kind: "delete" })}
              >
                Delete group
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setConfirm({ kind: "leave" })}
            >
              Leave group
            </Button>
          )
        }
      />
      <Section title="This week">
        <ol className={`${panel} divide-y divide-border`}>
          {group.leaderboard.map((m, i) => (
            <li
              key={m.userId}
              data-testid="leader-row"
              data-current={m.isYou ? "true" : "false"}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 ${m.isYou ? "bg-accent" : ""}`}
            >
              <span className="w-6 text-sm font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.email}
                  {m.isYou ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      (you)
                    </span>
                  ) : null}
                  {m.isOwner ? (
                    <Badge variant="outline" className="ml-2">
                      Owner
                    </Badge>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.reviews} cards · {m.attempts} attempts · {m.tasksDone}{" "}
                  tasks done
                </p>
              </div>
              <p className="text-sm">
                <span
                  className="font-semibold tabular-nums"
                  data-testid="points"
                >
                  {m.points}
                </span>
                <span className="text-muted-foreground"> pts</span>
              </p>
              {group.isOwner && !m.isOwner ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${m.email}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setConfirm({
                      kind: "remove",
                      userId: m.userId,
                      email: m.email,
                    })
                  }
                >
                  <UserMinus />
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          1 point per card reviewed, 3 per exercise attempt, 5 per plan task
          done. Weeks start on Monday.
        </p>
      </Section>
      {renaming ? (
        <FieldsDialog
          title="Rename group"
          fields={[{ name: "name", label: "Name" }]}
          initial={{ name: group.name }}
          onClose={() => setRenaming(false)}
          onSave={async (values) => {
            await renameGroup({
              data: { groupId: group.id, name: String(values.name) },
            });
            await router.invalidate();
          }}
        />
      ) : null}
      {confirm?.kind === "remove" ? (
        <ConfirmDialog
          title={`Remove ${confirm.email}?`}
          confirmLabel="Remove"
          destructive
          pending={pending}
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            run(() =>
              removeMember({
                data: { groupId: group.id, userId: confirm.userId },
              }),
            ).then(() => setConfirm(null))
          }
        />
      ) : null}
      {confirm?.kind === "leave" ? (
        <ConfirmDialog
          title="Leave this group?"
          confirmLabel="Leave"
          pending={pending}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await leaveGroup({ data: { groupId: group.id } });
            await navigate({ to: "/groups" });
          }}
        >
          You'll need the join code to come back.
        </ConfirmDialog>
      ) : null}
      {confirm?.kind === "delete" ? (
        <ConfirmDialog
          title="Delete this group?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await deleteGroup({ data: { groupId: group.id } });
            await navigate({ to: "/groups" });
          }}
        >
          Its members lose the leaderboard.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
