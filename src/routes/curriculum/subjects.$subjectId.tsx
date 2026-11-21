import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { Page, Section, panel } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { ListRow, RowActions, useEditor } from "@/client/components/useEditor";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { plural } from "@/client/lib/format";
import {
  getSubject,
  saveChapter,
  saveExercise,
  saveUnit,
} from "@/serverFunctions/curriculum";

export const Route = createFileRoute("/curriculum/subjects/$subjectId")({
  loader: ({ params }) => getSubject({ data: { id: params.subjectId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.found?.subject.name ?? "Subject"} · Exam Revision Planner`,
      },
    ],
  }),
  component: SubjectPage,
});

const nameField = [{ name: "name", label: "Name" }];
const paperFields = [
  { name: "title", label: "Title" },
  { name: "statement", label: "Statement", type: "textarea" as const },
  {
    name: "solution",
    label: "Solution",
    type: "textarea" as const,
    required: false,
  },
];

function SubjectPage() {
  const { canEdit, found } = Route.useLoaderData();
  const editor = useEditor();
  if (!found) {
    return (
      <Page>
        <PageHeader
          title="Subject not found"
          backLink={<BackLink to="/curriculum">Curriculum</BackLink>}
        />
      </Page>
    );
  }
  const { stream, subject, units, papers } = found;
  const savePaper = (id?: string) => (v: Record<string, string | boolean>) =>
    saveExercise({
      data: {
        id,
        kind: "paper",
        parentId: subject.id,
        title: String(v.title),
        statement: String(v.statement),
        solution: String(v.solution ?? ""),
      },
    });

  return (
    <Page>
      <PageHeader
        title={subject.name}
        backLink={
          <BackLink
            to="/curriculum/streams/$streamId"
            params={{ streamId: stream.id }}
          >
            {stream.name}
          </BackLink>
        }
        description={
          <span className="inline-flex items-center gap-2">
            Coefficient {subject.coefficient}
            {subject.isLanguage ? (
              <Badge variant="secondary">Language</Badge>
            ) : null}
          </span>
        }
        actions={
          canEdit ? (
            <>
              <Button
                onClick={() =>
                  editor.open({
                    title: "New unit",
                    fields: nameField,
                    save: (v) =>
                      saveUnit({
                        data: { subjectId: subject.id, name: String(v.name) },
                      }),
                  })
                }
              >
                New unit
              </Button>
              {subject.isLanguage ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    editor.open({
                      title: "New exam paper",
                      fields: paperFields,
                      save: savePaper(),
                    })
                  }
                >
                  New paper
                </Button>
              ) : null}
            </>
          ) : null
        }
      />
      {units.length === 0 && !subject.isLanguage ? (
        <EmptyState title="No units yet" />
      ) : null}
      {units.map((unit) => (
        <Section
          key={unit.id}
          title={unit.name}
          actions={
            canEdit ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`New chapter in ${unit.name}`}
                  onClick={() =>
                    editor.open({
                      title: "New chapter",
                      fields: nameField,
                      save: (v) =>
                        saveChapter({
                          data: { unitId: unit.id, name: String(v.name) },
                        }),
                    })
                  }
                >
                  <Plus /> Chapter
                </Button>
                <RowActions
                  name={unit.name}
                  onEdit={() =>
                    editor.open({
                      title: "Edit unit",
                      fields: nameField,
                      initial: { name: unit.name },
                      save: (v) =>
                        saveUnit({
                          data: {
                            id: unit.id,
                            subjectId: subject.id,
                            name: String(v.name),
                          },
                        }),
                    })
                  }
                  onDelete={() =>
                    editor.remove({
                      type: "unit",
                      id: unit.id,
                      name: unit.name,
                      consequence:
                        "Its chapters, cards and exercises are deleted too.",
                    })
                  }
                />
              </>
            ) : null
          }
        >
          {unit.chapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chapters yet.</p>
          ) : (
            <ul className={`${panel} divide-y divide-border`}>
              {unit.chapters.map((c) => (
                <ListRow key={c.id} testId="chapter-row">
                  <Link
                    to="/curriculum/chapters/$chapterId"
                    params={{ chapterId: c.id }}
                    className="min-w-0 flex-1 font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">
                    {plural(c.cards, "card")} ·{" "}
                    {plural(c.exercises, "exercise")}
                  </span>
                  {canEdit ? (
                    <RowActions
                      name={c.name}
                      onEdit={() =>
                        editor.open({
                          title: "Edit chapter",
                          fields: nameField,
                          initial: { name: c.name },
                          save: (v) =>
                            saveChapter({
                              data: {
                                id: c.id,
                                unitId: unit.id,
                                name: String(v.name),
                              },
                            }),
                        })
                      }
                      onDelete={() =>
                        editor.remove({
                          type: "chapter",
                          id: c.id,
                          name: c.name,
                          consequence:
                            "Its cards and exercises are deleted too.",
                        })
                      }
                    />
                  ) : null}
                </ListRow>
              ))}
            </ul>
          )}
        </Section>
      ))}
      {subject.isLanguage ? (
        <Section title="Exam papers">
          {papers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No papers yet.</p>
          ) : (
            <ul className={`${panel} divide-y divide-border`}>
              {papers.map((p) => (
                <ListRow key={p.id} testId="paper-row">
                  <Link
                    to="/exercises/$exerciseId"
                    params={{ exerciseId: p.id }}
                    className="min-w-0 flex-1 font-medium hover:underline"
                  >
                    {p.title}
                  </Link>
                  {canEdit ? (
                    <RowActions
                      name={p.title}
                      onEdit={() =>
                        editor.open({
                          title: "Edit exam paper",
                          fields: paperFields,
                          initial: {
                            title: p.title,
                            statement: p.statement,
                            solution: p.solution ?? "",
                          },
                          save: savePaper(p.id),
                        })
                      }
                      onDelete={() =>
                        editor.remove({
                          type: "exercise",
                          id: p.id,
                          name: p.title,
                        })
                      }
                    />
                  ) : null}
                </ListRow>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
      {editor.element}
    </Page>
  );
}
