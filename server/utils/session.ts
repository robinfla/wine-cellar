import { randomBytes } from 'crypto'
import type { H3Event } from 'h3'
import { getCookie, setCookie, deleteCookie } from 'h3'
import { eq, and, gt } from 'drizzle-orm'
import { db } from './db'
import { sessions, users } from '../db/schema'

const SESSION_COOKIE_NAME = 'wine_session'
const SESSION_EXPIRY_DAYS = 30

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: number): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS)

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
  })

  return token
}

/**
 * Validate a session token and return the associated user
 */
export async function validateSession(token: string) {
  const result = await db
    .select({
      session: sessions,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        isAdmin: users.isAdmin,
        preferredCurrency: users.preferredCurrency,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.id, token),
      gt(sessions.expiresAt, new Date()),
    ))
    .limit(1)

  if (result.length === 0) {
    return null
  }

  return result[0]
}

/**
 * Invalidate a session
 */
export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token))
}

/**
 * Get session token from request cookies
 */
export function getSessionToken(event: H3Event): string | null {
  return getCookie(event, SESSION_COOKIE_NAME) || null
}

/**
 * Set session cookie
 */
export function setSessionCookie(event: H3Event, token: string): void {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS)

  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}
