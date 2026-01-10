import { eq, gt } from 'drizzle-orm'
import { db } from '~/server/utils/db'
import {
  inventoryLots,
  wines,
  producers,
  appellations,
  regions,
  cellars,
  formats,
} from '~/server/db/schema'

export default defineEventHandler(async (event) => {
  // Get all inventory with details
  const lots = await db
    .select({
      cellar: cellars.name,
      producer: producers.name,
      wineName: wines.name,
      color: wines.color,
      region: regions.name,
      appellation: appellations.name,
      vintage: inventoryLots.vintage,
      format: formats.name,
      quantity: inventoryLots.quantity,
      purchaseDate: inventoryLots.purchaseDate,
      purchasePricePerBottle: inventoryLots.purchasePricePerBottle,
      purchaseCurrency: inventoryLots.purchaseCurrency,
      purchaseSource: inventoryLots.purchaseSource,
      notes: inventoryLots.notes,
    })
    .from(inventoryLots)
    .innerJoin(wines, eq(inventoryLots.wineId, wines.id))
    .innerJoin(producers, eq(wines.producerId, producers.id))
    .innerJoin(cellars, eq(inventoryLots.cellarId, cellars.id))
    .innerJoin(formats, eq(inventoryLots.formatId, formats.id))
    .leftJoin(appellations, eq(wines.appellationId, appellations.id))
    .leftJoin(regions, eq(producers.regionId, regions.id))
    .where(gt(inventoryLots.quantity, 0))

  // Build CSV
  const headers = [
    'Cellar',
    'Producer',
    'Wine Name',
    'Color',
    'Region',
    'Appellation',
    'Vintage',
    'Format',
    'Quantity',
    'Purchase Date',
    'Price per Bottle',
    'Currency',
    'Purchase Source',
    'Notes',
  ]

  const rows = lots.map(lot => [
    lot.cellar,
    lot.producer,
    lot.wineName,
    lot.color,
    lot.region || '',
    lot.appellation || '',
    lot.vintage || 'NV',
    lot.format,
    lot.quantity,
    lot.purchaseDate ? new Date(lot.purchaseDate).toISOString().split('T')[0] : '',
    lot.purchasePricePerBottle || '',
    lot.purchaseCurrency || '',
    lot.purchaseSource || '',
    lot.notes || '',
  ])

  // Escape CSV values
  const escapeCSV = (value: any) => {
    const str = String(value ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n')

  // Set response headers for CSV download
  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="wine-inventory-${new Date().toISOString().split('T')[0]}.csv"`)

  return csv
})
