import { supabase } from './lib/supabaseClient.js';

async function testConnection() {
  console.log('🔄 Conectando con Supabase...');
  const { data, error } = await supabase
    .from('suppliers')
    .select('*');

  if (error) {
    console.error('❌ Error de conexión:', error.message);
  } else {
    console.log('✅ Conexión exitosa. Datos de suppliers:');
    console.table(data);
  }
}

testConnection();
