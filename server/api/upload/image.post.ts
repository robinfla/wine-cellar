import { defineEventHandler, readMultipartFormData, createError } from 'h3'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

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

  const imageFile = formData.find(item => item.name === 'image')
  if (!imageFile || !imageFile.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Image file is required',
    })
  }

  // Generate unique filename
  const filename = `${randomUUID()}.jpg`
  const thumbnailFilename = `${randomUUID()}.jpg`
  
  const imagePath = join(process.cwd(), 'public', 'uploads', 'images', filename)
  const thumbnailPath = join(process.cwd(), 'public', 'uploads', 'thumbnails', thumbnailFilename)

  // Process image with sharp
  const image = sharp(imageFile.data)
  const metadata = await image.metadata()

  // Resize and compress main image (max 1920px width, 85% quality)
  await image
    .resize(1920, null, { 
      withoutEnlargement: true,
      fit: 'inside',
    })
    .jpeg({ quality: 85 })
    .toFile(imagePath)

  // Generate thumbnail (max 400px width)
  await sharp(imageFile.data)
    .resize(400, null, {
      withoutEnlargement: true,
      fit: 'inside',
    })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath)

  return {
    url: `/uploads/images/${filename}`,
    thumbnailUrl: `/uploads/thumbnails/${thumbnailFilename}`,
    width: metadata.width || 0,
    height: metadata.height || 0,
  }
})
