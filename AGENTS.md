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
