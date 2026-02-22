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
└── CLAUDE.md            # This file
```

## Development Workflow

### Branching

- The default branch is `main`.
- Feature branches should branch from `main` and be merged back via pull request.

### CI Pipeline

The CI workflow (`.github/workflows/blank.yml`) triggers on:
- Push to `main`
- Pull requests targeting `main`
- Manual dispatch (`workflow_dispatch`)

Currently the workflow is a placeholder that runs `echo` commands. Update it with real build, test, and deploy steps as the project grows.

### Commits

- Write clear, descriptive commit messages.
- Keep commits focused on a single logical change.

## Conventions

- No build system, language runtime, or package manager is configured yet. Establish these as the project takes shape and update this file accordingly.
- Keep CI green — don't merge PRs with failing checks.

## For AI Assistants

- Read this file first for orientation.
- The repo is minimal right now; avoid assuming the presence of files, tools, or frameworks that haven't been added yet.
- When adding new tooling (language runtimes, linters, test frameworks, etc.), update this file with the relevant commands and conventions.
- Prefer small, incremental changes over large rewrites.
