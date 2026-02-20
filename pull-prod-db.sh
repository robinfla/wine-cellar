#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

echo -e "${YELLOW}=== Pull Production Database to Local ===${NC}"

if [ -z "$SUPABASE_DB_URL" ]; then
  echo -e "${RED}Error: SUPABASE_DB_URL environment variable is not set${NC}"
  echo ""
  echo "Add to your .env file:"
  echo "  SUPABASE_DB_URL='postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres'"
  echo ""
  echo "Find this in: Supabase Dashboard > Settings > Database > Connection string (Direct)"
  exit 1
fi

LOCAL_DB_HOST="${LOCAL_DB_HOST:-localhost}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-5435}"
LOCAL_DB_USER="${LOCAL_DB_USER:-wine}"
LOCAL_DB_PASSWORD="${LOCAL_DB_PASSWORD:-password}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-wine_cellar}"

DUMP_FILE="/tmp/wine_cellar_prod_dump_$(date +%Y%m%d_%H%M%S).sql"

echo -e "${GREEN}Step 1: Dumping production database (schema + data)...${NC}"

pg_dump "$SUPABASE_DB_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exclude-table='_prisma_migrations' \
  --exclude-table='drizzle.*' \
  -f "$DUMP_FILE"

echo -e "${GREEN}Step 2: Checking local database...${NC}"

export PGPASSWORD="$LOCAL_DB_PASSWORD"
if ! pg_isready -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" > /dev/null 2>&1; then
  echo -e "${YELLOW}Starting docker-compose db...${NC}"
  cd "$PROJECT_DIR" && docker compose up -d db
  sleep 5
fi

echo -e "${GREEN}Step 3: Importing to local database...${NC}"

psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -f "$DUMP_FILE" 2>&1 | grep -v "NOTICE\|already exists\|does not exist" || true

echo -e "${GREEN}Step 4: Cleaning up...${NC}"
rm -f "$DUMP_FILE"

echo ""
echo -e "${GREEN}=== Done! ===${NC}"
echo ""
echo "Local database now mirrors production."
echo "Update your .env DATABASE_URL to: postgresql://wine:password@localhost:5435/wine_cellar"
echo ""
echo "Run 'npm run dev' to start developing."
