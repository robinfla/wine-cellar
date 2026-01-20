import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'

vi.stubGlobal('useRuntimeConfig', () => ({
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
}))

beforeAll(async () => {
})

afterAll(async () => {
})

beforeEach(async () => {
})

afterEach(async () => {
})
