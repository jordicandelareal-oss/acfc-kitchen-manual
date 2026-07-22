import { supabase } from '../lib/supabaseClient.js';

async function findSchema() {
  console.log('--- FINDING REAL COLUMNS OF purchase_order_items ---');

  // Try inserting dummy object and check error message for valid columns
  const testCols = ['quantity', 'cantidad', 'qty', 'amount', 'price_per_unit', 'precio_unitario', 'price', 'unit', 'unidad'];

  for (const col of testCols) {
    const obj = {
      purchase_order_id: '00000000-0000-0000-0000-000000000000',
      ingredient_id: '00000000-0000-0000-0000-000000000000',
      [col]: 1
    };

    const { error } = await supabase.from('purchase_order_items').insert([obj]);
    console.log(`Column '${col}':`, error ? error.message : 'SUCCESS');
  }
}

findSchema();
