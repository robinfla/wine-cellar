import { z } from 'zod'
import { executeImport, type ValidatedRow } from '~/server/services/import.service'

const executeSchema = z.object({
  rows: z.array(z.any()), // Already validated rows from the validate step
  skipDuplicates: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = executeSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid import data',
      data: parsed.error.flatten(),
    })
  }

  // Filter to only valid rows
  const validRows = (parsed.data.rows as ValidatedRow[]).filter((r) => r.isValid)

  if (validRows.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No valid rows to import',
    })
  }

  const result = await executeImport(validRows, parsed.data.skipDuplicates)

  return result
})
