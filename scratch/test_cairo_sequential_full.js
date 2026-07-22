import { supabase } from '../lib/supabaseClient.js';
import { calcularCosteLineaIngrediente, formatSupplierMessage } from '../frontend/src/utils/mathUtils.js';

async function testCairoSequentialFull() {
  const { data: menuPlanner } = await supabase
    .from('menu_planner')
    .select(`
      *,
      breakfast_recipe:recipes!breakfast_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
      lunch_recipe:recipes!lunch_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
      snack_recipe:recipes!snack_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
      dinner_recipe:recipes!dinner_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*))))
    `)
    .order('date', { ascending: true });

  const EL_CAIRO_UUID = 'd257d90b-ad0b-4f84-97a0-fee73612953c';
  const checkCairo = (s) => s && s.toLowerCase().includes('cairo');

  const cairoStockMap = {};
  const cairoTrays = [];

  (menuPlanner || []).forEach(day => {
    const playersCount = Number(day.lunch_players || day.lunch_players_count || 10);
    const slots = [
      { label: 'Comida', recipe: day.lunch_recipe, players: playersCount }
    ];

    slots.forEach(slot => {
      if (slot.recipe && slot.recipe.recipe_ingredients && slot.players > 0) {
        slot.recipe.recipe_ingredients.forEach(ri => {
          const ing = ri.ingredients;
          if (!ing) return;

          const supplierId = ing.supplier_id || (ing.suppliers ? ing.suppliers.id : null);
          const supplierName = ing.suppliers?.name || ing.proveedor_principal || '';
          const isElCairo = supplierId === EL_CAIRO_UUID || checkCairo(supplierName);

          if (!isElCairo) return;

          const ingId = ing.id;
          if (cairoStockMap[ingId] === undefined) {
            cairoStockMap[ingId] = Number(ing.stock_actual || 0);
          }

          const qtyPerPortion = Number(ri.quantity_per_portion || ri.quantity || 0);
          const dishNeeded = qtyPerPortion * slot.players;
          let remStock = cairoStockMap[ingId];

          let deficit = 0;
          if (remStock >= dishNeeded) {
            cairoStockMap[ingId] -= dishNeeded;
            deficit = 0;
          } else if (remStock > 0) {
            deficit = dishNeeded - remStock;
            cairoStockMap[ingId] = 0;
          } else {
            deficit = dishNeeded;
          }

          if (deficit > 0) {
            const corte = ri.tipo_corte || 'entera';
            const cost = calcularCosteLineaIngrediente(ing, deficit);

            cairoTrays.push({
              id: `${ingId}_${day.date}_${slot.label}_${cairoTrays.length}`,
              ingredientId: ingId,
              name: `${ing.name} (${corte})`,
              rawName: ing.name,
              tipoCorte: corte,
              neededQuantity: deficit,
              unit: ri.unit || ing.unit || 'GR',
              totalCost: cost,
              unitPrice: Number(ing.calculated_net_cost_kg || ing.purchase_price || 0),
              date: day.date,
              mealLabel: slot.label,
              dishName: slot.recipe.name,
              supplierId: supplierId,
              supplierName: supplierName || 'Carnicería El Cairo',
              isElCairo: true
            });
          }
        });
      }
    });
  });

  console.log(`Generated ${cairoTrays.length} independent Cairo trays:`);
  console.log(JSON.stringify(cairoTrays, null, 2));

  // Format WhatsApp message
  const msg = formatSupplierMessage('Carnicería El Cairo', cairoTrays, true);
  console.log('\n--- COMPILED WHATSAPP / EMAIL MESSAGE FOR CARNICERÍA EL CAIRO ---');
  console.log(msg);
}

testCairoSequentialFull().catch(console.error);
