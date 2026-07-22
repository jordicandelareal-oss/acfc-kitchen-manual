import fs from 'fs';
import path from 'path';

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

const rows = parseCSV(content);
const headers = rows[1];
const nameIdx = headers.findIndex(h => h.toLowerCase().includes('producto'));
const priceIdx = headers.findIndex(h => h.toLowerCase().includes('purchase_price'));
const formatIdx = headers.findIndex(h => h.toLowerCase().includes('purchase_format_gr'));
const eurGrIdx = headers.findIndex(h => h.toLowerCase().includes('€/gr'));

console.log('--- ALL ROWS DETAIL ---');
const formatCounts = {};
for (let i = 2; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length < 3) continue;
  const name = row[nameIdx] || '';
  const priceRaw = row[priceIdx] || '';
  const formatRaw = row[formatIdx] || '';
  const eurGrRaw = row[eurGrIdx] || '';

  formatCounts[formatRaw] = (formatCounts[formatRaw] || 0) + 1;
  if (formatRaw !== '1.000' && formatRaw !== '') {
    console.log(`Row ${i}: "${name}" | Price: "${priceRaw}" | Format: "${formatRaw}" | €/gr: "${eurGrRaw}"`);
  }
}
console.log('\nFormat Value Frequencies:', formatCounts);
