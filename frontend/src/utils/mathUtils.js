/**
 * Centralización de fórmulas matemáticas y algoritmos de negocio de ACFC Kitchen.
 */

/**
 * Calcula el coste base por kilogramo/litro o por unidad.
 * @param {number} price Precio de compra.
 * @param {number} format Formato de compra (en gramos/mililitros o unidades).
 * @param {string} scenario Escenario de salida ("KG_LT" o "UNIDADES").
 * @returns {number} Coste base.
 */
export function calcularCosteBase(price, format, scenario) {
  if (format <= 0) return 0;
  if (scenario === 'KG_LT') {
    return price / (format / 1000);
  }
  return price / format;
}

/**
 * Calcula el coste neto aplicando mermas o hidrataciones.
 * @param {number} baseCost Coste base.
 * @param {number} pct Porcentaje de merma o hidratación.
 * @param {string} processType Tipo de proceso ("MERMA" o "HIDRATACION").
 * @returns {number} Coste neto por KG o unidad.
 */
export function calcularCosteNeto(baseCost, pct, processType) {
  if (processType === 'MERMA') {
    const divisor = 1 - (pct / 100);
    return divisor > 0 ? baseCost / divisor : 0;
  }
  // HIDRATACION
  return baseCost / (1 + (pct / 100));
}

/**
 * Calcula el coste total por línea de un ingrediente según su tipo de salida (KG/LT vs UNIDADES)
 * contemplando el precio neto por KG real (con merma/hidratación) o precio por unidad.
 * @param {Object} item Objeto del ingrediente
 * @param {number} qtyToBuy Cantidad a comprar en gramos/ml o unidades
 * @returns {number} Coste total de la línea
 */
export function calcularCosteLineaIngrediente(item, qtyToBuy) {
  const qty = Number(qtyToBuy) || 0;
  if (qty <= 0) return 0;

  const unit = (item?.unit || '').toLowerCase();
  const scenario = item?.output_scenario || (['gr', 'g', 'kg', 'ml', 'l'].includes(unit) ? 'KG_LT' : 'UNIDADES');

  if (scenario === 'KG_LT' || ['gr', 'g', 'kg', 'ml', 'l'].includes(unit)) {
    let netCostKg = Number(item.calculated_net_cost_kg || item.coste_neto_calculado || 0);

    if (netCostKg <= 0) {
      const price = Number(item.purchase_price || item.precio_compra || item.precio_por_kg || item.precio_mas_bajo || 0);
      const formatGr = Number(item.purchase_format_gr || 1000);
      const baseCost = formatGr > 0 ? price / (formatGr / 1000) : price;
      
      const mermaPct = Number(item.waste_percentage || item.merma_percentage || 0);
      const processType = item.process_type || 'MERMA';

      netCostKg = calcularCosteNeto(baseCost, mermaPct, processType);
      if (netCostKg <= 0) netCostKg = baseCost;
    }

    return (qty / 1000) * netCostKg;
  } else {
    const unitPrice = Number(item.precio_por_u || item.purchase_price || item.precio_compra || item.precio_mas_bajo || 0);
    return qty * unitPrice;
  }
}

/**
 * Calcula el coste de una ración de plato basándose en sus ingredientes.
 * @param {Array} recipeIngredients Array de ingredientes de la receta.
 * @returns {number} Coste calculado.
 */
export function calcularCostePlato(recipeIngredients) {
  let cost = 0;
  (recipeIngredients || []).forEach(ri => {
    const ing = ri.ingredients || {};
    const qty = Number(ri.quantity_per_portion) || 0;
    const unit = ri.unit || 'Gr';
    const uLower = unit.toLowerCase();
    
    if (uLower === 'gr' || uLower === 'ml' || uLower === 'g') {
      cost += (qty / 1000) * Number(ing.calculated_net_cost_kg || 0);
    } else {
      cost += qty * Number(ing.precio_por_u || ing.precio_mas_bajo || 0);
    }
  });
  return cost;
}

/**
 * Agrupa insumos requeridos en la lista de la compra optimizando el algoritmo de Carnicería El Cairo.
 * Utiliza un mapa indexado de complejidad O(n) para evitar agrupaciones costosas de forma óptima.
 * Cada entrada incluye un array 'mealBreakdown' con el detalle por plato para simular
 * el consumo secuencial de stock (Simulación de Despensa).
 * @param {Array} meals Lista de comidas del planificador.
 * @returns {Object} Mapa de necesidades agrupadas.
 */
export function isElCairoSupplier(supplierName, supplierId, ingName, providerRef) {
  if (supplierId === 'd257d90b-ad0b-4f84-97a0-fee73612953c') return true;
  const str = `${supplierName || ''} ${ingName || ''} ${providerRef || ''}`.toLowerCase();
  return str.includes('cairo') || str.includes('samir');
}

/**
 * Genera bandejas independientes cronológicas para Carnicería El Cairo.
 * Aplica el stock físico actual disponible en la nevera de forma secuencial al primer plato que lo requiera.
 * Si queda déficit o si el stock es 0, genera una línea/bandeja independiente.
 */
export function generarBandejasCairoCronologicas(menuPlannerDays) {
  const sortedDays = [...(menuPlannerDays || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const cairoStockMap = {};
  const cairoTrays = [];

  sortedDays.forEach(day => {
    const dateStr = day.date || '';
    const lunchPlayers = Number(day.lunch_players || day.lunch_players_count || 25);
    const dinnerPlayers = Number(day.dinner_players || day.dinner_players_count || 20);
    const breakfastPlayers = Number(day.breakfast_players || day.breakfast_players_count || 20);

    const shifts = [
      { label: 'Desayuno', recipe: day.breakfast_recipe, players: breakfastPlayers },
      { label: 'Almuerzo', recipe: day.lunch_recipe, players: lunchPlayers },
      { label: 'Guarnición', recipe: day.lunch_side_recipe, players: lunchPlayers },
      { label: 'Cena', recipe: day.dinner_recipe, players: dinnerPlayers }
    ];

    shifts.forEach(shift => {
      if (!shift.recipe || !shift.recipe.recipe_ingredients || shift.players <= 0) return;

      shift.recipe.recipe_ingredients.forEach(ri => {
        const ing = ri.ingredients || ri.ingredient;
        if (!ing) return;

        const ingId = ing.id || ri.ingredient_id;
        const supplierObj = ing.suppliers || null;
        const supplierId = ing.supplier_id || supplierObj?.id || 'no-supplier';
        const supplierName = supplierObj?.name || ing.proveedor_principal || 'Carnicería El Cairo';
        const isElCairo = isElCairoSupplier(supplierName, supplierId, ing.name, ing.provider_ref);

        if (!isElCairo) return;

        const qtyPerPortion = Number(ri.quantity_per_portion || ri.quantity || 0);
        const dishNeeded = qtyPerPortion * shift.players;
        if (dishNeeded <= 0) return;

        if (cairoStockMap[ingId] === undefined) {
          cairoStockMap[ingId] = Number(ing.stock_actual || 0);
        }

        let remStock = cairoStockMap[ingId];
        let deficit = 0;

        if (remStock >= dishNeeded) {
          cairoStockMap[ingId] -= dishNeeded;
          deficit = 0;
        } else if (remStock > 0) {
          deficit = dishNeeded - remStock;
          cairoStockMap[ingId] = 0;
        } else {
          deficit = dishNeeded;
        }

        if (deficit > 0) {
          const corte = ri.tipo_corte || '';
          const rawName = ing.name || '';
          const hasCorteInName = corte && rawName.toLowerCase().includes(corte.toLowerCase());
          const displayName = (corte && !hasCorteInName && corte !== 'Entera' && corte !== 'Entero/a')
            ? `${rawName} (${corte})`
            : rawName;
          const cost = calcularCosteLineaIngrediente(ing, deficit);
          const unitStr = ri.unit || ing.unit || 'GR';

          cairoTrays.push({
            id: `cairo_${ingId}_${dateStr}_${shift.label}_${cairoTrays.length}`,
            ingredientId: ingId,
            name: displayName,
            rawName: rawName,
            tipoCorte: corte || 'Entera',
            neededQuantity: deficit,
            calculatedNeeded: deficit,
            dishNeeded: dishNeeded,
            unit: unitStr,
            totalCost: cost,
            unitPrice: Number(ing.calculated_net_cost_kg || ing.purchase_price || ing.precio_por_kg || 0),
            date: dateStr,
            mealLabel: shift.label,
            dishName: shift.recipe.name || '',
            supplierId: supplierId,
            supplierName: supplierName || 'Carnicería El Cairo',
            supplierObj: supplierObj,
            isElCairo: true
          });
        }
      });
    });
  });

  return cairoTrays;
}

/**
 * Agrupa insumos requeridos en la lista de la compra optimizando el algoritmo de Carnicería El Cairo.
 * Utiliza un mapa indexado de complejidad O(n) para evitar agrupaciones costosas de forma óptima.
 * Cada entrada incluye un array 'mealBreakdown' con el detalle por plato para simular
 * el consumo secuencial de stock (Simulación de Despensa).
 * @param {Array} meals Lista de comidas del planificador.
 * @returns {Object} Mapa de necesidades agrupadas.
 */
export function agruparInsumos(meals) {
  const needs = {};
  let uniqueCounter = 0;
  
  meals.forEach(meal => {
    (meal.recipe_ingredients || []).forEach(ri => {
      const ing = ri.ingredients;
      if (!ing) return;
      
      const ingId = ing.id;
      const qtyPerPortion = Number(ri.quantity_per_portion) || 0;
      const totalNeeded = qtyPerPortion * meal.players;
      
      const hasSupplierObj = ing.suppliers && typeof ing.suppliers === 'object';
      const supplierId = ing.supplier_id || (hasSupplierObj ? ing.suppliers.id : 'no-supplier');
      const supplierName = hasSupplierObj && ing.suppliers.name ? ing.suppliers.name : 'Sin Proveedor';
      
      const isElCairo = isElCairoSupplier(supplierName, supplierId, ing.name, ing.provider_ref || ing.proveedor_principal);
                        
      // El Cairo exige desglose por plato/corte sin agrupar por ingrediente general,
      // por lo que generamos una llave única para cada aparición de carne del Cairo.
      const key = isElCairo 
        ? `elcairo_${ingId}_${uniqueCounter++}` 
        : ingId;
        
      const corte = ri.tipo_corte || '';
      const rawName = ing.name || 'Sin nombre';
      const hasCorteInName = corte && rawName.toLowerCase().includes(corte.toLowerCase());
      const displayName = (corte && !hasCorteInName && corte !== 'Entera' && corte !== 'Entero/a')
        ? `${rawName} (${corte})`
        : rawName;
        
      const dayNames = {
        6: 'Lunes',
        7: 'Martes',
        8: 'Miércoles',
        9: 'Jueves',
        10: 'Viernes',
        11: 'Sábado',
        12: 'Domingo'
      };
      const dayName = dayNames[meal.day] || `Día ${meal.day}`;
      const destStr = meal.recipeName ? `${meal.recipeName} (${meal.mealLabel} ${dayName})` : '';

      if (!needs[key]) {
        needs[key] = {
          name: displayName,
          ingredientId: ingId,
          quantity: 0,
          unit: ri.unit || 'Gr',
          supplierId: supplierId,
          supplierName: supplierName,
          supplierObj: hasSupplierObj ? ing.suppliers : null,
          isElCairo: isElCairo,
          ingName: ing.name,
          rawName: ing.name,
          tipoCorte: ri.tipo_corte || 'Entera',
          destinations: [],
          // Per-dish breakdown for sequential stock simulation
          mealBreakdown: []
        };
      }
      needs[key].quantity += totalNeeded;
      // Store per-dish detail: label + raw needed quantity (before stock offset)
      needs[key].mealBreakdown.push({ label: destStr || meal.mealLabel, needed: totalNeeded });

      if (destStr && !needs[key].destinations.includes(destStr)) {
        needs[key].destinations.push(destStr);
      }
    });
  });
  
  return needs;
}

/**
 * Formateadores de moneda y unidades.
 */
export function fmt(n, dec = 4) {
  return n != null && !isNaN(n) ? `€${Number(n).toFixed(dec)}` : '—';
}

export function fmtKg(n) {
  return n != null && !isNaN(n) ? `€${Number(n).toFixed(2)}/kg` : null;
}

export function fmtU(n) {
  return n != null && !isNaN(n) ? `€${Number(n).toFixed(2)}/u` : null;
}

/**
 * Compila el mensaje formateado para enviar por WhatsApp o Email a un proveedor.
 * Para Carnicería El Cairo, oculta el nombre de la receta y muestra cada línea por separado:
 * [Ingrediente] ([Tipo de Corte]) - [Cantidad] [Unidad]
 */
export function formatSupplierMessage(supplierName, itemsList, isElCairo = false) {
  const isCairoSupplier = isElCairo || isElCairoSupplier(supplierName);
  if (isCairoSupplier) {
    let msg = `Hola, pedido ACFC Kitchen (Carnicería El Cairo):\n\n`;
    (itemsList || []).forEach(item => {
      const rawName = item.rawName || (item.name || item.nombre_ingrediente || '').replace(/\s*\([^)]*\)/g, '').trim();
      const corte = item.tipoCorte || item.tipo_corte || item.corte || '';
      const qtyVal = item.neededQuantity !== undefined ? item.neededQuantity : (item.a_comprar !== undefined ? item.a_comprar : (item.quantity || 0));
      const unit = item.unit || 'Kg';
      
      let qtyStr = `${qtyVal} ${unit}`;
      if ((unit.toLowerCase() === 'gr' || unit.toLowerCase() === 'g') && Number(qtyVal) >= 1000) {
        qtyStr = `${(Number(qtyVal) / 1000).toFixed(2)} Kg`;
      } else if (unit.toLowerCase() === 'gr' || unit.toLowerCase() === 'g') {
        qtyStr = `${Number(qtyVal)} g`;
      }

      const lowerRaw = rawName.toLowerCase();
      const lowerCorte = corte.toLowerCase();
      const isEntera = lowerCorte.startsWith('entera') || lowerCorte.startsWith('entero') || lowerRaw.includes('entera') || lowerRaw.includes('entero');
      const hasCorteInName = corte && lowerRaw.includes(lowerCorte);
      const label = (corte && !hasCorteInName && !isEntera) ? `${rawName} (${corte})` : rawName;

      msg += `- ${label} - ${qtyStr}\n`;
    });
    msg += `\nMuchas gracias!`;
    return msg;
  } else {
    let msg = `Hola, pedido ACFC Kitchen (${supplierName || 'Proveedor'}):\n\n`;
    (itemsList || []).forEach(item => {
      const qtyVal = item.neededQuantity !== undefined ? item.neededQuantity : (item.a_comprar !== undefined ? item.a_comprar : (item.quantity || 0));
      const unit = item.unit || 'Kg';
      let qtyStr = `${qtyVal} ${unit}`;
      if ((unit.toLowerCase() === 'gr' || unit.toLowerCase() === 'g') && Number(qtyVal) >= 1000) {
        qtyStr = `${(Number(qtyVal) / 1000).toFixed(2)} Kg`;
      }
      msg += `- ${item.name || item.nombre_ingrediente} - ${qtyStr}\n`;
    });
    msg += `\nMuchas gracias!`;
    return msg;
  }
}


