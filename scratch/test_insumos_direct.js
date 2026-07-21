import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aosweyggyalowhogjatz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc3dleWdneWFsb3dob2dqYXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NjQzOTUsImV4cCI6MjA5ODQ0MDM5NX0.od5Zg10H_EflslfXYksolRAu81nFi2zd0vZRXDeqrcs'
);

async function main() {
  const { data, error } = await supabase.from('ingredients').select('*');
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Total ingredients:', data.length);
  
  let totalCalculated = 0;
  
  data.forEach(item => {
    const stock = Number(item.stock_actual) || 0;
    
    // Fallbacks
    const cost = Number(item.calculated_net_cost_kg || item.precio_mas_bajo || item.precio_por_u || item.precio_por_kg || item.purchase_price || 0);
    const itemVal = stock * cost;
    totalCalculated += itemVal;
    
    if (stock > 0) {
      console.log(`- ${item.name}: Stock = ${stock}, Cost = ${cost}, Value = ${itemVal}`);
    }
  });
  
  console.log('Total calculated value:', totalCalculated);
}
main();
