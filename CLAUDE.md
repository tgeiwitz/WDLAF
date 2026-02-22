# CLAUDE.md

## Project Overview

**WDLAF** (Webhook Delivery for Little Acre Flowers) is a Node.js webhook service that receives Shopify/Zapiet order webhooks and creates corresponding delivery tasks in [Wodely](https://app.wodely.com), a delivery management platform. It uses the Claude API (Anthropic) to classify order notes as delivery instructions vs. special requests.

## Repository Structure

```
.
├── src/
│   ├── index.js        # HTTP server, webhook handler, payload assembly
│   ├── claude.js       # Anthropic SDK: order-note classification
│   ├── wodely.js       # Wodely REST API client (POST /v2/tasks)
│   ├── datetime.js     # Delivery window calculation, service-ID logic
│   └── normalize.js    # Phone, address, tag, and package helpers
├── .github/
│   └── workflows/
│       └── blank.yml   # CI workflow (placeholder)
├── .env.example        # Environment variable template
├── .gitignore
├── package.json
└── railway.toml        # Railway deployment config (Nixpacks builder)
```

## Architecture

```
Shopify (Zapiet) webhook
        │
        ▼
   src/index.js  (HTTP server, POST /webhook)
        │
        ├── src/claude.js      → Claude API: classify order notes
        ├── src/datetime.js    → delivery window & service-ID logic
        ├── src/normalize.js   → phone, address, tag helpers
        │
        ▼
   src/wodely.js → Wodely REST API: create delivery task
```

### Module Responsibilities

| File | Purpose |
|---|---|
| `src/index.js` | HTTP server (`http`), webhook handler, payload assembly |
| `src/claude.js` | Anthropic SDK client; classifies order notes into `delivery`, `special_request`, `both`, or `none` |
| `src/wodely.js` | HTTPS client for `POST /v2/tasks` on Wodely |
| `src/datetime.js` | `calcDeliveryWindow` (date adjustment, time windows) and `calcServiceId` (rush vs. standard) |
| `src/normalize.js` | Phone normalization/deduplication, address formatting, line-item descriptions, tag construction |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template and fill in secrets
cp .env.example .env

# Start the server (default port 3000)
npm start
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook` | Receives Shopify order JSON |
| `GET` | `/health` | Returns `{"status":"ok"}` |

## Environment Variables

See `.env.example` for a template.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP listen port |
| `ANTHROPIC_API_KEY` | **Yes** | — | Claude API key for note classification |
| `WODELY_API_KEY` | **Yes** | — | Wodely API bearer token |
| `OUTLET_ADDRESS` | No | `2004 17th St NW` | Dispatch origin address line 1 |
| `OUTLET_BUILDING` | No | `Little Acre Flowers` | Dispatch origin building name |
| `OUTLET_CITY` | No | `Washington` | Dispatch origin city |
| `OUTLET_ZIP` | No | `DC 20009` | Dispatch origin postal code |
| `OUTLET_COUNTRY` | No | *(empty)* | Dispatch origin country |
| `OUTLET_COORDINATES` | No | *(empty)* | Dispatch origin lat/lng |

## Dependencies

- **Runtime:** Node.js >= 18
- **Production dependency:** `@anthropic-ai/sdk` (^0.39.0)
- All other HTTP calls use Node.js built-in `https` module (no Express, no Axios).

## Deployment

Deployed on **Railway** using the Nixpacks builder.

- **Config file:** `railway.toml`
- **Start command:** `npm start` → `node src/index.js`
- **Health check:** `GET /health` (30s timeout)
- **Restart policy:** on failure, max 3 retries

## Key Business Rules

- **Delivery windows:** Weekdays 12:00–18:00 UTC, Saturdays 11:00–17:00 UTC.
- **Sunday adjustment:** Sunday delivery dates are pushed to Monday (`DATE_ADV_SUNDAY` flag).
- **Past-date adjustment:** Dates in the past are moved to the next available non-Sunday date (`DATE_ADV_PAST` flag), and packages are marked `RESCHEDULED`.
- **Service ID:** `4624` (rush) if current time is within 2 hours of the delivery window start; `1888` (standard) otherwise.
- **High-value orders:** Total > $300 gets priority `10` (default `20`) and `HIGH_VALUE` flag.
- **Phone deduplication:** When sender and recipient phones match, only the requester phone is sent, with `PHONE_DEDUPED` (same name) or `NO_RECEIVER_PHONE` (different names) flag.
- **Note classification (Claude):** Order notes are classified and routed — delivery-related notes go to `destinationNotes`, special requests go to `tag3`, and `SENTIMENT_FLAGGED` is set when an occasion is present.
- **Email suppression:** `EMAIL_SUPPRESSED` flag is always set on every order.

## Code Conventions

- **`'use strict'`** at the top of every file.
- **CommonJS modules** — `require()` / `module.exports`.
- **No framework** — uses Node.js built-in `http` and `https` modules directly.
- **No build step** — run source files directly with `node`.
- **Minimal dependencies** — only `@anthropic-ai/sdk`; everything else uses Node built-ins.
- Functions are kept small and pure where possible (especially in `normalize.js` and `datetime.js`).
- Conditional spread (`...(value ? { key: value } : {})`) is used to omit empty optional fields from the Wodely payload.
- US phone numbers are normalized to `(XXX) XXX-XXXX` format.

## Constants

- **Merchant ID:** `09cc8b76-6b54-4995-b136-a5dea3f0656a`
- **Template ID:** `1981`
- **Claude model:** `claude-sonnet-4-6` (used for note classification, max 512 tokens)

## Tag System

The Wodely payload uses tags for metadata:

| Tag | Content |
|---|---|
| `tag1` | Order number |
| `tag2` | Sentiment, shipping fee, subtotal, high-value flag |
| `tag3` | Special request note (if any) |
| `tag5` | Timestamp + processing flags (e.g., `DATE_ADV_SUNDAY`, `PHONE_DEDUPED`, `EMAIL_SUPPRESSED`) |

### All Tag5 Flags

| Flag | Meaning |
|---|---|
| `DATE_ADV_SUNDAY` | Delivery date fell on Sunday, moved to Monday |
| `DATE_ADV_PAST` | Delivery date was in the past, advanced to next valid day |
| `PHONE_DEDUPED` | Sender and recipient have same phone and name |
| `NO_RECEIVER_PHONE` | Sender and recipient have same phone but different names |
| `EMAIL_SUPPRESSED` | Always set; email notifications suppressed |
| `HIGH_VALUE` | Order total exceeds $300 |
| `SENTIMENT_FLAGGED` | Occasion/sentiment value present on the order |
| `NOTE_ROUTED_TO_DEST` | Order note classified as delivery-related and routed to destination notes |
| `NOTE_FLAGGED_REVIEW` | Special request note extracted; needs review |

## CI / CD

- **Workflow file:** `.github/workflows/blank.yml`
- Currently a placeholder — triggers on push/PR to `main` branch and runs echo commands.
- **Default branch:** `master` (note: CI references `main` — this mismatch should be resolved).

## Testing

No test framework is currently configured. When adding tests:
- `src/datetime.js` and `src/normalize.js` are pure-function modules well-suited for unit tests.
- `src/claude.js` and `src/wodely.js` make external API calls and should be tested with mocked HTTP.
