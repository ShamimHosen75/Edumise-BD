# Workflow prompts

Templates used between and inside build steps. Copy, fill in the `<...>` parts, and send.

## QA review — after every step

```text
Switch to your QA tester role and review the step you just finished. Do not add features.
1. Run npm run lint, typecheck, test, db:test, build and the E2E tests for this step.
   Fix anything that fails.
2. Re-read the step's prompt and check every acceptance criterion one by one. Show a
   table: criterion | pass/fail | evidence (test name or how you verified).
3. Look for: missing RLS or role checks, unvalidated input, hard-coded English text,
   missing Bangla translations, broken layout at 360px, missing loading/empty/error
   states, files over 300 lines, any any-types, console errors.
4. Write at least 2 negative tests (bad input, wrong role) if they are missing.
5. Update docs/progress.md (tick the step, list known issues).
6. Give me a manual test checklist (max 8 clicks) to verify it myself.
```

## Bug fix

```text
Bug: <what happened>
Where: <page URL / role logged in as>
Steps: 1) ... 2) ... 3) ...
Expected: <...>   Actual: <...>   Error/screenshot: <paste>

First write a failing test that reproduces this bug. Then find the root cause and explain
it in 2-3 sentences before changing code. Fix it with the smallest change, make the test
pass, run the full test suite, and tell me if the same bug could exist elsewhere.
```

## Resume in a new session

```text
Read CLAUDE.md, docs/progress.md and the last 10 git commits (git log --oneline -10).
Tell me in 5 lines: which step we are on, what is done, what is left in this step, and
any known issues. Then wait for my instruction.
```

## Change request mid-project

```text
I want to change: <describe>. Before coding, tell me: which requirement IDs, tables,
pages and tests this affects; whether it needs a new migration; risks to existing data;
and an estimate in steps. Update docs/requirements.md only after I approve.
```

## Code review before a phase ends

```text
Review all code changed in this phase (git diff <phase-start-commit>..HEAD) as a strict
senior reviewer. Report problems grouped as: security, correctness, performance,
maintainability, UX/i18n. Give file:line for each and a suggested fix. Then fix the
security and correctness items and re-run all tests.
```
