import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || 'postgresql://wine:wine@localhost:5432/wine_cellar'
const queryClient = postgres(connectionString)
const db = drizzle(queryClient, { schema })

async function seed() {
  console.log('Seeding database...')

  // Seed formats
  console.log('Seeding formats...')
  await db.insert(schema.formats).values([
    { name: 'Standard', volumeMl: 750 },
    { name: 'Half', volumeMl: 375 },
    { name: 'Magnum', volumeMl: 1500 },
    { name: 'Double Magnum', volumeMl: 3000 },
    { name: 'Jeroboam', volumeMl: 4500 },
    { name: 'Imperial', volumeMl: 6000 },
  ]).onConflictDoNothing()



  // Seed French regions
  console.log('Seeding regions...')
  const frenchRegions = await db.insert(schema.regions).values([
    { name: 'Bordeaux', countryCode: 'FR' },
    { name: 'Burgundy', countryCode: 'FR' },
    { name: 'Rhône', countryCode: 'FR' },
    { name: 'Loire', countryCode: 'FR' },
    { name: 'Champagne', countryCode: 'FR' },
    { name: 'Alsace', countryCode: 'FR' },
    { name: 'Languedoc', countryCode: 'FR' },
    { name: 'Provence', countryCode: 'FR' },
    { name: 'Jura', countryCode: 'FR' },
    { name: 'Savoie', countryCode: 'FR' },
  ]).onConflictDoNothing().returning()

  // Seed South African regions
  await db.insert(schema.regions).values([
    { name: 'Stellenbosch', countryCode: 'ZA' },
    { name: 'Franschhoek', countryCode: 'ZA' },
    { name: 'Paarl', countryCode: 'ZA' },
    { name: 'Constantia', countryCode: 'ZA' },
    { name: 'Swartland', countryCode: 'ZA' },
    { name: 'Elgin', countryCode: 'ZA' },
    { name: 'Hemel-en-Aarde', countryCode: 'ZA' },
  ]).onConflictDoNothing()

  // Seed other regions
  await db.insert(schema.regions).values([
    { name: 'Barossa Valley', countryCode: 'AU' },
    { name: 'Margaret River', countryCode: 'AU' },
    { name: 'Napa Valley', countryCode: 'US' },
    { name: 'Sonoma', countryCode: 'US' },
    { name: 'Tuscany', countryCode: 'IT' },
    { name: 'Piedmont', countryCode: 'IT' },
    { name: 'Rioja', countryCode: 'ES' },
    { name: 'Ribera del Duero', countryCode: 'ES' },
    { name: 'Mosel', countryCode: 'DE' },
    { name: 'Douro', countryCode: 'PT' },
  ]).onConflictDoNothing()

  // Get Bordeaux region for appellations
  const bordeaux = frenchRegions.find(r => r.name === 'Bordeaux')
  const burgundy = frenchRegions.find(r => r.name === 'Burgundy')
  const rhone = frenchRegions.find(r => r.name === 'Rhône')
  const champagne = frenchRegions.find(r => r.name === 'Champagne')

  // Seed Bordeaux appellations
  console.log('Seeding appellations...')
  if (bordeaux) {
    await db.insert(schema.appellations).values([
      { name: 'Saint-Émilion Grand Cru', regionId: bordeaux.id, level: 'Grand Cru' },
      { name: 'Pauillac', regionId: bordeaux.id, level: 'AOC' },
      { name: 'Margaux', regionId: bordeaux.id, level: 'AOC' },
      { name: 'Saint-Julien', regionId: bordeaux.id, level: 'AOC' },
      { name: 'Pomerol', regionId: bordeaux.id, level: 'AOC' },
      { name: 'Pessac-Léognan', regionId: bordeaux.id, level: 'AOC' },
      { name: 'Sauternes', regionId: bordeaux.id, level: 'AOC' },
      { name: 'Médoc', regionId: bordeaux.id, level: 'AOC' },
      { name: 'Haut-Médoc', regionId: bordeaux.id, level: 'AOC' },
      { name: 'Saint-Estèphe', regionId: bordeaux.id, level: 'AOC' },
      { name: 'Graves', regionId: bordeaux.id, level: 'AOC' },
    ]).onConflictDoNothing()
  }

  // Seed Burgundy appellations
  if (burgundy) {
    await db.insert(schema.appellations).values([
      { name: 'Gevrey-Chambertin', regionId: burgundy.id, level: 'AOC' },
      { name: 'Chambolle-Musigny', regionId: burgundy.id, level: 'AOC' },
      { name: 'Vosne-Romanée', regionId: burgundy.id, level: 'AOC' },
      { name: 'Nuits-Saint-Georges', regionId: burgundy.id, level: 'AOC' },
      { name: 'Pommard', regionId: burgundy.id, level: 'AOC' },
      { name: 'Volnay', regionId: burgundy.id, level: 'AOC' },
      { name: 'Meursault', regionId: burgundy.id, level: 'AOC' },
      { name: 'Puligny-Montrachet', regionId: burgundy.id, level: 'AOC' },
      { name: 'Chassagne-Montrachet', regionId: burgundy.id, level: 'AOC' },
      { name: 'Chablis', regionId: burgundy.id, level: 'AOC' },
      { name: 'Chablis Grand Cru', regionId: burgundy.id, level: 'Grand Cru' },
      { name: 'Corton', regionId: burgundy.id, level: 'Grand Cru' },
      { name: 'Corton-Charlemagne', regionId: burgundy.id, level: 'Grand Cru' },
    ]).onConflictDoNothing()
  }

  // Seed Rhône appellations
  if (rhone) {
    await db.insert(schema.appellations).values([
      { name: 'Côte-Rôtie', regionId: rhone.id, level: 'AOC' },
      { name: 'Hermitage', regionId: rhone.id, level: 'AOC' },
      { name: 'Châteauneuf-du-Pape', regionId: rhone.id, level: 'AOC' },
      { name: 'Gigondas', regionId: rhone.id, level: 'AOC' },
      { name: 'Crozes-Hermitage', regionId: rhone.id, level: 'AOC' },
      { name: 'Saint-Joseph', regionId: rhone.id, level: 'AOC' },
      { name: 'Condrieu', regionId: rhone.id, level: 'AOC' },
    ]).onConflictDoNothing()
  }

  // Seed Champagne appellations
  if (champagne) {
    await db.insert(schema.appellations).values([
      { name: 'Champagne', regionId: champagne.id, level: 'AOC' },
      { name: 'Champagne Grand Cru', regionId: champagne.id, level: 'Grand Cru' },
      { name: 'Champagne Premier Cru', regionId: champagne.id, level: 'Premier Cru' },
    ]).onConflictDoNothing()
  }

  console.log('Seeding grapes...')
  await db.insert(schema.grapes).values([
    { name: 'Cabernet Sauvignon', color: 'red' },
    { name: 'Merlot', color: 'red' },
    { name: 'Pinot Noir', color: 'red' },
    { name: 'Syrah', color: 'red' },
    { name: 'Grenache', color: 'red' },
    { name: 'Mourvèdre', color: 'red' },
    { name: 'Cabernet Franc', color: 'red' },
    { name: 'Malbec', color: 'red' },
    { name: 'Petit Verdot', color: 'red' },
    { name: 'Sangiovese', color: 'red' },
    { name: 'Nebbiolo', color: 'red' },
    { name: 'Tempranillo', color: 'red' },
    { name: 'Pinotage', color: 'red' },
    { name: 'Gamay', color: 'red' },
    { name: 'Cinsault', color: 'red' },
    { name: 'Carignan', color: 'red' },
    { name: 'Red Blend', color: 'red' },

    { name: 'Chardonnay', color: 'white' },
    { name: 'Sauvignon Blanc', color: 'white' },
    { name: 'Riesling', color: 'white' },
    { name: 'Chenin Blanc', color: 'white' },
    { name: 'Sémillon', color: 'white' },
    { name: 'Viognier', color: 'white' },
    { name: 'Gewürztraminer', color: 'white' },
    { name: 'Pinot Gris', color: 'white' },
    { name: 'Pinot Blanc', color: 'white' },
    { name: 'Marsanne', color: 'white' },
    { name: 'Roussanne', color: 'white' },
    { name: 'Muscadet', color: 'white' },
    { name: 'Grüner Veltliner', color: 'white' },
    { name: 'Albariño', color: 'white' },
    { name: 'Vermentino', color: 'white' },
    { name: 'White Blend', color: 'white' },
  ]).onConflictDoNothing()

  console.log('Seeding complete!')
  process.exit(0)
}

seed().catch((e) => {
  console.error('Seeding failed:', e)
  process.exit(1)
})
