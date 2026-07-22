import { supabase } from '../lib/supabaseClient.js';
import { 
  generarBandejasCairoCronologicas, 
  isElCairoSupplier, 
  formatSupplierMessage 
} from '../frontend/src/utils/mathUtils.js';

async function validateCairoFlow() {
  console.log('--- VALIDATING CARNICERÍA EL CAIRO FLOW ---');

  // Fetch real menu_planner data
  const { data: menuPlanner, error: pErr } = await supabase
    .from('menu_planner')
    .select(`
      *,
      breakfast_recipe:recipes!breakfast_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
      lunch_recipe:recipes!lunch_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
      lunch_side_recipe:recipes!lunch_side_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
      dinner_recipe:recipes!dinner_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*))))
    `)
    .order('date', { ascending: true });

  if (pErr) {
    console.error('Error fetching menu_planner:', pErr);
    process.exit(1);
  }

  // Test 1: Check supplier matching
  console.log('\n[TEST 1] Supplier Matching:');
  console.log('  "Carnicería El Cairo":', isElCairoSupplier('Carnicería El Cairo'));
  console.log('  "Carniceria Samir":', isElCairoSupplier('Carniceria Samir'));
  console.log('  "Makro":', isElCairoSupplier('Makro'));
  console.log('  "Mercadona":', isElCairoSupplier('Mercadona'));

  // Test 2: Chronological Cairo trays generation
  const cairoTrays = generarBandejasCairoCronologicas(menuPlanner);
  console.log(`\n[TEST 2] Generated ${cairoTrays.length} independent Cairo trays chronologically:`);
  cairoTrays.forEach((tray, i) => {
    console.log(`  Tray ${i + 1}: ${tray.date} (${tray.mealLabel}) -> ${tray.name} | Qty needed: ${tray.neededQuantity}${tray.unit} | Cost: €${tray.totalCost.toFixed(2)}`);
  });

  // Test 3: Export Message Formatting
  const msg = formatSupplierMessage('Carnicería El Cairo', cairoTrays, true);
  console.log('\n[TEST 3] Formatted Export Message for Carnicería El Cairo:');
  console.log('--------------------------------------------------');
  console.log(msg);
  console.log('--------------------------------------------------');

  // Verify constraints
  const containsRecipeName = cairoTrays.some(t => t.dishName && msg.includes(t.dishName));
  console.log('\n[VALIDATION CHECK] Hides recipe name:', !containsRecipeName ? 'PASSED ✅' : 'FAILED ❌');
  
  process.exit(0);
}

validateCairoFlow().catch(console.error);
