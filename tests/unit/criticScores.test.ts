import { beforeEach, describe, expect, it, vi } from 'vitest'

interface MockError extends Error {
  statusCode?: number
  data?: unknown
}

type HandlerEvent = {
  context: {
    user?: {
      id: number
    }
  }
}

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
}

vi.mock('~/server/utils/db', () => ({
  db: mockDb,
}))

const mockReadBody = vi.fn()
const mockGetRouterParam = vi.fn()

const mockCreateError = vi.fn(
  ({ statusCode, message, data }: { statusCode: number, message: string, data?: unknown }) => {
    const error = new Error(message) as MockError
    error.statusCode = statusCode
    error.data = data
    return error
  },
)

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', mockCreateError)
vi.stubGlobal('readBody', mockReadBody)
vi.stubGlobal('getRouterParam', mockGetRouterParam)

const createEvent = ({ userId }: { userId?: number } = {}): HandlerEvent => {
  return {
    context: {
      user: userId ? { id: userId } : undefined,
    },
  }
}

const createSelectQuery = ({ result }: { result: unknown[] }) => {
  const where = vi.fn().mockResolvedValue(result)
  const from = vi.fn().mockReturnValue({ where })

  return {
    from,
    where,
  }
}

const createInsertChain = ({ returned }: { returned: unknown[] }) => {
  const returning = vi.fn().mockResolvedValue(returned)
  const values = vi.fn().mockReturnValue({ returning })

  return {
    values,
    returning,
  }
}

const createDeleteChain = () => {
  const where = vi.fn().mockResolvedValue(undefined)

  return {
    where,
  }
}

describe('critic scores endpoints', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockReadBody.mockResolvedValue({})
    mockGetRouterParam.mockReturnValue(undefined)
  })

  describe('POST /api/wines/:wineId/critic-scores', () => {
    it('returns 401 when unauthenticated', async () => {
      const { default: handler } = await import('~/server/api/wines/[wineId]/critic-scores.post')

      await expect(handler(createEvent() as never)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Unauthorized',
      })
    })

    it('returns 400 for invalid wineId (NaN)', async () => {
      mockGetRouterParam.mockReturnValue('abc')

      const { default: handler } = await import('~/server/api/wines/[wineId]/critic-scores.post')

      await expect(handler(createEvent({ userId: 2 }) as never)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid wine ID',
      })
    })

    it('returns 404 when wine not found or does not belong to user', async () => {
      mockGetRouterParam.mockReturnValue('4')
      const wineSelect = createSelectQuery({ result: [] })
      mockDb.select.mockReturnValue(wineSelect)

      const { default: handler } = await import('~/server/api/wines/[wineId]/critic-scores.post')

      await expect(handler(createEvent({ userId: 2 }) as never)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Wine not found',
      })
    })

    it('creates critic score successfully', async () => {
      mockGetRouterParam.mockReturnValue('4')
      const wineSelect = createSelectQuery({ result: [{ id: 4 }] })
      mockDb.select.mockReturnValue(wineSelect)

      const saved = {
        id: 8,
        wineId: 4,
        critic: 'vinous',
        score: 95,
      }
      const insertChain = createInsertChain({ returned: [saved] })
      mockDb.insert.mockReturnValue(insertChain)
      mockReadBody.mockResolvedValue({
        critic: 'vinous',
        score: 95,
        vintage: 2018,
      })

      const { default: handler } = await import('~/server/api/wines/[wineId]/critic-scores.post')
      const result = await handler(createEvent({ userId: 2 }) as never)

      expect(result).toEqual(saved)
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          wineId: 4,
          critic: 'vinous',
          score: 95,
          vintage: 2018,
        }),
      )
    })

    it('returns 400 for invalid body (score out of range)', async () => {
      mockGetRouterParam.mockReturnValue('4')
      const wineSelect = createSelectQuery({ result: [{ id: 4 }] })
      mockDb.select.mockReturnValue(wineSelect)
      mockReadBody.mockResolvedValue({
        critic: 'vinous',
        score: 101,
      })

      const { default: handler } = await import('~/server/api/wines/[wineId]/critic-scores.post')

      await expect(handler(createEvent({ userId: 2 }) as never)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid critic score data',
      })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('returns 409 for duplicate wine/vintage/critic combo', async () => {
      mockGetRouterParam.mockReturnValue('4')
      const wineSelect = createSelectQuery({ result: [{ id: 4 }] })
      mockDb.select.mockReturnValue(wineSelect)
      mockReadBody.mockResolvedValue({
        critic: 'vinous',
        score: 97,
      })

      const returning = vi.fn().mockRejectedValue({ code: '23505' })
      const values = vi.fn().mockReturnValue({ returning })
      mockDb.insert.mockReturnValue({ values })

      const { default: handler } = await import('~/server/api/wines/[wineId]/critic-scores.post')

      await expect(handler(createEvent({ userId: 2 }) as never)).rejects.toMatchObject({
        statusCode: 409,
        message: 'Score already exists for this wine/vintage/critic combination',
      })
    })
  })

  describe('DELETE /api/critic-scores/:id', () => {
    it('returns 401 when unauthenticated', async () => {
      const { default: handler } = await import('~/server/api/critic-scores/[id].delete')

      await expect(handler(createEvent() as never)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Unauthorized',
      })
    })

    it('returns 400 for invalid id (NaN)', async () => {
      mockGetRouterParam.mockReturnValue('abc')

      const { default: handler } = await import('~/server/api/critic-scores/[id].delete')

      await expect(handler(createEvent({ userId: 4 }) as never)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid critic score ID',
      })
    })

    it('returns 404 for non-existent score', async () => {
      mockGetRouterParam.mockReturnValue('3')
      const scoreSelect = createSelectQuery({ result: [] })
      mockDb.select.mockReturnValueOnce(scoreSelect)

      const { default: handler } = await import('~/server/api/critic-scores/[id].delete')

      await expect(handler(createEvent({ userId: 4 }) as never)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Critic score not found',
      })
      expect(mockDb.delete).not.toHaveBeenCalled()
    })

    it('returns 404 when wine does not belong to user', async () => {
      mockGetRouterParam.mockReturnValue('3')
      const scoreSelect = createSelectQuery({ result: [{ id: 3, wineId: 11 }] })
      const wineSelect = createSelectQuery({ result: [] })
      mockDb.select.mockReturnValueOnce(scoreSelect).mockReturnValueOnce(wineSelect)

      const { default: handler } = await import('~/server/api/critic-scores/[id].delete')

      await expect(handler(createEvent({ userId: 4 }) as never)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Critic score not found',
      })
      expect(mockDb.delete).not.toHaveBeenCalled()
    })

    it('deletes score successfully', async () => {
      mockGetRouterParam.mockReturnValue('3')
      const scoreSelect = createSelectQuery({ result: [{ id: 3, wineId: 11 }] })
      const wineSelect = createSelectQuery({ result: [{ id: 11 }] })
      mockDb.select.mockReturnValueOnce(scoreSelect).mockReturnValueOnce(wineSelect)
      const deleteChain = createDeleteChain()
      mockDb.delete.mockReturnValue(deleteChain)

      const { default: handler } = await import('~/server/api/critic-scores/[id].delete')
      const result = await handler(createEvent({ userId: 4 }) as never)

      expect(result).toEqual({ success: true })
      expect(mockDb.delete).toHaveBeenCalledTimes(1)
      expect(deleteChain.where).toHaveBeenCalledTimes(1)
    })
  })
})
