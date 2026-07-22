import fs from 'fs';
import path from 'path';

const csvPath = path.resolve('./Ingredientes.csv');
const content = fs.readFileSync(csvPath, 'utf8');

// Simple CSV parser handling quoted fields
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

const rows = parseCSV(content);
console.log(`Total lines in CSV: ${rows.length}`);
console.log('Row 0:', rows[0]);
console.log('Row 1 (Header):', rows[1]);

const headers = rows[1];
const nameIdx = headers.findIndex(h => h.toLowerCase().includes('producto'));
const priceIdx = headers.findIndex(h => h.toLowerCase().includes('purchase_price'));
const formatIdx = headers.findIndex(h => h.toLowerCase().includes('purchase_format_gr'));
const eurGrIdx = headers.findIndex(h => h.toLowerCase().includes('€/gr'));
const supplierIdx = headers.findIndex(h => h.toLowerCase().includes('proveedor'));

console.log(`Indexes -> Producto: ${nameIdx}, purchase_price: ${priceIdx}, purchase_format_gr: ${formatIdx}, €/gr: ${eurGrIdx}, Proveedor: ${supplierIdx}`);

const formatValues = new Set();
const parsedSamples = [];

for (let i = 2; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length < 3) continue;
  const name = row[nameIdx] || '';
  const priceRaw = row[priceIdx] || '';
  const formatRaw = row[formatIdx] || '';
  const eurGrRaw = row[eurGrIdx] || '';

  formatValues.add(formatRaw);

  if (i <= 15) {
    parsedSamples.push({ name, priceRaw, formatRaw, eurGrRaw });
  }
}

console.log('Unique raw format values in CSV:', Array.from(formatValues));
console.log('Sample parsed rows:', parsedSamples);
