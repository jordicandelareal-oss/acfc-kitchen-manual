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
 * @param {Array} meals Lista de comidas del planificador.
 * @returns {Object} Mapa de necesidades agrupadas.
 */
export function agruparInsumos(meals) {
  const needs = {};
  let uniqueCounter = 0;
  
  const EL_CAIRO_UUID = 'd257d90b-ad0b-4f84-97a0-fee73612953c';
  const checkCairo = (s) => s && s.toLowerCase().includes('cairo');
  
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
      
      const isElCairo = supplierId === EL_CAIRO_UUID ||
                        checkCairo(supplierName) ||
                        checkCairo(ing.provider_name) ||
                        checkCairo(ing.proveedor_principal);
                        
      // El Cairo exige desglose por plato/corte sin agrupar por ingrediente general,
      // por lo que generamos una llave única para cada aparición de carne del Cairo.
      const key = isElCairo 
        ? `elcairo_${ingId}_${uniqueCounter++}` 
        : ingId;
        
      const displayName = isElCairo
        ? `${ing.name} ${ri.tipo_corte || 'entera'}`
        : (ing.name || 'Sin nombre');
        
      if (!needs[key]) {
        needs[key] = {
          name: displayName,
          quantity: 0,
          unit: ri.unit || 'Gr',
          supplierId: supplierId,
          supplierName: supplierName,
          supplierObj: hasSupplierObj ? ing.suppliers : null,
          isElCairo: isElCairo,
          ingName: ing.name,
          tipoCorte: ri.tipo_corte || 'entera'
        };
      }
      needs[key].quantity += totalNeeded;
    });
  });
  
  return needs;
}
