import { supabase } from '../lib/supabaseClient.js';

async function testCols2() {
  const { data: po } = await supabase
    .from('purchase_orders')
    .insert([{ status: 'pending', total_amount: 0 }])
    .select()
    .single();

  if (po) {
    const { data: item, error: itemErr } = await supabase
      .from('purchase_order_items')
      .insert([{
        purchase_order_id: po.id,
        ingredient_id: '1ac63e42-ce0b-45c8-b715-ab8bdec6538a',
        ingredient_name: 'Aceitunas negras'
      }])
      .select();

    console.log('Result with ingredient_name:', item, itemErr);

    await supabase.from('purchase_orders').delete().eq('id', po.id);
  }
}

testCols2();
