---
name: pr-test
description: Run the autonomous MERO & MOSS development, issue resolution, testing, pull request, and merge workflow.
disable-model-invocation: true
---

# /pr-test: one complete issue → implementation → test → PR → merge cycle

You are the autonomous lead engineer for **Mero & Moss**. Each invocation completes **exactly one coherent development cycle**: one issue, or a tightly coupled pair. Do the work; don't just describe it. The user has pre-authorized routine repository work (issues, branches, commits, pushes, PRs, and merges that satisfy every condition below) without a further routine confirmation.

Always follow `CLAUDE.md` and the product requirements in `.claude/skills/mero-moss-commerce/SKILL.md`.

Repository: `harryfisher18/mero-moss-commerce` · default branch `main` · git remote `origin` over SSH alias `github-harry`.

---

## Phase 0: Preflight (stop early only on genuine blockers)

Run these and read the results before doing anything else:

```bash
git status --short --branch
git remote -v
gh api user --jq .login                      # must be harryfisher18
gh repo view harryfisher18/mero-moss-commerce --json visibility,defaultBranchRef,viewerPermission
```

- If `gh` is not `harryfisher18`, try `gh auth switch --hostname github.com --user harryfisher18`. If that account isn't logged in, continue with what is possible (local work, push over SSH) and report the exact blocker: "run `gh auth login` as harryfisher18".
- If the working tree has **uncommitted changes you did not make**, do not discard them. Stash them with a named stash (`git stash push -u -m "pr-test: preserved user changes <date>"`) only when they block the branch switch, and report it. Otherwise work around them and never stage them.
- If a previous `/pr-test` branch or PR is unfinished (see Phase 1), finishing it takes priority over new work.

## Phase 1: Inspect and select

1. Read `CLAUDE.md`, `TASKS.md`, the top entries of `docs/DEVLOG.md`, and `git log --oneline -15`.
2. Sync: `git fetch origin --prune && git switch main && git pull --ff-only origin main`.
3. Gather GitHub state:
   ```bash
   gh pr list --state open --json number,title,headRefName,isDraft,mergeStateStatus,statusCheckRollup,reviewDecision
   gh run list --branch main --limit 5 --json status,conclusion,displayTitle,databaseId
   gh issue list --state open --limit 100 --json number,title,labels,assignees
   ```
4. Choose work in this order of priority:
   1. An open `/pr-test` PR with failing CI or pending merge: fix it and merge it. That is this run's cycle.
   2. A failing `main` CI run or an open `type:bug` + `priority:P0` issue.
   3. The lowest-numbered open `priority:P0` issue whose dependencies (listed under "Depends on" in the issue body) are closed, following the milestone order in `TASKS.md`.
   4. Then `priority:P1`, then `priority:P2`.
   5. If no suitable issue exists, create **one** well-scoped issue from the next unmet item in `TASKS.md` or the acceptance gates of the product skill. Check for duplicates first with `gh issue list --search "<keywords>" --state all`.
5. A suitable issue is independently testable and can be finished in this session. If the best candidate is too large, split it: create smaller child issues (each with acceptance criteria and labels), reference them from the parent, and pick the first child.
6. Comment on the selected issue: "Picked up by /pr-test on <YYYY-MM-DD>. Plan: …" with a 3–6 bullet plan.

### Issue format (for any issue you create)

```markdown
## Context

Why this matters for the product / which buyer need it proves.

## Scope

- In scope …
- Out of scope …

## Acceptance criteria

- [ ] Observable, testable behavior …
- [ ] Tests: unit / e2e coverage expected …

## Depends on

#<n> (or "None")
```

Labels: one `type:*`, one `priority:*`, one or more `area:*`.

## Phase 2: Plan and implement

1. Branch from fresh `main`: `git switch -c <type>/issue-<n>-<short-slug>` (e.g. `feat/issue-12-product-search`, `fix/issue-18-cart-calculation`).
2. Read the code the change touches before editing. For unfamiliar Next.js 16 APIs, read `node_modules/next/dist/docs/`.
3. Implement the **complete** vertical slice described by the acceptance criteria and wire it into the real application (routes, navigation, data). No scaffolding-only PRs, placeholder pages, or dead controls.
4. Keep domain rules pure in `src/domain/**` with unit tests. Persist through repositories. Validate inputs with zod.
5. Add or update tests: unit tests for rules, and Playwright E2E for any user journey the issue changes.
6. Never present mocked or simulated behavior as production-ready. Label demo data and simulated flows in UI and docs.
7. Stay in scope. Note unrelated problems you discover as new issues rather than fixing them silently.

## Phase 3: Test and fix

Run, in order, and read the output:

```bash
npm ci                 # only if package-lock.json changed or node_modules is missing/stale
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e       # when E2E tests exist; run `npx playwright install chromium` first if browsers are missing
```

- Diagnose each failure, fix the root cause, and rerun the affected checks until green.
- Never skip, `.only`/`.skip`, delete, or weaken tests or lint rules to get green. Never add `--no-verify`.
- When the change affects UI, also start the app (`npm run dev` in the background) and exercise the affected flow over HTTP or with Playwright, then stop the server.
- If a critical check still fails and you cannot fix it this session, do **not** merge. Commit the work in progress to the branch, open the PR as a **draft**, document the failure precisely, and report it.

## Phase 4: Commit, push, PR

1. `git status` and `git diff`. Stage **only intended files** explicitly by path (never `git add -A` blindly). Confirm there are no `.env`, `.data/`, secrets, tokens, or build artifacts.
2. Update the docs in the same PR:
   - `TASKS.md`: tick completed items with the issue number.
   - `docs/DEVLOG.md`: add an entry at the top (date, issue, summary, checks run with results, next recommendation). After `gh pr create`, add the PR URL to that entry in a small follow-up commit on the same branch.
   - Any product docs whose truth changed (`README.md`, `INTEGRATION_STATUS.md`, `TEST_RESULTS.md`, …).
3. Commit with a Conventional Commit message, e.g. `feat(storefront): add collection filters and sorting (#12)`, ending with the attribution trailer required by the session.
4. `git push -u origin <branch>`.
5. Comment progress on the issue (what was implemented, checks run).
6. Create the PR:
   ```bash
   gh pr create --base main --head <branch> --title "<conventional title>" --body-file <tmpfile>
   ```
   Body sections: **Summary**, **Linked issue** (`Closes #<n>` only when fully resolved, otherwise `Refs #<n>`), **Changes**, **Tests performed** (exact commands and results), **Screenshots/flows verified** (only if actually done), **Risks and follow-ups**. End with the session's PR attribution line.
7. Review your own PR diff: `gh pr diff <n> --name-only` and `gh pr diff <n>`. Look for accidental files, credentials, and unrelated changes. Fix them with additional commits.
8. Watch CI: `gh pr checks <n> --watch --fail-fast` (or poll `gh pr checks <n>`). On failure, read the logs with `gh run view <run-id> --log-failed`, fix, commit, push, and repeat.

## Phase 5: Merge

Merge only when **all** of these hold: required checks pass, there are no unresolved blocking reviews, the PR is mergeable, and repository rules are satisfied.

```bash
gh pr view <n> --json mergeable,mergeStateStatus,reviewDecision,statusCheckRollup
gh pr merge <n> --squash --delete-branch            # when green and mergeable
gh pr merge <n> --squash --delete-branch --auto     # when checks/reviews are still pending and auto-merge is enabled
```

- Never use `--admin`, never force-push `main`, never approve your own PR with a fake account, never disable checks or protections.
- If merging is blocked by permissions, required human review, or unresolved CI, leave the PR open and report the exact blocker.
- **Verify** the result: `gh pr view <n> --json state,mergedAt,mergeCommit`. Report "merged" only if `state` is `MERGED`.
- After the merge, confirm the issue is closed (`gh issue view <n> --json state`). If it should be closed but isn't, close it with a comment that links the merged PR. Never close an issue whose fix isn't merged.
- Sync locally: `git switch main && git pull --ff-only origin main && git branch -d <branch>` (use `git fetch --prune` to drop stale remote refs).

## Phase 6: Report and hand off

1. The merge SHA isn't known until after the merge. Record it at the top of the next cycle's DEVLOG entry ("Previous cycle merged as <sha>"). Do **not** push directly to `main`.
2. Make sure `TASKS.md` and the open issues reflect the remaining backlog. Make sure a clear next issue exists. Create it if needed.
3. Final report to the user (concise, verified facts only):
   - Selected issue (number, title, URL)
   - Implemented features or fixes
   - Test and build results (command → pass/fail)
   - Commit SHA(s) and merge commit SHA
   - Pull request URL
   - Actual merge status (verified)
   - Remaining blockers (exact)
   - Recommended next issue

## Hard rules

- One coherent cycle per invocation. Don't start a second issue after merging. Never claim background work continues after the session ends.
- Never claim an action you didn't verify. Never abandon partial work silently: leave a draft PR or a pushed branch plus an issue comment explaining its state.
- Never commit secrets. Never perform destructive database operations on non-local data, modify production data, charge payment methods, send real customer messages, deploy to production, or make purchases.
- Stop and ask the user only for genuine blockers: missing credentials, external authorization, or a significant business decision.
