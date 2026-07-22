import { supabase } from '../lib/supabaseClient.js';

async function test() {
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, portions, recipe_ingredients(ingredient_id, quantity, quantity_per_portion)');

  console.log('Sample recipes:', JSON.stringify(recipes.slice(0, 3), null, 2));
}

test();
