import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { Page, panel } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { plural } from "@/client/lib/format";
import { getReviewList } from "@/serverFunctions/exercises";

export const Route = createFileRoute("/review")({
  loader: () => getReviewList(),
  head: () => ({ meta: [{ title: "Review · Exam Revision Planner" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const chapters = Route.useLoaderData();
  return (
    <Page>
      <PageHeader title="Review" />
      {chapters.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="Chapters appear here after a stuck or partial attempt, or a card rated Again."
        />
      ) : (
        <ul className={`${panel} divide-y divide-border`}>
          {chapters.map((c) => (
            <li
              key={c.chapterId}
              data-testid="review-row"
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.chapterName}</p>
                <p className="text-sm text-muted-foreground">
                  {c.subjectName} · {c.unitName}
                </p>
              </div>
              <p className="text-sm tabular-nums text-muted-foreground">
                {[
                  c.stuck && `${c.stuck} stuck`,
                  c.partial && `${c.partial} partial`,
                  c.lapses && plural(c.lapses, "lapse"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <Button
                size="sm"
                variant="outline"
                render={
                  <Link to="/exercises" search={{ chapter: c.chapterId }} />
                }
              >
                Exercises
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
