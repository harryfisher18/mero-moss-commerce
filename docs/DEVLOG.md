# Development Log

Newest entries first. Every `/pr-test` cycle adds one entry: date, issue, summary, checks with results, PR and merge status, blockers, and the recommended next step.

---

## 2026-11-05 — Bootstrap (M0)

- **Work:** Initial repository setup. The original product skill moved to `.claude/skills/mero-moss-commerce/` unchanged. Added `CLAUDE.md`, the `/pr-test` skill, a Next.js 16 + strict TypeScript scaffold, ESLint, Vitest, a GitHub Actions CI workflow, issue/PR templates, `TASKS.md` roadmap, `PROJECT_BRIEF.md`, and a typed money module with unit tests.
- **Checks:** `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` were run locally before the bootstrap commit. Results are recorded in the bootstrap report.
- **GitHub:** The existing repo `harryfisher18/mero-moss-commerce` was reused, so no duplicate was created. The bootstrap commit was pushed directly to the empty `main` because no PR is possible against an empty repository. All later work goes through PRs.
- **Next:** Issue #1, the catalog domain model, persistence, and seeded catalog.
