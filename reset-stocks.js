import { supabase } from './lib/supabaseClient.js';

async function resetStocks() {
  console.log('🔄 Reiniciando todos los stocks de ingredientes a 0...');
  
  // Update all rows (using neq on id to bypass single-row checks if any, or just empty filter)
  const { data, error } = await supabase
    .from('ingredients')
    .update({
      stock_actual: 0,
      stock_minimo: 0,
      stock_maximo: 0,
      current_stock: 0,
      min_stock: 0
    })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('❌ Error al reiniciar stocks:', error.message);
  } else {
    console.log('✅ Stocks reiniciados con éxito.');
  }
}

resetStocks();
