import { db } from '~/server/utils/db'
import { invitations, users } from '~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user
  if (!currentUser?.isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const allInvitations = await db
    .select({
      id: invitations.id,
      code: invitations.code,
      email: invitations.email,
      usedAt: invitations.usedAt,
      usedByUserId: invitations.usedByUserId,
      usedByEmail: users.email,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .leftJoin(users, eq(invitations.usedByUserId, users.id))
    .orderBy(invitations.createdAt)

  return allInvitations
})
