import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Section, panel } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { RowActions, useEditor } from "@/client/components/useEditor";
import { Button } from "@/client/components/ui/button";
import {
  getChapter,
  saveCard,
  saveExercise,
} from "@/serverFunctions/curriculum";

export const Route = createFileRoute("/curriculum/chapters/$chapterId")({
  loader: ({ params }) => getChapter({ data: { id: params.chapterId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.found?.chapter.name ?? "Chapter"} · Exam Revision Planner`,
      },
    ],
  }),
  component: ChapterPage,
});

const cardFields = [
  { name: "front", label: "Front", type: "textarea" as const },
  { name: "back", label: "Back", type: "textarea" as const },
];
const exerciseFields = [
  { name: "title", label: "Title" },
  { name: "statement", label: "Statement", type: "textarea" as const },
  {
    name: "solution",
    label: "Solution",
    type: "textarea" as const,
    required: false,
  },
];

function ChapterPage() {
  const { canEdit, found } = Route.useLoaderData();
  const editor = useEditor();
  if (!found) {
    return (
      <Page>
        <PageHeader
          title="Chapter not found"
          backLink={<BackLink to="/curriculum">Curriculum</BackLink>}
        />
      </Page>
    );
  }
  const { chapter, unit, subject, cards, exercises } = found;
  const card = (id?: string) => (v: Record<string, string | boolean>) =>
    saveCard({
      data: {
        id,
        chapterId: chapter.id,
        front: String(v.front),
        back: String(v.back),
      },
    });
  const exercise = (id?: string) => (v: Record<string, string | boolean>) =>
    saveExercise({
      data: {
        id,
        kind: "exercise",
        parentId: chapter.id,
        title: String(v.title),
        statement: String(v.statement),
        solution: String(v.solution ?? ""),
      },
    });

  return (
    <Page>
      <PageHeader
        title={chapter.name}
        backLink={
          <BackLink
            to="/curriculum/subjects/$subjectId"
            params={{ subjectId: subject.id }}
          >
            {subject.name}
          </BackLink>
        }
        description={unit.name}
      />
      <Section
        title={`Cards (${cards.length})`}
        actions={
          canEdit ? (
            <Button
              size="sm"
              onClick={() =>
                editor.open({
                  title: "New card",
                  fields: cardFields,
                  save: card(),
                })
              }
            >
              New card
            </Button>
          ) : null
        }
      >
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cards yet.</p>
        ) : (
          <ul className={`${panel} divide-y divide-border`}>
            {cards.map((c) => (
              <li
                key={c.id}
                data-testid="card-row"
                className="flex items-start gap-3 px-4 py-2.5 text-sm"
              >
                <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2 sm:gap-4">
                  <p className="font-medium whitespace-pre-wrap">{c.front}</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {c.back}
                  </p>
                </div>
                {canEdit ? (
                  <RowActions
                    name={c.front}
                    onEdit={() =>
                      editor.open({
                        title: "Edit card",
                        fields: cardFields,
                        initial: { front: c.front, back: c.back },
                        save: card(c.id),
                      })
                    }
                    onDelete={() =>
                      editor.remove({
                        type: "card",
                        id: c.id,
                        name: "this card",
                      })
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section
        title={`Exercises (${exercises.length})`}
        actions={
          canEdit ? (
            <Button
              size="sm"
              onClick={() =>
                editor.open({
                  title: "New exercise",
                  fields: exerciseFields,
                  save: exercise(),
                })
              }
            >
              New exercise
            </Button>
          ) : null
        }
      >
        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exercises yet.</p>
        ) : (
          <ul className={`${panel} divide-y divide-border`}>
            {exercises.map((e) => (
              <li
                key={e.id}
                data-testid="exercise-row"
                className="flex items-start gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to="/exercises/$exerciseId"
                    params={{ exerciseId: e.id }}
                    className="font-medium hover:underline"
                  >
                    {e.title}
                  </Link>
                  <p className="line-clamp-2 text-muted-foreground">
                    {e.statement}
                  </p>
                </div>
                {canEdit ? (
                  <RowActions
                    name={e.title}
                    onEdit={() =>
                      editor.open({
                        title: "Edit exercise",
                        fields: exerciseFields,
                        initial: {
                          title: e.title,
                          statement: e.statement,
                          solution: e.solution ?? "",
                        },
                        save: exercise(e.id),
                      })
                    }
                    onDelete={() =>
                      editor.remove({
                        type: "exercise",
                        id: e.id,
                        name: e.title,
                      })
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {editor.element}
    </Page>
  );
}
