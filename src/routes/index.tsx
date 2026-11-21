import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { Page, Section } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { TaskList } from "@/client/components/TaskList";
import { Button } from "@/client/components/ui/button";
import { Progress } from "@/client/components/ui/progress";
import { formatDay, plural } from "@/client/lib/format";
import { getToday } from "@/serverFunctions/profile";

export const Route = createFileRoute("/")({
  loader: () => getToday(),
  head: () => ({ meta: [{ title: "Today · Exam Revision Planner" }] }),
  component: Today,
});

function Today() {
  const { profile, plan, today } = Route.useLoaderData();

  if (!profile || !plan) {
    return (
      <Page>
        <PageHeader title="Today" />
        <div data-testid="setup-prompt">
          <EmptyState
            icon={CalendarCheck}
            title="Set up your study profile"
            description="Pick your stream, exam date and study time, and your daily plan appears here."
            action={
              <Button render={<Link to="/profile" />}>Set up profile</Button>
            }
          />
        </div>
      </Page>
    );
  }

  const total = plan.tasks.length;
  return (
    <Page>
      <PageHeader
        title="Today"
        description={`${formatDay(today)} · ${profile.streamName}`}
        actions={
          <Button variant="outline" render={<Link to="/profile" />}>
            Edit profile
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Until the exam"
          testId="countdown"
          value={plural(profile.daysLeft, "day")}
        />
        <Stat label="Done" testId="progress" value={`${plan.done} / ${total}`}>
          <Progress
            value={total ? (plan.done / total) * 100 : 0}
            aria-label="Today's progress"
            className="mt-2"
          />
        </Stat>
        <Stat label="Planned time" value={`${plan.totalMinutes} min`} />
        <Stat
          label="Streak"
          testId="streak"
          value={plural(plan.streak, "day")}
        />
      </div>
      <Section title="Tasks">
        {total === 0 ? (
          <EmptyState title="Rest day" />
        ) : (
          <TaskList tasks={plan.tasks} />
        )}
      </Section>
    </Page>
  );
}

function Stat({
  label,
  value,
  testId,
  children,
}: {
  label: string;
  value: string;
  testId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums" data-testid={testId}>
        {value}
      </p>
      {children}
    </div>
  );
}
