import { supabase } from '../lib/supabaseClient.js';

async function checkColumns() {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .insert([{
      purchase_order_id: '00000000-0000-0000-0000-000000000000',
      ingredient_id: '00000000-0000-0000-0000-000000000000',
      quantity: 1,
      unit: 'Kg'
    }])
    .select();

  console.log('Insert test with minimal columns:', error);
}

checkColumns();
