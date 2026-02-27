# CLAUDE.md

## Project Overview

**WDLAF** is a repository in early stages of development. It currently contains a GitHub Actions CI scaffold and is set up for future development.

- **Owner:** tgeiwitz
- **Default branch:** `main`
- **CI:** GitHub Actions (`.github/workflows/blank.yml`)

## Repository Structure

```
.
├── .github/
│   └── workflows/
│       └── blank.yml    # CI workflow — runs on push/PR to main
└── CLAUDE.md            # This file (project docs & AI assistant guide)
```

The repository is intentionally minimal. No language runtime, build system, package manager, or application code exists yet.

## Development Workflow

### Branching

- The default branch is `main`.
- Feature branches should branch from `main` and be merged back via pull request.
- Do not push directly to `main` — always use a PR.

### CI Pipeline

The CI workflow (`.github/workflows/blank.yml`) triggers on:
- Push to `main`
- Pull requests targeting `main`
- Manual dispatch (`workflow_dispatch`)

The workflow currently runs on `ubuntu-latest` and uses `actions/checkout@v4`. The build steps are placeholders (`echo` commands). Replace them with real build, test, and deploy steps as the project grows.

There are no build, test, or lint commands to run yet. When they are added, document them below under **Commands**.

### Commits

- Write clear, descriptive commit messages.
- Keep commits focused on a single logical change.
- Do not combine unrelated changes in a single commit.

## Commands

No build, test, or lint commands are configured yet. Update this section as tooling is added:

```
# (placeholder) build
# (placeholder) test
# (placeholder) lint
```

## Conventions

- No build system, language runtime, or package manager is configured yet. Establish these as the project takes shape and update this file accordingly.
- Keep CI green — don't merge PRs with failing checks.
- When introducing a new tool or framework, pin its version and document the setup steps in this file.

## For AI Assistants

### Orientation

- Read this file first before making any changes.
- The repo is minimal — do **not** assume the presence of files, tools, or frameworks that haven't been added yet.
- Check the repository structure (`find` / `ls`) before referencing or importing files.

### Making Changes

- Prefer small, incremental changes over large rewrites.
- When adding new tooling (language runtimes, linters, test frameworks, package managers, etc.), update **this file** with:
  - The new commands (build, test, lint, etc.) under the **Commands** section.
  - Any new conventions under the **Conventions** section.
  - An updated **Repository Structure** tree.
- Do not introduce tooling or dependencies without a clear reason tied to the current task.
- If the CI workflow is still a placeholder, update it when real build/test steps become available.

### Code Quality

- Do not leave dead code, commented-out blocks, or TODO comments unless explicitly asked.
- Keep files focused — one concern per file.
- Follow whatever language/framework conventions are established once a runtime is chosen.
