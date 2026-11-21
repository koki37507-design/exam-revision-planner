import { Link } from "@tanstack/react-router";
import { panel } from "@/client/components/Page";
import { StateBadge } from "@/client/components/StateBadge";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { formatDay } from "@/client/lib/format";

interface TaskView {
  id: string;
  date: string;
  kind: "cards" | "exercises" | "paper" | "review";
  minutes: number;
  subjectName: string;
  chapterId: string | null;
  chapterName: string | null;
  carriedFrom: string | null;
  state: "pending" | "done" | "partial" | "missed";
}

const KIND_LABEL = {
  cards: "Flashcards",
  exercises: "Exercises",
  paper: "Exam paper",
  review: "Review",
} as const;

/** Where a task's work is done. */
function TaskLink({ task }: { task: TaskView }) {
  const button = (to: React.ReactElement) => (
    <Button size="sm" variant="outline" render={to}>
      Start
    </Button>
  );
  if (task.kind === "cards") return button(<Link to="/cards/session" />);
  if (task.kind === "paper") return button(<Link to="/exercises" />);
  return button(
    <Link to="/exercises" search={{ chapter: task.chapterId ?? undefined }} />,
  );
}

export function TaskList({
  tasks,
  compact = false,
}: {
  tasks: TaskView[];
  compact?: boolean;
}) {
  return (
    <ul className={`${panel} divide-y divide-border`}>
      {tasks.map((task) => (
        <li
          key={task.id}
          data-testid="task"
          data-kind={task.kind}
          data-state={task.state}
          data-chapter={task.chapterName ?? ""}
          data-carried={task.carriedFrom ? "true" : "false"}
          className={
            compact
              ? "space-y-1 px-3 py-2"
              : "flex flex-wrap items-center gap-3 px-4 py-3"
          }
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {KIND_LABEL[task.kind]} · {task.subjectName}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {task.chapterName ? `${task.chapterName} · ` : ""}
              {task.minutes} min
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {task.carriedFrom ? (
              <Badge
                variant="outline"
                title={`From ${formatDay(task.carriedFrom)}`}
              >
                Overdue
              </Badge>
            ) : null}
            <StateBadge state={task.state} />
            {!compact && task.state !== "done" && task.state !== "missed" ? (
              <TaskLink task={task} />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
