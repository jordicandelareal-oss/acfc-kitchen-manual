import { createPurchaseOrder, fetchPurchaseOrders, fetchShoppingList } from '../frontend/src/api.js';

async function testFullPOFlow() {
  console.log('--- TESTING FULL PO SAVING FLOW IN NODE ---');

  // 1. Get shopping list items needing purchase
  const { items } = await fetchShoppingList();
  const reservedItems = items.filter(i => (Number(i.stock_reservado) || 0) > (Number(i.stock_actual) || 0));

  console.log(`Found ${reservedItems.length} reserved ingredients.`);

  if (reservedItems.length > 0) {
    const sampleItem = reservedItems[0];

    const orderPayload = {
      order_date: new Date().toISOString().split('T')[0],
      supplier_id: sampleItem.supplier_id || null,
      total_amount: Number(sampleItem.stock_reservado) * Number(sampleItem.calculated_net_cost_kg || 1),
      status: 'pending'
    };

    const itemsPayload = [{
      ingredient_id: sampleItem.id,
      ingredient_name: sampleItem.name,
      quantity_ordered: Number(sampleItem.stock_reservado),
      unit_price: Number(sampleItem.calculated_net_cost_kg || sampleItem.purchase_price || 0),
      tipo_corte: null
    }];

    console.log('Inserting order payload:', orderPayload);
    console.log('Inserting items payload:', itemsPayload);

    const { data: createdPO, error } = await createPurchaseOrder(orderPayload, itemsPayload);

    if (error) {
      console.error('❌ FAILED to create PO:', error);
    } else {
      console.log('✅ SUCCESS! Created PO with ID:', createdPO.id);

      // Fetch pending orders
      const { data: pendingOrders } = await fetchPurchaseOrders('pending');
      console.log(`Fetched ${pendingOrders.length} pending orders.`);
    }
  }
}

testFullPOFlow();
