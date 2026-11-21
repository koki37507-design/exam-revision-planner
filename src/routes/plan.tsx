import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import { EmptyState } from "@/client/components/EmptyState";
import { Page, Section } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { TaskList } from "@/client/components/TaskList";
import { Button } from "@/client/components/ui/button";
import { Progress } from "@/client/components/ui/progress";
import { formatDay, plural } from "@/client/lib/format";
import { useAction } from "@/client/lib/useAction";
import { getWeek, regenerate } from "@/serverFunctions/plan";

export const Route = createFileRoute("/plan")({
  validateSearch: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: ({ deps }) => getWeek({ data: { date: deps.date } }),
  head: () => ({ meta: [{ title: "Plan · Exam Revision Planner" }] }),
  component: PlanPage,
});

function shift(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function PlanPage() {
  const { profile, week, today } = Route.useLoaderData();
  const { run, pending } = useAction();

  if (!profile || !week) {
    return (
      <Page>
        <PageHeader title="Plan" />
        <EmptyState
          title="No plan yet"
          description="Your plan is made from your study profile."
          action={
            <Button render={<Link to="/profile" />}>Set up profile</Button>
          }
        />
      </Page>
    );
  }

  const { done, total } = week.overall;
  return (
    <Page>
      <PageHeader
        title="Plan"
        description={`${plural(profile.daysLeft, "day")} until the exam`}
        actions={
          <Button
            variant="outline"
            pending={pending}
            onClick={() => run(() => regenerate())}
          >
            Regenerate plan
          </Button>
        }
      />
      <div className="space-y-2 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Whole plan</span>
          <span
            className="tabular-nums text-muted-foreground"
            data-testid="overall-progress"
          >
            {done} of {total} tasks done
          </span>
        </div>
        <Progress
          value={total ? (done / total) * 100 : 0}
          aria-label="Whole plan progress"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          render={<Link to="/plan" search={{ date: shift(week.start, -7) }} />}
        >
          <ChevronLeft /> Previous week
        </Button>
        <span className="text-sm text-muted-foreground">
          {formatDay(week.start)} – {formatDay(shift(week.start, 6))}
        </span>
        <Button
          variant="ghost"
          size="sm"
          render={<Link to="/plan" search={{ date: shift(week.start, 7) }} />}
        >
          Next week <ChevronRight />
        </Button>
      </div>
      <div className="space-y-6">
        {week.days.map((day) => {
          const finished = day.tasks.filter((t) => t.state === "done").length;
          return (
            <div key={day.date} data-testid="plan-day" data-date={day.date}>
              <Section
                title={
                  <>
                    {formatDay(day.date)}
                    {day.date === today ? (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        Today
                      </span>
                    ) : null}
                  </>
                }
                actions={
                  day.tasks.length ? (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {finished} / {day.tasks.length} ·{" "}
                      {day.tasks.reduce((s, t) => s + t.minutes, 0)} min
                    </span>
                  ) : null
                }
              >
                {day.tasks.length ? (
                  <TaskList tasks={day.tasks} compact />
                ) : (
                  <p className="text-sm text-muted-foreground">Rest day</p>
                )}
              </Section>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
