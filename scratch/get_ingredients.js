import { supabase } from '../lib/supabaseClient.js';
import fs from 'fs';

async function main() {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name');
  if (error) {
    console.error('Error fetching ingredients:', error);
  } else {
    fs.writeFileSync('scratch/ingredients_dump.json', JSON.stringify(data, null, 2));
    console.log(`Loaded ${data.length} ingredients.`);
  }
}
main();
