### implementation notes

#### Steps
1. created project specification (system design) manually. This human-written spec will be used as source of truth for the Claude Code. 
2. composed a prompt for Claude Code to create a project context
```
You are the CLAUDE.md initializer for this project. This is your ONE job.

TASK
1. Read the spec @PROJECT_SPEC.md end-to-end
2. If ANYTHING is ambiguous (tech stack version, deliverable format, deadline, unclear acceptance criteria, unstated conventions), ask me 2-4 targeted questions in ONE message before writing. Do NOT drip them one at a time. Do NOT invent details.
4. Once you have enough, Use /init for this project: write CLAUDE.md at the repo root.
5. Print a short summary (5-8 lines) of what you captured, plus a "Follow-up" list if anything is still open. Then STOP.

CLAUDE.md STRUCTURE - use these H2 sections in this exact order:

## Project
1-2 sentences: what this project is and what problem it solves. If ANYTHING is unclear, ask me 2 - 4 targeted questions in ONE before writing. Do NOT drip them one at a time. Do NOT invent details.

## Tech stack
Language + versions, framework + versions, DB, runtime, deploy target, any allowed/forbidden dep families. Verbatim from spec where the spec is explicit. The preffered stack is in the specification.

## Assessment spec
- Path to the full spec file (so future sessions can re-read it directly).
- 5-10 bullet summary of acceptance criteria.

## Deliverable
- Repo URL (where the submission lives) - placeholder if not set yet.
- Live demo URL (where the deployed app runs) - placeholder if not set yet.

## Conventions
- Code style (linter, formatter, config file paths).
- Testing bar (framework, coverage target if any).
- Commit style (conventional commits? plain?).

## Working with the user
- User: senior full-stack engineer, frontend-leaning.
- Wants senior-signal code, not cargo cult. Prefers small reviewable diffs over large sprawling PRs.
- Ask before large changes. When in doubt, offer 2-3 concrete choices rather than open-ended "any preference?"
- Never skip git hooks, force-push, or bypass signing without explicit approval.
- The user makes their own commits unless explicitly asked otherwise.

## Out of scope
- Files/paths/deps NOT to touch (from the spec or that the user specifies).

## Reference material
- @PROJECT_SPEC

CONSTRAINTS
- Do NOT write any code beyond CLAUDE.md.
- Do NOT propose an implementation plan unless it explicitly asked.
- Do NOT start work on the assessment itself unless it explicitly asked.
- Do NOT invent details the spec doesn't cover - ask.
- Stop after CLAUDE.md is written and the summary is printed. Wait for my review before doing anything else.
```

3. Added basic skills and agent for Claude: .claude/skills/, .claude/agents/
4. Bootstrapped Next app. `pnpm create next-app`
5. Installed recommended Supabase skills for Claude Code
6. Planned and implemented the assessment task step-by-step:
    - using `/planner` I prompting a feature I want to add
    - review the result, make updates in the generated plan file
    - run `/executor` agent which looks at the plan generated and writes the code
    - manually review each step (still)
    - run `/reviewer` agent to review the latest changes in the working tree
    - merge to main branch

#### notes 
- [!] The platform users are teachers. Students have no their own accounts, the platform is public, perhaps it makes sense to consider some anti-spam measures.
- disabled RLS for teachers table
- disabled email comfirmation
- review agents output in-place
- AI accelerated Supabase connection management, and boilerplace code creation, e.g. Error handling
- currently my agents stops after each task in the plan, maybe it makes sense to let them proceed with the whole plan

#### out of scope
- custom auth flow, used Supabase auth instead
- email confirmation on registeration step
- instruments table. Ideally to store them in the separate table
- production-ready Logger
- db transactions, assuming that everything saved successfully
- branching strategy
- pr-creator, last minute update: it turns out could take a time
