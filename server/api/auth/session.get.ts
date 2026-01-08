import { getSessionToken, validateSession } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const token = getSessionToken(event)

  if (!token) {
    return { user: null }
  }

  const session = await validateSession(token)

  if (!session) {
    return { user: null }
  }

  return {
    user: session.user,
  }
})
