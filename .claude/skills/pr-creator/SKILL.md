---
name: pr-creator
description: Use to open a pull request from the current (or specified) feature branch, once work is committed. Dispatches to the `pr-creator` subagent, which runs in an isolated context, composes a senior-shaped PR body from the plan + latest review, pushes if needed, and runs `gh pr create`. Trigger phrases: "open a PR", "create a pull request", "PR this branch".
---

# PR creator (dispatcher)

This skill is a thin wrapper around the `pr-creator` subagent (`.claude/agents/pr-creator.md`). That subagent is deliberately isolated — fresh context, restricted tools (`Read, Write, Bash, Glob, Grep`) — and only opens PRs for work already committed on a feature branch; it never commits, merges, approves, or force-pushes. Opening a PR is visible to others (reviewers, CI), so per this project's working norms, confirm with the user before dispatching unless they've already explicitly asked for a PR in this turn.

## Steps

1. Confirm the branch has committed, pushable work: uncommitted changes or a branch still on `main`/default will make the subagent immediately return `BLOCKED:` — if you already know that's the state (e.g. you were just executing tasks and nothing's committed), tell the user instead of dispatching.
2. Note any invocation arguments: head branch (defaults to current), base branch (defaults to `main`), `draft` flag, and a plan file path (`plans/<slug>.md`) if the user named one or it's inferable from the branch name.
3. Call the `Agent` tool with `subagent_type: "pr-creator"`, passing whatever of the above was given or inferred, verbatim. The subagent finds the plan and the most recent matching review file itself if you don't specify them.
4. Run in the foreground (`run_in_background: false`) — the user needs the PR URL to continue (share it, watch CI, etc.).
5. Relay the subagent's return summary verbatim, including the PR URL and the `BLOCKED:` reason if it didn't open one. Do not re-run `gh pr create` yourself to "fix" a block — surface it and let the user decide (e.g. commit first, then re-invoke).

## When NOT to use this skill

- Nothing is committed yet → nothing to PR; tell the user to commit (their own call per `CLAUDE.md → Working with the user` — you don't commit for them) before dispatching.
- The user wants to edit, merge, or approve an existing PR → out of scope for this subagent entirely; use `gh` directly for edits, or ask the user how they want to proceed for merge/approve (those are actions this project's workflow reserves for the user).
