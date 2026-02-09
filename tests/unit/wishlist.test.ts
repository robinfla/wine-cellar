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

type InsertBuilder = {
  values: ReturnType<typeof vi.fn>
}

type SelectBuilder = {
  from: ReturnType<typeof vi.fn>
  leftJoin: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
}

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
}

vi.mock('~/server/utils/db', () => ({
  db: mockDb,
}))

const mockGetQuery = vi.fn()
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
vi.stubGlobal('getQuery', mockGetQuery)
vi.stubGlobal('readBody', mockReadBody)
vi.stubGlobal('getRouterParam', mockGetRouterParam)

const createEvent = ({ userId }: { userId?: number } = {}): HandlerEvent => {
  return {
    context: {
      user: userId ? { id: userId } : undefined,
    },
  }
}

const createSelectChain = ({ resolvedValue }: { resolvedValue: unknown }) => {
  const chain: SelectBuilder = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  }

  chain.from.mockReturnValue(chain)
  chain.leftJoin.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.orderBy.mockResolvedValue(resolvedValue)

  return chain
}

const createDeleteChain = ({ resolvedValue }: { resolvedValue?: unknown } = {}) => {
  const where = vi.fn().mockResolvedValue(resolvedValue)

  return {
    where,
  }
}

const createInsertChain = ({ returned }: { returned: unknown[] }): InsertBuilder => {
  const returning = vi.fn().mockResolvedValue(returned)
  const values = vi.fn().mockReturnValue({
    returning,
  })

  return {
    values,
  }
}

describe('wishlist endpoints', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetQuery.mockReturnValue({})
    mockReadBody.mockResolvedValue({})
    mockGetRouterParam.mockReturnValue(undefined)
  })

  describe('POST /api/wishlist', () => {
    it('returns 401 when unauthenticated', async () => {
      const { default: handler } = await import('~/server/api/wishlist/index.post')

      await expect(handler(createEvent() as never)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Unauthorized',
      })
    })

    it('creates wine wishlist item successfully', async () => {
      const returnedItem = {
        id: 10,
        itemType: 'wine',
        name: 'Test Wine',
      }
      const insertChain = createInsertChain({ returned: [returnedItem] })
      mockDb.insert.mockReturnValue(insertChain)
      mockReadBody.mockResolvedValue({
        itemType: 'wine',
        name: 'Test Wine',
        wineId: 5,
      })

      const { default: handler } = await import('~/server/api/wishlist/index.post')
      const result = await handler(createEvent({ userId: 7 }) as never)

      expect(result).toEqual(returnedItem)
      expect(mockDb.insert).toHaveBeenCalledTimes(1)
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          itemType: 'wine',
          name: 'Test Wine',
          wineId: 5,
          userId: 7,
        }),
      )
    })

    it('creates producer wishlist item successfully', async () => {
      const returnedItem = {
        id: 11,
        itemType: 'producer',
        name: 'Producer Name',
      }
      const insertChain = createInsertChain({ returned: [returnedItem] })
      mockDb.insert.mockReturnValue(insertChain)
      mockReadBody.mockResolvedValue({
        itemType: 'producer',
        name: 'Producer Name',
        producerId: 3,
      })

      const { default: handler } = await import('~/server/api/wishlist/index.post')
      const result = await handler(createEvent({ userId: 9 }) as never)

      expect(result).toEqual(returnedItem)
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          itemType: 'producer',
          name: 'Producer Name',
          producerId: 3,
          userId: 9,
        }),
      )
    })

    it('returns 400 for invalid body (missing name)', async () => {
      mockReadBody.mockResolvedValue({
        itemType: 'wine',
      })

      const { default: handler } = await import('~/server/api/wishlist/index.post')

      await expect(handler(createEvent({ userId: 1 }) as never)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid wishlist item data',
      })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid itemType', async () => {
      mockReadBody.mockResolvedValue({
        itemType: 'region',
        name: 'Invalid Type',
      })

      const { default: handler } = await import('~/server/api/wishlist/index.post')

      await expect(handler(createEvent({ userId: 1 }) as never)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid wishlist item data',
      })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/wishlist', () => {
    it('returns 401 when unauthenticated', async () => {
      const { default: handler } = await import('~/server/api/wishlist/index.get')

      await expect(handler(createEvent() as never)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Unauthorized',
      })
    })

    it('returns wishlist items for user', async () => {
      const items = [{ id: 1, name: 'Wishlist Wine' }]
      const selectChain = createSelectChain({ resolvedValue: items })
      mockDb.select.mockReturnValue(selectChain)

      const { default: handler } = await import('~/server/api/wishlist/index.get')
      const result = await handler(createEvent({ userId: 3 }) as never)

      expect(result).toEqual(items)
      expect(mockDb.select).toHaveBeenCalledTimes(1)
      expect(selectChain.where).toHaveBeenCalledTimes(1)
    })

    it('filters by itemType when provided', async () => {
      const items = [{ id: 2, itemType: 'producer' }]
      const selectChain = createSelectChain({ resolvedValue: items })
      mockDb.select.mockReturnValue(selectChain)
      mockGetQuery.mockReturnValue({ itemType: 'producer' })

      const { default: handler } = await import('~/server/api/wishlist/index.get')
      const result = await handler(createEvent({ userId: 4 }) as never)

      expect(result).toEqual(items)
      expect(mockGetQuery).toHaveBeenCalledTimes(1)
      expect(selectChain.where).toHaveBeenCalledTimes(1)
    })
  })

  describe('DELETE /api/wishlist/:id', () => {
    it('returns 401 when unauthenticated', async () => {
      const { default: handler } = await import('~/server/api/wishlist/[id].delete')

      await expect(handler(createEvent() as never)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Unauthorized',
      })
    })

    it('returns 400 for invalid id (NaN)', async () => {
      mockGetRouterParam.mockReturnValue('abc')

      const { default: handler } = await import('~/server/api/wishlist/[id].delete')

      await expect(handler(createEvent({ userId: 1 }) as never)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid wishlist item ID',
      })
    })

    it('returns 404 for non-existent item', async () => {
      mockGetRouterParam.mockReturnValue('99')

      const selectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      })
      mockDb.select.mockReturnValue({
        from: selectFrom,
      })

      const { default: handler } = await import('~/server/api/wishlist/[id].delete')

      await expect(handler(createEvent({ userId: 5 }) as never)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Wishlist item not found',
      })
      expect(mockDb.delete).not.toHaveBeenCalled()
    })

    it('deletes item successfully', async () => {
      mockGetRouterParam.mockReturnValue('13')

      const selectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 13, userId: 5 }]),
      })
      mockDb.select.mockReturnValue({
        from: selectFrom,
      })

      const deleteChain = createDeleteChain()
      mockDb.delete.mockReturnValue(deleteChain)

      const { default: handler } = await import('~/server/api/wishlist/[id].delete')
      const result = await handler(createEvent({ userId: 5 }) as never)

      expect(result).toEqual({ success: true })
      expect(mockDb.delete).toHaveBeenCalledTimes(1)
      expect(deleteChain.where).toHaveBeenCalledTimes(1)
    })
  })
})
