# AGENTS.md

## Documentation

Before making any changes, read the docs in `docs/`:

- `docs/ARCHITECTURE.md` — code structure and design
- `docs/CODING_GUIDELINES.md` — coding conventions
- `docs/CONTENT_AUTHORING.md` — how to author game content in `content/`
- `docs/DESIGN_PRINCIPLES.md` — game design principles
- `docs/GDD.md` — game design document
- `docs/PROGRESS.md` — current progress/status

Follow the conventions defined there.

## Workflow

1. **Read before writing.** For any non-trivial change, read the relevant docs
   first; for gameplay/content work also read `docs/DESIGN_PRINCIPLES.md` §D–F.
2. **Spec first, code second.** Changes spanning multiple files start with a
   short plan (files touched, new events/schemas, acceptance criteria). Do not
   invent design decisions silently — if pillars conflict or a number lacks an
   anchor in `content/`, stop and ask.
3. **One system per change.** Prefer depth over breadth: polishing one encounter
   beats generating ten shallow maps. Content must differ deliberately from
   existing content, not just by name and numbers.
4. **Definition of done** (`docs/CODING_GUIDELINES.md` §9): validate + build
   green, matching `scripts/qa-local.mjs` scenario passes, manual playtest with
   at least one concrete game-feel observation handled. "It compiles" is not done.

## Lessons

When an agent makes a real mistake that the docs do not cover, add a concise
rule here or in the relevant doc so future sessions don't repeat it. Keep this
file short (~40 lines) — details belong in `docs/`.

## Worktrees

Always make changes in a dedicated git worktree, never directly on the main
working copy:

1. Before starting work, create a worktree:
   ```
   git worktree add ../<branch-name> -b <branch-name>
   ```
   Worktrees live as siblings of `main/` inside `xiuxian-rpg/`.
   Use a short, descriptive branch name (e.g. `add-world-content`).
2. Perform all edits and run builds/tests inside that worktree.
3. Never create, edit, or delete files in the primary checkout.
4. Clean up when done: the user decides whether to merge; do not merge,
   rebase, or remove the worktree unless asked.
