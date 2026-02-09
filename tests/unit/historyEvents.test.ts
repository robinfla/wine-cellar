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

type EventsSelectChain = {
  from: ReturnType<typeof vi.fn>
  innerJoin: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  offset: ReturnType<typeof vi.fn>
}

type CountSelectChain = {
  from: ReturnType<typeof vi.fn>
  innerJoin: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
}

const mockDb = {
  select: vi.fn(),
}

vi.mock('~/server/utils/db', () => ({
  db: mockDb,
}))

const mockGetQuery = vi.fn()

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

const createEvent = ({ userId }: { userId?: number } = {}): HandlerEvent => {
  return {
    context: {
      user: userId ? { id: userId } : undefined,
    },
  }
}

const createEventsSelectChain = ({ result }: { result: unknown[] }): EventsSelectChain => {
  const chain: EventsSelectChain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  }

  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.orderBy.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.offset.mockResolvedValue(result)

  return chain
}

const createCountSelectChain = ({ count }: { count: string | number }): CountSelectChain => {
  const chain: CountSelectChain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
  }

  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.where.mockResolvedValue([{ count }])

  return chain
}

describe('history events endpoint', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetQuery.mockReturnValue({})
  })

  it('returns 401 when unauthenticated', async () => {
    const { default: handler } = await import('~/server/api/inventory/events.get')

    await expect(handler(createEvent() as never)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Unauthorized',
    })
  })

  it('returns events with pagination info', async () => {
    const events = [{ id: 1, eventType: 'purchase' }]
    const eventsChain = createEventsSelectChain({ result: events })
    const countChain = createCountSelectChain({ count: '1' })
    mockDb.select.mockReturnValueOnce(eventsChain).mockReturnValueOnce(countChain)

    const { default: handler } = await import('~/server/api/inventory/events.get')
    const result = await handler(createEvent({ userId: 6 }) as never)

    expect(result).toEqual({
      events,
      total: 1,
      limit: 50,
      offset: 0,
    })
  })

  it('filters by eventType when provided', async () => {
    mockGetQuery.mockReturnValue({ eventType: 'consumption' })
    const events = [{ id: 4, eventType: 'consumption' }]
    const eventsChain = createEventsSelectChain({ result: events })
    const countChain = createCountSelectChain({ count: 1 })
    mockDb.select.mockReturnValueOnce(eventsChain).mockReturnValueOnce(countChain)

    const { default: handler } = await import('~/server/api/inventory/events.get')
    const result = await handler(createEvent({ userId: 6 }) as never)

    expect(result.events).toEqual(events)
    expect(mockGetQuery).toHaveBeenCalledTimes(1)
    expect(eventsChain.where).toHaveBeenCalledTimes(1)
    expect(countChain.where).toHaveBeenCalledTimes(1)
  })

  it('uses default limit/offset when not provided', async () => {
    const eventsChain = createEventsSelectChain({ result: [] })
    const countChain = createCountSelectChain({ count: 0 })
    mockDb.select.mockReturnValueOnce(eventsChain).mockReturnValueOnce(countChain)

    const { default: handler } = await import('~/server/api/inventory/events.get')
    const result = await handler(createEvent({ userId: 6 }) as never)

    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
    expect(eventsChain.limit).toHaveBeenCalledWith(50)
    expect(eventsChain.offset).toHaveBeenCalledWith(0)
  })

  it('uses custom limit/offset when provided', async () => {
    mockGetQuery.mockReturnValue({ limit: '25', offset: '10' })
    const eventsChain = createEventsSelectChain({ result: [] })
    const countChain = createCountSelectChain({ count: 0 })
    mockDb.select.mockReturnValueOnce(eventsChain).mockReturnValueOnce(countChain)

    const { default: handler } = await import('~/server/api/inventory/events.get')
    const result = await handler(createEvent({ userId: 6 }) as never)

    expect(result.limit).toBe(25)
    expect(result.offset).toBe(10)
    expect(eventsChain.limit).toHaveBeenCalledWith(25)
    expect(eventsChain.offset).toHaveBeenCalledWith(10)
  })
})
