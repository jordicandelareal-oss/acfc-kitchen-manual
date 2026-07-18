import { useMemo } from 'react';

export function calculateRecipe(recipe) {
  if (!recipe) return { parsedIngredients: [], totalCost: 0, totalGrams: 0, portions: 1, costPerPortion: 0, totalRecipeCost: 0, suggestedPrice: 0 };

  let totalCost = 0;
  let totalGrams = 0;
  
  const parsedIngredients = (recipe.recipe_ingredients || []).map(ri => {
    const ing = ri.ingredients || {};
    const qty = Number(ri.quantity) || Number(ri.quantity_per_portion) || 0;
    const unit = ri.unit || 'Gr';
    const nutritionalCategory = ing.nutritional_category || ing.category || 'Sin asignar';
    
    let itemCost = 0;
    let unitCostText = "0.00€";
    const uLower = unit.toLowerCase();
    
    if (uLower === 'gr' || uLower === 'ml' || uLower === 'g') {
      const costPerKg = Number(ing.calculated_net_cost_kg || ing.precio_mas_bajo || ing.precio_por_kg || 0);
      itemCost = (qty / 1000) * costPerKg;
      unitCostText = `${costPerKg.toFixed(2)}€/kg`;
      totalGrams += qty;
    } else {
      const costPerUnit = Number(ing.precio_por_u || ing.precio_mas_bajo || 0);
      itemCost = qty * costPerUnit;
      unitCostText = `${costPerUnit.toFixed(2)}€/ud`;
    }
    
    totalCost += itemCost;
    
    return {
      id: ing.id,
      name: ing.name || 'Sin nombre',
      nutritional_category: nutritionalCategory,
      qty: `${qty} ${unit}`,
      rawQty: qty,
      unit: unit,
      unitCostText,
      waste_percentage: Number(ing.waste_percentage) || 0,
      cost: itemCost
    };
  });

  const portions = Number(recipe.portions) || 1;
  const costPerPortion = totalCost;
  const totalRecipeCost = totalCost * portions;
  const suggestedPrice = costPerPortion / 0.30; 

  return {
    parsedIngredients,
    totalCost,
    totalGrams,
    portions,
    costPerPortion,
    totalRecipeCost,
    suggestedPrice
  };
}

export default function useRecipeCalculations(recipe) {
  return useMemo(() => calculateRecipe(recipe), [recipe]);
}
