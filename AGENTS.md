# AGENTS.md - Wine Cellar App

This document provides guidelines for AI coding agents working on this codebase.

## Tech Stack

- **Frontend**: Nuxt 3 (v3.20.2) with Vue 3
- **Backend**: Hapi server with Objection.js ORM
- **Language**: TypeScript (strict mode enabled)
- **Package Manager**: npm
- **Database**: PostgreSQL 16
- **Validation**: Joi (backend), Zod (frontend)
- **Dates**: date-fns
- **Auth**: Session-based with Argon2 password hashing

## Build & Development Commands

```bash
# Development
npm run dev              # Start development server

# Build
npm run build            # Production build
npm run generate         # Generate static site
npm run preview          # Preview production build

# Database
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:push          # Push schema changes (dev)
npm run db:studio        # Open database GUI

# Testing
npm run test             # Run all tests
npm run test -- path/to/file.test.ts  # Run single test file
npm run test:e2e         # Run Playwright e2e tests
```

## Coding Standards

### Functional Programming

- Use `const` only - never reassign variables
- No classes or `this` keyword
- No imperative loops - use `map`, `filter`, `reduce`
- Single-argument destructuring for functions

```typescript
// Function style
const createWine = ({ name, producerId, color }: CreateWineParams) => {
  // ...
}

// Array operations
const activeWines = wines
  .filter(({ quantity }) => quantity > 0)
  .map(({ name, vintage }) => ({ name, vintage }))
```

### TypeScript

- Strict mode enabled - do not use `any` types
- Define interfaces at the top of files
- No semicolons
- Single quotes for strings
- 2-space indentation
- Trailing commas in multiline structures

### Naming Conventions

| Element              | Convention      | Example                          |
|---------------------|-----------------|----------------------------------|
| Vue components       | PascalCase      | `AddWineModal.vue`, `Button.vue` |
| TypeScript files     | camelCase       | `useAuth.ts`, `handler.ts`       |
| Variables/functions  | camelCase       | `isAuthenticated`, `handleSubmit`|
| Types/interfaces     | PascalCase      | `User`, `CreateWineParams`       |
| DB tables            | snake_case      | `inventory_lots`, `tasting_notes`|

## Backend Route Structure

**Pattern**: `/api/routes/{domain}/endpoints/{action}/`

Each endpoint directory contains:
```
endpoints/{action}/
├── handler.ts      # Business logic with pipeBoom
├── index.ts        # Route definition with Joi validation
├── schemas.ts      # Joi schemas for input/output
├── int.test.ts     # Integration tests (required)
└── unit.test.ts    # Unit tests (optional)
```

### Route Example

```typescript
// schemas.ts
import Joi from 'joi'

export const createWineSchema = Joi.object({
  name: Joi.string().required(),
  producerId: Joi.number().integer().positive().required(),
  color: Joi.string().valid('red', 'white', 'rose').required(),
})

// handler.ts
export const createWineHandler = async ({ name, producerId, color }: CreateWineParams) => {
  const wine = await Wine.query().insert({ name, producerId, color })
  return wine
}

// index.ts
export default {
  method: 'POST',
  path: '/api/wines',
  options: {
    validate: { payload: createWineSchema },
  },
  handler: createWineHandler,
}
```

## Testing (TDD)

**Framework**: @hapi/lab with BDD syntax

### TDD Workflow

1. Write failing test first
2. Implement minimal code to pass
3. Refactor if needed

**Always add tests when creating new endpoints.**

```typescript
// int.test.ts
import { expect } from '@hapi/code'
import Lab from '@hapi/lab'

const { describe, it, before } = exports.lab = Lab.script()

describe('POST /api/wines', () => {
  it('creates a wine successfully', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/wines',
      payload: { name: 'Test Wine', producerId: 1, color: 'red' },
    })
    
    expect(response.statusCode).to.equal(201)
    expect(response.result.name).to.equal('Test Wine')
  })
})
```

## Frontend (Vue/Nuxt)

### Vue Components

- Always use `<script setup lang="ts">` syntax
- Use `definePageMeta()` for page configuration
- Use `withDefaults(defineProps<Props>(), {...})` for typed props
- Rely on Nuxt auto-imports

```vue
<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
})

const isActive = computed(() => !props.disabled)
</script>
```

### Styling

- Use Tailwind CSS utility classes
- Custom color tokens: `primary`, `secondary`, `accent`, `muted`
- Flat design: no shadows, bold borders, scale transitions on hover
- Font classes: `font-display` (Space Grotesk), `font-sans` (IBM Plex Sans)

## Date Handling

Use `date-fns` for all date operations:

```typescript
import { format, addDays, isAfter } from 'date-fns'

const formattedDate = format(new Date(), 'yyyy-MM-dd')
const futureDate = addDays(new Date(), 30)
const isPast = isAfter(new Date(), targetDate)
```

## Error Handling

```typescript
// Backend - use pipeBoom pattern
import Boom from '@hapi/boom'

const handler = async ({ id }: Params) => {
  const wine = await Wine.query().findById(id)
  if (!wine) {
    throw Boom.notFound('Wine not found')
  }
  return wine
}

// Frontend
try {
  const result = await $fetch('/api/endpoint', { method: 'POST', body: data })
} catch (e) {
  console.error('Failed to submit', e)
  error.value = 'Something went wrong'
}
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL=postgresql://wine:password@localhost:5432/wine_cellar
SESSION_SECRET=your-secret-key
NUXT_PUBLIC_APP_URL=http://localhost:3000
```

## Docker Setup

```bash
docker-compose up -d     # Start app + PostgreSQL
docker-compose down      # Stop services
```
