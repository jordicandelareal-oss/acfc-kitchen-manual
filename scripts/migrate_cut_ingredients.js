import { supabase } from '../lib/supabaseClient.js';

async function migrateCutIngredients() {
  console.log('=== STARTING CUT INGREDIENTS MIGRATION ===');

  // 1. Fetch original Pechuga and Contramuslo ingredients
  const { data: origPechuga } = await supabase
    .from('ingredients')
    .select('*')
    .ilike('name', 'Pechuga de pollo')
    .single();

  const { data: origContramuslo } = await supabase
    .from('ingredients')
    .select('*')
    .ilike('name', 'Contramuslo pollo')
    .single();

  if (!origPechuga || !origContramuslo) {
    console.error('Error: Original ingredients not found in DB');
    process.exit(1);
  }

  console.log('Original Pechuga found ID:', origPechuga.id);
  console.log('Original Contramuslo found ID:', origContramuslo.id);

  // 2. Define 8 target cut ingredients
  const pechugaCuts = [
    'Pechuga de Pollo Entera',
    'Pechuga de Pollo en Tacos',
    'Pechuga de Pollo para Guiso',
    'Pechuga de Pollo Picada'
  ];

  const contramusloCuts = [
    'Contramuslo de Pollo Entero',
    'Contramuslo de Pollo en Tacos',
    'Contramuslo de Pollo para Guiso',
    'Contramuslo de Pollo Picado'
  ];

  const buildPayload = (name, orig) => ({
    name,
    category: orig.category || 'Frescos',
    subcategory: orig.subcategory || 'Carne',
    nutritional_category: orig.nutritional_category || 'Proteina',
    unit: orig.unit || 'GR',
    precio_por_kg: orig.precio_por_kg || orig.purchase_price || 6.2,
    precio_por_u: orig.precio_por_u || null,
    precio_por_gramo: orig.precio_por_gramo || (orig.precio_por_kg ? orig.precio_por_kg / 1000 : 0.0062),
    precio_mas_bajo: orig.precio_mas_bajo || orig.purchase_price || 6.2,
    precios_por_proveedor: orig.precios_por_proveedor || { "Carniceria el Cairo": orig.purchase_price || 6.2 },
    purchase_format_gr: orig.purchase_format_gr || 1000,
    purchase_price: orig.purchase_price || 6.2,
    output_scenario: orig.output_scenario || 'KG_LT',
    waste_percentage: orig.waste_percentage || 0,
    calculated_net_cost_kg: orig.calculated_net_cost_kg || orig.purchase_price || 6.2,
    process_type: orig.process_type || 'MERMA',
    supplier_id: orig.supplier_id || 'd257d90b-ad0b-4f84-97a0-fee73612953c',
    stock_actual: 0,
    stock_minimo: 0,
    stock_maximo: 0,
    stock_reservado: 0
  });

  const createdMap = {};

  // Insert Pechuga cuts
  for (const name of pechugaCuts) {
    const { data: existing } = await supabase
      .from('ingredients')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      console.log(`Ingredient "${name}" already exists ID: ${existing.id}`);
      createdMap[name] = existing.id;
    } else {
      const payload = buildPayload(name, origPechuga);
      const { data: inserted, error } = await supabase
        .from('ingredients')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error(`Error inserting "${name}":`, error);
      } else {
        console.log(`Inserted ingredient "${name}" ID: ${inserted.id}`);
        createdMap[name] = inserted.id;
      }
    }
  }

  // Insert Contramuslo cuts
  for (const name of contramusloCuts) {
    const { data: existing } = await supabase
      .from('ingredients')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      console.log(`Ingredient "${name}" already exists ID: ${existing.id}`);
      createdMap[name] = existing.id;
    } else {
      const payload = buildPayload(name, origContramuslo);
      const { data: inserted, error } = await supabase
        .from('ingredients')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error(`Error inserting "${name}":`, error);
      } else {
        console.log(`Inserted ingredient "${name}" ID: ${inserted.id}`);
        createdMap[name] = inserted.id;
      }
    }
  }

  // 3. Re-link recipe_ingredients
  console.log('\n--- RE-LINKING RECIPE INGREDIENTS ---');

  const { data: riPechuga } = await supabase
    .from('recipe_ingredients')
    .select('*, recipes(name)')
    .eq('ingredient_id', origPechuga.id);

  if (riPechuga && riPechuga.length > 0) {
    for (const ri of riPechuga) {
      let targetCutName = 'Pechuga de Pollo Entera';
      let validEnumCorte = 'Entero/a';
      const corte = (ri.tipo_corte || '').toLowerCase();
      const rName = (ri.recipes?.name || '').toLowerCase();

      if (corte.includes('guiso') || rName.includes('curry') || rName.includes('aji') || rName.includes('stew') || rName.includes('cream')) {
        targetCutName = 'Pechuga de Pollo para Guiso';
        validEnumCorte = 'Guiso';
      } else if (corte.includes('tacos') || rName.includes('tacos') || rName.includes('salad') || rName.includes('shredded') || rName.includes('taboule') || rName.includes('cous')) {
        targetCutName = 'Pechuga de Pollo en Tacos';
        validEnumCorte = 'Tacos';
      } else if (corte.includes('picada') || rName.includes('picada') || rName.includes('minced')) {
        targetCutName = 'Pechuga de Pollo Picada';
        validEnumCorte = 'Picada';
      } else if (corte.includes('entero') || corte.includes('entera')) {
        targetCutName = 'Pechuga de Pollo Entera';
        validEnumCorte = 'Entero/a';
      }

      const targetId = createdMap[targetCutName];
      if (targetId) {
        const { error: uErr } = await supabase
          .from('recipe_ingredients')
          .update({ ingredient_id: targetId, tipo_corte: validEnumCorte })
          .eq('id', ri.id);

        if (uErr) {
          console.error(`Error re-linking recipe_ingredient ${ri.id}:`, uErr);
        } else {
          console.log(`Re-linked recipe "${ri.recipes?.name}" -> ${targetCutName}`);
        }
      }
    }
  }

  const { data: riContramuslo } = await supabase
    .from('recipe_ingredients')
    .select('*, recipes(name)')
    .eq('ingredient_id', origContramuslo.id);

  if (riContramuslo && riContramuslo.length > 0) {
    for (const ri of riContramuslo) {
      let targetCutName = 'Contramuslo de Pollo Entero';
      let validEnumCorte = 'Entero/a';
      const corte = (ri.tipo_corte || '').toLowerCase();
      const rName = (ri.recipes?.name || '').toLowerCase();

      if (corte.includes('guiso') || rName.includes('guiso') || rName.includes('curry') || rName.includes('stew')) {
        targetCutName = 'Contramuslo de Pollo para Guiso';
        validEnumCorte = 'Guiso';
      } else if (corte.includes('tacos') || rName.includes('tacos') || rName.includes('pesto')) {
        targetCutName = 'Contramuslo de Pollo en Tacos';
        validEnumCorte = 'Tacos';
      } else if (corte.includes('picado') || corte.includes('picada')) {
        targetCutName = 'Contramuslo de Pollo Picado';
        validEnumCorte = 'Picada';
      }

      const targetId = createdMap[targetCutName];
      if (targetId) {
        const { error: uErr } = await supabase
          .from('recipe_ingredients')
          .update({ ingredient_id: targetId, tipo_corte: validEnumCorte })
          .eq('id', ri.id);

        if (uErr) {
          console.error(`Error re-linking recipe_ingredient ${ri.id}:`, uErr);
        } else {
          console.log(`Re-linked recipe "${ri.recipes?.name}" -> ${targetCutName}`);
        }
      }
    }
  }

  console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

migrateCutIngredients().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
