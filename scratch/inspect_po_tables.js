import { supabase } from '../lib/supabaseClient.js';

async function testSelect() {
  const { data: po, error: err1 } = await supabase.from('purchase_orders').select('*');
  console.log('po select result:', po, err1);

  const { data: poi, error: err2 } = await supabase.from('purchase_order_items').select('*');
  console.log('poi select result:', poi, err2);
}

testSelect();
