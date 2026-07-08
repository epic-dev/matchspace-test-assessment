---
name: executor
description: Use to execute one or more tasks from an approved plan file (plans/<slug>.md) — implements the task, runs its acceptance checks, updates its status in the plan. Dispatches to the `executor` subagent, which runs in an isolated fresh context and cannot ask clarifying questions. Trigger phrases: "execute task N", "run the executor", "implement task N of the plan", "next task".
---

# Executor (dispatcher)

This skill is a thin wrapper around the `executor` subagent (`.claude/agents/executor.md`). That subagent is deliberately isolated — fresh context, no conversation history, restricted tools (`Read, Write, Edit, Bash, Glob, Grep`), cannot ask the user questions — so it stays scoped to exactly one task and blocks on ambiguity instead of guessing. Do not implement the task yourself in this conversation; dispatch it.

## Steps

1. Parse the invocation arguments for a plan file path and a task selector (`task N`, `next`, or `tasks A-B`).
   - If either is missing or unclear, ask the user before dispatching — the subagent cannot ask on your behalf, and a wrong guess wastes its run.
2. Call the `Agent` tool with `subagent_type: "executor"`. The prompt you pass must contain the plan file path and the task selector verbatim, plus nothing else the subagent doesn't already read for itself (`CLAUDE.md`, the plan) — it has no access to this conversation's history.
3. Run in the foreground (`run_in_background: false`) when the user is waiting on the result to decide next steps (the common case, single task). Background is fine only for a batch range the user explicitly isn't blocking on.
4. Relay the subagent's return summary to the user verbatim — do not paraphrase away the `BLOCKED:` prefix, the Verification lines, or the Files changed list. The user needs those exactly as returned to decide what's next.

## When NOT to use this skill

- No `plans/<slug>.md` exists yet → use the `planner` skill first, don't invent a plan path.
- The work is ad hoc, outside any plan → just implement it directly in this conversation instead of dispatching.
- A task depends on an earlier task that isn't `done` → the subagent will block on this itself; no need to pre-check, but flag it to the user if it's obvious from the plan you already have open.
