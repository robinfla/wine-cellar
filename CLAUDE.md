# Bibo Wine Cellar — Backend

## Overview
Wine inventory management API for personal cellars. Users can scan labels, track bottles, get AI recommendations.

**Stack:** Nuxt 3, Drizzle ORM, PostgreSQL, TypeScript  
**Deployment:** Docker on muscle-museum VPS, Traefik reverse proxy  
**URL:** https://cellar.zubi.wine

## Architecture

```
server/
├── api/              # API routes (RESTful)
│   ├── auth/         # Login, register, session
│   ├── inventory/    # Lots (bottles in cellars)
│   ├── wines/        # Wine definitions, scan, AI search
│   ├── knowledge/    # Knowledge base search (public)
│   ├── cellars/      # Cellar management
│   ├── chat/         # Sommelier AI chat
│   └── reports/      # Analytics, stats
├── db/
│   ├── schema.ts     # Drizzle schema
│   └── migrations/   # SQL migrations
└── utils/
    ├── db.ts         # Database connection
    ├── knowledge.ts  # SQLite knowledge base integration
    └── maturity.ts   # Wine maturity calculations
```

## Key Design Decisions

### Vintages as First-Class Entities
- `vintages` table with FK to `wines`
- `inventory_lots.vintage_id` references `vintages.id`
- Enables per-vintage valuations, maturity, critic scores

### Multi-Tenant
- All user data has `user_id` column
- Queries always filter by `userId` from session

### Knowledge Base Integration
- SQLite DB with 493K wines mounted at `/app/knowledge/wine-knowledge.db`
- Read-only enrichment lookups (images, food pairings, critic reviews)
- See `server/utils/knowledge.ts` for API

### Maturity Calculation
- Cascading lookup: lot override → AI suggestion → appellation → region+grape → color
- 150+ appellation windows in `server/utils/maturity.ts`

## Database Schema (Key Tables)

```sql
users           -- Auth, preferences
wines           -- Wine definitions (name, color, producer_id)
producers       -- Wineries
regions         -- Geographic regions
appellations    -- AOC/DOC classifications
vintages        -- Year + wine_id, valuations
inventory_lots  -- Bottles in cellars (quantity, purchase info)
inventory_events-- History (purchase, consume)
cellars         -- User's storage locations
cellar_spaces   -- Rooms/fridges within cellars
cellar_racks    -- Grid-based bottle storage
taste_profiles  -- User taste preferences (for sommelier)
sommelier_conversations -- Chat history
```

## API Endpoints

### Public (no auth)
- `GET /api/knowledge/search?q=...` — Search 493K wines
- `GET /api/knowledge/:id` — Full wine enrichment

### Auth Required
- `POST /api/wines/scan` — Scan label image (Claude Vision)
- `POST /api/wines/ai-search` — Natural language wine search
- `GET /api/inventory/cards` — Wine cards with vintages
- `POST /api/chat/sommelier` — AI sommelier chat

## Environment Variables

```
DATABASE_URL=postgresql://wine:password@db:5432/wine_cellar
ANTHROPIC_API_KEY=sk-ant-...
KB_PATH=/app/knowledge/wine-knowledge.db
```

## Docker Setup

```yaml
# docker-compose.yml mounts:
- ./:/app
- ../bibo-knowledge/db/wine-knowledge.db:/app/knowledge/wine-knowledge.db:ro
```

## Current State (March 2026)

### Completed
- Full inventory CRUD with vintage tracking
- Label scanning with Claude Vision
- Knowledge base search (493K wines, images, critic reviews)
- Sommelier AI with taste profiles
- Cellar rack visualization (backend)
- Maturity calculations

### In Progress
- Cellar rack visualization (mobile UI)
- Analytics fixes

## Related Projects
- `../bibo-knowledge/` — Wine reference database (SQLite)
- `../wine-cellar-mobile/` — React Native mobile app

## Testing
```bash
npm run test          # Vitest
npm run db:migrate    # Run migrations
```

## Deploy
Push to `main` triggers GitHub Actions → Docker build → Traefik picks up.
