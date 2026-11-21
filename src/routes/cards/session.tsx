import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { Page } from "@/client/components/Page";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Progress } from "@/client/components/ui/progress";
import { plural } from "@/client/lib/format";
import { messageOf } from "@/client/lib/useAction";
import { getSession, rateCard } from "@/serverFunctions/study";
import { toast } from "sonner";

export const Route = createFileRoute("/cards/session")({
  loader: () => getSession(),
  // The queue is fixed when the session starts; a revisit builds a new one.
  staleTime: Infinity,
  shouldReload: false,
  head: () => ({ meta: [{ title: "Study session · Exam Revision Planner" }] }),
  component: SessionPage,
});

const RATINGS = [
  { rating: "again", label: "Again", variant: "destructive" },
  { rating: "hard", label: "Hard", variant: "outline" },
  { rating: "good", label: "Good", variant: "default" },
  { rating: "easy", label: "Easy", variant: "secondary" },
] as const;

function SessionPage() {
  const queue = Route.useLoaderData();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const card = queue[index];
  const header = (
    <PageHeader
      title="Study session"
      backLink={<BackLink to="/cards">Cards</BackLink>}
      description={card ? `${index + 1} of ${queue.length}` : undefined}
    />
  );

  if (queue.length === 0) {
    return (
      <Page>
        {header}
        <EmptyState
          title="Nothing to study today"
          description="Choose chapters on the Cards page, or come back when cards are due."
        />
      </Page>
    );
  }

  if (!card) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return (
      <Page>
        {header}
        <div data-testid="session-done">
          <EmptyState
            title="Session complete"
            description={`${plural(queue.length, "card")} reviewed in ${plural(minutes, "minute")}.`}
            action={<Button render={<Link to="/" />}>Back to today</Button>}
          />
        </div>
      </Page>
    );
  }

  async function rate(rating: (typeof RATINGS)[number]["rating"]) {
    const spent = Math.round((Date.now() - shownAt.current) / 1000);
    setPending(true);
    try {
      await rateCard({
        data: { cardId: card!.id, rating, seconds: Math.min(3600, spent) },
      });
      setSeconds((s) => s + Math.min(300, Math.max(1, spent)));
      setRevealed(false);
      setIndex((i) => i + 1);
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Page>
      {header}
      <Progress
        value={(index / queue.length) * 100}
        aria-label="Session progress"
      />
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <p className="text-lg whitespace-pre-wrap" data-testid="card-front">
          {card.front}
        </p>
        {revealed ? (
          <p
            className="border-t border-border pt-4 whitespace-pre-wrap text-muted-foreground"
            data-testid="card-back"
          >
            {card.back}
          </p>
        ) : null}
      </div>
      {revealed ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((r) => (
            <Button
              key={r.rating}
              variant={r.variant}
              disabled={pending}
              onClick={() => rate(r.rating)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      ) : (
        <Button className="w-full" onClick={() => setRevealed(true)}>
          Show answer
        </Button>
      )}
    </Page>
  );
}
