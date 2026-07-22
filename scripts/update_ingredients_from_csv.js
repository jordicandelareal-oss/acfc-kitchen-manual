import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabaseClient.js';

// Centralized Math Utilities (matching frontend/src/utils/mathUtils.js)
function calcularCosteBase(price, format, scenario) {
  if (!format || format <= 0) return 0;
  if (scenario === 'KG_LT') {
    return price / (format / 1000);
  }
  return price / format;
}

function calcularCosteNeto(baseCost, pct, processType) {
  if (processType === 'MERMA') {
    const divisor = 1 - (pct / 100);
    return divisor > 0 ? baseCost / divisor : 0;
  }
  return baseCost / (1 + (pct / 100));
}

// CSV Parser handling quotes
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

// Parse price from CSV cell (e.g., "€4,39", "11,90", "-")
function parsePrice(rawVal) {
  if (!rawVal) return null;
  let cleaned = rawVal.replace(/€/g, '').replace(/"/g, '').replace(/'/g, '').trim();
  if (cleaned === '-' || cleaned === '') return null;
  cleaned = cleaned.replace(',', '.');
  const parsed = parseFloat(cleaned);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

// Parse format from CSV cell (e.g. "1.000", "1", "500")
function parseFormat(rawVal) {
  if (!rawVal) return null;
  let cleaned = rawVal.replace(/"/g, '').replace(/'/g, '').trim();
  if (cleaned === '-' || cleaned === '') return null;
  
  // European thousands handling: "1.000" -> 1000
  if (cleaned === '1.000') return 1000;
  if (/^\d+\.\d{3}$/.test(cleaned)) {
    cleaned = cleaned.replace('.', '');
  } else {
    cleaned = cleaned.replace(',', '.');
  }
  
  const parsed = parseFloat(cleaned);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`=== ACTUALIZACIÓN MASIVA DE INGREDIENTES (${isDryRun ? 'DRY-RUN' : 'EJECUCIÓN REAL'}) ===\n`);

  // 1. Cargar ingredientes existentes desde Supabase
  const { data: dbIngredients, error: fetchErr } = await supabase
    .from('ingredients')
    .select('id, name, output_scenario, waste_percentage, process_type, purchase_format_gr, purchase_price, calculated_net_cost_kg');

  if (fetchErr) {
    console.error('❌ Error al consultar la tabla ingredients de Supabase:', fetchErr.message);
    process.exit(1);
  }

  console.log(`📦 Ingredientes cargados de Supabase: ${dbIngredients.length}`);

  // Mapa de búsqueda insensible a mayúsculas/minúsculas y espacios
  const dbMap = new Map();
  dbIngredients.forEach(ing => {
    if (ing.name) {
      dbMap.set(ing.name.trim().toLowerCase(), ing);
    }
  });

  // 2. Leer archivo CSV
  const csvPath = path.resolve('./Ingredientes.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ No se encontró el archivo CSV en la ruta: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(csvContent);

  if (rows.length < 2) {
    console.error('❌ El archivo CSV está vacío o no contiene suficientes filas.');
    process.exit(1);
  }

  const headers = rows[1]; // La fila 1 contiene los encabezados reales
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('producto'));
  const priceIdx = headers.findIndex(h => h.toLowerCase().includes('purchase_price'));
  const formatIdx = headers.findIndex(h => h.toLowerCase().includes('purchase_format_gr'));

  if (nameIdx === -1 || priceIdx === -1 || formatIdx === -1) {
    console.error('❌ No se encontraron las columnas requeridas (Producto, purchase_price, purchase_format_gr) en el CSV.');
    process.exit(1);
  }

  let totalProcesados = 0;
  let totalActualizados = 0;
  const noEncontrados = [];
  const errores = [];

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const rawName = (row[nameIdx] || '').trim();
    if (!rawName) continue;

    totalProcesados++;

    // Normalización para búsqueda
    let normalizedKey = rawName.toLowerCase();
    let dbIng = dbMap.get(normalizedKey);

    // Intento de fallback para erratas comunes del CSV (ej: "filetesde vacuno" -> "filetes de vacuno")
    if (!dbIng && normalizedKey === 'filetesde vacuno') {
      dbIng = dbMap.get('filetes de vacuno');
    }

    if (!dbIng) {
      noEncontrados.push(rawName);
      continue;
    }

    // Extraer valores numéricos del CSV
    const purchasePrice = parsePrice(row[priceIdx]);
    const purchaseFormatGr = parseFormat(row[formatIdx]);

    const payload = {
      purchase_price: purchasePrice,
      purchase_format_gr: purchaseFormatGr,
      updated_at: new Date().toISOString()
    };

    // Si tiene un precio válido (> 0), calcular coste neto en caliente
    if (purchasePrice && purchasePrice > 0) {
      const scenario = dbIng.output_scenario || 'KG_LT';
      const pct = Number(dbIng.waste_percentage) || 0;
      const processType = dbIng.process_type || 'MERMA';
      const formatToUse = purchaseFormatGr || 1000;

      const baseCost = calcularCosteBase(purchasePrice, formatToUse, scenario);
      const netCost = calcularCosteNeto(baseCost, pct, processType);

      if (netCost > 0) {
        payload.calculated_net_cost_kg = netCost;
        payload.precio_mas_bajo = netCost;
        payload.precio_por_kg = netCost;
      }
    }

    if (isDryRun) {
      totalActualizados++;
    } else {
      const { error: updateErr } = await supabase
        .from('ingredients')
        .update(payload)
        .eq('id', dbIng.id);

      if (updateErr) {
        console.error(`❌ Error actualizando "${dbIng.name}":`, updateErr.message);
        errores.push({ name: dbIng.name, error: updateErr.message });
      } else {
        totalActualizados++;
      }
    }
  }

  // 3. Imprimir Resumen en Consola
  console.log('\n================ RESUMEN DE EJECUCIÓN ================');
  console.log(`📊 Total de ingredientes procesados desde CSV: ${totalProcesados}`);
  console.log(`✅ Total de ingredientes actualizados con éxito: ${totalActualizados}`);
  console.log(`⚠️ Total de ingredientes no encontrados: ${noEncontrados.length}`);

  if (noEncontrados.length > 0) {
    console.log('\n🔍 Lista de ingredientes no encontrados en la Base de Datos:');
    noEncontrados.forEach(item => console.log(`  - ${item}`));
  }

  if (errores.length > 0) {
    console.log('\n❌ Lista de errores durante la actualización:');
    errores.forEach(item => console.log(`  - ${item.name}: ${item.error}`));
  }

  console.log('======================================================\n');
}

main().catch(err => {
  console.error('💥 Error inesperado:', err);
  process.exit(1);
});
