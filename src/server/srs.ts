import { addDays } from "./dates";

export const ratings = ["again", "hard", "good", "easy"] as const;
type Rating = (typeof ratings)[number];

interface ReviewState {
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
}

export const NEW_CARD: ReviewState = {
  intervalDays: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
};

const MIN_EASE = 1.3;

/** The card's next state after a rating, and the day it is due again. */
export function review(
  prev: ReviewState,
  rating: Rating,
  today: string,
): ReviewState & { due: string } {
  let { intervalDays, ease, reps, lapses } = prev;
  switch (rating) {
    case "again":
      reps = 0;
      lapses += 1;
      ease = Math.max(MIN_EASE, ease - 0.2);
      intervalDays = 1;
      break;
    case "hard":
      intervalDays =
        reps === 0 ? 1 : Math.max(1, Math.round(intervalDays * 1.2));
      ease = Math.max(MIN_EASE, ease - 0.15);
      reps += 1;
      break;
    case "good":
      intervalDays =
        reps === 0 ? 1 : reps === 1 ? 3 : Math.round(intervalDays * ease);
      reps += 1;
      break;
    case "easy":
      intervalDays =
        reps === 0
          ? 4
          : Math.max(intervalDays + 1, Math.round(intervalDays * ease * 1.3));
      ease += 0.15;
      reps += 1;
      break;
  }
  ease = Math.round(ease * 100) / 100;
  return {
    intervalDays,
    ease,
    reps,
    lapses,
    due: addDays(today, intervalDays),
  };
}
