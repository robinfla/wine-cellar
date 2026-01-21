import { z } from 'zod'
import { randomBytes } from 'crypto'
import { db } from '~/server/utils/db'
import { invitations } from '~/server/db/schema'

const createSchema = z.object({
  email: z.string().email().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

function generateInviteCode(): string {
  return randomBytes(6).toString('hex').toUpperCase()
}

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user
  if (!currentUser?.isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const body = await readBody(event)

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid invitation data',
      data: parsed.error.flatten(),
    })
  }

  const code = generateInviteCode()
  let expiresAt: Date | null = null

  if (parsed.data.expiresInDays) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + parsed.data.expiresInDays)
  }

  const [invitation] = await db
    .insert(invitations)
    .values({
      code,
      email: parsed.data.email || null,
      expiresAt,
    })
    .returning()

  return invitation
})
