import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { Page, Section, panel } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { plural } from "@/client/lib/format";
import { useAction } from "@/client/lib/useAction";
import { getCards, saveChapters } from "@/serverFunctions/study";

export const Route = createFileRoute("/cards/")({
  loader: () => getCards(),
  head: () => ({ meta: [{ title: "Cards · Exam Revision Planner" }] }),
  component: CardsPage,
});

function CardsPage() {
  const { profile, chapters, session } = Route.useLoaderData();
  const [picked, setPicked] = useState(
    () => new Set(chapters.filter((c) => c.selected).map((c) => c.chapterId)),
  );
  const { run, pending } = useAction();

  if (!profile || !session) {
    return (
      <Page>
        <PageHeader title="Cards" />
        <EmptyState
          title="Set up your study profile"
          action={
            <Button render={<Link to="/profile" />}>Set up profile</Button>
          }
        />
      </Page>
    );
  }

  const due = session.overdue + session.dueToday;
  const queued = due + session.fresh;
  const subjects = [...new Set(chapters.map((c) => c.subjectName))];
  const changed =
    picked.size !== chapters.filter((c) => c.selected).length ||
    chapters.some((c) => c.selected !== picked.has(c.chapterId));

  return (
    <Page>
      <PageHeader
        title="Cards"
        description={`${plural(profile.daysLeft, "day")} until the exam`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <p className="text-sm" data-testid="due-summary">
          <span className="font-medium">Today:</span> {due} due
          {session.overdue ? ` (${session.overdue} overdue)` : ""} ·{" "}
          {session.fresh} new
        </p>
        {queued > 0 ? (
          <Button render={<Link to="/cards/session" />}>Start session</Button>
        ) : null}
      </div>
      <Section
        title="Chapters to study"
        actions={
          <Button
            variant="outline"
            size="sm"
            pending={pending}
            disabled={!changed}
            onClick={() =>
              run(() => saveChapters({ data: { chapterIds: [...picked] } }))
            }
          >
            Save chapters
          </Button>
        }
      >
        {chapters.length === 0 ? (
          <EmptyState title="No cards in this stream yet" />
        ) : (
          subjects.map((subject) => (
            <div key={subject} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {subject}
              </h3>
              <ul className={`${panel} divide-y divide-border`}>
                {chapters
                  .filter((c) => c.subjectName === subject)
                  .map((c) => (
                    <li key={c.chapterId}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm">
                        <Checkbox
                          checked={picked.has(c.chapterId)}
                          onCheckedChange={(checked) =>
                            setPicked((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(c.chapterId);
                              else next.delete(c.chapterId);
                              return next;
                            })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          {c.chapterName}
                          <span className="text-muted-foreground">
                            {" "}
                            · {c.unitName}
                          </span>
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {plural(c.cards, "card")}
                        </span>
                      </label>
                    </li>
                  ))}
              </ul>
            </div>
          ))
        )}
      </Section>
    </Page>
  );
}
