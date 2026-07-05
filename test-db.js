import { supabase } from './lib/supabaseClient.js';

async function testConnection() {
  console.log('🔄 Conectando con Supabase...');
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .ilike('name', '%pollo%');

  if (error) {
    console.error('❌ Error:', error.message);
  } else {
    console.log('✅ Ingredientes de pollo:');
    console.table(data);
  }
}

testConnection();
