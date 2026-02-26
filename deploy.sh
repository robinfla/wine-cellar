#!/bin/bash
set -e

echo "🚀 Deploying wine-cellar backend..."

# Build and restart containers
docker compose up -d --build app

# Wait for app to be ready
echo "⏳ Waiting for app to start..."
sleep 15

# Check local health
echo "🔍 Checking local health..."
HEALTH=$(curl -s http://127.0.0.1:3000/api/health | jq -r .status)
if [ "$HEALTH" != "ok" ]; then
  echo "❌ Local health check failed!"
  docker logs wine-cellar --tail 20
  exit 1
fi
echo "✅ Local API healthy"

# Restart Traefik to pick up routing
echo "🔄 Restarting Traefik..."
docker restart traefik
sleep 8

# Check public HTTPS endpoint
echo "🔍 Checking public HTTPS endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 https://cellar.zubi.wine/api/health || echo "timeout")

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Public API healthy (HTTP $HTTP_CODE)"
  echo ""
  echo "🎉 Deploy complete!"
  echo "📍 API: https://cellar.zubi.wine"
else
  echo "⚠️  Public HTTPS check: $HTTP_CODE (Traefik may need more time)"
  echo "    Local API is working: http://127.0.0.1:3000"
  echo ""
  echo "🔧 If mobile app fails, try restarting Traefik again:"
  echo "   docker restart traefik"
fi
