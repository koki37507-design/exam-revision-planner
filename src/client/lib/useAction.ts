import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export function messageOf(cause: unknown): string {
  if (cause instanceof Error) {
    // Validation errors arrive as zod's JSON list of issues.
    try {
      const issues = JSON.parse(cause.message) as { message?: string }[];
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      // Not JSON: the message as written.
    }
    return cause.message;
  }
  return "That didn't work. Try again.";
}

/** Runs a change, reloads the page's data, and shows a failure as a toast. */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    setPending(true);
    try {
      const result = await work();
      await router.invalidate();
      return result;
    } catch (cause) {
      toast.error(messageOf(cause));
      return undefined;
    } finally {
      setPending(false);
    }
  }
  return { run, pending };
}
