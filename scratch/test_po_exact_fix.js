import { supabase } from '../lib/supabaseClient.js';

async function testPOExactFix() {
  console.log('--- TESTING EXACT PO INSERT WITH CORRECT COLUMN NAMES ---');

  // 1. Insert PO into purchase_orders
  const poPayload = {
    order_date: new Date().toISOString().split('T')[0],
    supplier_id: '4d65032c-ec10-4886-b159-3a5af4e2653c', // Makro
    total_amount: 14.76,
    status: 'pending'
  };

  const { data: poData, error: poErr } = await supabase
    .from('purchase_orders')
    .insert([poPayload])
    .select()
    .single();

  if (poErr) {
    console.error('❌ Error inserting purchase_orders:', poErr);
    return;
  }

  console.log('✅ PO created successfully:', poData);

  // 2. Insert items into purchase_order_items using EXACT real column names
  const itemsPayload = [
    {
      purchase_order_id: poData.id,
      ingredient_id: '2102c8e9-e8cf-4094-981c-fe41c2fa6b42', // Ajo morado
      ingredient_name: 'Ajo morado',
      quantity_ordered: 40,
      unit_price: 7.38,
      tipo_corte: null
    }
  ];

  const { data: poiData, error: poiErr } = await supabase
    .from('purchase_order_items')
    .insert(itemsPayload)
    .select();

  if (poiErr) {
    console.error('❌ Error inserting purchase_order_items:', poiErr);
  } else {
    console.log('✅ PO Items inserted successfully:', poiData);
  }

  // 3. Test querying PO with items and ingredients
  const { data: fetchedPO, error: fetchErr } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(id, name, phone, email), purchase_order_items(*, ingredients(id, name, unit, stock_actual, stock_reservado))')
    .eq('id', poData.id)
    .single();

  console.log('Fetched PO with full relations:', JSON.stringify(fetchedPO, null, 2));

  // Clean up test PO
  await supabase.from('purchase_orders').delete().eq('id', poData.id);
  console.log('Cleaned up test PO.');
}

testPOExactFix();
