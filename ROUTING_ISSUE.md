# Nuxt/Nitro Routing Issue - `/api/inventory/[id]/` Subdirectory

## Problem
All API endpoints under `/server/api/inventory/[id]/` return 404 at runtime, despite being:
- ✅ Registered in Nitro manifest
- ✅ Compiled to `.mjs` files
- ✅ Present in Docker image

## Affected Endpoints
- `/api/inventory/:id/consume` (created Feb 19)
- `/api/inventory/:id/maturity` (created Feb 19)
- `/api/inventory/:id/tasting-notes` (created Feb 19)
- `/api/inventory/:id/transfer` (created Mar 6)
- `/api/inventory/:id/transfer-space` (created Mar 7)
- `/api/inventory/:id/unassign` (created Mar 7)

## Working Endpoints
- `/api/inventory` (GET)
- `/api/inventory/:id` (GET, PATCH, DELETE)
- `/api/inventory/cards` (GET)
- `/api/inventory/search` (GET)
- `/api/history/consume` (POST)

## Evidence
```bash
# Routes ARE in Nitro manifest:
$ docker exec wine-cellar cat /app/.output/server/chunks/nitro/nitro.mjs | grep "inventory/:id"
{ route: '/api/inventory/:id/consume', handler: _lazy_fOo1Sk, lazy: true, middleware: false, method: "post" },
{ route: '/api/inventory/:id/unassign', handler: _lazy_8eSNro, lazy: true, middleware: false, method: "post" },
# ... etc

# But they return 404:
$ curl -X POST -H "Authorization: Bearer TOKEN" http://127.0.0.1:3000/api/inventory/723/consume
{"statusCode":404,"statusMessage":"Page not found: /api/inventory/723/consume"}
```

## Tested Solutions (Failed)
- [x] Force rebuild with `--no-cache`
- [x] Complete container restart (`docker compose down && up`)
- [x] Check file permissions
- [x] Verify Nitro route manifest

## Next Steps
1. Check Nuxt version for known routing bugs
2. Try restructuring directory (flatten to `/api/inventory-[id]-consume.post.ts`?)
3. Enable Nitro debug logging
4. Test with minimal reproduction case
5. File issue with Nuxt if reproducible

## Workaround
Move affected endpoints to top-level or different structure until routing is fixed.

## Date
March 7, 2026
