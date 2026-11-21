# Exam Revision Planner

A study companion for a final exam: a daily revision plan counting down to exam day, spaced-repetition flashcards, an exercise tracker and study groups with a weekly leaderboard. Admins write the curriculum; each member studies it at their own pace.

Inspired by https://wafi-education.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Admins build the curriculum: streams, subjects with coefficients, units, chapters, flashcards, exercises and language exam papers; members browse it.
- Set your stream, exam date, weekly hours, study days and tools, and see the days left.
- Pick chapters and review a daily flashcard session rated again, hard, good or easy.
- Read exercises and past papers, reveal solutions, log attempts with time spent, and see weak chapters.
- Follow a dated plan weighted by subject coefficient and weak chapters, with progress, streak and missed work carried forward.
- Create or join study groups by code and compare this week's points.

Left out: accounts and sign-in, which your Gateway handles; payments and referrals; bundled course content; extra interface languages.

## Setup

Needs Node 22+, pnpm and an EveryApp Gateway.

```sh
pnpm install
pnpm dev            # run locally behind a local Gateway
pnpm test           # unit tests
pnpm run deploy     # deploy to your Gateway
```

There are no secrets or settings to fill in. The app uses one D1 database and a daily cron (03:00 UTC) that carries missed plan tasks forward. Organization owners and admins edit the curriculum; every member can study.

The checks in `checks/` run against a packaged release with the oss.new runtime. They were not run against a live deployment.

## Limitations

- Days follow UTC, so "today", streaks and weeks turn over at midnight UTC.
- The app starts empty: an admin has to enter the curriculum before members can plan.
- Flashcard tasks count real review time, so a 30-minute card task needs about 30 minutes of reviewing.
