import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabaseClient.js';

const csvPath = path.resolve('./Ingredientes.csv');
const content = fs.readFileSync(csvPath, 'utf8');

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(line => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  });
}

async function run() {
  // Fetch all ingredients from DB
  const { data: dbIngredients, error } = await supabase
    .from('ingredients')
    .select('id, name, unit, output_scenario, waste_percentage, process_type, purchase_format_gr, purchase_price, calculated_net_cost_kg');

  if (error) {
    console.error('Error fetching DB ingredients:', error);
    return;
  }

  console.log(`Loaded ${dbIngredients.length} ingredients from Supabase DB.`);

  // Create lookup maps (lowercased & trimmed)
  const dbMap = new Map();
  dbIngredients.forEach(ing => {
    if (ing.name) {
      const key = ing.name.trim().toLowerCase();
      dbMap.set(key, ing);
    }
  });

  const rows = parseCSV(content);
  const headers = rows[1];
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('producto'));
  const priceIdx = headers.findIndex(h => h.toLowerCase().includes('purchase_price'));
  const formatIdx = headers.findIndex(h => h.toLowerCase().includes('purchase_format_gr'));

  let matchedCount = 0;
  let unmatchedCount = 0;
  const matched = [];
  const unmatched = [];

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const csvName = (row[nameIdx] || '').trim();
    if (!csvName) continue;

    const key = csvName.toLowerCase();
    const dbIng = dbMap.get(key);

    if (dbIng) {
      matchedCount++;
      matched.push({ csvName, dbName: dbIng.name, dbId: dbIng.id, rawPrice: row[priceIdx], rawFormat: row[formatIdx] });
    } else {
      unmatchedCount++;
      unmatched.push(csvName);
    }
  }

  console.log(`\n--- MATCHING RESULTS ---`);
  console.log(`Matched: ${matchedCount}`);
  console.log(`Unmatched: ${unmatchedCount}`);
  console.log(`\nUnmatched CSV items (${unmatched.length}):`);
  console.log(unmatched);
}

run();
