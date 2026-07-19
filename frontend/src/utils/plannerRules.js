/**
 * Reglas de negocio y nutricionales para la generación automática de menús.
 */
export const PLANNER_RULES = {
  // Reglas fijas del sistema
  sistema: {
    maxCarneRojaSemana: 2,
    minLegumbresSemana: 1,
    minPescadoSemana: 1,
    maxPastaSemana: 2,
    desayunoDefaultId: 'd9b736b4-2db2-4809-913a-c80f4f81c944' // ID por defecto de Café con leche / Desayuno base
  },
  
  // Reglas especiales configurables (guardadas en localStorage por el usuario)
  getSettings() {
    return {
      incluirEspeciales: localStorage.getItem('menu_setting_incluir_especiales') === 'true',
      menuSencilloFDS: localStorage.getItem('menu_setting_sencillo_fds') === 'true'
    };
  },

  // Algoritmo de filtrado y selección inteligente de recetas basado en reglas nutricionales
  filtrarRecetas(recipes, settings, isWeekend = false) {
    const { incluirEspeciales, menuSencilloFDS } = settings;
    
    return recipes.filter(recipe => {
      // 1. Regla de Especiales
      if (recipe.category === 'Especiales' && !incluirEspeciales) {
        return false;
      }

      // 2. Regla de Fin de Semana Sencillo
      if (isWeekend && menuSencilloFDS) {
        // Filtra para fin de semana recetas que tengan tiempo de elaboración bajo (< 30 min) o categoría rápida
        const tiempo = Number(recipe.cook_time || recipe.tiempo_elaboracion) || 30;
        if (tiempo > 30) return false;
      }

      return true;
    });
  }
};
