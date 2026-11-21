import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { Page, Section, panel } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import {
  StatusBadge,
  statusLabel,
  type AttemptStatus,
} from "@/client/components/StateBadge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";
import { useAction } from "@/client/lib/useAction";
import { getExercise, logAttempt } from "@/serverFunctions/exercises";

export const Route = createFileRoute("/exercises/$exerciseId")({
  loader: ({ params }) => getExercise({ data: { id: params.exerciseId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.exercise.title ?? "Exercise"} · Exam Revision Planner`,
      },
    ],
  }),
  component: ExercisePage,
});

const STATUSES: AttemptStatus[] = ["solved", "partial", "stuck", "skipped"];

function ExercisePage() {
  const found = Route.useLoaderData();
  const [showSolution, setShowSolution] = useState(false);
  const [status, setStatus] = useState<AttemptStatus>("solved");
  const [minutes, setMinutes] = useState("");
  const { run, pending } = useAction();
  const back = <BackLink to="/exercises">Exercises</BackLink>;

  if (!found) {
    return (
      <Page>
        <PageHeader title="Exercise not found" backLink={back} />
        <EmptyState title="This exercise no longer exists" />
      </Page>
    );
  }
  const { exercise, attempts } = found;
  const latest = attempts[0]?.status ?? null;

  return (
    <Page>
      <PageHeader
        title={exercise.title}
        backLink={back}
        description={[
          exercise.subjectName,
          exercise.chapterName ?? "Exam paper",
        ].join(" · ")}
        actions={<StatusBadge status={latest} data-testid="latest-status" />}
      />
      <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
        <p className="whitespace-pre-wrap" data-testid="statement">
          {exercise.statement}
        </p>
        {exercise.solution ? (
          showSolution ? (
            <div className="space-y-1 border-t border-border pt-4">
              <p className="text-sm font-medium">Solution</p>
              <p
                className="whitespace-pre-wrap text-muted-foreground"
                data-testid="solution"
              >
                {exercise.solution}
              </p>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowSolution(true)}>
              Show solution
            </Button>
          )
        ) : null}
      </div>
      <Section title="Log an attempt">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              logAttempt({
                data: {
                  exerciseId: exercise.id,
                  status,
                  minutes: Number(minutes || 0),
                },
              }),
            ).then(() => setMinutes(""));
          }}
        >
          <ToggleGroup
            value={[status]}
            onValueChange={(value: string[]) =>
              value[0] && setStatus(value[0] as AttemptStatus)
            }
            variant="outline"
            aria-label="Result"
          >
            {STATUSES.map((s) => (
              <ToggleGroupItem key={s} value={s} data-testid={`status-${s}`}>
                {statusLabel(s)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="space-y-1.5">
            <Label htmlFor="minutes">Minutes</Label>
            <Input
              id="minutes"
              type="number"
              min={0}
              max={600}
              className="w-24"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <Button type="submit" pending={pending}>
            Log attempt
          </Button>
        </form>
      </Section>
      <Section title="Attempts">
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attempts yet.</p>
        ) : (
          <ul className={`${panel} divide-y divide-border`}>
            {attempts.map((a) => (
              <li
                key={a.id}
                data-testid="attempt"
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="text-muted-foreground">
                  {new Date(`${a.createdAt.replace(" ", "T")}Z`).toLocaleString(
                    "en-GB",
                    { dateStyle: "medium", timeStyle: "short" },
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-muted-foreground">
                    {a.minutes} min
                  </span>
                  <StatusBadge status={a.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}
