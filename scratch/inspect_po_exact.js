import { supabase } from '../lib/supabaseClient.js';

async function inspectPOExact() {
  console.log('--- INSPECTING PURCHASE_ORDERS & PURCHASE_ORDER_ITEMS SCHEMAS ---');

  // Test insert into purchase_orders
  const testPO = {
    order_date: new Date().toISOString().split('T')[0],
    supplier_id: null,
    total_amount: 100.5,
    status: 'pending'
  };

  console.log('Attempting test insert into purchase_orders:', testPO);
  const { data: poData, error: poError } = await supabase
    .from('purchase_orders')
    .insert([testPO])
    .select()
    .single();

  if (poError) {
    console.error('❌ Error inserting purchase_orders:', poError);
  } else {
    console.log('✅ Successfully inserted purchase_orders record:', poData);

    // Test insert into purchase_order_items
    const testItem = {
      purchase_order_id: poData.id,
      ingredient_id: '1ac63e42-ce0b-45c8-b715-ab8bdec6538a', // Aceitunas negras
      quantity: 10,
      unit: 'GR',
      price_per_unit: 7
    };

    console.log('Attempting test insert into purchase_order_items:', testItem);
    const { data: itemData, error: itemError } = await supabase
      .from('purchase_order_items')
      .insert([testItem])
      .select();

    if (itemError) {
      console.error('❌ Error inserting purchase_order_items:', itemError);
    } else {
      console.log('✅ Successfully inserted purchase_order_items record:', itemData);
    }

    // Clean up test PO
    await supabase.from('purchase_orders').delete().eq('id', poData.id);
    console.log('Cleaned up test purchase order.');
  }
}

inspectPOExact();
