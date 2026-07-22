import { supabase } from '../lib/supabaseClient.js';
import { calcularCosteLineaIngrediente } from '../frontend/src/utils/mathUtils.js';

async function testCairoSequential() {
  console.log('--- TESTING CARNICERÍA EL CAIRO SEQUENTIAL CHRONOLOGICAL ALLOCATION ---');

  // Fetch menu planner with recipes and ingredients
  const { data: menuPlanner } = await supabase
    .from('menu_planner')
    .select(`
      *,
      breakfast_recipe:recipes!menu_planner_breakfast_recipe_id_fkey(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
      lunch_recipe:recipes!menu_planner_lunch_recipe_id_fkey(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
      snack_recipe:recipes!menu_planner_snack_recipe_id_fkey(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
      dinner_recipe:recipes!menu_planner_dinner_recipe_id_fkey(*, recipe_ingredients(*, ingredients(*, suppliers(*))))
    `)
    .order('date', { ascending: true });

  console.log(`Menu planner days fetched: ${menuPlanner ? menuPlanner.length : 0}`);

  // Build chronological meals list
  const mealsList = [];
  (menuPlanner || []).forEach(day => {
    const players = Number(day.players || 20);
    const slots = [
      { key: 'breakfast', label: 'Desayuno', recipe: day.breakfast_recipe },
      { key: 'lunch', label: 'Comida', recipe: day.lunch_recipe },
      { key: 'snack', label: 'Merienda', recipe: day.snack_recipe },
      { key: 'dinner', label: 'Cena', recipe: day.dinner_recipe }
    ];

    slots.forEach(slot => {
      if (slot.recipe && slot.recipe.recipe_ingredients) {
        mealsList.push({
          date: day.date,
          mealLabel: slot.label,
          recipeName: slot.recipe.name,
          players,
          recipe_ingredients: slot.recipe.recipe_ingredients
        });
      }
    });
  });

  console.log(`Total planned meals in schedule: ${mealsList.length}`);

  // Group Cairo ingredients sequentially
  const EL_CAIRO_UUID = 'd257d90b-ad0b-4f84-97a0-fee73612953c';
  const checkCairo = (s) => s && s.toLowerCase().includes('cairo');

  // Track stock_actual per ingredient for Cairo sequential deduction
  const cairoStockRemaining = {};
  const cairoOrderTrays = [];

  mealsList.forEach(meal => {
    (meal.recipe_ingredients || []).forEach(ri => {
      const ing = ri.ingredients;
      if (!ing) return;

      const supplierId = ing.supplier_id || (ing.suppliers ? ing.suppliers.id : null);
      const supplierName = ing.suppliers?.name || ing.proveedor_principal || '';
      const isElCairo = supplierId === EL_CAIRO_UUID || checkCairo(supplierName);

      if (!isElCairo) return;

      const ingId = ing.id;
      if (cairoStockRemaining[ingId] === undefined) {
        cairoStockRemaining[ingId] = Number(ing.stock_actual || 0);
      }

      const qtyPerPortion = Number(ri.quantity_per_portion || 0);
      const dishNeeded = qtyPerPortion * meal.players;
      let remStock = cairoStockRemaining[ingId];

      let dishDeficit = 0;
      if (remStock >= dishNeeded) {
        cairoStockRemaining[ingId] -= dishNeeded;
        dishDeficit = 0;
      } else if (remStock > 0) {
        dishDeficit = dishNeeded - remStock;
        cairoStockRemaining[ingId] = 0;
      } else {
        dishDeficit = dishNeeded;
      }

      if (dishDeficit > 0) {
        const corte = ri.tipo_corte || 'entera';
        const lineCost = calcularCosteLineaIngrediente(ing, dishDeficit);
        cairoOrderTrays.push({
          ingredientId: ingId,
          ingredientName: ing.name,
          tipoCorte: corte,
          quantity: dishDeficit,
          unit: ri.unit || ing.unit || 'Gr',
          dishName: meal.recipeName,
          mealLabel: meal.mealLabel,
          date: meal.date,
          lineCost,
          unitPrice: Number(ing.calculated_net_cost_kg || ing.purchase_price || 0)
        });
      }
    });
  });

  console.log(`Generated ${cairoOrderTrays.length} independent Cairo trays:`, JSON.stringify(cairoOrderTrays, null, 2));
}

testCairoSequential().catch(console.error);
