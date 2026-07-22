import { supabase } from '../lib/supabaseClient.js';

async function testFetchPOFull() {
  const { data: pos, error: poErr } = await supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*, ingredients(id, name, unit, stock_actual, stock_reservado))')
    .order('created_at', { ascending: false });

  const { data: suppliers } = await supabase.from('suppliers').select('*');
  const supplierMap = {};
  (suppliers || []).forEach(s => { supplierMap[s.id] = s; });

  const hydrated = (pos || []).map(po => ({
    ...po,
    suppliers: supplierMap[po.supplier_id] || null
  }));

  console.log(`Fetched ${hydrated.length} purchase orders with full relations.`);
  if (hydrated.length > 0) {
    console.log('Sample hydrated PO:', JSON.stringify(hydrated[0], null, 2));
  }
}

testFetchPOFull();
