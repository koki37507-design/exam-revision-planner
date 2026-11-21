import { describe, expect, it } from "vitest";
import { NEW_CARD, review } from "./srs";

describe("review", () => {
  it("schedules a new card by rating", () => {
    expect(review(NEW_CARD, "good", "2026-01-10").due).toBe("2026-01-11");
    expect(review(NEW_CARD, "easy", "2026-01-10").due).toBe("2026-01-14");
  });

  it("grows the interval with ease on repeated good ratings", () => {
    const first = review(NEW_CARD, "good", "2026-01-10");
    const second = review(first, "good", "2026-01-11");
    const third = review(second, "good", "2026-01-14");
    expect(second.intervalDays).toBe(3);
    expect(third.intervalDays).toBe(8);
  });

  it("resets on again and counts a lapse", () => {
    const first = review(NEW_CARD, "good", "2026-01-10");
    const learned = review(first, "good", "2026-01-11");
    const lapsed = review(learned, "again", "2026-01-14");
    expect(lapsed.reps).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.intervalDays).toBe(1);
    expect(lapsed.ease).toBeLessThan(learned.ease);
  });
});
