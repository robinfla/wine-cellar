import { z } from 'zod'
import { validateImportRows, type ImportRow } from '~/server/services/import.service'

const importRowSchema = z.object({
  cellar: z.string(),
  producer: z.string(),
  wineName: z.string(),
  color: z.string(),
  region: z.string().optional(),
  appellation: z.string().optional(),
  grapes: z.string().optional(),
  vintage: z.union([z.number(), z.string()]).optional(),
  format: z.string().optional(),
  quantity: z.union([z.number(), z.string()]),
  purchaseDate: z.string().optional(),
  purchasePricePerBottle: z.union([z.number(), z.string()]).optional(),
  purchaseCurrency: z.string().optional(),
  purchaseSource: z.string().optional(),
  notes: z.string().optional(),
})

const validateSchema = z.object({
  rows: z.array(importRowSchema),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = validateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid import data',
      data: parsed.error.flatten(),
    })
  }

  const validated = await validateImportRows(parsed.data.rows as ImportRow[])

  const validCount = validated.filter((r) => r.isValid).length
  const invalidCount = validated.filter((r) => !r.isValid).length
  const duplicateCount = validated.filter((r) => r.isDuplicate).length
  const warningCount = validated.filter((r) => r.warnings.length > 0).length

  return {
    rows: validated,
    summary: {
      total: validated.length,
      valid: validCount,
      invalid: invalidCount,
      duplicates: duplicateCount,
      withWarnings: warningCount,
    },
  }
})
