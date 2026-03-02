# CLAUDE.md

## Project Overview

**WDLAF** (WooDelivery Logistics Agent Framework) is a dispatch assistant agent system that coordinates delivery operations through Salesmsg (SMS) and WooDelivery (task management), with all actions routed through Pipedream webhooks.

**Key design principle:** Every agent action requires human approval (SMS to Todd) initially. As Todd approves patterns, they are logged to a knowledge base that informs future automation.

- **Owner:** tgeiwitz
- **Default branch:** `main`
- **Language:** Python 3.12+
- **Integrations:** Pipedream (webhooks) → Salesmsg (SMS) + WooDelivery (tasks)
- **CI:** GitHub Actions (`.github/workflows/blank.yml`)

## Repository Structure

```
.
├── .github/workflows/blank.yml   # CI workflow
├── .env.example                  # Environment variable template
├── .gitignore
├── CLAUDE.md                     # This file
├── agent/
│   ├── __init__.py
│   ├── config.py                 # All settings & Pipedream webhook URLs
│   ├── approval.py               # Human-in-the-loop approval via SMS to Todd
│   ├── dispatch.py               # Main agent — routes actions through guardrails
│   ├── guardrails.py             # Safety rules and validation
│   ├── logger.py                 # Structured logging + knowledge base writer
│   └── integrations/
│       ├── __init__.py
│       ├── pipedream.py          # HTTP webhook caller (shared layer)
│       ├── salesmsg.py           # SMS send/receive, contact management
│       └── woodelivery.py        # Delivery task CRUD + status changes
├── logs/                         # Daily JSONL interaction logs (gitignored)
└── knowledge_base/               # Approved/rejected patterns (gitignored)
```

## Architecture

```
Incoming Request
       │
       ▼
  DispatchAgent.execute()
       │
       ├─ guardrails.validate_action()   ← safety checks
       │
       ├─ approval.request_approval()    ← SMS to Todd, wait for YES/NO
       │
       ├─ integrations.*.action()        ← calls Pipedream webhook
       │
       └─ logger.save_to_knowledge_base() ← log result for learning
```

### Approval Flow

1. Agent proposes an action
2. SMS sent to Todd with action summary
3. Todd replies YES or NO (+ optional notes)
4. If YES → action executes → logged as approved pattern
5. If NO → action aborted → logged as rejected pattern
6. Ambiguous replies are treated as NO (safe default)

## Configuration

Copy `.env.example` to `.env` and fill in:
- `TODD_PHONE_NUMBER` — Todd's phone for approval SMS
- `PIPEDREAM_*_URL` — Pipedream workflow webhook URLs for each action
- `APPROVAL_TIMEOUT_SECONDS` — How long to wait for Todd's reply (default 300s)

## Development Workflow

### Branching

- Default branch: `main`
- Feature branches → merge via pull request

### CI Pipeline

Triggers on push to `main`, PRs targeting `main`, and manual dispatch.

### Commits

- Clear, descriptive messages
- One logical change per commit

## Conventions

- All external API calls go through Pipedream webhooks (never direct)
- All actions are logged as structured JSONL
- Human approval is required by default; auto-approval is earned
- Guardrails fail closed (deny on ambiguity)
- No secrets in code — everything via environment variables

## For AI Assistants

- Read this file first
- The agent system lives in `agent/` — start with `dispatch.py` for the main flow
- `config.py` has all environment variable mappings
- `approval.py` handles the human-in-the-loop SMS workflow
- `logger.py` writes to both `logs/` (audit) and `knowledge_base/` (learning)
- Prefer small, incremental changes over large rewrites
