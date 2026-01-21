import { eq } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import { invitations } from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user
  if (!currentUser?.isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid invitation ID',
    })
  }

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, id))

  if (!invitation) {
    throw createError({
      statusCode: 404,
      message: 'Invitation not found',
    })
  }

  if (invitation.usedAt) {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete a used invitation',
    })
  }

  await db.delete(invitations).where(eq(invitations.id, id))

  return { success: true }
})
