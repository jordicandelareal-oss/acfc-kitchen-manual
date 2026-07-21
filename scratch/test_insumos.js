import { fetchIngredients } from '../frontend/src/api.js';

async function main() {
  try {
    const res = await fetchIngredients();
    if (res && res.data && res.data.length > 0) {
      console.log('Keys:', Object.keys(res.data[0]));
      console.log('Sample ingredient data:', res.data[0]);
    } else {
      console.log('No ingredients found or res is invalid:', res);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

main();
