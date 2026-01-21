import { db } from '~/server/utils/db'
import { users } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user
  if (!currentUser?.isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isAdmin: users.isAdmin,
      preferredCurrency: users.preferredCurrency,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt)

  return allUsers
})
