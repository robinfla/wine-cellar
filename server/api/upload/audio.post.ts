import { defineEventHandler, readMultipartFormData, createError } from 'h3'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  // Authentication check
  const userId = event.context.userId
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file uploaded',
    })
  }

  const audioFile = formData.find(item => item.name === 'audio')
  if (!audioFile || !audioFile.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Audio file is required',
    })
  }

  // Generate unique filename
  const fileExt = audioFile.filename?.split('.').pop() || 'm4a'
  const filename = `${randomUUID()}.${fileExt}`
  const filepath = join(process.cwd(), 'public', 'uploads', 'audio', filename)

  // Save file
  await writeFile(filepath, audioFile.data)

  // TODO: Get audio duration (optional, can use ffprobe if available)
  const duration = 0 // Placeholder - mobile will send this

  return {
    url: `/uploads/audio/${filename}`,
    duration,
  }
})
