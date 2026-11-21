import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { FieldsDialog } from "@/client/components/FieldsDialog";
import { Page, Section, panel } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { plural } from "@/client/lib/format";
import { messageOf } from "@/client/lib/useAction";
import { createGroup, getGroups, joinGroup } from "@/serverFunctions/groups";

export const Route = createFileRoute("/groups/")({
  loader: () => getGroups(),
  head: () => ({ meta: [{ title: "Groups · Exam Revision Planner" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const groups = Route.useLoaderData();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  return (
    <Page>
      <PageHeader
        title="Groups"
        actions={<Button onClick={() => setCreating(true)}>New group</Button>}
      />
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setJoining(true);
          setJoinError(null);
          try {
            const { id } = await joinGroup({ data: { code } });
            await navigate({ to: "/groups/$groupId", params: { groupId: id } });
          } catch (cause) {
            setJoinError(messageOf(cause));
          } finally {
            setJoining(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="join-code">Join code</Label>
          <Input
            id="join-code"
            className="w-48 uppercase"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" pending={joining}>
          Join
        </Button>
      </form>
      {joinError ? (
        <Alert variant="destructive">
          <AlertDescription>{joinError}</AlertDescription>
        </Alert>
      ) : null}
      <Section title="Your groups">
        {groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No groups yet"
            description="Create one and share its code, or join with a code from a classmate."
          />
        ) : (
          <ul className={`${panel} divide-y divide-border`}>
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  to="/groups/$groupId"
                  params={{ groupId: g.id }}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted"
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {g.isOwner ? <Badge variant="outline">Owner</Badge> : null}
                    {plural(g.members, "member")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {creating ? (
        <FieldsDialog
          title="New group"
          fields={[{ name: "name", label: "Name" }]}
          onClose={() => setCreating(false)}
          onSave={async (values) => {
            const { id } = await createGroup({
              data: { name: String(values.name) },
            });
            await navigate({ to: "/groups/$groupId", params: { groupId: id } });
          }}
        />
      ) : null}
    </Page>
  );
}
