import {
  getSessionToken,
  invalidateSession,
  clearSessionCookie,
} from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const token = getSessionToken(event)

  if (token) {
    await invalidateSession(token)
  }

  clearSessionCookie(event)

  return { success: true }
})
