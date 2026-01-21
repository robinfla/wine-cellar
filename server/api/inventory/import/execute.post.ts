import { z } from 'zod'
import { executeImport, type ValidatedRow } from '~/server/services/import.service'

const executeSchema = z.object({
  rows: z.array(z.any()),
  skipDuplicates: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const body = await readBody(event)

  const parsed = executeSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid import data',
      data: parsed.error.flatten(),
    })
  }

  const validRows = (parsed.data.rows as ValidatedRow[]).filter((r) => r.isValid)

  if (validRows.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No valid rows to import',
    })
  }

  const result = await executeImport(validRows, userId, parsed.data.skipDuplicates)

  return result
})
