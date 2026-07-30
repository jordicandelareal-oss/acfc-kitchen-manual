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
  const records = parse(fileContent, {
    skip_empty_lines: true,
  });

  // The structure seems to have recipes horizontally.
  // Row 1: Recipe names in some columns.
  // Row 2: Raciones info
  // Row 3: Headers (Ingredientes, , Gr porcion, etc.)
  // Row 4 onwards: ingredients until empty or summary

  const row1 = records[1]; // 0-indexed, 1 is row 2
  // actually let's just trace through all columns looking for recipe names
  const recipes = [];
  
  // Row 1 (index 1 in file based on head)
  // FILTRO FILA,,,,,,,,,,,,,,,,, (row 0)
  // 1,lentil fried ball with yogurt sauce,,,,,,Costo por ración,"0,65 €",,Vegan Buddha bowls with yogurt chutney
  
  const titleRow = records[1];
  const portionsRow = records[2];
  const ingredientStartRow = 4;

  const categoryId = '05184480-b4c1-404b-9aa2-b4ea128f968c';
  let addedCount = 0;
  let skippedCount = 0;

  // fetch all ingredients to match by name (case insensitive ideally)
  const { data: dbIngredients, error: errIng } = await supabase.from('ingredients').select('id, name');
  if (errIng) throw errIng;
  
  const getIngredientId = (name) => {
    const found = dbIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
    return found ? found.id : null;
  };

  // Find columns that have recipe names (they seem to be at index 1, 11, etc.)
  // Let's iterate over column indices to find titles.
  for (let c = 0; c < titleRow.length; c++) {
    const cell = titleRow[c]?.trim();
    if (cell && isNaN(cell) && cell !== 'Costo por ración' && !cell.includes('€')) {
      // Possible recipe title.
      // Let's check if the row below has "Raciones" around here.
      let portions = 25; // default
      for (let offset = -2; offset <= 2; offset++) {
        if (portionsRow[c + offset] === 'Raciones') {
          const portionsStr = portionsRow[c + offset + 2];
          if (portionsStr) {
             portions = parseFloat(portionsStr.replace(',', '.'));
          }
        }
      }

      console.log(`Processing recipe: ${cell} with portions: ${portions}`);

      // Check if exists
      const { data: existing, error: errExist } = await supabase
        .from('recipes')
        .select('id')
        .eq('name', cell);

      if (errExist) {
        console.error('Error checking existing recipe', errExist);
        continue;
      }

      if (existing && existing.length > 0) {
        console.log(`- Recipe '${cell}' already exists. Skipping.`);
        skippedCount++;
        continue;
      }

      // Read ingredients for this recipe down the column
      const recipeIngredients = [];
      let ingredientCol = c - 1 >= 0 && records[3][c - 1] === 'Ingredientes' ? c - 1 : c; 
      // Actually in the head output:
      // index 1: lentil fried ball..., index 10: Vegan Buddha bowls...
      // ingredients for lentil are in col 1, gr in col 3, etc. Wait!
      // In the head output, "Lentejas" is col 1. The title is also at col 1.
      
      let ingNameCol = c;
      let ingGrCol = c + 2; 
      let ingTotalCol = c + 3;
      let ingUnitCol = c + 4;

      for (let r = ingredientStartRow; r < records.length; r++) {
        const row = records[r];
        if (!row || !row[ingNameCol]) break; 
        
        const name = row[ingNameCol].trim();
        if (name === '' || name === 'Resumen nutricional' || name === 'Total gr plato:') break;

        const grPorcion = parseFloat(row[ingGrCol]?.replace(',', '.') || '0');
        const total = parseFloat(row[ingTotalCol]?.replace(',', '.') || '0');
        let unit = row[ingUnitCol]?.trim();
        if (!unit) unit = 'Gr';

        const ingId = getIngredientId(name);
        
        recipeIngredients.push({
          name_for_log: name,
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
          name: cell,
          category_id: categoryId,
          category: 'Vegetariano',
          portions: portions,
          is_vegetarian: true
        })
        .select('id')
        .single();
      
      if (errInsert) {
         console.error('Error inserting recipe', errInsert);
         continue;
      }
      
      addedCount++;
      const recipeId = newRecipe.id;
      
      // Insert Ingredients
      for (const ring of recipeIngredients) {
        if (!ring.ingredient_id) {
          console.warn(`- Ingredient not found in DB: ${ring.name_for_log}. Skipping this ingredient.`);
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
          console.error(`Error inserting ingredient ${ring.name_for_log}`, errRing);
        }
      }
    }
  }

  console.log(`\nImport summary:`);
  console.log(`- Added: ${addedCount}`);
  console.log(`- Skipped (already existed): ${skippedCount}`);
}

main().catch(console.error);
