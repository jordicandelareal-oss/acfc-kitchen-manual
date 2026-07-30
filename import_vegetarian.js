import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const fileContent = fs.readFileSync('Copia de ACFC 2025 - Vegetariano (1).csv', 'utf8');
  const records = parse(fileContent, { skip_empty_lines: true });
  
  const categoryId = '05184480-b4c1-404b-9aa2-b4ea128f968c';
  
  // 1. Fetch all ingredients
  const { data: dbIngredients, error: errIng } = await supabase.from('ingredients').select('id, name');
  if (errIng) throw errIng;
  
  const getIngredientId = (name) => {
    const found = dbIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
    return found ? found.id : null;
  };

  let addedCount = 0;
  let skippedCount = 0;
  const skippedNames = [];

  // 2. Scan for blocks
  for (let r = 0; r < records.length; r++) {
    const row = records[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'Raciones') {
        const titleRow = r - 1;
        const nameCol = c - 3;
        const titleCell = records[titleRow][nameCol]?.trim();
        
        if (!titleCell) continue;

        // Clean up title (remove newlines, extra spaces)
        const recipeName = titleCell.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        // Get portions
        const portionsStr = row[c + 2];
        let portions = 25;
        if (portionsStr) {
          portions = parseFloat(portionsStr.replace(',', '.'));
        }

        console.log(`\nProcessing recipe: ${recipeName} (Portions: ${portions})`);

        // Check if exists
        const { data: existing, error: errExist } = await supabase
          .from('recipes')
          .select('id')
          .eq('name', recipeName);

        if (errExist) {
          console.error(`Error checking existing recipe ${recipeName}`, errExist);
          continue;
        }

        if (existing && existing.length > 0) {
          console.log(`- Recipe '${recipeName}' already exists. Skipping.`);
          skippedCount++;
          skippedNames.push(recipeName);
          continue;
        }

        // Parse ingredients
        const recipeIngredients = [];
        const ingStartRow = r + 2;
        
        const ingNameCol = c - 3;
        const ingGrCol = c - 1;
        const ingTotalCol = c;
        const ingUnitCol = c + 1;

        for (let ir = ingStartRow; ir < records.length; ir++) {
          const iRow = records[ir];
          if (!iRow || !iRow[ingNameCol]) break; 
          
          const iName = iRow[ingNameCol].trim();
          if (iName === '' || iName.startsWith('Resumen nutricional') || iName.startsWith('Total gr plato:')) break;

          const grPorcion = parseFloat(iRow[ingGrCol]?.replace(',', '.') || '0');
          const total = parseFloat(iRow[ingTotalCol]?.replace(',', '.') || '0');
          let unit = iRow[ingUnitCol]?.trim();
          if (!unit) unit = 'Gr';

          const ingId = getIngredientId(iName);
          
          recipeIngredients.push({
            name_for_log: iName,
            ingredient_id: ingId,
            quantity_per_portion: grPorcion,
            quantity: total,
            unit: unit
          });
        }

        // Insert Recipe
        const { data: newRecipe, error: errInsert } = await supabase
          .from('recipes')
          .insert({
            name: recipeName,
            category_id: categoryId,
            category: 'Vegetariano',
            portions: portions,
            is_vegetarian: true
          })
          .select('id')
          .single();
        
        if (errInsert) {
           console.error(`Error inserting recipe ${recipeName}`, errInsert);
           continue;
        }
        
        addedCount++;
        const recipeId = newRecipe.id;
        
        // Insert Ingredients
        for (const ring of recipeIngredients) {
          if (!ring.ingredient_id) {
            console.warn(`  - Ingredient not found in DB: ${ring.name_for_log}. Skipping this ingredient.`);
            continue;
          }
          const { error: errRing } = await supabase
            .from('recipe_ingredients')
            .insert({
              recipe_id: recipeId,
              ingredient_id: ring.ingredient_id,
              quantity_per_portion: ring.quantity_per_portion,
              quantity: ring.quantity,
              unit: ring.unit
            });
          if (errRing) {
            console.error(`  Error inserting ingredient ${ring.name_for_log}`, errRing);
          }
        }
        console.log(`- Inserted recipe '${recipeName}' with ${recipeIngredients.length} ingredients (matched ${recipeIngredients.filter(i => i.ingredient_id).length}).`);
      }
    }
  }

  console.log(`\n================================`);
  console.log(`IMPORT SUMMARY`);
  console.log(`================================`);
  console.log(`Recetas nuevas añadidas: ${addedCount}`);
  console.log(`Recetas omitidas (ya existían): ${skippedCount}`);
  if (skippedNames.length > 0) {
    console.log(`Lista de omitidas:`);
    skippedNames.forEach(n => console.log(`  - ${n}`));
  }
}

main().catch(console.error);
