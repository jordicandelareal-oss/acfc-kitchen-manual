import { supabase } from '../lib/supabaseClient.js';

async function main() {
  // Let's do a select from recipes and recipe_ingredients to see their columns/metadata
  const { data: rData, error: rErr } = await supabase.from('recipes').select('*').limit(1);
  console.log('recipes columns:', rData ? Object.keys(rData[0] || {}) : rErr);

  const { data: riData, error: riErr } = await supabase.from('recipe_ingredients').select('*').limit(1);
  console.log('recipe_ingredients columns:', riData ? Object.keys(riData[0] || {}) : riErr);
}
main();
