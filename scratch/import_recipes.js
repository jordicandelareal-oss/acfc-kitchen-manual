import { supabase } from '../lib/supabaseClient.js';
import fs from 'fs';

// Helper to normalize strings for comparison
function normalize(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .trim()
    .replace(/\s+/g, ' ');
}

// Load dumped ingredients to build a map
const ingredientsDump = JSON.parse(fs.readFileSync('scratch/ingredients_dump.json', 'utf8'));
const ingredientMap = new Map();
ingredientsDump.forEach(ing => {
  ingredientMap.set(normalize(ing.name), ing.id);
});

// Manual overrides for name mapping
const nameOverrides = {
  'aceite oliva': 'Aceite oliva',
  'aceite girasol': 'Aceite girasol',
  'ajo morado': 'Ajo morado',
  'cebolla': 'Cebolla',
  'cebolla morada': 'Cebolla Morada',
  'sal': 'Sal',
  'pimienta negra': 'Pimienta negra',
  'pepino': 'pepino',
  'tomate daniela': 'Tomate Daniela',
  'maiz': 'Maiz',
  'zanahoria': 'Zanahoria',
  'pechuga de pollo': 'Pechuga de pollo',
  'queso mozzarella': 'Queso mozzarella',
  'queso lonchas': 'Queso Lonchas',
  'jamon york': 'Jamon york',
  'mantequilla': 'Mantequilla',
  'pasta fusilli': 'Pasta fusilli',
  'spaguettis': 'Spaguettis',
  'spaguettis integral': 'Spaguettis integral',
  'macarrones': 'Macarrones',
  'bacon': 'Bacon',
  'nata': 'Nata',
  'champiñones': 'Champiñones',
  'huevos': 'Huevos',
  'parmesano': 'Parmesano',
  'tomate cherri': 'Tomate cherri',
  'tomate triturado': 'Tomate Triturado',
  'ñora': 'Ñora',
  'carne picada vacuno': 'Carne picada Vacuno',
  'carne picada cerdo': 'Carne picada Cerdo',
  'leche semidesnatada': 'Leche semidesnatada',
  'c. arroz chocolate': 'C. Arroz chocolate',
  'muesli': 'Muesli',
  'c. copos choco': 'C. Copos choco',
  'cereales bolas chocolate': 'Cereales bolas chocolate',
  'pan de molde': 'Pan de molde',
  'banana': 'banana',
  'manzana golden': 'Manzana Golden',
  'mermelada': 'Mermelada',
  'te': 'Te',
  'cafe': 'Cafe',
  'guisantes': 'guisantes',
  'patatas': 'Patatas',
  'salchicha f': 'Salchicha F',
  'queso cheddar': 'Queso cheddar',
  'tortillas trigo': 'Tortillas Trigo',
  'tortillas trigo integral': 'Tortillas Trigo Integral',
  'salsa barbacoa': 'Salsa Barbacoa',
  'longaniza fresca': 'Longaniza fresca',
  'chile en polvo': 'Chile en polvo',
  'pimenton de la vera': 'Pimentón de la vera',
  'queso pasta': 'Queso Pasta',
  'cous cous': 'Cous cous',
  'garbanzos': 'Garbanzos',
  'calabacin': 'Calabacín',
  'nuez picada': 'Nuez picada',
  'pasas': 'pasas',
  'limon': 'Limon',
  'salsa cesar': 'Salsa cesar',
  'picatostes': 'picatostes',
  'canela': 'Canela',
  'cardamomo': 'Cardamomo',
  'nuez moscada': 'Nuez moscada',
  'comino molido': 'Comino molido',
  'anis estrellado': 'Anis estrellado',
  'cilantro semilla': 'Cilantro semilla',
  'laurel': 'Laurel',
  'clavo': 'clavo',
  'zumo': 'Zumo',
  'patata bolsa': 'Patata bolsa',
  'tomate seco': 'Tomate seco',
  'almendra': 'Almendra',
  'albahaca': 'Albahaca',
  'quinoa': 'Quinoa',
  'pimiento rojo': 'Pimiento roJo',
  'perejil': 'Perejil',
  'cebolla frita': 'Cebolla frita',
  'aguacate': 'aguacate',
  'pimiento verde': 'pimiento verde',
  'brocoli': 'Brocoli',
  'coliflor': 'coliflor',
  'jengibre': 'jengibre',
  'salsa ostra': 'Salsa ostra',
  'sesamo': 'Sesamo',
  'shitake': 'Shitake',
  'salsa soja': 'Salsa soja',
  'tofu': 'Tofu',
  'brotes soja': 'Brotes soja',
  'col china': 'Col china',
  'pasta cacahuete': 'Pasta cacahuete',
  'salsa pescado': 'Salsa pescado',
  'tamarindo': 'Tamarindo',
  'gochujang': 'Gochujang',
  'tobanjan': 'Tobanjan',
  'galanga': 'galanga',
  'hoja de lima': 'Hoja de lima',
  'lemongrass': 'Lemongrass',
  'leche de coco': 'Leche de coco',
  'salsa kimchi': 'Salsa kimchi',
  'pota china': 'Pota china',
  'gamba pequeno': 'Gamba pequeno',
  'abadejo': 'abadejo',
  'bacalao lomo': 'Bacalao Lomo',
  'anillas a la romana': 'Anillas a la romana',
  'gamba arrocera': 'Gamba arrocera',
  'tinta sepia': 'Tinta sepia',
  'pescados': 'Pescados Atlántico',
  'pescado': 'Pescados Atlántico'
};

function getIngredientId(rawName) {
  const norm = normalize(rawName);
  if (!norm) return null;
  
  // Check direct map
  if (ingredientMap.has(norm)) {
    return ingredientMap.get(norm);
  }
  
  // Check override
  const overrideName = nameOverrides[norm];
  if (overrideName && ingredientMap.has(normalize(overrideName))) {
    return ingredientMap.get(normalize(overrideName));
  }
  
  // Clean common words and try token-based matching
  const stopWords = new Set(['de', 'del', 'con', 'y', 'la', 'el', 'los', 'las', 'para', 'a', 'al', 'en', 'fresca', 'fresco', 'seco', 'seca', 'pequeno', 'pequena']);
  const getTokens = (s) => s.split(/[\s_+\-/()]+/).map(w => normalize(w)).filter(w => w.length > 1 && !stopWords.has(w));
  
  const normTokens = getTokens(norm);
  if (normTokens.length > 0) {
    // 1. Exact match on token-sets (disregarding order or stop words)
    for (const [key, id] of ingredientMap.entries()) {
      const keyTokens = getTokens(key);
      if (keyTokens.length === 0) continue;
      
      const allNormInKey = normTokens.every(t => keyTokens.includes(t));
      const allKeyInNorm = keyTokens.every(t => normTokens.includes(t));
      
      if (allNormInKey || allKeyInNorm) {
        return id;
      }
    }
    
    // 2. Best token intersection matching (for cases like minor spelling or extra descriptions)
    let bestId = null;
    let bestScore = 0;
    for (const [key, id] of ingredientMap.entries()) {
      const keyTokens = getTokens(key);
      const intersection = normTokens.filter(t => keyTokens.includes(t));
      if (intersection.length > bestScore) {
        bestScore = intersection.length;
        bestId = id;
      }
    }
    if (bestScore >= Math.min(2, normTokens.length)) {
      return bestId;
    }
  }
  
  // Let's try partial matching as fallback
  for (const [key, id] of ingredientMap.entries()) {
    if (key.length > 3 && (key.includes(norm) || norm.includes(key))) {
      return id;
    }
  }
  return null;
}

// Fetch and parse CSV
async function fetchCSV(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/1ZkGa3yRh5LdRzMVkLDkhGZ8gehNV1Qn2JwGRg9idnrQ/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const text = await res.text();
  
  const lines = [];
  const regex = /("([^"]*)"|([^,]*))(,|$)/g;
  
  const rawLines = text.split(/\r?\n/);
  for (const rawLine of rawLines) {
    if (!rawLine.trim()) continue;
    const row = [];
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(rawLine)) !== null) {
      let val = match[2] !== undefined ? match[2] : match[3];
      row.push(val);
      if (match[4] === '') break;
    }
    lines.push(row);
  }
  return lines;
}

async function parseSheetRecipes(sheetName, categoryName) {
  console.log(`\n=== Parsing sheet: ${sheetName} ===`);
  const rows = await fetchCSV(sheetName);
  if (!rows || rows.length < 11) {
    console.log('Skipping empty sheet.');
    return [];
  }

  const recipesList = [];
  
  // Scan row-by-row to find block starts
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (row && row[0] && /^[0-9]+$/.test(row[0].trim())) {
      // Found a block start!
      const leftName = row[1] ? row[1].trim() : '';
      const rightName = row[10] ? row[10].trim() : '';
      
      if (leftName && leftName !== 'Producto' && leftName !== 'Ingredientes') {
        const leftRecipe = parseBlock(rows, r, 0, leftName, categoryName);
        recipesList.push(leftRecipe);
      }
      if (rightName && rightName !== 'Producto' && rightName !== 'Ingredientes') {
        const rightRecipe = parseBlock(rows, r, 10, rightName, categoryName);
        recipesList.push(rightRecipe);
      }
    }
  }
  
  return recipesList;
}

function parseBlock(rows, startRow, startCol, recipeName, categoryName) {
  // Portions count is at startRow + 1, col startCol + 6 (index 6 for left, 16 for right)
  const portionsRow = rows[startRow + 1];
  const portionsVal = portionsRow && portionsRow[startCol + 6] ? parseFloat(portionsRow[startCol + 6].replace(',', '.')) : 1;
  
  const recipe = {
    name: recipeName,
    category: categoryName,
    portions: isNaN(portionsVal) ? 1 : portionsVal,
    ingredients: [],
    instructions: []
  };
  
  const invalidNames = ['elaboracion', 'resumen nutricional', 'ingredientes', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];

  // Ingredients list starts at startRow + 3
  for (let i = startRow + 3; i < startRow + 20; i++) {
    const row = rows[i];
    if (!row) break;
    
    const ingName = row[startCol] ? row[startCol].trim() : '';
    if (!ingName) continue;
    if (ingName.toLowerCase() === 'resumen nutricional') break;
    if (invalidNames.includes(ingName.toLowerCase()) || /^[0-9]+$/.test(ingName)) {
      continue;
    }
    
    const qtyPortionStr = row[startCol + 2] ? row[startCol + 2].replace(',', '.') : '0';
    const qty = parseFloat(qtyPortionStr);
    const unit = row[startCol + 4] ? row[startCol + 4].trim() : 'Gr';
    
    const ingId = getIngredientId(ingName);
    recipe.ingredients.push({
      rawName: ingName,
      ingredient_id: ingId,
      quantity_per_portion: isNaN(qty) ? 0 : qty,
      unit: unit
    });
  }
  
  // Elaboracion steps start at startRow + 21
  let elabRowIndex = -1;
  for (let i = startRow + 10; i < startRow + 25; i++) {
    if (rows[i] && rows[i][startCol] && rows[i][startCol].toLowerCase() === 'elaboracion') {
      elabRowIndex = i;
      break;
    }
  }
  
  if (elabRowIndex !== -1) {
    for (let i = elabRowIndex + 1; i < elabRowIndex + 8; i++) {
      const row = rows[i];
      if (!row) break;
      const stepText = row[startCol + 1] ? row[startCol + 1].trim() : '';
      if (stepText) {
        recipe.instructions.push(stepText);
      }
    }
  }
  
  return recipe;
}

async function run() {
  const sheets = [
    { name: 'Recetas Base', cat: 'Base' },
    { name: 'Pasta', cat: 'Pasta' },
    { name: 'Arroces', cat: 'Arroces' },
    { name: 'Guisos', cat: 'Guisos' },
    { name: 'carnes y pescados', cat: 'Carnes y Pescados' },
    { name: 'Vegetariano', cat: 'Vegetariano' },
    { name: 'Desayunos', cat: 'Desayunos' }
  ];
  
  const allRecipes = [];
  for (const s of sheets) {
    const recipes = await parseSheetRecipes(s.name, s.cat);
    allRecipes.push(...recipes);
  }
  
  console.log(`\nParsed total of ${allRecipes.length} recipes.`);
  
  // Filter out any recipe that has empty/invalid names
  const validRecipes = allRecipes.filter(r => r.name && r.name.length > 2);
  
  // Dynamic categories creation
  const categories = Array.from(new Set(sheets.map(s => s.cat)));
  const categoryIds = {};
  
  for (const catName of categories) {
    const { data: catData, error: catError } = await supabase
      .from('recipe_categories')
      .upsert({ name: catName }, { onConflict: 'name' })
      .select('id')
      .single();
    
    if (catError) {
      console.error(`Error upserting category ${catName}:`, catError.message);
    } else {
      categoryIds[catName] = catData.id;
    }
  }
  
  console.log('Category IDs:', categoryIds);

  for (const recipe of validRecipes) {
    console.log(`Processing recipe: ${recipe.name}...`);
    
    // Resolve ingredient IDs, insert if missing
    for (const ing of recipe.ingredients) {
      if (!ing.ingredient_id) {
        const { data: existingIng } = await supabase
          .from('ingredients')
          .select('id')
          .eq('name', ing.rawName)
          .maybeSingle();
          
        if (existingIng) {
          ing.ingredient_id = existingIng.id;
        } else {
          const { data: newIng, error: newIngErr } = await supabase
            .from('ingredients')
            .insert({
              name: ing.rawName,
              category: recipe.category,
              stock_actual: 0,
              stock_minimo: 0,
              stock_maximo: 0,
              unit: ing.unit || 'Gr'
            })
            .select('id')
            .single();
            
          if (newIngErr) {
            console.error(`Failed to create missing ingredient "${ing.rawName}":`, newIngErr.message);
          } else {
            ing.ingredient_id = newIng.id;
            ingredientMap.set(normalize(ing.rawName), newIng.id);
          }
        }
      }
    }
    
    // Upsert Recipe
    const { data: recData, error: recError } = await supabase
      .from('recipes')
      .upsert({
        name: recipe.name,
        category: recipe.category,
        category_id: categoryIds[recipe.category] || null,
        portions: recipe.portions,
        instructions: recipe.instructions.join('\n')
      }, { onConflict: 'name' })
      .select('id')
      .single();
      
    if (recError) {
      console.error(`Failed to upsert recipe "${recipe.name}":`, recError.message);
      continue;
    }
    
    const recipeId = recData.id;
    
    // Clear and insert recipe ingredients relations
    const { error: deleteError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId);
      
    if (deleteError) {
      console.error(`Failed to clear ingredients for "${recipe.name}":`, deleteError.message);
    }
    
    // Group duplicates and sum their quantities
    const grouped = {};
    recipe.ingredients.forEach(ing => {
      if (!ing.ingredient_id) return;
      const key = ing.ingredient_id;
      if (grouped[key]) {
        grouped[key].quantity_per_portion += ing.quantity_per_portion;
      } else {
        grouped[key] = {
          recipe_id: recipeId,
          ingredient_id: ing.ingredient_id,
          quantity_per_portion: ing.quantity_per_portion,
          unit: ing.unit
        };
      }
    });
    
    const validIngredients = Object.values(grouped);
      
    if (validIngredients.length > 0) {
      const { error: relError } = await supabase
        .from('recipe_ingredients')
        .insert(validIngredients);
        
      if (relError) {
        console.error(`Failed to insert recipe ingredients relations for "${recipe.name}":`, relError.message);
      }
    }
  }
  
  console.log('✅ Import completed successfully!');
}

run();
