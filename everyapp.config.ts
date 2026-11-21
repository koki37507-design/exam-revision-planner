import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "exam-revision-planner",
  name: "Exam Revision Planner",
  description:
    "Plans daily revision up to an exam, with flashcards, exercises and study groups.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
  },
});
