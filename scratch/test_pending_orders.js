import { supabase } from '../lib/supabaseClient.js';

async function testPendingOrders() {
  const { data: orders, error } = await supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*, ingredients(name, stock_actual, stock_reservado))')
    .in('status', ['ordered', 'pending', 'sent']);

  if (error) {
    console.error('Error fetching pending orders:', error);
    return;
  }

  console.log(`Active pending/ordered POs count: ${orders ? orders.length : 0}`);
  
  const pendingQtyByIngredient = {};
  (orders || []).forEach(po => {
    (po.purchase_order_items || []).forEach(item => {
      const ingId = item.ingredient_id;
      if (!pendingQtyByIngredient[ingId]) {
        pendingQtyByIngredient[ingId] = 0;
      }
      pendingQtyByIngredient[ingId] += Number(item.quantity || 0);
    });
  });

  console.log('Pending ordered quantities by ingredient:', pendingQtyByIngredient);
}

testPendingOrders();
