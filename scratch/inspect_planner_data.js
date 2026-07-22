import { supabase } from '../lib/supabaseClient.js';

async function inspectPlanner() {
  const { data: menuPlanner } = await supabase.from('menu_planner').select('*');
  console.log('Menu planner rows:', menuPlanner);

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*, ingredients(*, suppliers(*)))');

  console.log(`Recipes with ingredients fetched: ${recipes ? recipes.length : 0}`);
}

inspectPlanner();
