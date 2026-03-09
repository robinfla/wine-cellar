#!/usr/bin/env node
/**
 * Taste Profile Engine v1
 * Analyzes a user's cellar to generate a structured taste profile.
 * 
 * Signals used (in order of strength):
 * 1. Ratings + tasting notes (strongest signal — explicit preference) [none yet for Robin]
 * 2. Consumption history (chose to drink it — implicit preference)
 * 3. Quantity owned (bought more = likes more)
 * 4. Diversity of producers/appellations (exploration vs loyalty)
 * 5. Cellar composition patterns (color, region, vintage spread)
 */

import pg from 'pg';
const { Client } = pg;

const DB_URL = process.env.DATABASE_URL || 'postgresql://wine:password@localhost:5435/wine_cellar';
const USER_ID = parseInt(process.argv[2] || '1');

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  // 1. Overall stats
  const { rows: [stats] } = await client.query(`
    SELECT count(*) as lots, sum(quantity) as bottles, count(DISTINCT wine_id) as unique_wines,
      min(vintage) as oldest, max(vintage) as newest
    FROM inventory_lots WHERE user_id = $1 AND quantity > 0
  `, [USER_ID]);

  // 2. Color distribution
  const { rows: colors } = await client.query(`
    SELECT w.color::text, sum(il.quantity) as bottles
    FROM inventory_lots il JOIN wines w ON il.wine_id = w.id
    WHERE il.user_id = $1 AND il.quantity > 0
    GROUP BY w.color ORDER BY bottles DESC
  `, [USER_ID]);

  const totalBottles = colors.reduce((s, r) => s + parseInt(r.bottles), 0);
  const colorProfile = {};
  for (const r of colors) {
    colorProfile[r.color] = {
      bottles: parseInt(r.bottles),
      pct: Math.round(parseInt(r.bottles) / totalBottles * 100)
    };
  }

  // 3. Top producers (loyalty signal)
  const { rows: producers } = await client.query(`
    SELECT p.name, sum(il.quantity) as bottles, count(*) as lots,
      string_agg(DISTINCT w.color::text, ', ') as colors
    FROM inventory_lots il JOIN wines w ON il.wine_id = w.id
    JOIN producers p ON w.producer_id = p.id
    WHERE il.user_id = $1 AND il.quantity > 0
    GROUP BY p.name ORDER BY bottles DESC LIMIT 20
  `, [USER_ID]);

  // 4. Appellation distribution (region preference)
  const { rows: appellations } = await client.query(`
    SELECT a.name, w.color::text, sum(il.quantity) as bottles
    FROM inventory_lots il JOIN wines w ON il.wine_id = w.id
    LEFT JOIN appellations a ON w.appellation_id = a.id
    WHERE il.user_id = $1 AND il.quantity > 0 AND a.name IS NOT NULL
    GROUP BY a.name, w.color ORDER BY bottles DESC
  `, [USER_ID]);

  // 5. Vintage spread (aging preference)
  const { rows: vintages } = await client.query(`
    SELECT il.vintage, sum(il.quantity) as bottles
    FROM inventory_lots il
    WHERE il.user_id = $1 AND il.quantity > 0 AND il.vintage IS NOT NULL
    GROUP BY il.vintage ORDER BY il.vintage
  `, [USER_ID]);

  // 6. Cellar distribution
  const { rows: cellars } = await client.query(`
    SELECT c.name, sum(il.quantity) as bottles
    FROM inventory_lots il JOIN cellars c ON il.cellar_id = c.id
    WHERE il.user_id = $1 AND il.quantity > 0
    GROUP BY c.name ORDER BY bottles DESC
  `, [USER_ID]);

  // 7. Consumption history
  const { rows: consumed } = await client.query(`
    SELECT w.name as wine, p.name as producer, w.color::text, il.vintage,
      a.name as appellation, ie.rating, ie.tasting_notes, ie.event_date
    FROM inventory_events ie
    JOIN inventory_lots il ON ie.lot_id = il.id
    JOIN wines w ON il.wine_id = w.id
    JOIN producers p ON w.producer_id = p.id
    LEFT JOIN appellations a ON w.appellation_id = a.id
    WHERE ie.event_type = 'consume' AND il.user_id = $1
    ORDER BY ie.event_date DESC
  `, [USER_ID]);

  // 8. Unique producers count (exploration metric)
  const { rows: [prodStats] } = await client.query(`
    SELECT count(DISTINCT p.id) as unique_producers
    FROM inventory_lots il JOIN wines w ON il.wine_id = w.id
    JOIN producers p ON w.producer_id = p.id
    WHERE il.user_id = $1 AND il.quantity > 0
  `, [USER_ID]);

  await client.end();

  // === ANALYSIS ===

  // Region classification
  const regionCategories = categorizeRegions(appellations);

  // Vintage analysis
  const vintageAnalysis = analyzeVintages(vintages);

  // Producer loyalty score
  const loyaltyScore = analyzeLoyalty(producers, parseInt(prodStats.unique_producers), totalBottles);

  // Exploration index (unique wines / total bottles)
  const explorationIndex = Math.round(parseInt(stats.unique_wines) / totalBottles * 100);

  // Build the profile
  const profile = {
    version: 1,
    generated: new Date().toISOString(),
    userId: USER_ID,

    summary: {
      totalBottles,
      uniqueWines: parseInt(stats.unique_wines),
      uniqueProducers: parseInt(prodStats.unique_producers),
      totalConsumed: consumed.length,
      oldestVintage: parseInt(stats.oldest),
      newestVintage: parseInt(stats.newest),
      cellars: cellars.map(c => ({ name: c.name, bottles: parseInt(c.bottles) }))
    },

    colorPreference: colorProfile,

    regionProfile: regionCategories,

    vintageProfile: vintageAnalysis,

    topProducers: producers.slice(0, 15).map(p => ({
      name: p.name,
      bottles: parseInt(p.bottles),
      lots: parseInt(p.lots),
      colors: p.colors
    })),

    loyaltyScore, // 0-100: 0 = total explorer, 100 = buys same producers

    explorationIndex, // higher = more diverse (unique wines / total bottles %)

    consumptionHistory: consumed.map(c => ({
      wine: c.wine,
      producer: c.producer,
      color: c.color,
      vintage: c.vintage,
      appellation: c.appellation,
      rating: c.rating,
      notes: c.tasting_notes,
      date: c.event_date
    })),

    // Derived personality tags
    tags: generateTags(colorProfile, regionCategories, vintageAnalysis, loyaltyScore, explorationIndex, producers)
  };

  console.log(JSON.stringify(profile, null, 2));
}

function categorizeRegions(appellations) {
  const southAfrica = ['Swartland', 'Stellenbosch', 'Franschhoek', 'Paarl', 'Elgin', 'Hemel-en-Aarde', 'Constantia', 'Walker Bay'];
  const bordeaux = ['Haut-Médoc', 'Pauillac', 'Margaux', 'Saint-Julien', 'Saint-Estèphe', 'Pessac-Léognan', 'Saint-Émilion Grand Cru', 'Graves'];
  const rhone = ['Vacqueyras', 'Côtes du Rhône', 'Crozes-Hermitage', 'Saint-Joseph', 'Châteauneuf-du-Pape', 'Gigondas', 'Hermitage'];
  const loire = ['Montlouis-sur-Loire', 'Vouvray', 'Savennières', 'Anjou', 'Muscadet', 'Saumur Champigny', 'Quincy', 'Chinon', 'Bourgueil'];
  const languedoc = ['Terrasses du Larzac', 'Pic Saint-Loup', 'Montagnes de Cucugnan', 'Côtes Catalanes', 'IGP Alpilles', 'Montpeyroux'];
  const provence = ['Palette', 'Bandol', 'Cassis'];
  const burgundy = ['Bourgogne', 'Bourgogne Aligoté', 'Chablis', 'Morgon', 'Pernand-Vergelesses', 'Aloxe-Corton', 'Saint-Véran', 'Mâcon-Villages'];

  const regions = {};
  const classify = (appName) => {
    if (southAfrica.some(a => appName.includes(a))) return 'South Africa';
    if (bordeaux.some(a => appName.includes(a))) return 'Bordeaux';
    if (rhone.some(a => appName.includes(a))) return 'Rhône Valley';
    if (loire.some(a => appName.includes(a))) return 'Loire Valley';
    if (languedoc.some(a => appName.includes(a))) return 'Languedoc-Roussillon';
    if (provence.some(a => appName.includes(a))) return 'Provence';
    if (burgundy.some(a => appName.includes(a))) return 'Burgundy';
    if (appName.includes('Vin de France')) return 'Vin de France';
    if (appName.includes('Alsace')) return 'Alsace';
    if (appName.includes('Valais') || appName.includes('Dézaley')) return 'Switzerland';
    return 'Other';
  };

  for (const a of appellations) {
    const region = classify(a.name);
    if (!regions[region]) regions[region] = { bottles: 0, appellations: [] };
    regions[region].bottles += parseInt(a.bottles);
    const existing = regions[region].appellations.find(x => x.name === a.name);
    if (existing) {
      existing.bottles += parseInt(a.bottles);
    } else {
      regions[region].appellations.push({ name: a.name, color: a.color, bottles: parseInt(a.bottles) });
    }
  }

  // Sort by bottles
  return Object.entries(regions)
    .sort((a, b) => b[1].bottles - a[1].bottles)
    .map(([name, data]) => ({
      region: name,
      bottles: data.bottles,
      appellations: data.appellations.sort((a, b) => b.bottles - a.bottles)
    }));
}

function analyzeVintages(vintages) {
  const currentYear = new Date().getFullYear();
  const buckets = { young: 0, mid: 0, aging: 0, mature: 0 };
  
  for (const v of vintages) {
    const age = currentYear - parseInt(v.vintage);
    const bottles = parseInt(v.bottles);
    if (age <= 2) buckets.young += bottles;
    else if (age <= 5) buckets.mid += bottles;
    else if (age <= 10) buckets.aging += bottles;
    else buckets.mature += bottles;
  }

  const total = Object.values(buckets).reduce((s, v) => s + v, 0);
  return {
    young_0_2y: { bottles: buckets.young, pct: Math.round(buckets.young / total * 100) },
    mid_3_5y: { bottles: buckets.mid, pct: Math.round(buckets.mid / total * 100) },
    aging_6_10y: { bottles: buckets.aging, pct: Math.round(buckets.aging / total * 100) },
    mature_10plus: { bottles: buckets.mature, pct: Math.round(buckets.mature / total * 100) },
    avgVintage: Math.round(vintages.reduce((s, v) => s + parseInt(v.vintage) * parseInt(v.bottles), 0) / total),
    preference: buckets.young + buckets.mid > buckets.aging + buckets.mature ? 'youthful_freshness' : 'aged_complexity'
  };
}

function analyzeLoyalty(producers, uniqueProducers, totalBottles) {
  // Top 5 producers' share of total bottles
  const top5Bottles = producers.slice(0, 5).reduce((s, p) => s + parseInt(p.bottles), 0);
  const concentration = Math.round(top5Bottles / totalBottles * 100);
  return concentration; // 0-100
}

function generateTags(colorProfile, regions, vintages, loyalty, exploration, producers) {
  const tags = [];

  // Color tags
  const redPct = colorProfile.red?.pct || 0;
  const whitePct = colorProfile.white?.pct || 0;
  if (Math.abs(redPct - whitePct) < 10) tags.push('balanced_palate');
  else if (redPct > 65) tags.push('red_dominant');
  else if (whitePct > 65) tags.push('white_dominant');

  // Region tags
  const topRegion = regions[0]?.region;
  if (topRegion === 'South Africa') tags.push('south_africa_enthusiast');
  if (regions.some(r => r.region === 'Bordeaux')) tags.push('bordeaux_collector');
  if (regions.some(r => r.region === 'Rhône Valley')) tags.push('rhone_lover');
  if (regions.some(r => r.region === 'Loire Valley')) tags.push('loire_explorer');
  if (regions.some(r => r.region === 'Burgundy')) tags.push('burgundy_curious');

  // Style tags
  const saProducers = ['The Sadie Family', 'Porseleinberg', 'Mullineux', 'Alheit Vineyards', 'David & Nadia', 'Boekenhoutskloof', 'Storm Wines', 'Savage', 'Restless River'];
  const saCount = producers.filter(p => saProducers.includes(p.name)).length;
  if (saCount >= 5) tags.push('new_wave_south_africa');

  // Vintage tags
  if (vintages.preference === 'youthful_freshness') tags.push('drinks_young');
  else tags.push('patience_for_aging');

  // Loyalty tags
  if (loyalty > 40) tags.push('producer_loyal');
  if (exploration > 25) tags.push('explorer');

  // Producer diversity
  if (producers.every(p => p.colors?.includes(','))) tags.push('full_range_buyer');

  return tags;
}

main().catch(console.error);
