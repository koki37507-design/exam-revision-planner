import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { plural } from "@/client/lib/format";
import { messageOf } from "@/client/lib/useAction";
import { getProfileForm, saveProfile } from "@/serverFunctions/profile";

export const Route = createFileRoute("/profile")({
  loader: () => getProfileForm(),
  head: () => ({ meta: [{ title: "Study profile · Exam Revision Planner" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, streams, today } = Route.useLoaderData();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    streamId: profile?.streamId ?? "",
    examDate: profile?.examDate ?? "",
    weeklyHours: String(profile?.weeklyHours ?? 10),
    daysPerWeek: String(profile?.daysPerWeek ?? 6),
    useCards: profile?.useCards ?? true,
    useExercises: profile?.useExercises ?? true,
    usePapers: profile?.usePapers ?? true,
    newCardsPerDay: String(profile?.newCardsPerDay ?? 15),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (streams.length === 0) {
    return (
      <Page>
        <PageHeader title="Study profile" />
        <EmptyState
          title="No streams yet"
          description="An admin adds streams and subjects under Curriculum first."
          action={
            <Button variant="outline" render={<Link to="/curriculum" />}>
              Open curriculum
            </Button>
          }
        />
      </Page>
    );
  }

  const number = (
    key: "weeklyHours" | "daysPerWeek" | "newCardsPerDay",
    label: string,
    min: number,
    max: number,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min={min}
        max={max}
        required
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <Page>
      <PageHeader
        title="Study profile"
        description={
          profile
            ? `${plural(profile.daysLeft, "day")} until the exam`
            : undefined
        }
      />
      <form
        className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-xs"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          try {
            await saveProfile({
              data: {
                streamId: form.streamId,
                examDate: form.examDate,
                weeklyHours: Number(form.weeklyHours),
                daysPerWeek: Number(form.daysPerWeek),
                useCards: form.useCards,
                useExercises: form.useExercises,
                usePapers: form.usePapers,
                newCardsPerDay: Number(form.newCardsPerDay),
              },
            });
            await navigate({ to: "/" });
          } catch (cause) {
            setError(messageOf(cause));
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Stream</Label>
            <Select
              items={streams.map((s) => ({ value: s.id, label: s.name }))}
              value={form.streamId || null}
              onValueChange={(value) => value && set("streamId", value)}
            >
              <SelectTrigger
                className="w-full"
                data-testid="stream-select"
                aria-label="Stream"
              >
                <SelectValue placeholder="Pick a stream" />
              </SelectTrigger>
              <SelectContent>
                {streams.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="examDate">Exam date</Label>
            <Input
              id="examDate"
              type="date"
              min={today}
              required
              value={form.examDate}
              onChange={(e) => set("examDate", e.target.value)}
            />
          </div>
          {number("weeklyHours", "Weekly study hours", 1, 80)}
          {number("daysPerWeek", "Study days per week", 1, 7)}
          {number("newCardsPerDay", "New cards per day", 0, 200)}
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">In the plan</legend>
          {(
            [
              ["useCards", "Flashcards"],
              ["useExercises", "Exercises"],
              ["usePapers", "Exam papers"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form[key]}
                onCheckedChange={(checked) => set(key, checked)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" pending={pending} disabled={!form.streamId}>
          Save profile
        </Button>
      </form>
    </Page>
  );
}
