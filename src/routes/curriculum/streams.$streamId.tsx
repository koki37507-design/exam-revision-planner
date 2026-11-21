import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { Page, panel } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { ListRow, RowActions, useEditor } from "@/client/components/useEditor";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { plural } from "@/client/lib/format";
import { getStream, saveSubject } from "@/serverFunctions/curriculum";

export const Route = createFileRoute("/curriculum/streams/$streamId")({
  loader: ({ params }) => getStream({ data: { id: params.streamId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.found?.stream.name ?? "Stream"} · Exam Revision Planner`,
      },
    ],
  }),
  component: StreamPage,
});

const fields = [
  { name: "name", label: "Name" },
  { name: "coefficient", label: "Coefficient", type: "number" as const },
  { name: "isLanguage", label: "Language subject", type: "checkbox" as const },
];

function StreamPage() {
  const { canEdit, found } = Route.useLoaderData();
  const editor = useEditor();
  const back = <BackLink to="/curriculum">Curriculum</BackLink>;
  if (!found) {
    return (
      <Page>
        <PageHeader title="Stream not found" backLink={back} />
      </Page>
    );
  }
  const { stream, subjects } = found;
  const save = (id?: string) => (v: Record<string, string | boolean>) =>
    saveSubject({
      data: {
        id,
        streamId: stream.id,
        name: String(v.name),
        coefficient: Number(v.coefficient),
        isLanguage: v.isLanguage === true,
      },
    });

  return (
    <Page>
      <PageHeader
        title={stream.name}
        backLink={back}
        actions={
          canEdit ? (
            <Button
              onClick={() =>
                editor.open({
                  title: "New subject",
                  fields,
                  initial: { coefficient: "1" },
                  save: save(),
                })
              }
            >
              New subject
            </Button>
          ) : null
        }
      />
      {subjects.length === 0 ? (
        <EmptyState title="No subjects yet" />
      ) : (
        <ul className={`${panel} divide-y divide-border`}>
          {subjects.map((s) => (
            <ListRow key={s.id} testId="subject-row">
              <Link
                to="/curriculum/subjects/$subjectId"
                params={{ subjectId: s.id }}
                className="min-w-0 flex-1 font-medium hover:underline"
              >
                {s.name}
              </Link>
              {s.isLanguage ? (
                <Badge variant="secondary">Language</Badge>
              ) : null}
              <span className="text-muted-foreground">
                Coefficient {s.coefficient}
              </span>
              <span className="hidden text-muted-foreground sm:inline">
                {plural(s.units, "unit")}
              </span>
              {canEdit ? (
                <RowActions
                  name={s.name}
                  onEdit={() =>
                    editor.open({
                      title: "Edit subject",
                      fields,
                      initial: {
                        name: s.name,
                        coefficient: String(s.coefficient),
                        isLanguage: s.isLanguage,
                      },
                      save: save(s.id),
                    })
                  }
                  onDelete={() =>
                    editor.remove({
                      type: "subject",
                      id: s.id,
                      name: s.name,
                      consequence:
                        "Its units, chapters, cards, exercises and papers are deleted too.",
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
