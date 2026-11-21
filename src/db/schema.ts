import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);

// People the Gateway signed in, keyed by its user id.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

// The curriculum, shared by every member and edited by admins only.
export const streams = sqliteTable("streams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const subjects = sqliteTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    streamId: text("stream_id")
      .notNull()
      .references(() => streams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    coefficient: integer("coefficient").notNull().default(1),
    isLanguage: integer("is_language", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: createdAt(),
  },
  (t) => [index("subjects_stream").on(t.streamId)],
);

export const units = sqliteTable(
  "units",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("units_subject").on(t.subjectId)],
);

export const chapters = sqliteTable(
  "chapters",
  {
    id: text("id").primaryKey(),
    unitId: text("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chapters_unit").on(t.unitId)],
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("cards_chapter").on(t.chapterId)],
);

// Exercises belong to a chapter; exam papers to a language subject.
export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["exercise", "paper"] }).notNull(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chapters.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    statement: text("statement").notNull(),
    solution: text("solution"),
    createdAt: createdAt(),
  },
  (t) => [
    index("exercises_chapter").on(t.chapterId),
    index("exercises_subject").on(t.subjectId),
  ],
);

// Each member's own study data, keyed by user id.
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  streamId: text("stream_id")
    .notNull()
    .references(() => streams.id, { onDelete: "cascade" }),
  examDate: text("exam_date").notNull(),
  weeklyHours: integer("weekly_hours").notNull(),
  daysPerWeek: integer("days_per_week").notNull(),
  useCards: integer("use_cards", { mode: "boolean" }).notNull(),
  useExercises: integer("use_exercises", { mode: "boolean" }).notNull(),
  usePapers: integer("use_papers", { mode: "boolean" }).notNull(),
  newCardsPerDay: integer("new_cards_per_day").notNull(),
  // The last day missed tasks were carried forward.
  rolledOn: text("rolled_on"),
  updatedAt: createdAt(),
});

export const chapterSelections = sqliteTable(
  "chapter_selections",
  {
    userId: text("user_id").notNull(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.chapterId] })],
);

export const cardStates = sqliteTable(
  "card_states",
  {
    userId: text("user_id").notNull(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    intervalDays: integer("interval_days").notNull(),
    ease: real("ease").notNull(),
    reps: integer("reps").notNull(),
    lapses: integer("lapses").notNull(),
    due: text("due").notNull(),
    introducedOn: text("introduced_on").notNull(),
    lastReviewedOn: text("last_reviewed_on").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.cardId] }),
    index("card_states_due").on(t.userId, t.due),
  ],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["solved", "partial", "stuck", "skipped"],
    }).notNull(),
    minutes: integer("minutes").notNull(),
    day: text("day").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("attempts_user").on(t.userId, t.exerciseId)],
);

// What a member actually did, per day: the plan and the leaderboard read it.
export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    source: text("source", { enum: ["card", "exercise", "paper"] }).notNull(),
    subjectId: text("subject_id").notNull(),
    chapterId: text("chapter_id"),
    seconds: integer("seconds").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("activity_user_day").on(t.userId, t.day)],
);

export const planTasks = sqliteTable(
  "plan_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chapters.id, {
      onDelete: "cascade",
    }),
    kind: text("kind", {
      enum: ["cards", "exercises", "paper", "review"],
    }).notNull(),
    minutes: integer("minutes").notNull(),
    // Set on a task carried from a missed day: that day's date.
    carriedFrom: text("carried_from"),
    // Set on a missed task once it has been carried forward.
    rolled: integer("rolled", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("plan_tasks_user_date").on(t.userId, t.date)],
);

export const studyGroups = sqliteTable(
  "study_groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id").notNull(),
    joinCode: text("join_code").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("study_groups_code").on(t.joinCode)],
);

export const groupMembers = sqliteTable(
  "group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => studyGroups.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    joinedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("group_members_user").on(t.userId),
  ],
);
