import { supabase } from '../lib/supabaseClient.js';

async function testFetchShoppingExact() {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, unit, stock_actual, stock_reservado, stock_minimo, stock_maximo, purchase_price, purchase_format_gr, waste_percentage, coste_neto_calculado, precio_por_kg, precio_por_u, proveedor_principal, supplier_id, output_scenario, suppliers(id, name, phone, email)')
    .order('name', { ascending: true });

  if (error) {
    console.error('❌ Supabase Query Error:', error);
  } else {
    console.log(`✅ Supabase Query Success! Returned ${data.length} ingredients.`);
    const reservedItems = data.filter(i => (Number(i.stock_reservado) || 0) > (Number(i.stock_actual) || 0));
    console.log(`Ingredients with (stock_reservado > stock_actual): ${reservedItems.length}`);
    if (reservedItems.length > 0) {
      console.log('Sample reserved ingredient:', reservedItems[0]);
    }
  }
}

testFetchShoppingExact();
