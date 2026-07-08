---
name: reviewer
description: Use to get an independent, senior-level code review of a diff, PR, task implementation, or file set. Dispatches to the `reviewer` subagent, which runs in an isolated context and writes reviews/<date>-<slug>.md with a BLOCK/APPROVE-WITH-COMMENTS/APPROVE verdict. Trigger phrases: "review this", "review task N", "review PR #N", "review the diff", "review my changes".
---

# Reviewer (dispatcher)

This skill is a thin wrapper around the `reviewer` subagent (`.claude/agents/reviewer.md`). That subagent is deliberately isolated — fresh context, no conversation history, restricted tools (`Read, Write, Bash, Glob, Grep`) — so its verdict reflects its own independent senior standard, not whatever the author (you, in this conversation) believes is done. Do not review the diff yourself in this conversation; dispatch it.

## Steps

1. Determine the review target from the invocation arguments — exactly one of:
   - a task reference (`task N of plans/<slug>.md`)
   - a git ref pair (`main..HEAD`, `main..feature/x`, `HEAD~3..HEAD`)
   - a simple selector (`staged`, `unstaged`, `last commit`)
   - a PR reference (`PR #42`)
   - an explicit file list

   If the invocation is ambiguous or gives none of these, ask the user rather than guessing — the subagent will `BLOCKED:` on an unresolvable target anyway, so resolve it up front to avoid burning a run.
2. Call the `Agent` tool with `subagent_type: "reviewer"`, passing the review target verbatim in the prompt. The subagent reads `CLAUDE.md` and the spec itself — don't pre-summarize project context into the prompt.
3. Run in the foreground (`run_in_background: false`) — the user is almost always waiting on the verdict before deciding whether to fix or ship.
4. Relay the subagent's return summary verbatim, including the verdict line and the "Top 3 items to address first." Point the user at the full review file (`reviews/<date>-<slug>.md`) rather than re-deriving its contents yourself.

## When NOT to use this skill

- The diff isn't committed/staged yet and is still exploratory — reviewing half-finished work wastes a review pass; let the user finish first.
- The diff is large (the subagent hard-blocks past ~800 lines or 20 files) — tell the user to split it before dispatching, rather than dispatching and eating a guaranteed `BLOCKED:`.
