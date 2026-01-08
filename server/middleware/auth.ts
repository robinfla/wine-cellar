import { getSessionToken, validateSession } from '~/server/utils/session'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/session',
  '/api/health',
]

export default defineEventHandler(async (event) => {
  const path = event.path

  // Skip middleware for non-API routes
  if (!path.startsWith('/api/')) {
    return
  }

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some(route => path.startsWith(route))) {
    return
  }

  const token = getSessionToken(event)

  if (!token) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required',
    })
  }

  const session = await validateSession(token)

  if (!session) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired session',
    })
  }

  // Attach user to event context for use in route handlers
  event.context.user = session.user
  event.context.session = session.session
})
