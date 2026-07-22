import { supabase } from '../lib/supabaseClient.js';

async function testSuppliers() {
  const { data: suppliers } = await supabase.from('suppliers').select('*');
  console.log('Suppliers in DB:', suppliers);

  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('*, suppliers(id, name, phone, email)')
    .gt('stock_reservado', 0);

  console.log('\nReserved ingredients with suppliers:', ingredients ? ingredients.length : 0);
  if (ingredients && ingredients.length > 0) {
    console.log('Sample ingredient:', ingredients[0]);
  }
}

testSuppliers();
