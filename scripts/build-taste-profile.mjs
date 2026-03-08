#!/usr/bin/env node
/**
 * Taste Profile Engine v1
 * Reads pre-exported cellar JSON and generates a structured taste profile.
 */
import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('/tmp/cellar-data.json', 'utf8'));

const totalBottles = data.total_bottles;
const currentYear = 2026;

// === COLOR PROFILE ===
const colorProfile = {};
for (const c of data.colors) {
  colorProfile[c.color] = {
    bottles: c.bottles,
    pct: Math.round(c.bottles / totalBottles * 100)
  };
}

// === REGION CLASSIFICATION ===
const regionMap = {
  'South Africa': ['Swartland', 'Stellenbosch', 'Franschhoek', 'Paarl', 'Elgin', 'Hemel-en-Aarde', 'Constantia', 'Walker Bay'],
  'Bordeaux': ['Haut-Médoc', 'Pauillac', 'Margaux', 'Saint-Julien', 'Saint-Estèphe', 'Pessac-Léognan', 'Saint-Émilion Grand Cru', 'Graves'],
  'Rhône Valley': ['Vacqueyras', 'Côtes du Rhône', 'Crozes-Hermitage', 'Saint-Joseph', 'Châteauneuf-du-Pape', 'Gigondas', 'Hermitage'],
  'Loire Valley': ['Montlouis-sur-Loire', 'Vouvray', 'Savennières', 'Anjou', 'Muscadet', 'Saumur Champigny', 'Quincy', 'Chinon', 'Bourgueil'],
  'Languedoc-Roussillon': ['Terrasses du Larzac', 'Pic Saint-Loup', 'Montagnes de Cucugnan', 'Côtes Catalanes', 'IGP Alpilles', 'Montpeyroux'],
  'Provence': ['Palette', 'Bandol', 'Cassis'],
  'Burgundy': ['Bourgogne', 'Bourgogne Aligoté', 'Chablis', 'Morgon', 'Pernand-Vergelesses', 'Aloxe-Corton', 'Saint-Véran', 'Mâcon-Villages'],
  'Alsace': ['Alsace AOP'],
  'Switzerland': ['Valais AOC', 'Dézaley']
};

function classifyAppellation(name) {
  for (const [region, apps] of Object.entries(regionMap)) {
    if (apps.some(a => name.includes(a))) return region;
  }
  if (name.includes('Vin de France')) return 'Vin de France';
  return 'Other';
}

const regions = {};
for (const a of data.appellations) {
  const region = classifyAppellation(a.name);
  if (!regions[region]) regions[region] = { bottles: 0, appellations: {} };
  regions[region].bottles += a.bottles;
  const key = `${a.name} (${a.color})`;
  regions[region].appellations[key] = (regions[region].appellations[key] || 0) + a.bottles;
}

const regionProfile = Object.entries(regions)
  .sort((a, b) => b[1].bottles - a[1].bottles)
  .map(([name, d]) => ({
    region: name,
    bottles: d.bottles,
    pct: Math.round(d.bottles / totalBottles * 100),
    topAppellations: Object.entries(d.appellations).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, b]) => `${n}: ${b}`)
  }));

// === VINTAGE ANALYSIS ===
const buckets = { young_0_2y: 0, mid_3_5y: 0, aging_6_10y: 0, mature_10plus: 0 };
let vintageSum = 0;
for (const v of data.vintages) {
  const age = currentYear - v.vintage;
  vintageSum += v.vintage * v.bottles;
  if (age <= 2) buckets.young_0_2y += v.bottles;
  else if (age <= 5) buckets.mid_3_5y += v.bottles;
  else if (age <= 10) buckets.aging_6_10y += v.bottles;
  else buckets.mature_10plus += v.bottles;
}

const vintageTotal = Object.values(buckets).reduce((s, v) => s + v, 0);
const vintageProfile = {};
for (const [k, v] of Object.entries(buckets)) {
  vintageProfile[k] = { bottles: v, pct: Math.round(v / vintageTotal * 100) };
}
vintageProfile.avgVintage = Math.round(vintageSum / vintageTotal);
vintageProfile.preference = (buckets.young_0_2y + buckets.mid_3_5y) > (buckets.aging_6_10y + buckets.mature_10plus) ? 'youthful_freshness' : 'aged_complexity';

// === LOYALTY SCORE ===
const top5Bottles = data.producers.slice(0, 5).reduce((s, p) => s + p.bottles, 0);
const loyaltyScore = Math.round(top5Bottles / totalBottles * 100);

// === EXPLORATION INDEX ===
const explorationIndex = Math.round(data.unique_wines / totalBottles * 100);

// === STYLE TAGS ===
const tags = [];
const redPct = colorProfile.red?.pct || 0;
const whitePct = colorProfile.white?.pct || 0;
if (Math.abs(redPct - whitePct) < 10) tags.push('balanced_red_white');
else if (redPct > 65) tags.push('red_dominant');
else if (whitePct > 65) tags.push('white_dominant');

// South Africa commitment
const saProducers = ['The Sadie Family', 'Porseleinberg', 'Mullineux', 'Alheit Vineyards', 'David & Nadia', 'Boekenhoutskloof', 'Storm Wines', 'Savage', 'Restless River', 'Damascene', 'Sakkie Mouton', 'Saurwein', 'Rall'];
const saInTop = data.producers.filter(p => saProducers.includes(p.name)).length;
if (saInTop >= 8) tags.push('south_africa_deep_collector');
else if (saInTop >= 4) tags.push('south_africa_enthusiast');

// French regions
if (regions['Bordeaux']?.bottles >= 10) tags.push('bordeaux_collector');
if (regions['Rhône Valley']?.bottles >= 10) tags.push('rhone_lover');
if (regions['Loire Valley']?.bottles >= 10) tags.push('loire_explorer');
if (regions['Burgundy']?.bottles >= 5) tags.push('burgundy_curious');
if (regions['Provence']?.bottles >= 5) tags.push('provence_fan');
if (regions['Languedoc-Roussillon']?.bottles >= 5) tags.push('languedoc_adventurer');

// Vintage style
tags.push(vintageProfile.preference);

// Loyalty
if (loyaltyScore > 40) tags.push('producer_loyal');
if (explorationIndex > 25) tags.push('explorer');

// Full range (buys both colors from same producers)
const fullRangeBuyers = data.producers.filter(p => p.colors?.includes(','));
if (fullRangeBuyers.length >= 10) tags.push('full_range_collector');

// === NATURAL LANGUAGE SUMMARY ===
const topRegionName = regionProfile[0]?.region || 'unknown';
const summary = [
  `${totalBottles} bottles across ${data.unique_wines} unique wines from ${data.unique_producers} producers.`,
  `Almost perfectly split: ${redPct}% red, ${whitePct}% white — a true dual-palate collector.`,
  `Heavily invested in ${topRegionName} (top producers: ${data.producers.slice(0, 3).map(p => p.name).join(', ')}).`,
  `French appellations span Bordeaux, Rhône, Loire, Burgundy, Languedoc, and Provence — broad French knowledge.`,
  `Vintages skew recent (avg ${vintageProfile.avgVintage}) — prefers drinking windows over long cellaring.`,
  loyaltyScore > 35 ? `High producer loyalty — top 5 producers account for ${loyaltyScore}% of the cellar.` : `Diverse buyer — spreads purchases across many producers.`,
  `Exploration index: ${explorationIndex}% (${explorationIndex > 25 ? 'high diversity' : 'focused buyer'}).`,
  saInTop >= 8 ? `Deep South African wine collector — knows the new-wave scene intimately.` : '',
].filter(Boolean).join('\n');

// === OUTPUT ===
const profile = {
  version: 1,
  generated: new Date().toISOString(),
  userId: 1,
  
  naturalLanguageSummary: summary,

  overview: {
    totalBottles,
    uniqueWines: data.unique_wines,
    uniqueProducers: data.unique_producers,
    totalConsumed: data.consumed?.length || 0,
    cellars: [{ name: 'Cape Town', bottles: 692 }, { name: 'Nice', bottles: 190 }]
  },

  colorPreference: colorProfile,
  regionProfile,
  vintageProfile,

  topProducers: data.producers.slice(0, 15).map(p => ({
    name: p.name, bottles: p.bottles, lots: p.lots, colors: p.colors
  })),

  metrics: {
    loyaltyScore,
    explorationIndex,
    regionDiversity: regionProfile.length,
    appellationCount: data.appellations.length
  },

  tags,

  consumptionHistory: data.consumed || []
};

const outPath = '/tmp/taste-profile-robin.json';
writeFileSync(outPath, JSON.stringify(profile, null, 2));
console.log(`\n✅ Profile written to ${outPath}\n`);
console.log('=== ROBIN\'S TASTE PROFILE ===\n');
console.log(summary);
console.log(`\n📊 Tags: ${tags.join(', ')}`);
console.log(`\n🎯 Loyalty: ${loyaltyScore}% | Exploration: ${explorationIndex}% | Regions: ${regionProfile.length}`);
console.log(`\n🏆 Top 5 Producers:`);
data.producers.slice(0, 5).forEach(p => console.log(`   ${p.name}: ${p.bottles} bottles (${p.lots} lots) [${p.colors}]`));
console.log(`\n🗺️  Region Breakdown:`);
regionProfile.forEach(r => console.log(`   ${r.region}: ${r.bottles} bottles (${r.pct}%)`));
console.log(`\n🍷 Vintage Spread:`);
Object.entries(buckets).forEach(([k, v]) => console.log(`   ${k}: ${v} bottles (${Math.round(v/vintageTotal*100)}%)`));
