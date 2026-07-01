// ============================================================
// seed_insumos.js — Script de siembra de ingredientes/insumos
// Ejecutar con: node seed_insumos.js
// Requiere: SUPABASE_URL y SUPABASE_SERVICE_KEY en .env.local
// ============================================================

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aosweyggyalowhogjatz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Datos de insumos ACFC 2025 ─────────────────────────────────────────────
// Fuente: Planificación alimentaria v2.0 + datos ACFC 2025
// Columnas: name, category, subcategory, nutritional_category,
//           unit, precio_mas_bajo, precio_por_gramo, proveedor_principal,
//           precios_por_proveedor (JSONB), current_stock, min_stock
const INSUMOS = [
  // ── PROTEÍNAS ANIMALES ─────────────────────────────────────
  {
    name: 'Carne picada de vacuno',
    category: 'Proteínas',
    subcategory: 'Carnes',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 8.05,
    precio_por_gramo: 0.00805,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 8.05,
      'Carnicería Samir': 7.80,
      Mercadona: 9.20,
    },
    current_stock: 0,
    min_stock: 5,
  },
  {
    name: 'Carne picada de cerdo',
    category: 'Proteínas',
    subcategory: 'Carnes',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 5.20,
    precio_por_gramo: 0.00520,
    proveedor_principal: 'Carnicería Samir',
    precios_por_proveedor: {
      Makro: 5.50,
      'Carnicería Samir': 5.20,
      Mercadona: 6.10,
    },
    current_stock: 0,
    min_stock: 3,
  },
  {
    name: 'Muslos de pollo',
    category: 'Proteínas',
    subcategory: 'Aves',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 4.33,
    precio_por_gramo: 0.00433,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 4.33,
      'Carnicería Samir': 4.10,
      Mercadona: 5.20,
      'Star Cash&Carry': 3.95,
    },
    current_stock: 0,
    min_stock: 8,
  },
  {
    name: 'Contramuslos de pollo',
    category: 'Proteínas',
    subcategory: 'Aves',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 2.49,
    precio_por_gramo: 0.00249,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 2.49,
      'Carnicería Samir': 2.30,
      Mercadona: 3.10,
      'Star Cash&Carry': 2.25,
    },
    current_stock: 0,
    min_stock: 10,
  },
  {
    name: 'Pechuga de pollo',
    category: 'Proteínas',
    subcategory: 'Aves',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 5.75,
    precio_por_gramo: 0.00575,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 5.75,
      'Carnicería Samir': 5.50,
      Mercadona: 6.90,
    },
    current_stock: 0,
    min_stock: 5,
  },
  {
    name: 'Bacon / Panceta',
    category: 'Proteínas',
    subcategory: 'Embutidos',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 4.61,
    precio_por_gramo: 0.00461,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 4.61,
      Mercadona: 5.30,
    },
    current_stock: 0,
    min_stock: 2,
  },
  {
    name: 'Costillas de cerdo',
    category: 'Proteínas',
    subcategory: 'Carnes',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 5.80,
    precio_por_gramo: 0.00580,
    proveedor_principal: 'Carnicería Samir',
    precios_por_proveedor: {
      Makro: 6.20,
      'Carnicería Samir': 5.80,
      Mercadona: 7.10,
    },
    current_stock: 0,
    min_stock: 3,
  },
  {
    name: 'Salmón fresco',
    category: 'Proteínas',
    subcategory: 'Pescado',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 10.50,
    precio_por_gramo: 0.01050,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 10.50,
      Mercadona: 13.90,
    },
    current_stock: 0,
    min_stock: 2,
  },
  {
    name: 'Jamón york',
    category: 'Proteínas',
    subcategory: 'Embutidos',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 6.30,
    precio_por_gramo: 0.00630,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 6.30,
      Mercadona: 7.50,
      'Star Cash&Carry': 5.90,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Salchicha frankfurt',
    category: 'Proteínas',
    subcategory: 'Embutidos',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 4.20,
    precio_por_gramo: 0.00420,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 4.20,
      Mercadona: 4.90,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Hamburguesa (congelada)',
    category: 'Proteínas',
    subcategory: 'Carnes',
    nutritional_category: 'Proteína animal',
    unit: 'Kg',
    precio_mas_bajo: 5.50,
    precio_por_gramo: 0.00550,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 5.50,
      Mercadona: 6.40,
    },
    current_stock: 0,
    min_stock: 2,
  },
  // ── LÁCTEOS ────────────────────────────────────────────────
  {
    name: 'Leche semidesnatada',
    category: 'Lácteos',
    subcategory: 'Leche',
    nutritional_category: 'Lácteo',
    unit: 'L',
    precio_mas_bajo: 0.72,
    precio_por_gramo: 0.000720,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 0.727,
      Mercadona: 0.85,
      'Star Cash&Carry': 0.69,
    },
    current_stock: 0,
    min_stock: 10,
  },
  {
    name: 'Nata para cocinar',
    category: 'Lácteos',
    subcategory: 'Cremas',
    nutritional_category: 'Lácteo',
    unit: 'L',
    precio_mas_bajo: 2.47,
    precio_por_gramo: 0.002473,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 2.47,
      Mercadona: 2.90,
    },
    current_stock: 0,
    min_stock: 3,
  },
  {
    name: 'Queso lonchas',
    category: 'Lácteos',
    subcategory: 'Quesos',
    nutritional_category: 'Lácteo',
    unit: 'Kg',
    precio_mas_bajo: 6.25,
    precio_por_gramo: 0.006250,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 6.25,
      Mercadona: 7.20,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Mantequilla',
    category: 'Lácteos',
    subcategory: 'Grasas',
    nutritional_category: 'Lácteo',
    unit: 'Kg',
    precio_mas_bajo: 7.80,
    precio_por_gramo: 0.00780,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 7.80,
      Mercadona: 8.90,
    },
    current_stock: 0,
    min_stock: 0.5,
  },
  // ── CEREALES Y PASTAS ──────────────────────────────────────
  {
    name: 'Macarrones',
    category: 'Cereales',
    subcategory: 'Pasta',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 1.10,
    precio_por_gramo: 0.001100,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 1.10,
      Mercadona: 1.30,
      Chino: 0.99,
    },
    current_stock: 0,
    min_stock: 5,
  },
  {
    name: 'Espaguetis',
    category: 'Cereales',
    subcategory: 'Pasta',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 1.10,
    precio_por_gramo: 0.001100,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 1.10,
      Mercadona: 1.20,
      Chino: 0.95,
    },
    current_stock: 0,
    min_stock: 5,
  },
  {
    name: 'Arroz redondo',
    category: 'Cereales',
    subcategory: 'Arroz',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 0.90,
    precio_por_gramo: 0.000900,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 0.90,
      Mercadona: 1.05,
      Chino: 0.85,
    },
    current_stock: 0,
    min_stock: 5,
  },
  {
    name: 'Arroz largo / Basmati',
    category: 'Cereales',
    subcategory: 'Arroz',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 1.50,
    precio_por_gramo: 0.001500,
    proveedor_principal: 'Chino',
    precios_por_proveedor: {
      Makro: 1.80,
      Mercadona: 1.90,
      Chino: 1.50,
    },
    current_stock: 0,
    min_stock: 3,
  },
  {
    name: 'Pan de molde',
    category: 'Cereales',
    subcategory: 'Pan',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 1.52,
    precio_por_gramo: 0.001525,
    proveedor_principal: 'Mercadona',
    precios_por_proveedor: {
      Makro: 1.65,
      Mercadona: 1.52,
    },
    current_stock: 0,
    min_stock: 2,
  },
  {
    name: 'Pan hotdog',
    category: 'Cereales',
    subcategory: 'Pan',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 2.25,
    precio_por_gramo: 0.002250,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 2.25,
      Mercadona: 2.60,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Pan hamburguesa',
    category: 'Cereales',
    subcategory: 'Pan',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 2.25,
    precio_por_gramo: 0.002250,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 2.25,
      Mercadona: 2.80,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Cous cous',
    category: 'Cereales',
    subcategory: 'Semillas',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 1.80,
    precio_por_gramo: 0.001800,
    proveedor_principal: 'Chino',
    precios_por_proveedor: {
      Makro: 2.10,
      Chino: 1.80,
      'Star Cash&Carry': 1.95,
    },
    current_stock: 0,
    min_stock: 2,
  },
  // ── VERDURAS Y VEGETALES ───────────────────────────────────
  {
    name: 'Lechuga iceberg',
    category: 'Verduras',
    subcategory: 'Hoja verde',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 1.07,
    precio_por_gramo: 0.001075,
    proveedor_principal: 'Mercadona',
    precios_por_proveedor: {
      Makro: 1.075,
      Mercadona: 1.10,
      Chino: 0.90,
    },
    current_stock: 0,
    min_stock: 3,
  },
  {
    name: 'Mezclum / Brotes',
    category: 'Verduras',
    subcategory: 'Hoja verde',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 5.97,
    precio_por_gramo: 0.005976,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 5.97,
      Mercadona: 6.50,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Zanahoria',
    category: 'Verduras',
    subcategory: 'Tubérculo',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 0.60,
    precio_por_gramo: 0.000600,
    proveedor_principal: 'Mercadona',
    precios_por_proveedor: {
      Makro: 0.70,
      Mercadona: 0.60,
      Chino: 0.55,
    },
    current_stock: 0,
    min_stock: 2,
  },
  {
    name: 'Cebolla',
    category: 'Verduras',
    subcategory: 'Bulbo',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 0.55,
    precio_por_gramo: 0.000550,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 0.55,
      Mercadona: 0.70,
      Chino: 0.50,
    },
    current_stock: 0,
    min_stock: 5,
  },
  {
    name: 'Ajo morado',
    category: 'Verduras',
    subcategory: 'Bulbo',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 4.70,
    precio_por_gramo: 0.004700,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 4.70,
      Mercadona: 5.50,
      Chino: 4.20,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Tomate triturado (lata)',
    category: 'Verduras',
    subcategory: 'Conservas',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 0.70,
    precio_por_gramo: 0.000700,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 0.70,
      Mercadona: 0.85,
      'Star Cash&Carry': 0.65,
    },
    current_stock: 0,
    min_stock: 5,
  },
  {
    name: 'Patatas prefritas (congeladas)',
    category: 'Verduras',
    subcategory: 'Tubérculo',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 1.01,
    precio_por_gramo: 0.001016,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 1.016,
      Mercadona: 1.20,
    },
    current_stock: 0,
    min_stock: 5,
  },
  {
    name: 'Pimiento rojo',
    category: 'Verduras',
    subcategory: 'Fruto',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 1.50,
    precio_por_gramo: 0.001500,
    proveedor_principal: 'Mercadona',
    precios_por_proveedor: {
      Makro: 1.80,
      Mercadona: 1.50,
      Chino: 1.30,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Pimiento verde',
    category: 'Verduras',
    subcategory: 'Fruto',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 0.90,
    precio_por_gramo: 0.000900,
    proveedor_principal: 'Chino',
    precios_por_proveedor: {
      Makro: 1.10,
      Mercadona: 1.00,
      Chino: 0.90,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Espinacas (congeladas)',
    category: 'Verduras',
    subcategory: 'Hoja verde',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 1.20,
    precio_por_gramo: 0.001200,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 1.20,
      Mercadona: 1.50,
    },
    current_stock: 0,
    min_stock: 2,
  },
  {
    name: 'Brócoli',
    category: 'Verduras',
    subcategory: 'Crucífera',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 1.20,
    precio_por_gramo: 0.001200,
    proveedor_principal: 'Mercadona',
    precios_por_proveedor: {
      Makro: 1.40,
      Mercadona: 1.20,
      Chino: 1.10,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Champiñones / Setas',
    category: 'Verduras',
    subcategory: 'Hongo',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 2.50,
    precio_por_gramo: 0.002500,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 2.50,
      Mercadona: 3.10,
      Chino: 2.20,
    },
    current_stock: 0,
    min_stock: 1,
  },
  // ── ACEITES, SALSAS Y CONDIMENTOS ─────────────────────────
  {
    name: 'Aceite de oliva virgen extra',
    category: 'Aceites y grasas',
    subcategory: 'Aceite',
    nutritional_category: 'Grasa saludable',
    unit: 'L',
    precio_mas_bajo: 4.20,
    precio_por_gramo: 0.004200,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 4.20,
      Mercadona: 5.50,
      'Star Cash&Carry': 3.90,
    },
    current_stock: 0,
    min_stock: 5,
  },
  {
    name: 'Sal',
    category: 'Condimentos',
    subcategory: 'Sal y especias',
    nutritional_category: 'Condimento',
    unit: 'Kg',
    precio_mas_bajo: 0.35,
    precio_por_gramo: 0.000350,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 0.35,
      Mercadona: 0.42,
    },
    current_stock: 0,
    min_stock: 2,
  },
  {
    name: 'Pimienta negra molida',
    category: 'Condimentos',
    subcategory: 'Sal y especias',
    nutritional_category: 'Condimento',
    unit: 'Kg',
    precio_mas_bajo: 8.50,
    precio_por_gramo: 0.008500,
    proveedor_principal: 'Chino',
    precios_por_proveedor: {
      Makro: 10.00,
      Chino: 8.50,
      'Star Cash&Carry': 9.20,
    },
    current_stock: 0,
    min_stock: 0.2,
  },
  {
    name: 'Curry en polvo',
    category: 'Condimentos',
    subcategory: 'Especias asiáticas',
    nutritional_category: 'Condimento',
    unit: 'Kg',
    precio_mas_bajo: 6.00,
    precio_por_gramo: 0.006000,
    proveedor_principal: 'Chino',
    precios_por_proveedor: {
      Makro: 8.00,
      Chino: 6.00,
      'Star Cash&Carry': 7.00,
    },
    current_stock: 0,
    min_stock: 0.2,
  },
  {
    name: 'Salsa de soja',
    category: 'Condimentos',
    subcategory: 'Salsas asiáticas',
    nutritional_category: 'Condimento',
    unit: 'L',
    precio_mas_bajo: 2.50,
    precio_por_gramo: 0.002500,
    proveedor_principal: 'Chino',
    precios_por_proveedor: {
      Makro: 3.20,
      Chino: 2.50,
      Mercadona: 3.00,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Caldo de pollo (tetrabrik)',
    category: 'Condimentos',
    subcategory: 'Caldos',
    nutritional_category: 'Condimento',
    unit: 'L',
    precio_mas_bajo: 0.90,
    precio_por_gramo: 0.000900,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 0.90,
      Mercadona: 1.10,
    },
    current_stock: 0,
    min_stock: 5,
  },
  {
    name: 'Tomate frito (bote)',
    category: 'Condimentos',
    subcategory: 'Salsas',
    nutritional_category: 'Vegetal',
    unit: 'Kg',
    precio_mas_bajo: 1.20,
    precio_por_gramo: 0.001200,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 1.20,
      Mercadona: 1.40,
      'Star Cash&Carry': 1.10,
    },
    current_stock: 0,
    min_stock: 3,
  },
  // ── LEGUMBRES ──────────────────────────────────────────────
  {
    name: 'Garbanzos (cocidos, bote)',
    category: 'Legumbres',
    subcategory: 'Legumbre',
    nutritional_category: 'Proteína vegetal',
    unit: 'Kg',
    precio_mas_bajo: 1.00,
    precio_por_gramo: 0.001000,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 1.00,
      Mercadona: 1.20,
      Chino: 0.85,
    },
    current_stock: 0,
    min_stock: 2,
  },
  {
    name: 'Lentejas',
    category: 'Legumbres',
    subcategory: 'Legumbre',
    nutritional_category: 'Proteína vegetal',
    unit: 'Kg',
    precio_mas_bajo: 1.10,
    precio_por_gramo: 0.001100,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 1.10,
      Mercadona: 1.30,
    },
    current_stock: 0,
    min_stock: 2,
  },
  // ── CEREALES DESAYUNO ──────────────────────────────────────
  {
    name: 'Cereales de arroz con chocolate',
    category: 'Cereales',
    subcategory: 'Desayuno',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 3.10,
    precio_por_gramo: 0.003100,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 3.10,
      Mercadona: 3.50,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Muesli',
    category: 'Cereales',
    subcategory: 'Desayuno',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 1.90,
    precio_por_gramo: 0.001900,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 1.90,
      Mercadona: 2.20,
    },
    current_stock: 0,
    min_stock: 1,
  },
  // ── CONSERVAS Y VARIOS ─────────────────────────────────────
  {
    name: 'Aceitunas negras',
    category: 'Conservas',
    subcategory: 'Aceitunas',
    nutritional_category: 'Grasa saludable',
    unit: 'Kg',
    precio_mas_bajo: 3.50,
    precio_por_gramo: 0.003500,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 3.50,
      Mercadona: 4.20,
      Chino: 3.10,
    },
    current_stock: 0,
    min_stock: 0.5,
  },
  {
    name: 'Maíz en lata',
    category: 'Conservas',
    subcategory: 'Legumbre',
    nutritional_category: 'Hidrato de carbono',
    unit: 'Kg',
    precio_mas_bajo: 0.90,
    precio_por_gramo: 0.000900,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 0.90,
      Mercadona: 1.10,
      Chino: 0.80,
    },
    current_stock: 0,
    min_stock: 1,
  },
  {
    name: 'Zumo de naranja (brick)',
    category: 'Bebidas',
    subcategory: 'Zumos',
    nutritional_category: 'Bebida',
    unit: 'L',
    precio_mas_bajo: 1.20,
    precio_por_gramo: 0.001200,
    proveedor_principal: 'Makro',
    precios_por_proveedor: {
      Makro: 1.20,
      Mercadona: 1.50,
      'Star Cash&Carry': 1.10,
    },
    current_stock: 0,
    min_stock: 10,
  },
];

// ── Función principal de seed ──────────────────────────────────────────────
async function seed() {
  console.log(`\n🌱 Iniciando seed de ${INSUMOS.length} insumos en Supabase...\n`);

  // Step 1: Run migration (add columns if missing)
  const migrationSQL = `
    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS precio_mas_bajo NUMERIC(12, 6) DEFAULT NULL;
    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS precio_por_gramo NUMERIC(12, 6) DEFAULT NULL;
    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS proveedor_principal VARCHAR(255) DEFAULT NULL;
    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS precios_por_proveedor JSONB DEFAULT '{}'::jsonb;
  `;

  // NOTE: RPC is needed for raw SQL if using anon key.
  // For service_role key, we can use the REST API or run the SQL via Supabase Dashboard.
  console.log('📋 Columnas que se añadirán si no existen:');
  console.log('   - precio_mas_bajo (NUMERIC)');
  console.log('   - precio_por_gramo (NUMERIC)');
  console.log('   - proveedor_principal (VARCHAR)');
  console.log('   - precios_por_proveedor (JSONB)\n');

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const insumo of INSUMOS) {
    try {
      // Upsert by name (unique constraint)
      const { data, error } = await supabase
        .from('ingredients')
        .upsert(
          {
            name: insumo.name,
            category: insumo.category,
            subcategory: insumo.subcategory,
            nutritional_category: insumo.nutritional_category,
            unit: insumo.unit,
            precio_mas_bajo: insumo.precio_mas_bajo,
            precio_por_gramo: insumo.precio_por_gramo,
            proveedor_principal: insumo.proveedor_principal,
            precios_por_proveedor: insumo.precios_por_proveedor,
            current_stock: insumo.current_stock ?? 0,
            min_stock: insumo.min_stock ?? 0,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'name',
            ignoreDuplicates: false,
          }
        )
        .select('id, name');

      if (error) {
        // If precios columns don't exist yet (migration not run), try without them
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.log(`⚠️  Columnas de precios no existen aún. Ejecuta primero la migración SQL.`);
          console.log(`   Archivo: migrations/001_alter_ingredients_add_insumos_fields.sql\n`);
          process.exit(1);
        }
        console.error(`❌ Error en ${insumo.name}: ${error.message}`);
        errors++;
      } else {
        const action = data && data.length > 0 ? 'UPSERT' : 'SKIP';
        console.log(`✅ ${action}: ${insumo.name}`);
        inserted++;
      }
    } catch (err) {
      console.error(`❌ Excepción en ${insumo.name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 Resultado:`);
  console.log(`   ✅ Insertados/actualizados: ${inserted}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log(`   📦 Total procesados: ${INSUMOS.length}`);
  console.log(`${'─'.repeat(50)}\n`);

  if (errors === 0) {
    console.log(`🎉 ¡Seed completado con éxito! La tabla 'ingredients' está lista.`);
  } else {
    console.log(`⚠️  Seed completado con ${errors} errores. Revisa los logs.`);
  }
}

seed().catch(console.error);
