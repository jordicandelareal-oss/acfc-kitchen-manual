import { supabase } from '../lib/supabaseClient.js';
import { calcularCosteLineaIngrediente } from '../frontend/src/utils/mathUtils.js';

async function testGrouping() {
  console.log('--- TESTING SUPPLIER GROUPING & CAIRO RULES ---');

  // Fetch ingredients with suppliers
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('*, suppliers(id, name, phone, email)')
    .gt('stock_reservado', 0);

  // Fetch menu planner to check recipes & cuts if any
  const { data: menuDays } = await supabase
    .from('menu_planner')
    .select('*, lunch_recipe:recipes!menu_planner_lunch_recipe_id_fkey(*, recipe_ingredients(*, ingredients(*)))');

  console.log(`Ingredients needing purchase: ${ingredients ? ingredients.length : 0}`);

  // Test cost calculation formula
  ingredients.forEach(ing => {
    const qty = Number(ing.stock_reservado) - Number(ing.stock_actual);
    const cost = calcularCosteLineaIngrediente(ing, qty);
    console.log(`Item: ${ing.name} | Qty: ${qty} ${ing.unit} | Net Cost/Kg: €${ing.calculated_net_cost_kg || ing.purchase_price} | Line Total: €${cost.toFixed(2)}`);
  });
}

testGrouping().catch(console.error);
