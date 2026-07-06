import { fetchRecipesWithIngredients } from '../frontend/src/api.js';

async function main() {
  const { data, error } = await fetchRecipesWithIngredients();
  if (error) {
    console.error('Fetch error:', error);
  } else {
    console.log('Successfully fetched', data ? data.length : 0, 'recipes');
    if (data && data[0]) {
      console.log('First recipe sample name:', data[0].name);
      console.log('First recipe ingredients count:', data[0].recipe_ingredients ? data[0].recipe_ingredients.length : 0);
    }
  }
}
main();
