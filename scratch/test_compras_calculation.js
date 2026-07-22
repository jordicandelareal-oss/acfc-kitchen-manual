import { supabase } from '../lib/supabaseClient.js';

async function testComprasCalculation() {
  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('*')
    .order('name');

  if (error) {
    console.error(error);
    return;
  }

  const itemsToBuy = ingredients.map(ing => {
    const stockActual = Number(ing.stock_actual || 0);
    const stockReservado = Number(ing.stock_reservado || 0);
    const stockMinimo = Number(ing.stock_minimo || 0);
    
    // Strict calculation as required by user prompt
    const targetRequired = Math.max(stockReservado, stockMinimo);
    const necesidad = Math.max(0, targetRequired - stockActual);
    const price = Number(ing.precio_compra || ing.purchase_price || ing.coste_neto_calculado || ing.precio_por_kg || 0);

    return {
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      stockActual,
      stockReservado,
      stockMinimo,
      necesidad,
      price,
      totalCost: necesidad * price
    };
  }).filter(item => item.necesidad > 0);

  console.log(`Total ingredients to buy: ${itemsToBuy.length}`);
  console.log('Sample items to buy:', JSON.stringify(itemsToBuy.slice(0, 5), null, 2));
}

testComprasCalculation();
