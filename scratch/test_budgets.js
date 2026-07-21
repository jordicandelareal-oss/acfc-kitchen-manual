import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aosweyggyalowhogjatz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc3dleWdneWFsb3dob2dqYXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NjQzOTUsImV4cCI6MjA5ODQ0MDM5NX0.od5Zg10H_EflslfXYksolRAu81nFi2zd0vZRXDeqrcs'
);

async function main() {
  const { data: budgets, error: err1 } = await supabase.from('purchase_budgets').select('*');
  const { data: orders, error: err2 } = await supabase.from('purchase_orders').select('*');
  
  console.log('Budgets:', budgets, err1);
  console.log('Orders Count:', orders ? orders.length : 0, err2);
  if (orders && orders.length > 0) {
    console.log('Sample Order:', orders[0]);
  }
}
main();
