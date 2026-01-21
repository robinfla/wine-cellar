import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { users, invitations, cellars } from '~/server/db/schema'
import { hashPassword } from '~/server/utils/auth'
import { createSession, setSessionCookie } from '~/server/utils/session'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  inviteCode: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid registration data',
      data: parsed.error.flatten(),
    })
  }

  const { email, password, name, inviteCode } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(and(
      eq(invitations.code, inviteCode),
      isNull(invitations.usedAt),
    ))

  if (!invitation) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired invitation code',
    })
  }

  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired invitation code',
    })
  }

  if (invitation.email && invitation.email.toLowerCase() !== normalizedEmail) {
    throw createError({
      statusCode: 400,
      message: 'This invitation is for a different email address',
    })
  }

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))

  if (existingUser) {
    throw createError({
      statusCode: 400,
      message: 'An account with this email already exists',
    })
  }

  const passwordHash = await hashPassword(password)

  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      passwordHash,
      name: name || null,
    })
    .returning()

  await db
    .update(invitations)
    .set({
      usedAt: new Date(),
      usedByUserId: user.id,
    })
    .where(eq(invitations.id, invitation.id))

  await db
    .insert(cellars)
    .values({
      userId: user.id,
      name: 'My Cellar',
      countryCode: 'FR',
      isVirtual: false,
    })

  const sessionToken = await createSession(user.id)
  setSessionCookie(event, sessionToken)

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      preferredCurrency: user.preferredCurrency,
    },
  }
})
