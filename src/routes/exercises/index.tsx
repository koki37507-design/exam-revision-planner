import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { EmptyState } from "@/client/components/EmptyState";
import { Page, Section, panel } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StateBadge";
import { Button } from "@/client/components/ui/button";
import { getExercises } from "@/serverFunctions/exercises";

export const Route = createFileRoute("/exercises/")({
  validateSearch: z.object({ chapter: z.string().uuid().optional() }),
  loaderDeps: ({ search }) => ({ chapter: search.chapter }),
  loader: ({ deps }) => getExercises({ data: { chapterId: deps.chapter } }),
  head: () => ({ meta: [{ title: "Exercises · Exam Revision Planner" }] }),
  component: ExercisesPage,
});

type Item = {
  id: string;
  title: string;
  status: "solved" | "partial" | "stuck" | "skipped" | null;
};

function ItemList({ items }: { items: Item[] }) {
  return (
    <ul className={`${panel} divide-y divide-border`}>
      {items.map((item) => (
        <li
          key={item.id}
          data-testid="exercise-link"
          className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
        >
          <Link
            to="/exercises/$exerciseId"
            params={{ exerciseId: item.id }}
            className="min-w-0 flex-1 truncate hover:underline"
          >
            {item.title}
          </Link>
          <StatusBadge status={item.status} />
        </li>
      ))}
    </ul>
  );
}

function ExercisesPage() {
  const { profile, subjects } = Route.useLoaderData();
  const { chapter } = Route.useSearch();

  if (!profile) {
    return (
      <Page>
        <PageHeader title="Exercises" />
        <EmptyState
          title="Set up your study profile"
          action={
            <Button render={<Link to="/profile" />}>Set up profile</Button>
          }
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Exercises"
        description={profile.streamName}
        actions={
          chapter ? (
            <Button variant="outline" render={<Link to="/exercises" />}>
              All chapters
            </Button>
          ) : null
        }
      />
      {subjects.length === 0 ? (
        <EmptyState title="No exercises yet" />
      ) : (
        subjects.map((subject) => (
          <Section key={subject.id} title={subject.name}>
            {subject.chapters.map((c) => (
              <div key={c.id} className="space-y-2">
                <h3 className="text-sm font-medium">
                  {c.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {c.unitName}
                  </span>
                </h3>
                <ItemList items={c.exercises} />
              </div>
            ))}
            {subject.papers.length > 0 && !chapter ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Exam papers</h3>
                <ItemList items={subject.papers} />
              </div>
            ) : null}
          </Section>
        ))
      )}
    </Page>
  );
}
