# CLAUDE.md

## Project Overview

**WDLAF** (WooDelivery Lil Agentic Friend) is a natural language chatbot for managing WooDelivery delivery tasks. It uses Claude's tool-use capability to translate plain English into WooDelivery API calls.

- **Owner:** tgeiwitz
- **Default branch:** `main`
- **CI:** GitHub Actions (`.github/workflows/blank.yml`)
- **Language:** Python 3.11+

## Repository Structure

```
.
├── .github/workflows/blank.yml   # CI workflow
├── wdlaf/
│   ├── __init__.py
│   ├── main.py                   # CLI entry point & chat loop
│   ├── web.py                    # Flask web interface
│   ├── chatbot.py                # Claude tool-use orchestration
│   ├── woodelivery.py            # WooDelivery API client
│   └── static/
│       └── index.html            # Chat web page
├── .env.example                  # Environment variable template
├── .gitignore
├── requirements.txt              # Python dependencies
└── CLAUDE.md                     # This file
```

## Setup

```bash
# 1. Create a virtual environment
python -m venv .venv && source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure API keys
cp .env.example .env
# Edit .env with your real keys

# 4. Run the web chatbot
python -m wdlaf.web
# Open http://localhost:5000 in your browser

# Or run the CLI version instead
python -m wdlaf.main
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key (powers NL understanding) |
| `WOODELIVERY_API_KEY` | WooDelivery API key (from Settings > Integration) |
| `CLAUDE_MODEL` | Optional. Claude model to use (default: `claude-sonnet-4-20250514`) |

## Usage Examples

Once running, talk to it in plain English:

- "Show me all unassigned tasks"
- "Create a delivery to 123 Main St for John Smith"
- "Mark task abc123 as completed"
- "What's the status of task xyz789?"
- "Delete task old-task-1"
- "Test the API connection"

## Development Workflow

### Branching

- The default branch is `main`.
- Feature branches should branch from `main` and be merged back via pull request.

### CI Pipeline

The CI workflow (`.github/workflows/blank.yml`) triggers on:
- Push to `main`
- Pull requests targeting `main`
- Manual dispatch (`workflow_dispatch`)

### Commits

- Write clear, descriptive commit messages.
- Keep commits focused on a single logical change.

## Architecture

The chatbot uses a **tool-use loop**:

1. User types a message in plain English
2. Message is sent to Claude along with WooDelivery tool definitions
3. Claude decides which tool(s) to call and with what arguments
4. The tool executes the corresponding WooDelivery API call
5. The result is sent back to Claude to formulate a human-readable response
6. Full conversation history is maintained for context (e.g., "now mark *that one* as completed")

## For AI Assistants

- Read this file first for orientation.
- The WooDelivery API base URL is `https://api.woodelivery.com/v2/`.
- Auth is via `Authorization: Basic <API_KEY>` header.
- Task statuses: Unassigned, Assigned, InTransit, Completed, Failed, Returned.
- When adding new tooling, update this file.
- Prefer small, incremental changes over large rewrites.
