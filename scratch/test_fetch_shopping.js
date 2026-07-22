import { supabase } from '../lib/supabaseClient.js';

async function testFetchShopping() {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, unit, stock_actual, stock_reservado, stock_minimo, purchase_price, purchase_format_gr, proveedor_principal, supplier_id')
    .order('name', { ascending: true });

  if (error) {
    console.error('❌ Supabase Query Error:', error);
  } else {
    console.log(`✅ Supabase Query Success! Returned ${data.length} ingredients.`);
    const reservedItems = data.filter(i => (Number(i.stock_reservado) || 0) > (Number(i.stock_actual) || 0));
    console.log(`Ingredients needing purchase (stock_reservado > stock_actual): ${reservedItems.length}`);
    console.log('Sample reserved item:', reservedItems[0]);
  }
}

testFetchShopping();
