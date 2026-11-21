import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { Page, panel } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { ListRow, RowActions, useEditor } from "@/client/components/useEditor";
import { Button } from "@/client/components/ui/button";
import { plural } from "@/client/lib/format";
import { getStreams, saveStream } from "@/serverFunctions/curriculum";

export const Route = createFileRoute("/curriculum/")({
  loader: () => getStreams(),
  head: () => ({ meta: [{ title: "Curriculum · Exam Revision Planner" }] }),
  component: StreamsPage,
});

function StreamsPage() {
  const { canEdit, streams } = Route.useLoaderData();
  const editor = useEditor();
  const fields = [{ name: "name", label: "Name" }];

  return (
    <Page>
      <PageHeader
        title="Curriculum"
        actions={
          canEdit ? (
            <Button
              onClick={() =>
                editor.open({
                  title: "New stream",
                  fields,
                  save: (v) => saveStream({ data: { name: String(v.name) } }),
                })
              }
            >
              New stream
            </Button>
          ) : null
        }
      />
      {streams.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No streams yet"
          description={
            canEdit
              ? "Add a stream, then its subjects."
              : "An admin hasn't added any streams yet."
          }
        />
      ) : (
        <ul className={`${panel} divide-y divide-border`}>
          {streams.map((s) => (
            <ListRow key={s.id} testId="stream-row">
              <Link
                to="/curriculum/streams/$streamId"
                params={{ streamId: s.id }}
                className="min-w-0 flex-1 font-medium hover:underline"
              >
                {s.name}
              </Link>
              <span className="text-muted-foreground">
                {plural(s.subjects, "subject")}
              </span>
              {canEdit ? (
                <RowActions
                  name={s.name}
                  onEdit={() =>
                    editor.open({
                      title: "Edit stream",
                      fields,
                      initial: { name: s.name },
                      save: (v) =>
                        saveStream({
                          data: { id: s.id, name: String(v.name) },
                        }),
                    })
                  }
                  onDelete={() =>
                    editor.remove({
                      type: "stream",
                      id: s.id,
                      name: s.name,
                      consequence:
                        "Its subjects, chapters, cards and exercises are deleted too.",
                    })
                  }
                />
              ) : null}
            </ListRow>
          ))}
        </ul>
      )}
      {editor.element}
    </Page>
  );
}
