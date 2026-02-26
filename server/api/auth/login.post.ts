import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { users } from '~/server/db/schema'
import { verifyPassword } from '~/server/utils/auth'
import { createSession, setSessionCookie } from '~/server/utils/session'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid email or password format',
    })
  }

  const { email, password } = parsed.data

  // DEV BYPASS: Login with any credentials if password is "dev"
  if (password === 'dev') {
    const firstUser = await db.select().from(users).limit(1)
    if (firstUser.length > 0) {
      const sessionToken = await createSession(firstUser[0].id)
      setSessionCookie(event, sessionToken)
      return {
        token: sessionToken,
        user: {
          id: firstUser[0].id,
          email: firstUser[0].email,
          name: firstUser[0].name,
          isAdmin: firstUser[0].isAdmin,
          preferredCurrency: firstUser[0].preferredCurrency,
        },
      }
    }
  }

  // Find user by email
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  if (user.length === 0) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password',
    })
  }

  // Verify password
  const isValid = await verifyPassword(user[0].passwordHash, password)
  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password',
    })
  }

  const sessionToken = await createSession(user[0].id)
  setSessionCookie(event, sessionToken)

  return {
    token: sessionToken,
    user: {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
      isAdmin: user[0].isAdmin,
      preferredCurrency: user[0].preferredCurrency,
    },
  }
})
